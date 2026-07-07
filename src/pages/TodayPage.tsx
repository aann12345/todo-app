import { useState } from 'react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { useTasks, useTaskMutations } from '../hooks/useTasks'
import { useLists } from '../hooks/useLists'
import { todayISO } from '../lib/dates'
import TaskItem from '../components/TaskItem'
import TaskEditor from '../components/TaskEditor'
import QuickAdd from '../components/QuickAdd'
import EmptyState from '../components/EmptyState'
import type { Task } from '../types'

export default function TodayPage() {
  const { tasks, isLoading } = useTasks()
  const lists = useLists()
  const { toggleComplete, deleteTask } = useTaskMutations()
  const [editing, setEditing] = useState<Task | null>(null)

  const today = todayISO()
  const listName = (id: string) => {
    const l = lists.find((x) => x.id === id)
    return l ? `${l.emoji ?? ''} ${l.name}`.trim() : ''
  }

  const overdue = tasks.filter((t) => !t.completed_at && t.due_date && t.due_date < today)
  const dueToday = tasks.filter((t) => !t.completed_at && t.due_date === today)
  const doneToday = tasks.filter(
    (t) => t.completed_at && t.completed_at.slice(0, 10) === today,
  )

  const total = overdue.length + dueToday.length + doneToday.length
  const progress = total > 0 ? Math.round((doneToday.length / total) * 100) : 0

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-1 text-2xl font-bold">Сегодня</h1>
      <p className="mb-4 text-sm text-ink-dim">
        {format(new Date(), 'EEEE, d MMMM', { locale: ru })}
      </p>

      {total > 0 && (
        <div className="mb-5">
          <div className="mb-1 flex justify-between text-xs text-ink-dim">
            <span>Выполнено {doneToday.length} из {total}</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-accent transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      <QuickAdd listId={lists[0]?.id} dueDate={today} placeholder="Добавить задачу на сегодня…" />

      {overdue.length > 0 && (
        <section className="mb-5">
          <h2 className="mb-1 px-3 text-sm font-semibold text-p1">Просроченные</h2>
          {overdue.map((t) => (
            <TaskItem
              key={t.id}
              task={t}
              onToggle={(task) => toggleComplete.mutate(task)} onDelete={(task) => deleteTask.mutate(task)}
              onOpen={setEditing}
              showList={listName(t.list_id)}
            />
          ))}
        </section>
      )}

      <section>
        {dueToday.length === 0 && overdue.length === 0 && !isLoading && (
          doneToday.length > 0 ? (
            <p className="px-3 py-8 text-center text-ink-faint">
              На сегодня всё сделано 🎉
            </p>
          ) : (
            <EmptyState
              icon="👋"
              text="Здесь появятся задачи на сегодня"
              hint={
                <>
                  Нажмите оранжевую «+» внизу или строку выше. Попробуйте написать
                  «купить хлеб завтра» — дата подставится сама.
                </>
              }
            />
          )
        )}
        {dueToday.map((t) => (
          <TaskItem
            key={t.id}
            task={t}
            onToggle={(task) => toggleComplete.mutate(task)} onDelete={(task) => deleteTask.mutate(task)}
            onOpen={setEditing}
            showList={listName(t.list_id)}
          />
        ))}
      </section>

      {doneToday.length > 0 && (
        <section className="mt-5 opacity-60">
          <h2 className="mb-1 px-3 text-sm font-semibold text-ink-dim">
            Выполнено сегодня — {doneToday.length}
          </h2>
          {doneToday.map((t) => (
            <TaskItem
              key={t.id}
              task={t}
              onToggle={(task) => toggleComplete.mutate(task)}
              onOpen={setEditing}
            />
          ))}
        </section>
      )}

      {editing && <TaskEditor task={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
