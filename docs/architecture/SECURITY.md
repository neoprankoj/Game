# SECURITY — Chronos Cradle: Temporal Empires

| Field | Value |
|---|---|
| Status | **Started in Part 2.8** (authentication). Completed by Part 11.1 (authorization audit of every endpoint); hardened by 11.2–11.6 |
| Last updated | 2026-11-02 |
| Related | `SYSTEM_ARCHITECTURE.md` §10 (security architecture), `RISKS.md` §5 (R-26…R-33), ADR-0007 (Better Auth), ADR-0013 (route contracts), `DOMAINS.md` D01 |

This document holds **what is true in the code now**: the threat model, the trust boundaries, how authentication works, and one row per endpoint with its access rule and the test that proves it. Every Part that adds an endpoint adds its row here (Part 11.1 audits that nothing is missing).

---

## 1. Assets and attackers

| Asset | Why it matters |
|---|---|
| Accounts (email, password hash, sessions) | takeover = loss of a player's empire; email addresses are personal data |
| Game state (resources, armies, cities) | the fairness of the shared universe; from S03 on |
| Admin capabilities (11.6) | can change anyone's state |
| Infrastructure secrets (`BETTER_AUTH_SECRET`, DB/Redis URLs) | forging sessions, direct data access |

| Attacker | Capabilities assumed |
|---|---|
| Anonymous internet client | any HTTP request, scripted, from many IPs |
| Malicious player | a valid session; modified client; replays and races requests |
| Malicious website | runs JavaScript in a victim's browser (CSRF, open-redirect abuse) |
| Someone with brief access to an unlocked device | can use an existing session |

Out of scope for the MVP: a compromised hosting provider, nation-state attackers, DDoS beyond the platform's own protection.

---

## 2. Threat model (Part 2.8 scope: authentication)

