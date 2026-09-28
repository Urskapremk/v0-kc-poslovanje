'use client'

import React, { useState } from 'react'
import useSWR, { useSWRConfig } from 'swr'
import { Landmark, ChevronDown, ChevronRight, HandCoins, Plus, Trash2, Wallet, Pencil, Check, X } from 'lucide-react'
import { getHnaturaExpensesYear, getHnaturaRepaymentsYear, addHnaturaRepayment, addHnaturaRepaymentCash, updateHnaturaRepayment, deleteHnaturaRepayment, getExchangeRateValue } from '@/app/actions/statistics'

const MONTH_NAMES = ['januar', 'februar', 'marec', 'april', 'maj', 'junij', 'julij', 'avgust', 'september', 'oktober', 'november', 'december']

const CATEGORY_LABELS: Record<string, string> = {
  marketing: 'Marketing',
  booking: 'Booking',
  optimaplus: 'Optima plus',
}

function formatEur(n: number) {
  return new Intl.NumberFormat('sl-SI', { style: 'currency', currency: 'EUR' }).format(n || 0)
}

function formatDate(d: string | null) {
  if (!d) return '-'
  return new Intl.DateTimeFormat('sl-SI', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(d))
}

export default function VraciloHnaturaTab({ year, month }: { year: number; month: number }) {
  const { mutate } = useSWRConfig()
  const expKey = ['hnatura-expenses-year', year]
  const repKey = ['hnatura-repayments-year', year]
  const { data: expenses, isLoading } = useSWR(expKey, () => getHnaturaExpensesYear(year))
  const { data: repayments } = useSWR(repKey, () => getHnaturaRepaymentsYear(year))
  const [openMonths, setOpenMonths] = useState<Record<number, boolean>>({ [month]: true })

  const [newDate, setNewDate] = useState(`${year}-${String(month).padStart(2, '0')}-01`)
  const [newDesc, setNewDesc] = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [saving, setSaving] = useState(false)

  // Gotovinsko vračilo: odštej tudi iz blagajne (znesek se vpiše v Ar).
  const [deductCash, setDeductCash] = useState(false)
  const [cashCompany, setCashCompany] = useState('tourism')
  const [cashAr, setCashAr] = useState('')
  const { data: rate = 4800 } = useSWR('exchange-rate', getExchangeRateValue)
  const cashArNum = Number(cashAr.replace(/[^\d]/g, '')) || 0
  const cashEur = cashArNum > 0 ? Math.round((cashArNum / rate) * 100) / 100 : 0

  const all = expenses || []
  const reps = repayments || []
  const yearTotal = all.reduce((s, e) => s + Number(e.amount), 0)
  const repaidTotal = reps.reduce((s, r) => s + Number(r.amount), 0)
  const remaining = yearTotal - repaidTotal

  const byMonth = all.reduce<Record<number, typeof all>>((acc, e) => {
    (acc[e.month] ||= []).push(e)
    return acc
  }, {})
  const monthsWithData = Object.keys(byMonth).map(Number).sort((a, b) => b - a)
  const repsSorted = [...reps].sort((a, b) => String(b.date).localeCompare(String(a.date)))

  const toggleMonth = (m: number) => setOpenMonths((prev) => ({ ...prev, [m]: !prev[m] }))

  async function handleAdd() {
    if (!newDate) return
    if (deductCash) {
      if (cashArNum <= 0) return
      setSaving(true)
      await addHnaturaRepaymentCash({ date: newDate, description: newDesc.trim(), company: cashCompany, amountAr: cashArNum })
      setCashAr('')
    } else {
      const amount = parseFloat(newAmount)
      if (isNaN(amount) || amount <= 0) return
      setSaving(true)
      await addHnaturaRepayment(newDate, newDesc.trim(), amount)
      setNewAmount('')
    }
    setNewDesc('')
    setNewDate(`${year}-${String(month).padStart(2, '0')}-01`)
    setSaving(false)
    mutate(repKey)
    mutate(['bank-cash-expenses'])
    mutate(['cash-expenses'])
  }

  async function handleDelete(id: string) {
    if (!confirm('Izbrisati to vračilo?')) return
    await deleteHnaturaRepayment(id)
    mutate(repKey)
    mutate(['bank-cash-expenses'])
    mutate(['cash-expenses'])
  }

  // Inline urejanje obstoječega vračila (predvsem za popravek napačnega datuma).
  const [editId, setEditId] = useState<string | null>(null)
  const [editDate, setEditDate] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editAmount, setEditAmount] = useState('')

  function startEdit(r: { id: string; date: string | null; description: string | null; amount: string | number }) {
    setEditId(r.id)
    setEditDate((r.date || '').slice(0, 10))
    setEditDesc(r.description || '')
    setEditAmount(String(Number(r.amount)))
  }

  async function handleSaveEdit(r: { id: string; cashExpenseId?: string | null }) {
    if (!editDate) return
    await updateHnaturaRepayment(r.id, {
      date: editDate,
      description: editDesc.trim(),
      amount: r.cashExpenseId ? undefined : parseFloat(editAmount) || undefined,
    })
    setEditId(null)
    mutate(repKey)
    mutate(['bank-cash-expenses'])
    mutate(['cash-expenses'])
  }

  return (
    <div className="space-y-5">
      {/* Glava */}
      <div>
        <h3 className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-white/60">
          <HandCoins className="h-4 w-4 text-[#c59b5b]" />
          Vračilo Hnatura d.o.o.
        </h3>
        <p className="mt-1 text-xs text-white/40">Stroški, plačani prek Hnatura d.o.o., zmanjšani za že opravljena vračila.</p>
      </div>

      {/* Povzetek: Za vračilo − Že vrnjeno = Preostane še */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4">
          <div className="text-[11px] uppercase tracking-wider text-white/50">Za vračilo — leto {year}</div>
          <div className="mt-1 text-xl font-bold text-white/80">{formatEur(yearTotal)}</div>
        </div>
        <div className="rounded-2xl border border-[#8fae92]/25 bg-[#8fae92]/10 px-5 py-4">
          <div className="text-[11px] uppercase tracking-wider text-white/50">Že vrnjeno</div>
          <div className="mt-1 text-xl font-bold text-[#8fae92]">− {formatEur(repaidTotal)}</div>
        </div>
        <div className="rounded-2xl border border-[#c59b5b]/30 bg-[#c59b5b]/10 px-5 py-4">
          <div className="text-[11px] uppercase tracking-wider text-white/50">Preostane še</div>
          <div className={`mt-1 text-xl font-bold ${remaining <= 0 ? 'text-[#8fae92]' : 'text-[#c59b5b]'}`}>{formatEur(remaining)}</div>
        </div>
      </div>

      {/* Vračila: obrazec + seznam */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <h4 className="text-[11px] font-medium uppercase tracking-wider text-white/50">Opravljena vračila (nakazila)</h4>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="w-40">
            <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">Datum</label>
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-[#c59b5b]/40 focus:outline-none [color-scheme:dark]"
            />
          </div>
          <div className="min-w-[220px] flex-1">
            <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">Opis</label>
            <input
              type="text"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="npr. Prenos sredstev Komba Cabana"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-[#c59b5b]/40 focus:outline-none"
            />
          </div>
          {deductCash ? (
            <>
              <div className="w-36">
                <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">Blagajna</label>
                <select
                  value={cashCompany}
                  onChange={(e) => setCashCompany(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-[#c59b5b]/40 focus:outline-none [color-scheme:dark]"
                >
                  <option value="tourism">Tourism</option>
                  <option value="sarl">SARL</option>
                </select>
              </div>
              <div className="w-44">
                <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">Znesek (Ar)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={cashAr}
                  onChange={(e) => setCashAr(e.target.value)}
                  placeholder="npr. 42000"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white text-right focus:border-[#c59b5b]/40 focus:outline-none"
                />
              </div>
            </>
          ) : (
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
          )}
          <button
            onClick={handleAdd}
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-[#c59b5b] px-5 py-3 text-sm font-medium text-[#1a1410] transition-colors hover:bg-[#d4aa6a] disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Dodaj
          </button>
        </div>

        {/* Možnost: odštej tudi iz gotovinske blagajne */}
        <label className="mt-3 flex w-fit cursor-pointer items-center gap-2 text-sm text-white/70">
          <input
            type="checkbox"
            checked={deductCash}
            onChange={(e) => setDeductCash(e.target.checked)}
            className="h-4 w-4 accent-[#c59b5b]"
          />
          <Wallet className="h-4 w-4 text-[#c59b5b]" />
          Odštej tudi iz gotovinske blagajne (vpiši znesek v Ar)
        </label>
        {deductCash && cashArNum > 0 && (
          <p className="mt-1.5 text-xs text-white/50">
            V blagajni <span className="font-medium text-white/70">{cashCompany === 'sarl' ? 'SARL' : 'Tourism'}</span> se odšteje{' '}
            <span className="font-semibold text-[#c59b5b]">{new Intl.NumberFormat('sl-SI').format(cashArNum)} Ar</span>
            {' → '}vračilo <span className="font-semibold text-[#8fae92]">{formatEur(cashEur)}</span> (tečaj {new Intl.NumberFormat('sl-SI').format(rate)})
          </p>
        )}

        {repsSorted.length > 0 && (
          <div className="mt-4 overflow-hidden rounded-xl border border-white/[0.06]">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-white/40">
                  <th className="px-5 py-2 font-medium w-32">Datum</th>
                  <th className="px-5 py-2 font-medium">Opis</th>
                  <th className="px-5 py-2 font-medium text-right">Znesek</th>
                  <th className="px-5 py-2 font-medium text-right w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {repsSorted.map((r) => (
                  editId === r.id ? (
                    <tr key={r.id} className="bg-white/[0.03]">
                      <td className="px-5 py-3">
                        <input
                          type="date"
                          value={editDate}
                          onChange={(e) => setEditDate(e.target.value)}
                          className="w-full rounded-lg border border-[#c59b5b]/40 bg-white/5 px-2 py-1.5 text-sm text-white focus:outline-none [color-scheme:dark]"
                        />
                      </td>
                      <td className="px-5 py-3">
                        <input
                          type="text"
                          value={editDesc}
                          onChange={(e) => setEditDesc(e.target.value)}
                          placeholder="Opis"
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white focus:border-[#c59b5b]/40 focus:outline-none"
                        />
                        {r.cashExpenseId && (
                          <span className="mt-1 inline-flex items-center gap-1 text-[10px] text-white/40">
                            <Wallet className="h-3 w-3" /> znesek je vezan na blagajno {r.cashCompany === 'sarl' ? 'SARL' : 'Tourism'}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {r.cashExpenseId ? (
                          <span className="text-sm text-[#8fae92] font-medium">{formatEur(Number(r.amount))}</span>
                        ) : (
                          <input
                            type="number"
                            value={editAmount}
                            onChange={(e) => setEditAmount(e.target.value)}
                            className="w-24 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white text-right focus:border-[#c59b5b]/40 focus:outline-none"
                          />
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => handleSaveEdit(r)} className="rounded-lg bg-[#8fae92]/15 p-2 text-[#8fae92] hover:bg-[#8fae92]/25" aria-label="Shrani">
                            <Check className="h-4 w-4" />
                          </button>
                          <button onClick={() => setEditId(null)} className="rounded-lg bg-white/5 p-2 text-white/50 hover:bg-white/10" aria-label="Prekliči">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={r.id}>
                      <td className="px-5 py-3 text-sm text-white/60">{formatDate(r.date)}</td>
                      <td className="px-5 py-3 text-sm text-white/80">
                        {r.description || '-'}
                        {r.cashExpenseId && (
                          <span className="ml-2 inline-flex items-center gap-1 rounded-md border border-[#c59b5b]/30 bg-[#c59b5b]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#c59b5b] align-middle">
                            <Wallet className="h-3 w-3" /> iz blagajne {r.cashCompany === 'sarl' ? 'SARL' : 'Tourism'}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-sm text-[#8fae92] text-right font-medium">{formatEur(Number(r.amount))}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => startEdit(r)} className="rounded-lg bg-white/5 p-2 text-white/50 hover:bg-[#c59b5b]/20 hover:text-[#c59b5b]" aria-label="Uredi vračilo">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button onClick={() => handleDelete(r.id)} className="rounded-lg bg-white/5 p-2 text-white/50 hover:bg-red-500/20 hover:text-red-400" aria-label="Izbriši vračilo">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Stroški po mesecih */}
      {isLoading ? (
        <p className="text-sm text-white/40">Nalagam...</p>
      ) : monthsWithData.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-12 text-center">
          <Landmark className="mx-auto h-8 w-8 text-white/20" />
          <p className="mt-3 text-sm text-white/50">Za leto {year} ni stroškov, plačanih prek Hnatura d.o.o.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {monthsWithData.map((m) => {
            const items = byMonth[m]
            const monthTotal = items.reduce((s, e) => s + Number(e.amount), 0)
            const open = openMonths[m]
            return (
              <div key={m} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
                <button
                  onClick={() => toggleMonth(m)}
                  className="flex w-full items-center justify-between px-5 py-4 transition-colors hover:bg-white/[0.03]"
                >
                  <span className="flex items-center gap-2 text-sm font-medium capitalize text-white">
                    {open ? <ChevronDown className="h-4 w-4 text-white/40" /> : <ChevronRight className="h-4 w-4 text-white/40" />}
                    {MONTH_NAMES[m - 1]} {year}
                    <span className="ml-1 rounded-md bg-white/10 px-2 py-0.5 text-[11px] text-white/50">{items.length}</span>
                  </span>
                  <span className="text-sm font-semibold text-[#c59b5b]">{formatEur(monthTotal)}</span>
                </button>

                {open && (
                  <div className="border-t border-white/[0.06]">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-[11px] uppercase tracking-wider text-white/40">
                          <th className="px-5 py-2 font-medium w-32">Datum</th>
                          <th className="px-5 py-2 font-medium">Opis</th>
                          <th className="px-5 py-2 font-medium w-32">Kategorija</th>
                          <th className="px-5 py-2 font-medium text-right">Znesek</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.06]">
                        {items.map((e) => (
                          <tr key={e.id}>
                            <td className="px-5 py-3 text-sm text-white/60">{formatDate(e.date)}</td>
                            <td className="px-5 py-3 text-sm text-white/80">{e.description}</td>
                            <td className="px-5 py-3 text-sm">
                              <span className="inline-block rounded-md bg-white/5 px-2 py-1 text-xs text-white/70">{CATEGORY_LABELS[e.category] || e.category}</span>
                            </td>
                            <td className="px-5 py-3 text-sm text-white text-right font-medium">{formatEur(Number(e.amount))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
