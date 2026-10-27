'use client'

import React from 'react'
import { saveBungalowUnitPeople } from '@/app/actions/komba'
import type { BungalowPeopleMap, BungalowPerson } from '@/lib/bungalow-people'

const POLICE_FIELDS: { key: keyof BungalowPerson; label: string; type?: string }[] = [
  { key: 'nationality', label: 'Nacionalnost' },
  { key: 'passport', label: 'Potni list' },
  { key: 'dateOfBirth', label: 'Datum rojstva', type: 'date' },
  { key: 'placeOfBirth', label: 'Kraj rojstva' },
  { key: 'fatherName', label: 'Ime očeta' },
  { key: 'motherName', label: 'Ime matere' },
  { key: 'profession', label: 'Poklic' },
  { key: 'domicile', label: 'Stalno prebivališče' },
  { key: 'passportDate', label: 'Datum izdaje potnega lista', type: 'date' },
  { key: 'passportLieu', label: 'Kraj izdaje potnega lista' },
  { key: 'venantDe', label: 'Prihaja iz' },
  { key: 'validiteVisa', label: 'Veljavnost vize', type: 'date' },
  { key: 'allantA', label: 'Potuje v' },
]

function blankPerson(): BungalowPerson {
  return { name: '' }
}

export function BungalowPeopleEditor({
  reservationId,
  units,
  people,
  onSaved,
}: {
  reservationId: string
  units: { key: string; label: string }[]
  people: BungalowPeopleMap | null | undefined
  onSaved: () => void
}) {
  const [draft, setDraft] = React.useState<BungalowPeopleMap>({})
  const draftRef = React.useRef<BungalowPeopleMap>({})
  const [open, setOpen] = React.useState<string | null>(units[0]?.key ?? null)
  const unitKey = units.map(unit => unit.key).join('|')

  React.useEffect(() => {
    const next: BungalowPeopleMap = {}
    for (const unit of units) {
      const stored = people?.[unit.key]
      next[unit.key] = stored && stored.length > 0 ? stored.map(p => ({ ...p })) : [blankPerson()]
    }
    draftRef.current = next
    setDraft(next)
  }, [people, reservationId, unitKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const commit = async (key: string, list: BungalowPerson[]) => {
    const next = { ...draftRef.current, [key]: list }
    draftRef.current = next
    setDraft(next)
    await saveBungalowUnitPeople(reservationId, key, list)
    onSaved()
  }

  const patch = (key: string, index: number, field: keyof BungalowPerson, value: string) => {
    const prev = draftRef.current
    const list = [...(prev[key] || [blankPerson()])]
    while (list.length <= index) list.push(blankPerson())
    list[index] = { ...(list[index] || blankPerson()), [field]: value }
    const next = { ...prev, [key]: list }
    draftRef.current = next
    setDraft(next)
  }

  return (
    <div className="space-y-3 px-3 pb-3">
      <p className="px-1 text-[11px] text-white/40">
        Nosilec rezervacije ostane ime rezervacije. Oseba v enem bungalovu se ne prepiše na druge bungalove.
      </p>
      {units.map(unit => {
        const list = draft[unit.key] || [blankPerson()]
        const expanded = open === unit.key
        return (
          <div key={unit.key} className="rounded-xl border border-[#7fa8b8]/20 bg-[#7fa8b8]/[0.04]">
            <button
              type="button"
              onClick={() => setOpen(expanded ? null : unit.key)}
              className="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-white"
            >
              <span>
                <span className="text-white/50">Bungalov: </span>
                <span className="font-medium text-[#7fa8b8]">{unit.label}</span>
              </span>
              <span className="text-[11px] text-white/40">
                {list.filter(p => p.name.trim()).map(p => p.name.trim()).join(', ') || 'brez osebe'}
              </span>
            </button>
            {expanded ? (
              <div className="space-y-4 border-t border-[#7fa8b8]/10 px-4 py-3">
                {list.map((person, index) => (
                  <div key={`${unit.key}-${index}`} className="space-y-2">
                    <label className="block text-[11px] font-medium uppercase tracking-wider text-white/40">
                      Oseba {index + 1}
                    </label>
                    <input
                      type="text"
                      className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white focus:border-[#7fa8b8]/40 focus:outline-none"
                      value={person.name}
                      placeholder="Ime in priimek"
                      onChange={e => patch(unit.key, index, 'name', e.target.value)}
                      onBlur={() => commit(unit.key, draftRef.current[unit.key] || list)}
                    />
                    {POLICE_FIELDS.map(field => (
                      <div key={field.key}>
                        <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/35">{field.label}</label>
                        <input
                          type={field.type || 'text'}
                          className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 text-sm text-white focus:border-[#7fa8b8]/40 focus:outline-none [color-scheme:dark]"
                          value={(person[field.key] as string) || ''}
                          onChange={e => patch(unit.key, index, field.key, e.target.value)}
                          onBlur={() => commit(unit.key, draftRef.current[unit.key] || list)}
                        />
                      </div>
                    ))}
                    {list.length > 1 ? (
                      <button
                        type="button"
                        className="text-[11px] text-white/40 underline"
                        onClick={() => commit(unit.key, list.filter((_, i) => i !== index))}
                      >
                        Odstrani osebo iz tega bungalova
                      </button>
                    ) : null}
                  </div>
                ))}
                <button
                  type="button"
                  className="text-xs font-medium text-[#7fa8b8]"
                  onClick={() => commit(unit.key, [...list, blankPerson()])}
                >
                  Dodaj osebo v ta bungalov
                </button>
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
