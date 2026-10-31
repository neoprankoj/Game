# GAME_SIMULATION_SPEC — Chronos Cradle: Temporal Empires

| Field | Value |
|---|---|
| Status | Draft for the S01 gate (Part 1.4). Combat feel is reviewed again at the S09 gate; balance values at the S04 gate and in 12.7 |
| Last updated | 2026-10-31 |
| Ruleset described | **ruleset 1** (MVP) |
| Executable reference | [`simulation/reference-model.mjs`](simulation/reference-model.mjs) → generates [`simulation/worked-examples.generated.md`](simulation/worked-examples.generated.md) |

This is the single source of truth for **every gameplay formula** (rule 13). Nothing in Parts 3–12 may compute game state with a formula that is not written here. If an implementation needs a new formula, this document is updated first.

**How the numbers were verified.** Every worked example (`W-1` … `W-17`) and every starter table (`T-1` … `T-5`) is *computed* by the reference model. Nothing was typed by hand. The model also runs property checks (§12), all passing at the time of writing:
- the closed-form accrual equals millisecond-by-millisecond simulation (3,000 random cases);
- settling once equals settling in pieces (5,000 cases, including production scale);
- the PRNG matches the published C reference;
- 1,000 random battles replay to identical hashes, with integers only;
- a hand-traced combat strike equals the engine.

Parts 4.2 and 9.1–9.2 port these examples into Vitest golden tests. The TypeScript implementation must reproduce them **exactly**.

Notation: `⌊x⌋` floor, `⌈x⌉` ceiling. "bp" = basis points (10000 = 100%). Every division is integer division unless written otherwise.

---

## 1. Time model

### 1.1 Authority and representation
- The server clock (injected `Clock`, UTC) is the only authority. Game time is **integer milliseconds since the Unix epoch** (`Instant`), stored as `timestamptz` truncated to whole milliseconds.
- Durations are **integer milliseconds**. Game-data durations are given in seconds; computed durations are rounded **up** to whole seconds unless stated otherwise.
- Clients call `GET /time` to compute `offset = server_now − client_now`. Countdowns display `completes_at − (client_now + offset)`. That is display only; the client never decides completion.
- Within one operation, `t = clock.now()` is captured **once**. Every check and write in that operation uses this `t`. The effective settlement time is `max(t, settled_at)`, so small clock differences between servers never move time backwards.

### 1.2 Timed-action lifecycle
```
scheduled ──(settlement reaches completes_at)──▶ completed   (terminal)
    └──────(owner cancels before completes_at)──▶ cancelled  (terminal)
```
- A cancel request at or after `completes_at` first settles. The action is then already completed and cannot be cancelled.
- Every action stores the `ruleset_version` active when it was **created**. Its **costs and duration are frozen** in its payload at creation.
- Payload per kind (Zod-validated):

| kind | Owner | Payload |
|---|---|---|
| `construction` | player (+ `city_id`) | building_type, to_level, cost[ore, aeth, flux], pop_reserved, duration_ms, queue_position |
| `research` | player | tech_id, to_level, cost, duration_ms |
| `recruitment` | player (+ `city_id`) | unit_type, count, cost, pop_reserved, duration_ms |
| `movement` | player (+ `target_*` if interaction) | row in `movements` (mission, army, target) |
| `transfer` (4.5, flagged off) | player | from_city, to_city, resources |
| `outpost_respawn` | outpost | tier |

### 1.3 Settlement ordering
Settlement brings an owner from `settled_at` to `t` (SYSTEM_ARCHITECTURE §4.3). Due items are processed in this total order:
1. by **instant** (ascending);
2. at the same instant: **derived economy breakpoints** (§3.6, §10.3, §1.5) **before** timed actions;
3. among timed actions at the same instant: **local actions before interactions**;
4. then by **`id`** (UUIDv7, ascending).

Between consecutive items, every city of the player is **accrued** (§3) to the item's instant. The item is then applied, which may change rates, capacity or units, and the loop continues. After the last item, all cities are accrued to `t`.

**Interactions** (army arrivals at another owner) are resolved under invariant I-SETTLE. Before an interaction at instant `τ` resolves, both participants are settled through all their local items with instant `≤ τ`, and through all their interactions that come earlier in the order above. Recursion only reaches earlier keys, so it terminates.

### 1.4 Example
**W-5**: an extractor upgrade completes at 10:40 and the player reads at 12:00. The settlement splits production into 40 min at 35/h and 80 min at 41/h, giving 300 → **378 ore**. Settling at 10:20, 11:00 and 12:00 instead gives the identical balance and remainder.

### 1.5 Ruleset versions
- A ruleset is an immutable `game-data` bundle plus engine version, registered in `ruleset_versions` with an `activated_at` instant.
- **Frozen at creation:** an action's cost, duration and pop reservation.
- **Evaluated per time segment:** rates, capacities, upkeep and combat stats. Each uses the ruleset active during that segment. `activated_at` is a global derived breakpoint, so a player settled after a balance change is still accrued with the old rates up to the activation instant.
- **Combat** uses the ruleset active at the battle instant (arrival). The battle stores it (§9.9).

