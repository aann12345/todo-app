import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useWorkspace } from './useWorkspace'

/**
 * Подписка на изменения задач и списков текущего пространства.
 * Любое изменение (от любого участника семьи) инвалидирует кэш —
 * TanStack Query перезагружает данные, UI обновляется мгновенно.
 */
export function useRealtimeSync() {
  const { current } = useWorkspace()
  const qc = useQueryClient()
  const wsId = current?.id

  useEffect(() => {
    if (!wsId) return

    const channel = supabase
      .channel(`workspace-${wsId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `workspace_id=eq.${wsId}` },
        () => qc.invalidateQueries({ queryKey: ['tasks', wsId] }),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lists', filter: `workspace_id=eq.${wsId}` },
        () => qc.invalidateQueries({ queryKey: ['lists', wsId] }),
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [wsId, qc])
}
