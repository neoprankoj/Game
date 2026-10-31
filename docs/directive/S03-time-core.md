# S03 — Time & Simulation Core

**Goal of this section:** the engine that makes the universe progress while players are offline — correctly, idempotently and recoverably. Every timed system (construction, research, recruitment, movement, battles) is built on this.

**Core idea:** the database stores *when* things start and complete. State is brought up to date ("settled") whenever it is read or changed. Background jobs only make completion arrive sooner; a reconciler guarantees nothing is missed.

---

### Part 3.1 — Clock & time utilities
**Goal:** one authoritative, testable notion of "now".
**Depends on:** 2.1.
**Build:** in `packages/game-temporal`: `Clock` interface (`now(): Instant`), system clock (apps only), fake clock (tests, can advance), duration helpers in integer milliseconds, UTC-only types. Server time endpoint `GET /time` so clients can compute a display offset (display only — never used for authority).
**Done when:** no domain code calls `Date.now()` (enforced by lint rule); clients show countdowns derived from server timestamps.
**Tests:** fake clock advance; duration arithmetic; no floating-point in durations.

### Part 3.2 — Timed action model
**Goal:** a single generic representation of "something that finishes at a time".
**Depends on:** 3.1, 2.3.
**Build:**
- Table `timed_actions`: `id`, `kind` (construction, research, recruitment, movement, battle…), `owner_city_id`/`owner_player_id`, `starts_at`, `completes_at`, `status` (`scheduled` | `completed` | `cancelled`), `payload` (validated JSON per kind), `ruleset_version`, `created_at`, `completed_at`, `version` (optimistic lock).
- Index on `(status, completes_at)` and on owner.
- Pure state-machine functions in `game-temporal`: allowed transitions, deterministic ordering of due actions (`completes_at`, then `id`).
- A handler registry: each `kind` registers an `onComplete` function that runs inside the settling transaction.
**Done when:** illegal transitions are rejected; ordering is deterministic for equal timestamps.
**Tests:** state machine transitions; ordering with ties; payload validation per kind.

### Part 3.3 — Settlement ("bring state up to now")
**Goal:** any read or write of a city/player first applies everything that is due, in order.
**Depends on:** 3.2.
**Build:** `settle(ownerId, until = now)`:
1. Lock the owner's rows (lock order from `DATABASE_DESIGN.md`).
2. Load due `scheduled` actions with `completes_at <= until`, ordered.
3. For each: settle economy up to its `completes_at` (hook for S04), run its `onComplete`, mark `completed`.
4. Settle economy up to `until`.
5. Emit domain events to the outbox (S10 uses them).
All in one transaction. Called by every API read/write touching that owner.
**Done when:** a player who was offline for days returns to correct state from a single request.
**Tests:** an action due while offline completes on next read; multiple due actions apply in correct order; settlement twice in a row changes nothing the second time.

### Part 3.4 — Scheduled completion jobs
**Goal:** completions happen close to on-time even if nobody reads the state (needed for notifications and for actions that affect other players).
**Depends on:** 3.3, 2.6.
**Build:** when a timed action is created, enqueue a delayed BullMQ job **after the transaction commits** (via outbox, not inline). The job calls `settle(owner, completes_at)`. Job ID = action ID (deduplication).
**Done when:** completions happen within a few seconds of `completes_at` with workers running.
**Tests:** job runs settlement; a duplicate job is a no-op; a job for a cancelled action is a no-op.

### Part 3.5 — Reconciler (crash recovery)
**Goal:** correctness never depends on a job having run.
**Depends on:** 3.4.
**Build:** periodic worker job (e.g. every 30–60 s) that finds `scheduled` actions with `completes_at < now − grace` and settles their owners in small batches (`FOR UPDATE SKIP LOCKED`). Metrics: number of overdue actions found, max lateness.
**Done when:** with all delayed jobs deleted from Redis, every overdue action is still completed by the reconciler.
**Tests:** simulate worker crash mid-processing; simulate Redis flush; overdue actions recover; two reconciler instances never double-apply.

### Part 3.6 — Concurrency & idempotency
**Goal:** simultaneous requests and retries can never corrupt state.
**Depends on:** 3.3.
**Build:**
- `idempotency_keys` table: key, account, request hash, response snapshot, expiry. Middleware: same key + same request → stored response; same key + different request → error.
- All mutating game endpoints require `Idempotency-Key`.
- Standard pattern: lock → settle → validate → mutate → outbox → commit.
- Deadlock/serialization retry via the 2.3 helper.
**Done when:** concurrency tests pass reliably (run them repeatedly in CI).
**Tests:** two simultaneous spend requests that together exceed the balance — exactly one succeeds; the same request submitted twice — applied once, same response; a failing transaction leaves no partial state.
