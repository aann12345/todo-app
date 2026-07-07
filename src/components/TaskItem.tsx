import { useRef, useState, type ReactNode } from 'react'
import { dueLabel, isOverdue, isoIn, todayISO } from '../lib/dates'
import { recurrenceLabel } from '../lib/recurrence'
import type { Task } from '../types'
import Avatar from './Avatar'

const PRIORITY_RING: Record<number, string> = {
  1: 'border-p1',
  2: 'border-p2',
  3: 'border-p3',
  4: 'border-p4',
}

const SWIPE_THRESHOLD = 72

export default function TaskItem({
  task,
  onToggle,
  onOpen,
  onDelete,
  onQuickDate,
  showList,
  dragHandle,
  big,
}: {
  task: Task
  onToggle: (task: Task) => void
  onOpen: (task: Task) => void
  onDelete?: (task: Task) => void
  onQuickDate?: (task: Task, due: string | null) => void
  showList?: string
  dragHandle?: ReactNode
  big?: boolean
}) {
  const done = Boolean(task.completed_at)
  const overdue = !done && task.due_date && isOverdue(task.due_date)
  const checklistDone = task.checklist?.filter((i) => i.done).length ?? 0
  const checklistTotal = task.checklist?.length ?? 0
  const [dateMenu, setDateMenu] = useState(false)

  // свайп вправо — выполнить, влево — удалить
  const [dx, setDx] = useState(0)
  const start = useRef<{ x: number; y: number } | null>(null)
  const swiping = useRef(false)

  function onTouchStart(e: React.TouchEvent) {
    start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    swiping.current = false
  }
  function onTouchMove(e: React.TouchEvent) {
    if (!start.current) return
    const ddx = e.touches[0].clientX - start.current.x
    const ddy = e.touches[0].clientY - start.current.y
    if (!swiping.current && Math.abs(ddx) > 12 && Math.abs(ddx) > Math.abs(ddy) * 1.5) {
      swiping.current = true
    }
    if (swiping.current) setDx(Math.max(-120, Math.min(120, ddx)))
  }
  function onTouchEnd() {
    if (swiping.current) {
      if (dx > SWIPE_THRESHOLD) onToggle(task)
      else if (dx < -SWIPE_THRESHOLD && onDelete) onDelete(task)
    }
    setDx(0)
    start.current = null
    swiping.current = false
  }

  return (
    <div className="relative overflow-hidden rounded-xl">
      {dx !== 0 && (
        <div
          className={`absolute inset-0 flex items-center rounded-xl px-4 text-sm font-semibold text-white ${
            dx > 0 ? 'justify-start bg-green-600' : 'justify-end bg-p1'
          }`}
        >
          {dx > 0 ? (done ? '↩ Вернуть' : '✓ Выполнить') : 'Удалить'}
        </div>
      )}
      <div
        className={`group flex cursor-pointer items-start gap-3 rounded-xl bg-surface-0 px-3 transition hover:bg-surface-1 ${
          big ? 'py-3.5' : 'py-2.5'
        }`}
        style={dx !== 0 ? { transform: `translateX(${dx}px)` } : undefined}
        onClick={() => onOpen(task)}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {dragHandle}
        <button
          aria-label={done ? 'Вернуть задачу' : 'Выполнить задачу'}
          onClick={(e) => {
            e.stopPropagation()
            e.currentTarget.classList.add('task-check-anim')
            onToggle(task)
          }}
          className={`mt-0.5 flex shrink-0 items-center justify-center rounded-full border-2 transition ${
            big ? 'h-6 w-6' : 'h-5 w-5'
          } ${PRIORITY_RING[task.priority]} ${done ? 'bg-p4 !border-p4' : 'hover:bg-surface-3'}`}
        >
          {done && <span className="text-[11px] leading-none text-white">✓</span>}
        </button>

        <div className="min-w-0 flex-1">
          <p className={`truncate ${big ? 'text-base' : 'text-[15px]'} ${done ? 'text-ink-faint line-through' : ''}`}>
            {task.title}
            {task.quantity && (
              <span className="ml-2 text-xs text-ink-dim">× {task.quantity}</span>
            )}
          </p>
          {(task.due_date || task.recurrence || task.notes || showList || checklistTotal > 0) && (
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink-dim">
              {task.due_date && (
                <button
                  onClick={(e) => {
                    if (!onQuickDate) return
                    e.stopPropagation()
                    setDateMenu((v) => !v)
                  }}
                  className={`${overdue ? 'font-medium text-p1' : ''} ${onQuickDate ? 'rounded hover:bg-surface-2' : ''}`}
                >
                  📅 {dueLabel(task.due_date)}
                </button>
              )}
              {task.recurrence && <span>🔁 {recurrenceLabel(task.recurrence)}</span>}
              {checklistTotal > 0 && (
                <span className={checklistDone === checklistTotal ? 'text-green-500' : ''}>
                  ☑ {checklistDone}/{checklistTotal}
                </span>
              )}
              {task.notes && <span>📝</span>}
              {showList && <span className="text-ink-faint">{showList}</span>}
            </div>
          )}

          {dateMenu && onQuickDate && (
            <div
              className="mt-1.5 flex flex-wrap gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              {(
                [
                  ['Сегодня', todayISO()],
                  ['Завтра', isoIn(1)],
                  ['+7 дней', isoIn(7)],
                  ['Убрать', null],
                ] as const
              ).map(([label, due]) => (
                <button
                  key={label}
                  onClick={() => {
                    onQuickDate(task, due)
                    setDateMenu(false)
                  }}
                  className="rounded-full bg-surface-2 px-2.5 py-1 text-xs text-ink-dim transition hover:bg-surface-3 hover:text-ink"
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {task.assignee_all ? (
          <span
            className="flex h-[22px] shrink-0 items-center rounded-full bg-surface-2 px-2 text-xs text-ink-dim"
            title="Задача для всех"
          >
            👥 Вместе
          </span>
        ) : (
          task.assignee && <Avatar profile={task.assignee} size={22} />
        )}
      </div>
    </div>
  )
}
