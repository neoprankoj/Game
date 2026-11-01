# infrastructure/

**Local development only.** Production and staging use managed hosting: Railway + Neon (ADR-0009, Part 2.10).

| Path | Purpose |
|---|---|
| `docker-compose.yml` | PostgreSQL 18.6 and Redis 8.10.3 for local development and integration tests |
| `postgres/init/01-create-test-database.sh` | creates the test database (`POSTGRES_TEST_DB`) the first time the data volume is created |
| `scripts/dev.mjs` | `pnpm dev:up / dev:down / dev:reset / dev:status`: preflight checks, start/stop, configuration verification |

## Why these settings
- **UTC everywhere** (`timezone=UTC`, `TZ`, `PGTZ`): all game time is server-side UTC (rule 5).
- **Slow-query log ≥ 250 ms**: missing indexes show up in `docker compose logs postgres` during development.
- **Redis `noeviction`**: required by BullMQ, otherwise queued jobs can silently disappear (ADR-0008).
- **Redis AOF persistence**: not needed for correctness (the reconciler recovers), but it avoids a burst of catch-up work after restarts.
- **Redis password, loopback-only ports**: parity with production and no accidental exposure on shared networks.
- **Pinned image versions**: upgrades are deliberate changes, tested like code.

## Data
Named volumes `chronos_postgres-data` and `chronos_redis-data` keep data across `dev:down`/`dev:up`. `dev:reset` removes both. The init script runs only on a fresh volume, so after changing `POSTGRES_TEST_DB` run `pnpm dev:reset`.

The Compose project name is fixed (`chronos`), so one machine runs one local stack, shared by all checkouts.
