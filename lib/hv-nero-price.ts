// Nabava HV (Hell-Ville): čoln je Nero. Dilipu se plača 120.000 ali 180.000 Ar.
// Vse drugo (voznik, nosači, tuc tuc, drugi dobavitelji) ostane nedotaknjeno.

export const HV_NERO_BOAT = "Nero"
export const HV_NERO_PRICES_AR = [120_000, 180_000] as const
export type HvNeroPriceAr = (typeof HV_NERO_PRICES_AR)[number]
export const HV_NERO_DEFAULT_AR: HvNeroPriceAr = 120_000

/** Shrani samo 180.000. Vse ostalo, vključno s praznim zapisom, ostane 120.000. */
export function hvNeroPriceAr(stored: unknown): HvNeroPriceAr {
  const n = Math.round(Number(stored) || 0)
  return n === 180_000 ? 180_000 : HV_NERO_DEFAULT_AR
}
