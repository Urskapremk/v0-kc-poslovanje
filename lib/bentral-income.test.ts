import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { bentralIncomeForMonth, centsForNightsInMonth, stayNights, type BentralIncomeRow } from './bentral-income'

const mayalenStay: BentralIncomeRow = {
  externalId: '5555502819',
  checkIn: '2026-03-28',
  checkOut: '2026-04-01',
  amount: '1433.18',
  currency: 'EUR',
  transferred: false,
  active: true,
}

const drinks: BentralIncomeRow[] = [
  { externalId: 'K-2026-47', checkIn: '2026-03-31', checkOut: '2026-04-01', amount: '74.64', currency: 'EUR', transferred: false, active: true },
  { externalId: 'K-2026-45', checkIn: '2026-03-27', checkOut: '2026-03-28', amount: '226.80', currency: 'EUR', transferred: false, active: true },
  { externalId: 'K-2025-265', checkIn: '2026-03-22', checkOut: '2026-03-29', amount: '160.39', currency: 'EUR', transferred: false, active: true },
  { externalId: 'K-2025-264', checkIn: '2026-03-22', checkOut: '2026-03-29', amount: '429.96', currency: 'EUR', transferred: false, active: true },
]

const otherGuest: BentralIncomeRow = {
  externalId: 'K-2025-222',
  checkIn: '2026-03-01',
  checkOut: '2026-03-08',
  amount: '1173.81',
  currency: 'EUR',
  transferred: false,
  active: true,
}

function cents(euros: number): number {
  return Math.round(euros * 100)
}

describe('stay nights', () => {
  it('keeps a checkout on the 1st in the previous month', () => {
    assert.deepEqual(stayNights('2026-03-28', '2026-04-01'), [
      '2026-03-28',
      '2026-03-29',
      '2026-03-30',
      '2026-03-31',
    ])
  })

  it('puts a night that starts in April into April', () => {
    assert.deepEqual(stayNights('2026-03-30', '2026-04-02'), [
      '2026-03-30',
      '2026-03-31',
      '2026-04-01',
    ])
    const nights = stayNights('2026-03-30', '2026-04-02')
    assert.equal(centsForNightsInMonth(300, nights, 2026, 3), 20000)
    assert.equal(centsForNightsInMonth(300, nights, 2026, 4), 10000)
  })
})

describe('bentral income for the named rows', () => {
  const rows = [mayalenStay, ...drinks, otherGuest]

  it('keeps the drink rows in March and leaves Mayalen lodging to her guest card', () => {
    const march = bentralIncomeForMonth(rows, 2026, 3)
    const april = bentralIncomeForMonth(rows, 2026, 4)
    assert.equal(cents(march.nocitve), 0)
    assert.equal(cents(march.pijaca), 7464 + 22680 + 16039 + 42996)
    assert.equal(march.lodgingNights, 0)
    assert.equal(cents(april.nocitve), 0)
    assert.equal(cents(april.pijaca), 0)
    assert.equal(april.lodgingNights, 0)
  })

  it('does not count drinks as lodging nights', () => {
    const march = bentralIncomeForMonth(drinks, 2026, 3)
    assert.equal(cents(march.nocitve), 0)
    assert.equal(march.lodgingNights, 0)
    assert.equal(cents(march.pijaca), 89179)
  })

  it('ignores another guest, a transferred row, and an inactive row', () => {
    const skipped: BentralIncomeRow[] = [
      otherGuest,
      { ...mayalenStay, transferred: true },
      { ...drinks[0], active: false },
      { ...drinks[1], currency: 'USD' },
    ]
    const march = bentralIncomeForMonth(skipped, 2026, 3)
    assert.equal(cents(march.nocitve), 0)
    assert.equal(cents(march.pijaca), 0)
    assert.equal(march.lodgingNights, 0)
  })
})
