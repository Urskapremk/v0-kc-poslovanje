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

// Writes police-form fields onto one person in a bungalow. index 0 is the
// first person; later people on the same bungalow keep their own row.
export function writePersonFields(
  current: BungalowPeopleMap | null | undefined,
  key: string,
  index: number,
  fields: Partial<Record<string, string>>,
): BungalowPeopleMap {
  const list = [...(current?.[key] || [])].map(person => ({ ...person }))
  while (list.length <= index) list.push({ name: '' })
  const person: BungalowPerson = { ...(list[index] || { name: '' }) }
  if (fields.guestName !== undefined) person.name = fields.guestName
  for (const field of PERSON_FIELDS) {
    if (fields[field] !== undefined) person[field] = fields[field]
  }
  list[index] = person
  return replaceBungalowPeople(current, key, list)
}

export function mergeGuestFieldsIntoPeople(
  current: BungalowPeopleMap | null | undefined,
  key: string,
  fields: Partial<Record<string, string>>,
): BungalowPeopleMap {
  return writePersonFields(current, key, 0, fields)
}

export type BungalowPerson = {
  name: string
  // Private link for a person who is not the first in their bungalow.
  // The first person of each of the first four units keeps the legacy slot token.
  checkinToken?: string
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

export type StayCheckinPerson = {
  unitKey: string
  unitLabel: string
  index: number
  name: string
  // Set only for the first person of a unit that still has a legacy slot token.
  legacySlot: GuestSlotName | null
}

// Every named person on a multi-unit stay, bungalow by bungalow. Blank rows
// are not guests. A single-unit booking returns [] and keeps the shared columns.
export function stayPeopleForCheckin(
  bungalow: string | null | undefined,
  people: BungalowPeopleMap | null | undefined,
): StayCheckinPerson[] {
  const units = stayUnits(bungalow)
  if (units.length < 2) return []
  const listed: StayCheckinPerson[] = []
  units.forEach((unit, unitIndex) => {
    const list = people?.[unit.key]
    if (!Array.isArray(list)) return
    list.forEach((person, index) => {
      const name = (person?.name || '').trim()
      if (!name) return
      listed.push({
        unitKey: unit.key,
        unitLabel: unit.label,
        index,
        name,
        legacySlot: index === 0 && unitIndex < GUEST_SLOTS.length ? GUEST_SLOTS[unitIndex] : null,
      })
    })
  })
  return listed
}

export function findPersonByCheckinToken(
  people: BungalowPeopleMap | null | undefined,
  token: string,
): { unitKey: string; index: number; person: BungalowPerson } | null {
  if (!people || !token) return null
  for (const [unitKey, list] of Object.entries(people)) {
    if (!Array.isArray(list)) continue
    const index = list.findIndex(person => person?.checkinToken === token)
    if (index >= 0) {
      const person = list[index]
      return { unitKey, index, person: { ...person, name: person.name || '' } }
    }
  }
  return null
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
