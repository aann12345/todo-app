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

  async function setPref(field: string, v: string | boolean | number) {
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
  ]

  const WEEKDAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']

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

      {/* Расписание сводок */}
      <section className={`mt-4 rounded-2xl bg-surface-1 p-5 ${supported && pushOn ? '' : 'opacity-50'}`}>
        <h2 className="mb-3 font-semibold">🗓️ Ежедневная сводка</h2>

        <div className="flex items-center justify-between gap-3">
          <p className="text-[15px]">Присылать сводку</p>
          <Toggle
            checked={myProfile?.notify_digest !== false}
            onChange={(v) => setPref('notify_digest', v)}
            disabled={!pushOn}
          />
        </div>

        <div className={`mt-3 space-y-3 ${myProfile?.notify_digest !== false ? '' : 'opacity-40'}`}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-[15px]">Во сколько</p>
            <input
              type="time"
              className="rounded-lg bg-surface-2 px-3 py-2 text-sm outline-none"
              value={myProfile?.digest_time ?? '07:00'}
              onChange={(e) => setPref('digest_time', e.target.value)}
              disabled={!pushOn}
            />
          </div>
          <div>
            <p className="mb-1.5 text-[15px]">О каких задачах</p>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ['today', 'На сегодня'],
                  ['tomorrow', 'На завтра'],
                  ['today_tomorrow', 'Сегодня и завтра'],
                ] as const
              ).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setPref('digest_scope', val)}
                  disabled={!pushOn}
                  className={`rounded-full px-3 py-1.5 text-sm transition ${
                    (myProfile?.digest_scope ?? 'today') === val
                      ? 'bg-accent font-medium text-white'
                      : 'bg-surface-2 text-ink-dim hover:text-ink'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Недельная сводка */}
      <section className={`mt-4 rounded-2xl bg-surface-1 p-5 ${supported && pushOn ? '' : 'opacity-50'}`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">📅 Сводка на неделю</h2>
            <p className="mt-0.5 text-xs text-ink-faint">Например, в воскресенье вечером — план на 7 дней</p>
          </div>
          <Toggle
            checked={Boolean(myProfile?.weekly_enabled)}
            onChange={(v) => setPref('weekly_enabled', v)}
            disabled={!pushOn}
          />
        </div>

        {myProfile?.weekly_enabled && (
          <div className="mt-3 space-y-3">
            <div>
              <p className="mb-1.5 text-[15px]">В какой день</p>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAYS.map((d, i) => (
                  <button
                    key={i}
                    onClick={() => setPref('weekly_day', i)}
                    disabled={!pushOn}
                    className={`h-9 w-9 rounded-full text-sm transition ${
                      (myProfile?.weekly_day ?? 0) === i
                        ? 'bg-accent font-medium text-white'
                        : 'bg-surface-2 text-ink-dim hover:text-ink'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-[15px]">Во сколько</p>
              <input
                type="time"
                className="rounded-lg bg-surface-2 px-3 py-2 text-sm outline-none"
                value={myProfile?.weekly_time ?? '18:00'}
                onChange={(e) => setPref('weekly_time', e.target.value)}
                disabled={!pushOn}
              />
            </div>
          </div>
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
