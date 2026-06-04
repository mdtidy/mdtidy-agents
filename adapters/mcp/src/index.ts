// @mdtidy/mcp — library entry. Advanced embedders + tests import from here;
// the stdio CLI is ./bin and the route-handler factory is ./http.

export {
  registerTools,
  buildContext,
  handleJsonRpc,
  startStdio,
  createMcpRouteHandler,
  SERVER_INFO,
  PROTOCOL_VERSION,
  type BuildContextOptions,
  type StdioOptions,
  type McpRouteHandler,
  type McpRouteHandlerOptions,
  type JsonRpcRequest,
  type JsonRpcResponse,
} from '@mdtidy/mcp-core';

export {
  REGISTRY,
  TOOL_CATALOG,
  DEFERRED_TOOLS,
  type ToolDef,
  type ToolContext,
  type CatalogEntry,
} from '@mdtidy/tools';

export {
  createMdtidyClient,
  MdtidyApiError,
  type MdtidyClient,
  type MdtidyClientOptions,
} from '@mdtidy/client';
