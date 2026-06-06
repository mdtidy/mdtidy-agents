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

const PROJECT_ID = '00000000-0000-4000-8000-00000000000a';
const FOLDER_ID = '00000000-0000-4000-8000-00000000000b';

describe('folder tools map to the workspace folder endpoints', () => {
  it('create_folder creates when absent → GET project (empty), then POST folders', async () => {
    const { ctx, reqs } = capturingCtx((path, method) => {
      if (method === 'GET' && path === `/api/v1/projects/${PROJECT_ID}`)
        return jsonResponse({ id: PROJECT_ID, folders: [], files: [] });
      if (method === 'POST' && path === `/api/v1/projects/${PROJECT_ID}/folders`)
        return jsonResponse(
          {
            id: FOLDER_ID,
            type: 'folder',
            project_id: PROJECT_ID,
            parent_id: PROJECT_ID,
            name: 'proposals',
            created_at: '',
            updated_at: '',
          },
          201,
        );
      return undefined;
    });

    await getTool('create_folder')!.handler({ project_id: PROJECT_ID, name: 'proposals' }, ctx);

    const post = reqs.find((r) => r.method === 'POST');
    expect(post!.path).toBe(`/api/v1/projects/${PROJECT_ID}/folders`);
    expect(post!.body.name).toBe('proposals');
    expect(post!.body.parent_folder_id).toBeUndefined();
  });

  it('create_folder is idempotent — returns the existing folder, never a duplicate POST', async () => {
    const { ctx, reqs } = capturingCtx((path, method) =>
      method === 'GET' && path === `/api/v1/projects/${PROJECT_ID}`
        ? jsonResponse({
            id: PROJECT_ID,
            folders: [
              {
                id: FOLDER_ID,
                type: 'folder',
                project_id: PROJECT_ID,
                parent_id: PROJECT_ID,
                name: 'proposals',
                created_at: '',
                updated_at: '',
              },
            ],
            files: [],
          })
        : undefined,
    );

    const res = await getTool('create_folder')!.handler(
      { project_id: PROJECT_ID, name: 'proposals' },
      ctx,
    );

    expect(reqs.some((r) => r.method === 'POST')).toBe(false);
    expect(res.content.some((c) => c.type === 'text' && c.text.includes(FOLDER_ID))).toBe(true);
  });

  it('create_folder matches on parent_folder_id when nesting (root folder of same name is not a match)', async () => {
    const ROOT_DUP = '00000000-0000-4000-8000-00000000000c';
    const { ctx, reqs } = capturingCtx((path, method) => {
      if (method === 'GET' && path === `/api/v1/projects/${PROJECT_ID}`)
        return jsonResponse({
          id: PROJECT_ID,
          // A same-named folder exists at the ROOT — it must NOT match a nested create.
          folders: [
            {
              id: ROOT_DUP,
              type: 'folder',
              project_id: PROJECT_ID,
              parent_id: PROJECT_ID,
              name: 'sub',
              created_at: '',
              updated_at: '',
            },
          ],
          files: [],
        });
      if (method === 'POST' && path === `/api/v1/projects/${PROJECT_ID}/folders`)
        return jsonResponse(
          {
            id: FOLDER_ID,
            type: 'folder',
            project_id: PROJECT_ID,
            parent_id: FOLDER_ID,
            name: 'sub',
            created_at: '',
            updated_at: '',
          },
          201,
        );
      return undefined;
    });

    await getTool('create_folder')!.handler(
      { project_id: PROJECT_ID, name: 'sub', parent_folder_id: FOLDER_ID },
      ctx,
    );

    const post = reqs.find((r) => r.method === 'POST');
    expect(post).toBeDefined();
    expect(post!.body.parent_folder_id).toBe(FOLDER_ID);
  });

  it('update_folder → PATCH /folders/{id} with the new name', async () => {
    const { ctx, reqs } = capturingCtx((path, method) =>
      method === 'PATCH' && path === `/api/v1/folders/${FOLDER_ID}`
        ? jsonResponse({
            id: FOLDER_ID,
            type: 'folder',
            project_id: PROJECT_ID,
            parent_id: PROJECT_ID,
            name: 'renamed',
            created_at: '',
            updated_at: '',
          })
        : undefined,
    );

    await getTool('update_folder')!.handler({ id: FOLDER_ID, name: 'renamed' }, ctx);

    const patch = reqs.find((r) => r.method === 'PATCH');
    expect(patch!.path).toBe(`/api/v1/folders/${FOLDER_ID}`);
    expect(patch!.body.name).toBe('renamed');
  });

  it('delete_folder → DELETE /folders/{id}', async () => {
    const { ctx, reqs } = capturingCtx((path, method) =>
      method === 'DELETE' && path === `/api/v1/folders/${FOLDER_ID}`
        ? jsonResponse({ ok: true })
        : undefined,
    );

    await getTool('delete_folder')!.handler({ id: FOLDER_ID }, ctx);

    expect(reqs.find((r) => r.method === 'DELETE')!.path).toBe(`/api/v1/folders/${FOLDER_ID}`);
  });

  it('folder tools carry MCP risk annotations', () => {
    expect(getTool('create_folder')!.annotations).toMatchObject({
      destructiveHint: false,
      idempotentHint: true,
    });
    expect(getTool('update_folder')!.annotations).toMatchObject({
      destructiveHint: false,
      idempotentHint: true,
    });
    expect(getTool('delete_folder')!.annotations).toMatchObject({ destructiveHint: true });
  });
});
