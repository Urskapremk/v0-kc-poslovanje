// Dnevna prisotnost + izracun obracuna ur (delo / dopust / prosto).
// BREZ 'use server' - deljeno med UI (place-tab) in streznimi akcijami/emailom.

import { getHolidayName, isSunday } from './holidays'

export type AttendanceStatus = 'work' | 'leave' | 'off'

// En dnevni vnos (od baze). day = 1..31.
export type AttendanceDay = {
  status: AttendanceStatus
  from: string | null // "HH:MM"
  to: string | null // "HH:MM"
  breakMinutes?: number | null // odmor (kosilo) v minutah, se NE šteje v ure
}

// Mapa dan -> vnos za enega delavca v mesecu.
export type AttendanceMonth = Record<number, AttendanceDay>

// Ena vrstica dneva za prikaz/izracun.
export type AttendanceRow = {
  day: number
  weekday: number // 0=ned .. 6=sob
  weekdayLabel: string
  isSunday: boolean
  holidayName: string | null
  status: AttendanceStatus | null
  from: string | null
  to: string | null
  breakMinutes: number // odmor v minutah
  hours: number
  // v katero kategorijo padejo ure tega dne
  kind: 'normal' | 'holiday' | 'sunday' | 'leave' | 'off' | 'none'
}

export type AttendanceSummary = {
  rows: AttendanceRow[]
  daysInMonth: number
  normalDays: number
  normalHours: number
  holidayDays: number
  holidayHours: number
  sundayDays: number
  sundayHours: number
  leaveDays: number
  offDays: number
  totalWorkDays: number
  totalWorkHours: number
}

export const WEEKDAYS_SL = ['Nedelja', 'Ponedeljek', 'Torek', 'Sreda', 'Četrtek', 'Petek', 'Sobota']
export const WEEKDAYS_SL_SHORT = ['Ned', 'Pon', 'Tor', 'Sre', 'Čet', 'Pet', 'Sob']

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

// Razlika ur med "HH:MM" - "HH:MM". Ce je konec <= zacetek, se steje cez polnoc.
export function computeHours(from: string | null, to: string | null): number {
  if (!from || !to) return 0
  const [fh, fm] = from.split(':').map((n) => Number.parseInt(n, 10))
  const [th, tm] = to.split(':').map((n) => Number.parseInt(n, 10))
  if ([fh, fm, th, tm].some((n) => Number.isNaN(n))) return 0
  let start = fh + fm / 60
  let end = th + tm / 60
  if (end <= start) end += 24 // cez polnoc
  const diff = end - start
  return Math.round(diff * 100) / 100
}

// Zgradi tabelo dni + sestevke za en mesec enega delavca.
export function computeAttendanceSummary(
  entries: AttendanceMonth,
  year: number,
  month: number,
): AttendanceSummary {
  const dim = daysInMonth(year, month)
  const rows: AttendanceRow[] = []

  let normalDays = 0
  let normalHours = 0
  let holidayDays = 0
  let holidayHours = 0
  let sundayDays = 0
  let sundayHours = 0
  let leaveDays = 0
  let offDays = 0

  for (let day = 1; day <= dim; day++) {
    const weekday = new Date(year, month - 1, day).getDay()
    const sunday = isSunday(year, month, day)
    const holidayName = getHolidayName(year, month, day)
    const entry = entries[day]
    const status = entry?.status ?? null
    const from = entry?.from ?? null
    const to = entry?.to ?? null
    const breakMinutes = entry?.breakMinutes ?? 0

    let hours = 0
    let kind: AttendanceRow['kind'] = 'none'

    if (status === 'work') {
      hours = Math.max(0, computeHours(from, to) - breakMinutes / 60)
      if (holidayName) {
        kind = 'holiday'
        if (hours > 0) {
          holidayDays++
          holidayHours += hours
        }
      } else if (sunday) {
        kind = 'sunday'
        if (hours > 0) {
          sundayDays++
          sundayHours += hours
        }
      } else {
        kind = 'normal'
        if (hours > 0) {
          normalDays++
          normalHours += hours
        }
      }
    } else if (status === 'leave') {
      kind = 'leave'
      leaveDays++
    } else if (status === 'off') {
      kind = 'off'
      offDays++
    }

    rows.push({
      day,
      weekday,
      weekdayLabel: WEEKDAYS_SL[weekday],
      isSunday: sunday,
      holidayName,
      status,
      from,
      to,
      breakMinutes,
      hours: Math.round(hours * 100) / 100,
      kind,
    })
  }

  const round = (n: number) => Math.round(n * 100) / 100
  return {
    rows,
    daysInMonth: dim,
    normalDays,
    normalHours: round(normalHours),
    holidayDays,
    holidayHours: round(holidayHours),
    sundayDays,
    sundayHours: round(sundayHours),
    leaveDays,
    offDays,
    totalWorkDays: normalDays + holidayDays + sundayDays,
    totalWorkHours: round(normalHours + holidayHours + sundayHours),
  }
}

// Mesečna norma ur in vrednost dneva dopusta.
export const MONTHLY_NORM_HOURS = 173.33
export const LEAVE_DAY_HOURS = 6

export type NormResult = {
  norm: number // zahtevana norma
  workHours: number // dejansko opravljene ure (delo, vklj. nedelja/praznik)
  leaveDays: number
  leaveHours: number // dopust priznan kot ure (leaveDays * LEAVE_DAY_HOURS)
  creditedHours: number // workHours + leaveHours
  diff: number // creditedHours - norm (negativno = manjka, pozitivno = presežek)
}

// Izračun norme: dopust se šteje LEAVE_DAY_HOURS/dan, ostalo po dejanskem delavniku.
export function computeNorm(
  summary: AttendanceSummary,
  norm: number = MONTHLY_NORM_HOURS,
): NormResult {
  const round = (n: number) => Math.round(n * 100) / 100
  const workHours = summary.totalWorkHours
  const leaveHours = summary.leaveDays * LEAVE_DAY_HOURS
  const creditedHours = round(workHours + leaveHours)
  return {
    norm,
    workHours,
    leaveDays: summary.leaveDays,
    leaveHours,
    creditedHours,
    diff: round(creditedHours - norm),
  }
}

export function formatHours(n: number): string {
  // 6 -> "6 h", 3.5 -> "3,5 h"
  const s = Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, '').replace(/[.]$/, '').replace('.', ',')
  return `${s} h`
}
