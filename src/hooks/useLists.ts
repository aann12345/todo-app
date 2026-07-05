import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useWorkspace } from './useWorkspace'
import type { List } from '../types'

export function useLists() {
  const { current } = useWorkspace()
  const wsId = current?.id

  const { data: lists = [] } = useQuery({
    queryKey: ['lists', wsId],
    enabled: Boolean(wsId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lists')
        .select('*')
        .eq('workspace_id', wsId!)
        .order('position')
        .order('created_at')
      if (error) throw error
      return data as List[]
    },
  })

  return lists
}

export function useListMutations() {
  const { current } = useWorkspace()
  const qc = useQueryClient()
  const wsId = current?.id
  const invalidate = () => qc.invalidateQueries({ queryKey: ['lists', wsId] })

  const addList = useMutation({
    mutationFn: async (input: { name: string; emoji?: string }) => {
      const { error } = await supabase.from('lists').insert({
        workspace_id: wsId,
        name: input.name,
        emoji: input.emoji ?? null,
      })
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const renameList = useMutation({
    mutationFn: async (input: { id: string; name: string }) => {
      const { error } = await supabase
        .from('lists')
        .update({ name: input.name })
        .eq('id', input.id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const deleteList = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('lists').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      invalidate()
      qc.invalidateQueries({ queryKey: ['tasks', wsId] })
    },
  })

  return { addList, renameList, deleteList }
}
