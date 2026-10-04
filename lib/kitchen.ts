// Shared constants & types for the KITCHEN schedule.
// NOTE: This file must NOT contain 'use server' — it exports constants and pure
// functions used by the client component.

// Full roster (display order). Angelina goes on maternity leave from August 2026
// and returns in September 2026 (period C). Selvera leaves in September 2026 —
// her past records (periods A/B) are kept, but she is no longer scheduled.
// Verginie (chef, morning) and Justin (assistant, afternoon, student) join in
// September 2026. Which names are active per month is decided in
// getActiveKitchenStaff.
export const KITCHEN_STAFF = [
  'Anifa',
  'Selvera',
  'Angelina',
  'Verginie',
  'Nazirah',
  'Francia',
  'Justin',
] as const
export type KitchenStaff = (typeof KITCHEN_STAFF)[number]

// Two daily shifts + OFF.
//  MORNING   = 06:00–12:00 (6 h)
//  AFTERNOON = split 12:00–15:00 + 17:00–21:00 (3 + 4 = 7 h)
// From 3 October 2026 the split afternoon is replaced by two shifts:
//  MIDDAY  = 10:00–16:00 (6 h)
//  EVENING = 16:00–22:00 (6 h)
//  EARLY   = 06:00–10:00 (4 h) — morning shift of the 3-shift pattern
export type KitchenShift = 'EARLY' | 'MORNING' | 'MIDDAY' | 'AFTERNOON' | 'EVENING' | 'OFF'

/** Display order of working shifts (legend, by-shift view). */
export const SHIFT_ORDER: Exclude<KitchenShift, 'OFF'>[] = ['EARLY', 'MORNING', 'MIDDAY', 'AFTERNOON', 'EVENING']

export const SHIFT_HOURS: Record<KitchenShift, number> = {
  EARLY: 4,
  MORNING: 6,
  MIDDAY: 6,
  AFTERNOON: 7,
  EVENING: 6,
  OFF: 0,
}

// Slovenian labels (on-screen, for the manager)
export const SHIFT_LABELS: Record<KitchenShift, string> = {
  EARLY: 'Dopoldan 06-10',
  MORNING: 'Dopoldan 06-12',
  MIDDAY: 'Opoldan 10-16',
  AFTERNOON: 'Popoldan 12-15 / 17-21',
  EVENING: 'Večer 16-22',
  OFF: 'Prosto',
}

// French labels (printed sheets — kitchen staff read French)
export const SHIFT_LABELS_FR: Record<KitchenShift, string> = {
  EARLY: 'Matin 6h-10h',
  MORNING: 'Matin 6h-12h',
  MIDDAY: 'Midi 10h-16h',
  AFTERNOON: 'Après-midi 12h-15h / 17h-21h',
  EVENING: 'Soir 16h-22h',
  OFF: 'Repos',
}

// Role per person (static). Slovenian (on-screen) + French (print).
export type KitchenRole = 'CHEF_MORNING' | 'ASSIST_MORNING' | 'CHEF_AFTERNOON' | 'ASSIST_AFTERNOON'
export const STAFF_ROLE: Record<KitchenStaff, KitchenRole> = {
  Anifa: 'CHEF_MORNING',
  Selvera: 'ASSIST_MORNING',
  Angelina: 'CHEF_AFTERNOON',
  Verginie: 'CHEF_MORNING',
  Nazirah: 'CHEF_AFTERNOON',
  Francia: 'ASSIST_AFTERNOON',
  Justin: 'ASSIST_AFTERNOON',
}
  // Kuhinjski študenti na praksi (allocateTo 'kuhinja', employmentType 'stagiaire'),
  // od septembra 2026. Noli in Severin DOPOLDAN, Vali POPOLDAN (smeni Vali/Severin
  // zamenjani na željo uporabnice); vsak 6 dni delo + 1 dan prost. Ključi = uradna
  // imena (ujemanje z dopusti); v prikazu se lahko uporabi vzdevek (glej kuhinja-tab displayName).
