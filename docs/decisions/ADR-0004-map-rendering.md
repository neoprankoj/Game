# ADR-0004 — Map and game rendering: React Native Skia everywhere, behind a renderer boundary, with PixiJS as the web fallback

| Field | Value |
|---|---|
| Status | Proposed (conditional on a performance spike) |
| Date | 2026-10-31 |
| Part | 1.1 |
| Owner approval needed | No deviation from `CLAUDE.md` §5. Owner should note that the **final** web renderer is confirmed by a measured spike, not by this ADR. |

## Context
- The world map (Part 7.6) is the heaviest view: floating islands, tiles, armies in motion, pan and zoom on phones and desktops. Smooth map interaction is a stated priority (source plan XII).
- `CLAUDE.md` §5 prefers `@shopify/react-native-skia`, including on web through CanvasKit, and asks us to validate web performance, with PixiJS as the web alternative.

**Verified facts (2026-10-31):**
- `@shopify/react-native-skia` latest is **2.14.0**. It is the version pinned by Expo SDK 58.
- On web, React Native Skia runs on **CanvasKit (WebAssembly)**. Its docs put the web download at **about 2.9 MB gzipped**, loaded asynchronously via `LoadSkiaWeb()` or lazily via `WithSkiaWeb` with code splitting. No official runtime-performance numbers were found. The download size says nothing about WASM compile time or frame rate, so this must be measured.
- `pixi.js` latest is **8.22.0** (WebGL/WebGPU, actively maintained). `@pixi/react` is 8.0.5, last published December 2025, which is less active.

## Decision
1. Use **React Native Skia** as the map renderer on **all** platforms by default: one drawing codebase.
2. Put the map behind a **renderer boundary**:
   - Pure, shared code: `WorldViewModel` (what to draw: islands, ownership, armies with interpolated positions, fog), camera math (pan/zoom/hit-testing) and level-of-detail rules. These are pure TypeScript and unit-tested.
   - Thin, platform-specific code: `MapCanvas.tsx` (Skia) and, if needed, `MapCanvas.web.tsx` (PixiJS). Each only turns the view model into pixels and pointer events back into camera/selection intents.
3. Load CanvasKit **lazily**, only when the player opens the map (`WithSkiaWeb`), so the login, city and report screens never pay the 2.9 MB cost. Self-host the `.wasm` file from our own origin, with a version matching the package; no third-party CDN at runtime.
4. Run a **spike before Part 7.6**, scheduled as the first step of 7.6, with these pass criteria:
   - 60 fps target (≥ 50 fps p95) panning and zooming a 2,000-tile / 300-island synthetic region on a mid-range laptop (Chrome) and a mid-range Android phone in Chrome;
   - map interactive in ≤ 3 s after first opening it on a typical connection (CanvasKit cached afterwards);
   - native iOS/Android at 60 fps on the same scene.
   If Skia **fails on web only**, implement `MapCanvas.web.tsx` with PixiJS 8 (imperative API; no dependency on `@pixi/react`).

## Alternatives
| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **Skia everywhere + boundary + spike** | One drawing codebase; Skia is first-class in Expo | 2.9 MB WASM on web; web perf unproven for our scene | **Chosen**, with a measured fallback |
| PixiJS on web, Skia on native | Pixi is purpose-built for 2D WebGL games; small and fast on web | Two renderers to maintain from day one | Kept as the fallback; only built if the spike requires it |
| SVG / react-native-svg | Trivial to start | Collapses beyond a few hundred animated nodes | Rejected for the world map; fine for small icons and charts |
| A game engine (Phaser, Unity WebGL) | Rich tooling | Separate runtime, poor integration with RN UI and our contracts | Rejected |

## Trade-offs
- Choosing Skia first optimises for one codebase. The boundary keeps the fallback cheap: only the "pixels" layer would be rewritten, never the map logic.
- The lazy-loading rule adds a little complexity (a loading state for the map) in exchange for fast first-screen loads.

## Consequences
- `WorldViewModel` and camera math sit in a pure package. The proposed home is `packages/game-world` (view-model helpers) or a client-local `map/` module; Part 1.2 decides where.
- Part 7.6 starts with the spike and records the results in this ADR (status → Accepted, or Superseded by a PixiJS ADR).
- **Revisit when** the spike fails, or when playtest telemetry (12.4) shows map frame times above budget.

## Verification
Spike results (fps, load time, device list) appended to this ADR in Part 7.6. Camera math covered by unit tests.
