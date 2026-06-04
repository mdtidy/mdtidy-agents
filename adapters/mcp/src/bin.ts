#!/usr/bin/env node
// @mdtidy/mcp stdio CLI — `npx -y @mdtidy/mcp`. Reads MDTIDY_API_KEY from the
// environment and serves the MCP tools over stdio to a local client.

import { startStdio } from '@mdtidy/mcp-core';

startStdio().catch((err: unknown) => {
  console.error(`[mdtidy-mcp] ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
