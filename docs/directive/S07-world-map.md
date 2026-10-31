# S07 — World & Map

**Goal of this section:** the shared universe — one region of floating islands where all players live, visible on a fast, readable map.

---

### Part 7.1 — World model
**Goal:** the shape of the universe in the database.
**Depends on:** 1.3.
**Build:** tables: `regions`, `sectors`, `islands` (or tiles — per DATABASE_DESIGN), with integer coordinates, terrain/biome type, resource bonuses, occupant (city, neutral outpost, empty). Indexes for viewport queries `(region_id, x, y)`. Pure helpers in `game-world`: coordinates, distance metric from spec, neighbors.
**Done when:** schema supports multiple regions even though MVP uses one.
**Tests:** distance metric; coordinate helpers.

### Part 7.2 — World generation
**Goal:** a deterministic, interesting region.
**Depends on:** 7.1.
**Build:** seeded generator in `game-world` producing islands, sectors, resource-rich spots, neutral outpost locations and spawn zones. CLI to generate and insert a region. Same seed → same world.
**Done when:** a generated region is stored and visually inspectable (debug image or map screen).
**Tests:** determinism (same seed, identical output); constraints (e.g. spawn zones spaced apart, no unreachable islands).

### Part 7.3 — Map queries
**Goal:** load only what a player is looking at.
**Depends on:** 7.1.
**Build:** endpoint `GET /map?region&x&y&w&h` (bounded size), returning islands, cities (public info only), neutral outposts; caching of static terrain; visibility rules per spec (no leaking private data like resources or army sizes).
**Done when:** queries stay fast with a fully populated test region (document measured latency).
**Tests:** bounds validation; no private fields in responses; query plan uses indexes.

### Part 7.4 — Spawn placement & new-player protection
**Goal:** new players start somewhere fair and are safe while learning.
**Depends on:** 7.2, 6.1.
**Build:** spawn algorithm (spread new players, avoid placing next to very strong players), replace the 6.1 placeholder location. New-player protection per spec (e.g. shield for N days or until the player attacks someone); visible on the map.
**Done when:** concurrent sign-ups never get the same spot; protected players cannot be attacked.
**Tests:** concurrent placement; shield expiry; attacking ends shield (if specified).

### Part 7.5 — Neutral outposts (PvE)
**Goal:** something to fight before fighting players.
**Depends on:** 7.2.
**Build:** neutral outposts with tiered garrisons from game-data, reward tables, respawn rules (timed actions).
**Done when:** outposts exist on the map with visible tier; respawn works offline.
**Tests:** respawn timing; reward data validation.

### Part 7.6 — Map rendering (client)
**Goal:** a smooth, beautiful, readable map.
**Depends on:** 5.3, 7.3, rendering ADR.
**Build:** Skia (or ADR choice) map with pan/zoom, level-of-detail (fewer details when zoomed out), island art placeholders in the visual style, selection → side panel (web) / bottom sheet (mobile) with island info and available actions. Fetch by viewport with debounce.
**Done when:** 60 fps target on a mid-range phone and desktop browser while panning (measure and document); works with mouse, trackpad and touch.
**Tests:** viewport fetch logic; Playwright: open map, select island, see panel.
