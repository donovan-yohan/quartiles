import { describe, expect, it } from 'vitest'
import {
  buildCandidateWords,
  buildPuzzleFromQuartets,
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
    { word: 'groceries', tileIds: [5, 6, 7, 8] },
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

  it('rejects unknown tile combinations and duplicate tile use', () => {
    expect(validateGuess(miniPuzzle, [3, 8])).toMatchObject({ ok: false })
    expect(validateGuess(miniPuzzle, [3, 3])).toMatchObject({ ok: false })
  })
})

describe('scoring', () => {
  it('rewards longer tile chains with a quartet bonus', () => {
    expect(scoreWord([3, 4])).toBe(2)
    expect(scoreWord([0, 1, 2])).toBe(4)
    expect(scoreWord([5, 6, 7, 8])).toBe(8)
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
