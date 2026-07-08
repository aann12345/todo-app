import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useWorkspace } from './useWorkspace'
import { useUserId } from '../auth/AuthProvider'
import { nextOccurrence } from '../lib/recurrence'
import { categorize } from '../lib/categories'
import { showSnackbar } from '../lib/snackbar'
import { dueLabel } from '../lib/dates'
import { combineDateTime, timeFromISO } from '../lib/remind'
import type { List, Task } from '../types'

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
  quantity?: string | null
  checklist?: Task['checklist']
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
        quantity: input.quantity ?? null,
        category: categorize(input.title),
        checklist: input.checklist ?? [],
      })
      if (error) throw error
    },
    onSuccess: (_d, input) => {
      invalidate()
      // подтверждение с адресом: видно, КУДА улетела задача
      const lists = qc.getQueryData<List[]>(['lists', wsId])
      const listName = lists?.find((l) => l.id === input.list_id)?.name ?? 'список'
      const when = input.due_date ? `, срок: ${dueLabel(input.due_date)}` : ''
      showSnackbar({ text: `Добавлено в «${listName}»${when}` })
    },
    onError: (err) => {
      showSnackbar({ text: `Не удалось добавить: ${err.message}` })
    },
  })

  // добавить сразу несколько задач (список покупок за один раз)
  const addMany = useMutation({
    mutationFn: async (input: { items: TaskInput[]; list_id: string }) => {
      const rows = input.items.map((it) => ({
        workspace_id: wsId,
        created_by: userId,
        title: it.title,
        list_id: input.list_id,
        due_date: it.due_date ?? null,
        recurrence: it.recurrence ?? null,
        quantity: it.quantity ?? null,
        category: categorize(it.title),
      }))
      const { error } = await supabase.from('tasks').insert(rows)
      if (error) throw error
    },
    onSuccess: (_d, input) => {
      invalidate()
      const lists = qc.getQueryData<List[]>(['lists', wsId])
      const listName = lists?.find((l) => l.id === input.list_id)?.name ?? 'список'
      showSnackbar({ text: `Добавлено ${input.items.length} в «${listName}»` })
    },
    onError: (err) => {
      showSnackbar({ text: `Не удалось добавить: ${err.message}` })
    },
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
        const nextDue = nextOccurrence(task.recurrence, task.due_date)
        // переносим время напоминания на новую дату
        let nextRemind: string | null = null
        if (task.remind_at) {
          nextRemind = combineDateTime(nextDue, timeFromISO(task.remind_at))
        }
        const { error: err2 } = await supabase.from('tasks').insert({
          workspace_id: task.workspace_id,
          list_id: task.list_id,
          title: task.title,
          notes: task.notes,
          priority: task.priority,
          assignee_id: task.assignee_id,
          recurrence: task.recurrence,
          created_by: userId,
          due_date: nextDue,
          quantity: task.quantity,
          category: task.category,
          assignee_all: task.assignee_all,
          remind_at: nextRemind,
        })
        if (err2) throw err2
      }
      return completing
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
    onSuccess: (completing, task) => {
      // undo только для обычных задач: у повторяющихся уже создано след. вхождение
      if (completing && !task.recurrence) {
        showSnackbar({
          text: 'Задача выполнена',
          actionLabel: 'Отменить',
          onAction: async () => {
            await supabase.from('tasks').update({ completed_at: null }).eq('id', task.id)
            invalidate()
          },
        })
      }
    },
    onSettled: invalidate,
  })

  const deleteTask = useMutation({
    mutationFn: async (task: Task) => {
      const { error } = await supabase.from('tasks').delete().eq('id', task.id)
      if (error) throw error
    },
    onSuccess: (_d, task) => {
      invalidate()
      showSnackbar({
        text: `Удалено: «${task.title}»`,
        actionLabel: 'Вернуть',
        onAction: async () => {
          const { assignee: _a, ...row } = task
          await supabase.from('tasks').insert(row)
          invalidate()
        },
      })
    },
  })

  // сохранить порядок после перетаскивания: пишем position = индекс
  const reorder = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      await Promise.all(
        orderedIds.map((id, i) =>
          supabase.from('tasks').update({ position: i }).eq('id', id),
        ),
      )
    },
    onMutate: async (orderedIds) => {
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<Task[]>(key)
      qc.setQueryData<Task[]>(key, (old) =>
        (old ?? []).map((t) => {
          const i = orderedIds.indexOf(t.id)
          return i >= 0 ? { ...t, position: i } : t
        }),
      )
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev)
    },
    onSettled: invalidate,
  })

  return { addTask, addMany, updateTask, toggleComplete, deleteTask, reorder }
}
