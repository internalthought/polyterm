import test from 'node:test';
import assert from 'node:assert/strict';
import { handleMarket } from '../server/app.js';

test('handleMarket returns 400 when input missing', async () => {
  const fakeClient = {} as any;
  const { status, payload } = await handleMarket({ client: fakeClient }, { input: '' });
  assert.equal(status, 400);
  assert.equal((payload as any).error, 'missing input');
});

test('handleMarket fetches by slug and id and normalizes', async () => {
  const fakeClient = {
    async getMarketBySlug(slug: string) {
      return { id: '1', slug, title: 'Rain?' };
    },
    async getMarketById(id: string) {
      return { id, slug: 'rain', title: 'Rain?' };
    },
  } as any;

  // slug path
  let r = await handleMarket({ client: fakeClient }, { input: 'will-it-rain' });
  assert.equal(r.status, 200);
  assert.equal((r.payload as any).data.slug, 'will-it-rain');

  // id path
  r = await handleMarket({ client: fakeClient }, { input: '123' });
  assert.equal(r.status, 200);
  assert.equal((r.payload as any).data.id, '123');
});

