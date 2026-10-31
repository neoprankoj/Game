# COVERAGE — Source Plan V2.0 → Directive V2.2

Every part of `SOURCE-PLAN-V2.0.md` and where it is implemented. When working on a Part, read the source-plan sections linked to it here.
If you find anything in the source plan that is not mapped, report it — do not silently drop it.

## Deliberate changes (owner-approved in V2.1/V2.2)

| Source plan said | Directive does | Why |
|---|---|---|
| Separate `apps/mobile` (Expo) and `apps/web` (Next.js) | One Expo app for web + iOS + Android (`apps/client`) | Solo developer: one UI codebase. Next.js can be added later via ADR. |
| NestJS backend | Fastify preferred, NestJS allowed via ADR (Part 1.1) | Less ceremony for one person. |
| Prisma ORM | Drizzle preferred (Part 1.1 decides) | Cleaner row locking for transactional economy. |
| "Inspect the existing repository" (Phase 0 steps 1–7) | Skipped | Starting from an empty repository. |
| 12 design documents | 7 living documents: SYSTEM_ARCHITECTURE, DATABASE_DESIGN, GAME_SIMULATION_SPEC, DOMAINS, TESTING_STRATEGY, SECURITY, RISKS + generated API spec + ADRs. GDD = `00-vision.md` + GAME_SIMULATION_SPEC. UI/UX architecture = S05. | Fewer documents a solo developer will actually keep current. |
| Operate as a team of 14 roles | Apply 14 perspectives when planning/reviewing (`CLAUDE.md` intro) | Same coverage of concerns, without role-play overhead. |
| "First response must contain 15 items" | Spread across Parts 1.1–1.6, one reviewed deliverable each | Deeper, more accurate output than one giant response. |
| Gates 1–7 / Phases 0–7 | Sections S01–S13 with owner gates after S01, S04, S09, S12 | Same principle (no auto-advancing), smaller verified steps. |
| Load testing in production prep | Deferred until real players exist (13.11) | Measure before scaling. |
| Full feature set before beta | MVP first (web), then post-MVP features one by one (S13) | Prove the fun early; keep the solo project shippable. |
| Docker for infrastructure | Docker Compose for local dev; managed hosting in production | Running your own infrastructure is a full-time job. |

## Plan preamble (sections 1–4 and 6 of the source plan)

| Source plan | Covered in |
|---|---|
| 1. Finalized game direction table | `CLAUDE.md` §3 |
| Five architectural principles | `CLAUDE.md` §7 rules 2–6, 10, 18, 20; S03; S09 |
| 2. Modular monolith, stack, repo structure | `CLAUDE.md` §5–6; Part 1.1, 1.2; S02 |
| 3A. Persistent universe engine (timestamp-driven) | S03 (3.1–3.6) |
| 3B. Resource simulation formula | Part 1.4; S04 (4.2) |
| 3C. Hybrid combat: three stages | S08 (8.3–8.5), S09, 13.1, 13.2, 13.13 |
| 3D. Permanent vs. seasonal layer | 13.8, 13.15; `00-vision.md` |
| 3E. Realtime communication | S10 |
| 4. Development gates 1–7 | `CLAUDE.md` §9 gates; S01–S13 |
| 6. SYSTEM_ARCHITECTURE / DATABASE_DESIGN / GAME_SIMULATION_SPEC / ARCHITECTURE_DECISIONS | 1.2 / 1.3 / 1.4 / 1.1 (ADRs in `docs/decisions/`) |
| 6. "Don't optimize for 100k players on day one" | `CLAUDE.md` §7 rule 18; 13.11 |
| 6. "Working persistent universe, not disconnected screens" | `CLAUDE.md` §10; rule 17 |

## Master directive V2.0 (Parts I–XVIII)

