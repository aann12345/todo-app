import type { ReactNode } from 'react'

export default function EmptyState({
  icon,
  text,
  hint,
  children,
}: {
  icon: string
  text: string
  hint?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-3 text-4xl opacity-80">{icon}</div>
      <p className="text-[15px] text-ink-dim">{text}</p>
      {hint && <p className="mt-1.5 max-w-xs text-sm text-ink-faint">{hint}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  )
}
