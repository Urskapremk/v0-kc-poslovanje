// Stays booked through a platform in a foreign currency (e.g. Airbnb in USD) are settled
// separately: the stay price and its payment stay in that currency, while everything the
// guest consumes at the lodge (bar, transfers, excursions) is billed in EUR.

type PaymentLike = { amount?: number | string | null; currency?: string | null }

export function foreignStayCurrency(res: { currency?: string | null }): string | null {
  const c = (res.currency || 'EUR').trim().toUpperCase()
  return c && c !== 'EUR' ? c : null
}

// Splits recorded payments into the stay payment(s) (in the stay currency) and the EUR
// payments for lodge extras. Payments tagged with the stay currency belong to the stay;
// an untagged payment matching the stay price exactly is treated as the platform payout.
export function splitStayPayments<T extends PaymentLike>(payments: T[], stayCurrency: string, stayTotal: number) {
  const stay: T[] = []
  const eur: T[] = []
  const hasTagged = payments.some((p) => (p.currency || 'EUR').toUpperCase() === stayCurrency)
  let matched = false
  for (const p of payments) {
    const cur = (p.currency || 'EUR').toUpperCase()
    if (cur === stayCurrency) stay.push(p)
    else if (!hasTagged && !matched && stayTotal > 0 && Math.abs(Number(p.amount || 0) - stayTotal) < 0.01) {
      stay.push(p)
      matched = true
    } else eur.push(p)
  }
  const sum = (arr: T[]) => arr.reduce((s, p) => s + (Number(p.amount) || 0), 0)
  return { stay, eur, stayPaid: sum(stay), eurPaid: sum(eur) }
}
