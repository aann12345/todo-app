// Момент напоминания хранится как абсолютный UTC ISO.
// Пользователь задаёт дату (due_date) и локальное время — переводим в UTC
// через локальную таймзону устройства.

/** дата 'YYYY-MM-DD' + время 'HH:MM' (локальные) → ISO UTC */
export function combineDateTime(dateISO: string, timeHHMM: string): string {
  return new Date(`${dateISO}T${timeHHMM}`).toISOString()
}

/** ISO UTC → локальное время 'HH:MM' для показа/редактирования */
export function timeFromISO(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** короткая метка времени напоминания */
export function remindLabel(iso: string): string {
  return timeFromISO(iso)
}
