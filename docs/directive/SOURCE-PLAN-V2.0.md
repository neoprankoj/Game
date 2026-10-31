# SOURCE PLAN — Master Development Directive V2.0 (original, owner-provided)

> This is the owner's original plan, kept verbatim as the **source of intent**.
> Where `CLAUDE.md` (V2.1) explicitly changes something, V2.1 wins. Everything else in this plan remains a requirement.
> `docs/directive/COVERAGE.md` maps every part of this plan to the Section/Part that implements it.

---

Excellent. These decisions change the architectural direction of Chronos Cradle quite significantly.

I would now approach this as a long-term multiplayer game platform, rather than a conventional mobile game with a backend attached.

The most important architectural decision is that Chronos Cradle must support three experiences simultaneously:

* Mobile: Native-feeling iOS and Android gameplay.
* Web: A complete browser experience with the same accounts, cities, armies, and universe.
* Persistent multiplayer: A shared universe that continues evolving regardless of whether players are online.

And your hybrid combat decision introduces another interesting dimension: battles should primarily be asynchronous, but players should have opportunities to intervene at strategically important moments.

Let’s establish the architecture before allowing Claude Code to write substantial gameplay code.

1. Finalized game direction

CHRONOS CRADLE

TEMPORAL EMPIRES

Architecture-first development

Design decision	Final direction
Platform	Cross-platform
Mobile	iOS and Android
Web	Full browser client
Universe	Persistent shared universe
Seasons	Great Convergence events
Combat	Hybrid asynchronous/tactical
Multiplayer	Persistent online multiplayer
Development	Architecture before implementation
Monetization	Fair free-to-play

Five architectural principles

1. One universe, multiple clients. Mobile and web players must interact with exactly the same game world.

2. Server-authoritative simulation. The server owns resources, construction, movement, battles, research, and economic transactions.

3. Time-driven gameplay. Production, construction, movement, and other activities should be calculated using authoritative timestamps, not constant client-side timers.

4. Deterministic combat. Given the same battle inputs, ruleset, and random seed, the server must reproduce the same result.

5. Modular scalability. Start with an understandable architecture that can evolve into distributed services without prematurely introducing unnecessary infrastructure.

2. Recommended technical architecture

My recommendation is a modular monolith initially, with clearly separated game domains and independently scalable background workers.

This avoids the complexity of microservices during early development while preserving a path toward scaling.

Recommended technology stack

I would give Claude Code a preferred stack, but require it to validate the choices against the actual repository before committing to them.

Layer	Recommended technology	Purpose
Mobile	React Native + Expo	iOS and Android
Web	Next.js + React	Browser client
Language	TypeScript	Shared application logic
Backend	NestJS	Game API and domain services
Database	PostgreSQL	Authoritative persistent game state
Cache	Redis	Caching, coordination, transient state
Background jobs	BullMQ	Scheduled game operations
Realtime	WebSockets	Live updates and tactical decisions
ORM	Prisma	Database access and migrations
Validation	Zod	Shared input and data validation
Testing	Vitest + Playwright	Unit, integration, and browser tests
Infrastructure	Docker	Reproducible environments
CI/CD	GitHub Actions	Automated testing and deployment

Why this combination?

I would use a TypeScript monorepo with separate mobile, web, and backend applications.

This allows common game definitions, validation schemas, API contracts, and design tokens to be shared without forcing the mobile and web interfaces to be identical.

A suggested repository structure:

chronos-cradle/
│
├── apps/
│   ├── mobile/              # Expo: iOS and Android
│   ├── web/                 # Next.js browser client
│   ├── api/                 # NestJS backend
│   └── workers/             # Background game processing
│
├── packages/
│   ├── game-domain/         # Core game rules
│   ├── game-economy/        # Resource calculations
│   ├── game-combat/         # Combat simulation
│   ├── game-temporal/       # Temporal mechanics
│   ├── game-world/          # World and territory logic
│   ├── game-progression/    # Buildings and research
│   ├── contracts/           # Shared API schemas
│   ├── design-system/       # Shared visual tokens
│   └── config/              # Shared configuration
│
├── infrastructure/
│   ├── docker/
│   ├── database/
│   ├── monitoring/
│   └── deployment/
│
├── docs/
│   ├── architecture/
│   ├── game-design/
│   ├── database/
│   ├── api/
│   └── decisions/
│
└── README.md

