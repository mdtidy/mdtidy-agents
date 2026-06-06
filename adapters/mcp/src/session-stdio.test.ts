// Real-world session #1 — local stdio (`npx -y @mdtidy/mcp`).
//
// Drives a genuine MCP session through the SDK Client: initialize handshake,
// tools/list, then a realistic agent workflow that touches every tool group —
// Convert (tidy_markdown), Write (save_document create→update), Read (get_file),
// and Share (share_project_public) — against the stateful mock backend, with
// credit accounting verified end to end.

import { describe, expect, it } from 'vitest';

import { createMockBackend } from './__fixtures__/mock-backend';
import { connectStdioSession, lastJson, textOf } from './__fixtures__/session';

describe('session — stdio (npx @mdtidy/mcp)', () => {
  it('completes initialize → list → tidy → save → update → read → share', async () => {
    const backend = createMockBackend({ startingCredits: 10 });
    const { client, close } = await connectStdioSession(backend);

    try {
      // The initialize handshake negotiated the server identity.
      expect(client.getServerVersion()?.name).toBe('mdtidy');

      // tools/list — the full v1 surface.
      const { tools } = await client.listTools();
      expect(tools).toHaveLength(15);
      const names = tools.map((t) => t.name);
      expect(names).toEqual(expect.arrayContaining(['tidy_markdown', 'save_document', 'get_file']));

      // Convert — tidy & render (1 credit).
      const tidy = await client.callTool({
        name: 'tidy_markdown',
        arguments: { markdown: '# Draft\n\n\n\nmessy   ', format: 'text' },
      });
      expect(tidy.isError).toBeFalsy();
      expect(textOf(tidy)).toContain('Draft');

      // Write — first save creates the file (1 credit).
      const created = await client.callTool({
        name: 'save_document',
        arguments: { content: '# Notes\nfirst body', name: 'Notes' },
      });
      expect(textOf(created)).toContain('Created');
      const createdJson = lastJson(created);
      const fileId: string = createdJson.file_id;
      const projectId: string = createdJson.project.id;
      expect(createdJson.created).toBe(true);

      // Write — re-saving the same name updates in place (0 credits).
      const updated = await client.callTool({
        name: 'save_document',
        arguments: { content: '# Notes\nsecond body', name: 'Notes' },
      });
      expect(textOf(updated)).toContain('Updated');
      expect(lastJson(updated).created).toBe(false);

      // Read — fetch the file back; it reflects the update.
      const file = await client.callTool({ name: 'get_file', arguments: { id: fileId } });
      expect(textOf(file)).toContain('second body');

      // Credit accounting: 10 − 1 (tidy) − 1 (create) − 0 (update) = 8.
      const usage = await client.callTool({ name: 'check_usage', arguments: {} });
      expect(textOf(usage)).toContain('Credits remaining: 8');
      expect(backend.credits()).toBe(8);

      // Share — turn on the public link.
      const shared = await client.callTool({
        name: 'share_project_public',
        arguments: { id: projectId },
      });
      expect(shared.isError).toBeFalsy();
      expect(textOf(shared)).toContain('/p/');
    } finally {
      await close();
    }
  });

  it('returns a tool error (not a thrown exception) when the backend runs out of credits', async () => {
    const backend = createMockBackend({ startingCredits: 1 });
    const { client, close } = await connectStdioSession(backend);
    try {
      const first = await client.callTool({
        name: 'tidy_markdown',
        arguments: { markdown: '# A', format: 'text' },
      });
      expect(first.isError).toBeFalsy();

      const second = await client.callTool({
        name: 'tidy_markdown',
        arguments: { markdown: '# B', format: 'text' },
      });
      expect(second.isError).toBe(true);
      expect(textOf(second).toLowerCase()).toContain('credit');
    } finally {
      await close();
    }
  });
});
