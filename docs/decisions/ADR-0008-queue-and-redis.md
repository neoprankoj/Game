# ADR-0008 — Background jobs: BullMQ 6 on Redis (Railway-hosted, persistent connections)

| Field | Value |
|---|---|
| Status | Proposed |
| Date | 2026-10-31 |
| Part | 1.1 |
| Owner approval needed | No deviation from `CLAUDE.md` §5. **Option flagged for the owner:** BullMQ 6 now ships a **PostgreSQL backend** that would remove Redis entirely. Not recommended for MVP start (see Alternatives), but noted because it changes the cost and complexity picture. |

## Context
- Timed activity is timestamp-driven. Jobs only **speed up** completion; they are **not required for correctness**, because a reconciler catches anything a job missed (rules 6–7; Parts 3.4, 3.5). A lost job therefore causes **latency**, never wrong state. That lowers the queue's criticality and helps us choose simplicity.
- Needs: delayed jobs ("complete construction at 14:00"), retries with backoff, idempotent handlers, repeatable jobs (reconciler sweep), visibility for monitoring (XV).
- Redis is **never authoritative** (rule 4). Later uses beyond the queue: rate-limit counters (11.2) and WebSocket fan-out if there is more than one API instance (13.11).

**Verified facts (npm registry, BullMQ docs, provider pages, 2026-10-31):**
- `bullmq` latest is **6.5.3** (2026-10-31). 6.0.0 was released 2026-07-30. 5.x is maintained on `release-v5.x` (5.81.5). Optional peers: `ioredis >=5`, `redis`, `pg >=8`.
- BullMQ docs (Connections): Redis or a compatible server (Valkey, Dragonfly). Requires **`maxmemory-policy=noeviction`**. Workers need ioredis `maxRetriesPerRequest: null`. Blocking classes open **extra, long-lived connections** (`duplicate()`). The ioredis `keyPrefix` option is not supported.
- BullMQ docs (PostgreSQL backend): needs PostgreSQL ≥ 13 (14+ recommended). The page says Redis "remains the default and the most battle-tested option". Throughput is "usually lower than Redis", roughly 1.5–2× fewer jobs/s. Claiming uses `FOR UPDATE SKIP LOCKED`, and waiting uses `LISTEN/NOTIFY`. It has existed only since 6.0 (about 3 months).
- Upstash Redis pricing: pay-as-you-go **$0.20 per 100K commands**; fixed plans from **$10/month (250 MB)** with no per-command billing. BullMQ workers issue blocking and polling commands continuously even when idle, so **per-command billing is a poor fit**.
- Railway runs Redis as a regular service (persistent TCP, private network) billed by resource usage (ADR-0009).

## Decision
- **BullMQ 6.x** with the **Redis backend**, using **ioredis** (exact version chosen in Part 2.6 from BullMQ's tested range).
- **Redis host: a Railway Redis service** in the same project and private network as the API and workers (ADR-0009). Configuration requirements, verified in Part 2.6/2.10 with `CONFIG GET`:
  - `maxmemory-policy noeviction`;
  - persistence (AOF or RDB) enabled. Not needed for correctness, but it avoids a burst of reconciler work after restarts;
  - private networking only; password required; no public endpoint.
- Locally and in CI: a `redis:8` (or `valkey`) container in Docker Compose.
- **Queue access sits behind a small `JobScheduler` port** owned by `game-temporal`/`apps/workers` (`schedule(actionId, runAt)`, `cancel(actionId)`). This keeps BullMQ out of domain code and makes switching to the Postgres backend a configuration change.
- Job IDs are **deterministic** (`timed-action:{id}`) for duplicate protection. Handlers re-read state from Postgres and settle idempotently (Part 3.4).

## Alternatives
| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **BullMQ 6 + Redis (Railway)** | Battle-tested; rich delayed/repeat/retry features; Redis is reused for rate limiting and pub/sub | One more service to run and pay for | **Chosen** |
| BullMQ 6 + **PostgreSQL backend** | No Redis at all; one database to back up; same BullMQ API | About 3 months old; lower throughput; queue load sits on the game's primary database; Redis may come back anyway for rate limits/pub-sub | **Deferred:** re-evaluate in Part 2.6 or 13.11; the `JobScheduler` port keeps the switch cheap |
| pg-boss 12 (Postgres-native queue) | Mature Postgres queue; transactional enqueue possible | Different API; fewer delayed-job ergonomics than BullMQ; Postgres load | Rejected for MVP (same reasoning as above) |
| Upstash Redis pay-as-you-go | Serverless pricing | Per-command billing plus BullMQ's constant polling and blocking means unpredictable cost | Rejected. Upstash **fixed** plans ($10+/mo) are an acceptable fallback host |
| Managed Redis elsewhere (Redis Cloud, Fly + Upstash) | Managed | Cross-provider latency; another vendor | Rejected for MVP |

## Trade-offs
- Redis adds about $1–5/month and one more service to monitor. In return we get the most proven BullMQ path and a ready home for rate limits and pub/sub.
- Self-hosted-on-platform Redis (Railway) is less "managed" than Redis Cloud. That is acceptable because Redis holds no authoritative data and the reconciler covers any loss.

## Consequences
- Part 2.6 creates `apps/workers` with BullMQ, health checks, graceful shutdown and the `JobScheduler` port.
- Part 3.4/3.5 implement deterministic job IDs and the reconciler. Tests kill a worker mid-job and prove the reconciler completes the action.
- Monitoring (12.4): queue depth, oldest-delayed-job lag, failed-job count.
- **Revisit when** Redis cost or operations become a real burden at playtest scale (switch to the Postgres backend), or when job throughput exceeds a single worker (scale workers first, 13.11).

## Verification
Part 2.6: an integration test enqueues a delayed job, kills the worker and restarts it, and observes exactly-once *effect* (idempotent handler). A startup check fails fast if `maxmemory-policy` is not `noeviction`.
