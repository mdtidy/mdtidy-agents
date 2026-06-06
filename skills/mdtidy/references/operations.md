# mdtidy — complete operation reference

Every mdtidy operation, as an MCP tool and the underlying REST endpoint. Base URL
`https://mdtidy.com`. Authenticate with the **`X-API-KEY`** header (never
`Authorization: Bearer`). Costs: **free** = 0 credits; renders, first-saves, and
public shares cost 1 credit (failures are auto-refunded). When the MCP tools are
present, call them by name; otherwise call the REST endpoint with the same intent.

## Save & organize

### `save_document` — one-step save (upsert) · 1 create / 0 update

Save Markdown in a single call. Finds or creates the target project (default
`Drafts`), then creates the file — or updates it in place if a same-named doc
already exists, so it never duplicates.

- Params: `content` (required), `name?` (defaults to the first H1, else
  "Untitled"), `project?` (project id, or a name to find-or-create; default
  `Drafts`), `idempotencyKey?`.
- Returns: file id, project, version/etag, edit URL, and a `created` flag.
- REST: a composite of `list_projects` / `create_project` / `get_project` /
  `save_file` / `update_file` — prefer the tool.

### `create_project` — new project · free

Create a workspace project (a container for files).

- Params: `name` (required), `description?`.
- REST: `POST /api/v1/projects`.

### `create_folder` — new folder in a project · free

Create a folder to organize files inside a project. Returns the folder `id` —
pass it as `folder_id` to `save_file` / `update_file`. To find an existing
folder's id first, read the project with `get_project` (it returns `folders`).

- Params: `project_id` (required), `name` (required), `parent_folder_id?` (nest
  under another folder; omit for the project root).
- REST: `POST /api/v1/projects/{id}/folders`.

### `update_folder` — rename a folder · free

Rename an existing folder.

- Params: `id` (required), `name` (required).
- REST: `PATCH /api/v1/folders/{id}`.

### `delete_folder` — remove a folder · free

Delete a folder. **409** if it still holds active files (move or archive them
first); archived files fall back to the project root.

- Params: `id` (required).
- REST: `DELETE /api/v1/folders/{id}`.

### `save_file` — first-save into a known project · 1 credit

Create a Markdown file inside a project (idempotent via an idempotency key).

- Params: `project_id`, `name`, `content`, `folder_id?`, `idempotencyKey?`.
- REST: `POST /api/v1/files`.

### `update_file` — autosave / rename / move / archive · free

Update a file's content or metadata. Content writes carry the file `version` for
safe concurrent edits (pass it as `ifMatch`).

- Params: `id`, `content?`, `name?`, `folder_id?`, `archived?`, `ifMatch?`.
- REST: `PATCH /api/v1/files/{id}`.

## Share

### `share_project_public` — turn on a public link · 1 credit

Enable a project's public link and return `https://mdtidy.com/p/{slug}` (free
within the 30-day slug grace).

- Params: `id`, `idempotencyKey?`.
- REST: `POST /api/v1/projects/{id}/share/public`.

### `get_project_share` — read share state · free

Return a project's current share state and public URL.

- Params: `id`.
- REST: `GET /api/v1/projects/{id}/share`.

## Export & clean

### `tidy_markdown` — clean & render · 1 credit (refunded on failure)

Clean and repair the Markdown, then render it.

- Params: `markdown` (required); `format` ∈ `html | text | pdf | docx | png`
  (default `text`); `designSystem` ∈ `minimal-clean | executive-report |
developer-docs`; `page?` (`paperSize` / `orientation` / `marginPreset` /
  `fontScale`); `tidy?` (`enable` / `polish`, both default `true`).
- Returns: `output` (for `html` / `text`) or `outputBase64` (for `pdf` / `docx` /
  `png`), `warnings` (the cleanup fixes applied), `creditsCharged`,
  `creditsRemaining`.
- REST: `POST /api/v1/convert`.

## Read & inspect

### `check_usage` — credit balance + recent calls · free

Returns `creditsRemaining` (subscription + top-up split) and calls this period.
Call before a batch so a run does not stop mid-task.

- REST: `GET /api/v1/usage`.

### `get_entitlement` — plan + workspace gates · free

Returns `plan`, `credits_balance`, `can_save`, `can_share`.

- REST: `GET /api/v1/credits`.

### `list_projects` — list projects · free

- Params: `scope?` ∈ `mine | shared | archived` (default `mine`).
- REST: `GET /api/v1/projects`.

### `get_project` — a project with its folders + files · free

- Params: `id`, `includeArchived?`.
- REST: `GET /api/v1/projects/{id}`.

### `get_file` — a saved file's content + version/ETag · free

- Params: `id`.
- REST: `GET /api/v1/files/{id}`.

## Choosing a write path

- For "save this," prefer **`save_document`** — one call, no duplicates.
- Use the granular **`create_project`** / **`save_file`** / **`update_file`** when
  building a structured workspace or editing a known file id.
- Credit cost surfaces in each render/save response (`creditsCharged`,
  `creditsRemaining`); on a `402 out_of_credits`, ask the user to top up.
