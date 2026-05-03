import { describe, expect, it } from 'vitest'
import { AVAILABLE_DAILY_DATES, createDailyPuzzle, LATEST_DAILY_DATE, resolveDailyPuzzleData } from './daily'
import {
  buildCandidateWords,
  buildPuzzleFromQuartets,
  calculateScore,
  calculateMedalThresholds,
  getMedalAward,
  scoreWord,
  validateExactQuartetPuzzle,
  validateGuess,
  type TilePuzzle,
} from './puzzle'

const miniPuzzle: TilePuzzle = {
  id: 'mini',
  title: 'Mini test board',
  tiles: ['fro', 'nt', 'ed', 'oce', 'an', 'gr', 'o', 'cer', 'ies'],
  words: [
    { word: 'fronted', tileIds: [0, 1, 2] },
    { word: 'ocean', tileIds: [3, 4] },
    { word: 'groceries', tileIds: [5, 6, 7, 8], isQuartet: true },
  ],
}

describe('word validation', () => {
  it('accepts a valid guess when selected tiles concatenate to a known word', () => {
    expect(validateGuess(miniPuzzle, [5, 6, 7, 8])).toEqual({
      ok: true,
      word: 'groceries',
      tileIds: [5, 6, 7, 8],
      points: 8,
      isQuartet: true,
    })
  })

  it('rejects unknown tile combinations and duplicate tile use with clear reasons', () => {
    expect(validateGuess(miniPuzzle, [3, 8])).toEqual({ ok: false, reason: 'Not in this puzzle.' })
    expect(validateGuess(miniPuzzle, [3, 3])).toEqual({ ok: false, reason: 'Each tile can only be used once.' })
  })

  it('rejects guesses longer than four tiles because puzzle words use up to four tiles', () => {
    const longPuzzle: TilePuzzle = {
      id: 'long',
      title: 'Long board',
      tiles: ['a', 'b', 'c', 'd', 'e'],
      words: [{ word: 'abcde', tileIds: [0, 1, 2, 3, 4] }],
    }

    expect(validateGuess(longPuzzle, [0, 1, 2, 3, 4])).toEqual({
      ok: false,
      reason: 'Words can use at most four tiles.',
    })
  })
})

describe('scoring', () => {
  it('rewards longer tile chains with a quartet bonus', () => {
    expect(scoreWord([3, 4])).toBe(2)
    expect(scoreWord([0, 1, 2])).toBe(4)
    expect(scoreWord([5, 6, 7, 8])).toBe(8)
  })

  it('adds the completion bonus only after all five target quartet words are found', () => {
    const puzzle: TilePuzzle = {
      id: 'bonus',
      title: 'Bonus board',
      tiles: [],
      words: [
        { word: 'one', tileIds: [0, 1, 2, 3], isQuartet: true },
        { word: 'two', tileIds: [4, 5, 6, 7], isQuartet: true },
        { word: 'three', tileIds: [8, 9, 10, 11], isQuartet: true },
        { word: 'four', tileIds: [12, 13, 14, 15], isQuartet: true },
        { word: 'five', tileIds: [16, 17, 18, 19], isQuartet: true },
        { word: 'otherfour', tileIds: [0, 4, 8, 12] },
        { word: 'short', tileIds: [0, 1] },
      ],
    }

    expect(calculateScore(puzzle, ['one', 'two', 'three', 'four'])).toBe(32)
    expect(calculateScore(puzzle, ['one', 'two', 'three', 'four', 'five'])).toBe(80)
    expect(calculateScore(puzzle, ['one', 'two', 'three', 'four', 'five', 'otherfour', 'short'])).toBe(90)
  })

  it('calculates medal thresholds from puzzle score rules and word requirements', () => {
    const puzzle: TilePuzzle = {
      id: 'medals',
      title: 'Medal board',
      tiles: [],
      words: [
        { word: 'one', tileIds: [0, 1, 2, 3], isQuartet: true },
        { word: 'two', tileIds: [4, 5, 6, 7], isQuartet: true },
        { word: 'three', tileIds: [8, 9, 10, 11], isQuartet: true },
        { word: 'four', tileIds: [12, 13, 14, 15], isQuartet: true },
        { word: 'five', tileIds: [16, 17, 18, 19], isQuartet: true },
        { word: 'otherfour', tileIds: [0, 4, 8, 12] },
        { word: 'short', tileIds: [0, 1] },
      ],
    }

    expect(calculateMedalThresholds(puzzle)).toEqual({
      bronze: 15,
      silver: 80,
      gold: 85,
      platinum: 90,
    })
  })

  it('calculates no gold threshold when there are no non-quartet words', () => {
    const puzzle: TilePuzzle = {
      id: 'quartets-only-medals',
      title: 'Quartets only medals',
      tiles: [],
      words: [
        { word: 'one', tileIds: [0, 1, 2, 3], isQuartet: true },
        { word: 'two', tileIds: [4, 5, 6, 7], isQuartet: true },
        { word: 'three', tileIds: [8, 9, 10, 11], isQuartet: true },
        { word: 'four', tileIds: [12, 13, 14, 15], isQuartet: true },
        { word: 'five', tileIds: [16, 17, 18, 19], isQuartet: true },
      ],
    }

    expect(calculateMedalThresholds(puzzle)).toEqual({
      bronze: 15,
      silver: 80,
      gold: null,
      platinum: 80,
    })
  })

  it('awards medals by score thresholds and completion requirements', () => {
    const puzzle: TilePuzzle = {
      id: 'medal-awards',
      title: 'Medal awards',
      tiles: [],
      words: [
        { word: 'one', tileIds: [0, 1, 2, 3], isQuartet: true },
        { word: 'two', tileIds: [4, 5, 6, 7], isQuartet: true },
        { word: 'three', tileIds: [8, 9, 10, 11], isQuartet: true },
        { word: 'four', tileIds: [12, 13, 14, 15], isQuartet: true },
        { word: 'five', tileIds: [16, 17, 18, 19], isQuartet: true },
        { word: 'otherfour', tileIds: [0, 4, 8, 12] },
        { word: 'short', tileIds: [0, 1] },
      ],
    }

    expect(getMedalAward(puzzle, [])).toBe('none')
    expect(getMedalAward(puzzle, ['otherfour', 'short'])).toBe('none')
    expect(getMedalAward(puzzle, ['one', 'otherfour'])).toBe('bronze')
    expect(getMedalAward(puzzle, ['one', 'two', 'three', 'four', 'five'])).toBe('silver')
    expect(getMedalAward(puzzle, ['one', 'two', 'three', 'four', 'five', 'short'])).toBe('silver')
    expect(getMedalAward(puzzle, ['one', 'two', 'three', 'four', 'five', 'otherfour'])).toBe('gold')
    expect(getMedalAward(puzzle, ['one', 'two', 'three', 'four', 'five', 'otherfour', 'short'])).toBe('platinum')
  })
})

