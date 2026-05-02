# Lexi Tiles acceptance criteria

This checklist captures the gameplay rules Lexi Tiles intentionally supports. It is based on public high-level descriptions of the tile-word puzzle format, not on copied source code or proprietary assets.

## Research notes

Sources consulted:

- Apple Support: words are made from up to four tiles; four-tile words score 8 points; finding all five four-tile words earns a 40-point bonus; not every dictionary word is accepted.
- Cult of Mac overview: each puzzle has five four-tile target words; valid words can use one, two, three, or four tiles; shorter words can be found before all four-tile words.

Product/legal constraint:

- Use original implementation, original styling, and original branding. Do not copy Apple assets, Apple naming, or GPL solver code.

## Must-have gameplay acceptance criteria

- [x] The app presents a mobile-first word-fragment board.
- [x] A valid submitted word can use 1, 2, 3, or 4 tiles.
- [x] A submitted word using more than 4 tiles is rejected with a clear error.
- [x] A tile cannot be reused within the same submitted word.
- [x] Invalid tile combinations are rejected with a visible error state.
- [x] Error messages are announced accessibly with `role="alert"`.
- [x] Already-entered words are detected and do not score twice.
- [x] Found words are tracked in a visible found-words list.
- [x] Score is based on tile count: 1 tile = 1 point, 2 tiles = 2 points, 3 tiles = 4 points, 4 tiles = 8 points.
- [x] Finding all five four-tile words adds a 40-point completion bonus.
- [x] Hints only suggest unfound words.
- [x] Custom puzzles reject malformed input with a clear error.

## Build/deploy acceptance criteria

- [x] App is Vite + React + TypeScript.
- [x] Project builds as a static app for Vercel.
- [x] Unit and UI tests cover core solver, validation, scoring, and interaction behavior.
- [x] GitHub Actions runs tests, build, and lint on pushes and PRs to `main`.
- [x] MIT license is included.

## Follow-up TODOs

These are nice-to-have, not blockers for the current public repo:

- [ ] Add a larger curated word list with explicit moderation filters for proper nouns, technical terms, slurs/profanity, and obscure entries.
- [ ] Add persistent local progress and stats per daily puzzle.
- [ ] Add shareable result text without spoiling found words.
- [ ] Add an optional reveal-all flow that clearly separates revealed words from player-found words.
- [ ] Add drag/reorder support for selected tiles on touch devices.
- [ ] Add PWA manifest and offline caching for daily play.
- [ ] Add visual grouping/sorting for found four-tile words.
