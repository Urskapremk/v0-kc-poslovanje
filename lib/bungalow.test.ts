import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  bungalowCardLabel,
  bungalowDisplayName,
  bungalowKey,
  reservationMatchesBungalow,
} from "./bungalow"

describe("jungle glamp units", () => {
  it("keeps the first unit's stored id and shows it as Village I", () => {
    assert.equal(bungalowKey("Jungle Glamp Village"), "jungle")
    assert.equal(bungalowDisplayName("Jungle Glamp Village"), "Jungle Glamp Village I")
    assert.equal(bungalowCardLabel("Jungle Glamp Village"), "Jungle Glamp Village I")
    assert.equal(bungalowDisplayName("Jungle Glamp Village / Jungle Glamp Village (2+0)"), "Jungle Glamp Village I")
  })

  it("adds Village II as its own unit", () => {
    assert.equal(bungalowKey("Jungle Glamp Village II"), "jungle-ii")
    assert.equal(bungalowDisplayName("Jungle Glamp Village II"), "Jungle Glamp Village II")
    assert.equal(bungalowCardLabel("Jungle Glamp Village II"), "Jungle Glamp Village II")
  })

  it("assigns the unnumbered glamp to I and not to II", () => {
    assert.equal(reservationMatchesBungalow("Jungle Glamp Village", "Jungle Glamp Village"), true)
    assert.equal(reservationMatchesBungalow("Jungle Glamp Village", "Jungle Glamp Village II"), false)
    assert.equal(reservationMatchesBungalow("Jungle Glamp Village I", "Jungle Glamp Village"), true)
    assert.equal(reservationMatchesBungalow("Jungle Glamp Village II", "Jungle Glamp Village"), false)
    assert.equal(reservationMatchesBungalow("Jungle Glamp Village II", "Jungle Glamp Village II"), true)
    assert.equal(
      reservationMatchesBungalow("Jungle Glamp Village / Jungle Glamp Village (2+0)", "Jungle Glamp Village II"),
      false,
    )
  })

  it("does not rename the other bungalows or cross-match their numbers", () => {
    assert.equal(bungalowCardLabel("Ocean Bungalow I"), "Ocean Bungalow I")
    assert.equal(bungalowCardLabel("Ocean Bungalow II"), "Ocean Bungalow II")
    assert.equal(bungalowCardLabel("Garden Bungalow III"), "Garden Bungalow III")
    assert.equal(bungalowCardLabel("Ocean Bungalow IV"), "Ocean Bungalow IV")
    assert.equal(bungalowDisplayName("Ocean Bungalow IV"), "Bungalow IV - Beach Villa")
    assert.equal(reservationMatchesBungalow("Ocean Bungalow I", "Ocean Bungalow II"), false)
    assert.equal(reservationMatchesBungalow("Ocean Bungalow II", "Ocean Bungalow I"), false)
    assert.equal(reservationMatchesBungalow("Ocean Bungalow IV", "Ocean Bungalow I"), false)
    assert.equal(reservationMatchesBungalow("Ocean Bungalov I", "Ocean Bungalow I"), true)
    assert.equal(reservationMatchesBungalow("Ocean Bungalow IV", "Ocean Bungalov I"), false)
    assert.equal(reservationMatchesBungalow("Ocean Bungalow I / Ocean Bungalow I (4+0)", "Ocean Bungalov I"), true)
    assert.equal(reservationMatchesBungalow("Garden Bungalov III", "Garden Bungalow III"), true)
  })
})
