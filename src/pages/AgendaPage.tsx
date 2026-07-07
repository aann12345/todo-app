import { useMemo, useState } from 'react'
import { useTasks, useTaskMutations } from '../hooks/useTasks'
import { useLists } from '../hooks/useLists'
import { dateHeading, endOfMonthISO, isoIn, todayISO } from '../lib/dates'
import TaskItem from '../components/TaskItem'
import TaskEditor from '../components/TaskEditor'
import EmptyState from '../components/EmptyState'
import type { Task } from '../types'

export type AgendaRange = 'tomorrow' | 'week' | 'month' | 'someday'

const TITLES: Record<AgendaRange, string> = {
  tomorrow: 'Завтра',
  week: 'Ближайшие 7 дней',
  month: 'В этом месяце',
  someday: 'Долгий ящик',
}

const EMPTY: Record<AgendaRange, string> = {
  tomorrow: 'На завтра задач нет',
  week: 'На неделю задач нет',
  month: 'В этом месяце задач нет',
  someday: 'Здесь задачи без даты — то, что «когда-нибудь». Пока пусто.',
}

export default function AgendaPage({ range }: { range: AgendaRange }) {
  const { tasks } = useTasks()
  const lists = useLists()
  const { toggleComplete, deleteTask } = useTaskMutations()
  const [editing, setEditing] = useState<Task | null>(null)

  const listName = (id: string) => {
    const l = lists.find((x) => x.id === id)
    return l ? `${l.emoji ?? ''} ${l.name}`.trim() : ''
  }

  const today = todayISO()

  const { grouped, flat } = useMemo(() => {
    const active = tasks.filter((t) => !t.completed_at)

    if (range === 'someday') {
      return { grouped: null, flat: active.filter((t) => !t.due_date) }
    }

    let from: string
    let to: string
    if (range === 'tomorrow') {
      from = to = isoIn(1)
    } else if (range === 'week') {
      from = today
      to = isoIn(7)
    } else {
      from = today
      to = endOfMonthISO()
    }

    const inRange = active.filter((t) => t.due_date && t.due_date >= from && t.due_date <= to)
    const byDate = new Map<string, Task[]>()
    for (const t of inRange) {
      byDate.set(t.due_date!, [...(byDate.get(t.due_date!) ?? []), t])
    }
    const dates = [...byDate.keys()].sort()
    return { grouped: dates.map((d) => [d, byDate.get(d)!] as const), flat: null }
  }, [tasks, range, today])

  const empty = grouped ? grouped.length === 0 : flat!.length === 0

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-5 text-2xl font-bold">{TITLES[range]}</h1>

      {empty && <EmptyState icon="🗓️" text={EMPTY[range]} />}

      {grouped?.map(([d, items]) => (
        <section key={d} className="mb-5">
          <h2 className="mb-1 px-3 text-sm font-semibold text-ink-dim first-letter:uppercase">
            {dateHeading(d)}
          </h2>
          {items.map((t) => (
            <TaskItem
              key={t.id}
              task={t}
              onToggle={(task) => toggleComplete.mutate(task)}
              onDelete={(task) => deleteTask.mutate(task)}
              onOpen={setEditing}
              showList={listName(t.list_id)}
            />
          ))}
        </section>
      ))}

      {flat?.map((t) => (
        <TaskItem
          key={t.id}
          task={t}
          onToggle={(task) => toggleComplete.mutate(task)}
          onDelete={(task) => deleteTask.mutate(task)}
          onOpen={setEditing}
          showList={listName(t.list_id)}
        />
      ))}

      {editing && <TaskEditor task={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
