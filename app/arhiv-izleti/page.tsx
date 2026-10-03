'use client'

import React, { useState, useMemo } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { ArrowLeft, Search, Palmtree, Users, Pencil, ChevronDown } from 'lucide-react'
import { getArchivedExcursions } from '@/app/actions/komba'
import { payFanja, unpayFanja, type FanjaPayMethod, type FanjaPayCompany } from '@/app/actions/fanja-payment'
import { paySupplier, unpaySupplier, type SupplierPayMethod, type SupplierPayCompany } from '@/app/actions/supplier-payment'
import { bungalowDisplayName } from '@/lib/bungalow'

const fetcher = async () => await getArchivedExcursions()
const ar = (v: number) => `${Math.round(v || 0).toLocaleString('de-DE')} Ar`

type ArchivedExcursion = Awaited<ReturnType<typeof getArchivedExcursions>>['items'][number]

// Plačilo dobavitelju za NE-Fanjin izlet (Dilip / kosilo / vstopnina) — vsak svoj panel,
// isti mehanizem kot pri transferjih (paySupplier/unpaySupplier, refKey), zato sinhronizirano.
function SupplierPayPanel({
  refKey, supplier, amountAr, supplierLabel, label, accent, paid, onDone,
}: {
  refKey: string
  supplier: string
  amountAr: number
  supplierLabel: string
  label: string
  accent: string
  paid: { paidAt: string | null; method: string | null; company: string | null; amountAr: number } | null
  onDone: () => void
}) {
  const [open, setOpen] = useState(false)
  const [method, setMethod] = useState<SupplierPayMethod>('cash')
  const [company, setCompany] = useState<SupplierPayCompany>('tourism')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      await paySupplier({ refKey, supplier, method, company: method === 'cash' ? company : undefined, date, amountAr, label })
      setOpen(false)
      onDone()
    } finally {
      setSaving(false)
    }
  }
  const cancel = async () => {
    if (!confirm('Prekličem plačilo? Vknjižba v blagajni/Orange Money se bo izbrisala.')) return
    setSaving(true)
    try {
      await unpaySupplier({ refKey })
      onDone()
    } finally {
      setSaving(false)
    }
  }
  const startEdit = () => {
    setMethod(paid?.method === 'orange' ? 'orange' : 'cash')
    setCompany(paid?.company === 'sarl' ? 'sarl' : 'tourism')
    if (paid?.paidAt) setDate(paid.paidAt.slice(0, 10))
    setOpen(true)
  }

  if (open) {
    return (
      <div className="mt-2 rounded-lg border bg-[#efe8da] p-2.5" style={{ borderColor: `${accent}55` }}>
        <p className="mb-2 text-[11px] font-semibold" style={{ color: accent }}>
          {paid ? 'Uredi plačilo' : 'Plačilo'} · {supplierLabel} · {ar(amountAr)}
        </p>
        <div className="flex gap-2">
          {(['cash', 'orange'] as SupplierPayMethod[]).map(m => (
            <button key={m} onClick={() => setMethod(m)}
              className={`flex-1 rounded-lg border px-3 py-2 text-[11px] font-medium transition-colors ${method === m ? '' : 'border-[#0f2e3a]/15 bg-[#0f2e3a]/5 text-[#2b2622]/60 hover:bg-[#0f2e3a]/10'}`}
              style={method === m ? { backgroundColor: `${accent}22`, borderColor: `${accent}66`, color: accent } : undefined}>
              {m === 'cash' ? 'Gotovina' : 'Orange Money'}
            </button>
          ))}
        </div>
        {method === 'cash' && (
          <div className="mt-2 flex gap-2">
            {(['tourism', 'sarl'] as SupplierPayCompany[]).map(c => (
              <button key={c} onClick={() => setCompany(c)}
                className={`flex-1 rounded-lg border px-3 py-2 text-[10px] font-medium transition-colors ${company === c ? 'border-[#4f7a54]/40 bg-[#4f7a54]/15 text-[#4f7a54]' : 'border-[#0f2e3a]/15 bg-[#0f2e3a]/5 text-[#2b2622]/60 hover:bg-[#0f2e3a]/10'}`}>
                {c === 'tourism' ? 'KOMBA CABANA TOURISM SARL' : 'KOMBA CABANA SARL'}
              </button>
            ))}
          </div>
        )}
        <div className="mt-2 flex items-center gap-2">
          <span className="text-[10px] text-[#2b2622]/55">Datum plačila:</span>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="flex-1 rounded-lg border border-[#0f2e3a]/15 bg-[#0f2e3a]/5 px-2 py-1.5 text-[11px] text-[#0f2e3a] [color-scheme:light] focus:outline-none" />
        </div>
        <div className="mt-2 flex gap-2">
          <button onClick={() => setOpen(false)}
            className="rounded-lg border border-[#0f2e3a]/15 bg-[#0f2e3a]/5 px-3 py-2 text-[11px] font-medium text-[#2b2622]/70 transition-colors hover:bg-[#0f2e3a]/10">
            Prekliči
          </button>
          <button onClick={save} disabled={saving}
            className="flex-1 rounded-lg px-3 py-2 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            style={{ backgroundColor: `${accent}22`, border: `1px solid ${accent}66`, color: accent }}>
            {saving ? 'Beležim…' : 'Zabeleži plačilo'}
          </button>
        </div>
      </div>
    )
  }

  if (paid) {
    return (
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#4f7a54]/30 bg-[#4f7a54]/[0.08] px-2.5 py-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-[#4f7a54]">
            {supplierLabel} ✓ · {paid.method === 'orange' ? <span className="text-[#c4741f]">Orange Money</span> : 'Gotovina'}
            {paid.method === 'cash' && paid.company ? ` (${paid.company === 'sarl' ? 'SARL' : 'Tourism'})` : ''}
          </p>
          <p className="text-[10px] text-[#2b2622]/55">
            {paid.paidAt ? new Date(paid.paidAt).toLocaleDateString('sl-SI', { day: 'numeric', month: 'short', year: 'numeric' }) : ''} · {ar(paid.amountAr || amountAr)}
          </p>
        </div>
        <div className="flex flex-shrink-0 gap-1.5">
          <button onClick={startEdit} aria-label="Uredi plačilo" title="Uredi plačilo"
            className="rounded-full border border-[#0f2e3a]/15 bg-[#0f2e3a]/5 p-1.5 text-[#2b2622]/70 transition-colors hover:bg-[#0f2e3a]/10">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button onClick={cancel} disabled={saving}
            className="rounded-full border border-[#0f2e3a]/15 bg-[#0f2e3a]/5 px-3 py-1.5 text-[10px] font-medium text-[#2b2622]/70 transition-colors hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-600">
            Prekliči
          </button>
        </div>
      </div>
    )
  }

  return (
    <button onClick={() => setOpen(true)}
      className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full border bg-[#efe8da] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.15em] transition-opacity hover:opacity-90"
      style={{ borderColor: `${accent}55`, color: accent }}>
      Plačaj {supplierLabel} · {ar(amountAr)}
    </button>
  )
}

