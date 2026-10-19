# ONGC Live Institutional Dashboard

A dark, real-time dashboard for ONGC market monitoring, with price charts, technical indicators, macro factors, support and resistance levels, and a trader assessment.

## Requirements

- Node.js 18 or newer
- npm

## Run locally

```bash
npm ci
npm start
```

Open [http://localhost:5000](http://localhost:5000). Set `PORT` to use a different port.

The health endpoint is available at `/api/health`. Yahoo Finance data is fetched by the server. NSE option chain routes are currently disabled because the upstream blocks this runtime; the dashboard falls back to pivot-based estimates.

## Project files

- `server.js` — Express server and market-data proxy
- `public/index.html` — dashboard UI
- `docs/` — system design and operations documentation

## Notes

Market data and analysis are provided for informational purposes and are not investment advice.
