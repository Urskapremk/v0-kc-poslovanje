// Monthly work-hours breakdown per worker.
// Splits worked hours into: regular (normal weekdays), Sunday work, holiday work,
// plus leave days. Holidays/Sundays come from lib/holidays (Madagascar).
// NOTE: no 'use server' — pure functions used by client schedule components.

import { getHolidayName, isSunday } from './holidays'

export interface DayWork {
  day: number // 1..31
  hours: number // shift hours worked that day (0 if off)
  onLeave: boolean // true if the worker is on leave that day
}

export interface HoursBreakdown {
  regularHours: number // worked on normal weekdays (not Sunday, not holiday)
  sundayHours: number // worked on Sundays
  holidayHours: number // worked on official holidays
  totalHours: number // regular + sunday + holiday (leave NOT counted as worked)
  regularDays: number
  sundayDays: number
  holidayDays: number
  leaveDays: number
}

/**
 * Summarize a single worker's month into a regular / Sunday / holiday / leave
 * breakdown. Leave days are excluded from worked hours and counted separately.
 */
export function summarizeMonthHours(year: number, month: number, entries: DayWork[]): HoursBreakdown {
  let regularHours = 0
  let sundayHours = 0
  let holidayHours = 0
  let regularDays = 0
  let sundayDays = 0
  let holidayDays = 0
  let leaveDays = 0

  for (const e of entries) {
    if (e.onLeave) {
      leaveDays += 1
      continue
    }
    if (e.hours <= 0) continue
    if (getHolidayName(year, month, e.day)) {
      holidayHours += e.hours
      holidayDays += 1
    } else if (isSunday(year, month, e.day)) {
      sundayHours += e.hours
      sundayDays += 1
    } else {
      regularHours += e.hours
      regularDays += 1
    }
  }

  return {
    regularHours,
    sundayHours,
    holidayHours,
    totalHours: regularHours + sundayHours + holidayHours,
    regularDays,
    sundayDays,
    holidayDays,
    leaveDays,
  }
}