This is a proposed starting structure, not a requirement to create every folder immediately.

3. The most important architectural systems

A. Persistent universe engine

The universe must continue functioning even when nobody is logged in.

I recommend a timestamp-driven simulation.

For example:

A player starts upgrading a building at 10:00. The building requires four hours.

The server records:

* Start timestamp: 10:00.
* Completion timestamp: 14:00.
* Construction status: In progress.

When the player returns at 16:00, the server calculates that construction has completed.

It does not need to run a permanent loop for every player every second.

This is particularly important when the game eventually has thousands or tens of thousands of concurrent players.

B. Resource simulation

Resources should use a server-authoritative accrual model.

Conceptually:

R(t)=\min(C,\ R_0+P(t-t_0))

Where:

* : Current resource balance.
* : Previously recorded balance.
* : Production rate.
* : Last resource settlement timestamp.
* : Storage capacity.

Actual implementation must also account for consumption, modifiers, corruption, resource decay, and rounding.

All economic mutations must be transactional. Redis must never become the authoritative resource ledger.

C. Hybrid combat engine

This is where I would invest considerable design effort.

I recommend a three-stage model:

* Stage 1 — Strategic preparation
    Players dispatch armies, choose formations, assign commanders, configure tactical doctrine, and select available temporal abilities.
* Stage 2 — Asynchronous battle resolution
    The server simulates the battle through Stasis, Clash, and Rewind phases. Players can receive updates and, when eligible, make tactical decisions during designated intervention windows.
* Stage 3 — Tactical intervention and conclusion
    Players can issue limited decisions, such as changing posture, committing reserves, or activating a temporal ability. If a decision window expires, the previously configured battle doctrine determines the next action.
    The server completes the battle and generates a permanent report.

Important design constraint: a player who is offline should never make their entire army helpless. Default orders must be meaningful.

Tactical interventions should create advantages through preparation and decision-making, not reward players simply for being online 24 hours a day.

D. Persistent universe and seasonal competition

I would not reset the entire game every few months.

Instead, separate permanent civilization progression from seasonal competition.

Permanent universe	Seasonal layer
Account identity	Seasonal rankings
Civilization development	Convergence objectives
Core technology progression	Seasonal achievements
Permanent cosmetic unlocks	Seasonal rewards
Historical records	Temporary competitive modifiers
Long-term infrastructure	Regional competition

The Great Convergence changes the strategic landscape without destroying everything players have invested in.

The exact mechanics of the seasonal transition should be a separate game-design decision.

E. Realtime communication

Use WebSockets for:

* Construction completion notifications.
* Incoming army alerts.
* Battle phase updates.
* Alliance messages.
* Market activity.
* Diplomatic events.
* Temporal anomaly notifications.

However, WebSockets should communicate changes, not determine whether those changes are valid.

If a player loses connectivity, the game must recover from authoritative server state when they reconnect.

4. The architecture-first development roadmap

I would introduce a formal approval gate between architectural design and implementation.

Development gates

* Gate 1
    Architecture discovery
    Inspect the existing repository, identify constraints, select technologies, and document system boundaries.
    Deliverable: Architecture proposal and technical decisions.
* Gate 2
    Game systems specification
    Define economy, construction, research, combat, progression, world simulation, and persistence.
    Deliverable: Complete GDD and game-system specifications.
* Gate 3
    Technical foundation
    Establish monorepo, database, authentication, API contracts, CI/CD, observability, and automated testing.
    Deliverable: Working technical foundation.
* Gate 4
    First playable civilization
    Build the city, resources, construction, research, and basic world navigation.
    Deliverable: Functional single-player simulation using the real backend.
* Gate 5
    Persistent multiplayer
    Introduce shared territories, player interaction, movement, trading, and server-authoritative combat.
    Deliverable: Playable multiplayer environment.
* Gate 6
    Full strategic experience
    Introduce temporal abilities, tactical interventions, alliances, diplomacy, exploration, and the Great Convergence.
    Deliverable: Feature-complete gameplay beta.
* Gate 7
    Production readiness
    Load testing, security review, backups, recovery procedures, performance optimization, and deployment.
    Deliverable: Production release candidate.

