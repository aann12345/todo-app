import { addDays, addMonths, format, getDay, parseISO } from 'date-fns'
import type { Recurrence } from '../types'

export const WEEKDAY_LABELS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб']

/**
 * Дата следующего вхождения после выполнения задачи.
 * Считается от срока задачи (как в Todoist), но не раньше завтрашнего дня —
 * чтобы просроченная ежедневная задача не породила снова просроченную.
 */
export function nextOccurrence(rec: Recurrence, dueDate: string): string {
  const base = parseISO(dueDate)
  const interval = Math.max(1, rec.interval || 1)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let next: Date
  switch (rec.freq) {
    case 'daily':
      next = addDays(base, interval)
      while (next <= today) next = addDays(next, interval)
      break
    case 'weekly': {
      const days = rec.byweekday?.length ? rec.byweekday : [getDay(base)]
      next = addDays(base > today ? base : today, 1)
      for (let i = 0; i < 8 * interval; i++) {
        if (days.includes(getDay(next))) break
        next = addDays(next, 1)
      }
      break
    }
    case 'monthly':
      next = addMonths(base, interval)
      while (next <= today) next = addMonths(next, interval)
      break
    case 'yearly':
      next = addMonths(base, 12 * interval)
      while (next <= today) next = addMonths(next, 12 * interval)
      break
  }
  return format(next, 'yyyy-MM-dd')
}

export function recurrenceLabel(rec: Recurrence): string {
  const n = Math.max(1, rec.interval || 1)
  switch (rec.freq) {
    case 'daily':
      return n === 1 ? 'каждый день' : `каждые ${n} дн.`
    case 'weekly': {
      const days = rec.byweekday?.length
        ? rec.byweekday.map((d) => WEEKDAY_LABELS[d]).join(', ')
        : null
      const base = n === 1 ? 'каждую неделю' : `каждые ${n} нед.`
      return days ? `${base}: ${days}` : base
    }
    case 'monthly':
      if (n === 6) return 'каждые полгода'
      return n === 1 ? 'каждый месяц' : `каждые ${n} мес.`
    case 'yearly':
      return n === 1 ? 'каждый год' : `каждые ${n} г.`
  }
}
