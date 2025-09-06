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
 - `GET /api/resolve?input=<url|slug|id>` → `{ slug? id? }` (alias: `/api/market/resolve`)
 - `GET /api/market?input=<url|slug|id>` → `{ data: Market }`
- `GET /api/price?tokenId=<id>` → `{ data: { tokenId, price, ts? } }`
- `GET /api/midpoint?tokenId=<id>` → `{ data: { tokenId, midpoint, ts? } }`
 - `GET /api/book?tokenId=<id>&depth=<n?>` → `{ data: { tokenId, bids: Level[], asks: Level[], ts?, seq } }`
 - `GET /api/trades?tokenId=<id>&limit=<n?>` → `{ data: Trade[] }`
  - `GET /api/history?tokenId=<id>&interval=<1m|5m|1h|1d>&limit=<n?>&from=<iso>&to=<iso>` → `{ data: Array<{ ts, price }> }`
  - `GET /api/tags` → `{ data: string[] }`

Implementation Notes
- URL parsing: `extractMarketRef(input)` returns `{ slug }` or `{ id }` from plain input or market URLs.
- Search: `buildPolymarketSearchURL(base, query, opts?)` constructs upstream URL; the HTTP client uses it.
- Client: `HttpPolymarketClient` (injectable `fetch`) powers the server when `POLYMARKET_API_BASE` is set.
  - Also supports: `listTags()` using `buildGetTagsURL(base)`.
  - Price history: `getPriceHistory(tokenId, { interval?, limit?, fromTs?, toTs? })` via `buildGetPriceHistoryURL(base, tokenId, opts)`.
- Market detail: `handleMarket(deps, { input })` resolves slug/id then calls client `getMarketBySlug`/`getMarketById` and normalizes.
- Prices: `handlePrice`/`handleMidpoint` call client `getLastPrice`/`getMidpoint` with numeric normalization.
 - Order book: `handleBook` fetches snapshot with optional `depth`, normalizes numeric levels.
 - Trades: `handleTrades` fetches recent trades with optional `limit`, normalizes numeric fields.
- DTOs and normalization live under `src/domain` and `src/services`.

Testing
- Unit tests only by default (fast, no sockets): `python3 tools/test.py --category unit`.
- Node built-in test runner; TypeScript compiled to `dist/` before tests.
