export type PuzzleWord = {
  word: string
  tileIds: number[]
}

export type TilePuzzle = {
  id: string
  title: string
  tiles: string[]
  words: PuzzleWord[]
}

export type ValidGuess = {
  ok: true
  word: string
  tileIds: number[]
  points: number
  isQuartet: boolean
}

export type InvalidGuess = {
  ok: false
  reason: string
}

export type GuessResult = ValidGuess | InvalidGuess

export type QuartetPuzzleInput = {
  seed: string
  title: string
  quartets: [string, string, string, string][]
  dictionary: string[]
}

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z]/g, '')

const hashSeed = (seed: string) => {
  let hash = 2166136261
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

const seededRandom = (seed: string) => {
  let state = hashSeed(seed) || 1

  return () => {
    state = Math.imul(1664525, state) + 1013904223
    return (state >>> 0) / 4294967296
  }
}

const shuffleWithSeed = <T>(items: T[], seed: string) => {
  const random = seededRandom(seed)
  const shuffled = [...items]

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    const current = shuffled[index]
    shuffled[index] = shuffled[swapIndex]
    shuffled[swapIndex] = current
  }

  return shuffled
}

export const scoreWord = (tileIds: number[]) => {
  if (tileIds.length >= 4) {
    return 8
  }

  if (tileIds.length === 3) {
    return 4
  }

  return tileIds.length
}

export const buildCandidateWords = (tiles: string[], dictionary: string[]): PuzzleWord[] => {
  const normalizedTiles = tiles.map(normalize)
  const uniqueWords = [...new Set(dictionary.map(normalize).filter(Boolean))]

  const findTilePath = (word: string) => {
    const search = (prefix: string, used: Set<number>, path: number[]): number[] | null => {
      if (prefix === word) {
        return path
      }

      if (!word.startsWith(prefix)) {
        return null
      }

      for (let index = 0; index < normalizedTiles.length; index += 1) {
        if (used.has(index)) {
          continue
        }

        const nextPrefix = prefix + normalizedTiles[index]
        if (!word.startsWith(nextPrefix)) {
          continue
        }

        used.add(index)
        const result = search(nextPrefix, used, [...path, index])
        used.delete(index)

        if (result) {
          return result
        }
      }

      return null
    }

    return search('', new Set<number>(), [])
  }

  return uniqueWords.flatMap((word) => {
    const tileIds = findTilePath(word)
    return tileIds ? [{ word, tileIds }] : []
  })
}

export const validateGuess = (puzzle: TilePuzzle, tileIds: number[]): GuessResult => {
  if (tileIds.length === 0) {
    return { ok: false, reason: 'Select at least one tile.' }
  }

  if (new Set(tileIds).size !== tileIds.length) {
    return { ok: false, reason: 'Each tile can only be used once.' }
  }

  if (tileIds.some((tileId) => tileId < 0 || tileId >= puzzle.tiles.length)) {
    return { ok: false, reason: 'That tile is not on this board.' }
  }

  const guess = normalize(tileIds.map((tileId) => puzzle.tiles[tileId]).join(''))
  const word = puzzle.words.find((candidate) => candidate.word === guess)

  if (!word) {
    return { ok: false, reason: 'Not in this puzzle.' }
  }

  return {
    ok: true,
    word: word.word,
    tileIds: [...tileIds],
    points: scoreWord(tileIds),
    isQuartet: tileIds.length === 4,
  }
}

export const buildPuzzleFromQuartets = ({
  seed,
  title,
  quartets,
  dictionary,
}: QuartetPuzzleInput): TilePuzzle => {
  const sourceTiles = quartets.flat()
  const tiles = shuffleWithSeed(sourceTiles, seed)
  const words = buildCandidateWords(tiles, dictionary)

  return {
    id: seed,
    title,
    tiles,
    words,
  }
}
