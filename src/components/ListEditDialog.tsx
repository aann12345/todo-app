import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useListMutations } from '../hooks/useLists'
import type { List } from '../types'

const EMOJI_CHOICES = [
  '📝', '🛒', '🏠', '💼', '📋', '🍎', '🧹', '🔧', '🎁', '✈️',
  '💊', '📚', '💰', '🐾', '🌱', '🎬', '🏋️', '🍽️', '🎉', '⭐',
]

export default function ListEditDialog({ list, onClose }: { list: List; onClose: () => void }) {
  const { updateList, deleteList } = useListMutations()
  const navigate = useNavigate()
  const [name, setName] = useState(list.name)
  const [emoji, setEmoji] = useState(list.emoji ?? '')

  async function save() {
    if (!name.trim()) return
    await updateList.mutateAsync({ id: list.id, name: name.trim(), emoji: emoji || null })
    onClose()
  }

  async function remove() {
    if (!confirm(`Удалить список «${list.name}» со всеми задачами?`)) return
    await deleteList.mutateAsync(list.id)
    onClose()
    navigate('/')
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[88vh] w-full max-w-sm overflow-y-auto rounded-t-2xl bg-surface-1 p-5 sm:rounded-2xl"
        style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-semibold">Изменить список</h2>

        <div className="flex items-center gap-2">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-2xl">
            {emoji || '📝'}
          </div>
          <input
            autoFocus
            className="min-w-0 flex-1 rounded-lg bg-surface-2 px-3 py-2.5 outline-none placeholder:text-ink-faint focus:ring-2 focus:ring-accent"
            placeholder="Название списка"
            value={name}
            onChange={(e) => setName(e.target.value)}
            enterKeyHint="done"
            onKeyDown={(e) => e.key === 'Enter' && save()}
          />
        </div>

        <p className="mt-4 mb-2 text-xs font-medium text-ink-dim">Значок</p>
        <div className="grid grid-cols-10 gap-1">
          {EMOJI_CHOICES.map((e) => (
            <button
              key={e}
              onClick={() => setEmoji(e)}
              className={`flex h-8 items-center justify-center rounded-lg text-xl transition ${
                emoji === e ? 'bg-accent-soft ring-2 ring-accent' : 'hover:bg-surface-2'
              }`}
            >
              {e}
            </button>
          ))}
        </div>
        {emoji && (
          <button
            onClick={() => setEmoji('')}
            className="mt-2 text-xs text-ink-faint transition hover:text-ink-dim"
          >
            Убрать значок
          </button>
        )}

        <div className="mt-5 flex items-center justify-between">
          <button
            onClick={remove}
            className="rounded-lg px-3 py-2 text-sm text-p1 transition hover:bg-surface-2"
          >
            Удалить список
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
              disabled={!name.trim()}
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
