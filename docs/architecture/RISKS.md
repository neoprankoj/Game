# RISKS — Chronos Cradle: Temporal Empires

| Field | Value |
|---|---|
| Status | Draft for the S01 gate (Part 1.6); reviewed at every gate (S04, S09, S12) |
| Last updated | 2026-11-01 |
| Scale | Likelihood / Impact: **L**ow · **M**edium · **H**igh. **Owner** = an owner decision is needed (see `S01_GATE_REVIEW.md` §4) |

## 1. Product and game design

| ID | Risk | L | I | Mitigation | Owner | Part |
|---|---|---|---|---|---|---|
| R-01 | The core loop isn't fun, or the pacing is wrong (too slow or too grindy) | M | H | first playable loop at the end of S06; economy harness (4.6) with three player profiles; combat review (9.6); closed playtest with retention metrics (12.8); all balance values are data, so tuning needs no code | no | 4.6, 6.6, 12.7, 12.8 |
| R-02 | **Late-game storage is lenient**: costs grow ×1.5 per level against production ×1.2, so storage must be generous to keep every level affordable (SIM §11) | H | M | invariant check keeps every level buildable; the 4.6 harness measures idle waste per profile; growth factors may change in a new ruleset | **yes** (pacing targets at the S04 gate) | 4.6 |
| R-03 | Combat feels random, or too predictable (stalemates, steamrolls) | M | H | bounded variance (±10%), visible battlefield condition, counter cycle, 6 rounds, Rewind; replayable reports explain outcomes; combat simulator dev tool | **yes** (S09 gate) | 9.6 |
| R-04 | Offline players feel helpless ("I lost everything while asleep") | M | H | doctrines always present; 72 h protection; incoming visibility with arrival time; vault protection of 12–30%; weak-target loot reduction; Rewind; time-zone fairness for interventions (13.1) | no | 7.4, 8.4, 9.x, 11.4 |
| R-05 | Scope creep: post-MVP features pulled into the MVP | H | H | gates; S13 needs Part-by-Part approval; MVP list fixed in CLAUDE.md §4 | **yes** (ongoing discipline) | all |
| R-06 | Monetization later conflicts with "time is the core resource" (pay-to-win time skips) | M | M | SIM §13 constraint: nothing sold changes §3–§9 outcomes; decision deferred to 13.9 | yes (13.9, later) | 13.9 |
| R-07 | The art direction can't be produced by a solo developer at premium quality | M | M | gameplay readability first; placeholder system (5.2); art budget and source decision in 12.3 | yes (12.3, later) | 5.1, 12.3 |

## 2. Technical and architecture

| ID | Risk | L | I | Mitigation | Owner | Part |
|---|---|---|---|---|---|---|
| R-08 | **Cross-player settlement** (interactions, I-SETTLE recursion, ordering ties) has subtle bugs | M | H | formal rules (SIM §1.3, SYSTEM_ARCHITECTURE §4.3); Part 3.3 **split** so interactions get their own Part (3.3b); property tests with chains of interactions; simultaneous-arrival tests | no | 3.3a/b, 9.3 |
| R-09 | Expo web performance, Skia's 2.9 MB CanvasKit on the map | M | M | renderer boundary; lazy loading; measured spike at the start of 7.6 with pass criteria; PixiJS web fallback (ADR-0004) | no | 7.6 |
| R-10 | TypeScript pinned at 6.0 while the ecosystem moves to 7 | M | L | revisit trigger: typescript-eslint support for 7 (ADR-0002) | **yes** (approve pin) | 2.1 |
| R-11 | Drizzle 0.45 → 1.0 churn | M | M | version rule at 2.3; repositories isolate Drizzle usage; Kysely as a fallback (ADR-0006) | **yes** (approve rule) | 2.3 |
| R-12 | Young or fast-moving dependencies (Better Auth, pnpm 12, BullMQ 6 / ioredis 6, Expo SDK quarterly) | M | M | pin minors; upgrades as their own Parts; documented fallbacks (pnpm 11, BullMQ 5 line) | no | 2.x |
| R-13 | Integer or bigint mistakes (overflow, JSON precision, floats sneaking in) | L | H | `bigint` end to end with decimal strings on the wire; lint bans floats in `game-*` money paths; bounds (rates < 3.6M/h, stacks ≤ 1M); golden + property tests | no | 2.4, 4.1, 9.1 |
| R-14 | **Build-order dependencies** in the directive (3.3 needs `players`, 3.4 needs the outbox, 4.4 desertion needs units) | H | M | recorded in PROGRESS: minimal `players` in 3.3; minimal outbox in 3.4; 4.4 implements upkeep and desertion against provider interfaces with test doubles, wired to real units in 8.2 | no | 3.3, 3.4, 4.4, 8.2 |
| R-15 | Code drifts away from the spec documents | M | H | executable reference model + domains-check run in CI; golden tests; every Part updates docs in the same commit | no | 2.9 → all |

## 3. Data and consistency

