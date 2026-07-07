import { useState, type FormEvent } from 'react'
import { NavLink } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useWorkspace } from '../hooks/useWorkspace'
import { useLists, useListMutations } from '../hooks/useLists'
import { useTasks } from '../hooks/useTasks'
import { isoIn, todayISO } from '../lib/dates'
import Avatar from './Avatar'

function navCls({ isActive }: { isActive: boolean }) {
  return `flex items-center justify-between rounded-lg px-3 py-2 text-[15px] transition ${
    isActive ? 'bg-accent-soft font-medium text-accent' : 'text-ink-dim hover:bg-surface-2 hover:text-ink'
  }`
}

export default function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { myProfile } = useWorkspace()
  const lists = useLists()
  const { addList } = useListMutations()
  const { tasks } = useTasks()
  const [newList, setNewList] = useState('')
  const [addingList, setAddingList] = useState(false)

  const today = todayISO()
  const todayCount = tasks.filter((t) => !t.completed_at && t.due_date && t.due_date <= today).length
  const tomorrow = isoIn(1)
  const tomorrowCount = tasks.filter((t) => !t.completed_at && t.due_date === tomorrow).length

  function submitList(e: FormEvent) {
    e.preventDefault()
    const name = newList.trim()
    if (!name) return
    addList.mutate({ name })
    setNewList('')
    setAddingList(false)
  }

  return (
    <aside className="flex h-full w-72 flex-col bg-surface-1 p-4">
      {/* Виды текущего пространства (пространства переключаются вкладками сверху) */}
      <nav className="flex flex-col gap-0.5" onClick={onNavigate}>
        <NavLink to="/" end className={navCls}>
          <span>📆 Сегодня</span>
          {todayCount > 0 && <span className="text-xs text-ink-faint">{todayCount}</span>}
        </NavLink>
        <NavLink to="/tomorrow" className={navCls}>
          <span>☀️ Завтра</span>
          {tomorrowCount > 0 && <span className="text-xs text-ink-faint">{tomorrowCount}</span>}
        </NavLink>
        <NavLink to="/week" className={navCls}>
          <span>🗓️ Ближайшие 7 дней</span>
        </NavLink>
        <NavLink to="/month" className={navCls}>
          <span>📆 В этом месяце</span>
        </NavLink>
        <NavLink to="/someday" className={navCls}>
          <span>🗄️ Долгий ящик</span>
        </NavLink>
        <NavLink to="/mine" className={navCls}>
          <span>👤 Мои задачи</span>
        </NavLink>
      </nav>

      {/* Списки */}
      <div className="mt-3 min-h-0 flex-1 overflow-y-auto border-t border-surface-2 pt-3">
        <div className="mb-1 flex items-center justify-between px-1">
          <span className="text-xs font-semibold tracking-wide text-ink-faint uppercase">
            Списки
          </span>
          <button
            onClick={() => setAddingList(true)}
            className="rounded px-1.5 text-lg leading-none text-ink-dim transition hover:text-accent"
            title="Новый список"
          >
            +
          </button>
        </div>
        <div className="flex flex-col gap-0.5" onClick={onNavigate}>
          {lists.map((l) => {
            const count = tasks.filter((t) => t.list_id === l.id && !t.completed_at).length
            return (
              <NavLink key={l.id} to={`/list/${l.id}`} className={navCls}>
                <span className="truncate">
                  {l.emoji ?? '•'} {l.name}
                </span>
                {count > 0 && <span className="text-xs text-ink-faint">{count}</span>}
              </NavLink>
            )
          })}
        </div>
        {addingList && (
          <form onSubmit={submitList} className="mt-1 px-1">
            <input
              autoFocus
              className="w-full rounded-lg bg-surface-2 px-3 py-2 text-sm outline-none placeholder:text-ink-faint focus:ring-2 focus:ring-accent"
              placeholder="Название списка"
              value={newList}
              onChange={(e) => setNewList(e.target.value)}
              onBlur={() => !newList.trim() && setAddingList(false)}
              onKeyDown={(e) => e.key === 'Escape' && setAddingList(false)}
            />
          </form>
        )}
      </div>

      {/* Пользователь */}
      <div className="mt-3 flex items-center gap-2.5 border-t border-surface-2 pt-3">
        {myProfile && <Avatar profile={myProfile} size={30} />}
        <span className="min-w-0 flex-1 truncate text-sm">{myProfile?.display_name}</span>
        <NavLink
          to="/settings"
          onClick={onNavigate}
          className="rounded-lg px-2 py-1 text-sm text-ink-faint transition hover:bg-surface-2 hover:text-ink"
          title="Настройки"
        >
          ⚙️
        </NavLink>
        <button
          onClick={() => supabase.auth.signOut()}
          className="rounded-lg px-2 py-1 text-xs text-ink-faint transition hover:bg-surface-2 hover:text-ink"
          title="Выйти"
        >
          Выйти
        </button>
      </div>

    </aside>
  )
}
