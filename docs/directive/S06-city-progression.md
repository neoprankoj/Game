# S06 — City, Construction & Research

**Goal of this section:** the first playable loop — a player founds a city, gathers resources, builds, researches and watches it all progress while offline.
**Milestone:** at the end of S06 the game is a working single-player experience on the real backend.

---

### Part 6.1 — Player profile, civilization & city founding
**Goal:** a new player gets a profile, a civilization and a starting city.
**Depends on:** 2.8, 4.3.
**Build:** tables `players`, `player_profiles`, `civilizations`, `cities`.
- Player profile: display name (unique, validated, profanity-filtered), avatar/banner placeholder, public stats (civilization age, battles won, outposts cleared), privacy of what others can see.
- Onboarding endpoint: choose display name + civilization name → create player, profile, civilization, city with starting buildings and resources from game-data.
- City placement uses a temporary placeholder location (real placement in Part 7.4).
- **Schema allows many cities per player** (colonization, 13.12); a rule limits MVP to one.
**Done when:** a new account can found exactly one civilization; repeating the request is idempotent; another player can view the public profile and nothing private.
**Tests:** founding; duplicate founding; starting state matches game-data; name uniqueness under concurrency; profile visibility.

### Part 6.2 — Building definitions
**Goal:** all MVP buildings described as data.
**Depends on:** 4.1, 1.4.
**Build:** in `game-data`: buildings (e.g. Ore Extractor, Aetherium Condenser, Flux Refinery, Storage Vault, Habitat, Research Spire, Barracks, Bastion Wall, Command Nexus), each with levels, costs, durations, prerequisites, and effects (production, capacity, population, unlocks, defense). Pure functions in `game-progression` to read effects for a city.
**Done when:** game-data validates; effects feed the economy's rate breakdown.
**Tests:** effect aggregation; prerequisite checks; data validation catches broken references.

### Part 6.3 — Construction queue
**Goal:** players upgrade buildings over time.
**Depends on:** 6.2, 3.3, 4.3.
**Build:** endpoints: start upgrade, cancel upgrade, get queue. Rules from spec: queue length limit, cost deducted at start, prerequisites, refund % on cancel, level applied on completion via timed action `construction`. Completion changes effects mid-settlement (economy accrues before and after correctly).
**Done when:** a building started before going offline is upgraded on return, with production correctly split at the completion time.
**Tests:** start/complete/cancel; insufficient resources; queue full; concurrent starts; completion while offline; refund math.

### Part 6.4 — Research
**Goal:** a light technology tree that unlocks and improves things.
**Depends on:** 6.3.
**Build:** `game-data` tech tree (~10–15 MVP techs: production boosts, storage, unit unlocks, movement speed, combat modifiers, Rewind effectiveness); one research at a time (or as specified); timed action `research`; effects aggregated alongside buildings.
**Done when:** completing a tech changes the relevant rates/unlocks immediately at its completion time.
**Tests:** prerequisites; completion effects; cancel rules.

### Part 6.5 — Population
**Goal:** a simple population model that creates a meaningful constraint.
**Depends on:** 6.2.
**Build:** population capacity from Habitats; population grows toward capacity per spec; buildings and units require population; shortage rules per spec. Keep it simple — no job assignment in MVP unless the spec justifies it.
**Done when:** population appears in the rate breakdown and constrains building/recruiting as specified.
**Tests:** growth over time; cap; insufficient population blocks actions.

### Part 6.6 — City screens
**Goal:** the city playable from web and phone.
**Depends on:** 5.3, 6.3–6.5.
**Build:** City overview (buildings with levels, resource bar with rates), building detail (current/next level effects, cost, duration, upgrade button), construction queue with countdowns, research screen (tree or list), resource breakdown screen ("why is my production this number?").
**Done when:** a player can play the full city loop in the browser; Playwright E2E: sign up → found city → start upgrade → advance server clock (test endpoint in dev/test only) → see completion.
**Tests:** E2E flow above; screens handle loading/error/empty states.
