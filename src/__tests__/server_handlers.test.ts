import test from 'node:test';
import assert from 'node:assert/strict';
import { handleSearch, handleMarket } from '../server/app.js';

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

test('handleMarket returns upstream_error on client failure', async () => {
  const fakeClient = {
    async getMarketBySlug(_s: string) { throw new Error('boom'); },
  } as any;
  const r = await handleMarket({ client: fakeClient }, { input: 'slug-here' });
  assert.equal(r.status, 502);
  assert.equal((r.payload as any).error, 'upstream_error');
});

