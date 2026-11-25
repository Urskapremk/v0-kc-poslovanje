import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { monthFinanceFromMonthly, sumFinanceMonths, type MonthFinanceSummary } from './letni-pregled'

const novemberCard = {
  revenue: {
    accommodation: 16678.52,
    bar: { pijaca: 671.25, prehrana: 2000 },
    mealPlan: 1878.5,
    transfers: 1195,
    excursions: 1382.3,
    wellness: 385,
    ostalo: 20.83,
    total: 24211.4,
  },
  costs: { total: 8123.45 },
  profit: 16087.95,
}

describe('monthFinanceFromMonthly', () => {
  it('uses the monthly card total and the same category split', () => {
    const row = monthFinanceFromMonthly(11, novemberCard)
    assert.equal(row.month, 11)
    assert.equal(row.prihodki, 24211.4)
    assert.equal(row.stroski, 8123.45)
    assert.equal(row.dobicek, 16087.95)
    assert.equal(row.nocitve, 16678.52)
    assert.equal(row.bar, 671.25)
    assert.equal(row.kuhinja, 3878.5)
    assert.equal(row.prevozi, 1195)
    assert.equal(row.izleti, 1382.3)
    assert.equal(row.wellness, 385)
    assert.equal(row.ostalo, 20.83)
  })

  it('keeps bar drinks out of kuhinja', () => {
    const row = monthFinanceFromMonthly(11, novemberCard)
    assert.equal(row.bar + row.kuhinja, 671.25 + 3878.5)
    assert.notEqual(row.kuhinja, novemberCard.revenue.bar.pijaca + novemberCard.revenue.bar.prehrana)
  })
})

describe('sumFinanceMonths', () => {
  it('adds the displayed monthly amounts in cents', () => {
    const prihodki = [0, 0, 4480.37, 21716.47, 16328.8, 9641.19, 22662.86, 47110.57, 22053.61, 36991.13, 24211.4, 19156.41]
    const rows: MonthFinanceSummary[] = prihodki.map((amount, index) => ({
      month: index + 1,
      prihodki: amount,
      stroski: 0.1,
      dobicek: amount,
      nocitve: 0,
      bar: 0,
      kuhinja: 0,
      prevozi: 0,
      izleti: 0,
      wellness: 0,
      ostalo: 0,
    }))
    const total = sumFinanceMonths(rows)
    assert.equal(total.prihodki, 224352.81)
    assert.equal(total.stroski, 1.2)
    assert.equal(total.prihodki, Math.round(prihodki.reduce((sum, value) => sum + Math.round(value * 100), 0)) / 100)
  })
})
