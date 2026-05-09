import { memo, type CSSProperties, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Check, Info, Lightbulb, Medal, Share2, Shuffle, Sparkles, X } from 'lucide-react'
import {
  AVAILABLE_DAILY_DATES,
  createDailyPuzzle,
  getAdjacentDailyDate,
  LATEST_DAILY_DATE,
} from './lib/daily'
import {
  calculateScore,
  getMedalAward,
  scoreWord,
  validateGuess,
  type MedalTier,
  type TilePuzzle,
  type PuzzleWord,
} from './lib/puzzle'
import './App.css'

const progressCookiePrefix = 'lexi_tiles_progress_'
const dailyPathPattern = /^\/daily\/(\d{4}-\d{2}-\d{2})\/?$/
export const historyPageSize = 7

type StatusKind = 'info' | 'success' | 'error'

type StatusMessage = {
  text: string
  kind: StatusKind
  celebration?: boolean
}

type MedalDetails = {
  label: string
  className: string
}

const createStatus = (text: string, kind: StatusKind = 'info', celebration = false): StatusMessage => ({
  text,
  kind,
  celebration,
})

type SavedProgress = {
  foundWords: string[]
  tileOrder: number[]
  hintedWords: string[]
  puzzleVersion?: string
}

type AppRoute =
  | {
      kind: 'home'
      page: number
    }
  | {
      kind: 'daily'
      date: string
    }

const progressCookieNameForPuzzle = (puzzle: TilePuzzle) => `${progressCookiePrefix}${puzzle.id}`
const dailyPathForDate = (date: string) => `/daily/${date}`
const resolveAvailableDailyDate = (date: string) => (AVAILABLE_DAILY_DATES.includes(date) ? date : LATEST_DAILY_DATE)
const rebalancedLegacyDailyPuzzleIds = new Set(['2026-04-27', '2026-04-28', '2026-04-29', '2026-05-01', '2026-05-02'])
const progressVersionForPuzzle = (puzzle: TilePuzzle) => {
  const versionSource = [
    puzzle.id,
    puzzle.tiles.join('|'),
    puzzle.words.map((word) => `${word.word}:${word.tileIds.join(',')}`).join('|'),
  ].join('::')
  let checksum = 0

  for (const character of versionSource) {
    checksum = (checksum * 31 + character.charCodeAt(0)) >>> 0
  }

  return checksum.toString(36)
}
const isLegacyProgressUnsafeForPuzzle = (puzzle: TilePuzzle) => rebalancedLegacyDailyPuzzleIds.has(puzzle.id)
const medalDetailsByTier: Record<Exclude<MedalTier, 'none'>, MedalDetails> = {
  bronze: { label: 'Bronze', className: 'medal-badge--bronze' },
  silver: { label: 'Silver', className: 'medal-badge--silver' },
  gold: { label: 'Gold', className: 'medal-badge--gold' },
  platinum: { label: 'Platinum', className: 'medal-badge--platinum' },
}

