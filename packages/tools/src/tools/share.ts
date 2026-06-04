import { z } from 'zod';

import { catalogMeta } from '../catalog';
import { jsonText, result, text } from '../shape';
import { defineTool } from '../types';

export const getProjectShare = defineTool({
  ...catalogMeta('get_project_share'),
  inputSchema: z.object({ id: z.string().uuid().describe('Project id.') }),
  handler: async (i, ctx) => {
    const { data } = await ctx.client.GET('/api/v1/projects/{id}/share', {
      params: { path: { id: i.id } },
    });
    return result(jsonText(data!));
  },
});

export const shareProjectPublic = defineTool({
  ...catalogMeta('share_project_public'),
  inputSchema: z.object({
    id: z.string().uuid().describe('Project id.'),
    idempotencyKey: z.string().optional(),
  }),
  handler: async (i, ctx) => {
    const { data } = await ctx.client.POST('/api/v1/projects/{id}/share/public', {
      params: {
        path: { id: i.id },
        ...(i.idempotencyKey ? { header: { 'Idempotency-Key': i.idempotencyKey } } : {}),
      },
    });
    const s = data!;
    return result(
      text(`Public link: ${s.public_url ?? s.project_url ?? '(enabled)'}`),
      jsonText(s),
    );
  },
});
