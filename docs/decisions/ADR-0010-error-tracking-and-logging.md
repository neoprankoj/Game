# ADR-0010 — Error tracking and logging: Sentry + structured logs with pino

| Field | Value |
|---|---|
| Status | Accepted at the S01 gate, 2026-11-01 |
| Date | 2026-10-31 |
| Part | 1.1 |
| Owner approval needed | No deviation from `CLAUDE.md` §5. |

## Context
- Source plan XV requires structured logs, error tracking, performance/latency metrics and job monitoring, and says to **never expose sensitive information in logs**.
- Errors must be visible from all three clients (web, iOS, Android) and from the API and workers, ideally in one place for a solo developer.

**Verified facts (npm registry, Sentry pricing, 2026-10-31):**
- `@sentry/node` latest is 11.10.0. `@sentry/react-native` latest is 8.33.0. Both were published in late October 2026.
- `pino` latest is 10.4.0. Fastify 5.12 depends on `pino ^9.14 || ^10.1`.
- Sentry pricing: **Developer** free (5k errors, 1 user, 50 replays, 5M spans); **Team** $29/month ($26 annual), 50k errors.

## Decision
- **Sentry** for errors (and light tracing) in `apps/api`, `apps/workers` and `apps/client` (`@sentry/react-native`, which also covers the Expo web build). Releases are tagged with the git SHA, and source maps are uploaded in CI.
- **pino** structured JSON logs in API and workers (Fastify's built-in logger). Every log line carries `requestId` / `jobId`, and when known `playerId` (an internal id, never an email). In the MVP, logs go to Railway's log stream. A log drain to a dedicated service is decided in Part 12.4 if needed.
- **Redaction is mandatory:** pino `redact` paths for `authorization`, `cookie`, `set-cookie`, `password`, `token`, `email`. Sentry `beforeSend` strips the same fields, and `sendDefaultPii: false`. A test in Part 2.5 asserts redaction.
- Game-specific metrics (economy anomalies, combat simulation stats, queue lag) are designed in Part 12.4. Sentry is not the metrics store.

## Alternatives
| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **Sentry** | Best-in-class RN/Expo + Node SDKs; free tier fits development; source maps; release health | Paid tier needed beyond 5k errors or 1 user | **Chosen** |
| GlitchTip (Sentry-compatible, self-hostable) | Cheap, same SDKs | We would run it ourselves (or pay their hosted tier); fewer features | Fallback if Sentry costs become a problem |
| PostHog (error tracking + product analytics) | One tool for analytics and errors | Error tracking less mature than Sentry for React Native (assumption, not verified this session) | Re-evaluate in 12.4 for player analytics only |
| Logs-only (Better Stack, Grafana Cloud) | Good log search | No client crash reporting | Complement for logs in 12.4 if needed, not a replacement |

## Trade-offs
- Sentry's free tier is single-user. That is fine for a solo developer, and the upgrade is a known $26–29/month.
- Logging to the platform stream keeps costs at zero but limits retention and search. Revisit in 12.4.

## Consequences
- Part 2.5 (API) and 2.6 (workers) wire pino and Sentry with redaction tests. Part 2.7 wires the client SDK.
- **Revisit when** monthly errors exceed the free quota for two consecutive months, or the team grows.

## Verification
Part 2.5: a test logs a request with an `authorization` header and asserts it is redacted. A deliberate test error appears in Sentry staging (manual check, recorded in the report).

## Update (Part 2.5, 2026-11-01)
- **pino is wired in the API**, with redaction (authorization, cookie, `Idempotency-Key`, set-cookie, `*.password|token|email|secret`). Query strings and client IPs are never logged; the request id is on every line. Covered by `apps/api/test/platform.test.ts`.
- **Sentry is not wired in 2.5.** The directive places "Sentry on client/API/workers" in Part 12.4, and it needs the owner's Sentry project (DSN). The "Consequences" line above saying 2.5 wires Sentry is superseded: Sentry arrives in 12.4.
