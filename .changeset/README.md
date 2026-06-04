# Changesets

This folder is managed by [changesets](https://github.com/changesets/changesets).
Add a changeset for any change that should publish a new `@mdtidy/mcp`:

```bash
pnpm changeset
```

Only `@mdtidy/mcp` is published; the internal `@mdtidy/*` packages are bundled
into it and `ignore`d in `config.json`.
