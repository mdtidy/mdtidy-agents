// Real-world session #3 — the Claude Code plugin.
//
// The plugin doesn't ship its own server; its `.mcp.json` launches the published
// `@mdtidy/mcp` package over stdio. This test (a) validates the plugin's declared
// config + marketplace/plugin manifests, (b) proves the config points at THIS
// package and the env var the stdio entrypoint actually reads, and (c) boots the
// configured server into a live MCP session — so "install the plugin" is covered
// end to end, not just asserted structurally.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { startStdio } from './index';
import { createMockBackend } from './__fixtures__/mock-backend';
import { connectStdioSession, textOf } from './__fixtures__/session';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../');
const readJson = (rel: string): any => JSON.parse(readFileSync(resolve(repoRoot, rel), 'utf8'));

describe('session — Claude plugin', () => {
  it('declares a marketplace + plugin manifest that resolve to "mdtidy@mdtidy"', () => {
    const marketplace = readJson('.claude-plugin/marketplace.json');
    expect(marketplace.name).toBe('mdtidy');
    expect(marketplace.plugins).toHaveLength(1);
    expect(marketplace.plugins[0].name).toBe('mdtidy');
    expect(marketplace.plugins[0].source).toBe('./plugins/claude');

    const plugin = readJson('plugins/claude/.claude-plugin/plugin.json');
    expect(plugin.name).toBe('mdtidy');
  });

  it('launches THIS published package over stdio with the MDTIDY_API_KEY env var', () => {
    const pkgName = readJson('adapters/mcp/package.json').name;
    const cfg = readJson('plugins/claude/.mcp.json');
    const server = cfg.mcpServers?.mdtidy;
    expect(server).toBeDefined();
    expect(server.command).toBe('npx');
    expect(server.args).toEqual(expect.arrayContaining(['-y', pkgName]));
    // The package the plugin launches is the one this repo publishes.
    expect(pkgName).toBe('@mdtidy/mcp');
    // ...and it passes through the env var the stdio entrypoint reads.
    expect(server.env).toHaveProperty('MDTIDY_API_KEY');
    expect(server.env.MDTIDY_API_KEY).toBe('${MDTIDY_API_KEY}');
  });

  it('refuses to boot without MDTIDY_API_KEY (the env var the plugin must supply)', async () => {
    const saved = process.env.MDTIDY_API_KEY;
    delete process.env.MDTIDY_API_KEY;
    try {
      await expect(startStdio()).rejects.toThrow(/MDTIDY_API_KEY is required/);
    } finally {
      if (saved !== undefined) process.env.MDTIDY_API_KEY = saved;
    }
  });

  it('boots the configured server and serves a working MCP session', async () => {
    const backend = createMockBackend({ startingCredits: 5 });
    const { client, close } = await connectStdioSession(backend);
    try {
      const { tools } = await client.listTools();
      expect(tools).toHaveLength(15);

      const tidy = await client.callTool({
        name: 'tidy_markdown',
        arguments: { markdown: '# From the plugin', format: 'text' },
      });
      expect(tidy.isError).toBeFalsy();
      expect(textOf(tidy)).toContain('From the plugin');
    } finally {
      await close();
    }
  });
});
