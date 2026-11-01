# DOMAINS — Chronos Cradle: Temporal Empires

| Field | Value |
|---|---|
| Status | Draft for the S01 gate (Part 1.5) |
| Last updated | 2026-11-01 |
| Depends on | `SYSTEM_ARCHITECTURE.md` (1.2), `DATABASE_DESIGN.md` (1.3), `GAME_SIMULATION_SPEC.md` (1.4) |
| Verified by | [`domains-check.mjs`](domains-check.mjs): 29 domains × 11 fields; every table in the reference schema owned exactly once; every event has exactly one producer; the event catalog and SYSTEM_ARCHITECTURE §5 agree with this file |

This catalog defines **every one of the 27 source-plan domains, plus Commanders and Strategic infrastructure** (29 in total). It also covers **two platform modules** that own data but are not game domains. Its purpose is rule 20: domain logic lives in exactly one place, never scattered across controllers, UI components or ad-hoc queries.

- MVP domains are specified in full detail.
- Post-MVP domains are **outlines**: every field is present, the content is shorter, and the design is finalised in its S13 Part.
- If a later Part changes a domain's tables, events or interface, this file changes in the same commit, and `domains-check.mjs` must still pass.

---

## How to read an entry

Each entry has the 11 fields required by source plan Part V:

| Field | Meaning |
|---|---|
| Responsibilities | what the domain decides; anything not listed belongs elsewhere |
| Data ownership | the facts this domain is the only authority for |
| Dependencies | domains whose **interfaces** it calls synchronously (inside a transaction) and libraries/ports it needs; event subscriptions are under *Events consumed* |
| Public interfaces | application-layer functions (`packages/application/src/<domain>/`), pure functions (`packages/game-*`), HTTP routes (`apps/api/src/modules/<domain>/`, indicative; the OpenAPI spec generated in 2.4 is authoritative) |
| Database entities | **Owns:** tables only this domain writes (one owner per table). **Uses:** other domains' data it reads through their interfaces. **Owns (planned):** post-MVP tables |
| Business rules | the invariants, with references to `GAME_SIMULATION_SPEC.md` (SIM) sections |
| Events produced / consumed | outbox events (SYSTEM_ARCHITECTURE §4.4). Each event type has exactly one producer |
| Validation requirements | what is checked, and where (Zod at the boundary, pure rules, DB constraints) |
| Failure handling | what happens on conflicts, retries, partial failure, dependency outages |
| Automated tests | the tests the implementing Part must deliver |

### Cross-domain rules
1. **Writes go through the owner.** A domain never writes another domain's table. It calls the owner's application interface inside the same transaction (for example, Construction calls `Resources.spend` and `Buildings.setLevel`).
2. **Reads** of another domain's data also go through its interface or a read model it publishes. No ad-hoc cross-domain SQL.
3. **Events are for side effects that may lag** (notifications, read models, analytics, job scheduling). State that must change together changes synchronously.
4. **Event naming:** `<domain>.<past_tense_verb>`. The envelope (2.4) is `{ id, type, seq, occurredAt, payload }`. Payloads carry ids and the minimum display data, never another player's private state.
5. **Recipients:** an event lists player recipients (`player_events` fan-out with a per-player `seq`). Events without recipients are internal.

---

## Domain index

| # | Domain | Phase | Pure rules | Application module | API module | Parts |
|---|---|---|---|---|---|---|
| D01 | Authentication & accounts | MVP | — | `accounts` | `auth` | 2.8, 12.6 |
| D02 | Player profiles | MVP | — | `profiles` | `profiles` | 6.1, 12.1 |
| D03 | Civilizations | MVP | `game-world` (protection, activity) | `civilizations` | `onboarding` | 6.1, 7.4, 11.4 |
| D04 | Cities | MVP | `game-progression` | `cities` | `cities` | 6.1, 6.6 |
| D05 | Buildings | MVP | `game-progression` | `buildings` | `cities` | 6.2 |
| D06 | Resources | MVP | `game-economy` | `resources` | `resources` | 4.1–4.6 |
| D07 | Population | MVP | `game-progression` | `population` | `cities` | 6.5 |
| D08 | Construction | MVP | `game-progression` | `construction` | `construction` | 6.3 |
| D09 | Technology & research | MVP | `game-progression` | `research` | `research` | 6.4 |
| D10 | Military recruitment | MVP | `game-military` | `recruitment` | `recruitment` | 8.2 |
| D11 | Armies & formations | MVP | `game-military` | `armies` | `armies` | 8.3, 8.4 |
| D12 | Military movement | MVP | `game-military`, `game-world` | `movement` | `movements` | 8.5 |
| D13 | Combat simulation | MVP | `game-combat` | `combat` | `reports` | S09 |
| D14 | Temporal abilities | Post-MVP | `game-military`/`game-combat` | `abilities` | `abilities` | 13.2 |
| D15 | World generation | MVP | `game-world` | `worldgen` | `tools/worldgen` | 7.2 |
| D16 | Islands & territories | MVP (islands) / Post-MVP (territories) | `game-world` | `world` | `map` | 7.1, 7.3–7.5, 13.12 |
| D17 | Colonization | Post-MVP | `game-world`, `game-military` | `colonization` | `colonization` | 13.12 |
| D18 | Temporal corruption | Post-MVP | `game-economy` | `corruption` | — | 13.7 |
| D19 | Exploration | Post-MVP | `game-world` | `exploration` | `exploration` | 13.3 |
| D20 | Trading | Post-MVP | `game-economy` | `market` | `market` | 13.4 |
| D21 | Alliances | Post-MVP | — | `alliances` | `alliances` | 13.5 |
| D22 | Diplomacy | Post-MVP | — | `diplomacy` | `diplomacy` | 13.6 |
| D23 | Notifications | MVP | — | `notifications`, `outbox` | `notifications`, `realtime` | 3.4, S10 |
| D24 | Seasonal & world events | Post-MVP | `game-world` | `world-events` | — | 13.15 |
| D25 | Great Convergence | Post-MVP | — | `seasons` | `seasons` | 13.8 |
| D26 | Monetization | Post-MVP (owner decision) | — | `store` | `store` | 13.9 |
| D27 | Administration & moderation | MVP (admin) / Post-MVP (moderation) | — | `admin`, `fairness` | `admin`, `tools/admin` | 11.3, 11.5, 11.6 |
| D28 | Commanders | Post-MVP | `game-military`, `game-combat` | `commanders` | `armies` | 13.13 |
| D29 | Strategic infrastructure | Post-MVP | `game-world` | `infrastructure` | `map` | 13.14 |
| P1 | Simulation core *(platform)* | MVP | `game-temporal` | `settlement` | `GET /time` | 3.1–3.5 |
| P2 | Request integrity *(platform)* | MVP | — | — (API middleware) | all mutating routes | 3.6 |

---

## MVP domains

### D01 — Authentication & accounts
- **Responsibilities:** sign-up, sign-in, sign-out; sessions for web (cookies) and native (SecureStore); email verification; password reset; session revocation; account roles (`player`, `admin`); suspension/ban flags; orchestration of account deletion and data export (12.6).
- **Data ownership:** credentials, sessions, verification tokens, account email, role and ban state.
- **Dependencies:** Better Auth library (ADR-0007); `Mailer` port; D02 (`createPlayer` is called by D03 during founding, `anonymizePlayer` during deletion); D27 (`audit`).
- **Public interfaces:** HTTP `/api/auth/*` (Better Auth catch-all); `requireAccount(request) → Account`; `requireRole(account, 'admin')`; `deleteAccount(accountId)`; `exportAccountData(accountId)`; `revokeSessions(accountId)` (admin).
- **Database entities:** Owns: `auth.user`, `auth.session`, `auth.account`, `auth.verification` · Uses: `game.players` (via D02).
- **Business rules:**
  - one account per email (case-insensitive);
  - all credential handling by the library, with no custom crypto;
  - database sessions, revocable;
  - deletion order: anonymise the player first (D02), then delete the auth user (enforced by a DB CHECK, DATABASE_DESIGN §4.2);
  - admin role granted only through the admin CLI, with an audit row.
