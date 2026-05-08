/// <reference types="node" />

import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { createDailyPuzzle, LATEST_DAILY_DATE } from './lib/daily'
import { calculateScore } from './lib/puzzle'

const latestDailyDate = LATEST_DAILY_DATE
const gameplayDailyDate = '2026-05-02'
const appCss = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'App.css'), 'utf8')
const originalClipboard = navigator.clipboard

const progressCookieName = (date: string) => `lexi_tiles_progress_${date}`
const progressVersionForTestPuzzle = (date: string) => {
  const puzzle = createDailyPuzzle(date)
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

const writeProgressCookie = (date: string, progress: unknown, versioned = true) => {
  const progressWithVersion =
    versioned && progress && typeof progress === 'object'
      ? { ...progress, puzzleVersion: progressVersionForTestPuzzle(date) }
      : progress
  document.cookie = `${progressCookieName(date)}=${encodeURIComponent(JSON.stringify(progressWithVersion))}; Path=/; SameSite=Lax`
}

const readProgressCookie = (date: string) => {
  const cookie = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(`${progressCookieName(date)}=`))
    ?.split('=')[1]

  return cookie ? JSON.parse(decodeURIComponent(cookie)) : null
}

const clearCookies = () => {
  document.cookie.split(';').forEach((cookie) => {
    const name = cookie.split('=')[0]?.trim()
    if (name) {
      document.cookie = `${name}=; Max-Age=0; Path=/`
    }
  })
}

const renderDaily = (date = gameplayDailyDate) => {
  window.history.pushState(null, '', `/daily/${date}`)
  return render(<App />)
}

const stubClipboard = () => {
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  })
  return writeText
}

afterEach(() => {
  clearCookies()
  window.history.replaceState(null, '', '/')
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: originalClipboard,
  })
})

