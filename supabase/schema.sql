-- ============================================================
-- Схема для приложения задач (выполнить в Supabase SQL Editor)
-- ============================================================

-- ---------- Таблицы ----------

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  color text not null default '#4a8fe3',
  created_at timestamptz not null default now()
);

-- Ссылки на profiles (а не auth.users), чтобы PostgREST мог делать embed-джойны
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'family' check (kind in ('personal', 'family', 'work')),
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  code text not null unique,
  created_by uuid not null references public.profiles(id) on delete cascade,
  expires_at timestamptz not null default now() + interval '7 days',
  created_at timestamptz not null default now()
);

create table public.lists (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  emoji text,
  position double precision not null default 0,
  created_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists(id) on delete cascade,
  -- денормализовано из lists: нужно для RLS-политики и фильтра realtime-подписки
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null,
  notes text not null default '',
  due_date date,
  priority int not null default 4 check (priority between 1 and 4),
  assignee_id uuid references public.profiles(id) on delete set null,
  recurrence jsonb,
  completed_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete cascade,
  position double precision not null default 0,
  created_at timestamptz not null default now()
);

create index tasks_workspace_idx on public.tasks (workspace_id);
create index tasks_list_idx on public.tasks (list_id);
create index tasks_due_idx on public.tasks (due_date) where completed_at is null;
create index lists_workspace_idx on public.lists (workspace_id);

-- ---------- Вспомогательная функция для RLS ----------
-- security definer: обходит RLS самой workspace_members,
-- иначе политики зациклятся (infinite recursion)

create or replace function public.is_member(ws uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = ws and user_id = auth.uid()
  );
$$;

-- ---------- RLS ----------

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.invites enable row level security;
alter table public.lists enable row level security;
alter table public.tasks enable row level security;

-- Профили видны всем вошедшим (нужно, чтобы показывать имена участников),
-- редактировать можно только свой
create policy "profiles_select" on public.profiles
  for select to authenticated using (true);
create policy "profiles_update" on public.profiles
  for update to authenticated using (id = auth.uid());

-- Пространства: видят только участники
create policy "workspaces_select" on public.workspaces
  for select to authenticated using (public.is_member(id));
create policy "workspaces_insert" on public.workspaces
  for insert to authenticated with check (created_by = auth.uid());
create policy "workspaces_update" on public.workspaces
  for update to authenticated using (
    exists (select 1 from workspace_members
            where workspace_id = id and user_id = auth.uid() and role = 'owner')
  );
create policy "workspaces_delete" on public.workspaces
  for delete to authenticated using (
    exists (select 1 from workspace_members
            where workspace_id = id and user_id = auth.uid() and role = 'owner')
  );

-- Участники: список видят участники; вступление — только через join_workspace()
create policy "members_select" on public.workspace_members
  for select to authenticated using (public.is_member(workspace_id));
create policy "members_delete_self" on public.workspace_members
  for delete to authenticated using (user_id = auth.uid());

-- Приглашения: создают и видят участники пространства
create policy "invites_select" on public.invites
  for select to authenticated using (public.is_member(workspace_id));
create policy "invites_insert" on public.invites
  for insert to authenticated
  with check (public.is_member(workspace_id) and created_by = auth.uid());
create policy "invites_delete" on public.invites
  for delete to authenticated using (public.is_member(workspace_id));

-- Списки и задачи: полный доступ участникам пространства
create policy "lists_all" on public.lists
  for all to authenticated
  using (public.is_member(workspace_id))
  with check (public.is_member(workspace_id));

create policy "tasks_all" on public.tasks
  for all to authenticated
  using (public.is_member(workspace_id))
  with check (public.is_member(workspace_id));

-- ---------- Триггеры ----------

-- При создании пространства создатель автоматически становится owner
create or replace function public.handle_workspace_created()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into workspace_members (workspace_id, user_id, role)
  values (new.id, new.created_by, 'owner');
  return new;
end;
$$;

create trigger on_workspace_created
  after insert on public.workspaces
  for each row execute function public.handle_workspace_created();

-- При регистрации: профиль + личное пространство со списком «Входящие»
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  ws_id uuid;
begin
  insert into profiles (id, display_name, color)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), split_part(new.email, '@', 1)),
    (array['#e3654a','#e0a03d','#4a8fe3','#4ab87a','#a06ae3','#e35a8f'])[1 + floor(random() * 6)::int]
  );

  insert into workspaces (name, kind, created_by)
  values ('Личное', 'personal', new.id)
  returning id into ws_id;

  insert into lists (workspace_id, name, emoji, position)
  values (ws_id, 'Входящие', '📥', 0);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Вступление по коду приглашения ----------
-- security definer: читает invites и пишет в workspace_members в обход RLS,
-- т.к. вступающий ещё не участник

create or replace function public.join_workspace(invite_code text)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  inv record;
begin
  select * into inv from invites
  where code = upper(trim(invite_code)) and expires_at > now();

  if inv is null then
    raise exception 'INVITE_INVALID';
  end if;

  insert into workspace_members (workspace_id, user_id, role)
  values (inv.workspace_id, auth.uid(), 'member')
  on conflict (workspace_id, user_id) do nothing;

  return inv.workspace_id;
end;
$$;

-- ---------- Realtime ----------

alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.lists;

-- чтобы delete-события содержали данные строки для фильтрации на клиенте
alter table public.tasks replica identity full;
alter table public.lists replica identity full;
