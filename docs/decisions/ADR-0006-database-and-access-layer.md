# ADR-0006 — Database and access layer: PostgreSQL 18 + Drizzle ORM + node-postgres (`pg`)

| Field | Value |
|---|---|
| Status | Proposed |
| Date | 2026-10-31 |
| Part | 1.1 |
| Owner approval needed | **Yes, one deferred sub-decision:** whether Part 2.3 starts on Drizzle **0.45.x (stable)** or **1.0** (currently a release candidate). Rule below. |

## Context
- PostgreSQL is the source of truth (rule 4). Every state-changing operation is transactional and idempotent (rule 9). Economy and combat math is integer-only (rule 8).
- **Hard requirement:** clean row locking (`SELECT … FOR UPDATE`, ideally `NO KEY UPDATE`, `SKIP LOCKED`, `NOWAIT`) inside typed transactions. Settlement locks a city's rows before applying due events (Parts 3.3, 3.6, 4.3).
- Migrations must be plain SQL, reviewable, forward-only with an expand/contract strategy (rule 15; Part 1.3).

**Verified facts (npm registry, published `.d.ts`, docs, 2026-10-31):**
- `drizzle-orm` `latest` is **0.45.4**. The `1.0.0` line is at **`rc.5`** (dist-tag `rc`). `drizzle-kit` latest is 0.31.11.
- Drizzle 0.45.4 `pg-core` select builder exposes `for(strength: LockStrength, config?: LockConfig)` with `LockStrength = 'update' | 'no key update' | 'share' | 'key share'`. `LockConfig` covers `noWait` / `skipLocked` (`pg-core/query-builders/select.types.d.ts`). `db.transaction(async tx => …)` supports isolation levels.
- `@prisma/client` stable is 7.10.1. The `prisma` CLI's `latest` dist-tag currently points to `8.0.0-rc.29`, a release candidate tagged as latest. Native row locking (`forUpdate()` and others) appears only in Prisma **8 RC** builds; in stable 7.x it needs `$queryRaw`.
- `kysely` latest is 0.29.7 and supports `.forUpdate()`, `.forNoKeyUpdate()`, `.skipLocked()`.
- `pg` (node-postgres) is 8.23.1. `postgres` (postgres.js) is 4.0.0 (2026-10-29, new major).
- BullMQ's Postgres backend and Better Auth's Drizzle adapter both work with `pg`.
- PostgreSQL: **18** is the current stable major. **19 RC1** came out on 2026-10-15, with GA planned for **2026-11-19**.

## Decision
- **PostgreSQL 18** in every environment: Docker image `postgres:18` locally and in CI, the same major on the host (ADR-0009). Move to 19 only after it has had a few minor releases, using a planned upgrade Part.
- **Drizzle ORM** for schema definitions, typed queries and transactions. **drizzle-kit** generates SQL migrations, which are **committed and reviewed as SQL**. Hand-written SQL migrations are allowed where Drizzle cannot express something (partial indexes, `CHECK` constraints, triggers, partitioning).
- **Driver: `pg` (node-postgres)** with a `Pool`. It is the most battle-tested driver, and the queue and auth layers already support it, so there is one connection model.
- **Version rule for Part 2.3:** if `drizzle-orm@1.x` is the npm `latest` (GA) when 2.3 starts, use 1.x. Otherwise use **0.45.x** and plan the 1.0 migration as its own small Part. This avoids building on a release candidate.
- **Transaction conventions** (detailed in `DATABASE_DESIGN.md`, Part 1.3):
  - default isolation `READ COMMITTED` with explicit row locks in a documented **lock order**;
  - `SELECT … FOR NO KEY UPDATE` when a row is updated but its key is not, so foreign-key checks on child rows are not blocked;
  - `SKIP LOCKED` for the reconciler's sweeps;
  - all repository functions take a `tx` parameter. No implicit global connection inside domain flows.
- Money-like columns (`bigint` resource amounts in milli-units) are mapped as **`bigint` → TypeScript `bigint`** (Drizzle `mode: 'bigint'`), never `number`, so they cannot silently lose precision. *Exact numeric scale is defined in Part 1.4.*

## Alternatives
| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **Drizzle** | SQL-shaped and typed; `.for('update'/'no key update', { skipLocked })` in stable; SQL migrations; light runtime | 1.0 not yet GA; relational-query API changing between 0.x and 1.0 | **Chosen** |
| Kysely | Excellent typed SQL builder, mature locking API | No schema-to-migration generator (migrations written by hand); schema types maintained separately or via codegen | Strong runner-up; the fallback if Drizzle's 1.0 transition goes badly |
| Prisma 7 / 8 | Great DX, big ecosystem | Row locking only in 8 RC, raw SQL in stable; heavier generator/engine pipeline; abstraction hides the SQL we need to reason about locks | Rejected (hard requirement not met in stable) |
| Raw SQL (`pg` + SQL files) | Total control | No types without extra codegen; slower to evolve | Rejected as a primary approach; used for special migrations |

| Driver | Pros | Cons | Verdict |
|---|---|---|---|
| **`pg`** | Most battle-tested; used by BullMQ's Postgres backend and the Better Auth examples | Callback-era API (we wrap it) | **Chosen** |
| `postgres` (postgres.js) | Fast, modern | 4.0 is days old (major release); fewer integrations | Rejected for now |

## Trade-offs
- Drizzle keeps us close to SQL, which is what concurrency reasoning needs, at the cost of a less "magic" ORM.
- Using `bigint` in TypeScript adds a little friction (JSON serialisation needs explicit string encoding in `contracts`). That is the price of never losing resource precision.

## Consequences
- Part 1.3 defines tables, lock order and migration policy in terms of these tools.
- Part 2.3 sets up `packages/db`: schema, migrations, a `withTransaction` helper, a test harness (a real Postgres in Docker per test run; no mocks for DB tests).
- `contracts` defines how bigints cross the wire (decimal strings).
- **Revisit when** Drizzle 1.0 reaches GA (upgrade Part), or if a locking or migration need cannot be met by Drizzle plus hand-written SQL.

## Verification
Part 2.3: an integration test runs two concurrent transactions that both `FOR UPDATE` the same row and proves they serialise. A test proves `bigint` values round-trip exactly above 2^53. Migrations apply cleanly from an empty database in CI.
