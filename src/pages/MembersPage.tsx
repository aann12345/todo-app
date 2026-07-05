import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useWorkspace } from '../hooks/useWorkspace'
import { useUserId } from '../auth/AuthProvider'
import Avatar from '../components/Avatar'
import type { Invite } from '../types'

function randomCode(): string {
  // без похожих символов (0/O, 1/I)
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export default function MembersPage() {
  const { current, members } = useWorkspace()
  const userId = useUserId()
  const qc = useQueryClient()
  const [copied, setCopied] = useState(false)
  const wsId = current?.id

  const { data: invites = [] } = useQuery({
    queryKey: ['invites', wsId],
    enabled: Boolean(wsId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invites')
        .select('*')
        .eq('workspace_id', wsId!)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as Invite[]
    },
  })

  const activeInvite = invites[0] ?? null

  async function createInvite() {
    const { error } = await supabase.from('invites').insert({
      workspace_id: wsId,
      code: randomCode(),
      created_by: userId,
    })
    if (!error) qc.invalidateQueries({ queryKey: ['invites', wsId] })
  }

  async function copyCode() {
    if (!activeInvite) return
    await navigator.clipboard.writeText(activeInvite.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (!current) return null

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-5 text-2xl font-bold">Участники — {current.name}</h1>

      <section className="mb-6 space-y-1">
        {members.map((m) => (
          <div key={m.user_id} className="flex items-center gap-3 rounded-xl px-3 py-2.5">
            <Avatar profile={m.profile} size={34} />
            <div className="flex-1">
              <p className="text-[15px]">
                {m.profile.display_name}
                {m.user_id === userId && <span className="text-ink-faint"> (вы)</span>}
              </p>
              <p className="text-xs text-ink-faint">
                {m.role === 'owner' ? 'Владелец' : 'Участник'}
              </p>
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-2xl bg-surface-1 p-5">
        <h2 className="mb-2 font-semibold">Пригласить в пространство</h2>
        {activeInvite ? (
          <>
            <p className="mb-3 text-sm text-ink-dim">
              Передайте код — в приложении: «+» рядом с «Пространства» → «Вступить по коду».
            </p>
            <div className="flex items-center gap-3">
              <span className="rounded-xl bg-surface-2 px-5 py-3 font-mono text-2xl tracking-[0.3em]">
                {activeInvite.code}
              </span>
              <button
                onClick={copyCode}
                className="rounded-lg bg-surface-2 px-4 py-2 text-sm transition hover:bg-surface-3"
              >
                {copied ? 'Скопировано ✓' : 'Копировать'}
              </button>
            </div>
            <p className="mt-2 text-xs text-ink-faint">
              Код действует 7 дней с момента создания.
            </p>
          </>
        ) : (
          <button
            onClick={createInvite}
            className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
          >
            Создать код приглашения
          </button>
        )}
      </section>
    </div>
  )
}
