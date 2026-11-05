import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { hideCompletedDepartureFromList } from './hidden-departure'

const mojca = {
  type: 'departure' as const,
  guestName: 'Mojca Aleš',
  bungalow: 'Ocean Bungalow IV - za 4 / Ocean Bungalow IV',
  stayDate: '2026-11-03',
  pickupDate: '',
}

describe('hideCompletedDepartureFromList', () => {
  it('hides Mojca Aleš’s paid 3 Nov departure from Bungalow IV', () => {
    assert.equal(hideCompletedDepartureFromList(mojca), true)
    assert.equal(hideCompletedDepartureFromList({
      ...mojca,
      guestName: 'Mojca Ales',
      bungalow: 'Bungalow IV - Beach Villa',
      pickupDate: '2026-11-03T00:00:00.000Z',
      stayDate: '2026-11-07',
    }), true)
  })

  it('keeps the 7 Nov card and every other transfer', () => {
    assert.equal(hideCompletedDepartureFromList({ ...mojca, stayDate: '2026-11-07' }), false)
    assert.equal(hideCompletedDepartureFromList({ ...mojca, type: 'arrival' }), false)
    assert.equal(hideCompletedDepartureFromList({ ...mojca, guestName: 'Ana Novak' }), false)
    assert.equal(hideCompletedDepartureFromList({
      ...mojca,
      bungalow: 'Ocean Bungalow I',
    }), false)
    assert.equal(hideCompletedDepartureFromList({
      ...mojca,
      type: 'reception',
    }), false)
  })
})
