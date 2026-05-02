import { describe, expect, it } from 'vitest'
import { createDailyPuzzle } from './daily'
import {
  buildCandidateWords,
  buildPuzzleFromQuartets,
  calculateScore,
  scoreWord,
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
  const tileIdsForFragments = (puzzle: TilePuzzle, fragments: string[]) =>
    fragments.map((fragment) => {
      const tileId = puzzle.tiles.indexOf(fragment)
      expect(tileId, `expected daily board to contain tile ${fragment}`).toBeGreaterThanOrEqual(0)
      return tileId
    })

  it('accepts all valid words constructible from the daily tiles, including shorter roots and plurals', () => {
    const puzzle = createDailyPuzzle(new Date('2026-05-02T00:00:00.000Z'))

    expect(validateGuess(puzzle, tileIdsForFragments(puzzle, ['flow', 'er']))).toMatchObject({
      ok: true,
      word: 'flower',
    })
    expect(validateGuess(puzzle, tileIdsForFragments(puzzle, ['flow', 'er', 's']))).toMatchObject({
      ok: true,
      word: 'flowers',
    })
    expect(puzzle.words.filter((word) => word.isQuartet)).toHaveLength(5)
  })

  it('does not accept Scrabble-only dictionary cruft as daily puzzle words', () => {
    const puzzle = createDailyPuzzle(new Date('2026-05-02T00:00:00.000Z'))

    expect(validateGuess(puzzle, tileIdsForFragments(puzzle, ['gl', 'ift']))).toEqual({
      ok: false,
      reason: 'Not in this puzzle.',
    })
    expect(validateGuess(puzzle, tileIdsForFragments(puzzle, ['dr', 'ack']))).toEqual({
      ok: false,
      reason: 'Not in this puzzle.',
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
