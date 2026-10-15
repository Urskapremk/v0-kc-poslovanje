// Kdo dela dopoldan / popoldan po oddelkih — za razpored čiščenja WC in tušev.
import { generateBarSchedule, type BarShift } from '@/lib/bar'
import { generateKitchenSchedule, SHIFT_LABELS as KITCHEN_LABELS, type KitchenShift } from '@/lib/kitchen'
import { generateGardenerSchedule, POST_LABELS, type GardenPost } from '@/lib/gardening'
import { housekeepingDay, housekeepingLabels, type Shift as HkShift } from '@/lib/housekeeping'
import { namesMatch } from '@/lib/leave'
import type { ScheduleLike } from '@/lib/wc-cleaning'

export type StaffDayShift = {
  working: boolean
  /** Upravičen za čiščenje ob 08:00 */
  morning08: boolean
  /** Upravičen za čiščenje ob 17:00 (primarni: popoldan/večer) */
  afternoon17Primary: boolean
  /** Samo opoldanska smena bara, če primarni nihče */
  afternoon17MiddayFallback: boolean
  label: string
}

export type StaffMemberLite = {
  staffName: string
  staffType: string
  endDate?: string | null
  active?: boolean
}

function findKey<T>(assignments: Record<string, T>, staffName: string): T | undefined {
  if (staffName in assignments) return assignments[staffName]
  for (const [k, v] of Object.entries(assignments)) {
    if (namesMatch(k, staffName)) return v
  }
  return undefined
}

function fromHousekeeping(date: string, shift: HkShift): StaffDayShift {
  const labels = housekeepingLabels(date)
  if (shift === 'MORNING') {
    return {
      working: true,
      morning08: true,
      afternoon17Primary: false,
      afternoon17MiddayFallback: false,
      label: labels.morningShort,
    }
  }
  if (shift === 'AFTERNOON') {
    return {
      working: true,
      morning08: false,
      afternoon17Primary: true,
      afternoon17MiddayFallback: false,
      label: labels.afternoonShort,
    }
  }
  return {
    working: false,
    morning08: false,
    afternoon17Primary: false,
    afternoon17MiddayFallback: false,
    label: 'Prosto',
  }
}

function fromBar(shift: BarShift): StaffDayShift {
  if (shift === 'MORNING') {
    return {
      working: true,
      morning08: true,
      afternoon17Primary: false,
      afternoon17MiddayFallback: false,
      label: 'Bar · Jutro',
    }
  }
  if (shift === 'EVENING') {
    return {
      working: true,
      morning08: false,
      afternoon17Primary: true,
      afternoon17MiddayFallback: false,
      label: 'Bar · Večer',
    }
  }
  if (shift === 'MIDDAY') {
    return {
      working: true,
      morning08: false,
      afternoon17Primary: false,
      afternoon17MiddayFallback: true,
      label: 'Bar · Opoldne',
    }
  }
  return {
    working: false,
    morning08: false,
    afternoon17Primary: false,
    afternoon17MiddayFallback: false,
    label: 'Prosto',
  }
}

function fromKitchen(shift: KitchenShift): StaffDayShift {
  if (shift === 'OFF') {
    return {
      working: false,
      morning08: false,
      afternoon17Primary: false,
      afternoon17MiddayFallback: false,
      label: 'Prosto',
    }
  }
  const label = `Kuhinja · ${KITCHEN_LABELS[shift]}`
  const morning = shift === 'EARLY' || shift === 'MORNING'
  const afternoonPrimary =
    shift === 'AFTERNOON' || shift === 'EVENING' || shift === 'MIDDAY'
  return {
    working: true,
    morning08: morning,
    afternoon17Primary: afternoonPrimary,
    afternoon17MiddayFallback: false,
    label,
  }
}

function fromGarden(post: GardenPost): StaffDayShift {
  if (post === 'OFF') {
    return {
      working: false,
      morning08: false,
      afternoon17Primary: false,
      afternoon17MiddayFallback: false,
      label: 'Prosto',
    }
  }
  if (post === 'BEACH_AM' || post === 'GARDEN_AM') {
    return {
      working: true,
      morning08: true,
      afternoon17Primary: false,
      afternoon17MiddayFallback: false,
      label: POST_LABELS[post],
    }
  }
  if (post === 'BEACH_PM' || post === 'GARDEN_PM') {
    return {
      working: true,
      morning08: false,
      afternoon17Primary: true,
      afternoon17MiddayFallback: false,
      label: POST_LABELS[post],
    }
  }
  // Rezerva — dela, primerno za popoldansko čiščenje
  return {
    working: true,
    morning08: false,
    afternoon17Primary: true,
    afternoon17MiddayFallback: false,
    label: POST_LABELS[post],
  }
}

