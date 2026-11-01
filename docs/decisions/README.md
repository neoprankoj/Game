# Architecture Decision Records

Each ADR follows `ADR-0000-template.md`. Status values: **Proposed** → **Accepted** (after owner approval) → **Superseded/Deprecated**.
ADR-0001…0010 were produced in Part 1.1 and ADR-0011 in Part 1.2. **All were accepted by the owner at the S01 gate on 2026-11-01.** ADR-0012 (Part 2.1) and ADR-0013 (Part 2.4) refine that scope.

| ADR | Decision | Status | Owner action |
|---|---|---|---|
| [0001](ADR-0001-monorepo-tooling.md) | pnpm workspaces + Turborepo; dependency-cruiser enforces boundaries | Accepted | — |
| [0002](ADR-0002-language-runtime-toolchain.md) | TypeScript **6.0.x** (not 7.0), Node **24 LTS**, Zod 4, Vitest 5, Playwright | Accepted | approved (O-4) |
| [0003](ADR-0003-client-expo-single-codebase.md) | One Expo SDK 58 app (Expo Router) for web, iOS, Android | Accepted | — |
| [0004](ADR-0004-map-rendering.md) | React Native Skia everywhere behind a renderer boundary; PixiJS web fallback; spike at the start of 7.6 | Accepted (renderer confirmed by 7.6 spike) | Note: final web renderer is decided by measurement |
| [0005](ADR-0005-backend-framework.md) | Fastify 5 modular monolith; Zod type provider; `@fastify/websocket` | Accepted | — |
| [0006](ADR-0006-database-and-access-layer.md) | PostgreSQL 18 + Drizzle + `pg`; `bigint` resources; `FOR NO KEY UPDATE` lock conventions | Accepted | approved (O-5) |
| [0007](ADR-0007-authentication.md) | Better Auth 1.7 with Drizzle adapter, DB sessions, `auth` schema | Accepted | email + password (O-6) |
| [0008](ADR-0008-queue-and-redis.md) | BullMQ 6 on Redis (Railway), behind a `JobScheduler` port | Accepted | Note: BullMQ Postgres backend option |
| [0009](ADR-0009-hosting-platform.md) | Railway (api, workers, redis, web) + Neon (Postgres), same region; cost estimates | Accepted | providers approved (O-1); region O-2 and budget O-3 pending |
| [0010](ADR-0010-error-tracking-and-logging.md) | Sentry + pino with mandatory redaction | Accepted | — |
| [0011](ADR-0011-package-structure-refinements.md) | Adds `game-core`, `application`, `tools/` to the §6 layout; `game-*` may not import `contracts` | Accepted | approved (O-7) |
| [0012](ADR-0012-internal-packages-as-source.md) | Internal packages consumed as TypeScript source (bundler resolution); apps own their build (API strategy in 2.5); `tsconfig.pure.json` type-level purity for `game-*` | Accepted (Part 2.1) | — |
| [0013](ADR-0013-route-contracts-and-openapi.md) | Route contracts in `@chronos/contracts` are the single API source; OpenAPI 3.1 generated from them (`pnpm api:spec`, freshness-tested) | Accepted (Part 2.4) | — |

## Version snapshot (checked on the npm registry / nodejs.org on 2026-10-31)

Versions are **recorded here, not installed**. Part 2.1 re-checks them and installs with exact pins. Anything newer than this table at install time is reviewed, not taken blindly.

| Package / runtime | Version | Notes |
|---|---|---|
| Node.js | 24.22.2 (LTS "Krypton") | 26.13.0 is LTS "Lithium" (newly LTS); 22.x LTS "Jod" is in maintenance |
| pnpm | 12.16.1 | fallback: newest 11.x |
| turbo | 2.11.10 | |
| typescript | **6.0.3** | npm `latest` is 7.0.2 — not used (typescript-eslint peer `<6.1.0`; Expo SDK 58 template uses `~6.0.3`) |
| typescript-eslint | 8.72.1 | |
| dependency-cruiser | 18.7.0 | |
| zod | 4.6.7 | |
| vitest | 5.0.5 | |
| @playwright/test | 1.64.1 | |
| expo (SDK 58) | 58.0.22 | pins react-native 0.88.1, react 19.3.0, react-native-web ~0.21.4, reanimated 4.7.1 |
| expo-router | 58.0.29 | |
| expo-notifications | 58.1.7 | |
| @shopify/react-native-skia | 2.14.0 | SDK 58 pin; web via CanvasKit (~2.9 MB gz) |
| pixi.js (fallback only) | 8.22.0 | |
| fastify | 5.12.7 | 6.0 in alpha |
| @fastify/websocket | 11.3.6 | |
| @fastify/rate-limit · cors · helmet | 11.2.1 · 11.3.1 · 13.2.0 | |
| fastify-type-provider-zod | 7.0.0 | community plugin |
| PostgreSQL | 18 | 19 GA planned 2026-11-19 |
| drizzle-orm · drizzle-kit | 0.45.4 · 0.31.11 | 1.0.0-rc.5 available; see ADR-0006 rule |
| pg | 8.23.1 | |
| better-auth · @better-auth/expo | 1.7.14 · 1.7.14 | |
| bullmq | 6.5.3 | Redis backend; Postgres backend available since 6.0 |
| ioredis | 6.0.0 | exact version chosen in 2.6 from BullMQ's tested range |
| Redis (server) | 8.x (or Valkey) | `maxmemory-policy noeviction` |
| @sentry/node · @sentry/react-native | 11.10.0 · 8.33.0 | |
| pino | 10.4.0 | |

## Deviations from `CLAUDE.md` §5 (all flagged for owner approval)
1. **TypeScript pinned to 6.0.x** although `latest` is 7.0 (ADR-0002). This doesn't change §5 ("TypeScript strict"); it constrains the version.
2. **Two hosting providers** (Railway + Neon) rather than literally "one platform" (ADR-0009). §5's own example pairs Fly + Neon.
3. **Drizzle version decided at Part 2.3** by a fixed rule (ADR-0006).
4. **Additions** not listed in §5, each with a one-line reason: Node 24 LTS (runtime baseline), `pg` driver (shared by Drizzle, Better Auth and BullMQ), dependency-cruiser (lint-enforced boundaries required by source plan IV.3), `fastify-type-provider-zod` (Zod → validation + OpenAPI), Prettier (formatting).

No other deviation: Expo single codebase, Skia (with spike), Fastify, Drizzle, Better Auth, BullMQ + Redis, Sentry + pino, Vitest + Playwright and GitHub Actions are all as preferred in §5.
