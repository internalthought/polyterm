import {
  buildPolymarketSearchURL,
  buildGetMarketByIdURL,
  buildGetMarketBySlugURL,
  buildGetLastPriceURL,
  buildGetMidpointURL,
  buildGetBookURL,
  buildGetTradesURL,
  buildGetPriceHistoryURL,
  buildGetTagsURL,
} from './request.js';
import type { RawSearchResponse, PolymarketClient, RawSearchMarket } from './polymarket.js';

export type HttpClientOptions = {
  baseURL: string;
  headers?: Record<string, string>;
  fetch?: typeof fetch;
};

export class HttpPolymarketClient implements PolymarketClient {
  private baseURL: string;
  private headers: Record<string, string>;
  private fetchFn: typeof fetch;

  constructor(opts: HttpClientOptions) {
    this.baseURL = opts.baseURL.replace(/\/$/, '');
    this.headers = { 'accept': 'application/json', ...opts.headers };
    this.fetchFn = opts.fetch ?? (globalThis.fetch as typeof fetch);
    if (!this.fetchFn) {
      throw new Error('fetch is not available; provide opts.fetch');
    }
  }

  async searchMarkets(query: string, opts?: { limit?: number; types?: string[] }): Promise<RawSearchResponse> {
    const url = buildPolymarketSearchURL(this.baseURL, query, {
      limit: opts?.limit,
      types: opts?.types as any,
    });
    const res = await this.fetchFn(url, { headers: this.headers });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return (await res.json()) as RawSearchResponse;
  }

  async getMarketById(id: string): Promise<RawSearchMarket> {
    const url = buildGetMarketByIdURL(this.baseURL, id);
    const res = await this.fetchFn(url, { headers: this.headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as RawSearchMarket;
  }

  async getMarketBySlug(slug: string): Promise<RawSearchMarket> {
    const url = buildGetMarketBySlugURL(this.baseURL, slug);
    const res = await this.fetchFn(url, { headers: this.headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as RawSearchMarket;
  }

  async getLastPrice(tokenId: string): Promise<{ tokenId: string; price: number; ts?: string }> {
    const url = buildGetLastPriceURL(this.baseURL, tokenId);
    const res = await this.fetchFn(url, { headers: this.headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = (await res.json()) as any;
    return { tokenId: String(j.tokenId ?? tokenId), price: Number(j.price), ts: j.ts };
  }

  async getMidpoint(tokenId: string): Promise<{ tokenId: string; midpoint: number; ts?: string }> {
    const url = buildGetMidpointURL(this.baseURL, tokenId);
    const res = await this.fetchFn(url, { headers: this.headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = (await res.json()) as any;
    return { tokenId: String(j.tokenId ?? tokenId), midpoint: Number(j.midpoint), ts: j.ts };
  }

  async getBookSnapshot(tokenId: string, opts?: { depth?: number }) {
    const url = buildGetBookURL(this.baseURL, tokenId, { depth: opts?.depth });
    const res = await this.fetchFn(url, { headers: this.headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = (await res.json()) as any;
    const toLevel = (x: any) => ({ price: Number(Array.isArray(x) ? x[0] : x.price), size: Number(Array.isArray(x) ? x[1] : x.size) });
    return {
      tokenId: String(j.tokenId ?? tokenId),
      bids: (j.bids ?? []).map(toLevel),
      asks: (j.asks ?? []).map(toLevel),
      ts: j.ts,
      seq: Number(j.seq ?? 0),
    };
  }

  async getRecentTrades(tokenId: string, opts?: { limit?: number }) {
    const url = buildGetTradesURL(this.baseURL, tokenId, { limit: opts?.limit });
    const res = await this.fetchFn(url, { headers: this.headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const arr = (await res.json()) as any[];
    return (arr ?? []).map((t) => ({
      tokenId: String(t.tokenId ?? tokenId),
      side: t.side,
      price: Number(t.price),
      size: Number(t.size),
      ts: t.ts,
      tradeId: String(t.tradeId ?? ''),
    }));
  }

  async listTags(): Promise<string[]> {
    const url = buildGetTagsURL(this.baseURL);
    const res = await this.fetchFn(url, { headers: this.headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = (await res.json()) as any;
    if (Array.isArray(j)) {
      // array of strings or objects
      if (typeof j[0] === 'string' || j.length === 0) return j as string[];
      return (j as any[]).map((x) => String((x && (x.name ?? x.tag ?? x.id)) ?? '')).filter(Boolean);
    }
    if (Array.isArray(j?.tags)) {
      const arr = j.tags as any[];
      if (typeof arr[0] === 'string' || arr.length === 0) return arr as string[];
      return arr.map((x) => String((x && (x.name ?? x.tag ?? x.id)) ?? '')).filter(Boolean);
    }
    return [];
  }

  async getPriceHistory(
    tokenId: string,
    opts?: { interval?: string; limit?: number; fromTs?: string; toTs?: string },
  ): Promise<Array<{ ts: string; price: number }>> {
    const url = buildGetPriceHistoryURL(this.baseURL, tokenId, {
      interval: opts?.interval,
      limit: opts?.limit,
      fromTs: opts?.fromTs,
      toTs: opts?.toTs,
    });
    const res = await this.fetchFn(url, { headers: this.headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = (await res.json()) as any;
    const arr: Array<{ ts: string; price: number }> = Array.isArray(j)
      ? j
      : Array.isArray(j?.data)
        ? j.data
        : [];
    return arr.map((p: any) => ({ ts: String(p.ts ?? p.time ?? p.t ?? ''), price: Number(p.price ?? p.p) })).filter((p) => !!p.ts && Number.isFinite(p.price));
  }
}
