// Skupna preverba stroška izdelave za vnos in popravek.
// Znesek v Ar je celo število (enako kot polje v obrazcu: vse, kar ni števka, odpade).
// Datum mora biti resničen koledarski dan YYYY-MM-DD. Prazen ali neveljaven vnos se ne shrani.

export function amountFromArInput(raw: string): number {
  return Number(String(raw ?? '').replace(/[^\d]/g, '')) || 0
}

export function normalizeIsoDate(value: string | null | undefined): string | null {
  const date = String(value ?? '').trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const [year, month, day] = date.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null
  }
  return date
}

export function normalizeAssetCost(input: {
  date: string | null | undefined
  description: string | null | undefined
  amountAr: number
}): { date: string; description: string; amountAr: number } | null {
  const description = String(input.description ?? '').trim()
  const date = normalizeIsoDate(input.date)
  const amountAr = Math.round((Number(input.amountAr) || 0) * 100) / 100
  if (!description || !date || !(amountAr > 0)) return null
  return { date, description, amountAr }
}
