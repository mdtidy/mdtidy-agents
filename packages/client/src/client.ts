// Typed mdtidy REST client — a thin wrapper over `openapi-fetch` using the
// generated `paths` type. Adds the dual auth header (X-API-KEY + Bearer, since
// /convert + /usage read the former and the workspace routes read the latter),
// a default timeout, and throw-on-error mapping. Spec §3.2, §3.5.

import createClient, { type Client, type Middleware } from 'openapi-fetch';

import { isApiErrorBody, MdtidyApiError } from './errors';
import type { paths } from './generated/types';

export const DEFAULT_BASE_URL = 'https://mdtidy.com';
export const DEFAULT_TIMEOUT_MS = 60_000;

export interface MdtidyClientOptions {
  /** mdtidy API key (`mt_live_…` / `mt_test_…`). */
  apiKey: string;
  /** API origin. Defaults to https://mdtidy.com. */
  baseUrl?: string;
  /** Injectable fetch (tests, in-process loopback). Defaults to global fetch. */
  fetch?: typeof fetch;
  /** Per-request timeout. Defaults to 60s (PDF/PNG renders can be slow). */
  timeoutMs?: number;
}

export type MdtidyClient = Client<paths>;

function withTimeout(baseFetch: typeof fetch, timeoutMs: number): typeof fetch {
  return (input, init) => {
    if (init?.signal) return baseFetch(input, init);
    return baseFetch(input, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  };
}

function authMiddleware(apiKey: string): Middleware {
  return {
    onRequest({ request }) {
      request.headers.set('X-API-KEY', apiKey);
      request.headers.set('Authorization', `Bearer ${apiKey}`);
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
