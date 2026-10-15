// Čiščenje WC in tušev — rotacija med vsemi zaposlenimi na ustrezni izmeni.
import { namesMatch, leaveDaysForStaff, type LeaveRequest } from '@/lib/leave'
import {
  buildStaffShiftPlan,
  wcStaffRoster,
  staffTypeByName,
  type StaffDayShift,
  type StaffMemberLite,
} from '@/lib/wc-staff-shifts'
import type { Shift } from '@/lib/housekeeping'

export const WC_CLEANING_FROM = '2026-10-17'
export const WC_MORNING_TIME = '08:00'
export const WC_AFTERNOON_TIME = '17:00'

export type WcTime = typeof WC_MORNING_TIME | typeof WC_AFTERNOON_TIME

export type WcCleaningAssignment = {
  time: WcTime
  assignee: string | null
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

function pickFair(
  eligible: string[],
  counts: Record<string, number>,
  exclude?: string | null,
): string | null {
  let pool = eligible
  if (exclude && pool.length > 1) pool = pool.filter((n) => n !== exclude)
  if (pool.length === 0) return null
  const sorted = [...pool].sort((a, b) => {
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

function monthBounds(year: number, month: number): { from: string; to: string } {
  const lastDay = new Date(year, month, 0).getDate()
  return {
    from: `${year}-${String(month).padStart(2, '0')}-01`,
    to: `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
  }
}

/** Pre-roll rotation from WC_CLEANING_FROM through months before `year`-`month`. */
function preRollCounts(
  year: number,
  month: number,
  staffMembers: StaffMemberLite[],
  housekeepingEntries: ScheduleLike[],
  leaves: LeaveRequest[],
  employedOn: (endDate: string | undefined, date: string) => boolean,
  endByName: Record<string, string | undefined>,
): { morning: Record<string, number>; afternoon: Record<string, number> } {
  const morningCounts: Record<string, number> = {}
  const afternoonCounts: Record<string, number> = {}
  if (parseIso(`${year}-${String(month).padStart(2, '0')}-01`) <= parseIso(WC_CLEANING_FROM)) {
    return { morning: morningCounts, afternoon: afternoonCounts }
  }

  let y = parseIso(WC_CLEANING_FROM).getFullYear()
  let m = parseIso(WC_CLEANING_FROM).getMonth() + 1
  const target = year * 100 + month

  while (y * 100 + m < target) {
    const roster = wcStaffRoster(staffMembers, y, m, WC_CLEANING_FROM)
    const types = staffTypeByName(staffMembers)
    const plan = buildStaffShiftPlan(y, m, housekeepingEntries, roster, types)
    simulateRange(
      WC_CLEANING_FROM,
      monthBounds(y, m).to,
      roster,
      plan,
      leaves,
      employedOn,
      endByName,
      morningCounts,
      afternoonCounts,
      null,
    )
    m += 1
    if (m > 12) {
      m = 1
      y += 1
    }
  }

  return { morning: morningCounts, afternoon: afternoonCounts }
}

function simulateRange(
  fromDate: string,
  toDate: string,
  roster: string[],
  shiftPlan: Map<string, Map<string, StaffDayShift>>,
  leaves: LeaveRequest[],
  employedOn: (endDate: string | undefined, date: string) => boolean,
  endByName: Record<string, string | undefined>,
  morningCounts: Record<string, number>,
  afternoonCounts: Record<string, number>,
  collectFrom: string | null,
): WcCleaningDay[] {
  const out: WcCleaningDay[] = []
  let cursor = WC_CLEANING_FROM
  while (parseIso(cursor) <= parseIso(toDate)) {
    if (parseIso(cursor) >= parseIso(WC_CLEANING_FROM)) {
      const dayPlan = shiftPlan.get(cursor) ?? new Map()
      const morningEligible: string[] = []
      const afternoonPrimary: string[] = []
      const afternoonMidday: string[] = []
      let morningWorking = 0
      let afternoonWorking = 0

      for (const name of roster) {
        if (!employedOn(endByName[name], cursor)) continue
        const info = dayPlan.get(name)
        if (!info?.working) continue
        const blocked = isBlockedByLeave(leaves, name, cursor)
        if (info.morning08) {
          morningWorking += 1
          if (!blocked) morningEligible.push(name)
        }
        if (info.afternoon17Primary) {
          afternoonWorking += 1
          if (!blocked) afternoonPrimary.push(name)
        } else if (info.afternoon17MiddayFallback && info.working) {
          if (!blocked) afternoonMidday.push(name)
        }
      }

      const morningPick = pickFair(morningEligible, morningCounts)
      let afternoonPool = afternoonPrimary.length > 0 ? afternoonPrimary : afternoonMidday
      if (afternoonPrimary.length > 0) afternoonWorking = afternoonPrimary.length
      else if (afternoonMidday.length > 0) afternoonWorking = afternoonMidday.length

      const afternoonPick = pickFair(afternoonPool, afternoonCounts, morningPick)

      const morningEmpty =
        morningWorking === 0 || (morningWorking > 0 && morningEligible.length === 0)
      const afternoonEmpty =
        afternoonWorking === 0 ||
        (afternoonWorking > 0 && afternoonPool.length === 0)

      if (collectFrom === null || parseIso(cursor) >= parseIso(collectFrom)) {
        out.push({
          date: cursor,
          morning: {
            time: WC_MORNING_TIME,
            assignee: morningPick,
            empty: morningEmpty,
          },
          afternoon: {
            time: WC_AFTERNOON_TIME,
            assignee: afternoonPick,
            empty: afternoonEmpty,
          },
        })
      }
    }
    cursor = addDaysIso(cursor, 1)
  }
  return out
}

export function generateWcCleaningRange(
  fromDate: string,
  toDate: string,
  housekeepingEntries: ScheduleLike[],
  leaves: LeaveRequest[],
  staffMembers: StaffMemberLite[],
  employedOn: (endDate: string | undefined, date: string) => boolean,
  endByName: Record<string, string | undefined>,
  year: number,
  month: number,
): WcCleaningDay[] {
  if (parseIso(toDate) < parseIso(WC_CLEANING_FROM)) return []

  const roster = wcStaffRoster(staffMembers, year, month, WC_CLEANING_FROM)
  const types = staffTypeByName(staffMembers)
  const shiftPlan = buildStaffShiftPlan(year, month, housekeepingEntries, roster, types)
  const { morning, afternoon } = preRollCounts(
    year,
    month,
    staffMembers,
    housekeepingEntries,
    leaves,
    employedOn,
    endByName,
  )

  return simulateRange(
    fromDate,
    toDate,
    roster,
    shiftPlan,
    leaves,
    employedOn,
    endByName,
    morning,
    afternoon,
    fromDate,
  )
}

export function generateWcCleaningMonth(
  year: number,
  month: number,
  housekeepingEntries: ScheduleLike[],
  leaves: LeaveRequest[],
  staffMembers: StaffMemberLite[],
  employedOn: (endDate: string | undefined, date: string) => boolean,
  endByName: Record<string, string | undefined>,
): WcCleaningDay[] {
  const { from, to } = monthBounds(year, month)
  return generateWcCleaningRange(
    from,
    to,
    housekeepingEntries,
    leaves,
    staffMembers,
    employedOn,
    endByName,
    year,
    month,
  )
}

export type StaffCombinedRow = {
  day: number
  date: string
  weekday: number
  shiftLabel: string
  wcLabel: string | null
  onLeave: boolean
  leaveType?: string
}

export function combinedScheduleForStaff(
  staffName: string,
  year: number,
  month: number,
  shiftPlan: Map<string, Map<string, StaffDayShift>>,
  wcDays: WcCleaningDay[],
  leaves: LeaveRequest[],
  employedOn: (endDate: string | undefined, date: string) => boolean,
  endByName: Record<string, string | undefined>,
): StaffCombinedRow[] {
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
        shiftLabel: '—',
        wcLabel: null,
        onLeave: false,
      })
      continue
    }
    const leave = leaveByDay[day]
    const info = shiftPlan.get(date)?.get(staffName)
    let shiftLabel = info?.label ?? 'Prosto'
    if (leave) {
      shiftLabel =
        leave.type === 'sick'
          ? 'Bolniška'
          : leave.type === 'exceptional'
            ? 'Izredni dopust'
            : 'Dopust'
    } else if (!info?.working) {
      shiftLabel = 'Prosto'
    }

    let wcLabel: string | null = null
    if (date >= WC_CLEANING_FROM) {
      const wc = wcByDate.get(date)
      if (wc) {
        if (wc.morning.assignee === staffName) wcLabel = `WC/tuši ${WC_MORNING_TIME}`
        else if (wc.afternoon.assignee === staffName) wcLabel = `WC/tuši ${WC_AFTERNOON_TIME}`
      }
    }

    rows.push({
      day,
      date,
      weekday: new Date(year, month - 1, day).getDay(),
      shiftLabel,
      wcLabel,
      onLeave: !!leave,
      leaveType: leave?.type,
    })
  }

  return rows
}