| ID | Risk | L | I | Mitigation | Owner | Part |
|---|---|---|---|---|---|---|
| R-16 | Lock contention or deadlocks under load | L | M | root-lock protocol with ranks; short step transactions; retry helper; lock-wait metrics (12.4) | no | 2.3, 3.6 |
| R-17 | Ledger and balance diverge (duplication exploit or bug) | L | H | append-only ledger; `CHECK (amount ≥ 0)`; reconciliation check + anomaly alert (12.4); idempotency at every layer | no | 4.3, 12.4 |
| R-18 | Events lost or duplicated | L | M | transactional outbox; at-least-once delivery + consumer dedupe; clients resync by `seq` | no | 3.4, 10.1 |
| R-19 | **Data loss** in the database | L | H | Neon PITR (7 days); restore drill before the playtest; no destructive migration without a rehearsal | **yes** (hosting approval) | 2.10, 12.5 |
| R-20 | A migration damages live data | M | H | expand/contract; Neon branch rehearsal; recorded PITR timestamp; lock timeouts in migrations | no | 2.3 → all |

## 4. Scalability

| ID | Risk | L | I | Mitigation | Owner | Part |
|---|---|---|---|---|---|---|
| R-21 | One popular target or region becomes a hot spot (root lock, map reads) | L (MVP) / M (later) | M | measure first; scaling steps S1–S8 with triggers (SYSTEM_ARCHITECTURE §12); region sharding prepared by `region_id` everywhere | no | 12.4, 13.11 |
| R-22 | Reconciler or outbox backlog grows | M | M | partial indexes (verified with history), backlog and lag metrics, worker split trigger (S2) | no | 3.5, 10.1, 12.4 |
| R-23 | WebSocket scaling and deploys dropping sockets | M | L | reconnect + resync by design; Redis fan-out; gateway split trigger (S6) | no | 10.2–10.3 |
| R-24 | **API↔DB latency between Railway and Neon** | M | M | same-region pairing; latency gate in 2.10 (p50 ≤ 3 ms) before S03 builds on it; fallback all-Railway (ADR-0009) | **yes** (region) | 2.10 |
| R-25 | Hosting cost overrun | L | M | estimates in ADR-0009; billing alerts; usage-based plans; review at each gate | **yes** (budget) | 2.10, 12.8 |

## 5. Security and fair play

| ID | Risk | L | I | Mitigation | Owner | Part |
|---|---|---|---|---|---|---|
| R-26 | Account takeover (credential stuffing, weak passwords) | M | H | Better Auth (no custom crypto); rate limits and lockout; email verification; password policy; optional breached-password check; **2FA required for admin accounts** | no (recommendation) | 2.8, 11.2 |
| R-27 | Authorization gaps (IDOR: acting on another player's ids) | M | H | ownership checks in the application layer; authorization matrix tests for every route (11.1) | no | all API Parts, 11.1 |
| R-28 | Client tampering, scripting, bots | H | M | server authority (clients send intents only); rate limits; action-timing signals (11.5) | no | 11.2, 11.5 |
| R-29 | Multi-account farming and resource pushing | H | M | weak-target loot rule; fairness signals; transfers disabled in the MVP; **manual enforcement policy needed before the playtest** | **yes** (policy) | 11.4, 11.5 |
| R-30 | Secrets or PII leaking into the repo, logs or Sentry | L | H | `.env.example` only; secret scanning in CI; pino/Sentry redaction with tests (ADR-0010) | no | 2.2, 2.5, 2.9 |
| R-31 | Supply-chain compromise of a dependency | L | H | frozen lockfile; exact pins; `pnpm audit`; few dependencies (every new one justified per CLAUDE.md §5); Dependabot alerts | no | 2.1, 2.9 |
| R-32 | Compromised admin session misused | L | H | admin 2FA; reason-required audit log; per-action caps on grants; admin routes separately rate-limited | no | 11.6 |
| R-33 | Security design scattered before `SECURITY.md` exists | M | M | security architecture in SYSTEM_ARCHITECTURE §10 and these risks now; `SECURITY.md` (threat model + endpoint access table) **started in 2.8** and completed in 11.1 (proposal, see review) | no | 2.8, 11.1 |

## 6. Operations, delivery and compliance

| ID | Risk | L | I | Mitigation | Owner | Part |
|---|---|---|---|---|---|---|
| R-34 | **Solo bandwidth / bus factor** | H | H | small verified Parts; living docs; managed services; runbooks (2.10, 12.5); everything reproducible from the repo | no | all |
| R-35 | Vendor outage or lock-in (Railway, Neon, Expo, Sentry) | L | M | standard Postgres and Docker images; portable configuration; documented fallbacks per ADR | no | 2.10 |
| R-36 | Store policy problems later (Sign in with Apple, IAP rules, randomized rewards) | M | M | constraints noted in ADR-0007 and 13.9; store compliance check in 13.10 | no | 13.10 |
| R-37 | Privacy and legal obligations (GDPR export/deletion, age rating, cookies) | M | M | deletion/export designed (D01/D02); privacy policy and terms templates for owner review (Claude is not a lawyer) | **yes** (12.6) | 12.6 |
| R-38 | Observability too thin to catch problems before players report them | M | M | Sentry + pino from 2.5; metrics and alerts in 12.4 with an injected-failure test | no | 2.5, 12.4 |
