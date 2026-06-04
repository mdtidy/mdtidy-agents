// CI drift gate (spec §3.6 / §5.1): regenerate in memory and assert the
// committed files match. Fails the build if `pnpm generate` was not re-run
// after a contract change.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { buildOutputs } from './generate.ts';

const ROOT = resolve(import.meta.dirname, '..');
const outputs = await buildOutputs();

let drift = false;
for (const [rel, expected] of Object.entries(outputs)) {
  let actual = '';
  try {
    actual = readFileSync(resolve(ROOT, rel), 'utf8');
  } catch {
    actual = '';
  }
  if (actual !== expected) {
    drift = true;
    console.error(`DRIFT: ${rel}`);
  }
}

if (drift) {
  console.error('\nGenerated files are out of date. Run `pnpm generate` and commit the result.');
  process.exit(1);
}
console.log('Generated files are up to date.');