| ID | Threat | Mitigation (in code) | Proven by |
|---|---|---|---|
| T-1 | **Credential stuffing / password guessing** | per-IP limits: sign-in 5/min, sign-up 3/min, reset request 3/5 min, reset 5/5 min, verification resend 3/5 min, deletion 5/min (`AUTH_RATE_LIMITS`); password ≥ 10 characters; scrypt hashing by the library. Account lockout and breached-password checks: 11.2 | `auth.test.ts` "limits sign-in attempts per client IP" |
| T-2 | **Rate-limit bypass by spoofing the IP** | Better Auth reads the client IP only from `x-chronos-client-ip`, which our adapter **overwrites** with Fastify's `request.ip` (proxy headers honoured only with `TRUST_PROXY=true`) | same test sends a different spoofed IP per request and is still limited |
| T-3 | **Account enumeration** | sign-in: one error for wrong password and unknown email; sign-up: with required email verification a duplicate email gets the same answer as a new one (+ a notice email to the owner); reset request: same answer for unknown emails, nothing sent | `auth.test.ts` "indistinguishable", "duplicate email", "unknown email … sends nothing"; e2e "same message" |
| T-4 | **CSRF** (a foreign site acting with the victim's cookie) | session cookie `SameSite=Lax`, `HttpOnly`; Better Auth origin check on every cookie-bearing state change (trusted origins = `CORS_ORIGINS` + `chronoscradle://`); CORS allow-list with credentials, so foreign origins fail the preflight; game routes accept only `application/json` | `auth.test.ts` "untrusted browser origin (CSRF)" |
| T-5 | **Open redirect leaking tokens** (reset/verification link sending its token to an attacker's site) | `callbackURL` / `redirectTo` must be a trusted origin, checked when the link is requested | `auth.test.ts` "reset redirect to an untrusted site", "send-verification-email … untrusted" |
| T-6 | **Security checks silently off in tests** | Better Auth disables its origin/CSRF checks when `NODE_ENV=test` unless configured; we set `disableOriginCheck: false`, `disableCSRFCheck: false` explicitly, so tests exercise production behaviour | removing them makes the CSRF and redirect tests fail (mutation-checked in 2.8) |
| T-7 | **Session theft / reuse** | database sessions (30 days, sliding), revocable by deleting the row; no cookie cache, so revocation and expiry apply on the next request; `Secure` + `__Secure-` cookies on https; native: cookie stored in SecureStore (keychain/keystore), never in plain storage | `auth.test.ts` "expired session", "revoked session", "cookies over https"; `native-client.test.ts` |
| T-8 | **Privilege escalation to admin** | `role` is `input: false` (sign-up and profile updates cannot set it), DB CHECK `role ∈ {player, admin}`; admin routes check the role server-side. Granting admin: admin CLI with audit row (11.6) | `auth.test.ts` "cannot make themselves admin", "admin routes refuse players"; `auth-schema.test.ts` |
| T-9 | **Account deletion by someone holding an unlocked device** | deletion always requires the password (our `before` hook), even on a fresh session | `auth.test.ts` "needs the password" |
| T-10 | **Password reset abuse** | single-use token, 1 h validity; using it **signs out every device** | `auth.test.ts` "password reset"; e2e "forgot password" |
| T-11 | **Leaking secrets or personal data in logs** | pino redaction (2.5); request bodies are never logged; Better Auth's own logger is forwarded at `warn` and above only (its `info` lines contain email addresses) | logging tests (2.5) |
| T-12 | **Weak or example secrets in production** | production refuses: the example `BETTER_AUTH_SECRET`, a non-https `BETTER_AUTH_URL`, `AUTH_RATE_LIMIT=false`, and the dev mailbox transport | `config.test.ts` "refuses unsafe auth and mail settings in production" |
| T-13 | **Unprotected route by mistake** | every route contract declares `auth`; protected routes authenticate **before** validation; an app built without authentication refuses to start if any route needs it | `auth.test.ts` "every non-public route … 401"; `registration.test.ts` |
| T-14 | **Supply chain (auth library)** | Better Auth pinned exactly in the pnpm catalog, upgraded deliberately; install scripts blocked by default (R-31); telemetry disabled explicitly | review at each upgrade (RISKS R-12) |

Threats for game state (IDOR, replay, races, bots, multi-accounting) are listed in `RISKS.md` §5 and are covered by 3.6 (idempotency), 11.1–11.5.

---

## 3. Trust boundaries and request path

```
client ──► CORS (allow-list) ──► rate limit (global per IP; auth endpoints stricter) ──► Better Auth (/api/auth/*)
                                                                                    └─► contract route:
                                                                                         authenticate (session) ─► role check
                                                                                         ─► Zod decode ─► Idempotency-Key ─► handler
```

- **The session is the only identity.** Handlers receive `account` from the server's session lookup; no route accepts an account id from the client to decide *who* is acting.
- **Order matters:** authentication runs before validation, so anonymous callers learn nothing about a route's input rules.
- `/api/auth/*` endpoints speak Better Auth's own request/response format (ADR-0013 exception). Every other route is a contract route with our `ErrorResponse`.

---

## 4. Authentication design (ADR-0007, implemented in 2.8)

| Aspect | Decision |
|---|---|
| Library | Better Auth 1.7.15 (exact pin), Drizzle adapter, tables in schema `auth` |
| Sign-in method | email + password only (owner decision O-6) |
| Email | **verification required** before sign-in; links valid 24 h (verification) / 1 h (reset). Delivery: `Mailer` port; local dev mailbox file now, a real provider in 2.10 (production refuses to start without one) |
| Sessions | database rows, 30 days sliding (refreshed daily), revocable; cookie `chronos.session_token` (`__Secure-` prefix on https) |
| Web | httpOnly cookie, `SameSite=Lax`; app and API must be **same-site** (`app.` / `api.` under one domain in production; `localhost` ↔ `localhost` in development) |
| Native | Better Auth Expo plugin: cookie kept in SecureStore, sent as a `Cookie` header with the app scheme in `expo-origin`; the typed API client adds the same cookie |
| Roles | `player` (default) and `admin`, a column on `auth.user`; no Better Auth admin plugin (its endpoints, including impersonation, would bypass our audit log) |
| Deletion | password required; deletion hooks run first (player anonymisation from 3.3/6.1, DATABASE_DESIGN deletion order), then the auth user and its sessions are removed |

---

## 5. Endpoint access table

Access: **public** (no session), **session** (any signed-in account), **admin** (role `admin`). "Library" = served by Better Auth under `/api/auth`.

| Endpoint | Access | Rule | Test |
|---|---|---|---|
| `GET /health` | public | liveness only, no data | `health.test.ts` |
| `GET /ready` | public | dependency up/down only, no details | `ready.test.ts` |
| `GET /account` | session | returns only the caller's own account | `auth.test.ts` (401 anonymous/forged, 200 own) |
| `POST /api/auth/sign-up/email` | public (library) | rate-limited; enumeration-safe; needs email verification | `auth.test.ts` sign-up tests |
| `GET /api/auth/verify-email` | public (library) | token from email; redirect only to trusted origins | `auth.test.ts` |
| `POST /api/auth/send-verification-email` | public (library) | rate-limited; trusted `callbackURL` only | `auth.test.ts` |
| `POST /api/auth/sign-in/email` | public (library) | rate-limited; one error for unknown email / wrong password | `auth.test.ts` |
| `POST /api/auth/sign-out` | session (library) | origin check | `auth.test.ts` |
| `GET /api/auth/get-session` | session (library) | own session only | `native-client.test.ts`, e2e |
| `POST /api/auth/request-password-reset` | public (library) | rate-limited; same answer for unknown email; trusted `redirectTo` only | `auth.test.ts` |
| `GET /api/auth/reset-password/:token` | public (library) | redirects the token only to the trusted `callbackURL` | `auth.test.ts` |
| `POST /api/auth/reset-password` | public (library) | single-use token; revokes all sessions | `auth.test.ts` |
| `POST /api/auth/delete-user` | session (library) | password required; deletion hooks first | `auth.test.ts` |
| `POST /api/auth/update-user` | session (library) | cannot set `role` | `auth.test.ts` |
| other `/api/auth/*` library endpoints (change password/email, list/revoke own sessions) | session (library) | own account only; not used by the client yet | reviewed in 11.1 |

**Rule for new Parts:** a new contract route declares `auth`; if it is not `none`, it gets a row here and an anonymous → 401 test (the generic test in `auth.test.ts` covers every registry route automatically). Ownership rules ("another player's id → 403/404") are added per route from S06 on and audited in 11.1.

---

## 6. Open items

| Item | Part |
|---|---|
| Real email provider (and its sending domain: SPF/DKIM) | 2.10 |
| Account lockout / progressive delays, breached-password check, Redis-backed limits for several API instances | 11.2 |
| Ownership (IDOR) matrix tests for every gameplay route | 11.1 |
| Audit log for admin actions; admin role CLI; admin 2FA (O-10); suspension/ban fields | 11.3, 11.6 |
| `account.created` / `account.deleted` events (needs the outbox) | 3.4 |
| Data export, deletion of game data (anonymisation) | 6.1, 12.6 |
