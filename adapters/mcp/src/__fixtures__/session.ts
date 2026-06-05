// Helpers for the real-world session tests: boot the published server (the exact
// construction `npx @mdtidy/mcp` uses, via buildMcpServer) and connect a real
// MCP SDK client over an in-memory transport pair — a genuine initialize →
// tools/list → tools/call handshake, minus the subprocess flakiness of real
// stdio pipes.

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { buildContext, buildMcpServer } from '../index';
import type { MockBackend } from './mock-backend';

export interface Session {
  client: Client;
  close: () => Promise<void>;
}

export async function connectStdioSession(
  backend: MockBackend,
  apiKey = 'mt_test_session',
): Promise<Session> {
  const ctx = buildContext({
    apiKey,
    baseUrl: 'https://app.test',
    transport: 'stdio',
    fetch: backend.fetch,
  });
  const server = buildMcpServer(ctx);
  const client = new Client({ name: 'test-agent', version: '0.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return {
    client,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}

// `result` is the SDK's CallToolResult (a union with a structured-output
// variant), so these helpers take `any` rather than re-deriving that type.

/** Concatenate the text blocks of a tool result. */
export function textOf(result: any): string {
  const blocks: Array<{ type: string; text?: string }> = result?.content ?? [];
  return blocks.map((c) => (c.type === 'text' ? (c.text ?? '') : '')).join('\n');
}

/** Parse the last JSON-bearing text block of a tool result (tools attach a
 *  machine-readable block after the human summary). */
export function lastJson(result: any): any {
  const blocks: Array<{ text?: string }> = result?.content ?? [];
  for (let i = blocks.length - 1; i >= 0; i -= 1) {
    const t = blocks[i]?.text;
    if (!t) continue;
    try {
      return JSON.parse(t);
    } catch {
      /* not this block */
    }
  }
  return null;
}
