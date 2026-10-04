// Start date for a reprinted schedule. Past days stay off the paper.

export function monthDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function monthLastDay(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

// Today, when that day is inside the month on screen. Otherwise the 1st.
export function defaultPrintFrom(year: number, month: number, today = new Date()): string {
  const y = today.getFullYear()
  const m = today.getMonth() + 1
  const d = today.getDate()
  if (y === year && m === month) return monthDate(year, month, d)
  return monthDate(year, month, 1)
}

// Keep the chosen day inside the month being printed.
export function clampPrintFrom(value: string, year: number, month: number): string {
  const first = monthDate(year, month, 1)
  const last = monthDate(year, month, monthLastDay(year, month))
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return first
  if (value < first) return first
  if (value > last) return last
  return value
}

// Day number when the print does not start on the 1st. Null means the whole month.
export function printStartDay(iso: string, year: number, month: number): number | null {
  const [y, m, d] = iso.split('-').map(Number)
  if (y !== year || m !== month || !d || d <= 1) return null
  return d
}
