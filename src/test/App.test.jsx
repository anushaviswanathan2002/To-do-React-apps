import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App.jsx'

const STORAGE_KEY = 'to-do-react-apps:tasks'

beforeEach(() => {
  window.localStorage.clear()
})

describe('To-do app', () => {
  it('renders the starter tasks on first load', () => {
    render(<App />)
    expect(screen.getByText('Read the project README')).toBeInTheDocument()
    expect(screen.getByText(/3 items total/)).toBeInTheDocument()
  })

  it('adds a new task from the form', async () => {
    const user = userEvent.setup()
    render(<App />)

    const input = screen.getByPlaceholderText('What needs to be done?')
    await user.type(input, 'Buy milk')
    await user.click(screen.getByRole('button', { name: 'Add task' }))

    expect(screen.getByText('Buy milk')).toBeInTheDocument()
    expect(input).toHaveValue('')
    expect(screen.getByText(/4 items total/)).toBeInTheDocument()
  })

  it('does not add blank tasks', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByPlaceholderText('What needs to be done?'), '   ')
    expect(screen.getByRole('button', { name: 'Add task' })).toBeDisabled()
    expect(screen.getByText(/3 items total/)).toBeInTheDocument()
  })

  it('marks a task as completed', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('checkbox', { name: /Add a new task using the form above/ }))

    const checked = screen.getByRole('checkbox', {
      name: /Add a new task using the form above/,
    })
    expect(checked).toBeChecked()
    expect(screen.getByText(/1 task left to do/)).toBeInTheDocument()
  })

  it('deletes a task', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Delete task: Read the project README' }))

    expect(screen.queryByText('Read the project README')).not.toBeInTheDocument()
    expect(screen.getByText(/2 items total/)).toBeInTheDocument()
  })

  it('edits a task title', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(
      screen.getByRole('button', { name: 'Edit task: Tick a task to mark it as done' }),
    )

    const editInput = screen.getByRole('textbox', { name: /Edit task: Tick a task to mark it as done/ })
    await user.clear(editInput)
    await user.type(editInput, 'Tick a task to mark it as finished{Enter}')

    expect(screen.getByText('Tick a task to mark it as finished')).toBeInTheDocument()
    expect(screen.queryByText('Tick a task to mark it as done')).not.toBeInTheDocument()
  })

  it('discards an edit when cancelled', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(
      screen.getByRole('button', { name: 'Edit task: Tick a task to mark it as done' }),
    )

    const editInput = screen.getByRole('textbox', { name: /Edit task: Tick a task to mark it as done/ })
    await user.clear(editInput)
    await user.type(editInput, 'This should be discarded')
    await user.click(screen.getByRole('button', { name: 'Cancel editing' }))

    expect(screen.getByText('Tick a task to mark it as done')).toBeInTheDocument()
    expect(screen.queryByText('This should be discarded')).not.toBeInTheDocument()
  })

  it('edits a completed task', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Edit task: Read the project README' }))

    const editInput = screen.getByRole('textbox', { name: /Edit task: Read the project README/ })
    await user.clear(editInput)
    await user.type(editInput, 'Read the docs{Enter}')

    expect(screen.getByText('Read the docs')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /Read the docs/ })).toBeChecked()
  })

  it('filters tasks by state', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /completed tasks/ }))
    expect(screen.getByText('Read the project README')).toBeInTheDocument()
    expect(screen.queryByText('Add a new task using the form above')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /active tasks/ }))
    expect(screen.queryByText('Read the project README')).not.toBeInTheDocument()
    expect(screen.getByText('Add a new task using the form above')).toBeInTheDocument()
  })

  it('clears completed tasks', async () => {
    const user = userEvent.setup()
    render(<App />)

    const clearButton = screen.getByRole('button', { name: 'Clear completed' })
    expect(clearButton).toBeEnabled()

    await user.click(clearButton)

    expect(screen.queryByText('Read the project README')).not.toBeInTheDocument()
    expect(screen.getByText(/2 items total/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Clear completed' })).toBeDisabled()
  })

  it('shows an empty state when there are no tasks', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Clear completed' }))
    await user.click(screen.getByRole('button', { name: /completed tasks/ }))

    const list = document.querySelector('.app__panel')
    expect(within(list).getByText('No completed tasks yet.')).toBeInTheDocument()
  })

  it('persists tasks to localStorage', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<App />)

    await user.type(screen.getByPlaceholderText('What needs to be done?'), 'Persisted task')
    await user.click(screen.getByRole('button', { name: 'Add task' }))

    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY))
    expect(stored).toHaveLength(4)
    expect(stored[0].title).toBe('Persisted task')

    unmount()
    render(<App />)
    expect(screen.getByText('Persisted task')).toBeInTheDocument()
  })
})
