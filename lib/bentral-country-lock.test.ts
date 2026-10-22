import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { bentralCountryForImport } from "./bentral-country-lock"

describe("bentralCountryForImport", () => {
  it("drops the extra Madagascar count where a police form already counts the guests", () => {
    for (const id of ["K-2025-142", "K-2026-16", "K-2026-72", "K-2026-6", "K-2026-168"]) {
      assert.equal(bentralCountryForImport(id, "Madagascar"), null)
    }
  })

  it("keeps Clement as France and the Zurcher fragment as Switzerland", () => {
    assert.equal(bentralCountryForImport("5680914490", "Madagascar"), "France")
    assert.equal(bentralCountryForImport("K-2026-169", "Madagascar"), "Switzerland")
  })

  it("leaves every other booking, including the December Madagascar stays, on the CSV country", () => {
    assert.equal(bentralCountryForImport("K-2026-23", "Madagascar"), "Madagascar")
    assert.equal(bentralCountryForImport("K-2026-127", "Madagascar"), "Madagascar")
    assert.equal(bentralCountryForImport("K-2026-129", "Madagascar"), "Madagascar")
    assert.equal(bentralCountryForImport("K-2026-18", "Germany"), "Germany")
    assert.equal(bentralCountryForImport("someone-else", ""), null)
    assert.equal(bentralCountryForImport("someone-else", "  France  "), "France")
  })
})