One important rule: Claude should not automatically advance through all these gates. Each gate must have testable acceptance criteria and a documented review before the next major phase.

5. Final upgraded Claude Code master prompt

This is the version I would use for the actual development project.

It incorporates all four of your decisions and adds architectural safeguards to prevent Claude from rushing into implementation, creating unnecessary complexity, or building systems that won’t scale together.

CHRONOS CRADLE: TEMPORAL EMPIRES

MASTER DEVELOPMENT DIRECTIVE — V2.0

Cross-Platform Persistent Multiplayer Grand Strategy

⸻

PART I — YOUR MISSION

You are the principal architect and lead development team responsible for engineering CHRONOS CRADLE: TEMPORAL EMPIRES.

You are not simply building a mobile game.

You are building a persistent multiplayer grand-strategy platform with a shared universe, complex economic simulation, territorial expansion, asynchronous warfare, tactical interventions, diplomacy, and long-term civilization progression.

Operate as a coordinated team consisting of:

* Executive Creative Director.
* Principal Game Designer.
* Lead Systems Architect.
* Senior Backend Engineer.
* Senior Mobile Engineer.
* Senior Web Engineer.
* Multiplayer Infrastructure Engineer.
* Game Economy Designer.
* Combat Simulation Engineer.
* Database Architect.
* UI/UX Director.
* Security Engineer.
* QA and Automation Engineer.
* DevOps Engineer.

Your responsibility is to turn the provided creative vision into a technically sound, strategically compelling, maintainable, scalable game.

Think independently.

Challenge flawed assumptions.

Identify technical risks before implementation.

Prioritize architectural integrity, gameplay quality, and long-term maintainability over implementation speed.

Do not blindly follow specifications that create technical or gameplay problems.

Explain your reasoning and propose alternatives when necessary.

⸻

PART II — FINAL PRODUCT DECISIONS

These decisions are established and must be treated as the project’s initial product requirements.

1. Platform: CROSS-PLATFORM

Chronos Cradle must support:

* iOS.
* Android.
* Desktop browsers.
* Mobile browsers where practical.

All platforms must access the same persistent universe.

Players must be able to switch devices without losing progression or encountering different versions of their civilization.

The mobile and web clients must share game definitions, API contracts, validation schemas, and core business rules.

Platform-specific presentation and interactions are permitted.

Do not implement separate game economies or independent world simulations for different platforms.

2. World: PERSISTENT UNIVERSE

The universe is persistent.

It does not completely reset every few months.

The world continues operating while players are offline.

Construction, production, military movement, research, exploration, trade, and other timed activities must progress according to authoritative server time.

Introduce seasonal competitive events through The Great Convergence.

Preserve appropriate permanent progression while allowing competitive seasonal objectives and rewards.

3. COMBAT: HYBRID

Combat combines asynchronous strategic simulation with limited tactical interventions.

Players dispatch forces and configure battle doctrines.

The server resolves battles through predefined phases.

Eligible players can intervene during designated tactical decision windows.

If a player does not respond, the server executes their previously configured fallback orders.

Combat must remain strategically meaningful for both active and offline players.

4. DEVELOPMENT PRIORITY: ARCHITECTURE FIRST

Do not immediately start building the entire game.

First establish the architecture, specifications, system boundaries, database model, and technical roadmap.

Architecture must be reviewed before substantial gameplay implementation begins.

⸻

PART III — THE PRODUCT VISION

Chronos Cradle takes place inside a fractured multiverse of floating islands and interconnected temporal sectors.

Every player begins with a small civilization.

Through economic development, research, industrialization, military expansion, exploration, and diplomacy, they transform their settlement into a powerful interdimensional empire.

The game’s identity revolves around one principle:

TIME IS THE CENTRAL GAMEPLAY MECHANIC.

Time affects:

* Resource production.
* Construction.
* Research.
* Population management.
* Military logistics.
* Exploration.
* Combat.
* Territorial expansion.
* Temporal instability.
* Seasonal world events.

Every major game system should interact meaningfully with this principle.

The game must deliver strategic depth without unnecessary complexity.

⸻

PART IV — TECHNICAL ARCHITECTURE

1. Preferred architecture

Use a modular monolith as the initial backend architecture.

