import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { NOSY_BE_PORT_PHOTO, voucherPortPhoto, type VoucherPortPlace } from './voucher-port-photo'

function place(over: Partial<VoucherPortPlace> = {}): VoucherPortPlace {
  return {
    type: 'arrival',
    pickupPoint: '',
    routeName: '',
    hermanRouteName: '',
    ...over,
  }
}

describe('voucherPortPhoto', () => {
  it('keeps the Nosy Be pier photo for Nosy Be port pickups', () => {
    for (const pickupPoint of [
      'Port de Nosy Be',
      'Big port Nosy be',
      'port nosy-be',
      'Hell-Ville port',
      'port of Hell Ville',
      'Andoany port',
      'port',
      'the port',
      'Port.',
      'Big port',
    ]) {
      assert.equal(voucherPortPhoto(place({ pickupPoint })), NOSY_BE_PORT_PHOTO, pickupPoint)
    }
  })

  it('shows no port photo for Port Ankify, port ankifi, or Ankify', () => {
    for (const pickupPoint of [
      'Port Ankify',
      'port ankifi',
      'Ankify',
      'ANKIFI',
      "Port d'Ankify",
      'Ankify port',
    ]) {
      assert.equal(voucherPortPhoto(place({ pickupPoint })), null, pickupPoint)
    }
  })

  it('does not use the Nosy Be photo when a bare port sits on an Ankify route', () => {
    assert.equal(
      voucherPortPhoto(place({
        pickupPoint: 'port',
        routeName: 'Port Ankify - Komba Cabana',
      })),
      null
    )
    assert.equal(
      voucherPortPhoto(place({
        pickupPoint: 'the port',
        hermanRouteName: 'port ankifi',
      })),
      null
    )
  })

  it('still shows the Nosy Be photo when the pickup itself names that port', () => {
    assert.equal(
      voucherPortPhoto(place({
        pickupPoint: 'Big port Nosy be',
        routeName: 'Big port Nosy be - Komba Cabana',
      })),
      NOSY_BE_PORT_PHOTO
    )
  })

  it('does not show a port photo for airport, hotel, or departure', () => {
    assert.equal(voucherPortPhoto(place({ pickupPoint: 'Airport Nosy Be' })), null)
    assert.equal(voucherPortPhoto(place({ pickupPoint: 'Fascene Airport' })), null)
    assert.equal(voucherPortPhoto(place({ pickupPoint: 'Hotel Vanila, Hell-Ville' })), null)
    assert.equal(
      voucherPortPhoto(place({ type: 'departure', pickupPoint: 'Port de Nosy Be' })),
      null
    )
    assert.equal(
      voucherPortPhoto(place({ type: 'departure', pickupPoint: 'Port Ankify' })),
      null
    )
  })
})
