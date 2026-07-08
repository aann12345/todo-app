-- ============================================================
-- Миграция 004: напоминания по времени + гибкое расписание сводок
-- Выполнить в Supabase SQL Editor
-- ============================================================

-- ---------- Напоминание у задачи ----------
-- remind_at — абсолютный момент (UTC), вычисляется клиентом из даты+времени.
-- reminded — уже отправлено (чтобы не слать повторно).
alter table public.tasks add column if not exists remind_at timestamptz;
alter table public.tasks add column if not exists reminded boolean not null default false;

create index if not exists tasks_remind_idx
  on public.tasks (remind_at) where remind_at is not null and reminded = false;

-- ---------- Расписание сводок в профиле ----------
-- Время хранится как строка «ЧЧ:ММ» по МСК (UTC+3).
alter table public.profiles add column if not exists digest_time text not null default '07:00';
alter table public.profiles add column if not exists digest_scope text not null default 'today'
  check (digest_scope in ('today', 'tomorrow', 'today_tomorrow'));
alter table public.profiles add column if not exists weekly_enabled boolean not null default false;
alter table public.profiles add column if not exists weekly_day int not null default 0;   -- 0=вс … 6=сб
alter table public.profiles add column if not exists weekly_time text not null default '18:00';
alter table public.profiles add column if not exists notify_overdue boolean not null default true;

-- ---------- Уведомление для общих задач («Вместе») ----------
-- когда задачу пометили «Вместе», уведомляем всех участников (как назначение)
create trigger on_task_assigned_all
  after update of assignee_all on public.tasks
  for each row
  when (new.assignee_all = true and old.assignee_all is distinct from new.assignee_all)
  execute function public.notify_push('task_assigned_all');

-- ---------- Cron: один тик в минуту ----------
-- Заменяем старую утреннюю сводку на универсальный «tick», который
-- сам решает, кому что слать (напоминания + сводки по времени).
select cron.unschedule('daily-digest');

select cron.schedule(
  'app-tick',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://orpddxcnuxzihzonnvvx.supabase.co/functions/v1/push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', 'b1210e8b3870eecc0350b12a9fdeb3d97ab35fdb7edea0f7'
    ),
    body := jsonb_build_object('type', 'tick')
  );
  $$
);
