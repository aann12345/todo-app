import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useUserId } from '../auth/AuthProvider'
import type { Member, Profile, Workspace, WorkspaceKind } from '../types'

interface WorkspaceCtx {
  workspaces: Workspace[]
  current: Workspace | null
  setCurrentId: (id: string) => void
  members: Member[]
  myProfile: Profile | null
  loading: boolean
  createWorkspace: (name: string, kind: WorkspaceKind) => Promise<void>
}

const Ctx = createContext<WorkspaceCtx | null>(null)

const LS_KEY = 'currentWorkspaceId'

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const userId = useUserId()
  const qc = useQueryClient()
  const [currentId, setCurrentIdState] = useState<string | null>(
    () => localStorage.getItem(LS_KEY),
  )

  const { data: workspaces = [], isLoading } = useQuery({
    queryKey: ['workspaces'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workspaces')
        .select('*')
        .order('created_at')
      if (error) throw error
      return data as Workspace[]
    },
  })

  // личное пространство создаётся триггером чуть позже signUp — коротко поллим, пока пусто
  useEffect(() => {
    if (isLoading || workspaces.length > 0) return
    const t = setTimeout(() => qc.invalidateQueries({ queryKey: ['workspaces'] }), 1500)
    return () => clearTimeout(t)
  }, [isLoading, workspaces.length, qc])

  const current = useMemo(
    () =>
      workspaces.find((w) => w.id === currentId) ??
      workspaces.find((w) => w.kind === 'personal') ??
      workspaces[0] ??
      null,
    [workspaces, currentId],
  )

  function setCurrentId(id: string) {
    setCurrentIdState(id)
    localStorage.setItem(LS_KEY, id)
  }

  const { data: members = [] } = useQuery({
    queryKey: ['members', current?.id],
    enabled: Boolean(current),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workspace_members')
        .select('user_id, role, profile:profiles(id, display_name, color)')
        .eq('workspace_id', current!.id)
      if (error) throw error
      return data as unknown as Member[]
    },
  })

  const { data: myProfile = null } = useQuery({
    queryKey: ['profile', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      if (error) throw error
      return data as Profile
    },
  })

  async function createWorkspace(name: string, kind: WorkspaceKind) {
    // id генерируем на клиенте: INSERT ... RETURNING не проходит RLS-проверку
    // чтения, т.к. триггер членства срабатывает уже после вычисления RETURNING
    const id = crypto.randomUUID()
    const { error } = await supabase
      .from('workspaces')
      .insert({ id, name, kind, created_by: userId })
    if (error) throw error
    await supabase.from('lists').insert({
      workspace_id: id,
      name: kind === 'family' ? 'Покупки' : 'Задачи',
      emoji: kind === 'family' ? '🛒' : '📋',
    })
    await qc.invalidateQueries({ queryKey: ['workspaces'] })
    setCurrentId(id)
  }

  return (
    <Ctx.Provider
      value={{
        workspaces,
        current,
        setCurrentId,
        members,
        myProfile,
        loading: isLoading,
        createWorkspace,
      }}
    >
      {children}
    </Ctx.Provider>
  )
}

export function useWorkspace() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useWorkspace вне WorkspaceProvider')
  return ctx
}
