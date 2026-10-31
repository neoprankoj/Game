# S13 — Post-MVP Expansion

**Rules for this section:**
- **Nothing here starts without explicit owner approval**, Part by Part.
- Each Part begins with a design step: update `GAME_SIMULATION_SPEC.md` (and other docs) → owner review → only then implementation sub-Parts.
- When a Part is approved, split it into numbered sub-Parts (e.g. 13.1a, 13.1b …) in the same format as S01–S12 before coding.
- Playtest data from S12 decides the order. Suggested order, based on the source plan's "settlement to empire" arc: **13.12 Colonization → 13.13 Commanders → 13.1 Interventions → 13.2 Temporal abilities → 13.3 Exploration → 13.5 Alliances → 13.4 Trading → 13.6 Diplomacy → 13.14 Strategic infrastructure → 13.7 Corruption → 13.15 World events → 13.8 Great Convergence → 13.9 Monetization → 13.10 Store release**, with 13.11 Scaling whenever metrics demand it. Part numbers are identifiers, not the build order.
- Each design step must cover, for its domain, the 11 fields from `DOMAINS.md` (responsibilities, data ownership, dependencies, interfaces, entities, rules, events produced/consumed, validation, failure handling, tests), upgrading the outline written in Part 1.5 to full detail.

---

### Part 13.1 — Tactical intervention windows
**Goal:** the "hybrid" in hybrid combat — limited, meaningful decisions between battle phases.
**Design must cover:** which battles qualify (e.g. large battles only); window length; available decisions (change posture, commit reserves, activate temporal ability, adjust retreat threshold); costs and cooldowns; doctrine as the fallback when the window expires; **time-zone fairness** (e.g. battles involving a player in quiet hours use longer windows or doctrine only; players can set "available hours"); push notification at window open; audit record of every decision.
**Implementation notes:** battles become multi-step timed actions (phase → window → phase); the combat engine already keeps explicit phase boundaries (Part 9.2); determinism must include player decisions as inputs.
**Key tests:** expired window → fallback order; decision submitted twice; decision after deadline rejected; player disconnects mid-window; replay with decisions matches.

### Part 13.2 — Temporal abilities
**Goal:** the signature time-bending powers.
**Design must cover:** ability list (e.g. accelerate a construction at a resource cost, delay an incoming army, strengthen Rewind), eligibility, Flux-Matter costs, cooldowns, counterplay, and **how they avoid becoming pay-to-win**.

### Part 13.3 — Exploration
**Goal:** discovering anomalies and sectors.
**Design must cover:** expeditions as timed actions, fog of war/discovery state, anomaly events and rewards, risk.

### Part 13.4 — Trading & market
**Goal:** player-driven economy.
**Design must cover:** market model (order book vs. fixed exchange vs. caravans with travel time), fees as resource sinks, anti-abuse (pushing resources to alt accounts — ties to 11.5), transactional safety.

### Part 13.5 — Alliances
**Goal:** cooperation at scale.
**Design must cover:** creation, roles and permissions, membership limits, chat (moderation!), shared vision, reinforcements, alliance-level objectives.

### Part 13.6 — Diplomacy
**Goal:** formal relationships between players/alliances.
**Design must cover:** treaties (non-aggression, trade, alliance), breaking treaties, notifications, effects on combat rules.

### Part 13.7 — Temporal corruption
**Goal:** instability as a strategic pressure.
**Design must cover:** what generates corruption (e.g. heavy temporal ability use), effects on production/combat, ways to reduce it, interaction with the Great Convergence.

### Part 13.8 — Great Convergence (seasons)
**Goal:** seasonal competition without wiping the universe.
**Design must cover:** season length, what changes (regional stability, objectives, map access, resource availability, temporary modifiers), seasonal rankings, rewards, historical records, what is permanent vs. seasonal, how the transition is executed safely (a migration-like, tested, reversible operation with a dry run on staging).

