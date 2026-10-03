'use client'

import React, { useState, useMemo } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { ArrowLeft, Search, LogIn, LogOut, Ship, Car, Users, Pencil, ChevronDown } from 'lucide-react'
import { getArchivedTransfers } from '@/app/actions/komba'
import { paySupplier, unpaySupplier, type SupplierPayMethod, type SupplierPayCompany } from '@/app/actions/supplier-payment'
import { bungalowDisplayName } from '@/lib/bungalow'

const fetcher = async () => await getArchivedTransfers()
const ar = (v: number) => `${Math.round(v || 0).toLocaleString('de-DE')} Ar`

type ArchivedTransfer = Awaited<ReturnType<typeof getArchivedTransfers>>['items'][number]
type PaidInfo = ArchivedTransfer['dilipPaid']

function SupplierPayPanel({
  refKey, supplier, amountAr, supplierLabel, accent, label, paid, onDone,
}: {
  refKey: string
  supplier: string
  amountAr: number
  supplierLabel: string
  accent: string
  label: string
  paid: PaidInfo
  onDone: () => void
}) {
  const [open, setOpen] = useState(false)
  const [method, setMethod] = useState<SupplierPayMethod>('cash')
  const [company, setCompany] = useState<SupplierPayCompany>('tourism')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    await paySupplier({ refKey, supplier, method, company: method === 'cash' ? company : undefined, date, amountAr, label })
    setSaving(false)
    setOpen(false)
    onDone()
  }
  const cancel = async () => {
    setSaving(true)
    await unpaySupplier({ refKey })
    setSaving(false)
    onDone()
  }
  const startEdit = () => {
    if (paid) {
      setMethod((paid.method as SupplierPayMethod) || 'cash')
      setCompany((paid.company as SupplierPayCompany) || 'tourism')
      if (paid.paidAt) setDate(paid.paidAt)
    }
    setOpen(true)
  }

  // Priority: open form (also for editing) → paid state → "Plačaj" button
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
            {saving ? 'Shranjujem...' : 'Zabeleži plačilo'}
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
            {supplierLabel} plačan ✓ · {paid.method === 'orange' ? <span className="text-[#c4741f]">Orange Money</span> : 'Gotovina'}
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
      {supplier === 'dilip' ? <Ship className="h-4 w-4" /> : <Car className="h-4 w-4" />}
      Plačaj {supplierLabel} · {ar(amountAr)}
    </button>
  )
}

export default function ArhivTransferjiPage() {
  const [search, setSearch] = useState('')
  const { data, isLoading, error, mutate } = useSWR('archived-transfers', fetcher, { revalidateOnFocus: false })

  const filtered = useMemo(() => {
    const items = data?.items || []
    if (!search.trim()) return items
    const q = search.toLowerCase()
    return items.filter(t =>
      t.guestName?.toLowerCase().includes(q) ||
      t.bungalow?.toLowerCase().includes(q) ||
      t.routeName?.toLowerCase().includes(q)
    )
  }, [data, search])

  // Group by day, newest first (list is already sorted desc by date)
  const groups = useMemo(() => {
    const map = new Map<string, ArchivedTransfer[]>()
    for (const t of filtered) {
      const arr = map.get(t.date) || []
      arr.push(t)
      map.set(t.date, arr)
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
                <h1 className="text-xl font-bold text-[#c59b5b]">Arhiv prihodov / odhodov</h1>
                <p className="text-sm text-white/40">Vsa opozorila o transferjih do danes · klikni za plačilo</p>
              </div>
            </div>
            {data?.items && (
              <p className="text-sm text-white/40">{filtered.length} transferjev</p>
            )}
          </div>

          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              placeholder="Išči po gostu, bungalovu, relaciji..."
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
            {search ? 'Ni rezultatov za iskanje' : 'Ni arhiviranih transferjev'}
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
                  {items.map((t) => {
                    const isArrival = t.type === 'arrival'
                    const TypeIcon = isArrival ? LogIn : LogOut
                    const typeColor = isArrival ? '#6f9a72' : '#c4744a'
                    const shortBungalow = bungalowDisplayName(t.bungalow)
                    const dilipLabel = `Prevoz Dilip (čoln) — ${shortBungalow} / ${t.guestName}${t.routeName ? ` · ${t.routeName}` : ''}`.slice(0, 200)
                    const taxiName = t.taxiName || 'Herman'
                    const hermanLabel = `Prevoz ${taxiName} (avto) — ${shortBungalow} / ${t.guestName}${t.routeName ? ` · ${t.routeName}` : ''}`.slice(0, 200)
                    const hasPay = t.dilipCostAr > 0 || t.hermanCostAr > 0
                    return (
                      <details key={t.id} className="group rounded-xl border border-white/10 bg-white/[0.03] transition-colors open:bg-white/[0.05] hover:bg-white/[0.05]">
                        <summary className="flex cursor-pointer list-none items-start gap-2.5 px-3 py-2.5 [&::-webkit-details-marker]:hidden">
                          <span
                            className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full"
                            style={{ backgroundColor: `${typeColor}22`, color: typeColor }}
                          >
                            <TypeIcon className={`h-3.5 w-3.5 ${isArrival ? '' : 'scale-x-[-1]'}`} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-medium text-white">
                              {shortBungalow} · {t.guestName}
                            </p>
                            <p className="truncate text-[11px]" style={{ color: '#a8c6d2' }}>
                              <span className="font-medium" style={{ color: typeColor }}>{isArrival ? 'Prihod' : 'Odhod'}</span>
                              {t.routeName ? <> · {t.routeName}</> : null}
                              {t.time ? <span className="text-white/50"> · {t.time}</span> : null}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-white/40">
                              <span className="flex items-center gap-1"><Users className="h-3 w-3" />{t.pax} os</span>
                              {t.boatName ? <span className="flex items-center gap-1"><Ship className="h-3 w-3" />{t.boatName}</span> : null}
                              {t.flightNumber ? <span>Let {t.flightNumber}</span> : null}
                            </div>
                          </div>
                          {t.executed && (
                            <span className="flex-shrink-0 rounded-full bg-[#8fae92]/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[#8fae92]">
                              Izveden
                            </span>
                          )}
                          <ChevronDown className="mt-0.5 h-4 w-4 flex-shrink-0 text-white/30 transition-transform group-open:rotate-180" />
                        </summary>
                        <div className="border-t border-white/5 px-3 pb-3 pt-2">
                          {hasPay ? (
                            <>
                              {t.dilipCostAr > 0 && (
                                <SupplierPayPanel
                                  refKey={t.dilipRefKey} supplier="dilip" amountAr={t.dilipCostAr}
                                  supplierLabel="Dilip (čoln)" accent="#3f6b7d" label={dilipLabel}
                                  paid={t.dilipPaid} onDone={() => mutate()}
                                />
                              )}
                              {t.hermanCostAr > 0 && (
                                <SupplierPayPanel
                                  refKey={t.hermanRefKey} supplier={t.taxiSupplier || 'herman'} amountAr={t.hermanCostAr}
                                  supplierLabel={`${taxiName} (${t.hermanRouteName || 'avto'})`} accent="#4f7a54" label={hermanLabel}
                                  paid={t.hermanPaid} onDone={() => mutate()}
                                />
                              )}
                            </>
                          ) : (
                            <p className="py-1 text-[11px] text-white/40">Za ta transfer ni zabeleženega stroška prevoznika.</p>
                          )}
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
