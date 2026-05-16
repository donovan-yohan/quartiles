export type PuzzleWord = {
  word: string
  tileIds: number[]
  isQuartet?: boolean
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

export const MAX_TILES_PER_WORD = 4
export const QUARTILE_COMPLETION_COUNT = 5
export const QUARTILE_COMPLETION_BONUS = 40

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z]/g, '')
const pathSignature = (tileIds: number[]) => tileIds.join(',')
const sameTilePath = (left: number[], right: number[]) =>
  left.length === right.length && left.every((tileId, index) => tileId === right[index])

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
  if (tileIds.length === MAX_TILES_PER_WORD) {
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

      if (path.length >= MAX_TILES_PER_WORD || !word.startsWith(prefix)) {
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

  if (tileIds.length > MAX_TILES_PER_WORD) {
    return { ok: false, reason: 'Words can use at most four tiles.' }
  }

  const guess = normalize(tileIds.map((tileId) => puzzle.tiles[tileId]).join(''))
  const word = puzzle.words.find(
    (candidate) => candidate.word === guess && sameTilePath(candidate.tileIds, tileIds),
  )

  if (!word) {
    return { ok: false, reason: 'Not in this puzzle.' }
  }

  return {
    ok: true,
    word: word.word,
    tileIds: [...word.tileIds],
    points: scoreWord(word.tileIds),
    isQuartet: Boolean(word.isQuartet),
  }
}

export const calculateScore = (puzzle: TilePuzzle, foundWords: string[]) => {
  const foundWordSet = new Set(foundWords)
  const foundScore = puzzle.words.reduce(
    (total, word) => total + (foundWordSet.has(word.word) ? scoreWord(word.tileIds) : 0),
    0,
  )
  const quartets = puzzle.words.filter((word) => word.isQuartet)
  const earnedQuartetBonus =
    quartets.length >= QUARTILE_COMPLETION_COUNT && quartets.every((word) => foundWordSet.has(word.word))

  return foundScore + (earnedQuartetBonus ? QUARTILE_COMPLETION_BONUS : 0)
}

export type MedalTier = 'none' | 'bronze' | 'silver' | 'gold' | 'platinum'

export type MedalThresholds = {
  bronze: number
  silver: number
  gold: number | null
  platinum: number
}

const BRONZE_MEDAL_MINIMUM_SCORE = 15

export const calculateMedalThresholds = (puzzle: TilePuzzle): MedalThresholds => {
  const quartetWords = puzzle.words.filter((word) => word.isQuartet)
  const nonQuartetWords = puzzle.words.filter((word) => !word.isQuartet)
  const nonQuartetScores = nonQuartetWords.map((word) => scoreWord(word.tileIds))
  const remainingScore = nonQuartetScores.reduce((total, score) => total + score, 0)
  const silver = calculateScore(
    puzzle,
    quartetWords.map((word) => word.word),
  )

  return {
    bronze: BRONZE_MEDAL_MINIMUM_SCORE,
    silver,
    gold: nonQuartetScores.length > 0 ? silver + Math.ceil(remainingScore / 2) : null,
    platinum: calculateScore(
      puzzle,
      puzzle.words.map((word) => word.word),
    ),
  }
}

export const getMedalAward = (puzzle: TilePuzzle, foundWords: string[]): MedalTier => {
  const foundWordSet = new Set(foundWords)
  const quartetWords = puzzle.words.filter((word) => word.isQuartet)
  const allQuartetsFound = quartetWords.length > 0 && quartetWords.every((word) => foundWordSet.has(word.word))
  const allWordsFound = puzzle.words.length > 0 && puzzle.words.every((word) => foundWordSet.has(word.word))
  const thresholds = calculateMedalThresholds(puzzle)
  const score = calculateScore(puzzle, foundWords)

  if (allWordsFound) {
    return 'platinum'
  }

  if (allQuartetsFound && thresholds.gold !== null && score >= thresholds.gold) {
    return 'gold'
  }

  if (allQuartetsFound) {
    return 'silver'
  }

  if (score >= thresholds.bronze) {
    return 'bronze'
  }

  return 'none'
}

export type QuartetPath = {
  word: string
  tileIds: number[]
  signature: string
}

export type ExactQuartetPuzzleValidation =
  | {
      ok: true
      quartetWords: string[]
      quartetPaths: QuartetPath[]
    }
  | {
      ok: false
      quartetWords: string[]
      quartetPaths: QuartetPath[]
      targetQuartetWords: string[]
      targetQuartetPaths: QuartetPath[]
      extraQuartetWords: string[]
      extraQuartetPaths: QuartetPath[]
      missingTargetQuartetWords: string[]
      missingTargetQuartetPaths: QuartetPath[]
      reason: string
    }

const sortQuartetPaths = (left: QuartetPath, right: QuartetPath) =>
  left.word.localeCompare(right.word) || left.signature.localeCompare(right.signature)

export const getFourTileWordPaths = (puzzle: TilePuzzle): QuartetPath[] => {
  const puzzleWordSet = new Set(puzzle.words.map((word) => word.word))
  const paths: QuartetPath[] = []

  const search = (prefix: string, usedTileIds: Set<number>, tileIds: number[]) => {
    if (tileIds.length === MAX_TILES_PER_WORD) {
      if (puzzleWordSet.has(prefix)) {
        paths.push({ word: prefix, tileIds: [...tileIds], signature: pathSignature(tileIds) })
      }
      return
    }

    for (let tileId = 0; tileId < puzzle.tiles.length; tileId += 1) {
      if (usedTileIds.has(tileId)) {
        continue
      }

      usedTileIds.add(tileId)
      search(prefix + normalize(puzzle.tiles[tileId]), usedTileIds, [...tileIds, tileId])
      usedTileIds.delete(tileId)
    }
  }

  search('', new Set<number>(), [])
  return paths.sort(sortQuartetPaths)
}

export const getFourTileWords = (puzzle: TilePuzzle) => getFourTileWordPaths(puzzle).map((path) => path.word)

export const validateExactQuartetPuzzle = (
  puzzle: TilePuzzle,
  targetQuartetWords: string[],
): ExactQuartetPuzzleValidation => {
  const quartetPaths = getFourTileWordPaths(puzzle)
  const quartetWords = quartetPaths.map((path) => path.word)
  const targetWords = [...new Set(targetQuartetWords.map(normalize).filter(Boolean))].sort((left, right) =>
    left.localeCompare(right),
  )
  const targetWordSet = new Set(targetWords)
  const targetQuartetPaths = puzzle.words
    .filter((word) => word.isQuartet && word.tileIds.length === MAX_TILES_PER_WORD && targetWordSet.has(word.word))
    .map((word) => ({ word: word.word, tileIds: [...word.tileIds], signature: pathSignature(word.tileIds) }))
    .sort(sortQuartetPaths)
  const quartetPathSignatures = new Set(quartetPaths.map((path) => path.signature))
  const targetPathSignatures = new Set(targetQuartetPaths.map((path) => path.signature))
  const targetPathWords = new Set(targetQuartetPaths.map((path) => path.word))
  const extraQuartetPaths = quartetPaths.filter((path) => !targetPathSignatures.has(path.signature))
  const missingTargetQuartetPaths = targetQuartetPaths.filter((path) => !quartetPathSignatures.has(path.signature))
  const missingTargetQuartetWords = [
    ...targetWords.filter((word) => !targetPathWords.has(word)),
    ...missingTargetQuartetPaths.map((path) => path.word),
  ]
  const duplicateTargetPathCount = targetQuartetPaths.length - targetPathSignatures.size

  if (
    quartetPaths.length === QUARTILE_COMPLETION_COUNT &&
    targetWords.length === QUARTILE_COMPLETION_COUNT &&
    targetQuartetPaths.length === QUARTILE_COMPLETION_COUNT &&
    duplicateTargetPathCount === 0 &&
    extraQuartetPaths.length === 0 &&
    missingTargetQuartetWords.length === 0
  ) {
    return { ok: true, quartetWords, quartetPaths }
  }

  return {
    ok: false,
    quartetWords,
    quartetPaths,
    targetQuartetWords: targetWords,
    targetQuartetPaths,
    extraQuartetWords: extraQuartetPaths.map((path) => path.word),
    extraQuartetPaths,
    missingTargetQuartetWords,
    missingTargetQuartetPaths,
    reason: 'Expected exactly 5 target quartet paths and no extra four-tile paths.',
  }
}

export const buildPuzzleFromQuartets = ({
  seed,
  title,
  quartets,
  dictionary,
}: QuartetPuzzleInput): TilePuzzle => {
  const sourceTiles = quartets.flat()
  const shuffledSourceTileIds = shuffleWithSeed(sourceTiles.map((_, index) => index), seed)
  const tiles = shuffledSourceTileIds.map((sourceTileId) => sourceTiles[sourceTileId])
  const shuffledTileIdBySourceTileId = new Map(
    shuffledSourceTileIds.map((sourceTileId, shuffledTileId) => [sourceTileId, shuffledTileId]),
  )
  const targetQuartetWords = new Map(
    quartets.map((quartet, quartetIndex) => {
      const sourceStart = quartetIndex * MAX_TILES_PER_WORD
      const tileIds = quartet.map((_, tileIndex) => {
        const shuffledTileId = shuffledTileIdBySourceTileId.get(sourceStart + tileIndex)
        if (shuffledTileId === undefined) {
          throw new Error(`Could not locate shuffled tile for target quartet ${normalize(quartet.join(''))}.`)
        }

        return shuffledTileId
      })

      return [normalize(quartet.join('')), tileIds]
    }),
  )
  const words = buildCandidateWords(tiles, dictionary).map((word) => ({
    ...word,
    tileIds: targetQuartetWords.get(word.word) ?? word.tileIds,
    isQuartet: targetQuartetWords.has(word.word),
  }))

  return {
    id: seed,
    title,
    tiles,
    words,
  }
}
