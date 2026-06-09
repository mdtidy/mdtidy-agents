# mdtidy — troubleshooting

| Symptom                                      | Cause                                                    | Fix                                                                      |
| -------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------ |
| `Missing API key` (401)                      | No key sent                                              | stdio: set `MDTIDY_API_KEY`. Remote: send `Authorization: Bearer <key>`. |
| `invalid_api_key` (401)                      | Bad/revoked key                                          | Create a new key at mdtidy.com/account/api-keys.                         |
| 401 even though the key is set and valid     | MCP server captured `MDTIDY_API_KEY` at startup — it was empty then, or the session runs somewhere the env isn't injected (e.g. a git worktree without it). The live shell may still see the key while the server doesn't. | Fully **restart** the MCP host (Claude Code) after setting/rotating the key — servers capture env once at startup. Set the key at **user level** (`~/.claude/settings.json` `env`), not a per-project/gitignored file, so every session and worktree inherits it. |
| `out_of_credits` (402)                       | Wallet empty this period                                 | Top up / upgrade at mdtidy.com — don't blind-retry.                      |
| `rate_limited` (429)                         | >60 requests/min on one key                              | Back off and retry after `Retry-After`.                                  |
| `payload_too_large` (413)                    | Markdown over the 1 MB cap                               | Split the document.                                                      |
| PDF/DOCX came back as a resource, not a file | Running over the remote `/mcp` transport (no local disk) | In stdio mode pass `savePath` to write to disk.                          |
| `save_document` updated instead of creating  | A same-named doc already exists in the project (upsert)  | Use a different `name`, or `save_file` for an explicit create.           |

The API key is a secret. Never print it or commit it. In MCP config use an env
var (`${MDTIDY_API_KEY}`), not the literal key.
