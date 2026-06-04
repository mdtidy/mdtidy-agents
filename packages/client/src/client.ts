// Typed mdtidy REST client — a thin wrapper over `openapi-fetch` using the
// generated `paths` type. Adds the dual auth header (X-API-KEY + Bearer, since
// /convert + /usage read the former and the workspace routes read the latter),
// a default timeout, and throw-on-error mapping. Spec §3.2, §3.5.

import createClient, { type Client, type Middleware } from 'openapi-fetch';

import { isApiErrorBody, MdtidyApiError } from './errors';
import type { paths } from './generated/types';

// Canonical host. The apex (mdtidy.com) 307-redirects to www, which breaks
// server-side self-fetch (the /mcp loopback) — target www directly.
export const DEFAULT_BASE_URL = 'https://www.mdtidy.com';
export const DEFAULT_TIMEOUT_MS = 60_000;

export interface MdtidyClientOptions {
  /** mdtidy API key (`mt_live_…` / `mt_test_…`). */
  apiKey: string;
  /** API origin. Defaults to https://www.mdtidy.com. */
  baseUrl?: string;
  /** Injectable fetch (tests, in-process loopback). Defaults to global fetch. */
  fetch?: typeof fetch;
  /** Per-request timeout. Defaults to 60s (PDF/PNG renders can be slow). */
  timeoutMs?: number;
}

export type MdtidyClient = Client<paths>;

function withTimeout(baseFetch: typeof fetch, timeoutMs: number): typeof fetch {
  // Pass the request through to fetch UNMODIFIED. Reconstructing it to attach a
  // timeout signal (`new Request(...)` / `fetch(req, init)`) re-reads the body
  // and undici rejects it ("expected non-null body source" / detached
  // ArrayBuffer) — fragile across undici versions and the bundled runtime.
  // Enforce the timeout with a race instead, so the body is never touched.
  return (input, init) => {
    let timer: ReturnType<typeof setTimeout>;
    const timeout = new Promise<Response>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`mdtidy request timed out after ${timeoutMs}ms`)),
        timeoutMs,
      );
    });
    return Promise.race([baseFetch(input, init), timeout]).finally(() => clearTimeout(timer));
  };
}

function authMiddleware(apiKey: string): Middleware {
  return {
    onRequest({ request }) {
      // mdtidy v1 authenticates with X-API-KEY only. `Authorization: Bearer`
      // is blocked globally by the app middleware (reserved for future OAuth
      // Apps), so we must NOT send it. Workspace routes read X-API-KEY via
      // resolveActor; convert/usage read it directly.
      request.headers.set('X-API-KEY', apiKey);
      return request;
    },
  };
}

const throwOnError: Middleware = {
  async onResponse({ response }) {
    if (response.ok) return response;
    let body: unknown;
    try {
      body = await response.clone().json();
    } catch {
      body = undefined;
    }
    const err = isApiErrorBody(body) ? body.error : undefined;
    throw new MdtidyApiError({
      status: response.status,
      code: err?.code ?? 'http_error',
      message: err?.message ?? (response.statusText || 'request failed'),
      requestId: err?.requestId,
      details: err ? { required: err.required, balance: err.balance } : undefined,
    });
  },
};

export function createMdtidyClient(opts: MdtidyClientOptions): MdtidyClient {
  const baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const baseFetch = opts.fetch ?? globalThis.fetch;
  const client = createClient<paths>({ baseUrl, fetch: withTimeout(baseFetch, timeoutMs) });
  client.use(authMiddleware(opts.apiKey), throwOnError);
  return client;
}
