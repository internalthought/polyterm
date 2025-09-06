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

