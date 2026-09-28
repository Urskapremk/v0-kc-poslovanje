// Kategorije za razbitje zneska računa (stroški arhiv).
// Ločena datoteka (NE 'use server'), ker server akcije lahko izvažajo samo async funkcije.

export const STROSEK_CATEGORIES = ['bar', 'nocitve', 'kuhinja', 'wellness', 'reprezentanca', 'ostalo'] as const
export type StrosekCategory = (typeof STROSEK_CATEGORIES)[number]

export const CATEGORY_LABELS: Record<StrosekCategory, string> = {
  bar: 'Bar',
  nocitve: 'Nočitve',
  kuhinja: 'Kuhinja',
  wellness: 'Wellness',
  reprezentanca: 'Reprezentanca',
  ostalo: 'Ostalo',
}

// amountEur = znesek alokacije v EUR (gre v kalkulacije).
// amountOriginal = znesek alokacije v izvirni valuti računa (Ar za ariarijske račune) — osnova, ki jo vpiše uporabnica.
export type CategoryAllocation = { category: StrosekCategory; amountEur: number; amountOriginal?: number }

export function parseCategories(raw: unknown): CategoryAllocation[] {
  let arr: unknown = raw
  if (typeof raw === 'string') {
    try { arr = JSON.parse(raw) } catch { return [] }
  }
  if (!Array.isArray(arr)) return []
  return arr
    .map((c) => {
      const cat = (c as { category?: string })?.category
      const amt = Number((c as { amountEur?: unknown })?.amountEur ?? 0)
      const origRaw = (c as { amountOriginal?: unknown })?.amountOriginal
      if (!STROSEK_CATEGORIES.includes(cat as StrosekCategory)) return null
      const out: CategoryAllocation = { category: cat as StrosekCategory, amountEur: amt }
      if (origRaw != null && Number.isFinite(Number(origRaw))) out.amountOriginal = Number(origRaw)
      return out
    })
    .filter((c): c is CategoryAllocation => c !== null)
}
