export const config = { path: "/api/health" };

export default async () => new Response(JSON.stringify({ ok: true, time: new Date().toISOString() }), {
  headers: { "Content-Type": "application/json; charset=utf-8" },
});
