import { bungalowDisplayName, bungalowKey } from './bungalow'

// Mojca Aleš, Bungalow IV, left on Tuesday 3 Nov 2026. Boat and taxi were
// already paid. The booking, the guest and those payments stay. Only this
// one card leaves the operational transfers list.
const HIDDEN_DEPARTURE_DAY = '2026-11-03'

function fold(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function day(value: string | null | undefined): string {
  const match = String(value || '').match(/\d{4}-\d{2}-\d{2}/)
  return match ? match[0] : ''
}

function isBeachVillaIv(bungalow: string | null | undefined): boolean {
  if (bungalowKey(bungalow) === 'ocean-iv') return true
  const shown = fold(`${bungalowDisplayName(bungalow)} ${bungalow || ''}`)
  return shown.includes('beach villa')
}

/**
 * True only for the completed 3 Nov 2026 departure of Mojca Aleš from
 * Bungalow IV. Every other transfer, including a later day for the same
 * guest, stays on the list.
 */
export function hideCompletedDepartureFromList(input: {
  type: 'arrival' | 'departure' | 'reception'
  guestName: string | null | undefined
  bungalow: string | null | undefined
  stayDate: string | null | undefined
  pickupDate?: string | null | undefined
}): boolean {
  if (input.type !== 'departure') return false
  const name = fold(input.guestName || '')
  if (!name.includes('mojca') || !name.includes('ales')) return false
  if (!isBeachVillaIv(input.bungalow)) return false
  const listDay = day(input.pickupDate) || day(input.stayDate)
  return listDay === HIDDEN_DEPARTURE_DAY
}
