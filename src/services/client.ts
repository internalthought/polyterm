import { buildPolymarketSearchURL } from './request.js';
import type { RawSearchResponse, PolymarketClient } from './polymarket.js';

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

  async searchMarkets(query: string): Promise<RawSearchResponse> {
    const url = buildPolymarketSearchURL(this.baseURL, query);
    const res = await this.fetchFn(url, { headers: this.headers });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return (await res.json()) as RawSearchResponse;
  }
}

