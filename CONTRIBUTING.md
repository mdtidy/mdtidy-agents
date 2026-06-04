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
- Add a `changeset` (`pnpm changeset`) for anything that should publish
  `@mdtidy/mcp`.

## Releasing

See [`docs/releasing.md`](./docs/releasing.md).
