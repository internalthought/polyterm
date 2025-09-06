export type SearchOptions = {
  limit?: number;
  types?: Array<'markets' | 'events' | 'profiles'>;
};

/**
 * Build the official Polymarket search URL.
 * This focuses purely on URL construction so it is unit-testable and side-effect free.
 */
export function buildPolymarketSearchURL(base: string, query: string, opts: SearchOptions = {}): string {
  const root = base.endsWith('/') ? base.slice(0, -1) : base;
  const u = new URL('/search', root);
  u.searchParams.set('query', query);
  const limit = opts.limit ?? 20;
  u.searchParams.set('limit', String(limit));
  if (opts.types && opts.types.length > 0) {
    u.searchParams.set('types', opts.types.join(','));
  }
  return u.toString();
}

export function buildGetMarketByIdURL(base: string, id: string): string {
  const root = base.endsWith('/') ? base.slice(0, -1) : base;
  const u = new URL(`/markets/${encodeURIComponent(id)}`, root);
  return u.toString();
}

export function buildGetMarketBySlugURL(base: string, slug: string): string {
  const root = base.endsWith('/') ? base.slice(0, -1) : base;
  const u = new URL(`/markets/slug/${encodeURIComponent(slug)}`, root);
  return u.toString();
}

export function buildGetLastPriceURL(base: string, tokenId: string): string {
  const root = base.endsWith('/') ? base.slice(0, -1) : base;
  const u = new URL(`/prices/last/${encodeURIComponent(tokenId)}`, root);
  return u.toString();
}

export function buildGetMidpointURL(base: string, tokenId: string): string {
  const root = base.endsWith('/') ? base.slice(0, -1) : base;
  const u = new URL(`/prices/midpoint/${encodeURIComponent(tokenId)}`, root);
  return u.toString();
}

export function buildGetBookURL(base: string, tokenId: string, opts: { depth?: number } = {}): string {
  const root = base.endsWith('/') ? base.slice(0, -1) : base;
  const u = new URL(`/books/${encodeURIComponent(tokenId)}`, root);
  if (opts.depth != null) u.searchParams.set('depth', String(opts.depth));
  return u.toString();
}

export function buildGetTradesURL(base: string, tokenId: string, opts: { limit?: number } = {}): string {
  const root = base.endsWith('/') ? base.slice(0, -1) : base;
  const u = new URL(`/trades/${encodeURIComponent(tokenId)}`, root);
  if (opts.limit != null) u.searchParams.set('limit', String(opts.limit));
  return u.toString();
}
