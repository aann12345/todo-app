import { useMemo, useState, type FormEvent } from 'react'
import { useLocation } from 'react-router-dom'
import { addDays, format } from 'date-fns'
import { useLists } from '../hooks/useLists'
import { useTaskMutations } from '../hooks/useTasks'
import { parseTaskInput, splitItems } from '../lib/nlDate'
import { dueLabel, todayISO } from '../lib/dates'
import { recurrenceLabel } from '../lib/recurrence'

type DueChip = 'none' | 'today' | 'tomorrow'

/** Плавающая кнопка «+»: добавить одну задачу или сразу список. */
export default function GlobalAdd() {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [listId, setListId] = useState('')
  const [chip, setChip] = useState<DueChip>('none')
  const lists = useLists()
  const { addTask, addMany } = useTaskMutations()
  const location = useLocation()

  // несколько пунктов, если есть перевод строки/запятая
  const items = useMemo(() => splitItems(text), [text])
  const multi = items.length > 1
  const parsed = useMemo(() => parseTaskInput(text), [text])

  function openDialog() {
    const m = location.pathname.match(/\/list\/([^/]+)/)
    setListId(m?.[1] ?? lists[0]?.id ?? '')
    setChip(location.pathname === '/' ? 'today' : 'none')
    setText('')
    setOpen(true)
  }

  const chipDue =
    chip === 'today' ? todayISO() : chip === 'tomorrow' ? format(addDays(new Date(), 1), 'yyyy-MM-dd') : null

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!listId || items.length === 0) return

    if (multi) {
      // каждый пункт разбираем на дату/количество отдельно
      addMany.mutate({
        list_id: listId,
        items: items.map((raw) => {
          const p = parseTaskInput(raw)
          return { title: p.title, list_id: listId, due_date: p.due_date ?? chipDue, recurrence: p.recurrence, quantity: p.quantity }
        }),
      })
    } else {
      addTask.mutate({
        title: parsed.title,
        list_id: listId,
        due_date: parsed.due_date ?? chipDue,
        recurrence: parsed.recurrence,
        quantity: parsed.quantity,
      })
    }
    setOpen(false)
  }

  if (!lists.length) return null

  return (
    <>
      <button
        onClick={openDialog}
        aria-label="Добавить задачу"
        className="fixed right-5 bottom-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-3xl leading-none font-light text-white shadow-lg shadow-black/40 transition hover:brightness-110 active:scale-95 md:right-8 md:bottom-8"
        style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
      >
        +
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
          onClick={() => setOpen(false)}
        >
          <form
            onSubmit={submit}
            className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-y-auto rounded-t-2xl bg-surface-1 p-5 sm:rounded-2xl"
            style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}
            onClick={(e) => e.stopPropagation()}
          >
            <textarea
              autoFocus
              rows={multi ? Math.min(items.length + 1, 8) : 2}
              className="w-full resize-none bg-transparent text-lg outline-none placeholder:text-ink-faint"
              placeholder="Что нужно сделать?&#10;Список: каждый товар с новой строки или через запятую"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />

            {multi && (
              <p className="mt-1 text-xs text-accent">Будет добавлено пунктов: {items.length}</p>
            )}

            {!multi && (parsed.due_date || parsed.recurrence || parsed.quantity) && (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-dim">
                <span className="text-ink-faint">Распознано:</span>
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

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <select
                className="rounded-lg bg-surface-2 px-3 py-2 text-sm outline-none"
                value={listId}
                onChange={(e) => setListId(e.target.value)}
              >
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.emoji ? `${l.emoji} ` : ''}{l.name}
                  </option>
                ))}
              </select>

              {!parsed.due_date && (
                <div className="flex gap-1">
                  {(
                    [
                      ['none', 'Без даты'],
                      ['today', 'Сегодня'],
                      ['tomorrow', 'Завтра'],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setChip(value)}
                      className={`rounded-full px-3 py-1.5 text-xs transition ${
                        chip === value
                          ? 'bg-surface-3 font-medium'
                          : 'bg-surface-2 text-ink-dim hover:text-ink'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg px-4 py-2 text-sm text-ink-dim transition hover:bg-surface-2"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={items.length === 0}
                className="rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
              >
                {multi ? `Добавить ${items.length}` : 'Добавить'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
