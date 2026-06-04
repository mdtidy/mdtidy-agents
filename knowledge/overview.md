# mdtidy — overview

**mdtidy** (mdtidy.com) turns messy, AI-generated Markdown into clean, branded,
platform-ready documents. It cleans and repairs Markdown (stray bullets, broken
tables, artifacts) and renders it to **HTML, plain text, PDF, DOCX, or PNG**. It
also offers a lightweight workspace: save documents into projects and share them
via a public link.

This repository (`@mdtidy/mcp`) is the **agent integration layer** — it lets AI
agents use mdtidy through the Model Context Protocol. It contains no business
logic; it calls the public mdtidy API (described by `contract/openapi.json`) and
presents a curated set of tools to agents.

- **Auth:** an mdtidy API key (`mt_live_…` / `mt_test_…`), created at
  <https://mdtidy.com/account/api-keys>.
- **Credits:** rendering and first-saves cost 1 credit; reads and updates are
  free. Failed renders are refunded.
- **Tools:** see [`docs/tools.md`](../docs/tools.md) (generated from the contract).
