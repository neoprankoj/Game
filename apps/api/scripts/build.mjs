// Production build (ADR-0012): see packages/config/build/bundle-app.mjs.
import { fileURLToPath } from 'node:url';
import { bundleApp } from '@chronos/config/build';

await bundleApp(fileURLToPath(new URL('..', import.meta.url)));
