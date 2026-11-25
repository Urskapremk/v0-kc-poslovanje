// Maps one month of Kalkulacije (getMonthlyStatistics) onto the yearly Finance
// overview. Categories match the monthly Pregled cards:
// Nočitve = accommodation, Bar = bar drinks only, Kuhinja = bar food + meal plan.

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
  costs: { total: number }
  profit: number
}

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

export type FinanceTotals = Record<FinanceSumKey, number>

function cents(value: number) {
  return Math.round(value * 100)
}

export function monthFinanceFromMonthly(month: number, stats: MonthlyFinanceInput): MonthFinanceSummary {
  return {
    month,
    prihodki: cents(stats.revenue.total) / 100,
    stroski: cents(stats.costs.total) / 100,
    dobicek: cents(stats.profit) / 100,
    nocitve: cents(stats.revenue.accommodation) / 100,
    bar: cents(stats.revenue.bar.pijaca) / 100,
    kuhinja: cents(stats.revenue.bar.prehrana + stats.revenue.mealPlan) / 100,
    prevozi: cents(stats.revenue.transfers) / 100,
    izleti: cents(stats.revenue.excursions) / 100,
    wellness: cents(stats.revenue.wellness) / 100,
    ostalo: cents(stats.revenue.ostalo) / 100,
  }
}

export function sumFinanceMonths(rows: MonthFinanceSummary[]): FinanceTotals {
  const acc = Object.fromEntries(FINANCE_SUM_KEYS.map((key) => [key, 0])) as FinanceTotals
  for (const row of rows) {
    for (const key of FINANCE_SUM_KEYS) acc[key] += cents(row[key])
  }
  for (const key of FINANCE_SUM_KEYS) acc[key] /= 100
  return acc
}