---

## 2. Numeric model

| Quantity | Representation | Notes |
|---|---|---|
| Resource amount | `bigint` whole units + `remainder` | |
| Rate | integer **milli-units per hour** (mu/h) | 7 ore/h = 7000 |
| Internal balance | **N = amount × D + remainder**, with **D = 1000 × 3,600,000 = 3.6 × 10⁹** | chosen so that **per millisecond, N changes by exactly the rate in mu/h**: no division during accrual, hence no rounding |
| Percentages | basis points | |
| Population | same machinery as resources (pop units, milli-pop per hour) | |
| Combat | integers; multiply then `⌊/10000⌋` at each documented step | §9 |

**Rounding rules**
1. Accrual never rounds: it is integer addition in N-space. The displayed amount is `⌊N / D⌋`, and the fraction stays in `remainder`.
2. Every `× bp / 10000` step floors **immediately**, in the order written in this spec (order matters and is part of the rules).
3. Costs, refunds and loot floor. Durations round **up** (never shorter than the formula).
4. Any amount that crosses the wire is a decimal string (bigint-safe).

**Path independence.** Because accrual is exact integer arithmetic on a deterministic per-millisecond dynamic (§3.2), settling once or a hundred times gives the **identical** N. This is property-checked at both small scale (against brute force) and production scale. **W-1**: 10 × 1 min at 7 ore/h equals 1 × 10 min: 1 ore + the same remainder.

---

## 3. Resource accrual

### 3.1 Per resource, per city, inside one segment (constants)
- `p` production (mu/h, ≥ 0, after modifiers §4.2)
- `u` upkeep (mu/h, ≥ 0)
- `C` capacity (units)
- `S` stable level (units, `S ≤ C`)
- `d` decay rate (mu/h)

### 3.2 Dynamics: three regions with sticky boundaries
In N-space the balance moves with a velocity (N per ms) that depends on its region:

| Region | Range | Velocity |
|---|---|---|
| R1 below stable | `0 ≤ N < S·D` | `p − u` |
| R2 unstable band (only if `S < C`) | `S·D ≤ N < C·D` | `p − u − d` |
| R3 at/above capacity | `N ≥ C·D` | `−u − d` (no production at capacity) |

**One millisecond** = `N ← N + v(region(N))`, with two rules at boundaries:
- **Sticky boundary:** if a step would cross a boundary and the velocity on the other side has the opposite sign (or is 0), the balance stops exactly **on** the boundary and stays there (equilibrium). Example: production holds the balance at the cap; decay and production balance at the stable level.
- **Floor:** the balance never goes below 0. Reaching 0 while the velocity is negative starts a **deficit** (§3.6).

This per-millisecond map *is* the definition. Implementations evaluate it in **closed form** (O(number of regions)):

```
accrue(N, Δt):
  while Δt > 0:
    v = velocity(N)
    if v == 0: stop
    if v > 0:
      b = upper boundary of region (none in R3 → N += v·Δt; stop)
      k = ⌈(b − N) / v⌉                      # ms until reaching/crossing b
      if Δt < k: N += v·Δt; stop
      if velocity(b) ≤ 0: N = b; stop         # sticky
      N += v·k; Δt −= k                       # overshoot into next region
    else:
      b = lower boundary of region (0 in R1)
      k = ⌊(N − b) / −v⌋ + 1                  # ms until strictly below b
      if Δt < k: N += v·Δt; stop
      if b == 0: deficit_at = ⌈N / −v⌉; N = 0; stop
      if velocity(b − 1) ≥ 0: N = b; stop     # sticky
      N += v·k; Δt −= k
```
Validation assumes `|v| < D` (less than 3.6 million units/hour), so one step never crosses two boundaries.

### 3.3 Capacity
```
C_r = ⌊ ⌊(nexus_cap(L_nexus) + vault_cap(L_vault)) × capFactor_r / 10000⌋ × (10000 + 1000 × storage_engineering) / 10000 ⌋
nexus_cap(L) = series(300, ×1.40) · vault_cap(L) = series(200, ×1.40) · capFactor: ore 10000, aetherium 10000, flux 2000
```
**W-2**: 990 ore, cap 1,000, 30/h. The cap is reached after exactly 20 min; then **20 ore** are wasted in the remaining 40 minutes. Waste at cap is shown in the economy breakdown and measured by the 4.6 harness ("idle waste").

### 3.4 Decay: decision and justification
**Rule:** each resource has a **stable level** `S = ⌊C × stable_bp / 10000⌋`. Any amount **above S decays** at `d = ⌊C × 1000 × decay_bp_per_hour / 10000⌋` mu/h.

| Resource | stable_bp | decay_bp_per_hour | Effect |
|---|---|---|---|
| Anomalous Ore | 10000 (S = C) | 1000 | only **overflow above capacity** (from loot/transfers) decays, 10% of C per hour |
| Aetherium-24 | 10000 (S = C) | 1000 | same |
| **Flux-Matter** | **5000** (+1000 per Flux Stabilization level) | **500** (−100 per level) | Flux is **unstable**: anything above half of capacity decays |

