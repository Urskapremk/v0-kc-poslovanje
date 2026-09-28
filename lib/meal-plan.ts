// Meal plan coverage helpers (NO 'use server' — pure functions usable on client & server)
//
// Meal plans:
//   B  = Breakfast only        -> covers breakfast
//   HB = Half Board            -> covers breakfast + dinner
//   FB = Full Board            -> covers breakfast + lunch + dinner
//
// The corresponding product IDs in the cenik (products table) are stable:
//   meal-breakfast, meal-lunch, meal-dinner

export const MEAL_PRODUCT_IDS = {
  breakfast: 'meal-breakfast',
  lunch: 'meal-lunch',
  dinner: 'meal-dinner',
} as const

/** Which meal product IDs are included in the given meal plan. */
export function mealPlanCoveredProductIds(mealPlan?: string | null): string[] {
  switch (mealPlan) {
    case 'B':
      return [MEAL_PRODUCT_IDS.breakfast]
    case 'HB':
      return [MEAL_PRODUCT_IDS.breakfast, MEAL_PRODUCT_IDS.dinner]
    case 'FB':
      return [MEAL_PRODUCT_IDS.breakfast, MEAL_PRODUCT_IDS.lunch, MEAL_PRODUCT_IDS.dinner]
    default:
      return []
  }
}

/** True when the given product is a meal included in the guest's meal plan. */
export function isMealCoveredByPlan(
  mealPlan: string | null | undefined,
  productId: string | null | undefined,
): boolean {
  if (!productId) return false
  return mealPlanCoveredProductIds(mealPlan).includes(productId)
}

/**
 * Koliko gostov iz rezervacije penzion dejansko pokriva.
 *
 * Rezervacija je ena vrstica, gostje v njej pa nimajo nujno istega dogovora: en
 * gost ima lahko polpenzion vse bivanje, drugi pa placa le posamezen obrok.
 * Prazen `mealPlanPax` pomeni "vse" — tako se berejo vse rezervacije, ki tega
 * polja niso nikoli nastavile, zato vedenje ostane nespremenjeno.
 *
 * Na enem mestu zato, ker ista omejitev velja za statistiko, postavko ob prijavi,
 * prikaz v profilu in bar. Ce bi se stevilka kje razlikovala, bi ista hrana bila
 * obracunana dvakrat ali pa nic.
 */
export function boardPax(pax: number | null | undefined, mealPlanPax: number | null | undefined): number {
  const total = Math.max(0, Number(pax) || 0)
  if (mealPlanPax == null) return total
  const covered = Number(mealPlanPax) || 0
  return covered > 0 ? Math.min(covered, total) : 0
}

/** Slovenska oblika stevila oseb: 1 oseba, 2 osebi, 3–4 osebe, 5+ oseb. */
export function paxLabel(n: number): string {
  const k = Math.abs(Math.floor(Number(n) || 0)) % 100
  if (k === 1) return `${n} oseba`
  if (k === 2) return `${n} osebi`
  if (k === 3 || k === 4) return `${n} osebe`
  return `${n} oseb`
}

// --- Otroski prehranski popusti --------------------------------------------
// Otroci placajo prehrano po starostnem razredu:
//   0-5 let   -> brezplacno       (placa 0 %)
//   5-10 let  -> 50 % popust      (placa 50 %)
//   10-15 let -> 20 % popust      (placa 80 %)
// Odrasli placajo polno. "payFactor" = delez cene, ki se placa.

export type ChildBandId = '0-5' | '5-10' | '10-15'

export interface ChildBand {
  id: ChildBandId
  label: string       // slovensko
  labelEn: string     // za racun/dobavnico v anglescini
  discount: number    // delez popusta (0..1)
  payFactor: number   // delez cene ki se placa (1 - discount)
}

export const CHILD_BANDS: ChildBand[] = [
  { id: '0-5', label: '0–5 let (brezplačno)', labelEn: '0–5 yrs (free)', discount: 1, payFactor: 0 },
  { id: '5-10', label: '5–10 let (−50 %)', labelEn: '5–10 yrs (−50%)', discount: 0.5, payFactor: 0.5 },
  { id: '10-15', label: '10–15 let (−20 %)', labelEn: '10–15 yrs (−20%)', discount: 0.2, payFactor: 0.8 },
]

export function childBand(id: string | null | undefined): ChildBand | undefined {
  return CHILD_BANDS.find((b) => b.id === id)
}

/** Delez cene, ki se placa za dano starostno oznako (privzeto odrasel = polno). */
export function mealPayFactor(bandId?: string | null): number {
  const b = childBand(bandId)
  return b ? b.payFactor : 1
}

export type ChildrenAges = Partial<Record<ChildBandId, number>>

/** Normaliziran zapis otrok po razredih (varno prebere JSONB vrednost). */
export function normalizeChildrenAges(raw: unknown): ChildrenAges {
  const out: ChildrenAges = {}
  if (raw && typeof raw === 'object') {
    for (const b of CHILD_BANDS) {
      const n = Number((raw as Record<string, unknown>)[b.id] || 0)
      if (n > 0) out[b.id] = Math.floor(n)
    }
  }
  return out
}

/** Skupno stevilo otrok. */
export function totalChildren(children: ChildrenAges): number {
  return CHILD_BANDS.reduce((s, b) => s + (children[b.id] || 0), 0)
}

/**
 * "Placljive enote" prehrane glede na sestavo gostov.
 * Odrasli = pax - vsota otrok (min 0). Vsak razred otrok se steje po svojem payFactor.
 * Rezultat pomnozi s ceno na osebo (in nocmi) za penzion.
 */
export function mealPayUnits(pax: number, children: ChildrenAges): number {
  const kids = totalChildren(children)
  const adults = Math.max(0, (Number(pax) || 0) - kids)
  const childUnits = CHILD_BANDS.reduce((s, b) => s + (children[b.id] || 0) * b.payFactor, 0)
  return adults + childUnits
}

/**
 * "Placljive enote" prehrane iz starostnih razredov po gostih.
 * `bands` = seznam band vrednosti (adult|0-5|5-10|10-15) za goste 1..N.
 * Steje prvih `pax` gostov; manjkajoci/prazni = adult (payFactor 1).
 */
export function mealPayUnitsFromBands(pax: number, bands: (string | null | undefined)[]): number {
  const n = Math.max(0, Number(pax) || 0)
  let units = 0
  for (let i = 0; i < n; i++) {
    units += mealPayFactor(bands[i])
  }
  return units
}

/** Prestej goste po starostnih razredih iz band seznama (za prvih `pax` gostov). */
export function countByBand(pax: number, bands: (string | null | undefined)[]): { adults: number; children: ChildrenAges } {
  const n = Math.max(0, Number(pax) || 0)
  const children: ChildrenAges = {}
  let adults = 0
  for (let i = 0; i < n; i++) {
    const b = childBand(bands[i])
    if (b) children[b.id] = (children[b.id] || 0) + 1
    else adults++
  }
  return { adults, children }
}
