// Shared constants & types for the housekeeping schedule.
// NOTE: This file must NOT have a 'use server' directive — server-action files
// may only export async functions, not constants or types.

export type Shift = 'MORNING' | 'AFTERNOON' | 'OFF'

export const HOUSEKEEPERS = ['Eniki', 'Felicia', 'Christaline', 'Mela'] as const
export type Housekeeper = (typeof HOUSEKEEPERS)[number]

export interface ScheduleEntry {
  id: string
  date: string // YYYY-MM-DD
  staffName: string
  shift: Shift
}