**Why this design.**
- *Time as a resource:* Flux cannot be hoarded indefinitely. Spending it on time is the decision.
- *Loot is not wasted instantly:* a raid that overfills storage leaves a few hours to spend the surplus. That is a timing decision, not a silent loss.
- *Readable:* one rule ("above the stable level, it decays") with two parameters.
- *Exact:* it stays piecewise-linear, so settlement remains path-independent. Proportional (exponential) decay was rejected because it cannot be computed exactly in integers independently of the settlement path.
- Ore and Aetherium only decay above capacity, so the base economy stays easy to learn.

**W-3:** 1,300 ore with cap 1,000 → 1,200 after 1 h, back at 1,000 after 3 h.
**W-4** (Nexus 5 + Vault 5): Flux cap 383, S = 191, decay 19.15/h:
- from 300 with a 6/h refinery → 234 after 5 h, pinned at 191 from ~8.3 h;
- from 100 → 160 after 10 h, then held at 191;
- a 30/h refinery still grows above S at +10.85/h: 299 after 10 h, then the cap at 383.

### 3.5 Offline accrual
Offline time is not special. Settlement applies the same function across the whole interval, split at every event (W-5). Read-only projections for display (SYSTEM_ARCHITECTURE §4.3) call the same pure function without persisting.

### 3.6 Economic penalties and recovery (Aetherium deficit)
Upkeep is paid in **Aetherium-24** (units only; buildings have no upkeep in ruleset 1, which avoids feedback loops). A **deficit** starts at the instant Aetherium reaches 0 with negative velocity: a derived breakpoint at `deficit_at` from §3.2.

| While in deficit | Value | Notes |
|---|---|---|
| Flux production halted | Flux `p = 0` (modifier step 4, §4.2) | "temporal instruments need power" |
| Morale penalty | −2000 bp attack for units of that city in combat | §9.3 |
| **Desertion** (after a 12 h grace) | at `deficit_start + 12 h + k × 1 h`: each unit stack of the city loses `max(1, ⌊count × 1000 / 10000⌋)` | derived breakpoints; reduces upkeep |
| Notifications | `resources.deficit_started`, one `units.deserted` per tick, `resources.deficit_ended` | never silent |

**Recovery.** The deficit ends at the first event after which Aetherium is > 0 or its velocity is ≥ 0 (a building completes, units die, the player disbands units, or desertion lowers upkeep). Effects at the end:
- Flux production resumes immediately;
- the morale penalty lingers until `ended_at + 2 h` (`resource_deficits.recovery_until`);
- desertion stops.

**W-6** (30 sentinels, Aetherium 20, net −12/h):
- deficit at +1 h 40 min;
- desertion ticks from +13 h 40 min: 30 → 27 → 25 → 23 → 21;
- a Condenser completes at +17 h and ends the deficit;
- at +20 h: 37 Aetherium, 33 Flux; morale normal again after +19 h.

---

## 4. Economy model

### 4.1 Resources (ruleset 1)
| Resource | Role | Main producer | Main sinks |
|---|---|---|---|
| Anomalous Ore | common base | Ore Extractor | construction, basic units |
| Aetherium-24 | energy | Aetherium Condenser | research, advanced buildings, **all unit upkeep** |
| Flux-Matter | rare, unstable temporal | Flux Refinery (needs Temporal Refining) | late techs, chrononauts, post-MVP temporal abilities |

### 4.2 Production and the order of modifiers
```
base_r = nexus_base_r + Σ_producers prod(L)               # nexus_base: ore 5/h, aeth 3/h, flux 0
p_r    = base_r
p_r    = ⌊p_r × (10000 + island_bonus_bp_r) / 10000⌋         # 1. island bonus
p_r    = ⌊p_r × (10000 + research_bp_r)   / 10000⌋           # 2. research (sum of levels × 1000)
p_r    = ⌊p_r × activity_factor_bp        / 10000⌋           # 3. activity: active 10000, inactive 5000, dormant 0
p_r    = deficit ∧ r = flux ? 0 : p_r                         # 4. deficit penalty
         # post-MVP slots, in this order: 5. world events · 6. temporal corruption · 7. strategic infrastructure
prod(L) = series(prod1, ×1.20)   # Extractor 30/h, Condenser 20/h, Refinery 5/h at L1
series(v1, g, L) = v1 iterated L−1 times with v ← ⌊v × g_bp / 10000⌋
```
Upkeep: `u_aeth = Σ units_of_city count × upkeep_mu` (exact; 0 when dormant). Units count toward upkeep from completion until death, desertion or disbanding, whether in garrison or in an army anywhere.

**Breakdown exposed to the UI** (4.4): base · island · research · activity · deficit penalty · upkeep · decay (current region) · net · time to cap / time to zero · waste at cap. The breakdown is computed by the same functions, so it always equals the engine.

**W-9** includes a research-modified rate: Nexus 5 + Extractor L3 43.2 = 48.2/h × 1.2 = **57.84/h**. **W-16** walks through the full order (island +15%, research +10% → 71.902/h; inactive → 35.951/h; dormant → 0 production and 0 upkeep).

