import test from 'node:test';
import assert from 'node:assert/strict';
import { handleSearch, handleMarket } from '../server/app.js';
import { handlePrice, handleMidpoint } from '../server/app.js';

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
