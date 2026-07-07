import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { versionLabel } from '../lib/version'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useUserId } from '../auth/AuthProvider'
import { useWorkspace } from '../hooks/useWorkspace'
import {
  getExistingSubscription,
  pushSupported,
  subscribePush,
  unsubscribePush,
} from '../lib/push'

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${
        checked ? 'bg-accent' : 'bg-surface-3'
      } disabled:opacity-40`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
          checked ? 'left-[22px]' : 'left-0.5'
        }`}
      />
    </button>
  )
}

export default function SettingsPage() {
  const userId = useUserId()
  const { myProfile, current, members } = useWorkspace()
  const qc = useQueryClient()
  const [pushOn, setPushOn] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const supported = pushSupported()

  useEffect(() => {
    getExistingSubscription().then((s) => setPushOn(Boolean(s)))
  }, [])

  async function togglePush(on: boolean) {
    setBusy(true)
    setError('')
    try {
      if (on) await subscribePush(userId)
      else await unsubscribePush()
      setPushOn(on)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function setPref(field: 'notify_added' | 'notify_assigned' | 'notify_digest', v: boolean) {
    await supabase.from('profiles').update({ [field]: v }).eq('id', userId)
    qc.invalidateQueries({ queryKey: ['profile', userId] })
  }

  const prefs = [
    {
      field: 'notify_added' as const,
      title: 'Новые задачи в общих списках',
      hint: '«Аня добавила Хлеб в Покупки»',
    },
    {
      field: 'notify_assigned' as const,
      title: 'Задачи, назначенные мне',
      hint: '«Вам назначили задачу»',
    },
    {
      field: 'notify_digest' as const,
      title: 'Утренняя сводка',
      hint: 'В 7:00 — сколько задач на сегодня',
    },
  ]

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-5 text-2xl font-bold">Настройки</h1>

      {current && current.kind !== 'personal' && (
        <Link
          to="/members"
          className="mb-4 flex items-center justify-between rounded-2xl bg-surface-1 p-5 transition hover:bg-surface-2"
        >
          <div>
            <p className="font-semibold">👥 Участники — {current.name}</p>
            <p className="mt-0.5 text-xs text-ink-faint">
              Приглашения по коду и список участников
            </p>
          </div>
          <span className="flex items-center gap-2 text-ink-dim">
            {members.length}
            <span className="text-lg">›</span>
          </span>
        </Link>
      )}

      <section className="rounded-2xl bg-surface-1 p-5">
        <h2 className="mb-1 font-semibold">🔔 Уведомления</h2>

        {!supported && (
          <p className="mt-2 text-sm text-p2">
            Этот браузер не поддерживает push-уведомления.
            На iPhone сначала установите приложение на экран «Домой»
            (Safari → Поделиться → На экран «Домой»), затем откройте его и включите уведомления здесь.
          </p>
        )}

        {supported && (
          <>
            <div className="mt-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-[15px]">Push-уведомления на этом устройстве</p>
                <p className="text-xs text-ink-faint">
                  Включается отдельно на каждом устройстве
                </p>
              </div>
              <Toggle checked={pushOn} onChange={togglePush} disabled={busy} />
            </div>
            {error && <p className="mt-2 text-sm text-p1">{error}</p>}

            <div className={`mt-4 space-y-3 border-t border-surface-2 pt-4 ${pushOn ? '' : 'opacity-40'}`}>
              {prefs.map((p) => (
                <div key={p.field} className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[15px]">{p.title}</p>
                    <p className="text-xs text-ink-faint">{p.hint}</p>
                  </div>
                  <Toggle
                    checked={myProfile?.[p.field] !== false}
                    onChange={(v) => setPref(p.field, v)}
                    disabled={!pushOn}
                  />
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <p className="mt-4 px-1 text-xs text-ink-faint">
        Уведомления о добавленных задачах приходят только участникам общих пространств
        (кроме автора задачи). Настройки действуют на все ваши устройства.
      </p>

      <p className="mt-6 px-1 text-center text-xs text-ink-faint">
        Версия приложения: {versionLabel()}
      </p>
    </div>
  )
}
