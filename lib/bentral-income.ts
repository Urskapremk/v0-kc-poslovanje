// A few Bentral rows never became guest cards, so kalkulacije never saw them.
// The list is these rows only. Other untransferred bookings stay out.
// A drink row is an extra charge on a stay that is already on a guest card.
// 5555502819 is the lodging stay itself. The row stores one amount and no board.

export type BentralIncomeKind = 'nocitve' | 'pijaca'

export const BENTRAL_INCOME_KIND: Record<string, BentralIncomeKind> = {
  // 5555502819 is the same stay as guest card res-1788098277691-f69d9433c39eb8.
  // The card is the lodging. Adding this row again would count it twice.
  'K-2026-47': 'pijaca', // Mayalen drinks, night of 31 Mar
  'K-2026-45': 'pijaca', // Sayaka Harada drinks
  'K-2025-265': 'pijaca', // Vinko in Mirjana Ivačić drinks
  'K-2025-264': 'pijaca', // Hermina Krt drinks, 429.96 (the row labelled K-2026-2)
}

export const BENTRAL_INCOME_IDS = Object.keys(BENTRAL_INCOME_KIND)

export type BentralIncomeRow = {
  externalId: string
  checkIn: string
  checkOut: string
  amount: string | number
  currency?: string | null
  transferred?: boolean | null
  active?: boolean | null
}

export type BentralMonthIncome = {
  nocitve: number
  pijaca: number
  lodgingNights: number
}

// Nights are the dates you sleep: check-in inclusive, check-out exclusive.
// A departure on the 1st is the morning after the last night of the previous month.
export function stayNights(checkIn: string, checkOut: string): string[] {
  const start = checkIn.slice(0, 10)
  const end = checkOut.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return []
  const cursor = new Date(`${start}T00:00:00Z`)
  const last = new Date(`${end}T00:00:00Z`)
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(last.getTime()) || cursor >= last) return []
  const nights: string[] = []
  while (cursor < last && nights.length < 400) {
    nights.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return nights
}

// Split the stored cents across nights. Leftover cents sit on the earliest nights
// so the months add back to the stored amount.
export function centsForNightsInMonth(amountEur: number, nights: string[], year: number, month: number): number {
  const total = Math.round(amountEur * 100)
  if (!Number.isFinite(total) || total <= 0 || nights.length === 0) return 0
  const base = Math.floor(total / nights.length)
  const extra = total - base * nights.length
  const prefix = `${year}-${String(month).padStart(2, '0')}`
  let cents = 0
  nights.forEach((night, index) => {
    if (!night.startsWith(prefix)) return
    cents += base + (index < extra ? 1 : 0)
  })
  return cents
}

function euros(cents: number): number {
  return cents / 100
}

export function bentralIncomeForMonth(rows: BentralIncomeRow[], year: number, month: number): BentralMonthIncome {
  let nocitveCents = 0
  let pijacaCents = 0
  let lodgingNights = 0
  for (const row of rows) {
    if (row.active === false || row.transferred) continue
    const kind = BENTRAL_INCOME_KIND[row.externalId]
    if (!kind) continue
    const currency = (row.currency || 'EUR').trim().toUpperCase()
    if (currency !== 'EUR') continue
    const amount = typeof row.amount === 'number' ? row.amount : Number(row.amount)
    const nights = stayNights(row.checkIn, row.checkOut)
    const cents = centsForNightsInMonth(amount, nights, year, month)
    if (cents <= 0) continue
    if (kind === 'nocitve') {
      nocitveCents += cents
      lodgingNights += nights.filter(night => night.startsWith(`${year}-${String(month).padStart(2, '0')}`)).length
    } else {
      pijacaCents += cents
    }
  }
  return {
    nocitve: euros(nocitveCents),
    pijaca: euros(pijacaCents),
    lodgingNights,
  }
}
