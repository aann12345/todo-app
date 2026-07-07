import {
  addDays,
  endOfMonth,
  format,
  isToday,
  isTomorrow,
  isYesterday,
  parseISO,
  startOfDay,
} from 'date-fns'
import { ru } from 'date-fns/locale'

export function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

export function isoIn(days: number): string {
  return format(addDays(new Date(), days), 'yyyy-MM-dd')
}

export function endOfMonthISO(): string {
  return format(endOfMonth(new Date()), 'yyyy-MM-dd')
}

export function isOverdue(dueDate: string): boolean {
  return parseISO(dueDate) < startOfDay(new Date())
}

export function dueLabel(dueDate: string): string {
  const d = parseISO(dueDate)
  if (isToday(d)) return 'Сегодня'
  if (isTomorrow(d)) return 'Завтра'
  if (isYesterday(d)) return 'Вчера'
  return format(d, d.getFullYear() === new Date().getFullYear() ? 'd MMM' : 'd MMM yyyy', {
    locale: ru,
  })
}

export function dateHeading(dateISO: string): string {
  const d = parseISO(dateISO)
  if (isToday(d)) return 'Сегодня'
  if (isTomorrow(d)) return 'Завтра'
  return format(d, 'EEEE, d MMMM', { locale: ru })
}
