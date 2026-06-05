import { MdtidyApiError } from '@mdtidy/client';
import { z } from 'zod';

import { catalogMeta } from '../catalog';
import type { ToolContext } from '../context';
import { jsonText, result, text } from '../shape';
import { defineTool } from '../types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface FileLike {
  id: string;
  name: string;
  version: number;
  etag: string;
  archived?: boolean;
  credits_remaining?: number;
}

function deriveName(markdown: string): string {
  const heading = markdown.match(/^#\s+(.+?)\s*$/m);
  return (heading?.[1] ?? 'Untitled').slice(0, 200);
}

/** Find-or-create the target project for save_document. Tolerates a 409 on
 *  create (concurrent saves converge). Spec §3.4. */
async function resolveProject(
  ctx: ToolContext,
  project?: string,
): Promise<{ id: string; name: string }> {
  const wanted = project?.trim() || 'Drafts';
  if (UUID_RE.test(wanted)) {
    const { data } = await ctx.client.GET('/api/v1/projects/{id}', {
      params: { path: { id: wanted }, query: {} },
    });
    return { id: data!.id, name: data!.name };
  }
  const findByName = async (): Promise<{ id: string; name: string } | undefined> => {
    const { data } = await ctx.client.GET('/api/v1/projects', {
      params: { query: { scope: 'mine' } },
    });
    const found = data!.items.find((p) => p.name === wanted);
    return found ? { id: found.id, name: found.name } : undefined;
  };
  const existing = await findByName();
  if (existing) return existing;
  try {
    const { data } = await ctx.client.POST('/api/v1/projects', { body: { name: wanted } });
    return { id: data!.id, name: data!.name };
  } catch (err) {
    if (err instanceof MdtidyApiError && err.status === 409) {
      const afterRace = await findByName();
      if (afterRace) return afterRace;
    }
    throw err;
  }
}

/** Parse a quoted ETag / version string (`"3"` or `3`) into a numeric version. */
function versionFromEtag(etag: string | number | undefined | null): number | undefined {
  if (etag == null) return undefined;
  const n = Number(String(etag).replace(/"/g, '').trim());
  return Number.isFinite(n) ? n : undefined;
}

// Carry the optimistic-lock version in the BODY, never the `If-Match` header.
// `If-Match` is a reserved HTTP conditional-request header (RFC 9110 §13.1.1):
// a CDN (Cloudflare, in front of mdtidy.com) is entitled to evaluate it at the
// edge and answer `412 Precondition Failed` — even rewriting an origin `200` to
// a `412`, so the write commits server-side but the caller sees an error. The
// route reads the version identically from the body
// (`parseIfMatch(header) ?? body.version`), so the body form is edge-proof.
// See the mdtidy bug note 2026-06-03-autosave-ifmatch-412.
async function patchContent(ctx: ToolContext, fileId: string, etag: string, content: string) {
  const version = versionFromEtag(etag);
  const { data } = await ctx.client.PATCH('/api/v1/files/{id}', {
    params: { path: { id: fileId } },
    body: { content, ...(version != null ? { version } : {}) },
  });
  return data!;
}

export const createProject = defineTool({
  ...catalogMeta('create_project'),
  inputSchema: z.object({
    name: z.string().min(1).max(200).describe('Project name.'),
    description: z.string().max(2000).optional(),
  }),
  handler: async (i, ctx) => {
    const { data } = await ctx.client.POST('/api/v1/projects', {
      body: { name: i.name, ...(i.description ? { description: i.description } : {}) },
    });
    return result(text(`Created project "${data!.name}" (${data!.id}).`), jsonText(data!));
  },
});

export const saveFile = defineTool({
  ...catalogMeta('save_file'),
  inputSchema: z.object({
    project_id: z.string().uuid().describe('Target project id.'),
    name: z.string().min(1).max(200),
    content: z.string().describe('Markdown body.'),
    folder_id: z.string().uuid().optional(),
    idempotencyKey: z.string().optional(),
  }),
  handler: async (i, ctx) => {
    const { data } = await ctx.client.POST('/api/v1/files', {
      ...(i.idempotencyKey ? { params: { header: { 'Idempotency-Key': i.idempotencyKey } } } : {}),
      body: {
        project_id: i.project_id,
        name: i.name,
        content: i.content,
        ...(i.folder_id ? { folder_id: i.folder_id } : {}),
      },
    });
    return result(
      text(`Saved file "${data!.name}" (${data!.id}). 1 credit charged.`),
      jsonText(data!),
    );
  },
});

export const updateFile = defineTool({
  ...catalogMeta('update_file'),
  inputSchema: z.object({
    id: z.string().uuid(),
    content: z.string().optional(),
    name: z.string().min(1).max(200).optional(),
    folder_id: z.string().uuid().nullable().optional(),
    archived: z.boolean().optional(),
    ifMatch: z
      .string()
      .optional()
      .describe('ETag/version for safe content writes (required when changing content).'),
  }),
  handler: async (i, ctx) => {
    // The version guards content writes only, and travels in the BODY — not the
    // `If-Match` header, which a CDN can answer with 412 at the edge (see
    // patchContent above).
    const version = i.content != null ? versionFromEtag(i.ifMatch) : undefined;
    const { data } = await ctx.client.PATCH('/api/v1/files/{id}', {
      params: { path: { id: i.id } },
      body: {
        ...(i.content != null ? { content: i.content } : {}),
        ...(i.name != null ? { name: i.name } : {}),
        ...(i.folder_id !== undefined ? { folder_id: i.folder_id } : {}),
        ...(i.archived != null ? { archived: i.archived } : {}),
        ...(version != null ? { version } : {}),
      },
    });
    return result(text(`Updated file "${data!.name}" (v${data!.version}).`), jsonText(data!));
  },
});

export const saveDocument = defineTool({
  ...catalogMeta('save_document'),
  inputSchema: z.object({
    content: z.string().min(1).describe('Markdown body to save.'),
    name: z
      .string()
      .max(200)
      .optional()
      .describe('Document name. Defaults to the first H1, else "Untitled".'),
    project: z
      .string()
      .optional()
      .describe('Project id, or a name to find-or-create. Defaults to "Drafts".'),
    idempotencyKey: z.string().optional(),
  }),
  handler: async (i, ctx) => {
    const name = i.name?.trim() || deriveName(i.content);
    const project = await resolveProject(ctx, i.project);

    const { data: full } = await ctx.client.GET('/api/v1/projects/{id}', {
      params: { path: { id: project.id }, query: {} },
    });
    const files = (full!.files ?? []) as FileLike[];
    const existing = files.find((f) => f.name === name && !f.archived);

    let file: FileLike;
    let created: boolean;
    if (existing) {
      try {
        file = (await patchContent(ctx, existing.id, existing.etag, i.content)) as FileLike;
      } catch (err) {
        if (err instanceof MdtidyApiError && err.status === 409) {
          // Stale ETag — re-read and retry once.
          const { data: fresh } = await ctx.client.GET('/api/v1/projects/{id}', {
            params: { path: { id: project.id }, query: {} },
          });
          const again = ((fresh!.files ?? []) as FileLike[]).find(
            (f) => f.name === name && !f.archived,
          );
          if (!again) throw err;
          file = (await patchContent(ctx, again.id, again.etag, i.content)) as FileLike;
        } else {
          throw err;
        }
      }
      created = false;
    } else {
      const { data } = await ctx.client.POST('/api/v1/files', {
        ...(i.idempotencyKey
          ? { params: { header: { 'Idempotency-Key': i.idempotencyKey } } }
          : {}),
        body: { project_id: project.id, name, content: i.content },
      });
      file = data! as FileLike;
      created = true;
    }

    const url = `${ctx.baseUrl}/edit/${file.id}`;
    const summary = created
      ? `Created "${name}" in project "${project.name}". 1 credit charged.`
      : `Updated "${name}" in project "${project.name}". No credit (update).`;
    return result(
      text(summary),
      jsonText({
        file_id: file.id,
        name,
        project,
        version: file.version,
        etag: file.etag,
        url,
        created,
        creditsRemaining: file.credits_remaining ?? null,
      }),
    );
  },
});
