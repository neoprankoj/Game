# S01 Gate Review — Architecture & Decisions

| Field | Value |
|---|---|
| Status | **Awaiting owner approval.** S02 does not start until this gate is approved |
| Date | 2026-11-01 |
| Parts covered | 1.1 Stack & ADRs · 1.2 SYSTEM_ARCHITECTURE · 1.3 DATABASE_DESIGN · 1.4 GAME_SIMULATION_SPEC · 1.5 DOMAINS · 1.6 Risks, testing, roadmap |

This is the package the owner needs to approve or redirect S01. Read §1 and §4 first. Everything else is supporting detail with links.

---

## 1. One-page summary

- **Architecture:** a TypeScript modular monolith.
  - **Clients:** one Expo app for web, iOS and Android.
  - **Server:** a thin Fastify API and BullMQ workers over a shared application layer and pure game-rule packages.
  - **Data:** PostgreSQL 18 is the only source of truth; Redis only accelerates.
- **Time:** stored as timestamps and *settled* on demand, with an exact, path-independent integer model. Jobs only make completions arrive sooner; a reconciler guarantees correctness without them.
- **Concurrency:** one root lock per empire, a fixed lock-rank order (deadlock-free by construction) and idempotency at every layer.
- **Combat:** deterministic Stasis → Clash → Rewind with a seeded xoshiro128** PRNG. Reproducible and auditable, with intervention points already present for post-MVP.
- **Verification during S01:** the designs were exercised rather than only described.

| What | Result |
|---|---|
| Reference schema on PostgreSQL 18.6 | 26/26 checks pass, plus a two-session concurrency test |
| Reference simulation model | 28/28 checks pass: exactness vs brute force, path independence, PRNG vs C reference, 1,000-battle determinism |
| Domain catalog checker | 11/11 checks pass, mutation-tested |
| Architecture diagrams | all 14 Mermaid diagrams render |

## 2. Key decisions (what · why · alternatives · trade-offs · future consequences)

| Decision | Why | Alternatives considered | Trade-off | Future consequence |
|---|---|---|---|---|
| **One Expo codebase** (ADR-0003) | a solo developer can't maintain two UIs | Expo + Next.js, Vite SPA, Flutter, Capacitor | web is react-native-web, not full DOM | a marketing site, if ever, is a separate small app |
| **Skia map behind a renderer boundary** (ADR-0004) | one drawing codebase | PixiJS web + Skia native, SVG, game engine | 2.9 MB WASM on web, performance unproven | measured spike at the start of 7.6; PixiJS fallback is cheap |
| **Fastify modular monolith** (ADR-0005) | thin transport, structure from packages | NestJS, Hono, Express | boundaries need lint enforcement | separate realtime gateway or services only on triggers (§12 SA) |
| **PostgreSQL 18 + Drizzle + `pg`** (ADR-0006) | typed SQL with first-class row locks | Kysely, Prisma (locking only in RC), raw SQL | Drizzle 1.0 not yet final | version rule at 2.3; Kysely is the fallback |
| **Better Auth, data in our Postgres** (ADR-0007) | own data, Expo + Fastify support | Auth.js, Lucia (deprecated), Clerk/Supabase | we operate email and auth upgrades | sign-in methods are an owner choice |
| **BullMQ 6 on Redis** (ADR-0008) | battle-tested; Redis reused for rate limits and pub/sub | BullMQ Postgres backend (new), pg-boss, Upstash PAYG | one more service (~$2–5/mo) | a `JobScheduler` port makes a Postgres-backend switch a config change |
| **Railway + Neon** (ADR-0009) | managed; Neon PITR + branching for migration rehearsal | all-Railway, Fly + Neon, cloud direct | two vendors; latency must be measured | latency gate in 2.10 |
| **`game-core`, `application`, `tools/`** (ADR-0011) | API and workers must share use cases; combat must not depend on the economy | orchestration in `db` or in the API | two more packages | `CLAUDE.md` §6 may be updated by the owner |
| **Settlement per player + interactions (I-SETTLE)** (SA §4.3) | research and colonies affect all cities at once; battles involve two owners | per-city settlement; one global serial queue | more complex settlement (split into 3.3a/b) | colonies work without redesign |
| **Root-lock protocol** (DB §5) | one rule to review and test | per-table lock choreography; SERIALIZABLE | coarse lock per empire | contention measured; region sharding is the scale path |
| **Exact fixed-point economy, D = 3.6 × 10⁹** (SIM §2) | per-millisecond integer accrual, no rounding, path-independent | decimals, floats, per-step rounding | bigint everywhere | any new modifier must stay piecewise-linear |
| **Decay above a stable level; unstable Flux** (SIM §3.4) | time pressure; exact; readable | proportional (exponential) decay; no decay | Flux hoarding impossible by design | corruption and events reuse the machinery |
| **Combat: simultaneous 6-round Clash, Rewind 10–30%** (SIM §9) | no first-strike snowball; preparation rewarded; explainable | sequential initiative, more randomness | the defender holds on stalemate | intervention windows slot in at phase boundaries |
| **Fairness: 72 h protection, weak-target 25% loot, inactivity 7/21 days** (SIM §10) | protect new and offline players without forbidding play | hard attack bans, power-ratio blocking | farming still possible at reduced value | signals + manual enforcement (11.5) |

