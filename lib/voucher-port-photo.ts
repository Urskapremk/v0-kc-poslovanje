// Which pier photo a transfer voucher may show.
// The email and the printable voucher page are the same HTML, so this one rule
// covers both. The only pier photo in the app is Port de Nosy Be
// (public/images/pickup-point-nosy-be.jpg). There is no Ankify photo — do not
// invent one. Ankify arrivals get no port photo.

export const NOSY_BE_PORT_PHOTO = '/images/pickup-point-nosy-be.jpg'

// "ankifi" is the spelling staff type as well as "Ankify".
const ANKIFY_RE = /ankif[iy]/i
// Word "port", not the letters inside "airport" or "transport".
const PORT_WORD_RE = /\bports?\b/i
// Names this lodge already uses for the Hell-Ville / Andoany pier.
const NOSY_BE_PORT_RE = /big\s*ports?|nosy[\s-]*be|hell[\s-]*ville|andoany/i

export type VoucherPortPlace = {
  type: 'arrival' | 'departure'
  pickupPoint: string
  routeName: string
  hermanRouteName: string
}

function isBarePort(text: string): boolean {
  const cleaned = text.trim().replace(/[.,;:]+$/g, '').trim()
  return /^(?:the\s+)?ports?$/i.test(cleaned)
}

/**
 * Path of the port photo for this voucher, or null when none should be shown.
 * Nosy Be pier photo only when the guest is collected at that port.
 * Port Ankify, "port ankifi", and Ankify never qualify.
 * A pickup that is only "port" / "the port" still means Nosy Be, unless the
 * route itself is Ankify.
 */
export function voucherPortPhoto(place: VoucherPortPlace): string | null {
  if (place.type !== 'arrival') return null
  const pickup = place.pickupPoint.trim()
  if (!pickup || ANKIFY_RE.test(pickup) || !PORT_WORD_RE.test(pickup)) return null
  const routes = `${place.routeName} ${place.hermanRouteName}`
  // "port" on an Ankify route is Ankify, not the Nosy Be pier.
  if (ANKIFY_RE.test(routes) && !NOSY_BE_PORT_RE.test(pickup)) return null
  if (NOSY_BE_PORT_RE.test(pickup) || isBarePort(pickup)) return NOSY_BE_PORT_PHOTO
  return null
}