### Part 13.9 — Monetization (owner decision required first)
**Goal:** sustainable revenue that keeps the game fair.
**Owner must decide:** what can be sold. Recommended principle to evaluate: cosmetics, convenience that does not affect competitive outcomes, and a season pass with cosmetic/non-competitive rewards. Selling time skips in competitive contexts conflicts with the "time is the core resource" pillar and is pay-to-win by default.
**Design must cover:** store rules (Apple/Google in-app purchase requirements, web payments), receipt validation server-side, refunds, regional pricing, any randomized rewards and their legal status in target countries.

### Part 13.10 — Mobile store release
**Goal:** ship to the App Store and Google Play.
**Build:** EAS builds, signing, store listings, screenshots, privacy labels, review guidelines check, crash reporting in release builds, update strategy (OTA updates for JS vs. store releases for native changes), minimum supported versions and forced-update mechanism.

### Part 13.11 — Scaling (only when measured)
**Goal:** grow capacity based on real data.
**Trigger:** metrics from 12.4 show a real bottleneck.
**Options to evaluate:** more regions with region-sharded workers, read replicas, caching hot reads, separating workers by queue, load testing with realistic player behavior. Each change needs an ADR with before/after measurements.

### Part 13.12 — Colonization & territorial expansion
**Goal:** the core of "small settlement to interdimensional empire" — players found new cities on other islands and control territory.
**Design must cover:** how a colony is founded (colonizer unit or expedition as a timed action, cost, travel), limits on number of cities (e.g. tied to a technology or a governance building) and why; colony development (each city has its own buildings, resources and queues; the economy already settles per city); resource transfers between cities (Part 4.5, feature flag turned on); **territories** — what an island/sector ownership means (bonuses, borders, visibility, upkeep), how territory is contested and captured, what happens to a captured city (raze, occupy, vassal — pick and justify); interaction with new-player protection and the Great Convergence; UI for managing multiple cities on mobile (city switcher) and web (empire overview).
**Implementation notes:** schema already supports many cities per player (6.1); map queries already return occupants; combat outcome needs a "capture" result type.
**Key tests:** two players colonize the same island simultaneously — exactly one wins; colony founded while offline; city capture with armies inside or en route; transfers between colonies; empire-wide settlement performance with many cities.

### Part 13.13 — Commanders
**Goal:** named leaders assigned to armies that add strategic identity (source plan, Combat Stage 1: "assign commanders").
**Design must cover:** how commanders are obtained (recruitment, research, rewards — not loot boxes), traits and skills, progression (experience from battles), limits (one per army), injury/capture/death rules, effect on combat phases (e.g. better Stasis positioning, stronger Rewind), and how they appear in battle reports. Avoid power creep that makes new players irrelevant.
**Implementation notes:** armies have a nullable commander slot (8.3) and the combat engine already accepts commanders as input (9.1) — this Part fills them in under a new ruleset version.
**Key tests:** commander bonuses in combat worked examples; replay of old battles unchanged; commander in two armies is impossible under concurrency.

### Part 13.14 — Strategic infrastructure
**Goal:** world-level structures that make territory worth fighting over.
**Design must cover:** infrastructure types (e.g. temporal gates that shorten travel, relay beacons that extend visibility, resource harvesters on rich islands, fortresses), who can build them (player, alliance), construction as timed actions with world-level effects, ownership changes when territory is captured, upkeep, and how movement/economy formulas incorporate them.
**Key tests:** movement time with and without a gate; capture transfers ownership atomically; effects removed exactly when infrastructure is destroyed.

### Part 13.15 — World events & seasonal events
**Goal:** a universe that surprises — temporal anomalies, storms, rifts — plus seasonal event content between Great Convergences.
**Design must cover:** event types and effects (production modifiers, map changes, neutral spawns, anomaly investigations), scheduling (deterministic, server-driven, announced in advance where fair), regional scope, rewards, achievements, how events interact with corruption and the Convergence, and notification strategy.
**Implementation notes:** events are timed actions at world/region scope; their effects enter settlement as modifiers with exact start and end timestamps so offline players are affected correctly.
**Key tests:** event starts while players are active (modifiers apply exactly at start for everyone); offline player settled across an event window; overlapping events; event cancelled mid-way.
