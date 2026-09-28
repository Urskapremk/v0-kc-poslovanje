// Madagascar official public holidays (Gregorian + Easter-based movable feasts).
// Used to highlight holidays and Sundays in the shared staff schedules.
//
// Fixed holidays (same date every year):
//   Jan 1   New Year's Day
//   Mar 8   International Women's Day
//   Mar 29  Martyrs' Day (commemoration of the 1947 rebellion)
//   May 1   Labour Day
//   Jun 26  Independence Day
//   Aug 15  Assumption
//   Nov 1   All Saints' Day
//   Dec 25  Christmas
//
// Movable holidays (derived from Easter Sunday):
//   Easter Sunday, Easter Monday (+1), Ascension (+39), Pentecost (+49), Whit Monday (+50)
//
// Note: Islamic feasts (Eid) and the Malagasy New Year are set by decree each
// year and are intentionally not computed here.

export interface Holiday {
  month: number // 1-12
  day: number // 1-31
  name: string // French label (staff-facing)
}

// French (staff-facing) names for fixed holidays, keyed by "month-day".
const FIXED_HOLIDAYS: { month: number; day: number; name: string }[] = [
  { month: 1, day: 1, name: 'Jour de l\u2019An' },
  { month: 3, day: 8, name: 'Journ\u00e9e de la Femme' },
  { month: 3, day: 29, name: 'F\u00eate des Martyrs' },
  { month: 5, day: 1, name: 'F\u00eate du Travail' },
  { month: 6, day: 26, name: 'F\u00eate de l\u2019Ind\u00e9pendance' },
  { month: 8, day: 15, name: 'Assomption' },
  { month: 11, day: 1, name: 'Toussaint' },
  { month: 12, day: 25, name: 'No\u00ebl' },
]

// Compute Easter Sunday (Gregorian) using the Anonymous/Meeus algorithm.
function easterSunday(year: number): { month: number; day: number } {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31) // 3 = March, 4 = April
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return { month, day }
}

// Add N days to a {month, day} within the same year and return {month, day}.
function addDays(year: number, month: number, day: number, add: number): { month: number; day: number } {
  const d = new Date(year, month - 1, day + add)
  return { month: d.getMonth() + 1, day: d.getDate() }
}

// All Madagascar holidays for a given year, as a map keyed by "month-day".
export function getHolidayMap(year: number): Map<string, string> {
  const map = new Map<string, string>()
  for (const h of FIXED_HOLIDAYS) {
    map.set(`${h.month}-${h.day}`, h.name)
  }
  const easter = easterSunday(year)
  const movable: { add: number; name: string }[] = [
    { add: 0, name: 'P\u00e2ques' },
    { add: 1, name: 'Lundi de P\u00e2ques' },
    { add: 39, name: 'Ascension' },
    { add: 49, name: 'Pentec\u00f4te' },
    { add: 50, name: 'Lundi de Pentec\u00f4te' },
  ]
  for (const mv of movable) {
    const { month, day } = addDays(year, easter.month, easter.day, mv.add)
    const key = `${month}-${day}`
    // Keep the fixed-holiday name if there is a clash; otherwise add the feast.
    if (!map.has(key)) map.set(key, mv.name)
  }
  return map
}

// Return the holiday name for a specific date, or null if not a holiday.
export function getHolidayName(year: number, month: number, day: number): string | null {
  return getHolidayMap(year).get(`${month}-${day}`) ?? null
}

// True when the given date falls on a Sunday.
export function isSunday(year: number, month: number, day: number): boolean {
  return new Date(year, month - 1, day).getDay() === 0
}
