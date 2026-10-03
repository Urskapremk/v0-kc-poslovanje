'use client'

import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Camera, Upload, Loader2, Receipt, Sparkles, SplitSquareHorizontal } from 'lucide-react'
import { addStroskiReceipt } from '@/app/actions/stroski-arhiv'
import { getExchangeRate } from '@/app/actions/komba'
import {
  STROSEK_CATEGORIES,
  CATEGORY_LABELS,
  type StrosekCategory,
  type CategoryAllocation,
} from '@/lib/stroski-categories'

type Currency = 'EUR' | 'Ar'

// Ključa za shranjevanje osnutka (da fotografiranje ne "vrže ven" uporabnice:
// če mobilni brskalnik osveži stran ob vrnitvi iz kamere, obnovimo modal + podatke).
const DRAFT_KEY = 'stroski-capture-draft'
export const STROSKI_CAPTURE_OPEN_KEY = 'stroski-capture-open'

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function emptyAlloc(): Record<StrosekCategory, string> {
  return { bar: '', nocitve: '', kuhinja: '', wellness: '', ostalo: '' }
}

// Pomanjša sliko na največ maxDim px in vrne JPEG dataURL (manjši = manj pomnilnika, hitrejši prenos)
async function fileToDownscaledDataUrl(f: File, maxDim = 1400, quality = 0.7): Promise<string> {
  const srcUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(f)
  })
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const im = new Image()
    im.onload = () => resolve(im)
    im.onerror = reject
    im.src = srcUrl
  })
  let width = img.naturalWidth || img.width
  let height = img.naturalHeight || img.height
  if (width > maxDim || height > maxDim) {
    if (width >= height) {
      height = Math.round((height * maxDim) / width)
      width = maxDim
    } else {
      width = Math.round((width * maxDim) / height)
      height = maxDim
    }
  }
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return srcUrl
  ctx.drawImage(img, 0, 0, width, height)
  return canvas.toDataURL('image/jpeg', quality)
}

// dataURL -> Blob (za nalaganje na strežnik)
function dataUrlToBlob(dataUrl: string): Blob {
  const [head, b64] = dataUrl.split(',')
  const mime = head.match(/:(.*?);/)?.[1] || 'image/jpeg'
  const bin = atob(b64)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return new Blob([arr], { type: mime })
}

