// Plača po datumu in datum izstopa. Brez 'use server' — uporablja ga tudi zaslon.

import { namesMatch } from './leave'

export type SalaryChange = { from: string; amount: number }

export type SalaryPeriod = {
  from: string | null
  until: string | null
  amount: number
  changeFrom: string | null
}

const MONTHS_GEN = [
  'januarja', 'februarja', 'marca', 'aprila', 'maja', 'junija',
  'julija', 'avgusta', 'septembra', 'oktobra', 'novembra', 'decembra',
]

export function isoDate(value: string | null | undefined): string {
  if (!value) return ''
  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : ''
}

export function slDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return `${d}. ${MONTHS_GEN[m - 1]} ${y}`
}

export function dayBefore(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d - 1)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

export function monthStart(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}-01`
}

export function monthEnd(year: number, month: number): string {
  const last = new Date(year, month, 0).getDate()
  return `${year}-${String(month).padStart(2, '0')}-${String(last).padStart(2, '0')}`
}

export function parseSalaryChanges(raw: unknown): SalaryChange[] {
  let value = raw
  if (typeof value === 'string') {
    try { value = JSON.parse(value) } catch { value = [] }
  }
  const list = Array.isArray(value) ? value : []
  return list
    .map((row) => {
      const item = row as { from?: unknown; amount?: unknown }
      return { from: isoDate(String(item?.from ?? '')), amount: Number(item?.amount) }
    })
    .filter((row) => /^\d{4}-\d{2}-\d{2}$/.test(row.from) && row.amount > 0)
    .sort((a, b) => a.from.localeCompare(b.from))
}

// Plača, ki velja na dan. Do prve spremembe velja osnovna, od vpisanega dne nova.
export function salaryOn(base: number, changes: SalaryChange[] | null | undefined, date: string): number {
  const day = isoDate(date)
  let amount = Math.round(Number(base) || 0)
  for (const change of parseSalaryChanges(changes)) {
    if (change.from <= day) amount = Math.round(change.amount)
  }
  return amount
}

// Mesečni znesek: plača, ki velja zadnji dan meseca (oziroma zadnji dan pred izstopom).
export function salaryForMonth(
  base: number,
  changes: SalaryChange[] | null | undefined,
  year: number,
  month: number,
  endDate?: string | null,
): number {
  if (!employedInMonth(endDate, year, month)) return 0
  const end = isoDate(endDate)
  const last = monthEnd(year, month)
  const asOf = end && end <= last ? dayBefore(end) : last
  return salaryOn(base, changes, asOf)
}

export function salaryHistory(base: number, changes: SalaryChange[] | null | undefined): SalaryPeriod[] {
  const list = parseSalaryChanges(changes)
  const amount = Math.round(Number(base) || 0)
  if (list.length === 0) return [{ from: null, until: null, amount, changeFrom: null }]
  const rows: SalaryPeriod[] = [{
    from: null,
    until: dayBefore(list[0].from),
    amount,
    changeFrom: null,
  }]
  list.forEach((change, index) => {
    const next = list[index + 1]
    rows.push({
      from: change.from,
      until: next ? dayBefore(next.from) : null,
      amount: Math.round(change.amount),
      changeFrom: change.from,
    })
  })
  return rows
}

export function periodCovers(period: SalaryPeriod, date: string): boolean {
  if (period.from && date < period.from) return false
  if (period.until && date > period.until) return false
  return true
}

export function periodLabel(period: SalaryPeriod): string {
  if (!period.from && period.until) return `Do ${slDate(period.until)}`
  if (period.from && period.until) return `Od ${slDate(period.from)} do ${slDate(period.until)}`
  if (period.from) return `Od ${slDate(period.from)}`
  return 'Plača'
}

// Od vpisanega datuma dalje delavca ni več v razporedu. Na ta dan že manjka.
export function employedOn(endDate: string | null | undefined, date: string): boolean {
  const end = isoDate(endDate)
  if (!end) return true
  return date < end
}

export function employedInMonth(endDate: string | null | undefined, year: number, month: number): boolean {
  const end = isoDate(endDate)
  if (!end) return true
  return monthStart(year, month) < end
}

export function endDatesFor(
  names: readonly string[],
  staff: { staffName: string; endDate?: string | null }[],
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const name of names) {
    const hit = staff.find((person) => namesMatch(person.staffName, name))
    const end = isoDate(hit?.endDate)
    if (end) out[name] = end
  }
  return out
}

export function keptInMonth(names: readonly string[], ends: Record<string, string>, year: number, month: number): string[] {
  return names.filter((name) => employedInMonth(ends[name], year, month))
}
