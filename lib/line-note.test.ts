import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { guestInvoiceLineNote, prepareLineNote, transferMirrorDirection, LINE_NOTE_MAX } from "./line-note"

describe("prepareLineNote", () => {
  it("keeps a saved note off the invoice until she says yes", () => {
    assert.deepEqual(prepareLineNote("Boat left at 09:00", false), {
      note: "Boat left at 09:00",
      onInvoice: false,
    })
  })

  it("marks the note for the invoice only when she says yes", () => {
    assert.deepEqual(prepareLineNote("  Boat left at 09:00  ", true), {
      note: "Boat left at 09:00",
      onInvoice: true,
    })
  })

  it("clears the invoice flag when the note is removed", () => {
    assert.deepEqual(prepareLineNote("   ", true), { note: null, onInvoice: false })
  })

  it("keeps the note short", () => {
    const long = "a".repeat(LINE_NOTE_MAX + 40)
    assert.equal(prepareLineNote(long, true).note?.length, LINE_NOTE_MAX)
  })
})

describe("guestInvoiceLineNote", () => {
  it("prints under the line only when she marked it for the invoice", () => {
    assert.equal(guestInvoiceLineNote("Delay at the port", true), "Delay at the port")
  })

  it("hides an app-only note, including on a transfer line", () => {
    assert.equal(guestInvoiceLineNote("Delay at the port", false), null)
    assert.equal(guestInvoiceLineNote("Delay at the port", null), null)
    assert.equal(guestInvoiceLineNote("", true), null)
    assert.equal(guestInvoiceLineNote("  ", true), null)
  })
})

describe("transferMirrorDirection", () => {
  it("recognises arrival and departure transfer lines", () => {
    assert.equal(
      transferMirrorDirection("Transfer ARRIVAL: Hell-Ville - Manja Kely Lodge (Citadel) - 2 pax"),
      "arrival",
    )
    assert.equal(transferMirrorDirection("Transfer DEPARTURE: Komba Cabana - Hell-Ville - 2 pax"), "departure")
    assert.equal(transferMirrorDirection("Transfer: private boat"), null)
  })
})
