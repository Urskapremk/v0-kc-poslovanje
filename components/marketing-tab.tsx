'use client'

import React, { useState } from 'react'
import useSWR, { mutate } from 'swr'
import { Megaphone, Plus, Trash2, Check, X, ChevronDown, ChevronRight } from 'lucide-react'
import {
  getMarketingExpensesYear,
  addMarketingExpense,
  updateMarketingExpense,
  deleteMarketingExpense,
} from '@/app/actions/statistics'
import StroskiArhivTab from './stroski-arhiv-tab'
import VraciloHnaturaTab from './vracilo-hnatura-tab'

const MONTH_NAMES = ['januar', 'februar', 'marec', 'april', 'maj', 'junij', 'julij', 'avgust', 'september', 'oktober', 'november', 'december']

const CATEGORIES = [
  { id: 'marketing', label: 'Marketing', placeholder: 'npr. Facebook oglasi, fotograf, agencija...' },
  { id: 'booking', label: 'Booking', placeholder: 'npr. provizija Booking.com' },
  { id: 'optimaplus', label: 'Optima plus', placeholder: 'npr. strošek Optima plus' },
  { id: 'provizija', label: 'Provizija', placeholder: 'npr. provizija Orange Money' },
] as const

type CategoryId = (typeof CATEGORIES)[number]['id']

const PAYMENT_METHODS = [
  { id: 'cash', label: 'Gotovina' },
  { id: 'orange_money', label: 'Orange Money' },
  { id: 'transfer', label: 'Bančni transfer' },
  { id: 'in_kind', label: 'Hnatura d.o.o.' },
] as const

const PAYMENT_LABELS: Record<string, string> = Object.fromEntries(PAYMENT_METHODS.map((m) => [m.id, m.label]))

function formatEur(n: number) {
  return new Intl.NumberFormat('sl-SI', { style: 'currency', currency: 'EUR' }).format(n || 0)
}

function formatDate(d: string | null) {
  if (!d) return '-'
  return new Intl.DateTimeFormat('sl-SI', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(d))
}

function defaultDate(year: number, month: number) {
  return `${year}-${String(month).padStart(2, '0')}-01`
}

