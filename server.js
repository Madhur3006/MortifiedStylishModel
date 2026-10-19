const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

const YF_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart/';
const YF_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://finance.yahoo.com/',
  'Origin': 'https://finance.yahoo.com',
};

async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

// ─── YAHOO FINANCE PROXY ─────────────────────────────────────────────────────
app.get('/api/quote/:symbol', async (req, res) => {
  const { symbol } = req.params;
  const { interval = '5m', range = '1d' } = req.query;
  const url = `${YF_BASE}${encodeURIComponent(symbol)}?interval=${interval}&range=${range}&includePrePost=false&events=div%7Csplit`;
  try {
    const r = await fetchWithTimeout(url, { headers: YF_HEADERS });
    if (!r.ok) {
      console.warn(`YF ${symbol} returned ${r.status}`);
      return res.status(r.status).json({ error: `Yahoo Finance returned ${r.status}` });
    }
    const data = await r.json();
    res.setHeader('Cache-Control', 'no-store');
    res.json(data);
  } catch (e) {
    console.error('YF fetch error:', symbol, e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── DISCONNECTED NSE ROUTES ─────────────────────────────────────────────────
// NSE currently blocks this runtime at the Akamai edge. Keep these compatibility
// routes explicit so stale clients receive a useful response without triggering
// another outbound request on every refresh.
function nseDisabled(res) {
  res.status(410).json({
    error: 'NSE data source disabled',
    reason: 'Upstream NSE access is unavailable from this runtime',
    fallback: 'Yahoo Finance data and pivot-based estimates remain active'
  });
}

app.get('/api/optionchain/:symbol', (req, res) => nseDisabled(res));
app.get('/api/nsequote/:symbol', (req, res) => nseDisabled(res));

// ─── HEALTH ──────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// ─── SERVE FRONTEND ───────────────────────────────────────────────────────────
app.get('/*splat', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`ONGC Dashboard server running on port ${PORT}`);
});
