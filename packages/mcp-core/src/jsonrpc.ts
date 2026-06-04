// Stateless JSON-RPC 2.0 dispatch for the Streamable-HTTP path (the Vercel
// /mcp route). Both transports share the same REGISTRY; this is the HTTP
// projection — no SDK server object, no session state. Spec §3.3, §4.1.

import { REGISTRY, type ToolContext, type ToolDef } from '@mdtidy/tools';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { PROTOCOL_VERSION, SERVER_INFO } from './server-info';

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export interface DispatchOptions {
  tools?: ToolDef[];
}

function toolInputJsonSchema(tool: ToolDef): Record<string, unknown> {
  const schema = zodToJsonSchema(tool.inputSchema, {
    target: 'jsonSchema7',
    $refStrategy: 'none',
  }) as Record<string, unknown>;
  delete schema.$schema;
  return schema;
}

export async function handleJsonRpc(
  req: JsonRpcRequest,
  ctx: ToolContext,
  opts: DispatchOptions = {},
): Promise<JsonRpcResponse | null> {
  const tools = opts.tools ?? REGISTRY;
  const id = req.id ?? null;
  const ok = (result: unknown): JsonRpcResponse => ({ jsonrpc: '2.0', id, result });
  const fail = (code: number, message: string): JsonRpcResponse => ({
    jsonrpc: '2.0',
    id,
    error: { code, message },
  });

  switch (req.method) {
    case 'initialize': {
      const requested = req.params?.protocolVersion;
      return ok({
        protocolVersion: typeof requested === 'string' ? requested : PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
      });
    }
    case 'ping':
      return ok({});
    case 'tools/list':
      return ok({
        tools: tools.map((t) => ({
          name: t.name,
          title: t.title,
          description: t.description,
          inputSchema: toolInputJsonSchema(t),
        })),
      });
    case 'tools/call': {
      const name = req.params?.name as string | undefined;
      const tool = tools.find((t) => t.name === name);
      if (!tool) return fail(-32602, `Unknown tool: ${name}`);
      const parsed = tool.inputSchema.safeParse(req.params?.arguments ?? {});
      if (!parsed.success) {
        const detail = parsed.error.issues
          .map((iss) => `${iss.path.join('.')}: ${iss.message}`)
          .join('; ');
        return fail(-32602, `Invalid arguments for ${name}: ${detail}`);
      }
      try {
        const res = await tool.handler(parsed.data, ctx);
        return ok({ content: res.content, isError: res.isError ?? false });
      } catch (err) {
        // Per MCP, tool execution failures are returned as an error *result*
        // (isError), not a JSON-RPC protocol error, so the model can react.
        const message = err instanceof Error ? err.message : String(err);
        return ok({ content: [{ type: 'text', text: `Error: ${message}` }], isError: true });
      }
    }
    default:
      // Notifications (no id) need no response.
      if (req.id === undefined || req.method.startsWith('notifications/')) return null;
      return fail(-32601, `Method not found: ${req.method}`);
  }
}