## 3. Confirmed facts vs assumptions

**Confirmed in this S01 session** (with evidence in the linked docs):
- Current versions and compatibility: npm registry, 2026-10-31 (ADR README);
  - typescript-eslint supports TypeScript `< 6.1`, and the Expo SDK 58 template uses TypeScript `~6.0.3`;
  - Expo SDK 58 pins React Native 0.88.1, React 19.3.0 and Skia 2.14.0.
- Drizzle 0.45 exposes `FOR UPDATE / NO KEY UPDATE` with `skipLocked`/`noWait`. Stable Prisma lacks native row locks.
- BullMQ 6 ships a PostgreSQL backend (docs: lower throughput; Redis remains "most battle-tested").
- PostgreSQL 18.6 provides `uuidv7()`; the reference schema (39 tables) and its checks pass.
- The root-lock spending pattern behaves as designed (two real sessions).
- Accrual closed form == brute force; path independence; the PRNG matches the C reference; combat is deterministic and integer-only.
- Provider prices as published on 2026-10-31 (ADR-0009).

**Assumptions not yet verified** (each has a Part that verifies it):

| Assumption | Verified in |
|---|---|
| Playtest load (500 accounts, 150–250 DAU, ≤ 100 sockets) | 12.8 |
| Railway↔Neon latency ≤ 3 ms p50 in the chosen region | 2.10 |
| Skia web performance on the map | 7.6 spike |
| pnpm 12 works with Expo/Metro/EAS | 2.1 (fallback pnpm 11) |
| Better Auth cross-origin cookies between web client and API | 2.8 |
| Expo push service is free at our volume (official quota not found) | 10.4 |
| Zod 4 JSON Schema conversion as the OpenAPI fallback | 2.4 |
| Ruleset-1 balance is fun | 4.6, 9.6, 12.7, 12.8 |
| TypeScript 6 → 7 migration is cheap later | when typescript-eslint supports 7 |
| Render pricing (could not be read) | not needed unless chosen |

## 4. Unresolved decisions for the owner

| # | Decision | Recommendation (assumed until you say otherwise) | Needed by |
|---|---|---|---|
| O-1 | Hosting with **two providers** (Railway + Neon) | approve (ADR-0009) | 2.10 |
| O-2 | **Region**: are playtesters mainly in the EU or North America? | tell us; we pick the matching Railway + Neon pair | 2.10 |
| O-3 | **Monthly budget**: dev ≈ $6–12; playtest ≈ $42–80 (up to ~$130) | approve or set a cap | 2.10 / 12.8 |
| O-4 | **TypeScript 6.0 pin** (not 7.0) | approve (ADR-0002) | 2.1 |
| O-5 | **Drizzle version rule** (1.x only if GA when 2.3 starts) | approve (ADR-0006) | 2.3 |
| O-6 | **Sign-in methods** for the playtest | email + password only | 2.8 |
| O-7 | **ADR-0011** layout change (`game-core`, `application`, `tools/`); optionally update `CLAUDE.md` §6 | approve | 2.1 |
| O-8 | **Ruleset-1 design**: decay model, deficit penalties with desertion, combat model (6 rounds, stalemate = defender holds, Rewind 10–30%), fairness constants (72 h, 25%, 7/21 days) | approve as the starting design; numbers are tuned at the S04/S09 gates | S03 |
| O-9 | **Multi-account enforcement policy** (MVP detects only; what do you do when detected?) | decide before the playtest | 12.8 |
| O-10 | **Admin accounts must use 2FA** | yes | 11.6 |
| O-11 | **PROGRESS changes** (§5: split 3.3 into 3.3a/3.3b; build-order notes; `SECURITY.md` started in 2.8) | approve | S02/S03 |
| O-12 | Pacing targets for the S04 review (e.g. "regular player reaches Nexus 5 in N days") | set at the S04 gate, informed by 4.6 | 4.6 |
| O-13 | Minor: `docs/PROGRESS.md` ends with an empty "SOURCE PLAN" table, and the source plan header says "CLAUDE.md (V2.1)" while CLAUDE.md is V2.2 | your files: keep, fix or remove | any time |
| — | Monetization (13.9) and art sourcing (12.3) | deferred; no action now | later |

