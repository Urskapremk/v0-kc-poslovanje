// Čiščenje WC in tušev — rotacija med delavci na dopoldanski / popoldanski izmeni.
import { HOUSEKEEPERS, housekeepingDay, type Shift } from '@/lib/housekeeping'
import { leaveDaysForStaff, namesMatch, type LeaveRequest } from '@/lib/leave'

export const WC_CLEANING_FROM = '2026-10-17'
export const WC_MORNING_TIME = '08:00'
export const WC_AFTERNOON_TIME = '17:00'

export type WcTime = typeof WC_MORNING_TIME | typeof WC_AFTERNOON_TIME

export type WcCleaningAssignment = {
  time: WcTime
  assignee: string | null
  /** true when nobody is on that shift (all off or on leave). */
  empty: boolean
}

export type WcCleaningDay = {
  date: string
  morning: WcCleaningAssignment
  afternoon: WcCleaningAssignment
}

export type ScheduleLike = { date: string; staffName: string; shift: Shift }

function parseIso(date: string): Date {
  return new Date(date.slice(0, 10) + 'T00:00:00')
}

function addDaysIso(date: string, n: number): string {
  const d = parseIso(date)
  d.setDate(d.getDate() + n)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function shiftOnDate(
  scheduleByDate: Map<string, Map<string, Shift>>,
  date: string,
  name: string,
): Shift {
  const fromDb = scheduleByDate.get(date)?.get(name)
  if (fromDb) return fromDb
  const plan = housekeepingDay(date)
  return plan[name as keyof typeof plan] ?? 'OFF'
}

function isBlockedByLeave(
  leaves: LeaveRequest[],
  staffName: string,
  date: string,
): boolean {
  const d = parseIso(date)
  for (const l of leaves) {
    if (l.status === 'rejected') continue
    if (!namesMatch(l.staffName, staffName)) continue
    const start = parseIso(String(l.startDate).slice(0, 10))
    const end = parseIso(String(l.endDate).slice(0, 10))
    if (d >= start && d <= end) return true
  }
  return false
}

function pickFair(eligible: string[], counts: Record<string, number>): string | null {
  if (eligible.length === 0) return null
  const sorted = [...eligible].sort((a, b) => {
    const ca = counts[a] ?? 0
    const cb = counts[b] ?? 0
    if (ca !== cb) return ca - cb
    return a.localeCompare(b, 'sl')
  })
  const pick = sorted[0]
  counts[pick] = (counts[pick] ?? 0) + 1
  return pick
}

export function buildScheduleMap(entries: ScheduleLike[]): Map<string, Map<string, Shift>> {
  const map = new Map<string, Map<string, Shift>>()
  for (const e of entries) {
    if (!map.has(e.date)) map.set(e.date, new Map())
    map.get(e.date)!.set(e.staffName, e.shift)
  }
  return map
}

/**
 * Generate WC cleaning assignments from `fromDate` through `toDate` (inclusive).
 * Rotation counters continue from WC_CLEANING_FROM so November stays fair after October.
 */
export function generateWcCleaningRange(
  fromDate: string,
  toDate: string,
  scheduleEntries: ScheduleLike[],
  leaves: LeaveRequest[],
  roster: readonly string[] = HOUSEKEEPERS,
  employedOn: (endDate: string | undefined, date: string) => boolean,
  endByName: Record<string, string | undefined>,
): WcCleaningDay[] {
  const scheduleByDate = buildScheduleMap(scheduleEntries)
  const morningCounts: Record<string, number> = {}
  const afternoonCounts: Record<string, number> = {}
  const out: WcCleaningDay[] = []

  let cursor = WC_CLEANING_FROM
  const end = toDate
  if (parseIso(end) < parseIso(WC_CLEANING_FROM)) return []

  while (parseIso(cursor) <= parseIso(end)) {
    if (parseIso(cursor) >= parseIso(WC_CLEANING_FROM)) {
      const morningEligible: string[] = []
      const afternoonEligible: string[] = []
      let morningOnShift = 0
      let afternoonOnShift = 0

      for (const name of roster) {
        if (!employedOn(endByName[name], cursor)) continue
        const shift = shiftOnDate(scheduleByDate, cursor, name)
        const blocked = isBlockedByLeave(leaves, name, cursor)
        if (shift === 'MORNING') {
          morningOnShift += 1
          if (!blocked) morningEligible.push(name)
        } else if (shift === 'AFTERNOON') {
          afternoonOnShift += 1
          if (!blocked) afternoonEligible.push(name)
        }
      }

      const morningPick = pickFair(morningEligible, morningCounts)
      const afternoonPick = pickFair(afternoonEligible, afternoonCounts)

      if (parseIso(cursor) >= parseIso(fromDate)) {
        out.push({
          date: cursor,
          morning: {
            time: WC_MORNING_TIME,
            assignee: morningPick,
            empty: morningOnShift === 0 || (morningOnShift > 0 && morningEligible.length === 0),
          },
          afternoon: {
            time: WC_AFTERNOON_TIME,
            assignee: afternoonPick,
            empty:
              afternoonOnShift === 0 ||
              (afternoonOnShift > 0 && afternoonEligible.length === 0),
          },
        })
      }
    }
    cursor = addDaysIso(cursor, 1)
  }

  return out
}

export function generateWcCleaningMonth(
  year: number,
  month: number,
  scheduleEntries: ScheduleLike[],
  leaves: LeaveRequest[],
  roster: readonly string[],
  employedOn: (endDate: string | undefined, date: string) => boolean,
  endByName: Record<string, string | undefined>,
): WcCleaningDay[] {
  const lastDay = new Date(year, month, 0).getDate()
  const from = `${year}-${String(month).padStart(2, '0')}-01`
  const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return generateWcCleaningRange(from, to, scheduleEntries, leaves, roster, employedOn, endByName)
}

export type StaffCombinedRow = {
  day: number
  date: string
  weekday: number
  shift: Shift | 'LEAVE' | 'SICK' | 'GONE'
  shiftLabel: string
  wcLabel: string | null
}

/** One worker's combined rota row for print (shift + WC duty). */
export function combinedScheduleForStaff(
  staffName: string,
  year: number,
  month: number,
  scheduleEntries: ScheduleLike[],
  wcDays: WcCleaningDay[],
  leaves: LeaveRequest[],
  employedOn: (endDate: string | undefined, date: string) => boolean,
  endByName: Record<string, string | undefined>,
): StaffCombinedRow[] {
  const scheduleByDate = buildScheduleMap(scheduleEntries)
  const wcByDate = new Map(wcDays.map((d) => [d.date, d]))
  const leaveByDay = leaveDaysForStaff(leaves, staffName, year, month)
  const lastDay = new Date(year, month, 0).getDate()
  const rows: StaffCombinedRow[] = []

  for (let day = 1; day <= lastDay; day++) {
    const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    if (!employedOn(endByName[staffName], date)) {
      rows.push({
        day,
        date,
        weekday: new Date(year, month - 1, day).getDay(),
        shift: 'GONE',
        shiftLabel: '—',
        wcLabel: null,
      })
      continue
    }
    const leave = leaveByDay[day]
    let shift: Shift | 'LEAVE' | 'SICK' = shiftOnDate(scheduleByDate, date, staffName)
    let shiftLabel =
      shift === 'MORNING'
        ? 'Dopoldan'
        : shift === 'AFTERNOON'
          ? 'Popoldan'
          : 'Prosto'
    if (leave) {
      shift = leave.type === 'sick' ? 'SICK' : 'LEAVE'
      shiftLabel = leave.type === 'sick' ? 'Bolniška' : 'Dopust'
    }

    let wcLabel: string | null = null
    if (date >= WC_CLEANING_FROM) {
      const wc = wcByDate.get(date)
      if (wc) {
        if (wc.morning.assignee === staffName) wcLabel = `WC/tuši ${WC_MORNING_TIME}`
        else if (wc.afternoon.assignee === staffName) wcLabel = `WC/tuši ${WC_AFTERNOON_TIME}`
      }
    }

    rows.push({ day, date, weekday: new Date(year, month - 1, day).getDay(), shift, shiftLabel, wcLabel })
  }

  return rows
}
