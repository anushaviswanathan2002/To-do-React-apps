import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { TaskItem } from './TaskItem.jsx'

export function SortableTaskItem(props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.task.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`sortable-task${isDragging ? ' sortable-task--dragging' : ''}`}
    >
      <TaskItem {...props} dragHandleProps={{ ...attributes, ...listeners }} />
    </li>
  )
}