**Approving the gate** = O-1, O-4, O-5, O-7, O-8 and O-11 approved (or changed), and the ADRs move from *Proposed* to *Accepted*. O-2, O-3 and O-6 can follow before their Parts.

## 5. Roadmap

```
S01 Architecture ──[GATE: this review]──▶ S02 Foundation (2.1–2.10) ──▶ S03 Time core (3.1, 3.2, 3.3a, 3.3b, 3.4–3.6)
   ──▶ S04 Economy (4.1–4.6) ──[GATE: economy sim]──▶ S05 Client & design system ──▶ S06 City loop (first playable)
   ──▶ S07 World & map (7.6 starts with the Skia spike) ──▶ S08 Military ──▶ S09 Combat ──[GATE: combat feel]
   ──▶ S10 Realtime & notifications ──▶ S11 Security & fairness ──▶ S12 Launch prep ──[GATE: closed web playtest]
   ──▶ S13 post-MVP, one approved Part at a time (suggested order in S13)
```

**Changes recorded in `PROGRESS.md` by this Part:**
1. **Split 3.3** into **3.3a Local settlement** (one owner: ordering, derived breakpoints, accrual hook, idempotent re-settle) and **3.3b Interaction settlement** (I-SETTLE, `resolveInteraction` with a test interaction kind, two-root lock order, recursion termination). Reason: the cross-owner part is the riskiest logic in the system (R-08) and deserves its own verified step. 9.3 plugs battles into 3.3b.
2. **3.3a** creates the minimal `players` root table (6.1 extends it, expand-only).
3. **3.4** creates the minimal `outbox_events` table and publisher for `timed_action.scheduled` (10.1 extends it).
4. **4.4** implements upkeep, deficit and desertion against provider interfaces with test doubles. **8.2** wires real units.
5. **2.3** applies the Drizzle version rule.
6. **2.8** starts `SECURITY.md` (threat model, endpoint access table), which **11.1** completes.
7. **2.10** includes the API↔DB latency gate.
8. **7.6** starts with the renderer spike (ADR-0004).
9. The reference model and domains-check run in CI from **2.9**. Golden tests are ported in 4.2/9.1–9.2.

## 6. What S02 will create (after approval)

| Part | Creates |
|---|---|
| 2.1 | pnpm + Turborepo monorepo, `packages/config` (strict TS 6.0, ESLint flat config with clock/random bans, Vitest preset, dependency-cruiser rules incl. ADR-0011), root README; one trivial test per workspace |
| 2.2 | `infrastructure/docker-compose.yml` (PostgreSQL 18, Redis 8), `.env.example`, `dev:up/down/reset` |
| 2.3 | `packages/db`: Drizzle config, migration scripts, `withTransaction` (+ retry), lock helpers, test-database strategy; DB tests ported from the reference checks (infrastructure only, no gameplay tables) |
| 2.4 | `packages/contracts`: error format, error codes, pagination, `Idempotency-Key` convention, event envelope, bigint wire codec, OpenAPI generation |
| 2.5 | `apps/api` Fastify shell: module pattern, validation, error mapping, request ids, pino with redaction tests, `/health` + `/ready`, CORS, base rate limit, graceful shutdown |
| 2.6 | `apps/workers` BullMQ shell: queues, payload validation, retries, failed set, reconciler skeleton, `JobScheduler` port, `maxmemory-policy` startup check |
| 2.7 | `apps/client` Expo SDK 58 shell: Expo Router, typed API client, placeholder screens; Playwright smoke |
| 2.8 | Better Auth (email + password, sessions web/native, reset, deletion), auth middleware, `SECURITY.md` started |
| 2.9 | GitHub Actions: all gates of TESTING_STRATEGY §6 |
| 2.10 | Railway + Neon staging, migrations before deploy, `RUNBOOK.md`, backups, latency gate, one rollback performed |

## 7. Document map (S01 outputs)

| Document | Purpose |
|---|---|
| `docs/decisions/ADR-0000…0011` + README | stack and structure decisions, version snapshot |
| `docs/architecture/SYSTEM_ARCHITECTURE.md` | how everything fits; feature locator |
| `docs/architecture/DATABASE_DESIGN.md` + `database/*.sql` | data model, locks, migrations (executable reference) |
| `docs/architecture/GAME_SIMULATION_SPEC.md` + `simulation/*` | every formula (executable reference model, generated examples) |
| `docs/architecture/DOMAINS.md` + `domains-check.mjs` | 29 domains × 11 fields; event catalog |
| `docs/architecture/RISKS.md` | 38 risks with mitigations |
| `docs/architecture/TESTING_STRATEGY.md` | 12 test types, 9 critical scenarios, CI gates |
| `docs/architecture/S01_GATE_REVIEW.md` | this review |
