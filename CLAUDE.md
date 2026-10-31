# CHRONOS CRADLE: TEMPORAL EMPIRES — Development Directive V2.2

You are the engineering partner of a **solo developer** building Chronos Cradle from an **empty repository**.
The game is a persistent, shared-universe, cross-platform grand-strategy game where **time is the central strategic resource**.
You are not building just another mobile strategy game: you are building a persistent civilization simulator — floating islands, territorial expansion, a living economy, asynchronous warfare with tactical moments, diplomacy and long-term progression.

Your job: turn the vision into a game that is correct, playable and maintainable — built one small, verified part at a time.
Think independently, challenge flawed assumptions, flag risks early, and propose alternatives with reasons. Never trade game integrity for speed.

**Perspectives to apply.** You work alone with a solo owner, but review every plan through the eyes of: creative director, game designer, systems architect, backend engineer, mobile engineer, web engineer, multiplayer/infrastructure engineer, economy designer, combat simulation engineer, database architect, UI/UX director, security engineer, QA/automation engineer and DevOps engineer. When one of these perspectives raises a concern, name it in your plan or report.

---

## 1. How this directive is organized

| File | Purpose |
|---|---|
| `CLAUDE.md` (this file) | Rules that apply to **every** session. Always in force. |
| `docs/directive/00-vision.md` | Product vision, pillars, MVP scope. Read before any design work. |
| `docs/directive/SOURCE-PLAN-V2.0.md` | The owner's **original full plan**, verbatim. The source of intent for the whole game. |
| `docs/directive/COVERAGE.md` | Maps every part of the source plan to the Section/Part that implements it. |
| `docs/directive/S01-…` to `S13-…` | **Sections.** Each is split into numbered **Parts** (e.g. Part 4.2). |
| `docs/PROGRESS.md` | The tracker. Single source of truth for what is done and what is next. |
| `docs/architecture/`, `docs/decisions/` | Documents you produce in Section 1 and keep current afterwards. |

**A Part is the unit of work.** One Part = one focused delivery with its own acceptance criteria and tests.

**Source plan rule.** `SOURCE-PLAN-V2.0.md` is binding intent. This file (V2.2) only changes it where it says so explicitly (stack choices, solo-dev scope, MVP ordering — see `COVERAGE.md` "Deliberate changes"). If you find something in the source plan that no Part covers, do not drop it: report it and propose where it belongs. When working on a Part, also read the source-plan sections that `COVERAGE.md` links to it.

---

## 2. Working protocol — follow in every session

1. **Orient.** Read `docs/PROGRESS.md`. Identify the current Part. If the owner names a Part, use that one.
2. **Read.** Open the Section file for that Part. Read the Part, its dependencies, and any spec documents it references.
3. **Plan before code.** Reply with:
   - the Part's goal in one sentence,
   - files you will create or change,
   - any conflict, ambiguity or risk you see,
   - questions that block you (ask them and wait; do not guess on blocking questions).
4. **Build only this Part.** Do not implement anything belonging to a later Part, even if it seems convenient.
5. **Test.** Write the tests the Part lists, plus any you judge necessary. Run them. All must pass.
6. **Document.** Update affected docs, add an ADR for any non-trivial decision, update `docs/PROGRESS.md`.
7. **Report and stop.** Use the report format below. Wait for the owner's approval before starting the next Part.

### Report format (end of every Part)
```
PART X.Y — <name> — DONE | BLOCKED | PARTIAL
Delivered:      what exists now (files, endpoints, tables, screens)
Tests:          command run + actual result summary (counts, failures)
Acceptance:     each "Done when" item → met / not met
Deviations:     anything different from the directive, and why
Decisions:      ADRs added or updated
Risks / debt:   new risks, shortcuts, follow-ups
Next:           the next Part and anything the owner must decide first
```

### Honesty rules
- Never claim tests pass without running them in this session.
- Never mark a Part DONE if any acceptance criterion is unmet — use PARTIAL and say what is missing.
- Separate confirmed facts from assumptions. Never fabricate implementation status.
- If a Part is too large to finish cleanly, stop and propose splitting it.

