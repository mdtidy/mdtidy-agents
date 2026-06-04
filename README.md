# mdtidy-agents

The agentic integration layer for **[mdtidy.com](https://mdtidy.com)** — a
Model Context Protocol (MCP) server that lets AI agents clean, convert, save, and
share Markdown. One package, **`@mdtidy/mcp`**, works as a local stdio server and
as the handler behind the hosted `https://mdtidy.com/mcp` endpoint.

> Build-and-publish repo, not a service. It contains **no business logic** — only
> the published OpenAPI contract (`contract/openapi.json`), a generated client,
> and a curated set of agent tools. See [`spec`](https://mdtidy.com) and
> [`docs/tools.md`](./docs/tools.md).

## Quick start

1. Create an API key at <https://mdtidy.com/account/api-keys> (`mt_live_…`).
2. Add the server to your agent:

**Claude Code**

```bash
claude mcp add mdtidy --env MDTIDY_API_KEY=mt_live_… -- npx -y @mdtidy/mcp
```

**Cursor / Claude Desktop / any stdio client**

```json
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

**Hosted (nothing to install)** — point any MCP client at
`https://www.mdtidy.com/mcp` with header `X-API-KEY: mt_live_…`. (mdtidy
authenticates with `X-API-KEY`, not `Authorization: Bearer`.)

## Tools

See the generated [`docs/tools.md`](./docs/tools.md). Highlights: `tidy_markdown`
(clean + convert to HTML/text/PDF/DOCX/PNG), `save_document` (one-step upsert),
`check_usage`, and read/write/share workspace tools.

## Repository layout

```
contract/openapi.json   # INPUT — the mdtidy contract (the only thing that crosses the IP boundary)
packages/
  client/               # generated typed REST client (openapi-fetch)
  tools/                # curated tool registry + result shaping
  mcp-core/             # registerTools (stdio) + stateless JSON-RPC (http) + context
adapters/mcp/           # @mdtidy/mcp — the published package (bin + ./http)
plugins/claude/         # Claude plugin (.mcp.json) + SKILL.md
skills/generic-agent/   # vendor-neutral agent instructions
knowledge/              # reference docs
scripts/generate.ts     # openapi.json → client types + operation manifest + docs/tools.md
```

## Develop

```bash
pnpm install
pnpm generate        # regenerate from contract/openapi.json
pnpm -r typecheck
pnpm -r test
pnpm -r build        # @mdtidy/mcp → dist/ via tsup
pnpm check:generated # CI drift gate
```

## License

MIT.
