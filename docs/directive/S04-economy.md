# S04 — Economy Engine

**Goal of this section:** a correct, auditable and balanced economy for Anomalous Ore, Aetherium-24 and Flux-Matter.
**Gate:** the owner reviews the simulation harness results (Part 4.6) before S06 depends on balance values.

---

### Part 4.1 — Resource definitions & numeric model
**Goal:** resources and their numbers defined once, safely.
**Depends on:** 1.4, 2.1.
**Build:**
- `packages/game-data`: resource definitions (id, name, description, base storage) as versioned data validated by Zod at load; a `ruleset_version` identifier.
- Numeric types in `game-economy`: `Amount` (integer units, stored as `bigint`), `Rate` (fixed-point, e.g. milli-units per hour). Helper functions for safe add/subtract/multiply with explicit rounding.
**Done when:** invalid game-data fails to load with a clear error; no floats appear in economy types.
**Tests:** arithmetic helpers incl. rounding edge cases and very large values; game-data validation.

### Part 4.2 — Accrual engine
**Goal:** compute balances over time exactly as specified.
**Depends on:** 4.1, 1.4.
**Build:** pure function `accrue(state, from, to, modifiers) → state`:
- net rate = production − upkeep, with modifiers applied in the documented order;
- clamp to `[0, capacity]`; carry fractional remainder so results are path-independent;
- report deficit (net negative while empty) for consequence handling.
Integrate with settlement (3.3): accrue up to each event timestamp, apply the event (which may change rates or capacity), continue.
**Done when:** output matches every worked example in `GAME_SIMULATION_SPEC.md`.
**Tests:** worked examples; **property test:** settling in 1 step vs N random steps gives identical balances; capacity clamp; negative net rate clamps at 0; rate change mid-interval.

### Part 4.3 — Ledger & transactions
**Goal:** every change to a balance is atomic and traceable.
**Depends on:** 4.2, 3.6.
**Build:**
- `resource_balances` (per city, per resource, `amount`, `remainder`, `settled_at`) with `CHECK (amount >= 0)`.
- `resource_ledger` (append-only: city, resource, delta, reason, reference id, balance after, timestamp).
- Domain operations `spend`, `credit`, `transfer` — always inside settlement transaction, always writing ledger rows. Spend of multiple resources is all-or-nothing.
**Done when:** the sum of ledger deltas reconciles with balances for any city.
**Tests:** insufficient funds rejected without partial deduction; concurrent spends; ledger reconciliation check; replayed request applied once.

### Part 4.4 — Storage, upkeep, decay, penalties & recovery
**Goal:** limits and ongoing costs that create meaningful decisions.
**Depends on:** 4.3.
**Build:** capacity derived from buildings (via game-data effects); upkeep derived from units/buildings; **resource decay** as specified (e.g. above a storage threshold or for unstable Flux-Matter), applied inside the accrual engine so it stays path-independent; **economic penalties** for deficits (e.g. production penalty or unit desertion — as specified, never silent) and **economic recovery** rules (how penalties lift once the deficit ends); clear "why" breakdown exposed for UI (base, modifiers, upkeep, decay, net).
**Done when:** the API can return a rate breakdown for each resource and it matches the engine's numbers.
**Tests:** capacity changes when storage completes mid-interval; decay worked examples and path-independence property test; deficit triggers documented penalty; recovery lifts the penalty at the right time; breakdown totals equal engine rates.

### Part 4.5 — Resource transfers between cities
**Goal:** move resources between a player's own cities safely (needed for colonization later, built and tested now while the economy is fresh).
**Depends on:** 4.3.
**Build:** `transfer` operation as a timed action (resources leave at dispatch, arrive at `completes_at`), both ledger sides written, cancellation rules per spec. In MVP a player has one city, so this is exercised by tests and seeded test data only; the API endpoint stays disabled behind a feature flag until colonization (13.12).
**Done when:** transfers are atomic, idempotent and fully reflected in the ledger.
**Tests:** transfer arrives offline; insufficient resources; duplicate request; destination storage full (behaviour per spec).

### Part 4.6 — Economy simulation harness
**Goal:** see the economy's behavior over weeks before players do.
**Depends on:** 4.4 (extend after S06 and S08 as new sinks/sources appear).
**Build:** CLI in `tools/sim` using the real `game-*` packages: simulate N days for player profiles (casual: 2 logins/day; regular: 6/day; hardcore: 20/day) with simple build strategies. Output CSV + summary: resources over time, time-to-milestone, idle waste at cap.
**Done when:** the owner receives a summary table and charts showing progression pace per profile, with flagged balance concerns.
**Tests:** harness is deterministic for a given seed.
**Stop for owner review of balance results.**
