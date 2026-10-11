// Plačilo Dilipu za izlet.
// Navadno: od cene čolna se odbije vodič, od ostanka Komba obdrži 10 %,
// vodič pa se Dilipu prišteje nazaj: (čoln − vodič) × 0,90 + vodič.
// Ena izjema: "Nosy Tanikely and trip around Nosy Komba" pri Dilipu.
// Plačamo polno ceno čolna iz cenika. Vodiča ne odbijemo in 10 % ne obdržimo.

const norm = (value: string | null | undefined) =>
  (value || '').toLowerCase().replace(/\s+/g, ' ').trim()

/** Samo ta izlet. Ne ujame Tanikely, Sakatie, otoka Nosy Komba ali "Top of Nosy Komba". */
export function isNosyTanikelyAroundKomba(name: string | null | undefined): boolean {
  const n = norm(name)
  return n.includes('tanikely') && n.includes('trip around') && n.includes('nosy komba')
}

/** Čolni, ki jih pelje Dilip. Taxi in Safari Baline nista Dilip. */
export function isDilipBoat(boatId?: string | null, boatName?: string | null): boolean {
  const id = norm(boatId)
  const name = norm(boatName)
  if (id.startsWith('taxi-') || name.startsWith('taxi')) return false
  if (id.includes('safari') || name.includes('safari') || name.includes('baline')) return false
  return true
}

export function dilipOwesFullBoatPrice(
  excursionName: string | null | undefined,
  boatId?: string | null,
  boatName?: string | null,
): boolean {
  return isNosyTanikelyAroundKomba(excursionName) && isDilipBoat(boatId, boatName)
}

/** Polna cena čolna, brez odbitka vodiča in brez 10 %. */
export function dilipFullBoatAr(boatPriceAr: number): number {
  return Math.max(0, Math.round(boatPriceAr || 0))
}

/** Navadna formula. Drugih izletov ne spreminja. */
export function standardDilipSupplierAr(boatPriceAr: number, guidePriceAr: number): number {
  return Math.round((boatPriceAr - guidePriceAr) * 0.9) + guidePriceAr
}

/**
 * Znesek pod "Dilip:" v ceniku dobaviteljev.
 * Izjema: polna cena čolna. Sicer shranjeni obračun (stara formula).
 */
export function shownDilipSupplierAr(opts: {
  excursionName: string | null | undefined
  boatId?: string | null
  boatName?: string | null
  boatPriceAr: number
  storedSupplierPriceAr?: number | null
}): number {
  if (dilipOwesFullBoatPrice(opts.excursionName, opts.boatId, opts.boatName)) {
    return dilipFullBoatAr(opts.boatPriceAr)
  }
  return opts.storedSupplierPriceAr || 0
}
