# Chronos Cradle: Temporal Empires

A persistent, shared-universe, cross-platform grand-strategy game where **time is the central strategic resource**.
One Expo client (web, iOS, Android), a Fastify API and BullMQ workers over PostgreSQL. See `docs/` for the full design.

> Status: **S02 — Technical Foundation** in progress. The current Part is in [`docs/PROGRESS.md`](docs/PROGRESS.md).

## Prerequisites

| Tool | Version | Why |
|---|---|---|
| Node.js | **24 LTS** (`.nvmrc`) | runtime baseline (ADR-0002); `pnpm install` refuses other majors (`engineStrict`) |
| pnpm | **12.16.1** (`packageManager` field) | workspace package manager (ADR-0001) |
| Docker with Compose v2 | any recent | local PostgreSQL + Redis (`pnpm dev:up`) |

## First-time setup (fresh machine)

```bash
git clone <repository-url> chronos-cradle && cd chronos-cradle
nvm install && nvm use          # Node 24 from .nvmrc (or install Node 24 another way)
corepack enable                 # provides the pinned pnpm version (packageManager field)
pnpm install                    # install all workspaces
cp .env.example .env            # local-development settings (placeholders only; see comments inside)
pnpm dev:up                     # start PostgreSQL 18 + Redis 8 in Docker and verify them
pnpm lint && pnpm typecheck && pnpm test
```

`pnpm dev:up` waits until both services are healthy, then checks that they are configured as the game requires (UTC, test database, `uuidv7()`, Redis `noeviction` + persistence + password). It prints the connection strings, with passwords masked.

## Local services (Docker)

| Command | What it does |
|---|---|
| `pnpm dev:up` | start (or keep running) PostgreSQL and Redis, then verify them |
| `pnpm dev:status` | verify the running services without changing anything |
| `pnpm dev:down` | stop the services; **data is kept** |
| `pnpm dev:reset` | **delete all local data** (both volumes) and start fresh |

| Service | Image | Host address | Notes |
|---|---|---|---|
| PostgreSQL | `postgres:18.6` | `127.0.0.1:55432` | databases `chronos` (dev) and `chronos_test` (tests); timezone UTC |
| Redis | `redis:8.10.3` | `127.0.0.1:56379` | password required; `noeviction`; AOF persistence |

Ports are bound to the loopback interface only. If a port is taken, change `POSTGRES_PORT` / `REDIS_PORT` **and** the matching URLs in `.env`. Details: [`infrastructure/README.md`](infrastructure/README.md).

**Troubleshooting:**
- *"Docker daemon is not running"*: start Docker Desktop or the Docker service.
- *".env is missing variables"*: a newer version added settings; copy the listed lines from `.env.example`.
- *Unhealthy service*: run `docker compose -f infrastructure/docker-compose.yml logs postgres` (or `redis`).

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
infrastructure/  local Docker Compose stack + dev script (production is managed hosting, ADR-0009)
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
