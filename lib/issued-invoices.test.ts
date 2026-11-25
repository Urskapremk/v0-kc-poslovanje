import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { guestInvoiceReference, issuedInvoiceAmountEur, issuedInvoiceRange } from './issued-invoices'

describe('issuedInvoiceRange', () => {
  it('uses the lodge day, three hours ahead of UTC', () => {
    const march = issuedInvoiceRange(2026, 3)
    assert.equal(march.start.toISOString(), '2026-02-28T21:00:00.000Z')
    assert.equal(march.end.toISOString(), '2026-03-31T21:00:00.000Z')
  })
})

describe('guestInvoiceReference', () => {
  it('uses the same KC reference the invoice page prints', () => {
    assert.equal(guestInvoiceReference('reservation-abcdef'), `KC-${new Date().getFullYear()}-ABCDEF`)
    assert.equal(guestInvoiceReference(''), '')
  })
})

describe('issuedInvoiceAmountEur', () => {
  it('adds the stay, charged extras and bar, then subtracts the discount', () => {
    const amount = issuedInvoiceAmountEur({
      totalAmount: 100,
      exchangeRate: 4800,
      orders: [
        { name: 'Massage', category: 'Masaza', priceAr: 4800, paymentStatus: 'UNPAID' },
        { name: 'Boat', category: 'Transfer', priceAr: 9600, paymentStatus: 'PAID', refPriceAr: 9600 },
        { name: 'Nosy Iranja', category: 'Izlet', priceAr: 0, refPriceAr: 9600, paymentStatus: 'PAID' },
        { name: 'Stay line', category: 'Bivanje', priceAr: 500000, paymentStatus: 'UNPAID' },
      ],
      barItems: [
        { productName: 'THB', priceAr: 12000, quantity: 2 },
        { productName: 'Water', priceAr: 4000, quantity: 1, isFree: true },
      ],
      discountsAr: 4800,
    })
    assert.equal(amount, 100 + 1 + 2 + 5 - 1)
  })

  it('does not charge a breakfast already covered by a paid board', () => {
    const amount = issuedInvoiceAmountEur({
      totalAmount: 80,
      mealPlan: 'HB',
      mealPlanPaymentStatus: 'PAID',
      exchangeRate: 4800,
      orders: [{ name: 'Breakfast', category: 'Prehrana', priceAr: 15000, paymentStatus: 'UNPAID' }],
      barItems: [{ productName: 'Zajtrk', priceAr: 8000, quantity: 1 }],
      discountsAr: 0,
    })
    assert.equal(amount, 80)
  })

  it('keeps a foreign-currency stay out of the euro total', () => {
    const amount = issuedInvoiceAmountEur({
      totalAmount: 400,
      currency: 'USD',
      exchangeRate: 4800,
      orders: [],
      barItems: [{ productName: 'Cola', priceAr: 4800, quantity: 1 }],
      discountsAr: 0,
    })
    assert.equal(amount, 1)
  })
})
