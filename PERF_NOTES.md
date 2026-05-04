# Mobile Platinum Tile Performance

## Setup

- Branch: `perf/mobile-platinum-and-puzzle-tiles`
- Page under investigation: `/daily/2026-05-04`
- Chrome DevTools MCP: unavailable in Codex. Deferred tool discovery did not expose a Chrome/DevTools tool.
- Local fallback: browser automation against the built Vite preview at `/daily/2026-05-04`, with a completed-puzzle cookie to force the platinum state. Chrome DevTools MCP was not registered, so the benchmark used in-page Performance APIs plus monkey-patched layout/animation counters.

## Root Cause

The expensive path is the exhausted/platinum tile styling after all words are found:

- All 20 tiles can become `.tile--exhausted`.
- Each exhausted tile created an oversized `::before` pseudo-element.
- That pseudo-element used multiple radial gradients, `filter: blur(...) saturate(...)`, `mix-blend-mode: screen`, and a `translate3d(...) scale(...)` transform.
- On mobile/touch, scrolling or tile movement makes the browser repaint/composite 20 blended and filtered surfaces in a dense grid.
- Shuffle/quartet pinning also captured tile positions with `getBoundingClientRect()` and played FLIP transforms, adding layout reads and transform work on low-end devices.

## Changes

- Kept the desktop static platinum highlight.
- Added a mobile/touch/small-screen/reduced-motion platinum style that preserves the static glow with direct background gradients.
- Disabled the expensive exhausted tile pseudo-element in that low-end bucket, removing the filter, blend mode, and translated pseudo layer.
- Disabled tile/control press transforms in that bucket.
- Skipped FLIP position reads and animations for reduced-motion, touch, coarse pointer, and small-screen contexts.
- Memoized tile buttons and only emits holographic CSS variables for exhausted tiles.

## Benchmark

Built preview (`vite preview`) on HeadlessChrome 147, viewport 1280×633, completed 2026-05-04 puzzle cookie, 20 Shuffle clicks:

| Mode | Tile layout reads | Tile animations | Avg click-to-2xRAF | Max click-to-2xRAF |
| --- | ---: | ---: | ---: | ---: |
| Desktop FLIP path | 800 | 379 | 19.33ms | 37.30ms |
| Simulated touch/low-end path | 0 | 0 | 17.64ms | 21.50ms |

The important result is not the small desktop-headless wall-time delta; it is that the low-end path removes the forced tile layout reads and generated animations entirely. Combined with the mobile CSS media query, touch devices also avoid the per-tile filtered/blended pseudo-element.

## Verification

- `npm run lint`
- `npx vitest run --configLoader runner`
- `npm run build -- --configLoader runner`
- `npm run check:daily-words`

Note: plain `npm test` and plain Vite dev startup try to write Vite's bundled config temp file into the parent repo `node_modules/.vite-temp`, which is outside this worktree sandbox. Using `--configLoader runner` keeps verification inside the allowed workspace.
