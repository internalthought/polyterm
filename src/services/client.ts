import {
  buildPolymarketSearchURL,
  buildGetMarketByIdURL,
  buildGetMarketBySlugURL,
  buildGetLastPriceURL,
  buildGetMidpointURL,
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
}
