# PROGRESS — Chronos Cradle

Status values: `todo` · `in progress` · `done` · `partial` · `blocked`. Claude updates this file at the end of every Part.

**Current Part:** 2.1 — Monorepo scaffold. (S01 gate approved 2026-11-01; open owner decisions: O-2/O-3 before 2.10, O-9 before 12.8, O-12 at S04.)

S13 Parts are listed by number; their build order is set in `S13-post-mvp.md` and decided by the owner after the playtest.

## S01 — Architecture & Decisions  (`docs/directive/S01-architecture.md`)

| Part | Name | Status | Notes |
|---|---|---|---|
| 1.1 | Stack validation & ADRs | done (approved by owner) | ADR-0001…0010 in `docs/decisions/` (Proposed until S01 gate). Owner decisions open: TS 6.0 pin, Drizzle version rule, hosting providers/region/budget, playtest sign-in methods. |
| 1.2 | SYSTEM_ARCHITECTURE.md | done (approved by owner) | `docs/architecture/SYSTEM_ARCHITECTURE.md` (14 Mermaid diagrams, all render) + ADR-0011. Open: outbox needed by 3.4 before 10.1 (§15.1); cross-player settlement model (§4.3) to formalise in 1.3/1.4. |
| 1.3 | DATABASE_DESIGN.md | done (approved by owner) | `docs/architecture/DATABASE_DESIGN.md` + executable reference schema/checks in `docs/architecture/database/` (39 tables; 26/26 checks pass on PostgreSQL 18.6). Build-order notes for 1.6: minimal `players` in 3.3, minimal outbox in 3.4. |
| 1.4 | GAME_SIMULATION_SPEC.md | done (approved by owner) | `docs/architecture/GAME_SIMULATION_SPEC.md` + executable reference model `docs/architecture/simulation/reference-model.mjs` (all property checks pass) → generated worked examples W-1…W-17 (28 checks) and tables T-1…T-5. Balance trade-off (cost ×1.5 vs production ×1.2 → lenient late storage) flagged for the S04 gate. |
| 1.5 | Domain catalog | done (approved by owner) | `docs/architecture/DOMAINS.md`: 29 domains + 2 platform modules × 11 fields; 43 tables each owned once; 61 events, one producer each; `domains-check.mjs` passes (11 checks; mutation-tested). |
| 1.6 | Risks, testing strategy, roadmap & gate review | done (S01 gate approved 2026-11-01) | `RISKS.md` (38 risks), `TESTING_STRATEGY.md`, `S01_GATE_REVIEW.md` (13 owner decisions O-1…O-13). **Gate approved.** |

## S02 — Technical Foundation  (`docs/directive/S02-foundation.md`)

| Part | Name | Status | Notes |
|---|---|---|---|
| 2.1 | Monorepo scaffold | todo | |
| 2.2 | Local development environment | todo | |
| 2.3 | Database layer | todo | Apply the Drizzle version rule (ADR-0006); port `database/mvp-reference-checks.sql` patterns to DB tests. |
| 2.4 | Contracts package | todo | |
| 2.5 | API shell | todo | |
| 2.6 | Workers shell | todo | |
| 2.7 | Client shell | todo | |
| 2.8 | Authentication | todo | Also starts `docs/architecture/SECURITY.md` (threat model + endpoint access table), completed in 11.1. |
| 2.9 | Continuous integration | todo | Includes `reference-model.mjs` and `domains-check.mjs` as CI gates (TESTING_STRATEGY §6). |
| 2.10 | Deployment (staging) | todo | Includes the API↔DB latency gate (ADR-0009: p50 ≤ 3 ms) and needs owner decisions O-2/O-3. |

## S03 — Time & Simulation Core  (`docs/directive/S03-time-core.md`)

| Part | Name | Status | Notes |
|---|---|---|---|
| 3.1 | Clock & time utilities | todo | |
| 3.2 | Timed action model | todo | |
| 3.3a | Local settlement (one owner) | todo | Split from 3.3 in Part 1.6 (approved at the S01 gate, O-11). Ordering, derived breakpoints, accrual hook, idempotent re-settle. Creates the minimal `players` root table (6.1 extends it). |
| 3.3b | Interaction settlement (two owners, I-SETTLE) | todo | Split from 3.3. `resolveInteraction` with a test interaction kind, two-root lock order, recursion termination, simultaneous arrivals. 9.3 plugs battles in. |
| 3.4 | Scheduled completion jobs | todo | Creates the minimal `outbox_events` table + publisher for `timed_action.scheduled` (10.1 extends it). |
| 3.5 | Reconciler (crash recovery) | todo | |
| 3.6 | Concurrency & idempotency | todo | |

## S04 — Economy Engine  (`docs/directive/S04-economy.md`)

| Part | Name | Status | Notes |
|---|---|---|---|
| 4.1 | Resource definitions & numeric model | todo | |
| 4.2 | Accrual engine | todo | Port reference-model goldens W-1…W-5 and the property checks; add fast-check (justify the dependency). |
| 4.3 | Ledger & transactions | todo | |
| 4.4 | Storage, upkeep, decay, penalties & recovery | todo | Upkeep/deficit/desertion against provider interfaces with test doubles; real units wired in 8.2. |
| 4.5 | Resource transfers between cities | todo | |
| 4.6 | Economy simulation harness | todo | |

