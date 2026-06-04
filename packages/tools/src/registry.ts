import { checkUsage, getEntitlement, getFile, getProject, listProjects } from './tools/read';
import { getProjectShare, shareProjectPublic } from './tools/share';
import { tidyMarkdown } from './tools/tidy-markdown';
import { createProject, saveDocument, saveFile, updateFile } from './tools/write';
import type { ToolDef } from './types';

// The v1 curated tool surface (spec §3.4). Order = how they appear in
// `tools/list`: the flagship convert first, then read, write (save_document
// leads the write group as the fast path), then share.
export const REGISTRY: ToolDef[] = [
  tidyMarkdown,
  checkUsage,
  getEntitlement,
  listProjects,
  getProject,
  getFile,
  createProject,
  saveDocument,
  saveFile,
  updateFile,
  getProjectShare,
  shareProjectPublic,
];

export function getTool(name: string): ToolDef | undefined {
  return REGISTRY.find((t) => t.name === name);
}
