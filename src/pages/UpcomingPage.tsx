import { useState } from 'react'
import { useTasks, useTaskMutations } from '../hooks/useTasks'
import { useLists } from '../hooks/useLists'
import { dateHeading, todayISO } from '../lib/dates'
import TaskItem from '../components/TaskItem'
import TaskEditor from '../components/TaskEditor'
import type { Task } from '../types'

export default function UpcomingPage() {
  const { tasks } = useTasks()
  const lists = useLists()
  const { toggleComplete } = useTaskMutations()
  const [editing, setEditing] = useState<Task | null>(null)

  const today = todayISO()
  const listName = (id: string) => {
    const l = lists.find((x) => x.id === id)
    return l ? `${l.emoji ?? ''} ${l.name}`.trim() : ''
  }

  const upcoming = tasks.filter((t) => !t.completed_at && t.due_date && t.due_date > today)
  const byDate = new Map<string, Task[]>()
  for (const t of upcoming) {
    const arr = byDate.get(t.due_date!) ?? []
    arr.push(t)
    byDate.set(t.due_date!, arr)
  }
  const dates = [...byDate.keys()].sort()

  const noDate = tasks.filter((t) => !t.completed_at && !t.due_date)

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-5 text-2xl font-bold">Предстоящее</h1>

      {dates.length === 0 && noDate.length === 0 && (
        <p className="px-3 py-8 text-center text-ink-faint">Впереди пока пусто</p>
      )}

      {dates.map((d) => (
        <section key={d} className="mb-5">
          <h2 className="mb-1 px-3 text-sm font-semibold text-ink-dim first-letter:uppercase">
            {dateHeading(d)}
          </h2>
          {byDate.get(d)!.map((t) => (
            <TaskItem
              key={t.id}
              task={t}
              onToggle={(task) => toggleComplete.mutate(task)}
              onOpen={setEditing}
              showList={listName(t.list_id)}
            />
          ))}
        </section>
      ))}

      {noDate.length > 0 && (
        <section className="mb-5">
          <h2 className="mb-1 px-3 text-sm font-semibold text-ink-faint">Без даты</h2>
          {noDate.map((t) => (
            <TaskItem
              key={t.id}
              task={t}
              onToggle={(task) => toggleComplete.mutate(task)}
              onOpen={setEditing}
              showList={listName(t.list_id)}
            />
          ))}
        </section>
      )}

      {editing && <TaskEditor task={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
