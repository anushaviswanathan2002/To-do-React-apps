import { useCallback, useMemo, useState } from 'react'
import { TaskFilters } from './components/TaskFilters.jsx'
import { TaskForm } from './components/TaskForm.jsx'
import { TaskList } from './components/TaskList.jsx'
import { useLocalStorage } from './hooks/useLocalStorage.js'
import { FILTERS, countTasks, createTask, filterTasks } from './utils/tasks.js'

const STORAGE_KEY = 'to-do-react-apps:tasks'

const DEMO_TASKS = [
  { id: 'demo-1', title: 'Read the project README', completed: true, createdAt: 3 },
  { id: 'demo-2', title: 'Add a new task using the form above', completed: false, createdAt: 2 },
  { id: 'demo-3', title: 'Tick a task to mark it as done', completed: false, createdAt: 1 },
]

export default function App() {
  const [tasks, setTasks] = useLocalStorage(STORAGE_KEY, DEMO_TASKS)
  const [filter, setFilter] = useState(FILTERS.all)

  const addTask = useCallback(
    (title) => {
      setTasks((current) => [createTask(title), ...current])
    },
    [setTasks],
  )

  const toggleTask = useCallback(
    (id) => {
      setTasks((current) =>
        current.map((task) => (task.id === id ? { ...task, completed: !task.completed } : task)),
      )
    },
    [setTasks],
  )

  const removeTask = useCallback(
    (id) => {
      setTasks((current) => current.filter((task) => task.id !== id))
    },
    [setTasks],
  )

  const renameTask = useCallback(
    (id, title) => {
      setTasks((current) => current.map((task) => (task.id === id ? { ...task, title } : task)))
    },
    [setTasks],
  )

  const clearCompleted = useCallback(() => {
    setTasks((current) => current.filter((task) => !task.completed))
  }, [setTasks])

  const counts = useMemo(() => countTasks(tasks), [tasks])
  const visibleTasks = useMemo(() => filterTasks(tasks, filter), [tasks, filter])

  return (
    <main className="app">
      <header className="app__header">
        <h1 className="app__title">To-Do</h1>
        <p className="app__subtitle">
          {counts.active === 0 && counts.total > 0
            ? 'All caught up — nothing left to do.'
            : `${counts.active} task${counts.active === 1 ? '' : 's'} left to do.`}
        </p>
      </header>

      <section className="app__panel" aria-label="To-do list">
        <TaskForm onAdd={addTask} />

        <TaskFilters current={filter} counts={counts} onChange={setFilter} />

        <TaskList
          tasks={visibleTasks}
          filter={filter}
          onToggle={toggleTask}
          onRemove={removeTask}
          onRename={renameTask}
        />

        <footer className="app__footer">
          <span className="app__counter">
            {counts.total} item{counts.total === 1 ? '' : 's'} total
          </span>
          <button
            className="app__clear"
            type="button"
            onClick={clearCompleted}
            disabled={counts.completed === 0}
          >
            Clear completed
          </button>
        </footer>
      </section>
    </main>
  )
}
