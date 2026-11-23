import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, it, expect, beforeEach } from 'vitest'
import LibraryApp from '../library/LibraryApp.jsx'
import { setToken } from '../library/api.js'

const json = (data, status = 200) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(data) })

beforeEach(() => { sessionStorage.clear(); setToken(null) })

it('shows login errors from the API', async () => {
  globalThis.fetch = vi.fn(() => json({ error: 'Invalid credentials' }, 401))
  render(<LibraryApp />)
  await userEvent.type(screen.getByLabelText('Email'), 'a@b.com')
  await userEvent.type(screen.getByLabelText('Password'), 'password123')
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Invalid credentials')
})

it('logs in as a member and lists the catalog without staff controls', async () => {
  globalThis.fetch = vi.fn((url) => {
    if (url.startsWith('/api/auth/login')) return json({ token: 't', user: { id: 2, name: 'Mia', role: 'member' } })
    if (url.startsWith('/api/books')) return json({ items: [{ id: 1, title: 'Dune', author: 'Herbert', isbn: '1', category: 'SF', total_copies: 1, available_copies: 0 }], total: 1, pageSize: 10 })
    return json({})
  })
  render(<LibraryApp />)
  await userEvent.type(screen.getByLabelText('Email'), 'a@b.com')
  await userEvent.type(screen.getByLabelText('Password'), 'password123')
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
  expect(await screen.findByText('Dune')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Reserve' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Add book' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Dashboard' })).not.toBeInTheDocument()
})

it('member can use the AI assistant and smart search', async () => {
  globalThis.fetch = vi.fn((url, opts) => {
    if (url.startsWith('/api/auth/login')) return json({ token: 't', user: { id: 2, name: 'Mia', role: 'member' } })
    if (url.startsWith('/api/books')) return json({ items: [], total: 0, pageSize: 10 })
    if (url === '/api/ai/chat') return json({ reply: `You said: ${JSON.parse(opts.body).message}` })
    if (url.startsWith('/api/ai/search')) return json({ items: [{ id: 1, title: 'Dune', author: 'Herbert', available_copies: 2 }] })
    if (url.startsWith('/api/ai/recommendations')) return json({ items: [{ id: 2, title: 'Foundation', author: 'Asimov', available_copies: 1, reason: 'Matches your reading history' }] })
    return json({})
  })
  render(<LibraryApp />)
  await userEvent.type(screen.getByLabelText('Email'), 'a@b.com')
  await userEvent.type(screen.getByLabelText('Password'), 'password123')
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Assistant (AI)' }))
  await userEvent.type(screen.getByLabelText('Message the assistant'), 'hello there')
  await userEvent.click(screen.getByRole('button', { name: 'Send' }))
  expect(await screen.findByText(/You said: hello there/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'AI insights' })).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Discover (AI)' }))
  expect(await screen.findByText('Foundation')).toBeInTheDocument()
  await userEvent.type(screen.getByLabelText('Describe what you want to read'), 'desert')
  await userEvent.click(screen.getByRole('button', { name: 'Search' }))
  expect(await screen.findByText('Dune')).toBeInTheDocument()
})