describe('candidate solving', () => {
  it('finds dictionary words from available tiles without reusing a tile in one word', () => {
    const candidates = buildCandidateWords(
      ['sun', 'flow', 'er', 'light', 'house', 'boat'],
      ['sunflower', 'sunlight', 'houseboat', 'sunhouse', 'sunflowerer'],
    )

    expect(candidates.map((candidate) => candidate.word)).toEqual([
      'sunflower',
      'sunlight',
      'houseboat',
      'sunhouse',
    ])
    expect(candidates.find((candidate) => candidate.word === 'sunflower')?.tileIds).toEqual([0, 1, 2])
  })

  it('does not generate candidate words that need more than four tiles', () => {
    const candidates = buildCandidateWords(['a', 'b', 'c', 'd', 'e'], ['abcd', 'abcde'])

    expect(candidates.map((candidate) => candidate.word)).toEqual(['abcd'])
  })
})

describe('daily puzzle dictionary coverage', () => {
  const expectedBackfillDates = [
    '2026-04-26',
    '2026-04-27',
    '2026-04-28',
    '2026-04-29',
    '2026-04-30',
    '2026-05-01',
    '2026-05-02',
    '2026-05-03',
  ]

  const tileIdsForFragments = (puzzle: TilePuzzle, fragments: string[]) =>
    fragments.map((fragment) => {
      const tileId = puzzle.tiles.indexOf(fragment)
      expect(tileId, `expected daily board to contain tile ${fragment}`).toBeGreaterThanOrEqual(0)
      return tileId
    })

  it('keeps generated daily dates sorted, unique, backfilled, and date-addressable', () => {
    const sortedDates = [...AVAILABLE_DAILY_DATES].sort((left, right) => left.localeCompare(right))

    expect(AVAILABLE_DAILY_DATES).toEqual(sortedDates)
    expect(new Set(AVAILABLE_DAILY_DATES).size).toBe(AVAILABLE_DAILY_DATES.length)
    expect(AVAILABLE_DAILY_DATES).toEqual(expect.arrayContaining(expectedBackfillDates))
    expect(LATEST_DAILY_DATE).toBe(AVAILABLE_DAILY_DATES.at(-1))
    expect(createDailyPuzzle('1999-01-01').id).toBe(LATEST_DAILY_DATE)

    for (const date of AVAILABLE_DAILY_DATES) {
      expect(createDailyPuzzle(date).id).toBe(date)
    }
  })

  it('accepts valid shorter words constructible from the daily tiles', () => {
    const puzzle = createDailyPuzzle(new Date('2026-05-02T00:00:00.000Z'))

    expect(validateGuess(puzzle, tileIdsForFragments(puzzle, ['eve', 'ry']))).toMatchObject({
      ok: true,
      word: 'every',
    })
    expect(validateGuess(puzzle, tileIdsForFragments(puzzle, ['whe', 're']))).toMatchObject({
      ok: true,
      word: 'where',
    })
    expect(puzzle.words.filter((word) => word.isQuartet)).toHaveLength(5)
  })

  it('does not award bronze on the May 2 board after only finding where', () => {
    const puzzle = createDailyPuzzle(new Date('2026-05-02T00:00:00.000Z'))

    expect(calculateScore(puzzle, ['where'])).toBe(2)
    expect(getMedalAward(puzzle, ['where'])).toBe('none')
    expect(getMedalAward(puzzle, ['where', 'everywhere', 'executed'])).toBe('bronze')
  })

  it('does not accept Scrabble-only dictionary cruft as daily puzzle words', () => {
    const puzzle = createDailyPuzzle(new Date('2026-05-02T00:00:00.000Z'))

    expect(validateGuess(puzzle, tileIdsForFragments(puzzle, ['whe', 'tic']))).toEqual({
      ok: false,
      reason: 'Not in this puzzle.',
    })
    expect(validateGuess(puzzle, tileIdsForFragments(puzzle, ['sop', 'ry']))).toEqual({
      ok: false,
      reason: 'Not in this puzzle.',
    })
  })

  it('keeps daily source tiles unique and at least two letters long', () => {
    for (const date of AVAILABLE_DAILY_DATES) {
      const sourceTiles = resolveDailyPuzzleData(date).quartets.flat()

      expect(sourceTiles.every((tile) => tile.length >= 2), `${date} has a short source tile`).toBe(true)
      expect(new Set(sourceTiles).size, `${date} has duplicate source tiles`).toBe(sourceTiles.length)
    }
  })

  it('rejects generated daily boards unless each date has exactly its own five target quartets', () => {
    for (const date of AVAILABLE_DAILY_DATES) {
      const puzzle = createDailyPuzzle(date)
      const targetQuartetWords = resolveDailyPuzzleData(date).quartets
        .map((quartet) => quartet.join(''))
        .sort((left, right) => left.localeCompare(right))

      expect(validateExactQuartetPuzzle(puzzle, targetQuartetWords), `${date} failed exact quartet validation`).toEqual({
        ok: true,
        quartetWords: targetQuartetWords,
      })
    }
  })

  it('reports extra valid four-tile words when a candidate puzzle is not strict enough', () => {
    const puzzle = buildPuzzleFromQuartets({
      seed: 'extra-four-tile-word',
      title: 'Invalid quartet board',
      quartets: [
        ['a', 'b', 'c', 'd'],
        ['e', 'f', 'g', 'h'],
        ['i', 'j', 'k', 'l'],
        ['m', 'n', 'o', 'p'],
        ['q', 'r', 's', 't'],
      ],
      dictionary: ['abcd', 'abce', 'efgh', 'ijkl', 'mnop', 'qrst'],
    })

    expect(validateExactQuartetPuzzle(puzzle, ['abcd', 'efgh', 'ijkl', 'mnop', 'qrst'])).toEqual({
      ok: false,
      quartetWords: ['abcd', 'abce', 'efgh', 'ijkl', 'mnop', 'qrst'],
      targetQuartetWords: ['abcd', 'efgh', 'ijkl', 'mnop', 'qrst'],
      extraQuartetWords: ['abce'],
      missingTargetQuartetWords: [],
      reason: 'Expected exactly 5 target quartets and no extra four-tile words.',
    })
  })
})

