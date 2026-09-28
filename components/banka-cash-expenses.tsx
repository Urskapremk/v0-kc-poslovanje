'use client'

import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import useSWR from 'swr'
import { Banknote, Plus, Trash2, Pencil, Check, X, ChevronDown, ChevronRight, Wallet, ArrowDownLeft, ArrowUpRight, BookText, Users } from 'lucide-react'
import {
  getCashExpenses, addCashExpense, updateCashExpense, deleteCashExpense,
  getCashIncome, addCashIncome, updateCashIncome, deleteCashIncome,
  type BankCompany, type CashExpense, type CashIncome,
} from '@/app/actions/banka'

const MONTHS_SL = ['januar', 'februar', 'marec', 'april', 'maj', 'junij', 'julij', 'avgust', 'september', 'oktober', 'november', 'december']

function monthLabel(ym: string) {
  const [y, m] = ym.split('-')
  return `${MONTHS_SL[parseInt(m, 10) - 1] ?? m} ${y}`
}

function formatDate(d: string) {
  const parts = d.split('-')
  if (parts.length === 3) return `${parts[2]}. ${parts[1]}. ${parts[0]}`
  return d
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

export default function BankaCashExpenses({
  company, companyLabel, year, currency, withdrawalsByMonth, withdrawals, onClose,
}: {
  company: BankCompany
  companyLabel: string
  year: number
  currency: string
  withdrawalsByMonth: Record<string, number>
  withdrawals: { date: string; amount: number; description: string }[]
  onClose: () => void
}) {
  const cur = currency === 'Ar' ? 'Ar' : '€'
  const fmt = (v: number) =>
    `${new Intl.NumberFormat('sl-SI', { minimumFractionDigits: cur === 'Ar' ? 0 : 2, maximumFractionDigits: cur === 'Ar' ? 0 : 2 }).format(v)} ${cur}`

  const { data, mutate } = useSWR(['cash-expenses', company, year], () => getCashExpenses(company, year))
  const list = data ?? []

  // Prilivi gotovine v blagajno (npr. gotovina strank)
  const { data: incomeData, mutate: mutateIncome } = useSWR(['cash-income', company, year], () => getCashIncome(company, year))
  const incomeList = incomeData ?? []

  // Obrazec za dodajanje
  const [nDir, setNDir] = useState<'in' | 'out'>('out')
  const [nDate, setNDate] = useState(todayIso())
  const [nPurpose, setNPurpose] = useState('')
  const [nAmount, setNAmount] = useState('')
  const [saving, setSaving] = useState(false)

  // Urejanje priliva
  const [editIncomeId, setEditIncomeId] = useState<string | null>(null)
  const [iDate, setIDate] = useState('')
  const [iSource, setISource] = useState('')
  const [iAmount, setIAmount] = useState('')
  const [confirmDeleteIncome, setConfirmDeleteIncome] = useState<string | null>(null)

  // Urejanje
  const [editId, setEditId] = useState<string | null>(null)
  const [eDate, setEDate] = useState('')
  const [ePurpose, setEPurpose] = useState('')
  const [eAmount, setEAmount] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  // Odprti meseci (privzeto vsi odprti)
  const [openMonths, setOpenMonths] = useState<Record<string, boolean>>({})

  const total = list.reduce((s, e) => s + Number(e.amount), 0)

  // Grupiranje: mesec -> dan -> postavke
  const monthMap = new Map<string, CashExpense[]>()
  for (const e of list) {
    const ym = e.date.slice(0, 7)
    if (!monthMap.has(ym)) monthMap.set(ym, [])
    monthMap.get(ym)!.push(e)
  }
  const months = [...monthMap.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)) // najnovejši zgoraj

  // --- Blagajniški dnevnik: združi dvige (priliv) in gotovinska plačila (odliv), kronološko ---
  const [view, setView] = useState<'monthly' | 'journal'>('monthly')

  type JournalEntry = { date: string; label: string; kind: 'in' | 'out'; amount: number; seq: number }
  const journalRaw: JournalEntry[] = [
    ...withdrawals.map((w, i) => ({ date: w.date, label: w.description, kind: 'in' as const, amount: w.amount, seq: i })),
    ...incomeList.map((e, i) => ({ date: e.date, label: e.source || 'Gotovina stranke', kind: 'in' as const, amount: Number(e.amount), seq: 500 + i })),
    ...list.map((e, i) => ({ date: e.date, label: e.purpose || 'Gotovinsko plačilo', kind: 'out' as const, amount: Number(e.amount), seq: 1000 + i })),
  ]
  // Sortiraj po datumu naraščajoče; znotraj istega dne najprej dvig (priliv), nato plačila
  journalRaw.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1
    if (a.kind !== b.kind) return a.kind === 'in' ? -1 : 1
    return a.seq - b.seq
  })
  // Tekoči saldo v blagajni
  let runningTill = 0
  const journal = journalRaw.map((j) => {
    runningTill += j.kind === 'in' ? j.amount : -j.amount
    return { ...j, balance: runningTill }
  })
  const totalWithdrawn = withdrawals.reduce((s, w) => s + w.amount, 0)
  const totalIncome = incomeList.reduce((s, e) => s + Number(e.amount), 0)
  const tillBalance = totalWithdrawn + totalIncome - total

  // Dnevnik grupiran po mesecih (najnovejši zgoraj), znotraj meseca kronološko naraščajoče
  const journalMonthMap = new Map<string, typeof journal>()
  for (const j of journal) {
    const ym = j.date.slice(0, 7)
    if (!journalMonthMap.has(ym)) journalMonthMap.set(ym, [])
    journalMonthMap.get(ym)!.push(j)
  }
  const journalMonths = [...journalMonthMap.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1))

  async function handleAdd() {
    if (!nDate || !nAmount) return
    setSaving(true)
    if (nDir === 'in') {
      await addCashIncome({ company, date: nDate, source: nPurpose.trim(), amount: parseFloat(nAmount) || 0 })
      mutateIncome()
    } else {
      await addCashExpense({ company, date: nDate, purpose: nPurpose.trim(), amount: parseFloat(nAmount) || 0 })
      mutate()
    }
    setNPurpose('')
    setNAmount('')
    setSaving(false)
  }

  function startEditIncome(e: CashIncome) {
    setEditIncomeId(e.id)
    setIDate(e.date)
    setISource(e.source)
    setIAmount(String(e.amount))
    setConfirmDeleteIncome(null)
  }
  async function saveEditIncome(id: string) {
    await updateCashIncome(id, { date: iDate, source: iSource.trim(), amount: parseFloat(iAmount) || 0 })
    setEditIncomeId(null)
    mutateIncome()
  }
  async function removeIncome(id: string) {
    if (confirmDeleteIncome !== id) {
      setConfirmDeleteIncome(id)
      setTimeout(() => setConfirmDeleteIncome((c) => (c === id ? null : c)), 4000)
      return
    }
    await deleteCashIncome(id)
    setConfirmDeleteIncome(null)
    mutateIncome()
  }

  function startEdit(e: CashExpense) {
    setEditId(e.id)
    setEDate(e.date)
    setEPurpose(e.purpose)
    setEAmount(String(e.amount))
    setConfirmDelete(null)
  }
  async function saveEdit(id: string) {
    await updateCashExpense(id, { date: eDate, purpose: ePurpose.trim(), amount: parseFloat(eAmount) || 0 })
    setEditId(null)
    mutate()
  }
  async function remove(id: string) {
    if (confirmDelete !== id) {
      setConfirmDelete(id)
      setTimeout(() => setConfirmDelete((c) => (c === id ? null : c)), 4000)
      return
    }
    await deleteCashExpense(id)
    setConfirmDelete(null)
    mutate()
  }

  function toggleMonth(ym: string) {
    setOpenMonths((p) => ({ ...p, [ym]: !p[ym] }))
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="flex max-h-[92vh] w-full flex-col rounded-t-2xl border border-white/10 bg-[#0b2731] sm:max-w-3xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glava */}
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#d9a68f]/15 text-[#d9a68f]">
            <Banknote className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-white">Plačila gotovinskih stroškov</h3>
            <p className="truncate text-xs text-white/40">{companyLabel} · {year}</p>
          </div>
          <span className="ml-auto rounded-lg bg-[#d9a68f]/10 px-2.5 py-1 text-xs font-bold tabular-nums text-[#d9a68f]">{fmt(total)}</span>
          <button onClick={onClose} className="rounded-lg p-2 text-white/40 hover:bg-white/5 hover:text-white" title="Zapri">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Obrazec za dodajanje */}
        <div className="border-b border-white/10 bg-white/[0.02] px-5 py-3">
          <div className="mb-2 flex gap-0.5 rounded-lg bg-white/5 p-0.5 w-fit">
            <button type="button" onClick={() => setNDir('out')}
              className={`rounded-md px-3 py-1 text-[11px] font-medium ${nDir === 'out' ? 'bg-[#8fae92]/20 text-[#8fae92]' : 'text-white/40 hover:text-white/70'}`}>Odliv (poraba)</button>
            <button type="button" onClick={() => setNDir('in')}
              className={`rounded-md px-3 py-1 text-[11px] font-medium ${nDir === 'in' ? 'bg-[#7fa8b8]/20 text-[#7fa8b8]' : 'text-white/40 hover:text-white/70'}`}>Priliv (gotovina strank)</button>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/40">Datum</label>
              <input type="date" value={nDate} onChange={(e) => setNDate(e.target.value)}
                className="w-36 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white [color-scheme:dark] focus:border-[#c59b5b]/40 focus:outline-none" />
            </div>
            <div className="min-w-[140px] flex-1">
              <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/40">{nDir === 'in' ? 'Vir / opis' : 'Postavka / namen'}</label>
              <input type="text" value={nPurpose} onChange={(e) => setNPurpose(e.target.value)} placeholder={nDir === 'in' ? 'npr. Gost — gotovina' : 'npr. Tržnica, Čoln, Voznik…'}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleAdd() }}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white focus:border-[#c59b5b]/40 focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/40">Znesek ({cur})</label>
              <input type="number" value={nAmount} onChange={(e) => setNAmount(e.target.value)} placeholder="0"
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleAdd() }}
                className="w-28 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-right text-xs text-white focus:border-[#c59b5b]/40 focus:outline-none" />
            </div>
            <button onClick={handleAdd} disabled={saving || !nDate || !nAmount}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium disabled:opacity-40 ${nDir === 'in' ? 'bg-[#7fa8b8]/15 text-[#7fa8b8] hover:bg-[#7fa8b8]/25' : 'bg-[#d9a68f]/15 text-[#d9a68f] hover:bg-[#d9a68f]/25'}`}>
              <Plus className="h-3.5 w-3.5" /> Dodaj
            </button>
          </div>
        </div>

        {/* Povzetek blagajne + preklopnik pogleda */}
        <div className="border-b border-white/10 bg-white/[0.02] px-5 py-3">
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-lg border border-[#d9a68f]/20 bg-[#d9a68f]/[0.06] p-2.5">
              <div className="mb-0.5 flex items-center gap-1 text-[#d9a68f]"><ArrowDownLeft className="h-3.5 w-3.5" /><span className="text-[10px] uppercase tracking-wider">Dvigi gotovine</span></div>
              <p className="text-sm font-bold tabular-nums text-white">{fmt(totalWithdrawn)}</p>
            </div>
            <div className="rounded-lg border border-[#7fa8b8]/20 bg-[#7fa8b8]/[0.06] p-2.5">
              <div className="mb-0.5 flex items-center gap-1 text-[#7fa8b8]"><Users className="h-3.5 w-3.5" /><span className="text-[10px] uppercase tracking-wider">Gotovina strank</span></div>
              <p className="text-sm font-bold tabular-nums text-white">{fmt(totalIncome)}</p>
            </div>
            <div className="rounded-lg border border-[#8fae92]/20 bg-[#8fae92]/[0.06] p-2.5">
              <div className="mb-0.5 flex items-center gap-1 text-[#8fae92]"><ArrowUpRight className="h-3.5 w-3.5" /><span className="text-[10px] uppercase tracking-wider">Porabljeno</span></div>
              <p className="text-sm font-bold tabular-nums text-white">{fmt(total)}</p>
            </div>
            <div className="rounded-lg border border-[#c59b5b]/30 bg-[#c59b5b]/10 p-2.5">
              <div className="mb-0.5 flex items-center gap-1 text-[#c59b5b]"><Wallet className="h-3.5 w-3.5" /><span className="text-[10px] uppercase tracking-wider">Saldo v blagajni</span></div>
              <p className={`text-sm font-bold tabular-nums ${tillBalance < 0 ? 'text-[#c98f7d]' : 'text-[#c59b5b]'}`}>{fmt(tillBalance)}</p>
            </div>
          </div>
          <div className="flex gap-0.5 rounded-lg bg-white/5 p-0.5">
            <button onClick={() => setView('monthly')}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium ${view === 'monthly' ? 'bg-[#d9a68f]/20 text-[#d9a68f]' : 'text-white/50 hover:text-white'}`}>
              <Banknote className="h-3.5 w-3.5" /> Po mesecih
            </button>
            <button onClick={() => setView('journal')}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium ${view === 'journal' ? 'bg-[#c59b5b]/20 text-[#c59b5b]' : 'text-white/50 hover:text-white'}`}>
              <BookText className="h-3.5 w-3.5" /> Blagajniški dnevnik
            </button>
          </div>
        </div>

        {/* Seznam po mesecih */}
        {view === 'monthly' && (
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* Prilivi gotovine (stranke) */}
          {incomeList.length > 0 && (
            <div className="mb-4 overflow-hidden rounded-xl border border-[#7fa8b8]/20 bg-[#7fa8b8]/[0.04]">
              <div className="flex items-center gap-2 border-b border-[#7fa8b8]/15 px-4 py-2.5">
                <Users className="h-4 w-4 text-[#7fa8b8]" />
                <span className="text-sm font-semibold text-white">Prilivi gotovine — stranke</span>
                <span className="ml-auto text-sm font-bold tabular-nums text-[#7fa8b8]">{fmt(totalIncome)}</span>
              </div>
              <div className="divide-y divide-white/[0.04] px-4 py-1">
                {incomeList.map((e) => (
                  <div key={e.id} className="py-2">
                    {editIncomeId === e.id ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <input type="date" value={iDate} onChange={(ev) => setIDate(ev.target.value)}
                          className="w-32 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white [color-scheme:dark] focus:border-[#c59b5b]/40 focus:outline-none" />
                        <input type="text" value={iSource} onChange={(ev) => setISource(ev.target.value)}
                          className="min-w-[120px] flex-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white focus:border-[#c59b5b]/40 focus:outline-none" />
                        <input type="number" value={iAmount} onChange={(ev) => setIAmount(ev.target.value)}
                          className="w-24 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-right text-xs text-white focus:border-[#c59b5b]/40 focus:outline-none" />
                        <button onClick={() => saveEditIncome(e.id)} className="rounded-lg bg-[#8fae92]/15 p-1.5 text-[#8fae92] hover:bg-[#8fae92]/25" title="Shrani"><Check className="h-3.5 w-3.5" /></button>
                        <button onClick={() => setEditIncomeId(null)} className="rounded-lg bg-white/5 p-1.5 text-white/40 hover:bg-white/10 hover:text-white" title="Prekliči"><X className="h-3.5 w-3.5" /></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <span className="w-20 shrink-0 text-xs text-[#c59b5b]">{formatDate(e.date)}</span>
                        <span className="min-w-0 flex-1 truncate text-sm text-white/80">{e.source || 'Gotovina stranke'}</span>
                        <span className="text-sm font-medium tabular-nums text-[#7fa8b8]">+ {fmt(Number(e.amount))}</span>
                        <button onClick={() => startEditIncome(e)} className="rounded-lg p-1.5 text-white/30 hover:bg-white/5 hover:text-white" title="Uredi"><Pencil className="h-3.5 w-3.5" /></button>
                        <button onClick={() => removeIncome(e.id)}
                          className={`rounded-lg p-1.5 transition-colors ${confirmDeleteIncome === e.id ? 'bg-[#c98f7d]/20 text-[#c98f7d]' : 'text-white/30 hover:bg-white/5 hover:text-[#c98f7d]'}`}
                          title={confirmDeleteIncome === e.id ? 'Klikni še enkrat za izbris' : 'Izbriši'}>
                          {confirmDeleteIncome === e.id ? <span className="px-1 text-[11px] font-medium">Izbriši?</span> : <Trash2 className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {list.length === 0 ? (
            incomeList.length === 0 ? (
            <p className="py-10 text-center text-sm text-white/30">Ni vpisanih gotovinskih stroškov za {year}. Dodaj prvo postavko zgoraj.</p>
            ) : null
          ) : (
            <div className="space-y-3">
              {months.map(([ym, items]) => {
                const isOpen = openMonths[ym] ?? true
                const mTotal = items.reduce((s, e) => s + Number(e.amount), 0)
                const withdrawn = withdrawalsByMonth[ym] ?? 0
                const diff = withdrawn - mTotal
                // Grupiranje po dnevih (naraščajoče znotraj meseca)
                const dayMap = new Map<string, CashExpense[]>()
                for (const e of items) {
                  if (!dayMap.has(e.date)) dayMap.set(e.date, [])
                  dayMap.get(e.date)!.push(e)
                }
                const days = [...dayMap.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))
                return (
                  <div key={ym} className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
                    <button onClick={() => toggleMonth(ym)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.03]">
                      {isOpen ? <ChevronDown className="h-4 w-4 text-white/40" /> : <ChevronRight className="h-4 w-4 text-white/40" />}
                      <span className="text-sm font-semibold capitalize text-white">{monthLabel(ym)}</span>
                      <span className="text-[11px] text-white/30">{items.length}</span>
                      <span className="ml-auto text-sm font-bold tabular-nums text-[#d9a68f]">{fmt(mTotal)}</span>
                    </button>
                    {isOpen && (
                      <div className="border-t border-white/[0.06] px-4 pb-3">
                        {/* Primerjava z dvigi gotovine */}
                        {withdrawn > 0 && (
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-white/[0.06] py-2.5 text-[11px]">
                            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#d9a68f]" /><span className="text-white/50">Dvigi gotovine</span><span className="font-medium tabular-nums text-[#d9a68f]">{fmt(withdrawn)}</span></span>
                            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#8fae92]" /><span className="text-white/50">Porabljeno</span><span className="font-medium tabular-nums text-[#8fae92]">{fmt(mTotal)}</span></span>
                            <span className="flex items-center gap-1.5"><span className="text-white/50">Razlika</span><span className={`font-medium tabular-nums ${diff >= 0 ? 'text-white/70' : 'text-[#c98f7d]'}`}>{diff >= 0 ? '' : '−'}{fmt(Math.abs(diff))}</span></span>
                          </div>
                        )}
                        {/* Dnevi */}
                        <div className="space-y-3 pt-2">
                          {days.map(([day, dayItems]) => {
                            const dTotal = dayItems.reduce((s, e) => s + Number(e.amount), 0)
                            return (
                              <div key={day}>
                                <div className="mb-1 flex items-center gap-2">
                                  <span className="text-xs font-medium text-[#c59b5b]">{formatDate(day)}</span>
                                  <span className="h-px flex-1 bg-white/[0.06]" />
                                  <span className="text-xs font-semibold tabular-nums text-white/60">{fmt(dTotal)}</span>
                                </div>
                                <div className="divide-y divide-white/[0.04]">
                                  {dayItems.map((e) => (
                                    <div key={e.id} className="py-1.5">
                                      {editId === e.id ? (
                                        <div className="flex flex-wrap items-center gap-2">
                                          <input type="date" value={eDate} onChange={(ev) => setEDate(ev.target.value)}
                                            className="w-32 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white [color-scheme:dark] focus:border-[#c59b5b]/40 focus:outline-none" />
                                          <input type="text" value={ePurpose} onChange={(ev) => setEPurpose(ev.target.value)}
                                            className="min-w-[120px] flex-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white focus:border-[#c59b5b]/40 focus:outline-none" />
                                          <input type="number" value={eAmount} onChange={(ev) => setEAmount(ev.target.value)}
                                            className="w-24 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-right text-xs text-white focus:border-[#c59b5b]/40 focus:outline-none" />
                                          <button onClick={() => saveEdit(e.id)} className="rounded-lg bg-[#8fae92]/15 p-1.5 text-[#8fae92] hover:bg-[#8fae92]/25" title="Shrani"><Check className="h-3.5 w-3.5" /></button>
                                          <button onClick={() => setEditId(null)} className="rounded-lg bg-white/5 p-1.5 text-white/40 hover:bg-white/10 hover:text-white" title="Prekliči"><X className="h-3.5 w-3.5" /></button>
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-3">
                                          <span className="min-w-0 flex-1 truncate text-sm text-white/80">{e.purpose || '—'}</span>
                                          <span className="text-sm tabular-nums text-white/90">{fmt(Number(e.amount))}</span>
                                          <button onClick={() => startEdit(e)} className="rounded-lg p-1.5 text-white/30 hover:bg-white/5 hover:text-white" title="Uredi"><Pencil className="h-3.5 w-3.5" /></button>
                                          <button onClick={() => remove(e.id)}
                                            className={`rounded-lg p-1.5 transition-colors ${confirmDelete === e.id ? 'bg-[#c98f7d]/20 text-[#c98f7d]' : 'text-white/30 hover:bg-white/5 hover:text-[#c98f7d]'}`}
                                            title={confirmDelete === e.id ? 'Klikni še enkrat za izbris' : 'Izbriši'}>
                                            {confirmDelete === e.id ? <span className="px-1 text-[11px] font-medium">Izbriši?</span> : <Trash2 className="h-3.5 w-3.5" />}
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
        )}

        {/* Blagajniški dnevnik */}
        {view === 'journal' && (
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {journal.length === 0 ? (
            <p className="py-10 text-center text-sm text-white/30">Ni prometa v blagajni za {year}.</p>
          ) : (
            <div className="space-y-3">
              {journalMonths.map(([ym, entries]) => {
                const endBal = entries[entries.length - 1]?.balance ?? 0
                return (
                  <div key={ym} className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
                    <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3">
                      <span className="text-sm font-semibold capitalize text-white">{monthLabel(ym)}</span>
                      <span className="ml-auto flex items-center gap-1.5 rounded-lg bg-[#c59b5b]/10 px-2.5 py-1 text-xs">
                        <Wallet className="h-3.5 w-3.5 text-[#c59b5b]" />
                        <span className="text-[10px] uppercase tracking-wider text-[#c59b5b]/60">Saldo ob koncu</span>
                        <span className={`font-bold tabular-nums ${endBal < 0 ? 'text-[#c98f7d]' : 'text-[#c59b5b]'}`}>{fmt(endBal)}</span>
                      </span>
                    </div>
                    {/* Glava stolpcev */}
                    <div className="hidden items-center gap-3 px-4 py-2 text-[10px] uppercase tracking-wider text-white/30 sm:flex">
                      <span className="w-20 shrink-0">Datum</span>
                      <span className="flex-1">Opis</span>
                      <span className="w-28 shrink-0 text-right text-[#d9a68f]">Priliv</span>
                      <span className="w-28 shrink-0 text-right text-[#8fae92]">Odliv</span>
                      <span className="w-28 shrink-0 text-right text-[#c59b5b]">Saldo</span>
                    </div>
                    <div className="divide-y divide-white/[0.04] px-4 pb-2">
                      {entries.map((j, i) => (
                        <div key={i} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 py-2">
                          <span className="w-20 shrink-0 text-xs text-white/50">{formatDate(j.date)}</span>
                          <span className="flex min-w-0 flex-[1_1_100%] items-center gap-1.5 sm:flex-1">
                            {j.kind === 'in'
                              ? <ArrowDownLeft className="h-3.5 w-3.5 shrink-0 text-[#d9a68f]" />
                              : <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-[#8fae92]" />}
                            <span className="truncate text-sm text-white/80">{j.label}</span>
                          </span>
                          <span className="w-28 shrink-0 text-right text-sm tabular-nums text-[#d9a68f]">{j.kind === 'in' ? fmt(j.amount) : ''}</span>
                          <span className="w-28 shrink-0 text-right text-sm tabular-nums text-[#8fae92]">{j.kind === 'out' ? fmt(j.amount) : ''}</span>
                          <span className={`w-28 shrink-0 text-right text-sm font-semibold tabular-nums ${j.balance < 0 ? 'text-[#c98f7d]' : 'text-[#c59b5b]'}`}>{fmt(j.balance)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        )}
      </div>
    </div>,
    document.body
  )
}
