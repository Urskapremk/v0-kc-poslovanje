'use client'

import React, { useEffect, useState } from 'react'
import useSWR, { mutate } from 'swr'
import { Receipt, Plus, Trash2, ExternalLink, ChevronDown, ChevronRight, FileText, Pencil, Check, X } from 'lucide-react'
import {
  getStroskiReceipts,
  deleteStroskiReceipt,
  updateStroskiReceipt,
  type StroskiReceipt,
} from '@/app/actions/stroski-arhiv'
import { getExchangeRate } from '@/app/actions/komba'
import { STROSEK_CATEGORIES, CATEGORY_LABELS, type StrosekCategory } from '@/lib/stroski-categories'
import StroskiReceiptCaptureModal from './stroski-receipt-capture-modal'

type Currency = 'EUR' | 'Ar'

const MONTH_NAMES = ['januar', 'februar', 'marec', 'april', 'maj', 'junij', 'julij', 'avgust', 'september', 'oktober', 'november', 'december']

const CAT_COLORS: Record<StrosekCategory, string> = {
  bar: '#7fa8b8',
  nocitve: '#c59b5b',
  kuhinja: '#8fae92',
  wellness: '#d9a68f',
  ostalo: '#b1c7cf',
}

function emptyAlloc(): Record<StrosekCategory, string> {
  return { bar: '', nocitve: '', kuhinja: '', wellness: '', ostalo: '' }
}

// Sešteje zneske po kategorijah za dani nabor računov
function sumByCategory(items: StroskiReceipt[]): { category: StrosekCategory; amountEur: number }[] {
  const totals = {} as Record<StrosekCategory, number>
  for (const r of items) {
    for (const c of r.categories) {
      totals[c.category] = (totals[c.category] || 0) + Number(c.amountEur)
    }
  }
  return STROSEK_CATEGORIES
    .filter((c) => (totals[c] || 0) > 0)
    .map((c) => ({ category: c, amountEur: Math.round(totals[c] * 100) / 100 }))
}

function formatEur(n: number) {
  return new Intl.NumberFormat('sl-SI', { style: 'currency', currency: 'EUR' }).format(n || 0)
}

function formatDate(d: string | null) {
  if (!d) return '-'
  return new Intl.DateTimeFormat('sl-SI', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(d))
}

function isImage(pathname: string) {
  return /\.(jpe?g|png|gif|webp|heic|heif)$/i.test(pathname)
}

