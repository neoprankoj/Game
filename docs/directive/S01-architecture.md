# S01 — Architecture & Decisions

**Goal of this section:** decide the stack and write the reference documents that every later Part builds on. No gameplay code.
**Gate:** the owner reviews all S01 outputs before S02 starts.

> Every Part in this file follows the protocol in `CLAUDE.md` §2: plan → build only this Part → test/verify → document → report → stop.

---

### Part 1.1 — Stack validation & ADRs
**Goal:** confirm or adjust the preferred stack in `CLAUDE.md` §5, with evidence.
**Depends on:** nothing.
**Build:**
- `docs/decisions/ADR-0000-template.md` (Context · Decision · Alternatives · Trade-offs · Consequences · Status).
- One ADR per decision: monorepo tooling, client (Expo single codebase), map rendering (Skia vs PixiJS on web), backend framework (Fastify vs NestJS), DB access (Drizzle vs Prisma vs Kysely — row locking is a hard requirement), auth library, queue + Redis host compatibility (BullMQ requires a persistent connection; confirm the chosen Redis provider supports it and its pricing model fits), hosting platform, error tracking.
- Check **current** stable versions and maintenance status of every chosen library. Record versions in the ADR.
**Out of scope:** installing anything.
**Done when:**
- Each ADR lists at least two alternatives and the reason for the choice.
- Any deviation from `CLAUDE.md` §5 is clearly flagged for owner approval.
- An estimated monthly hosting cost for (a) development and (b) a 500-player playtest is included.

### Part 1.2 — SYSTEM_ARCHITECTURE.md
**Goal:** one document that explains how the whole system fits together.
**Depends on:** 1.1.
**Build:** `docs/architecture/SYSTEM_ARCHITECTURE.md` containing:
- C4 context and container diagrams (Mermaid).
- Module map: each package/app, its single responsibility, what it may import.
- Domain list for the MVP with: responsibilities, data owned, public interface, events produced/consumed.
- Request flow for a player action (client → API → domain → DB transaction → outbox → worker → WebSocket/push).
- Timed-event flow (scheduled job + reconciler) as a sequence diagram.
- Sequence diagrams for other critical operations: spending resources, army arrival → battle → report, reconnect and resync.
- Domain dependency diagram (which domain may call/consume events from which).
- Gameplay flow diagrams: new player first session; core daily loop; army lifecycle (preparation → deployment → travel → arrival → battle initialization → Stasis → Clash → Rewind → resolution → report → return).
- Cross-platform architecture: what is shared (contracts, game-data, domain rules, design tokens) vs. platform-specific (layouts, input, push).
- Scalability path: how the modular monolith can later split (region-sharded workers, read replicas, separate services) and what metrics would trigger each step — described, not built.
- Post-MVP domains (colonization, territories, commanders, strategic infrastructure, temporal abilities, exploration, trading, alliances, diplomacy, corruption, world/seasonal events, Great Convergence, monetization) shown with where they plug in.
**Done when:** a new developer could locate where any feature — MVP or post-MVP — lives using only this document; dependency rules match `CLAUDE.md` §6.

### Part 1.3 — DATABASE_DESIGN.md
**Goal:** the MVP data model, designed to evolve safely.
**Depends on:** 1.2.
**Build:** `docs/architecture/DATABASE_DESIGN.md` containing:
- ERD (Mermaid) for MVP entities: accounts, players, civilizations, cities, buildings, resource balances, resource ledger, timed actions, research, units, armies, movements, battles, battle reports, world regions/islands/tiles, neutral outposts, notifications, outbox events, idempotency keys, device tokens, audit log.
- For each table: purpose, key columns, types (integers for resources; `timestamptz` UTC for time), constraints (e.g. `CHECK (amount >= 0)`), indexes and why.
- Concurrency strategy: which rows get locked for which operations, lock ordering to avoid deadlocks, transaction isolation level.
- Migration policy: forward-only, expand/contract for breaking changes, how to roll back.
- Partitioning/indexing approach for map queries (region + coordinates) and a world partitioning strategy for a growing player population (regions → sectors → islands).
- **Post-MVP readiness** (designed now, tables created later): multiple cities per player (colonies), territory ownership, commanders, strategic infrastructure, alliances, treaties, market orders, seasons and seasonal rankings, historical records. Show how each attaches to the MVP model without breaking migrations.
**Done when:** every MVP Part in S03–S12 can name the tables it uses; lock ordering is written down; no post-MVP feature requires rewriting an MVP table.