### 4.3 Resource transfers (Part 4.5; feature-flagged off until 13.12)
- Between two cities of the same player, as a timed action: resources are **debited at dispatch** (`transfer.out` ledger rows) and **credited at arrival** (`transfer.in`).
- Travel uses §8 with caravan speed 8 cells/h. Maximum per transfer = `500 × Command Nexus level` units in total.
- **Destination over capacity:** accepted. The excess becomes overflow and decays per §3.4 (same as loot), so nothing is silently destroyed.
- **Cancel** before arrival: the caravan returns and arrives back after the time already travelled; the resources are re-credited at the origin.
- **W-17:** 600 ore over 13 cells at 8 cells/h takes 1 h 37 min 30 s; arriving at a colony holding 700/1000 gives 1300, and the overflow then decays.

### 4.4 Market transactions (post-MVP outline, finalised in 13.4)
Outline — to be finalised in S13:
- caravans with travel time (no instant global market), keeping time central;
- escrow through ledger reasons `market.escrow` / `market.release`;
- a fee of 5–10% as a resource sink;
- anti-alt rules: flows between linked accounts flagged (11.5); price bands relative to a rolling median.

---

## 5. Construction, research, recruitment

Shared series rule: **cost(L) = series(cost1, costG, L)**, applied per resource. **base_duration(L) = series(dur1, durG, L)** seconds. **Effective duration** = `⌈base × 10000 / (10000 + speed_bp)⌉ s`, minimum 1 s. The speed building gives `speed_bp = 500 × (level − 1)`.

### 5.1 Construction (Part 6.3)
- Speed comes from the **Command Nexus**. A building's target level must be ≤ the current Nexus level (the Nexus itself is capped at 10 in ruleset 1).
- **Queue:** per city at most **2 entries**, executed sequentially. Entry 2 starts at entry 1's `completes_at`. A building may appear only once in the queue (DB-enforced).
- **At enqueue:** prerequisites are checked; the cost is debited; population `pop_per_level` is reserved; the duration is computed **and frozen**.
- **Completion:** level + 1. Effects (rates, capacity, population cap) change at exactly `completes_at`, which is a settlement segment boundary.
- **Cancel the active entry:** refund `⌊cost × 8000 / 10000⌋` and release population. The waiting entry starts at the cancel instant with its frozen duration.
- **Cancel a waiting entry:** 100% refund.
- **W-17** shows the queue shift: cancelling the active entry at 10:02 moves the waiting entry to start at 10:02 with its frozen duration.
- **W-8:** Ore Extractor to L3 costs 135/45/0, takes 307 s base, **280 s** with Nexus 3; cancel refund 108/36/0.

### 5.2 Research (Part 6.4)
- **One active research per player**, no waiting entry in the MVP. It requires Research Spire level ≥ `2 × tier − 1`. Speed comes from the Spire.
- Cost and duration use the same series. Completion adds the tech level. Effects apply from `completes_at` to every city of the player (the reason the settlement unit is the player).
- Cancel: 80% refund.
- **W-9:** Ore Refinement L2 costs 180/144/0 and takes **1473 s** with Spire 3.

### 5.3 Recruitment (Part 8.2)
- Per city at most **3 batches**, sequential; batch size 1–500. Speed comes from Barracks.
- `duration = ⌈train_s × count × 10000 / (10000 + speed_bp)⌉`. Cost = unit cost × count, debited at enqueue. Population `unit_pop × count` reserved at enqueue.
- At completion the whole batch is added to the city garrison, and upkeep starts.
- Cancel active: 80% refund and population released; the next batch starts at the cancel instant. Cancel waiting: 100%.
- **W-10:** 25 sentinels at Barracks 2 cost 1250/500/0 and take **1429 s**.

### 5.4 Prerequisites
Building, tech and unit prerequisites are data (`game-data`). They are validated at load (no dangling references, no cycles; every cost fits the storage reachable when it can be paid, §11) and checked at enqueue under the root lock.

---

## 6. Population (MVP)

- **Capacity:** `pop_cap = 100 + series(60, ×1.25, L_habitat)`.
- **Growth:** linear, `5% of capacity per hour`, using the same accrual machinery (R1 velocity = growth, sticky at the cap, no decay).
- **Employed** = Σ buildings `pop_per_level × level`. **Drafted** = Σ units `pop × count`, including batches in training (reserved).
- **Free** = `⌊population⌋ − employed − drafted − reserved_for_queued_construction`. Construction and recruitment require free ≥ cost. Nothing else uses population in the MVP (no job assignment; the spec does not justify it yet).
- **Shortage:** in ruleset 1, population never decreases (capacity cannot shrink), so a shortage is impossible. If later systems shrink capacity (13.7 corruption, 13.12 capture), the rule is: new population-consuming actions are blocked, and nothing is destroyed.
- **W-7:** cap 160, growth 8/h. From 40 → 72 after 4 h; capped at 160.

---

## 7. World geometry (Part 7.1–7.4)