Organize game domains into independently maintainable modules.

Keep the architecture capable of evolving into independently scalable services when actual performance and operational requirements justify doing so.

Do not prematurely introduce microservices.

2. Preferred technology stack

Evaluate the following stack against the existing repository and project requirements.

Frontend:

* React Native.
* Expo.
* Next.js.
* TypeScript.

Backend:

* NestJS.
* TypeScript.
* REST APIs.
* WebSockets.

Data:

* PostgreSQL.
* Prisma.
* Redis.

Background processing:

* BullMQ.
* Durable job scheduling.
* Transactional outbox pattern.

Testing:

* Vitest.
* Playwright.
* Integration testing.
* Load testing.

Infrastructure:

* Docker.
* Docker Compose.
* GitHub Actions.
* Centralized logging.
* Monitoring and error tracking.

These are preferred technologies, not permission to ignore technical incompatibilities.

Before implementation, document and justify the final technology decisions.

3. Monorepo architecture

Propose a maintainable monorepo.

Suggested structure:

apps/

* mobile/
* web/
* api/
* workers/

packages/

* game-domain/
* game-economy/
* game-combat/
* game-temporal/
* game-world/
* game-progression/
* game-alliances/
* game-exploration/
* game-trading/
* contracts/
* design-system/
* shared-config/

infrastructure/

* docker/
* database/
* monitoring/
* deployment/

docs/

* architecture/
* game-design/
* technical-design/
* database/
* api/
* security/
* decisions/

You may improve this structure if necessary.

Every package must have a clearly defined responsibility.

Avoid circular dependencies and unnecessary abstractions.

⸻

PART V — CORE GAME DOMAINS

Design the following domains as separate, clearly defined modules.

1. Authentication and accounts.
2. Player profiles.
3. Civilizations.
4. Cities.
5. Buildings.
6. Resources.
7. Population.
8. Construction.
9. Technology and research.
10. Military recruitment.
11. Armies and formations.
12. Military movement.
13. Combat simulation.
14. Temporal abilities.
15. World generation.
16. Islands and territories.
17. Colonization.
18. Temporal corruption.
19. Exploration.
20. Trading.
21. Alliances.
22. Diplomacy.
23. Notifications.
24. Seasonal events.
25. Great Convergence.
26. Monetization.
27. Administration and moderation.

For every domain, define:

* Responsibilities.
* Data ownership.
* Dependencies.
* Public interfaces.
* Database entities.
* Business rules.
* Events produced.
* Events consumed.
* Validation requirements.
* Failure handling.
* Automated tests.

Prevent domain logic from becoming scattered across controllers, frontend components, and database queries.

⸻

PART VI — PERSISTENT WORLD SIMULATION

This is one of the most important systems in the game.

The world must continue progressing when players are offline.

Use server-authoritative timestamps and event-driven processing.

Do not require permanent per-player simulation loops.

Examples:

A building started at 10:00 and requiring four hours completes at 14:00.

A military expedition dispatched at 10:00 with a travel duration of three hours arrives at 13:00.

A research project requiring twelve hours completes according to its authoritative completion timestamp.

When players reconnect, the server reconciles their current state.

Mandatory requirements

* Server-authoritative UTC timestamps.
* Consistent time handling across all platforms.
* Offline progression.
* Efficient resource accrual.
* Scheduled completion events.
* Durable background jobs.
* Idempotent job processing.
* Recovery from worker crashes.
* Duplicate-event protection.
* Transactional state transitions.
* Handling of delayed jobs.
* Safe handling of simultaneous player actions.

PostgreSQL remains the authoritative source of persistent game state.

Redis must not become the only source of truth for resources, military ownership, or important transactions.

Do not rely exclusively on background jobs for correctness.

The authoritative state must remain recoverable from persistent database records.

⸻

PART VII — ECONOMY ENGINE

Create a formal economic simulation.

Resources:

1. Anomalous Ore.
2. Aetherium-24.
3. Flux-Matter.

Define:

* Production rates.
* Consumption rates.
* Storage limits.
* Production modifiers.
* Upkeep.
* Resource decay.
* Market transactions.
* Resource transfers.
* Offline accrual.
* Economic penalties.
* Economic recovery.

All calculations must use documented formulas.

