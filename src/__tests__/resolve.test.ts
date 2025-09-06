import test from 'node:test';
import assert from 'node:assert/strict';
import { handleResolve } from '../server/app.js';

test('handleResolve returns 400 on missing input', async () => {
  const { status, payload } = await handleResolve({ input: '' });
  assert.equal(status, 400);
  assert.equal((payload as any).error, 'missing input');
});

test('handleResolve parses slug or id from input/URL', async () => {
  // slug
  let r = await handleResolve({ input: 'will-it-rain' });
  assert.equal(r.status, 200);
  assert.deepEqual(r.payload, { slug: 'will-it-rain' });

  // id
  r = await handleResolve({ input: '12345' });
  assert.equal(r.status, 200);
  assert.deepEqual(r.payload, { id: '12345' });

  // URL path
  r = await handleResolve({ input: 'https://polymarket.com/market/will-it-rain' });
  assert.equal(r.status, 200);
  assert.deepEqual(r.payload, { slug: 'will-it-rain' });

  // URL query param tokenId
  r = await handleResolve({ input: 'https://polymarket.com/market/x?tokenId=abc123' });
  assert.equal(r.status, 200);
  assert.deepEqual(r.payload, { id: 'abc123' });
});

