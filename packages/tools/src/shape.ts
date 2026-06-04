// Result shaping — turn API responses into agent-legible MCP content. Spec §3.4.

import type { ToolContext } from './context';
import type { ContentBlock, ToolResult } from './types';

export function jsonText(value: unknown): ContentBlock {
  return { type: 'text', text: JSON.stringify(value, null, 2) };
}

export function text(value: string): ContentBlock {
  return { type: 'text', text: value };
}

export function result(...content: ContentBlock[]): ToolResult {
  return { content };
}

interface ConvertResponse {
  format: 'html' | 'text' | 'pdf' | 'docx' | 'png';
  contentType: string;
  byteSize: number;
  designSystem: string;
  output?: string;
  outputBase64?: string;
  warnings: Array<{ rule: string; fixes: number }>;
  creditsCharged: number;
  creditsRemaining: number;
  requestId: string;
}

export interface TidyInput {
  format: string;
  savePath?: string;
}

/** Shape a /convert response per output format (spec §3.4). */
export async function shapeConvertResult(
  data: ConvertResponse,
  input: TidyInput,
  ctx: ToolContext,
): Promise<ToolResult> {
  const fixes =
    data.warnings.length > 0
      ? data.warnings.map((w) => `${w.rule}×${w.fixes}`).join(', ')
      : 'no changes needed';
  const summary =
    `Tidied → ${data.format} (${data.byteSize} bytes, design system "${data.designSystem}"). ` +
    `Fixes: ${fixes}. Credits charged ${data.creditsCharged}, remaining ${data.creditsRemaining}.`;

  const blocks: ContentBlock[] = [];

  if (data.format === 'html' || data.format === 'text') {
    blocks.push(text(data.output ?? ''));
  } else if (data.format === 'png') {
    if (data.outputBase64)
      blocks.push({ type: 'image', data: data.outputBase64, mimeType: 'image/png' });
  } else {
    // pdf / docx
    if (ctx.transport === 'stdio' && input.savePath && data.outputBase64) {
      const { writeFileSync } = await import('node:fs');
      writeFileSync(input.savePath, Buffer.from(data.outputBase64, 'base64'));
      blocks.push(text(`Saved ${data.format.toUpperCase()} to ${input.savePath}`));
    } else if (data.outputBase64) {
      blocks.push({
        type: 'resource',
        resource: {
          uri: `mdtidy://convert/${data.requestId}.${data.format}`,
          mimeType: data.contentType,
          blob: data.outputBase64,
        },
      });
    }
  }

  blocks.push(text(summary));
  return { content: blocks };
}
