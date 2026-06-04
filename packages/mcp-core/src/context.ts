import { createMdtidyClient } from '@mdtidy/client';
import type { ToolContext } from '@mdtidy/tools';

export interface BuildContextOptions {
  apiKey: string;
  baseUrl: string;
  transport: 'stdio' | 'http';
  fetch?: typeof fetch;
  timeoutMs?: number;
  logger?: (message: string) => void;
}

/** Build the per-invocation ToolContext: a configured client + transport tag. */
export function buildContext(opts: BuildContextOptions): ToolContext {
  return {
    client: createMdtidyClient({
      apiKey: opts.apiKey,
      baseUrl: opts.baseUrl,
      fetch: opts.fetch,
      timeoutMs: opts.timeoutMs,
    }),
    baseUrl: opts.baseUrl,
    transport: opts.transport,
    logger: opts.logger,
  };
}
