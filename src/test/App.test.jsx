import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App.jsx'

const STORAGE_KEY = 'to-do-react-apps:tasks'

beforeEach(() => {
  window.localStorage.clear()
})

describe('To-do app', () => {
  it('renders the starter tasks on first load with priorities', () => {
    render(<App />)
    expect(screen.getByText('Read the project README')).toBeInTheDocument()
    expect(screen.getByText(/3 items total/)).toBeInTheDocument()

    // Priority badges rendered
    expect(screen.getByText('low')).toBeInTheDocument()
    expect(screen.getByText('medium')).toBeInTheDocument()
    expect(screen.getByText('high')).toBeInTheDocument()
  })

  it('adds a new task with default medium priority', async () => {
    const user = userEvent.setup()
    render(<App />)

    const input = screen.getByPlaceholderText('What needs to be done?')
    await user.type(input, 'Buy milk')
    await user.click(screen.getByRole('button', { name: 'Add task' }))

    expect(screen.getByText('Buy milk')).toBeInTheDocument()
    expect(input).toHaveValue('')
    expect(screen.getByText(/4 items total/)).toBeInTheDocument()
  })

  it('adds a new task with selected high priority', async () => {
    const user = userEvent.setup()
    render(<App />)

    const input = screen.getByPlaceholderText('What needs to be done?')
    const prioritySelect = screen.getByRole('combobox', { name: 'Priority' })

    await user.type(input, 'Critical bug fix')
    await user.selectOptions(prioritySelect, 'high')
    await user.click(screen.getByRole('button', { name: 'Add task' }))

    const taskItem = screen.getByText('Critical bug fix').closest('li')
    expect(within(taskItem).getByText('high')).toBeInTheDocument()
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

  it('deletes a task and shows undo toast', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Delete task: Read the project README' }))

    expect(screen.queryByText('Read the project README')).not.toBeInTheDocument()
    expect(screen.getByText(/2 items total/)).toBeInTheDocument()

    // Undo toast should appear
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText('Deleted "Read the project README"')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument()
  })

  it('restores a deleted task when clicking Undo', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Delete task: Read the project README' }))
    expect(screen.queryByText('Read the project README')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Undo' }))

    expect(screen.getByText('Read the project README')).toBeInTheDocument()
    expect(screen.getByText(/3 items total/)).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('dismisses the undo toast when clicking close', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Delete task: Read the project README' }))
    expect(screen.getByRole('status')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Dismiss notification' }))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('restores multiple cleared tasks when clicking Undo', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Clear completed' }))
    expect(screen.queryByText('Read the project README')).not.toBeInTheDocument()
    expect(screen.getByText('Cleared 1 completed task')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(screen.getByText('Read the project README')).toBeInTheDocument()
    expect(screen.getByText(/3 items total/)).toBeInTheDocument()
  })

  it('edits a task title and priority', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(
      screen.getByRole('button', { name: 'Edit task: Tick a task to mark it as done' }),
    )

    const editInput = screen.getByRole('textbox', { name: /Edit task: Tick a task to mark it as done/ })
    const prioritySelect = screen.getByRole('combobox', { name: 'Change priority' })

    await user.clear(editInput)
    await user.type(editInput, 'Tick a task to mark it as finished')
    await user.selectOptions(prioritySelect, 'low')
    await user.click(screen.getByRole('button', { name: 'Save task' }))

    expect(screen.getByText('Tick a task to mark it as finished')).toBeInTheDocument()
    expect(screen.queryByText('Tick a task to mark it as done')).not.toBeInTheDocument()

    const taskItem = screen.getByText('Tick a task to mark it as finished').closest('li')
    expect(within(taskItem).getByText('low')).toBeInTheDocument()
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

  it('persists tasks with priorities to localStorage', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<App />)

    await user.type(screen.getByPlaceholderText('What needs to be done?'), 'High priority item')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Priority' }), 'high')
    await user.click(screen.getByRole('button', { name: 'Add task' }))

    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY))
    expect(stored).toHaveLength(4)
    expect(stored[0].title).toBe('High priority item')
    expect(stored[0].priority).toBe('high')

    unmount()
    render(<App />)
    expect(screen.getByText('High priority item')).toBeInTheDocument()
    const item = screen.getByText('High priority item').closest('li')
    expect(within(item).getByText('high')).toBeInTheDocument()
  })
})
