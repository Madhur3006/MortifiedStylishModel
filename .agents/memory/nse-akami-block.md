---
name: NSE upstream access
description: Environment-specific behavior of NSE requests from the dashboard runtime.
---

The NSE website and API currently return Akamai `403 Access Denied` responses from this runtime, including the homepage session handshake. This is an upstream egress/IP restriction, not a dashboard parsing or session-cookie defect.

**Why:** Direct Node and curl requests both receive the same Akamai response before an authenticated NSE API session can be established.

**How to apply:** Treat NSE option-chain and quote data as optional in this environment; preserve the existing pivot/last-known fallback. Do not spend time on client-side chart debugging when Yahoo and `/api/health` are healthy but NSE alone returns 403.