const readAppRouteFromUrl = (): AppRoute => {
  if (typeof window === 'undefined') {
    return { kind: 'home', page: 1 }
  }

  const dailyDate = window.location.pathname.match(dailyPathPattern)?.[1]
  if (dailyDate) {
    return { kind: 'daily', date: resolveAvailableDailyDate(dailyDate) }
  }

  const requestedPage = Number(new URLSearchParams(window.location.search).get('page') ?? '1')
  return { kind: 'home', page: Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1 }
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

const uniqueKnownWords = (words: unknown, puzzle: TilePuzzle) => {
  const knownWords = new Set(puzzle.words.map((word) => word.word))
  return Array.isArray(words)
    ? [...new Set(words.filter((word): word is string => typeof word === 'string' && knownWords.has(word)))]
    : []
}

const readCookieValue = (name: string) => {
  if (typeof document === 'undefined') {
    return null
  }

  const prefix = `${name}=`
  return (
    document.cookie
      .split('; ')
      .find((cookie) => cookie.startsWith(prefix))
      ?.slice(prefix.length) ?? null
  )
}

const readSavedProgress = (puzzle: TilePuzzle): SavedProgress | null => {
  if (typeof document === 'undefined') {
    return null
  }

  try {
    const rawProgress = readCookieValue(progressCookieNameForPuzzle(puzzle))
    if (!rawProgress) {
      return null
    }

    const parsed = JSON.parse(decodeURIComponent(rawProgress)) as Partial<SavedProgress>
    const currentPuzzleVersion = progressVersionForPuzzle(puzzle)
    if (parsed.puzzleVersion && parsed.puzzleVersion !== currentPuzzleVersion) {
      return null
    }
    if (!parsed.puzzleVersion && isLegacyProgressUnsafeForPuzzle(puzzle)) {
      return null
    }

    const foundWords = uniqueKnownWords(parsed.foundWords, puzzle)
    const tileOrder = isValidTileOrder(parsed.tileOrder, puzzle) ? parsed.tileOrder : defaultTileOrder(puzzle)
    const hintedWords = uniqueKnownWords(parsed.hintedWords, puzzle)

    return { foundWords, tileOrder, hintedWords }
  } catch {
    return null
  }
}

const writeSavedProgress = (puzzle: TilePuzzle, foundWords: string[], tileOrder: number[], hintedWords: string[]) => {
  if (typeof document === 'undefined') {
    return
  }

  const progress = encodeURIComponent(
    JSON.stringify({ foundWords, tileOrder, hintedWords, puzzleVersion: progressVersionForPuzzle(puzzle) }),
  )
  document.cookie = `${progressCookieNameForPuzzle(puzzle)}=${progress}; Max-Age=31536000; Path=/; SameSite=Lax`
}

const formatWord = (word: PuzzleWord) => `${word.word} (${scoreWord(word.tileIds)} pts)`

const writeClipboardText = async (text: string) => {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return
    } catch {
      // Fall through to the textarea copy path for browsers that expose clipboard but deny it.
    }
  }

  const textArea = document.createElement('textarea')
  textArea.value = text
  textArea.setAttribute('readonly', '')
  textArea.style.position = 'fixed'
  textArea.style.opacity = '0'
  document.body.appendChild(textArea)
  textArea.select()

  try {
    if (!document.execCommand('copy')) {
      throw new Error('copy command failed')
    }
  } finally {
    document.body.removeChild(textArea)
  }
}

const medalDetailsForTier = (tier: MedalTier) => (tier === 'none' ? null : medalDetailsByTier[tier])

function MedalBadge({ tier, compact = false }: { tier: MedalTier; compact?: boolean }) {
  const details = medalDetailsForTier(tier)

  if (!details) {
    return null
  }

  return (
    <span className={`medal-badge ${details.className}${compact ? ' medal-badge--compact' : ''}`}>
      <Medal aria-hidden="true" size={compact ? 13 : 15} />
      {details.label}
    </span>
  )
}

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

const orderExhaustedTilesForPostQuartetShuffle = (
  exhaustedTileIds: Set<number>,
  foundQuartets: PuzzleWord[],
  currentOrder: number[],
) => {
  const orderedExhaustedTileIds: number[] = []
  const orderedExhaustedTileIdSet = new Set<number>()

  foundQuartets.forEach((quartet) => {
    if (!quartet.tileIds.every((tileId) => exhaustedTileIds.has(tileId))) {
      return
    }

    quartet.tileIds.forEach((tileId) => {
      if (!orderedExhaustedTileIdSet.has(tileId)) {
        orderedExhaustedTileIdSet.add(tileId)
        orderedExhaustedTileIds.push(tileId)
      }
    })
  })

  currentOrder.forEach((tileId) => {
    if (exhaustedTileIds.has(tileId) && !orderedExhaustedTileIdSet.has(tileId)) {
      orderedExhaustedTileIds.push(tileId)
    }
  })

  return orderedExhaustedTileIds
}

const shuffleUnpinnedTiles = (order: number[], pinnedTileOrder: number[]) => {
  const pinnedTileSet = new Set(pinnedTileOrder)
  const unpinnedOrder = order.filter((tileId) => !pinnedTileSet.has(tileId))

  return [...pinnedTileOrder, ...shuffleOrder(unpinnedOrder)]
}

const shouldReduceTileMotion = () => {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return false
  }

  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

