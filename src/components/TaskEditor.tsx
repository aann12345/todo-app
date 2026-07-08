import { useState, type FormEvent } from 'react'
import { useLists } from '../hooks/useLists'
import { useTaskMutations } from '../hooks/useTasks'
import { useWorkspace } from '../hooks/useWorkspace'
import { useComments } from '../hooks/useComments'
import { WEEKDAY_LABELS } from '../lib/recurrence'
import { todayISO } from '../lib/dates'
import { combineDateTime, timeFromISO } from '../lib/remind'
import { showSnackbar } from '../lib/snackbar'
import type { ChecklistItem, Recurrence, Task } from '../types'
import Avatar from './Avatar'

const PRIORITIES = [
  { value: 1, label: 'P1', cls: 'text-p1 border-p1' },
  { value: 2, label: 'P2', cls: 'text-p2 border-p2' },
  { value: 3, label: 'P3', cls: 'text-p3 border-p3' },
  { value: 4, label: 'P4', cls: 'text-p4 border-p4' },
]

function CommentsSection({ task }: { task: Task }) {
  const { comments, addComment } = useComments(task.id, task.workspace_id)
  const [text, setText] = useState('')

  function submit(e: FormEvent) {
    e.preventDefault()
    const body = text.trim()
    if (!body) return
    addComment.mutate(body)
    setText('')
  }

  return (
    <div className="mt-4 border-t border-surface-2 pt-3">
      <span className="mb-2 block text-xs font-medium text-ink-dim">
        Комментарии {comments.length > 0 && `(${comments.length})`}
      </span>
      <div className="max-h-44 space-y-2.5 overflow-y-auto">
        {comments.map((c) => (
          <div key={c.id} className="flex items-start gap-2">
            {c.author && <Avatar profile={c.author} size={22} />}
            <div className="min-w-0 flex-1 rounded-lg rounded-tl-none bg-surface-2 px-3 py-1.5">
              <p className="text-xs font-medium text-ink-dim">{c.author?.display_name}</p>
              <p className="text-sm break-words whitespace-pre-wrap">{c.body}</p>
            </div>
          </div>
        ))}
      </div>
      <form onSubmit={submit} className="mt-2 flex gap-2">
        <input
          className="min-w-0 flex-1 rounded-lg bg-surface-2 px-3 py-2 text-sm outline-none placeholder:text-ink-faint focus:ring-2 focus:ring-accent"
          placeholder="Написать комментарий…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          disabled={!text.trim()}
          className="shrink-0 rounded-lg bg-surface-2 px-3 py-2 text-sm transition hover:bg-surface-3 disabled:opacity-40"
        >
          ➤
        </button>
      </form>
    </div>
  )
}

