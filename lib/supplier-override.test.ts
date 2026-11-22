import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseSupplierAmountAr, readOverrideAr, supplierAmountAr } from './supplier-override'

describe('supplier amount override', () => {
  it('reads a stored amount and treats a missing one as the catalog', () => {
    assert.equal(supplierAmountAr(273000, null), 273000)
    assert.equal(supplierAmountAr(273000, undefined), 273000)
    assert.equal(supplierAmountAr(300000, 273000), 273000)
    assert.equal(supplierAmountAr(300000, 0), 0)
  })

  it('parses a typed ariary amount with dots or spaces', () => {
    assert.equal(parseSupplierAmountAr('300.000'), 300000)
    assert.equal(parseSupplierAmountAr('300 000'), 300000)
    assert.equal(parseSupplierAmountAr(''), null)
    assert.equal(readOverrideAr(''), null)
  })
})
