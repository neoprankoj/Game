# TESTING_STRATEGY — Chronos Cradle: Temporal Empires

| Field | Value |
|---|---|
| Status | Draft for the S01 gate (Part 1.6) |
| Last updated | 2026-11-01 |
| Depends on | ADR-0001/0002 (tooling), DATABASE_DESIGN §5, GAME_SIMULATION_SPEC §12, DOMAINS (each entry's *Automated tests*) |

Rule 14: **no untested critical logic** (economy, time, combat, auth, authorization). This document says how each of the 12 test types from source plan XIV is done, where it runs, and which Part delivers it. It also maps the 9 critical scenarios to Parts.

---

## 1. Principles

1. **Test the rules where they live.** Pure `game-*` packages get fast unit and property tests without infrastructure. Use cases get integration tests against a **real PostgreSQL 18** (no database mocks; the locks and constraints are part of the behaviour).
2. **Time and randomness are inputs.** Every test uses a `FakeClock` (advanceable) and a seeded `Prng`. A test that reads the wall clock or `Math.random` fails lint (ADR-0002).
3. **Executable specs become golden tests.** The worked examples and property checks of `simulation/reference-model.mjs` (W-1…W-17, 28 checks) are ported to Vitest in Parts 4.x/6.x/8.x/9.x. The TypeScript implementation must reproduce them exactly, including the W-13 battle hash. The reference schema checks (DATABASE_DESIGN, 26 checks) become DB tests in 2.3 and in each table's Part.
4. **Concurrency claims are tested with real concurrency.** Two or more connections race, and tests are repeated (§4).
5. **A flaky test is a bug.** It is fixed or deleted with a tracked issue, never retried into green.
6. **Coverage is a smoke alarm, not a goal.** Targets: `game-*` ≥ 90% lines and branches; `application` ≥ 80%; apps follow the critical paths. CI reports coverage but gates only on `game-*`.

## 2. Tooling

| Need | Tool | Note |
|---|---|---|
| Unit / domain / integration | **Vitest 5** | one config preset in `packages/config` |
| Property-based tests | **fast-check** (to be justified as a new dependency in Part 4.2) | generators for rates, intervals, battles; the reference model shows the properties already hold |
| Database | PostgreSQL 18 in Docker (`docker compose` locally, service container in CI) | a fresh database per test file (template-database clone), migrations applied once per run |
| Redis / BullMQ | `redis:8` container | flushed per suite; recovery tests flush it on purpose |
| API tests | Fastify `inject` + real application layer + real DB | no network needed |
| WebSocket / multiplayer sync | `ws` test clients against an in-process API | two or more clients per test |
| Web E2E | **Playwright** (Chromium baseline) | against a production-like build with a **test-only clock-advance endpoint** (enabled in test/dev builds only, 6.6) |
| Native | `expo export` for iOS/Android in CI (bundle must build); a manual smoke checklist per release; device automation (e.g. Maestro) evaluated at 13.10 | |
| Load | **k6** (evaluated in 13.11) | only when real players exist (COVERAGE "Deliberate changes") |
| Security | authorization matrix tests, rate-limit tests, `pnpm audit`, secret scanning, OWASP ZAP baseline (12.x) | |
| Design-doc consistency | `reference-model.mjs`, `domains-check.mjs` | run in CI from 2.9 |

## 3. The 12 test types

| # | Type | What it proves | How | Runs | First Part → ongoing |
|---|---|---|---|---|---|
| 1 | **Unit** | small pure functions are correct | Vitest, table-driven; golden values from the reference model | every push | 2.1 → all |
| 2 | **Domain** | domain rules hold (queues, prerequisites, refunds, doctrines, combat phases) | pure `game-*` tests + property tests (path independence, conservation of units/resources, determinism) | every push | 3.1, 4.1–4.4, 6.x, 8.x, 9.1–9.2 |
| 3 | **Database integration** | schema constraints, locks, transactions, migrations | real PG 18; constraint tests from `mvp-reference-checks.sql`; lock-order tests; migrations from empty in CI | every push | 2.3 → every Part adding tables |
| 4 | **API** | contract shape, validation, error mapping, auth, idempotency | Fastify `inject`; every route has success, validation-error, unauthenticated and foreign-resource cases | every push | 2.5 → all API Parts |
| 5 | **Multiplayer synchronisation** | events reach the right sockets in order; reconnect recovers | 2+ WS clients; per-player `seq` ordering; gap → catch-up; two API instances via Redis fan-out | every push (2-instance test nightly) | 10.1–10.3 |
| 6 | **Economy simulation** | balance over weeks per player profile; no anomalies | `tools/sim` harness on real `game-*` packages; deterministic per seed; CSV + summary; anomaly assertions (no negative balance, ledger = balance) | on demand + nightly once S06 exists | 4.6 (gate), 9.6, 12.7 |
| 7 | **Combat determinism** | same input + seed + ruleset ⇒ same hash; old battles replay | 1,000 random battles × 2 runs; W-13 hash golden; replay of stored battles after a ruleset change; integer-only assertion | every push | 9.1, 9.2, 9.4 |
| 8 | **Background-job recovery** | correctness never depends on a job | kill the worker mid-job; delete all delayed jobs (`FLUSHALL`); duplicate jobs; late jobs; reconciler double-run | every push (short), nightly (long) | 2.6, 3.4, 3.5, 10.1 |
| 9 | **Concurrency** | simultaneous requests cannot corrupt state | N connections race the same root; repeated 20× per CI run and 200× nightly; assertions on conservation and single success | every push + nightly | 3.6, 4.3, 6.1, 6.3, 7.4, 8.3, 8.5, 9.3 |
| 10 | **Cross-platform** | one codebase works on web, iOS, Android | Playwright on web (desktop + mobile viewport); `expo export` iOS/Android must succeed in CI; a manual native smoke checklist recorded per release | every push (export), per release (manual) | 2.7, 2.9, 5.3, 6.6, 7.6, 13.10 |
| 11 | **Load** | capacity meets measured needs | k6 scenarios from real playtest behaviour (sessions, actions/min, sockets) against staging; before/after each scaling ADR | on demand | 13.11 (preceded by 12.4 metrics) |
| 12 | **Security** | authentication, authorization, abuse controls, secrets | authorization matrix (every mutating route × another player's id → 403/404; anonymous → 401); rate-limit tests; log/Sentry redaction tests; `pnpm audit` + secret scan in CI; ZAP baseline before the playtest | every push (+ scans) | 2.5, 2.8, 11.1–11.3, 12.6 |

## 4. Concurrency test pattern

```
given: a seeded player with known state
when:  k connections (default 2–8) each BEGIN, then wait at a barrier, then run the operation
then:  invariants hold —
       · exactly the allowed number of successes (e.g. one spend of two that exceed the balance)
       · conservation: Σ resources (balances + cargo) and Σ units (all places) match the ledger/history
       · no deadlock errors escape the retry helper; no partial rows
repeat: 20× per CI run, 200× nightly; any failure keeps the seed and connection timing in the report
```
The barrier is a Postgres advisory lock that the test releases. This makes interleavings reproducible enough to hit the race reliably.

## 5. The 9 critical scenarios (source plan XIV)

| Scenario | Where proven | Test |
|---|---|---|
| Two players attempting simultaneous actions | 3.6, 7.4, 8.5, 9.3, 13.12 | concurrency pattern (§4): simultaneous spends on one city, two sign-ups for one spawn island, two arrivals at the same target in the same millisecond (ordering by `(instant, id)`), two colonisers for one island (post-MVP) |
| A player disconnecting during combat | 9.3, 10.3 | battles resolve server-side with the player offline (no socket at all); the client reconnects with a sequence gap → catch-up → report visible; Playwright with the network cut |
| A worker crashing during a scheduled event | 3.5, 2.6 | kill the worker after it takes the job but before commit → the job is retried or the reconciler completes it; exactly-once effect |
| A building completing while a player is offline | 3.3, 6.3 | settle after days offline in one request; production split at completion (W-5); E2E with clock advance (6.6) |
| A resource transaction being submitted twice | 3.6, 4.3 | same `Idempotency-Key` twice (sequential and concurrent) → one ledger row, same response; same key with a different body → error |
| A seasonal event starting while players are active | 13.15, 13.8 (post-MVP) | an event start instant falls inside an active session and inside an offline gap → modifiers apply exactly from the start for both (breakpoints) |
| An expired tactical decision window | 13.1 (post-MVP) | no decision before the deadline → doctrine fallback recorded; a decision after the deadline is rejected; replay with decisions matches |
| An interrupted military movement | 8.5 | recall mid-flight (return after elapsed time); target disappears or becomes invalid before arrival (abort + return); arrival processed twice (one battle) |
| A database transaction failing | 2.3, 3.6, 9.3 | inject a failure after partial writes (constraint, killed connection) → no partial state, no published event, the retry helper behaves |

## 6. CI quality gates (configured in 2.9)

Every push runs:
1. install (frozen lockfile);
2. lint + typecheck + **dependency-cruiser** (boundaries);
3. unit/domain tests with coverage (gate on `game-*`);
4. integration tests (PG 18 + Redis services);
5. reference-model and domains-check scripts;
6. web build + Playwright smoke;
7. `expo export` iOS/Android;
8. OpenAPI freshness check;
9. `pnpm audit` (high/critical fail) + secret scan.

**Nightly** adds: long concurrency repetitions, long job-recovery runs, the economy harness and the two-instance realtime test.

## 7. Test data
- Factories build domain state from `game-data` (no hand-written magic numbers in tests).
- Each worked example has a named fixture.
- Seeds for the PRNG and world generation are fixed per test and printed on failure.
- No production data in tests. Staging uses synthetic players (12.8 uses real invited players only in production).

## 8. Definition of done (testing part)
A Part is DONE only when its listed tests and the relevant scenario tests exist and pass **in this session's run** (CLAUDE.md honesty rules), with the command and counts in the report.
