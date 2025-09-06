import { createServer } from './app.js';
import { HttpPolymarketClient } from '../services/client.js';

// Configure HttpPolymarketClient if an API base is provided; otherwise keep a placeholder that throws.
const polyBase = process.env.POLYMARKET_API_BASE;
const client = polyBase
  ? new HttpPolymarketClient({ baseURL: polyBase })
  : {
      async searchMarkets(_q: string) {
        throw new Error('Upstream client not configured: set POLYMARKET_API_BASE');
      },
    };

const server = createServer({ client });
const port = Number(process.env.PORT || 3000);
server.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`MarketLens data service listening on :${port}`);
});
