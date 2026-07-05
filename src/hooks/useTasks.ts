import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useWorkspace } from './useWorkspace'
import { useUserId } from '../auth/AuthProvider'
import { nextOccurrence } from '../lib/recurrence'
import type { Task } from '../types'

const TASK_SELECT = '*, assignee:profiles!tasks_assignee_id_fkey(id, display_name, color)'

export function useTasks() {
  const { current } = useWorkspace()
  const wsId = current?.id

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks', wsId],
    enabled: Boolean(wsId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select(TASK_SELECT)
        .eq('workspace_id', wsId!)
        .order('position')
        .order('created_at')
      if (error) throw error
      return data as unknown as Task[]
    },
  })

  return { tasks, isLoading }
}

export interface TaskInput {
  title: string
  list_id: string
  notes?: string
  due_date?: string | null
  priority?: number
  assignee_id?: string | null
  recurrence?: Task['recurrence']
}

export function useTaskMutations() {
  const { current } = useWorkspace()
  const userId = useUserId()
  const qc = useQueryClient()
  const wsId = current?.id
  const key = ['tasks', wsId]
  const invalidate = () => qc.invalidateQueries({ queryKey: key })

  const addTask = useMutation({
    mutationFn: async (input: TaskInput) => {
      const { error } = await supabase.from('tasks').insert({
        workspace_id: wsId,
        created_by: userId,
        title: input.title,
        list_id: input.list_id,
        notes: input.notes ?? '',
        due_date: input.due_date ?? null,
        priority: input.priority ?? 4,
        assignee_id: input.assignee_id ?? null,
        recurrence: input.recurrence ?? null,
      })
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const updateTask = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Task> & { id: string }) => {
      delete (patch as Record<string, unknown>).assignee
      const { error } = await supabase.from('tasks').update(patch).eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  /**
   * Выполнение задачи. Если у неё есть повтор и срок —
   * создаём следующее вхождение (как в Todoist).
   */
  const toggleComplete = useMutation({
    mutationFn: async (task: Task) => {
      const completing = !task.completed_at
      const { error } = await supabase
        .from('tasks')
        .update({ completed_at: completing ? new Date().toISOString() : null })
        .eq('id', task.id)
      if (error) throw error

      if (completing && task.recurrence && task.due_date) {
        const { error: err2 } = await supabase.from('tasks').insert({
          workspace_id: task.workspace_id,
          list_id: task.list_id,
          title: task.title,
          notes: task.notes,
          priority: task.priority,
          assignee_id: task.assignee_id,
          recurrence: task.recurrence,
          created_by: userId,
          due_date: nextOccurrence(task.recurrence, task.due_date),
        })
        if (err2) throw err2
      }
    },
    // оптимистично переключаем чекбокс, чтобы UI не ждал сеть
    onMutate: async (task) => {
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<Task[]>(key)
      qc.setQueryData<Task[]>(key, (old) =>
        (old ?? []).map((t) =>
          t.id === task.id
            ? { ...t, completed_at: t.completed_at ? null : new Date().toISOString() }
            : t,
        ),
      )
      return { prev }
    },
    onError: (_e, _t, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev)
    },
    onSettled: invalidate,
  })

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tasks').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  return { addTask, updateTask, toggleComplete, deleteTask }
}
