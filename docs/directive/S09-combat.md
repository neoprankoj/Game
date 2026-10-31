# S09 — Combat (Asynchronous MVP)

**Goal of this section:** deterministic, explainable battles resolved by the server through Stasis, Clash and Rewind, using doctrines. No live intervention windows yet (post-MVP, S13).
**Gate:** the owner plays/reviews battles and approves "combat feel" before S10.

---

### Part 9.1 — Combat engine package
**Goal:** a pure, deterministic simulation.
**Depends on:** 1.4, 8.1, 8.4.
**Build:** `packages/game-combat`:
- Input: attacker and defender sides (units, formations, doctrines, techs, fortifications), `ruleset_version`, `seed`. Also accept — empty in MVP — commanders, active temporal abilities and a list of player decisions per phase boundary, so post-MVP features (13.1, 13.2, 13.13) extend the engine without changing its shape.
- Seeded PRNG implementation chosen in the spec (e.g. a small, well-known integer PRNG); no `Math.random`, no floats, no clock, no I/O.
- Output: outcome, per-phase log, losses, survivors, loot calculation inputs.
- Ruleset registry: old rulesets stay available so old battles can be replayed.
**Done when:** the engine runs in tests with no infrastructure at all.
**Tests:** determinism (1,000 random seeded battles run twice → identical); no float leakage (assert integers everywhere).

### Part 9.2 — Phases: Stasis, Clash, Rewind
**Goal:** three phases with distinct strategic meaning, as defined in the spec.
**Depends on:** 9.1.
**Build:** implement each phase per `GAME_SIMULATION_SPEC.md` (suggested: Stasis = positioning and initial modifiers; Clash = fixed rounds of damage; Rewind = limited recovery of losses based on tech and doctrine). Doctrines and retreat thresholds apply between phases — these are the exact points where post-MVP intervention windows will later insert player decisions, so keep phase boundaries explicit in the code.
**Done when:** every worked example in the spec matches exactly.
**Tests:** worked examples; edge cases (empty defender, overwhelming attacker, retreat triggered, equal forces).

### Part 9.3 — Battle orchestration
**Goal:** turn an army's arrival into a committed battle result.
**Depends on:** 9.2, 8.5, 3.3.
**Build:** on movement arrival: settle both sides to arrival time → lock both sides (lock order!) → snapshot inputs → generate seed → run engine → apply losses, loot (ledger entries), outpost/city effects → create battle record and report → schedule return movement → emit events. All in one transaction; idempotent if the arrival is processed twice.
**Done when:** battles between offline players resolve correctly at arrival time.
**Tests:** processed twice → one battle; defender building/recruiting at the same moment; attacker's target gained protection mid-flight; transaction failure leaves no partial result.

### Part 9.4 — Battle records & replay
**Goal:** every battle can be audited and reproduced.
**Depends on:** 9.3.
**Build:** `battles` table storing input snapshot, `seed`, `ruleset_version`, result hash. Admin/dev command `replay(battleId)` reruns the engine and compares the hash.
**Done when:** replay of stored battles matches 100%.
**Tests:** replay golden tests; ruleset upgrade does not change replays of older battles.

### Part 9.5 — Battle reports
**Goal:** players understand why they won or lost.
**Depends on:** 9.4.
**Build:** report data per participant (with correct visibility — defender may see less about attacker per spec): forces, phase-by-phase summary, key moments (e.g. "Rewind restored 12% of your line infantry"), losses, loot, and 1–3 plain-language insights derived from the log (e.g. counter matchups).
**Done when:** a non-technical player can explain the outcome from the report alone.
**Tests:** visibility rules; insight generation for known scenarios.

### Part 9.6 — Combat screens & balance check
**Goal:** reports that read beautifully, plus a balance sanity check.
**Depends on:** 5.3, 9.5.
**Build:** reports inbox, report detail screen (phase timeline, losses, insights), battle simulator in a dev tool to compare compositions; extend the S04 harness with combat scenarios (counter checks, no dominant single-unit strategy).
**Done when:** E2E: attack outpost → read report; balance summary delivered to owner. **Stop for owner review.**