describe('puzzle generation', () => {
  it('creates a deterministic 20-tile board from five quartet words', () => {
    const puzzle = buildPuzzleFromQuartets({
      seed: '2026-05-02',
      title: 'Daily stack',
      quartets: [
        ['sun', 'flow', 'er', 's'],
        ['moon', 'light', 'ing', 's'],
        ['rain', 'bow', 'fish', 'es'],
        ['star', 'dust', 'trail', 's'],
        ['book', 'mark', 'let', 's'],
      ],
      dictionary: ['sunflowers', 'moonlightings', 'rainbowfishes', 'stardusttrails', 'bookmarklets'],
    })

    expect(puzzle.tiles).toHaveLength(20)
    expect(new Set(puzzle.tiles)).toEqual(new Set([
      'sun', 'flow', 'er', 's',
      'moon', 'light', 'ing', 's',
      'rain', 'bow', 'fish', 'es',
      'star', 'dust', 'trail', 's',
      'book', 'mark', 'let', 's',
    ]))
    expect(puzzle.words.filter((word) => word.tileIds.length === 4)).toHaveLength(5)

    const second = buildPuzzleFromQuartets({
      seed: '2026-05-02',
      title: 'Daily stack',
      quartets: [
        ['sun', 'flow', 'er', 's'],
        ['moon', 'light', 'ing', 's'],
        ['rain', 'bow', 'fish', 'es'],
        ['star', 'dust', 'trail', 's'],
        ['book', 'mark', 'let', 's'],
      ],
      dictionary: ['sunflowers', 'moonlightings', 'rainbowfishes', 'stardusttrails', 'bookmarklets'],
    })

    expect(second.tiles).toEqual(puzzle.tiles)
  })
})
