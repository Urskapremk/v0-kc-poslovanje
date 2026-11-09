import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { guestInvoiceLineNote, lineNoteButtonLabel, prepareLineNote, shownLineNote, transferMirrorDirection, LINE_NOTE_MAX } from "./line-note"

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

describe("shownLineNote", () => {
  it("shows a note she just saved even when the reloaded line is still empty", () => {
    assert.deepEqual(shownLineNote("", false, { note: "Coln je zamudil", onInvoice: false }), {
      note: "Coln je zamudil",
      onInvoice: false,
    })
  })

  it("uses the stored note when nothing is waiting to catch up", () => {
    assert.deepEqual(shownLineNote("  Na pristanišču  ", true, null), {
      note: "Na pristanišču",
      onInvoice: true,
    })
    assert.deepEqual(shownLineNote("", false), { note: "", onInvoice: false })
  })

  it("drops the invoice flag when the pending note was cleared", () => {
    assert.deepEqual(shownLineNote("Stara", true, { note: "  ", onInvoice: true }), {
      note: "",
      onInvoice: false,
    })
  })
})

describe("lineNoteButtonLabel", () => {
  it("offers Opomba until a note exists, then Popravi", () => {
    assert.equal(lineNoteButtonLabel(""), "Opomba")
    assert.equal(lineNoteButtonLabel("   "), "Opomba")
    assert.equal(lineNoteButtonLabel("Zamuda"), "Popravi")
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
