export const config = {
  path: ["/api/optionchain/:symbol", "/api/nsequote/:symbol"],
};

export default async () => new Response(JSON.stringify({
  error: "NSE data source disabled",
  reason: "Upstream NSE access is unavailable from this runtime",
  fallback: "Yahoo Finance data and pivot-based estimates remain active",
}), {
  status: 410,
  headers: { "Content-Type": "application/json; charset=utf-8" },
});
