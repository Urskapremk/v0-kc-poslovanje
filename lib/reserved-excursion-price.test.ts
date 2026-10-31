import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  reservedExcursionTotal,
  seedReservedExcursionDraft,
  withBoatPer,
  withEntrance,
  withEntranceCount,
  withLunch,
  withLunchCount,
  withTransport,
} from "./reserved-excursion-price.ts"

const ENTRANCE_PER = 40000 / 4800
const LUNCH_PER = 7.29

function tanikely() {
  return seedReservedExcursionDraft({
    pax: 4,
    fallbackPax: 4,
    boatId: "noah",
    guestPrice: 320,
    entranceFee: 33.33,
    lunchPrice: 29.17,
    lunchPax: 4,
    entrancePax: null,
    boatPriceEur: null,
    lunchProviderId: "sakatia",
    entrancePer: ENTRANCE_PER,
    lunchPer: LUNCH_PER,
  })
}

describe("reserved excursion price lines", () => {
  it("keeps the saved Nosy Tanikely lines and total", () => {
    const draft = tanikely()
    assert.equal(draft.boatPer, 80)
    assert.equal(draft.lunchCount, 4)
    assert.equal(draft.entranceCount, 4)
    assert.equal(draft.transport, 320)
    assert.equal(draft.entrance, 33.33)
    assert.equal(draft.lunch, 29.17)
    assert.equal(reservedExcursionTotal(draft), 382.5)
  })

  it("updates only the total when transport, entrance, or lunch is typed", () => {
    const transport = withTransport(tanikely(), 300)
    assert.equal(transport.transport, 300)
    assert.equal(transport.boatPer, 80)
    assert.equal(transport.entrance, 33.33)
    assert.equal(transport.lunch, 29.17)
    assert.equal(reservedExcursionTotal(transport), 362.5)

    const entrance = withEntrance(tanikely(), 10)
    assert.equal(entrance.entrance, 10)
    assert.equal(entrance.entranceCount, 4)
    assert.equal(entrance.transport, 320)
    assert.equal(reservedExcursionTotal(entrance), 359.17)

    const lunch = withLunch(tanikely(), 10)
    assert.equal(lunch.lunch, 10)
    assert.equal(lunch.lunchCount, 4)
    assert.equal(lunch.transport, 320)
    assert.equal(reservedExcursionTotal(lunch), 363.33)
  })

  it("fills the line from the boat rate, lunch count, or entrance count", () => {
    const boat = withBoatPer(tanikely(), 70)
    assert.equal(boat.boatPer, 70)
    assert.equal(boat.transport, 280)
    assert.equal(boat.entrance, 33.33)
    assert.equal(boat.lunch, 29.17)
    assert.equal(reservedExcursionTotal(boat), 342.5)

    const keptBoat = withTransport(boat, 250)
    assert.equal(keptBoat.boatPer, 70)
    assert.equal(keptBoat.transport, 250)
    assert.equal(reservedExcursionTotal(keptBoat), 312.5)

    const lunches = withLunchCount(tanikely(), 2, LUNCH_PER)
    assert.equal(lunches.lunchCount, 2)
    assert.equal(lunches.lunch, 14.58)
    assert.equal(lunches.transport, 320)
    assert.equal(reservedExcursionTotal(lunches), 367.91)

    const entrances = withEntranceCount(tanikely(), 2, ENTRANCE_PER)
    assert.equal(entrances.entranceCount, 2)
    assert.equal(entrances.entrance, 16.67)
    assert.equal(entrances.transport, 320)
    assert.equal(reservedExcursionTotal(entrances), 365.84)
  })
})