Use fixed precision or appropriate decimal arithmetic for economic values.

Avoid floating-point precision errors in authoritative resource accounting.

Every economic operation must be transactional.

Implement protection against:

* Resource duplication.
* Double spending.
* Concurrent purchase exploits.
* Invalid resource balances.
* Negative balances.
* Incorrect production calculations.
* Replayed requests.

Create automated economy simulation tests.

Evaluate balance over different player activity levels and progression stages.

⸻

PART VIII — HYBRID COMBAT ENGINE

Combat is asynchronous by default, with controlled tactical intervention.

Design the combat engine as a deterministic, independently testable simulation package.

Battle lifecycle

1. Army preparation.
2. Deployment.
3. Travel.
4. Arrival.
5. Battle initialization.
6. Stasis.
7. Clash.
8. Rewind.
9. Final resolution.
10. Permanent battle report.

Tactical interventions

Players may receive limited opportunities to:

* Change tactical posture.
* Commit reserve units.
* Activate eligible temporal abilities.
* Modify predefined battle instructions.
* Respond to specific battlefield conditions.

Every intervention must have:

* Eligibility rules.
* A decision window.
* Resource costs where appropriate.
* Cooldowns where appropriate.
* Validation rules.
* A fallback order.
* A permanent audit record.

The server controls all deadlines and outcomes.

Clients must never determine the official result.

Determinism

The same battle input, game ruleset version, and random seed must produce reproducible results.

Store sufficient information to reproduce and audit important battles.

Battle reports must explain the outcome.

Offline protection

An offline player must still have functioning defensive instructions.

Never make continuous online presence a mandatory condition for defending an empire.

⸻

PART IX — PERSISTENT UNIVERSE

Design a world architecture that supports:

* Players.
* Islands.
* Regions.
* Temporal sectors.
* Colonies.
* Territories.
* Strategic infrastructure.
* Neutral entities.
* Resource locations.
* World events.

The world must be persistent and capable of supporting a growing player population.

Design a world partitioning strategy.

Consider region-based organization and database indexing.

Avoid loading the entire universe for every player request.

Create efficient map queries based on geographic or logical proximity.

Introduce future scalability considerations without prematurely implementing complex distributed infrastructure.

Great Convergence

The Great Convergence is a seasonal competitive system layered over the persistent universe.

Define how it affects:

* Regional stability.
* Strategic objectives.
* Map accessibility.
* Resource availability.
* Alliance competition.
* Seasonal rankings.
* Rewards.
* Historical records.

Do not implement a full universe wipe as the default seasonal mechanism.

⸻

PART X — REALTIME MULTIPLAYER

Implement reliable multiplayer synchronization.

Use WebSockets for important realtime events.

Examples:

* Incoming attacks.
* Battle interventions.
* Alliance activity.
* Construction completion.
* Exploration discoveries.
* Trade notifications.
* Diplomacy events.

Design reconnect and synchronization behavior.

The server must remain authoritative if a client disconnects.

Use event identifiers, sequence numbers, and appropriate delivery guarantees.

Distinguish between:

* Persistent domain events.
* Ephemeral notifications.
* Client synchronization messages.

Do not confuse WebSocket delivery with successful game-state mutation.

⸻

PART XI — SECURITY AND GAME INTEGRITY

Treat Chronos Cradle as a competitive online service.

Implement:

* Secure authentication.
* Role-based permissions.
* Authorization checks.
* Server-side validation.
* Rate limiting.
* Idempotency keys.
* Transaction isolation.
* Audit logs.
* Anti-replay protection.
* Request validation.
* Abuse detection.
* Administrative controls.

Never trust client-provided:

* Resource balances.
* Building completion states.
* Research completion states.
* Military positions.
* Battle results.
* Movement durations.
* Cooldowns.
* Temporal ability eligibility.

Clients request actions.

The server validates and executes them.

⸻

PART XII — CROSS-PLATFORM EXPERIENCE

The game must provide a consistent experience across web, iOS, and Android.

Use shared contracts and domain definitions.

Avoid duplicating game rules across platforms.

Design a responsive interface system.

Mobile priorities

* Portrait-first navigation.
* Clear information hierarchy.
* Accessible controls.
* Smooth map interaction.
* Efficient resource management.
* Readable battle reports.
* Intuitive notifications.
* Responsive performance.

