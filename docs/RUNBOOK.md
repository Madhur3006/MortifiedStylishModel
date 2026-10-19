# RUNBOOK
# MortifiedStylishModel — ONGC Live Institutional Dashboard

**Document Version:** 1.1  
**Date:** May 14, 2026  
**Last Updated:** May 14, 2026 (v1.1 — runtime stability hardening)
**Classification:** Operations / Architect Review  
**System Codename:** MortifiedStylishModel  
**Companion Documents:** HLD.md · LLD.md

---

## Table of Contents

1. [System Quick Reference](#1-system-quick-reference)
2. [Prerequisites & Environment](#2-prerequisites--environment)
3. [Local Development Setup](#3-local-development-setup)
4. [Deployment Procedures](#4-deployment-procedures)
   - 4.1 First-Time Deployment (Replit)
   - 4.2 Code Update Deployment
   - 4.3 Rollback Procedure
5. [Configuration Management](#5-configuration-management)
6. [Health Checks & Monitoring](#6-health-checks--monitoring)
7. [Incident Response Playbooks](#7-incident-response-playbooks)
   - INC-01: Dashboard shows blank / no data
   - INC-02: Option chain / Max Pain missing
   - INC-03: NSE session authentication broken
   - INC-04: Yahoo Finance data stale or failing
   - INC-05: Server process down / crash loop
   - INC-06: Chart not rendering
   - INC-07: India VIX missing / flat line
8. [NSE Session Rotation Procedure](#8-nse-session-rotation-procedure)
9. [Data Source Failover Procedures](#9-data-source-failover-procedures)
10. [Scaling Procedures](#10-scaling-procedures)
11. [Dependency Upgrade Procedures](#11-dependency-upgrade-procedures)
12. [Log Reference](#12-log-reference)
13. [Runbook Change Log](#13-runbook-change-log)

---

## 1. System Quick Reference

| Item | Value |
|---|---|
| **Application** | ONGC Live Dashboard |
| **Codename** | MortifiedStylishModel |
| **Server file** | `server.js` |
| **Frontend file** | `public/index.html` |
| **Runtime** | Node.js 20 LTS |
| **Framework** | Express 5 |
| **Port** | 5000 |
| **Deployment platform** | Replit Autoscale |
| **Workflow name** | Start Dashboard |
| **Workflow command** | `node server.js` |
| **Health endpoint** | `GET /api/health` |
| **Refresh cycle** | 30 seconds |
| **NSE session TTL** | 5 minutes |
| **External APIs** | Yahoo Finance v8, NSE India (unauthenticated) |
| **API keys required** | None |
| **Database** | None |
| **Environment variables** | None required (PORT is optional override) |

---

## 2. Prerequisites & Environment

### 2.1 Required Software

| Tool | Minimum Version | Check command |
|---|---|---|
| Node.js | 18.0.0 | `node --version` |
| npm | 8.0.0 | `npm --version` |

> **Note:** Node.js 18+ is required for the native `fetch()` API and `res.headers.getSetCookie()` method. Both are used in `server.js`. Node.js 16 and below will cause a runtime crash on startup.

### 2.2 Required npm Packages

```json
{
  "dependencies": {
    "express": "^5.2.1",
    "cors":       "^2.8.5",
    "node-fetch": "^2.7.0"
  }
}
```

> `node-fetch` and `cors` are installed but not actively used — the server uses native `fetch` and no explicit CORS headers. They are retained to avoid reinstall friction if future features require them.

### 2.3 External Access Requirements

The server process must be able to make outbound HTTPS requests to:

| Host | Port | Purpose |
|---|---|---|
| `query1.finance.yahoo.com` | 443 | Yahoo Finance v8 chart API |
| `www.nseindia.com` | 443 | NSE session + option chain |

No firewall rules need to be opened inbound (Replit handles this). All inbound traffic is routed via Replit's reverse proxy to port 5000.

---

## 3. Local Development Setup

### 3.1 Clone and Install

```bash
# Install dependencies
npm install

# Verify Node version
node --version   # must be >= 18.0.0
```

### 3.2 Start the Server

```bash
node server.js
```

Expected startup output:
```
ONGC Dashboard server running on port 5000
```

### 3.3 Verify Server is Responsive

```bash
# Health check
curl http://localhost:5000/api/health
# Expected: {"ok":true,"time":"2026-05-14T09:30:00.000Z"}

# Test Yahoo Finance proxy (ONGC spot)
curl "http://localhost:5000/api/quote/ONGC.NS?interval=5m&range=1d" | head -c 500

# Test NSE option chain proxy
curl "http://localhost:5000/api/optionchain/ONGC" | head -c 500
```

### 3.4 Access the Dashboard

Open browser: `http://localhost:5000`

You should see the dark-themed dashboard loading within 2–3 seconds, with live ONGC price in the top-left KPI tile.

---

## 4. Deployment Procedures

### 4.1 First-Time Deployment (Replit)

**Step 1 — Verify `.replit` workflow configuration**

Open `.replit` and confirm:
```toml
[[workflows.workflow]]
name = "Start Dashboard"
mode = "sequential"

[[workflows.workflow.tasks]]
task = "shell.exec"
args = "node server.js"
```

**Step 2 — Install dependencies**

In the Replit Shell tab:
```bash
npm install
```

**Step 3 — Start the workflow**

Click **Run** or start the "Start Dashboard" workflow from the Replit Workflows panel.

**Step 4 — Verify deployment**

```bash
curl https://$REPLIT_DEV_DOMAIN/api/health
```

Expected response: `{"ok":true,"time":"..."}`

**Step 5 — Open preview**

Click the Replit preview pane or visit `https://<repl-name>.<username>.replit.app`.

---

### 4.2 Code Update Deployment

**For `server.js` changes:**

```
1. Save changes to server.js
2. In Replit: Stop the "Start Dashboard" workflow
3. Start the "Start Dashboard" workflow again
4. Verify: curl /api/health returns 200
5. Spot-check affected route:
   curl /api/quote/ONGC.NS | python3 -m json.tool | head -30
```

**For `public/index.html` changes:**

No server restart required. The change is immediately live because `express.static()` serves the file fresh on each browser request with `Cache-Control: no-store`.

```
1. Save changes to public/index.html
2. Hard-refresh the browser: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)
3. No workflow restart needed
```

**For `package.json` dependency changes:**

```
1. Edit package.json
2. npm install
3. Restart the "Start Dashboard" workflow
4. Verify /api/health
```

---

### 4.3 Rollback Procedure

Replit automatically creates checkpoints (git commits) at regular intervals and after significant changes.

**Using Replit Checkpoints UI:**
1. Open the Replit history panel (clock icon in sidebar)
2. Locate the last known-good checkpoint by timestamp
3. Click "Restore this checkpoint"
4. Restart the "Start Dashboard" workflow

**Using git (if checkpoints are git commits):**
```bash
# List recent commits
git --no-optional-locks log --oneline -10

# Restore to specific commit (creates new checkout)
git --no-optional-locks show <commit-id>:server.js > server.js
git --no-optional-locks show <commit-id>:public/index.html > public/index.html

# Restart workflow
```

**Rollback decision criteria:**

| Symptom | Rollback trigger? |
|---|---|
| Dashboard blank on all browsers after deployment | Yes |
| `/api/health` returns 500 after deployment | Yes |
| Single data source (NSE/YF) failing | No — check INC-02 / INC-04 first |
| Chart renders but one indicator is missing | No — hotfix in `index.html` |

---

## 5. Configuration Management

### 5.1 Environment Variables

The application has minimal configuration needs. No secrets or API keys are required.

| Variable | Default | Description |
|---|---|---|
| `PORT` | `5000` | HTTP server listen port. Override only if deploying outside Replit. |
| `NODE_ENV` | (unset) | Set to `production` to suppress development-only logging. |

**Setting PORT on Replit:**
```bash
# In Replit Secrets tab, or:
export PORT=8080
node server.js
```

> Replit's Autoscale deployment always uses port 5000 internally, mapped to HTTPS externally. Do not change the port without also updating `.replit` port bindings.

### 5.2 NSE Session Cache TTL

Location: `server.js`, line ~15:
```javascript
const NSE_SESSION_TTL = 5 * 60 * 1000;   // 5 minutes in milliseconds
```

**When to change:**
- If NSE starts returning 403 errors frequently → reduce TTL to `2 * 60 * 1000` (2 minutes)
- If NSE homepage load is causing latency issues → increase TTL to `10 * 60 * 1000` (10 minutes)

After changing, restart the workflow for the new value to take effect.

### 5.3 Fetch Timeouts

Location: `server.js`:
```javascript
const YF_FETCH_TIMEOUT = 10_000;       // Yahoo Finance data timeout (ms)
const NSE_SESSION_TIMEOUT = 8_000;     // NSE homepage session fetch timeout (ms)
```

**Tuning guidance:**
- If deployed in a region far from US East (Yahoo Finance servers): increase `YF_FETCH_TIMEOUT` to 15,000
- If NSE session fetches are consistently slow: increase `NSE_SESSION_TIMEOUT` to 12,000

### 5.4 Frontend Refresh Interval

Location: `public/index.html`:
```javascript
const REFRESH_INTERVAL = 30;   // seconds
```

**Change process:**
1. Edit `public/index.html`
2. No server restart required — active browser sessions will pick up the change on next hard-refresh
3. Note: reducing below 15 seconds risks rate-limiting from Yahoo Finance (~2000 req/hr limit)

---

## 6. Health Checks & Monitoring

### 6.1 Primary Health Endpoint

```
GET /api/health
```

**Expected response (HTTP 200):**
```json
{ "ok": true, "time": "2026-05-14T09:30:00.000Z" }
```

**Abnormal responses:**

| Response | Cause | Action |
|---|---|---|
| HTTP 200, `ok: true` | Healthy | None |
| Connection refused | Process not running | Restart workflow |
| HTTP 500 | Express crashed mid-startup | Check server.js logs |
| Timeout | Process hung | Kill and restart workflow |

### 6.2 Data Source Health Checks

Run these ad-hoc to verify each upstream source is reachable via the proxy:

```bash
# Yahoo Finance — ONGC spot price
curl -s "https://$REPLIT_DEV_DOMAIN/api/quote/ONGC.NS" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['chart']['result'][0]['meta']['regularMarketPrice'])"
# Expected: a number like 297.15

# Yahoo Finance — Brent Crude
curl -s "https://$REPLIT_DEV_DOMAIN/api/quote/BZ%3DF" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['chart']['result'][0]['meta']['regularMarketPrice'])"
# Expected: a number like 105.87

# NSE Option Chain (requires market hours for fresh data)
curl -s "https://$REPLIT_DEV_DOMAIN/api/optionchain/ONGC" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('Strikes:', len(d.get('records',{}).get('data',[])))"
# Expected: Strikes: <number> (typically 40–120 strikes)

# NSE Equity Quote (backup price source)
curl -s "https://$REPLIT_DEV_DOMAIN/api/nsequote/ONGC" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('priceInfo',{}).get('lastPrice'))"
# Expected: a number like 297.15
```

### 6.3 Log Monitoring

**Server console logs (Replit workflow console):**

| Log line | Meaning |
|---|---|
| `ONGC Dashboard server running on port 5000` | Clean startup |
| `NSE session refresh...` | Cookie cache was expired, re-fetching |
| `NSE session error: ...` | Homepage handshake failed — see INC-03 |
| `YF fetch error for ONGC.NS: ...` | Yahoo Finance unreachable — see INC-04 |
| `Warning: AbortError` | A fetch timed out — check upstream latency |

**Browser console (for frontend debugging):**

| Log pattern | Meaning |
|---|---|
| `fetchYF failed for ONGC.NS` | Backend returned non-200 |
| `parseYF: no result data` | Yahoo Finance returned empty response |
| `NSE option chain unavailable` | `/api/optionchain` returned null |
| `calcRSI: insufficient candles` | Fewer than 15 data points returned |

---

## 7. Incident Response Playbooks

Each playbook follows: **Symptoms → Diagnosis → Resolution → Verification**

---

### INC-01: Dashboard Shows Blank / No Data

**Symptoms:**
- Page loads but all KPI tiles show `—` or `0`
- Candlestick chart shows loading overlay indefinitely
- Browser console shows `fetchYF failed` errors

**Diagnosis:**

```bash
# Step 1: Check server is running
curl https://$REPLIT_DEV_DOMAIN/api/health
# If connection refused → go to INC-05

# Step 2: Check Yahoo Finance proxy
curl -s "https://$REPLIT_DEV_DOMAIN/api/quote/ONGC.NS" | head -c 200
# If {"error":...} → go to INC-04
# If HTML response → server is returning wrong content type

# Step 3: Check browser network tab
# Open DevTools → Network → filter by /api/
# Check status codes on each /api/quote/ call
```

**Resolution:**

```
A. If server is down → follow INC-05
B. If Yahoo Finance is returning errors → follow INC-04
C. If market is closed (weekend/holiday):
   - This is expected behavior
   - Dashboard shows last session data; candle chart may be empty
   - Verify: check IST time, confirm NSE holiday calendar
D. If all routes return 200 but chart is blank:
   - Hard-refresh browser (Ctrl+Shift+R)
   - Check browser console for Lightweight Charts JS errors
   - Verify CDN resources loaded: unpkg.com/lightweight-charts should be in Sources
```

**Verification:** All 4 KPI tiles show numeric prices; candlestick chart shows candles.

---

### INC-02: Option Chain / Max Pain Missing

**Symptoms:**
- Max Pain KPI tile shows "Pivot Est." instead of a live NSE value
- Option chain panel shows: *"NSE option chain data unavailable. Displaying calculated max pain from pivot."*
- PCR is absent or showing N/A

**Diagnosis:**

```bash
# Test NSE option chain route directly
curl -v "https://$REPLIT_DEV_DOMAIN/api/optionchain/ONGC" 2>&1 | head -50

# Check for 403 (auth failure) vs 200 with empty data vs network error
```

**Common causes:**

| HTTP Status | Cause |
|---|---|
| 403 Forbidden | NSE session cookie expired or invalid — follow INC-03 |
| 200 but empty `data: []` | Market closed; NSE returns empty OC outside market hours |
| 200 with data | Frontend parsing error — check browser console |
| Timeout / 504 | NSE servers slow — will auto-recover on next 30s refresh |

**Resolution:**

```
A. If 403 / auth failure → follow NSE Session Rotation (Section 8)
B. If market is closed → expected; fallback to Pivot P is working correctly
C. If 200 with valid JSON but UI shows missing data:
   - Check that `records.data` is an array and not empty
   - Verify no JS errors in browser console during parseOptionChain()
D. If persistent failures:
   - Check NSE India status: https://www.nseindia.com (manual browser check)
   - If NSE is down, Max Pain will remain on Pivot P fallback — acceptable
```

**Verification:** `/api/optionchain/ONGC` returns HTTP 200 with `records.data` array containing strike rows. Max Pain KPI tile shows a round-number strike price (e.g. ₹295, ₹300).

---

### INC-03: NSE Session Authentication Broken

**Symptoms:**
- `/api/optionchain/ONGC` returns HTTP 403 persistently
- Server console shows: `NSE session error: ...`
- Option chain data absent even during market hours

**Diagnosis:**

This indicates one of three scenarios:
1. NSE has rotated/changed its session cookie names or structure
2. NSE has updated its bot-detection mechanism (Akamai BMP)
3. The server IP has been rate-limited or blocked by NSE

**Step 1 — Confirm it is an auth failure, not a network failure:**

```bash
# Check if NSE is reachable at all
curl -I https://www.nseindia.com
# Expected: HTTP/2 200 with set-cookie headers
# If connection refused / timeout: NSE is down → wait and retry
```

**Step 2 — Inspect current cookie format:**

Add temporary debug logging to `getNSESession()` in `server.js`:

```javascript
// Temporary debug — remove after diagnosis
console.log('[DEBUG] NSE set-cookie headers:', res.headers.getSetCookie());
console.log('[DEBUG] Joined cookies:', nseSession.cookies.substring(0, 200));
```

Restart the workflow and check console output after the first `/api/optionchain/` call.

**Step 3 — Identify changed cookie names:**

Visit `https://www.nseindia.com` in a real Chrome browser and inspect the cookies set (DevTools → Application → Cookies). Compare cookie names to what the server is logging.

**Resolution A — Cookie structure unchanged, session just expired:**

```bash
# Force session refresh by restarting the workflow
# The 5-minute TTL cache will be cleared on restart
# Verify: curl /api/optionchain/ONGC returns 200
```

**Resolution B — NSE has added new required cookies:**

```javascript
// In server.js getNSESession(), check which cookies are being set
// by NSE's Akamai layer. Common NSE session cookies:
//   nsit       → primary session identifier
//   nseappid   → application identifier
//   ak_bmsc    → Akamai Bot Manager session
//   bm_sz      → Akamai Bot Manager size parameter

// If new cookie names appear, the existing code will capture them
// automatically (it joins ALL set-cookie values from the homepage response)
// The only failure case is if NSE requires a JS challenge (rare)
```

**Resolution C — IP rate-limited by NSE:**

```
1. NSE rate limits aggressive scrapers. The 30s refresh + 5min session cache
   means approximately 1 homepage request per 5 minutes from this server.
   This is well within normal limits.

2. If rate-limited:
   a. Increase NSE_SESSION_TTL to 15 * 60 * 1000 (15 minutes)
   b. Restart the workflow
   c. Wait 30–60 minutes for the IP block to expire

3. If running multiple instances: ensure session cache is shared (see Section 10)
```

**Resolution D — NSE requires JS challenge (worst case):**

If NSE's Akamai protection starts requiring JavaScript execution (uncommon but possible), the pure-fetch approach will fail. Mitigation:

```
Option 1: Use a headless browser (Puppeteer) for session acquisition
Option 2: Fall back permanently to Pivot P max pain (update frontend message)
Option 3: Find an alternative NSE option chain data source
```

**Verification:** `/api/optionchain/ONGC` returns HTTP 200 with non-empty `records.data[]`. Server console no longer shows `NSE session error`.

---

### INC-04: Yahoo Finance Data Stale or Failing

**Symptoms:**
- KPI tiles for ONGC, Brent, INR, or VIX show `—`
- Chart overlay stuck on loading spinner
- Server console shows `YF fetch error` or `AbortError`

**Diagnosis:**

```bash
# Test the Yahoo Finance proxy directly
curl -s "https://$REPLIT_DEV_DOMAIN/api/quote/ONGC.NS" | python3 -m json.tool | head -20

# Test directly from server shell (bypass proxy layer)
curl -s \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36" \
  -H "Referer: https://finance.yahoo.com/" \
  "https://query1.finance.yahoo.com/v8/finance/chart/ONGC.NS?interval=5m&range=1d" \
  | head -c 300
```

**Common failure patterns:**

| Response | Cause | Action |
|---|---|---|
| `{"chart":{"error":{"code":"Not Found"}}}` | Symbol not found or delisted | Verify symbol on finance.yahoo.com |
| HTTP 429 Too Many Requests | Rate limit hit | Wait 60 minutes; reduce refresh frequency |
| HTTP 401 Unauthorized | Yahoo has tightened auth | Update `YF_HEADERS` User-Agent string |
| `{"chart":{"result":[{"meta":{},"timestamp":[]...}]}}` | Market closed; zero candles | Normal outside NSE/global hours |
| Connection timeout | Network issue / Yahoo down | Will auto-retry on next 30s cycle |

**Resolution A — Rate limiting (HTTP 429):**

```javascript
// In server.js, add staggered delays between YF calls
// OR reduce REFRESH_INTERVAL to 60s in public/index.html
// Current load: 4 YF symbols × 120 refreshes/hr = 480 req/hr
// Yahoo Finance free limit: ~2000 req/hr per IP
// If 429 occurs, wait and reduce to 60s intervals
```

**Resolution B — Yahoo Finance has updated required headers:**

```javascript
// Visit finance.yahoo.com in Chrome DevTools
// Network tab → find a v8/finance/chart/ request
// Copy the exact request headers Yahoo accepts
// Update YF_HEADERS in server.js:

const YF_HEADERS = {
  'User-Agent': '<updated Chrome UA string>',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://finance.yahoo.com/',
  'Origin': 'https://finance.yahoo.com',
  // Add any new required headers here
}
```

**Resolution C — BZ=F (Brent) symbol returning null:**

Brent Crude futures (`BZ=F`) can return empty data when the front-month contract rolls. Check the symbol:

```bash
# Try alternate Brent symbol
curl -s "https://$REPLIT_DEV_DOMAIN/api/quote/BZ%3DF" | python3 -c \
  "import sys,json; d=json.load(sys.stdin); print(d['chart']['result'][0]['meta'].get('shortName','?'))"
# Should print: "Brent Crude Oil Last Day Financ"
# If empty, check if contract rollover occurred; try BZ%3DF1 or CL%3DF (WTI as fallback)
```

**Verification:** All 4 KPI tiles show live numeric values. Candlestick chart shows ≥ 1 candle bar.

---

### INC-05: Server Process Down / Crash Loop

**Symptoms:**
- `curl /api/health` returns "Connection refused"
- Replit workflow shows as "stopped" or in error state
- Browser shows "Cannot connect" error

**Diagnosis:**

```bash
# Check if port 5000 is in use
lsof -i :5000

# Try starting manually to see error output
node server.js
```

**Common crash causes:**

| Error | Cause | Fix |
|---|---|---|
| `SyntaxError: Unexpected token` | Syntax error introduced in server.js | Revert last change |
| `Error: Cannot find module 'express'` | npm install not run after dependency change | Run `npm install` |
| `Error: listen EADDRINUSE :::5000` | Another process has port 5000 | Kill the other process: `lsof -ti:5000 \| xargs kill` |
| `ReferenceError: fetch is not defined` | Node < 18 | Upgrade Node: `nvm install 20` |
| `TypeError: res.headers.getSetCookie is not a function` | Node < 18 | Same as above |
| Express 5 `*` route error | Using bare `*` instead of `/*splat` | Fix route: `app.get('/*splat', ...)` |

**Resolution:**

```bash
# 1. Read the error output carefully from the crash
node server.js 2>&1 | head -30

# 2. Fix the identified cause

# 3. Restart the Replit workflow:
#    - Click Stop on "Start Dashboard" workflow
#    - Click Start

# 4. Verify:
curl https://$REPLIT_DEV_DOMAIN/api/health
```

---

### INC-06: Chart Not Rendering

**Symptoms:**
- Dashboard loads, KPI tiles show data, but price chart is blank/grey
- "Loading price data..." overlay persists even after data arrives
- RSI or Volume chart is missing

**Diagnosis:**

```bash
# Check browser console for JavaScript errors
# Open DevTools (F12) → Console tab
# Look for:
#   - LightweightCharts errors
#   - "Cannot set properties of null"
#   - "setData is not a function"
#   - CDN load failures (failed to load unpkg.com/...)
#   - "[caught non-Error throw]" warn messages (LWC internal throws, now suppressed)
#   - "[chart] candlestick setData failed:" warnings
```

**Resolution A — CDN failed to load Lightweight Charts:**

```html
<!-- In public/index.html, the CDN import is: -->
<script src="https://unpkg.com/lightweight-charts@4.2.0/dist/lightweight-charts.standalone.production.js"></script>

<!-- If unpkg.com is unreachable, switch to jsdelivr: -->
<script src="https://cdn.jsdelivr.net/npm/lightweight-charts@4.2.0/dist/lightweight-charts.standalone.production.js"></script>
```

As of v1.1, `initPriceChart()` is wrapped in a `try/catch` inside `DOMContentLoaded`. If the CDN fails, the chart area will show a descriptive error message ("Chart library failed to load") instead of a silent blank. Check this message first before investigating data sources.

**Resolution B — Chart container has zero height:**

```javascript
// In browser console, check container dimensions:
document.getElementById('priceChart').getBoundingClientRect()
// If height: 0 → Tailwind CSS CDN failed to load, chart has no container height
// Fix: ensure Tailwind CDN script loaded; check Network tab for cdn.tailwindcss.com
```

**Resolution C — parseYF returns null (no candles):**

```javascript
// In public/index.html, add temporary debug:
console.log('[DEBUG] parsed:', JSON.stringify(parsed?.candles?.length));
// If candles.length === 0 → market is closed, no intraday data
// chartOverlay should show a message; if it doesn't, check the null guard in updatePriceChart
```

**Resolution D — Lightweight Charts throwing on data (v1.1 behaviour change):**

As of v1.1, each `series.setData()` call is individually wrapped in a `try/catch`. If a series is blank but others render correctly, check the browser console for warnings of the form:

```
[chart] candlestick setData failed: data must be asc
[chart] RSI setData failed: data must be asc
```

These indicate that `parseYF` deduplication or sort did not fully resolve the timestamp ordering issue. Steps to investigate:

```javascript
// Temporary debug — add inside updatePriceChart before setData:
const times = cdData.map(c => c.time)
const dups = times.filter((t, i) => times.indexOf(t) !== i)
console.log('[DEBUG] duplicate timestamps:', dups.length, dups.slice(0,5))
const outOfOrder = times.filter((t, i) => i > 0 && t <= times[i-1])
console.log('[DEBUG] out-of-order timestamps:', outOfOrder.length, outOfOrder.slice(0,5))
```

If duplicates or out-of-order timestamps are found, the Yahoo Finance response format may have changed. Report to the team to review the `parseYF` deduplication logic.

**Verification:** Candlestick bars visible in chart panel. Volume histogram shows bars below the candles. RSI panel shows a line between 0–100. Browser console shows no `[chart] * setData failed` warnings.

---

### INC-07: India VIX Missing / Flat Line

**Symptoms:**
- India VIX KPI tile shows `—` or 0
- Macro Pressure Radar chart is missing the VIX spoke
- Browser console: `fetchYF failed for ^INDIAVIX`

**Diagnosis:**

```bash
# Test VIX symbol directly
curl -s "https://$REPLIT_DEV_DOMAIN/api/quote/%5EINDIAVIX" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); r=d['chart']['result']; print(r[0]['meta']['regularMarketPrice'] if r else 'EMPTY')"
```

**Common causes:**
- `^INDIAVIX` returns empty outside NSE trading hours (VIX has no continuous market)
- The `%5E` URL encoding of `^` must be applied — verify with `encodeURIComponent('^INDIAVIX')`
- Yahoo Finance occasionally delists Indian index symbols temporarily

**Resolution:**

```
A. If VIX is missing only outside market hours → expected behavior; dashboard shows last known
B. If VIX is persistently failing:
   - Try symbol INDIAVIX.NS as alternative
   - Or remove VIX from the fetch list and hardcode 15 as a neutral default
C. If VIX tile always shows 0: check changePct computation; prev may be 0 causing divide-by-zero
```

---

## 8. NSE Session Rotation Procedure

Use this procedure whenever NSE authentication needs to be manually refreshed or the session cookie format changes.

### 8.1 Force Session Refresh (Simple)

The simplest fix — restarts the server and clears the in-memory session cache:

```
1. Stop the "Start Dashboard" workflow
2. Start the "Start Dashboard" workflow
3. Within 30 seconds, a new NSE homepage handshake will occur
4. Monitor server console for: "NSE session refresh..." followed by no errors
5. Test: curl /api/optionchain/ONGC | python3 -c "..."
```

### 8.2 Verify Session Cookie Format

If the above doesn't resolve it, diagnose the current cookie structure:

**Step 1** — Add debug logging to `server.js` temporarily:

```javascript
async function getNSESession() {
  // ... existing code ...
  try {
    const res = await fetchWithTimeout('https://www.nseindia.com/', { headers: NSE_BASE_HEADERS }, NSE_SESSION_TIMEOUT);
    const rawCookies = res.headers.getSetCookie();
    console.log('[SESSION DEBUG] Raw cookies received:', rawCookies.length, 'entries');
    rawCookies.forEach((c, i) => console.log(`  Cookie ${i}:`, c.split(';')[0].split('=')[0]));
    // ... rest of function
  }
}
```

**Step 2** — Restart the workflow and check console output.

**Step 3** — Open `https://www.nseindia.com` in a real Chrome browser and compare cookie names in DevTools → Application → Cookies → www.nseindia.com.

**Step 4** — If NSE now requires specific cookies that the server is missing, identify them and check whether they appear in the `set-cookie` response or require JS execution.

**Step 5** — Remove debug logging once resolved.

### 8.3 Update NSE Base Headers (if User-Agent rotation required)

NSE's Akamai BMP system checks the User-Agent string. If it starts rejecting the current UA:

```javascript
// In server.js, update NSE_BASE_HEADERS:
const NSE_BASE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  // ↑ Update to latest Chrome UA from https://www.whatismybrowser.com/guides/the-latest-user-agent/chrome
  'Accept': '*/*',
  'Accept-Language': 'en-US,en;q=0.9,hi;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Referer': 'https://www.nseindia.com/',
  'Connection': 'keep-alive',
  'sec-ch-ua': '"Chromium";v="125", "Not.A/Brand";v="24"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-origin',
}
```

Restart the workflow after any header changes.

---

## 9. Data Source Failover Procedures

### 9.1 Yahoo Finance Failover

If Yahoo Finance v8 is down for an extended period (>30 minutes):

**Option A — Wait** (recommended for outages < 2 hours)

The `Promise.allSettled` pattern retains last-known values. The dashboard will display stale data with the last refresh timestamp visible. This is acceptable for institutional monitoring dashboards.

**Option B — Switch to Yahoo Finance v11 endpoint**

```javascript
// In server.js, change YF_BASE:
// From:
const YF_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart/';
// To:
const YF_BASE = 'https://query2.finance.yahoo.com/v8/finance/chart/';
// query2 is a parallel Yahoo Finance endpoint that sometimes stays up when query1 is degraded
```

**Option C — Switch to NSE equity price for ONGC**

If only ONGC.NS is failing but NSE is up:

```javascript
// In refreshAll() in public/index.html, add fallback:
if (!state.ongc) {
  const nseQuote = await fetch('/api/nsequote/ONGC').then(r => r.json()).catch(() => null);
  if (nseQuote?.priceInfo) {
    state.ongc = {
      price: nseQuote.priceInfo.lastPrice,
      changePct: nseQuote.priceInfo.pChange,
      // candles will be empty — chart stays blank but tiles work
      candles: []
    };
  }
}
```

### 9.2 NSE Option Chain Failover

The system already has an automatic fallback:

```
IF NSE option chain unavailable:
  → Max Pain = Pivot P (Standard Pivot Point)
  → PCR tile hidden or shows "N/A"
  → OI bar chart hidden
  → Max Pain KPI tile annotated with "Pivot Est."
```

No manual intervention needed. The fallback is automatic and displayed transparently to the user.

### 9.3 Complete Data Loss (All Sources Down)

In the rare event all upstream sources are simultaneously unavailable:

1. KPI tiles retain last known values (state is not cleared on failed refreshes)
2. Chart retains last rendered candles (Lightweight Charts data is not cleared)
3. Last refresh timestamp shows when data was last current
4. Error chips appear in chart overlay area

**User communication:** Update the dashboard header text to indicate "Last known data from [timestamp]" — edit `public/index.html` and push.

---

## 10. Scaling Procedures

### 10.1 Current Capacity Estimate

| Resource | Current | Theoretical Max (single instance) |
|---|---|---|
| Concurrent users | 1–5 (internal) | ~50 (before Node.js CPU-bound) |
| YF API calls/hr | 4 symbols × 120 = 480/hr | ~2000/hr (Yahoo limit) |
| NSE sessions | 1 cached per 5 min | — |
| Memory per instance | ~80–120 MB | Node.js default 1.5 GB heap |

### 10.2 Moving to Multiple Instances

The server is **stateless** except for the NSE session cookie cache. To scale horizontally:

**Step 1 — Externalize session cache to Redis:**

```javascript
// Replace in-memory nseSession with Redis:
const redis = require('redis');
const client = redis.createClient({ url: process.env.REDIS_URL });

async function getNSESession() {
  const cached = await client.get('nse_session');
  if (cached) return cached;
  // ... fetch from NSE ...
  await client.setEx('nse_session', 300, cookies);  // TTL: 300 seconds
  return cookies;
}
```

**Step 2 — Deploy behind load balancer:**
- Point load balancer to N instances, all on port 5000
- Session cache is shared via Redis; no sticky sessions needed
- Instances are stateless and interchangeable

**Step 3 — Yahoo Finance rate limit management:**
- With N instances × 4 symbols × 120 req/hr = N × 480 req/hr
- At 5 instances: 2,400 req/hr → near Yahoo's free limit
- Solution: Add a shared Redis cache for YF responses with 25-second TTL (less than the 30s refresh interval to ensure freshness, while preventing redundant upstream calls)

### 10.3 Adding New Equity Symbols

To track additional equities (e.g., RELIANCE.NS, HPCL.NS):

```javascript
// In public/index.html, extend SYMBOLS:
const SYMBOLS = {
  ongc:     'ONGC.NS',
  reliance: 'RELIANCE.NS',    // New
  hpcl:     'HPCL.NS',        // New
  brent:    'BZ=F',
  usdinr:   'USDINR=X',
  vix:      '^INDIAVIX'
}

// In refreshAll(), add new fetch calls:
const relianceRaw = await fetchYF(SYMBOLS.reliance, '5m', '1d');
if (relianceRaw) state.reliance = parseYF(relianceRaw);

// Add corresponding KPI tiles and chart panels in the HTML
```

No backend changes required — `/api/quote/:symbol` works for any Yahoo Finance symbol.

---

## 11. Dependency Upgrade Procedures

### 11.1 Express Upgrade (4.x → 5.x Breaking Changes)

The project is already on Express 5. Key breaking changes to be aware of:

| Change | Express 4 | Express 5 |
|---|---|---|
| Wildcard routes | `app.get('*', ...)` | `app.get('/*splat', ...)` |
| Path parameters | `:param` | Same |
| Error handling | `next(err)` | Same |
| Async errors | Manual try/catch | Auto-caught |

**Upgrade test checklist:**
- [ ] `GET /api/health` returns 200
- [ ] `GET /api/quote/ONGC.NS` returns Yahoo Finance JSON
- [ ] `GET /` returns `public/index.html` (SPA fallback)
- [ ] `GET /nonexistent` returns `public/index.html` (not 404)

### 11.2 Lightweight Charts Upgrade

```bash
# Check current version in public/index.html:
grep -i "lightweight-charts" public/index.html
# Currently: @4.2.0

# Before upgrading, check the Lightweight Charts changelog:
# https://github.com/tradingview/lightweight-charts/blob/master/CHANGELOG.md

# Key API surface used in this project:
# - createChart(container, options)
# - addCandlestickSeries(options)
# - addLineSeries(options)
# - addHistogramSeries(options)
# - series.setData(data[])
# - chart.timeScale().fitContent()
# - CrosshairMode, LineStyle enums
```

**Test after upgrade:**
- [ ] Candlestick chart renders with green/red candles
- [ ] SMA-20 and VWAP line overlays visible
- [ ] Volume histogram below price chart
- [ ] RSI panel with OB/OS lines at 70/30

### 11.3 Chart.js Upgrade

The project uses Chart.js for the Radar chart only.

```bash
# Current: @4.4.0
# Chart.js v4 API used: new Chart(ctx, { type: 'radar', data, options })

# After upgrade, verify:
# - Radar chart renders on the Macro Pressure panel
# - radarChartInst.destroy() still works before re-creation
```

---

## 12. Log Reference

### 12.1 Server Logs (server.js)

All server logs are written to stdout and visible in the Replit workflow console.

| Log message | Level | Meaning |
|---|---|---|
| `ONGC Dashboard server running on port 5000` | INFO | Successful startup |
| `NSE session refresh at <timestamp>` | INFO | Session cache miss, re-fetching |
| `NSE session cached, expires in Xmin` | DEBUG | Session cache hit |
| `NSE session error: <error>` | WARN | Homepage handshake failed; cookies = '' |
| `YF error for <symbol>: HTTP <code>` | WARN | Yahoo Finance returned non-200 |
| `Timeout: <symbol> fetch aborted after 10000ms` | WARN | Upstream request timed out |
| `GET /api/quote/<symbol> 200 <ms>ms` | HTTP | Route access log (Express default) |
| `GET /api/optionchain/<symbol> 403 <ms>ms` | HTTP | NSE auth failure in access log |

### 12.2 Browser Console Logs (public/index.html)

| Log message | Level | Meaning |
|---|---|---|
| `[refresh] starting...` | LOG | refreshAll() called |
| `[refresh] all settled in <ms>ms` | LOG | All 5 fetches completed (success or fail) |
| `fetchYF failed for <symbol>: <reason>` | WARN | A single YF symbol failed |
| `NSE OC fetch failed: <reason>` | WARN | Option chain unavailable |
| `parseYF: null result for <symbol>` | WARN | YF returned empty/malformed JSON |
| `calcRSI: not enough candles (N < 15)` | WARN | Insufficient data for RSI |
| `[chart] updating with N candles` | LOG | Candle count on each chart update |
| `[assessment] bias: BULLISH/NEUTRAL/BEARISH` | LOG | Bias computed |
| `[caught non-Error throw] <message> <source> <line>` | WARN | LWC or other library threw a non-Error string; suppressed by global handler — not a crash |
| `[unhandled rejection suppressed] <reason>` | WARN | An unhandled Promise rejection was intercepted; suppressed — investigate reason field |
| `[chart] candlestick setData failed: <e>` | WARN | Candlestick series setData threw; other series unaffected |
| `[chart] volume setData failed: <e>` | WARN | Volume histogram setData threw; price chart unaffected |
| `[chart] SMA setData failed: <e>` | WARN | SMA-20 overlay missing on this refresh cycle |
| `[chart] VWAP setData failed: <e>` | WARN | VWAP overlay missing on this refresh cycle |
| `[chart] RSI setData failed: <e>` | WARN | RSI line missing on this refresh cycle |
| `[chart] fitContent failed: <e>` | WARN | Time scale fit suppressed; chart still rendered |
| `[chart] init failed: <e>` | ERROR | Lightweight Charts library did not load — check CDN |

---

## 13. Runbook Change Log

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-05-14 | MortifiedStylishModel Engineering | Initial runbook — all procedures documented |
| 1.1 | 2026-05-14 | MortifiedStylishModel Engineering | Runtime stability hardening: added INC-06 Resolution D (non-Error throw diagnosis); expanded browser console log reference with v1.1 suppression log patterns; updated INC-06 CDN failure diagnosis to reflect try/catch boot guard; updated Change Log |

---

*End of RUNBOOK Document*  
*MortifiedStylishModel v1.1 — Operations Reference*