const playFlipAnimations = (firstPositions: Map<number, DOMRect>, tileNodes: Map<number, HTMLButtonElement>) => {
  if (shouldReduceTileMotion()) {
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
  exhausted: boolean
  onClick: (index: number) => void
  registerTileNode: (index: number, node: HTMLButtonElement | null) => void
}

const tileHoloVariation = (tileId: number, label: string): CSSProperties => {
  const labelSeed = [...label].reduce((total, character, characterIndex) => {
    return total + character.charCodeAt(0) * (characterIndex + 3)
  }, tileId * 97)

  return {
    '--tile-holo-x': `${-18 + (labelSeed % 37)}%`,
    '--tile-holo-y': `${-16 + ((labelSeed * 7) % 33)}%`,
    '--tile-holo-hue': `${(labelSeed * 11) % 360}deg`,
  } as CSSProperties
}

const TileButton = memo(function TileButton({
  index,
  label,
  selected,
  foundQuartetTile,
  exhausted,
  onClick,
  registerTileNode,
}: TileButtonProps) {
  const className = `tile${foundQuartetTile ? ' tile--quartet' : ''}${exhausted ? ' tile--exhausted' : ''}${selected ? ' tile--selected' : ''}`
  const holoStyle = useMemo(() => (exhausted ? tileHoloVariation(index, label) : undefined), [exhausted, index, label])
  const buttonRef = useCallback((node: HTMLButtonElement | null) => registerTileNode(index, node), [index, registerTileNode])

  return (
    <button
      ref={buttonRef}
      type="button"
      className={className}
      aria-pressed={selected}
      disabled={exhausted}
      style={holoStyle}
      title={exhausted ? 'No remaining words use this tile' : undefined}
      onClick={() => onClick(index)}
    >
      <span className="tile__label">{label}</span>
    </button>
  )
})

type ControlsProps = {
  selectedCount: number
  onClear: () => void
  onShuffle: () => void
  onSubmit: () => void
  onHint: () => void
  onHelp: () => void
  onShare: () => void
  shareTooltip: string
  showShareChallenge: boolean
}

function Controls({
  selectedCount,
  onClear,
  onShuffle,
  onSubmit,
  onHint,
  onHelp,
  onShare,
  shareTooltip,
  showShareChallenge,
}: ControlsProps) {
  const shareChallengeTooltipId = useId()

  return (
    <div className="controls-layout" role="group" aria-label="Puzzle controls">
      <div className="controls">
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
      <div className="control-icons" role="group" aria-label="Puzzle extras">
        <button type="button" className="control-icon-button" aria-label="How to play" title="How to play" onClick={onHelp}>
          ?
        </button>
        <div className={`share-action${showShareChallenge ? ' share-action--challenge' : ''}`}>
          <button
            type="button"
            className="control-icon-button"
            aria-label="Share your results"
            aria-describedby={showShareChallenge ? shareChallengeTooltipId : undefined}
            title={showShareChallenge ? undefined : shareTooltip}
            onClick={onShare}
          >
            <Share2 aria-hidden="true" size={18} />
          </button>
          {showShareChallenge ? (
            <span id={shareChallengeTooltipId} className="share-action__tooltip" role="tooltip">
              Challenge your friends to beat your platinum run.
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )
}

const createGameForDate = (date: string) => {
  const puzzle = createDailyPuzzle(date)
  const savedProgress = readSavedProgress(puzzle)

  return {
    puzzle,
    foundWords: savedProgress?.foundWords ?? [],
    hintedWords: savedProgress?.hintedWords ?? [],
    tileOrder: savedProgress?.tileOrder ?? defaultTileOrder(puzzle),
  }
}

const buildHistoryEntry = (date: string) => {
  const puzzle = createDailyPuzzle(date)
  const progress = readSavedProgress(puzzle)
  const foundWords = progress?.foundWords ?? []
  const hintedWords = progress?.hintedWords ?? []
  const foundWordSet = new Set(foundWords)
  const quartetWords = puzzle.words.filter((word) => word.isQuartet)
  const foundQuartets = quartetWords.filter((word) => foundWordSet.has(word.word)).length
  const completed = quartetWords.length > 0 && foundQuartets === quartetWords.length

  return {
    date: puzzle.id,
    foundWords,
    totalWords: puzzle.words.length,
    score: calculateScore(puzzle, foundWords),
    medal: getMedalAward(puzzle, foundWords),
    foundQuartets,
    totalQuartets: quartetWords.length,
    completed,
    hintCount: hintedWords.length,
  }
}

function HomePage({ page }: { page: number }) {
  const allDates = useMemo(() => [...AVAILABLE_DAILY_DATES].reverse(), [])
  const pageCount = Math.max(1, Math.ceil(allDates.length / historyPageSize))
  const currentPage = Math.min(page, pageCount)
  const pageDates = allDates.slice((currentPage - 1) * historyPageSize, currentPage * historyPageSize)
  const entries = pageDates.map(buildHistoryEntry)
  const previousPageHref = currentPage <= 2 ? '/' : `/?page=${currentPage - 1}`
  const nextPageHref = `/?page=${currentPage + 1}`

  return (
    <main className="app-shell home-shell">
      <section className="home-hero">
        <p className="mode-label">Daily word puzzle</p>
        <h1>Lexi Tiles</h1>
        <p>
          Find the five target quartets by combining tile fragments into complete words. Shorter words also score, but
          the board is complete when every target quartet has been found.
        </p>
        <a className="home-cta" href={dailyPathForDate(LATEST_DAILY_DATE)}>
          Play today's puzzle
        </a>
      </section>

      <section className="tutorial-panel" aria-labelledby="tutorial-title">
        <h2 id="tutorial-title">How to play</h2>
        <ol>
          <li>Tap fragments in order to spell a word, then submit it.</li>
          <li>Four-fragment target words turn their tiles blue and keep them pinned near the top.</li>
          <li>Use hints when stuck. Each unique hinted word is counted in your puzzle history.</li>
        </ol>
      </section>

      <section className="history-panel" aria-labelledby="history-title">
        <div className="section-title">
          <h2 id="history-title">Recent puzzles</h2>
          <span>
            Page {currentPage}/{pageCount}
          </span>
        </div>
        <div className="history-list">
          {entries.map((entry) => (
            <article
              key={entry.date}
              className="history-entry"
              data-testid="history-entry"
              data-date={entry.date}
            >
              <a href={dailyPathForDate(entry.date)} data-testid={`history-entry-${entry.date}`}>
                <strong>{entry.date}</strong>
                <span>Progress {entry.foundWords.length}/{entry.totalWords}</span>
                <span className="history-score">
                  Score {entry.score}
                  <MedalBadge tier={entry.medal} compact />
                </span>
                <span>
                  Results {entry.foundQuartets}/{entry.totalQuartets} target quartets
                </span>
                <span>Completed {entry.completed ? 'Yes' : 'No'}</span>
                <span>Hints {entry.hintCount}</span>
              </a>
            </article>
          ))}
        </div>
        {pageCount > 1 ? (
          <nav className="history-pagination" aria-label="Puzzle history pages">
            {currentPage > 1 ? <a href={previousPageHref}>Previous page</a> : <span>Previous page</span>}
            {currentPage < pageCount ? <a href={nextPageHref}>Next page</a> : <span>Next page</span>}
          </nav>
        ) : null}
      </section>
    </main>
  )
}

function App() {
  const [initialRoute] = useState<AppRoute>(() => readAppRouteFromUrl())
  const [initialGame] = useState(() => {
    const initialDate = initialRoute.kind === 'daily' ? initialRoute.date : LATEST_DAILY_DATE
    return createGameForDate(initialDate)
  })
  const [route, setRoute] = useState<AppRoute>(initialRoute)
  const [puzzle, setPuzzle] = useState<TilePuzzle>(initialGame.puzzle)
  const [selectedTileIds, setSelectedTileIds] = useState<number[]>([])
  const [foundWords, setFoundWords] = useState<string[]>(initialGame.foundWords)
  const [hintedWords, setHintedWords] = useState<string[]>(initialGame.hintedWords)
  const [message, setMessage] = useState<StatusMessage>(() => createStatus('Ready.'))
  const [tileOrder, setTileOrder] = useState<number[]>(initialGame.tileOrder)
  const [showRemainingLengths, setShowRemainingLengths] = useState(false)
  const [showHowToPlay, setShowHowToPlay] = useState(false)
  const tileNodes = useRef(new Map<number, HTMLButtonElement>())
  const pendingFlipPositions = useRef(new Map<number, DOMRect>())

  const setTileNode = useCallback((tileId: number, node: HTMLButtonElement | null) => {
    if (node) {
      tileNodes.current.set(tileId, node)
      return
    }

    tileNodes.current.delete(tileId)
  }, [])

  const resetForPuzzle = useCallback((nextPuzzle: TilePuzzle, nextMessage: string, restoreProgress = false) => {
    const savedProgress = restoreProgress ? readSavedProgress(nextPuzzle) : null

    setPuzzle(nextPuzzle)
    setSelectedTileIds([])
    setFoundWords(savedProgress?.foundWords ?? [])
    setHintedWords(savedProgress?.hintedWords ?? [])
    setTileOrder(savedProgress?.tileOrder ?? defaultTileOrder(nextPuzzle))
    setMessage(createStatus(nextMessage))
    setShowRemainingLengths(false)
    setShowHowToPlay(false)
  }, [])

  const loadDailyPuzzleByDate = useCallback(
    (date: string, replaceUrl = false) => {
      const nextPuzzle = createDailyPuzzle(date)
      updateDailyUrl(nextPuzzle.id, replaceUrl)
      resetForPuzzle(nextPuzzle, `Daily puzzle loaded for ${nextPuzzle.id}.`, true)
      setRoute({ kind: 'daily', date: nextPuzzle.id })
    },
    [resetForPuzzle],
  )

  useEffect(() => {
    if (route.kind !== 'daily') {
      return
    }

    writeSavedProgress(puzzle, foundWords, tileOrder, hintedWords)
  }, [foundWords, hintedWords, puzzle, route.kind, tileOrder])

  useEffect(() => {
    if (route.kind === 'daily' && window.location.pathname !== dailyPathForDate(route.date)) {
      updateDailyUrl(route.date, true)
    }
  }, [route])

  useEffect(() => {
    const syncRoute = () => {
      const nextRoute = readAppRouteFromUrl()
      setRoute(nextRoute)

      if (nextRoute.kind === 'daily') {
        const nextPuzzle = createDailyPuzzle(nextRoute.date)
        resetForPuzzle(nextPuzzle, `Daily puzzle loaded for ${nextPuzzle.id}.`, true)
        updateDailyUrl(nextRoute.date, true)
      }
    }

    window.addEventListener('popstate', syncRoute)
    return () => window.removeEventListener('popstate', syncRoute)
  }, [resetForPuzzle])

  const foundWordSet = useMemo(() => new Set(foundWords), [foundWords])
  const quartetWords = useMemo(() => puzzle.words.filter((word) => word.isQuartet), [puzzle.words])
  const foundQuartets = useMemo(
    () => foundWords.flatMap((word) => quartetWords.find((candidate) => candidate.word === word) ?? []),
    [foundWords, quartetWords],
  )
  const allQuartetsFound = quartetWords.length > 0 && quartetWords.every((word) => foundWordSet.has(word.word))
  const foundQuartetTileOrder = useMemo(() => foundQuartets.flatMap((quartet) => quartet.tileIds), [foundQuartets])
  const foundQuartetTileIds = useMemo(() => new Set(foundQuartetTileOrder), [foundQuartetTileOrder])
  const exhaustedTileIds = useMemo(() => {
    const remainingTileIds = new Set<number>()

    puzzle.words.forEach((word) => {
      if (foundWordSet.has(word.word)) {
        return
      }

      word.tileIds.forEach((tileId) => remainingTileIds.add(tileId))
    })

    return new Set(puzzle.tiles.flatMap((_, tileId) => (remainingTileIds.has(tileId) ? [] : [tileId])))
  }, [foundWordSet, puzzle.tiles, puzzle.words])
  const pinnedTileOrder = useMemo(
    () => (allQuartetsFound ? [] : foundQuartetTileOrder),
    [allQuartetsFound, foundQuartetTileOrder],
  )
  const displayTileOrder = useMemo(() => moveTilesToTop(tileOrder, pinnedTileOrder), [pinnedTileOrder, tileOrder])
  const selectedWord = selectedTileIds.map((tileId) => puzzle.tiles[tileId]).join('')
  const score = calculateScore(puzzle, foundWords)
  const totalScore = useMemo(
    () =>
      calculateScore(
        puzzle,
        puzzle.words.map((word) => word.word),
      ),
    [puzzle],
  )
  const remaining = puzzle.words.length - foundWords.length
  const medalTier = getMedalAward(puzzle, foundWords)
  const allWordsFound = puzzle.words.length > 0 && puzzle.words.every((word) => foundWordSet.has(word.word))
  const remainingLengthGroups = useMemo(() => {
    const countsByLength = new Map<number, number>()

    puzzle.words.forEach((word) => {
      if (foundWordSet.has(word.word)) {
        return
      }

      countsByLength.set(word.word.length, (countsByLength.get(word.word.length) ?? 0) + 1)
    })

    return [...countsByLength.entries()]
      .sort(([left], [right]) => left - right)
      .map(([length, count]) => ({ length, count }))
  }, [foundWordSet, puzzle.words])

  useEffect(() => {
    if (!showRemainingLengths && !showHowToPlay) {
      return
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowRemainingLengths(false)
        setShowHowToPlay(false)
      }
    }

    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [showHowToPlay, showRemainingLengths])

  useLayoutEffect(() => {
    if (pendingFlipPositions.current.size === 0) {
      return
    }

    playFlipAnimations(pendingFlipPositions.current, tileNodes.current)
    pendingFlipPositions.current.clear()
  }, [displayTileOrder])

  const captureFlipPositions = () => {
    if (shouldReduceTileMotion()) {
      pendingFlipPositions.current.clear()
      return
    }

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
    setTileOrder((current) => {
      const nextPinnedTileOrder = allQuartetsFound
        ? orderExhaustedTilesForPostQuartetShuffle(exhaustedTileIds, foundQuartets, current)
        : pinnedTileOrder

      return shuffleUnpinnedTiles(moveTilesToTop(current, nextPinnedTileOrder), nextPinnedTileOrder)
    })
  }

  const previousDailyDate = getAdjacentDailyDate(puzzle.id, -1)
  const nextDailyDate = getAdjacentDailyDate(puzzle.id, 1)

  const toggleTile = useCallback((tileId: number) => {
    setSelectedTileIds((current) =>
      current.includes(tileId) ? current.filter((selected) => selected !== tileId) : [...current, tileId],
    )
  }, [])

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
    const nextFoundWordSet = new Set(nextFoundWords)
    const nextAllQuartetsFound =
      quartetWords.length > 0 && quartetWords.every((word) => nextFoundWordSet.has(word.word))
    const nextAllWordsFound = puzzle.words.length > 0 && puzzle.words.every((word) => nextFoundWordSet.has(word.word))
    const nextMedal = getMedalAward(puzzle, nextFoundWords)
    const nextMedalDetails = medalDetailsForTier(nextMedal)

    if (result.isQuartet) {
      const nextFoundQuartets = nextFoundWords.flatMap((word) => quartetWords.find((candidate) => candidate.word === word) ?? [])
      const nextFoundQuartetTileOrder = nextFoundQuartets.flatMap((quartet) => quartet.tileIds)
      captureFlipPositions()
      setTileOrder((current) => moveTilesToTop(current, nextFoundQuartetTileOrder))
    }

    setFoundWords(nextFoundWords)
    setSelectedTileIds([])

    if (!allWordsFound && nextAllWordsFound) {
      setMessage(createStatus('Platinum medal! Every word found.', 'success', true))
      return
    }

    if (!allQuartetsFound && nextAllQuartetsFound) {
      setMessage(
        createStatus(`${nextMedalDetails?.label ?? 'Silver'} medal! All ${quartetWords.length} quartets found.`, 'success', true),
      )
      return
    }

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

    setHintedWords((current) => (current.includes(hint.word) ? current : [...current, hint.word]))
    setMessage(createStatus(`Try a ${hint.tileIds.length}-tile word worth ${scoreWord(hint.tileIds)} points: starts with ${hint.word.slice(0, 2)}.`))
  }

  const shareGame = useCallback(async () => {
    const gameUrl = new URL(dailyPathForDate(puzzle.id), window.location.origin).toString()
    const shareText = `Lexi Tiles ${puzzle.id}: ${score}/${totalScore} points, ${foundQuartets.length}/${quartetWords.length} quartets, ${foundWords.length}/${puzzle.words.length} words. Play: ${gameUrl}`

    try {
      await writeClipboardText(shareText)
      setMessage(createStatus('Share text copied. Challenge someone before they pretend this was luck.', 'success'))
    } catch {
      setMessage(createStatus('Could not copy share text. Your browser is being annoying.', 'error'))
    }
  }, [foundQuartets.length, foundWords.length, puzzle.id, puzzle.words.length, quartetWords.length, score, totalScore])

  const shareTooltip = allWordsFound ? 'Challenge your friends to beat your platinum run.' : 'Copy share link and score'

  if (route.kind === 'home') {
    return <HomePage page={route.page} />
  }

  return (
    <main className="app-shell app-shell--daily">
      <section className="date-nav" aria-label="Daily puzzle date">
        <a className="date-nav__home" href="/" aria-label="Home">
          Home
        </a>
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

      <section className="score-strip" aria-label="Game progress">
        <div>
          <span className="score-line">
            Score: {score}
            <MedalBadge tier={medalTier} compact />
          </span>
          <small className="words-left-line">
            {remaining} words left
            <button
              type="button"
              className="words-left-info"
              aria-label="Show remaining word lengths"
              onClick={() => setShowRemainingLengths(true)}
            >
              <Info aria-hidden="true" size={12} />
            </button>
          </small>
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

        <div
          className={`tile-grid${allWordsFound ? ' tile-grid--platinum' : ''}`}
          data-platinum-shine={allWordsFound ? 'true' : undefined}
          data-testid="tile-grid"
        >
          {displayTileOrder.map((tileId) => (
            <TileButton
              key={tileId}
              index={tileId}
              label={puzzle.tiles[tileId]}
              selected={selectedTileIds.includes(tileId)}
              foundQuartetTile={foundQuartetTileIds.has(tileId)}
              exhausted={exhaustedTileIds.has(tileId)}
              onClick={toggleTile}
              registerTileNode={setTileNode}
            />
          ))}
        </div>

        <Controls
          selectedCount={selectedTileIds.length}
          onClear={() => setSelectedTileIds([])}
          onShuffle={shuffleTiles}
          onSubmit={submitWord}
          onHint={showHint}
          onHelp={() => setShowHowToPlay(true)}
          onShare={shareGame}
          shareTooltip={shareTooltip}
          showShareChallenge={allWordsFound}
        />
      </section>

      <section
        className={`status-panel status-panel--${message.kind}${message.celebration ? ' status-panel--celebration' : ''}`}
        role={message.kind === 'error' ? 'alert' : 'status'}
        aria-live={message.kind === 'error' ? 'assertive' : 'polite'}
      >
        {message.celebration ? <Sparkles aria-hidden="true" size={16} /> : null}
        {message.text}
      </section>

      {showHowToPlay ? (
        <div className="word-length-backdrop" role="presentation" onClick={() => setShowHowToPlay(false)}>
          <div
            className="word-length-dialog help-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="how-to-play-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="word-length-dialog__header">
              <h2 id="how-to-play-title">How to play</h2>
              <button type="button" className="word-length-dialog__close" onClick={() => setShowHowToPlay(false)}>
                <X aria-hidden="true" size={16} />
                Close
              </button>
            </div>
            <ol className="help-steps">
              <li>Tap tile fragments in order to build a word, then submit it.</li>
              <li>Longer tile chains score more points: two tiles score 2, three score 4, and four score 8.</li>
              <li>The five four-tile target words are quartets. Finding one turns its tiles blue and pins them near the top.</li>
              <li>Platinum tiles are exhausted tiles: every known word using that tile has already been found.</li>
              <li>Find every word on the board to earn platinum for the whole puzzle.</li>
            </ol>
          </div>
        </div>
      ) : null}

      {showRemainingLengths ? (
        <div
          className="word-length-backdrop"
          role="presentation"
          onClick={() => setShowRemainingLengths(false)}
        >
          <div
            className="word-length-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="word-length-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="word-length-dialog__header">
              <h2 id="word-length-title">Remaining word lengths</h2>
              <button type="button" className="word-length-dialog__close" onClick={() => setShowRemainingLengths(false)}>
                <X aria-hidden="true" size={16} />
                Close
              </button>
            </div>
            {remainingLengthGroups.length > 0 ? (
              <ul className="word-length-list">
                {remainingLengthGroups.map(({ length, count }) => (
                  <li key={length}>
                    {length} letters × {count}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty-state">No words left.</p>
            )}
          </div>
        </div>
      ) : null}

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