describe('Lexi Tiles app', () => {
  const activeTileLabels = () =>
    screen
      .getAllByRole('button')
      .filter((button) => button.classList.contains('tile'))
      .map((button) => button.textContent)

  const submitTiles = async (labels: string[]) => {
    for (const label of labels) {
      await userEvent.click(screen.getByRole('button', { name: new RegExp(`^${label}$`, 'i') }))
    }
    await userEvent.click(screen.getByRole('button', { name: /submit word/i }))
  }

  it('renders a compact daily puzzle without the app header, custom controls, or instructional copy', () => {
    renderDaily()

    expect(screen.queryByRole('heading', { name: /lexi tiles/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /custom/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/how to play/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/build words by tapping/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /hint/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /how to play/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /share your results/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: gameplayDailyDate })).toBeInTheDocument()
  })

  it('opens a how-to-play modal from the question mark control', async () => {
    renderDaily()

    await userEvent.click(screen.getByRole('button', { name: /how to play/i }))

    const dialog = screen.getByRole('dialog', { name: /how to play/i })
    expect(within(dialog).getByText(/five four-tile target words are quartets/i)).toBeInTheDocument()
    expect(within(dialog).getByText(/platinum tiles are exhausted tiles/i)).toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole('button', { name: /close/i }))

    expect(screen.queryByRole('dialog', { name: /how to play/i })).not.toBeInTheDocument()
  })

  it('copies a share link with score, quartet, and word totals', async () => {
    const writeText = stubClipboard()
    const puzzle = createDailyPuzzle(gameplayDailyDate)
    const foundWords = ['where', 'everywhere']
    const totalScore = calculateScore(
      puzzle,
      puzzle.words.map((word) => word.word),
    )
    writeProgressCookie(gameplayDailyDate, {
      foundWords,
      tileOrder: Array.from({ length: 20 }, (_, index) => index),
      hintedWords: [],
    })
    renderDaily()

    await userEvent.click(screen.getByRole('button', { name: /share your results/i }))

    expect(writeText).toHaveBeenCalledWith(
      `Lexi Tiles ${gameplayDailyDate}: 10/${totalScore} points, 1/5 quartets, 2/24 words. Play: http://localhost:3000/daily/${gameplayDailyDate}`,
    )
    expect(screen.getByRole('status')).toHaveTextContent(/share text copied/i)
  })

  it('keeps the puzzle tile grid at four columns for the 20 playable tiles', () => {
    renderDaily()

    expect(screen.getAllByRole('button').filter((button) => button.classList.contains('tile'))).toHaveLength(20)
    expect(appCss).toMatch(/\.tile-grid\s*{[^}]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/)
    expect(appCss).not.toMatch(/\.tile-grid\s*{[^}]*grid-template-columns:\s*repeat\(5,/)
  })

  it('uses solid shared tile and control colors with selected overriding found styling', async () => {
    renderDaily()

    await submitTiles(['eve', 'ry', 'whe', 're'])
    const foundTile = screen.getByRole('button', { name: /^eve$/i })
    expect(foundTile).toHaveClass('tile--quartet')
    expect(foundTile).not.toHaveClass('tile--selected')

    await userEvent.click(foundTile)

    expect(foundTile).toHaveAttribute('aria-pressed', 'true')
    expect(foundTile).toHaveClass('tile--quartet', 'tile--selected')
    expect(appCss).toMatch(/\.tile\s*{[^}]*background:\s*var\(--control-button-bg\)/)
    expect(appCss).toMatch(/\.control-button\s*{[^}]*background:\s*var\(--control-button-bg\)/)
    expect(appCss).toMatch(/\.tile--quartet\s*{[^}]*background:\s*var\(--tile-found-bg\)/)
    expect(appCss).toMatch(/\.tile--selected,\s*\.tile\[aria-pressed='true'\]\s*{[^}]*background:\s*var\(--tile-selected-bg\)/)
    const playableTileBlocks = [
      appCss.match(/\.tile\s*{[^}]*}/)?.[0] ?? '',
      appCss.match(/\.tile--quartet\s*{[^}]*}/)?.[0] ?? '',
      appCss.match(/\.tile--selected,\s*\.tile\[aria-pressed='true'\]\s*{[^}]*}/)?.[0] ?? '',
    ].join('\n')
    expect(playableTileBlocks).not.toMatch(/linear-gradient/)
  })

  it('marks a tile exhausted after the last remaining word using it is found', async () => {
    const puzzle = createDailyPuzzle(gameplayDailyDate)
    const assTileId = puzzle.tiles.indexOf('ass')
    const wordsUsingAss = puzzle.words
      .filter((word) => word.tileIds.includes(assTileId))
      .map((word) => word.word)
      .sort()

    expect(wordsUsingAss).toEqual(['ass', 'associate'])

    writeProgressCookie(gameplayDailyDate, {
      foundWords: ['associate'],
      tileOrder: Array.from({ length: 20 }, (_, index) => index),
      hintedWords: [],
    })
    renderDaily()

    const assTile = screen.getByRole('button', { name: /^ass$/i })
    expect(assTile).not.toHaveClass('tile--exhausted')

    await submitTiles(['ass'])

    expect(assTile).toHaveClass('tile--exhausted')
    expect(assTile).toBeDisabled()
  })

  it('disables exhausted solved quartet tiles without letting them become selected', async () => {
    const puzzle = createDailyPuzzle(gameplayDailyDate)
    const eveTileId = puzzle.tiles.indexOf('eve')
    const wordsUsingEve = puzzle.words
      .filter((word) => word.tileIds.includes(eveTileId))
      .map((word) => word.word)
      .sort()

    expect(wordsUsingEve).toEqual(['eve', 'every', 'everywhere', 'reeve'])

    writeProgressCookie(gameplayDailyDate, {
      foundWords: wordsUsingEve.filter((word) => word !== 'everywhere'),
      tileOrder: Array.from({ length: 20 }, (_, index) => index),
      hintedWords: [],
    })
    renderDaily()

    const eveTile = screen.getByRole('button', { name: /^eve$/i })
    expect(eveTile).not.toHaveClass('tile--quartet')
    expect(eveTile).not.toHaveClass('tile--exhausted')

    await submitTiles(['eve', 'ry', 'whe', 're'])

    expect(eveTile).toHaveClass('tile--quartet', 'tile--exhausted')
    expect(eveTile).toBeDisabled()

    await userEvent.click(eveTile)

    expect(eveTile).toHaveAttribute('aria-pressed', 'false')
    expect(eveTile).not.toHaveClass('tile--selected')

    const quartetIndex = appCss.indexOf('.tile--quartet')
    const exhaustedIndex = appCss.indexOf('.tile--exhausted')
    const selectedIndex = appCss.indexOf(".tile--selected,\n.tile[aria-pressed='true']")
    expect(quartetIndex).toBeGreaterThan(-1)
    expect(exhaustedIndex).toBeGreaterThan(quartetIndex)
    expect(selectedIndex).toBeGreaterThan(exhaustedIndex)
    expect(appCss).toMatch(/--platinum-fg:\s*#eefcff/)
    expect(appCss).toMatch(/--platinum-bg:\s*rgba\(60,\s*106,\s*122,\s*0\.55\)/)
    expect(appCss).toMatch(/--platinum-border:\s*rgba\(191,\s*245,\s*255,\s*0\.68\)/)
    expect(appCss).toMatch(/\.tile--exhausted\s*{[^}]*color:\s*var\(--platinum-fg\)/)
    expect(appCss).toMatch(/\.tile--exhausted\s*{[^}]*background:\s*var\(--platinum-bg\)/)
    expect(appCss).toMatch(/\.tile--exhausted\s*{[^}]*border-color:\s*var\(--platinum-border\)/)
    expect(appCss).toMatch(/\.tile--exhausted:disabled\s*{[^}]*opacity:\s*1/)

    const tileStateBlocks = [
      appCss.match(/\.tile\s*{[^}]*}/)?.[0] ?? '',
      appCss.match(/\.tile--quartet\s*{[^}]*}/)?.[0] ?? '',
      appCss.match(/\.tile--exhausted\s*{[^}]*}/)?.[0] ?? '',
      appCss.match(/\.tile--selected,\s*\.tile\[aria-pressed='true'\]\s*{[^}]*}/)?.[0] ?? '',
    ].join('\n')
    expect(tileStateBlocks).not.toMatch(/linear-gradient/)
  })

  it('adds distinct per-tile CSS variables for exhausted holographic variation', () => {
    const allButWhere = [
      'ass',
      'associate',
      'ate',
      'aureate',
      'authority',
      'eve',
      'every',
      'everywhere',
      'exec',
      'executed',
      'his',
      'ocreate',
      'reed',
      'reeve',
      'rete',
      'rite',
      'sop',
      'sophistic',
      'sophisticate',
      'teed',
      'tho',
      'thorite',
      'tic',
    ]
    writeProgressCookie(gameplayDailyDate, {
      foundWords: allButWhere,
      tileOrder: Array.from({ length: 20 }, (_, index) => index),
      hintedWords: [],
    })
    renderDaily()

    const eveTile = screen.getByRole('button', { name: /^eve$/i })
    const exTile = screen.getByRole('button', { name: /^ex$/i })

    expect(eveTile).toHaveClass('tile--exhausted')
    expect(exTile).toHaveClass('tile--exhausted')
    for (const property of ['--tile-holo-x', '--tile-holo-y', '--tile-holo-hue']) {
      expect(eveTile.style.getPropertyValue(property)).not.toBe('')
      expect(exTile.style.getPropertyValue(property)).not.toBe('')
    }
    for (const removedAnimationProperty of [
      '--tile-holo-angle',
      '--tile-holo-delay',
      '--tile-holo-speed',
    ]) {
      expect(eveTile.style.getPropertyValue(removedAnimationProperty)).toBe('')
      expect(exTile.style.getPropertyValue(removedAnimationProperty)).toBe('')
    }
    expect([
      eveTile.style.getPropertyValue('--tile-holo-x'),
      eveTile.style.getPropertyValue('--tile-holo-y'),
      eveTile.style.getPropertyValue('--tile-holo-hue'),
    ]).not.toEqual([
      exTile.style.getPropertyValue('--tile-holo-x'),
      exTile.style.getPropertyValue('--tile-holo-y'),
      exTile.style.getPropertyValue('--tile-holo-hue'),
    ])
  })

  const mobilePlatinumMediaPattern =
    '@media \\(hover: none\\), \\(pointer: coarse\\), \\(max-width: 640px\\), \\(prefers-reduced-motion: reduce\\) \\{[\\s\\S]*?\\.tile--exhausted::before\\s*{[\\s\\S]*?\\n {2}}\\n}'

  it('keeps exhausted tile holographic highlights static without the dark diagonal split', () => {
    const exhaustedBeforeBlock = appCss.match(/\.tile--exhausted::before\s*{[\s\S]*?\n}/)?.[0] ?? ''
    const mobilePlatinumBlock = appCss.match(new RegExp(mobilePlatinumMediaPattern))?.[0] ?? ''

    expect(appCss).toMatch(/\.tile--exhausted::before,\s*\.tile--exhausted::after\s*{[^}]*position:\s*absolute/)
    expect(exhaustedBeforeBlock).toMatch(/radial-gradient/)
    expect(exhaustedBeforeBlock).toMatch(/mix-blend-mode:\s*screen/)
    expect(exhaustedBeforeBlock).toMatch(/transform:\s*translate3d\(var\(--tile-holo-x\), var\(--tile-holo-y\), 0\) scale\(1\.04\)/)
    expect(appCss).toMatch(/\.tile--exhausted::after\s*{[^}]*display:\s*none/)
    expect(mobilePlatinumBlock).toMatch(/\.tile--exhausted\s*{[^}]*radial-gradient/)
    expect(mobilePlatinumBlock.match(/radial-gradient/g)).toHaveLength(3)
    expect(mobilePlatinumBlock).toMatch(/calc\(var\(--tile-holo-hue\) \+ 302deg\)/)
    expect(mobilePlatinumBlock).toMatch(/linear-gradient\(180deg, rgba\(12, 18, 27, 0\.22\), rgba\(13, 19, 28, 0\.34\)\)/)
    expect(mobilePlatinumBlock).toMatch(/\.tile--exhausted::before\s*{[^}]*display:\s*none/)
    expect(mobilePlatinumBlock).not.toMatch(/mix-blend-mode|filter:\s*blur|translate3d/)
    expect(appCss).not.toMatch(/@keyframes\s+tile-holo-drift/)
    expect(appCss).not.toMatch(/background-position/)
    expect(exhaustedBeforeBlock).not.toMatch(/\banimation\b|will-change|linear-gradient|rotate/)

    const nonExhaustedStateBlocks = [
      appCss.match(/\.tile\s*{[^}]*}/)?.[0] ?? '',
      appCss.match(/\.tile--quartet\s*{[^}]*}/)?.[0] ?? '',
      appCss.match(/\.tile--selected,\s*\.tile\[aria-pressed='true'\]\s*{[^}]*}/)?.[0] ?? '',
    ].join('\n')
    expect(nonExhaustedStateBlocks).not.toMatch(/gradient/)
  })

  it('renders the root tutorial with a latest puzzle CTA and 7 recent puzzle entries', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: /lexi tiles/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /how to play/i })).toBeInTheDocument()
    expect(screen.getByText(/find the five target quartets/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /play today's puzzle/i })).toHaveAttribute(
      'href',
      `/daily/${latestDailyDate}`,
    )
    expect(screen.getAllByTestId('history-entry')).toHaveLength(7)
  })

  it('shows cookie-backed progress, score, results, completion, and unique hint count in history', () => {
    writeProgressCookie(gameplayDailyDate, {
      foundWords: ['where', 'everywhere'],
      tileOrder: Array.from({ length: 20 }, (_, index) => index),
      hintedWords: ['everywhere', 'where'],
    })

    render(<App />)

    const gameplayEntry = screen.getByTestId(`history-entry-${gameplayDailyDate}`)
    expect(within(gameplayEntry).getByText('Progress 2/24')).toBeInTheDocument()
    expect(within(gameplayEntry).getByText('Score 10')).toBeInTheDocument()
    expect(within(gameplayEntry).queryByText('Bronze')).not.toBeInTheDocument()
    expect(within(gameplayEntry).getByText('Results 1/5 target quartets')).toBeInTheDocument()
    expect(within(gameplayEntry).getByText('Completed No')).toBeInTheDocument()
    expect(within(gameplayEntry).getByText('Hints 2')).toBeInTheDocument()
  })

  it('does not show a medal next to the game score after only finding where', async () => {
    renderDaily()

    await submitTiles(['whe', 're'])

    const scoreStrip = screen.getByLabelText(/game progress/i)
    expect(within(scoreStrip).getByText(/score: 2/i)).toBeInTheDocument()
    expect(within(scoreStrip).queryByText('Bronze')).not.toBeInTheDocument()
  })

  it('shows the earned bronze medal next to the game score at 15 or more points', () => {
    writeProgressCookie(gameplayDailyDate, {
      foundWords: ['where', 'everywhere', 'executed'],
      tileOrder: Array.from({ length: 20 }, (_, index) => index),
      hintedWords: [],
    })
    renderDaily()

    const scoreStrip = screen.getByLabelText(/game progress/i)
    expect(within(scoreStrip).getByText(/score: 18/i)).toBeInTheDocument()
    expect(within(scoreStrip).getByText('Bronze')).toBeInTheDocument()
  })

  it('persists each hinted word only once in cookies', async () => {
    const dailySession = renderDaily()

    await userEvent.click(screen.getByRole('button', { name: /hint/i }))
    await userEvent.click(screen.getByRole('button', { name: /hint/i }))

    const savedProgress = readProgressCookie(gameplayDailyDate)
    expect(savedProgress.hintedWords).toHaveLength(1)
    expect(savedProgress.hintedWords[0]).toEqual(expect.any(String))

    dailySession.unmount()
    window.history.replaceState(null, '', '/')
    render(<App />)

    const gameplayEntry = screen.getByTestId(`history-entry-${gameplayDailyDate}`)
    expect(within(gameplayEntry).getByText('Hints 1')).toBeInTheDocument()
  })

  it('lets players select tiles and submit a valid word', async () => {
    renderDaily()

    await userEvent.click(screen.getByRole('button', { name: /^eve$/i }))
    await userEvent.click(screen.getByRole('button', { name: /^ry$/i }))
    await userEvent.click(screen.getByRole('button', { name: /^whe$/i }))
    await userEvent.click(screen.getByRole('button', { name: /^re$/i }))
    await userEvent.click(screen.getByRole('button', { name: /submit word/i }))

    expect(screen.getByText(/everywhere/i)).toBeInTheDocument()
    expect(screen.getByText(/score: 8/i)).toBeInTheDocument()
  })

  it('shows an error state for wrong words without adding them to found words', async () => {
    renderDaily()

    await userEvent.click(screen.getByRole('button', { name: /^eve$/i }))
    await userEvent.click(screen.getByRole('button', { name: /^tic$/i }))
    await userEvent.click(screen.getByRole('button', { name: /submit word/i }))

    expect(screen.getByRole('alert')).toHaveTextContent(/not in this puzzle/i)
    expect(screen.getByText(/score: 0/i)).toBeInTheDocument()
    expect(screen.getByText(/found words will collect here/i)).toBeInTheDocument()
  })

  it('tracks already-entered words and does not double score duplicates', async () => {
    renderDaily()

    const submitWhere = async () => {
      await userEvent.click(screen.getByRole('button', { name: /^whe$/i }))
      await userEvent.click(screen.getByRole('button', { name: /^re$/i }))
      await userEvent.click(screen.getByRole('button', { name: /submit word/i }))
    }

    await submitWhere()
    await submitWhere()

    expect(screen.getByRole('alert')).toHaveTextContent(/already on your found list/i)
    expect(screen.getByText(/score: 2/i)).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByRole('listitem')).toHaveTextContent(/where/i)
  })

  it('restores daily progress after navigating away and coming back', async () => {
    const firstSession = renderDaily()

    await userEvent.click(screen.getByRole('button', { name: /^whe$/i }))
    await userEvent.click(screen.getByRole('button', { name: /^re$/i }))
    await userEvent.click(screen.getByRole('button', { name: /submit word/i }))

    expect(screen.getByRole('listitem')).toHaveTextContent(/where/i)
    expect(screen.getByText(/score: 2/i)).toBeInTheDocument()
    expect(readProgressCookie(gameplayDailyDate).puzzleVersion).toBe(progressVersionForTestPuzzle(gameplayDailyDate))

    firstSession.unmount()
    renderDaily()

    expect(screen.getByRole('listitem')).toHaveTextContent(/where/i)
    expect(screen.getByText(/score: 2/i)).toBeInTheDocument()
  })

  it('ignores legacy progress for daily puzzles whose source tiles were rebalanced', () => {
    writeProgressCookie(
      gameplayDailyDate,
      {
        foundWords: ['where', 'everywhere'],
        tileOrder: Array.from({ length: 20 }, (_, index) => index),
        hintedWords: ['where'],
      },
      false,
    )

    renderDaily()

    expect(screen.getByText(/score: 0/i)).toBeInTheDocument()
    expect(screen.getByText(/found words will collect here/i)).toBeInTheDocument()
    expect(screen.queryByText(/where \(2 pts\)/i)).not.toBeInTheDocument()
  })

  it('loads previous daily puzzles from their date URL', () => {
    window.history.pushState(null, '', '/daily/2026-04-26')
    render(<App />)

    expect(screen.getByRole('link', { name: '2026-04-26' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^re$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^qu$/i })).toBeInTheDocument()
  })

  it('falls back to the latest daily puzzle when the requested date is missing', () => {
    window.history.pushState(null, '', '/daily/1999-01-01')
    render(<App />)

    expect(screen.getByRole('link', { name: latestDailyDate })).toBeInTheDocument()
    expect(window.location.pathname).toBe(`/daily/${latestDailyDate}`)
  })

  it('pins found quartet tiles at the top while keeping them usable for other words', async () => {
    renderDaily()

    await submitTiles(['eve', 'ry', 'whe', 're'])

    expect(activeTileLabels().slice(0, 4)).toEqual(['eve', 'ry', 'whe', 're'])
    for (const label of ['eve', 'ry', 'whe', 're']) {
      expect(screen.getByRole('button', { name: new RegExp(`^${label}$`, 'i') })).toHaveClass('tile--quartet')
    }

    await submitTiles(['whe', 're'])

    expect(screen.getByText(/where \(2 pts\)/i)).toBeInTheDocument()
    expect(screen.getByText(/score: 10/i)).toBeInTheDocument()
  })

  it('excludes pinned quartet tiles from shuffle until every quartet is found', async () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0)
    renderDaily()

    await submitTiles(['eve', 'ry', 'whe', 're'])
    const beforeShuffle = activeTileLabels()

    await userEvent.click(screen.getByRole('button', { name: /shuffle/i }))

    const afterShuffle = activeTileLabels()
    expect(random).toHaveBeenCalled()
    expect(afterShuffle.slice(0, 4)).toEqual(['eve', 'ry', 'whe', 're'])
    expect(afterShuffle.slice(4)).not.toEqual(beforeShuffle.slice(4))
    expect([...afterShuffle].sort()).toEqual([...beforeShuffle].sort())
  })

  it('shuffles remaining tiles after all quartets are found while keeping all tiles visible', async () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0)
    renderDaily()

    await submitTiles(['eve', 'ry', 'whe', 're'])
    await submitTiles(['ex', 'ec', 'ut', 'ed'])
    await submitTiles(['au', 'tho', 'ri', 'ty'])
    await submitTiles(['ass', 'oc', 'ia', 'te'])
    await submitTiles(['sop', 'his', 'tic', 'ate'])

    expect(screen.getAllByRole('button').filter((button) => button.classList.contains('tile--quartet'))).toHaveLength(20)
    const beforeShuffle = activeTileLabels()

    await userEvent.click(screen.getByRole('button', { name: /shuffle/i }))

    const afterShuffle = activeTileLabels()
    expect(random).toHaveBeenCalled()
    expect(afterShuffle).not.toEqual(beforeShuffle)
    expect([...afterShuffle].sort()).toEqual([...beforeShuffle].sort())
  })

  it('celebrates exactly when the final quartet is found', async () => {
    writeProgressCookie(gameplayDailyDate, {
      foundWords: ['everywhere', 'executed', 'authority', 'associate'],
      tileOrder: Array.from({ length: 20 }, (_, index) => index),
      hintedWords: [],
    })
    renderDaily()

    expect(screen.queryByText(/all 5 quartets/i)).not.toBeInTheDocument()

    await submitTiles(['sop', 'his', 'tic', 'ate'])

    expect(screen.getByRole('status')).toHaveTextContent(/silver medal/i)
    expect(screen.getByRole('status')).toHaveTextContent(/all 5 quartets/i)
  })

  it('celebrates full completion and adds the platinum shine state to the tile grid', async () => {
    const allButWhere = [
      'ass',
      'associate',
      'ate',
      'aureate',
      'authority',
      'eve',
      'every',
      'everywhere',
      'exec',
      'executed',
      'his',
      'ocreate',
      'reed',
      'reeve',
      'rete',
      'rite',
      'sop',
      'sophistic',
      'sophisticate',
      'teed',
      'tho',
      'thorite',
      'tic',
    ]
    writeProgressCookie(gameplayDailyDate, {
      foundWords: allButWhere,
      tileOrder: Array.from({ length: 20 }, (_, index) => index),
      hintedWords: [],
    })
    renderDaily()

    await submitTiles(['whe', 're'])

    expect(screen.getByRole('status')).toHaveTextContent(/platinum medal/i)
    expect(screen.getByRole('status')).toHaveTextContent(/every word/i)
    expect(screen.getByTestId('tile-grid')).toHaveClass('tile-grid--platinum')
  })

  it('shows a challenge-friends tooltip on share after platinum', async () => {
    const allButWhere = [
      'ass',
      'associate',
      'ate',
      'aureate',
      'authority',
      'eve',
      'every',
      'everywhere',
      'exec',
      'executed',
      'his',
      'ocreate',
      'reed',
      'reeve',
      'rete',
      'rite',
      'sop',
      'sophistic',
      'sophisticate',
      'teed',
      'tho',
      'thorite',
      'tic',
    ]
    writeProgressCookie(gameplayDailyDate, {
      foundWords: allButWhere,
      tileOrder: Array.from({ length: 20 }, (_, index) => index),
      hintedWords: [],
    })
    renderDaily()

    const shareButton = screen.getByRole('button', { name: /share your results/i })
    expect(shareButton).toHaveAttribute('title', 'Copy share link and score')
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()

    await submitTiles(['whe', 're'])

    const platinumShareButton = screen.getByRole('button', { name: /share your results/i })
    const tooltip = screen.getByRole('tooltip')
    expect(platinumShareButton).not.toHaveAttribute('title')
    expect(platinumShareButton).toHaveAttribute('aria-describedby', tooltip.id)
    expect(tooltip).toHaveTextContent('Challenge your friends to beat your platinum run.')
    expect(appCss).toMatch(/\.share-action__tooltip\s*{[\s\S]*position:\s*absolute/)
  })

  it('pins exhausted platinum tiles above remaining playable tiles when shuffling after all quartets are found', async () => {
    const allButWhere = [
      'ass',
      'associate',
      'ate',
      'aureate',
      'authority',
      'eve',
      'every',
      'everywhere',
      'exec',
      'executed',
      'his',
      'ocreate',
      'reed',
      'reeve',
      'rete',
      'rite',
      'sop',
      'sophistic',
      'sophisticate',
      'teed',
      'tho',
      'thorite',
      'tic',
    ]
    const puzzle = createDailyPuzzle(gameplayDailyDate)
    const foundWordSet = new Set(allButWhere)
    const exhaustedTileIds = new Set(
      puzzle.tiles.flatMap((_, tileId) =>
        puzzle.words.some((word) => !foundWordSet.has(word.word) && word.tileIds.includes(tileId)) ? [] : [tileId],
      ),
    )
    const exhaustedQuartetTileIds = puzzle.words
      .filter((word) => word.isQuartet && word.tileIds.every((tileId) => exhaustedTileIds.has(tileId)))
      .flatMap((word) => word.tileIds)
    const exhaustedQuartetTileIdSet = new Set(exhaustedQuartetTileIds)
    const initialTileOrder = Array.from({ length: puzzle.tiles.length }, (_, index) => puzzle.tiles.length - index - 1)
    const expectedPinnedTileIds = [
      ...exhaustedQuartetTileIds,
      ...initialTileOrder.filter((tileId) => exhaustedTileIds.has(tileId) && !exhaustedQuartetTileIdSet.has(tileId)),
    ]
    const expectedPinnedLabels = expectedPinnedTileIds.map((tileId) => puzzle.tiles[tileId])

    expect(exhaustedQuartetTileIds.length).toBeGreaterThanOrEqual(4)
    writeProgressCookie(gameplayDailyDate, {
      foundWords: allButWhere,
      tileOrder: initialTileOrder,
      hintedWords: [],
    })
    renderDaily()

    expect(activeTileLabels().slice(0, expectedPinnedLabels.length)).not.toEqual(expectedPinnedLabels)

    await userEvent.click(screen.getByRole('button', { name: /shuffle/i }))

    const tileButtons = screen.getAllByRole('button').filter((button) => button.classList.contains('tile'))
    expect(tileButtons.map((button) => button.textContent).slice(0, expectedPinnedLabels.length)).toEqual(
      expectedPinnedLabels,
    )
    expect(tileButtons.slice(0, expectedPinnedLabels.length).every((button) => button.classList.contains('tile--exhausted'))).toBe(
      true,
    )
    expect(tileButtons.slice(expectedPinnedLabels.length).every((button) => !button.classList.contains('tile--exhausted'))).toBe(
      true,
    )
  })

  it('opens a words-left overlay grouped by remaining total letter lengths', async () => {
    renderDaily()

    await userEvent.click(screen.getByRole('button', { name: /show remaining word lengths/i }))

    const dialog = screen.getByRole('dialog', { name: /remaining word lengths/i })
    expect(within(dialog).getByText('3 letters × 7')).toBeInTheDocument()
    expect(within(dialog).getByText('4 letters × 5')).toBeInTheDocument()
    expect(within(dialog).getByText('12 letters × 1')).toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole('button', { name: /close/i }))

    expect(screen.queryByRole('dialog', { name: /remaining word lengths/i })).not.toBeInTheDocument()
  })

  it('uses a random tile permutation instead of a fixed rotation when shuffling', async () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0)
    renderDaily()

    const originalOrder = activeTileLabels()
    await userEvent.click(screen.getByRole('button', { name: /shuffle/i }))
    const shuffledOrder = activeTileLabels()

    expect(random).toHaveBeenCalled()
    expect(shuffledOrder).not.toEqual([...originalOrder.slice(3), ...originalOrder.slice(0, 3)])
    expect([...shuffledOrder].sort()).toEqual([...originalOrder].sort())
  })

  it('animates shuffled tiles with FLIP transforms', async () => {
    const animate = vi.fn()
    const originalAnimate = HTMLElement.prototype.animate
    const originalRect = HTMLElement.prototype.getBoundingClientRect

    Object.defineProperty(HTMLElement.prototype, 'animate', {
      configurable: true,
      value: animate,
    })
    HTMLElement.prototype.getBoundingClientRect = function () {
      if (!this.classList.contains('tile') || !this.parentElement) {
        return originalRect.call(this)
      }

      const index = Array.from(this.parentElement.children).indexOf(this)
      return {
        x: index * 100,
        y: 0,
        width: 90,
        height: 52,
        top: 0,
        right: index * 100 + 90,
        bottom: 52,
        left: index * 100,
        toJSON: () => ({}),
      }
    }

    try {
      renderDaily()

      await userEvent.click(screen.getByRole('button', { name: /shuffle/i }))

      expect(animate).toHaveBeenCalled()
      expect(animate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ transform: expect.stringMatching(/^translate\(-?\d+px, -?\d+px\)$/) }),
          expect.objectContaining({ transform: 'translate(0, 0)' }),
        ]),
        expect.objectContaining({ easing: expect.any(String), duration: expect.any(Number) }),
      )
    } finally {
      Object.defineProperty(HTMLElement.prototype, 'animate', {
        configurable: true,
        value: originalAnimate,
      })
      HTMLElement.prototype.getBoundingClientRect = originalRect
    }
  })

  it('keeps FLIP shuffle animations on touch-sized devices', async () => {
    const matchMedia = vi.fn((query: string) => ({
      matches: query === '(pointer: coarse)' || query === '(hover: none)' || query === '(max-width: 640px)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
    const animate = vi.fn()
    const originalAnimate = HTMLElement.prototype.animate
    const originalRect = HTMLElement.prototype.getBoundingClientRect

    vi.stubGlobal('matchMedia', matchMedia)
    Object.defineProperty(HTMLElement.prototype, 'animate', {
      configurable: true,
      value: animate,
    })
    HTMLElement.prototype.getBoundingClientRect = function () {
      if (!this.classList.contains('tile') || !this.parentElement) {
        return originalRect.call(this)
      }

      const index = Array.from(this.parentElement.children).indexOf(this)
      return {
        x: index * 100,
        y: 0,
        width: 90,
        height: 52,
        top: 0,
        right: index * 100 + 90,
        bottom: 52,
        left: index * 100,
        toJSON: () => ({}),
      }
    }

    try {
      renderDaily()

      await userEvent.click(screen.getByRole('button', { name: /shuffle/i }))

      expect(matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)')
      expect(matchMedia).not.toHaveBeenCalledWith('(pointer: coarse)')
      expect(animate).toHaveBeenCalled()
    } finally {
      Object.defineProperty(HTMLElement.prototype, 'animate', {
        configurable: true,
        value: originalAnimate,
      })
      HTMLElement.prototype.getBoundingClientRect = originalRect
    }
  })

  it('keeps FLIP quartet-pinning animations on touch-sized devices', async () => {
    const matchMedia = vi.fn((query: string) => ({
      matches: query === '(pointer: coarse)' || query === '(hover: none)' || query === '(max-width: 640px)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
    const animate = vi.fn()
    const originalAnimate = HTMLElement.prototype.animate
    const originalRect = HTMLElement.prototype.getBoundingClientRect
    const puzzle = createDailyPuzzle(gameplayDailyDate)

    writeProgressCookie(gameplayDailyDate, {
      foundWords: [],
      tileOrder: Array.from({ length: puzzle.tiles.length }, (_, index) => puzzle.tiles.length - index - 1),
      hintedWords: [],
    })
    vi.stubGlobal('matchMedia', matchMedia)
    Object.defineProperty(HTMLElement.prototype, 'animate', {
      configurable: true,
      value: animate,
    })
    HTMLElement.prototype.getBoundingClientRect = function () {
      if (!this.classList.contains('tile') || !this.parentElement) {
        return originalRect.call(this)
      }

      const index = Array.from(this.parentElement.children).indexOf(this)
      return {
        x: index * 100,
        y: 0,
        width: 90,
        height: 52,
        top: 0,
        right: index * 100 + 90,
        bottom: 52,
        left: index * 100,
        toJSON: () => ({}),
      }
    }

    try {
      renderDaily()

      await submitTiles(['eve', 'ry', 'whe', 're'])

      expect(matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)')
      expect(matchMedia).not.toHaveBeenCalledWith('(pointer: coarse)')
      expect(animate).toHaveBeenCalled()
    } finally {
      Object.defineProperty(HTMLElement.prototype, 'animate', {
        configurable: true,
        value: originalAnimate,
      })
      HTMLElement.prototype.getBoundingClientRect = originalRect
    }
  })

  it('skips FLIP layout reads and animations when reduced motion is requested', async () => {
    const matchMedia = vi.fn((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
    const animate = vi.fn()
    const getBoundingClientRect = vi.fn(() => ({
      x: 0,
      y: 0,
      width: 90,
      height: 52,
      top: 0,
      right: 90,
      bottom: 52,
      left: 0,
      toJSON: () => ({}),
    }))
    const originalAnimate = HTMLElement.prototype.animate
    const originalRect = HTMLElement.prototype.getBoundingClientRect

    vi.stubGlobal('matchMedia', matchMedia)
    Object.defineProperty(HTMLElement.prototype, 'animate', {
      configurable: true,
      value: animate,
    })
    HTMLElement.prototype.getBoundingClientRect = getBoundingClientRect

    try {
      renderDaily()

      await userEvent.click(screen.getByRole('button', { name: /shuffle/i }))

      expect(matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)')
      expect(getBoundingClientRect).not.toHaveBeenCalled()
      expect(animate).not.toHaveBeenCalled()
    } finally {
      Object.defineProperty(HTMLElement.prototype, 'animate', {
        configurable: true,
        value: originalAnimate,
      })
      HTMLElement.prototype.getBoundingClientRect = originalRect
    }
  })
})
