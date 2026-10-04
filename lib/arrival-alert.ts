/** Guide phone and arrival-day window for the bungalow card. */

const GUIDE_HINT = /guide|vodi[cč]|vodic|contact/i
// Madagascar mobile: 0XX XX XXX XX, or +261 XX XX XXX XX.
// Slashes are not separators, so a date like 03/10/2026 is not a phone.
const PHONE_RE = /(?:\+261|0)[\s.-]*(?:\d[\s.-]*){8,9}/g

function tidyPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10 && digits.startsWith('0')) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`
  }
  if (digits.startsWith('261') && digits.length === 12) {
    const n = digits.slice(3)
    return `+261 ${n.slice(0, 2)} ${n.slice(2, 4)} ${n.slice(4, 7)} ${n.slice(7)}`
  }
  return raw.replace(/\s+/g, ' ').trim()
}

/** Phone of the guest's guide, read from the reservation note. Null when none is written. */
export function guidePhoneFromNotes(notes: string | null | undefined): string | null {
  if (!notes) return null
  for (const raw of notes.split('\n---\n')) {
    const text = raw.replace(/^@\w+\s*/, '')
    if (!GUIDE_HINT.test(text)) continue
    PHONE_RE.lastIndex = 0
    const match = PHONE_RE.exec(text)
    if (match) return tidyPhone(match[0])
  }
  return null
}

function addOneDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10)
}

/** True on the arrival day and the day before. Compared as calendar dates, not timestamps. */
export function isDayBeforeOrArrival(arrival: string | null | undefined, todayIso: string): boolean {
  const day = String(arrival || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^\d{4}-\d{2}-\d{2}$/.test(todayIso)) return false
  return day === todayIso || day === addOneDay(todayIso)
}
