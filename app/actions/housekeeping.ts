'use server'

import { db } from '@/lib/db'
import { housekeepingSchedule, reservations } from '@/lib/db/schema'
import { and, gte, lte, eq, ne } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { housekeepingMonth, type Shift, type ScheduleEntry, type GuestStay } from '@/lib/housekeeping'
import { bungalowKey, bungalowKeys } from '@/lib/bungalow'

// Format a Date to YYYY-MM-DD without timezone shifts
function ymd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Get all schedule entries for a given month (1-12)
export async function getHousekeepingSchedule(year: number, month: number): Promise<ScheduleEntry[]> {
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  const rows = await db
    .select()
    .from(housekeepingSchedule)
    .where(and(gte(housekeepingSchedule.date, start), lte(housekeepingSchedule.date, end)))

  return rows.map((r) => ({
    id: r.id,
    date: typeof r.date === 'string' ? r.date : ymd(new Date(r.date as unknown as string)),
    staffName: r.staffName,
    shift: r.shift as Shift,
  }))
}

// Guest stays touching the month, one row per bungalow segment. Back-to-back
// bookings of the same guest in the same bungalow are merged into one stay.
export async function getGuestStaysForMonth(year: number, month: number): Promise<GuestStay[]> {
  const mm = String(month).padStart(2, '0')
  const start = `${year}-${mm}-01`
  const end = `${year}-${mm}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`
  const lookBack = ymd(new Date(year, month - 1, 1 - 60))

  const rows = await db
    .select({
      guestName: reservations.guestName,
      bungalow: reservations.bungalow,
      bungalowSegments: reservations.bungalowSegments,
      arrival: reservations.arrival,
      departure: reservations.departure,
    })
    .from(reservations)
    .where(and(ne(reservations.status, 'CANCELLED'), lte(reservations.arrival, end), gte(reservations.departure, lookBack)))

  const toStr = (v: unknown) => (typeof v === 'string' ? v.slice(0, 10) : ymd(new Date(v as string)))
  const raw: GuestStay[] = []
  for (const r of rows) {
    const arrival = toStr(r.arrival)
    const departure = toStr(r.departure)
    const segs = Array.isArray(r.bungalowSegments)
      ? (r.bungalowSegments as { key?: string; bungalow?: string; arrival?: string; departure?: string }[])
      : null
    if (segs && segs.length > 0) {
      for (const s of segs) {
        const key = s.key || bungalowKey(s.bungalow || '')
        raw.push({ bungalowKey: key, guestName: r.guestName, arrival: (s.arrival || arrival).slice(0, 10), departure: (s.departure || departure).slice(0, 10) })
      }
    } else {
      for (const key of bungalowKeys(r.bungalow)) {
        raw.push({ bungalowKey: key, guestName: r.guestName, arrival, departure })
      }
    }
  }

  raw.sort((a, b) => a.bungalowKey.localeCompare(b.bungalowKey) || a.arrival.localeCompare(b.arrival))
  const merged: GuestStay[] = []
  for (const s of raw) {
    const prev = merged[merged.length - 1]
    if (
      prev &&
      prev.bungalowKey === s.bungalowKey &&
      prev.guestName.trim().toLowerCase() === s.guestName.trim().toLowerCase() &&
      s.arrival <= prev.departure
    ) {
      if (s.departure > prev.departure) prev.departure = s.departure
    } else {
      merged.push({ ...s })
    }
  }
  return merged.filter((s) => s.departure >= start && s.arrival <= end && s.departure > s.arrival)
}

// Update or insert a single cell (one staff member's shift on one day)
export async function setHousekeepingShift(date: string, staffName: string, shift: Shift): Promise<void> {
  const existing = await db
    .select()
    .from(housekeepingSchedule)
    .where(and(eq(housekeepingSchedule.date, date), eq(housekeepingSchedule.staffName, staffName)))

  if (existing.length > 0) {
    await db
      .update(housekeepingSchedule)
      .set({ shift })
      .where(eq(housekeepingSchedule.id, existing[0].id))
  } else {
    await db.insert(housekeepingSchedule).values({
      id: `hk-${date}-${staffName}-${Math.random().toString(36).slice(2, 8)}`,
      date,
      staffName,
      shift,
    })
  }
  revalidatePath('/statistika')
}

/**
 * Generate the schedule for a whole month.
 * Until 5 Oct 2026 the four-person rota (with Mela) is kept.
 * From 6 Oct 2026 only Eniki, Felicia and Christaline remain.
 * See housekeepingDay in lib/housekeeping.ts.
 *
 * Returns the generated entries (also written to DB, overwriting that month).
 */
export async function generateHousekeepingSchedule(year: number, month: number): Promise<ScheduleEntry[]> {
  const lastDay = new Date(year, month, 0).getDate()

  // Clear existing entries for this month first
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  await db
    .delete(housekeepingSchedule)
    .where(and(gte(housekeepingSchedule.date, start), lte(housekeepingSchedule.date, end)))

  const entries = housekeepingMonth(year, month)

  await db.insert(housekeepingSchedule).values(
    entries.map((e) => ({
      id: `hk-${e.date}-${e.staffName}-${Math.random().toString(36).slice(2, 8)}`,
      date: e.date,
      staffName: e.staffName,
      shift: e.shift,
    }))
  )

  revalidatePath('/statistika')

  return entries.map((e, i) => ({ id: `gen-${i}`, ...e }))
}
