# S12 — Onboarding, Polish & MVP Launch

**Goal of this section:** turn a working game into one strangers can learn, enjoy and trust — then run a closed web playtest.
**Gate:** closed playtest results reviewed by the owner before any S13 work.

---

### Part 12.1 — Onboarding & tutorial
**Goal:** a new player understands the core loop within 10 minutes.
**Depends on:** S06–S09.
**Build:** guided first session (found city → upgrade a producer → start research → recruit → attack a nearby outpost → read the report), short objective list with small rewards (from game-data), contextual tips, skippable. Track funnel step completion (privacy-friendly analytics).
**Done when:** a tester with no prior explanation completes the tutorial; funnel events are recorded.
**Tests:** E2E of the full tutorial path; rewards granted exactly once.

### Part 12.2 — Localization readiness
**Goal:** adding languages later is cheap.
**Depends on:** 5.2.
**Build:** all UI strings in i18n files (English first); number/date/duration formatting by locale; layouts tested in RTL mode (Hebrew/Arabic readiness); no text baked into images.
**Done when:** switching to a pseudo-locale and RTL shows no hard-coded strings or broken layouts on core screens.

### Part 12.3 — Visual & UX polish pass
**Goal:** the premium grand-strategy feel from the vision.
**Depends on:** 5.1–5.3 and all screens.
**Build:** consistent use of design system across every screen; meaningful motion (completions, incoming threats); art direction for islands/buildings (placeholders replaced with a consistent style — source, license and cost documented); accessibility review (contrast, labels, touch targets, reduced motion).
**Done when:** owner signs off on a screenshot set for phone and desktop.

### Part 12.4 — Observability
**Goal:** know when something is wrong before players report it.
**Depends on:** 2.10.
**Build:** Sentry on client/API/workers; dashboards or reports for: API latency and errors, job lag (time from `completes_at` to completion), reconciler overdue counts, outbox backlog, WebSocket connections, economy anomalies (e.g. balance jumps beyond expected max rate, ledger/balance mismatch). Alerts for the critical ones to the owner's phone/email.
**Done when:** an injected failure (e.g. stopped worker) triggers an alert within minutes.

### Part 12.5 — Backups & recovery drill
**Goal:** proof that data can be restored.
**Depends on:** 2.10.
**Build:** verify automated backups and retention; perform a restore of staging from backup into a fresh database; document time taken and steps in the runbook.
**Done when:** a successful restore drill is documented with date and duration.

### Part 12.6 — Privacy, legal & compliance basics
**Goal:** minimum responsible launch requirements.
**Depends on:** 2.8.
**Build:** privacy policy and terms (templates adapted — owner must review; Claude is not a lawyer), in-app account deletion, data export on request, age rating considerations, cookie notice if needed for web. List what data is collected and why.
**Done when:** documents are linked in-app and account deletion removes or anonymizes personal data as documented.

### Part 12.7 — Balance pass
**Goal:** pacing that feels good for casual and dedicated players.
**Depends on:** 4.6, 9.6.
**Build:** rerun economy + combat harness with final MVP content; adjust game-data under a new ruleset version; document changes and reasoning.
**Done when:** owner approves pacing targets (e.g. time to key milestones per player profile).

### Part 12.8 — Closed web playtest
**Goal:** real players in the persistent universe.
**Depends on:** all S12 Parts.
**Build:** production environment (separate from staging), invite-only sign-up, in-game feedback button, known-issues page, a playtest checklist (launch steps, monitoring watch, rollback plan). Collect retention (day 1/day 7), tutorial funnel, top feedback themes, top errors.
**Done when:** playtest runs for an agreed period and a results report is delivered to the owner with recommended next priorities. **Stop for owner review.**
