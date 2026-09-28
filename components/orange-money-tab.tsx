'use client'

import React, { useState } from 'react'
import useSWR from 'swr'
import {
  Smartphone, ArrowDownLeft, ArrowUpRight, Plus, Trash2, Pencil, Check, X, Wallet, ClipboardPaste,
} from 'lucide-react'
import {
  getOmAccount, saveOmAccount, getOmTransactions, getOmCarryIn, addOmTransaction, updateOmTransaction, deleteOmTransaction,
  type OmDirection, type OmCategory,
} from '@/app/actions/orange-money'
import OmTransferList from '@/components/om-transfer-list'
import OmIncomingList from '@/components/om-incoming-list'
import { parseOmIncoming } from '@/lib/om-parse'
import { getPhoneContacts } from '@/app/actions/phone-contacts'

const IN_CATEGORIES: { id: OmCategory; label: string }[] = [
  { id: 'revolut', label: 'Revolut' },
  { id: 'nakazilo', label: 'Direktno nakazilo' },
  { id: 'stranka', label: 'Plačilo stranke' },
  { id: 'ostalo_in', label: 'Ostalo (priliv)' },
]
const OUT_CATEGORIES: { id: OmCategory; label: string }[] = [
  { id: 'placilo', label: 'Plačilo' },
  { id: 'dobavitelj', label: 'Dobavitelj / nakup' },
  { id: 'ostalo_out', label: 'Ostalo (odliv)' },
]

function catLabel(cat: OmCategory): string {
  return [...IN_CATEGORIES, ...OUT_CATEGORIES].find((c) => c.id === cat)?.label ?? cat
}

const CAT_COLORS: Record<OmCategory, string> = {
  revolut: '#8ec0d4',
  nakazilo: '#8fae92',
  stranka: '#7fa8b8',
  ostalo_in: '#aec7b1',
  placilo: '#d09681',
  dobavitelj: '#d1a979',
  ostalo_out: '#b1c7cf',
}

const CAT_ORDER: OmCategory[] = ['revolut', 'nakazilo', 'stranka', 'ostalo_in', 'placilo', 'dobavitelj', 'ostalo_out']

const MONTHS_SL = ['januar', 'februar', 'marec', 'april', 'maj', 'junij', 'julij', 'avgust', 'september', 'oktober', 'november', 'december']
function monthLabel(ym: string) {
  const [y, m] = ym.split('-')
  return `${MONTHS_SL[parseInt(m, 10) - 1] ?? m} ${y}`
}
function todayIso() {
  return new Date().toISOString().slice(0, 10)
}
function formatDate(d: string) {
  const parts = d.split('-')
  if (parts.length === 3) return `${parts[2]}. ${parts[1]}. ${parts[0]}`
  return d
}

const OM_ORANGE = '#ff7900'