export const KITCHEN_STUDENTS = ['Noeline Anjara', 'Severin Avilaza', 'Valencia Soaline'] as const

// Privzeta smena študenta (razen na prostem dnevu).
const STUDENT_WORK_SHIFT: Record<string, KitchenShift> = {
  'Noeline Anjara': 'MORNING',
  'Valencia Soaline': 'AFTERNOON',
  'Severin Avilaza': 'MORNING',
}
// Prosti dan v 7-dnevnem ciklu (offset 0..6). Vsak študent svoj dan → 6+1;
// dekleti (0 in 2) nista prosti isti dan, da dopoldne pokrije vsaj ena.
const STUDENT_OFF_OFFSET: Record<string, number> = {
  'Noeline Anjara': 0,
  'Valencia Soaline': 2,
  'Severin Avilaza': 4,
}
// Vloga študenta (za oznake in tiskane liste).
const STUDENT_ROLE: Record<string, KitchenRole> = {
  'Noeline Anjara': 'ASSIST_MORNING',
  'Valencia Soaline': 'ASSIST_AFTERNOON',
  'Severin Avilaza': 'ASSIST_MORNING',
}

// Period-aware role. STAFF_ROLE keeps each person's historical/default role so
// past months (periods A/B) print correctly; from September 2026 (period C)
// Francia moves to the morning shift (Justin stays afternoon). Students use
// STUDENT_ROLE (fixed).
export function getStaffRole(person: string, year: number, month: number): KitchenRole {
  if (person in STUDENT_ROLE) return STUDENT_ROLE[person]
  if (getKitchenPeriod(year, month) === 'C' && person === 'Francia') return 'ASSIST_MORNING'
  return STAFF_ROLE[person as KitchenStaff]
}
export const ROLE_LABELS: Record<KitchenRole, string> = {
  CHEF_MORNING: 'Kuharica dopoldan',
  ASSIST_MORNING: 'Pomočnica dopoldan',
  CHEF_AFTERNOON: 'Kuharica popoldan',
  ASSIST_AFTERNOON: 'Pomočnica popoldan',
}
export const ROLE_LABELS_FR: Record<KitchenRole, string> = {
  CHEF_MORNING: 'Cuisinière (matin)',
  ASSIST_MORNING: 'Aide-cuisinière (matin)',
  CHEF_AFTERNOON: 'Cuisinière (après-midi)',
  ASSIST_AFTERNOON: 'Aide-cuisinière (après-midi)',
}

// Kept for backwards compatibility (some callers may import it).
export const HOURS_PER_SHIFT = 6

export type DaySchedule = { date: string; assignments: Record<string, KitchenShift> }

// Period A = June/July 2026 (Angelina active, 5 people).
// Period B = August 2026 only (Angelina on maternity leave, hidden — 4 people).
// Period C = September 2026 onwards (Angelina back; Selvera left — records kept
// but unscheduled; Verginie + Justin joined — 6 people).
export type KitchenPeriod = 'A' | 'B' | 'C'

export function getKitchenPeriod(year: number, month: number): KitchenPeriod {
  if (year > 2026) return 'C'
  if (year === 2026 && month >= 9) return 'C'
  if (year === 2026 && month === 8) return 'B'
  return 'A'
}

