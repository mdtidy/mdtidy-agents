import { createMdtidyClient } from '@mdtidy/client';
import { describe, expect, it } from 'vitest';

import type { ToolContext } from '../context';
import { getTool } from '../registry';

// Regression guard for the Cloudflare-412 bug: the optimistic-lock version must
// ride in the request BODY, and NO `If-Match` header may leave the client (a CDN
// answers that reserved conditional header with 412 at the edge). Mirrors the
// mdtidy web client's fix — see bug note 2026-06-03-autosave-ifmatch-412.

interface Captured {
  method: string;
  path: string;
  ifMatch: string | null;
  body: Record<string, unknown>;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function capturingCtx(route: (path: string, method: string) => Response | undefined): {
  ctx: ToolContext;
  reqs: Captured[];
} {
  const reqs: Captured[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const req = input instanceof Request ? input : new Request(input, init);
    const url = new URL(req.url);
    let body: Record<string, unknown> = {};
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const t = await req.clone().text();
      body = t ? JSON.parse(t) : {};
    }
    reqs.push({
      method: req.method,
      path: url.pathname,
      ifMatch: req.headers.get('if-match'),
      body,
    });
    return route(url.pathname, req.method) ?? jsonResponse({}, 404);
  };
  const ctx: ToolContext = {
    client: createMdtidyClient({ apiKey: 'k', baseUrl: 'https://app.test', fetch: fetchImpl }),
    baseUrl: 'https://app.test',
    transport: 'stdio',
  };
  return { ctx, reqs };
}

const FILE_ID = '00000000-0000-4000-8000-000000000009';

describe('write tools carry the optimistic-lock version in the body, not the If-Match header', () => {
  it('update_file content write → body.version, no If-Match header', async () => {
    const { ctx, reqs } = capturingCtx((path, method) =>
      method === 'PATCH' && path === `/api/v1/files/${FILE_ID}`
        ? jsonResponse({ id: FILE_ID, name: 'Doc', version: 4, etag: '"4"' })
        : undefined,
    );

    await getTool('update_file')!.handler(
      { id: FILE_ID, content: 'new body', ifMatch: '"3"' },
      ctx,
    );

    const patch = reqs.find((r) => r.method === 'PATCH');
    expect(patch).toBeDefined();
    expect(patch!.ifMatch).toBeNull();
    expect(patch!.body.content).toBe('new body');
    expect(patch!.body.version).toBe(3);
  });

  it('save_document update path → body.version, no If-Match header anywhere', async () => {
    const { ctx, reqs } = capturingCtx((path, method) => {
      if (method === 'GET' && path === '/api/v1/projects')
        return jsonResponse({ scope: 'mine', items: [{ id: 'p1', name: 'Notes' }] });
      if (method === 'GET' && path === '/api/v1/projects/p1')
        return jsonResponse({
          id: 'p1',
          name: 'Notes',
          files: [{ id: 'f9', name: 'My Doc', version: 3, etag: '"3"', archived: false }],
        });
      if (method === 'PATCH' && path === '/api/v1/files/f9')
        return jsonResponse({ id: 'f9', name: 'My Doc', version: 4, etag: '"4"' });
      return undefined;
    });

    await getTool('save_document')!.handler(
      { content: '# My Doc\nupdated', name: 'My Doc', project: 'Notes' },
      ctx,
    );

    const patch = reqs.find((r) => r.method === 'PATCH');
    expect(patch).toBeDefined();
    expect(patch!.ifMatch).toBeNull();
    expect(patch!.body.version).toBe(3);
    // No request in the whole flow may carry the reserved conditional header.
    expect(reqs.every((r) => r.ifMatch === null)).toBe(true);
  });

  it('update_file metadata-only write (rename) sends neither version nor If-Match', async () => {
    const { ctx, reqs } = capturingCtx((path, method) =>
      method === 'PATCH' && path === `/api/v1/files/${FILE_ID}`
        ? jsonResponse({ id: FILE_ID, name: 'Renamed', version: 3, etag: '"3"' })
        : undefined,
    );

    await getTool('update_file')!.handler({ id: FILE_ID, name: 'Renamed' }, ctx);

    const patch = reqs.find((r) => r.method === 'PATCH');
    expect(patch!.ifMatch).toBeNull();
    expect(patch!.body.version).toBeUndefined();
    expect(patch!.body.name).toBe('Renamed');
  });
});
