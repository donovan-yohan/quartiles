# Lexi Tiles

Lexi Tiles is a mobile-first, open-source word-fragment puzzle. Tap tiles in order to build valid words, chase the four-part bonus words, and use hints when your brain starts leaking out of your ears.

The repository name is `quartiles`, but the app intentionally avoids Apple naming, branding, assets, and UI copy.

## Features

- Mobile-first React + TypeScript + Vite app
- Daily generated board from five four-part target words
- Custom puzzle builder: paste up to five lines of four word parts each
- Clean-room solver/generator for finding valid tile combinations from a dictionary
- Hint system powered by the same solver data
- Score tracking, found-word list, shuffle, clear, and submit controls
- Wrong-word and duplicate-word error states with accessible alerts
- Five-quartet completion bonus scoring
- Accessible button labels and live status messages
- Vercel-ready static deployment

See [`docs/acceptance-criteria.md`](docs/acceptance-criteria.md) for the researched gameplay checklist and follow-up TODOs.

## Clean-room note

The implementation may be conceptually inspired by word-fragment puzzle mechanics and by the existence of public solver projects, but it does **not** copy source code from `nilsstreedain/quartiles-solver` or other GPL projects. The solver/generator in `src/lib/puzzle.ts` was written for this repo and is covered by this repo's license.

## Development

```bash
npm install
npm run dev
```

## Verification

```bash
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
sun flow er s
af ter gl ow
bl ack bi rd
but ter cu p
dr ift wo od
```

Each line creates one four-part target word and the board solver also finds shorter valid words from the built-in dictionary.

## License

MIT
