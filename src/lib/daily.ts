import { buildPuzzleFromQuartets, type TilePuzzle, type QuartetPuzzleInput } from './puzzle'

export const BUILT_IN_DICTIONARY = [
  'after',
  'afterglow',
  'black',
  'blackbird',
  'bird',
  'cup',
  'drift',
  'driftwood',
  'glow',
  'sunflower',
  'sunflowers',
  'butter',
  'buttercup',
  'wood',
]

export const DAILY_QUARTETS: QuartetPuzzleInput['quartets'] = [
  ['sun', 'flow', 'er', 's'],
  ['af', 'ter', 'gl', 'ow'],
  ['bl', 'ack', 'bi', 'rd'],
  ['but', 'ter', 'cu', 'p'],
  ['dr', 'ift', 'wo', 'od'],
]

export const todaySeed = (date = new Date()) => date.toISOString().slice(0, 10)

export const createDailyPuzzle = (date = new Date()): TilePuzzle =>
  buildPuzzleFromQuartets({
    seed: todaySeed(date),
    title: 'Daily puzzle',
    quartets: DAILY_QUARTETS,
    dictionary: BUILT_IN_DICTIONARY,
  })

export const createCustomPuzzle = (source: string): TilePuzzle | null => {
  const quartets = source
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/[\s,+/]+/).filter(Boolean))
    .filter((parts): parts is [string, string, string, string] => parts.length === 4)
    .slice(0, 5)

  if (quartets.length === 0) {
    return null
  }

  const customWords = quartets.map((quartet) => quartet.join('').toLowerCase())

  return buildPuzzleFromQuartets({
    seed: `custom-${customWords.join('-')}`,
    title: 'Custom puzzle',
    quartets,
    dictionary: [...BUILT_IN_DICTIONARY, ...customWords],
  })
}