- **Events produced:** `account.created`, `account.deleted`
- **Events consumed:** —
- **Validation requirements:**
  - email format and length;
  - password policy (≥ 10 characters; library hashing);
  - Zod on every non-library endpoint;
  - auth routes rate-limited (2.8 basic, 11.2 hardened);
  - CORS limited to trusted origins.
- **Failure handling:**
  - the email provider being down never blocks sign-up; verification can be resent;
  - library errors map to contract errors without revealing whether an email exists (`AUTH_INVALID_CREDENTIALS`);
  - deletion is idempotent and resumable: anonymisation can be repeated, and auth deletion is retried.
- **Automated tests:** sign-up; duplicate email; wrong password (same error as unknown email); session expiry; revocation; anonymous request → 401 on every game route; deletion order and idempotency; admin-only routes refuse players.

### D02 — Player profiles
- **Responsibilities:** the game identity linked to an account (the `players` row, also the **root lock**); the public profile (display name, avatar/banner placeholders, stats visibility); the public stats read model; `last_active_at` tracking; tutorial progress and rewards (12.1); anonymisation on deletion.
- **Data ownership:** player status (`active` / `suspended` / `dormant` / `deleted`), display name, profile settings, public statistics, tutorial progress, last activity instant.
- **Dependencies:** D06 (`credit` for tutorial rewards); D27 (`audit`); profanity word list (data in `game-data`).
- **Public interfaces:** `createPlayer(accountId, t)`; `getPublicProfile(playerId)`; `updateProfile(playerId, patch)`; `touchActivity(playerId, t)`; `anonymizePlayer(playerId)`; `completeTutorialStep(playerId, step, t)`; HTTP `GET /me`, `PATCH /me/profile`, `GET /players/{id}`.
- **Database entities:** Owns: `game.players`, `game.player_profiles`, `game.player_stats`, `game.tutorial_progress` · Uses: `game.resource_balances` (via D06).
- **Business rules:**
  - display name 3–24 characters, allowed character set, profanity-filtered, unique case-insensitively;
  - the public profile never shows resources, army composition or other private state;
  - stats can be hidden (`show_stats`);
  - `last_active_at` is updated by any authenticated request **after** settlement;
  - each tutorial reward is granted exactly once;
  - anonymisation replaces the display name with `Deleted-<short id>` and keeps game history.
- **Events produced:** `profile.updated`, `tutorial.step_completed`
- **Events consumed:** `battle.resolved`, `outpost.cleared` (public stats)
- **Validation requirements:** Zod (name format); uniqueness via DB unique index; tutorial step ids validated against `game-data`.
- **Failure handling:**
  - a concurrent name collision returns `DISPLAY_NAME_TAKEN` (the unique index is the arbiter);
  - event consumption is idempotent via `event_consumptions`;
  - stats lag is acceptable (read model).
- **Automated tests:** name uniqueness under concurrency; profanity filter; another player sees only public fields; stats consumer applies each event once; tutorial reward once; anonymisation keeps battles readable.

### D03 — Civilizations
- **Responsibilities:** the player's in-world identity and status:
  - civilization name and founding;
  - **orchestrating the founding transaction** (player, civilization, spawn, city, starting state);
  - **new-player protection**;
  - **activity state** (active / inactive / dormant).
- **Data ownership:** civilization name, founding instant, protection window and end reason, activity state and since-when.
- **Dependencies:** D02 (`createPlayer`, `last_active_at`), D16 (`placeSpawn`), D04 (`foundCity`), D05 (starting buildings), D06 (starting balances), D07 (starting population), D11 (default city doctrine), P1 (settlement breakpoints for activity thresholds).
- **Public interfaces:** `foundCivilization(accountId, {displayName, civName}, t)` (HTTP `POST /onboarding/found`); `isAttackable(playerId, t)`; `endProtection(playerId, reason, t)` (called by D12 on `attack_city` dispatch); `activityStateAt(playerId, t)` (used by D06 modifiers); `getCivilization(playerId)`.
- **Database entities:** Owns: `game.civilizations` · Uses: `game.players`, `game.islands`, `game.cities` (via owners).
- **Business rules:**
  - exactly one civilization per player; the founding request is idempotent (unique `player_id` and idempotency key);
  - protection lasts 72 h from founding and ends early on dispatching `attack_city` (SIM §10.1);
  - activity thresholds: 7 days → inactive, 21 days → dormant (SIM §10.3). Returning restores active from that instant;
  - nothing is deleted for inactivity.
- **Events produced:** `civilization.founded`, `protection.ended`, `civilization.activity_changed`
- **Events consumed:** —
- **Validation requirements:** civilization name 3–32 characters, unique case-insensitive, profanity-filtered; starting state taken from `game-data` (validated at load).
- **Failure handling:**
  - no free spawn island → `WORLD_FULL` (and an alert to the owner to generate a region, 7.1);
  - the whole founding is one transaction, so partial failure leaves nothing behind;
  - a duplicate request returns the stored response.
- **Automated tests:** founding creates the exact starting state from game-data; double founding (sequential and concurrent); protection blocks attacks and ends on `attack_city` dispatch; activity transitions at exact thresholds during offline settlement; reactivation.

### D04 — Cities
- **Responsibilities:** city entities (name, island, capital flag); the **city-count rule** (1 in the MVP, many later); the city view model that composes building, economy and population data for the client.
- **Data ownership:** which player owns which city on which island; city name; capital flag.
- **Dependencies:** D16 (`setOccupant`), D05, D06, D07 (read interfaces for the city view).
- **Public interfaces:** `foundCity(playerId, islandId, name, t)` (called by D03; by D17 post-MVP); `getCityView(playerId, cityId, t)` (HTTP `GET /cities/{id}`); `listCities(playerId)`; `getCityOwner(cityId)`; `renameCity`.
- **Database entities:** Owns: `game.cities` · Uses: `game.islands` (via D16).
- **Business rules:**
  - one city per island (DB unique);
  - at most one capital per player;
  - city count ≤ `game-data.max_cities_per_player` (1 in ruleset 1). The schema allows more (13.12).
- **Events produced:** `city.founded`
- **Events consumed:** —
- **Validation requirements:** city name 2–32 characters, profanity-filtered; ownership checked on every city route (11.1).
- **Failure handling:** island already occupied → `ISLAND_OCCUPIED` (the unique index and island lock arbitrate); the view model degrades to cached public parts only if a read dependency fails (never shows fabricated numbers).
- **Automated tests:** founding; second city rejected in the MVP; foreign city → 404; the view model numbers equal the domain engines (no client-side recomputation).