export default function TaskEditor({ task, onClose }: { task: Task; onClose: () => void }) {
  const lists = useLists()
  const { members } = useWorkspace()
  const { updateTask, deleteTask } = useTaskMutations()

  const [title, setTitle] = useState(task.title)
  const [notes, setNotes] = useState(task.notes)
  const [listId, setListId] = useState(task.list_id)
  const [dueDate, setDueDate] = useState(task.due_date ?? '')
  const [remindTime, setRemindTime] = useState(task.remind_at ? timeFromISO(task.remind_at) : '')
  const [priority, setPriority] = useState<number>(task.priority)
  const [assigneeId, setAssigneeId] = useState(task.assignee_id ?? '')
  const [assigneeAll, setAssigneeAll] = useState(task.assignee_all)
  const [quantity, setQuantity] = useState(task.quantity ?? '')
  const [checklist, setChecklist] = useState<ChecklistItem[]>(task.checklist ?? [])
  const [newItem, setNewItem] = useState('')
  const initialPreset = (() => {
    const r = task.recurrence
    if (!r) return ''
    if (r.freq === 'monthly' && r.interval === 6) return 'halfyear'
    return r.freq
  })()
  const [preset, setPreset] = useState<string>(initialPreset)
  const [interval, setIntervalN] = useState(task.recurrence?.interval ?? 1)
  const [byweekday, setByweekday] = useState<number[]>(task.recurrence?.byweekday ?? [])
  const showInterval = preset === 'daily' || preset === 'weekly' || preset === 'monthly' || preset === 'yearly'
  const [saving, setSaving] = useState(false)

  function addChecklistItem() {
    const text = newItem.trim()
    if (!text) return
    setChecklist([...checklist, { id: crypto.randomUUID(), text, done: false }])
    setNewItem('')
  }

  async function save() {
    if (!title.trim()) return
    // защита от случайной даты в прошлом (изменённой, не изначальной)
    if (dueDate && dueDate < todayISO() && dueDate !== task.due_date) {
      if (!confirm(`Срок ${dueDate} уже в прошлом. Точно сохранить?`)) return
    }
    setSaving(true)
    let recurrence: Recurrence | null = null
    const n = Math.max(1, interval)
    if (preset === 'halfyear') recurrence = { freq: 'monthly', interval: 6 }
    else if (preset === 'weekly')
      recurrence = { freq: 'weekly', interval: n, ...(byweekday.length ? { byweekday } : {}) }
    else if (preset === 'daily' || preset === 'monthly' || preset === 'yearly')
      recurrence = { freq: preset, interval: n }
    // напоминание: дата + время → момент UTC; сброс «отправлено» при изменении
    const remind_at = dueDate && remindTime ? combineDateTime(dueDate, remindTime) : null
    try {
      await updateTask.mutateAsync({
        id: task.id,
        title: title.trim(),
        notes,
        list_id: listId,
        due_date: dueDate || null,
        priority: priority as Task['priority'],
        assignee_id: assigneeAll ? null : assigneeId || null,
        assignee_all: assigneeAll,
        recurrence,
        quantity: quantity.trim() || null,
        checklist,
        remind_at,
        reminded: remind_at !== task.remind_at ? false : task.reminded,
      })
      onClose()
    } catch (err) {
      setSaving(false)
      showSnackbar({
        text: `Не удалось сохранить: ${err instanceof Error ? err.message : String(err)}`,
      })
    }
  }

  async function remove() {
    await deleteTask.mutateAsync(task)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-surface-1 p-5 sm:rounded-2xl"
        style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          className="w-full bg-transparent text-lg font-semibold outline-none placeholder:text-ink-faint"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Название задачи"
        />
        <textarea
          className="mt-2 w-full resize-none rounded-lg bg-surface-2 px-3 py-2 text-sm outline-none placeholder:text-ink-faint"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Заметки…"
        />

        {/* Чек-лист */}
        <div className="mt-3">
          <span className="mb-1 block text-xs font-medium text-ink-dim">
            Подзадачи{' '}
            {checklist.length > 0 &&
              `(${checklist.filter((i) => i.done).length}/${checklist.length})`}
          </span>
          <div className="space-y-1">
            {checklist.map((item) => (
              <div key={item.id} className="flex items-center gap-2">
                <button
                  onClick={() =>
                    setChecklist(
                      checklist.map((i) =>
                        i.id === item.id ? { ...i, done: !i.done } : i,
                      ),
                    )
                  }
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                    item.done ? 'border-accent bg-accent' : 'border-ink-faint'
                  }`}
                >
                  {item.done && <span className="text-[9px] text-white">✓</span>}
                </button>
                <span
                  className={`min-w-0 flex-1 truncate text-sm ${
                    item.done ? 'text-ink-faint line-through' : ''
                  }`}
                >
                  {item.text}
                </span>
                <button
                  onClick={() => setChecklist(checklist.filter((i) => i.id !== item.id))}
                  className="text-ink-faint transition hover:text-p1"
                  aria-label="Удалить подзадачу"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex gap-2">
            <input
              className="min-w-0 flex-1 rounded-lg bg-surface-2 px-3 py-1.5 text-sm outline-none placeholder:text-ink-faint"
              placeholder="+ Добавить подзадачу"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addChecklistItem()
                }
              }}
            />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-dim">Список</span>
            <select
              className="w-full rounded-lg bg-surface-2 px-3 py-2 text-sm outline-none"
              value={listId}
              onChange={(e) => setListId(e.target.value)}
            >
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.emoji ? `${l.emoji} ` : ''}{l.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-dim">Срок</span>
            <input
              type="date"
              className="w-full rounded-lg bg-surface-2 px-3 py-2 text-sm outline-none"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </label>
        </div>

        {/* Напоминание по времени — доступно, когда задан срок */}
        <div className="mt-3">
          <span className="mb-1 block text-xs font-medium text-ink-dim">
            🔔 Напомнить {!dueDate && <span className="text-ink-faint">(сначала укажите срок)</span>}
          </span>
          <div className="flex items-center gap-2">
            <input
              type="time"
              disabled={!dueDate}
              className="rounded-lg bg-surface-2 px-3 py-2 text-sm outline-none disabled:opacity-40"
              value={remindTime}
              onChange={(e) => setRemindTime(e.target.value)}
            />
            {remindTime && (
              <button
                type="button"
                onClick={() => setRemindTime('')}
                className="rounded-lg px-2 py-1 text-xs text-ink-faint transition hover:bg-surface-2 hover:text-ink"
              >
                Убрать
              </button>
            )}
            {dueDate && !remindTime && (
              <div className="flex gap-1">
                {['09:00', '12:00', '18:00'].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setRemindTime(t)}
                    className="rounded-full bg-surface-2 px-2.5 py-1 text-xs text-ink-dim transition hover:bg-surface-3 hover:text-ink"
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <span className="mb-1 block text-xs font-medium text-ink-dim">Приоритет</span>
            <div className="flex gap-1.5">
              {PRIORITIES.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPriority(p.value)}
                  className={`rounded-lg border px-2.5 py-1.5 text-sm font-semibold transition ${p.cls} ${
                    priority === p.value ? 'bg-surface-3' : 'border-transparent opacity-60 hover:opacity-100'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-dim">Количество</span>
            <input
              className="w-full rounded-lg bg-surface-2 px-3 py-2 text-sm outline-none placeholder:text-ink-faint"
              placeholder="2 кг, 3 шт…"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </label>
        </div>

        {members.length > 1 && (
          <div className="mt-3">
            <span className="mb-1 block text-xs font-medium text-ink-dim">Исполнитель</span>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  setAssigneeId('')
                  setAssigneeAll(false)
                }}
                className={`rounded-lg px-3 py-1.5 text-sm transition ${
                  !assigneeId && !assigneeAll ? 'bg-surface-3' : 'opacity-60 hover:opacity-100'
                }`}
              >
                Никто
              </button>
              <button
                onClick={() => {
                  setAssigneeAll(true)
                  setAssigneeId('')
                }}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition ${
                  assigneeAll ? 'bg-surface-3' : 'opacity-60 hover:opacity-100'
                }`}
              >
                👥 Вместе
              </button>
              {members.map((m) => (
                <button
                  key={m.user_id}
                  onClick={() => {
                    setAssigneeId(m.user_id)
                    setAssigneeAll(false)
                  }}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition ${
                    assigneeId === m.user_id && !assigneeAll
                      ? 'bg-surface-3'
                      : 'opacity-60 hover:opacity-100'
                  }`}
                >
                  <Avatar profile={m.profile} size={18} />
                  {m.profile.display_name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-3">
          <span className="mb-1 block text-xs font-medium text-ink-dim">Повтор</span>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="rounded-lg bg-surface-2 px-3 py-2 text-sm outline-none"
              value={preset}
              onChange={(e) => setPreset(e.target.value)}
            >
              <option value="">Без повтора</option>
              <option value="daily">Ежедневно</option>
              <option value="weekly">Еженедельно</option>
              <option value="monthly">Ежемесячно</option>
              <option value="halfyear">Каждые полгода</option>
              <option value="yearly">Каждый год</option>
            </select>
            {showInterval && (
              <label className="flex items-center gap-1.5 text-sm text-ink-dim">
                каждые
                <input
                  type="number"
                  min={1}
                  max={30}
                  className="w-14 rounded-lg bg-surface-2 px-2 py-2 text-center text-sm outline-none"
                  value={interval}
                  onChange={(e) => setIntervalN(Number(e.target.value))}
                />
                {preset === 'daily' ? 'дн.' : preset === 'weekly' ? 'нед.' : preset === 'yearly' ? 'г.' : 'мес.'}
              </label>
            )}
          </div>
          {preset === 'weekly' && (
            <div className="mt-2 flex gap-1.5">
              {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                <button
                  key={d}
                  onClick={() =>
                    setByweekday((prev) =>
                      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d],
                    )
                  }
                  className={`h-8 w-8 rounded-full text-xs font-medium transition ${
                    byweekday.includes(d)
                      ? 'bg-accent text-white'
                      : 'bg-surface-2 text-ink-dim hover:bg-surface-3'
                  }`}
                >
                  {WEEKDAY_LABELS[d]}
                </button>
              ))}
            </div>
          )}
          {preset && !dueDate && (
            <p className="mt-1.5 text-xs text-p2">Для повтора укажите срок задачи</p>
          )}
        </div>

        <CommentsSection task={task} />

        <div className="mt-5 flex items-center justify-between">
          <button
            onClick={remove}
            className="rounded-lg px-3 py-2 text-sm text-p1 transition hover:bg-surface-2"
          >
            Удалить
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm text-ink-dim transition hover:bg-surface-2"
            >
              Отмена
            </button>
            <button
              onClick={save}
              disabled={saving || !title.trim() || Boolean(preset && !dueDate)}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
            >
              Сохранить
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
