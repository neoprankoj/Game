# ADR-0002 — Language, runtime and core toolchain versions

| Field | Value |
|---|---|
| Status | Proposed |
| Date | 2026-10-31 |
| Part | 1.1 |
| Owner approval needed | **Yes, one flag:** TypeScript stays on **6.0.x**, not the npm `latest` (7.0). See "Decision". |

## Context
`CLAUDE.md` §5 fixes TypeScript (strict) everywhere, Zod for contracts, Vitest and Playwright for tests. It also says to check current stable versions instead of relying on memory. These are cross-cutting choices, so they get one ADR.

**Verified facts (npm registry, nodejs.org dist index, 2026-10-31):**

| Item | Finding |
|---|---|
| `typescript` | `latest` = **7.0.2** (2026-07-08). This is the native (Go) compiler line. **6.0.3** is the newest 6.x. `7.1.0-beta` exists. |
| `typescript-eslint` 8.72.1 | peer `typescript: ">=4.8.4 <6.1.0"`, so it does **not** support TypeScript 7 |
| Expo default template (`expo-template-default@sdk-58`) | devDependency `typescript: "~6.0.3"` |
| Node.js | v26.13.0 is LTS "Lithium" (it just entered LTS). v24.22.2 is LTS "Krypton". v22 is LTS "Jod" (maintenance). |
| Engine ranges | `expo@58` needs `^22.13 \|\| ^24.3 \|\| ^26 \|\| >=27`. `vitest@5` needs `^22.12 \|\| ^24 \|\| >=26`. `@nestjs/core@12` needs `>=20`. `@prisma/client@7` needs `^20.19 \|\| ^22.12 \|\| >=24`. |
| `zod` | 4.6.7 |
| `vitest` | 5.0.5 (peer `vite ^6.4 \|\| ^7 \|\| ^8`) |
| `@playwright/test` | 1.64.1 |

## Decision
| Tool | Version line | Why |
|---|---|---|
| **TypeScript** | **~6.0.3**, `strict: true`, plus `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` | typescript-eslint (our linter) and the Expo SDK 58 template both target 6.0. TS 7 would break type-aware linting today. |
| **Node.js** | **24 LTS** (runtime and CI), pinned in `.nvmrc` and `engines` | Supported by every chosen library. In LTS for over a year, with maintenance through April 2028. Hosting images and EAS support it widely. Node 26 went LTS only days ago. |
| **Zod** | 4.x | Contracts, game-data validation, and env/config validation |
| **Vitest** | 5.x | Unit, domain and DB-integration tests |
| **Playwright** | 1.6x | Web E2E (Part 2.9 onward). Chromium is the baseline browser. |
| **ESLint** | flat config + typescript-eslint 8.x | Includes `no-restricted-properties` / `no-restricted-globals` for `Date.now`, `Math.random` and `new Date()` inside `game-*` (`CLAUDE.md` §8). |
| **Prettier** | latest 3.x | Formatting only; no style debates |

## Alternatives
| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **TypeScript 6.0.x** | Supported by typescript-eslint and the Expo template | Misses TS 7 compile-speed gains | **Chosen** |
| TypeScript 7.0 (`latest`) | Roughly 10× faster type checking | Type-aware lint rules unsupported (peer `<6.1`); RN/Expo tooling targets 6.0 | Rejected **for now** |
| TS 6.0 for lint/build plus the TS 7 native preview for `typecheck` only | Fast CI type checks | Two compilers with possibly different diagnostics | Optional optimisation in Part 2.9 if type checking gets slow |
| Node 26 LTS | Newest LTS, longest support window | Entered LTS days ago; platform images and native-module prebuilds may lag | Revisit in mid-2027 |
| Node 22 LTS | Most widely deployed | Already in maintenance; end of life April 2027 | Rejected: too short a runway |
| Jest instead of Vitest | Mature | Slower; weaker ESM/TS support | Rejected; Vitest is the directive's choice |

## Trade-offs
- Staying on TS 6.0 costs compile speed and keeps us one major behind. Microsoft announced 6.0 as the last JavaScript-based release and the bridge to 7, so code written for 6.0 strict should move to 7 with little change. *(Assumption from prior knowledge, not re-verified in this session.)*
- Node 24 rather than 26 means one more major upgrade later (about 2027–28), in exchange for fewer surprises now.

## Consequences
- `packages/config` holds the shared `tsconfig.base.json`, ESLint flat config and Vitest presets (Part 2.1).
- **Revisit TypeScript when** a typescript-eslint release declares support for `typescript >=7`. The upgrade is then a single Part with a CI run.
- **Revisit Node when** Expo, Railway and our native dependencies officially list Node 26, or in Q3 2027, whichever comes first.

## Verification
Part 2.1: `pnpm turbo run typecheck lint` passes on an empty scaffold with Node 24 and TS 6.0.x. A lint test proves that `Date.now()` inside `packages/game-economy` is rejected.
