import { describe, expect, it } from 'vitest';

import { DEFERRED_TOOLS, TOOL_CATALOG } from './catalog';
import { REGISTRY } from './registry';

describe('tool registry (allow-list)', () => {
  it('exposes exactly the curated catalog tools', () => {
    expect(REGISTRY.map((t) => t.name).sort()).toEqual(TOOL_CATALOG.map((t) => t.name).sort());
  });

  it('exposes none of the deferred tools', () => {
    const exposed = new Set(REGISTRY.map((t) => t.name));
    for (const deferred of DEFERRED_TOOLS) {
      expect(exposed.has(deferred.name)).toBe(false);
    }
  });

  it('every tool has a title, a real description, a schema, and a handler', () => {
    for (const tool of REGISTRY) {
      expect(tool.title).toBeTruthy();
      expect(tool.description.length).toBeGreaterThan(10);
      expect(tool.inputSchema).toBeTruthy();
      expect(typeof tool.handler).toBe('function');
    }
  });

  it('tool names are unique', () => {
    const names = REGISTRY.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
