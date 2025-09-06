import test from 'node:test';
import assert from 'node:assert/strict';
import { handleSearch, handleMarket, handleBook, handleTrades } from '../server/app.js';
import { handlePrice, handleMidpoint } from '../server/app.js';
import { handleSpread } from '../server/app.js';
import { handleHistory } from '../server/app.js';
import { handleTags } from '../server/app.js';

test('handleSearch requires q', async () => {
  const fakeClient = { searchMarkets: async (_q: string) => ({ markets: [] }) } as any;
  const r = await handleSearch({ client: fakeClient }, { q: '' });
  assert.equal(r.status, 400);
  assert.equal((r.payload as any).error, 'missing q');
});

test('handleSearch normalizes markets', async () => {
  const fakeClient = {
    async searchMarkets(q: string) {
      return q === 'rain'
        ? { markets: [{ id: '1', slug: 'rain', question: 'Will it rain?', volume: '5' }] }
        : { markets: [] };
    },
  } as any;
  const r = await handleSearch({ client: fakeClient }, { q: 'rain' });
  assert.equal(r.status, 200);
  const data = (r.payload as any).data;
  assert.equal(Array.isArray(data), true);
  assert.equal(data.length, 1);
  assert.equal(data[0].title, 'Will it rain?');
  assert.equal(data[0].volume, 5);
});

test('handleSearch parses limit/types and passes to client', async () => {
  const seen: any[] = [];
  const fakeClient = {
    async searchMarkets(q: string, opts?: any) {
      seen.push({ q, opts });
      return { markets: [{ id: '1', slug: 'rain', question: 'Q' }] };
    },
  } as any;
  const r = await handleSearch(
    { client: fakeClient },
    { q: 'rain', limit: '50', types: 'markets,events' } as any,
  );
  assert.equal(r.status, 200);
  assert.equal(seen.length, 1);
  assert.equal(seen[0].q, 'rain');
  assert.deepEqual(seen[0].opts, { limit: 50, types: ['markets', 'events'] });
});

test('handleMarket returns upstream_error on client failure', async () => {
  const fakeClient = {
    async getMarketBySlug(_s: string) { throw new Error('boom'); },
  } as any;
  const r = await handleMarket({ client: fakeClient }, { input: 'slug-here' });
  assert.equal(r.status, 502);
  assert.equal((r.payload as any).error, 'upstream_error');
});

test('handlePrice and handleMidpoint require tokenId and normalize number fields', async () => {
  // missing tokenId
  let r = await handlePrice({ client: {} as any }, { tokenId: '' } as any);
  assert.equal(r.status, 400);

  const fakeClient = {
    async getLastPrice(tokenId: string) { return { tokenId, price: '0.12', ts: 't' }; },
    async getMidpoint(tokenId: string) { return { tokenId, midpoint: '0.34', ts: 't' }; },
  } as any;

  r = await handlePrice({ client: fakeClient }, { tokenId: 'abc' } as any);
  assert.equal(r.status, 200);
  assert.equal((r.payload as any).data.price, 0.12);

  const m = await handleMidpoint({ client: fakeClient }, { tokenId: 'abc' } as any);
  assert.equal(m.status, 200);
  assert.equal((m.payload as any).data.midpoint, 0.34);
});

test('handleBook and handleTrades parse numeric options and normalize data', async () => {
  const seen: any[] = [];
  const fakeClient = {
    async getBookSnapshot(tokenId: string, opts?: any) {
      seen.push({ tokenId, opts });
      return { tokenId, bids: [["0.40","100"]], asks: [["0.60","200"]], ts: 't', seq: 1 };
    },
    async getRecentTrades(tokenId: string, opts?: any) {
      seen.push({ tokenId, opts });
      return [
        { tokenId, side: 'buy', price: '0.41', size: '10', ts: 't', tradeId: 't1' },
      ];
    },
  } as any;

  const b = await handleBook({ client: fakeClient }, { tokenId: 'tok', depth: '5' } as any);
  assert.equal(b.status, 200);
  assert.deepEqual(seen[0], { tokenId: 'tok', opts: { depth: 5 } });
  assert.equal((b.payload as any).data.bids[0].price, 0.4);
  assert.equal((b.payload as any).data.bids[0].size, 100);

  const t = await handleTrades({ client: fakeClient }, { tokenId: 'tok', limit: '1' } as any);
  assert.equal(t.status, 200);
  assert.deepEqual(seen[1], { tokenId: 'tok', opts: { limit: 1 } });
  assert.equal((t.payload as any).data[0].price, 0.41);
  assert.equal((t.payload as any).data[0].size, 10);
});

test('handleTags returns list of tag names', async () => {
  const fakeClient = {
    async listTags() { return ['sports', 'politics']; },
  } as any;
  const r = await handleTags({ client: fakeClient } as any);
  assert.equal(r.status, 200);
  assert.deepEqual((r.payload as any).data, ['sports', 'politics']);
});

test('handleTags returns upstream_error on client failure', async () => {
  const fakeClient = {
    async listTags() { throw new Error('boom'); },
  } as any;
  const r = await handleTags({ client: fakeClient } as any);
  assert.equal(r.status, 502);
  assert.equal((r.payload as any).error, 'upstream_error');
});

test('handleHistory requires tokenId and passes interval/limit', async () => {
  // missing tokenId
  let r = await handleHistory({ client: {} as any } as any, { tokenId: '' } as any);
  assert.equal(r.status, 400);

  const seen: any[] = [];
  const fakeClient = {
    async getPriceHistory(tokenId: string, opts?: any) {
      seen.push({ tokenId, opts });
      return [ { ts: 't', price: 0.4 } ];
    },
  } as any;
  r = await handleHistory({ client: fakeClient } as any, { tokenId: 'tok', interval: '1h', limit: '100' } as any);
  assert.equal(r.status, 200);
  assert.deepEqual(seen[0], { tokenId: 'tok', opts: { interval: '1h', limit: 100 } });
  assert.equal((r.payload as any).data[0].price, 0.4);
});

test('handleSpread computes from book when upstream not available', async () => {
  const fakeClient = {
    async getBookSnapshot(tokenId: string) {
      return { tokenId, bids: [["0.45","10"], ["0.44","5"]], asks: [["0.55","8"], ["0.56","7"]], ts: 't', seq: 1 };
    },
  } as any;
  const r = await handleSpread({ client: fakeClient } as any, { tokenId: 'tok' } as any);
  assert.equal(r.status, 200);
  const data = (r.payload as any).data;
  assert.equal(data.bid, 0.45);
  assert.equal(data.ask, 0.55);
  assert.equal(data.midpoint, 0.5);
  assert.equal(data.spread, 0.10);
});

test('handleSpread uses upstream spreads when available', async () => {
  const fakeClient = {
    async getSpreads(tokenId: string) { return { tokenId, bid: '0.40', ask: '0.60' }; },
  } as any;
  const r = await handleSpread({ client: fakeClient } as any, { tokenId: 'tok' } as any);
  const data = (r.payload as any).data;
  assert.equal(r.status, 200);
  assert.equal(data.bid, 0.4);
  assert.equal(data.ask, 0.6);
  assert.equal(data.midpoint, 0.5);
  assert.equal(data.spread, 0.2);
});
