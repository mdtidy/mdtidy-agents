import { z } from 'zod';

import { catalogMeta } from '../catalog';
import { jsonText, result, text } from '../shape';
import { defineTool } from '../types';

export const checkUsage = defineTool({
  ...catalogMeta('check_usage'),
  inputSchema: z.object({}),
  handler: async (_i, ctx) => {
    const { data } = await ctx.client.GET('/api/v1/usage', {});
    const u = data!;
    return result(
      text(
        `Credits remaining: ${u.creditsRemaining} (subscription ${u.subscriptionCredits} + top-up ${u.topupCredits}). ` +
          `Calls this period: ${u.callsThisPeriod}.`,
      ),
      jsonText(u),
    );
  },
});

export const getEntitlement = defineTool({
  ...catalogMeta('get_entitlement'),
  inputSchema: z.object({}),
  handler: async (_i, ctx) => {
    const { data } = await ctx.client.GET('/api/v1/credits', {});
    const e = data!;
    return result(
      text(
        `Plan: ${e.plan}. Balance: ${e.credits_balance}. can_save=${e.can_save} can_share=${e.can_share}.`,
      ),
      jsonText(e),
    );
  },
});

export const listProjects = defineTool({
  ...catalogMeta('list_projects'),
  inputSchema: z.object({
    scope: z
      .enum(['mine', 'shared', 'archived'])
      .optional()
      .describe('Which projects to list. Defaults to mine.'),
  }),
  handler: async (i, ctx) => {
    const { data } = await ctx.client.GET('/api/v1/projects', {
      params: { query: i.scope ? { scope: i.scope } : {} },
    });
    const d = data!;
    return result(text(`${d.items.length} project(s) in scope "${d.scope}".`), jsonText(d.items));
  },
});

export const getProject = defineTool({
  ...catalogMeta('get_project'),
  inputSchema: z.object({
    id: z.string().uuid().describe('Project id.'),
    includeArchived: z.boolean().optional().describe('Include archived files. Default false.'),
  }),
  handler: async (i, ctx) => {
    const { data } = await ctx.client.GET('/api/v1/projects/{id}', {
      params: {
        path: { id: i.id },
        query: i.includeArchived != null ? { include_archived: i.includeArchived } : {},
      },
    });
    return result(jsonText(data!));
  },
});

export const getFile = defineTool({
  ...catalogMeta('get_file'),
  inputSchema: z.object({ id: z.string().uuid().describe('File id.') }),
  handler: async (i, ctx) => {
    const { data } = await ctx.client.GET('/api/v1/files/{id}', {
      params: { path: { id: i.id } },
    });
    const f = data!;
    return result(text(`File "${f.name}" (v${f.version}). ETag ${f.etag}.`), text(f.content ?? ''));
  },
});