- Integer grid per region. Islands are sparse cells (DATABASE_DESIGN §4.6).
- **Distance (Euclidean, integer):** `dist_milli = isqrt((dx² + dy²) × 10⁶)` with an exact integer square root (floor). One cell = 1000 milli-cells.
- **Spawn placement (7.4):** a free spawn-zone island, chosen to:
  - keep **≥ 6 cells** to the nearest other city;
  - prefer distance ≥ 15 cells from any player whose power score (§10.2) is more than 3× the median new-player power;
  - break ties by seeded randomness (seed stored with the placement).
- **W-16:** a candidate 5.0 cells from an existing city is rejected; one at 6.0 cells is allowed.

---

## 8. Movement (Part 8.5)

```
speed_milli_per_h = ⌊ min_over_units(speed_cells_per_h × 1000) × (10000 + 1000 × logistics) / 10000 ⌋
travel_ms = ⌈ dist_milli × 3,600,000 / speed_milli_per_h ⌉ → rounded up to whole seconds → minimum 60,000 ms
```
- **Missions (MVP):** `attack_outpost`, `attack_city`, `return`. `reinforce` (own cities) is specified for 13.12; with one city it is unreachable.
- **Recall:** only while outbound. The army turns around at the recall instant and arrives home after the **time already travelled**. Return trips cannot be recalled.
- **After a battle:** survivors return over the same distance at their (possibly faster) current speed, carrying loot as `movement_cargo`.
- **Validation at dispatch:**
  - the army is home and not empty;
  - the target exists;
  - `attack_city` targets are not the player's own, and not protected (§10.1);
  - a player under protection who dispatches `attack_city` **ends their own protection**.
- **Re-validation at arrival** (target may have changed): city destroyed or moved (post-MVP), or owner changed to self → **aborted**, army returns. A target that became dormant is still valid.
- **Visibility:** at dispatch the defender sees `movement.incoming` with arrival time, origin and a **size class** (1–20, 21–100, 101–500, 500+ units). The composition stays hidden. This gives offline players time to react (pillar 2).
- **W-11:** 5 cells at 6 cells/h = **50 min**; with Logistics 1 = 45 min 28 s; skiff riders only = 25 min. The 1-minute floor cannot trigger with ruleset-1 speeds (the shortest possible trip is 7 min 5 s); it exists for future fast units and gates.

---

## 9. Combat (ruleset 1)

### 9.1 Inputs (`BattleInput`, stored as `battles.input_snapshot`)
```
{ rulesetVersion,
  attacker: { stacks:[{unit,count}], formation, stance, retreatBp, rewindPriority,
              tech:{weapon_alloys, aether_shielding, rewind_mastery}, morale(bool), rewindEnabled },
  defender: { …same…, wallLevel },                 # city: garrison + armies at home; outpost: garrison, no Rewind
  commanders: [], abilities: [], decisions: [] }    # post-MVP inputs; MUST be empty in ruleset 1
```
Stacks are merged per unit type and processed in the **canonical unit order** from game-data: sentinel, lancer, colossus, skiff_rider, rift_ram, chrononaut.

### 9.2 Seeded PRNG
- **Algorithm:** **xoshiro128\*\*** (Blackman & Vigna), 128-bit state = 16 seed bytes read as four little-endian u32 words. The all-zero state is invalid and is regenerated.
- **Seed:** 16 bytes from the server's CSPRNG **at resolution time**, stored in `battles.seed`. Clients never see the seed before resolution.
- **Uniform integer in [0, n):** `threshold = (2³² − n) mod n`; draw `x` until `x ≥ threshold`; return `x mod n` (unbiased).
- **Draw order (exhaustive):**
  1. one draw `uniform(10000)` in Stasis;
  2. then per Clash round: attacker stacks alive (canonical order), then defender stacks alive, one `uniform(2001)` each.
  No other code may draw.
- **Test vector (W-12):** state {1, 2, 3, 4} → 11520, 0, 5927040, 70819200, 2031721883, 1637235492, identical to the C reference compiled during this Part.

### 9.3 Stasis — preparation and positioning
1. **Battlefield condition**, from `roll = uniform(10000)`:

| Roll | Condition | Effect (both sides) |
|---|---|---|
| < 6000 | calm | none |
| < 7500 | aether storm | ranged attack −1500 bp |
| < 9000 | temporal fog | no flanking; all attack −500 bp |
| < 10000 | chrono surge | Rewind +500 bp |

2. **Lines** come from the formation:

| Formation | Front line | Modifiers |
|---|---|---|
| balanced (default) | infantry, heavy, siege, cavalry | — |
| vanguard (Tactical Doctrine) | all except temporal | +1000 bp attack (front); −1000 bp armor (all) |
| defensive_line (Tactical Doctrine) | infantry, heavy | +1500 bp armor (front); −1000 bp attack (all) |

