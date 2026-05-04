import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import wordlistEnglish from 'wordlist-english'

const minimumWordLength = 3
const minimumTileLength = 2
const maximumTileLength = 4
const maxTilesPerWord = 4
const targetQuartetCount = 5
const blockedWords = new Set(['wop', 'wops'])

const dailyPuzzlesPath = fileURLToPath(new URL('../src/data/daily-puzzles.json', import.meta.url))
const outputPath = fileURLToPath(new URL('../src/data/generated-daily-puzzles.ts', import.meta.url))

const normalize = (value) => value.toLowerCase().replace(/[^a-z]/g, '')
const datePattern = /^\d{4}-\d{2}-\d{2}$/
const dailyPuzzles = JSON.parse(readFileSync(dailyPuzzlesPath, 'utf8'))
const sourceWords = wordlistEnglish.english
  .map(normalize)
  .filter((word) => word.length >= minimumWordLength && !blockedWords.has(word))

const validateSourcePuzzle = (sourcePuzzle) => {
  if (!datePattern.test(sourcePuzzle.date)) {
    throw new Error(`Daily puzzle date must be YYYY-MM-DD: ${sourcePuzzle.date}`)
  }

  const quartets = sourcePuzzle.quartets
  if (!Array.isArray(quartets) || quartets.length !== targetQuartetCount || quartets.some((quartet) => quartet.length !== maxTilesPerWord)) {
    throw new Error(`${sourcePuzzle.date}: daily source must contain exactly ${targetQuartetCount} quartets of ${maxTilesPerWord} tiles each.`)
  }

  const tiles = quartets.flat().map(normalize)
  const duplicateTiles = tiles.filter((tile, index) => tiles.indexOf(tile) !== index)
  const invalidLengthTiles = tiles.filter((tile) => tile.length < minimumTileLength || tile.length > maximumTileLength)

  if (invalidLengthTiles.length > 0 || duplicateTiles.length > 0) {
    throw new Error(
      `${sourcePuzzle.date}: source tiles must be unique and between ${minimumTileLength} and ${maximumTileLength} letters long. Invalid length: ${[
        ...new Set(invalidLengthTiles),
      ].join(', ') || '(none)'}. Duplicate: ${[...new Set(duplicateTiles)].join(', ') || '(none)'}.`,
    )
  }

  return quartets.map((quartet) => quartet.map(normalize))
}

const findConstructibleWords = (tiles) => {
  const constructibleWords = new Set()
  const search = (prefix, usedTileIds) => {
    if (prefix.length >= minimumWordLength) {
      constructibleWords.add(prefix)
    }

    if (usedTileIds.size >= maxTilesPerWord) {
      return
    }

    for (let tileId = 0; tileId < tiles.length; tileId += 1) {
      if (usedTileIds.has(tileId)) {
        continue
      }

      usedTileIds.add(tileId)
      search(`${prefix}${tiles[tileId]}`, usedTileIds)
      usedTileIds.delete(tileId)
    }
  }

  search('', new Set())
  return constructibleWords
}

const findFourTileWords = (tiles, generatedWords) => {
  const generatedWordSet = new Set(generatedWords)
  const fourTileWords = new Set()

  const searchFourTiles = (prefix, usedTileIds) => {
    if (usedTileIds.size === maxTilesPerWord) {
      if (generatedWordSet.has(prefix)) {
        fourTileWords.add(prefix)
      }
      return
    }

    for (let tileId = 0; tileId < tiles.length; tileId += 1) {
      if (usedTileIds.has(tileId)) {
        continue
      }

      usedTileIds.add(tileId)
      searchFourTiles(`${prefix}${tiles[tileId]}`, usedTileIds)
      usedTileIds.delete(tileId)
    }
  }

  searchFourTiles('', new Set())
  return [...fourTileWords].sort((left, right) => left.localeCompare(right))
}

const buildGeneratedPuzzle = (sourcePuzzle) => {
  const quartets = validateSourcePuzzle(sourcePuzzle)
  const tiles = quartets.flat()
  const constructibleWords = findConstructibleWords(tiles)
  const requiredQuartets = quartets.map((quartet) => quartet.join(''))
  const generatedWords = [...new Set([...sourceWords, ...requiredQuartets])]
    .filter((word) => constructibleWords.has(word))
    .sort((left, right) => left.localeCompare(right))
  const fourTileWords = findFourTileWords(tiles, generatedWords)
  const requiredQuartetSet = new Set(requiredQuartets)
  const fourTileWordSet = new Set(fourTileWords)
  const extraQuartets = fourTileWords.filter((word) => !requiredQuartetSet.has(word))
  const missingQuartets = requiredQuartets.filter((word) => !fourTileWordSet.has(word))
  const hasExactTargetQuartets =
    fourTileWords.length === requiredQuartets.length && extraQuartets.length === 0 && missingQuartets.length === 0

  if (!hasExactTargetQuartets) {
    throw new Error(
      `${sourcePuzzle.date}: invalid quartet board. Target quartets: ${requiredQuartets.join(', ')}. Valid four-tile words: ${fourTileWords.join(', ')}. Extra: ${extraQuartets.join(', ') || '(none)'}. Missing: ${missingQuartets.join(', ') || '(none)'}.`,
    )
  }

  return {
    date: sourcePuzzle.date,
    quartets,
    words: generatedWords,
  }
}

const generatedPuzzles = [...dailyPuzzles]
  .sort((left, right) => left.date.localeCompare(right.date))
  .map(buildGeneratedPuzzle)

const formattedPuzzles = generatedPuzzles
  .map(
    (puzzle) => `  {
    date: '${puzzle.date}',
    quartets: ${JSON.stringify(puzzle.quartets)},
    words: [${puzzle.words.map((word) => `'${word}'`).join(', ')}],
  },`,
  )
  .join('\n')

const content = `// Generated by scripts/generate-daily-words.mjs from src/data/daily-puzzles.json and the MIT-licensed wordlist-english package, backed by SCOWL.\n// Do not edit by hand; run npm run generate:daily-words.\n// Generation fails unless source tiles are unique, every tile has 2-4 letters, and each board has exactly the five target four-tile words with no extra valid quartets.\n\nexport const DAILY_PUZZLES = [\n${formattedPuzzles}\n] as const\n`

if (process.argv.includes('--check')) {
  const currentContent = existsSync(outputPath) ? readFileSync(outputPath, 'utf8') : ''
  if (currentContent !== content) {
    console.error(`${outputPath} is stale. Run npm run generate:daily-words and commit the result.`)
    process.exit(1)
  }
  console.log(`Daily puzzles are up to date (${generatedPuzzles.length} puzzles).`)
} else {
  writeFileSync(outputPath, content)
  console.log(`Generated ${generatedPuzzles.length} daily puzzles at ${outputPath}`)
}
