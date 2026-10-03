'use client'

import React, { useState } from 'react'
import useSWR from 'swr'
import {
  Landmark, ArrowDownLeft, ArrowUpRight, Banknote, Users, Plus, Trash2, Pencil, Check, X, Wallet, ChevronDown, ChevronRight, FileText,
} from 'lucide-react'
import { BankaVlogaLetters } from './banka-vloga-letters'
import {
  getBankAccount,
  saveBankAccount,
  getBankTransactions,
  addBankTransaction,
  updateBankTransaction,
  deleteBankTransaction,
  type BankCompany,
  type TxDirection,
  type TxCategory,
} from '@/app/actions/banka'
import BankaCashExpenses from './banka-cash-expenses'

const COMPANY_LABELS: Record<BankCompany, string> = {
  tourism: 'KOMBA CABANA TOURISM SARL',
  sarl: 'KOMBA CABANA SARL',
}

const IN_CATEGORIES: { id: TxCategory; label: string }[] = [
  { id: 'stranka', label: 'Nakazilo stranke' },
  { id: 'ostalo_in', label: 'Ostalo (priliv)' },
]
const OUT_CATEGORIES: { id: TxCategory; label: string }[] = [
  { id: 'dvig', label: 'Dvig gotovine' },
  { id: 'dobavitelj', label: 'Dobavitelji / nakup' },
  { id: 'davki', label: 'Davki' },
  { id: 'vracilo', label: 'Vračilo stranki' },
  { id: 'placilo', label: 'Ostala nakazila' },
  { id: 'banka', label: 'Bančni stroški' },
  { id: 'ostalo_out', label: 'Ostalo (odliv)' },
]

function catLabel(cat: TxCategory): string {
  return [...IN_CATEGORIES, ...OUT_CATEGORIES].find((c) => c.id === cat)?.label ?? cat
}

const CAT_COLORS: Record<TxCategory, string> = {
  stranka: '#7fa8b8',
  ostalo_in: '#8fae92',
  dvig: '#d9a68f',
  dobavitelj: '#d1a979',
  davki: '#bca197',
  vracilo: '#cba79a',
  placilo: '#8ec0d4',
  banka: '#c89c67',
  ostalo_out: '#b1c7cf',
}

// Vrstni red prikaza v razčlembi
const CAT_ORDER: TxCategory[] = ['stranka', 'ostalo_in', 'dvig', 'dobavitelj', 'davki', 'vracilo', 'placilo', 'banka', 'ostalo_out']

const MONTHS_SL = ['januar', 'februar', 'marec', 'april', 'maj', 'junij', 'julij', 'avgust', 'september', 'oktober', 'november', 'december']