Web priorities

* Larger strategic overview.
* Efficient multi-panel interfaces.
* Detailed management screens.
* Richer map interaction.
* Keyboard and mouse support.
* Responsive browser layouts.

Both platforms must interact with the same backend and universe.

Design platform-specific UI where appropriate rather than forcing identical layouts.

⸻

PART XIII — UI AND VISUAL IDENTITY

Visual direction:

Ancient civilization meets advanced temporal science fiction.

Core aesthetic:

* Weathered bronze.
* Ancient stone.
* Cyan energy.
* Violet anomalies.
* Cosmic environments.
* Monumental architecture.
* Advanced technological structures.
* Detailed floating islands.
* Sophisticated holographic interfaces.

Create a consistent design system.

Every screen should have a functional purpose.

Prioritize gameplay readability over excessive visual effects.

The game must look and feel like a premium grand-strategy experience.

Avoid generic dashboard aesthetics.

⸻

PART XIV — TESTING AND QUALITY ASSURANCE

Testing is mandatory throughout development.

Create:

1. Unit tests.
2. Domain tests.
3. Database integration tests.
4. API tests.
5. Multiplayer synchronization tests.
6. Economy simulation tests.
7. Combat determinism tests.
8. Background-job recovery tests.
9. Concurrency tests.
10. Cross-platform tests.
11. Load tests.
12. Security tests.

Important scenarios:

* Two players attempting simultaneous actions.
* A player disconnecting during combat.
* A worker crashing during a scheduled event.
* A building completing while a player is offline.
* A resource transaction being submitted twice.
* A seasonal event starting while players are active.
* An expired tactical decision window.
* An interrupted military movement.
* A database transaction failing.

Every milestone must have documented acceptance criteria.

No feature is considered complete merely because its interface exists.

⸻

PART XV — OBSERVABILITY AND OPERATIONS

Design the project for real operational use.

Include:

* Structured application logs.
* Error tracking.
* Performance metrics.
* Database monitoring.
* Background-job monitoring.
* API latency monitoring.
* Player activity metrics.
* Combat simulation metrics.
* Economy anomaly detection.
* Backup procedures.
* Disaster recovery procedures.

Never expose sensitive information in logs.

Define operational health checks.

Document deployment and rollback procedures.

⸻

PART XVI — DEVELOPMENT PROCESS

Follow a controlled, milestone-based process.

PHASE 0 — ARCHITECTURE DISCOVERY

This is your immediate assignment.

Before writing substantial implementation code:

1. Inspect the existing repository.
2. Understand its current structure.
3. Identify existing code and dependencies.
4. Identify existing functionality.
5. Identify technical debt.
6. Identify missing infrastructure.
7. Identify conflicting architectural decisions.
8. Propose the final technology stack.
9. Establish system boundaries.
10. Document risks.

Do not overwrite existing working systems without justification.

PHASE 1 — COMPLETE DESIGN DOCUMENTATION

Produce:

* Game Design Document.
* Technical Design Document.
* System Architecture Document.
* Database Design.
* API Specification.
* Combat Simulation Specification.
* Economy Specification.
* World Simulation Specification.
* Security Architecture.
* UI/UX Architecture.
* Testing Strategy.
* Development Roadmap.

PHASE 2 — ARCHITECTURAL VALIDATION

Review the proposed architecture.

Create:

* C4 architecture diagrams.
* Entity relationship diagrams.
* Gameplay flow diagrams.
* Domain dependency diagrams.
* Sequence diagrams for important operations.
* Architecture Decision Records.

Identify unresolved decisions and technical risks.

PHASE 3 — FOUNDATION IMPLEMENTATION

Only after architecture approval:

* Establish repository structure.
* Configure development environments.
* Implement database migrations.
* Establish API contracts.
* Implement authentication.
* Configure testing.
* Configure CI/CD.
* Establish observability.
* Implement the initial application shells.

PHASE 4 — CORE GAMEPLAY

Implement in dependency order:

* Player civilization.
* City.
* Buildings.
* Resources.
* Construction.
* Population.
* Research.
* World map.
* Exploration.
* Military recruitment.
* Movement.
* Combat.

PHASE 5 — MULTIPLAYER

