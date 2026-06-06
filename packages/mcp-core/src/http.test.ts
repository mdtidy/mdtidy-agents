import { describe, expect, it } from 'vitest';

import { createMcpRouteHandler } from './http';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

// Mock mdtidy API backend for tools/call.
const apiFetch: typeof fetch = async (input, init) => {
  const req = input instanceof Request ? input : new Request(input, init);
  const url = new URL(req.url);
  if (url.pathname === '/api/v1/convert') {
    return jsonResponse({
      format: 'text',
      contentType: 'text/plain',
      byteSize: 4,
      designSystem: 'minimal-clean',
      output: '# Hi',
      warnings: [{ rule: 'table_pipe_balance', fixes: 1 }],
      creditsCharged: 1,
      creditsRemaining: 9,
      requestId: 'req_1',
    });
  }
  return jsonResponse({}, 404);
};

const handler = createMcpRouteHandler({ defaultBaseUrl: 'https://app.test', fetch: apiFetch });

function post(
  method: string,
  params: unknown,
  key: string | null = 'mt_test_k',
): Promise<Response> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (key) headers.authorization = `Bearer ${key}`;
  return handler(
    new Request('https://app.test/mcp', {
      method: 'POST',
      headers,
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    }),
  );
}

describe('createMcpRouteHandler (stateless HTTP)', () => {
  it('responds to initialize with serverInfo', async () => {
    const body: any = await (await post('initialize', { protocolVersion: '2025-06-18' })).json();
    expect(body.result.serverInfo.name).toBe('mdtidy');
    expect(body.result.protocolVersion).toBe('2025-06-18');
  });

  it('lists the 12 tools', async () => {
    const body: any = await (await post('tools/list', {})).json();
    expect(body.result.tools).toHaveLength(15);
    expect(body.result.tools[0].name).toBe('tidy_markdown');
    expect(body.result.tools[0].inputSchema.type).toBe('object');
  });

  it('surfaces MCP risk annotations in tools/list', async () => {
    const body: any = await (await post('tools/list', {})).json();
    const createFolder = body.result.tools.find((t: any) => t.name === 'create_folder');
    expect(createFolder.annotations).toMatchObject({
      destructiveHint: false,
      idempotentHint: true,
    });
    const deleteFolder = body.result.tools.find((t: any) => t.name === 'delete_folder');
    expect(deleteFolder.annotations).toMatchObject({ destructiveHint: true });
  });

  it('calls tidy_markdown and shapes the result', async () => {
    const body: any = await (
      await post('tools/call', {
        name: 'tidy_markdown',
        arguments: { markdown: '# Hi', format: 'text' },
      })
    ).json();
    expect(body.result.isError).toBe(false);
    const textBlobs = JSON.stringify(body.result.content);
    expect(textBlobs).toContain('# Hi');
    expect(textBlobs).toContain('remaining 9');
  });

  it('returns a tool error result (not a protocol error) for invalid args', async () => {
    const body: any = await (
      await post('tools/call', { name: 'tidy_markdown', arguments: { format: 'text' } })
    ).json();
    expect(body.error.code).toBe(-32602); // missing required "markdown"
  });

  it('401 without an API key', async () => {
    const res = await post('tools/list', {}, null);
    expect(res.status).toBe(401);
  });

  it('405 on GET (stateless — POST only)', async () => {
    const res = await handler(new Request('https://app.test/mcp', { method: 'GET' }));
    expect(res.status).toBe(405);
  });
});
