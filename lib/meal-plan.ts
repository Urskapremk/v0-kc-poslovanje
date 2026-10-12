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

/** Reservation meal plan marked "Plačano", not "Za plačilo". */
export function isMealPlanPaid(status: string | null | undefined): boolean {
  return String(status || '').toUpperCase() === 'PAID'
}

/**
 * Same meals the invoice refuses to charge when the pension is already paid.
 * Half board: breakfast and dinner. Full board: breakfast, lunch, and dinner.
 * Breakfast only: breakfast. Lunch on half board, snacks, and desserts stay billable.
 * Matched by cenik product id or by the same name test the invoice uses.
 */
export function paidPensionCoversMeal(opts: {
  mealPlan?: string | null
  mealPlanPaymentStatus?: string | null
  productId?: string | null
  productName?: string | null
}): boolean {
  if (!isMealPlanPaid(opts.mealPlanPaymentStatus)) return false
  const plan = String(opts.mealPlan || '').toUpperCase()
  const planCode = plan === 'BB' ? 'B' : plan
  if (opts.productId && isMealCoveredByPlan(planCode, opts.productId)) return true
  const n = String(opts.productName || '').toLowerCase()
  const breakfast = /breakfast|zajtrk|petit[- ]d[ée]jeuner/.test(n)
  const lunch = /lunch|kosilo|d[ée]jeuner/.test(n) && !breakfast
  const dinner = /dinner|ve[cč]erj|d[iî]ner/.test(n)
  if (plan === 'FB') return breakfast || lunch || dinner
  if (plan === 'HB') return breakfast || dinner
  if (plan === 'B' || plan === 'BB') return breakfast
  return false
}

/**
 * The single Prehrana line check-in writes for a prepaid pension:
 * `${mealName} (${paxLabel} × ${days} dni)`.
 * That lump is the same nights as the nightly 50/80 € split, so kalkulacije
 * must not add it on top.
 */
export function isCheckInPensionLump(name: string | null | undefined): boolean {
  const n = String(name || '').trim()
  if (!/×\s*\d+\s*dni\s*\)?\s*$/i.test(n)) return false
  return /(polpenzion|polni penzion|half board|full board|\(hb\)|\(fb\)|breakfast|zajtrk)/i.test(n)
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

/** Slovenian unit for a child's age in years (1 leto, 2 leti, 3 leta, 5 let). */
export function slovenianLetWord(age: number): string {
  const m10 = age % 10
  const m100 = age % 100
  if (m100 !== 11 && m10 === 1) return 'leto'
  if (m100 !== 12 && m10 === 2) return 'leti'
  if (m100 !== 13 && m100 !== 14 && (m10 === 3 || m10 === 4)) return 'leta'
  return 'let'
}

/** Explicit child ages stored on the reservation (reception), not meal bands. */
export function childAgesYearsFromReservation(raw: unknown): number[] | null {
  if (!raw || typeof raw !== 'object') return null
  const years = (raw as Record<string, unknown>).years
  if (!Array.isArray(years) || years.length === 0) return null
  const nums = years
    .map((y) => Number(y))
    .filter((n) => Number.isFinite(n) && n >= 0 && n < 18)
  return nums.length ? nums : null
}

export type ChildAgeCardInfo = {
  ages: string
  label: string
  unit: string
  why: string
}

/** Ages for the bungalow card: stored years first, else from police-form DOBs at arrival. */
export function buildChildAgeCardInfo(res: {
  arrival?: string | null
  guestName?: string | null
  secondGuestName?: string | null
  thirdGuestName?: string | null
  fourthGuestName?: string | null
  dateOfBirth?: string | null
  secondDateOfBirth?: string | null
  thirdDateOfBirth?: string | null
  fourthDateOfBirth?: string | null
  childrenAges?: unknown
}): ChildAgeCardInfo | null {
  const stored = childAgesYearsFromReservation(res.childrenAges)
  if (stored?.length) {
    const label = stored.length === 1 ? 'Otrok' : stored.length === 2 ? 'Otroka' : 'Otroci'
    const unit = slovenianLetWord(stored[stored.length - 1])
    const ages =
      stored.length === 1
        ? String(stored[0])
        : stored.length === 2
          ? `${stored[0]} in ${stored[1]}`
          : `${stored.slice(0, -1).join(', ')} in ${stored[stored.length - 1]}`
    return {
      ages,
      label,
      unit,
      why: `Otroci ${ages} ${unit} (starost ob prihodu)`,
    }
  }

  const isDay = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v)
  const ref = res.arrival ? String(res.arrival).slice(0, 10) : ''
  if (!isDay(ref)) return null
  const [ry, rm, rd] = ref.split('-').map(Number)
  const people = [
    { dob: res.dateOfBirth, name: res.guestName },
    { dob: res.secondDateOfBirth, name: res.secondGuestName },
    { dob: res.thirdDateOfBirth, name: res.thirdGuestName },
    { dob: res.fourthDateOfBirth, name: res.fourthGuestName },
  ]
  const kids: { age: number; name: string }[] = []
  for (const p of people) {
    const dob = p.dob ? String(p.dob).slice(0, 10) : ''
    if (!isDay(dob)) continue
    const [by, bm, bd] = dob.split('-').map(Number)
    let age = ry - by
    if (rm < bm || (rm === bm && rd < bd)) age -= 1
    if (age < 0 || age >= 18) continue
    kids.push({ age, name: (p.name || '').trim() })
  }
  if (!kids.length) return null
  kids.sort((a, b) => a.age - b.age)
  const agesNums = kids.map((k) => k.age)
  const label = kids.length === 1 ? 'Otrok' : kids.length === 2 ? 'Otroka' : 'Otroci'
  const unit = slovenianLetWord(agesNums[agesNums.length - 1])
  const ages =
    agesNums.length === 1
      ? String(agesNums[0])
      : agesNums.length === 2
        ? `${agesNums[0]} in ${agesNums[1]}`
        : `${agesNums.slice(0, -1).join(', ')} in ${agesNums[agesNums.length - 1]}`
  return {
    ages,
    label,
    unit,
    why: `${kids.map((k) => `${k.name || 'Otrok'} — ${k.age}`).join(' · ')} (starost ob prihodu, iz rojstnih datumov)`,
  }
}
