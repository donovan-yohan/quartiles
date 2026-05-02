import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

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
    await userEvent.click(screen.getByRole('button', { name: /^flow$/i }))
    await userEvent.click(screen.getByRole('button', { name: /^er$/i }))
    await userEvent.click(screen.getByRole('button', { name: /^s$/i }))
    await userEvent.click(screen.getByRole('button', { name: /submit word/i }))

    expect(screen.getByText(/sunflowers/i)).toBeInTheDocument()
    expect(screen.getByText(/score: 8/i)).toBeInTheDocument()
  })
})
