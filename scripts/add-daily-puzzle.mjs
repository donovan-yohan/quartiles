import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import wordlistEnglish from 'wordlist-english'

const dailyPuzzlesPath = fileURLToPath(new URL('../src/data/daily-puzzles.json', import.meta.url))
const minTileLength = 2
const maxTileLength = 4
const maxTilesPerWord = 4
const targetQuartetCount = 5
const maxAttempts = 10000
const datePattern = /^\d{4}-\d{2}-\d{2}$/
const normalize = (word) => word.toLowerCase().replace(/[^a-z]/g, '')
const pathSignature = (tileIds) => tileIds.join(',')
const fullWordSet = new Set(wordlistEnglish.english.map(normalize).filter((word) => word.length >= 3))
const commonWords = [...new Set(wordlistEnglish['english/10'].map(normalize))].filter(
  (word) => word.length >= 8 && word.length <= 13 && /^[a-z]+$/.test(word),
)

const hashSeed = (seed) => {
  let hash = 2166136261
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

const seededRandom = (seed) => {
  let state = hashSeed(seed) || 1
  return () => {
    state = Math.imul(1664525, state) + 1013904223
    return (state >>> 0) / 4294967296
  }
}

const todayInNewYork = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())

const nextDate = (date) => {
  const [year, month, day] = date.split('-').map(Number)
  const next = new Date(Date.UTC(year, month - 1, day + 1))
  return next.toISOString().slice(0, 10)
}

const parseDateArg = () => {
  const dateArg = process.argv.find((arg) => arg.startsWith('--date='))?.slice('--date='.length) ?? 'today'

  if (dateArg === 'today') {
    return { mode: 'single', dates: [todayInNewYork()] }
  }

  if (dateArg === 'catch-up') {
    return { mode: 'catch-up', dates: [] }
  }

  if (!datePattern.test(dateArg)) {
    throw new Error(`--date must be YYYY-MM-DD, today, or catch-up, got ${dateArg}`)
  }

  return { mode: 'single', dates: [dateArg] }
}

const segmentations = (word) => {
  const output = []
  const search = (start, parts) => {
    if (parts.length === maxTilesPerWord) {
      if (start === word.length) {
        output.push([...parts])
      }
      return
    }

    const remainingParts = maxTilesPerWord - parts.length
    for (let end = start + minTileLength; end <= Math.min(word.length, start + maxTileLength); end += 1) {
      const remainingChars = word.length - end
      if (remainingChars < (remainingParts - 1) * minTileLength) {
        continue
      }

      parts.push(word.slice(start, end))
      search(end, parts)
      parts.pop()
    }
  }

  search(0, [])
  return output.filter((parts) => new Set(parts).size === parts.length)
}

const vowels = /[aeiouy]/
const badFragments = new Set(['nf', 'hni', 'rgl', 'kb', 'erc', 'nfl', 'sunf'])
const partScore = (parts) =>
  parts.reduce((score, part) => {
    let value = part.length === 2 ? 2 : 0
    if (!vowels.test(part)) value += 12
    if (/^[bcdfghjklmnpqrstvwxyz]{2,}$/.test(part)) value += 8
    if (badFragments.has(part)) value += 20
    return score + value
  }, 0)

const optionsByWord = new Map(
  commonWords
    .map((word) => [word, segmentations(word).sort((left, right) => partScore(left) - partScore(right)).slice(0, 16)])
    .filter(([, options]) => options.length > 0),
)
const candidateWords = [...optionsByWord.keys()]

const sample = (items, random) => items[Math.floor(random() * items.length)]

const fourTilePathsForBoard = (tiles, requiredWords) => {
  const sourceWords = new Set(fullWordSet)
  requiredWords.forEach((word) => sourceWords.add(word))
  const found = []

  const search = (prefix, usedTileIds, tileIds) => {
    if (tileIds.length === maxTilesPerWord) {
      if (sourceWords.has(prefix)) {
        found.push({ word: prefix, tileIds: [...tileIds], signature: pathSignature(tileIds) })
      }
      return
    }

    for (let tileId = 0; tileId < tiles.length; tileId += 1) {
      if (usedTileIds.has(tileId)) {
        continue
      }

      usedTileIds.add(tileId)
      search(prefix + tiles[tileId], usedTileIds, [...tileIds, tileId])
      usedTileIds.delete(tileId)
    }
  }

  search('', new Set(), [])
  return found.sort((left, right) => left.word.localeCompare(right.word) || left.signature.localeCompare(right.signature))
}

