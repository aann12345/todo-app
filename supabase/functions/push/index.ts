// Edge Function: рассылка Web Push уведомлений.
// Вызывается триггерами из БД (task_added / task_assigned) и pg_cron (digest).
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

webpush.setVapidDetails(
  'mailto:04ananda@gmail.com',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
)

const APP_URL = 'https://aann12345.github.io/todo-app/'

interface Sub {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
}

async function sendTo(subs: Sub[], payload: { title: string; body: string }) {
  const json = JSON.stringify({ ...payload, url: APP_URL })
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          json,
        )
      } catch (err) {
        // подписка умерла (браузер отозвал) — удаляем
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
  const { data } = await supabase
    .from('push_subscriptions')
    .select('*')
    .in('user_id', userIds)
  return (data ?? []) as Sub[]
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

async function handleTaskAdded(rec: TaskRecord) {
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

  // назначили сразу при создании
  if (rec.assignee_id && rec.assignee_id !== rec.created_by) {
    await handleTaskAssigned(rec)
  }
}

async function handleTaskAssigned(rec: TaskRecord) {
  if (!rec.assignee_id) return
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

async function handleDigest() {
  const today = new Date().toISOString().slice(0, 10)
  const { data: subs } = await supabase.from('push_subscriptions').select('*')
  const userIds = [...new Set((subs ?? []).map((s) => s.user_id))]

  for (const uid of userIds) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('notify_digest')
      .eq('id', uid)
      .single()
    if (profile?.notify_digest === false) continue

    const { data: memberships } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', uid)
    const wsIds = (memberships ?? []).map((m) => m.workspace_id)
    if (!wsIds.length) continue

    const { count: dueCount } = await supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .in('workspace_id', wsIds)
      .is('completed_at', null)
      .lte('due_date', today)
    const { count: overdueCount } = await supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .in('workspace_id', wsIds)
      .is('completed_at', null)
      .lt('due_date', today)

    if (!dueCount) continue

    const overdue = overdueCount ? `, из них ${overdueCount} просрочено` : ''
    await sendTo(
      (subs ?? []).filter((s) => s.user_id === uid) as Sub[],
      { title: 'Доброе утро 👋', body: `На сегодня ${dueCount} задач(и)${overdue}` },
    )
  }
}

Deno.serve(async (req) => {
  if (req.headers.get('x-webhook-secret') !== Deno.env.get('WEBHOOK_SECRET')) {
    return new Response('forbidden', { status: 403 })
  }

  const { type, record } = await req.json()

  if (type === 'task_added') await handleTaskAdded(record)
  else if (type === 'task_assigned') await handleTaskAssigned(record)
  else if (type === 'digest') await handleDigest()

  return new Response('ok')
})
