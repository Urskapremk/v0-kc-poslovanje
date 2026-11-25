// Maps one month of Kalkulacije (getMonthlyStatistics) onto the yearly Finance
// overview. Income categories match the monthly Pregled cards.
// Cost types are the same groups the monthly page already adds into Stroški:
// the seven departments, then the other invoice and payroll types.

export type MonthlyFinanceInput = {
  revenue: {
    accommodation: number
    bar: { pijaca: number; prehrana: number }
    transfers: number
    excursions: number
    mealPlan: number
    wellness: number
    ostalo: number
    total: number
  }
  costs: {
    total: number
    barPijaca?: number
    barPrehrana?: number
    wellness?: number
    ostalo?: number
    excursions?: number
    transfers?: number
    mealPlan?: number
    receiptsKuhinja?: number
    receiptsBar?: number
    receiptsNocitve?: number
    receiptsWellness?: number
    receiptsOstalo?: number
    receiptsReprezentanca?: number
    receiptsVzdrzevanje?: number
    najemninaHisa?: number
    stipendija?: number
    hranaStudenti?: number
    racunovodstvo?: number
    prevozniki?: number
    reklama?: number
    porters?: number
    tuctuc?: number
    depreciation?: number
    marketing?: number
    booking?: number
    optimaplus?: number
    starlink?: number
  }
  salaryBreakdown?: {
    accommodation?: number
    bar?: number
    kuhinja?: number
    management?: number
  }
  profit: number
}

export const COST_TYPES = [
  { key: 'nocitve', label: 'Nočitve', parallel: true },
  { key: 'bar', label: 'Bar', parallel: true },
  { key: 'kuhinja', label: 'Kuhinja', parallel: true },
  { key: 'prevozi', label: 'Prevozi', parallel: true },
  { key: 'izleti', label: 'Izleti', parallel: true },
  { key: 'wellness', label: 'Wellness', parallel: true },
  { key: 'ostalo', label: 'Ostalo', parallel: true },
  { key: 'reprezentanca', label: 'Reprezentanca', parallel: false },
  { key: 'vzdrzevanje', label: 'Vzdrževanje', parallel: false },
  { key: 'najemnina', label: 'Najemnina hiša', parallel: false },
  { key: 'stipendija', label: 'Štipendija', parallel: false },
  { key: 'reklama', label: 'Reklama', parallel: false },
  { key: 'racunovodstvo', label: 'Računovodstvo', parallel: false },
  { key: 'prevozniki', label: 'Prevozniki', parallel: false },
  { key: 'hranaStudenti', label: 'Hrana za študente', parallel: false },
  { key: 'nosaci', label: 'Nosači', parallel: false },
  { key: 'tuctuc', label: 'Tuc tuc', parallel: false },
  { key: 'amortizacija', label: 'Amortizacija', parallel: false },
  { key: 'vodstvo', label: 'Vodstvo', parallel: false },
] as const

export type CostTypeKey = (typeof COST_TYPES)[number]['key']

export type CostTypeAmounts = Record<CostTypeKey, number>

export type MonthFinanceSummary = {
  month: number
  prihodki: number
  stroski: number
  dobicek: number
  nocitve: number
  bar: number
  kuhinja: number
  prevozi: number
  izleti: number
  wellness: number
  ostalo: number
  stroskiPoVrsti: CostTypeAmounts
}

export const FINANCE_SUM_KEYS = [
  'prihodki',
  'stroski',
  'dobicek',
  'nocitve',
  'bar',
  'kuhinja',
  'prevozi',
  'izleti',
  'wellness',
  'ostalo',
] as const

export type FinanceSumKey = (typeof FINANCE_SUM_KEYS)[number]

export type FinanceTotals = Record<FinanceSumKey, number> & {
  stroskiPoVrsti: CostTypeAmounts
}

function cents(value: number | undefined) {
  return Math.round((value || 0) * 100)
}

function fromCents(value: number) {
  return value / 100
}

export function emptyCostTypes(): CostTypeAmounts {
  return Object.fromEntries(COST_TYPES.map((type) => [type.key, 0])) as CostTypeAmounts
}

