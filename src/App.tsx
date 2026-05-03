import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Check, Lightbulb, Shuffle, Sparkles, X } from 'lucide-react'
import {
  createCustomPuzzle,
  createDailyPuzzle,
  getAdjacentDailyDate,
  resolveDailyPuzzleData,
  todaySeed,
} from './lib/daily'
import { calculateScore, scoreWord, validateGuess, type TilePuzzle, type PuzzleWord } from './lib/puzzle'
import './App.css'

const customStarter = `eve ry whe re
ex ec ut ed
au tho ri ty
ass oc ia te
sop his tic ate`

const progressStoragePrefix = 'lexi-tiles-progress'
const dailyPathPattern = /^\/daily\/(\d{4}-\d{2}-\d{2})\/?$/

type StatusKind = 'info' | 'success' | 'error'

type StatusMessage = {
  text: string
  kind: StatusKind
}

const createStatus = (text: string, kind: StatusKind = 'info'): StatusMessage => ({ text, kind })

type SavedProgress = {
  foundWords: string[]
  tileOrder: number[]
}

const storageKeyForPuzzle = (puzzle: TilePuzzle) => `${progressStoragePrefix}:${puzzle.id}`
const dailyPathForDate = (date: string) => `/daily/${date}`

const readDailyDateFromUrl = () => {
  if (typeof window === 'undefined') {
    return null
  }

  return window.location.pathname.match(dailyPathPattern)?.[1] ?? null
}

const updateDailyUrl = (date: string, replace = false) => {
  if (typeof window === 'undefined') {
    return
  }

  const path = dailyPathForDate(date)
  if (window.location.pathname === path) {
    return
  }

  const method = replace ? 'replaceState' : 'pushState'
  window.history[method](null, '', path)
}

const defaultTileOrder = (puzzle: TilePuzzle) => puzzle.tiles.map((_, index) => index)

const isValidTileOrder = (tileOrder: unknown, puzzle: TilePuzzle): tileOrder is number[] =>
  Array.isArray(tileOrder) &&
  tileOrder.length === puzzle.tiles.length &&
  new Set(tileOrder).size === puzzle.tiles.length &&
  tileOrder.every((tileId) => Number.isInteger(tileId) && tileId >= 0 && tileId < puzzle.tiles.length)

const readSavedProgress = (puzzle: TilePuzzle): SavedProgress | null => {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const rawProgress = window.localStorage.getItem(storageKeyForPuzzle(puzzle))
    if (!rawProgress) {
      return null
    }

    const parsed = JSON.parse(rawProgress) as Partial<SavedProgress>
    const knownWords = new Set(puzzle.words.map((word) => word.word))
    const foundWords = Array.isArray(parsed.foundWords)
      ? [...new Set(parsed.foundWords.filter((word): word is string => typeof word === 'string' && knownWords.has(word)))]
      : []
    const tileOrder = isValidTileOrder(parsed.tileOrder, puzzle) ? parsed.tileOrder : defaultTileOrder(puzzle)

    return { foundWords, tileOrder }
  } catch {
    return null
  }
}

const writeSavedProgress = (puzzle: TilePuzzle, foundWords: string[], tileOrder: number[]) => {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(storageKeyForPuzzle(puzzle), JSON.stringify({ foundWords, tileOrder }))
}

const formatWord = (word: PuzzleWord) => `${word.word} (${scoreWord(word.tileIds)} pts)`

const nextHint = (words: PuzzleWord[], foundWords: Set<string>) =>
  [...words]
    .filter((word) => !foundWords.has(word.word))
    .sort((first, second) => second.tileIds.length - first.tileIds.length || first.word.localeCompare(second.word))[0]

const shuffleOrder = (order: number[], random = Math.random) => {
  if (order.length < 2) {
    return order
  }

  const shuffled = [...order]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
  }

  if (shuffled.every((tileId, index) => tileId === order[index])) {
    return [...shuffled.slice(1), shuffled[0]]
  }

  return shuffled
}

const moveTilesToTop = (order: number[], topTileIds: number[]) => {
  if (topTileIds.length === 0) {
    return order
  }

  const topTileSet = new Set(topTileIds)
  return [...topTileIds, ...order.filter((tileId) => !topTileSet.has(tileId))]
}

const shuffleUnpinnedTiles = (order: number[], pinnedTileOrder: number[]) => {
  const pinnedTileSet = new Set(pinnedTileOrder)
  const unpinnedOrder = order.filter((tileId) => !pinnedTileSet.has(tileId))

  return [...pinnedTileOrder, ...shuffleOrder(unpinnedOrder)]
}

const shouldReduceMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const playFlipAnimations = (firstPositions: Map<number, DOMRect>, tileNodes: Map<number, HTMLButtonElement>) => {
  if (shouldReduceMotion()) {
    return
  }

  firstPositions.forEach((firstRect, tileId) => {
    const tile = tileNodes.get(tileId)
    if (!tile?.animate) {
      return
    }

    const lastRect = tile.getBoundingClientRect()
    const deltaX = firstRect.left - lastRect.left
    const deltaY = firstRect.top - lastRect.top

    if (deltaX === 0 && deltaY === 0) {
      return
    }

    const animation = tile.animate(
      [{ transform: `translate(${deltaX}px, ${deltaY}px)` }, { transform: 'translate(0, 0)' }],
      { duration: 260, easing: 'cubic-bezier(0.2, 0, 0, 1)', fill: 'both' },
    )
    animation?.addEventListener?.('finish', () => animation.cancel(), { once: true })
  })
}

type TileButtonProps = {
  index: number
  label: string
  selected: boolean
  foundQuartetTile: boolean
  onClick: (index: number) => void
  buttonRef?: (node: HTMLButtonElement | null) => void
}

function TileButton({ index, label, selected, foundQuartetTile, onClick, buttonRef }: TileButtonProps) {
  return (
    <button
      ref={buttonRef}
      type="button"
      className={`tile${foundQuartetTile ? ' tile--quartet' : ''}`}
      aria-pressed={selected}
      onClick={() => onClick(index)}
    >
      {label}
    </button>
  )
}

type ControlsProps = {
  selectedCount: number
  onClear: () => void
  onShuffle: () => void
  onSubmit: () => void
  onHint: () => void
}

function Controls({ selectedCount, onClear, onShuffle, onSubmit, onHint }: ControlsProps) {
  return (
    <div className="controls" aria-label="Puzzle controls">
      <button type="button" className="control-button" onClick={onShuffle}>
        <Shuffle aria-hidden="true" size={18} />
        Shuffle
      </button>
      <button type="button" className="control-button" onClick={onClear} disabled={selectedCount === 0}>
        <X aria-hidden="true" size={18} />
        Clear
      </button>
      <button type="button" className="control-button primary" onClick={onSubmit} disabled={selectedCount === 0}>
        <Check aria-hidden="true" size={18} />
        Submit word
      </button>
      <button type="button" className="control-button hint" onClick={onHint}>
        <Lightbulb aria-hidden="true" size={18} />
        Hint
      </button>
    </div>
  )
}

