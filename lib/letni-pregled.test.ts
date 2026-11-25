import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { emptyCostTypes, emptyIncomeTypes, monthFinanceFromMonthly, sumCostTypes, sumIncomeTypes, sumFinanceMonths, type MonthFinanceSummary, type MonthlyFinanceInput } from './letni-pregled'

const novemberCard: MonthlyFinanceInput = {
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
  costs: {
    total: 8123.45,
    barPijaca: 200,
    barPrehrana: 500,
    mealPlan: 300,
    wellness: 80,
    receiptsWellness: 40,
    ostalo: 15,
    receiptsOstalo: 5,
    excursions: 900,
    transfers: 700,
    receiptsKuhinja: 100,
    receiptsBar: 50,
    receiptsNocitve: 60,
    marketing: 400,
    booking: 250,
    optimaplus: 150,
    starlink: 150,
    receiptsReprezentanca: 30,
    receiptsVzdrzevanje: 20,
    najemninaHisa: 1000,
    stipendija: 0,
    racunovodstvo: 75,
    prevozniki: 120,
    porters: 10,
    tuctuc: 8,
    depreciation: 200,
    reklama: 12.45,
  },
  salaryBreakdown: {
    accommodation: 800,
    bar: 600,
    kuhinja: 700,
    management: 648,
  },
  profit: 16087.95,
}

describe('monthFinanceFromMonthly', () => {
  it('uses the monthly card total and the same income split', () => {
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

  it('splits income into the stored categories and keeps their sum equal to prihodki', () => {
    const row = monthFinanceFromMonthly(11, novemberCard)
    const income = row.prihodkiPoVrsti
    assert.equal(income.nocitve, 16678.52)
    assert.equal(income.hrana, 2000)
    assert.equal(income.predplacilo, 1878.5)
    assert.equal(income.pijaca, 671.25)
    assert.equal(income.izleti, 1382.3)
    assert.equal(income.transferji, 1195)
    assert.equal(income.masaze, 385)
    assert.equal(income.izdelki, 0)
    assert.equal(income.pranje, 0)
    assert.equal(income.ostalo, 20.83)
    assert.equal(sumIncomeTypes(income), 24211.4)
    assert.equal(sumIncomeTypes(income), row.prihodki)
  })

  it('keeps shop products and laundry out of one ostalo column', () => {
    const row = monthFinanceFromMonthly(11, {
      ...novemberCard,
      revenue: { ...novemberCard.revenue, shop: 12.5, laundry: 8.33, ostaloOther: 0 },
    })
    assert.equal(row.prihodkiPoVrsti.izdelki, 12.5)
    assert.equal(row.prihodkiPoVrsti.pranje, 8.33)
    assert.equal(row.prihodkiPoVrsti.ostalo, 0)
    assert.equal(sumIncomeTypes(row.prihodkiPoVrsti), row.prihodki)
  })

  it('moves a one-cent income rounding gap onto the largest category', () => {
    const row = monthFinanceFromMonthly(11, {
      ...novemberCard,
      revenue: { ...novemberCard.revenue, total: 24211.41 },
    })
    assert.equal(sumIncomeTypes(row.prihodkiPoVrsti), 24211.41)
    assert.equal(row.prihodkiPoVrsti.nocitve, 16678.53)
  })

  it('splits costs into the monthly types and keeps their sum equal to stroški', () => {
    const row = monthFinanceFromMonthly(11, novemberCard)
    const costs = row.stroskiPoVrsti
    assert.equal(costs.nocitve, 800 + 400 + 250 + 150 + 150 + 60)
    assert.equal(costs.bar, 200 + 600 + 50)
    assert.equal(costs.kuhinja, 500 + 300 + 100 + 700)
    assert.equal(costs.prevozi, 700)
    assert.equal(costs.izleti, 900)
    assert.equal(costs.wellness, 80 + 40)
    assert.equal(costs.ostalo, 15 + 5)
    assert.equal(costs.reprezentanca, 30)
    assert.equal(costs.vzdrzevanje, 20)
    assert.equal(costs.najemnina, 1000)
    assert.equal(costs.racunovodstvo, 75)
    assert.equal(costs.prevozniki, 120)
    assert.equal(costs.nosaci, 10)
    assert.equal(costs.tuctuc, 8)
    assert.equal(costs.amortizacija, 200)
    assert.equal(costs.vodstvo, 648)
    assert.equal(costs.reklama, 12.45)
    assert.equal(sumCostTypes(costs), 8123.45)
    assert.equal(sumCostTypes(costs), row.stroski)
  })

  it('moves a one-cent rounding gap onto the largest cost type', () => {
    const row = monthFinanceFromMonthly(11, {
      ...novemberCard,
      costs: { ...novemberCard.costs, total: 8123.46 },
    })
    assert.equal(sumCostTypes(row.stroskiPoVrsti), 8123.46)
    assert.equal(row.stroskiPoVrsti.nocitve, 1810.01)
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
      prihodkiPoVrsti: { ...emptyIncomeTypes(), nocitve: 0.1 },
      stroskiPoVrsti: { ...emptyCostTypes(), nocitve: 0.1 },
    }))
    const total = sumFinanceMonths(rows)
    assert.equal(total.prihodki, 224352.81)
    assert.equal(total.stroski, 1.2)
    assert.equal(total.prihodkiPoVrsti.nocitve, 1.2)
    assert.equal(sumIncomeTypes(total.prihodkiPoVrsti), 1.2)
    assert.equal(total.stroskiPoVrsti.nocitve, 1.2)
    assert.equal(sumCostTypes(total.stroskiPoVrsti), 1.2)
  })
})