---

## 3. Final product decisions (fixed)

| Decision | Direction |
|---|---|
| Platforms | iOS, Android, desktop browsers, mobile browsers where practical |
| Client strategy | **One Expo codebase** (React Native + Expo Router) targeting web, iOS and Android |
| Release order | **Web first** for fast playtesting → iOS/Android store builds later |
| Universe | One persistent shared universe for all platforms; no full wipes |
| Seasons | Great Convergence = seasonal competitive layer on top of permanent progression |
| Combat | Hybrid: asynchronous by default; tactical intervention windows are **post-MVP** |
| Expansion | Players grow from one settlement to an interdimensional empire: colonization of new islands, territorial control and strategic infrastructure (**post-MVP build, but designed in S01 and supported by the data model from day one**) |
| Development | Architecture first, then small verified Parts |
| Monetization | Fair free-to-play. **Undecided details — owner decision required** (see S13) |
| Team | Solo developer → prefer managed services and simple, well-known tools |

---

## 4. MVP scope (what version 1 contains)

**In MVP:** accounts and player profiles · one region of the universe · one city per player · the three resources with production, upkeep, storage, decay, penalties and recovery · construction · light research tree · population (simple) · world map · neutral outposts (PvE) · unit recruitment · armies, formations and doctrines · army movement · asynchronous deterministic combat (Stasis, Clash, Rewind) · battle reports · realtime updates + push notifications · new-player protection · onboarding · web release for closed playtest.

**Post-MVP (designed on paper, built later, each needs owner approval):** colonization and territorial expansion · commanders · strategic infrastructure · tactical intervention windows · temporal abilities · exploration · trading/market · alliances · diplomacy · temporal corruption · world and seasonal events · Great Convergence · monetization · store releases · multi-region scaling.

**Build MVP so post-MVP fits without rewrites.** Examples: a player owns a *list* of cities even if MVP allows only one; armies have an optional commander slot; combat input accepts commanders, abilities and player decisions as (empty) inputs; regions and sectors exist in the schema; resources support transfers between cities. Section 1 designs every domain at least at outline level for this reason.

If a request would pull post-MVP work into the MVP, flag it and ask.

### Full domain map (all 27 source-plan domains + additions)

| # | Domain | Phase | Where |
|---|---|---|---|
| 1 | Authentication & accounts | MVP | 2.8 |
| 2 | Player profiles | MVP | 6.1 |
| 3 | Civilizations | MVP | 6.1 |
| 4 | Cities | MVP | 6.1, 6.6 |
| 5 | Buildings | MVP | 6.2, 6.3 |
| 6 | Resources | MVP | 4.1–4.6 |
| 7 | Population | MVP | 6.5 |
| 8 | Construction | MVP | 6.3 |
| 9 | Technology & research | MVP | 6.4 |
| 10 | Military recruitment | MVP | 8.2 |
| 11 | Armies & formations | MVP | 8.3, 8.4 |
| 12 | Military movement | MVP | 8.5 |
| 13 | Combat simulation | MVP | S09 |
| 14 | Temporal abilities | Post-MVP | 13.2 |
| 15 | World generation | MVP | 7.2 |
| 16 | Islands & territories | MVP (islands) / Post-MVP (territories) | 7.1, 13.12 |
| 17 | Colonization | Post-MVP | 13.12 |
| 18 | Temporal corruption | Post-MVP | 13.7 |
| 19 | Exploration | Post-MVP | 13.3 |
| 20 | Trading | Post-MVP | 13.4 |
| 21 | Alliances | Post-MVP | 13.5 |
| 22 | Diplomacy | Post-MVP | 13.6 |
| 23 | Notifications | MVP | S10 |
| 24 | Seasonal & world events | Post-MVP | 13.15 |
| 25 | Great Convergence | Post-MVP | 13.8 |
| 26 | Monetization | Post-MVP (owner decision) | 13.9 |
| 27 | Administration & moderation | MVP (admin) / Post-MVP (chat moderation) | 11.6, 13.5 |
| + | Commanders | Post-MVP | 13.13 |
| + | Strategic infrastructure | Post-MVP | 13.14 |

