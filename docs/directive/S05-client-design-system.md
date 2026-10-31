# S05 — Client Shell & Design System

**Goal of this section:** the visual language and app structure that all gameplay screens plug into. Built before gameplay screens so they don't each invent their own style.

---

### Part 5.1 — Design tokens
**Goal:** the Chronos Cradle visual identity as code.
**Depends on:** 2.7, `00-vision.md`.
**Build:** `packages/design-system` tokens: color palette (weathered bronze, ancient stone, cyan energy, violet anomaly, cosmic dark backgrounds, semantic colors for success/warning/danger/info), typography scale (a display face with monumental character + a highly legible UI face), spacing, radii, elevation, motion durations. Light-on-dark primary theme. Verify text contrast meets WCAG AA.
**Done when:** a token preview screen in the client shows every token; contrast checks pass.
**Tests:** contrast check script for text/background token pairs.

### Part 5.2 — Core components
**Goal:** reusable building blocks with the game's look.
**Depends on:** 5.1.
**Build:** Button (primary/secondary/danger, loading, disabled), Panel/Card (bronze-framed), Resource chip (icon + amount + rate), Countdown timer (driven by server `completes_at` + server offset), Progress bar, Modal/Sheet, Tabs, List row, Toast, Empty and error states, Icon set placeholder system.
**Done when:** each component renders on web and native in a component gallery screen; components are accessible (labels, focus, touch target ≥ 44 pt).
**Tests:** countdown correctness with a fake clock; component render tests.

### Part 5.3 — Navigation & responsive layouts
**Goal:** structure that suits both phones and desktops.
**Depends on:** 5.2.
**Build:** mobile: portrait-first bottom tab navigation (City, Map, Military, Reports, More); web/desktop: multi-panel layout (navigation rail + main view + side detail panel) with keyboard shortcuts for main sections. Shared top bar showing resources and notifications. Breakpoints defined in tokens.
**Done when:** the same routes work on phone and desktop with platform-appropriate layouts; Playwright test covers desktop navigation.

### Part 5.4 — Data layer & state
**Goal:** a consistent way to fetch, cache and refresh server state.
**Depends on:** 2.4, 3.1.
**Build:** query/cache library (e.g. TanStack Query) wired to the typed API client; idempotency key generation for mutations; optimistic UI only where safe and always reconciled with server response; global error handling (session expired, network offline, server error); server-time offset service.
**Done when:** a mutation retried after a network drop does not double-apply; offline banner appears and recovers.
**Tests:** idempotency key reuse on retry; error mapping.
