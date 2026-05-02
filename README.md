# Lexi Tiles

Lexi Tiles is a mobile-first, open-source word-fragment puzzle. Tap tiles in order to build valid words, chase the four-part bonus words, and use hints when your brain starts leaking out of your ears.

The repository name is `quartiles`, but the app intentionally avoids Apple naming, branding, assets, and UI copy.

## Features

- Mobile-first React + TypeScript + Vite app
- Daily generated board from five four-part target words
- Custom puzzle builder: paste up to five lines of four word parts each
- Clean-room solver/generator for finding valid tile combinations from a generated dictionary
- Daily dictionary generated from the MIT-licensed `wordlist-english` package, backed by SCOWL, so constructible words like `flowers` are accepted without falling back to Scrabble-only cruft
- Hint system powered by the same solver data
- Score tracking, found-word list, shuffle, clear, and submit controls
- Wrong-word and duplicate-word error states with accessible alerts
- Local browser progress storage, so daily found words survive refreshes/navigation
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

`npm run generate:daily-words` refreshes `src/data/daily-words.ts` from `src/data/daily-quartets.json` and the MIT-licensed `wordlist-english` npm package. The generator treats the configured word source as the playable dictionary: it enumerates every 1-4 tile string that can be built from the daily board, keeps every match in that source, always includes the five target quartet words, and filters a small explicit blocklist for inappropriate entries.

Generation fails unless the board has exactly the five target four-tile words and no extra valid four-tile words. This prevents accidental “extra quartets” from showing up outside the intended five.

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
sun flo we rs
af ter gl ow
bl ack bi rd
but ter cu p
d ri ft wood
```

Each line creates one four-part target word. The board solver finds shorter valid words from the built-in generated dictionary. Daily puzzle generation also validates that exactly five valid four-tile words exist: the five configured targets, and nothing else.

## License

MIT
