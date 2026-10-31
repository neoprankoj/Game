# 00 — Product Vision

## The game
Chronos Cradle takes place in a fractured multiverse of floating islands and interconnected temporal sectors.
Every player begins with a small settlement. Through economy, research, industry, military expansion, exploration and diplomacy, they grow it into an interdimensional empire.

**Core identity: TIME IS THE CENTRAL GAMEPLAY MECHANIC.**
Time shapes production, construction, research, population, military logistics, exploration, combat, territorial expansion, temporal instability and seasonal events. Every major system must interact meaningfully with time.

Strategic depth without unnecessary complexity.

## Design pillars
1. **A living universe.** The world keeps moving while you are away. Coming back should feel like returning to a story that continued.
2. **Decisions over presence.** Good planning beats being online 24/7. Offline players are protected by meaningful default orders.
3. **Time as a resource.** Players trade time against resources, risk and position. Timing an attack, a build or a research path is the core skill.
4. **Fair competition.** No pay-to-win. No outcome decided by who has the most money or the least sleep.
5. **Readable depth.** Every number that matters can be understood: battle reports explain outcomes, economy screens explain rates.

## Resources
| Resource | Role (initial intent — finalize in GAME_SIMULATION_SPEC) |
|---|---|
| **Anomalous Ore** | Common base resource: construction and basic units |
| **Aetherium-24** | Mid-tier energy resource: research, advanced buildings, upkeep |
| **Flux-Matter** | Rare temporal resource: advanced units, temporal technologies |

## Combat identity
Battles resolve through three named phases — **Stasis**, **Clash**, **Rewind** — which must have distinct mechanical meaning (to be defined in Part 1.4 and approved by the owner). Suggested starting interpretation for Claude to evaluate and improve:
- **Stasis:** positioning and preparation; doctrines, formations and defensive structures set initial modifiers.
- **Clash:** main exchange of damage over a fixed number of rounds.
- **Rewind:** a temporal correction phase — a limited portion of losses can be undone based on technology and doctrine, rewarding preparation.

The MVP resolves all phases asynchronously using doctrines. Tactical intervention windows between phases come post-MVP.

## Expansion arc
Growth follows a clear arc: one settlement → a developed city → colonies on new islands → controlled territories with strategic infrastructure → an interdimensional empire competing in the Great Convergence. The MVP covers the first two steps; the data model and specs are designed for the whole arc from day one.

## Army lifecycle
Preparation (units, formation, commander, doctrine, temporal abilities) → deployment → travel → arrival → battle initialization → Stasis → Clash → Rewind → final resolution → permanent battle report → return. Commanders, temporal abilities and live intervention arrive post-MVP; doctrines always provide the fallback orders.

## Great Convergence (post-MVP)
A seasonal competitive layer over the persistent universe. It shifts regional stability, objectives, map access and resource availability, with seasonal rankings and rewards. Permanent progression (account, civilization core, cosmetics, history) is never wiped.

## Visual identity
Ancient civilization meets advanced temporal science fiction.
- Weathered bronze, ancient stone, cyan energy, violet anomalies, cosmic backdrops.
- Monumental architecture, detailed floating islands, sophisticated holographic interfaces.
- Gameplay readability beats visual effects. Premium grand-strategy feel, never a generic dashboard.

## Platform experience
- **Mobile:** portrait-first, clear hierarchy, thumb-reachable controls, smooth map, readable reports.
- **Web:** larger strategic overview, multi-panel layouts, keyboard and mouse support.
- Same backend, same universe, platform-appropriate layouts.

## The north-star moment
A player wakes up, sees their civilization advanced overnight, spots an incoming enemy force, checks that their defensive doctrine is ready, investigates an anomaly, and makes decisions that shape the future of their empire — in five minutes on a phone or an hour on a desktop.

## What success looks like for the MVP
Not a beautiful set of screens — a working persistent universe with real players, real economic progression, and reproducible combat that people want to come back to tomorrow.

*Build civilizations. Bend time. Rewrite history.*
