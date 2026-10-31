# S08 — Military

**Goal of this section:** players raise forces, organize them into armies, set doctrines and send them across the map.

---

### Part 8.1 — Unit definitions
**Goal:** the MVP roster as data.
**Depends on:** 4.1, 1.4.
**Build:** `game-data` units (e.g. 5–7 MVP units with clear roles: line infantry, ranged, heavy, fast raider, siege, temporal specialist) with stats (integer attack, defense, health, speed, carry capacity), costs, upkeep, population, training time, prerequisites. Counter relationships documented in the spec.
**Done when:** data validates; each unit has a clear role and counter.
**Tests:** data validation; prerequisite checks.

### Part 8.2 — Recruitment
**Goal:** train units over time.
**Depends on:** 8.1, 3.3, 4.3, 6.5.
**Build:** recruitment queue (timed action `recruitment`), batch recruitment rules, costs and population reserved at start, units added to city garrison on completion, upkeep starts per spec.
**Done when:** recruitment completes offline; upkeep shows in the economy breakdown.
**Tests:** costs, population, completion, cancel/refund, concurrent requests.

### Part 8.3 — Armies & formations
**Goal:** group units for operations.
**Depends on:** 8.2.
**Build:** tables `armies`, `army_units`; create/disband army from garrison; MVP formation options per spec (e.g. balanced, vanguard, defensive line) affecting combat modifiers; city defense is the garrison plus fortifications. Armies include a nullable commander reference (commanders arrive in 13.13; always empty in MVP).
**Done when:** units are always in exactly one place (garrison, army at home, army moving, army in battle) — enforced by constraints and tests.
**Tests:** no unit duplication or loss when forming/disbanding concurrently.

### Part 8.4 — Doctrines (default orders)
**Goal:** offline players are never helpless.
**Depends on:** 8.3, 1.4.
**Build:** doctrine settings per army and for city defense (e.g. stance: aggressive / balanced / defensive; retreat threshold; Rewind priority). Every army and city always has a valid doctrine (default provided). These feed combat in S09 and will be the fallback orders for post-MVP intervention windows.
**Done when:** a doctrine can be set from the client and is stored with validation.
**Tests:** validation; defaults always present.

### Part 8.5 — Movement
**Goal:** armies travel across the universe over time.
**Depends on:** 8.3, 7.1, 3.4.
**Build:** dispatch endpoint (target, mission: attack outpost, attack city, reinforce, return), travel duration from distance + slowest unit speed + modifiers per spec, timed action `movement` with arrival event, recall rules (return time per spec), automatic return trip after battle with loot. Targets validated at dispatch and again at arrival (target may have changed). Defender sees incoming movement per visibility rules.
**Done when:** an army dispatched before logging off arrives, triggers its mission and returns home with results — all without the player online.
**Tests:** duration math; recall; target became protected/disappeared before arrival; concurrent dispatch of the same army.

### Part 8.6 — Military screens
**Goal:** manage forces from any device.
**Depends on:** 5.3, 8.2–8.5.
**Build:** barracks/recruitment screen, army management (compose, formation, doctrine), dispatch flow from the map (select target → choose army → see travel time → confirm), movements list with countdowns, incoming threats list.
**Done when:** E2E: recruit → form army → dispatch to outpost → (advance clock) → army returns.
