import { z } from 'zod';

import { catalogMeta } from '../catalog';
import { shapeConvertResult } from '../shape';
import { defineTool } from '../types';

const input = z.object({
  markdown: z.string().min(1).describe('The Markdown to clean and convert.'),
  format: z
    .enum(['html', 'text', 'pdf', 'docx', 'png'])
    .default('text')
    .describe(
      'Output format. Defaults to "text" (cleaned Markdown, inline). html/text return inline; pdf/docx/png return a file or resource.',
    ),
  designSystem: z
    .enum(['minimal-clean', 'executive-report', 'developer-docs'])
    .optional()
    .describe('Visual theme. Defaults to minimal-clean.'),
  page: z
    .object({
      paperSize: z.enum(['Letter', 'A4', 'A3']).optional(),
      orientation: z.enum(['portrait', 'landscape']).optional(),
      marginPreset: z.enum(['narrow', 'normal', 'wide']).optional(),
      fontScale: z.enum(['down', 'normal', 'up']).optional(),
    })
    .optional()
    .describe('Optional page geometry + font scale (render-only; no credit cost).'),
  tidy: z
    .object({
      enable: z.boolean().optional(),
      polish: z.boolean().optional(),
    })
    .optional()
    .describe('Tidy pipeline toggles. Both default to true.'),
  savePath: z
    .string()
    .optional()
    .describe('(stdio only) write binary output (pdf/docx/png) to this local path and return it.'),
});

export const tidyMarkdown = defineTool({
  ...catalogMeta('tidy_markdown'),
  inputSchema: input,
  handler: async (i, ctx) => {
    const { data } = await ctx.client.POST('/api/v1/convert', {
      body: {
        markdown: i.markdown,
        format: i.format,
        ...(i.designSystem ? { designSystem: i.designSystem } : {}),
        ...(i.page ? { page: i.page } : {}),
        ...(i.tidy ? { settings: { tidy: i.tidy } } : {}),
      },
    });
    return shapeConvertResult(data!, i, ctx);
  },
});