## S05 — Client Shell & Design System  (`docs/directive/S05-client-design-system.md`)

| Part | Name | Status | Notes |
|---|---|---|---|
| 5.1 | Design tokens | todo | |
| 5.2 | Core components | todo | |
| 5.3 | Navigation & responsive layouts | todo | |
| 5.4 | Data layer & state | todo | |

## S06 — City, Construction & Research  (`docs/directive/S06-city-progression.md`)

| Part | Name | Status | Notes |
|---|---|---|---|
| 6.1 | Player profile, civilization & city founding | todo | |
| 6.2 | Building definitions | todo | |
| 6.3 | Construction queue | todo | |
| 6.4 | Research | todo | |
| 6.5 | Population | todo | |
| 6.6 | City screens | todo | |

## S07 — World & Map  (`docs/directive/S07-world-map.md`)

| Part | Name | Status | Notes |
|---|---|---|---|
| 7.1 | World model | todo | |
| 7.2 | World generation | todo | |
| 7.3 | Map queries | todo | |
| 7.4 | Spawn placement & new-player protection | todo | |
| 7.5 | Neutral outposts (PvE) | todo | |
| 7.6 | Map rendering (client) | todo | Starts with the Skia renderer spike and its pass criteria (ADR-0004). |

## S08 — Military  (`docs/directive/S08-military.md`)

| Part | Name | Status | Notes |
|---|---|---|---|
| 8.1 | Unit definitions | todo | |
| 8.2 | Recruitment | todo | Wires real unit upkeep and desertion into the economy (from 4.4). |
| 8.3 | Armies & formations | todo | |
| 8.4 | Doctrines (default orders) | todo | |
| 8.5 | Movement | todo | |
| 8.6 | Military screens | todo | |

## S09 — Combat (Asynchronous MVP)  (`docs/directive/S09-combat.md`)

| Part | Name | Status | Notes |
|---|---|---|---|
| 9.1 | Combat engine package | todo | |
| 9.2 | Phases: Stasis, Clash, Rewind | todo | Must reproduce the W-13 golden hash from the reference model. |
| 9.3 | Battle orchestration | todo | |
| 9.4 | Battle records & replay | todo | |
| 9.5 | Battle reports | todo | |
| 9.6 | Combat screens & balance check | todo | |

## S10 — Realtime & Notifications  (`docs/directive/S10-realtime-notifications.md`)

| Part | Name | Status | Notes |
|---|---|---|---|
| 10.1 | Domain events & outbox | todo | |
| 10.2 | WebSocket gateway | todo | |
| 10.3 | Client sync & reconnect | todo | |
| 10.4 | Push notifications | todo | |
| 10.5 | In-game notification inbox | todo | |

## S11 — Security, Fairness & Integrity  (`docs/directive/S11-security-fairness.md`)

| Part | Name | Status | Notes |
|---|---|---|---|
| 11.1 | Authorization audit | todo | |
| 11.2 | Rate limiting & abuse controls | todo | |
| 11.3 | Audit log | todo | |
| 11.4 | Fairness rules | todo | |
| 11.5 | Multi-account & bot signals | todo | |
| 11.6 | Admin tools | todo | |

## S12 — Onboarding, Polish & MVP Launch  (`docs/directive/S12-mvp-launch.md`)

| Part | Name | Status | Notes |
|---|---|---|---|
| 12.1 | Onboarding & tutorial | todo | |
| 12.2 | Localization readiness | todo | |
| 12.3 | Visual & UX polish pass | todo | |
| 12.4 | Observability | todo | |
| 12.5 | Backups & recovery drill | todo | |
| 12.6 | Privacy, legal & compliance basics | todo | |
| 12.7 | Balance pass | todo | |
| 12.8 | Closed web playtest | todo | |

## S13 — Post-MVP Expansion  (`docs/directive/S13-post-mvp.md`)

| Part | Name | Status | Notes |
|---|---|---|---|
| 13.1 | Tactical intervention windows | todo | |
| 13.2 | Temporal abilities | todo | |
| 13.3 | Exploration | todo | |
| 13.4 | Trading & market | todo | |
| 13.5 | Alliances | todo | |
| 13.6 | Diplomacy | todo | |
| 13.7 | Temporal corruption | todo | |
| 13.8 | Great Convergence (seasons) | todo | |
| 13.9 | Monetization (owner decision required first) | todo | |
| 13.10 | Mobile store release | todo | |
| 13.11 | Scaling (only when measured) | todo | |
| 13.12 | Colonization & territorial expansion | todo | |
| 13.13 | Commanders | todo | |
| 13.14 | Strategic infrastructure | todo | |
| 13.15 | World events & seasonal events | todo | |

## SOURCE PLAN — Master Development Directive V2.0 (original, owner-provided)  (`docs/directive/SOURCE-PLAN-V2.0.md`)

| Part | Name | Status | Notes |
|---|---|---|---|
