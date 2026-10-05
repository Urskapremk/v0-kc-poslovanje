'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import useSWR from 'swr'
import { Coins, Printer, X, RotateCcw, Users, Upload, FileText, Trash2, Paperclip, Save } from 'lucide-react'
import { getAllStaffMembers } from '@/app/actions/statistics'
import { getMgCompany } from '@/lib/payroll-mg'
import { buildNapitninaHtml, type NapitninaRow } from '@/lib/napitnina-doc'
import {
  getNapitninaDocuments,
  addNapitninaDocument,
  deleteNapitninaDocument,
  getNapitninaDraft,
  saveNapitninaDraft,
} from '@/app/actions/napitnina'

const MONTHS_SL = [
  'Januar', 'Februar', 'Marec', 'April', 'Maj', 'Junij',
  'Julij', 'Avgust', 'September', 'Oktober', 'November', 'December',
]
const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

// Barvni logo vgradimo kot data URI, da se ZANESLJIVO natisne (enak vzorec kot placilna lista).
async function loadLogoDataUrl(): Promise<string | undefined> {
  try {
    const res = await fetch('/images/komba-logo-color.png')
    const blob = await res.blob()
    return await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = () => resolve(undefined)
      reader.readAsDataURL(blob)
    })
  } catch {
    return undefined
  }
}

function fmtAr(v: number): string {
  if (!v) return '0 Ar'
  return Math.round(v).toLocaleString('sl-SI') + ' Ar'
}

function peopleLabel(n: number): string {
  if (n === 1) return '1 oseba'
  if (n === 2) return '2 osebi'
  if (n === 3 || n === 4) return `${n} osebe`
  return `${n} oseb`
}

