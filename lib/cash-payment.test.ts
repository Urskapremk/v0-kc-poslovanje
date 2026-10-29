import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { cashAriaryToEurAmount } from './cash-payment'

describe('cashAriaryToEurAmount', () => {
  it('converts Ariary with the app rate (Ar per EUR)', () => {
    assert.equal(cashAriaryToEurAmount(480000, 4800), '100.00')
    assert.equal(cashAriaryToEurAmount(100000, 4800), '20.83')
    assert.equal(cashAriaryToEurAmount(24, 4800), '0.01')
  })

  it('rounds Ariary to a whole number before dividing', () => {
    assert.equal(cashAriaryToEurAmount(480000.4, 4800), '100.00')
  })

  it('returns 0.00 when the amount or the rate cannot convert', () => {
    assert.equal(cashAriaryToEurAmount(0, 4800), '0.00')
    assert.equal(cashAriaryToEurAmount(-100, 4800), '0.00')
    assert.equal(cashAriaryToEurAmount(480000, 0), '0.00')
    assert.equal(cashAriaryToEurAmount(Number.NaN, 4800), '0.00')
  })
})