// Core roster per period (display order). Off-day rotation uses this order.
// Students are NOT part of this list (they have their own 6+1 rotation and must
// not enter the core off-rotation).
export function getKitchenCore(year: number, month: number): KitchenStaff[] {
  const period = getKitchenPeriod(year, month)
  if (period === 'A') return ['Anifa', 'Selvera', 'Angelina', 'Nazirah', 'Francia']
  if (period === 'B') return ['Anifa', 'Selvera', 'Nazirah', 'Francia']
  // Period C: Selvera left; Verginie (chef, morning) + Justin (assist, afternoon)
  // joined; Angelina back (always afternoon, split shift).
  // From November 2026 the three-shift pattern has no place for Verginie.
  if (year > 2026 || (year === 2026 && month >= 11)) {
    return ['Anifa', 'Angelina', 'Nazirah']
  }
  // From October 2026 Francia and Justin are no longer in the kitchen.
  if (year === 2026 && month === 10) {
    return ['Anifa', 'Verginie', 'Angelina', 'Nazirah']
  }
  return ['Anifa', 'Verginie', 'Angelina', 'Nazirah', 'Francia', 'Justin']
}

// Full active roster for display (columns, pills, hours): core + students
// (students only from September 2026 / period C).
export function getKitchenStudents(year: number, month: number): string[] {
  if (getKitchenPeriod(year, month) !== 'C') return []
  // From October 2026 Severin is no longer in the kitchen.
  if (year > 2026 || (year === 2026 && month >= 10)) {
    return KITCHEN_STUDENTS.filter((s) => s !== 'Severin Avilaza')
  }
  return [...KITCHEN_STUDENTS]
}

export function getActiveKitchenStaff(year: number, month: number): string[] {
  return [...getKitchenCore(year, month), ...getKitchenStudents(year, month)]
}

// Anchor for the continuous 6-work / 1-off rotation (schedule starts 29.06.2026).
const ROTATION_ANCHOR = Date.UTC(2026, 5, 29) // 2026-06-29
const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Builds the assignments for a single day given who (if anyone) is off.
 * Encodes the manager's rules per active period.
 */
