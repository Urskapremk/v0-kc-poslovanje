import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildCashReceiptHtml,
  cashReceiptFigures,
  cashReceiptSubject,
  formatReceiptAr,
  formatReceiptDate,
  formatReceiptEur,
  formatReceiptRate,
  receiptCompanions,
} from './cash-receipt'

const LOGO = 'https://www.kombacabana.app/images/komba-logo-gold.png'

const mojca = {
  guestName: 'Mojca Aleš',
  companions: ['Igor Smolnikar', 'Jošt Smolnikar', 'Eva Prelovšek'],
  amountAr: 2_800_000,
  eur: 583.33,
  exchangeRate: 4800,
  paidAt: '2026-10-29',
  bungalow: 'Bungalow IV - Beach Villa',
  arrival: '2026-10-28',
  departure: '2026-11-03',
  bookingNumber: 'K-2026-69',
  logoUrl: LOGO,
}

describe('cashReceiptFigures', () => {
  it('keeps entered ariary and converts euros with the app rate', () => {
    const figures = cashReceiptFigures({ cashAmountAr: 2_800_000, amountEur: 1, exchangeRate: 4800 })
    assert.equal(figures.amountAr, 2_800_000)
    assert.equal(figures.eur, 583.33)
    assert.equal(figures.rate, 4800)
  })

  it('turns a euro-only cash entry into ariary with the same rate', () => {
    const figures = cashReceiptFigures({ cashAmountAr: null, amountEur: 100, exchangeRate: 4800 })
    assert.equal(figures.amountAr, 480_000)
    assert.equal(figures.eur, 100)
  })
})

describe('receiptCompanions', () => {
  it('keeps the other names already on the booking', () => {
    assert.deepEqual(
      receiptCompanions('Mojca Aleš', ['Mojca Aleš', ' Igor Smolnikar ', '', 'Jošt Smolnikar', 'Eva Prelovšek']),
      ['Igor Smolnikar', 'Jošt Smolnikar', 'Eva Prelovšek'],
    )
  })
})

describe('receipt formatting', () => {
  it('uses the approved number and date shapes', () => {
    assert.equal(formatReceiptAr(2_800_000), '2.800.000')
    assert.equal(formatReceiptEur(583.33), '583,33')
    assert.equal(formatReceiptRate(4800), '4.800')
    assert.equal(formatReceiptDate('2026-10-29', 'sl'), '29. oktober 2026')
    assert.equal(formatReceiptDate('2026-10-29', 'en'), '29 October 2026')
    assert.equal(formatReceiptDate('2026-10-29', 'fr'), '29 octobre 2026')
    assert.equal(formatReceiptDate('2026-11-03', 'fr'), '3 novembre 2026')
  })
})

describe('buildCashReceiptHtml', () => {
  it('matches the Slovenian receipt', () => {
    const html = buildCashReceiptHtml({ ...mojca, lang: 'sl' })
    assert.match(html, /Potrdilo o plačilu z gotovino/)
    assert.equal(html.includes('Cash payment receipt'), false)
    assert.match(html, /Mojca Aleš/)
    assert.match(html, /2\.800\.000 Ar/)
    assert.match(html, /583,33 EUR/)
    assert.match(html, /Tečaj 1 EUR = 4\.800 Ar/)
    assert.match(html, /Bungalow IV - Beach Villa/)
    assert.match(html, /28\. oktober 2026 – 3\. november 2026/)
    assert.match(html, /K-2026-69/)
    assert.match(html, /Igor Smolnikar/)
    assert.match(html, /Jošt Smolnikar/)
    assert.match(html, /Eva Prelovšek/)
    assert.match(html, /Način plačila · Gotovina/)
    assert.match(html, /To potrdilo potrjuje, da je Komba Cabana prejela navedeno gotovino\./)
    assert.equal(html.split(LOGO).length - 1, 2)
    assert.equal(/font-family:[^;"]*cursive/i.test(html), false)
    assert.equal(/Great Vibes|Allura|Pacifico|Dancing Script|Sacramento|Cormorant|Palatino|Georgia/i.test(html), false)
    assert.match(html, /family=Manrope:wght@500;600&family=Inter:wght@400;500;600/)
    assert.match(html, /font-family:'Manrope','Segoe UI',Tahoma,Arial,Helvetica,sans-serif/)
    assert.match(html, /font-family:'Inter','Segoe UI',Tahoma,Arial,Helvetica,sans-serif/)
    assert.equal(/font-style:italic/.test(html), false)
  })

  it('matches the English and French titles and confirmation lines', () => {
    const en = buildCashReceiptHtml({ ...mojca, lang: 'en' })
    assert.match(en, /Cash payment receipt/)
    assert.match(en, /This confirms that Komba Cabana has received the cash above\./)
    assert.match(en, /Payment method · Cash/)
    assert.match(en, /28 October 2026 – 3 November 2026/)
    assert.equal(cashReceiptSubject('en'), 'Cash payment receipt — Komba Cabana')

    const fr = buildCashReceiptHtml({ ...mojca, lang: 'fr' })
    assert.match(fr, /Reçu de paiement en espèces/)
    assert.match(fr, /Ceci confirme que Komba Cabana a reçu le montant en espèces indiqué\./)
    assert.match(fr, /Mode de paiement · Espèces/)
    assert.match(fr, /28 octobre 2026 – 3 novembre 2026/)
    assert.equal(cashReceiptSubject('fr'), 'Reçu de paiement en espèces — Komba Cabana')
    assert.equal(cashReceiptSubject('sl'), 'Potrdilo o plačilu z gotovino — Komba Cabana')
  })

  it('omits the companion block when the booking has no other names', () => {
    const html = buildCashReceiptHtml({ ...mojca, lang: 'en', companions: [] })
    assert.equal(html.includes('>With<'), false)
    assert.equal(html.includes('Igor Smolnikar'), false)
  })
})
