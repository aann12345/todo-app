import { useEffect, useRef, useState } from 'react'
import { onSnackbar, type SnackbarMessage } from '../lib/snackbar'

export default function Snackbar() {
  const [msg, setMsg] = useState<SnackbarMessage | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(null)

  useEffect(
    () =>
      onSnackbar((m) => {
        setMsg(m)
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => setMsg(null), 5000)
      }),
    [],
  )

  if (!msg) return null

  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 items-center justify-between gap-3 rounded-xl bg-surface-3 px-4 py-3 text-sm shadow-lg">
      <span className="min-w-0 truncate">{msg.text}</span>
      {msg.onAction && (
        <button
          className="shrink-0 font-semibold text-accent"
          onClick={() => {
            msg.onAction?.()
            setMsg(null)
            if (timer.current) clearTimeout(timer.current)
          }}
        >
          {msg.actionLabel ?? 'Отменить'}
        </button>
      )}
    </div>
  )
}
