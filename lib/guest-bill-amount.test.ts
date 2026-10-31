import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { GUEST_BILL_RATE_FALLBACK, guestBillLineAmount } from "./guest-bill-amount"

describe("guestBillLineAmount", () => {
  it("puts the euro equivalent beside the ariary on an excursion line", () => {
    assert.equal(
      guestBillLineAmount("Izlet", 1_092_000, 4800),
      "1.092.000 Ar · 227.50 EUR",
    )
  })

  it("uses the app exchange rate, not a fixed conversion", () => {
    assert.equal(
      guestBillLineAmount("Izlet", 1_092_000, 5000),
      "1.092.000 Ar · 218.40 EUR",
    )
  })

  it("falls back to the guest-bill rate when the setting is missing", () => {
    assert.equal(GUEST_BILL_RATE_FALLBACK, 4800)
    assert.equal(
      guestBillLineAmount("Izlet", 1_092_000, 0),
      "1.092.000 Ar · 227.50 EUR",
    )
  })

  it("leaves non-excursion lines as ariary only", () => {
    assert.equal(guestBillLineAmount("Transfer", 504_000, 4800), "504.000 Ar")
    assert.equal(guestBillLineAmount("Pijaca", 15_000, 4800), "15.000 Ar")
    assert.equal(guestBillLineAmount("Hrana", 25_000, 4800), "25.000 Ar")
  })
})