export default function StroskiReceiptCaptureModal({
  isOpen,
  onClose,
  onSaved,
}: {
  isOpen: boolean
  onClose: () => void
  onSaved?: () => void
}) {
  const cameraRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Slika je predstavljena kot pomanjšan dataURL (preživi osvežitev strani).
  const [imageData, setImageData] = useState<string | null>(null)
  const [imageName, setImageName] = useState('')
  const [date, setDate] = useState(todayIso())
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reading, setReading] = useState(false)
  const [autoFilled, setAutoFilled] = useState(false)
  const [alloc, setAlloc] = useState<Record<StrosekCategory, string>>(emptyAlloc())
  const [currency, setCurrency] = useState<Currency>('EUR')
  const [rate, setRate] = useState(4800)
  const restoredRef = useRef(false)

  // Naloži menjalni tečaj ob odprtju
  useEffect(() => {
    if (isOpen) getExchangeRate().then(setRate).catch(() => {})
  }, [isOpen])

  // OB PRVEM MOUNTU: obnovi morebitni osnutek (če je stran osvežila kamera na telefonu)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY)
      if (raw) {
        const d = JSON.parse(raw)
        if (d.imageData) setImageData(d.imageData)
        if (d.imageName) setImageName(d.imageName)
        if (d.date) setDate(d.date)
        if (typeof d.description === 'string') setDescription(d.description)
        if (typeof d.amount === 'string') setAmount(d.amount)
        if (d.currency === 'EUR' || d.currency === 'Ar') setCurrency(d.currency)
        if (d.alloc) setAlloc({ ...emptyAlloc(), ...d.alloc })
      }
    } catch {
      // ignoriraj (npr. zaseben način)
    }
    restoredRef.current = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sproti shranjuj osnutek (samo ko je modal odprt in ima vsebino) -> preživi osvežitev
  useEffect(() => {
    if (!isOpen || !restoredRef.current) return
    const hasContent = !!imageData || !!amount || !!description.trim()
    try {
      if (hasContent) {
        sessionStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({ imageData, imageName, date, description, amount, currency, alloc }),
        )
        sessionStorage.setItem(STROSKI_CAPTURE_OPEN_KEY, '1')
      }
    } catch {
      // ignoriraj
    }
  }, [isOpen, imageData, imageName, date, description, amount, currency, alloc])

  function clearDraft() {
    try {
      sessionStorage.removeItem(DRAFT_KEY)
      sessionStorage.removeItem(STROSKI_CAPTURE_OPEN_KEY)
    } catch {
      // ignoriraj
    }
  }

  // Pretvorba v EUR (če je vnos v Ar, deli s tečajem)
  const toEur = (v: number) => (currency === 'Ar' ? v / rate : v)

  const totalAmount = parseFloat(amount) || 0
  const totalEur = Math.round(toEur(totalAmount) * 100) / 100
  const allocatedTotal = STROSEK_CATEGORIES.reduce((s, c) => s + (parseFloat(alloc[c]) || 0), 0)
  const allocRemaining = Math.round((totalAmount - allocatedTotal) * 100) / 100
  const hasAlloc = STROSEK_CATEGORIES.some((c) => (parseFloat(alloc[c]) || 0) > 0)
  const cur = currency === 'Ar' ? 'Ar' : '€'

  function reset() {
    setImageData(null)
    setImageName('')
    setDate(todayIso())
    setDescription('')
    setAmount('')
    setError(null)
    setReading(false)
    setAutoFilled(false)
    setAlloc(emptyAlloc())
    setCurrency('EUR')
    clearDraft()
  }

  // Nastavi znesek kategorije
  function setCatAmount(cat: StrosekCategory, value: string) {
    setAlloc((prev) => ({ ...prev, [cat]: value }))
  }

  // Celoten znesek dodeli eni kategoriji (ostale sprazni)
  function assignAllTo(cat: StrosekCategory) {
    const next = emptyAlloc()
    next[cat] = totalAmount > 0 ? String(totalAmount) : ''
    setAlloc(next)
  }

  // Preostanek dodeli izbrani kategoriji
  function assignRemainderTo(cat: StrosekCategory) {
    const current = parseFloat(alloc[cat]) || 0
    const add = allocRemaining
    setAlloc((prev) => ({ ...prev, [cat]: String(Math.round((current + add) * 100) / 100) }))
  }

  // Samodejno prebere znesek/datum/opis iz slike računa (prek API poti)
  async function runOcr(dataUrl: string) {
    setReading(true)
    setAutoFilled(false)
    try {
      const fd = new FormData()
      fd.append('file', dataUrlToBlob(dataUrl), 'receipt.jpg')
      const res = await fetch('/api/read-receipt', { method: 'POST', body: fd })
      if (!res.ok) return
      const result: { amountEur: number | null; date: string | null; description: string | null } = await res.json()
      let filled = false
      if (typeof result.amountEur === 'number' && result.amountEur > 0) {
        setCurrency('EUR')
        setAmount(String(result.amountEur))
        filled = true
      }
      if (result.date && /^\d{4}-\d{2}-\d{2}$/.test(result.date)) {
        setDate(result.date)
        filled = true
      }
      if (result.description) {
        setDescription((prev) => (prev.trim() ? prev : result.description!.trim()))
        filled = true
      }
      setAutoFilled(filled)
    } catch {
      // tiho — uporabnica lahko vpiše ročno
    } finally {
      setReading(false)
    }
  }

  async function pickFile(f: File | null) {
    if (!f) {
      setImageData(null)
      setImageName('')
      setAutoFilled(false)
      clearDraft()
      return
    }
    setError(null)
    setImageName(f.name)
    try {
      // Slike pomanjšamo (manj pomnilnika -> mobilni brskalnik ne osveži strani); PDF pretvorimo v dataURL.
      const dataUrl = f.type.startsWith('image/')
        ? await fileToDownscaledDataUrl(f)
        : await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result as string)
            reader.onerror = reject
            reader.readAsDataURL(f)
          })
      setImageData(dataUrl)
      // Samodejno branje za slike (OCR); PDF preskočimo pri pomanjšanem prikazu, a ga vseeno beremo
      if (f.type.startsWith('image/') || f.type === 'application/pdf') {
        void runOcr(dataUrl)
      }
    } catch {
      setError('Slike ni bilo mogoče obdelati. Poskusi znova.')
    }
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function handleSave() {
    if (!imageData) {
      setError('Najprej fotografiraj ali naloži račun.')
      return
    }
    // Razbitje: če je vpisano, mora vsota ustrezati znesku računa (toleranca)
    const tol = currency === 'Ar' ? 1 : 0.01
    if (hasAlloc && totalAmount > 0 && Math.abs(allocRemaining) > tol) {
      const rem = currency === 'Ar' ? Math.round(allocRemaining) : allocRemaining.toFixed(2)
      const remAbs = currency === 'Ar' ? Math.round(Math.abs(allocRemaining)) : Math.abs(allocRemaining).toFixed(2)
      setError(
        allocRemaining > 0
          ? `Nerazporejeno je še ${rem} ${cur}. Razporedi celoten znesek ali počisti razbitje.`
          : `Razporejeno je ${remAbs} ${cur} preveč. Popravi zneske.`,
      )
      return
    }
    setSaving(true)
    setError(null)
    try {
      // 1) Naloži datoteko v blob shrambo
      const blob = dataUrlToBlob(imageData)
      const fd = new FormData()
      fd.append('file', blob, imageName || 'receipt.jpg')
      const res = await fetch('/api/upload-stroski-document', { method: 'POST', body: fd })
      if (!res.ok) throw new Error('upload')
      const { pathname } = await res.json()

      // Zneski se shranijo v EUR (Ar se preračuna prek tečaja)
      const categories: CategoryAllocation[] = STROSEK_CATEGORIES
        .map((c) => ({ category: c, amountEur: Math.round(toEur(parseFloat(alloc[c]) || 0) * 100) / 100 }))
        .filter((c) => c.amountEur > 0)

      // 2) Shrani zapis v arhiv
      await addStroskiReceipt({
        date,
        description: description.trim(),
        amountEur: totalEur,
        categories,
        pathname,
        fileName: imageName || 'receipt.jpg',
      })

      reset()
      onSaved?.()
      onClose()
    } catch {
      setError('Shranjevanje ni uspelo. Poskusi znova.')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen || typeof document === 'undefined') return null

  const isPdf = !!imageData && imageData.startsWith('data:application/pdf')

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
      onClick={handleClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#152329] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glava */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-[#c59b5b]" />
            <h2 className="text-sm font-semibold text-white">Nov račun (strošek)</h2>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-1.5 text-white/40 transition-all hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Telo */}
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {/* Skriti vhodi za kamero in disk */}
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          />

          {/* Predogled ali gumbi za zajem */}
          {imageData && !isPdf ? (
            <div className="relative overflow-hidden rounded-xl border border-white/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageData || "/placeholder.svg"} alt="Predogled računa" className="max-h-64 w-full object-contain bg-black/30" />
              <button
                onClick={() => pickFile(null)}
                className="absolute right-2 top-2 rounded-lg bg-black/60 p-1.5 text-white/80 hover:bg-black/80"
                title="Odstrani sliko"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : imageData && isPdf ? (
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
              <span className="truncate">{imageName || 'Dokument PDF'}</span>
              <button onClick={() => pickFile(null)} className="text-white/40 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => cameraRef.current?.click()}
                className="flex flex-col items-center justify-center gap-2 rounded-xl border border-[#c59b5b]/30 bg-[#c59b5b]/10 py-6 text-[#c59b5b] transition-all hover:bg-[#c59b5b]/20"
              >
                <Camera className="h-6 w-6" />
                <span className="text-xs font-medium">Fotografiraj</span>
              </button>
              <button
                onClick={() => fileRef.current?.click()}
                className="flex flex-col items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-6 text-white/70 transition-all hover:bg-white/10 hover:text-white"
              >
                <Upload className="h-6 w-6" />
                <span className="text-xs font-medium">Naloži iz računalnika</span>
              </button>
            </div>
          )}

          {/* Indikator samodejnega branja */}
          {reading && (
            <div className="flex items-center gap-2 rounded-xl border border-[#7fa8b8]/30 bg-[#7fa8b8]/10 px-4 py-2.5 text-sm text-[#7fa8b8]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Berem račun in razbiram znesek...
            </div>
          )}
          {!reading && autoFilled && (
            <div className="flex items-center gap-2 rounded-xl border border-[#8fae92]/30 bg-[#8fae92]/10 px-4 py-2.5 text-sm text-[#8fae92]">
              <Sparkles className="h-4 w-4" />
              Samodejno prebrano — preveri in po potrebi popravi.
            </div>
          )}

          {/* Datum */}
          <div>
            <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">Datum računa</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white [color-scheme:dark] focus:border-[#c59b5b]/40 focus:outline-none"
            />
          </div>

          {/* Opis */}
          <div>
            <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">Opis</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="npr. gorivo, material, popravilo..."
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-[#c59b5b]/40 focus:outline-none"
            />
          </div>

          {/* Znesek + valuta */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="block text-[11px] font-medium uppercase tracking-wider text-white/40">Znesek</label>
              {/* Preklop valute */}
              <div className="flex gap-1 rounded-lg bg-white/5 p-0.5">
                {(['EUR', 'Ar'] as Currency[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCurrency(c)}
                    className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${
                      currency === c ? 'bg-[#c59b5b]/20 text-[#c59b5b]' : 'text-white/40 hover:text-white/70'
                    }`}
                  >
                    {c === 'EUR' ? 'EUR (€)' : 'Ariary (Ar)'}
                  </button>
                ))}
              </div>
            </div>
            <div className="relative">
              <input
                type="number"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 pr-12 text-right text-sm text-white focus:border-[#c59b5b]/40 focus:outline-none"
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-white/40">{cur}</span>
            </div>
            {/* Preračun */}
            {currency === 'Ar' && totalAmount > 0 && (
              <p className="mt-2 text-right text-xs text-[#8fae92]">≈ {totalEur.toFixed(2)} € (tečaj {rate.toLocaleString('sl-SI')} Ar / €)</p>
            )}
          </div>

          {/* Razbitje po kategorijah */}
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <div className="mb-3 flex items-center gap-2">
              <SplitSquareHorizontal className="h-4 w-4 text-[#c59b5b]" />
              <span className="text-[11px] font-medium uppercase tracking-wider text-white/50">Razporedi po kategorijah</span>
            </div>
            <p className="mb-3 text-xs text-white/40">
              Razbij znesek po kategorijah (npr. nekaj na bar, nekaj kuhinja). Vpiši samo tam, kjer želiš — pusti prazno, če ni potrebno.
            </p>

            <div className="space-y-2">
              {STROSEK_CATEGORIES.map((c) => (
                <div key={c} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => assignAllTo(c)}
                    title="Celoten znesek na to kategorijo"
                    className="w-24 shrink-0 rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-left text-xs font-medium text-white/70 transition-all hover:border-[#c59b5b]/40 hover:text-white"
                  >
                    {CATEGORY_LABELS[c]}
                  </button>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={alloc[c]}
                    onChange={(e) => setCatAmount(c, e.target.value)}
                    placeholder="0.00"
                    className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-right text-sm text-white focus:border-[#c59b5b]/40 focus:outline-none"
                  />
                </div>
              ))}
            </div>

            {/* Povzetek razporeditve */}
            {(hasAlloc || totalAmount > 0) && (
              <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3 text-xs">
                <span className="text-white/50">
                  Razporejeno {allocatedTotal.toLocaleString('sl-SI')} {cur} / {totalAmount.toLocaleString('sl-SI')} {cur}
                </span>
                {hasAlloc && Math.abs(allocRemaining) > (currency === 'Ar' ? 1 : 0.01) ? (
                  <button
                    type="button"
                    onClick={() => assignRemainderTo('ostalo')}
                    className="rounded-md bg-[#c59b5b]/15 px-2 py-1 font-medium text-[#c59b5b] transition-all hover:bg-[#c59b5b]/25"
                    title="Preostanek dodeli kategoriji Ostalo"
                  >
                    Preostanek {(currency === 'Ar' ? Math.round(allocRemaining) : allocRemaining).toLocaleString('sl-SI')} {cur} → Ostalo
                  </button>
                ) : hasAlloc ? (
                  <span className="font-medium text-[#8fae92]">Ujema se ✓</span>
                ) : (
                  <span className="text-white/30">Neobvezno</span>
                )}
              </div>
            )}
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>

        {/* Noga */}
        <div className="flex gap-2 border-t border-white/10 px-5 py-4">
          <button
            onClick={handleClose}
            className="flex-1 rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-medium text-white/70 transition-all hover:bg-white/10 hover:text-white"
          >
            Prekliči
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !imageData}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#c59b5b] py-3 text-sm font-semibold text-[#152329] transition-all hover:bg-[#c59b5b]/90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />}
            {saving ? 'Shranjujem...' : 'Shrani račun'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
