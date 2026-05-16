const minimumTileLength = 2
const maximumTileLength = 4
const maxTilesPerWord = 4
const targetQuartetCount = 5
const datePattern = /^\d{4}-\d{2}-\d{2}$/

export const normalize = (value) => value.toLowerCase().replace(/[^a-z]/g, '')

const pathSignature = (tileIds) => tileIds.join(',')
const formatPath = (path, tiles) => `${path.word} [${path.signature}] (${path.tileIds.map((tileId) => tiles[tileId]).join('+')})`

export const validateSourcePuzzle = (sourcePuzzle) => {
  if (!datePattern.test(sourcePuzzle.date)) {
    throw new Error(`Daily puzzle date must be YYYY-MM-DD: ${sourcePuzzle.date}`)
  }

  const quartets = sourcePuzzle.quartets
  if (!Array.isArray(quartets) || quartets.length !== targetQuartetCount || quartets.some((quartet) => quartet.length !== maxTilesPerWord)) {
    throw new Error(`${sourcePuzzle.date}: daily source must contain exactly ${targetQuartetCount} quartets of ${maxTilesPerWord} tiles each.`)
  }

  const normalizedQuartets = quartets.map((quartet) => quartet.map(normalize))
  const tiles = normalizedQuartets.flat()
  const duplicateTiles = tiles.filter((tile, index) => tiles.indexOf(tile) !== index)
  const invalidLengthTiles = tiles.filter((tile) => tile.length < minimumTileLength || tile.length > maximumTileLength)

  if (invalidLengthTiles.length > 0 || duplicateTiles.length > 0) {
    throw new Error(
      `${sourcePuzzle.date}: source tiles must be unique and between ${minimumTileLength} and ${maximumTileLength} letters long. Invalid length: ${[
        ...new Set(invalidLengthTiles),
      ].join(', ') || '(none)'}. Duplicate: ${[...new Set(duplicateTiles)].join(', ') || '(none)'}.`,
    )
  }

  const targetQuartetPaths = normalizedQuartets.map((quartet, quartetIndex) => {
    const tileIds = quartet.map((_, tileIndex) => quartetIndex * maxTilesPerWord + tileIndex)
    return { word: quartet.join(''), tileIds, signature: pathSignature(tileIds) }
  })
  const pathsByWord = new Map()
  for (const path of targetQuartetPaths) {
    pathsByWord.set(path.word, [...(pathsByWord.get(path.word) ?? []), path])
  }
  const duplicateQuartetPaths = [...pathsByWord.values()].filter((paths) => paths.length > 1).flat()

  if (duplicateQuartetPaths.length > 0) {
    throw new Error(
      `${sourcePuzzle.date}: configured quartet words must be unique. Duplicate: ${duplicateQuartetPaths
        .map((path) => formatPath(path, tiles))
        .join('; ')}.`,
    )
  }

  return normalizedQuartets
}
