# ADR-0011 — Package structure refinements: `game-core`, `application`, `tools/`

| Field | Value |
|---|---|
| Status | Accepted at the S01 gate, 2026-11-01 |
| Date | 2026-10-31 |
| Part | 1.2 |
| Owner approval needed | **Yes**: this changes the target structure in `CLAUDE.md` §6, which §6 allows "via an ADR". |

## Context
While designing `SYSTEM_ARCHITECTURE.md`, three gaps appeared in the `CLAUDE.md` §6 layout:
1. **Use-case orchestration has no home.** Settlement and every mutating use case follow *lock → settle → validate → mutate → outbox → commit*, combining pure `game-*` rules with `db` repositories. Both `apps/api` (player requests) and `apps/workers` (jobs, reconciler, battle resolution) must run the **same** code. Putting it in `apps/api` makes workers import an app (forbidden). Putting it in `packages/db` mixes game orchestration with persistence (rule 20).
2. **Shared deterministic primitives have no neutral home.** Combat and world generation both need a seeded PRNG. Economy, combat and progression all need integer/fixed-point helpers and id types. Putting them in `game-economy` would make `game-combat` depend on the economy, which would hurt combat's independence and replayability.
3. **CLIs** (economy simulation 4.6, world generation 7.2, admin 11.6, battle replay 9.4) need a place that is neither a deployed app nor a library.

## Decision
- Add **`packages/game-core`**: pure, dependency-free primitives. That covers integer and fixed-point arithmetic with explicit rounding, branded id types, `Instant`/`Duration` value types (integer ms), the seeded `Prng` interface plus one implementation (algorithm chosen in 1.4), and `Result`/typed-error helpers. It holds no game rules.
- Add **`packages/application`**: one folder per domain (`application/src/<domain>/`) holding use cases, the settlement orchestrator, the outbox writer and the timed-action handler registry. It may import all `game-*`, `game-data`, `db` and `contracts`. It must not import Fastify, BullMQ or any transport. `apps/api` and `apps/workers` become thin adapters over it.
- Add a top-level **`tools/`** folder for developer and owner CLIs (`sim`, `worldgen`, `admin`, `replay`), never deployed to clients.
- Tighten the `game-*` import rule written in ADR-0001: `game-*` packages may import `game-core`, `game-data` and lower `game-*` packages (as layered in SYSTEM_ARCHITECTURE §3.2), but **not** `contracts`. API shapes must not leak into rules.
- Clarify `db`'s scope as persistence only (schema, migrations, repositories, transaction and lock helpers), matching `CLAUDE.md` §6.

## Alternatives
| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **Separate `application` package** | One implementation for API and workers; transport-free and testable with a real DB | One more package | **Chosen** |
| Orchestration inside `packages/db` | No new package | `db` becomes "everything with I/O"; game orchestration mixed with SQL; breaks rule 20's spirit | Rejected |
| Orchestration inside `apps/api`, workers call the API over HTTP | Simple dependency graph | Network hop for every job; settlement correctness depends on API availability; harder transactions | Rejected |
| Duplicate orchestration in both apps | — | Divergence guaranteed | Rejected |
| Primitives in `game-temporal` or `game-economy` instead of `game-core` | No new package | Combat would depend on economy/temporal; wrong coupling | Rejected |

## Trade-offs
- Two more packages and one more folder add a little more structure, in exchange for clear layering: rules (pure) → application (use cases) → apps (transport).
- `application` is the largest package. Its per-domain folders plus dependency-cruiser rules (no cross-domain imports except through each domain's `index.ts`) keep it modular.

## Consequences
- SYSTEM_ARCHITECTURE §3 documents the layout and import rules. Part 2.1 encodes them in dependency-cruiser.
- `CLAUDE.md` §6 is not edited by Claude. The owner may update it after approving this ADR. Until then, this ADR is the reference.
- **Revisit when** `application` grows beyond what one package can build and test quickly (e.g. CI > 10 min for it alone). Then split per bounded context.

## Verification
Part 2.1: depcruise rules for the new packages exist and a deliberate violation fails (`game-combat` → `game-economy`, `game-economy` → `contracts`, `apps/workers` → `apps/api`).
