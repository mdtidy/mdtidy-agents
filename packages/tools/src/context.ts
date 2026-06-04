import type { MdtidyClient } from '@mdtidy/client';

// Everything a tool handler needs, independent of transport. `transport` lets a
// tool make a transport-specific choice (e.g. write a binary to disk only in
// stdio mode — spec §3.4). The key/baseUrl/fetch are encapsulated by `client`.
export interface ToolContext {
  client: MdtidyClient;
  /** API origin, for building user-facing links (e.g. /edit/{id}, /p/{slug}). */
  baseUrl: string;
  transport: 'stdio' | 'http';
  logger?: (message: string) => void;
}
