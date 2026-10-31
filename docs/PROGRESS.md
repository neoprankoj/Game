# PROGRESS — Chronos Cradle

Status values: `todo` · `in progress` · `done` · `partial` · `blocked`. Claude updates this file at the end of every Part.

**Current Part:** 1.1 — Stack validation & ADRs

S13 Parts are listed by number; their build order is set in `S13-post-mvp.md` and decided by the owner after the playtest.

## S01 — Architecture & Decisions  (`docs/directive/S01-architecture.md`)

| Part | Name | Status | Notes |
|---|---|---|---|
| 1.1 | Stack validation & ADRs | todo | |
| 1.2 | SYSTEM_ARCHITECTURE.md | todo | |
| 1.3 | DATABASE_DESIGN.md | todo | |
| 1.4 | GAME_SIMULATION_SPEC.md | todo | |
| 1.5 | Domain catalog | todo | |
| 1.6 | Risks, testing strategy, roadmap & gate review | todo | |

## S02 — Technical Foundation  (`docs/directive/S02-foundation.md`)

| Part | Name | Status | Notes |
|---|---|---|---|
| 2.1 | Monorepo scaffold | todo | |
| 2.2 | Local development environment | todo | |
| 2.3 | Database layer | todo | |
| 2.4 | Contracts package | todo | |
| 2.5 | API shell | todo | |
| 2.6 | Workers shell | todo | |
| 2.7 | Client shell | todo | |
| 2.8 | Authentication | todo | |
| 2.9 | Continuous integration | todo | |
| 2.10 | Deployment (staging) | todo | |

## S03 — Time & Simulation Core  (`docs/directive/S03-time-core.md`)

| Part | Name | Status | Notes |
|---|---|---|---|
| 3.1 | Clock & time utilities | todo | |
| 3.2 | Timed action model | todo | |
| 3.3 | Settlement ("bring state up to now") | todo | |
| 3.4 | Scheduled completion jobs | todo | |
| 3.5 | Reconciler (crash recovery) | todo | |
| 3.6 | Concurrency & idempotency | todo | |

## S04 — Economy Engine  (`docs/directive/S04-economy.md`)

| Part | Name | Status | Notes |
|---|---|---|---|
| 4.1 | Resource definitions & numeric model | todo | |
| 4.2 | Accrual engine | todo | |
| 4.3 | Ledger & transactions | todo | |
| 4.4 | Storage, upkeep, decay, penalties & recovery | todo | |
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
| 7.6 | Map rendering (client) | todo | |

## S08 — Military  (`docs/directive/S08-military.md`)

| Part | Name | Status | Notes |
|---|---|---|---|
| 8.1 | Unit definitions | todo | |
| 8.2 | Recruitment | todo | |
| 8.3 | Armies & formations | todo | |
| 8.4 | Doctrines (default orders) | todo | |
| 8.5 | Movement | todo | |
| 8.6 | Military screens | todo | |

## S09 — Combat (Asynchronous MVP)  (`docs/directive/S09-combat.md`)

| Part | Name | Status | Notes |
|---|---|---|---|
| 9.1 | Combat engine package | todo | |
| 9.2 | Phases: Stasis, Clash, Rewind | todo | |
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
