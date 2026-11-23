import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, it, expect, beforeEach } from 'vitest'
import LibraryApp from '../library/LibraryApp.jsx'

const json = (data, status = 200) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(data) })

beforeEach(() => sessionStorage.clear())

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
