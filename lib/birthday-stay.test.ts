import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { birthdayGuestsOnCard, birthdayLabel, stayNights } from './birthday-stay'

const VITOGAZ =
  'Garden Bungalov III / Garden Bungalov III (2+1); Ocean Bungalow IV - Beach Villa / Ocean Bungalow IV ; Jungle Glamp Village / Jungle Glamp Village 1 (2+0); Jungle Glamp Village / Jungle Glamp Village 2 (2+0)'

const people = {
  jungle: [{ name: 'Ana', dateOfBirth: '1990-10-30' }],
  'jungle-ii': [{ name: 'Boris', dateOfBirth: '1980-01-01' }],
  'garden-iii': [{ name: 'Cene' }],
  'ocean-iv': [{ name: 'Dora', dateOfBirth: '1975-11-02' }],
}

describe('stay nights', () => {
  it('includes check-in and the day before checkout', () => {
    assert.deepEqual(stayNights('2026-03-01', '2026-03-04'), ['2026-03-01', '2026-03-02', '2026-03-03'])
  })

  it('crosses the new year', () => {
    assert.deepEqual(stayNights('2026-12-30', '2027-01-03'), ['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02'])
  })

  it('has no nights when there is no overnight stay', () => {
    assert.deepEqual(stayNights('2026-03-01', '2026-03-01'), [])
  })
})

describe('birthday on a bungalow card', () => {
  it('uses the person stored on that bungalow, not the company holder', () => {
    const shared = {
      bungalow: VITOGAZ,
      arrival: '2026-10-28',
      departure: '2026-11-02',
      bungalowPeople: people,
      guestName: 'VITOGAZ MADAGASCAR',
      dateOfBirth: '1970-10-29',
    }
    assert.deepEqual(birthdayGuestsOnCard({ ...shared, cardBungalow: 'Jungle Glamp Village' }), [{ name: 'Ana' }])
    assert.deepEqual(birthdayGuestsOnCard({ ...shared, cardBungalow: 'Jungle Glamp Village II' }), [])
    assert.deepEqual(birthdayGuestsOnCard({ ...shared, cardBungalow: 'Garden Bungalow III' }), [])
    assert.deepEqual(birthdayGuestsOnCard({ ...shared, cardBungalow: 'Ocean Bungalow IV' }), [])
  })

  it('shows nothing when that bungalow has no date of birth', () => {
    assert.deepEqual(
      birthdayGuestsOnCard({
        cardBungalow: 'Garden Bungalow III',
        bungalow: VITOGAZ,
        arrival: '2026-10-28',
        departure: '2026-11-02',
        bungalowPeople: people,
        dateOfBirth: '1970-10-29',
      }),
      [],
    )
  })

  it('shows nothing when a multi-bungalow booking has no people stored', () => {
    assert.deepEqual(
      birthdayGuestsOnCard({
        cardBungalow: 'Garden Bungalow III',
        bungalow: VITOGAZ,
        arrival: '2026-10-28',
        departure: '2026-11-02',
        guestName: 'VITOGAZ MADAGASCAR',
        dateOfBirth: '1970-10-29',
      }),
      [],
    )
  })

  it('reads police-form dates on a single bungalow, including the day before checkout', () => {
    assert.deepEqual(
      birthdayGuestsOnCard({
        cardBungalow: 'Ocean Bungalow I',
        bungalow: 'Ocean Bungalow I',
        arrival: '2026-03-01',
        departure: '2026-03-04',
        guestName: 'Ana',
        dateOfBirth: '1985-03-01',
        secondGuestName: 'Borut',
        secondDateOfBirth: '1980-03-03',
      }),
      [{ name: 'Ana' }, { name: 'Borut' }],
    )
  })

  it('ignores a birthday that falls on the checkout morning', () => {
    assert.deepEqual(
      birthdayGuestsOnCard({
        cardBungalow: 'Ocean Bungalow I',
        bungalow: 'Ocean Bungalow I',
        arrival: '2026-03-01',
        departure: '2026-03-04',
        guestName: 'Cene',
        dateOfBirth: '1985-03-04',
      }),
      [],
    )
  })

  it('matches month and day across the new year', () => {
    assert.deepEqual(
      birthdayGuestsOnCard({
        cardBungalow: 'Ocean Bungalow II',
        bungalow: 'Ocean Bungalow II',
        arrival: '2026-12-30',
        departure: '2027-01-03',
        guestName: 'Dora',
        dateOfBirth: '1992-01-01',
      }),
      [{ name: 'Dora' }],
    )
  })

  it('matches 29 February only on a night that is 29 February', () => {
    assert.deepEqual(
      birthdayGuestsOnCard({
        cardBungalow: 'Ocean Bungalow I',
        bungalow: 'Ocean Bungalow I',
        arrival: '2027-02-27',
        departure: '2027-03-01',
        dateOfBirth: '2000-02-29',
      }),
      [],
    )
    assert.deepEqual(
      birthdayGuestsOnCard({
        cardBungalow: 'Ocean Bungalow I',
        bungalow: 'Ocean Bungalow I',
        arrival: '2028-02-28',
        departure: '2028-03-01',
        guestName: 'Eva',
        dateOfBirth: '2000-02-29',
      }),
      [{ name: 'Eva' }],
    )
  })

  it('uses the nights stored for that bungalow when the stay is split', () => {
    assert.deepEqual(
      birthdayGuestsOnCard({
        cardBungalow: 'Ocean Bungalow IV',
        bungalow: 'Ocean Bungalow I; Ocean Bungalow IV',
        arrival: '2026-10-01',
        departure: '2026-10-20',
        bungalowSegments: [
          { key: 'ocean-i', arrival: '2026-10-01', departure: '2026-10-10' },
          { key: 'ocean-iv', arrival: '2026-10-10', departure: '2026-10-20' },
        ],
        bungalowPeople: {
          'ocean-i': [{ name: 'Ana', dateOfBirth: '1990-10-12' }],
          'ocean-iv': [{ name: 'Dora', dateOfBirth: '1975-10-12' }],
        },
        dateOfBirth: '1970-10-05',
      }),
      [{ name: 'Dora' }],
    )
  })

  it('labels the gift with the person, or stays quiet when they have no name', () => {
    assert.equal(birthdayLabel([{ name: 'Ana' }, { name: '' }]), 'Rojstni dan med bivanjem: Ana')
    assert.equal(birthdayLabel([{ name: '' }]), 'Rojstni dan med bivanjem')
  })
})
