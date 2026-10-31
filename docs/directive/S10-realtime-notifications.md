# S10 — Realtime & Notifications

**Goal of this section:** players learn about important events immediately — in the app via WebSockets and outside the app via push notifications — without the client ever deciding what is true.

**Principle:** delivery is not mutation. State changes happen in transactions; messages only tell clients that something changed. A client that misses messages recovers by re-fetching.

---

### Part 10.1 — Domain events & outbox
**Goal:** reliable event publishing from committed transactions.
**Depends on:** 3.3.
**Build:** `outbox_events` table (id, type, recipients, payload, created_at, published_at); written in the same transaction as the state change; a publisher worker forwards unpublished events to Redis pub/sub / queues and marks them published; per-player monotonically increasing `seq`. Event catalog in `contracts` (construction.completed, research.completed, movement.incoming, movement.arrived, battle.resolved, outpost.respawned, …). Distinguish persistent domain events, ephemeral notifications and sync messages.
**Done when:** no event is ever published for a rolled-back transaction; no committed event is lost if the publisher crashes.
**Tests:** rollback → no event; publisher crash → event published after restart; ordering per player.

### Part 10.2 — WebSocket gateway
**Goal:** live updates to connected clients.
**Depends on:** 10.1, 2.8.
**Build:** authenticated WebSocket endpoint in `apps/api`; per-player channel subscription; heartbeat/ping; message envelope with `seq`; works across multiple API instances (Redis pub/sub fan-out); connection limits per account.
**Done when:** two browser tabs for the same player both receive events; unauthenticated connections are rejected.
**Tests:** auth; fan-out across two API instances; malformed client messages ignored safely.

### Part 10.3 — Client sync & reconnect
**Goal:** the client is always eventually correct.
**Depends on:** 10.2, 5.4.
**Build:** client tracks last `seq`; on gap or reconnect → re-fetch affected state from REST (and optionally a `GET /events?after=seq` catch-up endpoint); events invalidate cached queries rather than patching state manually; reconnect with backoff; app foreground/background handling on mobile.
**Done when:** with the network cut during a construction completion, the client shows the correct state after reconnecting.
**Tests:** gap detection; reconnect recovery (Playwright with network throttling).

### Part 10.4 — Push notifications
**Goal:** reach players when the app is closed.
**Depends on:** 10.1, 2.8.
**Build:** device token registration (`expo-notifications`), token cleanup on invalid responses, per-player notification preferences (categories: attacks, construction/research done, battle reports, outpost events), quiet hours per player time zone, rate limiting/grouping to avoid spam, web push if supported by the chosen approach (otherwise in-app + email fallback for web — document in ADR). Incoming attack notifications are high priority.
**Done when:** a test device receives an incoming-attack push while the app is closed; disabled categories are not sent.
**Tests:** preference filtering; quiet hours; token invalidation; grouping.

### Part 10.5 — In-game notification inbox
**Goal:** a history of what happened while away.
**Depends on:** 10.1, 5.3.
**Build:** notifications table/read model; inbox screen with unread counts; "while you were away" summary on login (resources gained, buildings completed, battles fought, incoming threats).
**Done when:** after a day offline, the summary accurately lists what happened.
**Tests:** summary generation from events; read/unread state.
