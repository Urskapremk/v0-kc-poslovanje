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