function buildDayAssignments(
  period: KitchenPeriod,
  active: KitchenStaff[],
  off: KitchenStaff | null,
): Record<string, KitchenShift> {
  const a: Record<string, KitchenShift> = {}
  for (const p of active) a[p] = 'OFF'
  const set = (p: KitchenStaff, s: KitchenShift) => {
    if (active.includes(p)) a[p] = s
  }

  if (period === 'A') {
    // Normal: morning Anifa+Selvera; afternoon Angelina+Nazirah+Francia
    switch (off) {
      case 'Anifa':
        // Selvera alone morning + Francia helps morning; afternoon Angelina+Nazirah
        set('Selvera', 'MORNING'); set('Francia', 'MORNING')
        set('Angelina', 'AFTERNOON'); set('Nazirah', 'AFTERNOON')
        break
      case 'Selvera':
        set('Anifa', 'MORNING'); set('Francia', 'MORNING')
        set('Angelina', 'AFTERNOON'); set('Nazirah', 'AFTERNOON')
        break
      case 'Angelina':
        set('Anifa', 'MORNING'); set('Selvera', 'MORNING')
        set('Nazirah', 'AFTERNOON'); set('Francia', 'AFTERNOON')
        break
      case 'Nazirah':
        set('Anifa', 'MORNING'); set('Selvera', 'MORNING')
        set('Angelina', 'AFTERNOON'); set('Francia', 'AFTERNOON')
        break
      case 'Francia':
        set('Anifa', 'MORNING'); set('Selvera', 'MORNING')
        set('Angelina', 'AFTERNOON'); set('Nazirah', 'AFTERNOON')
        break
      default:
        set('Anifa', 'MORNING'); set('Selvera', 'MORNING')
        set('Angelina', 'AFTERNOON'); set('Nazirah', 'AFTERNOON'); set('Francia', 'AFTERNOON')
    }
    return a
  }

  if (period === 'C') {
    // Normal: morning Anifa+Verginie (chefs) + Francia (assist, ALWAYS morning);
    // afternoon Angelina+Nazirah (chefs) + Justin (assist, ALWAYS afternoon).
    // Angelina always afternoon (split shift); Francia never afternoon; Justin never morning.
    switch (off) {
      case 'Anifa':
        set('Verginie', 'MORNING'); set('Francia', 'MORNING')
        set('Angelina', 'AFTERNOON'); set('Nazirah', 'AFTERNOON'); set('Justin', 'AFTERNOON')
        break
      case 'Verginie':
        set('Anifa', 'MORNING'); set('Francia', 'MORNING')
        set('Angelina', 'AFTERNOON'); set('Nazirah', 'AFTERNOON'); set('Justin', 'AFTERNOON')
        break
      case 'Angelina':
        set('Anifa', 'MORNING'); set('Verginie', 'MORNING'); set('Francia', 'MORNING')
        set('Nazirah', 'AFTERNOON'); set('Justin', 'AFTERNOON')
        break
      case 'Nazirah':
        set('Anifa', 'MORNING'); set('Verginie', 'MORNING'); set('Francia', 'MORNING')
        set('Angelina', 'AFTERNOON'); set('Justin', 'AFTERNOON')
        break
      case 'Francia':
        set('Anifa', 'MORNING'); set('Verginie', 'MORNING')
        set('Angelina', 'AFTERNOON'); set('Nazirah', 'AFTERNOON'); set('Justin', 'AFTERNOON')
        break
      case 'Justin':
        set('Anifa', 'MORNING'); set('Verginie', 'MORNING'); set('Francia', 'MORNING')
        set('Angelina', 'AFTERNOON'); set('Nazirah', 'AFTERNOON')
        break
      default:
        set('Anifa', 'MORNING'); set('Verginie', 'MORNING'); set('Francia', 'MORNING')
        set('Angelina', 'AFTERNOON'); set('Nazirah', 'AFTERNOON'); set('Justin', 'AFTERNOON')
    }
    return a
  }

  // Period B (Angelina on maternity). Normal: morning Anifa+Selvera; afternoon Nazirah+Francia
  switch (off) {
    case 'Anifa':
      set('Selvera', 'MORNING')
      set('Nazirah', 'AFTERNOON'); set('Francia', 'AFTERNOON')
      break
    case 'Selvera':
      set('Anifa', 'MORNING')
      set('Nazirah', 'AFTERNOON'); set('Francia', 'AFTERNOON')
      break
    case 'Nazirah':
      // Anifa replaces Nazirah in the afternoon; Selvera alone morning
      set('Selvera', 'MORNING')
      set('Anifa', 'AFTERNOON'); set('Francia', 'AFTERNOON')
      break
    case 'Francia':
      // Selvera helps afternoon; Anifa alone morning
      set('Anifa', 'MORNING')
      set('Nazirah', 'AFTERNOON'); set('Selvera', 'AFTERNOON')
      break
    default:
      set('Anifa', 'MORNING'); set('Selvera', 'MORNING')
      set('Nazirah', 'AFTERNOON'); set('Francia', 'AFTERNOON')
  }
  return a
}

// From 3 October 2026: morning Nazirah + Noli, midday Anifa, evening Angelina + Vali.
// When Anifa is off, Vali covers midday and Angelina works the evening alone.
// When Angelina is off, Anifa works the evening and Vali covers midday.
// Each person keeps a 6-work / 1-off rotation (own offset in the 7-day cycle;
// offsets 1 and 6 nobody is off).
const NEW_PATTERN_START = '2026-10-03'
const NOLI = 'Noeline Anjara'
const VALI = 'Valencia Soaline'
const THREE_SHIFT_OFF_OFFSET: Record<string, number> = {
  Anifa: 0,
  Angelina: 2,
  Nazirah: 3,
  [NOLI]: 4,
  [VALI]: 5,
}