export default function NapitninaTab({ year, month }: { year: number; month: number }) {
  const { data: staff } = useSWR('all-staff-members', getAllStaffMembers)

  // Naloženi podpisani dokumenti / fotografije za ta mesec
  const docsKey = `napitnina-docs-${year}-${month}`
  const { data: docs, mutate: mutateDocs } = useSWR(docsKey, () =>
    getNapitninaDocuments(year, month),
  )

  // znesek napitnine na zaposlenega (id -> string), odstranjeni delavci, prisotni pri stetju
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const [removed, setRemoved] = useState<Set<string>>(new Set())
  const [present, setPresent] = useState<Set<string>>(new Set())
  const [upToDate, setUpToDate] = useState('')
  const [printing, setPrinting] = useState(false)
  // Znesek, ki ga vpiše vsem na seznamu. Privzeto 180.000 Ar, lahko pa ga spremeni.
  const [bulkAmount, setBulkAmount] = useState('180.000')
  const [uploadingDoc, setUploadingDoc] = useState(false)
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const loadedDraft = useRef<string | null>(null)
  const dirty = useRef(false)

  const draftKey = `napitnina-draft-${year}-${month}`
  const { data: draft, mutate: mutateDraft } = useSWR(draftKey, () => getNapitninaDraft(year, month))

  useEffect(() => {
    loadedDraft.current = null
    dirty.current = false
  }, [year, month])

  useEffect(() => {
    const key = `${year}-${month}`
    if (draft === undefined || loadedDraft.current === key) return
    loadedDraft.current = key
    if (!draft || dirty.current) return
    setAmounts(draft.amounts || {})
    setRemoved(new Set(draft.removed || []))
    setPresent(new Set(draft.present || []))
    setUpToDate(draft.upToDate || '')
  }, [draft, year, month])

  async function handleUploadDocument(file: File) {
    setUploadingDoc(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/upload-napitnina-document', { method: 'POST', body: fd })
      if (!res.ok) throw new Error('Upload failed')
      const { pathname } = await res.json()
      await addNapitninaDocument(year, month, pathname, file.name)
      mutateDocs()
    } catch (e) {
      console.error('[v0] napitnina document upload error:', e)
      alert('Nalaganje dokumenta ni uspelo.')
    } finally {
      setUploadingDoc(false)
    }
  }

  async function handleDeleteDocument(id: string) {
    setDeletingDocId(id)
    try {
      await deleteNapitninaDocument(id)
      mutateDocs()
    } catch (e) {
      console.error('[v0] napitnina document delete error:', e)
    } finally {
      setDeletingDocId(null)
    }
  }

  const activeStaff = useMemo(
    () => (staff ?? []).filter((s) => s.active),
    [staff],
  )
  const listStaff = useMemo(
    () => activeStaff.filter((s) => !removed.has(s.id)),
    [activeStaff, removed],
  )
  const removedStaff = useMemo(
    () => activeStaff.filter((s) => removed.has(s.id)),
    [activeStaff, removed],
  )

  const displayName = (s: (typeof activeStaff)[number]) => {
    const base = `${s.lastName || ''} ${s.firstName || ''}`.trim() || s.staffName
    return s.nickname ? `${base} „${s.nickname}"` : base
  }

  const total = useMemo(
    () => listStaff.reduce((a, s) => a + (Number(amounts[s.id]) || 0), 0),
    [listStaff, amounts],
  )

  function toggleRemoved(id: string) {
    dirty.current = true
    setSavedFlash(false)
    setRemoved((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  function togglePresent(id: string) {
    dirty.current = true
    setSavedFlash(false)
    setPresent((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  // Izpolni znesek pri vseh zaposlenih na seznamu z isto vrednostjo.
  function fillAll(amountAr: number) {
    dirty.current = true
    setAmounts((prev) => {
      const next = { ...prev }
      listStaff.forEach((s) => {
        next[s.id] = String(amountAr)
      })
      return next
    })
  }
  function applyBulk() {
    const digits = bulkAmount.replace(/[^\d]/g, '')
    if (!digits) return
    fillAll(Number(digits))
    setSavedFlash(false)
  }

  async function handleSave() {
    setSaving(true)
    setSavedFlash(false)
    try {
      const saved = {
        amounts,
        removed: [...removed],
        present: [...present],
        upToDate,
      }
      await saveNapitninaDraft(year, month, saved)
      await mutateDraft(saved, false)
      dirty.current = false
      setSavedFlash(true)
    } catch (e) {
      console.error('[v0] napitnina save error:', e)
      alert('Shranjevanje ni uspelo. Poskusi znova.')
    } finally {
      setSaving(false)
    }
  }

  async function handlePrint() {
    setPrinting(true)
    try {
      const company = getMgCompany('tourism')
      const logoDataUrl = await loadLogoDataUrl()
      const rows: NapitninaRow[] = listStaff.map((s) => ({
        name: displayName(s),
        fonction: s.staffType || undefined,
        amountAr: Number(amounts[s.id]) || 0,
      }))
      const presentNames = activeStaff
        .filter((s) => present.has(s.id))
        .map((s) => displayName(s))
      // Datum "do" v francoskem zapisu (npr. 31 juillet 2026)
      let upToDateFr: string | undefined
      if (upToDate) {
        const d = new Date(upToDate + 'T00:00:00')
        if (!isNaN(d.getTime())) {
          upToDateFr = `${d.getDate()} ${MONTHS_FR[d.getMonth()].toLowerCase()} ${d.getFullYear()}`
        }
      }
      const html = buildNapitninaHtml({
        company: company.name,
        companyAddress: company.address,
        monthLabelFr: `${MONTHS_FR[(month - 1) % 12]} ${year}`,
        upToDateFr,
        rows,
        presentNames,
        totalAr: total,
        logoDataUrl,
      })
      const iframe = document.createElement('iframe')
      iframe.style.position = 'fixed'
      iframe.style.right = '0'
      iframe.style.bottom = '0'
      iframe.style.width = '0'
      iframe.style.height = '0'
      iframe.style.border = '0'
      document.body.appendChild(iframe)
      const doc = iframe.contentWindow?.document
      if (!doc) return
      doc.open()
      doc.write(html)
      doc.close()
      setTimeout(() => {
        iframe.contentWindow?.focus()
        iframe.contentWindow?.print()
        setTimeout(() => document.body.removeChild(iframe), 1000)
      }, 300)
    } finally {
      setPrinting(false)
    }
  }

  const inputCls =
    'w-32 rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-sm text-white text-right tabular-nums placeholder:text-white/25 focus:border-[#c59b5b]/50 focus:outline-none'

  return (
    <div className="space-y-5">
      {/* Glava */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Coins className="h-5 w-5 text-[#c59b5b]" />
          <div>
            <h2 className="text-lg font-semibold text-white">Napitnina – razdelitev</h2>
            <p className="text-xs text-white/40">
              Obdobje: {MONTHS_SL[(month - 1) % 12]} {year} · na seznamu {peopleLabel(listStaff.length)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wide text-white/40">Napitnina do datuma</span>
            <input
              type="date"
              value={upToDate}
              onChange={(e) => {
                dirty.current = true
                setSavedFlash(false)
                setUpToDate(e.target.value)
              }}
              className="rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-sm text-white [color-scheme:dark] focus:border-[#c59b5b]/50 focus:outline-none"
            />
          </label>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || listStaff.length === 0}
            className="flex items-center gap-2 rounded-xl bg-[#c59b5b] px-4 py-2 text-sm font-medium text-[#0a2029] transition-colors hover:bg-[#d4b074] disabled:opacity-40"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Shranjujem…' : savedFlash ? 'Shranjeno' : 'Shrani'}
          </button>
          <button
            onClick={handlePrint}
            disabled={printing || listStaff.length === 0}
            className="flex items-center gap-2 rounded-xl bg-[#c59b5b]/20 px-4 py-2 text-sm font-medium text-[#c59b5b] border border-[#c59b5b]/30 transition-colors hover:bg-[#c59b5b]/30 disabled:opacity-40"
          >
            <Printer className="h-4 w-4" />
            {printing ? 'Pripravljam…' : 'Natisni / izvozi PDF'}
          </button>
        </div>
      </div>

      {/* Seznam zaposlenih z zneski */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1">
          <span className="text-[11px] uppercase tracking-wide text-white/40">
            Zaposleni · {peopleLabel(listStaff.length)}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5">
              <span className="text-[11px] uppercase tracking-wide text-white/40">Vsem</span>
              <input
                type="text"
                inputMode="numeric"
                value={bulkAmount}
                onChange={(e) => setBulkAmount(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    applyBulk()
                  }
                }}
                aria-label="Znesek napitnine za vse, v ariarijih"
                className="w-24 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-right text-xs tabular-nums text-white placeholder:text-white/25 focus:border-[#c59b5b]/50 focus:outline-none"
              />
              <span className="text-[11px] text-white/40">Ar</span>
            </label>
            <button
              type="button"
              onClick={applyBulk}
              disabled={listStaff.length === 0 || !bulkAmount.replace(/[^\d]/g, '')}
              className="rounded-lg border border-[#c59b5b]/25 bg-[#c59b5b]/10 px-2.5 py-1 text-[11px] font-medium text-[#c59b5b] transition-colors hover:bg-[#c59b5b]/20 disabled:opacity-40"
            >
              Vpiši vsem
            </button>
            <span className="text-[11px] uppercase tracking-wide text-white/40">Znesek napitnine (Ar)</span>
          </div>
        </div>
        <div className="divide-y divide-white/5">
          {listStaff.map((s) => (
            <div key={s.id} className="flex items-center gap-3 py-2.5">
              <button
                onClick={() => toggleRemoved(s.id)}
                title="Odstrani delavca s seznama"
                aria-label={`Odstrani ${displayName(s)} s seznama`}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white/30 transition-colors hover:bg-red-500/15 hover:text-red-400"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{displayName(s)}</p>
                {s.staffType && (
                  <p className="truncate text-[11px] text-white/35">{s.staffType}</p>
                )}
              </div>
              <input
                type="number"
                min="0"
                inputMode="numeric"
                placeholder="0"
                className={inputCls}
                value={amounts[s.id] ?? ''}
                onChange={(e) => {
                  dirty.current = true
                  setSavedFlash(false)
                  setAmounts((prev) => ({ ...prev, [s.id]: e.target.value }))
                }}
              />
            </div>
          ))}
          {listStaff.length === 0 && (
            <p className="py-6 text-center text-sm text-white/40">Ni aktivnih zaposlenih na seznamu.</p>
          )}
        </div>

        {/* Skupaj */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#c59b5b]/10 px-4 py-3">
          <span className="text-sm font-medium uppercase tracking-wide text-[#c59b5b]">
            Skupaj razdeljeno · {peopleLabel(listStaff.length)}
          </span>
          <span className="text-base font-semibold tabular-nums text-white">{fmtAr(total)}</span>
        </div>
      </div>

      {/* Odstranjeni delavci (obnovitev) */}
      {removedStaff.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <p className="mb-2 text-[11px] uppercase tracking-wide text-white/40">
            Odstranjeni s seznama ({removedStaff.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {removedStaff.map((s) => (
              <button
                key={s.id}
                onClick={() => toggleRemoved(s.id)}
                className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/60 transition-colors hover:bg-white/10 hover:text-white"
              >
                <RotateCcw className="h-3 w-3" />
                {displayName(s)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Prisotni pri stetju napitnine */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
        <div className="mb-3 flex items-center gap-2">
          <Users className="h-4 w-4 text-[#8fae92]" />
          <span className="text-sm font-medium text-white">Prisotni pri štetju napitnine</span>
        </div>
        <p className="mb-3 text-[11px] text-white/40">
          Izberi zaposlene, ki so bili prisotni pri štetju – na dokumentu dobijo črto za podpis.
        </p>
        <div className="flex flex-wrap gap-2">
          {activeStaff.map((s) => {
            const on = present.has(s.id)
            return (
              <button
                key={s.id}
                onClick={() => togglePresent(s.id)}
                aria-pressed={on}
                className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                  on
                    ? 'border-[#8fae92]/40 bg-[#8fae92]/20 text-[#8fae92]'
                    : 'border-white/10 bg-white/5 text-white/55 hover:bg-white/10'
                }`}
              >
                {on ? '✓ ' : ''}
                {displayName(s)}
              </button>
            )
          })}
          {activeStaff.length === 0 && (
            <span className="text-sm text-white/40">Ni zaposlenih.</span>
          )}
        </div>
      </div>

      {/* Podpisani dokumenti / fotografije za ta mesec */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Paperclip className="h-4 w-4 text-[#c59b5b]" />
            <div>
              <span className="text-sm font-medium text-white">Podpisani dokumenti / fotografije</span>
              <p className="text-[11px] text-white/40">
                {MONTHS_SL[(month - 1) % 12]} {year} · naloži sliko ali PDF podpisanega prevzema napitnine
              </p>
            </div>
          </div>
          <label
            className={`flex cursor-pointer items-center gap-2 rounded-xl border border-[#c59b5b]/30 bg-[#c59b5b]/20 px-4 py-2 text-sm font-medium text-[#c59b5b] transition-colors hover:bg-[#c59b5b]/30 ${
              uploadingDoc ? 'pointer-events-none opacity-60' : ''
            }`}
          >
            <Upload className="h-4 w-4" />
            {uploadingDoc ? 'Nalagam…' : 'Naloži dokument'}
            <input
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleUploadDocument(f)
                e.target.value = ''
              }}
            />
          </label>
        </div>

        {docs && docs.length > 0 ? (
          <div className="divide-y divide-white/5">
            {docs.map((d) => (
              <div key={d.id} className="flex items-center gap-3 py-2.5">
                <FileText className="h-4 w-4 shrink-0 text-white/40" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-white">{d.fileName || 'Dokument'}</p>
                  {d.uploadedAt && (
                    <p className="text-[11px] text-white/35">
                      Naloženo: {new Date(d.uploadedAt).toLocaleDateString('sl-SI')}
                    </p>
                  )}
                </div>
                <a
                  href={`/api/image?pathname=${encodeURIComponent(d.pathname)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 rounded-lg bg-[#8fae92]/15 px-3 py-2 text-xs text-[#8fae92] transition-colors hover:bg-[#8fae92]/25"
                >
                  <FileText className="h-3.5 w-3.5" /> Poglej
                </a>
                <button
                  onClick={() => handleDeleteDocument(d.id)}
                  disabled={deletingDocId === d.id}
                  aria-label="Izbriši dokument"
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-white/40 transition-colors hover:bg-red-500/15 hover:text-red-400 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-4 text-center text-sm text-white/40">
            Ni naloženih dokumentov za ta mesec.
          </p>
        )}
      </div>
    </div>
  )
}
