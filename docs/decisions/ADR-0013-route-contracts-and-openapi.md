# ADR-0013 — Route contracts in `@chronos/contracts` are the single source of the API surface; OpenAPI is generated from them

| Field | Value |
|---|---|
| Status | Accepted (Part 2.4, within the S01-approved architecture) |
| Date | 2026-11-01 |
| Part | 2.4 |
| Owner approval needed | No: refines ADR-0005's "OpenAPI from Fastify route schemas". Reported for visibility |

## Context
Part 2.4 requires one shared definition of the API, no duplicated request/response types anywhere, and a living OpenAPI spec regenerated in CI. ADR-0005 assumed the spec would be produced by Fastify at runtime (`fastify-type-provider-zod` + `@fastify/swagger`). That works, but:
- the routes would only exist inside `apps/api`;
- the client (2.7) would have to re-declare paths and methods, which is duplication;
- the spec would need a booted server to generate.

## Decision
- Every HTTP route is declared **once**, in `packages/contracts`, as a `RouteContract`. A contract holds:
  - `id`, method and path;
  - auth level, idempotency, params/query/body schemas;
  - success responses and the domain error codes it may return.

  `defineRoute()` checks invariants when the module loads: mutating ⇔ idempotent, path params = declared params, `domain.action` ids.
- **The API (2.5) registers handlers from these contracts.** The adapter may use `fastify-type-provider-zod` for validation. **The client (2.7) derives its typed calls from the same contracts.**
- **OpenAPI 3.1** is built by a small, tested builder (`buildOpenApiDocument`) from the contracts and Zod 4's `z.toJSONSchema`:
  - named schemas become `components/schemas`, converted in one registry pass so nested refs resolve;
  - codecs are described by their wire form (decimal strings for bigint, ISO UTC for instants);
  - every operation declares `security`;
  - error responses are grouped by status from the error catalog.

  It is written to `docs/architecture/api/openapi.json` by `pnpm api:spec`. A test fails when the committed file is stale, so CI enforces freshness through `pnpm test`.
- Wire codecs (`BigIntString`, `AmountString`, `InstantString`) are Zod 4 codecs: decode and encode share one definition.

## Alternatives
| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **Contracts as data + own builder** | single source for API, client and docs; no runtime needed; no extra dependency; fully tested | we maintain ~150 lines of builder | **Chosen** |
| Runtime generation via `@fastify/swagger` (ADR-0005's assumption) | standard Fastify path | routes live in the API only; the client duplicates paths; generation needs a booted server | Rejected as the source; may still serve a docs UI later |
| Contract libraries (ts-rest, oRPC, zod-openapi) | batteries included | another framework to learn and track; Zod 4 compatibility and maintenance to verify; less control over error and idempotency conventions | Rejected for now |

## Consequences
- Part 2.5's API shell must register routes **only** from `routes` in contracts, and must return errors in the `ErrorResponse` shape with codes from `ERROR_CODES`.
- Part 2.7's API client must be derived from the same contracts. That Part should add a check that no request/response type is declared outside `packages/contracts`.
- Every new route = a contract + regenerated spec (`pnpm api:spec`) in the same commit.

## Verification (Part 2.4)
- 41 contract tests, including:
  - freshness of the committed spec;
  - every `$ref` resolves inside the document;
  - codec round-trips beyond 2^53;
  - every error code named in DOMAINS.md exists in the catalog.
- The generated spec passes `@redocly/cli@2.72.1 lint --extends=recommended` ("valid"). The only note left is the missing `info.license` warning; choosing a license is the owner's call.
- The first builder version emitted `#/$defs/...` refs that do not resolve in OpenAPI. The strengthened test caught exactly those three refs, and the builder now converts all components in one registry pass.

## Update (Part 2.8, 2026-11-02): the authentication exception
- Better Auth serves its own endpoints under `/api/auth/*` (ADR-0007). They use the **library's** request and response format (`{ code, message }` errors) and are not route contracts:
  - they are not in the registry or in `openapi.json`;
  - the startup check covers contract routes only.
- Why: reimplementing sign-up, sign-in and reset as contract routes would duplicate security-critical library code and lose the official web/native clients.
- How the single error format is preserved for clients: `authErrorCode()` in `@chronos/contracts` maps every library code to our catalog (tested). Screens only ever see catalog codes.
- The OpenAPI document describes the session as a cookie security scheme (`chronos.session_token`) and points to `/api/auth` for obtaining it.
- Contract routes now enforce their `auth` field: `session` and `admin` routes authenticate before validation. An app built without authentication refuses to start if any route needs it.
