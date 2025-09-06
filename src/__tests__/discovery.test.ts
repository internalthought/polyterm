import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeMarket,
  normalizeSearch,
  type RawSearchResponse,
  extractMarketRef,
} from '../services/polymarket.js';

test('normalizeMarket maps raw to Market DTO and drops invalid', () => {
  const valid = normalizeMarket({ id: '123', slug: 'will-it-rain', question: 'Will it rain?', volume: '1000', openInterest: 50, endDate: '2025-12-31T00:00:00Z', status: 'active', tokenIds: ['t1','t2'] });
  assert.ok(valid);
  assert.equal(valid!.id, '123');
  assert.equal(valid!.slug, 'will-it-rain');
  assert.equal(valid!.title, 'Will it rain?');
  assert.equal(valid!.volume, 1000);
  assert.equal(valid!.openInterest, 50);
  assert.equal(valid!.endTime, '2025-12-31T00:00:00Z');
  assert.deepEqual(valid!.tokenIds, ['t1', 't2']);

  const invalid = normalizeMarket({ slug: 'x', question: 'missing id', volume: 0 });
  assert.equal(invalid, null);
});

test('normalizeSearch returns only valid markets with expected fields', () => {
  const res: RawSearchResponse = {
    markets: [
      { id: '1', slug: 'a', question: 'A?', volume: '10' },
      { id: '', slug: 'b', question: 'B?' },
      { slug: 'c', question: 'C?' },
    ],
  };
  const list = normalizeSearch(res);
  assert.equal(list.length, 1);
  assert.deepEqual(list[0], {
    id: '1', slug: 'a', title: 'A?', endTime: undefined, status: undefined, volume: 10, openInterest: undefined, tokenIds: undefined,
  });
});

test('extractMarketRef parses slug or id from input or URL', () => {
  // Plain slug
  assert.deepEqual(extractMarketRef('will-it-rain'), { slug: 'will-it-rain' });

  // Numeric id
  assert.deepEqual(extractMarketRef('12345'), { id: '12345' });

  // URL with /market/<slug>
  assert.deepEqual(
    extractMarketRef('https://polymarket.com/market/will-it-rain'),
    { slug: 'will-it-rain' },
  );

  // URL with /event/<slug>
  assert.deepEqual(
    extractMarketRef('https://polymarket.com/event/will-it-rain?ref=x'),
    { slug: 'will-it-rain' },
  );

  // URL with id path
  assert.deepEqual(
    extractMarketRef('https://polymarket.com/market/12345'),
    { id: '12345' },
  );

  // URL with query param tokenId
  assert.deepEqual(
    extractMarketRef('https://polymarket.com/market/will-it-rain?tokenId=abc123'),
    { id: 'abc123' },
  );

  // Invalid inputs yield null
  assert.equal(extractMarketRef(''), null);
  assert.equal(extractMarketRef('   '), null);
});