| Source plan part | Covered in |
|---|---|
| I — Mission, think independently, challenge assumptions, team roles | `CLAUDE.md` intro + perspectives; §2 protocol |
| II.1 — Cross-platform, same universe, shared contracts | `CLAUDE.md` §3; 1.2 (cross-platform architecture); 2.4; 2.7; S05 |
| II.2 — Persistent universe, offline progression, Great Convergence | S03; 13.8 |
| II.3 — Hybrid combat, doctrines, fallback orders | 8.4; S09; 13.1 |
| II.4 — Architecture first | S01 gate; `CLAUDE.md` rule 1 |
| III — Product vision, time as central mechanic | `00-vision.md`; every Section uses timed actions (S03) |
| IV.1 — Modular monolith, path to services | 1.2 (scalability path); 13.11 |
| IV.2 — Preferred stack incl. outbox pattern | 1.1; `CLAUDE.md` §5; 10.1 (outbox) |
| IV.3 — Monorepo, clear responsibilities, no circular deps | `CLAUDE.md` §6; 2.1 (lint-enforced boundaries) |
| V — 27 domains × 11 fields | `CLAUDE.md` §4 domain map; **1.5 DOMAINS.md**; full detail per domain in its Part / S13 design step |
| VI — Persistent world simulation (all 12 mandatory requirements) | UTC/clock 3.1 · offline progression 3.3 · efficient accrual 4.2 · scheduled completions 3.4 · durable jobs 2.6/3.4 · idempotent jobs 3.4 · crash recovery 3.5 · duplicate protection 3.4/3.6 · transactional transitions 3.3 · delayed jobs 3.5 · simultaneous actions 3.6 · Postgres as truth `CLAUDE.md` rule 4 |
| VII — Economy: rates, consumption, storage, modifiers, upkeep | 1.4; 4.2; 4.4 |
| VII — Resource decay, penalties, recovery | 1.4; **4.4** |
| VII — Market transactions | 1.4 (outline); 13.4 |
| VII — Resource transfers | **4.5**; enabled in 13.12 |
| VII — Offline accrual, fixed precision, transactions | 4.1–4.3; rule 8 |
| VII — Protection against duplication, double spend, concurrency, negatives, replays | 3.6; 4.3 |
| VII — Economy simulation tests across activity levels | 4.6; 12.7 |
| VIII — Battle lifecycle (10 steps) | 8.3–8.5 (prep, deployment, travel, arrival); 9.2–9.5 (initialization → report); `00-vision.md` |
| VIII — Tactical interventions (eligibility, window, costs, cooldowns, validation, fallback, audit) | 13.1 |
| VIII — Determinism, reproducibility, explainable reports | 9.1; 9.4; 9.5 |
| VIII — Offline protection | 8.4; `CLAUDE.md` rule 11 |
| IX — World: players, islands, regions, sectors, neutral entities, resource locations | 7.1; 7.2; 7.5 |
| IX — Colonies, territories | **13.12** (schema ready in 1.3, 6.1) |
| IX — Strategic infrastructure | **13.14** |
| IX — World events | **13.15** |
| IX — World partitioning, indexing, proximity queries | 1.3; 7.1; 7.3 |
| IX — Great Convergence (8 aspects, no wipe) | 13.8 |
| X — Realtime: WebSockets, reconnect, sequence numbers, event types, delivery ≠ mutation | 10.1–10.3 |
| X — Alliance, trade, diplomacy, exploration notifications | 10.1 event catalog, extended in 13.3–13.6 |
| XI — Security list (auth, roles, authz, validation, rate limits, idempotency, isolation, audit, anti-replay, abuse, admin) | 2.8; 3.6; 11.1–11.6; 1.6 (SECURITY in risks) |
| XI — Never trust client values (8 items) | `CLAUDE.md` rules 2, 5; 11.1 |
| XII — Cross-platform UX, mobile and web priorities | S05 (5.3); 6.6; 7.6; 8.6; 9.6 |
| XIII — UI and visual identity | `00-vision.md`; 5.1–5.2; 12.3 |
| XIV — 12 test types | 1.6 TESTING_STRATEGY; each Part's tests; cross-platform 2.9; load 13.11; security 11.1 |
| XIV — 9 critical scenarios | simultaneous actions 3.6 · disconnect during combat 9.3/10.3 · worker crash 3.5 · offline completion 3.3/6.3 · double submission 3.6 · seasonal event while active 13.15/13.8 · expired decision window 13.1 · interrupted movement 8.5 · failed transaction 3.6/9.3 |
| XIV — Acceptance criteria per milestone | Every Part's "Done when"; `CLAUDE.md` report format |
| XV — Observability and operations (11 items) | 2.5; 2.10; 12.4; 12.5; 3.5 (job monitoring); 4.6/12.4 (economy anomalies) |
| XVI — Phase 0 → Phase 7 | S01 → S13 (see Deliberate changes) |
| XVII — 17 non-negotiable rules | `CLAUDE.md` §7 (all 17 included, expanded to 21) |
| XVIII — Immediate assignment (15 items) | repo assessment: n/a · architecture 1.2 · stack 1.1 · monorepo 1.2/2.1 · domain boundaries 1.5 · database 1.3 · world simulation 1.4 · hybrid combat 1.4 · cross-platform 1.2 · multiplayer sync 1.2 · security 1.6 · scalability 1.2/1.6 · risk register 1.6 · ADRs 1.1 · roadmap 1.6 |
| XVIII — explain recommendation, why, alternatives, trade-offs, consequences | ADR template (1.1); 1.6 report |
| Final creative directive | `00-vision.md`; `CLAUDE.md` §10 |

## Additions beyond the source plan (from the upgrade review)
Push notifications (10.4) · map rendering decision (1.1, 7.6) · data-driven versioned balance (rule 12, `game-data`) · fairness: new-player protection, inactive players, multi-account detection (7.4, 11.4, 11.5) · time-zone fairness for interventions (13.1) · onboarding/tutorial (12.1) · localization and RTL readiness (12.2) · privacy and store compliance (12.6) · monetization vs. "time is the core resource" conflict (13.9) · hosting cost estimate (1.1).
