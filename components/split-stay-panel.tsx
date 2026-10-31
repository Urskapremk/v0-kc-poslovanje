'use client'

import { useState } from 'react'
import { mutate } from 'swr'
import { BedDouble, X } from 'lucide-react'
import { splitStayByUnit } from '@/app/actions/split-stay'

type Unit = { key: string; label: string }
type Row = { guestName: string; adults: string; children: string; totalAmount: string }

export function SplitStayPanel({
  reservationId,
  guestName,
  units,
}: {
  reservationId: string
  guestName: string
  units: Unit[]
}) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const extraUnits = units.slice(1)
  const [rows, setRows] = useState<Record<string, Row>>(() =>
    Object.fromEntries(extraUnits.map(u => [u.key, { guestName: '', adults: '1', children: '0', totalAmount: '' }])),
  )

  const update = (key: string, field: keyof Row, value: string) =>
    setRows(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }))

  const handleSplit = async () => {
    setError('')
    if (!confirm(`Ločim rezervacijo ${guestName} na ${units.length} ločene račune (po bungalovih)?`)) return
    setSaving(true)
    const res = await splitStayByUnit(
      reservationId,
      extraUnits.map(u => ({
        unitKey: u.key,
        guestName: rows[u.key].guestName,
        adults: Number(rows[u.key].adults) || 0,
        children: Number(rows[u.key].children) || 0,
        totalAmount: Number(rows[u.key].totalAmount) || 0,
      })),
    )
    setSaving(false)
    if (!res.ok) { setError(res.error); return }
    setOpen(false)
    mutate(key => Array.isArray(key) && key[0] === 'dashboard')
  }

  return (
    <div className="mt-4 rounded-xl border border-[#3f6b7d]/30 bg-[#3f6b7d]/10 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-xs text-white/70">
          <BedDouble className="h-4 w-4 text-[#7fa8b8]" />
          {'Skupen račun na '}<span className="font-semibold text-white">{units[0].label}</span>
          {' · spijo tudi v '}{extraUnits.map(u => u.label).join(', ')}
        </p>
        {!open ? (
          <button
            onClick={() => setOpen(true)}
            className="rounded-lg border border-[#7fa8b8]/40 px-3 py-1.5 text-xs font-medium text-[#7fa8b8] hover:bg-[#7fa8b8]/10"
          >
            Ločeno plačilo po bungalovih
          </button>
        ) : (
          <button onClick={() => setOpen(false)} aria-label="Zapri" className="rounded-lg p-1 text-white/50 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && (
        <div className="mt-3 space-y-3">
          <p className="text-[11px] leading-relaxed text-white/50">
            {`${units[0].label} ostane na rezervaciji ${guestName}. Za vsak drug bungalov vpiši nosilca, osebe in ceno bivanja — ustvari se ločena rezervacija z lastno dobavnico in računom. Osebe in cena se odštejejo od glavne rezervacije.`}
          </p>
          {extraUnits.map(u => (
            <div key={u.key} className="grid grid-cols-2 gap-2 rounded-lg border border-white/10 p-2.5 sm:grid-cols-[1fr_1.6fr_5rem_5rem_7rem]">
              <p className="col-span-2 self-center text-sm font-semibold text-[#c59b5b] sm:col-span-1">{u.label}</p>
              <label className="col-span-2 flex flex-col gap-1 text-[10px] uppercase tracking-wider text-white/40 sm:col-span-1">
                Nosilec
                <input value={rows[u.key].guestName} onChange={e => update(u.key, 'guestName', e.target.value)} className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-sm normal-case tracking-normal text-white" />
              </label>
              <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-white/40">
                Odrasli
                <input type="number" min={1} value={rows[u.key].adults} onChange={e => update(u.key, 'adults', e.target.value)} className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white" />
              </label>
              <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-white/40">
                Otroci
                <input type="number" min={0} value={rows[u.key].children} onChange={e => update(u.key, 'children', e.target.value)} className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white" />
              </label>
              <label className="col-span-2 flex flex-col gap-1 text-[10px] uppercase tracking-wider text-white/40 sm:col-span-1">
                Cena bivanja (EUR)
                <input type="number" min={0} value={rows[u.key].totalAmount} onChange={e => update(u.key, 'totalAmount', e.target.value)} className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white" />
              </label>
            </div>
          ))}
          {error && <p className="text-xs text-[#e07a6a]">{error}</p>}
          <button
            onClick={handleSplit}
            disabled={saving}
            className="w-full rounded-lg bg-[#3f6b7d] py-2 text-sm font-medium text-white hover:bg-[#4e8296] disabled:opacity-50"
          >
            {saving ? 'Ločujem…' : 'Ločeni računi po bungalovih'}
          </button>
        </div>
      )}
    </div>
  )
}
