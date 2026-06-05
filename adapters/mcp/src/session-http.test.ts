// Real-world session #2 — hosted Streamable-HTTP (`https://www.mdtidy.com/mcp`).
//
// Drives the stateless route handler the way the deployed mdtidy app mounts it:
// sequential JSON-RPC POSTs over a single backend, authenticated with the
// X-API-KEY header (the app blocks `Authorization: Bearer`, so X-API-KEY is the
// real-world path). Covers the initialize/list handshake, the save_document
// upsert workflow with credit accounting, the missing-key 401, and a mid-session
// out-of-credits 402 surfaced as a tool error.

import { describe, expect, it } from 'vitest';

import { createMcpRouteHandler, type McpRouteHandler } from './index';
import { createMockBackend } from './__fixtures__/mock-backend';

function rpc(
  handler: McpRouteHandler,
  method: string,
  params: unknown,
  key: string | null = 'mt_test_session',
): Promise<Response> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  // Production reality: the hosted endpoint authenticates with X-API-KEY.
  if (key) headers['x-api-key'] = key;
  return handler(
    new Request('https://app.test/mcp', {
      method: 'POST',
      headers,
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    }),
  );
}

async function call(handler: McpRouteHandler, name: string, args: unknown): Promise<any> {
  const res = await rpc(handler, 'tools/call', { name, arguments: args });
  return ((await res.json()) as any).result;
}

function textOf(result: any): string {
  return (result?.content ?? []).map((c: any) => (c.type === 'text' ? c.text : '')).join('\n');
}

describe('session — Streamable HTTP (hosted /mcp, X-API-KEY)', () => {
  it('runs initialize → list → tidy → save (create→update) with credit accounting', async () => {
    const backend = createMockBackend({ startingCredits: 10 });
    const handler = createMcpRouteHandler({
      defaultBaseUrl: 'https://app.test',
      fetch: backend.fetch,
    });

    const init: any = await (
      await rpc(handler, 'initialize', { protocolVersion: '2025-06-18' })
    ).json();
    expect(init.result.serverInfo.name).toBe('mdtidy');
    expect(init.result.protocolVersion).toBe('2025-06-18');

    const list: any = await (await rpc(handler, 'tools/list', {})).json();
    expect(list.result.tools).toHaveLength(12);

    const tidy = await call(handler, 'tidy_markdown', { markdown: '# Hi', format: 'text' });
    expect(tidy.isError).toBe(false);

    const created = await call(handler, 'save_document', { content: '# Doc\nbody', name: 'Doc' });
    expect(textOf(created)).toContain('Created');

    const updated = await call(handler, 'save_document', {
      content: '# Doc\nbody v2',
      name: 'Doc',
    });
    expect(textOf(updated)).toContain('Updated');

    // 10 − 1 (tidy) − 1 (create) − 0 (update) = 8.
    const usage = await call(handler, 'check_usage', {});
    expect(textOf(usage)).toContain('Credits remaining: 8');
    expect(backend.credits()).toBe(8);
  });

  it('rejects a session with no API key (401) but accepts X-API-KEY (200)', async () => {
    const backend = createMockBackend();
    const handler = createMcpRouteHandler({
      defaultBaseUrl: 'https://app.test',
      fetch: backend.fetch,
    });

    const noKey = await rpc(handler, 'tools/list', {}, null);
    expect(noKey.status).toBe(401);

    const withKey = await rpc(handler, 'tools/list', {}, 'mt_test_x');
    expect(withKey.status).toBe(200);
  });

  it('surfaces a mid-session out-of-credits (402) as a tool error result', async () => {
    const backend = createMockBackend({ startingCredits: 1 });
    const handler = createMcpRouteHandler({
      defaultBaseUrl: 'https://app.test',
      fetch: backend.fetch,
    });

    const ok = await call(handler, 'tidy_markdown', { markdown: '# A', format: 'text' });
    expect(ok.isError).toBe(false);

    const dead = await call(handler, 'tidy_markdown', { markdown: '# B', format: 'text' });
    expect(dead.isError).toBe(true);
    expect(textOf(dead).toLowerCase()).toContain('credit');
  });

  it('returns a -32602 protocol error for malformed tool arguments', async () => {
    const backend = createMockBackend();
    const handler = createMcpRouteHandler({
      defaultBaseUrl: 'https://app.test',
      fetch: backend.fetch,
    });

    const res: any = await (
      await rpc(handler, 'tools/call', { name: 'tidy_markdown', arguments: { format: 'text' } })
    ).json();
    expect(res.error.code).toBe(-32602); // missing required "markdown"
  });
});
