-- Миграция 003: исполнитель «Вместе» (задача для всех участников)
alter table public.tasks add column if not exists assignee_all boolean not null default false;
