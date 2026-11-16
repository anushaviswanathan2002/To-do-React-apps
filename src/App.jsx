import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { TaskFilters } from './components/TaskFilters.jsx'
import { TaskForm } from './components/TaskForm.jsx'
import { TaskList } from './components/TaskList.jsx'
import { UndoToast } from './components/UndoToast.jsx'
import { useLocalStorage } from './hooks/useLocalStorage.js'
import { FILTERS, PRIORITIES, countTasks, createTask, filterTasks } from './utils/tasks.js'

const STORAGE_KEY = 'to-do-react-apps:tasks'

const DEMO_TASKS = [
  { id: 'demo-1', title: 'Read the project README', priority: PRIORITIES.low, completed: true, createdAt: 3 },
  { id: 'demo-2', title: 'Add a new task using the form above', priority: PRIORITIES.medium, completed: false, createdAt: 2 },
  { id: 'demo-3', title: 'Tick a task to mark it as done', priority: PRIORITIES.high, completed: false, createdAt: 1 },
]

export default function App() {
  const [tasks, setTasks] = useLocalStorage(STORAGE_KEY, DEMO_TASKS)
  const [filter, setFilter] = useState(FILTERS.all)
  const [undoState, setUndoState] = useState(null)
  const undoTimerRef = useRef(null)

  const clearUndoTimer = useCallback(() => {
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current)
      undoTimerRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => clearUndoTimer()
  }, [clearUndoTimer])

  const scheduleUndoDismiss = useCallback(() => {
    clearUndoTimer()
    undoTimerRef.current = setTimeout(() => {
      setUndoState(null)
    }, 6000)
  }, [clearUndoTimer])

  const addTask = useCallback(
    (title, priority) => {
      setTasks((current) => [createTask(title, priority), ...current])
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
      setTasks((current) => {
        const index = current.findIndex((task) => task.id === id)
        if (index === -1) return current
        const removedTask = current[index]
        setUndoState({
          type: 'single',
          task: removedTask,
          index,
          message: `Deleted "${removedTask.title}"`,
        })
        scheduleUndoDismiss()
        return current.filter((task) => task.id !== id)
      })
    },
    [setTasks, scheduleUndoDismiss],
  )

  const updateTask = useCallback(
    (id, updates) => {
      setTasks((current) =>
        current.map((task) => (task.id === id ? { ...task, ...updates } : task)),
      )
    },
    [setTasks],
  )

  const clearCompleted = useCallback(() => {
    setTasks((current) => {
      const completedTasks = current.filter((task) => task.completed)
      if (completedTasks.length === 0) return current
      setUndoState({
        type: 'bulk',
        tasks: current,
        message: `Cleared ${completedTasks.length} completed task${completedTasks.length === 1 ? '' : 's'}`,
      })
      scheduleUndoDismiss()
      return current.filter((task) => !task.completed)
    })
  }, [setTasks, scheduleUndoDismiss])

  const handleUndo = useCallback(() => {
    if (!undoState) return
    clearUndoTimer()
    if (undoState.type === 'single') {
      setTasks((current) => {
        // If already restored, don't duplicate
        if (current.some((t) => t.id === undoState.task.id)) return current
        const next = [...current]
        const targetIndex = Math.min(undoState.index, next.length)
        next.splice(targetIndex, 0, undoState.task)
        return next
      })
    } else if (undoState.type === 'bulk') {
      setTasks(undoState.tasks)
    }
    setUndoState(null)
  }, [undoState, clearUndoTimer, setTasks])

  const handleDismissUndo = useCallback(() => {
    clearUndoTimer()
    setUndoState(null)
  }, [clearUndoTimer])

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
          onUpdate={updateTask}
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

      {undoState && (
        <UndoToast
          message={undoState.message}
          onUndo={handleUndo}
          onDismiss={handleDismissUndo}
        />
      )}
    </main>
  )
}
