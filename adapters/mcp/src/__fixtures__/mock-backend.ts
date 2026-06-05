// A stateful, in-memory stand-in for the mdtidy REST API (`/api/v1/*`), used by
// the real-world session tests. It tracks a credit balance and a tiny
// projects/files store so multi-step flows behave like the live API:
//   - renders / first-saves / shares debit credits; reads + updates are free,
//   - `save_document` create→update converges on a single file,
//   - draining credits returns a 402 (so the tool surfaces an isError result).
//
// Response shapes mirror the OpenAPI contract the typed client is generated from
// (cross-checked against the tool handlers in @mdtidy/tools). Inject
// `backend.fetch` as the `fetch` option of buildContext / createMcpRouteHandler.

export interface FileRec {
  id: string;
  name: string;
  version: number;
  etag: string;
  content: string;
  archived: boolean;
}

export interface ProjectRec {
  id: string;
  name: string;
  files: FileRec[];
  shareEnabled: boolean;
}

export interface MockBackend {
  /** Inject this as the `fetch` option. */
  fetch: typeof fetch;
  /** "METHOD /path" for every request, in order. */
  calls: string[];
  /** Current credit balance. */
  credits(): number;
  /** Current project/file store (for assertions). */
  projects(): ProjectRec[];
}

export interface MockBackendOptions {
  startingCredits?: number;
  /** Seed project names (each gets a generated id). Defaults to ["Drafts"]. */
  projectNames?: string[];
}

const PDF_BASE64 = 'JVBERi0xLjQK'; // "%PDF-1.4\n"

