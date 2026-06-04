import type { z } from 'zod';

import type { ToolContext } from './context';

// MCP content blocks a tool may return. Mirrors the subset of the MCP result
// content union we use; mcp-core maps these to the SDK / JSON-RPC wire shapes.
export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mimeType: string }
  | {
      type: 'resource';
      resource: { uri: string; mimeType?: string; blob?: string; text?: string };
    };

export interface ToolResult {
  content: ContentBlock[];
  isError?: boolean;
}

// A tool definition. `inputSchema` is a Zod object whose `.shape` feeds the MCP
// SDK's `registerTool` (stdio) and whose JSON Schema projection feeds the
// stateless HTTP `tools/list`. Spec §3.2, §3.4.
export interface ToolDef<Schema extends z.ZodObject<z.ZodRawShape> = z.ZodObject<z.ZodRawShape>> {
  name: string;
  title: string;
  description: string;
  inputSchema: Schema;
  /** Credit cost shown to agents (0 = free, 1 = one credit, '1/0' = create vs update). */
  cost: 0 | 1 | '1/0';
  handler: (input: z.infer<Schema>, ctx: ToolContext) => Promise<ToolResult>;
}

/** Helper to define a tool with inference on the input schema. */
export function defineTool<Schema extends z.ZodObject<z.ZodRawShape>>(
  def: ToolDef<Schema>,
): ToolDef {
  return def as unknown as ToolDef;
}