export function sumCostTypes(parts: CostTypeAmounts) {
  return fromCents(COST_TYPES.reduce((sum, type) => sum + cents(parts[type.key]), 0))
}

function fitCostTypes(parts: Record<CostTypeKey, number>, targetCents: number): CostTypeAmounts {
  const drift = targetCents - COST_TYPES.reduce((sum, type) => sum + parts[type.key], 0)
  if (drift !== 0) {
    const host = COST_TYPES.reduce((best, type) => {
      const bestAbs = Math.abs(parts[best])
      const nextAbs = Math.abs(parts[type.key])
      if (nextAbs > bestAbs) return type.key
      if (nextAbs === bestAbs && type.key === 'ostalo') return type.key
      return best
    }, 'ostalo' as CostTypeKey)
    parts[host] += drift
  }
  return Object.fromEntries(COST_TYPES.map((type) => [type.key, fromCents(parts[type.key])])) as CostTypeAmounts
}

export function monthFinanceFromMonthly(month: number, stats: MonthlyFinanceInput): MonthFinanceSummary {
  const costs = stats.costs
  const salary = stats.salaryBreakdown || {}
  const parts: Record<CostTypeKey, number> = {
    nocitve: cents(salary.accommodation) + cents(costs.marketing) + cents(costs.booking) + cents(costs.optimaplus) + cents(costs.starlink) + cents(costs.receiptsNocitve),
    bar: cents(costs.barPijaca) + cents(salary.bar) + cents(costs.receiptsBar),
    kuhinja: cents(costs.barPrehrana) + cents(costs.mealPlan) + cents(costs.receiptsKuhinja) + cents(salary.kuhinja),
    prevozi: cents(costs.transfers),
    izleti: cents(costs.excursions),
    wellness: cents(costs.wellness) + cents(costs.receiptsWellness),
    ostalo: cents(costs.ostalo) + cents(costs.receiptsOstalo),
    reprezentanca: cents(costs.receiptsReprezentanca),
    vzdrzevanje: cents(costs.receiptsVzdrzevanje),
    najemnina: cents(costs.najemninaHisa),
    stipendija: cents(costs.stipendija),
    reklama: cents(costs.reklama),
    racunovodstvo: cents(costs.racunovodstvo),
    prevozniki: cents(costs.prevozniki),
    hranaStudenti: cents(costs.hranaStudenti),
    nosaci: cents(costs.porters),
    tuctuc: cents(costs.tuctuc),
    amortizacija: cents(costs.depreciation),
    vodstvo: cents(salary.management),
  }

  return {
    month,
    prihodki: fromCents(cents(stats.revenue.total)),
    stroski: fromCents(cents(costs.total)),
    dobicek: fromCents(cents(stats.profit)),
    nocitve: fromCents(cents(stats.revenue.accommodation)),
    bar: fromCents(cents(stats.revenue.bar.pijaca)),
    kuhinja: fromCents(cents(stats.revenue.bar.prehrana + stats.revenue.mealPlan)),
    prevozi: fromCents(cents(stats.revenue.transfers)),
    izleti: fromCents(cents(stats.revenue.excursions)),
    wellness: fromCents(cents(stats.revenue.wellness)),
    ostalo: fromCents(cents(stats.revenue.ostalo)),
    stroskiPoVrsti: fitCostTypes(parts, cents(costs.total)),
  }
}

export function sumFinanceMonths(rows: MonthFinanceSummary[]): FinanceTotals {
  const acc = Object.fromEntries(FINANCE_SUM_KEYS.map((key) => [key, 0])) as Record<FinanceSumKey, number>
  const costs = emptyCostTypes()
  for (const row of rows) {
    for (const key of FINANCE_SUM_KEYS) acc[key] += cents(row[key])
    for (const type of COST_TYPES) costs[type.key] += cents(row.stroskiPoVrsti[type.key])
  }
  for (const key of FINANCE_SUM_KEYS) acc[key] = fromCents(acc[key])
  for (const type of COST_TYPES) costs[type.key] = fromCents(costs[type.key])
  return { ...acc, stroskiPoVrsti: costs }
}
