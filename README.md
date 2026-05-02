# Lexi Tiles

Lexi Tiles is a mobile-first, open-source word-fragment puzzle. Tap tiles in order to build valid words, chase the four-part bonus words, and use hints when your brain starts leaking out of your ears.

The repository name is `quartiles`, but the app intentionally avoids Apple naming, branding, assets, and UI copy.

## Features

- Mobile-first React + TypeScript + Vite app
- Date-addressable daily puzzles with one week of backfilled boards
- Daily generated board from five four-part target words
- Custom puzzle builder: paste up to five lines of four word parts each
- Clean-room solver/generator for finding valid tile combinations from a generated dictionary
- Daily dictionary generated from the MIT-licensed `wordlist-english` package, backed by SCOWL, so constructible shorter words are accepted without falling back to Scrabble-only cruft
- Hint system powered by the same solver data
- Score tracking, found-word list, shuffle, clear, and submit controls
- Wrong-word and duplicate-word error states with accessible alerts
- Local browser progress storage, so daily found words survive refreshes/navigation
- Solved quartet tiles lock into rows and stay out of shuffle
- GitHub Actions automation can add a new daily puzzle around America/New_York midnight
- Five-quartet completion bonus scoring
- Accessible button labels and live status messages
- Vercel-ready static deployment

See [`docs/acceptance-criteria.md`](docs/acceptance-criteria.md) for the researched gameplay checklist and follow-up TODOs.

## Clean-room note

The implementation may be conceptually inspired by word-fragment puzzle mechanics and by the existence of public solver projects, but it does **not** copy source code from `nilsstreedain/quartiles-solver` or other GPL projects. The solver/generator in `src/lib/puzzle.ts` was written for this repo and is covered by this repo's license.

## Development

```bash
npm install
npm run generate:daily-words
npm run dev
```

`npm run generate:daily-words` refreshes `src/data/generated-daily-puzzles.ts` from `src/data/daily-puzzles.json` and the MIT-licensed `wordlist-english` npm package. The generator treats the configured word source as the playable dictionary: it enumerates every 1-4 tile string that can be built from each dated board, keeps every match in that source, always includes the five target quartet words, and filters a small explicit blocklist for inappropriate entries.

Generation fails unless every daily board has exactly five quartet rows of four tiles, every tile text is unique within that board, every tile has at least two letters, and exactly the five target four-tile words are valid. This prevents duplicate tiles, one-letter fragments, and accidental “extra quartets.”

Add a new dated puzzle manually with:

```bash
npm run add:daily-puzzle -- --date=YYYY-MM-DD
npm run generate:daily-words
```

The `Daily puzzle generation` GitHub Actions workflow runs at the two UTC offsets around America/New_York midnight, adds the date if missing, verifies, commits, and pushes. Vercel should deploy from that push.

## Verification

```bash
npm run check:daily-words
npm test
npm run build
npm run lint
```

## Deploy to Vercel

Vercel should auto-detect this as a Vite app.

- Framework preset: `Vite`
- Build command: `npm run build`
- Output directory: `dist`
- Install command: `npm install`

CLI deploy:

```bash
npm i -g vercel
vercel
vercel --prod
```

## Puzzle format

Custom puzzles accept one quartet per line:

```text
eve ry whe re
ex ec ut ed
au tho ri ty
ass oc ia te
sop his tic ate
```

Each line creates one four-part target word. The board solver finds shorter valid words from the built-in generated dictionary. Daily puzzle generation also validates that exactly five valid four-tile words exist: the five configured targets, and nothing else. Daily source boards additionally require unique tile text and a minimum tile length of two letters.

Dated daily puzzles are available at `/daily/YYYY-MM-DD`; the repo currently includes a one-week backfill ending at `2026-05-02`.

## License

MIT
