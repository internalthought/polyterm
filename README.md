MarketLens Data Service (MVP)

Overview
- Thin Node proxy exposing normalized Polymarket data for the MarketLens web app.
- TypeScript, Node’s built-in test runner, zero external runtime deps.

Quick Start
- Build: `npm run build`
- Run: `POLYMARKET_API_BASE=https://api.polymarket.com npm start`
  - Env: `POLYMARKET_API_BASE` sets the upstream base URL for the official API.

Endpoints
- `GET /health` → `{ ok: true }`
- `GET /api/search?q=<query>` → `{ data: Market[] }`

Implementation Notes
- URL parsing: `extractMarketRef(input)` returns `{ slug }` or `{ id }` from plain input or market URLs.
- Search: `buildPolymarketSearchURL(base, query, opts?)` constructs upstream URL; the HTTP client uses it.
- Client: `HttpPolymarketClient` (injectable `fetch`) powers the server when `POLYMARKET_API_BASE` is set.
- DTOs and normalization live under `src/domain` and `src/services`.

Testing
- Unit tests only by default (fast, no sockets): `python3 tools/test.py --category unit`.
- Node built-in test runner; TypeScript compiled to `dist/` before tests.