3. **Stance** (doctrine): aggressive +1000 attack / −1000 armor; balanced 0; defensive −1000 / +1000.
4. **Tech:** +500 bp attack per Weapon Alloys level; +500 bp armor per Aether Shielding level.
5. **Morale:** −2000 bp attack if the side's city is in deficit or recovery (§3.6).
6. **Fortification** (defender city only): `wall_bp = max(0, 500 × wall_level − 100 × attacking rift rams)` added to the defender's armor. Examples: Wall 2 with no rams = +1000 bp (W-13); Wall 5 against 8 rams = 2500 − 800 = **+1700 bp**.
7. **Sum and clamp:** `atk_bp` and `armor_bp` are **sums** of the above added to 10000, then clamped to a minimum of 2000. Additive bp keeps reports readable ("+10% stance, +5% tech, −5% fog").

### 9.4 Clash — 6 rounds of simultaneous exchange
Before each round: if either side has no living units, Clash ends. All strikes in a round are computed from the state **at the start of the round** and applied together. Simultaneous resolution removes any first-strike snowball.

**Target line:**
- the enemy front line if it has living units, otherwise the back line;
- **cavalry flanks**: it targets the back line if that has living units, unless the condition is temporal fog.

**Damage** from stack `s` to each target stack `t` in the chosen line. Floors happen in exactly this order:
```
raw   = count_s × attack_s
raw   = ⌊raw × atk_bp_s / 10000⌋
raw   = ⌊raw × variance_s / 10000⌋                  # variance_s = 9000 + uniform(2001) → ±10%
part  = ⌊raw × hp_pool_t / hp_pool_line⌋           # split by remaining HP share
part  = ⌊part × counter(class_s, class_t) / 10000⌋  # T-4
armor = ⌊armor_t × armor_bp_t / 10000⌋
dmg   = ⌊part × 50 / (50 + armor)⌋                  # K = 50: diminishing returns, never immune
```
**Apply:** `wounds_t += Σ dmg`; `deaths = min(count, ⌊wounds / hp⌋)`; `wounds −= deaths × hp`. A dead stack clears its wounds. Wounds carry between rounds, so small hits accumulate.

**Retreat** (attacker only in the MVP; cities and outposts never retreat): after each round, if the attacker's remaining HP pool × 10000 < initial pool × `retreatBp`, the attacker retreats and Clash ends.

**Counter cycle (T-4):** infantry > cavalry > ranged > heavy > infantry. Siege breaks walls but fights poorly (×0.5). Temporal units are support (×0.8) whose value is Rewind.
The back line (ranged, temporal in balanced formation) is protected until the front falls or cavalry flanks. That gives formations real meaning.

**Hand-checkable strike (W-13):** 40 sentinels at 11000 bp with variance 9140 give raw **402**. Split over the defender front (HP pool 1730):
- → sentinels: 290 × 1.0 → armor 12 → **233** damage;
- → colossi: 111 × 0.8 = 88 → armor 30 → **55**.
Both equal the engine's values.

### 9.5 Outcome (after Clash)
| Condition | Outcome |
|---|---|
| attacker retreated | `attacker_retreat` |
| defender has no units, attacker has | `attacker_victory` |
| attacker has no units (including mutual destruction) | `defender_victory` |
| both have units after 6 rounds | `stalemate`: the defender holds, the attacker returns without loot |

**W-14:** 15 sentinels + 5 lancers clear a tier-1 outpost in 4 rounds, while 10 sentinels with a 50% retreat threshold retreat after round 1 against a large garrison.

### 9.6 Rewind — temporal correction
Rewind undoes part of each side's Clash losses. It rewards preparation (tech, chrononauts kept alive in the back line, doctrine priority).
```
rewind_bp = min(3000, 1000 + 500 × rewind_mastery + min(1000, 200 × ⌊alive_chrononauts / 10⌋) + 500·[chrono surge])
rewind_bp = ⌊rewind_bp × factor / 10000⌋   # factor: winner/stalemate 10000; loser/retreating 5000
```
**Allocation by doctrine `rewindPriority`:**
- **proportional:** `restored_t = ⌊losses_t × rewind_bp / 10000⌋`.
- **elite / numbers:** budget = `⌊Σ losses_t × value_t × rewind_bp / 10000⌋` with `value = ore + 2·aeth + 5·flux` cost. Restore the most (elite) or least (numbers) valuable units first, greedily. Ties follow the canonical order.

Neutral outposts have no Rewind (`rewindEnabled = false`). The outcome is **not** changed by Rewind; it only restores units.

### 9.7 Results
- Final survivors = post-Clash counts + restored.
- Losses = initial − survivors.
- The phase log (Stasis modifiers, every strike with variance and per-target damage, deaths per round, retreat, Rewind) is stored in `battles.result` and feeds the battle report (9.5).
- **W-13** full battle: `attacker_victory` in round 5. The attacker loses 16 sentinels and 5 skiff riders; the defender keeps 1 colossus (restored by elite Rewind at 750 bp).

### 9.8 Loot (orchestration, Part 9.3)
```
carry       = Σ attacker survivors × carry
protected_r = ⌊C_r × (1000 + 200 × L_vault) / 10000⌋
lootable_r  = max(0, balance_r − protected_r)
take        = min(carry, Σ lootable)                         # × 2500/10000 if weak target (§10.2)
per_r       = ⌊take × lootable_r / Σ lootable⌋ + largest-remainder distribution (ties: ore, aeth, flux)
```
The defender is debited at the battle instant (`loot.out`). The loot travels as `movement_cargo` and is credited at the attacker's home on arrival (`loot.in`). Overflow there is allowed and decays (§3.4).