export default function OrangeMoneyTab({ year }: { year: number }) {
  const [omView, setOmView] = useState<'wallet' | 'transfers' | 'incoming'>('wallet')
  const { data: account, mutate: mutateAccount } = useSWR(['om-account'], () => getOmAccount())
  const { data: txs, mutate: mutateTxs } = useSWR(['om-txs', year], () => getOmTransactions(year))
  const { data: carryIn, mutate: mutateCarry } = useSWR(['om-carry', year], () => getOmCarryIn(year))
  const { data: contacts } = useSWR(['phone-contacts'], () => getPhoneContacts())

  const cur = account?.currency === 'EUR' ? '€' : 'Ar'
  const fmt = (v: number) =>
    `${new Intl.NumberFormat('sl-SI', { minimumFractionDigits: cur === '€' ? 2 : 0, maximumFractionDigits: cur === '€' ? 2 : 0 }).format(v)} ${cur}`

  const list = txs ?? []
  const inflows = list.filter((t) => t.direction === 'in')
  const outflows = list.filter((t) => t.direction === 'out')
  const totalIn = inflows.reduce((s, t) => s + Number(t.amount), 0)
  const totalOut = outflows.reduce((s, t) => s + Number(t.amount), 0)
  const revolutIn = inflows.filter((t) => t.category === 'revolut').reduce((s, t) => s + Number(t.amount), 0)
  const nakaziloIn = inflows.filter((t) => t.category === 'nakazilo').reduce((s, t) => s + Number(t.amount), 0)
  const opening = Number(account?.openingBalance ?? 0)
  const carry = Number(carryIn ?? 0)
  const balance = opening + carry + totalIn - totalOut

  // Razčlemba po kategorijah (letno)
  const byCategory = CAT_ORDER.map((cat) => {
    const items = list.filter((t) => t.category === cat)
    const sum = items.reduce((s, t) => s + Number(t.amount), 0)
    const dir: OmDirection = ['revolut', 'nakazilo', 'stranka', 'ostalo_in'].includes(cat) ? 'in' : 'out'
    return { cat, sum, count: items.length, dir }
  }).filter((c) => c.count > 0)

  // Razvrstitev po mesecih
  const monthMap = new Map<string, typeof list>()
  for (const t of list) {
    const ym = t.date.slice(0, 7)
    if (!monthMap.has(ym)) monthMap.set(ym, [])
    monthMap.get(ym)!.push(t)
  }
  const months = [...monthMap.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1))

  // --- Urejanje računa (začetno stanje) ---
  const [editAccount, setEditAccount] = useState(false)
  const [accOpening, setAccOpening] = useState('')
  const [accDate, setAccDate] = useState('2026-01-01')
  const [accCurrency, setAccCurrency] = useState<'EUR' | 'Ar'>('Ar')

  function startEditAccount() {
    setAccOpening(String(account?.openingBalance ?? 0))
    setAccDate(account?.openingDate ?? '2026-01-01')
    setAccCurrency(account?.currency === 'EUR' ? 'EUR' : 'Ar')
    setEditAccount(true)
  }
  async function saveAccount() {
    await saveOmAccount({ currency: accCurrency, openingBalance: parseFloat(accOpening) || 0, openingDate: accDate || '2026-01-01' })
    setEditAccount(false)
    mutateAccount()
    mutateTxs()
  }

  // --- Nova transakcija ---
  const [txDate, setTxDate] = useState(todayIso())
  const [txDir, setTxDir] = useState<OmDirection>('in')
  const [txCat, setTxCat] = useState<OmCategory>('revolut')
  const [txAmount, setTxAmount] = useState('')
  const [txDesc, setTxDesc] = useState('')
  const [saving, setSaving] = useState(false)

  function switchDir(dir: OmDirection) {
    setTxDir(dir)
    setTxCat(dir === 'in' ? 'revolut' : 'placilo')
  }
  async function addTx() {
    const amt = parseFloat(txAmount) || 0
    if (amt <= 0) return
    setSaving(true)
    try {
      await addOmTransaction({ date: txDate, direction: txDir, category: txCat, amount: amt, description: txDesc.trim() })
      setTxAmount('')
      setTxDesc('')
      mutateTxs()
      mutateCarry()
    } finally {
      setSaving(false)
    }
  }

  // --- Prilepi SMS o prejetem nakazilu (priliv v denarnico) ---
  const [smsText, setSmsText] = useState('')
  const [smsMsg, setSmsMsg] = useState<string | null>(null)
  const [smsSaving, setSmsSaving] = useState(false)
  async function addFromSms() {
    const parsed = parseOmIncoming(smsText, contacts)
    if (parsed.length === 0) {
      setSmsMsg('Ni bilo mogoče prepoznati nobenega prejetega nakazila v besedilu.')
      return
    }
    setSmsSaving(true)
    try {
      for (const p of parsed) {
        const who = p.senderName ? `${p.senderName} (${p.senderNumber})` : p.senderNumber ?? 'neznan pošiljatelj'
        const desc = `Prejeto nakazilo od ${who}${p.transId ? ` · Trans Id ${p.transId}` : ''}`
        await addOmTransaction({ date: todayIso(), direction: 'in', category: 'nakazilo', amount: p.amount, description: desc })
      }
      const total = parsed.reduce((s, p) => s + p.amount, 0)
      setSmsMsg(`Dodano ${parsed.length} ${parsed.length === 1 ? 'nakazilo' : 'nakazil'} (${fmt(total)}).`)
      setSmsText('')
      mutateTxs()
      mutateCarry()
    } finally {
      setSmsSaving(false)
    }
  }

  // --- Urejanje transakcije ---
  const [editId, setEditId] = useState<string | null>(null)
  const [eDate, setEDate] = useState('')
  const [eDir, setEDir] = useState<OmDirection>('in')
  const [eCat, setECat] = useState<OmCategory>('revolut')
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
    await updateOmTransaction(id, { date: eDate, direction: eDir, category: eCat, amount: parseFloat(eAmount) || 0, description: eDesc.trim() })
    setEditId(null)
    mutateTxs()
    mutateCarry()
  }
  async function removeTx(id: string) {
    if (confirmDelete !== id) {
      setConfirmDelete(id)
      setTimeout(() => setConfirmDelete((c) => (c === id ? null : c)), 4000)
      return
    }
    await deleteOmTransaction(id)
    setConfirmDelete(null)
    mutateTxs()
    mutateCarry()
  }

  function renderTxRow(t: (typeof list)[number]) {
    const isIn = t.direction === 'in'
    const color = isIn ? '#8fae92' : '#c98f7d'
    return (
      <div key={t.id} className="py-3">
        {editId === t.id ? (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-0.5 rounded-lg bg-white/5 p-0.5">
              <button onClick={() => { setEDir('in'); setECat('revolut') }} className={`rounded-md px-2 py-1 text-[11px] font-medium ${eDir === 'in' ? 'bg-[#8fae92]/20 text-[#8fae92]' : 'text-white/40'}`}>Priliv</button>
              <button onClick={() => { setEDir('out'); setECat('placilo') }} className={`rounded-md px-2 py-1 text-[11px] font-medium ${eDir === 'out' ? 'bg-[#c98f7d]/20 text-[#c98f7d]' : 'text-white/40'}`}>Odliv</button>
            </div>
            <input type="date" value={eDate} onChange={(e) => setEDate(e.target.value)}
              className="w-36 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white [color-scheme:dark] focus:border-[#ff7900]/40 focus:outline-none" />
            <select value={eCat} onChange={(e) => setECat(e.target.value as OmCategory)}
              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white focus:border-[#ff7900]/40 focus:outline-none">
              {(eDir === 'in' ? IN_CATEGORIES : OUT_CATEGORIES).map((c) => (
                <option key={c.id} value={c.id} className="bg-[#1b282d]">{c.label}</option>
              ))}
            </select>
            <input type="number" value={eAmount} onChange={(e) => setEAmount(e.target.value)}
              className="w-24 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-right text-xs text-white focus:border-[#ff7900]/40 focus:outline-none" />
            <input type="text" value={eDesc} onChange={(e) => setEDesc(e.target.value)} placeholder="Opis"
              className="min-w-[120px] flex-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white focus:border-[#ff7900]/40 focus:outline-none" />
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
      {/* Preklop: denarnica / seznam nakazil */}
      <div className="flex w-fit gap-0.5 rounded-lg bg-white/5 p-0.5">
        <button type="button" onClick={() => setOmView('wallet')}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${omView === 'wallet' ? 'bg-[#ff7900]/20 text-[#d09681]' : 'text-white/40 hover:text-white/70'}`}>
          Denarnica
        </button>
        <button type="button" onClick={() => setOmView('transfers')}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${omView === 'transfers' ? 'bg-[#ff7900]/20 text-[#d09681]' : 'text-white/40 hover:text-white/70'}`}>
          Seznam nakazil
        </button>
        <button type="button" onClick={() => setOmView('incoming')}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${omView === 'incoming' ? 'bg-[#ff7900]/20 text-[#d09681]' : 'text-white/40 hover:text-white/70'}`}>
          Seznam prilivov
        </button>
      </div>

      {omView === 'transfers' ? <OmTransferList /> : omView === 'incoming' ? <OmIncomingList /> : (
      <>
      {/* Kartica denarnice + začetno stanje */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ backgroundColor: `${OM_ORANGE}22`, color: OM_ORANGE }}>
              <Smartphone className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-white/40">Mobilna denarnica</p>
              <h2 className="text-lg font-bold text-white">Orange Money</h2>
            </div>
          </div>
          {!editAccount && (
            <button onClick={startEditAccount} className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs text-white/60 hover:bg-white/10 hover:text-white">
              <Pencil className="h-3.5 w-3.5" /> Uredi začetno stanje
            </button>
          )}
        </div>

        {editAccount ? (
          <div className="space-y-3 rounded-xl border p-4" style={{ borderColor: `${OM_ORANGE}33`, backgroundColor: `${OM_ORANGE}0d` }}>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1 block text-[11px] uppercase tracking-wider text-white/40">Stanje na dan</label>
                <input type="date" value={accDate} onChange={(e) => setAccDate(e.target.value)}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white [color-scheme:dark] focus:border-[#ff7900]/40 focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-[11px] uppercase tracking-wider text-white/40">Začetno stanje</label>
                <input type="number" inputMode="decimal" value={accOpening} onChange={(e) => setAccOpening(e.target.value)} placeholder="0"
                  className="w-40 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-right text-sm text-white focus:border-[#ff7900]/40 focus:outline-none" />
              </div>
              <div className="flex gap-1 rounded-lg bg-white/5 p-0.5">
                {(['Ar', 'EUR'] as const).map((c) => (
                  <button key={c} type="button" onClick={() => setAccCurrency(c)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${accCurrency === c ? 'bg-[#ff7900]/20 text-[#d09681]' : 'text-white/40 hover:text-white/70'}`}>
                    {c === 'EUR' ? 'EUR (€)' : 'Ariary (Ar)'}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-white/40">Vpiši celotno stanje na Orange Money računu na izbrani dan. Prilivi in odlivi se prištevajo/odštevajo od tega stanja.</p>
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
            <div className="mb-4 flex items-center gap-3 rounded-xl border p-4" style={{ borderColor: `${OM_ORANGE}33`, background: `linear-gradient(135deg, ${OM_ORANGE}1a, transparent)` }}>
              <Wallet className="h-8 w-8" style={{ color: OM_ORANGE }} />
              <div>
                <p className="text-[11px] uppercase tracking-wider text-white/50">Trenutni saldo na Orange Money</p>
                <p className="text-3xl font-bold tabular-nums" style={{ color: OM_ORANGE }}>{fmt(balance)}</p>
                <p className="text-xs text-white/40">
                  Začetno stanje {fmt(opening)} · {formatDate(account?.openingDate ?? '2026-01-01')}
                  {carry !== 0 && <> · prenos iz prejšnjih let {carry >= 0 ? '+' : '−'} {fmt(Math.abs(carry))}</>}
                </p>
              </div>
            </div>

            {/* Povzetek */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-[#8fae92]/20 bg-[#8fae92]/[0.06] p-3">
                <div className="mb-1 flex items-center gap-1.5 text-[#8fae92]"><ArrowDownLeft className="h-4 w-4" /><span className="text-[11px] uppercase tracking-wider">Prilivi</span></div>
                <p className="text-lg font-bold text-white tabular-nums">{fmt(totalIn)}</p>
              </div>
              <div className="rounded-xl border border-[#8ec0d4]/20 bg-[#8ec0d4]/[0.06] p-3">
                <div className="mb-1 flex items-center gap-1.5 text-[#8ec0d4]"><ArrowDownLeft className="h-4 w-4" /><span className="text-[11px] uppercase tracking-wider">Revolut</span></div>
                <p className="text-lg font-bold text-white tabular-nums">{fmt(revolutIn)}</p>
              </div>
              <div className="rounded-xl border border-[#7fa8b8]/20 bg-[#7fa8b8]/[0.06] p-3">
                <div className="mb-1 flex items-center gap-1.5 text-[#7fa8b8]"><ArrowDownLeft className="h-4 w-4" /><span className="text-[11px] uppercase tracking-wider">Nakazila</span></div>
                <p className="text-lg font-bold text-white tabular-nums">{fmt(nakaziloIn)}</p>
              </div>
              <div className="rounded-xl border border-[#c98f7d]/20 bg-[#c98f7d]/[0.06] p-3">
                <div className="mb-1 flex items-center gap-1.5 text-[#c98f7d]"><ArrowUpRight className="h-4 w-4" /><span className="text-[11px] uppercase tracking-wider">Odlivi (plačila)</span></div>
                <p className="text-lg font-bold text-white tabular-nums">{fmt(totalOut)}</p>
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
                        <span className="w-40 shrink-0 text-sm text-white/70">{catLabel(c.cat)}</span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/5">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                        </div>
                        <span className="w-32 shrink-0 text-right text-sm font-medium tabular-nums text-white/80">{fmt(c.sum)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Prilepi SMS o prejetem nakazilu */}
      <div className="rounded-2xl border border-[#8fae92]/25 bg-[#8fae92]/[0.06] p-5">
        <div className="mb-1 flex items-center gap-2">
          <ClipboardPaste className="h-4 w-4 text-[#8fae92]" />
          <p className="text-sm font-semibold text-white">Prilepi obvestilo o prejetem nakazilu</p>
        </div>
        <p className="mb-3 text-xs text-white/50">
          Prilepi SMS Orange Money (npr. „Vous avez recu un transfert international de … AR de la part de …") in znesek se doda kot priliv v denarnico.
        </p>
        <textarea
          value={smsText}
          onChange={(e) => { setSmsText(e.target.value); setSmsMsg(null) }}
          rows={3}
          placeholder="Vous avez recu un transfert international de 2144583 AR de la part de +262692282610. Votre nouveau solde est : 3601270 AR. Trans Id : f9afd2e7. Orange Money vous remercie."
          className="w-full resize-y rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-white/25 focus:border-[#8fae92]/50 focus:outline-none"
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            onClick={addFromSms}
            disabled={smsSaving || !smsText.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-[#8fae92]/20 px-4 py-2 text-xs font-medium text-[#8fae92] transition-colors hover:bg-[#8fae92]/30 disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" /> Dodaj priliv iz SMS
          </button>
          {smsMsg && <span className="text-xs text-white/60">{smsMsg}</span>}
        </div>
      </div>

      {/* Dodaj priliv ali odliv */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <p className="mb-3 text-sm font-semibold text-white">Dodaj priliv ali plačilo</p>
        <div className="mb-3 flex gap-0.5 rounded-lg bg-white/5 p-0.5 w-fit">
          <button type="button" onClick={() => switchDir('in')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${txDir === 'in' ? 'bg-[#8fae92]/20 text-[#8fae92]' : 'text-white/40 hover:text-white/70'}`}>Priliv (polnjenje)</button>
          <button type="button" onClick={() => switchDir('out')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${txDir === 'out' ? 'bg-[#c98f7d]/20 text-[#c98f7d]' : 'text-white/40 hover:text-white/70'}`}>Odliv (plačilo)</button>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/40">Datum</label>
            <input type="date" value={txDate} onChange={(e) => setTxDate(e.target.value)}
              className="w-36 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white [color-scheme:dark] focus:border-[#ff7900]/40 focus:outline-none" />
          </div>
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/40">Vrsta</label>
            <select value={txCat} onChange={(e) => setTxCat(e.target.value as OmCategory)}
              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white focus:border-[#ff7900]/40 focus:outline-none">
              {(txDir === 'in' ? IN_CATEGORIES : OUT_CATEGORIES).map((c) => (
                <option key={c.id} value={c.id} className="bg-[#1b282d]">{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/40">Znesek ({cur})</label>
            <input type="number" value={txAmount} onChange={(e) => setTxAmount(e.target.value)} placeholder="0"
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) addTx() }}
              className="w-28 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-right text-xs text-white focus:border-[#ff7900]/40 focus:outline-none" />
          </div>
          <div className="min-w-[140px] flex-1">
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/40">Opis</label>
            <input type="text" value={txDesc} onChange={(e) => setTxDesc(e.target.value)} placeholder="npr. Polnjenje prek Revoluta / plačilo dobavitelju"
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) addTx() }}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white focus:border-[#ff7900]/40 focus:outline-none" />
          </div>
          <button onClick={addTx} disabled={saving || !txDate || !txAmount}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium disabled:opacity-40"
            style={{ backgroundColor: `${OM_ORANGE}26`, color: '#d09681' }}>
            <Plus className="h-3.5 w-3.5" /> Dodaj
          </button>
        </div>
      </div>

      {/* Promet po mesecih */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <p className="mb-3 text-sm font-semibold text-white">Promet — {year}</p>
        {list.length === 0 ? (
          <p className="py-10 text-center text-sm text-white/30">Ni vpisanih transakcij za {year}. Dodaj prvi priliv ali plačilo zgoraj.</p>
        ) : (
          <div className="space-y-5">
            {months.map(([ym, items]) => {
              const mIn = items.filter((t) => t.direction === 'in').reduce((s, t) => s + Number(t.amount), 0)
              const mOut = items.filter((t) => t.direction === 'out').reduce((s, t) => s + Number(t.amount), 0)
              return (
                <div key={ym}>
                  <div className="mb-1 flex items-center justify-between border-b border-white/10 pb-1.5">
                    <span className="text-sm font-semibold" style={{ color: OM_ORANGE }}>{monthLabel(ym)}</span>
                    <span className="text-xs tabular-nums text-white/50">
                      <span className="text-[#8fae92]">+{fmt(mIn)}</span> · <span className="text-[#c98f7d]">−{fmt(mOut)}</span>
                    </span>
                  </div>
                  <div className="divide-y divide-white/[0.04]">
                    {items.map((t) => renderTxRow(t))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      </>
      )}
    </div>
  )
}
