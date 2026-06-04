// @mdtidy/mcp/http — the route-handler factory the mdtidy `/mcp` route mounts
// (spec §4.1). Stateless Streamable-HTTP; reads the caller's key from the
// request and forwards it to /api/v1/*.

export {
  createMcpRouteHandler,
  type McpRouteHandler,
  type McpRouteHandlerOptions,
} from '@mdtidy/mcp-core';
