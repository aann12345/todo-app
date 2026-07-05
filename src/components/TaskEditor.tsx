import { useState } from 'react'
import { useLists } from '../hooks/useLists'
import { useTaskMutations } from '../hooks/useTasks'
import { useWorkspace } from '../hooks/useWorkspace'
import { WEEKDAY_LABELS } from '../lib/recurrence'
import type { Recurrence, Task } from '../types'
import Avatar from './Avatar'

const PRIORITIES = [
  { value: 1, label: 'P1', cls: 'text-p1 border-p1' },
  { value: 2, label: 'P2', cls: 'text-p2 border-p2' },
  { value: 3, label: 'P3', cls: 'text-p3 border-p3' },
  { value: 4, label: 'P4', cls: 'text-p4 border-p4' },
]

export default function TaskEditor({ task, onClose }: { task: Task; onClose: () => void }) {
  const lists = useLists()
  const { members } = useWorkspace()
  const { updateTask, deleteTask } = useTaskMutations()

  const [title, setTitle] = useState(task.title)
  const [notes, setNotes] = useState(task.notes)
  const [listId, setListId] = useState(task.list_id)
  const [dueDate, setDueDate] = useState(task.due_date ?? '')
  const [priority, setPriority] = useState<number>(task.priority)
  const [assigneeId, setAssigneeId] = useState(task.assignee_id ?? '')
  const [freq, setFreq] = useState<Recurrence['freq'] | ''>(task.recurrence?.freq ?? '')
  const [interval, setIntervalN] = useState(task.recurrence?.interval ?? 1)
  const [byweekday, setByweekday] = useState<number[]>(task.recurrence?.byweekday ?? [])
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!title.trim()) return
    setSaving(true)
    const recurrence: Recurrence | null = freq
      ? { freq, interval: Math.max(1, interval), ...(freq === 'weekly' && byweekday.length ? { byweekday } : {}) }
      : null
    await updateTask.mutateAsync({
      id: task.id,
      title: title.trim(),
      notes,
      list_id: listId,
      due_date: dueDate || null,
      priority: priority as Task['priority'],
      assignee_id: assigneeId || null,
      recurrence,
    })
    onClose()
  }

  async function remove() {
    if (!confirm('Удалить задачу?')) return
    await deleteTask.mutateAsync(task.id)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-surface-1 p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          className="w-full bg-transparent text-lg font-semibold outline-none placeholder:text-ink-faint"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Название задачи"
          autoFocus
        />
        <textarea
          className="mt-2 w-full resize-none rounded-lg bg-surface-2 px-3 py-2 text-sm outline-none placeholder:text-ink-faint"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Заметки…"
        />

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

        <div className="mt-3">
          <span className="mb-1 block text-xs font-medium text-ink-dim">Приоритет</span>
          <div className="flex gap-2">
            {PRIORITIES.map((p) => (
              <button
                key={p.value}
                onClick={() => setPriority(p.value)}
                className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${p.cls} ${
                  priority === p.value ? 'bg-surface-3' : 'border-transparent opacity-60 hover:opacity-100'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {members.length > 1 && (
          <div className="mt-3">
            <span className="mb-1 block text-xs font-medium text-ink-dim">Исполнитель</span>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setAssigneeId('')}
                className={`rounded-lg px-3 py-1.5 text-sm transition ${
                  !assigneeId ? 'bg-surface-3' : 'opacity-60 hover:opacity-100'
                }`}
              >
                Никто
              </button>
              {members.map((m) => (
                <button
                  key={m.user_id}
                  onClick={() => setAssigneeId(m.user_id)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition ${
                    assigneeId === m.user_id ? 'bg-surface-3' : 'opacity-60 hover:opacity-100'
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
              value={freq}
              onChange={(e) => setFreq(e.target.value as Recurrence['freq'] | '')}
            >
              <option value="">Без повтора</option>
              <option value="daily">Ежедневно</option>
              <option value="weekly">Еженедельно</option>
              <option value="monthly">Ежемесячно</option>
            </select>
            {freq && (
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
                {freq === 'daily' ? 'дн.' : freq === 'weekly' ? 'нед.' : 'мес.'}
              </label>
            )}
          </div>
          {freq === 'weekly' && (
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
          {freq && !dueDate && (
            <p className="mt-1.5 text-xs text-p2">Для повтора укажите срок задачи</p>
          )}
        </div>

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
              disabled={saving || !title.trim() || Boolean(freq && !dueDate)}
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