### D05 — Buildings
- **Responsibilities:** building levels per city; **effect aggregation** (production, capacity, population capacity, speeds, wall), consumed by other domains as read-only effect providers; starting buildings.
- **Data ownership:** the current level of each building type in each city.
- **Dependencies:** `game-data` (building definitions); none at runtime besides the caller's transaction.
- **Public interfaces:** `getBuildings(cityId)`; `getEffects(cityId) → Effects` (pure aggregation in `game-progression`); `setLevel(cityId, type, level)` (**only** D08 and D13/D29 post-MVP may call it); `seedStartingBuildings(cityId)`.
- **Database entities:** Owns: `game.city_buildings` · Uses: —
- **Business rules:**
  - level range 0…max (data);
  - a non-Nexus building level ≤ Command Nexus level (checked at construction enqueue by D08 using this domain's rule function);
  - effects follow the series formulas (SIM §4.2, §3.3, §6, §5);
  - building types are data ids (validated against `game-data`).
- **Events produced:** —
- **Events consumed:** —
- **Validation requirements:** type id exists in `game-data`; level within bounds; DB CHECK `level >= 0`.
- **Failure handling:** an unknown building type in stored data (after a ruleset change) is treated as level 0 with an alert; a ruleset migration must map retired types.
- **Automated tests:** effect aggregation equals the T-1 tables; prerequisite rule; data validation catches dangling references (6.2).

### D06 — Resources (economy)
- **Responsibilities:** everything about the three resources:
  - balances, accrual (production, upkeep, capacity, decay);
  - deficits, penalties and recovery;
  - the ledger; `spend` / `credit`;
  - transfers between own cities (feature-flagged);
  - the rate breakdown;
  - loot debit/credit on request of combat/movement.
- **Data ownership:** each city's resource balances and remainders, economy clock, deficit periods and ledger.
- **Dependencies:**
  - D05 (`getEffects`), D09 (research bonuses), D07 (none in ruleset 1), D11 (unit upkeep; `applyDesertion`), D16 (island bonus), D03 (`activityStateAt`), P1 (breakpoints, ruleset per segment);
  - `game-economy` (pure accrual, SIM §2–§4).
- **Public interfaces:**
  - `accrueTo(cityId, t)` (settlement only); `spend(cityId, cost, reason, ref, t)` (all-or-nothing); `credit(cityId, amounts, reason, ref, t)`;
  - `debitLoot(cityId, amounts, battleRef, t)`;
  - `dispatchTransfer(fromCity, toCity, amounts, t)` (flagged);
  - `getBreakdown(cityId, t)` (HTTP `GET /cities/{id}/economy`);
  - `projectBalances(cityId, t)` (read-only projection);
  - `nextBreakpoint(cityId, until)` (deficit start, desertion tick).
- **Database entities:** Owns: `game.city_economy`, `game.resource_balances`, `game.resource_deficits`, `game.resource_ledger` · Uses: `game.timed_actions` (kind `transfer`, via P1), `game.unit_stacks` (counts, via D11).
- **Business rules:**
  - integers only; exact accrual with sticky boundaries; path-independent (SIM §2–§3);
  - modifiers applied in the order of SIM §4.2;
  - decay above the stable level (SIM §3.4);
  - deficit penalties, desertion and recovery (SIM §3.6);
  - every balance change writes a ledger row, so balance = Σ ledger deltas;
  - `CHECK (amount >= 0)`;
  - multi-resource spends are atomic;
  - overflow from loot or transfers is allowed and decays;
  - transfers are disabled until 13.12.
- **Events produced:** `resources.deficit_started`, `resources.deficit_ended`, `resources.storage_full`, `transfer.dispatched`, `transfer.arrived`
- **Events consumed:** —
- **Validation requirements:**
  - resource ids exist in `game-data`;
  - amounts are positive integers (decimal strings on the wire);
  - `storage_full` is emitted at most once per resource per 6 h (avoids spam);
  - game-data invariant: every cost fits the reachable capacity (SIM §11).
- **Failure handling:**
  - insufficient funds → `INSUFFICIENT_RESOURCES` with the missing amounts and **no** partial deduction;
  - a negative-balance attempt is caught by the DB CHECK (a bug signal, alerted);
  - a ledger/balance mismatch found by the 12.4 check raises an economy anomaly alert; no automatic fixing.
- **Automated tests:**
  - worked examples W-1…W-6, W-16, W-17;
  - property tests: closed form == iteration, split invariance;
  - concurrent spends (exactly one succeeds);
  - replayed request applied once;
  - ledger reconciliation;
  - breakdown totals == engine;
  - deficit → desertion → recovery offline.

### D07 — Population
- **Responsibilities:** population per city (capacity, growth, employed, drafted, reserved, free); reservations for construction and recruitment.
- **Data ownership:** population amount and remainder per city, and its clock.
- **Dependencies:** D05 (Habitat/Nexus capacity effects, employed workers), D11 (drafted units), P1 (settlement).
- **Public interfaces:** `accrueTo(cityId, t)`; `getPopulation(cityId, t) → {total, cap, employed, drafted, reserved, free}`; `reserve(cityId, n, ref)`; `release(cityId, n, ref)`.
- **Database entities:** Owns: `game.city_population` · Uses: `game.city_buildings`, `game.unit_stacks`, `game.timed_actions` (reservations in payloads).
- **Business rules:**
  - linear growth at 5% of capacity per hour up to the cap (SIM §6);
  - free = total − employed − drafted − reserved;
  - actions need free ≥ cost;
  - no shortage is possible in ruleset 1. If later systems shrink capacity, new consuming actions are blocked and nothing is destroyed.
- **Events produced:** —
- **Events consumed:** —
- **Validation requirements:** reservations are positive integers; free never negative (assertion plus test).
- **Failure handling:** insufficient population → `INSUFFICIENT_POPULATION` with the shortfall.
- **Automated tests:** W-7; growth across a Habitat completion mid-interval; reserve/release on enqueue and cancel; concurrent enqueues cannot overbook.

### D08 — Construction
- **Responsibilities:** the construction queue per city: enqueue, cancel, completion; frozen cost/duration; queue shifting.
- **Data ownership:** the payload schema and rules of `construction` timed actions (the rows live in P1's table).
- **Dependencies:** D05 (levels, prerequisites, `setLevel`), D06 (`spend`, refunds via `credit`), D07 (`reserve`/`release`), D09 (tech prerequisites), P1 (`schedule`, handler registration).
- **Public interfaces:** `startUpgrade(playerId, cityId, buildingType, t)` (HTTP `POST /cities/{id}/constructions`); `cancel(playerId, actionId, t)` (`DELETE /constructions/{id}`); `getQueue(cityId)`; handler `onComplete(action)`.
- **Database entities:** Owns: — · Uses: `game.timed_actions` rows of kind `construction` (via P1), `game.city_buildings` (via D05).
- **Business rules:**
  - at most 2 queue entries per city, sequential;
  - a building at most once in the queue (DB-enforced);
  - cost debited and duration frozen at enqueue;
  - cancel active = 80% refund and the waiting entry shifts to the cancel instant; cancel waiting = 100% (SIM §5.1, W-8, W-17);
  - completion changes effects exactly at `completes_at`.
- **Events produced:** `construction.started`, `construction.cancelled`, `construction.completed`
- **Events consumed:** —
- **Validation requirements:** building type in `game-data`; target level ≤ max and ≤ Nexus; queue length; prerequisites; ownership.
- **Failure handling:** `QUEUE_FULL`, `PREREQUISITE_MISSING`, `ALREADY_QUEUED`, `MAX_LEVEL`; a duplicate completion is a no-op (status under lock); cancel after completion → `ALREADY_COMPLETED`.
- **Automated tests:** start/complete/cancel; refund math; queue shift; queue full; concurrent starts; completion while offline with production split (W-5); cancel/complete race.

### D09 — Technology & research
- **Responsibilities:** the tech tree per player: start, cancel, completion; tech levels as effect providers (production bonuses, capacity, speed, unlocks, combat modifiers, Rewind).
- **Data ownership:** completed tech levels per player; the payload rules of `research` actions.
- **Dependencies:** D05 (Research Spire level), D06 (`spend`, refunds), P1 (`schedule`, handler).
- **Public interfaces:** `startResearch(playerId, techId, t)` (HTTP `POST /research`); `cancelResearch(playerId, actionId, t)`; `getTree(playerId)`; `getTechLevels(playerId)` (effect provider); handler `onComplete`.
- **Database entities:** Owns: `game.player_research` · Uses: `game.timed_actions` (kind `research`, via P1).
- **Business rules:**
  - one active research per player;
  - Spire level ≥ 2·tier − 1;
  - cost/duration series with Spire speed (SIM §5.2, W-9);
  - cancel refunds 80%;
  - effects apply to all of the player's cities from `completes_at`.
- **Events produced:** `research.started`, `research.cancelled`, `research.completed`
- **Events consumed:** —
- **Validation requirements:** tech id and level in `game-data`; prerequisites; no cycles in tech prerequisites (data validation).
- **Failure handling:** `RESEARCH_BUSY`, `PREREQUISITE_MISSING`, `MAX_LEVEL`; duplicate completion is a no-op.
- **Automated tests:** prerequisites; completion effects at the exact instant in an offline settlement; cancel refund; concurrent starts.

### D10 — Military recruitment
- **Responsibilities:** recruitment batches per city: enqueue, cancel, completion into the garrison.
- **Data ownership:** the payload rules of `recruitment` actions (unit type, count, frozen cost, duration, population).
- **Dependencies:** D06 (`spend`, refunds), D07 (`reserve`/`release`), D05 (Barracks level), D09 (unit unlocks), D11 (`addToGarrison`), P1.
- **Public interfaces:** `recruit(playerId, cityId, unitType, count, t)` (HTTP `POST /cities/{id}/recruitments`); `cancel(playerId, actionId, t)`; `getQueue(cityId)`; handler `onComplete`.
- **Database entities:** Owns: — · Uses: `game.timed_actions` rows of kind `recruitment` (via P1), `game.unit_stacks` (via D11).
- **Business rules:**
  - at most 3 batches per city, sequential; batch size 1–500;
  - cost and population reserved at enqueue;
  - the whole batch joins the garrison at completion, when upkeep starts;
  - cancel active = 80%, waiting = 100% (SIM §5.3, W-10).
- **Events produced:** `recruitment.started`, `recruitment.cancelled`, `recruitment.completed`
- **Events consumed:** —
- **Validation requirements:** unit type in `game-data` and unlocked; Barracks level; count range; ownership.
- **Failure handling:** `QUEUE_FULL`, `UNIT_LOCKED`, `INSUFFICIENT_RESOURCES`, `INSUFFICIENT_POPULATION`; duplicate completion is a no-op.
- **Automated tests:** cost, population, completion offline, cancel/refund, queue shift, concurrent requests; upkeep visible in the D06 breakdown after completion.

### D11 — Armies & formations
- **Responsibilities:**
  - unit stacks (where every unit is), armies (form, disband, rename), formations;
  - **doctrines** (default orders) for armies and city defense;
  - the commander slot (empty in the MVP);
  - applying battle losses and desertion;
  - power score inputs.
- **Data ownership:** the location of every existing unit; army composition, status and formation; doctrines.
- **Dependencies:** D09 (formation unlocks); `game-military` (rules).
- **Public interfaces:**
  - `formArmy(playerId, cityId, units, formation, t)`; `disbandArmy(playerId, armyId, t)`;
  - `setFormation`, `setDoctrine` (HTTP `PUT /armies/{id}/doctrine`, `PUT /cities/{id}/defense-doctrine`);
  - `addToGarrison(cityId, unitType, n)`; `applyLosses(sideRef, losses)`; `applyDesertion(cityId, t)`; `setArmyStatus(armyId, status, movementRef)`;
  - `getDefenders(cityId)` (garrison + armies at home); `getUpkeep(cityId)`; `getPower(playerId)`.
- **Database entities:** Owns: `game.armies`, `game.doctrines`, `game.unit_stacks` · Uses: —
- **Business rules:**
  - every unit is in exactly one place (garrison or army; DB CHECK + partial uniques);
  - one stack per unit type per place;
  - every army and city **always** has a valid doctrine, with a default created in the same transaction;
  - armies can be formed or disbanded only at home;
  - `commander_id` stays null in ruleset 1;
  - desertion follows SIM §3.6.
- **Events produced:** `army.formed`, `army.disbanded`, `doctrine.changed`, `units.deserted`
- **Events consumed:** —
- **Validation requirements:** counts ≤ available garrison; formation unlocked; doctrine values in `game-data` enumerations (stance, retreat 0–10000 bp, Rewind priority).
- **Failure handling:** `UNITS_UNAVAILABLE`, `ARMY_NOT_HOME`, `FORMATION_LOCKED`; a concurrent form/disband is serialised by the root lock and never duplicates or loses units.
- **Automated tests:** concurrent form/disband conservation (Σ units constant); defaults always present; losses and desertion bookkeeping; power score (W-16).

### D12 — Military movement
- **Responsibilities:** dispatch, travel, recall, arrival (an **interaction** with another owner, or local for returns), return with cargo; incoming visibility.
- **Data ownership:** movements (mission, route, timing, status) and the cargo carried.
- **Dependencies:** D11 (army status/composition), D16 (target island/outpost lookup), D03 (`isAttackable`, `endProtection`), D04 (target city owner), D13 (`resolveBattle` at arrival), D06 (`credit` loot at return), P1 (`schedule`, interaction ordering), `game-military` + `game-world` (distance, speed).
- **Public interfaces:** `dispatch(playerId, armyId, mission, target, t)` (HTTP `POST /movements`); `recall(playerId, movementId, t)`; `listMovements(playerId)`; `listIncoming(playerId)` (size class only); handlers `onArrival` (interaction) and `onReturn` (local); `previewTravel` (pure: duration for the dispatch UI).
- **Database entities:** Owns: `game.movements`, `game.movement_cargo` · Uses: `game.timed_actions` (kind `movement`, via P1), `game.armies` (via D11).
- **Business rules:**
  - travel time per SIM §8 (integer Euclidean distance, slowest unit, logistics, whole seconds, min 1 min);
  - recall only outbound, return after the time already travelled;
  - targets validated at dispatch and **re-validated at arrival**;
  - dispatching `attack_city` ends own protection;
  - one active movement per army;
  - the defender sees arrival time, origin and size class.
- **Events produced:** `movement.dispatched`, `movement.incoming`, `movement.recalled`, `movement.arrived`, `movement.returned`
- **Events consumed:** —
- **Validation requirements:** mission enabled (reinforce/transfer flags); target exists and is of the right kind; not own city for attacks; not protected; army non-empty and at home.
- **Failure handling:**
  - target invalid at arrival → movement `aborted`, army returns, `movement.arrived{status:aborted}`;
  - a duplicate arrival is a no-op (status + unique battle per movement);
  - recall racing arrival → whichever commits first under the lock wins, the other gets `MOVEMENT_ALREADY_ARRIVED`.
- **Automated tests:** duration math (W-11); recall; target became invalid before arrival; concurrent dispatch of the same army; arrival processed twice; return credits loot exactly once; interaction ordering with simultaneous arrivals.

### D13 — Combat simulation
- **Responsibilities:**
  - building the `BattleInput` snapshot from both sides;
  - generating the seed; running the deterministic engine (Stasis/Clash/Rewind);
  - computing loot, applying results through owners;
  - storing replayable battle records and per-participant reports with insights; replay.
- **Data ownership:** battle records (input, seed, ruleset, result, hash) and battle reports.
- **Dependencies:** D11 (`getDefenders`, `applyLosses`, doctrines), D09 (combat techs), D05 (wall level), D06 (`debitLoot`, protection/capacity, deficit/morale state), D16 (outpost garrison/result), D03 (power for the weak-target rule), `game-combat` (pure engine), CSPRNG port (seed).
- **Public interfaces:** `resolveBattle(movement, t)` (called by D12 inside the interaction transaction); `replay(battleId) → {matches, hash}` (admin/`tools/replay`); `getReport(playerId, reportId)` (HTTP `GET /reports/{id}`); `listReports(playerId)`.
- **Database entities:** Owns: `game.battles`, `game.battle_reports` · Owns (planned): `game.battles_in_progress`, `game.battle_decisions` · Uses: `game.unit_stacks`, `game.outpost_garrison`, `game.resource_balances` (via owners).
- **Business rules:**
  - the engine and formulas of SIM §9;
  - the seed comes from the server CSPRNG at resolution and is stored;
  - the engine is pure, so the same input + seed + ruleset gives the same hash;
  - commanders/abilities/decisions must be empty in ruleset 1;
  - one battle per movement;
  - loot per SIM §9.8 including the weak-target rule;
  - reports filter what each side may see (the defender does not see the attacker's tech levels or doctrine details);
  - battles are append-only.
- **Events produced:** `battle.resolved` · planned: `battle.window_opened`, `battle.decision_made`
- **Events consumed:** —
- **Validation requirements:** snapshot complete and Zod-valid before simulation; stack sizes ≤ 1,000,000; seed is 16 non-zero bytes; ruleset registered.
- **Failure handling:**
  - an engine exception aborts the whole interaction transaction, with no partial result. The movement stays due; the reconciler retries; repeated failure alerts and quarantines that movement (an admin runbook);
  - a replay mismatch is a critical alert.
- **Automated tests:**
  - W-12…W-15 goldens (hash `a9af1ceb…` for W-13);
  - 1,000 random battles × 2 runs (determinism);
  - integer-only output;
  - phase edge cases (empty defender, overwhelming attacker, retreat, equal forces);
  - replay after a ruleset upgrade;
  - processed twice → one battle;
  - report visibility;
  - insight generation for known scenarios.

### D15 — World generation
- **Responsibilities:** deterministic generation of a region (sectors, islands, terrain, bonuses, spawn zones, outpost sites) from a seed; recording the generation run.
- **Data ownership:** generation runs (seed, generator version, parameters).
- **Dependencies:** D16 (`createRegion`, bulk island/outpost insert); `game-world` generator; `Prng` (seeded).
- **Public interfaces:** `generateRegion(params, seed)` (pure, returns a plan); `applyGeneratedRegion(plan)` (CLI `tools/worldgen`, admin only); `renderDebugMap(plan)` (7.2 inspection).
- **Database entities:** Owns: `game.world_generation_runs` · Uses: `game.regions`, `game.sectors`, `game.islands`, `game.outposts` (via D16).
- **Business rules:**
  - same seed + version + params → identical region;
  - spawn zones spaced (≥ 6 cells between spawn islands);
  - every island reachable (no isolated clusters beyond the max travel range);
  - outpost tiers distributed by distance from spawn.
- **Events produced:** `region.generated`
- **Events consumed:** —
- **Validation requirements:** params schema (size, density, tier distribution); generated plan checked against constraints before insert.
- **Failure handling:** the insert is a single transaction per region (or batched with a run id and resumable); a constraint violation aborts with a report and inserts nothing.
- **Automated tests:** determinism; constraints (spacing, reachability, counts); idempotent apply (same run twice → no duplicates).

### D16 — Islands & territories
- **Responsibilities:**
  - the world model (regions, sectors, islands);
  - island occupancy; viewport map queries with visibility rules; spawn placement;
  - **neutral outposts** (garrison, clearing, respawn) as lockable owners;
  - territories post-MVP.
- **Data ownership:** world geometry and static terrain; island occupancy; outpost state.
- **Dependencies:** D04 (public city info for the map), D03 (protection badge), D13 (battle results against outposts arrive through `applyOutpostBattle`), P1 (`outpost_respawn` actions).
- **Public interfaces:**
  - `queryViewport(region, chunkRect, viewer)` (HTTP `GET /map`);
  - `getIsland(id)`; `placeSpawn(region, t, seed)`; `setOccupant(islandId, kind)`;
  - `getOutpostDefense(outpostId)`; `applyOutpostBattle(outpostId, result, t)`;
  - handler `onOutpostRespawn`; `islandBonus(cityId)` (effect provider for D06).
- **Database entities:** Owns: `game.regions`, `game.sectors`, `game.islands`, `game.outposts`, `game.outpost_garrison` · Owns (planned): `game.territories`, `game.territory_control`, `game.city_captures`.
- **Business rules:**
  - viewport ≤ 4×4 chunks;
  - no private data in map responses (no resources, army sizes or tech);
  - spawn rules (SIM §7);
  - outposts are cleared by an `attacker_victory` and respawn after `8 h + 2 h × (tier − 1)` with a full garrison (T-5);
  - an outpost is an owner with its own root lock (rank 2).
- **Events produced:** `outpost.cleared`, `outpost.respawned` · planned: `territory.captured`
- **Events consumed:** —
- **Validation requirements:** viewport bounds and region existence (Zod); coordinates inside the region; tier within data range.
- **Failure handling:** `WORLD_FULL` (no free spawn island) alerts the owner; a respawn processed twice is a no-op; map query timeout → 503 with retry hint (cached static layer still served).
- **Automated tests:** viewport bounds; no private fields; query plan uses the chunk index (latency measured in 7.3); concurrent spawn placement; respawn timing offline; outpost battle bookkeeping.

### D23 — Notifications
- **Responsibilities:**
  - the **transactional outbox** (append in producers' transactions, publish after commit);
  - per-player event sequence and catch-up;
  - the WebSocket gateway (sync messages); push notifications (preferences, quiet hours, grouping, token hygiene);
  - the in-game inbox and the "while you were away" summary.
- **Data ownership:** outbox rows, per-player event sequence, consumer bookkeeping, inbox entries, device tokens, notification preferences.
- **Dependencies:** Redis pub/sub (fan-out), Expo Push Service (`PushSender` port), D02 (player existence), P1 (`timed_action.scheduled` is published to BullMQ via the job scheduler port).
- **Public interfaces:**
  - `append(tx, event, recipients)` (used by every producer);
  - `publishPending()` (worker);
  - WS endpoint `/realtime` (authenticated; `hello{current_seq}`);
  - HTTP `GET /events?after=seq`, `GET /notifications`, `POST /notifications/read`, `PUT /me/notification-prefs`, `POST /me/devices`, `DELETE /me/devices/{id}`;
  - `whileYouWereAway(playerId, since)`.
- **Database entities:** Owns: `platform.outbox_events`, `platform.player_events`, `platform.player_event_cursors`, `platform.event_consumptions`, `game.notifications`, `game.device_tokens`, `game.notification_prefs` · Uses: —
- **Business rules:**
  - an event is published **only after** its transaction commits, and every committed event is eventually published (at least once; consumers dedupe);
  - per-player `seq` is gap-free and monotonic;
  - WS messages only invalidate client caches; they never carry state the client must trust;
  - push respects category preferences and quiet hours (local time zone); incoming attacks are high priority;
  - consecutive similar notifications are grouped;
  - invalid push tokens are invalidated;
  - published outbox rows are retained 14 days.
- **Events produced:** `notification.created` (ephemeral; never written to the per-player event sequence)
- **Events consumed:**
  - **all events with player recipients** (WebSocket sync);
  - inbox and push subset: `construction.completed`, `research.completed`, `recruitment.completed`, `movement.incoming`, `movement.arrived`, `movement.returned`, `battle.resolved`, `outpost.respawned`, `resources.deficit_started`, `resources.deficit_ended`, `resources.storage_full`, `units.deserted`, `protection.ended`.
- **Validation requirements:** event payloads validated against the `contracts` catalog on append (Zod); WS client messages Zod-validated, with malformed ones ignored; device token format per platform.
- **Failure handling:**
  - publisher crash → unpublished rows are picked up again (`SKIP LOCKED`);
  - Redis down → events stay unpublished and clients resync on reconnect;
  - push provider errors → retry with backoff, then drop (the inbox remains the durable record);
  - sequence gap detected by a client → catch-up or full refetch (10.3).
- **Automated tests:** rollback → no event; publisher crash → published after restart; per-player ordering; two tabs receive the same event; reconnect with a gap → catch-up; quiet hours and preferences; token invalidation; grouping; summary after a day offline.

### D27 — Administration & moderation
- **Responsibilities:** the append-only audit log; admin operations (find player, view state/ledger/battles, grant or remove resources with a reason, suspend/ban, replay battle); fairness signals and the suspicious-cluster report (detection only, 11.5); chat moderation post-MVP.
- **Data ownership:** audit trail; fairness signals; moderation records (planned).
- **Dependencies:** D01 (roles, suspension), D06 (`credit`/`spend` with reason `admin.*`), D13 (`replay`), D02 (player lookup).
- **Public interfaces:** `audit(tx, entry)` (used by sensitive operations in every domain); admin routes under `/admin/*` and `tools/admin` CLI (`grantResources`, `suspend`, `findPlayer`, `viewLedger`, `replayBattle`); `recordSignal(kind, …)`; `suspiciousClusters(period)`.
- **Database entities:** Owns: `platform.audit_log`, `platform.fairness_signals` · Owns (planned): `platform.reports`, `platform.moderation_actions`.
- **Business rules:**
  - every admin action is authorised (admin role) and audited **with a reason** (DB CHECK);
  - the audit log is append-only and contains no secrets or full IPs (prefix only);
  - fairness signals never trigger automatic punishment in the MVP;
  - collected data is listed in the privacy policy (12.6).
- **Events produced:** `admin.action_performed` · planned: `moderation.action_taken`
- **Events consumed:** `battle.resolved` (farming and loot-flow signals)
- **Validation requirements:** admin inputs Zod-validated; reason required; amounts bounded per action (configurable cap) to limit the damage of a compromised admin session.
- **Failure handling:** an audit write failure fails the whole operation (no unaudited admin action); a signal pipeline failure is non-blocking and retried.
- **Automated tests:** non-admin denied on every admin route; an audit row per action with redaction; staged linked-accounts scenario appears in the report (11.5); grant + ledger reconciliation.

---

## Platform modules

### P1 — Simulation core *(platform)*
- **Responsibilities:**
  - the `Clock` and time utilities; the generic timed-action model and state machine;
  - the handler registry; **settlement** (local and interactions, ordering, invariant I-SETTLE);
  - scheduling completion jobs; the reconciler;
  - the ruleset registry and activation.
- **Data ownership:** timed-action rows (lifecycle, timing, owner, counterparty, frozen payload), each player's settlement watermark, the ruleset registry.
- **Dependencies:** the handler registry (domains register `onComplete`/`onArrival`; no import of domain internals), D06/D07 (`accrueTo`, `nextBreakpoint`), D03 (activity breakpoints), `JobScheduler` port (BullMQ, ADR-0008), D23 (outbox append).
- **Public interfaces:** `schedule(tx, action)`; `cancel(tx, actionId, t)`; `settlePlayer(playerId, t)`; `settleOutpost(outpostId, t)`; `resolveInteraction(actionId)`; `reconcile(batch)` (worker); `GET /time`; `activeRuleset(t)`.
- **Database entities:** Owns: `game.ruleset_versions`, `game.timed_actions`, `game.player_settlement` · Uses: owners' root rows (`game.players`, `game.outposts`) for locking only.
- **Business rules:**
  - SIM §1 (lifecycle, ordering: instant → derived breakpoints → local before interaction → id);
  - effective `t = max(t, settled_at)`;
  - costs and durations frozen at creation; rates per ruleset segment;
  - lock discipline from DATABASE_DESIGN §5;
  - jobs are accelerators only.
- **Events produced:** `timed_action.scheduled` (internal, no player recipients)
- **Events consumed:** `timed_action.scheduled` (job scheduler, via outbox publisher)
- **Validation requirements:** payload Zod schema per kind; transitions validated by the pure state machine; `completes_at ≥ starts_at` (DB CHECK).
- **Failure handling:**
  - worker crash or Redis flush → the reconciler completes overdue actions (grace + interval);
  - a handler exception rolls back that settlement step; the step is retried by the next settle/reconcile, and repeated failure alerts and quarantines the action;
  - lock busy for the reconciler → skip (SKIP LOCKED).
- **Automated tests:** state machine; ordering with ties; settle twice = no change; offline completion; worker crash; Redis flush; two reconcilers never double-apply; interaction recursion terminates; ruleset activation splits segments.

### P2 — Request integrity *(platform)*
- **Responsibilities:** idempotency for all mutating requests; request hashing; replay of stored responses; key expiry.
- **Data ownership:** idempotency keys with request hash and stored response.
- **Dependencies:** D01 (account identity); P1/domains (the guarded operation runs in the same transaction).
- **Public interfaces:** API middleware `withIdempotency(route)`; header `Idempotency-Key` (contract in 2.4); cleanup job.
- **Database entities:** Owns: `platform.idempotency_keys` · Uses: —
- **Business rules:**
  - the key row is inserted **first** in the transaction (lock rank 0);
  - same key + same hash → stored response; same key + different hash → `IDEMPOTENCY_KEY_REUSED`;
  - only committed successes are stored;
  - keys expire after 24 h.
- **Events produced:** —
- **Events consumed:** —
- **Validation requirements:** key 16–128 characters; hash = SHA-256 of method + route + canonical body.
- **Failure handling:** a concurrent duplicate waits on the unique index, then replays the stored response; a business failure stores nothing, so the client may retry safely.
- **Automated tests:** same request twice → applied once, same response; reused key with a different body → error; concurrent duplicates; expiry cleanup.

---

## Post-MVP domains (outlines — to be finalised in S13)

### D14 — Temporal abilities
- **Responsibilities:** Flux-cost powers (*Accelerate*, *Anchor*, *Echo*, …) with eligibility, cooldowns and counterplay (SIM §13).
- **Data ownership:** cooldowns and activation history per player.
- **Dependencies:** D06 (Flux `spend`), P1 (adjusting timed actions with a recorded modifier), D13 (`BattleInput.abilities`), D12 (delaying an incoming army).
- **Public interfaces:** `activate(playerId, abilityId, target, t)`; `listAvailable(playerId, t)`.
- **Database entities:** Owns (planned): `game.ability_cooldowns`, `game.ability_activations`.
- **Business rules:** cannot be bought with money; every ability has counterplay; cooldown per player; limits per day; audited.
- **Events produced:** planned: `ability.activated`
- **Events consumed:** —
- **Validation requirements:** eligibility computed server-side only; target ownership; cooldown not active.
- **Failure handling:** an activation that races its target's completion → `TARGET_ALREADY_COMPLETED`, nothing spent.
- **Automated tests:** cooldown boundaries; Flux spent once; effect on settlement path independence; replay with abilities.

### D17 — Colonization
- **Responsibilities:** founding additional cities via a colonizer expedition; the city-count limit; empire overview.
- **Data ownership:** none of its own; colonization actions (timed action kind `colonization`) and the resulting cities via D04.
- **Dependencies:** D04 (`foundCity`), D16 (island lock, occupancy), D12 (travel), D06 (cost, transfers on), D09 (governance tech).
- **Public interfaces:** `launchColony(playerId, fromCity, islandId, t)`; `empireOverview(playerId)`.
- **Database entities:** Owns (planned): — · Uses: `game.timed_actions`, `game.cities` (via P1, D04).
- **Business rules:** city limit from tech/building; the target island must still be free at arrival; extra upkeep per city (SIM §13).
- **Events produced:** planned: `colony.founded`
- **Events consumed:** —
- **Validation requirements:** island free and reachable; limit not exceeded (checked at dispatch and arrival).
- **Failure handling:** two players colonising the same island → the first to resolve wins (island lock rank 3); the other expedition returns.
- **Automated tests:** simultaneous colonization; colony founded offline; settlement performance with many cities.

### D18 — Temporal corruption
- **Responsibilities:** corruption levels per city/sector, generated by heavy temporal-ability use, with production and combat effects.
- **Data ownership:** corruption level and remainder with its clock.
- **Dependencies:** D06 (modifier slot 6), D13 (battlefield conditions), P1.
- **Public interfaces:** `accrueTo(scope, t)`; `getCorruption(scope)`.
- **Database entities:** Owns (planned): `game.corruption_levels`.
- **Business rules:** linear accrual/decay (same exact machinery as SIM §3); threshold effects; interaction with the Convergence.
- **Events produced:** planned: `corruption.threshold_crossed`
- **Events consumed:** `ability.activated`
- **Validation requirements:** thresholds from `game-data`.
- **Failure handling:** event consumption idempotent; corruption never makes balances negative (modifier floors at 0).
- **Automated tests:** path independence; threshold crossings at exact instants.

### D19 — Exploration
- **Responsibilities:** expeditions, fog of war, anomaly discovery and outcomes.
- **Data ownership:** discoveries per player; anomaly definitions per sector.
- **Dependencies:** D12 (expedition travel), D16 (sectors), `Prng` (seeded outcomes), D06 (rewards).
- **Public interfaces:** `launchExpedition`; `getDiscoveries(playerId)`.
- **Database entities:** Owns (planned): `game.anomalies`, `game.discoveries`.
- **Business rules:** outcomes are deterministic from the stored seed; risk/reward from data.
- **Events produced:** planned: `exploration.discovered`
- **Events consumed:** —
- **Validation requirements:** sector reachable; expedition composition.
- **Failure handling:** expedition arrival processed twice → one discovery (unique per player and anomaly).
- **Automated tests:** determinism; fog visibility rules.

### D20 — Trading
- **Responsibilities:** caravan-based market (orders, matching, escrow, fees) (SIM §4.4).
- **Data ownership:** orders and trades.
- **Dependencies:** D06 (escrow via the ledger), D12 (caravan travel), D27 (anti-alt signals).
- **Public interfaces:** `placeOrder`; `cancelOrder`; `listOrders(region)`.
- **Database entities:** Owns (planned): `game.market_orders`, `game.trades`.
- **Business rules:** escrow at order time; a fee as a sink; price bands; flows between linked accounts flagged.
- **Events produced:** planned: `trade.executed`
- **Events consumed:** —
- **Validation requirements:** amounts > 0; within price band; ownership.
- **Failure handling:** a partial match is atomic per trade; escrow is always released or settled.
- **Automated tests:** no duplication or double spend under concurrent matching; fee accounting.

### D21 — Alliances
- **Responsibilities:** alliance creation, membership, roles, shared vision, alliance chat (moderated by D27).
- **Data ownership:** alliances and memberships.
- **Dependencies:** D23 (fan-out to members), D27 (moderation).
- **Public interfaces:** `create`, `invite`, `join`, `leave`, `setRole`.
- **Database entities:** Owns (planned): `game.alliances`, `game.alliance_members`.
- **Business rules:** one active alliance per player; membership limits; role permissions.
- **Events produced:** planned: `alliance.created`, `alliance.member_joined`, `alliance.member_left`
- **Events consumed:** —
- **Validation requirements:** name rules; permissions.
- **Failure handling:** concurrent joins over the limit → only allowed members are accepted (counted under the alliance row lock).
- **Automated tests:** limits under concurrency; permissions.

### D22 — Diplomacy
- **Responsibilities:** treaties between players/alliances and their effect on attack validation.
- **Data ownership:** treaties.
- **Dependencies:** D21, D12 (validation hook at dispatch and arrival).
- **Public interfaces:** `propose`, `accept`, `break`.
- **Database entities:** Owns (planned): `game.treaties`.
- **Business rules:** breaking a treaty has a notice period; non-aggression blocks attacks.
- **Events produced:** planned: `treaty.signed`, `treaty.broken`
- **Events consumed:** —
- **Validation requirements:** parties exist; no duplicate active treaty.
- **Failure handling:** a treaty signed while an attack is in flight → re-validated at arrival.
- **Automated tests:** attack blocked; notice period timing.

### D24 — Seasonal & world events
- **Responsibilities:** scheduled, region/sector-scoped events with exact start and end and their modifiers.
- **Data ownership:** event definitions and schedule.
- **Dependencies:** P1 (region-owned timed actions, breakpoints), D06 (modifier slot 5), D12 (travel modifiers).
- **Public interfaces:** `scheduleEvent` (admin); `activeEvents(region, t)`.
- **Database entities:** Owns (planned): `game.world_events`.
- **Business rules:** modifiers apply exactly at start for everyone, including offline players settled later; announced in advance when they affect combat or economy.
- **Events produced:** planned: `world_event.started`, `world_event.ended`
- **Events consumed:** —
- **Validation requirements:** non-overlapping rules per event type; parameters from data.
- **Failure handling:** an event cancelled mid-way → its end instant is set and the segment splits correctly.
- **Automated tests:** event starts while players are active; offline settlement across the window; overlaps; cancellation.

### D25 — Great Convergence
- **Responsibilities:** seasons layered on the permanent universe: objectives, seasonal modifiers, rankings, rewards, historical records, and the safe season transition (SIM §13).
- **Data ownership:** seasons, rankings, historical records.
- **Dependencies:** D24 (seasonal modifiers), D16 (Convergence sectors), D13/D02 (scores).
- **Public interfaces:** `currentSeason`; `rankings(season)`; `transition(dryRun)` (admin CLI).
- **Database entities:** Owns (planned): `game.seasons`, `game.season_rankings`, `game.historical_records`.
- **Business rules:** no wipe; only seasonal scores and temporary modifiers reset; the transition is idempotent and rehearsed on staging.
- **Events produced:** planned: `season.started`, `season.ended`
- **Events consumed:** `battle.resolved`, `territory.captured`
- **Validation requirements:** season schedule; reward definitions.
- **Failure handling:** a transition failing half-way resumes from its checkpoint (idempotent steps).
- **Automated tests:** a seasonal event starting while players are active; dry run equals the real run; permanent data untouched.

### D26 — Monetization *(owner decision required)*
- **Responsibilities:** store catalog, purchases, server-side receipt validation, entitlements, refunds.
- **Data ownership:** purchases and entitlements.
- **Dependencies:** D01 (account), store providers (Apple/Google/web payments), D27 (audit).
- **Public interfaces:** `validateReceipt`; `listEntitlements`; `refund` (webhook).
- **Database entities:** Owns (planned): `platform.purchases`, `platform.entitlements`.
- **Business rules:** nothing sold may change SIM §3–§9 outcomes (fair free-to-play); receipts validated server-side only.
- **Events produced:** planned: `purchase.completed`
- **Events consumed:** —
- **Validation requirements:** receipt signature; idempotent per transaction id.
- **Failure handling:** a provider outage queues validation; entitlements are never granted without validation.
- **Automated tests:** a duplicate receipt is granted once; refund revokes; no gameplay effect.

### D28 — Commanders
- **Responsibilities:** named leaders: acquisition (research/achievements, never loot boxes), traits, XP, injury, one per army.
- **Data ownership:** commanders and their progression.
- **Dependencies:** D11 (army slot), D13 (`BattleInput.commanders`).
- **Public interfaces:** `recruitCommander`; `assign(armyId)`; `unassign`.
- **Database entities:** Owns (planned): `game.commanders`.
- **Business rules:** one per army (partial unique index already exists on `armies.commander_id`); XP soft cap; injury is not permanent death in v1.
- **Events produced:** planned: `commander.recruited`, `commander.injured`
- **Events consumed:** `battle.resolved` (XP and injury)
- **Validation requirements:** ownership; not already assigned.
- **Failure handling:** concurrent assignment → the unique index rejects the second.
- **Automated tests:** commander bonus goldens; old battles replay unchanged; the same commander can never be in two armies under concurrency.

### D29 — Strategic infrastructure
- **Responsibilities:** world structures (gates, beacons, harvesters, fortresses) with world-level effects and ownership tied to territory.
- **Data ownership:** structures and their state.
- **Dependencies:** D16 (islands/territories), D12 (travel modifier), D06 (production modifier slot 7), P1 (construction as timed actions).
- **Public interfaces:** `build`; `upgrade`; `structuresIn(region, rect)`.
- **Database entities:** Owns (planned): `game.world_structures`.
- **Business rules:** ownership changes atomically with territory capture; effects end exactly when destroyed.
- **Events produced:** planned: `structure.built`, `structure.destroyed`
- **Events consumed:** `territory.captured`
- **Validation requirements:** placement rules; owner permissions.
- **Failure handling:** capture and destruction in the same instant → ordered by settlement rules.
- **Automated tests:** travel time with and without a gate; capture transfers ownership atomically.

---

## Event catalog

One row per event type. **Producer** is the only domain allowed to append it. **Recipients**: `owner` = the acting player; `defender` = the target's owner; `none` = internal. Payload schemas live in `contracts/events` (2.4/10.1).

| Event | Producer | Consumers | Recipients | Phase |
|---|---|---|---|---|
| `account.created` | D01 | — | none | MVP |
| `account.deleted` | D01 | — | none | MVP |
| `profile.updated` | D02 | — | owner | MVP |
| `tutorial.step_completed` | D02 | — | owner | MVP |
| `civilization.founded` | D03 | — | owner | MVP |
| `protection.ended` | D03 | D23 | owner | MVP |
| `civilization.activity_changed` | D03 | — | owner | MVP |
| `city.founded` | D04 | — | owner | MVP |
| `resources.deficit_started` | D06 | D23 | owner | MVP |
| `resources.deficit_ended` | D06 | D23 | owner | MVP |
| `resources.storage_full` | D06 | D23 | owner | MVP |
| `transfer.dispatched` | D06 | — | owner | MVP (flag off) |
| `transfer.arrived` | D06 | — | owner | MVP (flag off) |
| `construction.started` | D08 | — | owner | MVP |
| `construction.cancelled` | D08 | — | owner | MVP |
| `construction.completed` | D08 | D23 | owner | MVP |
| `research.started` | D09 | — | owner | MVP |
| `research.cancelled` | D09 | — | owner | MVP |
| `research.completed` | D09 | D23 | owner | MVP |
| `recruitment.started` | D10 | — | owner | MVP |
| `recruitment.cancelled` | D10 | — | owner | MVP |
| `recruitment.completed` | D10 | D23 | owner | MVP |
| `army.formed` | D11 | — | owner | MVP |
| `army.disbanded` | D11 | — | owner | MVP |
| `doctrine.changed` | D11 | — | owner | MVP |
| `units.deserted` | D11 | D23 | owner | MVP |
| `movement.dispatched` | D12 | — | owner | MVP |
| `movement.incoming` | D12 | D23 | defender | MVP |
| `movement.recalled` | D12 | — | owner, defender | MVP |
| `movement.arrived` | D12 | D23 | owner | MVP |
| `movement.returned` | D12 | D23 | owner | MVP |
| `battle.resolved` | D13 | D02, D23, D25, D27, D28 | owner, defender | MVP |
| `battle.window_opened` | D13 | — | owner, defender | Post-MVP |
| `battle.decision_made` | D13 | — | owner | Post-MVP |
| `ability.activated` | D14 | D18 | owner | Post-MVP |
| `region.generated` | D15 | — | none | MVP |
| `outpost.cleared` | D16 | D02 | owner | MVP |
| `outpost.respawned` | D16 | D23 | none (map invalidation) | MVP |
| `territory.captured` | D16 | D25, D29 | owner, defender | Post-MVP |
| `colony.founded` | D17 | — | owner | Post-MVP |
| `corruption.threshold_crossed` | D18 | — | owner | Post-MVP |
| `exploration.discovered` | D19 | — | owner | Post-MVP |
| `trade.executed` | D20 | — | owner, counterparty | Post-MVP |
| `alliance.created` | D21 | — | owner | Post-MVP |
| `alliance.member_joined` | D21 | — | alliance members | Post-MVP |
| `alliance.member_left` | D21 | — | alliance members | Post-MVP |
| `treaty.signed` | D22 | — | parties | Post-MVP |
| `treaty.broken` | D22 | — | parties | Post-MVP |
| `notification.created` | D23 | — | owner (ephemeral) | MVP |
| `world_event.started` | D24 | — | region players | Post-MVP |
| `world_event.ended` | D24 | — | region players | Post-MVP |
| `season.started` | D25 | — | all players | Post-MVP |
| `season.ended` | D25 | — | all players | Post-MVP |
| `purchase.completed` | D26 | — | owner | Post-MVP |
| `admin.action_performed` | D27 | — | none | MVP |
| `moderation.action_taken` | D27 | — | affected player | Post-MVP |
| `commander.recruited` | D28 | — | owner | Post-MVP |
| `commander.injured` | D28 | — | owner | Post-MVP |
| `structure.built` | D29 | — | owner | Post-MVP |
| `structure.destroyed` | D29 | — | owner | Post-MVP |
| `timed_action.scheduled` | P1 | P1 | none | MVP |

---

## Changes made to other documents in this Part
- **SYSTEM_ARCHITECTURE §5:**
  - Population produces no events in ruleset 1 (shortage is impossible, SIM §6);
  - Civilizations consumes no events (protection ends synchronously when D12 calls `endProtection`);
  - Armies adds `units.deserted`;
  - Player profiles adds `tutorial.step_completed`;
  - Civilizations adds `civilization.activity_changed`;
  - Resources adds the flagged transfer events;
  - Administration consumes `battle.resolved` for fairness signals.
- **SYSTEM_ARCHITECTURE §5** now points here as the authoritative domain definition.
