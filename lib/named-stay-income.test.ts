import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { bendaTransferInMonth, lodgingShareLines, namedLodgingForMonth, BENDA_STAY_ID, MAYALEN_STAY_ID } from './named-stay-income'

describe('Mayalen lodging', () => {
  it('puts all 1.433,18 in March and none in April', () => {
    assert.deepEqual(namedLodgingForMonth(MAYALEN_STAY_ID, 3), { eur: 1433.18, nights: 4 })
    assert.deepEqual(namedLodgingForMonth(MAYALEN_STAY_ID, 4), { eur: 0, nights: 0 })
    assert.equal(lodgingShareLines(3)[0].guestName, 'Mayalen Darrigade Sallaberry')
    assert.equal(lodgingShareLines(3)[0].amountEur, 1433.18)
    assert.equal(lodgingShareLines(4).some((line) => line.guestName.includes('Mayalen')), false)
  })
})

describe('Benda Nina and Mark', () => {
  it('splits Nina by night and keeps Mark and the arrival transfer in April', () => {
    assert.deepEqual(namedLodgingForMonth(BENDA_STAY_ID, 4), { eur: 201, nights: 10 })
    assert.deepEqual(namedLodgingForMonth(BENDA_STAY_ID, 5), { eur: 80, nights: 4 })
    assert.deepEqual(namedLodgingForMonth(BENDA_STAY_ID, 3), { eur: 0, nights: 0 })
    const april = lodgingShareLines(4)
    const may = lodgingShareLines(5)
    assert.equal(april.reduce((sum, line) => sum + line.amountEur, 0), 201)
    assert.equal(may.reduce((sum, line) => sum + line.amountEur, 0), 80)
    assert.equal(april.find((line) => line.reference.startsWith('Nina'))?.amountEur, 200)
    assert.equal(may[0].amountEur, 80)
    assert.equal(bendaTransferInMonth('2026-04-21', 'arrival', 2026, 4), true)
    assert.equal(bendaTransferInMonth('2026-04-21', 'arrival', 2026, 5), false)
    assert.equal(bendaTransferInMonth('2026-05-05', 'departure', 2026, 5), true)
    assert.equal(bendaTransferInMonth(null, 'departure', 2026, 5), true)
  })

  it('leaves another guest on the generic split', () => {
    assert.equal(namedLodgingForMonth('res-someone-else', 4), null)
  })
})