function tidied(markdown: string): string {
  // A stand-in for the Tidy pipeline: collapse blank runs + trim trailing space.
  return markdown
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function createMockBackend(opts: MockBackendOptions = {}): MockBackend {
  let credits = opts.startingCredits ?? 25;
  let counter = 0;
  // Deterministic, version-4/variant-8 UUIDs so tool input schemas (`.uuid()`)
  // accept the ids we hand back.
  const uuid = (): string => {
    counter += 1;
    return `00000000-0000-4000-8000-${counter.toString(16).padStart(12, '0')}`;
  };
  const projects: ProjectRec[] = (opts.projectNames ?? ['Drafts']).map((name) => ({
    id: uuid(),
    name,
    files: [],
    shareEnabled: false,
  }));
  const calls: string[] = [];

  const json = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  const apiError = (code: string, message: string, status: number): Response =>
    json({ error: { code, message, requestId: `req_${counter}` } }, status);
  const slug = (id: string): string => id.slice(-6);

  const fetchImpl: typeof fetch = async (input, init) => {
    const req = input instanceof Request ? input : new Request(input, init);
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method.toUpperCase();
    calls.push(`${method} ${path}`);
    const readBody = async (): Promise<any> => {
      try {
        return await req.json();
      } catch {
        return {};
      }
    };

    // --- convert (1 credit) ---------------------------------------------------
    if (method === 'POST' && path === '/api/v1/convert') {
      if (credits <= 0) return apiError('out_of_credits', 'No credits left this period.', 402);
      const body = await readBody();
      credits -= 1;
      const format = body.format ?? 'text';
      const rendered = format !== 'html' && format !== 'text';
      const base = {
        format,
        contentType: rendered ? 'application/pdf' : 'text/plain',
        byteSize: 12,
        designSystem: body.designSystem ?? 'minimal-clean',
        warnings: [{ rule: 'table_pipe_balance', fixes: 1 }],
        creditsCharged: 1,
        creditsRemaining: credits,
        requestId: `req_${counter}`,
      };
      return json(
        rendered
          ? { ...base, outputBase64: PDF_BASE64 }
          : { ...base, output: tidied(body.markdown ?? '') },
      );
    }

    // --- usage / entitlement (free) ------------------------------------------
    if (method === 'GET' && path === '/api/v1/usage') {
      return json({
        creditsRemaining: credits,
        subscriptionCredits: credits,
        topupCredits: 0,
        callsThisPeriod: calls.length,
      });
    }
    if (method === 'GET' && path === '/api/v1/credits') {
      return json({ plan: 'pro', credits_balance: credits, can_save: true, can_share: true });
    }

    // --- projects -------------------------------------------------------------
    if (method === 'GET' && path === '/api/v1/projects') {
      return json({
        scope: url.searchParams.get('scope') ?? 'mine',
        items: projects.map((p) => ({ id: p.id, name: p.name })),
      });
    }
    if (method === 'POST' && path === '/api/v1/projects') {
      const body = await readBody();
      const p: ProjectRec = {
        id: uuid(),
        name: body.name ?? 'Untitled',
        files: [],
        shareEnabled: false,
      };
      projects.push(p);
      return json({ id: p.id, name: p.name }, 201);
    }
    const projGet = /^\/api\/v1\/projects\/([^/]+)$/.exec(path);
    if (method === 'GET' && projGet) {
      const p = projects.find((x) => x.id === projGet[1]);
      if (!p) return apiError('not_found', 'No such project.', 404);
      return json({
        id: p.id,
        name: p.name,
        files: p.files.map((f) => ({
          id: f.id,
          name: f.name,
          version: f.version,
          etag: f.etag,
          archived: f.archived,
        })),
      });
    }

    // --- files ----------------------------------------------------------------
    if (method === 'POST' && path === '/api/v1/files') {
      const body = await readBody();
      const p = projects.find((x) => x.id === body.project_id);
      if (!p) return apiError('invalid_request', 'Unknown project_id.', 400);
      if (credits <= 0) return apiError('out_of_credits', 'No credits left this period.', 402);
      credits -= 1;
      const f: FileRec = {
        id: uuid(),
        name: body.name ?? 'Untitled',
        version: 1,
        etag: '"1"',
        content: body.content ?? '',
        archived: false,
      };
      p.files.push(f);
      return json(
        { id: f.id, name: f.name, version: f.version, etag: f.etag, credits_remaining: credits },
        201,
      );
    }
    const fileMatch = /^\/api\/v1\/files\/([^/]+)$/.exec(path);
    if (fileMatch) {
      const f = projects.flatMap((p) => p.files).find((x) => x.id === fileMatch[1]);
      if (!f) return apiError('not_found', 'No such file.', 404);
      if (method === 'GET') {
        return json({
          id: f.id,
          name: f.name,
          version: f.version,
          etag: f.etag,
          content: f.content,
        });
      }
      if (method === 'PATCH') {
        const body = await readBody();
        if (body.content != null) f.content = body.content;
        if (body.name != null) f.name = body.name;
        if (body.archived != null) f.archived = body.archived;
        f.version += 1;
        f.etag = `"${f.version}"`;
        return json({ id: f.id, name: f.name, version: f.version, etag: f.etag });
      }
    }

    // --- share ----------------------------------------------------------------
    const shareGet = /^\/api\/v1\/projects\/([^/]+)\/share$/.exec(path);
    if (method === 'GET' && shareGet) {
      const p = projects.find((x) => x.id === shareGet[1]);
      if (!p) return apiError('not_found', 'No such project.', 404);
      return json({
        enabled: p.shareEnabled,
        public_url: p.shareEnabled ? `https://mdtidy.com/p/${slug(p.id)}` : null,
      });
    }
    const sharePub = /^\/api\/v1\/projects\/([^/]+)\/share\/public$/.exec(path);
    if (method === 'POST' && sharePub) {
      const p = projects.find((x) => x.id === sharePub[1]);
      if (!p) return apiError('not_found', 'No such project.', 404);
      p.shareEnabled = true; // free within the slug grace (modeled as free here)
      const publicUrl = `https://mdtidy.com/p/${slug(p.id)}`;
      return json({
        enabled: true,
        public_url: publicUrl,
        project_url: publicUrl,
        slug: slug(p.id),
      });
    }

    return apiError('not_found', `No mock route for ${method} ${path}`, 404);
  };

  return {
    fetch: fetchImpl,
    calls,
    credits: () => credits,
    projects: () => projects,
  };
}
