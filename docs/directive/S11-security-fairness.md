# S11 — Security, Fairness & Integrity

**Goal of this section:** harden the game as a competitive online service. Many protections already exist from earlier Parts (idempotency, transactions, server authority); this section closes gaps and adds fairness systems.

---

### Part 11.1 — Authorization audit
**Goal:** no player can read or change anything they don't own.
**Depends on:** all gameplay Parts so far.
**Build:** review every endpoint and WebSocket message for ownership checks; centralize checks in module guards; list endpoints and their access rules in `docs/architecture/SECURITY.md`.
**Done when:** every endpoint has an access rule and a test.
**Tests:** for each mutating endpoint: another player's resource ID → 403/404; anonymous → 401.

### Part 11.2 — Rate limiting & abuse controls
**Goal:** prevent scripted spam and resource exhaustion.
**Depends on:** 2.5.
**Build:** per-account and per-IP limits per endpoint category (auth, actions, map queries); brute-force protection on sign-in; request size limits; WebSocket message limits.
**Done when:** limits are documented and return contract-shaped errors.
**Tests:** limit exceeded → correct error; normal play never hits limits (run E2E suite under limits).

### Part 11.3 — Audit log
**Goal:** a trail for investigations and support.
**Depends on:** 2.3.
**Build:** append-only `audit_log` for sensitive actions: sign-in, password changes, account deletion, admin actions, large resource movements, battle results. No secrets or passwords ever logged.
**Done when:** an admin can reconstruct what happened to an account over a time range.
**Tests:** audit entries written for each listed action; sensitive fields redacted.

### Part 11.4 — Fairness rules
**Goal:** keep the shared universe fun for everyone.
**Depends on:** 7.4, 9.3.
**Build:** finalize new-player protection; inactive-player handling per spec (e.g. after N days inactive: reduced production, become attackable outpost-like target or moved to a "dormant" state — never silent deletion of paying users' data); attack limits against much weaker players if specified (e.g. reduced loot or no attack under a power ratio).
**Done when:** rules are visible to players (help text) and enforced server-side.
**Tests:** each rule's boundary conditions.

### Part 11.5 — Multi-account & bot signals
**Goal:** detect the most common competitive abuse early.
**Depends on:** 11.3.
**Build:** collect lightweight signals (shared device/IP patterns, resource flows between accounts, inhuman action timing); admin report listing suspicious clusters. Detection only — enforcement is manual in MVP. Respect privacy: document what is collected in the privacy policy.
**Done when:** a staged test with two linked accounts appears in the report.

### Part 11.6 — Admin tools
**Goal:** the owner can support players and fix problems safely.
**Depends on:** 11.3.
**Build:** admin role; minimal admin screens or CLI: find player, view state, view ledger and battles, grant/remove resources (with reason), suspend/ban, replay battle. Every admin action audited.
**Done when:** each admin action is available, authorized to admins only, and audited.
**Tests:** non-admin denied; audit entry created per action.
