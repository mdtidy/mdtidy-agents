// Web-standard, stateless Streamable-HTTP handler for the mdtidy /mcp route.
// Reads the API key from the request, forwards it to /api/v1/*, and dispatches
// JSON-RPC against the shared registry. No session state — ideal for Vercel's
// ephemeral functions. Spec §4.1.

import { buildContext } from './context';
import { handleJsonRpc, type JsonRpcRequest } from './jsonrpc';

export interface McpRouteHandlerOptions {
  /** Resolve the API origin per request (e.g. the request's own origin for loopback). */
  resolveBaseUrl?: (req: Request) => string;
  /** Fallback API origin. Defaults to https://mdtidy.com. */
  defaultBaseUrl?: string;
  /** Injectable fetch (tests / custom transport). */
  fetch?: typeof fetch;
}

export type McpRouteHandler = (req: Request) => Promise<Response>;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function extractApiKey(req: Request): string | undefined {
  const auth = req.headers.get('authorization');
  if (auth && auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  const xKey = req.headers.get('x-api-key');
  return xKey?.trim() || undefined;
}

export function createMcpRouteHandler(options: McpRouteHandlerOptions = {}): McpRouteHandler {
  return async function handler(req: Request): Promise<Response> {
    // Stateless v1: GET (SSE stream) / DELETE (session teardown) are not used.
    if (req.method === 'GET' || req.method === 'DELETE') {
      return json(
        {
          jsonrpc: '2.0',
          id: null,
          error: { code: -32000, message: 'This MCP server is stateless; use POST.' },
        },
        405,
      );
    }
    if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

    const apiKey = extractApiKey(req);
    if (!apiKey) {
      return json(
        {
          jsonrpc: '2.0',
          id: null,
          error: {
            code: -32001,
            message:
              'Missing API key. Send "Authorization: Bearer <mdtidy key>" or "X-API-KEY". Create one at https://mdtidy.com/account/api-keys.',
          },
        },
        401,
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return json(
        { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } },
        400,
      );
    }

    const baseUrl = options.resolveBaseUrl?.(req) ?? options.defaultBaseUrl ?? 'https://mdtidy.com';
    const ctx = buildContext({ apiKey, baseUrl, transport: 'http', fetch: options.fetch });

    if (Array.isArray(body)) {
      const responses = (
        await Promise.all(body.map((m) => handleJsonRpc(m as JsonRpcRequest, ctx)))
      ).filter((r) => r !== null);
      return json(responses, 200);
    }

    const res = await handleJsonRpc(body as JsonRpcRequest, ctx);
    if (res === null) return new Response(null, { status: 202 });
    return json(res, 200);
  };
}
