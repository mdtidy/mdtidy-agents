---
name: mdtidy
description: Use when the user has messy or AI-generated Markdown to clean, normalize, or convert to PDF/DOCX/HTML/PNG, or wants to save and share a document. Works through the mdtidy MCP tools if available, otherwise the mdtidy REST API.
license: MIT
---

# mdtidy

[mdtidy.com](https://mdtidy.com) cleans and repairs messy, AI-generated Markdown
and renders it to **HTML, plain text, PDF, DOCX, or PNG** — and can save documents
to the user's workspace and produce a public share link. Input is plain Markdown;
there is no special format to learn.

## When to use

- The user pastes messy Markdown (stray bullets, broken tables, artifacts) and
  wants it cleaned or "made readable."
- The user wants a **branded export**: "give me a PDF / DOCX / PNG of this."
- The user wants to **save** a document or **share** it via a link.

## Setup (one-time)

The user needs an mdtidy API key (`mt_live_…`) from
<https://mdtidy.com/account/api-keys>. Treat it as a secret — never echo or commit it.

There are two ways to call mdtidy; **prefer whichever is available**:

1. **mdtidy MCP tools** — if tools named `tidy_markdown`, `save_document`, etc.
   are present in this session, call them directly.
2. **REST API** — otherwise call it over HTTP with the key in the **`X-API-KEY`**
   header (NOT `Authorization: Bearer`):

   ```http
   POST https://mdtidy.com/api/v1/convert
   X-API-KEY: <the user's key>
   Content-Type: application/json

   { "markdown": "<content>", "format": "text" }
   ```

   `format` ∈ `html` | `text` | `pdf` | `docx` | `png`. `html`/`text` return
   `output` (a string); `pdf`/`docx`/`png` return base64 in `outputBase64`. Every
   response includes `creditsCharged`, `creditsRemaining`, and `requestId`.

## Capabilities (MCP tool ↔ REST)

- **Tidy & convert** — `tidy_markdown` ↔ `POST /api/v1/convert`. `designSystem` ∈
  `minimal-clean` | `executive-report` | `developer-docs`. **1 credit per render**
  (refunded on failure).
- **Save (upsert)** — `save_document(content, name?, project?)` — one-step save;
  finds/creates the project and updates in place if the name exists. **1 credit on
  create, 0 on update.**
- **Read** — `check_usage`, `get_entitlement`, `list_projects`, `get_project`,
  `get_file`. Free.
- **Share** — `get_project_share`, `share_project_public` → a public
  `https://mdtidy.com/p/…` link.

## Behavior

1. Cleanup/convert → tidy first; report the fixes applied and the credit cost.
2. "Save this" → prefer `save_document` (one step, never duplicates).
3. Before a batch → check usage; on `out_of_credits`, ask the user to top up.
4. Preserve the original meaning; do not invent content. The API key is a secret
   — never print it back.
