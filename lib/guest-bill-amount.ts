const num = (value: unknown) => (Number.isFinite(Number(value)) ? Number(value) : 0)

/** Same fallback as the guest bill when settings have no exchange rate. */
export const GUEST_BILL_RATE_FALLBACK = 4800

function formatAriary(value: unknown): string {
  return `${Math.round(num(value)).toLocaleString("de-DE")} Ar`
}

function formatEur(value: unknown): string {
  return `${num(value).toFixed(2)} EUR`
}

/**
 * Money on a "Postavke za placilo" line.
 * Excursions show the euro equivalent beside the ariary, using the app rate.
 * Every other category stays ariary only.
 */
export function guestBillLineAmount(category: string, priceAr: unknown, exchangeRate: number): string {
  const ariary = formatAriary(priceAr)
  if (category !== "Izlet") return ariary
  const rate = Number.isFinite(exchangeRate) && exchangeRate > 0 ? exchangeRate : GUEST_BILL_RATE_FALLBACK
  return `${ariary} · ${formatEur(Math.round(num(priceAr)) / rate)}`
}