Examples:
- **W-13:** carry 1050 → **729/292/29**.
- **W-15:** 825/175/0 normally, **206/44/0** against a weak target.

**Outposts** pay the T-5 loot table, capped by carry. They respawn with a full garrison `8 h + 2 h × (tier − 1)` after being cleared (an `outpost_respawn` timed action).

### 9.9 Determinism, versioning and replay
- **Pure function:** `simulate(BattleInput, seed, ruleset) → BattleResult`. No clock, I/O, floats or `Math.random`.
- **Stored:** input snapshot, seed, `ruleset_version`, `engine_version`, result, and `result_hash` = SHA-256 of the **canonical JSON** of the result (keys sorted, no whitespace, integers as JSON numbers).
- Max 1,000,000 units per stack, so all result integers stay < 2⁵³.
- **Replay (9.4):** re-run with the stored input, seed and ruleset, then compare hashes. Old rulesets stay registered forever.
- **Golden values:** W-13's hash `a9af1ceb…6288754` must be reproduced by Part 9.2.
- **Extension points:** `commanders`, `abilities`, `decisions` are part of the input type now and must be empty for ruleset 1. Post-MVP rulesets consume them at the explicit phase boundaries **Stasis→Clash** and **Clash→Rewind** (13.1), without changing the engine's shape.

---

## 10. Fairness rules