function FanjaPayPanel({
  bookingIds, amountAr, label, paidAt, paidMethod, paidCompany, paidAmountAr, onDone,
}: {
  bookingIds: string[]
  amountAr: number
  label: string
  paidAt: string | null
  paidMethod: string | null
  paidCompany: string | null
  paidAmountAr: number
  onDone: () => void
}) {
  const [open, setOpen] = useState(false)
  const [method, setMethod] = useState<FanjaPayMethod>('cash')
  const [company, setCompany] = useState<FanjaPayCompany>('tourism')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      await payFanja({ bookingIds, method, company: method === 'cash' ? company : undefined, date, amountAr, label })
      setOpen(false)
      onDone()
    } finally {
      setSaving(false)
    }
  }
  const cancel = async () => {
    if (!confirm('Prekličem plačilo Fanji? Vknjižba v blagajni/Orange Money se bo izbrisala.')) return
    setSaving(true)
    try {
      await unpayFanja({ bookingIds })
      onDone()
    } finally {
      setSaving(false)
    }
  }
  const startEdit = () => {
    setMethod(paidMethod === 'orange' ? 'orange' : 'cash')
    setCompany(paidCompany === 'sarl' ? 'sarl' : 'tourism')
    if (paidAt) setDate(paidAt.slice(0, 10))
    setOpen(true)
  }

  // Priority: open form (also for editing) → paid state → "Plačaj" button
  if (open) {
    return (
      <div className="mt-2 rounded-xl border border-[#3f6b7d]/25 bg-[#efe8da] p-3 space-y-3">
        <p className="text-[11px] font-semibold text-[#3f6b7d]">{paidAt ? 'Uredi plačilo Fanji' : 'Plačilo Fanji'} · {ar(amountAr)}</p>
        <div className="flex gap-2">
          {(['cash', 'orange'] as FanjaPayMethod[]).map(m => (
            <button key={m} onClick={() => setMethod(m)}
              className={`flex-1 rounded-lg px-3 py-2 text-[11px] font-medium border transition-colors ${method === m ? 'bg-[#3f6b7d]/15 text-[#3f6b7d] border-[#3f6b7d]/40' : 'bg-[#0f2e3a]/5 text-[#2b2622]/60 border-[#0f2e3a]/15 hover:bg-[#0f2e3a]/10'}`}>
              {m === 'cash' ? 'Gotovina' : 'Orange Money'}
            </button>
          ))}
        </div>
        {method === 'cash' && (
          <div className="flex gap-2">
            {(['tourism', 'sarl'] as FanjaPayCompany[]).map(c => (
              <button key={c} onClick={() => setCompany(c)}
                className={`flex-1 rounded-lg px-3 py-2 text-[10px] font-medium border transition-colors ${company === c ? 'bg-[#4f7a54]/15 text-[#4f7a54] border-[#4f7a54]/40' : 'bg-[#0f2e3a]/5 text-[#2b2622]/60 border-[#0f2e3a]/15 hover:bg-[#0f2e3a]/10'}`}>
                {c === 'tourism' ? 'KOMBA CABANA TOURISM SARL' : 'KOMBA CABANA SARL'}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[#2b2622]/55">Datum plačila:</span>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="flex-1 rounded-lg bg-[#0f2e3a]/5 border border-[#0f2e3a]/15 px-2 py-1.5 text-[11px] text-[#0f2e3a] [color-scheme:light] focus:border-[#3f6b7d]/40 focus:outline-none" />
        </div>
        <div className="flex gap-2">
          <button onClick={() => setOpen(false)}
            className="rounded-lg bg-[#0f2e3a]/5 border border-[#0f2e3a]/15 px-3 py-2 text-[11px] font-medium text-[#2b2622]/70 hover:bg-[#0f2e3a]/10 transition-colors">
            Prekliči
          </button>
          <button onClick={save} disabled={saving}
            className="flex-1 rounded-lg bg-[#3f6b7d]/15 border border-[#3f6b7d]/40 px-3 py-2 text-[11px] font-semibold text-[#3f6b7d] hover:bg-[#3f6b7d]/25 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {saving ? 'Beležim…' : 'Zabeleži plačilo'}
          </button>
        </div>
      </div>
    )
  }

  if (paidAt) {
    return (
      <div className="mt-2 flex flex-col gap-2 rounded-xl border border-[#8f6d3a]/30 bg-[#f7efdd] px-3 py-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-[#0f2e3a]">
            Plačano Fanji ✓ · {paidMethod === 'orange' ? <span className="text-[#c4741f]">Orange Money</span> : 'Gotovina'}
            {paidMethod === 'cash' && paidCompany ? ` (${paidCompany === 'sarl' ? 'SARL' : 'Tourism'})` : ''}
          </p>
          <p className="text-[10px] text-[#2b2622]/55">
            {new Date(paidAt).toLocaleDateString('sl-SI', { day: 'numeric', month: 'short', year: 'numeric' })} · {ar(paidAmountAr || amountAr)}
          </p>
        </div>
        <div className="flex justify-center gap-1.5">
          <button onClick={startEdit} aria-label="Uredi plačilo" title="Uredi"
            className="inline-flex items-center justify-center rounded-full border border-[#8f6d3a]/30 bg-[#f7efdd] p-1.5 text-[#8f6d3a] hover:bg-[#f2e6c9] transition-colors">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button onClick={cancel} disabled={saving}
            className="rounded-full border border-[#8f6d3a]/30 bg-[#f7efdd] px-3 py-1.5 text-[10px] font-medium text-[#2b2622]/70 hover:bg-red-500/10 hover:text-red-600 hover:border-red-500/30 transition-colors">
            Prekliči
          </button>
        </div>
      </div>
    )
  }

  return (
    <button onClick={() => setOpen(true)}
      className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#3f6b7d]/40 bg-[#efe8da] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#3f6b7d] transition-opacity hover:opacity-90">
      <Palmtree className="h-4 w-4" />
      Plačilo Fanji · {ar(amountAr)}
    </button>
  )
}

export default function ArhivIzletiPage() {
  const [search, setSearch] = useState('')
  const { data, isLoading, error, mutate } = useSWR('archived-excursions', fetcher, { revalidateOnFocus: false })

  const filtered = useMemo(() => {
    const items = data?.items || []
    if (!search.trim()) return items
    const q = search.toLowerCase()
    return items.filter(e =>
      e.excursionName?.toLowerCase().includes(q) ||
      e.members.some(m => m.guestName?.toLowerCase().includes(q) || m.bungalow?.toLowerCase().includes(q))
    )
  }, [data, search])

  const groups = useMemo(() => {
    const map = new Map<string, ArchivedExcursion[]>()
    for (const e of filtered) {
      const arr = map.get(e.date) || []
      arr.push(e)
      map.set(e.date, arr)
    }
    return Array.from(map.entries())
  }, [filtered])

  const today = data?.today || ''
  const yesterday = today ? new Date(new Date(today).getTime() - 86400000).toISOString().split('T')[0] : ''

  const dayLabel = (dateStr: string) => {
    if (dateStr === today) return 'Danes'
    if (dateStr === yesterday) return 'Včeraj'
    const d = new Date(dateStr)
    return d.toLocaleDateString('sl-SI', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }

  return (
    <div className="min-h-screen bg-[#0a2029] text-white">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0a2029]/95 backdrop-blur-sm">
        <div className="mx-auto max-w-3xl px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="rounded-lg bg-white/5 p-2 text-white/60 hover:bg-white/10 hover:text-white">
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div>
                <h1 className="text-xl font-bold text-[#c59b5b]">Arhiv izletov</h1>
                <p className="text-sm text-white/40">Vsa opozorila o izletih do danes · klikni za plačilo Fanji</p>
              </div>
            </div>
            {data?.items && (
              <p className="text-sm text-white/40">{filtered.length} izletov</p>
            )}
          </div>

          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              placeholder="Išči po izletu, gostu, bungalovu..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-4 text-white placeholder:text-white/30 focus:border-[#7fa8b8]/50 focus:outline-none"
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        {isLoading ? (
          <div className="py-12 text-center text-white/40">Nalagam...</div>
        ) : error ? (
          <div className="py-12 text-center text-red-400">Napaka pri nalaganju</div>
        ) : groups.length === 0 ? (
          <div className="py-12 text-center text-white/40">
            {search ? 'Ni rezultatov za iskanje' : 'Ni arhiviranih izletov'}
          </div>
        ) : (
          <div className="space-y-6">
            {groups.map(([date, items]) => (
              <section key={date}>
                <div className="mb-2 flex items-center gap-2">
                  <h2 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#c59b5b]">{dayLabel(date)}</h2>
                  <span className="rounded-full bg-white/5 px-1.5 py-0.5 text-[10px] text-white/40">{items.length}</span>
                </div>
                <div className="space-y-2">
                  {items.map((e) => {
                    const firstBungalow = bungalowDisplayName(e.members[0]?.bungalow || '')
                    const firstGuest = e.members[0]?.guestName || ''
                    const fanjaLabel = `Izlet ${e.excursionName} — ${e.members.map(m => `${bungalowDisplayName(m.bungalow)} / ${m.guestName}`).join(', ')}`.slice(0, 200)
                    return (
                      <details key={e.key} className="group rounded-xl border border-white/10 bg-white/[0.03] transition-colors open:bg-white/[0.05] hover:bg-white/[0.05]">
                        <summary className="flex cursor-pointer list-none items-start gap-2.5 px-3 py-2.5 [&::-webkit-details-marker]:hidden">
                          <span
                            className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full"
                            style={{ backgroundColor: e.isOrdered ? '#4f7a5422' : '#b0761a22', color: e.isOrdered ? '#8fae92' : '#e0a561' }}
                          >
                            <Palmtree className="h-3.5 w-3.5" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-medium text-[#8fae92]">
                              {e.excursionName || 'Izlet'}
                              {e.isGroup && <span className="ml-1 rounded bg-[#3f6b7d]/25 px-1.5 py-0.5 text-[9px] align-middle text-[#a8c6d2]">SKUPINA</span>}
                            </p>
                            <p className="truncate text-[11px] text-white/70">
                              {e.isGroup ? `${e.members.length} bungalovov` : `${firstBungalow} · ${firstGuest}`}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-white/40">
                              <span className="flex items-center gap-1"><Users className="h-3 w-3" />{e.totalPax} os</span>
                              {e.boatName ? <span>{e.boatName}</span> : null}
                            </div>
                          </div>
                          {e.isOrdered ? (
                            <span className="flex-shrink-0 rounded-full bg-[#4f7a54]/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[#8fae92]">
                              Naročeno
                            </span>
                          ) : (
                            <span className="flex-shrink-0 rounded-full bg-[#b0761a]/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[#e0a561]">
                              Za naročiti
                            </span>
                          )}
                          <ChevronDown className="mt-0.5 h-4 w-4 flex-shrink-0 text-white/30 transition-transform group-open:rotate-180" />
                        </summary>
                        <div className="border-t border-white/5 px-3 pb-3 pt-2">
                          {/* Guests (for groups) */}
                          {e.isGroup && (
                            <div className="mb-2 space-y-0.5">
                              {e.members.map((m, mi) => (
                                <p key={mi} className="truncate text-[11px] text-white/70">
                                  {bungalowDisplayName(m.bungalow)} · <span className="text-white">{m.guestName}</span> <span className="text-white/40">({m.pax} os)</span>
                                </p>
                              ))}
                            </div>
                          )}
                          {/* Payment breakdown — mirrors the pending IZLETI card */}
                          <div className="space-y-1 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] text-white/50">{e.isFanja ? 'Plačilo Fanji' : 'Dilipu (čoln + vodič)'}</span>
                              <span className="text-[11px] font-semibold text-[#a8c6d2] whitespace-nowrap">
                                {e.isFanja ? (e.fanjaPayment > 0 ? ar(e.fanjaPayment) : '—') : (e.dilipPayment > 0 ? ar(e.dilipPayment) : '—')}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] text-white/50">Vodiču za kosilo</span>
                              <span className="text-[11px] font-semibold text-[#e0a561] whitespace-nowrap">{e.lunchTotal > 0 ? ar(e.lunchTotal) : '—'}</span>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] text-white/50">Skiperju za vstopnino ({e.totalPax} os)</span>
                              <span className="text-[11px] font-semibold text-[#d99175] whitespace-nowrap">{e.isFanja ? '—' : (e.entranceTotalAr > 0 ? ar(e.entranceTotalAr) : '—')}</span>
                            </div>
                          </div>
                          {/* Fanja payment panel (edit/cancel) — only for Fanja excursions with an amount */}
                          {e.isFanja && e.fanjaPayment > 0 ? (
                            <FanjaPayPanel
                              bookingIds={e.bookingIds}
                              amountAr={e.fanjaPayment}
                              label={fanjaLabel}
                              paidAt={e.fanjaPaidAt}
                              paidMethod={e.fanjaPaidMethod}
                              paidCompany={e.fanjaPaidCompany}
                              paidAmountAr={e.fanjaPaidAmountAr}
                              onDone={() => mutate()}
                            />
                          ) : !e.isFanja ? (
                            <div className="space-y-1.5">
                              {e.dilipPayment > 0 && (
                                <SupplierPayPanel
                                  refKey={e.dilipRefKey} supplier="dilip" amountAr={e.dilipPayment}
                                  supplierLabel="Dilipu (čoln + vodič)" accent="#3f6b7d"
                                  label={`Izlet ${e.excursionName} (Dilip) — ${firstBungalow} / ${firstGuest}`.slice(0, 200)}
                                  paid={e.dilipPaid} onDone={() => mutate()} />
                              )}
                              {e.lunchTotal > 0 && (
                                <SupplierPayPanel
                                  refKey={e.lunchRefKey} supplier="lunch" amountAr={e.lunchTotal}
                                  supplierLabel="Vodiču za kosilo" accent="#8f6d3a"
                                  label={`Izlet ${e.excursionName} (kosilo) — ${firstBungalow} / ${firstGuest}`.slice(0, 200)}
                                  paid={e.lunchPaid} onDone={() => mutate()} />
                              )}
                              {e.entranceTotalAr > 0 && (
                                <SupplierPayPanel
                                  refKey={e.entranceRefKey} supplier="entrance" amountAr={e.entranceTotalAr}
                                  supplierLabel={`Skiperju za vstopnino (${e.totalPax} os)`} accent="#a8543a"
                                  label={`Izlet ${e.excursionName} (vstopnina) — ${firstBungalow} / ${firstGuest}`.slice(0, 200)}
                                  paid={e.entrancePaid} onDone={() => mutate()} />
                              )}
                              {e.dilipPayment <= 0 && e.lunchTotal <= 0 && e.entranceTotalAr <= 0 && (
                                <p className="mt-2 text-[10px] text-white/40">Za ta izlet ni zabeleženih stroškov dobavitelja.</p>
                              )}
                            </div>
                          ) : null}
                        </div>
                      </details>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
