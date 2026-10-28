// A blinking gift on the bungalow card when a guest's birthday falls on a night
// of that bungalow's stay. Check-in day counts. The checkout morning does not.
// A booking that stores people per bungalow uses those people, never the
// company holder on the reservation.

import { bungalowKey, stayUnits } from './bungalow'
import type { BungalowPeopleMap } from './bungalow-people'

export type StaySegment = {
  key?: string
  bungalow?: string
  arrival?: string
  departure?: string
}

function day(value: string | null | undefined): string {
  const s = String(value || '').slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ''
}

function nextDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + 1)
  return dt.toISOString().slice(0, 10)
}

/** Nights slept: arrival inclusive, departure (checkout morning) exclusive. */
export function stayNights(arrival: string | null | undefined, departure: string | null | undefined): string[] {
  const start = day(arrival)
  const end = day(departure)
  if (!start || !end || start >= end) return []
  const nights: string[] = []
  let cur = start
  while (cur < end && nights.length < 400) {
    nights.push(cur)
    cur = nextDay(cur)
  }
  return nights
}

export function unitStayDates(input: {
  cardBungalow: string
  arrival?: string | null
  departure?: string | null
  bungalowSegments?: StaySegment[] | null
}): { arrival: string; departure: string } {
  const key = bungalowKey(input.cardBungalow)
  const segs = Array.isArray(input.bungalowSegments) ? input.bungalowSegments : []
  const seg = segs.find((s) => (s.key || bungalowKey(s.bungalow || '')) === key)
  return {
    arrival: day(seg?.arrival) || day(input.arrival),
    departure: day(seg?.departure) || day(input.departure),
  }
}

type CardGuest = {
  cardBungalow: string
  bungalow?: string | null
  arrival?: string | null
  departure?: string | null
  bungalowSegments?: StaySegment[] | null
  bungalowPeople?: BungalowPeopleMap | null
  guestName?: string | null
  secondGuestName?: string | null
  thirdGuestName?: string | null
  fourthGuestName?: string | null
  dateOfBirth?: string | null
  secondDateOfBirth?: string | null
  thirdDateOfBirth?: string | null
  fourthDateOfBirth?: string | null
}

function datedPeople(input: CardGuest): { name: string; monthDay: string }[] {
  const units = stayUnits(input.bungalow)
  if (units.length >= 2) {
    const list = input.bungalowPeople?.[bungalowKey(input.cardBungalow)]
    if (!Array.isArray(list)) return []
    return list.flatMap((person) => {
      const dob = day(person?.dateOfBirth)
      if (!dob) return []
      return [{ name: (person?.name || '').trim(), monthDay: dob.slice(5) }]
    })
  }
  const slots = [
    [input.guestName, input.dateOfBirth],
    [input.secondGuestName, input.secondDateOfBirth],
    [input.thirdGuestName, input.thirdDateOfBirth],
    [input.fourthGuestName, input.fourthDateOfBirth],
  ] as const
  return slots.flatMap(([name, dob]) => {
    const iso = day(dob)
    if (!iso) return []
    return [{ name: (name || '').trim(), monthDay: iso.slice(5) }]
  })
}

/** People on this bungalow whose birthday (month and day) falls during the stay. */
export function birthdayGuestsOnCard(input: CardGuest): { name: string }[] {
  const { arrival, departure } = unitStayDates(input)
  const nights = new Set(stayNights(arrival, departure).map((iso) => iso.slice(5)))
  if (!nights.size) return []
  return datedPeople(input)
    .filter((person) => nights.has(person.monthDay))
    .map((person) => ({ name: person.name }))
}

export function birthdayLabel(people: { name: string }[]): string {
  const who = people.map((person) => person.name.trim()).filter(Boolean)
  return who.length ? `Rojstni dan med bivanjem: ${who.join(', ')}` : 'Rojstni dan med bivanjem'
}
