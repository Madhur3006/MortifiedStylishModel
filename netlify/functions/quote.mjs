const YAHOO_CHART_API = "https://query1.finance.yahoo.com/v8/finance/chart/";
const ALLOWED_INTERVALS = new Set(["1m", "2m", "5m", "15m", "30m", "60m", "90m", "1d", "5d", "1wk", "1mo", "3mo"]);
const ALLOWED_RANGES = new Set(["1d", "5d", "1mo", "3mo", "6mo", "1y", "2y", "5y", "10y", "ytd", "max"]);

export const config = { path: "/api/quote/:symbol" };

export default async (request, context) => {
  if (request.method !== "GET") {
    return json({ error: "Method not allowed" }, 405, { Allow: "GET" });
  }

  let symbol;
  try {
    symbol = decodeURIComponent(context.params.symbol || "");
  } catch {
    return json({ error: "Invalid symbol" }, 400);
  }

  if (!symbol || !/^[A-Za-z0-9.^=_-]{1,32}$/.test(symbol)) {
    return json({ error: "Invalid symbol" }, 400);
  }

  const requestUrl = new URL(request.url);
  const interval = requestUrl.searchParams.get("interval") || "5m";
  const range = requestUrl.searchParams.get("range") || "1d";
  if (!ALLOWED_INTERVALS.has(interval) || !ALLOWED_RANGES.has(range)) {
    return json({ error: "Unsupported interval or range" }, 400);
  }

  const url = new URL(encodeURIComponent(symbol), YAHOO_CHART_API);
  url.search = new URLSearchParams({
    interval,
    range,
    includePrePost: "false",
    events: "div|split",
  }).toString();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const upstream = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ONGC-Dashboard/1.0)",
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    if (!upstream.ok) {
      return json({ error: "Yahoo Finance returned " + upstream.status }, upstream.status);
    }

    return new Response(await upstream.text(), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return json({ error: "Yahoo Finance request failed or timed out" }, 502);
  } finally {
    clearTimeout(timeout);
  }
};

function json(body, status, additionalHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...additionalHeaders },
  });
}
