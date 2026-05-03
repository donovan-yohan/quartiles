import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

afterEach(() => {
  localStorage.clear()
  window.history.replaceState(null, '', '/')
})

describe('Lexi Tiles app', () => {
  it('renders a mobile-first word tile game with hint and custom puzzle controls', async () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: /lexi tiles/i })).toBeInTheDocument()
    expect(screen.getByText(/daily puzzle/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /hint/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /custom/i })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /hint/i }))
    expect(screen.getByText(/try a/i)).toBeInTheDocument()
  })

  it('lets players select tiles and submit a valid word', async () => {
    render(<App />)

    await userEvent.click(screen.getByRole('button', { name: /^eve$/i }))
    await userEvent.click(screen.getByRole('button', { name: /^ry$/i }))
    await userEvent.click(screen.getByRole('button', { name: /^whe$/i }))
    await userEvent.click(screen.getByRole('button', { name: /^re$/i }))
    await userEvent.click(screen.getByRole('button', { name: /submit word/i }))

    expect(screen.getByText(/everywhere/i)).toBeInTheDocument()
    expect(screen.getByText(/score: 8/i)).toBeInTheDocument()
  })

  it('shows an error state for wrong words without adding them to found words', async () => {
    render(<App />)

    await userEvent.click(screen.getByRole('button', { name: /^eve$/i }))
    await userEvent.click(screen.getByRole('button', { name: /^tic$/i }))
    await userEvent.click(screen.getByRole('button', { name: /submit word/i }))

    expect(screen.getByRole('alert')).toHaveTextContent(/not in this puzzle/i)
    expect(screen.getByText(/score: 0/i)).toBeInTheDocument()
    expect(screen.getByText(/found words will collect here/i)).toBeInTheDocument()
  })

  it('tracks already-entered words and does not double score duplicates', async () => {
    render(<App />)

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
    const firstSession = render(<App />)

    await userEvent.click(screen.getByRole('button', { name: /^whe$/i }))
    await userEvent.click(screen.getByRole('button', { name: /^re$/i }))
    await userEvent.click(screen.getByRole('button', { name: /submit word/i }))

    expect(screen.getByRole('listitem')).toHaveTextContent(/where/i)
    expect(screen.getByText(/score: 2/i)).toBeInTheDocument()

    firstSession.unmount()
    render(<App />)

    expect(screen.getByRole('listitem')).toHaveTextContent(/where/i)
    expect(screen.getByText(/score: 2/i)).toBeInTheDocument()
  })

  it('loads previous daily puzzles from their date URL', () => {
    window.history.pushState(null, '', '/daily/2026-04-26')
    render(<App />)

    expect(screen.getByRole('link', { name: '2026-04-26' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^re$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^qu$/i })).toBeInTheDocument()
  })

  it('locks solved quartet tiles into rows and keeps them out of shuffle', async () => {
    render(<App />)

    await userEvent.click(screen.getByRole('button', { name: /^eve$/i }))
    await userEvent.click(screen.getByRole('button', { name: /^ry$/i }))
    await userEvent.click(screen.getByRole('button', { name: /^whe$/i }))
    await userEvent.click(screen.getByRole('button', { name: /^re$/i }))
    await userEvent.click(screen.getByRole('button', { name: /submit word/i }))

    const solvedQuartet = screen.getByLabelText(/solved quartet: everywhere/i)
    expect(within(solvedQuartet).getByText('eve')).toBeInTheDocument()
    expect(within(solvedQuartet).getByText('ry')).toBeInTheDocument()
    expect(within(solvedQuartet).getByText('whe')).toBeInTheDocument()
    expect(within(solvedQuartet).getByText('re')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^eve$/i })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /shuffle/i }))

    expect(screen.queryByRole('button', { name: /^eve$/i })).not.toBeInTheDocument()
    expect(screen.getByLabelText(/solved quartet: everywhere/i)).toBeInTheDocument()
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
      render(<App />)

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
})
