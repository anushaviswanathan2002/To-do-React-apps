import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers'
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { SortableTaskItem } from './SortableTaskItem.jsx'

export function TaskList({ tasks, onToggle, onRemove, onUpdate, onReorder, filter, today }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  if (tasks.length === 0) {
    const message =
      filter === 'completed'
        ? 'No completed tasks yet.'
        : filter === 'active'
          ? 'Nothing left to do. Nice work!'
          : 'No tasks yet. Add your first one above.'

    return (
      <div className="empty-state">
        <span className="empty-state__icon" aria-hidden="true">
          ✓
        </span>
        <p className="empty-state__message">{message}</p>
      </div>
    )
  }

  const visibleIds = tasks.map((task) => task.id)

  function handleDragEnd(event) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const fromIndex = visibleIds.indexOf(active.id)
    const toIndex = visibleIds.indexOf(over.id)
    if (fromIndex === -1 || toIndex === -1) return

    // Active and completed tasks each stay within their own group, so a drag
    // never has to snap back after the drop.
    const firstCompleted = visibleIds.findIndex((id) =>
      tasks.find((task) => task.id === id)?.completed,
    )
    const activeCount = firstCompleted === -1 ? visibleIds.length : firstCompleted
    const dragged = tasks.find((task) => task.id === active.id)

    let target = toIndex
    if (dragged?.completed) {
      target = Math.max(target, activeCount)
    } else {
      target = Math.min(target, activeCount - 1)
    }

    if (target === fromIndex) return
    onReorder(visibleIds, fromIndex, target)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={visibleIds} strategy={verticalListSortingStrategy}>
        <ul className="task-list">
          {tasks.map((task) => (
            <SortableTaskItem
              key={task.id}
              task={task}
              onToggle={onToggle}
              onRemove={onRemove}
              onUpdate={onUpdate}
              today={today}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}
