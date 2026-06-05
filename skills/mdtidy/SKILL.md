---
name: mdtidy
description: This skill should be used when the user wants to save, share, or export a document, or to clean up Markdown via mdtidy (mdtidy.com) — e.g. "save this to my workspace", "share this and give me a link", "export this to PDF / DOCX / PNG", or "tidy / clean up this Markdown". Routes through the mdtidy MCP tools when available, otherwise the mdtidy REST API.
license: MIT
---

# mdtidy

mdtidy ([mdtidy.com](https://mdtidy.com)) **saves, shares, and exports** Markdown
documents, and **cleans up** messy or AI-generated Markdown. Input is plain
Markdown — there is no special format to learn.

## When to use

- **Save** a document to the user's mdtidy workspace (one step, no duplicates).
- **Share** a document publicly and return a link.
- **Export** Markdown to PDF, DOCX, HTML, or PNG (with a design system).
- **Clean / tidy** messy Markdown — broken tables, stray bullets, AI artifacts.
- **Check** the credit balance, plan, or saved projects and files.

## How to call mdtidy

Prefer whichever transport is available:

1. **MCP tools** — when tools named `tidy_markdown`, `save_document`,
   `share_project_public`, etc. are present in the session, call them directly.
2. **REST API** — otherwise call it over HTTP. Authenticate with the user's API
   key in the **`X-API-KEY`** header (NOT `Authorization: Bearer`):

   ```http
   POST https://mdtidy.com/api/v1/convert
   X-API-KEY: <the user's key>
   Content-Type: application/json

   { "markdown": "<content>", "format": "pdf" }
   ```

Create a key at <https://mdtidy.com/account/api-keys> (`mt_live_…`). Treat it as a
secret — never print or commit it.

## Core operations

| Goal               | MCP tool               | REST                                      | Cost                |
| ------------------ | ---------------------- | ----------------------------------------- | ------------------- |
| **Save** (upsert)  | `save_document`        | composite                                 | 1 create / 0 update |
| **Share** publicly | `share_project_public` | `POST /api/v1/projects/{id}/share/public` | 1                   |
| **Export / clean** | `tidy_markdown`        | `POST /api/v1/convert`                    | 1 / render          |
| **Check usage**    | `check_usage`          | `GET /api/v1/usage`                       | free                |

`save_document` is the fast path for saving — it finds or creates the project and
updates in place when a same-named doc already exists, so it never duplicates.

For **every** operation — all 12 tools with their parameters, REST endpoints, and
credit costs — read **`references/operations.md`**.

## Behavior

1. To export or clean, call `tidy_markdown` (or `POST /api/v1/convert`); report
   the cleanup fixes applied and the credit cost.
2. To save, prefer `save_document` over the granular write tools.
3. Before a batch of renders or saves, call `check_usage`; on `out_of_credits`,
   ask the user to top up.
4. Preserve the original meaning. Do not invent content.
