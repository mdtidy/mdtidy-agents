import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { buildContext } from './context';
import { buildMcpServer } from './server';

export interface StdioOptions {
  /** Defaults to process.env.MDTIDY_API_KEY. */
  apiKey?: string;
  /** Defaults to process.env.MDTIDY_BASE_URL ?? https://mdtidy.com. */
  baseUrl?: string;
}

/** Boot the stdio MCP server (the `npx @mdtidy/mcp` / local-client path). */
export async function startStdio(opts: StdioOptions = {}): Promise<void> {
  const apiKey = opts.apiKey ?? process.env.MDTIDY_API_KEY;
  if (!apiKey) {
    throw new Error(
      'MDTIDY_API_KEY is required. Create a key at https://mdtidy.com/account/api-keys and set it in your MCP client config.',
    );
  }
  const baseUrl = opts.baseUrl ?? process.env.MDTIDY_BASE_URL ?? 'https://www.mdtidy.com';
  const ctx = buildContext({ apiKey, baseUrl, transport: 'stdio' });

  const server = buildMcpServer(ctx);
  await server.connect(new StdioServerTransport());
}
