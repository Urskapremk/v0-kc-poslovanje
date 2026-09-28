// Shared constants & types for the GARDENERS schedule (DRAFT / osnutek).
// NOTE: This file must NOT contain 'use server' — it exports constants and a
// pure function used by the client component.

export const GARDENERS = ['Hijaldo', 'Velo', 'Maxim', 'Francelj', 'KD'] as const
export type Gardener = (typeof GARDENERS)[number]

// 4 real work posts + reserve (standby) + off
export type GardenPost = 'BEACH_AM' | 'BEACH_PM' | 'GARDEN_AM' | 'GARDEN_PM' | 'RESERVE' | 'OFF'

// Slovenian labels (on-screen, for the manager)
export const POST_LABELS: Record<GardenPost, string> = {
  BEACH_AM: 'Plaža 06-12:30',
  BEACH_PM: 'Plaža 12:30-19',
  GARDEN_AM: 'Vrt 07-13:30',
  GARDEN_PM: 'Vrt 12:30-19',
  RESERVE: 'Rezerva',
  OFF: 'Prosto',
}

// French labels (printed sheets — gardeners read French)
export const POST_LABELS_FR: Record<GardenPost, string> = {
  BEACH_AM: 'Plage 6h-12h30',
  BEACH_PM: 'Plage 12h30-19h',
  GARDEN_AM: 'Jardin 7h-13h30',
  GARDEN_PM: 'Jardin 12h30-19h',
  RESERVE: 'Réserve',
  OFF: 'Repos',
}

// The 4 real fillable posts (reserve is handled separately).
const POSTS4: GardenPost[] = ['BEACH_AM', 'BEACH_PM', 'GARDEN_AM', 'GARDEN_PM']
const isGarden = (p: GardenPost) => p === 'GARDEN_AM' || p === 'GARDEN_PM'

// Who may ever be the weekly RESERVE. Only KD is ever reserve — Hijaldo,
// Velo, Maxim and Francelj ALWAYS work a real post. KD is new and only works
// in the GARDEN, never on the beach; when he covers for someone who is off, he
// takes a garden post and the gardener from that garden post moves to the beach.
function reserveForWeek(_weekIndex: number): Gardener {
  return 'KD'
}

export const HOURS_PER_POST = 6.5

// Hours per worked post. All four posts now run 6.5h:
// beach AM 06:00-12:30, beach PM 12:30-19:00, garden AM 07:00-13:30, garden PM 12:30-19:00.
export function hoursForPost(_post: GardenPost): number {
  return HOURS_PER_POST
}

export type DaySchedule = { date: string; assignments: Record<string, GardenPost> }

/**
 * Generates a gardener schedule for the given month.
 *
 * Rules implemented:
 *  - 5 gardeners, each works 6 days and is OFF on the 7th (days off staggered
 *    so never more than one is off on the same day).
 *  - WEEKLY ROTATION: each week a gardener keeps the same base post, and the
 *    posts rotate between gardeners from week to week.
 *  - There are 4 real posts (beach AM/PM, garden AM/PM). The 5th gardener is the
 *    weekly RESERVE who covers the post of whoever is off that day, so all 4
 *    posts are always filled (no empty post).
 */
export function generateGardenerSchedule(year: number, month: number): DaySchedule[] {
  const lastDay = new Date(year, month, 0).getDate()
  const result: DaySchedule[] = []

  for (let day = 1; day <= lastDay; day++) {
    const dayIndex = day - 1
    const weekIndex = Math.floor(dayIndex / 7)
    const offMod = dayIndex % 7 // 0..6 ; 0..4 => that gardener off, 5/6 => nobody off

    // The weekly reserve is ALWAYS KD. The other four gardeners rotate
    // across the 4 real posts each week.
    const reserveGardener = reserveForWeek(weekIndex)
    const workers = GARDENERS.filter((g) => g !== reserveGardener)

    // Assign each non-reserve gardener a real post; rotate weekly.
    const basePost: Record<string, GardenPost> = {}
    workers.forEach((g, i) => {
      basePost[g] = POSTS4[(i + weekIndex) % POSTS4.length]
    })
    basePost[reserveGardener] = 'RESERVE'

    const offIdx = offMod < GARDENERS.length ? offMod : -1
    const offGardener = offIdx >= 0 ? GARDENERS[offIdx] : null

    const assignments: Record<string, GardenPost> = {}
    GARDENERS.forEach((g) => {
      assignments[g] = g === offGardener ? 'OFF' : basePost[g]
    })

    // KD covers for whoever is off (he is the reserve). But KD is new and
    // only works in the GARDEN, never on the beach.
    if (offGardener && offGardener !== reserveGardener) {
      const vacated = basePost[offGardener]
      if (isGarden(vacated)) {
        // Off gardener was in the garden → KD simply takes that garden post.
        assignments[reserveGardener] = vacated
      } else {
        // Off gardener was on the beach → KD takes a garden post, and the
        // gardener currently on that garden post moves to the vacated beach post.
        const gardenPost: GardenPost = 'GARDEN_AM'
        const swapGardener = GARDENERS.find(
          (g) => g !== offGardener && g !== reserveGardener && assignments[g] === gardenPost,
        )
        if (swapGardener) {
          assignments[reserveGardener] = gardenPost
          assignments[swapGardener] = vacated
        } else {
          // Fallback (should not happen): keep all posts covered.
          assignments[reserveGardener] = vacated
        }
      }
    }

    // When KD is NOT covering anyone (nobody is off that day) he stays as
    // reserve. Per the rule, a reserve KD is shown working in the GARDEN in
    // the morning (07-13) even if another gardener is already there.
    if (assignments[reserveGardener] === 'RESERVE') {
      assignments[reserveGardener] = 'GARDEN_AM'
    }

    const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    result.push({ date, assignments })
  }

  return result
}

/** Counts worked posts (each = 6h) and reserve days per gardener. */
export function computeGardenerStats(schedule: DaySchedule[]) {
  const stats: Record<string, { shifts: number; hours: number; reserve: number }> = {}
  for (const g of GARDENERS) stats[g] = { shifts: 0, hours: 0, reserve: 0 }
  for (const day of schedule) {
    for (const g of GARDENERS) {
      const post = day.assignments[g]
      if (post === 'RESERVE') stats[g].reserve += 1
      else if (post && post !== 'OFF') {
        stats[g].shifts += 1
        stats[g].hours += hoursForPost(post)
      }
    }
  }
  return stats
}
