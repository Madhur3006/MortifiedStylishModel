# Low Level Design (LLD)
# MortifiedStylishModel — ONGC Live Institutional Dashboard

**Document Version:** 1.1  
**Date:** May 14, 2026  
**Last Updated:** May 14, 2026 (v1.1 — runtime stability hardening)
**Classification:** Architect Review  
**System Codename:** MortifiedStylishModel  
**Companion Document:** HLD.md

---

## Table of Contents

1. [Module Overview](#1-module-overview)
2. [Backend Module — server.js](#2-backend-module--serverjs)
   - 2.1 fetchWithTimeout
   - 2.2 getNSESession
   - 2.3 Route: /api/quote/:symbol
   - 2.4 Route: /api/optionchain/:symbol
   - 2.5 Route: /api/nsequote/:symbol
   - 2.6 Route: /api/health
   - 2.7 SPA Fallback Route
3. [Frontend Data Layer — public/index.html](#3-frontend-data-layer--publicindexhtml)
   - 3.1 fetchYF
   - 3.2 fetchNSEOptionChain
   - 3.3 parseYF
4. [Technical Indicator Functions](#4-technical-indicator-functions)
   - 4.1 calcSMA
   - 4.2 calcVWAP
   - 4.3 calcRSI
   - 4.4 calcPivotPoints
   - 4.5 calcBollingerBands
5. [Chart Rendering Modules](#5-chart-rendering-modules)
   - 5.1 initPriceChart
   - 5.2 updatePriceChart
   - 5.3 Radar Chart (updateRadar)
6. [Display Update Functions](#6-display-update-functions)
   - 6.1 updateTile
   - 6.2 updateSR (Support & Resistance)
   - 6.3 updateVWAP
   - 6.4 updateTechSignals
   - 6.5 updateMacroFactors
7. [Option Chain Analytics](#7-option-chain-analytics)
   - 7.1 parseOptionChain
   - 7.2 updateOptionChain
8. [Intraday Bias Algorithm](#8-intraday-bias-algorithm)
   - 8.1 updateTraderAssessment
9. [State Management & Refresh Engine](#9-state-management--refresh-engine)
   - 9.1 Global State Object
   - 9.2 refreshAll
   - 9.3 startCountdown
10. [Market Status Detection](#10-market-status-detection)
11. [Data Structures & Type Definitions](#11-data-structures--type-definitions)
12. [Error Handling Matrix](#12-error-handling-matrix)
13. [Constants & Configuration](#13-constants--configuration)
14. [Dependency Map](#14-dependency-map)

---

## 1. Module Overview

The system consists of two primary code files:

```
workspace/
├── server.js              Backend proxy server (Node.js + Express 5)
├── public/
│   └── index.html         Frontend SPA (HTML + Vanilla JS)
├── package.json           Node.js project manifest
└── docs/
    ├── HLD.md             This document's companion
    └── LLD.md             This document
```

### Module Dependency Graph

```
server.js
├── express (npm)
├── path (Node stdlib)
└── fetch (Node 18+ built-in)

public/index.html (browser)
├── lightweight-charts@4.2.0 (CDN unpkg)
├── chart.js@4.4.0 (CDN jsdelivr)
├── tailwindcss (CDN)
└── Vanilla JS ES2020
    ├── window.onerror / unhandledrejection  ← global error boundary (registered first)
    ├── fetchYF() → calls /api/quote/:symbol
    ├── fetchNSEOptionChain() → calls /api/optionchain/ONGC
    ├── parseYF()  ← with dedup + ascending sort
    ├── calcSMA / calcVWAP / calcRSI / calcPivotPoints / calcBollingerBands
    ├── initPriceChart (try/catch guarded in DOMContentLoaded)
    ├── updatePriceChart  ← per-series try/catch + fitContent guard + rsiData.length >= 2
    ├── updateSR / updateVWAP / updateTechSignals
    ├── updateMacroFactors / updateRadar
    ├── parseOptionChain  ← empty-strikes guard
    ├── updateOptionChain
    ├── updateTraderAssessment
    └── refreshAll / startCountdown / getMarketStatus
```

---

## 2. Backend Module — server.js

### 2.1 `fetchWithTimeout(url, options, timeoutMs)`

**Purpose:** Wraps the native `fetch()` call with a configurable abort timeout to prevent indefinite hangs on unresponsive upstream servers.

**Signature:**
```javascript
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs: number = 10000): Promise<Response>
```

**Algorithm:**
```
1. new AbortController()
2. timer = setTimeout(() => controller.abort(), timeoutMs)
3. try:
     res = await fetch(url, { ...options, signal: controller.signal })
     clearTimeout(timer)
     return res
4. catch:
     clearTimeout(timer)
     throw e          // caller handles
```

**Timeout values:**
| Use case | Timeout |
|---|---|
| Yahoo Finance quote data | 10,000ms |
| NSE option chain data | 10,000ms |
| NSE homepage session fetch | 8,000ms |

**Error behavior:** On timeout, `fetch()` throws `AbortError`. Caller receives the error and returns a 500 response to the browser.

---

### 2.2 `getNSESession()`

**Purpose:** Manages a server-side session cookie cache for NSE India. NSE requires valid session cookies to respond to API requests. This function obtains cookies by performing a homepage handshake and caches them to avoid repeated overhead.

**Signature:**
```javascript
async function getNSESession(): Promise<string>
```

**State:**
```javascript
let nseSession = {
  cookies: '',       // semicolon-joined cookie string
  lastFetch: 0       // Unix ms timestamp of last successful fetch
}
```

**Algorithm:**
```
1. now = Date.now()
2. if nseSession.cookies !== '' AND (now - nseSession.lastFetch) < 300_000ms:
     return nseSession.cookies    // cache hit, skip handshake

3. res = await fetchWithTimeout('https://www.nseindia.com/', NSE_BASE_HEADERS, 8000)
4. setCookieHeader = res.headers.getSetCookie()   // Node 18+ API
5. nseSession.cookies = setCookieHeader
     .map(c => c.split(';')[0])                    // take "name=value" only
     .join('; ')
6. nseSession.lastFetch = Date.now()
7. return nseSession.cookies

8. on error:
     console.warn(...)
     return ''        // empty string = no cookie; NSE may return 403
```

**Cookie format returned:** `"bm_sz=abc123; ak_bmsc=xyz789; nsit=token"`

**Cache TTL:** 300,000ms (5 minutes)

**Note:** If NSE changes its authentication mechanism or rotates cookie names, only this function needs updating.

---

### 2.3 Route: `GET /api/quote/:symbol`

**Purpose:** Proxies a Yahoo Finance v8 Chart API request server-side, bypassing CORS restrictions that prevent direct browser access.

**Parameters:**
| Param | Source | Description |
|---|---|---|
| `:symbol` | URL path | Yahoo Finance symbol (e.g. `ONGC.NS`, `BZ=F`) |
| `interval` | Query string | Candle interval, default `5m` |
| `range` | Query string | Date range, default `1d` |

**Request construction:**
```javascript
const url = `https://query1.finance.yahoo.com/v8/finance/chart/
             ${encodeURIComponent(symbol)}
             ?interval=${interval}
             &range=${range}
             &includePrePost=false
             &events=div%7Csplit`
```

**Headers sent to Yahoo Finance:**
```javascript
{
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://finance.yahoo.com/',
  'Origin': 'https://finance.yahoo.com'
}
```

**Response:** Raw Yahoo Finance JSON, with `Cache-Control: no-store` header set on the Express response.

**Error handling:**
- HTTP 4xx/5xx from Yahoo → forwarded to browser with same status code
- Network/timeout error → 500 + `{error: message}`

---

### 2.4 Route: `GET /api/optionchain/:symbol`

**Purpose:** Proxies NSE India's option chain equities API with session cookie authentication.

**Parameters:**
| Param | Source | Description |
|---|---|---|
| `:symbol` | URL path | NSE symbol, uppercased (e.g. `ONGC`) |

**Process:**
```
1. cookies = await getNSESession()
2. url = `https://www.nseindia.com/api/option-chain-equities?symbol=${symbol.toUpperCase()}`
3. r = await fetchWithTimeout(url, { ...NSE_BASE_HEADERS, Cookie: cookies }, 10000)
4. if !r.ok → return status + { error }
5. data = await r.json()
6. return data with Cache-Control: no-store
```

**Response structure (abbreviated):**
```json
{
  "records": {
    "data": [
      {
        "strikePrice": 295,
        "CE": { "openInterest": 123456, "changeinOpenInterest": 100, ... },
        "PE": { "openInterest": 654321, "changeinOpenInterest": -50, ... }
      },
      ...
    ],
    "expiryDates": ["29-May-2026", ...],
    "timestamp": "14-May-2026 15:30:00"
  }
}
```

---

### 2.5 Route: `GET /api/nsequote/:symbol`

**Purpose:** Returns the live NSE equity quote for a symbol. Used as a backup price source if Yahoo Finance is unavailable.

**Process:** Identical to `/api/optionchain/` but hits `/api/quote-equity?symbol=`.

**Response (abbreviated):**
```json
{
  "priceInfo": {
    "lastPrice": 297.15,
    "change": 2.65,
    "pChange": 0.90,
    "open": 294.5,
    "close": 297.15
  }
}
```

---

### 2.6 Route: `GET /api/health`

**Purpose:** Liveness probe for monitoring and deployment verification.

**Response:**
```json
{ "ok": true, "time": "2026-05-14T09:30:00.000Z" }
```

---

### 2.7 SPA Fallback Route

```javascript
app.get('/*splat', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
)
```

**Note on Express 5 Compatibility:** Express 5 uses `path-to-regexp` v8 which no longer accepts bare `*` wildcards. The named wildcard syntax `/*splat` is required. This was a breaking change from Express 4.

---

## 3. Frontend Data Layer — public/index.html

### 3.1 `fetchYF(symbol, interval, range)`

**Purpose:** Calls the backend `/api/quote/` proxy and returns raw Yahoo Finance JSON.

**Signature:**
```javascript
async function fetchYF(symbol: string, interval = '5m', range = '1d'): Promise<object|null>
```

**Implementation:**
```javascript
async function fetchYF(symbol, interval='5m', range='1d') {
  try {
    const res = await fetch(`/api/quote/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`);
    if (!res.ok) throw new Error(`API returned ${res.status}`);
    return await res.json();
  } catch(e) {
    console.warn('fetchYF failed for', symbol, e.message);
    return null;    // caller must handle null
  }
}
```

**Error contract:** Returns `null` on any failure. All callers check for null before proceeding.

---

### 3.2 `fetchNSEOptionChain(symbol)`

**Purpose:** Calls the backend `/api/optionchain/` proxy and returns raw NSE option chain JSON.

**Signature:**
```javascript
async function fetchNSEOptionChain(symbol = 'ONGC'): Promise<object|null>
```

**Returns `null` on error.** The option chain is considered non-critical; the dashboard functions fully without it (with Max Pain falling back to Pivot P).

---

### 3.3 `parseYF(data)`

**Purpose:** Transforms raw Yahoo Finance v8 chart JSON into a structured `ParsedQuote` object used throughout the application. Includes timestamp deduplication and ascending sort to prevent Lightweight Charts from throwing on out-of-order data.

**Signature:**
```javascript
function parseYF(data: object): ParsedQuote | null
```

**Algorithm:**
```
1. Guard: if !data?.chart?.result?.[0] → return null
2. r = data.chart.result[0]
3. meta = r.meta
4. ts = r.timestamp || []
5. q = r.indicators?.quote?.[0] || {}
6. Build raw candles[]:
   for i in ts:
     if closes[i] == null → skip (filter out pre/post market nulls)
     push { time: ts[i], open: opens[i] ?? closes[i],
             high: highs[i] ?? closes[i],
             low: lows[i] ?? closes[i],
             close: closes[i],
             volume: vols[i] ?? 0 }
7. Deduplicate by timestamp (keep last occurrence per timestamp):
   seen = new Set()
   candles = rawCandles
     .reverse()
     .filter(c => { if seen.has(c.time) return false; seen.add(c.time); return true })
     .reverse()
8. Sort ascending by time:
   candles.sort((a, b) => a.time - b.time)
9. price = meta.regularMarketPrice
10. prev = meta.chartPreviousClose || meta.previousClose
11. change = price - prev
12. changePct = (change / prev) * 100
13. return { meta, candles, price, prev, change, changePct,
               dayHigh, dayLow, open, volume, currency }
```

**Null handling:** `open`, `high`, `low` candle fields fall back to `close` if null, preventing chart rendering errors for instruments with partial data.

**Why deduplication and sort are required:** Yahoo Finance v8 occasionally returns duplicate timestamps (e.g., two rows for the same 5-minute bar) or non-monotonic sequences during market open and close transitions. Lightweight Charts v4 throws the string `"data must be asc"` if `setData()` receives non-strictly-ascending timestamps — this is a library invariant. The dedup+sort step in `parseYF` ensures this invariant is always met before any chart series is touched.

---

## 4. Technical Indicator Functions

All indicator functions operate on the `candles[]` array returned by `parseYF()`. All return arrays in the format `[{ time: unix_seconds, value: number }]` compatible with Lightweight Charts `LineSeries.setData()`.

---

### 4.1 `calcSMA(candles, period)`

**Purpose:** Simple Moving Average — rolling mean of close prices over `period` bars.

**Signature:**
```javascript
function calcSMA(candles: Candle[], period: number): LinePoint[]
```

**Algorithm:**
```
for i from 0 to candles.length - 1:
  if i < period - 1:
    result.push(null)          // not enough data yet
    continue
  sum = Σ candles[i - period + 1 .. i].close
  result.push({ time: candles[i].time, value: sum / period })

return result.filter(x => x !== null)
```

**Time complexity:** O(n × period). Can be optimized to O(n) with a sliding window sum if performance is needed for large datasets.

**Usage:** `calcSMA(candles, 20)` → SMA-20 chart overlay; `calcSMA(candles, 50)` → SMA-50 signal.

---

### 4.2 `calcVWAP(candles)`

**Purpose:** Volume-Weighted Average Price — the volume-weighted mean of typical prices from session open to the current bar. Resets each trading session.

**Signature:**
```javascript
function calcVWAP(candles: Candle[]): LinePoint[]
```

**Formula:**
```
typicalPrice(i) = (high(i) + low(i) + close(i)) / 3
VWAP(i) = Σ(tp(j) × volume(j), j=0..i) / Σ(volume(j), j=0..i)
```

**Algorithm:**
```
cumPV = 0, cumV = 0
for each candle c:
  tp = (c.high + c.low + c.close) / 3
  cumPV += tp × c.volume
  cumV  += c.volume
  value = (cumV > 0) ? cumPV / cumV : c.close
  result.push({ time: c.time, value })
return result
```

**Institutional significance:** Traders use VWAP as an institutional benchmark. Price above VWAP = bullish intraday; price below = bearish. Used in both the chart overlay and the VWAP KPI tile.

---

### 4.3 `calcRSI(candles, period)`

**Purpose:** Relative Strength Index — momentum oscillator ranging 0–100. Uses Wilder's smoothing method (exponential smoothing with alpha = 1/period).

**Signature:**
```javascript
function calcRSI(candles: Candle[], period = 14): LinePoint[]
```

**Algorithm:**
```
Phase 1 — Seed (first `period` changes):
  for i from 1 to period:
    d = candles[i].close - candles[i-1].close
    gains  += (d >= 0) ? d : 0
    losses += (d < 0)  ? -d : 0
  avgGain = gains / period
  avgLoss = losses / period
  push RSI at index period

Phase 2 — Wilder's rolling (index period+1 onward):
  for i from period+1 to end:
    d = candles[i].close - candles[i-1].close
    g = (d >= 0) ? d : 0
    l = (d < 0)  ? -d : 0
    avgGain = (avgGain × (period-1) + g) / period
    avgLoss = (avgLoss × (period-1) + l) / period
    rs    = (avgLoss === 0) ? 100 : avgGain / avgLoss
    rsi   = 100 - 100 / (1 + rs)
    push { time: candles[i].time, value: rsi }

return result
```

**Interpretation thresholds:**
| RSI Range | Signal | Display color |
|---|---|---|
| > 70 | Overbought | Red (#f43f5e) |
| 30 – 70 | Neutral | Amber (#fbbf24) |
| < 30 | Oversold | Green (#34d399) |

---

### 4.4 `calcPivotPoints(high, low, close)`

**Purpose:** Standard Pivot Points — a set of price levels derived from the previous session's High, Low, and Close. Used as the primary support/resistance framework.

**Signature:**
```javascript
function calcPivotPoints(high: number, low: number, close: number): PivotLevels
```

**Formulas:**
```
P  = (H + L + C) / 3                    Pivot (center of gravity)

R1 = 2P − L                             First resistance
R2 = P + (H − L)                        Second resistance
R3 = H + 2 × (P − L)                   Third resistance (gamma squeeze zone)

S1 = 2P − H                             First support
S2 = P − (H − L)                        Second support
S3 = L − 2 × (H − P)                   Third support (capitulation zone)
```

**Inputs used:**
- `high` = `parsed.dayHigh` from Yahoo Finance meta (or computed `max(candles[].high)` as fallback)
- `low` = `parsed.dayLow` from Yahoo Finance meta (or `min(candles[].low)` as fallback)
- `close` = `parsed.prev` (previous session close)

**Return type:**
```javascript
{ P, R1, R2, R3, S1, S2, S3 }   // all numbers, INR
```

---

### 4.5 `calcBollingerBands(candles, period, stdDev)`

**Purpose:** Bollinger Bands — a volatility envelope consisting of a rolling mean ± N standard deviations.

**Signature:**
```javascript
function calcBollingerBands(candles: Candle[], period = 20, stdDev = 2): BandPoint[]
```

**Algorithm:**
```
for i from period-1 to candles.length-1:
  slice = candles[i - period + 1 .. i].map(c => c.close)
  mean = Σ(slice) / period
  variance = Σ((x - mean)² for x in slice) / period
  sd = √variance
  push { time: candles[i].time,
         upper: mean + stdDev × sd,
         mid: mean,
         lower: mean - stdDev × sd }
return result
```

**Usage:** The last band value (`bands[bands.length-1]`) is used for the Technical Signals panel:
- Price > upper → "Upper Band Breach" (bearish exhaustion signal)
- Price < lower → "Lower Band Breach" (oversold signal)
- Price within → "Within Bands" (normal range)

---

## 5. Chart Rendering Modules

### 5.1 `initPriceChart()`

**Purpose:** Initializes all Lightweight Charts instances on page load. Creates three separate chart containers: price chart, volume chart, RSI chart.

**Chart Instances Created:**

| Variable | Type | Container | Height | Purpose |
|---|---|---|---|---|
| `lwChart` | `IChartApi` | `#priceChart` | 320px | Main candlestick chart |
| `lwSeries` | `ICandlestickSeriesApi` | lwChart | — | OHLC candles |
| `lwSma` | `ILineSeriesApi` | lwChart | — | SMA-20 overlay |
| `lwVwap` | `ILineSeriesApi` | lwChart | — | VWAP overlay (dashed) |
| `volChart` | `IChartApi` | `#volumeChart` | 60px | Volume histogram |
| `lwVolSeries` | `IHistogramSeriesApi` | volChart | — | Volume bars |
| `rsiChartInst` | `IChartApi` | `#rsiChart` | 120px | RSI oscillator |
| `rsiLineSeries` | `ILineSeriesApi` | rsiChartInst | — | RSI line |
| `__rsiOB` | `ILineSeriesApi` | rsiChartInst | — | Static overbought line (70) |
| `__rsiOS` | `ILineSeriesApi` | rsiChartInst | — | Static oversold line (30) |

**Theme configuration:**
```javascript
{
  layout: { background: { color: 'transparent' }, textColor: '#a1a1aa' },
  grid: { vertLines: { color: 'rgba(63,63,70,0.4)' }, horzLines: { color: 'rgba(63,63,70,0.4)' } },
  crosshair: { mode: CrosshairMode.Normal },
  rightPriceScale: { borderColor: 'rgba(63,63,70,0.5)' },
  timeScale: { borderColor: 'rgba(63,63,70,0.5)', timeVisible: true, secondsVisible: false }
}
```

**Candlestick colors:**
```javascript
{ upColor: '#34d399', downColor: '#f43f5e',   // green up, red down
  borderUpColor: '#34d399', borderDownColor: '#f43f5e',
  wickUpColor: '#34d399', wickDownColor: '#f43f5e' }
```

**Series overlays:**
```javascript
lwSma  = addLineSeries({ color: '#22d3ee', lineWidth: 1 })           // SMA-20: cyan solid
lwVwap = addLineSeries({ color: '#e879f9', lineWidth: 1.5,
                          lineStyle: LineStyle.Dashed })               // VWAP: pink dashed
```

**Window resize handler:** A single event listener calls `applyOptions({ width: el.clientWidth })` on all three chart instances when the browser window is resized.

---

### 5.2 `updatePriceChart(parsed)`

**Purpose:** Feeds a fresh `ParsedQuote` into all chart series. Hides the loading overlay on first successful update. Each `series.setData()` call is individually try/catch guarded so a failure in one series does not prevent the others from rendering.

**Signature:**
```javascript
function updatePriceChart(parsed: ParsedQuote): void
```

**Algorithm:**
```
1. Guard: if !parsed || !lwSeries → return

2. cdData = candles.map(c => ({ time, open, high, low, close }))
3. try { lwSeries.setData(cdData) } catch(e) { console.warn('candlestick setData', e) }

4. volData = candles.map(c => ({
     time, value: c.volume,
     color: c.close >= c.open ? 'rgba(52,211,153,0.5)' : 'rgba(244,63,94,0.5)'
   }))
5. try { lwVolSeries.setData(volData) } catch(e) { console.warn('volume setData', e) }

6. smaData = calcSMA(candles, 20)
7. try { lwSma.setData(smaData) } catch(e) { console.warn('SMA setData', e) }

8. vwapData = calcVWAP(candles)
9. try { lwVwap.setData(vwapData) } catch(e) { console.warn('VWAP setData', e) }

10. rsiData = calcRSI(candles, 14)
11. try { rsiLineSeries.setData(rsiData) } catch(e) { console.warn('RSI setData', e) }

12. if rsiData.length >= 2:          ← GUARD: require at least 2 points before drawing OB/OS lines
      Build obData / osData as constant lines spanning rsiData[0].time → rsiData[last].time
      try { __rsiOB.setData(obData) } catch(e) { console.warn('OB setData', e) }
      try { __rsiOS.setData(osData) } catch(e) { console.warn('OS setData', e) }
      Update RSI value display with color coding (red > 70, green < 30, amber otherwise)

13. chartOverlay.style.display = 'none'
14. chartStatus spinner hidden
15. try { lwChart.timeScale().fitContent() } catch(e) { console.warn('fitContent', e) }
```

**Error isolation design:** Each `setData()` and `fitContent()` call is wrapped individually. If a single series receives data that violates Lightweight Charts' internal invariants (e.g., non-ascending timestamps that survive the `parseYF` sort due to an edge case), the failure is caught and logged as a warning without affecting any other series or the overall refresh cycle.

**RSI OB/OS guard detail:** Lightweight Charts requires at least 2 data points to render a line series. Setting OB/OS reference lines from a single-point array causes a non-Error throw. The `rsiData.length >= 2` check ensures the reference lines are only drawn once the RSI panel has enough data to define a valid time range.

---

### 5.3 Radar Chart — `updateRadar(factors)`

**Purpose:** Renders a Chart.js radar (spider) chart showing the 5 macro pressure scores.

**Signature:**
```javascript
function updateRadar(factors: MacroFactor[]): void
```

**Implementation detail:** Calls `radarChartInst.destroy()` before recreating to prevent Chart.js canvas memory leak from multiple `new Chart()` calls on the same canvas element.

```javascript
if (radarChartInst) { radarChartInst.destroy(); }
radarChartInst = new Chart(ctx, {
  type: 'radar',
  data: { labels, datasets: [{ data, borderColor: '#22d3ee', ... }] },
  options: {
    scales: { r: { min: 0, max: 100, ticks: { display: false }, ... } }
  }
})
```

---

## 6. Display Update Functions

### 6.1 `updateTile(idPrice, idChange, price, changePct, formatter)`

**Purpose:** Updates a single KPI tile in the header.

**Signature:**
```javascript
function updateTile(
  idPrice: string,
  idChange: string,
  price: number,
  changePct: number,
  formatter: (v: number) => string
): void
```

**Color logic:**
| Change | Class | Color |
|---|---|---|
| > 0 | `tick-up` | #34d399 (green) |
| < 0 | `tick-down` | #f43f5e (red) |
| = 0 | `tick-neutral` | #a1a1aa (grey) |

---

### 6.2 `updateSR(parsed)` — Support & Resistance

**Purpose:** Computes Standard Pivot Points from live OHLCV data and renders the Support/Resistance panel.

**Algorithm:**
```
1. high = parsed.dayHigh || max(candles[].high)
2. low  = parsed.dayLow  || min(candles[].low)
3. close = parsed.prev   (previous session close)

4. pp = calcPivotPoints(high, low, close)
   → { P, R1, R2, R3, S1, S2, S3 }

5. levels = [R3, R2, R1, P, S1, S2, S3]
   each annotated with:
     - dist = (val - spot) / spot × 100 (% from spot)
     - type: 'r' | 'p' | 's'

6. Render resistance levels (sorted ascending, above spot → red)
7. Render support levels (sorted descending, below spot → green)
8. Render pivot row: P | Spot | ABOVE/BELOW indicator
```

**Level rendering HTML template:**
```html
<div class="sr-level sr-r">       <!-- or sr-s, sr-p -->
  <div>
    <div>R2 (Strong Resist)</div>
    <div class="text-xs opacity-60">Pivot Range Top</div>
  </div>
  <div class="text-right">
    <div>₹299.50</div>
    <div class="text-xs opacity-70">+0.80%</div>
  </div>
</div>
```

---

### 6.3 `updateVWAP(parsed)`

**Purpose:** Computes VWAP from live candles and updates the VWAP KPI tile.

**Algorithm:**
```
vwapArr = calcVWAP(candles)
lastVwap = vwapArr[last].value
spot = parsed.price
tile.value = '₹' + lastVwap.toFixed(2)
status = spot > lastVwap ? 'Above VWAP ↑' : 'Below VWAP ↓'
status.class = spot > lastVwap ? 'tick-up' : 'tick-down'
```

---

### 6.4 `updateTechSignals(parsed)`

**Purpose:** Computes 6 technical indicator signals from live candle data and renders the Live Technical Signals panel.

**Signals generated:**

| # | Signal | Computation | Thresholds |
|---|---|---|---|
| 1 | RSI (14) | `calcRSI(candles, 14)[last]` | > 70 overbought / < 30 oversold |
| 2 | SMA-20 | `calcSMA(candles, 20)[last]` | spot > SMA → bullish |
| 3 | SMA-50 | `calcSMA(candles, 50)[last]` | spot > SMA → bullish |
| 4 | VWAP | `calcVWAP(candles)[last]` | spot > VWAP → bullish |
| 5 | Bollinger | `calcBollingerBands(candles)[last]` | Within / Upper breach / Lower breach |
| 6 | 3-bar trend | `candles[-3..-1].close` comparison | Higher highs = uptrend |

**Output row format:**
```html
<div class="data-row">
  <span class="text-zinc-400">RSI (14): 52.34</span>
  <span class="font-semibold tick-neutral">→ Neutral</span>
</div>
```

---

### 6.5 `updateMacroFactors()`

**Purpose:** Reads the current `state` object for all 4 market instruments and computes a 0–100 pressure score for each macro factor, rendering animated score bars and feeding the radar chart.

**Scoring formulas:**

#### Brent Crude Score
```
score = clamp(0, 100, (brentP − 60) / 60 × 100)
color:  brentP > 100 → #f43f5e  (Policy Fear Zone)
        brentP > 85  → #fbbf24  (Elevated)
        else         → #34d399  (Normal)
```

#### USD/INR Depreciation Score
```
score = clamp(0, 100, (usdinrP − 75) / 30 × 100)
label:  usdinrP > 90 → 'Strong INR Tailwind'
        usdinrP > 83 → 'Moderate Tailwind'
        else         → 'Minimal'
```

#### India VIX Score
```
score = clamp(0, 100, vixP / 40 × 100)
label:  vixP > 25 → 'High Dealer Hedging'
        vixP > 17 → 'Elevated Hedging'
        else      → 'Low Volatility'
```

#### ONGC Momentum Score
```
score = clamp(0, 100, 50 + changePct × 10)
  (50% baseline, ±10 per 1% price move)
```

#### Windfall Tax Probability (Rule-based)
```
score = brentP > 100 → 70   (High Policy Risk)
        brentP > 85  → 40   (Moderate Risk)
        else         → 20
```

**HTML output per factor:**
```html
<div>
  <div class="flex justify-between items-center mb-1">
    <span class="font-semibold">Brent Crude Bullishness</span>
    <div>
      <span style="color:#f43f5e">105.87$</span>
      <span class="text-zinc-500 ml-1">Policy Fear Zone</span>
    </div>
  </div>
  <div class="h-1 bg-zinc-800 rounded-full">
    <div class="macro-score-bar h-1 rounded-full"
         style="width:76%;background:#f43f5e"></div>
  </div>
</div>
```

The `.macro-score-bar` class has `transition: width 1s ease` for smooth animated updates.

---

## 7. Option Chain Analytics

### 7.1 `parseOptionChain(data, spot)`

**Purpose:** Transforms raw NSE option chain JSON into structured analytics including Max Pain, PCR, and top strikes for the OI bar chart.

**Signature:**
```javascript
function parseOptionChain(data: NSEOptionChainResponse, spot: number): OCAnalytics | null
```

**Step 1 — Build Strike Map:**
```javascript
const strikeMap = {}
rows.forEach(row => {
  const s = row.strikePrice
  if (!strikeMap[s]) strikeMap[s] = { strike: s, callOI: 0, putOI: 0 }
  if (row.CE) strikeMap[s].callOI += row.CE.openInterest || 0
  if (row.PE) strikeMap[s].putOI  += row.PE.openInterest || 0
})
const strikes = Object.values(strikeMap).sort((a,b) => a.strike - b.strike)
```

**Step 2 — Max Pain Algorithm (O(n²)):**
```
For each potential expiry strike T in strikes:
  totalPayout = 0
  For each strike S in strikes:
    if S.strike < T:
      totalPayout += S.callOI × (T - S.strike) × 100
      (call writers pay out if spot is above call strike)
    if S.strike > T:
      totalPayout += S.putOI × (S.strike - T) × 100
      (put writers pay out if spot is below put strike)
  record totalPayout[T]

maxPainStrike = strike T that minimizes totalPayout[T]
```

**Rationale for ×100:** NSE options contracts are in lots of 100 shares.

**Step 3 — Put-Call Ratio:**
```
totalCallOI = Σ strikes[].callOI
totalPutOI  = Σ strikes[].putOI
PCR = totalPutOI / totalCallOI

PCR > 1.2 → Bullish sentiment (more puts = bearish hedging = market maker support)
PCR < 0.8 → Bearish sentiment (more calls = speculative buying = resistance)
```

**Step 0 — Empty Strikes Guard:**
```
if strikes.length === 0:
  return null    // No option chain data; caller falls back to pivot-based max pain
```

**Step 4 — ATM Detection & Top Strikes:**
```
atmStrike = strikes.reduce(min|strike - spot|)
atmIdx = strikes.indexOf(atmStrike)
topStrikes = strikes[max(0, atmIdx-4) .. atmIdx+4]   // up to 9 strikes around ATM
```

**Note on variable rename:** The loop variable was renamed from `atm` to `atmStrike` to avoid shadowing the common abbreviation and to make the reduce intent explicit in code review.

**Return type:**
```javascript
{
  maxPainStrike: number,
  pcr: number,
  topStrikes: StrikeRow[],
  totalCallOI: number,
  totalPutOI: number
}
```

---

### 7.2 `updateOptionChain()`

**Purpose:** Renders the Option Chain Analytics panel from `state.optionChain` and `state.ongc.price`.

**Fallback behavior:**
```
if !state.optionChain || !state.ongc:
  show message: "NSE option chain data unavailable. Displaying calculated max pain from pivot."
  set maxPainVal = Pivot P
  set maxPainSrc = "Pivot Est."
  return
```

**OI Bar Chart rendering:**
```
For each strike in topStrikes:
  callWidth = (callOI / maxOI) × 100 + '%'
  putWidth  = (putOI / maxOI) × 100  + '%'
  ATM strike highlighted with cyan text
  Call bar: left-aligned, red gradient
  Put bar: right-aligned, green gradient
```

**PCR color coding:**
```
pcr > 1.2 → green-400  (bullish)
pcr < 0.8 → rose-400   (bearish)
else      → amber-400  (neutral)
```

---

## 7.5 Global Error Boundary

**Location:** Top of the `<script>` block in `public/index.html`, registered before any chart initialization.

**Purpose:** Intercepts all uncaught JavaScript exceptions and unhandled promise rejections — including non-`Error` throws emitted by Lightweight Charts — and prevents them from propagating to the Replit preview iframe's crash boundary.

**Implementation:**
```javascript
window.onerror = function(message, source, lineno, colno, error) {
  console.warn('[caught non-Error throw]', message, source, lineno)
  return true   // returning true prevents the default browser error handling
}

window.addEventListener('unhandledrejection', function(event) {
  console.warn('[unhandled rejection suppressed]', event.reason)
  event.preventDefault()
})
```

**Why `return true`:** The `window.onerror` contract specifies that returning `true` suppresses the browser's default uncaught-error behavior (which Replit's iframe monitors). Returning `false` or `undefined` allows the error to propagate to the host frame's error detector.

**Scope of suppression:** Only non-`Error` throws and unhandled rejections are suppressed at the UI level. `Error` instances thrown by application code (bugs) still surface in the browser console as `console.warn` output and can be investigated. The dashboard's own `try/catch` blocks around all `setData()` calls provide the primary defence layer; this global handler is a last-resort backstop.

**Not a substitute for proper error handling:** This handler does not fix underlying data issues — it prevents a cosmetic "crashed" banner from appearing when the dashboard would recover naturally on the next 30-second refresh cycle. Each `series.setData()` and `fitContent()` call is individually guarded as the primary error containment strategy.

---

## 8. Intraday Bias Algorithm

### 8.1 `updateTraderAssessment()`

**Purpose:** Synthesizes all available live data into a single directional bias assessment (BULLISH / NEUTRAL / BEARISH) using a multi-factor point scoring model.

**Signature:**
```javascript
function updateTraderAssessment(): void
```

**Input data sources:**
- `state.ongc.price`, `state.ongc.changePct`, `state.ongc.candles`
- `state.brent.price`
- `state.usdinr.price`
- `state.vix.price`

**Pre-computation:**
```javascript
const rsiArr = calcRSI(ongc.candles, 14)
const rsi    = rsiArr[last]?.value

const vwapArr = calcVWAP(ongc.candles)
const vwap    = vwapArr[last]?.value

const pp = calcPivotPoints(ongc.dayHigh, ongc.dayLow, ongc.prev)
```

**Scoring model:**

| Factor | Bull Point | Bear Point |
|---|---|---|
| Brent > $100 | +1.0 | — |
| Brent > $110 | +1.0 (additive) | — |
| USD/INR > 85 | +1.0 | — |
| ONGC changePct > 0 | +1.0 | — |
| RSI < 50 | +0.5 | — |
| Spot > VWAP | +1.0 | — |
| Spot > Pivot P | +1.0 | — |
| VIX > 20 | — | +1.0 |
| Brent > $105 (windfall risk) | — | +0.5 |
| RSI > 65 | — | +1.0 |
| ONGC changePct < 0 | — | +1.0 |
| Spot < R1 | — | +0.5 |

**Classification:**
```
net = bullPoints - bearPoints
net > +1.5  → BIAS = "BULLISH"   (green, text-green-400)
net < -1.5  → BIAS = "BEARISH"   (red, text-rose-400)
else        → BIAS = "NEUTRAL"   (amber, text-amber-400)
```

**Gamma Squeeze Probability:**
```
spot > pp.R2 → 45%
spot > pp.R1 → 25%
default      → 12%
```

This represents the estimated probability of a gamma squeeze (forced call-writer delta hedging above R2) based on current spot position relative to pivot levels.

**Assessment text generation:**
```javascript
const parts = [
  `Spot ₹${spot} ${pctChg>=0?'up':'down'} ${|pctChg|}% today.`,
  brentP ? `Brent at $${brentP} — ${brentP>105 ? 'policy risk elevated (Windfall Tax ~'+prob+'%)' : 'within normal range'}.` : '',
  usdinrP ? `USD/INR ${usdinrP} — ${usdinrP>85 ? 'strong INR tailwind for realizations' : 'moderate FX support'}.` : '',
  vixP ? `India VIX ${vixP} — ${vixP>20 ? 'elevated, dealer delta-hedging creates chop' : 'controlled, trend trading viable'}.` : '',
  rsi ? `RSI(14) at ${rsi} — ${rsi>70 ? 'overbought' : rsi<30 ? 'oversold' : 'mid-range'}.` : '',
  pp ? `Key levels: R1 ₹${pp.R1}, Pivot ₹${pp.P}, S1 ₹${pp.S1}.` : '',
  `Overall intraday bias: ${bias}.`
]
document.getElementById('traderAssessment').textContent = parts.join(' ')
```

---

## 9. State Management & Refresh Engine

### 9.1 Global State Object

**Definition:**
```javascript
const state = {
  ongc:        null,   // ParsedQuote | null
  brent:       null,   // ParsedQuote | null
  usdinr:      null,   // ParsedQuote | null
  vix:         null,   // ParsedQuote | null
  optionChain: null    // NSEOptionChainResponse | null
}
```

**Lifecycle:** State is initialized to `null` on page load. On each successful `refreshAll()`, fields are overwritten with the latest `ParsedQuote`. Failed fetches do NOT update state, preserving last known values.

**Mutation policy:** State is only mutated inside `refreshAll()`. All display functions read from `state` and are side-effect-free with respect to state.

---

### 9.2 `refreshAll()`

**Purpose:** Main orchestrator for a full data refresh cycle.

**Signature:**
```javascript
async function refreshAll(): Promise<void>
```

**Algorithm:**
```
1. if isRefreshing → return early (debounce guard)
2. isRefreshing = true
3. btn.disabled = true; btn.innerHTML = spinner

4. updateMarketBadge()    // IST time check, no API call

5. [ongcRaw, brentRaw, usdinrRaw, vixRaw, ocRaw] =
     await Promise.allSettled([
       fetchYF('ONGC.NS', '5m', '1d'),
       fetchYF('BZ=F', '5m', '1d'),
       fetchYF('USDINR=X', '5m', '1d'),
       fetchYF('^INDIAVIX', '5m', '1d'),
       fetchNSEOptionChain('ONGC')
     ])

6. For each result:
     if status === 'fulfilled' → parse + assign to state
     if status === 'rejected'  → state field unchanged (keeps last value)

7. Update KPI tiles (updateTile × 4)

8. if state.ongc:
     updatePriceChart(state.ongc)
     updateSR(state.ongc)
     updateVWAP(state.ongc)
     updateTechSignals(state.ongc)
   else:
     chartOverlay.innerHTML = error-chip HTML

9. updateOptionChain()

10. if !state.optionChain AND state.ongc:
      maxPain = calcPivotPoints(...).P   // fallback
      set Max Pain tile to Pivot P

11. updateMacroFactors()
12. updateTraderAssessment()

13. lastUpdated = current IST time string

14. finally:
      isRefreshing = false
      btn.disabled = false
      btn.innerHTML = refresh icon SVG
```

---

### 9.3 `startCountdown()`

**Purpose:** Manages the 30-second auto-refresh countdown display and the periodic refresh call.

**Implementation:**
```javascript
function startCountdown() {
  clearInterval(countdownTimer)     // prevent timer leak on re-call
  clearInterval(refreshTimer)
  countdownVal = REFRESH_INTERVAL   // reset to 30

  countdownTimer = setInterval(() => {
    countdownVal--
    if (countdownVal < 0) countdownVal = REFRESH_INTERVAL
    document.getElementById('countdown').textContent = countdownVal
  }, 1000)

  refreshTimer = setInterval(() => {
    refreshAll()
    countdownVal = REFRESH_INTERVAL
  }, REFRESH_INTERVAL * 1000)       // 30,000ms
}
```

**Note:** The countdown display and the actual refresh call are on separate intervals. The countdown timer runs every 1s; the refresh timer runs every 30s. This decouples the display from the data fetch, preventing visual jank from fetch latency.

---

## 10. Market Status Detection

**Purpose:** Determines whether NSE is currently open for trading without any API call, using IST timezone arithmetic.

**Signature:**
```javascript
function getMarketStatus(): { status: string, label: string, cls: string }
```

**Algorithm:**
```javascript
const now = new Date()
// IST = UTC + 5:30 = UTC + 330 minutes
const ist = new Date(now.getTime() + (5*60 + 30) * 60 * 1000)
const h   = ist.getUTCHours()
const m   = ist.getUTCMinutes()
const day = ist.getUTCDay()          // 0=Sunday, 6=Saturday
const mins = h * 60 + m

if (day === 0 || day === 6):
  return { status: 'CLOSED', label: 'WEEKEND', cls: 'badge-closed' }

if (mins >= 9*60+15 && mins <= 15*60+30):
  return { status: 'OPEN', label: 'LIVE', cls: 'badge-live' }   // 09:15 – 15:30 IST

if (mins >= 9*60 && mins < 9*60+15):
  return { status: 'PREMARKET', label: 'PRE-OPEN', cls: 'badge-premarket' }

return { status: 'CLOSED', label: 'CLOSED', cls: 'badge-closed' }
```

**NSE Trading Hours (IST):**
| Session | Time |
|---|---|
| Pre-open | 09:00 – 09:14 |
| Market open | 09:15 – 15:30 |
| Post-market | 15:30 – 16:00 |
| Closed | All other times |

**Note:** Indian public holidays are not modeled. On NSE holidays, the `LIVE` badge may show incorrectly, but data will simply reflect the last available session.

---

## 11. Data Structures & Type Definitions

```typescript
interface Candle {
  time:   number   // Unix timestamp in seconds
  open:   number   // Opening price (INR)
  high:   number   // High price (INR)
  low:    number   // Low price (INR)
  close:  number   // Closing price (INR)
  volume: number   // Shares traded
}

interface ParsedQuote {
  meta:       object   // Raw Yahoo Finance meta object
  candles:    Candle[]
  price:      number   // Current/last price
  prev:       number   // Previous close
  change:     number   // Absolute price change
  changePct:  number   // Percentage change
  dayHigh:    number
  dayLow:     number
  open:       number
  volume:     number
  currency:   string   // 'INR', 'USD', etc.
}

interface LinePoint {
  time:  number   // Unix timestamp in seconds
  value: number
}

interface PivotLevels {
  P:  number   // Pivot
  R1: number   R2: number   R3: number
  S1: number   S2: number   S3: number
}

interface BandPoint {
  time:  number
  upper: number
  mid:   number
  lower: number
}

interface StrikeRow {
  strike:  number
  callOI:  number
  putOI:   number
}

interface OCAnalytics {
  maxPainStrike: number
  pcr:           number
  topStrikes:    StrikeRow[]
  totalCallOI:   number
  totalPutOI:    number
}

interface MacroFactor {
  label: string
  val:   string     // formatted display value
  unit:  string
  score: number     // 0–100
  color: string     // hex color
  note:  string     // human-readable label
}
```

---

## 12. Error Handling Matrix

| Function | Failure Scenario | Response | User Impact |
|---|---|---|---|
| `fetchWithTimeout` | Network timeout | Throws `AbortError` | Route returns 500 |
| `fetchYF` | Backend 4xx/5xx | Returns `null` | Tile shows "—"; chart retains last data |
| `fetchNSEOptionChain` | NSE auth failure | Returns `null` | Max Pain shows Pivot P; OC panel shows message |
| `parseYF` | Malformed JSON | Returns `null` | Same as fetchYF null |
| `parseYF` | Duplicate timestamps in YF response | Deduplicated via Set + re-sorted | No user impact; chart receives clean data |
| `parseYF` | Non-monotonic timestamps in YF response | Ascending sort applied | No user impact; prevents LWC "data must be asc" throw |
| `calcRSI` | < 15 candles | Returns `[]` | RSI tile shows "—"; no RSI line on chart |
| `calcBollingerBands` | < 20 candles | Returns `[]` | BB signal row absent |
| `calcPivotPoints` | Zero prices | P/R/S = NaN | S/R panel shows "NaN" (should not occur in normal operation) |
| `parseOptionChain` | No records.data | Returns `null` | OC panel shows fallback message |
| `parseOptionChain` | `strikes.length === 0` | Returns `null` early | Same as above; avoids reduce on empty array |
| `updatePriceChart` | `setData()` throws string (LWC internal) | Per-series `try/catch`; logs `console.warn` | Individual series may be blank; others unaffected |
| `updatePriceChart` | `fitContent()` on degenerate range | `try/catch`; silently suppressed | Chart visible with last valid time scale |
| `initPriceChart` | CDN load failure (`LightweightCharts` undefined) | `try/catch` in DOMContentLoaded | User-visible error message in chart area |
| `updateTraderAssessment` | `!state.ongc` | Returns early | Assessment text = "Analyzing live data..." |
| `refreshAll` | Unhandled exception | Caught by try/catch | Console error; refresh button re-enabled |
| `getNSESession` | nseindia.com unreachable | Returns `''` | NSE calls proceed without cookie → likely 403 |
| Lightweight Charts | Non-Error string throw (any path) | `window.onerror` global handler returns `true` | Logged as `console.warn`; iframe crash banner suppressed |
| Unhandled promise rejection | Any rejected Promise not caught | `unhandledrejection` listener; `event.preventDefault()` | Logged as `console.warn`; no crash banner |
| RSI OB/OS `setData` | `rsiData.length < 2` | Guarded; OB/OS lines skipped | RSI line visible without OB/OS reference lines until data accumulates |

---

## 13. Constants & Configuration

**server.js:**
```javascript
const PORT = process.env.PORT || 5000
const YF_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart/'
const NSE_SESSION_TTL = 5 * 60 * 1000    // 5 minutes in ms
const YF_FETCH_TIMEOUT = 10_000           // 10 seconds
const NSE_SESSION_TIMEOUT = 8_000         // 8 seconds
```

**public/index.html:**
```javascript
const SYMBOLS = {
  ongc:   'ONGC.NS',
  brent:  'BZ=F',
  usdinr: 'USDINR=X',
  vix:    '^INDIAVIX',
  nifty:  '^NSEI'
}
const REFRESH_INTERVAL = 30          // seconds
const RSI_PERIOD = 14
const SMA_SHORT = 20
const SMA_LONG = 50
const BOLLINGER_PERIOD = 20
const BOLLINGER_STDEV = 2
const BULL_BIAS_THRESHOLD = 1.5
const BEAR_BIAS_THRESHOLD = -1.5
```

---

## 14. Dependency Map

```
server.js dependencies:
├── express@^5.2.1          HTTP server framework
│   └── path-to-regexp@8.x  Route matching (requires /*splat syntax)
├── path (stdlib)            File path resolution
└── fetch (Node 18+ native)  HTTP client (replaces node-fetch)
    └── AbortController (native) Timeout signal

public/index.html dependencies (CDN):
├── lightweight-charts@4.2.0 (unpkg.com)
│   ├── IChartApi
│   ├── ICandlestickSeriesApi
│   ├── ILineSeriesApi
│   ├── IHistogramSeriesApi
│   ├── CrosshairMode
│   └── LineStyle
├── chart.js@4.4.0 (jsdelivr.net)
│   └── radar type
└── tailwindcss (cdn.tailwindcss.com)
    └── Utility classes (zinc palette, responsive grid)
```

---

*End of LLD Document*  
*Prepared for architect review — MortifiedStylishModel v1.1*
