# Contributing

Thanks for helping improve the mdtidy agentic layer.

## Setup

```bash
pnpm install
pnpm generate        # regenerate client + docs from contract/openapi.json
pnpm -r typecheck
pnpm -r test
pnpm -r build
```

## Ground rules

- **No business logic.** This repo only knows how to _call_ the mdtidy API
  (described by `contract/openapi.json`) and present it well to agents.
- **Generated files are not hand-edited.** Anything under `**/generated/` and
  `docs/tools.md` is produced by `pnpm generate`. CI runs `pnpm check:generated`
  and fails on drift — run `pnpm generate` and commit the result instead.
- **Tools are curated.** Adding a tool means a registry entry in
  `packages/tools` plus a test; it should map to an existing API operation.

## Releasing

Releases are **automatic**. Any push to `main` that touches `packages/**`,
`adapters/**`, or `contract/**` publishes a new `@mdtidy/mcp` via OIDC trusted
publishing (`.github/workflows/release.yml`). The version is
`MAJOR.MINOR.<github-run-number>`, where `MAJOR.MINOR` comes from
`adapters/mcp/package.json`.

- For a normal change, just merge — it ships as a new patch automatically.
- To signal a **minor or breaking** change, bump `MAJOR.MINOR` in
  `adapters/mcp/package.json` in the same PR (e.g. `1.1.0` → `1.2.0` or `2.0.0`).
