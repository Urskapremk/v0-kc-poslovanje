import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { HV_NERO_BOAT, HV_NERO_DEFAULT_AR, HV_NERO_PRICES_AR, hvNeroPriceAr } from "./hv-nero-price"

describe("hvNeroPriceAr", () => {
  it("keeps Nero and offers 120.000 or 180.000 Ar", () => {
    assert.equal(HV_NERO_BOAT, "Nero")
    assert.deepEqual(HV_NERO_PRICES_AR, [120_000, 180_000])
    assert.equal(HV_NERO_DEFAULT_AR, 120_000)
  })

  it("defaults an unset Hell-Ville boat to 120.000 Ar", () => {
    assert.equal(hvNeroPriceAr(undefined), 120_000)
    assert.equal(hvNeroPriceAr(null), 120_000)
    assert.equal(hvNeroPriceAr(""), 120_000)
    assert.equal(hvNeroPriceAr(0), 120_000)
    assert.equal(hvNeroPriceAr("120000"), 120_000)
  })

  it("accepts 180.000 Ar and refuses any other amount", () => {
    assert.equal(hvNeroPriceAr(180_000), 180_000)
    assert.equal(hvNeroPriceAr("180000"), 180_000)
    assert.equal(hvNeroPriceAr(180_000.4), 180_000)
    assert.equal(hvNeroPriceAr(80_000), 120_000)
    assert.equal(hvNeroPriceAr(150_000), 120_000)
  })
})
