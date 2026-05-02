import { afterEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

afterEach(() => {
  localStorage.clear()
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

    await userEvent.click(screen.getByRole('button', { name: /^sun$/i }))
    await userEvent.click(screen.getByRole('button', { name: /^flo$/i }))
    await userEvent.click(screen.getByRole('button', { name: /^we$/i }))
    await userEvent.click(screen.getByRole('button', { name: /^rs$/i }))
    await userEvent.click(screen.getByRole('button', { name: /submit word/i }))

    expect(screen.getByText(/sunflowers/i)).toBeInTheDocument()
    expect(screen.getByText(/score: 8/i)).toBeInTheDocument()
  })

  it('shows an error state for wrong words without adding them to found words', async () => {
    render(<App />)

    await userEvent.click(screen.getByRole('button', { name: /^sun$/i }))
    await userEvent.click(screen.getByRole('button', { name: /^cu$/i }))
    await userEvent.click(screen.getByRole('button', { name: /^rd$/i }))
    await userEvent.click(screen.getByRole('button', { name: /submit word/i }))

    expect(screen.getByRole('alert')).toHaveTextContent(/not in this puzzle/i)
    expect(screen.getByText(/score: 0/i)).toBeInTheDocument()
    expect(screen.getByText(/found words will collect here/i)).toBeInTheDocument()
  })

  it('tracks already-entered words and does not double score duplicates', async () => {
    render(<App />)

    const submitSunflowers = async () => {
      await userEvent.click(screen.getByRole('button', { name: /^sun$/i }))
      await userEvent.click(screen.getByRole('button', { name: /^flo$/i }))
      await userEvent.click(screen.getByRole('button', { name: /^we$/i }))
      await userEvent.click(screen.getByRole('button', { name: /^rs$/i }))
      await userEvent.click(screen.getByRole('button', { name: /submit word/i }))
    }

    await submitSunflowers()
    await submitSunflowers()

    expect(screen.getByRole('alert')).toHaveTextContent(/already on your found list/i)
    expect(screen.getByText(/score: 8/i)).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByRole('listitem')).toHaveTextContent(/sunflowers/i)
  })

  it('restores daily progress after navigating away and coming back', async () => {
    const firstSession = render(<App />)

    await userEvent.click(screen.getByRole('button', { name: /^flo$/i }))
    await userEvent.click(screen.getByRole('button', { name: /^we$/i }))
    await userEvent.click(screen.getByRole('button', { name: /^rs$/i }))
    await userEvent.click(screen.getByRole('button', { name: /submit word/i }))

    expect(screen.getByRole('listitem')).toHaveTextContent(/flowers/i)
    expect(screen.getByText(/score: 4/i)).toBeInTheDocument()

    firstSession.unmount()
    render(<App />)

    expect(screen.getByRole('listitem')).toHaveTextContent(/flowers/i)
    expect(screen.getByText(/score: 4/i)).toBeInTheDocument()
  })
})
