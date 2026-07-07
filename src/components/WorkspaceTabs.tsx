import { useState } from 'react'
import { useWorkspace } from '../hooks/useWorkspace'
import WorkspaceDialog from './WorkspaceDialog'
import type { WorkspaceKind } from '../types'

const KIND_EMOJI: Record<WorkspaceKind, string> = {
  personal: '🙂',
  family: '🏠',
  work: '💼',
}

export default function WorkspaceTabs() {
  const { workspaces, current, setCurrentId } = useWorkspace()
  const [showDialog, setShowDialog] = useState(false)

  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
      {workspaces.map((w) => {
        const active = current?.id === w.id
        return (
          <button
            key={w.id}
            onClick={() => setCurrentId(w.id)}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm transition ${
              active
                ? 'bg-accent font-semibold text-white'
                : 'bg-surface-1 text-ink-dim hover:bg-surface-2 hover:text-ink'
            }`}
          >
            <span>{KIND_EMOJI[w.kind]}</span>
            <span className="max-w-40 truncate">{w.name}</span>
          </button>
        )
      })}
      <button
        onClick={() => setShowDialog(true)}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-1 text-lg leading-none text-ink-dim transition hover:bg-surface-2 hover:text-accent"
        title="Новое пространство или вступить по коду"
      >
        +
      </button>
      {showDialog && <WorkspaceDialog onClose={() => setShowDialog(false)} />}
    </div>
  )
}
