import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useUserId } from '../auth/AuthProvider'
import type { Comment } from '../types'

export function useComments(taskId: string, workspaceId: string) {
  const qc = useQueryClient()
  const userId = useUserId()
  const key = ['comments', taskId]

  const { data: comments = [] } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('comments')
        .select('*, author:profiles(id, display_name, color)')
        .eq('task_id', taskId)
        .order('created_at')
      if (error) throw error
      return data as unknown as Comment[]
    },
  })

  // живое обновление, пока открыта карточка задачи
  useEffect(() => {
    const channel = supabase
      .channel(`comments-${taskId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'comments', filter: `task_id=eq.${taskId}` },
        () => qc.invalidateQueries({ queryKey: key }),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId])

  const addComment = useMutation({
    mutationFn: async (body: string) => {
      const { error } = await supabase.from('comments').insert({
        task_id: taskId,
        workspace_id: workspaceId,
        author_id: userId,
        body,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  })

  return { comments, addComment }
}
