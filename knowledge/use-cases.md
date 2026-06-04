# mdtidy — use cases

- **Clean an AI answer.** Paste a ChatGPT/Claude/Gemini response and get tidy,
  consistent Markdown back (`tidy_markdown`, format `text` or `html`).
- **Branded export.** Turn a draft into a polished **PDF/DOCX/PNG** with a design
  system (`executive-report` for reports, `developer-docs` for technical docs,
  `minimal-clean` as a neutral default).
- **Save & iterate.** Save a working document with `save_document` (upsert), then
  keep editing — re-saving the same title updates it in place (free).
- **Share.** Make a project public and hand back an `https://mdtidy.com/p/{slug}`
  link with `share_project_public`.
- **Budget-aware automation.** Check the balance with `check_usage` before a
  batch so an agent never strands itself mid-task.
