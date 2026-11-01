# ADR-0009 — Hosting: Railway (API, workers, Redis, web client) + Neon (PostgreSQL), same region

| Field | Value |
|---|---|
| Status | Accepted at the S01 gate, 2026-11-01 |
| Date | 2026-10-31 |
| Part | 1.1 |
| Owner approval needed | **Yes.** (1) Deliberately **two providers** instead of `CLAUDE.md` §5's "one platform" wording. §5's own example ("Fly + Neon") already pairs two, but this is flagged anyway. (2) **Region**: where are the playtesters? (EU or North America). (3) The **monthly budget** below. |

## Context
- Solo developer: managed services, no self-run infrastructure; Docker Compose for local development only (§5, COVERAGE "Deliberate changes").
- Needs: Postgres (source of truth, so **backups and point-in-time recovery** matter: no wipes, rule 4, Part 12.5), Redis with persistent connections (ADR-0008), a long-running API process with WebSockets, long-running workers, static hosting for the Expo web export, preview/staging environments.
- Row-locking transactions (ADR-0006) make **API↔DB latency** critical. Every round trip inside a transaction extends lock-hold time.

**Verified prices (provider pricing pages, fetched 2026-10-31; USD):**

| Provider | Item | Price |
|---|---|---|
| Railway | Hobby plan | $5/mo, includes $5 usage |
| Railway | Pro plan | $20/mo per workspace, includes $20 usage |
| Railway | vCPU / memory / volume / egress | ~$20 per vCPU-month · ~$10 per GB-month RAM · ~$0.15 per GB-month volume · $0.05/GB egress |
| Railway | Volume backups | daily / weekly / monthly schedules; retention 6 / 27 / 89 days; **no PITR documented** |
| Neon | Free | 100 CU-hours and 1 GB per project; scale-to-zero after 5 min (cannot be disabled); restore window 6 h |
| Neon | Launch | $0.106 per CU-hour, $0.35 per GB-month storage, $0.20 per GB-month history; **restore window up to 7 days**; no monthly minimum; up to 16 CU |
| Fly.io | Machines | shared-cpu-1x 256 MB $2.19/mo · 512 MB $3.69 · 1 GB $6.70; volumes $0.15/GB-mo; egress (NA/EU) $0.02/GB; **no free tier for new orgs**; Managed Postgres from $38/mo |
| Upstash | Redis fixed plan | from $10/mo (250 MB); pay-as-you-go $0.20 per 100K commands (unsuitable for BullMQ, see ADR-0008) |
| Sentry | Developer / Team | Free (5k errors, 1 user) / $29 per month ($26 annual) |
| Expo EAS | Free / Starter | $0 (15 Android + 15 iOS builds/mo) / $19/mo. Not needed until store builds (13.10). Expo push service: free per Expo's FAQ as quoted by third parties; **official quota not verified**. |

Render was also considered, but its pricing page could not be read in this session, so it has **no verified numbers** here.

## Decision
- **Railway** runs: `api` (Fastify + WebSockets), `workers` (BullMQ + reconciler), `redis`, and the static **web client**. Environments: `staging` (later, PR previews) and `production`. One Railway project per environment group, with private networking between services.
- **Neon** runs PostgreSQL 18:
  - production on the **Launch** plan (7-day point-in-time restore, autoscaling, branching);
  - staging on **Neon Free** or a Neon branch of a sanitised dataset.
  - **Neon branches** are used to rehearse every risky migration against a copy of production data before applying it (supports rule 15 and Part 12.5).
- **Same cloud region** for Railway and Neon, chosen with the owner (e.g. Railway US-East ↔ Neon AWS `us-east-1`, or the closest EU pair). **Gate in Part 2.10:** measure API→DB round-trip latency. If p50 > 3 ms, re-evaluate (all-Railway Postgres, or another region pair) before S03 builds on it.
- Docker Compose (`postgres:18`, `redis:8`) for local development and CI only (Part 2.2).

## Cost estimates (monthly, USD)
Assumptions are stated so the owner can challenge them. Railway bills **actual** usage, not allocations.

**(a) Development (local development + one always-on staging)**

