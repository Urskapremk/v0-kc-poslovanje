import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { chargedInvoiceAmountEur, guestInvoiceReference, issuedInvoiceAmountEur, issuedInvoiceRange } from './issued-invoices'

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

describe('chargedInvoiceAmountEur', () => {
  const ar = (eur: number) => Math.round(eur * 4800)

  it('includes every charge on the invoice, including a guest loan', () => {
    const amount = chargedInvoiceAmountEur({
      totalAmount: 732.12,
      exchangeRate: 4800,
      transferEur: 220,
      orders: [
        { name: 'Lunch × 2', category: 'Prehrana', priceAr: ar(60), paymentStatus: 'PAID' },
        { name: 'Lunch × 2', category: 'Prehrana', priceAr: ar(60), paymentStatus: 'PAID' },
        { name: 'Dinner × 2', category: 'Prehrana', priceAr: ar(70), paymentStatus: 'PAID' },
        { name: 'Dinner × 2', category: 'Prehrana', priceAr: ar(70), paymentStatus: 'PAID' },
        { name: 'Dinner × 2', category: 'Prehrana', priceAr: ar(70), paymentStatus: 'PAID' },
        { name: 'Pijača 22.04.2026', category: 'Pijača', priceAr: ar(32.71), paymentStatus: 'PAID' },
        { name: 'Pijača 23.04.2026', category: 'Pijača', priceAr: ar(42.91), paymentStatus: 'PAID' },
        { name: 'Pijača 24.04.2026', category: 'Pijača', priceAr: ar(8.53), paymentStatus: 'PAID' },
        { name: 'Izlet: Ampangorina', category: 'Izlet', priceAr: ar(65), paymentStatus: 'PAID' },
        { name: 'Malagasy Massage', category: 'Masaza', priceAr: ar(35), paymentStatus: 'PAID' },
        { name: 'Malagasy Massage', category: 'Masaza', priceAr: ar(35), paymentStatus: 'PAID' },
        { name: 'Money Loan 700.000 Ar +5%', category: 'Razno', priceAr: ar(153.12), paymentStatus: 'PAID' },
      ],
      barItems: [],
      discountsAr: 0,
    })
    assert.equal(amount, 1654.39)
  })

  it('does not add the arrival transfer twice when the transfer record is already counted', () => {
    const amount = chargedInvoiceAmountEur({
      totalAmount: 100,
      exchangeRate: 4800,
      transferEur: 55,
      orders: [
        { name: 'Transfer ARRIVAL: Big port Nosy be - Komba Cabana - 2 pax', category: 'Transfer', priceAr: 0, refPriceAr: ar(55), paymentStatus: 'PAID' },
      ],
      barItems: [],
      discountsAr: 0,
    })
    assert.equal(amount, 155)
  })

  it('leaves a prepaid board lump out of the stay it is already inside', () => {
    const amount = chargedInvoiceAmountEur({
      totalAmount: 200,
      mealPlan: 'HB',
      mealPlanPaymentStatus: 'PAID',
      exchangeRate: 4800,
      orders: [
        { name: 'Polpenzion (2 osebi × 3 dni)', category: 'Prehrana', priceAr: ar(150), paymentStatus: 'PAID' },
      ],
      barItems: [],
      discountsAr: 0,
    })
    assert.equal(amount, 200)
  })
})
