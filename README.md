# Chronos Cradle: Temporal Empires

A persistent, shared-universe, cross-platform grand-strategy game where **time is the central strategic resource**.
One Expo client (web, iOS, Android), a Fastify API and BullMQ workers over PostgreSQL. See `docs/` for the full design.

> Status: **S02 — Technical Foundation** in progress. The current Part is in [`docs/PROGRESS.md`](docs/PROGRESS.md).

## Prerequisites

| Tool | Version | Why |
|---|---|---|
| Node.js | **24 LTS** (`.nvmrc`) | runtime baseline (ADR-0002); `pnpm install` refuses other majors (`engineStrict`) |
| pnpm | **12.16.1** (`packageManager` field) | workspace package manager (ADR-0001) |
| Docker | any recent | local PostgreSQL + Redis (from Part 2.2) |

```bash
nvm use                         # or install Node 24 another way
corepack enable                 # makes the pinned pnpm version available
pnpm install
```

## Everyday commands

| Command | What it does |
|---|---|
| `pnpm lint` | ESLint in every workspace (strict type-aware rules, purity rules for `game-*`) **and** dependency-cruiser (import boundaries, layering, no cycles) |
| `pnpm typecheck` | `tsc --noEmit` in every workspace (TypeScript 6.0, strict) |
| `pnpm test` | Vitest in every workspace |
| `pnpm build` | builds apps (none yet; packages are consumed as TypeScript source, ADR-0012) |
| `pnpm format` / `pnpm format:check` | Prettier for code and config (docs are hand-formatted) |

All tasks run through Turborepo (`turbo.json`) with local caching.

## Repository layout

```
apps/        deployable apps: client (2.7), api (2.5), workers (2.6)       — created by their Parts
packages/    config (tooling) · game-core (pure primitives) · …            — more packages arrive with their Parts
tools/       developer/owner CLIs: sim, worldgen, admin, replay            — created by their Parts
docs/        directive, architecture, decisions (ADRs), PROGRESS
```

**Dependency rules** (`CLAUDE.md` §6, ADR-0011; enforced by `pnpm lint`):
- `packages/game-*` are pure: no Node built-ins, clock, randomness, timers, environment or infrastructure packages;
- packages never import apps; apps never import each other;
- the pure packages follow a fixed layering (SYSTEM_ARCHITECTURE §3.2);
- no circular dependencies.

Shared versions live in the `catalog:` of `pnpm-workspace.yaml`: one exact version per tool across all workspaces.

## Working on this project

Development follows the directive in [`CLAUDE.md`](CLAUDE.md): one **Part** at a time (plan → build → test → document → report), tracked in [`docs/PROGRESS.md`](docs/PROGRESS.md). Read these first:
- [`docs/architecture/SYSTEM_ARCHITECTURE.md`](docs/architecture/SYSTEM_ARCHITECTURE.md): how the system fits together;
- [`docs/architecture/GAME_SIMULATION_SPEC.md`](docs/architecture/GAME_SIMULATION_SPEC.md): every gameplay formula;
- [`docs/architecture/DOMAINS.md`](docs/architecture/DOMAINS.md): which domain owns what;
- [`docs/decisions/`](docs/decisions/): architecture decision records.
