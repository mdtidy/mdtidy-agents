# @mdtidy/mcp

Model Context Protocol server for **[mdtidy.com](https://mdtidy.com)** — clean,
convert, save, and share Markdown from any AI agent.

## Use it

Create an API key at <https://mdtidy.com/account/api-keys>, then:

```bash
# Claude Code
claude mcp add mdtidy --env MDTIDY_API_KEY=mt_live_… -- npx -y @mdtidy/mcp
```

```json
// Any stdio client (.mcp.json / client MCP config)
{
  "mcpServers": {
    "mdtidy": {
      "command": "npx",
      "args": ["-y", "@mdtidy/mcp"],
      "env": { "MDTIDY_API_KEY": "${MDTIDY_API_KEY}" }
    }
  }
}
```

Or point any client at the hosted `https://mdtidy.com/mcp` with
`Authorization: Bearer mt_live_…`.

## Entry points

- `mdtidy-mcp` (bin) — stdio server. Reads `MDTIDY_API_KEY` (and optional
  `MDTIDY_BASE_URL`).
- `@mdtidy/mcp/http` — `createMcpRouteHandler()`, the stateless Streamable-HTTP
  handler the mdtidy `/mcp` route mounts.
- `@mdtidy/mcp` — library exports (`registerTools`, `REGISTRY`, `createMdtidyClient`, …).

Full tool reference: <https://github.com/mdtidy/mdtidy-agents/blob/main/docs/tools.md>.

MIT.
