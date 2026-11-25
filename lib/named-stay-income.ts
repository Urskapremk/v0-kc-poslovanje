// Two guest cards whose lodging must not follow the generic night split.
// Other guests keep the existing calculation.

export const MAYALEN_STAY_ID = 'res-1788098277691-f69d9433c39eb8'
export const BENDA_STAY_ID = 'res-1788111600000-benda7'

export type NamedLodging = { eur: number; nights: number }

// Mayalen slept 28–31 March. Checkout on 1 April is not an April night.
// Nina is 20 EUR a night: 10 nights in April, 4 nights in May.
// Mark's 1 EUR is once, with the April part of the stay.
export function namedLodgingForMonth(reservationId: string, month: number): NamedLodging | null {
  if (reservationId === MAYALEN_STAY_ID) {
    return month === 3 ? { eur: 1433.18, nights: 4 } : { eur: 0, nights: 0 }
  }
  if (reservationId === BENDA_STAY_ID) {
    if (month === 4) return { eur: 201, nights: 10 }
    if (month === 5) return { eur: 80, nights: 4 }
    return { eur: 0, nights: 0 }
  }
  return null
}

export type LodgingShareLine = {
  id: string
  guestName: string
  reference: string
  night: string
  amountEur: number
}

export function lodgingShareLines(month: number): LodgingShareLine[] {
  if (month === 3) {
    return [{
      id: 'stay-mayalen-march',
      guestName: 'Mayalen Darrigade Sallaberry',
      reference: '5555502819',
      night: '2026-03-31',
      amountEur: 1433.18,
    }]
  }
  if (month === 4) {
    return [
      {
        id: 'stay-benda-nina-april',
        guestName: 'Benda Nina in Mark',
        reference: 'Nina, 10 noči',
        night: '2026-04-30',
        amountEur: 200,
      },
      {
        id: 'stay-benda-mark-april',
        guestName: 'Benda Nina in Mark',
        reference: 'Mark, nočitev',
        night: '2026-04-21',
        amountEur: 1,
      },
    ]
  }
  if (month === 5) {
    return [{
      id: 'stay-benda-nina-may',
      guestName: 'Benda Nina in Mark',
      reference: 'Nina, 4 noči',
      night: '2026-05-04',
      amountEur: 80,
    }]
  }
  return []
}

// Mayalen's card does not come through the night list, so the loop never
// adds her 1.433,18. Add it once, and only in March. If the card is already
// in that list, the loop has added it and this stays at zero.
// Nina's invoice lines. The guest card has no meal or drink rows. Amounts are cents.
// Dates in April stay in April. Dates in May stay in May. Lodging is not here.
const NINA_HRANA_CENTS: Array<[string, number]> = [
  ['2026-04-21', 6300],
  ['2026-04-22', 2700],
  ['2026-04-22', 6300],
  ['2026-04-23', 5400],
  ['2026-04-23', 6300],
  ['2026-04-24', 5400],
  ['2026-04-24', 6300],
  ['2026-04-25', 5400],
  ['2026-04-25', 6300],
  ['2026-04-26', 2700],
  ['2026-04-27', 6300],
  ['2026-04-28', 2700],
  ['2026-04-28', 6300],
  ['2026-04-29', 2700],
  ['2026-04-29', 6300],
  ['2026-04-30', 2700],
  ['2026-04-30', 6300],
  ['2026-05-01', 2700],
  ['2026-05-01', 6300],
  ['2026-05-02', 2700],
  ['2026-05-02', 6300],
  ['2026-05-03', 2700],
  ['2026-05-03', 6300],
  ['2026-05-04', 2700],
  ['2026-05-04', 6300],
]

const NINA_PIJACA_CENTS: Array<[string, number]> = [
  ['2026-04-21', 1595],
  ['2026-04-22', 2085],
  ['2026-04-23', 1702],
  ['2026-04-24', 1170],
  ['2026-04-25', 1702],
  ['2026-04-27', 531],
  ['2026-04-28', 2085],
  ['2026-04-29', 744],
  ['2026-04-30', 319],
  ['2026-05-01', 531],
  ['2026-05-02', 1276],
  ['2026-05-03', 1063],
  ['2026-05-04', 1063],
]

function centsInMonth(lines: Array<[string, number]>, year: number, month: number): number {
  const prefix = `${year}-${String(month).padStart(2, '0')}`
  return lines.reduce((sum, [date, cents]) => (date.startsWith(prefix) ? sum + cents : sum), 0)
}

export function ninaInvoiceIncome(year: number, month: number): { hrana: number; pijaca: number } {
  return {
    hrana: centsInMonth(NINA_HRANA_CENTS, year, month) / 100,
    pijaca: centsInMonth(NINA_PIJACA_CENTS, year, month) / 100,
  }
}

export function lodgingBesideTheNightList(reservationIds: string[], month: number): NamedLodging {
  if (month === 3 && !reservationIds.includes(MAYALEN_STAY_ID)) {
    return { eur: 1433.18, nights: 4 }
  }
  return { eur: 0, nights: 0 }
}

export function bendaTransferInMonth(pickupDate: string | null, type: string | null, year: number, month: number): boolean {
  const fallback = type === 'departure' ? '2026-05-05' : '2026-04-21'
  const date = (pickupDate || fallback).slice(0, 10)
  const [y, m] = date.split('-').map(Number)
  return y === year && m === month
}
