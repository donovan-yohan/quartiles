import { DAILY_PUZZLES } from '../data/generated-daily-puzzles'
import { buildPuzzleFromQuartets, type TilePuzzle, type QuartetPuzzleInput } from './puzzle'

export const AVAILABLE_DAILY_DATES: string[] = DAILY_PUZZLES.map((puzzle) => puzzle.date)
export const LATEST_DAILY_DATE = AVAILABLE_DAILY_DATES[AVAILABLE_DAILY_DATES.length - 1]
export const DATE_ID_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export const todaySeed = (date = new Date()) => date.toISOString().slice(0, 10)

export const normalizeDailyDateId = (date: Date | string = new Date()) => {
  if (date instanceof Date) {
    return todaySeed(date)
  }

  return DATE_ID_PATTERN.test(date) ? date : todaySeed(new Date())
}

export const resolveDailyPuzzleData = (date: Date | string = new Date()) => {
  const requestedDate = normalizeDailyDateId(date)
  return DAILY_PUZZLES.find((puzzle) => puzzle.date === requestedDate) ?? DAILY_PUZZLES[DAILY_PUZZLES.length - 1]
}

export const getAdjacentDailyDate = (date: string, direction: -1 | 1) => {
  const index = AVAILABLE_DAILY_DATES.indexOf(date)
  if (index < 0) {
    return null
  }

  return AVAILABLE_DAILY_DATES[index + direction] ?? null
}

export const createDailyPuzzle = (date: Date | string = new Date()): TilePuzzle => {
  const dailyPuzzle = resolveDailyPuzzleData(date)
  const quartets = dailyPuzzle.quartets.map((quartet) => [...quartet]) as QuartetPuzzleInput['quartets']

  return buildPuzzleFromQuartets({
    seed: dailyPuzzle.date,
    title: 'Daily puzzle',
    quartets,
    dictionary: [...dailyPuzzle.words],
  })
}

export const DAILY_QUARTETS = resolveDailyPuzzleData(LATEST_DAILY_DATE).quartets.map((quartet) => [
  ...quartet,
]) as QuartetPuzzleInput['quartets']
