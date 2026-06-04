import { defineConfig } from 'tsup';

// Bundle the package into a single publishable artifact. The internal
// `@mdtidy/*` workspace packages are inlined (noExternal) so the published
// package.json has no `workspace:*` deps; the real runtime deps (the MCP SDK,
// zod) stay external. The stdio `bin` keeps its shebang from src/bin.ts.
export default defineConfig({
  entry: ['src/index.ts', 'src/bin.ts', 'src/http.ts'],
  format: ['esm'],
  target: 'node20',
  dts: true,
  clean: true,
  sourcemap: true,
  noExternal: [/^@mdtidy\//],
});
