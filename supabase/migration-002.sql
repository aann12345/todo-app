-- ============================================================
-- Миграция 002: комментарии, чек-листы, категории, уведомления
-- Выполнить в Supabase SQL Editor ПОСЛЕ schema.sql
-- ============================================================

-- ---------- Новые поля задач ----------

alter table public.tasks add column if not exists quantity text;
alter table public.tasks add column if not exists category text;
alter table public.tasks add column if not exists checklist jsonb not null default '[]'::jsonb;

-- ---------- Комментарии ----------

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
create index comments_task_idx on public.comments (task_id);

alter table public.comments enable row level security;

create policy "comments_select" on public.comments
  for select to authenticated using (public.is_member(workspace_id));
create policy "comments_insert" on public.comments
  for insert to authenticated
  with check (public.is_member(workspace_id) and author_id = auth.uid());
create policy "comments_delete" on public.comments
  for delete to authenticated using (author_id = auth.uid());

alter publication supabase_realtime add table public.comments;
alter table public.comments replica identity full;

-- ---------- Push-подписки и настройки уведомлений ----------

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

create policy "push_subs_all" on public.push_subscriptions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

alter table public.profiles add column if not exists notify_added boolean not null default true;
alter table public.profiles add column if not exists notify_assigned boolean not null default true;
alter table public.profiles add column if not exists notify_digest boolean not null default true;

-- ---------- Триггеры отправки пушей через Edge Function ----------

create extension if not exists pg_net with schema extensions;

create or replace function public.notify_push()
returns trigger
language plpgsql security definer
set search_path = public, extensions
as $$
begin
  perform net.http_post(
    url := 'https://orpddxcnuxzihzonnvvx.supabase.co/functions/v1/push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', 'c1effa1bb10d94f07c4659e4e4b6ca9e480ac2c00dbefb42'
    ),
    body := jsonb_build_object('type', tg_argv[0], 'record', to_jsonb(new))
  );
  return new;
end;
$$;

-- кто-то добавил задачу в пространство
create trigger on_task_added
  after insert on public.tasks
  for each row execute function public.notify_push('task_added');

-- задачу назначили (смена исполнителя)
create trigger on_task_assigned
  after update of assignee_id on public.tasks
  for each row
  when (new.assignee_id is not null and new.assignee_id is distinct from old.assignee_id)
  execute function public.notify_push('task_assigned');

-- ---------- Утренняя сводка (07:00 МСК = 04:00 UTC) ----------

create extension if not exists pg_cron;

select cron.schedule(
  'daily-digest',
  '0 4 * * *',
  $$
  select net.http_post(
    url := 'https://orpddxcnuxzihzonnvvx.supabase.co/functions/v1/push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', 'c1effa1bb10d94f07c4659e4e4b6ca9e480ac2c00dbefb42'
    ),
    body := jsonb_build_object('type', 'digest')
  );
  $$
);
