import type { Market } from '../domain/dto.js';

// Raw shapes (partial) based on tools/polymarket_docs
export type RawSearchMarket = {
  id?: string;
  slug?: string;
  question?: string;
  title?: string; // some endpoints use title
  volume?: number | string;
  openInterest?: number | string;
  endDate?: string; // ISO
  status?: string;
  tokenIds?: string[];
};

export type RawSearchResponse = {
  markets?: RawSearchMarket[];
};

export interface PolymarketClient {
  searchMarkets(query: string, opts?: { limit?: number; types?: string[] }): Promise<RawSearchResponse>;
  getMarketById?(id: string): Promise<RawSearchMarket>;
  getMarketBySlug?(slug: string): Promise<RawSearchMarket>;
  getLastPrice?(tokenId: string): Promise<{ tokenId: string; price: number | string; ts?: string }>;
  getMidpoint?(tokenId: string): Promise<{ tokenId: string; midpoint: number | string; ts?: string }>;
  getBookSnapshot?(tokenId: string, opts?: { depth?: number }): Promise<any>;
  getRecentTrades?(tokenId: string, opts?: { limit?: number }): Promise<any>;
  listTags?(): Promise<string[]>;
  getPriceHistory?(tokenId: string, opts?: { interval?: string; limit?: number; fromTs?: string; toTs?: string }): Promise<Array<{ ts: string; price: number }>>;
}

export type MarketRef = { id?: string; slug?: string } | null;

function isLikelyId(s: string): boolean {
  return /^[0-9]+$/.test(s) || (/^[a-f0-9]+$/i.test(s) && s.length >= 8);
}

function isLikelySlug(s: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(s);
}

export function extractMarketRef(input: string): MarketRef {
  const raw = (input ?? '').trim();
  if (!raw) return null;

  // Try URL parsing first
  try {
    const u = new URL(raw);
    // Prefer explicit query params when present
    const qp = u.searchParams;
    const qId =
      qp.get('tokenId') ||
      qp.get('token_id') ||
      qp.get('marketId') ||
      qp.get('id');
    if (qId && qId.trim()) return { id: qId.trim() };

    const segments = u.pathname.split('/').filter(Boolean);
    const last = segments[segments.length - 1];
    if (!last) return null;
    if (isLikelyId(last)) return { id: last };
    if (isLikelySlug(last)) return { slug: last };
    return null;
  } catch {
    // Not a URL — treat as plain identifier
    if (isLikelyId(raw)) return { id: raw };
    if (isLikelySlug(raw)) return { slug: raw };
    return null;
  }
}

export function normalizeMarket(raw: RawSearchMarket): Market | null {
  const id = raw.id?.toString();
  const slug = raw.slug ?? '';
  const title = raw.title ?? raw.question ?? '';
  if (!id || !slug || !title) return null;
  const normalizeStatus = (s?: string) => {
    if (!s) return undefined;
    const x = s.toLowerCase();
    if (['open', 'active', 'trading'].includes(x)) return 'active' as const;
    if (['closed', 'resolved', 'finalized', 'settled', 'ended'].includes(x)) return 'closed' as const;
    return s as Market['status'];
  };
  const volumeNum = raw.volume != null ? Number(raw.volume) : undefined;
  const oiNum = raw.openInterest != null ? Number(raw.openInterest) : undefined;
  return {
    id,
    slug,
    title,
    endTime: raw.endDate,
    status: normalizeStatus(raw.status),
    volume: Number.isFinite(volumeNum!) ? volumeNum : undefined,
    openInterest: Number.isFinite(oiNum!) ? oiNum : undefined,
    tokenIds: raw.tokenIds,
  };
}

export function normalizeSearch(res: RawSearchResponse): Market[] {
  const out: Market[] = [];
  for (const m of res.markets ?? []) {
    const norm = normalizeMarket(m);
    if (norm) out.push(norm);
  }
  return out;
}

export function normalizeMarketDetail(raw: RawSearchMarket): Market | null {
  return normalizeMarket(raw);
}
