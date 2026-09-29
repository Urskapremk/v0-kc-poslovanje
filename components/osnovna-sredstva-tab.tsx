'use client'

import React, { useState } from 'react'
import useSWR, { useSWRConfig } from 'swr'
import { Building2, Plus, Trash2, Pencil, Check, X } from 'lucide-react'
import {
  getFixedAssets,
  getFixedAssetsDepreciation,
  addFixedAsset,
  updateFixedAsset,
  deleteFixedAsset,
  getExchangeRateValue,
} from '@/app/actions/statistics'
import AssetsInProgress from '@/components/assets-in-progress'
import FixedAssetRegister from '@/components/fixed-asset-register'

const MONTH_NAMES = ['januar', 'februar', 'marec', 'april', 'maj', 'junij', 'julij', 'avgust', 'september', 'oktober', 'november', 'december']

function formatEur(n: number) {
  return new Intl.NumberFormat('sl-SI', { style: 'currency', currency: 'EUR' }).format(n || 0)
}
function formatAr(n: number) {
  return `${new Intl.NumberFormat('sl-SI').format(Math.round(n || 0))} Ar`
}
function formatDate(d: string | null) {
  if (!d) return '-'
  return new Intl.DateTimeFormat('sl-SI', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(d))
}

export default function OsnovnaSredstvaTab({ year, month }: { year: number; month: number }) {
  const { mutate } = useSWRConfig()
  const assetsKey = ['fixed-assets']
  const depKey = ['fixed-assets-depreciation', year, month]
  const { data: assets, isLoading } = useSWR(assetsKey, () => getFixedAssets())
  const { data: depreciation } = useSWR(depKey, () => getFixedAssetsDepreciation(year, month))
  const { data: rate = 4800 } = useSWR('exchange-rate', getExchangeRateValue)

  const [newName, setNewName] = useState('')
  const [newDate, setNewDate] = useState(`${year}-${String(month).padStart(2, '0')}-01`)
  const [newAr, setNewAr] = useState('')
  const [newRate, setNewRate] = useState('')
  const [saving, setSaving] = useState(false)

  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editAr, setEditAr] = useState('')
  const [editRate, setEditRate] = useState('')

  const all = (assets || []).filter((a) => a.status !== 'in_progress')
  const dep = depreciation
  const newArNum = Number(newAr.replace(/[^\d]/g, '')) || 0
  const newRateNum = Number(newRate.replace(',', '.')) || 0
  const newEur = newArNum > 0 ? Math.round((newArNum / rate) * 100) / 100 : 0
  const newMonthly = newEur > 0 && newRateNum > 0 ? Math.round((newEur * (newRateNum / 100) / 12) * 100) / 100 : 0

  const refresh = () => {
    mutate(assetsKey)
    mutate(depKey)
    mutate(['fixed-asset-register', year, month])
  }

  async function handleAdd() {
    if (!newName.trim() || !newDate || newArNum <= 0 || newRateNum <= 0) return
    setSaving(true)
    await addFixedAsset({ name: newName.trim(), purchaseDate: newDate, amountAr: newArNum, annualRatePct: newRateNum })
    setNewName('')
    setNewAr('')
    setNewRate('')
    setNewDate(`${year}-${String(month).padStart(2, '0')}-01`)
    setSaving(false)
    refresh()
  }

  function startEdit(a: { id: string; name: string; purchaseDate: string; amountAr: number; annualRatePct: number }) {
    setEditId(a.id)
    setEditName(a.name)
    setEditDate((a.purchaseDate || '').slice(0, 10))
    setEditAr(String(Math.round(a.amountAr)))
    setEditRate(String(a.annualRatePct))
  }

  async function handleSaveEdit(id: string) {
    const ar = Number(editAr.replace(/[^\d]/g, '')) || 0
    const r = Number(editRate.replace(',', '.')) || 0
    if (!editName.trim() || !editDate || ar <= 0 || r <= 0) return
    await updateFixedAsset(id, { name: editName.trim(), purchaseDate: editDate, amountAr: ar, annualRatePct: r })
    setEditId(null)
    refresh()
  }

  async function handleDelete(id: string) {
    if (!confirm('Izbrisati to osnovno sredstvo? Amortizacija bo odstranjena iz kalkulacij.')) return
    await deleteFixedAsset(id)
    refresh()
  }

  // Mesečna amortizacija po sredstvu za prikaz v tabeli (aktivnost v izbranem mesecu).
  const monthlyById: Record<string, { monthlyEur: number; active: boolean; elapsed: number; lifeMonths: number }> = {}
  for (const i of dep?.items || []) {
    monthlyById[i.id] = { monthlyEur: i.monthlyEur, active: i.active, elapsed: i.elapsed, lifeMonths: i.lifeMonths }
  }

  return (
    <div className="space-y-5">
      {/* Glava */}
      <div>
        <h3 className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-white/60">
          <Building2 className="h-4 w-4 text-[#c59b5b]" />
          Osnovna sredstva
        </h3>
        <p className="mt-1 text-xs text-white/40">
          Osnovna sredstva se knjižijo posebej. Mesečni strošek je <strong className="text-white/60">amortizacija</strong>, izračunana iz nabavne vrednosti in letne amortizacijske stopnje. Amortizacija teče od meseca nabave do konca dobe.
        </p>
      </div>

      {/* Povzetek: mesečna amortizacija izbranega meseca */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-[#c59b5b]/30 bg-[#c59b5b]/10 px-5 py-4">
          <div className="text-[11px] uppercase tracking-wider text-white/50">Amortizacija — {MONTH_NAMES[month - 1]} {year}</div>
          <div className="mt-1 text-2xl font-bold text-[#c59b5b]">{formatEur(dep?.total || 0)}</div>
          <div className="mt-0.5 text-[11px] text-white/40">Ta znesek se knjiži kot strošek v kalkulacijah.</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4">
          <div className="text-[11px] uppercase tracking-wider text-white/50">Osnovna sredstva</div>
          <div className="mt-1 text-2xl font-bold text-white/80">{all.length}</div>
          <div className="mt-0.5 text-[11px] text-white/40">Nabavna vrednost skupaj {formatAr(all.reduce((s, a) => s + a.amountAr, 0))}</div>
        </div>
      </div>

      <AssetsInProgress onActivated={refresh} />

      {/* Dodaj osnovno sredstvo */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <h4 className="text-[11px] font-medium uppercase tracking-wider text-white/50">Dodaj osnovno sredstvo</h4>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">Naziv</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="npr. Generator, klima, čoln, pohištvo..."
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-[#c59b5b]/40 focus:outline-none"
            />
          </div>
          <div className="w-40">
            <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">Datum nabave</label>
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-[#c59b5b]/40 focus:outline-none [color-scheme:dark]"
            />
          </div>
          <div className="w-44">
            <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">Nabavna vrednost (Ar)</label>
            <input
              type="text"
              inputMode="numeric"
              value={newAr}
              onChange={(e) => setNewAr(e.target.value)}
              placeholder="npr. 12000000"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white text-right focus:border-[#c59b5b]/40 focus:outline-none"
            />
          </div>
          <div className="w-36">
            <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">Stopnja (letno %)</label>
            <input
              type="text"
              inputMode="decimal"
              value={newRate}
              onChange={(e) => setNewRate(e.target.value)}
              placeholder="npr. 20"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white text-right focus:border-[#c59b5b]/40 focus:outline-none"
            />
          </div>
          <button
            onClick={handleAdd}
            disabled={saving || !newName.trim() || newArNum <= 0 || newRateNum <= 0}
            className="flex items-center gap-2 rounded-xl bg-[#c59b5b] px-5 py-3 text-sm font-medium text-[#1a1410] transition-colors hover:bg-[#d4aa6a] disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Dodaj
          </button>
        </div>
        {newArNum > 0 && newRateNum > 0 && (
          <p className="mt-2.5 text-xs text-white/50">
            Nabavna vrednost <span className="font-semibold text-white/70">{formatAr(newArNum)}</span> ≈ <span className="font-semibold text-white/70">{formatEur(newEur)}</span> (tečaj {new Intl.NumberFormat('sl-SI').format(rate)}){' → '}
            doba <span className="font-semibold text-white/70">{Math.round(1200 / newRateNum)} mesecev</span>, mesečna amortizacija <span className="font-semibold text-[#c59b5b]">{formatEur(newMonthly)}</span>
          </p>
        )}
      </div>

      {/* Seznam osnovnih sredstev */}
      {isLoading ? (
        <p className="text-sm text-white/40">Nalagam...</p>
      ) : all.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-12 text-center">
          <Building2 className="mx-auto h-8 w-8 text-white/20" />
          <p className="mt-3 text-sm text-white/50">Ni vpisanih osnovnih sredstev. Dodajte prvo zgoraj.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/[0.06]">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-white/40">
                <th className="px-5 py-3 font-medium">Naziv</th>
                <th className="px-5 py-3 font-medium w-28">Nabava</th>
                <th className="px-5 py-3 font-medium text-right w-40">Nabavna vred.</th>
                <th className="px-5 py-3 font-medium text-right w-24">Stopnja</th>
                <th className="px-5 py-3 font-medium text-right w-44">Amort. {MONTH_NAMES[month - 1].slice(0, 3)}. {year}</th>
                <th className="px-5 py-3 font-medium text-right w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {all.map((a) => {
                const m = monthlyById[a.id]
                const life = Math.round(1200 / a.annualRatePct)
                return editId === a.id ? (
                  <tr key={a.id} className="bg-white/[0.03]">
                    <td className="px-5 py-3">
                      <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full rounded-lg border border-[#c59b5b]/40 bg-white/5 px-2 py-1.5 text-sm text-white focus:outline-none" />
                    </td>
                    <td className="px-5 py-3">
                      <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white focus:outline-none [color-scheme:dark]" />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <input type="text" inputMode="numeric" value={editAr} onChange={(e) => setEditAr(e.target.value)} className="w-32 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white text-right focus:outline-none" />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <input type="text" inputMode="decimal" value={editRate} onChange={(e) => setEditRate(e.target.value)} className="w-16 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white text-right focus:outline-none" />
                    </td>
                    <td className="px-5 py-3"></td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => handleSaveEdit(a.id)} className="rounded-lg bg-[#8fae92]/15 p-2 text-[#8fae92] hover:bg-[#8fae92]/25" aria-label="Shrani">
                          <Check className="h-4 w-4" />
                        </button>
                        <button onClick={() => setEditId(null)} className="rounded-lg bg-white/5 p-2 text-white/50 hover:bg-white/10" aria-label="Prekliči">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={a.id}>
                    <td className="px-5 py-3 text-sm text-white/80">{a.name}</td>
                    <td className="px-5 py-3 text-sm text-white/60">{formatDate(a.purchaseDate)}</td>
                    <td className="px-5 py-3 text-right text-sm text-white/70">
                      {formatAr(a.amountAr)}
                      <span className="block text-[10px] text-white/35">{formatEur(a.amountEur)}</span>
                    </td>
                    <td className="px-5 py-3 text-right text-sm text-white/70">
                      {new Intl.NumberFormat('sl-SI').format(a.annualRatePct)} %
                      <span className="block text-[10px] text-white/35">{life} mes.</span>
                    </td>
                    <td className="px-5 py-3 text-right text-sm font-medium">
                      {m?.active ? (
                        <span className="text-[#c59b5b]">{formatEur(m.monthlyEur)}</span>
                      ) : m && m.elapsed >= m.lifeMonths ? (
                        <span className="text-white/30" title="Amortizirano do konca">amortizirano</span>
                      ) : (
                        <span className="text-white/30" title="Še ni nabavljeno v tem mesecu">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => startEdit(a)} className="rounded-lg bg-white/5 p-2 text-white/50 hover:bg-[#c59b5b]/20 hover:text-[#c59b5b]" aria-label="Uredi">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDelete(a.id)} className="rounded-lg bg-white/5 p-2 text-white/50 hover:bg-red-500/20 hover:text-red-400" aria-label="Izbriši">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <FixedAssetRegister year={year} month={month} />
    </div>
  )
}