function hkShiftOnDate(
  scheduleByDate: Map<string, Map<string, HkShift>>,
  date: string,
  name: string,
): HkShift {
  const fromDb = findKey(scheduleByDate.get(date) ?? {}, name)
  if (fromDb) return fromDb
  const plan = housekeepingDay(date)
  return findKey(plan as Record<string, HkShift>, name) ?? 'OFF'
}

/** Zaposleni, ki so vsaj en dan v mesecu (od 17. 10.) še v službi. */
export function wcStaffRoster(
  staff: StaffMemberLite[],
  year: number,
  month: number,
  fromDate: string,
): string[] {
  const lastDay = new Date(year, month, 0).getDate()
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
  const rangeStart = monthStart < fromDate ? fromDate : monthStart
  const rangeEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  if (rangeEnd < fromDate) return []

  const names: string[] = []
  for (const s of staff) {
    if (s.active === false) continue
    const end = s.endDate ? String(s.endDate).slice(0, 10) : null
    let any = false
    for (let d = 1; d <= lastDay; d++) {
      const date = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      if (date < rangeStart) continue
      if (end && date >= end) continue
      any = true
      break
    }
    if (any) names.push(s.staffName)
  }
  return names.sort((a, b) => a.localeCompare(b, 'sl'))
}

export function staffTypeByName(staff: StaffMemberLite[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const s of staff) out[s.staffName] = s.staffType
  return out
}

/** date -> staffName -> shift info (vsi oddelki). */
export function buildStaffShiftPlan(
  year: number,
  month: number,
  housekeepingEntries: ScheduleLike[],
  roster: string[],
  staffTypes: Record<string, string>,
): Map<string, Map<string, StaffDayShift>> {
  const barDays = generateBarSchedule(year, month)
  const kitchenDays = generateKitchenSchedule(year, month)
  const gardenDays = generateGardenerSchedule(year, month)

  const barByDate = new Map(barDays.map((d) => [d.date, d]))
  const kitchenByDate = new Map(kitchenDays.map((d) => [d.date, d]))
  const gardenByDate = new Map(gardenDays.map((d) => [d.date, d]))

  const hkMap = new Map<string, Map<string, HkShift>>()
  for (const e of housekeepingEntries) {
    if (!hkMap.has(e.date)) hkMap.set(e.date, new Map())
    hkMap.get(e.date)!.set(e.staffName, e.shift as HkShift)
  }

  const lastDay = new Date(year, month, 0).getDate()
  const plan = new Map<string, Map<string, StaffDayShift>>()

  for (let day = 1; day <= lastDay; day++) {
    const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const byName = new Map<string, StaffDayShift>()

    for (const name of roster) {
      const type = staffTypes[name] ?? ''
      let info: StaffDayShift | undefined

      if (type === 'housekeeper') {
        info = fromHousekeeping(date, hkShiftOnDate(hkMap, date, name))
      } else if (type === 'barman') {
        const barDay = barByDate.get(date)
        const shift = barDay ? findKey(barDay.assignments, name) ?? 'OFF' : 'OFF'
        info = fromBar(shift as BarShift)
      } else if (type === 'kitchen') {
        const kDay = kitchenByDate.get(date)
        const shift = kDay ? findKey(kDay.assignments, name) ?? 'OFF' : 'OFF'
        info = fromKitchen(shift as KitchenShift)
      } else if (type === 'gardener') {
        const gDay = gardenByDate.get(date)
        const post = gDay ? findKey(gDay.assignments, name) ?? 'OFF' : 'OFF'
        info = fromGarden(post as GardenPost)
      } else {
        // Neznan tip — poskusi vse vire
        const hk = hkShiftOnDate(hkMap, date, name)
        if (hk !== 'OFF') info = fromHousekeeping(date, hk)
        if (!info?.working) {
          const barDay = barByDate.get(date)
          const bs = barDay ? findKey(barDay.assignments, name) : undefined
          if (bs && bs !== 'OFF') info = fromBar(bs as BarShift)
        }
        if (!info?.working) {
          const kDay = kitchenByDate.get(date)
          const ks = kDay ? findKey(kDay.assignments, name) : undefined
          if (ks && ks !== 'OFF') info = fromKitchen(ks as KitchenShift)
        }
        if (!info?.working) {
          const gDay = gardenByDate.get(date)
          const gp = gDay ? findKey(gDay.assignments, name) : undefined
          if (gp && gp !== 'OFF') info = fromGarden(gp as GardenPost)
        }
        if (!info) {
          info = {
            working: false,
            morning08: false,
            afternoon17Primary: false,
            afternoon17MiddayFallback: false,
            label: '—',
          }
        }
      }

      byName.set(name, info)
    }
    plan.set(date, byName)
  }

  return plan
}
