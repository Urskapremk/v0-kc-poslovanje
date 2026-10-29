// Cash on the reservation payments panel is entered in Ariary.
// The rest of that panel (Skupaj / Placano / Preostanek) stays in EUR, so the
// entered Ariary is converted with the app exchange rate (Ariary per 1 EUR) —
// the same rate as getExchangeRate() / the dashboard exchangeRate. Do not
// introduce a second rate.

/** EUR amount (2 decimals) for a cash sum entered in Ariary. */
export function cashAriaryToEurAmount(amountAr: number, rate: number): string {
  const ar = Math.round(Number(amountAr))
  if (!Number.isFinite(ar) || ar <= 0) return '0.00'
  if (!Number.isFinite(rate) || rate <= 0) return '0.00'
  return (ar / rate).toFixed(2)
}