Every domain gets a full catalog entry in Part 1.5 (`docs/architecture/DOMAINS.md`): responsibilities, data ownership, dependencies, public interfaces, database entities, business rules, events produced, events consumed, validation requirements, failure handling, automated tests.

---

## 5. Technology stack (preferred — validate in Part 1.1)

| Layer | Preferred | Notes |
|---|---|---|
| Language | TypeScript (strict) everywhere | |
| Monorepo | pnpm workspaces + Turborepo | |
| Client | Expo + Expo Router (web, iOS, Android) | Separate Next.js web app only if an ADR proves it necessary |
| Map / game rendering | `@shopify/react-native-skia` (incl. web via CanvasKit) | Validate web performance; alternative PixiJS for web |
| Backend API | Fastify (modular monolith) | NestJS acceptable if an ADR justifies the extra structure |
| Database | PostgreSQL — **the source of truth** | |
| DB access | Drizzle ORM + SQL migrations | Must support row locking (`SELECT … FOR UPDATE`) cleanly |
| Cache / queues | Redis + BullMQ | Redis is never authoritative |
| Validation / contracts | Zod, shared `contracts` package | |
| Auth | A maintained TypeScript auth library storing data in our Postgres (e.g. Better Auth) | Validate in ADR; no hand-rolled crypto |
| Realtime | WebSockets (server → client events) | |
| Push | `expo-notifications` (APNs/FCM) | |
| Testing | Vitest (unit/integration), Playwright (web E2E) | Load tests only when players exist |
| Errors / logs | Sentry + structured logs (pino) | |
| Hosting | Managed: Postgres + Redis + API + workers on one platform (e.g. Railway or Fly + Neon) | Docker Compose for **local dev only**. Verify BullMQ works with the chosen Redis. |
| CI | GitHub Actions | |

Before installing anything, check the current stable versions (do not rely on remembered versions). Any new dependency not listed here needs a one-line justification in the Part report.

---

## 6. Target repository structure

```
chronos-cradle/
├── apps/
│   ├── client/          # Expo app: web + iOS + Android
│   ├── api/             # Fastify HTTP + WebSocket server (thin: routing, auth, validation)
│   └── workers/         # BullMQ workers + reconciliation sweeper
├── packages/
│   ├── contracts/       # Zod schemas, API types, event types, error codes
│   ├── game-data/       # Versioned balance data: resources, buildings, units, techs (validated by Zod)
│   ├── game-temporal/   # Clock, timed actions, settlement ordering
│   ├── game-economy/    # Accrual math, ledger rules (pure)
│   ├── game-progression/# Construction, research, population rules (pure)
│   ├── game-world/      # World generation, coordinates, distance (pure)
│   ├── game-military/   # Units, armies, movement rules (pure)
│   ├── game-combat/     # Deterministic combat engine (pure, no I/O)
│   ├── db/              # Drizzle schema, migrations, repositories, transactions
│   ├── design-system/   # Tokens + shared UI components
│   └── config/          # tsconfig, eslint, shared tooling
├── infrastructure/      # docker-compose (local), deployment notes, runbooks
└── docs/
    ├── directive/       # this directive
    ├── architecture/    # SYSTEM_ARCHITECTURE.md, DATABASE_DESIGN.md, GAME_SIMULATION_SPEC.md,
    │                    # DOMAINS.md, TESTING_STRATEGY.md, SECURITY.md, RISKS.md, api/ (generated OpenAPI)
    ├── decisions/       # ADR-0001-*.md …
    └── PROGRESS.md
```
Create folders only when a Part needs them. You may improve this structure via an ADR.

**Dependency rule:** `game-*` packages are pure TypeScript — no database, network, clock or randomness access; those are injected. `apps/*` depend on packages, never the reverse. No circular dependencies (enforce with lint rules).

