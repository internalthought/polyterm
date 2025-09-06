import test from 'node:test';
import assert from 'node:assert/strict';
import { HttpPolymarketClient } from '../services/client.js';

test('HttpPolymarketClient.searchMarkets builds correct URL and returns JSON', async () => {
  const calls: string[] = [];
  const fakeFetch = async (input: RequestInfo | URL, _init?: RequestInit): Promise<Response> => {
    const u = typeof input === 'string' ? new URL(input) : new URL(input.toString());
    calls.push(u.toString());
    const body = JSON.stringify({ markets: [{ id: '1', slug: 'rain', title: 'Will it rain?' }] });
    return new Response(body, { status: 200, headers: { 'content-type': 'application/json' } });
  };

  const client = new HttpPolymarketClient({ baseURL: 'https://api.pm', fetch: fakeFetch as any });
  const res = await client.searchMarkets('rain');
  assert.equal(calls.length, 1);
  const u = new URL(calls[0]);
  assert.equal(u.origin, 'https://api.pm');
  assert.equal(u.pathname, '/search');
  assert.equal(u.searchParams.get('query'), 'rain');
  assert.equal(u.searchParams.get('limit'), '20');
  assert.ok(Array.isArray(res.markets));
  assert.equal(res.markets![0].slug, 'rain');
});

test('HttpPolymarketClient.getMarketBySlug and getMarketById call correct endpoints', async () => {
  const calls: string[] = [];
  const fakeFetch = async (input: RequestInfo | URL): Promise<Response> => {
    const u = typeof input === 'string' ? new URL(input) : new URL(input.toString());
    calls.push(u.toString());
    const body = JSON.stringify({ id: '1', slug: 'rain', title: 'Will it rain?' });
    return new Response(body, { status: 200, headers: { 'content-type': 'application/json' } });
  };

  const client = new HttpPolymarketClient({ baseURL: 'https://api.pm', fetch: fakeFetch as any });
  const bySlug = await client.getMarketBySlug('rain');
  const byId = await client.getMarketById('123');
  assert.equal(calls.length, 2);
  const u1 = new URL(calls[0]);
  const u2 = new URL(calls[1]);
  assert.equal(u1.pathname, '/markets/slug/rain');
  assert.equal(u2.pathname, '/markets/123');
  assert.equal(bySlug.slug, 'rain');
  assert.equal(byId.id, '1');
});

test('HttpPolymarketClient.getLastPrice and getMidpoint call expected URLs and normalize numbers', async () => {
  const calls: string[] = [];
  const fakeFetch = async (input: RequestInfo | URL): Promise<Response> => {
    const u = typeof input === 'string' ? new URL(input) : new URL(input.toString());
    calls.push(u.toString());
    if (u.pathname.includes('/prices/last/')) {
      return new Response(JSON.stringify({ tokenId: 'tok', price: '0.42', ts: '2025-01-01T00:00:00Z' }), { status: 200 });
    }
    if (u.pathname.includes('/prices/midpoint/')) {
      return new Response(JSON.stringify({ tokenId: 'tok', midpoint: 0.5, ts: '2025-01-01T00:00:00Z' }), { status: 200 });
    }
    return new Response('{}', { status: 404 });
  };

  const client = new HttpPolymarketClient({ baseURL: 'https://api.pm', fetch: fakeFetch as any });
  const last = await client.getLastPrice('tok');
  const mid = await client.getMidpoint('tok');
  assert.equal(calls.length, 2);
  assert.ok(calls[0].includes('/prices/last/tok'));
  assert.ok(calls[1].includes('/prices/midpoint/tok'));
  assert.equal(last.tokenId, 'tok');
  assert.equal(last.price, 0.42);
  assert.equal(mid.midpoint, 0.5);
});
