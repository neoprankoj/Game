# ADR-0003 — Client: one Expo (React Native + Expo Router) codebase for web, iOS and Android

| Field | Value |
|---|---|
| Status | Accepted at the S01 gate, 2026-11-01 |
| Date | 2026-10-31 |
| Part | 1.1 |
| Owner approval needed | No deviation from `CLAUDE.md` §3/§5. (This confirms an owner-approved V2.2 change to the source plan, which had a separate Next.js app.) |

## Context
- Platforms: iOS, Android, desktop browsers, and mobile browsers where practical. **Web ships first** for the closed playtest (`CLAUDE.md` §3).
- The source plan (Part II.1, XII) wants shared contracts, game definitions and rules, with **platform-appropriate layouts**: portrait-first on mobile, multi-panel with keyboard and mouse on web.
- One developer: two UI codebases would double UI work.

**Verified facts (npm registry, 2026-10-31):**
- `expo` latest is **58.0.22** (SDK 58). `expo-router` is 58.0.29.
- SDK 58 `bundledNativeModules.json` pins: `react-native` **0.88.1**, `react`/`react-dom` **19.3.0**, `react-native-web` ~0.21.4, `react-native-reanimated` 4.7.1, `@shopify/react-native-skia` **2.14.0**, `expo-notifications` ~58.1.7.
- `@better-auth/expo` 1.7.14 exists and the Better Auth docs say it supports "both Expo native and web apps" (see ADR-0007).

## Decision
- **`apps/client`**: one Expo SDK 58 app using **Expo Router** with file-based routing. Built for web (static or SPA export) first; iOS/Android dev builds work from day one so native regressions show up early, but they are not released until S13 (13.10).
- Native module versions are always installed with `npx expo install` so they match the SDK pins.
- Responsive and platform differences use, in this order of preference:
  1. responsive layout primitives in `packages/design-system` (breakpoints, not platform checks);
  2. `*.web.tsx` / `*.native.tsx` files when a component's interaction model really differs (map, hover, keyboard shortcuts);
  3. `Platform.OS` checks only for small details.
- The client data layer is decided in Part 5.4; the leading candidate is TanStack Query. The client never computes authoritative state; it only displays countdowns that are recomputed from server timestamps.

## Alternatives
| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **One Expo app (web + native)** | One UI codebase; Expo Router gives URL routing on web and native navigation on mobile; shared components | react-native-web is not a full DOM, so some web conventions (SEO, rich text, complex tables) are harder | **Chosen**: a logged-in game client does not need SEO |
| Expo (native) + Next.js (web) | Best-in-class web | Two UI codebases, two routers, two sets of components for one person | Rejected; can be added later via ADR for a *marketing* site only |
| Expo (native) + Vite/React DOM SPA | Fast web dev loop, full DOM | Still two UI codebases | Rejected for the same reason |
| Flutter | One codebase, strong canvas rendering | Not TypeScript, so contracts, Zod schemas and game-data cannot be shared directly (breaks the "shared rules" principle) | Rejected |
| Capacitor (web app wrapped for stores) | Web-first, one codebase | Weaker native feel; the source plan asks for "native-feeling" mobile | Rejected |

## Trade-offs
- Web performance and feel depend on react-native-web. Heavy views (the map) get dedicated rendering (ADR-0004), and everything else is ordinary UI.
- Expo ships a new SDK roughly every quarter. We upgrade deliberately (one Part, one SDK) and never in the middle of a Section.

## Consequences
- Part 2.7 creates the shell. Part 5.3 defines breakpoints and mobile/web layouts.
- The `apps/client` → `packages/*` dependency direction is fixed. The client may import `contracts`, `game-data` and `design-system`, plus read-only display helpers from `game-*` (for example "time remaining"), but never `db`.
- **Revisit when** web UX measurements in the playtest (12.8) show react-native-web is the bottleneck for a core screen. Answer that screen with a `.web.tsx` implementation first, before considering a second app.

## Verification
Part 2.7: one codebase renders a screen on web (Playwright), iOS simulator and Android emulator (manual smoke test, documented), using the same `contracts` types.
