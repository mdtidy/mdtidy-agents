// Identity advertised to MCP clients. `version` is the published @mdtidy/mcp
// version; bumped by changesets at release.
export const SERVER_INFO = {
  name: 'mdtidy',
  version: '1.0.0',
  title: 'Markdown Tidy',
};

/** MCP protocol version this server speaks (echoes the client's request when valid). */
export const PROTOCOL_VERSION = '2025-06-18';