function applyThreeShiftPattern(a: Record<string, KitchenShift>, offset: number) {
  for (const p of Object.keys(a)) a[p] = 'OFF'
  const isOff = (p: string) => THREE_SHIFT_OFF_OFFSET[p] === offset
  const set = (p: string, s: KitchenShift) => {
    a[p] = isOff(p) ? 'OFF' : s
  }
  set('Nazirah', 'EARLY')
  set(NOLI, 'EARLY')
  set('Anifa', isOff('Angelina') ? 'EVENING' : 'MIDDAY')
  set('Angelina', 'EVENING')
  set(VALI, isOff('Anifa') || isOff('Angelina') ? 'MIDDAY' : 'EVENING')
}

/**
 * Generates the kitchen schedule for a given month.
 *
 * Rules:
 *  - 6 days work, 7th day off (continuous rotation from 29.06.2026).
 *  - Two shifts: morning (06–12) and split afternoon (12–15 / 17–21).
 *  - Nobody works morning AND afternoon the same day.
 *  - At most one person is off per day; off-days rotate by roster order so the
 *    control pairs (Anifa/Selvera, Angelina/Nazirah) are never off together.
 *  - Per-person "off" rules redistribute staff to keep every shift covered with
 *    at least one chef (see buildDayAssignments).
 */
export function generateKitchenSchedule(year: number, month: number): DaySchedule[] {
  const lastDay = new Date(year, month, 0).getDate()
  const period = getKitchenPeriod(year, month)
  const core = getKitchenCore(year, month)
  const result: DaySchedule[] = []

  for (let day = 1; day <= lastDay; day++) {
    const todayUTC = Date.UTC(year, month - 1, day)
    const diffDays = Math.round((todayUTC - ROTATION_ANCHOR) / DAY_MS)
    const offset = ((diffDays % 7) + 7) % 7 // 0..6
    const off = offset < core.length ? core[offset] : null

    const assignments = buildDayAssignments(period, core, off)

    // Students (September 2026 / period C): boy afternoon, girls morning, each
    // with an independent 6-work / 1-off rotation (own off-day per 7-day cycle).
    if (period === 'C') {
      for (const s of getKitchenStudents(year, month)) {
        // From October 2026 (4 core cooks off on offsets 0-3), students take their
        // day off on offsets when every cook works, so no shift is left with one person.
        const octPlus = year > 2026 || (year === 2026 && month >= 10)
        const offOffset = octPlus
          ? ({ 'Noeline Anjara': 4, 'Valencia Soaline': 5 } as Record<string, number>)[s] ?? STUDENT_OFF_OFFSET[s]
          : STUDENT_OFF_OFFSET[s]
        // From October 2026 Vali and Noli swap shifts every 14 days: days 1-14
        // Vali morning / Noli afternoon, from day 15 the other way round.
        let workShift = STUDENT_WORK_SHIFT[s]
        if (octPlus && (s === 'Valencia Soaline' || s === 'Noeline Anjara')) {
          const firstHalf = day <= 14 || (year === 2026 && month === 10 && day >= 26)
          const valiMorning = firstHalf
          workShift = (s === 'Valencia Soaline') === valiMorning ? 'MORNING' : 'AFTERNOON'
        }
        assignments[s] = offset === offOffset ? 'OFF' : workShift
      }
    }

    // 1-4, 6-11 and 26-31 October 2026: Anifa works afternoon, Nazirah morning (on the days they work).
    if (year === 2026 && month === 10 && (day <= 4 || (day >= 6 && day <= 11) || day >= 26)) {
      if (assignments['Anifa'] && assignments['Anifa'] !== 'OFF') assignments['Anifa'] = 'AFTERNOON'
      if (assignments['Nazirah'] && assignments['Nazirah'] !== 'OFF') assignments['Nazirah'] = 'MORNING'
    }

    const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    if (date >= NEW_PATTERN_START) applyThreeShiftPattern(assignments, offset)
    // Verginie keeps the September rhythm (6 mornings, Tuesday off) through October.
    // The three-shift roster has no place for her, so that pattern would otherwise
    // mark every day from 3 October as free.
    if (date >= NEW_PATTERN_START && Object.prototype.hasOwnProperty.call(assignments, 'Verginie')) {
      assignments['Verginie'] = offset === 1 ? 'OFF' : 'MORNING'
    }
    result.push({ date, assignments })
  }

  return result
}

