import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPolymarketSearchURL } from '../services/request.js';

test('buildPolymarketSearchURL builds URL with query and defaults', () => {
  const url = buildPolymarketSearchURL('https://api.polymarket.com', 'rain');
  const u = new URL(url);
  assert.equal(u.origin, 'https://api.polymarket.com');
  assert.equal(u.pathname, '/search');
  assert.equal(u.searchParams.get('query'), 'rain');
  // default limit when not provided
  assert.equal(u.searchParams.get('limit'), '20');
});

test('buildPolymarketSearchURL encodes query and serializes types', () => {
  const url = buildPolymarketSearchURL('https://api.pm.test', 'will it rain?', {
    limit: 50,
    types: ['markets', 'events'],
  });
  const u = new URL(url);
  assert.equal(u.searchParams.get('query'), 'will it rain?');
  assert.equal(u.searchParams.get('limit'), '50');
  assert.equal(u.searchParams.get('types'), 'markets,events');
});

test('buildPolymarketSearchURL is resilient to base with/without slash', () => {
  const a = buildPolymarketSearchURL('https://api.pm', 'q');
  const b = buildPolymarketSearchURL('https://api.pm/', 'q');
  assert.equal(new URL(a).pathname, '/search');
  assert.equal(new URL(b).pathname, '/search');
});

