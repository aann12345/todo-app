import { useState } from 'react'
import { useTasks, useTaskMutations } from '../hooks/useTasks'
import { useLists } from '../hooks/useLists'
import { useUserId } from '../auth/AuthProvider'
import TaskItem from '../components/TaskItem'
import TaskEditor from '../components/TaskEditor'
import type { Task } from '../types'

export default function MyTasksPage() {
  const { tasks } = useTasks()
  const lists = useLists()
  const userId = useUserId()
  const { toggleComplete, deleteTask } = useTaskMutations()
  const [editing, setEditing] = useState<Task | null>(null)

  const listName = (id: string) => {
    const l = lists.find((x) => x.id === id)
    return l ? `${l.emoji ?? ''} ${l.name}`.trim() : ''
  }

  const mine = tasks
    .filter((t) => !t.completed_at && t.assignee_id === userId)
    .sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999'))

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-5 text-2xl font-bold">Мои задачи</h1>
      {mine.length === 0 && (
        <p className="px-3 py-8 text-center text-ink-faint">
          Вам пока ничего не назначено
        </p>
      )}
      {mine.map((t) => (
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