| Item | Assumption | Cost |
|---|---|---|
| Local dev, CI | Docker on the developer's machine; GitHub Actions free minutes for a private repo | $0 |
| Railway Hobby (staging) | api ≈0.02 vCPU/0.2 GB, workers ≈0.01 vCPU/0.15 GB, redis ≈0.05 GB + 1 GB volume, static web ≈0.05 GB → ≈$6 of usage, $5 of it included | **≈ $5–10** |
| Neon Free (staging) | Reconciler sweep set to ≥15 min in staging so compute can sleep (assumption: about 60 CU-h/month < 100 free) | $0 (else ≈ $19 on Launch at 0.25 CU always-on) |
| Sentry Developer | 1 user, 5k errors | $0 |
| Domain | Amortised | ≈ $1–2 |
| **Total (a)** | | **≈ $6–12 / month** (≈ $25–30 if staging DB must stay awake on Neon Launch) |

**(b) 500-player closed web playtest**
Assumptions: 500 accounts, ~150–250 daily actives, peak ~60–100 concurrent WebSockets, peak a few requests/s. The reconciler keeps the DB awake 24/7.

| Item | Assumption | Cost |
|---|---|---|
| Railway Pro | api ≈0.15 vCPU / 0.5 GB (≈$8), workers ≈0.1 vCPU / 0.4 GB (≈$6), redis ≈$2, static web ≈$1, egress ≈25–50 GB (≈$1–3) → ≈$18–30 usage; $20 included | **≈ $20–35** |
| Neon Launch | 0.25–0.5 CU average (autoscale up to 2 CU at peaks) ≈ $19–39; storage 2–5 GB ≈ $1–2; PITR history ≈ $1 | **≈ $21–42** |
| Sentry | Developer (free) to start; Team if more than 5k errors or more than 1 user is needed | $0–29 |
| Transactional email | Free tier of the provider chosen in 2.8 (assumption, not verified) | $0–20 |
| Domain | | ≈ $1–2 |
| Expo | Web-only playtest: no builds needed | $0 |
| **Total (b)** | | **≈ $42–80 / month typical, up to ≈ $130 worst case** with every optional upgrade |

Comparison for the same playtest (rough, same assumptions):
- **All-Railway** (Postgres as a Railway service, 1 GB RAM + 5 GB volume ≈ $13): ≈ $35–60/month, but only daily volume backups (6-day retention, no PITR), and we run Postgres upgrades ourselves.
- **Fly.io + Neon**: 2× api 512 MB + 1× worker 512 MB + Redis machine ≈ $13–15, plus Neon ≈ $21–42 → ≈ $35–60/month, but there is no free tier for staging, and more operations work (machines, `fly.toml`, volume management).

## Alternatives
| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **Railway + Neon** | Simple deploys from GitHub; private network for api/workers/redis; Neon gives PITR, branching for migration rehearsal, autoscaling | Two vendors; cross-provider latency must be measured | **Chosen** |
| All on Railway | One vendor, lowest latency (same private network), lowest cost | No documented PITR; DB backups and upgrades are our job | **Fallback** if the latency gate fails |
| Fly.io + Neon | Fine-grained machines, cheap egress, many regions | No free tier; more ops surface; Fly's managed Postgres starts at $38 | Rejected |
| AWS/GCP directly | Maximum control | Far too much ops for one person | Rejected |
| Supabase (Postgres + auth + realtime) | Batteries included | Pulls toward their auth/realtime (we chose our own, ADR-0007); still need a host for API/workers | Rejected |

## Trade-offs
- We pay about $20–40/month extra for PITR and branching compared with all-Railway. For a persistent universe that never wipes, a 7-day restore window is worth it.
- Two dashboards and two bills, in exchange for a properly managed database.

## Consequences
- Part 2.10 deploys staging, measures API↔DB latency, and records the region and latency results here.
- Part 12.5 rehearses a Neon PITR restore and a Railway service rollback.
- Secrets live in Railway/Neon environment settings; `.env.example` holds placeholders only (rule 16).
- **Revisit when** the latency gate fails, the monthly bill exceeds the owner's budget, or the player count grows enough for the 13.11 scaling triggers.

## Verification
Part 2.10: staging deploy from CI; `/ready` checks DB and Redis; latency measurement recorded; restore drill scheduled for 12.5.
