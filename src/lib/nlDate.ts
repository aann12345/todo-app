import { addDays, format, getDay } from 'date-fns'
import type { Recurrence } from '../types'

export interface ParsedInput {
  title: string
  due_date: string | null
  recurrence: Recurrence | null
  quantity: string | null
}

/**
 * Разбивает ввод на отдельные пункты: по переносам строк и запятым.
 * «хлеб, молоко, яйца» → ['хлеб','молоко','яйца']. Пустые отбрасываются.
 */
export function splitItems(raw: string): string[] {
  return raw
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

const WEEKDAYS: Record<string, number> = {
  'воскресенье': 0, 'воскресенья': 0,
  'понедельник': 1, 'понедельника': 1,
  'вторник': 2, 'вторника': 2,
  'среду': 3, 'среда': 3, 'среды': 3,
  'четверг': 4, 'четверга': 4,
  'пятницу': 5, 'пятница': 5, 'пятницы': 5,
  'субботу': 6, 'суббота': 6, 'субботы': 6,
}

const MONTHS: Record<string, number> = {
  'января': 0, 'февраля': 1, 'марта': 2, 'апреля': 3, 'мая': 4, 'июня': 5,
  'июля': 6, 'августа': 7, 'сентября': 8, 'октября': 9, 'ноября': 10, 'декабря': 11,
}

const WD_NAMES = Object.keys(WEEKDAYS).join('|')
const MONTH_NAMES = Object.keys(MONTHS).join('|')

function iso(d: Date): string {
  return format(d, 'yyyy-MM-dd')
}

function nextWeekday(wd: number, from = new Date()): Date {
  let d = addDays(from, 1)
  while (getDay(d) !== wd) d = addDays(d, 1)
  return d
}

/**
 * Распознаёт даты, повторы и количество в тексте задачи на русском:
 * «позвонить маме завтра», «зал каждый вторник», «купить молоко 2 л»,
 * «оплатить счета 15 июля», «отчёт через 3 дня».
 */
export function parseTaskInput(raw: string): ParsedInput {
  let text = ' ' + raw + ' '
  let due: string | null = null
  let rec: Recurrence | null = null
  let qty: string | null = null
  const today = new Date()

  const cut = (m: RegExpMatchArray) => {
    text = text.replace(m[0], ' ')
  }

  // --- повторы ---
  let m = text.match(/\s(каждый день|ежедневно)\s/i)
  if (m) {
    rec = { freq: 'daily', interval: 1 }
    cut(m)
  }
  if (!rec && (m = text.match(new RegExp(`\\sкажд(?:ую|ый|ое)\\s+(${WD_NAMES})\\s`, 'i')))) {
    // «каждую субботу», «каждый вторник»
    const wd = WEEKDAYS[m[1].toLowerCase()]
    rec = { freq: 'weekly', interval: 1, byweekday: [wd] }
    due = iso(getDay(today) === wd ? today : nextWeekday(wd))
    cut(m)
  }
  if (!rec && (m = text.match(/\s(каждую неделю|еженедельно)\s/i))) {
    rec = { freq: 'weekly', interval: 1 }
    cut(m)
  }
  if (!rec && (m = text.match(/\s(каждый месяц|ежемесячно)\s/i))) {
    rec = { freq: 'monthly', interval: 1 }
    cut(m)
  }
  if (!rec && (m = text.match(/\sкаждые\s+(\d{1,2})\s+(день|дня|дней)\s/i))) {
    rec = { freq: 'daily', interval: Number(m[1]) }
    cut(m)
  }

  // --- даты ---
  if (!due && (m = text.match(/\s(сегодня)\s/i))) {
    due = iso(today)
    cut(m)
  }
  if (!due && (m = text.match(/\s(послезавтра)\s/i))) {
    due = iso(addDays(today, 2))
    cut(m)
  }
  if (!due && (m = text.match(/\s(завтра)\s/i))) {
    due = iso(addDays(today, 1))
    cut(m)
  }
  if (!due && (m = text.match(/\sчерез\s+(\d{1,2})\s+(день|дня|дней)\s/i))) {
    due = iso(addDays(today, Number(m[1])))
    cut(m)
  }
  if (!due && (m = text.match(/\sчерез\s+неделю\s/i))) {
    due = iso(addDays(today, 7))
    cut(m)
  }
  if (!due && (m = text.match(new RegExp(`\\sвo?\\s+(${WD_NAMES})\\s`, 'i')))) {
    due = iso(nextWeekday(WEEKDAYS[m[1].toLowerCase()]))
    cut(m)
  }
  if (!due && (m = text.match(new RegExp(`\\s(\\d{1,2})\\s+(${MONTH_NAMES})\\s`, 'i')))) {
    const d = new Date(today.getFullYear(), MONTHS[m[2].toLowerCase()], Number(m[1]))
    if (d < today) d.setFullYear(d.getFullYear() + 1)
    due = iso(d)
    cut(m)
  }

  // повтор без даты — стартуем с сегодня/завтра
  if (rec && !due) {
    due = iso(today)
  }

  // --- количество в конце: «2 кг», «х3», «3 шт», «1.5 л» ---
  m = text.match(/\s[x×х]?\s?(\d+[.,]?\d*)\s*(кг|г|л|мл|шт|уп|пач\w*|бут\w*)?\s*$/i)
  if (m && (m[2] || /^[x×х]/i.test(m[0].trim()))) {
    qty = `${m[1]}${m[2] ? ' ' + m[2] : ' шт'}`
    cut(m)
  }

  return {
    title: text.replace(/\s+/g, ' ').trim(),
    due_date: due,
    recurrence: rec,
    quantity: qty,
  }
}
