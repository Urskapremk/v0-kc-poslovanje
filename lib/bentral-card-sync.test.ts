import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { bentralCountryForImport } from "./bentral-country-lock"
import { cardFieldsFromBentral, cardStatusFromBentral } from "./bentral-card-sync"

const vitogaz = {
  guestName: "VITOGAZ MADAGASCAR",
  units: "Garden Bungalov III / Garden Bungalov III (2+1); Ocean Bungalow IV - Beach Villa / Ocean Bungalow IV ; Jungle Glamp Village / Jungle Glamp Village 1 (2+0); Jungle Glamp Village / Jungle Glamp Village 2 (2+0)",
  adults: 6,
  children: 0,
  checkIn: "2026-11-20",
  checkOut: "2026-11-22",
  status: "Potrjeno",
  source: null,
  country: "Madagascar",
  guestNotes: null,
  ownNotes: null,
  amount: "1324.80",
  currency: "EUR",
}

describe("cardFieldsFromBentral", () => {
  it("copies the Vitogaz Bentral row onto the existing card, including the new name", () => {
    const patch = cardFieldsFromBentral(vitogaz, "RESERVED")
    assert.equal(patch.guestName, "VITOGAZ MADAGASCAR")
    assert.equal(patch.pax, 6)
    assert.equal(patch.adults, 6)
    assert.equal(patch.children, 0)
    assert.equal(patch.arrival, "2026-11-20")
    assert.equal(patch.departure, "2026-11-22")
    assert.equal(patch.checkIn, "2026-11-20")
    assert.equal(patch.checkOut, "2026-11-22")
    assert.equal(patch.bungalow, vitogaz.units)
    assert.equal(patch.totalAmount, "1324.80")
    assert.equal(patch.amountPaid, "0")
    assert.equal(patch.currency, "EUR")
    assert.equal(patch.nationality, "Madagascar")
    assert.equal(patch.bookingSource, "Direct")
    assert.equal(patch.status, "RESERVED")
    assert.equal(patch.notes, null)
  })

  it("uses the country it is given, so a locked country stays locked and Vitogaz does not", () => {
    assert.equal(bentralCountryForImport("K-2026-180", "Madagascar"), "Madagascar")
    const cleared = cardFieldsFromBentral({ ...vitogaz, country: null }, "RESERVED")
    assert.equal(cleared.nationality, null)
    const kept = cardFieldsFromBentral({ ...vitogaz, country: "France" }, "RESERVED")
    assert.equal(kept.nationality, "France")
  })

  it("cancels a card when Bentral says so, and leaves an in-house stay in house", () => {
    assert.equal(cardStatusFromBentral("Preklicano", "RESERVED"), "CANCELLED")
    assert.equal(cardStatusFromBentral("Preklicano", "IN_HOUSE"), "CANCELLED")
    assert.equal(cardStatusFromBentral("Potrjeno", "IN_HOUSE"), "IN_HOUSE")
    assert.equal(cardStatusFromBentral("Potrjeno", "CHECKED_OUT"), "CHECKED_OUT")
    assert.equal(cardStatusFromBentral("Potrjeno", "ARRIVING_TODAY"), "ARRIVING_TODAY")
    assert.equal(cardStatusFromBentral("Potrjeno", "CANCELLED"), "RESERVED")
  })

  it("marks the stay paid only when Bentral says the first part is paid", () => {
    const paid = cardFieldsFromBentral({ ...vitogaz, status: "Plačano (1. del)" }, "RESERVED")
    assert.equal(paid.amountPaid, "1324.80")
    assert.equal(paid.status, "RESERVED")
  })
})
