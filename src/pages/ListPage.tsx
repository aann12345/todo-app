import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTasks, useTaskMutations } from '../hooks/useTasks'
import { useLists, useListMutations } from '../hooks/useLists'
import TaskItem from '../components/TaskItem'
import TaskEditor from '../components/TaskEditor'
import QuickAdd from '../components/QuickAdd'
import type { Task } from '../types'

export default function ListPage() {
  const { listId } = useParams<{ listId: string }>()
  const navigate = useNavigate()
  const { tasks } = useTasks()
  const lists = useLists()
  const { toggleComplete } = useTaskMutations()
  const { deleteList } = useListMutations()
  const [editing, setEditing] = useState<Task | null>(null)
  const [showDone, setShowDone] = useState(false)

  const list = lists.find((l) => l.id === listId)
  if (!list) {
    return <p className="px-7 py-8 text-ink-faint">Список не найден</p>
  }

  const active = tasks.filter((t) => t.list_id === listId && !t.completed_at)
  const done = tasks
    .filter((t) => t.list_id === listId && t.completed_at)
    .sort((a, b) => b.completed_at!.localeCompare(a.completed_at!))

  async function removeList() {
    if (!confirm(`Удалить список «${list!.name}» со всеми задачами?`)) return
    await deleteList.mutateAsync(list!.id)
    navigate('/')
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          {list.emoji ? `${list.emoji} ` : ''}{list.name}
        </h1>
        <button
          onClick={removeList}
          className="rounded-lg px-2.5 py-1.5 text-xs text-ink-faint transition hover:bg-surface-2 hover:text-p1"
        >
          Удалить список
        </button>
      </div>

      <QuickAdd listId={list.id} placeholder={`Добавить в «${list.name}»…`} />

      {active.length === 0 && (
        <p className="px-3 py-8 text-center text-ink-faint">Список пуст</p>
      )}
      {active.map((t) => (
        <TaskItem
          key={t.id}
          task={t}
          onToggle={(task) => toggleComplete.mutate(task)}
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
              {done.map((t) => (
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
