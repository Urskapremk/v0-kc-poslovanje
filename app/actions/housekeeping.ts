'use server'

import { db } from '@/lib/db'
import { housekeepingSchedule } from '@/lib/db/schema'
import { and, gte, lte, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import type { Shift, ScheduleEntry } from '@/lib/housekeeping'

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
 * Generate the schedule for a whole month following the rules:
 * - 4 housekeepers: Eniki, Felicia, Christaline (core) + Mela (reserve).
 * - Each works 6 days, every 7th day off. Off days are staggered so that no two
 *   are ever off on the same day:
 *     Eniki off  -> dayIndex % 7 === 0
 *     Mela off   -> dayIndex % 7 === 1
 *     Felicia off-> dayIndex % 7 === 3
 *     Christaline off -> dayIndex % 7 === 6
 * - Core normal-day shifts: Christaline MORNING; Eniki & Felicia alternate weekly
 *   (one week morning, the other afternoon).
 * - Mela is the reserve:
 *     • When one core housekeeper is OFF, Mela takes that person's normal shift
 *       (she substitutes the absent one), so the day looks like a full normal day.
 *     • When nobody is off (and Mela is not off), Mela works the AFTERNOON shift so
 *       the lone afternoon housekeeper is not alone.
 *     • Mela has her own weekly day off (dayIndex % 7 === 1); on that day the core
 *       three work the normal pattern (afternoon person alone, the baseline).
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

  const entries: { date: string; staffName: string; shift: Shift }[] = []

  // Day index 0-based from the 1st of the month.
  for (let d = 1; d <= lastDay; d++) {
    const dayIndex = d - 1
    const pos = dayIndex % 7
    const weekIndex = Math.floor(dayIndex / 7)
    const date = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`

    const enikiOff = pos === 0
    const melaOff = pos === 1
    const feliciaOff = pos === 3
    const christalineOff = pos === 6

    // Core normal-day shifts (before applying offs).
    // Christaline always morning; Eniki & Felicia alternate weekly.
    const normalEniki: Shift = weekIndex % 2 === 0 ? 'MORNING' : 'AFTERNOON'
    const normalFelicia: Shift = weekIndex % 2 === 0 ? 'AFTERNOON' : 'MORNING'
    const normalChristaline: Shift = 'MORNING'

    let eniki: Shift = normalEniki
    let felicia: Shift = normalFelicia
    let christaline: Shift = normalChristaline
    let mela: Shift

    if (melaOff) {
      // Mela rests; the three core housekeepers work their normal pattern.
      mela = 'OFF'
    } else if (enikiOff) {
      // Eniki off -> Mela substitutes Eniki (takes her normal shift).
      eniki = 'OFF'
      mela = normalEniki
    } else if (feliciaOff) {
      // Felicia off -> Mela substitutes Felicia.
      felicia = 'OFF'
      mela = normalFelicia
    } else if (christalineOff) {
      // Christaline off -> Mela substitutes Christaline (morning).
      christaline = 'OFF'
      mela = normalChristaline
    } else {
      // Nobody off -> Mela helps the lone afternoon housekeeper.
      mela = 'AFTERNOON'
    }

    entries.push({ date, staffName: 'Eniki', shift: eniki })
    entries.push({ date, staffName: 'Felicia', shift: felicia })
    entries.push({ date, staffName: 'Christaline', shift: christaline })
    entries.push({ date, staffName: 'Mela', shift: mela })
  }

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