export default function StroskiArhivTab({ year, month }: { year: number; month: number }) {
  const key = ['stroski-receipts', year]
  const { data: receipts, isLoading } = useSWR(key, () => getStroskiReceipts(year))

  const [showCapture, setShowCapture] = useState(false)
  const [openMonths, setOpenMonths] = useState<Record<number, boolean>>({ [month]: true })
  const [editId, setEditId] = useState<string | null>(null)
  const [editDate, setEditDate] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const [editAlloc, setEditAlloc] = useState<Record<StrosekCategory, string>>(emptyAlloc())
  const [editError, setEditError] = useState<string | null>(null)
  const [editCurrency, setEditCurrency] = useState<Currency>('EUR')
  const [rate, setRate] = useState(4800)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  useEffect(() => {
    getExchangeRate().then(setRate).catch(() => {})
  }, [])

  const editToEur = (v: number) => (editCurrency === 'Ar' ? v / rate : v)
  const editCur = editCurrency === 'Ar' ? 'Ar' : '€'
  const editTol = editCurrency === 'Ar' ? 1 : 0.01
  const editTotal = parseFloat(editAmount) || 0
  const editTotalEur = Math.round(editToEur(editTotal) * 100) / 100
  const editAllocated = STROSEK_CATEGORIES.reduce((s, c) => s + (parseFloat(editAlloc[c]) || 0), 0)
  const editRemaining = Math.round((editTotal - editAllocated) * 100) / 100
  const editHasAlloc = STROSEK_CATEGORIES.some((c) => (parseFloat(editAlloc[c]) || 0) > 0)

  const all = receipts || []
  const yearTotal = all.reduce((s, r) => s + Number(r.amountEur), 0)

  const byMonth = all.reduce<Record<number, StroskiReceipt[]>>((acc, r) => {
    (acc[r.month] ||= []).push(r)
    return acc
  }, {})
  const monthsWithData = Object.keys(byMonth).map(Number).sort((a, b) => b - a)

  const refresh = () => mutate(key)
  const toggleMonth = (m: number) => setOpenMonths((prev) => ({ ...prev, [m]: !prev[m] }))

  function startEdit(r: StroskiReceipt) {
    setEditId(r.id)
    setEditDate(r.date)
    setEditDesc(r.description)
    setEditAmount(String(r.amountEur))
    setEditCurrency('EUR')
    const a = emptyAlloc()
    for (const c of r.categories) a[c.category] = String(c.amountEur)
    setEditAlloc(a)
    setEditError(null)
    setConfirmDelete(null)
  }

  function setEditCat(cat: StrosekCategory, value: string) {
    setEditAlloc((prev) => ({ ...prev, [cat]: value }))
  }

  function editAssignAllTo(cat: StrosekCategory) {
    const next = emptyAlloc()
    next[cat] = editTotal > 0 ? String(editTotal) : ''
    setEditAlloc(next)
  }

  function editAssignRemainderTo(cat: StrosekCategory) {
    const current = parseFloat(editAlloc[cat]) || 0
    setEditAlloc((prev) => ({ ...prev, [cat]: String(Math.round((current + editRemaining) * 100) / 100) }))
  }

  async function saveEdit(id: string) {
    if (editHasAlloc && editTotal > 0 && Math.abs(editRemaining) > editTol) {
      const rem = editCurrency === 'Ar' ? Math.round(editRemaining) : editRemaining.toFixed(2)
      const remAbs = editCurrency === 'Ar' ? Math.round(Math.abs(editRemaining)) : Math.abs(editRemaining).toFixed(2)
      setEditError(
        editRemaining > 0
          ? `Nerazporejeno je še ${rem} ${editCur}.`
          : `Razporejeno je ${remAbs} ${editCur} preveč.`,
      )
      return
    }
    const categories = STROSEK_CATEGORIES
      .map((c) => ({ category: c, amountEur: Math.round(editToEur(parseFloat(editAlloc[c]) || 0) * 100) / 100 }))
      .filter((c) => c.amountEur > 0)
    await updateStroskiReceipt(id, {
      date: editDate,
      description: editDesc.trim(),
      amountEur: editTotalEur,
      categories,
    })
    setEditId(null)
    refresh()
  }

  async function handleDelete(id: string) {
    if (confirmDelete !== id) {
      setConfirmDelete(id)
      setTimeout(() => setConfirmDelete((c) => (c === id ? null : c)), 4000)
      return
    }
    await deleteStroskiReceipt(id)
    setConfirmDelete(null)
    refresh()
  }

  return (
    <div className="space-y-5">
      {/* Glava: skupaj + gumb za dodajanje */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-white/60">
            <Receipt className="h-4 w-4 text-[#c59b5b]" />
            Stroški arhiv (fotografije računov)
          </h3>
          <p className="mt-1 text-xs text-white/40">Arhiv slikanih računov za evidenco. Ne vpliva na izračune v statistiki.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-right">
            <div className="text-[11px] uppercase tracking-wider text-white/50">Skupaj leto {year}</div>
            <div className="text-2xl font-bold text-[#c59b5b]">{formatEur(yearTotal)}</div>
          </div>
          <button
            onClick={() => setShowCapture(true)}
            className="flex items-center gap-2 rounded-xl bg-[#c59b5b] px-4 py-3 text-sm font-semibold text-[#152329] transition-all hover:bg-[#c59b5b]/90"
          >
            <Plus className="h-4 w-4" />
            Nov račun
          </button>
        </div>
      </div>

      {/* Seznam po mesecih */}
      {isLoading ? (
        <p className="text-sm text-white/40">Nalagam...</p>
      ) : monthsWithData.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-12 text-center">
          <Receipt className="mx-auto h-8 w-8 text-white/20" />
          <p className="mt-3 text-sm text-white/50">Za leto {year} še ni arhiviranih računov.</p>
          <button
            onClick={() => setShowCapture(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#c59b5b]/10 px-4 py-2 text-sm font-medium text-[#c59b5b] transition-all hover:bg-[#c59b5b]/20"
          >
            <Plus className="h-4 w-4" />
            Dodaj prvi račun
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {monthsWithData.map((m) => {
            const items = byMonth[m]
            const monthTotal = items.reduce((s, r) => s + Number(r.amountEur), 0)
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
                    {/* Mesečni povzetek po kategorijah */}
                    {(() => {
                      const cats = sumByCategory(items)
                      if (cats.length === 0) return null
                      return (
                        <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] bg-white/[0.02] px-4 py-2.5">
                          <span className="text-[10px] uppercase tracking-wider text-white/40">Po kategorijah:</span>
                          {cats.map((c) => (
                            <span
                              key={c.category}
                              className="rounded-md px-2 py-0.5 text-xs font-medium"
                              style={{ backgroundColor: `${CAT_COLORS[c.category]}22`, color: CAT_COLORS[c.category] }}
                            >
                              {CATEGORY_LABELS[c.category]} {formatEur(c.amountEur)}
                            </span>
                          ))}
                        </div>
                      )
                    })()}
                    <div className="divide-y divide-white/[0.06]">
                    {items.map((r) => (
                      <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                        {/* Sličica / ikona */}
                        <a
                          href={`/api/image?pathname=${encodeURIComponent(r.pathname)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-black/30"
                          title="Odpri račun"
                        >
                          {isImage(r.pathname) ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={`/api/image?pathname=${encodeURIComponent(r.pathname)}`}
                              alt="Račun"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <FileText className="h-5 w-5 text-white/40" />
                          )}
                        </a>

                        {editId === r.id ? (
                          <div className="flex flex-1 flex-col gap-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <input
                                type="date"
                                value={editDate}
                                onChange={(e) => setEditDate(e.target.value)}
                                className="w-36 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white [color-scheme:dark] focus:border-[#c59b5b]/40 focus:outline-none"
                              />
                              <input
                                type="text"
                                value={editDesc}
                                onChange={(e) => setEditDesc(e.target.value)}
                                placeholder="Opis"
                                className="min-w-[140px] flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white focus:border-[#c59b5b]/40 focus:outline-none"
                              />
                              <input
                                type="number"
                                value={editAmount}
                                onChange={(e) => setEditAmount(e.target.value)}
                                className="w-24 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-right text-xs text-white focus:border-[#c59b5b]/40 focus:outline-none"
                              />
                              <div className="flex gap-0.5 rounded-lg bg-white/5 p-0.5">
                                {(['EUR', 'Ar'] as Currency[]).map((c) => (
                                  <button
                                    key={c}
                                    type="button"
                                    onClick={() => setEditCurrency(c)}
                                    className={`rounded-md px-2 py-1 text-[11px] font-medium transition-all ${
                                      editCurrency === c ? 'bg-[#c59b5b]/20 text-[#c59b5b]' : 'text-white/40 hover:text-white/70'
                                    }`}
                                  >
                                    {c === 'EUR' ? '€' : 'Ar'}
                                  </button>
                                ))}
                              </div>
                              <button onClick={() => saveEdit(r.id)} className="rounded-lg bg-[#8fae92]/15 p-2 text-[#8fae92] hover:bg-[#8fae92]/25" title="Shrani">
                                <Check className="h-4 w-4" />
                              </button>
                              <button onClick={() => setEditId(null)} className="rounded-lg bg-white/5 p-2 text-white/40 hover:bg-white/10 hover:text-white" title="Prekliči">
                                <X className="h-4 w-4" />
                              </button>
                              {editCurrency === 'Ar' && editTotal > 0 && (
                                <span className="w-full text-right text-[11px] text-[#8fae92]">≈ {editTotalEur.toFixed(2)} € (tečaj {rate.toLocaleString('sl-SI')} Ar / €)</span>
                              )}
                            </div>

                            {/* Razbitje po kategorijah */}
                            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                              <p className="mb-2 text-[10px] uppercase tracking-wider text-white/40">Razporedi po kategorijah (klikni ime za cel znesek)</p>
                              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                                {STROSEK_CATEGORIES.map((c) => (
                                  <div key={c} className="flex flex-col gap-1">
                                    <button
                                      type="button"
                                      onClick={() => editAssignAllTo(c)}
                                      className="rounded-md px-2 py-1 text-left text-[11px] font-medium transition-all hover:opacity-80"
                                      style={{ backgroundColor: `${CAT_COLORS[c]}22`, color: CAT_COLORS[c] }}
                                    >
                                      {CATEGORY_LABELS[c]}
                                    </button>
                                    <input
                                      type="number"
                                      inputMode="decimal"
                                      value={editAlloc[c]}
                                      onChange={(e) => setEditCat(c, e.target.value)}
                                      placeholder="0.00"
                                      className="w-full rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-right text-xs text-white focus:border-[#c59b5b]/40 focus:outline-none"
                                    />
                                  </div>
                                ))}
                              </div>
                              <div className="mt-2 flex items-center justify-between text-[11px]">
                                <span className="text-white/50">Razporejeno {editAllocated.toLocaleString('sl-SI')} {editCur} / {editTotal.toLocaleString('sl-SI')} {editCur}</span>
                                {editHasAlloc && Math.abs(editRemaining) > editTol ? (
                                  <button
                                    type="button"
                                    onClick={() => editAssignRemainderTo('ostalo')}
                                    className="rounded-md bg-[#c59b5b]/15 px-2 py-1 font-medium text-[#c59b5b] transition-all hover:bg-[#c59b5b]/25"
                                  >
                                    Preostanek {(editCurrency === 'Ar' ? Math.round(editRemaining) : editRemaining).toLocaleString('sl-SI')} {editCur} → Ostalo
                                  </button>
                                ) : editHasAlloc ? (
                                  <span className="font-medium text-[#8fae92]">Ujema se ✓</span>
                                ) : (
                                  <span className="text-white/30">Neobvezno</span>
                                )}
                              </div>
                              {editError && <p className="mt-2 text-[11px] text-red-400">{editError}</p>}
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm text-white/90">{r.description || <span className="text-white/40">Brez opisa</span>}</p>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-xs text-white/40">{formatDate(r.date)}</span>
                                {r.categories.map((c) => (
                                  <span
                                    key={c.category}
                                    className="rounded-md px-1.5 py-0.5 text-[10px] font-medium"
                                    style={{ backgroundColor: `${CAT_COLORS[c.category]}22`, color: CAT_COLORS[c.category] }}
                                  >
                                    {CATEGORY_LABELS[c.category]} {formatEur(Number(c.amountEur))}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <span className="whitespace-nowrap text-sm font-semibold tabular-nums text-white/80">{formatEur(Number(r.amountEur))}</span>
                            <a
                              href={`/api/image?pathname=${encodeURIComponent(r.pathname)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-lg p-2 text-white/40 transition-all hover:bg-white/10 hover:text-white"
                              title="Odpri"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                            <button onClick={() => startEdit(r)} className="rounded-lg p-2 text-white/40 transition-all hover:bg-white/10 hover:text-white" title="Uredi">
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(r.id)}
                              className={`rounded-lg p-2 transition-all ${confirmDelete === r.id ? 'bg-red-500/20 text-red-400' : 'text-white/40 hover:bg-white/10 hover:text-red-400'}`}
                              title={confirmDelete === r.id ? 'Klikni znova za izbris' : 'Izbriši'}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <StroskiReceiptCaptureModal isOpen={showCapture} onClose={() => setShowCapture(false)} onSaved={refresh} />
    </div>
  )
}
