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
    expect(document.querySelector('.toast')).toBeInTheDocument()
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
    expect(document.querySelector('.toast')).not.toBeInTheDocument()
  })

  it('dismisses the undo toast when clicking close', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Delete task: Read the project README' }))
    expect(document.querySelector('.toast')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Dismiss notification' }))
    expect(document.querySelector('.toast')).not.toBeInTheDocument()
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

describe('Task notes', () => {
  it('adds a task with notes and reveals them', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Add details' }))
    await user.type(screen.getByPlaceholderText('What needs to be done?'), 'Write the report')
    await user.type(
      screen.getByRole('textbox', { name: 'Notes' }),
      'Include revenue figures and the Q3 outlook',
    )
    await user.click(screen.getByRole('button', { name: 'Add task' }))

    await user.click(
      screen.getByRole('button', { name: 'Show notes for task: Write the report' }),
    )
    const item = screen.getByText('Write the report').closest('li')
    expect(within(item).getByText('Include revenue figures and the Q3 outlook')).toBeInTheDocument()
  })

  it('hides notes until the notes button is pressed', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Add details' }))
    await user.type(screen.getByPlaceholderText('What needs to be done?'), 'Call the bank')
    await user.type(screen.getByRole('textbox', { name: 'Notes' }), 'Ask about the fee')
    await user.click(screen.getByRole('button', { name: 'Add task' }))

    // Notes are collapsed by default
    expect(screen.queryByText('Ask about the fee')).not.toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: 'Show notes for task: Call the bank' }),
    )
    expect(screen.getByText('Ask about the fee')).toBeInTheDocument()
  })

  it('edits notes inline', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(
      screen.getByRole('button', { name: 'Edit task: Add a new task using the form above' }),
    )

    const notesInput = screen.getByRole('textbox', { name: 'Edit notes' })
    await user.clear(notesInput)
    await user.type(notesInput, 'Updated note')
    await user.click(screen.getByRole('button', { name: 'Save task' }))

    await user.click(
      screen.getByRole('button', { name: 'Show notes for task: Add a new task using the form above' }),
    )
    expect(screen.getByText('Updated note')).toBeInTheDocument()
  })

  it('persists notes to localStorage', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Add details' }))
    await user.type(screen.getByPlaceholderText('What needs to be done?'), 'Persisted notes')
    await user.type(screen.getByRole('textbox', { name: 'Notes' }), 'Keep me')
    await user.click(screen.getByRole('button', { name: 'Add task' }))

    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY))
    expect(stored[0].notes).toBe('Keep me')
  })
})

describe('Due dates and overdue highlighting', () => {
  it('adds a task with a due date and shows the badge', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Add details' }))
    await user.type(screen.getByPlaceholderText('What needs to be done?'), 'Submit taxes')
    await user.type(screen.getByLabelText('Due date'), '2099-03-15')
    await user.click(screen.getByRole('button', { name: 'Add task' }))

    const item = screen.getByText('Submit taxes').closest('li')
    expect(within(item).getByText('15 Mar 2099')).toBeInTheDocument()
  })

  it('highlights an overdue task', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Add details' }))
    await user.type(screen.getByPlaceholderText('What needs to be done?'), 'Overdue task')
    await user.type(screen.getByLabelText('Due date'), '2020-01-01')
    await user.click(screen.getByRole('button', { name: 'Add task' }))

    const item = screen.getByText('Overdue task').closest('.task')
    expect(item).toHaveClass('task--overdue')
    expect(within(item).getByText('Overdue')).toBeInTheDocument()
    expect(screen.getByText(/1 task overdue/)).toBeInTheDocument()
  })

  it('does not highlight a completed overdue task', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Add details' }))
    await user.type(screen.getByPlaceholderText('What needs to be done?'), 'Done in time')
    await user.type(screen.getByLabelText('Due date'), '2020-01-01')
    await user.click(screen.getByRole('button', { name: 'Add task' }))

    await user.click(screen.getByRole('checkbox', { name: /Done in time/ }))

    const item = screen.getByText('Done in time').closest('.task')
    expect(item).not.toHaveClass('task--overdue')
    expect(screen.queryByText(/task overdue/)).not.toBeInTheDocument()
  })

  it('shows Today for a task due today', async () => {
    const user = userEvent.setup()
    render(<App />)

    const today = new Date()
    const value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

    await user.click(screen.getByRole('button', { name: 'Add details' }))
    await user.type(screen.getByPlaceholderText('What needs to be done?'), 'Due today')
    await user.type(screen.getByLabelText('Due date'), value)
    await user.click(screen.getByRole('button', { name: 'Add task' }))

    const item = screen.getByText('Due today').closest('li')
    expect(within(item).getByText('Today')).toBeInTheDocument()
    expect(item).not.toHaveClass('task--overdue')
  })

  it('edits the due date inline', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(
      screen.getByRole('button', { name: 'Edit task: Tick a task to mark it as done' }),
    )

    await user.type(screen.getByLabelText('Change due date'), '2099-06-10')
    await user.click(screen.getByRole('button', { name: 'Save task' }))

    const item = screen.getByText('Tick a task to mark it as done').closest('li')
    expect(within(item).getByText('10 Jun 2099')).toBeInTheDocument()
  })

  it('persists the due date to localStorage', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Add details' }))
    await user.type(screen.getByPlaceholderText('What needs to be done?'), 'Persisted due')
    await user.type(screen.getByLabelText('Due date'), '2099-12-25')
    await user.click(screen.getByRole('button', { name: 'Add task' }))

    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY))
    expect(stored[0].dueDate).toBe('2099-12-25')
  })
})

describe('Reordering', () => {
  function renderedTitles() {
    return Array.from(document.querySelectorAll('.task__title')).map((node) => node.textContent)
  }

  it('moves a completed task to the bottom of the list', async () => {
    const user = userEvent.setup()
    render(<App />)

    // Active tasks come first; the already-completed demo task sits last.
    expect(renderedTitles()[0]).toBe('Tick a task to mark it as done')
    expect(renderedTitles()[2]).toBe('Read the project README')

    await user.click(screen.getByRole('checkbox', { name: /Tick a task to mark it as done/ }))

    const titles = renderedTitles()
    expect(titles[titles.length - 1]).toBe('Tick a task to mark it as done')
    expect(titles[titles.length - 2]).toBe('Read the project README')
  })

  it('moves a reopened task back into the active section', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('checkbox', { name: /Tick a task to mark it as done/ }))
    expect(renderedTitles()[renderedTitles().length - 1]).toBe('Tick a task to mark it as done')

    await user.click(screen.getByRole('checkbox', { name: /Tick a task to mark it as done/ }))

    const titles = renderedTitles()
    expect(titles[titles.length - 1]).toBe('Read the project README')
    expect(titles.indexOf('Tick a task to mark it as done')).toBeLessThan(
      titles.indexOf('Read the project README'),
    )
  })

  it('keeps completed tasks at the bottom of the stored list', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('checkbox', { name: /Tick a task to mark it as done/ }))

    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY))
    const lastTask = stored[stored.length - 1]
    expect(lastTask.title).toBe('Tick a task to mark it as done')
    expect(lastTask.completed).toBe(true)
    expect(lastTask.completedAt).toBeTypeOf('number')
  })

  it('renders a drag handle for each task', () => {
    render(<App />)
    expect(screen.getAllByRole('button', { name: /^Reorder task:/ })).toHaveLength(3)
  })
})
