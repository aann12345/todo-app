import { useState } from 'react'

const KEY = 'swipeHintSeen'

/** Одноразовая подсказка про жесты — показывается, пока не закроют. */
export default function SwipeHint() {
  const [seen, setSeen] = useState(() => localStorage.getItem(KEY) === '1')
  if (seen) return null

  function dismiss() {
    localStorage.setItem(KEY, '1')
    setSeen(true)
  }

  return (
    <div className="mb-3 flex items-center gap-3 rounded-xl bg-surface-1 px-3 py-2.5 text-sm text-ink-dim">
      <span className="text-lg">👉</span>
      <span className="flex-1">
        Смахните задачу <b className="text-green-500">вправо</b> — выполнить,{' '}
        <b className="text-p1">влево</b> — удалить. Нажмите на задачу, чтобы открыть.
      </span>
      <button
        onClick={dismiss}
        className="shrink-0 rounded-lg px-2 py-1 text-xs text-ink-faint transition hover:bg-surface-2"
        aria-label="Понятно"
      >
        Понятно
      </button>
    </div>
  )
}
