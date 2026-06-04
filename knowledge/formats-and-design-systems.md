# mdtidy — formats & design systems

## Output formats (`tidy_markdown` `format`)

| Format | Returns         | Notes                                                                                          |
| ------ | --------------- | ---------------------------------------------------------------------------------------------- |
| `html` | inline text     | Sanitized HTML render.                                                                         |
| `text` | inline text     | Clean plain Markdown/text.                                                                     |
| `pdf`  | file / resource | In stdio mode pass `savePath` to write it to disk; otherwise returned as an embedded resource. |
| `docx` | file / resource | Same handling as PDF.                                                                          |
| `png`  | image           | Returned as an image content block.                                                            |

## Design systems (`designSystem`)

| Slug                      | Use it for                               |
| ------------------------- | ---------------------------------------- |
| `minimal-clean` (default) | Neutral, general-purpose documents.      |
| `executive-report`        | Polished business reports and summaries. |
| `developer-docs`          | Technical docs, code-heavy content.      |

## Page options (`page`)

All optional; omitted fields inherit the design-system defaults.

- `paperSize`: `Letter` | `A4` | `A3`
- `orientation`: `portrait` | `landscape`
- `marginPreset`: `narrow` | `normal` | `wide`
- `fontScale`: `down` | `normal` | `up`

## Tidy toggles (`tidy`)

- `enable` (default true) — run cleanup + repair; set false to render as-is.
- `polish` (default true) — opinionated typography (em-dash → "-", etc.).
