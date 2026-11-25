import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { bendaListRow, bendaTransferInMonth, hannahOnInvoiceList, hiddenCheckoutInvoice, lodgingBesideTheNightList, lodgingShareLines, namedLodgingForMonth, ninaInvoiceIncome, BENDA_STAY_ID, HANNAH_STAY_ID, MAYALEN_STAY_ID } from './named-stay-income'

describe('Mayalen lodging', () => {
  it('puts all 1.433,18 in March and none in April', () => {
    assert.deepEqual(namedLodgingForMonth(MAYALEN_STAY_ID, 3), { eur: 1433.18, nights: 4 })
    assert.deepEqual(namedLodgingForMonth(MAYALEN_STAY_ID, 4), { eur: 0, nights: 0 })
    assert.equal(lodgingShareLines(3)[0].guestName, 'Mayalen Darrigade Sallaberry')
    assert.equal(lodgingShareLines(3)[0].amountEur, 1433.18)
    assert.equal(lodgingShareLines(4).some((line) => line.guestName.includes('Mayalen')), false)
    assert.deepEqual(lodgingBesideTheNightList([], 3), { eur: 1433.18, nights: 4 })
    assert.deepEqual(lodgingBesideTheNightList([MAYALEN_STAY_ID], 3), { eur: 0, nights: 0 })
    assert.deepEqual(lodgingBesideTheNightList([], 4), { eur: 0, nights: 0 })
  })
})

describe('Benda Nina and Mark', () => {
  it('splits Nina by night and keeps Mark and the arrival transfer in April', () => {
    assert.deepEqual(namedLodgingForMonth(BENDA_STAY_ID, 4), { eur: 201, nights: 10 })
    assert.deepEqual(namedLodgingForMonth(BENDA_STAY_ID, 5), { eur: 80, nights: 4 })
    assert.deepEqual(namedLodgingForMonth(BENDA_STAY_ID, 3), { eur: 0, nights: 0 })
    assert.equal(lodgingShareLines(4).length, 0)
    assert.equal(lodgingShareLines(5).length, 0)
    assert.deepEqual(bendaListRow(2026, 4), { amountEur: 1289.33, night: '2026-04-30' })
    assert.deepEqual(bendaListRow(2026, 5), { amountEur: 584.33, night: '2026-05-04' })
    assert.equal(bendaListRow(2026, 3), null)
    const both = (bendaListRow(2026, 4)?.amountEur || 0) + (bendaListRow(2026, 5)?.amountEur || 0)
    assert.equal(Math.round(both * 100) / 100, 1873.66)
    assert.equal(bendaTransferInMonth('2026-04-21', 'arrival', 2026, 4), true)
    assert.equal(bendaTransferInMonth('2026-04-21', 'arrival', 2026, 5), false)
    assert.equal(bendaTransferInMonth('2026-05-05', 'departure', 2026, 5), true)
    assert.equal(bendaTransferInMonth(null, 'departure', 2026, 5), true)
  })

  it('leaves another guest on the generic split', () => {
    assert.equal(namedLodgingForMonth('res-someone-else', 4), null)
  })

  it('shows Hannah on the April invoice list and hides the May checkout row', () => {
    assert.deepEqual(hannahOnInvoiceList(4), { nights: 3, night: '2026-04-30' })
    assert.equal(hannahOnInvoiceList(5), null)
    assert.equal(hiddenCheckoutInvoice(HANNAH_STAY_ID, 5), true)
    assert.equal(hiddenCheckoutInvoice(HANNAH_STAY_ID, 4), false)
    assert.equal(hiddenCheckoutInvoice('res-someone-else', 5), false)
  })

  it('puts pasted meals and drinks in the month of the date', () => {
    assert.deepEqual(ninaInvoiceIncome(2026, 4), { hrana: 864, pijaca: 119.33 })
    assert.deepEqual(ninaInvoiceIncome(2026, 5), { hrana: 360, pijaca: 39.33 })
    assert.deepEqual(ninaInvoiceIncome(2026, 3), { hrana: 0, pijaca: 0 })
  })
})
