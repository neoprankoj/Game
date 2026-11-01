# ADR-0012 — Internal packages are consumed as TypeScript source (no per-package build)

| Field | Value |
|---|---|
| Status | Accepted (Part 2.1, within the scope approved at the S01 gate; revisit at 2.5) |
| Date | 2026-11-01 |
| Part | 2.1 |
| Owner approval needed | No: tooling detail inside ADR-0001/0002. Reported for visibility |

## Context
Workspace packages (`game-*`, `contracts`, `db`, …) are imported by three very different consumers:
- the Expo client, bundled by Metro;
- the Fastify API and the workers, running on Node 24;
- the test runner, Vitest (Vite).

A build step per package (emit `dist/` + type declarations) adds watch processes, project references and stale-output bugs. The question is how packages are resolved and compiled.

## Decision
- Every internal package exports its **TypeScript source** (`"exports": { ".": "./src/index.ts" }`), with no package-level `build` script. Turborepo's `build` task only runs where a script exists (the apps).
- Shared tsconfig: `"module": "ESNext"`, `"moduleResolution": "Bundler"`, `"verbatimModuleSyntax": true`, `"noEmit": true`. Relative imports are extensionless.
- `game-*` packages have a second tsconfig, `tsconfig.pure.json`: non-test source only, with `"types": []` and `lib: ES2023`. `process`, `console`, timers and other Node/DOM globals do not even type-check there, a third purity guard next to ESLint and dependency-cruiser. A separate config is needed because test files import Vitest, whose declarations pull Node's global types into the main program (found and verified in Part 2.1).
- Each **app** owns its build:
  - the client: Metro/Expo handles TS;
  - API and workers: bundled with a TS-aware bundler (or a TS runtime loader), decided and measured in Part 2.5, recorded as an update to this ADR.

## Alternatives
| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **Source packages + bundler resolution** | zero build steps for packages; instant feedback; one source of truth | Node cannot run the packages directly, so apps need a bundler or loader | **Chosen** |
| Compiled packages (`tsc -b`, project references, `dist/`) | apps can run plain Node; classic | build orchestration, stale `dist/` bugs, slower loop, declaration maps | Rejected for now; still possible per package later |
| `NodeNext` resolution with `.js` extensions everywhere | runs on Node with type stripping | every import needs an extension; Node refuses to type-strip files under `node_modules` (per Node docs; re-verify in 2.5); awkward for Metro | Rejected |

## Consequences
- Part 2.5 must choose and verify how `apps/api` runs and is deployed with source packages (candidates: an esbuild/tsup bundle for production; a TS loader for development). That choice updates this ADR.
- Vitest and Metro consume the source directly: no extra configuration.

## Verification
Part 2.1: `pnpm install && pnpm lint && pnpm typecheck && pnpm test` on a clean clone. A probe file using `process`, `console` and `setTimeout` in `game-core/src` fails `pnpm typecheck` (TS2591, TS2584, TS2304).
