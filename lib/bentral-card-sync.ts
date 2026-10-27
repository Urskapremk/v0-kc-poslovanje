// Fields a first Bentral transfer copies onto a guest card.
// A later CSV import of the same Bentral number must write these again
// onto that same card. The match is the Bentral id, never the guest name.

export type BentralCardSource = {
  guestName: string
  units: string | null
  adults: number
  children: number
  checkIn: string
  checkOut: string
  status: string
  source: string | null
  country: string | null
  guestNotes: string | null
  ownNotes: string | null
  amount: string
  currency: string | null
}

export type BentralCardPatch = {
  guestName: string
  bungalow: string
  pax: number
  arrival: string
  departure: string
  checkIn: string
  checkOut: string
  adults: number
  children: number
  status: string
  bookingSource: string
  nationality: string | null
  notes: string | null
  totalAmount: string
  amountPaid: string
  currency: string
}

// Statuses reception sets after the booking exists. A repeat import must not
// knock an in-house or departing guest back to a fresh reservation.
const KEPT_CARD_STATUSES = new Set([
  'ARRIVING_TODAY',
  'IN_HOUSE',
  'DEPARTING_TODAY',
  'CHECKED_OUT',
])

export function bentralAmountPaid(status: string, amount: string): string {
  const s = (status || '').toLowerCase()
  const isPaid = s.includes('placano') || s.includes('plačano')
  return isPaid ? amount : '0'
}

export function cardStatusFromBentral(bentralStatus: string, currentStatus: string): string {
  if (bentralStatus === 'Preklicano') return 'CANCELLED'
  if (KEPT_CARD_STATUSES.has(currentStatus)) return currentStatus
  return 'RESERVED'
}

export function cardFieldsFromBentral(bentral: BentralCardSource, currentStatus: string): BentralCardPatch {
  const notes = [bentral.guestNotes, bentral.ownNotes].filter(Boolean).join('\n---\n')
  return {
    guestName: bentral.guestName,
    bungalow: bentral.units || 'TBD',
    pax: (bentral.adults || 0) + (bentral.children || 0),
    arrival: bentral.checkIn,
    departure: bentral.checkOut,
    checkIn: bentral.checkIn,
    checkOut: bentral.checkOut,
    adults: bentral.adults,
    children: bentral.children,
    status: cardStatusFromBentral(bentral.status, currentStatus),
    bookingSource: bentral.source || 'Direct',
    nationality: bentral.country,
    notes: notes || null,
    totalAmount: bentral.amount,
    amountPaid: bentralAmountPaid(bentral.status, bentral.amount),
    currency: bentral.currency || 'EUR',
  }
}
