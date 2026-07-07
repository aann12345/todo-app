import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import TaskItem from './TaskItem'
import type { Task } from '../types'

function Row({
  task,
  onToggle,
  onOpen,
  onDelete,
  onQuickDate,
  showList,
  big,
}: {
  task: Task
  onToggle: (t: Task) => void
  onOpen: (t: Task) => void
  onDelete: (t: Task) => void
  onQuickDate: (t: Task, due: string | null) => void
  showList?: string
  big?: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
    >
      <TaskItem
        task={task}
        onToggle={onToggle}
        onOpen={onOpen}
        onDelete={onDelete}
        onQuickDate={onQuickDate}
        showList={showList}
        big={big}
        dragHandle={
          <button
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
            aria-label="Перетащить"
            className="mt-0.5 shrink-0 cursor-grab touch-none px-0.5 text-ink-faint transition hover:text-ink-dim active:cursor-grabbing"
          >
            ⠿
          </button>
        }
      />
    </div>
  )
}

export default function SortableTaskList({
  tasks,
  onToggle,
  onOpen,
  onDelete,
  onQuickDate,
  onReorder,
  showList,
  big,
}: {
  tasks: Task[]
  onToggle: (t: Task) => void
  onOpen: (t: Task) => void
  onDelete: (t: Task) => void
  onQuickDate: (t: Task, due: string | null) => void
  onReorder: (orderedIds: string[]) => void
  showList?: (id: string) => string
  big?: boolean
}) {
  const sensors = useSensors(
    // небольшая задержка/дистанция, чтобы обычный тап и свайп не запускали перетаскивание
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  )

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const ids = tasks.map((t) => t.id)
    const from = ids.indexOf(active.id as string)
    const to = ids.indexOf(over.id as string)
    onReorder(arrayMove(ids, from, to))
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragEnd={onDragEnd}
    >
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        {tasks.map((t) => (
          <Row
            key={t.id}
            task={t}
            onToggle={onToggle}
            onOpen={onOpen}
            onDelete={onDelete}
            onQuickDate={onQuickDate}
            showList={showList?.(t.list_id)}
            big={big}
          />
        ))}
      </SortableContext>
    </DndContext>
  )
}
