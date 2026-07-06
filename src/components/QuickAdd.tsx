import { useMemo, useState, type FormEvent } from 'react'
import { useTaskMutations } from '../hooks/useTasks'
import { parseTaskInput } from '../lib/nlDate'
import { dueLabel } from '../lib/dates'
import { recurrenceLabel } from '../lib/recurrence'

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

  const parsed = useMemo(() => parseTaskInput(title), [title])
  const hasHint =
    title.trim() && (parsed.due_date || parsed.recurrence || parsed.quantity)

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!parsed.title || !listId) return
    addTask.mutate({
      title: parsed.title,
      list_id: listId,
      due_date: parsed.due_date ?? dueDate ?? null,
      recurrence: parsed.recurrence,
      quantity: parsed.quantity,
    })
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
      {hasHint && (
        <div className="mt-1.5 flex flex-wrap items-center gap-2 px-3 text-xs text-ink-dim">
          <span className="text-ink-faint">Распознано:</span>
          <span className="font-medium">{parsed.title}</span>
          {parsed.due_date && (
            <span className="rounded-full bg-accent-soft px-2 py-0.5 text-accent">
              📅 {dueLabel(parsed.due_date)}
            </span>
          )}
          {parsed.recurrence && (
            <span className="rounded-full bg-accent-soft px-2 py-0.5 text-accent">
              🔁 {recurrenceLabel(parsed.recurrence)}
            </span>
          )}
          {parsed.quantity && (
            <span className="rounded-full bg-surface-2 px-2 py-0.5">× {parsed.quantity}</span>
          )}
        </div>
      )}
    </form>
  )
}