export default function MarketingTab({ year, month }: { year: number; month: number }) {
  const [category, setCategory] = useState<CategoryId>('marketing')
  const [view, setView] = useState<'expenses' | 'archive' | 'hnatura'>('expenses')
  const activeCat = CATEGORIES.find((c) => c.id === category)!
  const key = ['marketing-expenses-year', category, year]
  const { data: expenses, isLoading } = useSWR(key, () => getMarketingExpensesYear(year, category))

  const [newDate, setNewDate] = useState(defaultDate(year, month))
  const [newDesc, setNewDesc] = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [newMethod, setNewMethod] = useState<string>('cash')
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editDate, setEditDate] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const [editMethod, setEditMethod] = useState<string>('cash')
  const [openMonths, setOpenMonths] = useState<Record<number, boolean>>({ [month]: true })

  const all = expenses || []
  // Vsota izbranega meseca (ta gre v Pregled) in vsota celega leta
  const monthTotal = all.filter((e) => e.month === month).reduce((s, e) => s + Number(e.amount), 0)
  const yearTotal = all.reduce((s, e) => s + Number(e.amount), 0)

  // Grupiraj vnose po mesecih (1-12) za razsirljive mesecne kartice
  const byMonth = all.reduce<Record<number, typeof all>>((acc, e) => {
    (acc[e.month] ||= []).push(e)
    return acc
  }, {})
  const monthsWithData = Object.keys(byMonth).map(Number).sort((a, b) => a - b)

  const toggleMonth = (m: number) => setOpenMonths((prev) => ({ ...prev, [m]: !prev[m] }))

  const refresh = () => mutate(key)

  async function handleAdd() {
    const amount = parseFloat(newAmount)
    if (!newDesc.trim() || isNaN(amount) || !newDate) return
    setSaving(true)
    await addMarketingExpense(newDate, newDesc.trim(), amount, category, newMethod)
    setNewDesc('')
    setNewAmount('')
    setNewMethod('cash')
    setNewDate(defaultDate(year, month))
    setSaving(false)
    refresh()
  }

  function startEdit(id: string, date: string | null, desc: string, amount: number, method: string | null) {
    setEditId(id)
    setEditDate(date || defaultDate(year, month))
    setEditDesc(desc)
    setEditAmount(String(amount))
    setEditMethod(method || 'cash')
  }

  async function handleSaveEdit(id: string) {
    const amount = parseFloat(editAmount)
    if (!editDesc.trim() || isNaN(amount) || !editDate) return
    await updateMarketingExpense(id, editDate, editDesc.trim(), amount, editMethod)
    setEditId(null)
    refresh()
  }

  async function handleDelete(id: string) {
    await deleteMarketingExpense(id)
    refresh()
  }

  return (
    <div className="space-y-6">
      {view === 'expenses' && (
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-[#c59b5b] flex items-center gap-2">
            <Megaphone className="h-5 w-5" />
            Stroški
          </h2>
          <p className="text-white/50 text-sm mt-1">
            Vpišite posamezne stroške ({activeCat.label.toLowerCase()}). <strong className="text-white/70">Datum določa, v kateri mesec se strošek knjiži.</strong> Spodaj so prikazani vsi vnosi za leto {year}; v Pregledu se upošteva vsota izbranega meseca.
          </p>
        </div>
        <div className="flex gap-3">
          <div className="rounded-2xl bg-[#c59b5b]/10 border border-[#c59b5b]/30 px-5 py-3 text-right">
            <div className="text-[11px] uppercase tracking-wider text-white/50">{MONTH_NAMES[month - 1]} {year}</div>
            <div className="text-2xl font-bold text-[#c59b5b]">{formatEur(monthTotal)}</div>
          </div>
          <div className="rounded-2xl bg-white/[0.03] border border-white/10 px-5 py-3 text-right">
            <div className="text-[11px] uppercase tracking-wider text-white/50">Skupaj leto {year}</div>
            <div className="text-2xl font-bold text-white/80">{formatEur(yearTotal)}</div>
          </div>
        </div>
      </div>
      )}

      {/* Category sub-toggle */}
      <div className="flex gap-1 rounded-xl bg-white/5 p-1 w-fit flex-wrap">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => { setCategory(c.id); setView('expenses'); setEditId(null) }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              view === 'expenses' && category === c.id ? 'bg-[#c59b5b]/20 text-[#c59b5b]' : 'text-white/50 hover:text-white/80'
            }`}
          >
            {c.label}
          </button>
        ))}
        <button
          onClick={() => { setView('archive'); setEditId(null) }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
            view === 'archive' ? 'bg-[#c59b5b]/20 text-[#c59b5b]' : 'text-white/50 hover:text-white/80'
          }`}
        >
          Stroški arhiv
        </button>
        <button
          onClick={() => { setView('hnatura'); setEditId(null) }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
            view === 'hnatura' ? 'bg-[#c59b5b]/20 text-[#c59b5b]' : 'text-white/50 hover:text-white/80'
          }`}
        >
          Vračilo Hnatura d.o.o.
        </button>
      </div>

      {view === 'archive' ? (
        <StroskiArhivTab year={year} month={month} />
      ) : view === 'hnatura' ? (
        <VraciloHnaturaTab year={year} month={month} />
      ) : (
      <>
      {/* Add new */}
      <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-5">
        <h3 className="text-sm font-medium text-white/60 uppercase tracking-wider mb-4">Dodaj strošek</h3>
        <div className="flex items-end gap-3 flex-wrap">
          <div className="w-44">
            <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">Datum</label>
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-[#c59b5b]/40 focus:outline-none"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">Opis</label>
            <input
              type="text"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder={activeCat.placeholder}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-[#c59b5b]/40 focus:outline-none"
            />
          </div>
          <div className="w-40">
            <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">Znesek (EUR)</label>
            <input
              type="number"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white text-right focus:border-[#c59b5b]/40 focus:outline-none"
            />
          </div>
          <div className="w-44">
            <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">Način plačila</label>
            <select
              value={newMethod}
              onChange={(e) => setNewMethod(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-[#c59b5b]/40 focus:outline-none [color-scheme:dark]"
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleAdd}
            disabled={saving || !newDesc.trim() || !newAmount || !newDate}
            className="flex items-center gap-2 rounded-xl bg-[#c59b5b]/20 px-5 py-3 text-sm font-medium text-[#c59b5b] border border-[#c59b5b]/30 transition-colors hover:bg-[#c59b5b]/30 disabled:opacity-40"
          >
            <Plus className="h-4 w-4" />
            Dodaj
          </button>
        </div>
      </div>

      {/* List grouped by month */}
      {isLoading ? (
        <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-8 text-center text-white/40 text-sm">Nalaganje...</div>
      ) : all.length === 0 ? (
        <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-8 text-center text-white/40 text-sm">
          Za leto {year} še ni vnesenih stroškov ({activeCat.label.toLowerCase()}).
        </div>
      ) : (
        <div className="space-y-3">
          {monthsWithData.map((m) => {
            const rows = byMonth[m]
            const mTotal = rows.reduce((s, e) => s + Number(e.amount), 0)
            const isOpen = !!openMonths[m]
            const isCurrent = m === month
            return (
              <div
                key={m}
                className={`rounded-2xl border overflow-hidden ${isCurrent ? 'border-[#c59b5b]/30 bg-[#c59b5b]/[0.04]' : 'border-white/10 bg-white/[0.03]'}`}
              >
                <button
                  onClick={() => toggleMonth(m)}
                  className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-white/[0.03]"
                  aria-expanded={isOpen}
                >
                  <span className="flex items-center gap-2">
                    {isOpen ? <ChevronDown className="h-4 w-4 text-white/40" /> : <ChevronRight className="h-4 w-4 text-white/40" />}
                    <span className={`text-sm font-medium capitalize ${isCurrent ? 'text-[#c59b5b]' : 'text-white/80'}`}>
                      {MONTH_NAMES[m - 1]} {year}
                    </span>
                    <span className="text-xs text-white/40">({rows.length})</span>
                  </span>
                  <span className={`text-base font-bold ${isCurrent ? 'text-[#c59b5b]' : 'text-white'}`}>{formatEur(mTotal)}</span>
                </button>

                {isOpen && (
                  <table className="w-full border-t border-white/10">
                    <thead>
                      <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-wider text-white/40">
                        <th className="px-5 py-2 font-medium w-32">Datum</th>
                        <th className="px-5 py-2 font-medium">Opis</th>
                        <th className="px-5 py-2 font-medium w-40">Način</th>
                        <th className="px-5 py-2 font-medium text-right">Znesek</th>
                        <th className="px-5 py-2 font-medium text-right w-28">Dejanja</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((e) => (
                        <tr key={e.id} className="border-b border-white/5 last:border-0">
                          {editId === e.id ? (
                            <>
                              <td className="px-5 py-3">
                                <input
                                  type="date"
                                  value={editDate}
                                  onChange={(ev) => setEditDate(ev.target.value)}
                                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-[#c59b5b]/40 focus:outline-none"
                                />
                              </td>
                              <td className="px-5 py-3">
                                <input
                                  type="text"
                                  value={editDesc}
                                  onChange={(ev) => setEditDesc(ev.target.value)}
                                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-[#c59b5b]/40 focus:outline-none"
                                />
                              </td>
                              <td className="px-5 py-3">
                                <select
                                  value={editMethod}
                                  onChange={(ev) => setEditMethod(ev.target.value)}
                                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-[#c59b5b]/40 focus:outline-none [color-scheme:dark]"
                                >
                                  {PAYMENT_METHODS.map((m) => (
                                    <option key={m.id} value={m.id}>{m.label}</option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-5 py-3">
                                <input
                                  type="number"
                                  value={editAmount}
                                  onChange={(ev) => setEditAmount(ev.target.value)}
                                  className="w-32 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white text-right focus:border-[#c59b5b]/40 focus:outline-none"
                                />
                              </td>
                              <td className="px-5 py-3">
                                <div className="flex items-center justify-end gap-2">
                                  <button onClick={() => handleSaveEdit(e.id)} className="rounded-lg bg-[#8fae92]/20 p-2 text-[#8fae92] hover:bg-[#8fae92]/30" aria-label="Shrani">
                                    <Check className="h-4 w-4" />
                                  </button>
                                  <button onClick={() => setEditId(null)} className="rounded-lg bg-white/5 p-2 text-white/50 hover:bg-white/10" aria-label="Prekliči">
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="px-5 py-3 text-sm text-white/60">{formatDate(e.date)}</td>
                              <td className="px-5 py-3 text-sm text-white/80">{e.description}</td>
                              <td className="px-5 py-3 text-sm">
                                {e.paymentMethod ? (
                                  <span className="inline-block rounded-md bg-white/5 px-2 py-1 text-xs text-white/70">{PAYMENT_LABELS[e.paymentMethod] || e.paymentMethod}</span>
                                ) : (
                                  <span className="text-white/30">-</span>
                                )}
                              </td>
                              <td className="px-5 py-3 text-sm text-white text-right font-medium">{formatEur(Number(e.amount))}</td>
                              <td className="px-5 py-3">
                                <div className="flex items-center justify-end gap-2">
                                  <button onClick={() => startEdit(e.id, e.date, e.description, Number(e.amount), e.paymentMethod)} className="rounded-lg bg-white/5 p-2 text-white/60 hover:bg-white/10" aria-label="Uredi">
                                    <span className="text-xs">Uredi</span>
                                  </button>
                                  <button onClick={() => handleDelete(e.id)} className="rounded-lg bg-[#cc9f8e]/15 p-2 text-[#cc9f8e] hover:bg-[#cc9f8e]/25" aria-label="Izbriši">
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )
          })}

          <div className="flex justify-between rounded-2xl bg-white/[0.02] border border-white/10 px-5 py-4">
            <span className="text-sm font-medium text-white/60">Skupaj leto {year}</span>
            <span className="text-base font-bold text-[#c59b5b]">{formatEur(yearTotal)}</span>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  )
}
