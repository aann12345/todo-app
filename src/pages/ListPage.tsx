import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTasks, useTaskMutations } from '../hooks/useTasks'
import { useLists, useListMutations } from '../hooks/useLists'
import { CATEGORY_ORDER } from '../lib/categories'
import TaskItem from '../components/TaskItem'
import TaskEditor from '../components/TaskEditor'
import QuickAdd from '../components/QuickAdd'
import type { Task } from '../types'

export default function ListPage() {
  const { listId } = useParams<{ listId: string }>()
  const navigate = useNavigate()
  const { tasks } = useTasks()
  const lists = useLists()
  const { toggleComplete, deleteTask, addTask } = useTaskMutations()
  const [editing, setEditing] = useState<Task | null>(null)
  const [showDone, setShowDone] = useState(false)

  const list = lists.find((l) => l.id === listId)

  const active = useMemo(
    () => tasks.filter((t) => t.list_id === listId && !t.completed_at),
    [tasks, listId],
  )
  const done = useMemo(
    () =>
      tasks
        .filter((t) => t.list_id === listId && t.completed_at)
        .sort((a, b) => b.completed_at!.localeCompare(a.completed_at!)),
    [tasks, listId],
  )

  // если хотя бы треть активных задач распознана как товары — включаем режим покупок
  const shoppingMode =
    active.length > 0 &&
    active.filter((t) => t.category).length >= Math.max(1, Math.ceil(active.length / 3))

  const grouped = useMemo(() => {
    if (!shoppingMode) return null
    const map = new Map<string, Task[]>()
    for (const t of active) {
      const cat = t.category ?? 'Прочее'
      map.set(cat, [...(map.get(cat) ?? []), t])
    }
    const order = [...CATEGORY_ORDER, 'Прочее']
    return [...map.entries()].sort(
      (a, b) => order.indexOf(a[0] as never) - order.indexOf(b[0] as never),
    )
  }, [active, shoppingMode])

  // частые покупки: что чаще всего выполняли в этом списке и чего сейчас нет
  const frequent = useMemo(() => {
    const counts = new Map<string, { title: string; n: number }>()
    for (const t of done) {
      const k = t.title.toLowerCase().trim()
      const cur = counts.get(k)
      counts.set(k, { title: t.title, n: (cur?.n ?? 0) + 1 })
    }
    const activeTitles = new Set(active.map((t) => t.title.toLowerCase().trim()))
    return [...counts.values()]
      .filter((c) => c.n >= 2 && !activeTitles.has(c.title.toLowerCase().trim()))
      .sort((a, b) => b.n - a.n)
      .slice(0, 8)
  }, [done, active])

  if (!list) {
    return <p className="px-7 py-8 text-ink-faint">Список не найден</p>
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          {list.emoji ? `${list.emoji} ` : ''}{list.name}
        </h1>
        <DeleteListButton listId={list.id} listName={list.name} onDeleted={() => navigate('/')} />
      </div>

      <QuickAdd listId={list.id} placeholder={`Добавить в «${list.name}»…`} />

      {frequent.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {frequent.map((f) => (
            <button
              key={f.title}
              onClick={() => addTask.mutate({ title: f.title, list_id: list.id })}
              className="rounded-full bg-surface-1 px-3 py-1 text-xs text-ink-dim transition hover:bg-surface-2 hover:text-ink"
            >
              + {f.title}
            </button>
          ))}
        </div>
      )}

      {active.length === 0 && (
        <p className="px-3 py-8 text-center text-ink-faint">Список пуст</p>
      )}

      {grouped
        ? grouped.map(([category, items]) => (
            <section key={category} className="mb-4">
              <h2 className="mb-0.5 px-3 text-xs font-semibold tracking-wide text-ink-faint uppercase">
                {category}
              </h2>
              {items.map((t) => (
                <TaskItem
                  key={t.id}
                  task={t}
                  onToggle={(task) => toggleComplete.mutate(task)}
                  onDelete={(task) => deleteTask.mutate(task)}
                  onOpen={setEditing}
                />
              ))}
            </section>
          ))
        : active.map((t) => (
            <TaskItem
              key={t.id}
              task={t}
              onToggle={(task) => toggleComplete.mutate(task)}
              onDelete={(task) => deleteTask.mutate(task)}
              onOpen={setEditing}
            />
          ))}

      {done.length > 0 && (
        <div className="mt-5">
          <button
            onClick={() => setShowDone(!showDone)}
            className="px-3 text-sm font-medium text-ink-faint transition hover:text-ink-dim"
          >
            {showDone ? '▾' : '▸'} Выполненные — {done.length}
          </button>
          {showDone && (
            <div className="mt-1 opacity-60">
              {done.slice(0, 50).map((t) => (
                <TaskItem
                  key={t.id}
                  task={t}
                  onToggle={(task) => toggleComplete.mutate(task)}
                  onOpen={setEditing}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {editing && <TaskEditor task={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function DeleteListButton({
  listId,
  listName,
  onDeleted,
}: {
  listId: string
  listName: string
  onDeleted: () => void
}) {
  const { deleteList } = useListMutations()
  return (
    <button
      onClick={async () => {
        if (!confirm(`Удалить список «${listName}» со всеми задачами?`)) return
        await deleteList.mutateAsync(listId)
        onDeleted()
      }}
      className="rounded-lg px-2.5 py-1.5 text-xs text-ink-faint transition hover:bg-surface-2 hover:text-p1"
    >
      Удалить список
    </button>
  )
}
