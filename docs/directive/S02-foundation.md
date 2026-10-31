# S02 — Technical Foundation

**Goal of this section:** a working, tested, deployable skeleton. No gameplay yet.
**Prerequisite:** S01 approved by the owner.

---

### Part 2.1 — Monorepo scaffold
**Goal:** an empty but correctly wired monorepo.
**Depends on:** 1.1.
**Build:** git repo, pnpm workspaces, Turborepo pipeline (build, lint, typecheck, test), `packages/config` with shared strict `tsconfig`, ESLint (incl. import-boundary rules enforcing `CLAUDE.md` §6), Prettier, Vitest base config, `.gitignore`, `.editorconfig`, root `README.md` (how to install and run).
**Done when:** `pnpm install && pnpm lint && pnpm typecheck && pnpm test` succeeds on a clean clone; an import from `apps/*` into a `game-*` package fails lint.
**Tests:** one trivial test per workspace proving the pipeline runs.

### Part 2.2 — Local development environment
**Goal:** one command brings up local dependencies.
**Depends on:** 2.1.
**Build:** `infrastructure/docker-compose.yml` (PostgreSQL, Redis), `.env.example` with every variable documented, scripts `pnpm dev:up`, `pnpm dev:down`, `pnpm dev:reset`.
**Done when:** a fresh machine with Docker and Node can run the stack following only the README.

### Part 2.3 — Database layer
**Goal:** schema-as-code with safe migrations and isolated tests.
**Depends on:** 2.2, 1.3.
**Build:** `packages/db` with Drizzle config, migration scripts, a transaction helper (with retry on serialization failure / deadlock), a row-locking helper, seed script (dev only), and a test-database strategy (separate DB or schema per test run, cleaned between tests).
**Out of scope:** gameplay tables (added in their own Parts).
**Done when:** migrations run up on an empty DB; tests use an isolated database; the transaction helper is used by all future writes.
**Tests:** transaction commits/rolls back correctly; retry helper retries a simulated serialization failure.

### Part 2.4 — Contracts package
**Goal:** one shared definition of the API surface.
**Depends on:** 2.1.
**Build:** `packages/contracts`: Zod schemas, inferred types, the standard error format (`code`, `message`, `details`), error code catalog, pagination format, `Idempotency-Key` header convention, event envelope type (`id`, `type`, `seq`, `occurredAt`, `payload`).
- OpenAPI generation from the Zod schemas into `docs/architecture/api/` — this is the living API specification (regenerated in CI, never hand-edited).
**Done when:** API and client both import types from here; no duplicated request/response types anywhere; the generated API spec is up to date.

### Part 2.5 — API shell
**Goal:** a production-shaped API server with nothing game-specific yet.
**Depends on:** 2.3, 2.4.
**Build:** Fastify app in `apps/api` with: module registration pattern (one module per domain), Zod request validation, error handler mapping domain errors to the contract format, request IDs, structured logging (pino, no secrets/PII), `/health` and `/ready` (DB + Redis checks), CORS for the client origins, basic global rate limit, graceful shutdown.
**Done when:** API starts locally; invalid requests return contract-shaped errors; health checks reflect DB/Redis state.
**Tests:** API tests for health, validation errors, unknown routes.

### Part 2.6 — Workers shell
**Goal:** background processing infrastructure ready for timed events.
**Depends on:** 2.3.
**Build:** `apps/workers` with BullMQ connection, queue naming conventions, job payload validation (Zod), retry/backoff policy, dead-letter handling, a periodic "reconciler" job skeleton, graceful shutdown, structured logs.
**Done when:** a sample job is enqueued from a script, processed once, and a failing job lands in the failed set after retries.
**Tests:** job payload validation; worker processes a job exactly once in a test.

### Part 2.7 — Client shell
**Goal:** the Expo app runs on web, iOS simulator and Android emulator.
**Depends on:** 2.4.
**Build:** `apps/client` with Expo Router, typed API client (built from `contracts`), environment configuration, a root layout, placeholder screens (Sign in, Home), error boundary, loading states.
**Done when:** the app renders on web and at least one native target and calls `/health` successfully.
**Tests:** a Playwright smoke test against the web build.

### Part 2.8 — Authentication
**Goal:** players can create accounts and sign in on every platform.
**Depends on:** 2.5, 2.7, ADR from 1.1.
**Build:** account tables via the chosen auth library; email + password sign-up/sign-in/sign-out; session handling suitable for web (secure cookies) and native (secure token storage); password reset flow (email sending may be stubbed with a dev mailbox); auth middleware exposing the current account to modules; account deletion endpoint (required by app stores).
**Out of scope:** social login (later), roles beyond `player` and `admin`.
**Done when:** a user can sign up on web, sign in on native with the same account, and protected routes reject anonymous requests.
**Tests:** sign-up, duplicate email, wrong password, session expiry, protected route access, account deletion.

### Part 2.9 — Continuous integration
**Goal:** every push is checked automatically.
**Depends on:** 2.1–2.8.
**Build:** GitHub Actions workflow: install with cache, lint, typecheck, unit tests, integration tests against a Postgres + Redis service container, web build, **cross-platform check** (native bundle export for iOS and Android succeeds), API spec freshness check.
**Done when:** CI passes on main; a deliberately failing test makes CI fail; a change that breaks the native bundle fails CI.

### Part 2.10 — Deployment (staging)
**Goal:** a live staging environment.
**Depends on:** 2.9, hosting ADR.
**Build:** managed Postgres + Redis + API + workers on the chosen host; web client deployed; migrations run automatically before the new API version starts; environment secrets set in the host (never in git); `infrastructure/RUNBOOK.md` with deploy, rollback and "restore from backup" steps; automatic DB backups enabled.
**Done when:** staging URL serves the web client, sign-up works end to end, and a rollback has been performed once and documented.
