# mdtidy — troubleshooting

| Symptom                                      | Cause                                                    | Fix                                                                      |
| -------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------ |
| `Missing API key` (401)                      | No key sent                                              | stdio: set `MDTIDY_API_KEY`. Remote: send `Authorization: Bearer <key>`. |
| `invalid_api_key` (401)                      | Bad/revoked key                                          | Create a new key at mdtidy.com/account/api-keys.                         |
| `out_of_credits` (402)                       | Wallet empty this period                                 | Top up / upgrade at mdtidy.com — don't blind-retry.                      |
| `rate_limited` (429)                         | >60 requests/min on one key                              | Back off and retry after `Retry-After`.                                  |
| `payload_too_large` (413)                    | Markdown over the 1 MB cap                               | Split the document.                                                      |
| PDF/DOCX came back as a resource, not a file | Running over the remote `/mcp` transport (no local disk) | In stdio mode pass `savePath` to write to disk.                          |
| `save_document` updated instead of creating  | A same-named doc already exists in the project (upsert)  | Use a different `name`, or `save_file` for an explicit create.           |

The API key is a secret. Never print it or commit it. In MCP config use an env
var (`${MDTIDY_API_KEY}`), not the literal key.
