// Shared constants & types for the housekeeping schedule.
// NOTE: This file must NOT have a 'use server' directive — server-action files
// may only export async functions, not constants or types.

export type Shift = 'MORNING' | 'AFTERNOON' | 'OFF'

export const HOUSEKEEPERS = ['Eniki', 'Felicia', 'Christaline', 'Mela'] as const
export type Housekeeper = (typeof HOUSEKEEPERS)[number]

export interface GuestStay {
  bungalowKey: string
  guestName: string
  arrival: string
  departure: string
}

// Stay day 1 = arrival day. Departure day (nights + 1) is always a full change.
export function linenChangeStayDays(nights: number): number[] {
  if (nights <= 4) return []
  if (nights <= 6) return [3]
  if (nights === 7) return [4]
  const days: number[] = []
  for (let d = 4; d <= nights; d += 4) days.push(d)
  return days
}

// 4-night stays: change on day 3 only if the linen is dirty.
export function linenOptionalStayDays(nights: number): number[] {
  return nights === 4 ? [3] : []
}

export interface ScheduleEntry {
  id: string
  date: string // YYYY-MM-DD
  staffName: string
  shift: Shift
}

// From this day Mela has left. Three housekeepers, new hours.
export const HOUSEKEEPING_NEW_FROM = '2026-10-06'

export function housekeepingHours(date: string): number {
  return date >= HOUSEKEEPING_NEW_FROM ? 6 : 6.5
}

export function housekeepingLabels(date: string): {
  morning: string
  afternoon: string
  morningShort: string
  afternoonShort: string
  morningFr: string
  afternoonFr: string
} {
  if (date >= HOUSEKEEPING_NEW_FROM) {
    return {
      morning: 'Dopoldan 7-13',
      afternoon: 'Popoldan 13-19',
      morningShort: 'Dop 7-13',
      afternoonShort: 'Pop 13-19',
      morningFr: 'Matin 7h-13h',
      afternoonFr: 'Après-midi 13h-19h',
    }
  }
  return {
    morning: 'Dopoldan 6-12:30',
    afternoon: 'Popoldan 12-18:30',
    morningShort: 'Dop 6-12:30',
    afternoonShort: 'Pop 12-18:30',
    morningFr: 'Matin 6h-12h30',
    afternoonFr: 'Après-midi 12h-18h30',
  }
}

export type HousekeepingDay = Record<string, Shift>

// One day of the housekeeping rota.
// Before 6 Oct 2026: four people, Mela covers whoever is off.
// From 6 Oct 2026: Eniki, Felicia and Christaline. Christaline is the morning
// helper. Eniki and Felicia swap morning/afternoon every 7 days, counted from
// the 1st of the month. Each works 6 days and is off on the 7th. If the
// afternoon worker is off, the other main takes the afternoon and Christaline
// stays alone in the morning.
export function housekeepingDay(date: string): HousekeepingDay {
  const day = Number(date.slice(8, 10))
  const dayIndex = day - 1
  const pos = dayIndex % 7
  const weekIndex = Math.floor(dayIndex / 7)
  const enikiMorning = weekIndex % 2 === 0
  if (date < HOUSEKEEPING_NEW_FROM) return housekeepingDayWithMela(pos, enikiMorning)
  return housekeepingDayThree(pos, enikiMorning)
}

function housekeepingDayWithMela(pos: number, enikiMorning: boolean): HousekeepingDay {
  const normalEniki: Shift = enikiMorning ? 'MORNING' : 'AFTERNOON'
  const normalFelicia: Shift = enikiMorning ? 'AFTERNOON' : 'MORNING'
  const plan: HousekeepingDay = {
    Eniki: normalEniki,
    Felicia: normalFelicia,
    Christaline: 'MORNING',
    Mela: 'AFTERNOON',
  }
  if (pos === 1) plan.Mela = 'OFF'
  else if (pos === 0) { plan.Eniki = 'OFF'; plan.Mela = normalEniki }
  else if (pos === 3) { plan.Felicia = 'OFF'; plan.Mela = normalFelicia }
  else if (pos === 6) { plan.Christaline = 'OFF'; plan.Mela = 'MORNING' }
  return plan
}

function housekeepingDayThree(pos: number, enikiMorning: boolean): HousekeepingDay {
  const morningMain = enikiMorning ? 'Eniki' : 'Felicia'
  const afternoonMain = enikiMorning ? 'Felicia' : 'Eniki'
  const off = pos === 0 ? 'Eniki' : pos === 3 ? 'Felicia' : pos === 6 ? 'Christaline' : null
  const plan: HousekeepingDay = { Eniki: 'OFF', Felicia: 'OFF', Christaline: 'OFF' }
  if (off === 'Christaline') {
    plan[morningMain] = 'MORNING'
    plan[afternoonMain] = 'AFTERNOON'
  } else if (off === afternoonMain) {
    plan.Christaline = 'MORNING'
    plan[morningMain] = 'AFTERNOON'
  } else if (off === morningMain) {
    plan.Christaline = 'MORNING'
    plan[afternoonMain] = 'AFTERNOON'
  } else {
    plan[morningMain] = 'MORNING'
    plan.Christaline = 'MORNING'
    plan[afternoonMain] = 'AFTERNOON'
  }
  return plan
}

export function housekeepingMonth(year: number, month: number): { date: string; staffName: string; shift: Shift }[] {
  const lastDay = new Date(year, month, 0).getDate()
  const entries: { date: string; staffName: string; shift: Shift }[] = []
  for (let d = 1; d <= lastDay; d++) {
    const date = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const plan = housekeepingDay(date)
    for (const staffName of Object.keys(plan)) entries.push({ date, staffName, shift: plan[staffName] })
  }
  return entries
}