function monthLabel(ym: string) {
  const [y, m] = ym.split('-')
  const idx = parseInt(m, 10) - 1
  return `${MONTHS_SL[idx] ?? m} ${y}`
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function formatDate(d: string) {
  const parts = d.split('-')
  if (parts.length === 3) return `${parts[2]}. ${parts[1]}. ${parts[0]}`
  return d
}

export default function BankaTab({ year }: { year: number }) {
  const [company, setCompany] = useState<BankCompany>('tourism')
  const [bankView, setBankView] = useState<'bank' | 'vloga'>('bank')

  const { data: account, mutate: mutateAccount } = useSWR(['bank-account', company], () => getBankAccount(company))
  const { data: txs, mutate: mutateTxs } = useSWR(['bank-txs', company, year], () => getBankTransactions(company, year))

  const cur = account?.currency === 'Ar' ? 'Ar' : '€'
  const fmt = (v: number) =>
    `${new Intl.NumberFormat('sl-SI', { minimumFractionDigits: cur === 'Ar' ? 0 : 2, maximumFractionDigits: cur === 'Ar' ? 0 : 2 }).format(v)} ${cur}`

  // Vsote
  const list = txs ?? []
  const inflows = list.filter((t) => t.direction === 'in')
  const outflows = list.filter((t) => t.direction === 'out')
  const totalIn = inflows.reduce((s, t) => s + Number(t.amount), 0)
  const totalOut = outflows.reduce((s, t) => s + Number(t.amount), 0)
  const clientTransfers = inflows.filter((t) => t.category === 'stranka').reduce((s, t) => s + Number(t.amount), 0)
  const cashWithdrawals = outflows.filter((t) => t.category === 'dvig').reduce((s, t) => s + Number(t.amount), 0)
  const opening = Number(account?.openingBalance ?? 0)
  const balance = opening + totalIn - totalOut

  // Razčlemba po kategorijah (letno)
  const byCategory = CAT_ORDER.map((cat) => {
    const items = list.filter((t) => t.category === cat)
    const sum = items.reduce((s, t) => s + Number(t.amount), 0)
    const dir: TxDirection = cat === 'stranka' || cat === 'ostalo_in' ? 'in' : 'out'
    return { cat, sum, count: items.length, dir }
  }).filter((c) => c.count > 0)

  // Razvrstitev po mesecih (seznam je že sortiran DESC po datumu)
  const monthMap = new Map<string, typeof list>()
  for (const t of list) {
    const ym = t.date.slice(0, 7)
    if (!monthMap.has(ym)) monthMap.set(ym, [])
    monthMap.get(ym)!.push(t)
  }
  const months = [...monthMap.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)) // najnovejši mesec zgoraj

  // Stanje na koncu vsakega meseca (kumulativa od začetnega stanja, po naraščajočem vrstnem redu)
  const endOfMonthBalance = new Map<string, number>()
  {
    const asc = [...months].sort((a, b) => (a[0] < b[0] ? -1 : 1))
    let running = opening
    for (const [ym, items] of asc) {
      const mIn = items.filter((t) => t.direction === 'in').reduce((s, t) => s + Number(t.amount), 0)
      const mOut = items.filter((t) => t.direction === 'out').reduce((s, t) => s + Number(t.amount), 0)
      running = running + mIn - mOut
      endOfMonthBalance.set(ym, running)
    }
  }

  // Dvigi gotovine po mesecih (za primerjavo v porabi gotovine) + posamezne postavke (za blagajniški dnevnik)
  const withdrawalsByMonth: Record<string, number> = {}
  const withdrawals: { date: string; amount: number; description: string }[] = []
  for (const t of outflows.filter((t) => t.category === 'dvig')) {
    const ym = t.date.slice(0, 7)
    withdrawalsByMonth[ym] = (withdrawalsByMonth[ym] ?? 0) + Number(t.amount)
    withdrawals.push({ date: t.date, amount: Number(t.amount), description: t.description || 'Dvig gotovine' })
  }

  const [openMonths, setOpenMonths] = useState<Record<string, boolean>>({})
  function toggleMonth(ym: string) {
    setOpenMonths((prev) => ({ ...prev, [ym]: !prev[ym] }))
  }

  const [showCashExpenses, setShowCashExpenses] = useState(false)

  // --- Urejanje računa (začetno stanje) ---
  const [editAccount, setEditAccount] = useState(false)
  const [accOpening, setAccOpening] = useState('')
  const [accDate, setAccDate] = useState('2026-01-01')
  const [accCurrency, setAccCurrency] = useState<'EUR' | 'Ar'>('EUR')

  function startEditAccount() {
    setAccOpening(String(account?.openingBalance ?? 0))
    setAccDate(account?.openingDate ?? '2026-01-01')
    setAccCurrency(account?.currency === 'Ar' ? 'Ar' : 'EUR')
    setEditAccount(true)
  }
  async function saveAccount() {
    await saveBankAccount({
      company,
      currency: accCurrency,
      openingBalance: parseFloat(accOpening) || 0,
      openingDate: accDate || '2026-01-01',
    })
    setEditAccount(false)
    mutateAccount()
    mutateTxs()
  }

  // --- Nova transakcija ---
  const [txDate, setTxDate] = useState(todayIso())
  const [txDir, setTxDir] = useState<TxDirection>('in')
  const [txCat, setTxCat] = useState<TxCategory>('stranka')
  const [txAmount, setTxAmount] = useState('')
  const [txDesc, setTxDesc] = useState('')
  const [saving, setSaving] = useState(false)

  function switchDir(dir: TxDirection) {
    setTxDir(dir)
    setTxCat(dir === 'in' ? 'stranka' : 'dvig')
  }

  async function addTx() {
    const amt = parseFloat(txAmount) || 0
    if (amt <= 0) return
    setSaving(true)
    try {
      await addBankTransaction({ company, date: txDate, direction: txDir, category: txCat, amount: amt, description: txDesc.trim() })
      setTxAmount('')
      setTxDesc('')
      mutateTxs()
    } finally {
      setSaving(false)
    }
  }

  // --- Urejanje transakcije ---
  const [editId, setEditId] = useState<string | null>(null)
  const [eDate, setEDate] = useState('')
  const [eDir, setEDir] = useState<TxDirection>('in')
  const [eCat, setECat] = useState<TxCategory>('stranka')
  const [eAmount, setEAmount] = useState('')
  const [eDesc, setEDesc] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  function startEditTx(t: (typeof list)[number]) {
    setEditId(t.id)
    setEDate(t.date)
    setEDir(t.direction)
    setECat(t.category)
    setEAmount(String(t.amount))
    setEDesc(t.description)
    setConfirmDelete(null)
  }
  async function saveTx(id: string) {
    await updateBankTransaction(id, {
      date: eDate,
      direction: eDir,
      category: eCat,
      amount: parseFloat(eAmount) || 0,
      description: eDesc.trim(),
    })
    setEditId(null)
    mutateTxs()
  }
  async function removeTx(id: string) {
    if (confirmDelete !== id) {
      setConfirmDelete(id)
      setTimeout(() => setConfirmDelete((c) => (c === id ? null : c)), 4000)
      return
    }
    await deleteBankTransaction(id)
    setConfirmDelete(null)
    mutateTxs()
  }

  function renderTxRow(t: (typeof list)[number]) {
    const isIn = t.direction === 'in'
    const color = isIn ? '#8fae92' : '#c98f7d'
    return (
      <div key={t.id} className="py-3">
        {editId === t.id ? (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-0.5 rounded-lg bg-white/5 p-0.5">
              <button onClick={() => { setEDir('in'); setECat('stranka') }} className={`rounded-md px-2 py-1 text-[11px] font-medium ${eDir === 'in' ? 'bg-[#8fae92]/20 text-[#8fae92]' : 'text-white/40'}`}>Priliv</button>
              <button onClick={() => { setEDir('out'); setECat('dvig') }} className={`rounded-md px-2 py-1 text-[11px] font-medium ${eDir === 'out' ? 'bg-[#c98f7d]/20 text-[#c98f7d]' : 'text-white/40'}`}>Odliv</button>
            </div>
            <input type="date" value={eDate} onChange={(e) => setEDate(e.target.value)}
              className="w-36 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white [color-scheme:dark] focus:border-[#c59b5b]/40 focus:outline-none" />
            <select value={eCat} onChange={(e) => setECat(e.target.value as TxCategory)}
              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white focus:border-[#c59b5b]/40 focus:outline-none">
              {(eDir === 'in' ? IN_CATEGORIES : OUT_CATEGORIES).map((c) => (
                <option key={c.id} value={c.id} className="bg-[#1b282d]">{c.label}</option>
              ))}
            </select>
            <input type="number" value={eAmount} onChange={(e) => setEAmount(e.target.value)}
              className="w-24 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-right text-xs text-white focus:border-[#c59b5b]/40 focus:outline-none" />
            <input type="text" value={eDesc} onChange={(e) => setEDesc(e.target.value)} placeholder="Opis"
              className="min-w-[120px] flex-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white focus:border-[#c59b5b]/40 focus:outline-none" />
            <button onClick={() => saveTx(t.id)} className="rounded-lg bg-[#8fae92]/15 p-2 text-[#8fae92] hover:bg-[#8fae92]/25" title="Shrani"><Check className="h-4 w-4" /></button>
            <button onClick={() => setEditId(null)} className="rounded-lg bg-white/5 p-2 text-white/40 hover:bg-white/10 hover:text-white" title="Prekliči"><X className="h-4 w-4" /></button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `${color}22`, color }}>
              {isIn ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-sm text-white/90">{t.description || catLabel(t.category)}</span>
                <span className="rounded-md px-1.5 py-0.5 text-[10px] font-medium" style={{ backgroundColor: `${CAT_COLORS[t.category]}22`, color: CAT_COLORS[t.category] }}>{catLabel(t.category)}</span>
              </div>
              <p className="text-xs text-white/40">{formatDate(t.date)}</p>
            </div>
            <span className="text-sm font-semibold tabular-nums" style={{ color }}>{isIn ? '+' : '−'} {fmt(Number(t.amount))}</span>
            <button onClick={() => startEditTx(t)} className="rounded-lg p-2 text-white/30 hover:bg-white/5 hover:text-white" title="Uredi"><Pencil className="h-4 w-4" /></button>
            <button onClick={() => removeTx(t.id)}
              className={`rounded-lg p-2 transition-colors ${confirmDelete === t.id ? 'bg-[#c98f7d]/20 text-[#c98f7d]' : 'text-white/30 hover:bg-white/5 hover:text-[#c98f7d]'}`}
              title={confirmDelete === t.id ? 'Klikni še enkrat za izbris' : 'Izbriši'}>
              {confirmDelete === t.id ? <span className="text-[11px] font-medium px-1">Izbriši?</span> : <Trash2 className="h-4 w-4" />}
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Preklop: Banka / Vloga za banko */}
      <div className="no-print flex flex-wrap gap-2">
        <button
          onClick={() => setBankView('bank')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${bankView === 'bank' ? 'bg-[#c59b5b]/20 text-[#c59b5b] border border-[#c59b5b]/30' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}
        >
          <Landmark className="h-4 w-4" /> Banka
        </button>
        <button
          onClick={() => setBankView('vloga')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${bankView === 'vloga' ? 'bg-[#c59b5b]/20 text-[#c59b5b] border border-[#c59b5b]/30' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}
        >
          <FileText className="h-4 w-4" /> Vloga za banko
        </button>
      </div>

      {bankView === 'vloga' && (
        <div>
          <style jsx global>{`
            @media print {
              @page { size: A4; margin: 20mm; }
              body * { visibility: hidden !important; }
              .banka-vloga-print-root, .banka-vloga-print-root * { visibility: visible !important; }
              .banka-vloga-print-root { position: absolute; left: 0; top: 0; width: 100%; }
              .no-print { display: none !important; }
              .letter-page { page-break-after: always; }
              .letter-page:last-child { page-break-after: auto; }
            }
          `}</style>
          <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-sm text-white/60">Dve vlogi za banko (BMOI) — po ena za vsak račun — za odprtje podračunov, s podpisom Borut Retelj.</p>
            <button
              onClick={() => window.print()}
              className="shrink-0 rounded-lg bg-[#576f59] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#485b4a]"
            >
              Natisni vlogi
            </button>
          </div>
          <div className="banka-vloga-print-root space-y-6 rounded-xl bg-white/[0.02] p-4">
            <BankaVlogaLetters />
          </div>
        </div>
      )}

      {bankView === 'bank' && (
      <>
      {/* Izbira podjetja */}
      <div className="flex flex-wrap gap-2">
        {(['tourism', 'sarl'] as BankCompany[]).map((c) => (
          <button
            key={c}
            onClick={() => { setCompany(c); setEditAccount(false); setEditId(null) }}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              company === c ? 'bg-[#c59b5b]/20 text-[#c59b5b] border border-[#c59b5b]/30' : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            <Landmark className="h-4 w-4" />
            {COMPANY_LABELS[c]}
          </button>
        ))}
      </div>

      {/* Kartica računa + začetno stanje */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-white/40">Bančni račun</p>
            <h2 className="text-lg font-bold text-white">{COMPANY_LABELS[company]}</h2>
          </div>
          {!editAccount && (
            <button onClick={startEditAccount} className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs text-white/60 hover:bg-white/10 hover:text-white">
              <Pencil className="h-3.5 w-3.5" /> Uredi začetno stanje
            </button>
          )}
        </div>

        {editAccount ? (
          <div className="space-y-3 rounded-xl border border-[#c59b5b]/20 bg-[#c59b5b]/[0.04] p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1 block text-[11px] uppercase tracking-wider text-white/40">Stanje na dan</label>
                <input type="date" value={accDate} onChange={(e) => setAccDate(e.target.value)}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white [color-scheme:dark] focus:border-[#c59b5b]/40 focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-[11px] uppercase tracking-wider text-white/40">Začetno stanje</label>
                <input type="number" inputMode="decimal" value={accOpening} onChange={(e) => setAccOpening(e.target.value)} placeholder="0.00"
                  className="w-36 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-right text-sm text-white focus:border-[#c59b5b]/40 focus:outline-none" />
              </div>
              <div className="flex gap-1 rounded-lg bg-white/5 p-0.5">
                {(['EUR', 'Ar'] as const).map((c) => (
                  <button key={c} type="button" onClick={() => setAccCurrency(c)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${accCurrency === c ? 'bg-[#c59b5b]/20 text-[#c59b5b]' : 'text-white/40 hover:text-white/70'}`}>
                    {c === 'EUR' ? 'EUR (€)' : 'Ariary (Ar)'}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-white/40">Vpiši celotno stanje na računu na izbrani dan. Prilivi in odlivi se prištevajo/odštevajo od tega stanja.</p>
            <div className="flex gap-2">
              <button onClick={saveAccount} className="flex items-center gap-1.5 rounded-lg bg-[#8fae92]/15 px-3 py-2 text-sm font-medium text-[#8fae92] hover:bg-[#8fae92]/25">
                <Check className="h-4 w-4" /> Shrani
              </button>
              <button onClick={() => setEditAccount(false)} className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-2 text-sm text-white/50 hover:bg-white/10">
                <X className="h-4 w-4" /> Prekliči
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Trenutno stanje */}
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-[#c59b5b]/20 bg-gradient-to-br from-[#c59b5b]/10 to-transparent p-4">
              <Wallet className="h-8 w-8 text-[#c59b5b]" />
              <div>
                <p className="text-[11px] uppercase tracking-wider text-white/50">Trenutno stanje na računu</p>
                <p className="text-3xl font-bold text-[#c59b5b] tabular-nums">{fmt(balance)}</p>
                <p className="text-xs text-white/40">Začetno stanje {fmt(opening)} · {formatDate(account?.openingDate ?? '2026-01-01')}</p>
              </div>
            </div>

            {/* Povzetek prilivov/odlivov */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-[#8fae92]/20 bg-[#8fae92]/[0.06] p-3">
                <div className="mb-1 flex items-center gap-1.5 text-[#8fae92]"><ArrowDownLeft className="h-4 w-4" /><span className="text-[11px] uppercase tracking-wider">Prilivi</span></div>
                <p className="text-lg font-bold text-white tabular-nums">{fmt(totalIn)}</p>
              </div>
              <div className="rounded-xl border border-[#7fa8b8]/20 bg-[#7fa8b8]/[0.06] p-3">
                <div className="mb-1 flex items-center gap-1.5 text-[#7fa8b8]"><Users className="h-4 w-4" /><span className="text-[11px] uppercase tracking-wider">Nakazila strank</span></div>
                <p className="text-lg font-bold text-white tabular-nums">{fmt(clientTransfers)}</p>
              </div>
              <div className="rounded-xl border border-[#c98f7d]/20 bg-[#c98f7d]/[0.06] p-3">
                <div className="mb-1 flex items-center gap-1.5 text-[#c98f7d]"><ArrowUpRight className="h-4 w-4" /><span className="text-[11px] uppercase tracking-wider">Odlivi</span></div>
                <p className="text-lg font-bold text-white tabular-nums">{fmt(totalOut)}</p>
              </div>
              <div className="flex flex-col rounded-xl border border-[#d9a68f]/20 bg-[#d9a68f]/[0.06] p-3">
                <div className="mb-1 flex items-center gap-1.5 text-[#d9a68f]"><Banknote className="h-4 w-4" /><span className="text-[11px] uppercase tracking-wider">Dvigi gotovine</span></div>
                <p className="text-lg font-bold text-white tabular-nums">{fmt(cashWithdrawals)}</p>
                <button onClick={() => setShowCashExpenses(true)}
                  className="mt-2 flex items-center justify-center gap-1.5 rounded-lg bg-[#d9a68f]/15 px-2 py-1.5 text-[11px] font-medium text-[#d9a68f] hover:bg-[#d9a68f]/25">
                  <Banknote className="h-3.5 w-3.5" /> Plačila gotovinskih stroškov
                </button>
              </div>
            </div>

            {/* Razčlemba po kategorijah (letno) */}
            {byCategory.length > 0 && (
              <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <p className="mb-3 text-[11px] uppercase tracking-wider text-white/40">Razčlemba po kategorijah — {year}</p>
                <div className="space-y-2">
                  {byCategory.map((c) => {
                    const color = CAT_COLORS[c.cat]
                    const denom = c.dir === 'in' ? totalIn : totalOut
                    const pct = denom > 0 ? (c.sum / denom) * 100 : 0
                    return (
                      <div key={c.cat} className="flex items-center gap-3">
                        <span className="w-3 shrink-0 text-xs" style={{ color }}>{c.dir === 'in' ? '+' : '−'}</span>
                        <span className="w-36 shrink-0 text-sm text-white/80">{catLabel(c.cat)}</span>
                        <span className="text-[11px] text-white/30">{c.count}×</span>
                        <div className="hidden h-1.5 flex-1 overflow-hidden rounded-full bg-white/5 sm:block">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                        </div>
                        <span className="ml-auto text-sm font-semibold tabular-nums sm:ml-0 sm:w-40 sm:text-right" style={{ color }}>{fmt(c.sum)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Nov priliv / odliv */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <p className="mb-3 text-sm font-medium text-white/70">Dodaj priliv ali odliv</p>
        <div className="mb-3 flex gap-1 rounded-lg bg-white/5 p-0.5 w-fit">
          <button onClick={() => switchDir('in')}
            className={`flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium transition-all ${txDir === 'in' ? 'bg-[#8fae92]/20 text-[#8fae92]' : 'text-white/40 hover:text-white/70'}`}>
            <ArrowDownLeft className="h-4 w-4" /> Priliv
          </button>
          <button onClick={() => switchDir('out')}
            className={`flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium transition-all ${txDir === 'out' ? 'bg-[#c98f7d]/20 text-[#c98f7d]' : 'text-white/40 hover:text-white/70'}`}>
            <ArrowUpRight className="h-4 w-4" /> Odliv
          </button>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-wider text-white/40">Datum</label>
            <input type="date" value={txDate} onChange={(e) => setTxDate(e.target.value)}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white [color-scheme:dark] focus:border-[#c59b5b]/40 focus:outline-none" />
          </div>
          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-wider text-white/40">Vrsta</label>
            <select value={txCat} onChange={(e) => setTxCat(e.target.value as TxCategory)}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-[#c59b5b]/40 focus:outline-none">
              {(txDir === 'in' ? IN_CATEGORIES : OUT_CATEGORIES).map((c) => (
                <option key={c.id} value={c.id} className="bg-[#1b282d]">{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-wider text-white/40">Znesek ({cur})</label>
            <input type="number" inputMode="decimal" value={txAmount} onChange={(e) => setTxAmount(e.target.value)} placeholder="0.00"
              className="w-32 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-right text-sm text-white focus:border-[#c59b5b]/40 focus:outline-none" />
          </div>
          <div className="min-w-[160px] flex-1">
            <label className="mb-1 block text-[11px] uppercase tracking-wider text-white/40">Opis (neobvezno)</label>
            <input type="text" value={txDesc} onChange={(e) => setTxDesc(e.target.value)} placeholder="npr. ime stranke, namen"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-[#c59b5b]/40 focus:outline-none" />
          </div>
          <button onClick={addTx} disabled={saving || !(parseFloat(txAmount) > 0)}
            className="flex items-center gap-1.5 rounded-lg bg-[#c59b5b] px-4 py-2 text-sm font-semibold text-[#1b282d] transition-all hover:bg-[#c59b5b]/90 disabled:opacity-40">
            <Plus className="h-4 w-4" /> Dodaj
          </button>
        </div>
      </div>

      {/* Seznam transakcij */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <p className="mb-3 text-sm font-medium text-white/70">Promet {year} <span className="text-white/40">({list.length})</span> <span className="text-xs font-normal text-white/30">— po mesecih</span></p>
        {list.length === 0 ? (
          <p className="py-8 text-center text-sm text-white/30">Ni prometa za to leto. Dodaj prvi priliv ali odliv zgoraj.</p>
        ) : (
          <div className="space-y-3">
            {months.map(([ym, items]) => {
              const mIn = items.filter((t) => t.direction === 'in').reduce((s, t) => s + Number(t.amount), 0)
              const mOut = items.filter((t) => t.direction === 'out').reduce((s, t) => s + Number(t.amount), 0)
              const isOpen = openMonths[ym] ?? true
              // Razčlemba meseca po kategorijah
              const mByCat = CAT_ORDER.map((cat) => {
                const its = items.filter((t) => t.category === cat)
                return { cat, sum: its.reduce((s, t) => s + Number(t.amount), 0), count: its.length }
              }).filter((c) => c.count > 0)
              return (
                <div key={ym} className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
                  <button onClick={() => toggleMonth(ym)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.03]">
                    {isOpen ? <ChevronDown className="h-4 w-4 text-white/40" /> : <ChevronRight className="h-4 w-4 text-white/40" />}
                    <span className="text-sm font-semibold capitalize text-white">{monthLabel(ym)}</span>
                    <span className="text-[11px] text-white/30">{items.length}</span>
                    <span className="ml-auto flex flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-4">
                      <span className="flex items-center gap-3 text-xs tabular-nums">
                        <span className="text-[#8fae92]">+ {fmt(mIn)}</span>
                        <span className="text-[#c98f7d]">− {fmt(mOut)}</span>
                      </span>
                      <span className="flex items-center gap-1.5 rounded-lg bg-[#c59b5b]/10 px-2.5 py-1 text-xs sm:min-w-[170px] sm:justify-end">
                        <span className="text-[10px] uppercase tracking-wider text-[#c59b5b]/60">Konec meseca</span>
                        <span className="font-bold tabular-nums text-[#c59b5b]">{fmt(endOfMonthBalance.get(ym) ?? 0)}</span>
                      </span>
                    </span>
                  </button>
                  {isOpen && (
                    <div className="border-t border-white/[0.06] px-4 pb-3">
                      {/* Mesečna razčlemba po kategorijah */}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 py-2.5">
                        {mByCat.map((c) => (
                          <span key={c.cat} className="flex items-center gap-1.5 text-[11px]">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CAT_COLORS[c.cat] }} />
                            <span className="text-white/50">{catLabel(c.cat)}</span>
                            <span className="font-medium tabular-nums" style={{ color: CAT_COLORS[c.cat] }}>{fmt(c.sum)}</span>
                          </span>
                        ))}
                      </div>
                      <div className="divide-y divide-white/[0.06] border-t border-white/[0.06]">
                        {items.map((t) => renderTxRow(t))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showCashExpenses && (
        <BankaCashExpenses
          company={company}
          companyLabel={COMPANY_LABELS[company]}
          year={year}
          currency={cur === 'Ar' ? 'Ar' : 'EUR'}
          withdrawalsByMonth={withdrawalsByMonth}
          withdrawals={withdrawals}
          onClose={() => setShowCashExpenses(false)}
        />
      )}
      </>
      )}
    </div>
  )
}
