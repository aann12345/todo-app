// Edge Function: рассылка Web Push уведомлений.
// Вызывается триггерами из БД (task_added / task_assigned) и pg_cron (digest).
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

const APP_URL = 'https://aann12345.github.io/todo-app/'

interface Sub {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
}

interface TaskRecord {
  id: string
  workspace_id: string
  list_id: string
  title: string
  created_by: string
  assignee_id: string | null
  due_date: string | null
}

function need(name: string): string {
  const v = Deno.env.get(name)
  if (!v) throw new Error(`Не задан секрет ${name}`)
  return v
}

// ленивая инициализация: если что-то не настроено, ошибка попадёт в ответ,
// а не уронит воркер при старте
let ctx: {
  supabase: SupabaseClient
  webpush: typeof import('npm:web-push@3.6.7').default
} | null = null

async function init() {
  if (ctx) return ctx
  const webpush = (await import('npm:web-push@3.6.7')).default
  webpush.setVapidDetails(
    'mailto:04ananda@gmail.com',
    need('VAPID_PUBLIC_KEY'),
    need('VAPID_PRIVATE_KEY'),
  )
  const supabase = createClient(need('SUPABASE_URL'), need('SUPABASE_SERVICE_ROLE_KEY'))
  ctx = { supabase, webpush }
  return ctx
}

async function sendTo(subs: Sub[], payload: { title: string; body: string }) {
  const { supabase, webpush } = await init()
  const json = JSON.stringify({ ...payload, url: APP_URL })
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          json,
        )
      } catch (err) {
        const code = (err as { statusCode?: number }).statusCode
        if (code === 404 || code === 410) {
          await supabase.from('push_subscriptions').delete().eq('id', s.id)
        }
      }
    }),
  )
}

async function subsForUsers(userIds: string[]): Promise<Sub[]> {
  if (!userIds.length) return []
  const { supabase } = await init()
  const { data } = await supabase
    .from('push_subscriptions')
    .select('*')
    .in('user_id', userIds)
  return (data ?? []) as Sub[]
}

async function handleTaskAdded(rec: TaskRecord) {
  const { supabase } = await init()
  const [{ data: author }, { data: list }, { data: members }] = await Promise.all([
    supabase.from('profiles').select('display_name').eq('id', rec.created_by).single(),
    supabase.from('lists').select('name').eq('id', rec.list_id).single(),
    supabase
      .from('workspace_members')
      .select('user_id, profile:profiles(notify_added)')
      .eq('workspace_id', rec.workspace_id),
  ])

  const recipients = (members ?? [])
    .filter((m) => m.user_id !== rec.created_by)
    .filter((m) => (m.profile as { notify_added?: boolean } | null)?.notify_added !== false)
    .map((m) => m.user_id)

  await sendTo(await subsForUsers(recipients), {
    title: list?.name ?? 'Задачи',
    body: `${author?.display_name ?? 'Кто-то'} добавил(а) «${rec.title}»`,
  })

  if (rec.assignee_id && rec.assignee_id !== rec.created_by) {
    await handleTaskAssigned(rec)
  }
}

async function handleTaskAssigned(rec: TaskRecord) {
  if (!rec.assignee_id) return
  const { supabase } = await init()
  const { data: assignee } = await supabase
    .from('profiles')
    .select('notify_assigned')
    .eq('id', rec.assignee_id)
    .single()
  if (assignee?.notify_assigned === false) return

  const due = rec.due_date ? ` — срок ${rec.due_date}` : ''
  await sendTo(await subsForUsers([rec.assignee_id]), {
    title: 'Вам назначили задачу',
    body: `«${rec.title}»${due}`,
  })
}

// задачу пометили «Вместе» — уведомляем всех участников, кроме автора действия
async function handleTaskAssignedAll(rec: TaskRecord) {
  const { supabase } = await init()
  const { data: members } = await supabase
    .from('workspace_members')
    .select('user_id, profile:profiles(notify_assigned)')
    .eq('workspace_id', rec.workspace_id)
  const recipients = (members ?? [])
    .filter((m) => m.user_id !== rec.created_by)
    .filter((m) => (m.profile as { notify_assigned?: boolean } | null)?.notify_assigned !== false)
    .map((m) => m.user_id)
  const due = rec.due_date ? ` — срок ${rec.due_date}` : ''
  await sendTo(await subsForUsers(recipients), {
    title: 'Общая задача 👥',
    body: `«${rec.title}»${due}`,
  })
}

// ---------- Ежеминутный тик: напоминания + сводки по расписанию ----------

const MSK_OFFSET_MS = 3 * 60 * 60 * 1000 // Москва = UTC+3 (без перехода на летнее время)

function mskNow() {
  const d = new Date(Date.now() + MSK_OFFSET_MS)
  const hhmm = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
  const isoDate = d.toISOString().slice(0, 10)
  return { hhmm, weekday: d.getUTCDay(), isoDate }
}