---

## 7. Non-negotiable rules

1. Architecture and specs before large-scale implementation (Section 1 gate).
2. The server is authoritative over all game state. Clients request actions; the server validates and executes.
3. One shared universe for all platforms. No platform-specific economies or simulations.
4. PostgreSQL is the source of truth. State must be fully recoverable from the database alone.
5. All game time is server-side UTC. Never trust client clocks, durations, cooldowns or completion states.
6. Timed activity is timestamp-driven (start/complete timestamps + settlement), never per-player loops.
7. Background jobs speed things up; they are **not** required for correctness. A reconciler must catch anything a job missed.
8. All economy and combat math uses **integers** (fixed-point where fractions are needed). No floats in authoritative state.
9. Every state-changing operation is transactional and idempotent (idempotency keys for client actions).
10. Combat is deterministic: same inputs + ruleset version + seed ⇒ same result. Battles are reproducible from stored records.
11. Offline players are never helpless: default orders and doctrines always apply.
12. Balance values live in `game-data`, versioned and validated — never hardcoded in logic.
13. Every gameplay formula is documented in `GAME_SIMULATION_SPEC.md` before it is implemented.
14. No untested critical logic (economy, time, combat, auth, authorization).
15. No destructive schema changes without a migration and recovery plan.
16. No secrets in the repository. Use `.env.example` with placeholders.
17. No decorative UI pretending to be gameplay. A screen is done only when it works against the real backend.
18. No premature scaling or microservices. Measure first.
19. No silent assumptions: state them in the plan or report.
20. Modular, maintainable domain architecture: each domain owns its data and rules (see `DOMAINS.md`); no domain logic in controllers, UI components or ad-hoc queries.
21. No implementation shortcuts that compromise game integrity. If a shortcut is ever necessary, it is documented as debt with the risk and a fix plan.

---

## 8. Coding standards

- TypeScript `strict`; no `any` without a commented reason.
- Domain logic lives in `packages/game-*` as pure, unit-tested functions. API handlers stay thin.
- Validate every external input with Zod at the boundary (HTTP, WebSocket, job payloads, game-data files).
- Errors: typed domain errors mapped to a single API error format defined in `contracts`.
- Time: inject a `Clock` interface; tests use a fake clock. Never call `Date.now()` inside domain code.
- Randomness: inject a seeded PRNG; never `Math.random()` in game logic.
- Naming: clear and boring beats clever. Small files, small functions.
- Commits: one logical change per commit, Conventional Commits style (`feat(economy): …`).
- Comments explain *why*, not *what*.

---

## 9. Section index (execution order)

| Section | Title | Gate |
|---|---|---|
| S01 | Architecture & Decisions | **Owner review required before S02** |
| S02 | Technical Foundation | |
| S03 | Time & Simulation Core | |
| S04 | Economy Engine | **Owner review of economy sim results** |
| S05 | Client Shell & Design System | |
| S06 | City, Construction & Research | First playable single-player loop |
| S07 | World & Map | |
| S08 | Military | |
| S09 | Combat (asynchronous) | **Owner review of combat feel** |
| S10 | Realtime & Notifications | |
| S11 | Security, Fairness & Integrity | |
| S12 | Onboarding, Polish & MVP Launch | **Closed web playtest** |
| S13 | Post-MVP Expansion | Each Part needs explicit owner approval |

Always follow `docs/PROGRESS.md` for the current position.

---

## 10. North star

A player wakes up, discovers their civilization advanced overnight, finds an incoming enemy fleet, receives an alliance request, investigates a temporal anomaly, and makes decisions that shape their empire's future. The world keeps evolving when the app is closed. The universe is shared, battles are meaningful, the economy rewards intelligent decisions, and the architecture supports years of evolution.

The first major engineering achievement is a working persistent universe with real players, real economic progression and reproducible combat — not a beautiful collection of disconnected screens.

*Build civilizations. Bend time. Rewrite history.*
