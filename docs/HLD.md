# High Level Design (HLD)
# MortifiedStylishModel — ONGC Live Institutional Dashboard

**Document Version:** 1.1  
**Date:** May 14, 2026  
**Last Updated:** May 14, 2026 (v1.1 — runtime stability hardening)
**Classification:** Architect Review  
**System Codename:** MortifiedStylishModel  
**Product:** ONGC Real-Time Institutional Trade Desk Dashboard

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Overview](#2-system-overview)
3. [Architecture Goals & Constraints](#3-architecture-goals--constraints)
4. [System Context Diagram](#4-system-context-diagram)
5. [High-Level Architecture](#5-high-level-architecture)
6. [Layer Breakdown](#6-layer-breakdown)
   - 6.1 Client Layer
   - 6.2 Server Layer
   - 6.3 External Data Layer
   - 6.4 Derived / Computed Layer
7. [Data Flow](#7-data-flow)
8. [Technology Stack](#8-technology-stack)
9. [Key Architectural Decisions](#9-key-architectural-decisions)
10. [Non-Functional Requirements](#10-non-functional-requirements)
11. [Security Considerations](#11-security-considerations)
12. [Scalability & Deployment](#12-scalability--deployment)
13. [Failure Modes & Resilience](#13-failure-modes--resilience)
14. [Known Limitations](#14-known-limitations)

---

## 1. Executive Summary

MortifiedStylishModel is a real-time, institutional-grade monitoring dashboard for ONGC (Oil and Natural Gas Corporation) equity trading. It aggregates live market data from multiple external sources, computes a comprehensive set of technical and macro indicators server-side and client-side, and presents a unified view for institutional trade desk assessment.

The system is built as a Node.js Express backend acting as a secure data proxy, serving a single-page application (SPA) frontend that renders live candlestick charts, option chain analytics, support/resistance levels, macro pressure indices, and a dynamic intraday bias algorithm — all auto-refreshing every 30 seconds.

---

## 2. System Overview

### 2.1 Purpose

The dashboard provides institutional traders with a consolidated, real-time view of:

- ONGC spot price with intraday candlestick data (5-minute resolution)
- Macro factors: Brent Crude, USD/INR, India VIX
- Technical indicators: RSI, SMA, VWAP, Bollinger Bands, Pivot Points
- Option chain analytics: Max Pain, PCR, OI by strike
- Intraday bias scoring and trader assessment
- Market status detection (IST-aware: LIVE / CLOSED / PRE-OPEN)

### 2.2 Scope

| In Scope | Out of Scope |
|---|---|
| Real-time data display (15-min delay, Yahoo Finance) | Order routing / trade execution |
| Technical indicator computation | Portfolio management |
| Option chain analytics | Regulatory reporting |
| Macro factor monitoring | Historical backtesting |
| NSE option chain via session proxy | User authentication / multi-user |
| Auto-refresh every 30 seconds | Persistent database storage |

---

## 3. Architecture Goals & Constraints

### 3.1 Goals

| Priority | Goal | Rationale |
|---|---|---|
| P0 | **Live data delivery** | Dashboard must reflect current market state |
| P0 | **CORS bypass** | Yahoo Finance and NSE block direct browser requests |
| P1 | **Graceful degradation** | Every data source has a fallback; no blank screens |
| P1 | **Low latency display** | Charts must render within 2s of page load |
| P2 | **Zero-cost data layer** | No paid API keys required for operation |
| P2 | **Single-node simplicity** | One server process, no microservices overhead |

### 3.2 Constraints

- **Deployment target:** Replit Autoscale (static → Node.js migration)
- **Port:** 5000 (Replit webview requirement)
- **No API keys required:** Yahoo Finance v8 and NSE are free, unauthenticated (session-based for NSE)
- **Single HTML file frontend:** No build step, no bundler, CDN-loaded libraries
- **Express 5:** Wildcard route syntax `/*splat` (breaking change from Express 4)

---

## 4. System Context Diagram

```
┌───────────────────────────────────────────────────────────────────────────┐
│                          EXTERNAL WORLD                                    │
│                                                                             │
│   ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐      │
│   │  Yahoo Finance   │   │    NSE India      │   │  Derived/Computed│      │
│   │  (query1.finance │   │  (nseindia.com)   │   │  (server-side)   │      │
│   │   .yahoo.com)    │   │                  │   │                  │      │
│   │  · ONGC.NS       │   │  · Option Chain  │   │  · Windfall Tax  │      │
│   │  · BZ=F (Brent)  │   │  · Equity Quote  │   │  · Macro Scores  │      │
│   │  · USDINR=X      │   │  · Session auth  │   │  · Bias Model    │      │
│   │  · ^INDIAVIX     │   │    via cookies   │   │  · Gamma Prob    │      │
│   └────────┬─────────┘   └────────┬─────────┘   └────────┬─────────┘      │
│            │                      │                       │                │
└────────────┼──────────────────────┼───────────────────────┼────────────────┘
             │  HTTPS               │  HTTPS                │
             │  fetch               │  fetch + cookie       │
             ▼                      ▼                       ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                     NODE.JS EXPRESS SERVER  (Port 5000)                    │
│                              server.js                                     │
│                                                                             │
│   GET /api/quote/:symbol      →  Yahoo Finance proxy                       │
│   GET /api/optionchain/:symbol →  NSE option chain proxy                   │
│   GET /api/nsequote/:symbol   →  NSE equity quote proxy                    │
│   GET /api/health             →  Liveness check                            │
│   GET /*splat                 →  SPA fallback (public/index.html)          │
└─────────────────────────────────┬──────────────────────────────────────────┘
                                  │  HTTP  /api/* calls
                                  │  (same origin, no CORS)
                                  ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                     BROWSER  (public/index.html)                           │
│                                                                             │
│   Lightweight Charts v4 │ Chart.js v4 │ Tailwind CSS CDN                  │
│                                                                             │
│   · fetchYF() / fetchNSEOptionChain() → /api/* backend routes             │
│   · parseYF() → structured quote + candle array                            │
│   · calcRSI / calcSMA / calcVWAP / calcPivotPoints / calcBollingerBands   │
│   · updatePriceChart / updateSR / updateVWAP / updateMacroFactors         │
│   · updateOptionChain / updateTechSignals / updateTraderAssessment        │
│   · 30s auto-refresh engine + IST market status detection                 │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. High-Level Architecture

The architecture follows a **3-tier proxy pattern**:

```
[Browser SPA] ←──same-origin──→ [Express Proxy Server] ←──HTTPS──→ [External APIs]
     Tier 1                             Tier 2                          Tier 3
  Presentation                      Integration                      Data Sources
```

### Why a Proxy Tier?

Both Yahoo Finance v8 API and NSE India API block cross-origin browser requests (CORS). The Express server acts as a server-side proxy that:

1. **Yahoo Finance**: Sets the correct `User-Agent`, `Referer`, and `Origin` headers that Yahoo Finance requires for valid responses.
2. **NSE India**: Performs a homepage handshake to obtain a valid session cookie (`bm_sv`, `ak_bmsc`, etc.), then forwards that cookie with every subsequent API request.

Without this proxy tier, the browser would receive a CORS error or a 403/429 from both sources.

---

## 6. Layer Breakdown

### 6.1 Client Layer

**Location:** `public/index.html`  
**Runtime:** Browser (JavaScript ES2020+)  
**Libraries:** TradingView Lightweight Charts v4.2.0, Chart.js v4.4.0, Tailwind CSS

#### Responsibilities

| Responsibility | Implementation |
|---|---|
| Data fetching | `fetchYF(symbol)` → `GET /api/quote/:symbol` |
| Option chain fetching | `fetchNSEOptionChain()` → `GET /api/optionchain/ONGC` |
| Raw JSON parsing | `parseYF(data)` → candles[], price, change, meta (with dedup+sort) |
| Chart rendering | `initPriceChart()` (try/catch guarded) + `updatePriceChart(parsed)` |
| Volume rendering | Histogram series, color-coded by candle direction |
| RSI panel | Separate LightweightCharts instance, 120px height |
| Technical indicators | Computed in-browser from candle data (see LLD) |
| Support/Resistance | `updateSR(parsed)` → Standard Pivot Points |
| VWAP tile | `updateVWAP(parsed)` → spot vs VWAP comparison |
| Option chain display | `updateOptionChain()` → Max Pain, PCR, OI bars (empty-strikes guarded) |
| Macro pressure index | `updateMacroFactors()` → 5-factor scored radar |
| Trader assessment | `updateTraderAssessment()` → 7-factor bias text |
| Market status | IST timezone math, no API required |
| Auto-refresh | `setInterval(30s)` + 1s countdown display |
| Global error boundary | `window.onerror` + `unhandledrejection` suppress non-Error throws from LWC |

#### Sub-components

```
Browser
├── Header KPI Tiles (6 tiles)
│   ├── ONGC Spot + % change
│   ├── Brent Crude + % change
│   ├── USD/INR + % change
│   ├── India VIX + % change
│   ├── VWAP + Above/Below signal
│   └── Max Pain (NSE live or pivot estimate)
│
├── Price Chart Panel (Lightweight Charts)
│   ├── Candlestick series (green up / red down)
│   ├── SMA-20 line overlay (cyan)
│   ├── VWAP line overlay (pink dashed)
│   ├── Volume histogram (60px)
│   └── RSI(14) panel with OB/OS lines (120px)
│
├── Support & Resistance Panel
│   ├── R3 / R2 / R1 (resistance, red)
│   ├── Pivot P (amber)
│   └── S1 / S2 / S3 (support, green)
│
├── Live Macro Pressure Index
│   ├── 5× scored bars (animated CSS width)
│   └── Chart.js Radar chart (pentagon)
│
├── Option Chain Analytics
│   ├── Total Call OI / Put OI
│   ├── Put-Call Ratio (PCR)
│   └── OI bar chart per strike (±4 around ATM)
│
├── Live Technical Signals (6 rows)
│   ├── RSI status (Overbought/Neutral/Oversold)
│   ├── SMA-20 position
│   ├── SMA-50 position
│   ├── VWAP position
│   ├── Bollinger Band position
│   └── Recent 3-bar trend direction
│
└── Trader Assessment Footer
    ├── Intraday Bias label (BULLISH/NEUTRAL/BEARISH)
    ├── Bias reason text
    ├── Gamma Squeeze Probability
    └── Free-text assessment paragraph
```

### 6.2 Server Layer

**Location:** `server.js`  
**Runtime:** Node.js 20 LTS  
**Framework:** Express 5  
**Port:** 5000

#### Responsibilities

| Responsibility | Implementation |
|---|---|
| Yahoo Finance proxy | `GET /api/quote/:symbol` — adds required headers |
| NSE option chain proxy | `GET /api/optionchain/:symbol` — manages session |
| NSE equity quote proxy | `GET /api/nsequote/:symbol` — backup price |
| NSE session management | `getNSESession()` — cookie cache, 5-min TTL |
| Timeout management | `fetchWithTimeout()` — AbortController pattern |
| Static file serving | `express.static('public/')` |
| SPA fallback | `GET /*splat` → `public/index.html` |
| Health check | `GET /api/health` → `{ok: true, time: ISO}` |

#### Header Strategy

**Yahoo Finance headers:**
```
User-Agent: Mozilla/5.0 ... Chrome/124.0.0.0 Safari/537.36
Accept: application/json, text/plain, */*
Accept-Language: en-US,en;q=0.9
Referer: https://finance.yahoo.com/
Origin: https://finance.yahoo.com
```

**NSE India headers:**
```
User-Agent: Mozilla/5.0 ... Chrome/124.0.0.0 Safari/537.36
Accept: */*
Accept-Language: en-US,en;q=0.9
Referer: https://www.nseindia.com/
Connection: keep-alive
Cookie: <session cookies from homepage handshake>
```

### 6.3 External Data Layer

#### Yahoo Finance v8 API

| Symbol | Asset | Endpoint |
|---|---|---|
| `ONGC.NS` | ONGC equity (NSE) | `/v8/finance/chart/ONGC.NS` |
| `BZ=F` | Brent Crude futures | `/v8/finance/chart/BZ%3DF` |
| `USDINR=X` | USD/INR forex rate | `/v8/finance/chart/USDINR%3DX` |
| `^INDIAVIX` | India VIX index | `/v8/finance/chart/%5EINDIAVIX` |

**Query parameters used:** `interval=5m&range=1d&includePrePost=false&events=div|split`

**Response structure:**
```json
{
  "chart": {
    "result": [{
      "meta": { "regularMarketPrice": 297.15, "chartPreviousClose": 294.5, ... },
      "timestamp": [unix_seconds, ...],
      "indicators": {
        "quote": [{ "open": [...], "high": [...], "low": [...], "close": [...], "volume": [...] }]
      }
    }]
  }
}
```

**Rate limits:** ~2000 req/hr per IP (unauthenticated). The 30s refresh cycle with 4 symbols = ~480 req/hr well within limits.

#### NSE India APIs

| Endpoint | Purpose |
|---|---|
| `https://www.nseindia.com/` | Session cookie acquisition (GET only, no data) |
| `/api/option-chain-equities?symbol=ONGC` | Full option chain with OI by strike |
| `/api/quote-equity?symbol=ONGC` | Live equity price (backup) |

**Authentication flow:**
1. Server fetches `nseindia.com` homepage
2. Parses `set-cookie` response header
3. Caches cookies for 5 minutes
4. Attaches cookies to all subsequent NSE API calls

### 6.4 Derived / Computed Layer

All these computations happen **in the browser** from raw OHLCV data:

| Computation | Input | Output |
|---|---|---|
| Standard Pivot Points | Prev day H/L/C | P, R1, R2, R3, S1, S2, S3 |
| RSI (14) | Close prices | Momentum oscillator (0–100) |
| SMA (20, 50) | Close prices | Trend direction |
| VWAP | H, L, C, Volume | Volume-weighted mean price |
| Bollinger Bands (20, ±2σ) | Close prices | Volatility envelope |
| Max Pain | OI per strike | Option expiry gravity |
| PCR | Call OI, Put OI | Market sentiment ratio |
| Intraday Bias Score | 7 live factors | BULLISH/NEUTRAL/BEARISH |
| Macro Pressure Index | Brent, INR, VIX, Δ% | 0–100 per factor |
| Windfall Tax Probability | Brent price | 20% / 40% / 70% |
| Gamma Squeeze Probability | Spot vs R1/R2 | 12% / 25% / 45% |

---

## 7. Data Flow

### 7.1 Startup / Full Refresh Sequence

```
t=0ms    DOMContentLoaded
           └── initPriceChart()       [Lightweight Charts instances created]
           └── refreshAll()            [main fetch triggered]
           └── startCountdown()        [30s timer initialized]

t=0ms    Browser issues 5 parallel requests:
           ├── GET /api/quote/ONGC.NS
           ├── GET /api/quote/BZ=F
           ├── GET /api/quote/USDINR=X
           ├── GET /api/quote/^INDIAVIX
           └── GET /api/optionchain/ONGC

t=0ms    Server receives /api/quote/ONGC.NS:
           └── fetchWithTimeout(YF_URL, YF_HEADERS, 10000ms)
               └── Returns raw Yahoo Finance JSON

t=0ms    Server receives /api/optionchain/ONGC:
           └── getNSESession()         [cache hit or homepage handshake]
               └── fetchWithTimeout(NSE_OC_URL, {Cookie}, 10000ms)
                   └── Returns records.data[]

t=500-2000ms  All 5 responses arrive (Promise.allSettled)
           └── parseYF(ongcRaw)         → state.ongc
           └── parseYF(brentRaw)        → state.brent
           └── parseYF(usdinrRaw)       → state.usdinr
           └── parseYF(vixRaw)          → state.vix
           └── (NSE response)           → state.optionChain

           └── updateTile × 4           [KPI tiles updated]
           └── updatePriceChart(ongc)   [candles + SMA + VWAP + Volume + RSI]
           └── updateSR(ongc)           [pivot levels computed + rendered]
           └── updateVWAP(ongc)         [spot vs VWAP tile]
           └── updateTechSignals(ongc)  [6 signal rows]
           └── updateOptionChain()      [Max Pain, PCR, OI bars]
           └── updateMacroFactors()     [5 scored bars + radar]
           └── updateTraderAssessment() [bias + assessment text]
           └── lastUpdated timestamp    [IST clock]

t=30s    Countdown reaches 0 → refreshAll() called again
```

### 7.2 Data Lineage

```
Yahoo Finance JSON
    └── parseYF()
        ├── price ──────────────────────────── KPI tile (spot)
        ├── changePct ──────────────────────── KPI tile (% change)
        └── candles[] ──┬── updatePriceChart() (candlestick)
                        ├── calcSMA(20) ─────── chart overlay
                        ├── calcVWAP() ─────── chart overlay + tile
                        ├── calcRSI(14) ─────── RSI panel + signal
                        ├── calcBollingerBands() ── signal row
                        ├── calcPivotPoints() ─── S/R panel + bias
                        └── updateTechSignals() ── 6-row table

NSE Option Chain JSON
    └── parseOptionChain()
        ├── maxPainStrike ──────────────────── KPI tile (max pain)
        ├── pcr ────────────────────────────── OC panel row
        └── topStrikes[] ───────────────────── OI bar chart

{brent, usdinr, vix, ongc} ── updateMacroFactors() ── radar + score bars
{all state} ─────────────── updateTraderAssessment() ── bias + text
```

---

## 8. Technology Stack

| Component | Technology | Version | Rationale |
|---|---|---|---|
| Backend runtime | Node.js | 20 LTS | Built-in `fetch`, AbortController, ES2022 |
| Backend framework | Express | 5.x | Minimal, battle-tested proxy tier |
| Candlestick charts | TradingView Lightweight Charts | 4.2.0 | Purpose-built financial charting, MIT, ~40KB |
| Supplementary charts | Chart.js | 4.4.0 | Radar chart, widely supported |
| CSS framework | Tailwind CSS | CDN | Rapid dark-mode UI, no build step |
| Yahoo Finance data | v8 Finance Chart API | — | Free, no key, OHLCV + metadata |
| NSE data | nseindia.com API | — | Free, session-cookie auth |
| Deployment | Replit Autoscale | — | Zero-config hosting |
| Package manager | npm | — | Standard Node ecosystem |

---

## 9. Key Architectural Decisions

### ADR-001: Server-Side Proxy over Client-Side Fetch

**Decision:** All external API calls go through the Express backend, not directly from the browser.

**Rationale:**
- Yahoo Finance returns `Access-Control-Allow-Origin: *` inconsistently — blocked in many browser environments
- NSE India explicitly blocks browser-origin requests with CORS restrictions and requires `Referer: nseindia.com` + session cookies
- Server-side fetch allows full header control and cookie management

**Alternatives considered:**
- CORS proxy services (corsproxy.io, allorigins.win) — rejected due to unreliability and rate limiting
- Client-side fetch with no-cors mode — rejected because opaque responses cannot be read
- Paid API aggregators (Alpha Vantage, Twelve Data) — rejected to maintain zero-cost operation

### ADR-002: In-Browser Indicator Computation

**Decision:** All technical indicators (RSI, SMA, VWAP, Bollinger, Pivots) are computed client-side from raw OHLCV data.

**Rationale:**
- Reduces server load and eliminates a computation layer
- Allows real-time indicator updates as each data point arrives
- Indicator math is deterministic and stateless — no server state required

### ADR-003: Static SPA over Framework

**Decision:** Single `public/index.html` with CDN-loaded libraries, no React/Vue/bundler.

**Rationale:**
- Zero build pipeline complexity
- Instant deployment on Replit static hosting (before migration)
- Chart.js and Lightweight Charts work natively in plain JS
- Dashboard is a single-screen application — SPA routing unnecessary

### ADR-004: NSE Session Cookie Caching

**Decision:** NSE session cookies are cached server-side for 5 minutes.

**Rationale:**
- NSE's homepage handshake takes ~800ms
- With a 30s refresh cycle, re-authenticating every request would add 800ms of latency
- 5-minute TTL balances freshness against overhead

### ADR-005: Promise.allSettled for Parallel Fetch

**Decision:** All 5 data sources are fetched in parallel using `Promise.allSettled()`.

**Rationale:**
- `Promise.all()` would cause a full refresh failure if any single source times out
- `allSettled()` allows partial success — e.g., if NSE is down, the price chart still updates
- Each source's failure is handled independently with graceful fallbacks

### ADR-006: Global Browser Error Boundary for Non-Error Throws

**Decision:** A `window.onerror` handler and an `unhandledrejection` listener are registered at the top of the frontend script block, before any chart code runs.

**Rationale:**
- TradingView Lightweight Charts (v4.2.0) throws raw **strings** internally in certain edge cases (e.g., `"data must be asc"` when candle timestamps are not strictly ascending). These are not `Error` objects.
- Replit's preview iframe detects uncaught non-Error throws and displays a "crashed" banner, halting the visible application even when the dashboard would otherwise recover on the next 30-second refresh cycle.
- The global handler intercepts all such throws, logs them as `console.warn`, and returns `true` to suppress propagation to the iframe error boundary.
- Individual `series.setData()` calls are also wrapped in per-series `try/catch` blocks so a single bad data point cannot abort the entire chart update path.

**Alternatives considered:**
- Upgrading Lightweight Charts to a version that does not throw strings — rejected because v4.2.0 is the latest stable release and the upstream issue is a library design choice, not a bug.
- Catching only inside `updatePriceChart()` — rejected because a single catch wrapper still allows the uncaught throw to reach the iframe boundary if the throw originates asynchronously.

**Implementation location:** First `<script>` tag in `public/index.html`, lines 1–20 of the JS block.

---

## 10. Non-Functional Requirements

### 10.1 Performance

| Metric | Target | Mechanism |
|---|---|---|
| Time to first data | < 3 seconds | Parallel fetch, preloaded CDN scripts |
| Chart render time | < 500ms after data | Lightweight Charts WebGL rendering |
| Refresh cycle | 30 seconds | `setInterval` + `isRefreshing` guard |
| Server response time | < 200ms (excl. upstream) | Express minimal overhead |
| NSE session cache TTL | 5 minutes | Avoid repeated homepage handshake |

### 10.2 Availability

| Scenario | Behavior |
|---|---|
| Yahoo Finance down | Error chip shown in chart overlay; other tiles remain |
| NSE down | Max Pain falls back to Pivot P estimate; OC panel shows message |
| Single symbol failure | Other symbols unaffected (allSettled pattern) |
| Market closed (weekend/holiday) | CLOSED badge shown; last session data displayed |
| Server process crash | Replit Autoscale restarts automatically |

### 10.3 Data Freshness

- Yahoo Finance data is **real-time during market hours** but may carry a 15-minute delay for free-tier access
- NSE option chain is refreshed every 30 seconds
- All data is marked with IST timestamp on each refresh

---

## 11. Security Considerations

### 11.1 No User Data Collected

- No authentication, no user sessions, no personal data
- No database; no persistent storage of any kind

### 11.2 API Key Safety

- No API keys used. All data sources are publicly accessible endpoints
- No secrets in environment variables or `.env` files

### 11.3 Header Spoofing

- The server sets `User-Agent` and `Referer` headers mimicking a Chrome browser
- This is required for Yahoo Finance and NSE to respond normally
- Industry-standard practice for server-side data aggregation

### 11.4 Input Sanitization

- Route parameters (`:symbol`, `:symbol`) are passed to `encodeURIComponent()` before constructing upstream URLs
- Prevents URL injection attacks through the proxy

### 11.5 CORS on Express Server

- Express does not set explicit CORS headers (not needed — browser and server share the same origin on Replit)
- If deployed to a separate domain, `cors` package is installed and can be enabled

---

## 12. Scalability & Deployment

### 12.1 Current Deployment

- **Platform:** Replit Autoscale
- **Instances:** 1 (single-node)
- **Port:** 5000
- **Process manager:** Replit's built-in workflow runner

### 12.2 Horizontal Scaling Path

The architecture is **stateless** (except NSE session cache in memory), making it horizontally scalable:

1. Move `nseSession` cache to Redis → multiple nodes share session
2. Deploy N instances behind a load balancer
3. No changes required to client or external API logic

### 12.3 Caching Improvements (Future)

| Cache | Benefit |
|---|---|
| Redis cache for YF responses | Reduce upstream calls under high user load |
| CDN for static assets | Reduce TTFB for HTML/JS |
| NSE option chain cache (30s) | Serve multiple users from one NSE call |

---

## 13. Failure Modes & Resilience

| Failure | Detection | Mitigation |
|---|---|---|
| Yahoo Finance timeout | `fetchWithTimeout` (10s) AbortController | Returns 500; browser shows error chip |
| NSE session expired | 403 response from NSE API | `getNSESession()` forces re-authentication |
| NSE API down | 4xx/5xx or network error | Max Pain falls back to Pivot P calculation |
| All sources fail | `allSettled` → all rejected | Charts retain last known data; error messages displayed |
| Partial data (e.g. no VIX) | Null check in all update functions | Tiles show "—"; radar updates with available data |
| Market closed (no candles) | Empty `candles[]` array | Chart overlay persists; KPI tiles show last close |
| Server crash | Process exit | Replit Autoscale automatic restart |
| Browser refresh (manual) | `isRefreshing` guard reset | Full refresh cycle begins clean |
| Lightweight Charts non-Error throw | `window.onerror` global handler | Throw logged as `console.warn`, suppressed from iframe crash boundary |
| Duplicate/out-of-order timestamps in YF response | `parseYF` deduplication + sort | Candles de-duped by timestamp Set, then sorted ascending before chart render |
| `series.setData()` on bad data | Per-series `try/catch` in `updatePriceChart` | Individual series failure is isolated; other series continue to update |
| `fitContent()` on degenerate time range | `try/catch` around `lwChart.timeScale().fitContent()` | Silently suppressed; chart remains visible with last valid time scale |
| `initPriceChart()` fails (CDN miss) | `try/catch` in DOMContentLoaded boot | User-visible error message shown; page does not crash |
| `parseOptionChain` with empty strikes | Early return `null` when `strikes.length === 0` | OC panel falls back to pivot-based max pain gracefully |
| RSI OB/OS lines with insufficient data | `rsiData.length >= 2` guard before `setData` | OB/OS reference lines not drawn until enough RSI points exist |

---

## 14. Known Limitations

| Limitation | Impact | Mitigation |
|---|---|---|
| Yahoo Finance 15-min delay | Prices may lag real-time by up to 15 minutes during market hours | Timestamp shown on dashboard |
| NSE CORS dependency | If NSE changes authentication, option chain breaks | Fallback to pivot-based max pain |
| No WebSocket / streaming | Data updates on a 30s poll, not push | Sufficient for institutional intraday review |
| No historical persistence | Dashboard shows only current session data on refresh | In-browser candle array persists until reload |
| Single stock focus | Only ONGC is tracked | Symbols array can be extended with additional equities |
| No mobile layout optimization | Dashboard is designed for desktop trade desk screens | Responsive grid collapses on small screens |
| India VIX via Yahoo Finance | `^INDIAVIX` may have data gaps outside NSE hours | Falls back gracefully to last known value |

---

*End of HLD Document*  
*Prepared for architect review — MortifiedStylishModel v1.1*
