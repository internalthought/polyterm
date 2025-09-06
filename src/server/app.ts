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

export async function handleSearch(
  deps: AppDeps,
  params: { q?: string; limit?: number | string; types?: string | string[] },
) {
  const q = (params.q ?? '').toString().trim();
  if (!q) return { status: 400, payload: { error: 'missing q' } } as const;
  // Parse optional params
  const opts: any = {};
  if (params.limit != null) {
    const n = Number.parseInt(params.limit as any, 10);
    if (Number.isFinite(n) && n > 0) opts.limit = n;
  }
  if (params.types != null) {
    const raw = Array.isArray(params.types)
      ? params.types.join(',')
      : (params.types as string);
    const allowed = new Set(['markets', 'events', 'profiles']);
    const list = raw
      .split(',')
      .map((s) => s.trim())
      .filter((s) => !!s && allowed.has(s));
    if (list.length > 0) opts.types = list;
  }
  try {
    // @ts-ignore allow optional opts for clients that support it
    const raw = await deps.client.searchMarkets(q, Object.keys(opts).length ? opts : undefined);
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

export async function handlePrice(deps: AppDeps, params: { tokenId?: string }) {
  const tokenId = (params.tokenId ?? '').trim();
  if (!tokenId) return { status: 400, payload: { error: 'missing tokenId' } } as const;
  try {
    const raw = await deps.client.getLastPrice?.(tokenId as string);
    const price = Number((raw as any)?.price);
    return { status: 200, payload: { data: { tokenId, price, ts: (raw as any)?.ts } } } as const;
  } catch (err: any) {
    return { status: 502, payload: { error: 'upstream_error', detail: String(err?.message ?? err) } } as const;
  }
}

export async function handleMidpoint(deps: AppDeps, params: { tokenId?: string }) {
  const tokenId = (params.tokenId ?? '').trim();
  if (!tokenId) return { status: 400, payload: { error: 'missing tokenId' } } as const;
  try {
    const raw = await deps.client.getMidpoint?.(tokenId as string);
    const midpoint = Number((raw as any)?.midpoint);
    return { status: 200, payload: { data: { tokenId, midpoint, ts: (raw as any)?.ts } } } as const;
  } catch (err: any) {
    return { status: 502, payload: { error: 'upstream_error', detail: String(err?.message ?? err) } } as const;
  }
}

export async function handleBook(
  deps: AppDeps,
  params: { tokenId?: string; depth?: number | string },
) {
  const tokenId = (params.tokenId ?? '').trim();
  if (!tokenId) return { status: 400, payload: { error: 'missing tokenId' } } as const;
  const opts: any = {};
  if (params.depth != null) {
    const d = Number.parseInt(params.depth as any, 10);
    if (Number.isFinite(d) && d > 0) opts.depth = d;
  }
  try {
    const raw = await deps.client.getBookSnapshot?.(tokenId, Object.keys(opts).length ? opts : undefined);
    const toLevel = (x: any) => ({ price: Number(x.price ?? (Array.isArray(x) ? x[0] : undefined)), size: Number(x.size ?? (Array.isArray(x) ? x[1] : undefined)) });
    const data = {
      tokenId,
      bids: ((raw as any)?.bids ?? []).map(toLevel),
      asks: ((raw as any)?.asks ?? []).map(toLevel),
      ts: (raw as any)?.ts,
      seq: Number((raw as any)?.seq ?? 0),
    };
    return { status: 200, payload: { data } } as const;
  } catch (err: any) {
    return { status: 502, payload: { error: 'upstream_error', detail: String(err?.message ?? err) } } as const;
  }
}

export async function handleTrades(
  deps: AppDeps,
  params: { tokenId?: string; limit?: number | string },
) {
  const tokenId = (params.tokenId ?? '').trim();
  if (!tokenId) return { status: 400, payload: { error: 'missing tokenId' } } as const;
  const opts: any = {};
  if (params.limit != null) {
    const n = Number.parseInt(params.limit as any, 10);
    if (Number.isFinite(n) && n > 0) opts.limit = n;
  }
  try {
    const arr = await deps.client.getRecentTrades?.(tokenId, Object.keys(opts).length ? opts : undefined);
    const data = (arr as any[]).map((t) => ({
      tokenId: String(t.tokenId ?? tokenId),
      side: t.side,
      price: Number(t.price),
      size: Number(t.size),
      ts: t.ts,
      tradeId: String(t.tradeId ?? ''),
    }));
    return { status: 200, payload: { data } } as const;
  } catch (err: any) {
    return { status: 502, payload: { error: 'upstream_error', detail: String(err?.message ?? err) } } as const;
  }
}

export async function handleTags(deps: AppDeps) {
  try {
    const tags = await deps.client.listTags?.();
    return { status: 200, payload: { data: tags ?? [] } } as const;
  } catch (err: any) {
    return { status: 502, payload: { error: 'upstream_error', detail: String(err?.message ?? err) } } as const;
  }
}

export async function handleHistory(
  deps: AppDeps,
  params: { tokenId?: string; interval?: string; limit?: number | string; fromTs?: string; toTs?: string },
) {
  const tokenId = (params.tokenId ?? '').trim();
  if (!tokenId) return { status: 400, payload: { error: 'missing tokenId' } } as const;
  const opts: any = {};
  if (params.interval) opts.interval = String(params.interval);
  if (params.limit != null) {
    const n = Number.parseInt(params.limit as any, 10);
    if (Number.isFinite(n) && n > 0) opts.limit = n;
  }
  if (params.fromTs) opts.fromTs = String(params.fromTs);
  if (params.toTs) opts.toTs = String(params.toTs);
  try {
    const data = await deps.client.getPriceHistory?.(tokenId, Object.keys(opts).length ? opts : undefined);
    return { status: 200, payload: { data: data ?? [] } } as const;
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
      const limit = parsed.query['limit'] as any;
      const types = parsed.query['types'] as any;
      const result = await handleSearch(deps, { q, limit, types });
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

    // Prices
    if (req.method === 'GET' && parsed.pathname === '/api/price') {
      const tokenId = (parsed.query['tokenId'] ?? '').toString();
      const result = await handlePrice(deps, { tokenId });
      res.writeHead(result.status);
      res.end(JSON.stringify(result.payload));
      return;
    }
    if (req.method === 'GET' && parsed.pathname === '/api/midpoint') {
      const tokenId = (parsed.query['tokenId'] ?? '').toString();
      const result = await handleMidpoint(deps, { tokenId });
      res.writeHead(result.status);
      res.end(JSON.stringify(result.payload));
      return;
    }

    if (req.method === 'GET' && parsed.pathname === '/api/book') {
      const tokenId = (parsed.query['tokenId'] ?? '').toString();
      const depth = parsed.query['depth'] as any;
      const result = await handleBook(deps, { tokenId, depth });
      res.writeHead(result.status);
      res.end(JSON.stringify(result.payload));
      return;
    }

    if (req.method === 'GET' && parsed.pathname === '/api/trades') {
      const tokenId = (parsed.query['tokenId'] ?? '').toString();
      const limit = parsed.query['limit'] as any;
      const result = await handleTrades(deps, { tokenId, limit });
      res.writeHead(result.status);
      res.end(JSON.stringify(result.payload));
      return;
    }

    // Tags
    if (req.method === 'GET' && parsed.pathname === '/api/tags') {
      const result = await handleTags(deps);
      res.writeHead(result.status);
      res.end(JSON.stringify(result.payload));
      return;
    }

    // Price history
    if (req.method === 'GET' && parsed.pathname === '/api/history') {
      const tokenId = (parsed.query['tokenId'] ?? '').toString();
      const interval = (parsed.query['interval'] ?? '').toString() || undefined;
      const limit = parsed.query['limit'] as any;
      const fromTs = (parsed.query['from'] ?? '').toString() || undefined;
      const toTs = (parsed.query['to'] ?? '').toString() || undefined;
      const result = await handleHistory(deps, { tokenId, interval, limit, fromTs, toTs });
      res.writeHead(result.status);
      res.end(JSON.stringify(result.payload));
      return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: 'not_found' }));
  });

  return server;
}
