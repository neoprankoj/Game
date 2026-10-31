# ADR-0001 — Monorepo tooling: pnpm workspaces + Turborepo

| Field | Value |
|---|---|
| Status | Proposed |
| Date | 2026-10-31 |
| Part | 1.1 |
| Owner approval needed | No deviation from `CLAUDE.md` §5. Approval as part of the S01 gate. |

## Context
- One repository holds the Expo client, the Fastify API, the workers and about 11 internal packages (`CLAUDE.md` §6).
- `game-*` packages must stay pure, and nothing may import "upwards" from `apps/*`. Circular dependencies are forbidden and must be **lint-enforced** (source plan IV.3; Part 2.1).
- A solo developer needs fast, cached builds and tests, and as little tooling configuration as possible.
- The Expo client must work inside the monorepo.

**Verified facts (npm registry and docs, 2026-10-31):**
- `pnpm` latest is **12.16.1** (released 2026-10-27). The `latest-10` and `latest-11` lines are still published.
- `turbo` latest is **2.11.10** (released 2026-10-20).
- `nx` latest is 24.0.3.
- Expo docs ("Work with monorepos") say: "Expo configures Metro automatically for monorepos" (SDK 52+). "From SDK 54, Expo supports isolated dependencies and isolated installations." pnpm has "first-class support for isolated installs", with `nodeLinker: hoisted` as the documented fallback. "Duplicate React Native versions in a single monorepo are not supported."
- `eslint-plugin-boundaries` 7.4.0 and `dependency-cruiser` 18.7.0 are both maintained (published October 2026).

## Decision
- **pnpm workspaces**, pinned with the `packageManager` field to the **12.x** line current at Part 2.1. A `pnpm-workspace.yaml` lists `apps/*` and `packages/*`.
- **Turborepo 2.x** runs the task graph and local caching: `build`, `typecheck`, `lint`, `test`. Remote cache is off for now; Vercel's free remote cache can be added later with no code changes.
- **Boundary enforcement** uses `dependency-cruiser`, run in CI. It enforces the rules from `CLAUDE.md` §6:
  - `packages/game-*` may import only `game-core`, `game-data` and lower-layer `game-*` packages, as layered in SYSTEM_ARCHITECTURE §3.2. *(Tightened by ADR-0011: `contracts` is no longer allowed.)* They may never import `db`, `contracts`, `apps/*`, Node I/O modules, `Date.now` or `Math.random` (the last two are checked by an ESLint `no-restricted-properties` rule).
  - `packages/*` never import `apps/*`.
  - No circular dependencies anywhere.
  `eslint-plugin-boundaries` was considered as well. dependency-cruiser is chosen because it checks the real resolved import graph, including cycles, independently of ESLint's parser.
- Exactly **one** `react-native` version in the repo. A pnpm `overrides` guard or a CI check enforces this.

## Alternatives
| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **pnpm + Turborepo** | Simple; fast installs; content-addressed store; Turbo needs one small `turbo.json`; Expo documents pnpm support | Two tools instead of one | **Chosen** |
| Nx 24 | Very powerful: generators, affected graph, built-in module-boundary rules | Heavy configuration and plugin ecosystem; more concepts than a solo developer needs; Expo plugin adds another moving part | Rejected: too much ceremony |
| pnpm workspaces only (`pnpm -r`) | Fewest tools | No task caching; slower CI as the repo grows | Rejected: Turbo's cost is about 20 lines of config |
| npm / Yarn 4 workspaces | Familiar | npm is slower with weaker isolation; Yarn PnP has known React Native/Metro friction | Rejected |

## Trade-offs
- pnpm's isolated `node_modules` catches undeclared dependencies, which is good for boundaries. Some React Native libraries still assume hoisting. The escape hatch is `nodeLinker: hoisted`, applied to the whole workspace if needed. That costs a little strictness, and the dependency-cruiser rules still hold.
- pnpm 12 is a very recent major version. If Expo/Metro or EAS Build has problems with it in Part 2.1, we drop to the newest **pnpm 11.x** and record that here.

## Consequences
- Part 2.1 creates `pnpm-workspace.yaml`, `turbo.json`, `.dependency-cruiser.cjs` and shared configs in `packages/config`.
- CI (Part 2.9) runs `turbo run lint typecheck test` and `depcruise` on every push.
- **Revisit when** Turbo or pnpm stop being maintained, or when we need code generators or distributed task execution (unlikely for a solo project).

## Verification
In Part 2.1: a fresh clone runs `pnpm install && pnpm turbo run build test` on CI. A deliberately wrong import, such as `game-combat` → `db`, fails `depcruise`. The Expo web build resolves workspace packages.