### Part 1.4 — GAME_SIMULATION_SPEC.md
**Goal:** every gameplay formula and rule written down before it is coded.
**Depends on:** 1.2.
**Build:** `docs/architecture/GAME_SIMULATION_SPEC.md` containing:
- **Time model:** server UTC clock, timed-action lifecycle (scheduled → completed/cancelled), settlement ordering when several events are due (by `completes_at`, then a deterministic tie-breaker).
- **Numeric model:** integer units; fixed-point scale for rates (e.g. milli-units per hour); rounding rules; remainder carry so that settling once or a hundred times yields the identical balance.
- **Resource accrual:** piecewise formula — between consecutive events, `R(t) = min(C, R0 + P·(t − t0))` with net production `P` (production − upkeep), clamped at 0 with deficit consequences; segments split at every event that changes `P` or `C`.
- **Full economy model:** production rates, consumption, storage limits, production modifiers (order of application), upkeep, **resource decay** (e.g. above a storage threshold or for Flux-Matter specifically — decide and justify), resource transfers, offline accrual, **economic penalties** (deficit consequences) and **economic recovery** (how a player climbs out of a deficit). Market transactions are specified at outline level for post-MVP.
- **Construction, research, recruitment:** cost and duration formulas per level; queue rules; cancel/refund rules.
- **Population:** simple MVP model.
- **Movement:** distance metric, speed, travel duration, recall rules.
- **Combat:** full model for Stasis / Clash / Rewind; unit stats; formations; doctrines; seeded PRNG algorithm; integer damage math; ruleset versioning; what is stored for replay. Include the extension points for post-MVP: commanders, temporal abilities and tactical intervention decisions as additional (empty-in-MVP) inputs.
- **New-player protection** and **inactive-player** rules.
- **Post-MVP outlines** (one short subsection each, enough to keep the MVP compatible): colonization and territorial expansion, commanders, strategic infrastructure, temporal abilities, tactical intervention windows, exploration, trading, temporal corruption, world events, Great Convergence. Mark them "outline — to be finalized in S13".
- Starter balance tables (values will live in `game-data`; the spec explains the shape and the reasoning).
**Done when:** no MVP formula in later Parts is left undefined; every formula has a worked numeric example; every post-MVP system has an outline.

### Part 1.5 — Domain catalog
**Goal:** every one of the 27 source-plan domains (plus commanders and strategic infrastructure) clearly defined, so domain logic never scatters across controllers, UI and queries.
**Depends on:** 1.2, 1.3, 1.4.
**Build:** `docs/architecture/DOMAINS.md` with one entry per domain from `CLAUDE.md` §4 "Full domain map", each containing: responsibilities · data ownership · dependencies · public interfaces · database entities · business rules · events produced · events consumed · validation requirements · failure handling · automated tests. MVP domains in full detail; post-MVP domains at outline level (every field present, shorter content).
**Done when:** all 29 domains have all 11 fields; no table in `DATABASE_DESIGN.md` is owned by two domains; every event has exactly one producer.

### Part 1.6 — Risks, testing strategy, roadmap & gate review
**Goal:** make risks, test approach and open decisions explicit and hand the owner a clear review package.
**Depends on:** 1.1–1.5.
**Build:**
- `docs/architecture/RISKS.md`: risk · likelihood · impact · mitigation · owner decision needed (yes/no). Include scalability considerations and security considerations as risk categories.
- `docs/architecture/TESTING_STRATEGY.md`: how each of the 12 test types (unit, domain, DB integration, API, multiplayer sync, economy simulation, combat determinism, background-job recovery, concurrency, cross-platform, load, security) is done and in which Parts; and which Part covers each critical scenario (simultaneous actions, disconnect during combat, worker crash, offline completion, double submission, seasonal event start while active, expired decision window, interrupted movement, failed transaction).
- Unresolved decisions list for the owner.
- `docs/PROGRESS.md` updated with any added/split Parts.
- A short review summary in the Part report: key decisions (what, why, alternatives, trade-offs, future consequences), confirmed facts vs. assumptions, open questions, what S02 will create.
**Done when:** the owner has everything needed to approve or redirect. **Stop here until approval.**
