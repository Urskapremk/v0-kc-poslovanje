import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  applyCombinedRouteLabels,
  combinedRouteLabel,
  transferLineName,
  withCombinedRouteInItemName,
} from './combined-route'

const BOAT = 'Big port Nosy be - Komba Cabana'
const TAXI = 'Airport Fascene - Big Port Nosy Be'
const FULL_ARRIVAL = 'Airport - Big port Nosy Be - Komba Cabana'
const FULL_DEPARTURE = 'Komba Cabana - Big port Nosy Be - Airport'

describe('combinedRouteLabel', () => {
  it('joins Therese’s airport taxi and boat into one arrival path', () => {
    assert.equal(combinedRouteLabel(BOAT, TAXI, 'arrival'), FULL_ARRIVAL)
  })

  it('uses the older taxi name Port Nosy Be the same way', () => {
    assert.equal(
      combinedRouteLabel(BOAT, 'Airport Fascene - Port Nosy Be', 'arrival'),
      FULL_ARRIVAL,
    )
  })

  it('reverses the same two legs for a departure, even when the stored names point the other way', () => {
    assert.equal(combinedRouteLabel(BOAT, TAXI, 'departure'), FULL_DEPARTURE)
    assert.equal(
      combinedRouteLabel('Komba Cabana - Big port Nosy be', 'Big Port Nosy Be - Airport Fascene', 'departure'),
      FULL_DEPARTURE,
    )
  })

  it('keeps a hotel or beach stop instead of calling everything an airport', () => {
    assert.equal(
      combinedRouteLabel(BOAT, 'Exora Beach to Big Port Nosy Be', 'arrival'),
      'Exora Beach - Big port Nosy Be - Komba Cabana',
    )
    assert.equal(
      combinedRouteLabel(BOAT, 'Hotel Vanila - Big Port Nosy Be', 'departure'),
      'Komba Cabana - Big port Nosy Be - Hotel Vanila',
    )
  })

  it('leaves a single leg alone', () => {
    assert.equal(combinedRouteLabel(BOAT, '', 'arrival'), null)
    assert.equal(combinedRouteLabel('', TAXI, 'arrival'), null)
    assert.equal(combinedRouteLabel(BOAT, BOAT, 'arrival'), null)
  })
})

describe('transfer invoice line', () => {
  it('writes the full path into the arrival line and keeps the boat and the guest count', () => {
    assert.equal(
      transferLineName('arrival', BOAT, TAXI, 'Citadel', 2),
      `Transfer ARRIVAL: ${FULL_ARRIVAL} (Citadel) - 2 pax`,
    )
  })

  it('rewrites a line that was stored with only the boat route', () => {
    const stored = 'Transfer ARRIVAL: Big port Nosy be - Komba Cabana (Citadel) - 2 pax'
    assert.equal(
      withCombinedRouteInItemName(stored, FULL_ARRIVAL),
      `Transfer ARRIVAL: ${FULL_ARRIVAL} (Citadel) - 2 pax`,
    )
  })

  it('is idempotent and ignores a line that is not a transfer', () => {
    const line = `Transfer DEPARTURE: ${FULL_DEPARTURE} - 1 pax`
    assert.equal(withCombinedRouteInItemName(line, FULL_DEPARTURE), line)
    const items = applyCombinedRouteLabels(
      [
        { category: 'Transfer', name: 'Transfer ARRIVAL: Big port Nosy be - Komba Cabana (Citadel) - 2 pax' },
        { category: 'Bivanje', name: 'Bivanje Ocean' },
      ],
      { arrival: FULL_ARRIVAL, departure: null },
    )
    assert.equal(items[0].name, `Transfer ARRIVAL: ${FULL_ARRIVAL} (Citadel) - 2 pax`)
    assert.equal(items[1].name, 'Bivanje Ocean')
  })
})
