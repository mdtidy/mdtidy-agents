// Refresh contract/openapi.json from the live mdtidy contract.
//
// The contract is the ONLY thing that crosses from the closed mdtidy service
// into this repo (spec §2). `contract-sync.yml` runs this on a schedule and
// opens a drift PR when the regenerated output changes.

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const CONTRACT_URL = process.env.MDTIDY_OPENAPI_URL ?? 'https://www.mdtidy.com/openapi.json';
const OUT = resolve(import.meta.dirname, '../contract/openapi.json');

const res = await fetch(CONTRACT_URL);
if (!res.ok) {
  throw new Error(`Failed to fetch ${CONTRACT_URL}: ${res.status} ${res.statusText}`);
}
const doc = await res.json();
if (doc.openapi !== '3.1.0') {
  throw new Error(`Unexpected OpenAPI version: ${doc.openapi}`);
}
writeFileSync(OUT, JSON.stringify(doc, null, 2) + '\n');
console.log(`Wrote ${OUT} (${doc.info?.title} ${doc.info?.version})`);
