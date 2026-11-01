// `pnpm api:spec` regenerates docs/architecture/api/openapi.json from the route contracts.
// The file is generated, never hand-edited; test/openapi.test.ts fails when it is stale.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { API_VERSION, buildOpenApiDocument, routes } from '../src';

export const SPEC_FILE = fileURLToPath(
  new URL('../../../docs/architecture/api/openapi.json', import.meta.url),
);
export const renderSpec = (): string =>
  `${JSON.stringify(buildOpenApiDocument(routes, API_VERSION), null, 2)}\n`;

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  writeFileSync(SPEC_FILE, renderSpec());
  console.log(`✔ wrote ${SPEC_FILE}`);
}
