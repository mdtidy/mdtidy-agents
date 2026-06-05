import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ToolContext, ToolDef } from '@mdtidy/tools';

import { registerTools } from './register';
import { SERVER_INFO } from './server-info';

/**
 * Construct an MCP SDK server with the mdtidy tool surface attached.
 *
 * The single place a server is assembled — shared by the stdio CLI
 * (`startStdio`) and by in-process tests that drive a real MCP session over an
 * in-memory transport. Keeping it here means those tests exercise the exact
 * construction the published `npx @mdtidy/mcp` binary uses, not a copy.
 */
export function buildMcpServer(ctx: ToolContext, tools?: ToolDef[]): McpServer {
  const server = new McpServer(
    { name: SERVER_INFO.name, version: SERVER_INFO.version },
    { capabilities: { tools: {} } },
  );
  registerTools(server, ctx, tools);
  return server;
}
