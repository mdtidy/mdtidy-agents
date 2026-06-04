---
name: mdtidy
description: Use when the user has messy or AI-generated Markdown and wants it cleaned, converted to PDF/DOCX/HTML/PNG, or saved and shared. Routes through the mdtidy MCP tools (tidy_markdown, save_document, etc.).
---

# mdtidy

[mdtidy.com](https://mdtidy.com) cleans and repairs messy AI-generated Markdown
and renders it to **HTML, plain text, PDF, DOCX, or PNG**. It can also save
documents to the user's workspace and produce a public share link. Input is plain
Markdown — there is no special format to learn.

## When to use

- The user pastes messy Markdown (stray bullets, broken tables, artifacts) and
  wants it cleaned or "made readable."
- The user wants a **branded export**: "give me a PDF / DOCX / PNG of this."
- The user wants to **save** a document or **share** it via a link.

## Tools

| Want to…                        | Tool                                       | Cost                                    |
| ------------------------------- | ------------------------------------------ | --------------------------------------- |
| Clean + convert Markdown        | `tidy_markdown`                            | 1 credit / render (refunded on failure) |
| Save a doc in one step (upsert) | `save_document`                            | 1 on create, 0 on update                |
| Check credit balance            | `check_usage`                              | free                                    |
| List / read projects + files    | `list_projects`, `get_project`, `get_file` | free                                    |
| Edit a saved file               | `update_file`                              | free                                    |
| Share publicly                  | `share_project_public`                     | 1 credit                                |

Design systems for `tidy_markdown`: `minimal-clean` (default), `executive-report`,
`developer-docs`. Formats: `html`, `text`, `pdf`, `docx`, `png`.

## How to behave

1. For a cleanup/convert request, call `tidy_markdown` with the user's Markdown
   and the requested `format`. Report the fixes it applied and the credits used.
2. For "save this," prefer `save_document` (it finds-or-creates a project and
   upserts by title — re-saving the same title updates in place).
3. Before a large batch, call `check_usage`. If `out_of_credits`, tell the user
   to top up at mdtidy.com rather than retrying.
4. Treat the API key as a secret; never print it.

## Examples

- "Tidy this up and give me a branded PDF." → `tidy_markdown { format: "pdf", designSystem: "executive-report" }`
- "Clean this and save it as Release Notes." → `tidy_markdown` then `save_document { name: "Release Notes" }`
- "Share my Q3 report publicly." → `get_project` / `list_projects` to find it, then `share_project_public`.
