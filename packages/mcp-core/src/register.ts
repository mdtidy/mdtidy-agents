import { REGISTRY, type ToolContext, type ToolDef } from '@mdtidy/tools';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// Attach every registry tool to an MCP SDK server (the stdio path). Both
// transports consume the same REGISTRY; this is the SDK projection. Spec §3.3.
export function registerTools(
  server: McpServer,
  ctx: ToolContext,
  tools: ToolDef[] = REGISTRY,
): void {
  for (const tool of tools) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema.shape,
        ...(tool.annotations ? { annotations: tool.annotations } : {}),
      },
      async (args: unknown) => {
        const res = await tool.handler(args as Record<string, unknown>, ctx);
        return { content: res.content as never, isError: res.isError };
      },
    );
  }
}
