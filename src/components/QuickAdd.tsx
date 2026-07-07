import { useMemo, useState, type FormEvent } from 'react'
import { useTaskMutations } from '../hooks/useTasks'
import { parseTaskInput, splitItems } from '../lib/nlDate'
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
  const { addTask, addMany } = useTaskMutations()

  const items = useMemo(() => splitItems(title), [title])
  const multi = items.length > 1
  const parsed = useMemo(() => parseTaskInput(title), [title])
  const hasHint =
    !multi && title.trim() && (parsed.due_date || parsed.recurrence || parsed.quantity)

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!listId || items.length === 0) return
    if (multi) {
      addMany.mutate({
        list_id: listId,
        items: items.map((raw) => {
          const p = parseTaskInput(raw)
          return { title: p.title, list_id: listId, due_date: p.due_date ?? dueDate ?? null, recurrence: p.recurrence, quantity: p.quantity }
        }),
      })
    } else {
      addTask.mutate({
        title: parsed.title,
        list_id: listId,
        due_date: parsed.due_date ?? dueDate ?? null,
        recurrence: parsed.recurrence,
        quantity: parsed.quantity,
      })
    }
    setTitle('')
  }

  if (!listId) return null

  return (
    <form onSubmit={submit} className="mb-3">
      <div className="flex items-center gap-3 rounded-xl bg-surface-1 px-3 py-2 ring-accent transition focus-within:ring-2">
        <span className="text-lg leading-none text-accent">+</span>
        <input
          className="w-full bg-transparent text-[15px] outline-none placeholder:text-ink-faint"
          placeholder={placeholder}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          enterKeyHint="done"
        />
        {/* явная кнопка отправки: галочка на клавиатуре iOS не сабмитит форму */}
        {title.trim() && (
          <button
            type="submit"
            className="shrink-0 rounded-lg bg-accent px-3.5 py-1.5 text-sm font-semibold text-white transition hover:brightness-110"
          >
            {multi ? `+${items.length}` : 'Добавить'}
          </button>
        )}
      </div>
      {multi && (
        <p className="mt-1.5 px-3 text-xs text-accent">
          Будет добавлено пунктов: {items.length} (через запятую)
        </p>
      )}
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