function App() {
  const [initialGame] = useState(() => {
    const requestedDate = readDailyDateFromUrl() ?? todaySeed()
    const puzzle = createDailyPuzzle(requestedDate)
    updateDailyUrl(puzzle.id, true)
    const savedProgress = readSavedProgress(puzzle)
    return {
      puzzle,
      foundWords: savedProgress?.foundWords ?? [],
      tileOrder: savedProgress?.tileOrder ?? defaultTileOrder(puzzle),
    }
  })
  const [puzzle, setPuzzle] = useState<TilePuzzle>(initialGame.puzzle)
  const [selectedTileIds, setSelectedTileIds] = useState<number[]>([])
  const [foundWords, setFoundWords] = useState<string[]>(initialGame.foundWords)
  const [message, setMessage] = useState<StatusMessage>(() => createStatus('Build words by tapping tiles in order.'))
  const [tileOrder, setTileOrder] = useState<number[]>(initialGame.tileOrder)
  const [customOpen, setCustomOpen] = useState(false)
  const [customSource, setCustomSource] = useState(customStarter)
  const tileNodes = useRef(new Map<number, HTMLButtonElement>())
  const pendingFlipPositions = useRef(new Map<number, DOMRect>())

  const setTileNode = (tileId: number) => (node: HTMLButtonElement | null) => {
    if (node) {
      tileNodes.current.set(tileId, node)
      return
    }

    tileNodes.current.delete(tileId)
  }

  useEffect(() => {
    writeSavedProgress(puzzle, foundWords, tileOrder)
  }, [foundWords, puzzle, tileOrder])

  const foundWordSet = useMemo(() => new Set(foundWords), [foundWords])
  const quartetWords = useMemo(() => puzzle.words.filter((word) => word.isQuartet), [puzzle.words])
  const foundQuartets = useMemo(
    () => foundWords.flatMap((word) => quartetWords.find((candidate) => candidate.word === word) ?? []),
    [foundWords, quartetWords],
  )
  const allQuartetsFound = quartetWords.length > 0 && quartetWords.every((word) => foundWordSet.has(word.word))
  const foundQuartetTileOrder = useMemo(() => foundQuartets.flatMap((quartet) => quartet.tileIds), [foundQuartets])
  const foundQuartetTileIds = useMemo(() => new Set(foundQuartetTileOrder), [foundQuartetTileOrder])
  const pinnedTileOrder = useMemo(
    () => (allQuartetsFound ? [] : foundQuartetTileOrder),
    [allQuartetsFound, foundQuartetTileOrder],
  )
  const displayTileOrder = useMemo(() => moveTilesToTop(tileOrder, pinnedTileOrder), [pinnedTileOrder, tileOrder])
  const selectedWord = selectedTileIds.map((tileId) => puzzle.tiles[tileId]).join('')
  const score = calculateScore(puzzle, foundWords)
  const remaining = puzzle.words.length - foundWords.length

  useLayoutEffect(() => {
    if (pendingFlipPositions.current.size === 0) {
      return
    }

    playFlipAnimations(pendingFlipPositions.current, tileNodes.current)
    pendingFlipPositions.current.clear()
  }, [displayTileOrder])

  const captureFlipPositions = () => {
    pendingFlipPositions.current = new Map(
      displayTileOrder.flatMap((tileId) => {
        const tile = tileNodes.current.get(tileId)
        return tile ? ([[tileId, tile.getBoundingClientRect()]] as const) : []
      }),
    )
  }

  const shuffleTiles = () => {
    if (displayTileOrder.length < 2) {
      return
    }

    captureFlipPositions()
    setTileOrder((current) => shuffleUnpinnedTiles(moveTilesToTop(current, pinnedTileOrder), pinnedTileOrder))
  }

  const resetForPuzzle = (nextPuzzle: TilePuzzle, nextMessage: string, restoreProgress = false) => {
    const savedProgress = restoreProgress ? readSavedProgress(nextPuzzle) : null

    setPuzzle(nextPuzzle)
    setSelectedTileIds([])
    setFoundWords(savedProgress?.foundWords ?? [])
    setTileOrder(savedProgress?.tileOrder ?? defaultTileOrder(nextPuzzle))
    setMessage(createStatus(nextMessage))
  }

  const loadDailyPuzzleByDate = (date: string, replaceUrl = false) => {
    const nextPuzzle = createDailyPuzzle(date)
    updateDailyUrl(nextPuzzle.id, replaceUrl)
    resetForPuzzle(nextPuzzle, `Daily puzzle loaded for ${nextPuzzle.id}.`, true)
    setCustomOpen(false)
  }

  const previousDailyDate = getAdjacentDailyDate(puzzle.id, -1)
  const nextDailyDate = getAdjacentDailyDate(puzzle.id, 1)

  const toggleTile = (tileId: number) => {
    setSelectedTileIds((current) =>
      current.includes(tileId) ? current.filter((selected) => selected !== tileId) : [...current, tileId],
    )
  }

  const submitWord = () => {
    const result = validateGuess(puzzle, selectedTileIds)

    if (!result.ok) {
      setMessage(createStatus(result.reason, 'error'))
      return
    }

    if (foundWordSet.has(result.word)) {
      setMessage(createStatus(`${result.word} is already on your found list.`, 'error'))
      setSelectedTileIds([])
      return
    }

    const nextFoundWords = [...foundWords, result.word]
    const oldScore = calculateScore(puzzle, foundWords)
    const nextScore = calculateScore(puzzle, nextFoundWords)
    const bonusPoints = nextScore - oldScore - result.points

    if (result.isQuartet) {
      const nextFoundQuartets = nextFoundWords.flatMap((word) => quartetWords.find((candidate) => candidate.word === word) ?? [])
      const nextFoundQuartetTileOrder = nextFoundQuartets.flatMap((quartet) => quartet.tileIds)
      captureFlipPositions()
      setTileOrder((current) => moveTilesToTop(current, nextFoundQuartetTileOrder))
    }

    setFoundWords(nextFoundWords)
    setSelectedTileIds([])
    setMessage(
      createStatus(
        bonusPoints > 0
          ? `Nice one — ${result.points} points added, plus ${bonusPoints} quartet bonus points.`
          : `Nice one — ${result.points} points added.`,
        'success',
      ),
    )
  }

  const showHint = () => {
    const hint = nextHint(puzzle.words, foundWordSet)

    if (!hint) {
      setMessage(createStatus('Every known word on this board has been found.'))
      return
    }

    setMessage(createStatus(`Try a ${hint.tileIds.length}-tile word worth ${scoreWord(hint.tileIds)} points: starts with ${hint.word.slice(0, 2)}.`))
  }

  const loadCustomPuzzle = () => {
    const customPuzzle = createCustomPuzzle(customSource)

    if (!customPuzzle) {
      setMessage(createStatus('Custom puzzles need at least one line with four tile parts.', 'error'))
      return
    }

    resetForPuzzle(customPuzzle, 'Custom puzzle loaded.')
    setCustomOpen(false)
  }

  return (
    <main className="app-shell">
      <section className="game-header" aria-labelledby="game-title">
        <div>
          <p className="mode-label">{puzzle.title}</p>
          <h1 id="game-title">Lexi Tiles</h1>
          <p className="intro">Tap word fragments, submit complete words, and chase every quartet on the board.</p>
        </div>
        <button
          type="button"
          className="custom-toggle"
          aria-expanded={customOpen}
          onClick={() => setCustomOpen((open) => !open)}
        >
          <Sparkles aria-hidden="true" size={18} />
          Custom
        </button>
      </section>

      <section className="date-nav" aria-label="Daily puzzle date">
        <button
          type="button"
          className="date-nav__button"
          onClick={() => previousDailyDate && loadDailyPuzzleByDate(previousDailyDate)}
          disabled={!previousDailyDate}
        >
          Previous
        </button>
        <a className="date-nav__date" href={dailyPathForDate(puzzle.id)}>
          {puzzle.id}
        </a>
        <button
          type="button"
          className="date-nav__button"
          onClick={() => nextDailyDate && loadDailyPuzzleByDate(nextDailyDate)}
          disabled={!nextDailyDate}
        >
          Next
        </button>
      </section>

      {customOpen ? (
        <section className="custom-panel" aria-labelledby="custom-title">
          <div>
            <h2 id="custom-title">Custom puzzle</h2>
            <p>Enter up to five lines. Each line needs four tile parts separated by spaces, commas, or plus signs.</p>
          </div>
          <textarea
            value={customSource}
            onChange={(event) => setCustomSource(event.target.value)}
            aria-label="Custom puzzle tile parts"
            rows={5}
          />
          <div className="custom-actions">
            <button type="button" className="control-button primary" onClick={loadCustomPuzzle}>
              Load custom
            </button>
            <button
              type="button"
              className="control-button"
              onClick={() => loadDailyPuzzleByDate(resolveDailyPuzzleData(todaySeed()).date, true)}
            >
              Daily puzzle
            </button>
          </div>
        </section>
      ) : null}

      <section className="score-strip" aria-label="Game progress">
        <div>
          <span>Score: {score}</span>
          <small>{remaining} words left</small>
        </div>
        <div>
          <span>{foundWords.length}</span>
          <small>found</small>
        </div>
        <div>
          <span>{puzzle.words.filter((word) => word.isQuartet).length}</span>
          <small>quartets</small>
        </div>
      </section>

      <section className="board-panel" aria-label="Tile board">
        <div className="current-word" aria-live="polite">
          <span>{selectedWord || 'Select tiles'}</span>
          <small>{selectedTileIds.length > 0 ? `${selectedTileIds.length} selected` : 'No tiles selected'}</small>
        </div>

        <div className="tile-grid">
          {displayTileOrder.map((tileId) => (
            <TileButton
              key={tileId}
              index={tileId}
              label={puzzle.tiles[tileId]}
              selected={selectedTileIds.includes(tileId)}
              foundQuartetTile={foundQuartetTileIds.has(tileId)}
              onClick={toggleTile}
              buttonRef={setTileNode(tileId)}
            />
          ))}
        </div>

        <Controls
          selectedCount={selectedTileIds.length}
          onClear={() => setSelectedTileIds([])}
          onShuffle={shuffleTiles}
          onSubmit={submitWord}
          onHint={showHint}
        />
      </section>

      <section
        className={`status-panel status-panel--${message.kind}`}
        role={message.kind === 'error' ? 'alert' : 'status'}
        aria-live={message.kind === 'error' ? 'assertive' : 'polite'}
      >
        {message.text}
      </section>

      <section className="found-panel" aria-labelledby="found-title">
        <div className="section-title">
          <h2 id="found-title">Found words</h2>
          <span>{foundWords.length}/{puzzle.words.length}</span>
        </div>
        {foundWords.length > 0 ? (
          <ul className="found-list">
            {foundWords.map((word) => {
              const candidate = puzzle.words.find((puzzleWord) => puzzleWord.word === word)
              return <li key={word}>{candidate ? formatWord(candidate) : word}</li>
            })}
          </ul>
        ) : (
          <p className="empty-state">Found words will collect here as you solve the board.</p>
        )}
      </section>
    </main>
  )
}

export default App
