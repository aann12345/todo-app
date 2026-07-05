import { useState, type FormEvent } from 'react'
import { useTaskMutations } from '../hooks/useTasks'

export default function QuickAdd({
  listId,
  dueDate,
  placeholder = 'Добавить задачу…',
}: {
  listId: string | undefined
  dueDate?: string
  placeholder?: string
}) {
  const [title, setTitle] = useState('')
  const { addTask } = useTaskMutations()

  function submit(e: FormEvent) {
    e.preventDefault()
    const t = title.trim()
    if (!t || !listId) return
    addTask.mutate({ title: t, list_id: listId, due_date: dueDate ?? null })
    setTitle('')
  }

  if (!listId) return null

  return (
    <form onSubmit={submit} className="mb-3">
      <div className="flex items-center gap-3 rounded-xl bg-surface-1 px-3 py-2.5 ring-accent transition focus-within:ring-2">
        <span className="text-lg leading-none text-accent">+</span>
        <input
          className="w-full bg-transparent text-[15px] outline-none placeholder:text-ink-faint"
          placeholder={placeholder}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
    </form>
  )
}
