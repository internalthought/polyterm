import http, { IncomingMessage, ServerResponse } from 'http';
import url from 'url';
import { normalizeSearch, normalizeMarketDetail, extractMarketRef, type PolymarketClient } from '../services/polymarket.js';

export type AppDeps = {
  client: PolymarketClient;
};

export async function handleResolve(params: { input?: string }) {
  const input = (params.input ?? '').trim();
  if (!input) return { status: 400, payload: { error: 'missing input' } } as const;
  const ref = extractMarketRef(input);
  if (!ref) return { status: 422, payload: { error: 'unrecognized input' } } as const;
  return { status: 200, payload: ref } as const;
}

export async function handleSearch(deps: AppDeps, params: { q?: string }) {
  const q = (params.q ?? '').toString().trim();
  if (!q) return { status: 400, payload: { error: 'missing q' } } as const;
  try {
    const raw = await deps.client.searchMarkets(q);
    const data = normalizeSearch(raw);
    return { status: 200, payload: { data } } as const;
  } catch (err: any) {
    return { status: 502, payload: { error: 'upstream_error', detail: String(err?.message ?? err) } } as const;
  }
}

export async function handleMarket(deps: AppDeps, params: { input?: string }) {
  const input = (params.input ?? '').trim();
  if (!input) return { status: 400, payload: { error: 'missing input' } } as const;
  const ref = extractMarketRef(input);
  if (!ref) return { status: 422, payload: { error: 'unrecognized input' } } as const;
  try {
    const raw = ref.id
      ? await (deps.client.getMarketById?.(ref.id) as Promise<any>)
      : await (deps.client.getMarketBySlug?.(ref.slug!) as Promise<any>);
    const data = normalizeMarketDetail(raw);
    if (!data) return { status: 502, payload: { error: 'normalize_failed' } } as const;
    return { status: 200, payload: { data } } as const;
  } catch (err: any) {
    return { status: 502, payload: { error: 'upstream_error', detail: String(err?.message ?? err) } } as const;
  }
}

export function createServer(deps: AppDeps) {
  const server = http.createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const parsed = url.parse(req.url ?? '', true);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    // Health
    if (req.method === 'GET' && parsed.pathname === '/health') {
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    // Search proxy (normalized)
    if (req.method === 'GET' && parsed.pathname === '/api/search') {
      const q = (parsed.query['q'] ?? '').toString();
      const result = await handleSearch(deps, { q });
      res.writeHead(result.status);
      res.end(JSON.stringify(result.payload));
      return;
    }

    // Resolve input (URL | slug | id) → { slug? id? }
    if (req.method === 'GET' && (parsed.pathname === '/api/resolve' || parsed.pathname === '/api/market/resolve')) {
      const input = (parsed.query['input'] ?? '').toString();
      const result = await handleResolve({ input });
      res.writeHead(result.status);
      res.end(JSON.stringify(result.payload));
      return;
    }

    // Market detail: resolve input then fetch detail
    if (req.method === 'GET' && parsed.pathname === '/api/market') {
      const input = (parsed.query['input'] ?? '').toString();
      const result = await handleMarket(deps, { input });
      res.writeHead(result.status);
      res.end(JSON.stringify(result.payload));
      return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: 'not_found' }));
  });

  return server;
}
