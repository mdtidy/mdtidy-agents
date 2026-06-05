# mdtidy — agent instructions (vendor-neutral)

Paste these into any MCP-capable agent (Cursor, Codex, Gemini CLI, …) alongside
the mdtidy MCP server. They mirror the Claude `SKILL.md` without Claude-specific
framing.

[mdtidy.com](https://mdtidy.com) cleans and repairs messy AI-generated Markdown
and renders it to HTML, plain text, PDF, DOCX, or PNG, and can save/share
documents. Input is plain Markdown — no special format to learn.

## Setup

Configure the mdtidy MCP server (`npx -y @mdtidy/mcp` with `MDTIDY_API_KEY`, or
the hosted endpoint `https://www.mdtidy.com/mcp` with the `X-API-KEY` header —
mdtidy does not accept `Authorization: Bearer`). Create a key at
<https://mdtidy.com/account/api-keys>.

## Tools

- `tidy_markdown(markdown, format, designSystem?, page?, tidy?)` — clean + convert.
  format ∈ html | text | pdf | docx | png. designSystem ∈ minimal-clean |
  executive-report | developer-docs. **1 credit per render** (refunded on failure).
- `save_document(content, name?, project?)` — save in one step (upsert by
  project+name). **1 credit on create, 0 on update.**
- `check_usage()` / `get_entitlement()` — balance + plan. Free.
- `list_projects()`, `get_project(id)`, `get_file(id)` — browse. Free.
- `create_project(name)`, `save_file(...)`, `update_file(id, ...)` — granular writes.
- `get_project_share(id)`, `share_project_public(id)` — sharing.

## Behavior

1. Cleanup/convert → `tidy_markdown`; report fixes + credit cost.
2. "Save this" → prefer `save_document`.
3. Before a batch → `check_usage`; on `out_of_credits`, ask the user to top up.
4. The API key is a secret — never echo it.
