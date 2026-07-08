import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useQueryClient } from '@tanstack/react-query'
import { useWorkspace } from '../hooks/useWorkspace'
import type { WorkspaceKind } from '../types'

// ошибки supabase-js — не экземпляры Error, у них просто поле message
function errMsg(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) return String(err.message)
  return String(err)
}

const KINDS: { value: WorkspaceKind; label: string; emoji: string; hint: string }[] = [
  { value: 'family', label: 'Семья', emoji: '🏠', hint: 'покупки, дела по дому' },
  { value: 'work', label: 'Работа', emoji: '💼', hint: 'рабочие проекты' },
]

export default function WorkspaceDialog({ onClose }: { onClose: () => void }) {
  const { createWorkspace, setCurrentId } = useWorkspace()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [tab, setTab] = useState<'create' | 'join'>('create')
  const [name, setName] = useState('')
  const [kind, setKind] = useState<WorkspaceKind>('family')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function create() {
    if (!name.trim()) return
    setBusy(true)
    setError('')
    try {
      await createWorkspace(name.trim(), kind)
      onClose()
      navigate('/')
    } catch (err) {
      setError(errMsg(err))
    } finally {
      setBusy(false)
    }
  }

  async function join() {
    if (!code.trim()) return
    setBusy(true)
    setError('')
    try {
      const { data, error } = await supabase.rpc('join_workspace', {
        invite_code: code.trim(),
      })
      if (error) {
        throw new Error(
          error.message.includes('INVITE_INVALID')
            ? 'Код не найден или истёк'
            : error.message,
        )
      }
      await qc.invalidateQueries({ queryKey: ['workspaces'] })
      setCurrentId(data as string)
      onClose()
      navigate('/')
    } catch (err) {
      setError(errMsg(err))
    } finally {
      setBusy(false)
    }
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
        <div className="mb-4 flex rounded-lg bg-surface-2 p-1">
          {(
            [
              ['create', 'Создать'],
              ['join', 'Вступить по коду'],
            ] as const
          ).map(([t, label]) => (
            <button
              key={t}
              onClick={() => {
                setTab(t)
                setError('')
              }}
              className={`flex-1 rounded-md py-1.5 text-sm font-medium transition ${
                tab === t ? 'bg-surface-3' : 'text-ink-dim'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'create' ? (
          <div className="space-y-3">
            <input
              autoFocus
              className="w-full rounded-lg bg-surface-2 px-4 py-2.5 outline-none placeholder:text-ink-faint focus:ring-2 focus:ring-accent"
              placeholder="Название (например, «Наша семья»)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && create()}
            />
            <div className="flex gap-2">
              {KINDS.map((k) => (
                <button
                  key={k.value}
                  onClick={() => setKind(k.value)}
                  className={`flex-1 rounded-xl border-2 p-3 text-left transition ${
                    kind === k.value
                      ? 'border-accent bg-accent-soft'
                      : 'border-surface-2 hover:border-surface-3'
                  }`}
                >
                  <div className="text-lg">{k.emoji} {k.label}</div>
                  <div className="mt-0.5 text-xs text-ink-dim">{k.hint}</div>
                </button>
              ))}
            </div>
            {error && <p className="text-sm text-p1">{error}</p>}
            <button
              onClick={create}
              disabled={busy || !name.trim()}
              className="w-full rounded-lg bg-accent py-2.5 font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
            >
              Создать пространство
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-ink-dim">
              Попросите код приглашения у того, кто создал пространство (страница «Участники»).
            </p>
            <input
              autoFocus
              className="w-full rounded-lg bg-surface-2 px-4 py-2.5 text-center font-mono text-xl tracking-[0.3em] uppercase outline-none placeholder:text-sm placeholder:tracking-normal placeholder:text-ink-faint focus:ring-2 focus:ring-accent"
              placeholder="Код (6 символов)"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && join()}
            />
            {error && <p className="text-sm text-p1">{error}</p>}
            <button
              onClick={join}
              disabled={busy || code.trim().length < 6}
              className="w-full rounded-lg bg-accent py-2.5 font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
            >
              Вступить
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