### 10.1 New-player protection (7.4)
- Every new civilization is **protected for 72 h** from founding: it cannot be the target of `attack_city`.
- Protection **ends early** when the player dispatches `attack_city` (raiding outposts is allowed).
- Shown on the map (badge) and in the profile. Expiry emits `protection.ended` (lazily, at the player's next settlement or a map read).

### 10.2 Weak-target rule
`power = 10 × Σ building levels + Σ unit pop × count` (all units of the player). If the defender's power is **< 25%** of the attacker's at the battle instant, **loot is reduced to 25%** (W-15; the power score is computed in W-16: 55 vs 360 → weak). Combat itself is unchanged. This discourages farming new or weak players without forbidding attacks.

### 10.3 Inactive players
`last_active_at` is updated by any authenticated request. The thresholds are derived breakpoints in settlement:

| Since last activity | State | Effects |
|---|---|---|
| < 7 days | active | — |
| ≥ 7 days | **inactive** | production × 50% (modifier step 3) |
| ≥ 21 days | **dormant** | production 0; upkeep 0 (units frozen); city still attackable and still defended by its garrison; shown as dormant on the map |

**Return:** the next request settles the absence correctly (reduced or zero production for the inactive or dormant segments), then the player is active from that instant. Accounts and cities are **never deleted** for inactivity.

---

## 11. Starter balance (ruleset 1 proposal)

Full tables are generated: **T-1** buildings (all 10 levels), **T-2** research, **T-3** units, **T-4** counters, **T-5** outposts. See [`worked-examples.generated.md`](simulation/worked-examples.generated.md).

**Shape and reasoning:**
- **Exponential series** (`×1.5` cost, `×1.45` for the Command Nexus, `×1.6`–`×1.7` duration, `×1.2` production) give fast early levels (2–10 min) and hours-long late levels (Extractor L10 ≈ 2.3 h; Nexus L10 ≈ 19.75 h). Early sessions feel productive, and later decisions are about *when* to commit long queues before going offline (pillar 3).
- **Cost grows faster than production** (1.5 vs 1.2), so payback time grows with level. Diversification and storage matter.
- **Storage** (Nexus base + Vault, both ×1.40) is sized by two rules:
  1. **invariant:** every building and tech cost must fit the capacity reachable at the stage when it can be paid. This is checked by the reference model and becomes a `game-data` validation rule in 4.1;
  2. **pacing:** filling an empty ore store with matching Extractor/Vault/Nexus levels takes ~14 h at L1 (cap 500 at 35/h), ~29 h at L5 and ~65 h at L10.
  A once-a-day player loses early production unless they spend, and late storage is lenient. **Trade-off flagged for the S04 review:** costs grow ×1.5 per level against production ×1.2, so meeting rule 1 forces late storage to be generous. 4.6 measures the resulting idle waste per player profile and may rebalance the growth factors.
- **Units** follow the counter cycle with clear roles. Aetherium upkeep makes army size an economic decision. Chrononauts are expensive in Flux, and their value is Rewind.
- All values move into `game-data` in Parts 4.1, 6.2, 8.1 and 7.5, and are tuned at the S04 gate (4.6) and in 12.7. Tuning creates a new ruleset version; nothing here is final.

---

## 12. Property checks (in the reference model, ported to tests)

| Check | Proves | Ported to |
|---|---|---|
| Closed form == per-ms iteration (3,000 random cases, small D) | §3.2 algorithm is exact | 4.2 property test |
| Split invariance (3,000 small + 2,000 production-scale cases) | path independence (§2) | 4.2 |
| xoshiro128** C-reference vector | PRNG correctness | 9.1 |
| 1,000 random battles × 2 runs → identical hashes | determinism | 9.1 |
| No non-integer anywhere in battle results | rule 8 | 9.1 |
| Every building/tech cost ≤ storage reachable at that stage | ruleset 1 data is playable (no unbuildable level) | 4.1 game-data validation |
| W-1 … W-17 example assertions incl. a hand-traced strike | formulas as written | 4.x, 6.x, 8.x, 9.x golden tests |

Run with `node docs/architecture/simulation/reference-model.mjs` (exit code 1 on any failure). `--write` regenerates the examples file.

---

## 13. Post-MVP outlines

Each is **outline — to be finalised in S13** (design step first, owner approval). Each one only uses MVP seams that already exist.

| System | Outline | MVP compatibility |
|---|---|---|
| **Colonization & territorial expansion** (13.12) | A **colonizer unit** (expensive, Flux) travels like an army to a free island; founding is a timed action (e.g. 4 h). City count is limited by a governance tech/building (e.g. 1 + ⌊Nexus/3⌋), with growing upkeep per extra city. **Territory:** a sector is controlled when a player or alliance holds ≥ 50% of its islands for 24 h; control gives modest production and visibility bonuses. Captured cities can be **occupied** (owner change, buildings −1 level), not razed, in the first version | settlement per player already spans many cities; transfers (§4.3); combat outcome gains `capture`; ownership via `territory_control` |
| **Commanders** (13.13) | Obtained via research and achievements (never loot boxes); one per army; 2–3 traits that modify a **phase** (e.g. +Stasis armor, +Rewind bp, flanking in fog); XP from battles with a soft cap; injury (unavailable for N hours), never permanent death in v1 | `armies.commander_id`; `BattleInput.commanders`; new ruleset version |
| **Strategic infrastructure** (13.14) | Island structures (Temporal Gate: travel time × 0.7 between linked gates; Relay Beacon: vision; Harvester: production on bonus islands; Fortress: wall for an island), built as timed actions; ownership follows territory | movement formula gains a modifier slot; economy modifier slot 7 |
| **Temporal abilities** (13.2) | Flux-cost powers with cooldowns: *Accelerate* (finish 10% of a construction instantly, limited per day), *Anchor* (delay an incoming army by up to 15 min once per attack), *Echo* (+Rewind in one battle). Every ability has counterplay and **cannot be bought with money** | Flux economy; `BattleInput.abilities`; actions' frozen duration can take a recorded adjustment |
| **Tactical intervention windows** (13.1) | Only for large battles (power above a threshold). At Stasis→Clash and Clash→Rewind a window opens (e.g. 15 min; longer or doctrine-only during the player's quiet hours). Decisions: change stance, commit reserves, activate an ability, change the retreat threshold. **Doctrine is the fallback when a window expires.** Every decision is audited | phase boundaries explicit (§9.4); `decisions` input; doctrines |
| **Exploration** (13.3) | Expeditions (timed actions) reveal sectors and **anomalies** with risk/reward tables drawn by seeded PRNG; fog of war per player | timed actions; visibility rules; PRNG |
| **Trading** (13.4) | §4.4 | ledger, transfers |
| **Alliances & diplomacy** (13.5, 13.6) | Membership with roles; shared vision; reinforcement missions; treaties (non-aggression, trade) checked at dispatch and at arrival | arrival re-validation hook (§8) |
| **Temporal corruption** (13.7) | Heavy ability use raises sector/city corruption (fixed-point level that decays slowly); above thresholds it adds a production penalty (modifier slot 6) and battlefield conditions; reduced by structures or research | same linear accrual machinery (§3); modifier slots |
| **World & seasonal events** (13.15) | Region/sector-scoped events with exact start/end (storms: travel ×1.2; rifts: neutral spawns; anomalies). Announced in advance when they affect combat or economy | modifier slot 5; region-owned timed actions; breakpoints in settlement |
| **Great Convergence** (13.8) | Seasons of ~10–12 weeks layered on the permanent universe. Objectives in sectors (hold Convergence nodes), seasonal modifiers (regional stability, access to Convergence sectors, Flux abundance), seasonal rankings and cosmetic/titular rewards, historical records. **No wipe:** cities, techs and accounts persist; only seasonal scores and temporary modifiers reset. The transition is a tested, idempotent, dry-run script | rulesets per season; world events; read models |
| **Monetization** (13.9, owner decision) | Constraint from this spec: nothing sold may change §3–§9 outcomes (no time skips in competitive contexts, no resources, no combat stats). Candidates: cosmetics, season pass with cosmetic rewards | all formulas are server-side and data-driven |

---

## 14. Open items deliberately deferred
1. Final balance numbers → 4.6 (S04 gate), 9.6 (S09 gate), 12.7.
2. Spawn-placement constants (6 / 15 cells, 3× median) → validated in 7.4 with generated regions.
3. Exact size-class buckets for incoming armies → 8.5 UX review.
4. Whether buildings get Aetherium upkeep in a later ruleset (deliberately none in ruleset 1 to avoid deficit feedback loops).
