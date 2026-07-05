import { useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { supabaseConfigured } from './lib/supabase'
import { useAuth } from './auth/AuthProvider'
import AuthPage from './auth/AuthPage'
import { WorkspaceProvider, useWorkspace } from './hooks/useWorkspace'
import { useRealtimeSync } from './hooks/useRealtimeSync'
import Sidebar from './components/Sidebar'
import TodayPage from './pages/TodayPage'
import UpcomingPage from './pages/UpcomingPage'
import MyTasksPage from './pages/MyTasksPage'
import ListPage from './pages/ListPage'
import MembersPage from './pages/MembersPage'

function SetupScreen() {
  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <div className="max-w-md rounded-2xl bg-surface-1 p-6 text-sm leading-relaxed">
        <h1 className="mb-3 text-lg font-bold">⚙️ Нужна настройка Supabase</h1>
        <ol className="list-decimal space-y-2 pl-5 text-ink-dim">
          <li>Создайте бесплатный проект на <b className="text-ink">supabase.com</b></li>
          <li>Выполните <b className="text-ink">supabase/schema.sql</b> в SQL Editor</li>
          <li>
            Создайте файл <b className="text-ink">.env.local</b> в корне проекта:
            <pre className="mt-1 rounded-lg bg-surface-2 p-3 text-xs">
{`VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...`}
            </pre>
          </li>
          <li>Перезапустите dev-сервер</li>
        </ol>
        <p className="mt-3 text-xs text-ink-faint">Подробная инструкция — в README.md</p>
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <div className="flex min-h-full items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-surface-3 border-t-accent" />
    </div>
  )
}

function Shell() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { current, loading } = useWorkspace()
  useRealtimeSync()

  if (loading || !current) return <Spinner />

  return (
    <div className="flex h-full">
      {/* Сайдбар: постоянный на десктопе, выезжающий на мобильном */}
      <div className="hidden md:block">
        <Sidebar />
      </div>
      {menuOpen && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setMenuOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div className="absolute inset-y-0 left-0" onClick={(e) => e.stopPropagation()}>
            <Sidebar onNavigate={() => setMenuOpen(false)} />
          </div>
        </div>
      )}

      <main className="min-w-0 flex-1 overflow-y-auto">
        {/* Мобильная шапка */}
        <header className="sticky top-0 z-30 flex items-center gap-3 bg-surface-0/90 px-4 py-3 backdrop-blur md:hidden">
          <button
            onClick={() => setMenuOpen(true)}
            className="rounded-lg bg-surface-1 px-3 py-1.5 text-lg leading-none"
            aria-label="Меню"
          >
            ☰
          </button>
          <span className="font-semibold">{current.name}</span>
        </header>

        <Routes>
          <Route path="/" element={<TodayPage />} />
          <Route path="/upcoming" element={<UpcomingPage />} />
          <Route path="/mine" element={<MyTasksPage />} />
          <Route path="/list/:listId" element={<ListPage />} />
          <Route path="/members" element={<MembersPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  const { session, loading } = useAuth()

  if (!supabaseConfigured) return <SetupScreen />
  if (loading) return <Spinner />
  if (!session) return <AuthPage />

  return (
    <WorkspaceProvider>
      <Shell />
    </WorkspaceProvider>
  )
}
