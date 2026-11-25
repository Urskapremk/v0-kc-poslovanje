import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  excursionLineParts,
  excursionLineTotalAr,
  matchExcursionLineBooking,
  parseExcursionEur,
} from "./excursion-line-price.ts"

const nosyKomba = {
  excursionId: "exc-komba",
  date: "2026-11-20",
  pax: 2,
  status: "ACTIVE",
  guestPrice: 104.17,
  entranceFee: 0,
  lunchPrice: 0,
  boatId: "nero",
  lunchProviderId: "",
  entrancePax: null,
  boatPriceEur: 52.085,
}

describe("excursion invoice price parts", () => {
  it("keeps only the boat transport on the Nosy Komba line", () => {
    const parts = excursionLineParts(nosyKomba)
    assert.deepEqual(parts.map((part) => part.label), ["Prevoz"])
    assert.equal(parts[0].eur, 104.17)
    assert.equal(excursionLineTotalAr(parts.map((part) => part.eur), 4800), 500016)
  })

  it("adds entrance and lunch only when this booking already has them", () => {
    const parts = excursionLineParts({
      ...nosyKomba,
      entranceFee: 16.67,
      entrancePax: 2,
      lunchPrice: 14.58,
      lunchProviderId: "sakatia",
    })
    assert.deepEqual(parts.map((part) => part.label), ["Prevoz", "Vstopnina", "Kosilo"])
    assert.equal(excursionLineTotalAr(parts.map((part) => part.eur), 4800), Math.round((104.17 + 16.67 + 14.58) * 4800))
  })

  it("does not invent a guide, taxi, or extra entrance line", () => {
    const parts = excursionLineParts({
      ...nosyKomba,
      guestPrice: 80,
      boatId: "",
      boatPriceEur: null,
    })
    assert.deepEqual(parts.map((part) => part.key), ["transport"])
  })

  it("shows a zero lunch line when a lunch provider is already on the booking", () => {
    const parts = excursionLineParts({ ...nosyKomba, lunchPrice: 0, lunchProviderId: "sakatia" })
    assert.deepEqual(parts.map((part) => part.label), ["Prevoz", "Kosilo"])
  })

  it("matches this invoice line and not another excursion on the same guest", () => {
    const other = { ...nosyKomba, excursionId: "exc-tanikely", guestPrice: 200, boatId: "noah" }
    const matched = matchExcursionLineBooking(
      { name: "Izlet: Excursion Island Nosy Komba - 2 pax | Vklj: Nero", eventDate: "2026-11-20" },
      [other, nosyKomba],
      (id) => (id === "exc-komba" ? "Excursion Island Nosy Komba" : "Nosy Tanikely"),
    )
    assert.equal(matched?.guestPrice, 104.17)
  })

  it("refuses two identical lines instead of editing the wrong one", () => {
    const matched = matchExcursionLineBooking(
      { name: "Izlet: Excursion Island Nosy Komba - 2 pax | Vklj: Nero", eventDate: "2026-11-20", priceAr: 500016 },
      [nosyKomba, { ...nosyKomba }],
      () => "Excursion Island Nosy Komba",
    )
    assert.equal(matched, null)
  })

  it("uses the line amount when two bookings share the name and the day", () => {
    const matched = matchExcursionLineBooking(
      { name: "Izlet: Excursion Island Nosy Komba - 2 pax | Vklj: Nero", eventDate: "2026-11-20", priceAr: 500016 },
      [nosyKomba, { ...nosyKomba, guestPrice: 80, boatPriceEur: 40 }],
      () => "Excursion Island Nosy Komba",
      4800,
    )
    assert.equal(matched?.guestPrice, 104.17)
  })

  it("reads a Slovenian decimal", () => {
    assert.equal(parseExcursionEur("104,17"), 104.17)
    assert.equal(parseExcursionEur("-1"), null)
  })
})
