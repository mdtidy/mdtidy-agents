import { createMdtidyClient } from '@mdtidy/client';
import { describe, expect, it } from 'vitest';

import type { ToolContext } from '../context';
import { getTool } from '../registry';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function ctxWith(fetchImpl: typeof fetch): ToolContext {
  return {
    client: createMdtidyClient({ apiKey: 'k', baseUrl: 'https://app.test', fetch: fetchImpl }),
    baseUrl: 'https://app.test',
    transport: 'stdio',
  };
}

describe('save_document upsert', () => {
  it('creates a new file when no same-named doc exists (charges 1 credit)', async () => {
    const calls: string[] = [];
    const ctx = ctxWith(async (input, init) => {
      const req = input instanceof Request ? input : new Request(input, init);
      const url = new URL(req.url);
      calls.push(`${req.method} ${url.pathname}`);
      if (req.method === 'GET' && url.pathname === '/api/v1/projects')
        return jsonResponse({ scope: 'mine', items: [{ id: 'p1', name: 'Drafts' }] });
      if (req.method === 'GET' && url.pathname === '/api/v1/projects/p1')
        return jsonResponse({ id: 'p1', name: 'Drafts', files: [] });
      if (req.method === 'POST' && url.pathname === '/api/v1/files')
        return jsonResponse(
          { id: 'f1', name: 'Untitled', version: 1, etag: '"1"', credits_remaining: 9 },
          201,
        );
      return jsonResponse({}, 404);
    });

    const res = await getTool('save_document')!.handler({ content: 'hello world' }, ctx);
    expect(JSON.stringify(res.content)).toContain('Created');
    expect(calls).toContain('POST /api/v1/files');
    expect(calls).not.toContain('PATCH /api/v1/files');
  });

  it('updates in place when a same-named doc exists (0 credits, PATCH)', async () => {
    const calls: string[] = [];
    const ctx = ctxWith(async (input, init) => {
      const req = input instanceof Request ? input : new Request(input, init);
      const url = new URL(req.url);
      calls.push(`${req.method} ${url.pathname}`);
      if (req.method === 'GET' && url.pathname === '/api/v1/projects')
        return jsonResponse({ scope: 'mine', items: [{ id: 'p1', name: 'Notes' }] });
      if (req.method === 'GET' && url.pathname === '/api/v1/projects/p1')
        return jsonResponse({
          id: 'p1',
          name: 'Notes',
          files: [{ id: 'f9', name: 'My Doc', version: 3, etag: '"3"', archived: false }],
        });
      if (req.method === 'PATCH' && url.pathname === '/api/v1/files/f9')
        return jsonResponse({ id: 'f9', name: 'My Doc', version: 4, etag: '"4"' });
      return jsonResponse({}, 404);
    });

    const res = await getTool('save_document')!.handler(
      { content: '# My Doc\nupdated body', name: 'My Doc', project: 'Notes' },
      ctx,
    );
    expect(JSON.stringify(res.content)).toContain('Updated');
    expect(calls).toContain('PATCH /api/v1/files/f9');
    expect(calls).not.toContain('POST /api/v1/files');
  });
});
