import { dueLabel, isOverdue } from '../lib/dates'
import { recurrenceLabel } from '../lib/recurrence'
import type { Task } from '../types'
import Avatar from './Avatar'

const PRIORITY_RING: Record<number, string> = {
  1: 'border-p1',
  2: 'border-p2',
  3: 'border-p3',
  4: 'border-p4',
}

export default function TaskItem({
  task,
  onToggle,
  onOpen,
  showList,
}: {
  task: Task
  onToggle: (task: Task) => void
  onOpen: (task: Task) => void
  showList?: string
}) {
  const done = Boolean(task.completed_at)
  const overdue = !done && task.due_date && isOverdue(task.due_date)

  return (
    <div
      className="group flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5 transition hover:bg-surface-1"
      onClick={() => onOpen(task)}
    >
      <button
        aria-label={done ? 'Вернуть задачу' : 'Выполнить задачу'}
        onClick={(e) => {
          e.stopPropagation()
          e.currentTarget.classList.add('task-check-anim')
          onToggle(task)
        }}
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${
          PRIORITY_RING[task.priority]
        } ${done ? 'bg-p4 !border-p4' : 'hover:bg-surface-3'}`}
      >
        {done && <span className="text-[11px] leading-none text-white">✓</span>}
      </button>

      <div className="min-w-0 flex-1">
        <p className={`truncate text-[15px] ${done ? 'text-ink-faint line-through' : ''}`}>
          {task.title}
        </p>
        {(task.due_date || task.recurrence || task.notes || showList) && (
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink-dim">
            {task.due_date && (
              <span className={overdue ? 'font-medium text-p1' : ''}>
                📅 {dueLabel(task.due_date)}
              </span>
            )}
            {task.recurrence && <span>🔁 {recurrenceLabel(task.recurrence)}</span>}
            {task.notes && <span>📝</span>}
            {showList && <span className="text-ink-faint">{showList}</span>}
          </div>
        )}
      </div>

      {task.assignee && <Avatar profile={task.assignee} size={22} />}
    </div>
  )
}
