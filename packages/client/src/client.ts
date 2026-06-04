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
  return async (input, init) => {
    // A caller-supplied signal wins — don't override it.
    if (init?.signal) return baseFetch(input, init);
    const signal = AbortSignal.timeout(timeoutMs);
    // openapi-fetch hands us a fully-built `Request` as `input` (no init).
    // Passing a second init to fetch() makes undici re-read the request body
    // and throw "expected non-null body source" for POST/PATCH. Buffer the body
    // first, then reconstruct the request with the timeout signal attached.
    if (input instanceof Request) {
      const method = input.method.toUpperCase();
      // Read the body as a STRING (not ArrayBuffer): a string is re-sendable, so
      // it survives a redirect, whereas an ArrayBuffer gets detached after the
      // first send (undici: "detached ArrayBuffer"). Our API bodies are JSON.
      const hasBody = method !== 'GET' && method !== 'HEAD';
      const body = hasBody ? (await input.text()) || undefined : undefined;
      return baseFetch(
        new Request(input.url, {
          method: input.method,
          headers: input.headers,
          body,
          redirect: input.redirect,
          signal,
        }),
      );
    }
    return baseFetch(input, { ...init, signal });
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