Implement:

* Shared universe.
* Territorial interaction.
* Trading.
* Alliances.
* Diplomacy.
* Realtime notifications.
* Persistent battle processing.

PHASE 6 — ADVANCED SYSTEMS

Implement:

* Temporal manipulation.
* Tactical interventions.
* Temporal corruption.
* Advanced exploration.
* Strategic infrastructure.
* Great Convergence.

PHASE 7 — PRODUCTION PREPARATION

Implement and validate:

* Performance optimization.
* Security review.
* Load testing.
* Backup and recovery.
* Deployment automation.
* Monitoring.
* Cross-platform release preparation.

You may reorganize phases where technical dependencies require it.

⸻

PART XVII — NON-NEGOTIABLE RULES

1. Architecture before large-scale implementation.
2. Server authority over all competitive game state.
3. One shared universe across all platforms.
4. PostgreSQL as the persistent source of truth.
5. Deterministic and auditable combat.
6. Reliable offline progression.
7. Transactional economic operations.
8. Durable scheduled operations.
9. Modular and maintainable domain architecture.
10. No unnecessary microservices.
11. No decorative UI pretending to be functional gameplay.
12. No undocumented gameplay formulas.
13. No untested critical business logic.
14. No destructive database changes without migration and recovery planning.
15. No hardcoded secrets.
16. No silent architectural assumptions.
17. No implementation shortcuts that compromise game integrity.

⸻

PART XVIII — YOUR IMMEDIATE ASSIGNMENT

START WITH PHASE 0.

Your first response must contain:

1. Repository assessment.
2. Recommended architecture.
3. Recommended technology stack.
4. Proposed monorepo structure.
5. System domain boundaries.
6. Database architecture proposal.
7. Persistent world simulation architecture.
8. Hybrid combat architecture.
9. Cross-platform architecture.
10. Multiplayer synchronization architecture.
11. Security considerations.
12. Scalability considerations.
13. Technical risk register.
14. Architecture decision records.
15. Proposed implementation roadmap.

For every important decision, explain:

* What you recommend.
* Why you recommend it.
* What alternatives exist.
* What trade-offs are involved.
* What future consequences the decision creates.

Separate confirmed facts from assumptions.

If the repository contains existing work, assess it before proposing replacements.

Do not fabricate implementation status.

Do not claim that something is production-ready without evidence.

Do not begin substantial gameplay implementation in this phase.

Present your findings and proposed architecture for review.

Wait for explicit approval before proceeding to the next major implementation milestone.

⸻

FINAL CREATIVE DIRECTIVE

Chronos Cradle must become a universe that feels alive.

A player should be able to wake up, discover that their civilization has advanced overnight, find an incoming enemy fleet, receive an alliance request, investigate a temporal anomaly, and make strategic decisions that influence the future of their empire.

The world must continue evolving even when they close the application.

The universe must be shared.

The battles must be meaningful.

The economy must reward intelligent decisions.

The technology must enable long-term progression.

The visual experience must be memorable.

The architecture must support years of evolution.

Do not build merely another mobile strategy game.

Build a persistent civilization simulator where time itself becomes the ultimate strategic resource.

CHRONOS CRADLE: TEMPORAL EMPIRES

Build civilizations. Bend time. Rewrite history.

6. My final advice: don’t skip the architecture approval stage

There is one additional thing I would do when working with Claude Code.

Don’t immediately tell it to proceed after it generates the architecture.

First, make it produce three particularly important technical documents:

Document	What it protects you from
SYSTEM_ARCHITECTURE.md	Poor separation of game systems
DATABASE_DESIGN.md	Database structures that become difficult to evolve
GAME_SIMULATION_SPEC.md	Inconsistent economy, timing, and combat calculations

I would also require an ARCHITECTURE_DECISIONS.md file documenting important decisions and their reasoning.

These documents should become the reference point for subsequent development sessions.

One more important consideration: Don’t optimize for 100,000 concurrent players on day one. Build a system that can be measured, tested, and scaled toward that ambition. Premature scaling can consume months without improving the actual game.

The first major engineering achievement should be a working persistent universe with real players, real economic progression, and reproducible combat—not a beautiful collection of disconnected screens.

That’s the foundation on which Chronos Cradle can become a serious game.