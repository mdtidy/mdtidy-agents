// The curated tool catalog — the single source of truth for which API
// operations become agent tools, and how they're described. Both the registry
// (packages/tools/src/registry.ts) and the docs generator
// (scripts/generate.ts → docs/tools.md) read this, so the published tools and
// the docs can never drift. Spec §3.4.

export type ToolGroup = 'Convert' | 'Read' | 'Write' | 'Share';

export interface CatalogEntry {
  /** MCP tool name (snake_case, agent-facing). */
  name: string;
  group: ToolGroup;
  /** Underlying API operation(s). An array means a composite tool. */
  operationId: string | string[];
  /** Credit cost shown to agents: 0 = free, 1 = one credit, '1/0' = create vs update. */
  cost: 0 | 1 | '1/0';
  title: string;
  description: string;
}

export const TOOL_CATALOG: CatalogEntry[] = [
  {
    name: 'tidy_markdown',
    group: 'Convert',
    operationId: 'convert',
    cost: 1,
    title: 'Tidy & convert Markdown',
    description:
      'Clean and repair messy AI-generated Markdown and render it to HTML, plain text, PDF, DOCX, or PNG. ' +
      'Choose a design system (minimal-clean, executive-report, developer-docs) and optional page geometry. ' +
      'Costs 1 credit per successful render (auto-refunded on failure); returns the cleanup fixes applied and the remaining balance.',
  },
  {
    name: 'check_usage',
    group: 'Read',
    operationId: 'usage',
    cost: 0,
    title: 'Check credit usage',
    description:
      "Return the caller's credit balance and recent API calls. Free — call it before a batch of conversions.",
  },
  {
    name: 'get_entitlement',
    group: 'Read',
    operationId: 'credits',
    cost: 0,
    title: 'Get plan entitlement',
    description: "Return the caller's plan and workspace gates (can_save / can_share). Free.",
  },
  {
    name: 'list_projects',
    group: 'Read',
    operationId: 'listProjects',
    cost: 0,
    title: 'List projects',
    description:
      "List the caller's projects. scope: mine | shared | archived (default mine). Free.",
  },
  {
    name: 'get_project',
    group: 'Read',
    operationId: 'getProject',
    cost: 0,
    title: 'Get a project',
    description: 'Return a project together with its folders and files. Free.',
  },
  {
    name: 'get_file',
    group: 'Read',
    operationId: 'getFile',
    cost: 0,
    title: 'Read a file',
    description: "Return a saved file's Markdown content plus its version/ETag. Free.",
  },
  {
    name: 'create_project',
    group: 'Write',
    operationId: 'createProject',
    cost: 0,
    title: 'Create a project',
    description: 'Create a workspace project (a container for files). Free.',
  },
  {
    name: 'create_folder',
    group: 'Write',
    operationId: 'createFolder',
    cost: 0,
    title: 'Create a folder',
    description:
      'Create a folder inside a project to organize files. Optionally nest it under a ' +
      'parent folder. Returns the folder id — pass it as folder_id to save_file / ' +
      'update_file. Free.',
  },
  {
    name: 'update_folder',
    group: 'Write',
    operationId: 'updateFolder',
    cost: 0,
    title: 'Rename a folder',
    description: 'Rename an existing folder. Free.',
  },
  {
    name: 'delete_folder',
    group: 'Write',
    operationId: 'deleteFolder',
    cost: 0,
    title: 'Delete a folder',
    description:
      'Delete a folder. Returns 409 if it still holds active files (move or archive them ' +
      'first); archived files fall back to the project root. Free.',
  },
  {
    name: 'save_document',
    group: 'Write',
    operationId: ['listProjects', 'createProject', 'getProject', 'createFile', 'updateFile'],
    cost: '1/0',
    title: 'Save a document (upsert)',
    description:
      'Fast path — save Markdown in one step. Finds or creates the target project (default "Drafts") and ' +
      'creates the file, or updates it if a same-named document already exists. 1 credit on create, 0 on update. ' +
      'Returns the file id, project, and a link. Use this to start fast; use the granular tools for structured workspaces.',
  },
  {
    name: 'save_file',
    group: 'Write',
    operationId: 'createFile',
    cost: 1,
    title: 'Create a file',
    description:
      'First-save a Markdown file into a known project (idempotent via an idempotency key). 1 credit.',
  },
  {
    name: 'update_file',
    group: 'Write',
    operationId: 'updateFile',
    cost: 0,
    title: 'Update a file',
    description:
      'Autosave, rename, or move a file. Content writes use If-Match for safe concurrent edits. Free.',
  },
  {
    name: 'get_project_share',
    group: 'Share',
    operationId: 'getProjectShare',
    cost: 0,
    title: 'Get share state',
    description: "Return a project's current share state and public URL. Free.",
  },
  {
    name: 'share_project_public',
    group: 'Share',
    operationId: 'enableProjectPublicLink',
    cost: 1,
    title: 'Share a project publicly',
    description:
      "Turn on a project's public link and return https://mdtidy.com/p/{slug}. 1 credit (free within the 30-day slug grace).",
  },
];

/** Look up the curated name/title/description/cost for a tool, so a tool
 *  definition and the docs never drift. */
export function catalogMeta(
  name: string,
): Pick<CatalogEntry, 'name' | 'title' | 'description' | 'cost'> {
  const entry = TOOL_CATALOG.find((t) => t.name === name);
  if (!entry) throw new Error(`No catalog entry for tool "${name}"`);
  return { name: entry.name, title: entry.title, description: entry.description, cost: entry.cost };
}

/** Generated + tested but intentionally not exposed in v1 (spec §3.4). One
 *  registry entry enables any of these later. */
export const DEFERRED_TOOLS: { name: string; operationId: string }[] = [
  { name: 'update_project', operationId: 'updateProject' },
  { name: 'delete_project', operationId: 'deleteProject' },
  { name: 'delete_file', operationId: 'deleteFile' },
  { name: 'copy_file', operationId: 'copyFile' },
  { name: 'regenerate_public_link', operationId: 'regenerateProjectPublicLink' },
  { name: 'invite_viewers', operationId: 'inviteProjectViewers' },
  { name: 'remove_invitee', operationId: 'removeProjectInvitee' },
  { name: 'make_project_private', operationId: 'makeProjectPrivate' },
  { name: 'disable_public_link', operationId: 'disableProjectPublicLink' },
];
