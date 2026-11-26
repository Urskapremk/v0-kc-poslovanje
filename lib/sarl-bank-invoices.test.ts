import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { bankReference, isBankTransferMethod, listSarlBankInvoices, type SarlBankLine, type SarlInvoiceCandidate } from './sarl-bank-invoices'

const sevanLines: SarlBankLine[] = [
  {
    id: 'sevan-340',
    date: '2026-11-11',
    amountAr: 1603356,
    description: "RPT N° RPT26045549 RPT d'ordre de M SEVAN GUNAHSIS - nakazilo stranke (340,00 EUR) (valuta 16.11)",
  },
  {
    id: 'sevan-500',
    date: '2026-11-24',
    amountAr: 2375370,
    description: "RPT N° RPT26047029 RPT d'ordre de M SEVAN GUNAHSIZ - nakazilo stranke (500,00 EUR) (valuta 27.11)",
  },
  {
    id: 'airbnb',
    date: '2026-11-10',
    amountAr: 2823270.71,
    description: "RPT N° RPT26045309 RPT d'ordre de AIRBNB PAYMENTS UK - nakazilo stranke (642,02 USD) (valuta 13.11)",
  },
  {
    id: 'oliver',
    date: '2026-11-11',
    amountAr: 3787851.6,
    description: "RPT N° RPT26045654 RPT d'ordre de MR OLIVER WHITE - nakazilo stranke (774,00 EUR) (valuta 16.11)",
  },
]

function payment(overrides: Partial<SarlInvoiceCandidate> & Pick<SarlInvoiceCandidate, 'paymentId' | 'amountEur' | 'method'>): SarlInvoiceCandidate {
  return {
    reservationId: 'res-sevan-551a9d',
    guestName: 'Sevan Gunahsiz',
    invoiceNumber: 'KC-2026-551A9D',
    paidAt: '2026-11-11',
    notes: null,
    checkedOutAt: '',
    invoiceEmailedAt: '2026-11-26',
    ...overrides,
  }
}

describe('SARL bank invoice payments', () => {
  it('keeps only the EUR that hit the SARL account for Sevan', () => {
    const rows = listSarlBankInvoices([
      payment({ paymentId: 'p340', amountEur: 340, method: 'transfer', paidAt: '2026-11-11', notes: 'RPT26045549' }),
      payment({ paymentId: 'p500', amountEur: 500, method: 'transfer', paidAt: '2026-11-24', notes: 'RPT26047029' }),
      payment({ paymentId: 'pcash', amountEur: 202.08, method: 'cash', paidAt: '2026-11-26', notes: null }),
      payment({ paymentId: 'pcard', amountEur: 202.08, method: 'card', paidAt: '2026-11-26', notes: null }),
      payment({ paymentId: 'porange', amountEur: 202.08, method: 'orange_money', paidAt: '2026-11-26', notes: null }),
    ], sevanLines, 2026)

    assert.deepEqual(rows.map((row) => ({
      amountEur: row.amountEur,
      paymentDate: row.paymentDate,
      bankReference: row.bankReference,
      invoiceNumber: row.invoiceNumber,
      guestName: row.guestName,
    })), [
      { amountEur: 340, paymentDate: '2026-11-11', bankReference: 'RPT26045549', invoiceNumber: 'KC-2026-551A9D', guestName: 'Sevan Gunahsiz' },
      { amountEur: 500, paymentDate: '2026-11-24', bankReference: 'RPT26047029', invoiceNumber: 'KC-2026-551A9D', guestName: 'Sevan Gunahsiz' },
    ])
    assert.equal(rows.reduce((sum, row) => sum + row.amountEur, 0), 840)
    assert.equal(new Set(rows.map((row) => row.invoiceNumber)).size, 1)
  })

  it('matches a transfer by the guest name when the payment note has no reference', () => {
    const rows = listSarlBankInvoices([
      payment({
        paymentId: 'oliver',
        reservationId: 'res-oliver',
        guestName: 'Oliver White',
        invoiceNumber: 'KC-2026-FFFFFF',
        amountEur: 774,
        method: 'transfer',
        paidAt: '2026-11-11',
        notes: '',
        checkedOutAt: '2026-11-18',
        invoiceEmailedAt: '',
      }),
    ], sevanLines, 2026)
    assert.equal(rows.length, 1)
    assert.equal(rows[0].amountEur, 774)
    assert.equal(rows[0].bankReference, 'RPT26045654')
  })

  it('does not use an Airbnb dollar credit or a reference that is not on SARL', () => {
    const rows = listSarlBankInvoices([
      payment({ paymentId: 'usd', amountEur: 642.02, method: 'transfer', paidAt: '2026-11-10', notes: 'RPT26045309', guestName: 'Airbnb Guest' }),
      payment({ paymentId: 'tourism', amountEur: 340, method: 'transfer', paidAt: '2026-11-11', notes: 'RPT99999999' }),
    ], sevanLines, 2026)
    assert.equal(rows.length, 0)
  })

  it('matches a SARL credit that has the guest name and no euro figure', () => {
    const rows = listSarlBankInvoices([
      payment({
        paymentId: 'roger',
        reservationId: 'res-roger',
        guestName: 'Roger Ritz',
        invoiceNumber: 'KC-2026-RITZ01',
        amountEur: 500,
        method: 'transfer',
        paidAt: '2026-11-23',
        notes: '',
        checkedOutAt: '2026-11-24',
      }),
    ], [{
      id: 'roger-line',
      date: '2026-11-23',
      amountAr: 2437980.3,
      description: "Virement d'ordre: MORA TRAVEL - SOLDE ROGER RITZ - nakazilo stranke (valuta 24.11)",
    }], 2026)
    assert.equal(rows.length, 1)
    assert.equal(rows[0].amountEur, 500)
    assert.equal(rows[0].bankReference, null)
  })

  it('leaves a transfer off the list until the invoice is issued', () => {
    const rows = listSarlBankInvoices([
      payment({ paymentId: 'open', amountEur: 340, method: 'transfer', paidAt: '2026-11-11', notes: 'RPT26045549', invoiceEmailedAt: '', checkedOutAt: '' }),
    ], sevanLines, 2026)
    assert.equal(rows.length, 0)
  })

  it('reads a bank reference and the transfer method', () => {
    assert.equal(bankReference("RPT N° RPT26045549 RPT d'ordre"), 'RPT26045549')
    assert.equal(bankReference('nakazilo stranke'), null)
    assert.equal(isBankTransferMethod(' transfer '), true)
    assert.equal(isBankTransferMethod('cash'), false)
    assert.equal(isBankTransferMethod('orange_money'), false)
    assert.equal(isBankTransferMethod('card'), false)
  })
})
