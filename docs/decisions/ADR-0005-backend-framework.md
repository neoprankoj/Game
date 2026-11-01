# ADR-0005 — Backend framework: Fastify 5 modular monolith

| Field | Value |
|---|---|
| Status | Accepted at the S01 gate, 2026-11-01 |
| Date | 2026-10-31 |
| Part | 1.1 |
| Owner approval needed | No deviation from `CLAUDE.md` §5. (This confirms the owner-approved V2.2 change from the source plan's NestJS.) |

## Context
- The API must be **thin**: routing, auth, validation and error mapping. Domain logic lives in pure `packages/game-*`, and persistence/transactions live in `packages/db` (`CLAUDE.md` §6, rule 20).
- It must serve REST plus WebSockets (S10), validate every input with Zod (§8), and emit a generated OpenAPI spec (`docs/architecture/api/`).
- Structure must come from our package boundaries, not from framework decorators. One developer maintains it.

**Verified facts (npm registry, 2026-10-31):**
- `fastify` latest is **5.12.7** (2026-10-13). A `6.0.0-alpha.5` exists under `next`. Fastify 5 depends on `pino ^9.14 || ^10.1`, so structured logging is built in (ADR-0010).
- Maintained plugins: `@fastify/websocket` 11.3.6 (on `ws` 8.22), `@fastify/rate-limit` 11.2.1, `@fastify/cors` 11.3.1, `@fastify/helmet` 13.2.0. All were published in October 2026.
- `fastify-type-provider-zod` 7.0.0: peers `fastify ^5.5`, `zod >=4.1.5`, `@fastify/swagger >=9.5.1`, so Zod schemas can drive validation and OpenAPI. It is community-maintained; last published 2026-06.
- `@nestjs/core` latest is 12.3.2. `hono` latest is 4.13.14.
- Better Auth has an official Fastify integration guide (ADR-0007).

## Decision
- **Fastify 5.x** for `apps/api`: one process serving HTTP and WebSocket. It is organised as **one Fastify plugin per domain module** (`modules/cities`, `modules/construction`, …). Each plugin only:
  1. parses and validates input with the Zod schema from `contracts`;
  2. resolves the authenticated player and checks authorization;
  3. calls an application service (in `packages/db` or a small `apps/api/src/services` layer) that runs **one transaction** combining pure `game-*` rules with repositories;
  4. maps typed domain errors to the single error format in `contracts`.
- Zod-based route schemas use `fastify-type-provider-zod`, and OpenAPI is generated from them. If that plugin becomes unmaintained, the fallback is to convert Zod 4 schemas to JSON Schema ourselves with Zod's built-in conversion and use Fastify's native AJV path. Assumption: Zod 4 ships JSON Schema conversion; confirm in Part 2.4.
- WebSockets use `@fastify/websocket` in the same process for the MVP (S10). Separating the gateway is a scaling step (13.11), not a starting point.
- Stay on Fastify 5 until Fastify 6 is stable and its plugins have caught up.

## Alternatives
| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **Fastify 5** | Fast; first-class schema validation; plugin encapsulation maps well to domain modules; pino built in; small API surface | Less built-in structure, so discipline comes from our package boundaries and lint rules | **Chosen** |
| NestJS 12 | Strong conventions (modules, DI, guards), batteries included | Decorator/DI ceremony; heavier mental model for one person; domain purity still depends on discipline; class-validator conventions clash with Zod-first contracts | Rejected; allowed later only via a new ADR |
| Hono 4 | Tiny, web-standard Request/Response, runs anywhere | Edge-first ecosystem; fewer mature Node plugins for WebSockets and rate limiting; long-lived Node workloads are not its focus | Rejected |
| Express 5 | Ubiquitous | No schema-first validation, slower, weaker typing | Rejected |

## Trade-offs
- Less framework structure means we must enforce module boundaries ourselves. That is done with dependency-cruiser (ADR-0001), the `DOMAINS.md` catalogue (Part 1.5) and code review.
- A single API process holding WebSockets means a deploy disconnects sockets. The client must reconnect and resync anyway (Part 10.3), so this is acceptable.

## Consequences
- Part 2.5 creates the API shell: health/readiness endpoints, error format, request IDs, pino logging, OpenAPI generation.
- **Revisit when** a measured need appears for a separate realtime gateway (socket count or CPU), see the 13.11 triggers in `SYSTEM_ARCHITECTURE.md`.

## Verification
Part 2.5: an integration test (Fastify `inject`) proves that an invalid body returns the contracts error format, `/health` and `/ready` behave correctly, and the OpenAPI document is generated in CI.

## Update (Part 2.4, 2026-11-01)
The OpenAPI source moved from Fastify runtime schemas to the **route contracts in `@chronos/contracts`** (ADR-0013), so the API, client and spec share one definition. The API shell (2.5) registers its routes from those contracts. `fastify-type-provider-zod` remains an option for request validation inside that adapter.