// 1) Отправить сработавшие напоминания у задач
async function runReminders() {
  const { supabase } = await init()
  const nowIso = new Date().toISOString()
  const { data: due } = await supabase
    .from('tasks')
    .select('id, title, workspace_id, assignee_id, assignee_all, created_by, remind_at')
    .lte('remind_at', nowIso)
    .eq('reminded', false)
    .is('completed_at', null)

  for (const t of (due ?? []) as TaskRecord[] & { remind_at: string }[]) {
    // получатели: исполнитель / все участники (Вместе) / автор
    let recipients: string[]
    if (t.assignee_all) {
      const { data: members } = await supabase
        .from('workspace_members')
        .select('user_id')
        .eq('workspace_id', t.workspace_id)
      recipients = (members ?? []).map((m) => m.user_id)
    } else {
      recipients = [t.assignee_id ?? t.created_by]
    }
    await sendTo(await subsForUsers(recipients), {
      title: '🔔 Напоминание',
      body: t.title,
    })
    await supabase.from('tasks').update({ reminded: true }).eq('id', t.id)
  }
}

async function countTasks(wsIds: string[], filter: (q: any) => any): Promise<number> {
  const { supabase } = await init()
  let q = supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .in('workspace_id', wsIds)
    .is('completed_at', null)
  q = filter(q)
  const { count } = await q
  return count ?? 0
}

// 2) Сводки, у которых наступило запланированное время
async function runDigests() {
  const { supabase } = await init()
  const { hhmm, weekday, isoDate } = mskNow()
  const { data: subs } = await supabase.from('push_subscriptions').select('*')
  const userIds = [...new Set((subs ?? []).map((s) => s.user_id))]

  const tomorrow = new Date(Date.now() + MSK_OFFSET_MS + 24 * 3600 * 1000)
    .toISOString()
    .slice(0, 10)
  const weekEnd = new Date(Date.now() + MSK_OFFSET_MS + 7 * 24 * 3600 * 1000)
    .toISOString()
    .slice(0, 10)

  for (const uid of userIds) {
    const { data: p } = await supabase
      .from('profiles')
      .select('notify_digest, digest_time, digest_scope, weekly_enabled, weekly_day, weekly_time, notify_overdue')
      .eq('id', uid)
      .single()
    if (!p) continue

    const { data: memberships } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', uid)
    const wsIds = (memberships ?? []).map((m) => m.workspace_id)
    if (!wsIds.length) continue
    const userSubs = (subs ?? []).filter((s) => s.user_id === uid) as Sub[]

    // ежедневная сводка
    if (p.notify_digest !== false && p.digest_time === hhmm) {
      const parts: string[] = []
      if (p.digest_scope === 'today' || p.digest_scope === 'today_tomorrow') {
        const n = await countTasks(wsIds, (q) => q.lte('due_date', isoDate))
        const overdue = await countTasks(wsIds, (q) => q.lt('due_date', isoDate))
        if (n) parts.push(`сегодня ${n}${overdue ? ` (просрочено ${overdue})` : ''}`)
      }
      if (p.digest_scope === 'tomorrow' || p.digest_scope === 'today_tomorrow') {
        const n = await countTasks(wsIds, (q) => q.eq('due_date', tomorrow))
        if (n) parts.push(`завтра ${n}`)
      }
      if (parts.length) {
        await sendTo(userSubs, { title: 'Задачи на день 📋', body: parts.join(', ') })
      }

      // отдельное уведомление о просрочке
      if (p.notify_overdue !== false) {
        const overdue = await countTasks(wsIds, (q) => q.lt('due_date', isoDate))
        if (overdue) {
          await sendTo(userSubs, {
            title: '⚠️ Просроченные задачи',
            body: `Не выполнено в срок: ${overdue}`,
          })
        }
      }
    }

    // недельная сводка
    if (p.weekly_enabled && p.weekly_day === weekday && p.weekly_time === hhmm) {
      const n = await countTasks(wsIds, (q) => q.gte('due_date', isoDate).lte('due_date', weekEnd))
      await sendTo(userSubs, {
        title: 'План на неделю 🗓️',
        body: n ? `На ближайшие 7 дней задач: ${n}` : 'На неделю задач пока нет',
      })
    }
  }
}

async function handleTick() {
  await runReminders()
  await runDigests()
}

Deno.serve(async (req) => {
  try {
    if (req.headers.get('x-webhook-secret') !== need('WEBHOOK_SECRET')) {
      return new Response('forbidden', { status: 403 })
    }

    const { type, record } = await req.json()

    if (type === 'task_added') await handleTaskAdded(record)
    else if (type === 'task_assigned') await handleTaskAssigned(record)
    else if (type === 'task_assigned_all') await handleTaskAssignedAll(record)
    else if (type === 'tick') await handleTick()
    else return new Response(`unknown type: ${type}`, { status: 400 })

    return new Response('ok')
  } catch (err) {
    // текст ошибки в ответ — чтобы диагностировать без доступа к логам
    return new Response(`error: ${err instanceof Error ? err.message : String(err)}`, {
      status: 500,
    })
  }
})
