import { describe, expect, it } from 'vitest';

import { createMcpRouteHandler as httpFactory } from './http';
import {
  createMdtidyClient,
  createMcpRouteHandler,
  REGISTRY,
  SERVER_INFO,
  startStdio,
} from './index';

describe('@mdtidy/mcp public surface', () => {
  it('re-exports the registry with the 15 v1 tools', () => {
    expect(REGISTRY).toHaveLength(15);
    expect(REGISTRY.map((t) => t.name)).toContain('tidy_markdown');
    expect(REGISTRY.map((t) => t.name)).toContain('save_document');
  });

  it('exposes the stdio + http + client entry points', () => {
    expect(typeof startStdio).toBe('function');
    expect(typeof createMcpRouteHandler).toBe('function');
    expect(typeof httpFactory).toBe('function');
    expect(typeof createMdtidyClient).toBe('function');
    expect(SERVER_INFO.name).toBe('mdtidy');
  });
});
