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

  const updateList = useMutation({
    mutationFn: async (input: { id: string; name: string; emoji: string | null }) => {
      const { error } = await supabase
        .from('lists')
        .update({ name: input.name, emoji: input.emoji })
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

  const reorderLists = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      await Promise.all(
        orderedIds.map((id, i) => supabase.from('lists').update({ position: i }).eq('id', id)),
      )
    },
    onMutate: async (orderedIds) => {
      const qkey = ['lists', wsId]
      await qc.cancelQueries({ queryKey: qkey })
      const prev = qc.getQueryData<List[]>(qkey)
      qc.setQueryData<List[]>(qkey, (old) =>
        [...(old ?? [])].sort((a, b) => orderedIds.indexOf(a.id) - orderedIds.indexOf(b.id)),
      )
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['lists', wsId], ctx.prev)
    },
    onSettled: invalidate,
  })

  return { addList, updateList, deleteList, reorderLists }
}
