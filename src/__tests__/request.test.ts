import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPolymarketSearchURL,
  buildGetMarketByIdURL,
  buildGetMarketBySlugURL,
  buildGetLastPriceURL,
  buildGetMidpointURL,
  buildGetTagsURL,
} from '../services/request.js';

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

test('buildGetMarketByIdURL and buildGetMarketBySlugURL build expected paths', () => {
  const idUrl = buildGetMarketByIdURL('https://api.pm', '123');
  const slugUrl = buildGetMarketBySlugURL('https://api.pm/', 'will-it-rain');
  const u1 = new URL(idUrl);
  const u2 = new URL(slugUrl);
  assert.equal(u1.origin, 'https://api.pm');
  assert.equal(u1.pathname, '/markets/123');
  assert.equal(u2.origin, 'https://api.pm');
  assert.equal(u2.pathname, '/markets/slug/will-it-rain');
});

test('price URL builders', () => {
  const last = buildGetLastPriceURL('https://api.pm', 'tok123');
  const mid = buildGetMidpointURL('https://api.pm/', 'tok123');
  const u1 = new URL(last);
  const u2 = new URL(mid);
  assert.equal(u1.pathname, '/prices/last/tok123');
  assert.equal(u2.pathname, '/prices/midpoint/tok123');
});

test('buildGetTagsURL builds expected path', () => {
  const url = buildGetTagsURL('https://api.pm/');
  const u = new URL(url);
  assert.equal(u.origin, 'https://api.pm');
  assert.equal(u.pathname, '/tags');
});