const isExactQuartetBoard = (quartets) => {
  const tiles = quartets.flat()
  const targets = quartets.map((quartet, quartetIndex) => {
    const tileIds = quartet.map((_, tileIndex) => quartetIndex * maxTilesPerWord + tileIndex)
    return { word: quartet.join(''), tileIds, signature: pathSignature(tileIds) }
  })
  const fourTilePaths = fourTilePathsForBoard(
    tiles,
    targets.map((target) => target.word),
  )
  const targetSignatures = new Set(targets.map((target) => target.signature))

  return (
    fourTilePaths.length === targetQuartetCount &&
    fourTilePaths.every((path) => targetSignatures.has(path.signature))
  )
}

const generatePuzzleForDate = (date) => {
  const random = seededRandom(`lexi-tiles:${date}`)
  let best = null

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const selected = []
    const usedWords = new Set()
    const usedTiles = new Set()
    let guard = 0

    while (selected.length < targetQuartetCount && guard < 300) {
      guard += 1
      const word = sample(candidateWords, random)
      if (usedWords.has(word)) continue

      const option = sample(optionsByWord.get(word), random)
      if (option.some((tile) => usedTiles.has(tile))) continue

      selected.push([word, option])
      usedWords.add(word)
      option.forEach((tile) => usedTiles.add(tile))
    }

    if (selected.length !== targetQuartetCount) {
      continue
    }

    const quartets = selected.map(([, option]) => option)
    if (!isExactQuartetBoard(quartets)) {
      continue
    }

    const score = quartets.reduce((total, parts) => total + partScore(parts), 0)
    if (!best || score < best.score) {
      best = { score, quartets, words: selected.map(([word]) => word) }
      if (score <= 45) {
        break
      }
    }
  }

  if (!best) {
    throw new Error(`Could not generate an exact quartet puzzle for ${date} after ${maxAttempts} attempts.`)
  }

  return { date, quartets: best.quartets }
}

const dateSelection = parseDateArg()
const dailyPuzzles = JSON.parse(readFileSync(dailyPuzzlesPath, 'utf8'))
const existingDates = new Set(dailyPuzzles.map((puzzle) => puzzle.date))
const datesToAdd =
  dateSelection.mode === 'catch-up'
    ? (() => {
        const latestDate = [...existingDates].sort((left, right) => left.localeCompare(right)).at(-1)
        if (!latestDate) {
          return [todayInNewYork()]
        }

        const today = todayInNewYork()
        const missingDates = []
        for (let date = nextDate(latestDate); date <= today; date = nextDate(date)) {
          if (!existingDates.has(date)) {
            missingDates.push(date)
          }
        }
        return missingDates
      })()
    : dateSelection.dates.filter((date) => !existingDates.has(date))

if (datesToAdd.length === 0) {
  const requestedDates = dateSelection.mode === 'catch-up' ? `through ${todayInNewYork()}` : dateSelection.dates.join(', ')
  console.log(`No daily puzzles to add for ${requestedDates}.`)
  process.exit(0)
}

const addedPuzzles = []
for (const date of datesToAdd) {
  const puzzle = generatePuzzleForDate(date)
  dailyPuzzles.push(puzzle)
  existingDates.add(date)
  addedPuzzles.push(puzzle)
}

dailyPuzzles.sort((left, right) => left.date.localeCompare(right.date))
writeFileSync(`${dailyPuzzlesPath}`, `${JSON.stringify(dailyPuzzles, null, 2)}\n`)
console.log(
  `Added ${addedPuzzles.length} daily puzzle${addedPuzzles.length === 1 ? '' : 's'}: ${addedPuzzles
    .map((puzzle) => `${puzzle.date} (${puzzle.quartets.map((quartet) => quartet.join('')).join(', ')})`)
    .join('; ')}`,
)