export type KitchenLeaveAdvanceMonth = {
  year: number
  month: number
  scheduledDays: number
  leaveWorkDays: number
  amountAr: number
}

// Plačilo dopusta vnaprej: cela mesečna plača krije delovne dni po razporedu
// (prosti dnevi niso v delitelju in niso dopust). Dopust šteje samo dneve,
// ko je oseba razporejena na delo.
export type KitchenLeaveAdvance = {
  amountAr: number
  salaryAr: number
  scheduledDays: number
  leaveWorkDays: number
  workedDates: string[]
  freeDates: string[]
  months: KitchenLeaveAdvanceMonth[]
}

function samePerson(a: string, b: string): boolean {
  const norm = (name: string) =>
    (name || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
  const na = norm(a)
  const nb = norm(b)
  if (!na || !nb) return false
  if (na === nb) return true
  const key = Math.min(4, na.length, nb.length)
  return na.slice(0, key) === nb.slice(0, key)
}

export function kitchenLeaveAdvancePay(
  staffName: string,
  startDate: string,
  endDate: string,
  monthlySalary: number,
): KitchenLeaveAdvance | null {
  const start = String(startDate ?? '').slice(0, 10)
  const end = String(endDate ?? '').slice(0, 10)
  const salary = Math.round(Number(monthlySalary))
  if (!staffName || !/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return null
  if (!(salary > 0) || start > end) return null

  let y = Number(start.slice(0, 4))
  let m = Number(start.slice(5, 7))
  const endY = Number(end.slice(0, 4))
  const endM = Number(end.slice(5, 7))

  const months: KitchenLeaveAdvanceMonth[] = []
  const freeDates: string[] = []
  const workedDates: string[] = []

  while (y < endY || (y === endY && m <= endM)) {
    const schedule = generateKitchenSchedule(y, m)
    const key = Object.keys(schedule[0]?.assignments ?? {}).find((k) => samePerson(k, staffName))
    if (key) {
      let scheduledDays = 0
      let leaveWorkDays = 0
      for (const day of schedule) {
        const shift = day.assignments[key]
        const working = !!shift && shift !== 'OFF'
        if (working) scheduledDays += 1
        const inLeave = day.date >= start && day.date <= end
        if (inLeave && working) leaveWorkDays += 1
        else if (inLeave) freeDates.push(day.date)
        else if (working) workedDates.push(day.date)
      }
      months.push({
        year: y,
        month: m,
        scheduledDays,
        leaveWorkDays,
        amountAr: scheduledDays > 0 ? Math.round((salary * leaveWorkDays) / scheduledDays) : 0,
      })
    }
    m += 1
    if (m > 12) {
      m = 1
      y += 1
    }
  }

  const scheduledDays = months.reduce((sum, month) => sum + month.scheduledDays, 0)
  if (scheduledDays === 0) return null
  return {
    amountAr: months.reduce((sum, month) => sum + month.amountAr, 0),
    salaryAr: salary,
    scheduledDays,
    leaveWorkDays: months.reduce((sum, month) => sum + month.leaveWorkDays, 0),
    workedDates,
    freeDates,
    months,
  }
}

/** Counts worked shifts and hours per person (morning 6 h, afternoon 7 h). */
export function computeKitchenStats(schedule: DaySchedule[]) {
  const stats: Record<string, { shifts: number; hours: number }> = {}
  for (const day of schedule) {
    for (const p of Object.keys(day.assignments)) {
      if (!stats[p]) stats[p] = { shifts: 0, hours: 0 }
      const shift = day.assignments[p]
      if (shift && shift !== 'OFF') {
        stats[p].shifts += 1
        stats[p].hours += SHIFT_HOURS[shift]
      }
    }
  }
  return stats
}
