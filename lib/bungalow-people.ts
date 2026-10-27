// People who sleep in one bungalow of a multi-unit booking.
// The holder (nosilec) stays on reservation.guestName and is not stored here.

import { stayUnits } from './bungalow'

const GUEST_SLOTS = ['first', 'second', 'third', 'fourth'] as const
export type GuestSlotName = (typeof GUEST_SLOTS)[number]

const PERSON_FIELDS = [
  'nationality',
  'passport',
  'dateOfBirth',
  'placeOfBirth',
  'fatherName',
  'motherName',
  'profession',
  'domicile',
  'passportDate',
  'passportLieu',
  'venantDe',
  'validiteVisa',
  'allantA',
] as const

// On a multi-unit booking the old guest slots line up with bungalows in the
// order Bentral lists them. A single-unit booking returns null and keeps the
// shared guest columns.
export function multiStayUnitForSlot(
  bungalow: string | null | undefined,
  slot: GuestSlotName,
): string | null {
  const units = stayUnits(bungalow)
  if (units.length < 2) return null
  return units[GUEST_SLOTS.indexOf(slot)]?.key || null
}

export function mergeGuestFieldsIntoPeople(
  current: BungalowPeopleMap | null | undefined,
  key: string,
  fields: Partial<Record<string, string>>,
): BungalowPeopleMap {
  const list = [...(current?.[key] || [])]
  const person: BungalowPerson = { ...(list[0] || { name: '' }) }
  if (fields.guestName !== undefined) person.name = fields.guestName
  for (const field of PERSON_FIELDS) {
    if (fields[field] !== undefined) person[field] = fields[field]
  }
  if (list.length === 0) list.push(person)
  else list[0] = person
  return replaceBungalowPeople(current, key, list)
}

export type BungalowPerson = {
  name: string
  nationality?: string
  passport?: string
  dateOfBirth?: string
  placeOfBirth?: string
  fatherName?: string
  motherName?: string
  profession?: string
  domicile?: string
  passportDate?: string
  passportLieu?: string
  venantDe?: string
  validiteVisa?: string
  allantA?: string
}

export type BungalowPeopleMap = Record<string, BungalowPerson[]>

export function replaceBungalowPeople(
  current: BungalowPeopleMap | null | undefined,
  key: string,
  people: BungalowPerson[],
): BungalowPeopleMap {
  const base: BungalowPeopleMap = {}
  if (current && typeof current === 'object') {
    for (const [k, list] of Object.entries(current)) {
      if (k === key) continue
      base[k] = Array.isArray(list) ? list.map(person => ({ ...person })) : []
    }
  }
  base[key] = people.map(person => ({ ...person, name: person.name ?? '' }))
  return base
}

// Police form for one bungalow reads that bungalow's person. It does not fall
// back to the booking holder.
export function policePerson(
  people: BungalowPeopleMap | null | undefined,
  key: string,
  index = 0,
): BungalowPerson | null {
  const list = people?.[key]
  const person = list?.[index]
  if (!person) return null
  return { ...person, name: person.name || '' }
}
