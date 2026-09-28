'use client'

import React, { useEffect, useRef, useState } from 'react'
import useSWR, { mutate } from 'swr'
import { Receipt, Plus, Trash2, ExternalLink, ChevronDown, ChevronRight, ChevronLeft, FileText, Pencil, Check, X, Layers, Languages, Loader2, ImagePlus, ScanLine, Merge, Mail, Building2, Send, CreditCard, Smartphone, Banknote, Printer, Maximize2, Scissors } from 'lucide-react'
import {
  getStroskiReceipts,
  deleteStroskiReceipt,
  updateStroskiReceipt,
  addStroskiReceiptPages,
  saveStroskiTranslation,
  mergeStroskiReceipts,
  splitStroskiReceipt,
  getAccountingEmail,
  setAccountingEmail,
  sendReceiptToAccounting,
  recognizeAllStroskiReceipts,
  setReceiptPaymentMethod,
  getOmMatchesForReceipt,
  getBankMatchesForReceipt,
  type StroskiReceipt,
  type PaymentMethod,
  type OmMatch,
  type BankMatch,
} from '@/app/actions/stroski-arhiv'
import { getExchangeRate } from '@/app/actions/komba'
import { addFixedAsset, getFixedAssetReceiptIds } from '@/app/actions/statistics'
import { STROSEK_CATEGORIES, CATEGORY_LABELS, type StrosekCategory } from '@/lib/stroski-categories'
import StroskiReceiptCaptureModal from './stroski-receipt-capture-modal'

type Currency = 'EUR' | 'Ar'

const MONTH_NAMES = ['januar', 'februar', 'marec', 'april', 'maj', 'junij', 'julij', 'avgust', 'september', 'oktober', 'november', 'december']

const CAT_COLORS: Record<StrosekCategory, string> = {
  bar: '#7fa8b8',
  nocitve: '#c59b5b',
  kuhinja: '#8fae92',
  wellness: '#d9a68f',
  reprezentanca: '#c8846b',
  ostalo: '#b1c7cf',
}

function emptyAlloc(): Record<StrosekCategory, string> {
  return { bar: '', nocitve: '', kuhinja: '', wellness: '', reprezentanca: '', ostalo: '' }
}

const PAYMENT_OPTIONS: { method: PaymentMethod; label: string; icon: typeof CreditCard; color: string }[] = [
  { method: 'card', label: 'Kreditna kartica', icon: CreditCard, color: '#7fa8b8' },
  { method: 'orange_money', label: 'Orange Money', icon: Smartphone, color: '#d09681' },
  { method: 'cash', label: 'Gotovina', icon: Banknote, color: '#8fae92' },
]

const PAYMENT_META: Record<PaymentMethod, { label: string; icon: typeof CreditCard; color: string }> = {
  card: { label: 'Kartica', icon: CreditCard, color: '#7fa8b8' },
  orange_money: { label: 'Orange Money', icon: Smartphone, color: '#d09681' },
  cash: { label: 'Gotovina', icon: Banknote, color: '#8fae92' },
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

function formatAr(n: number) {
  return new Intl.NumberFormat('sl-SI').format(Math.round(n || 0)) + ' Ar'
}

function formatDate(d: string | null) {
  if (!d) return '-'
  return new Intl.DateTimeFormat('sl-SI', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(d))
}

function isImage(pathname: string) {
  return /\.(jpe?g|png|gif|webp|heic|heif)$/i.test(pathname)
}

// Pomanjša sliko na največ maxDim px in vrne JPEG Blob (manj pomnilnika, hitrejši prenos)
async function downscaleFileToBlob(f: File, maxDim = 1400, quality = 0.7): Promise<Blob> {
  if (!f.type.startsWith('image/')) return f
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
  if (!ctx) return f
  ctx.drawImage(img, 0, 0, width, height)
  const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
  return blob || f
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
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [translatingId, setTranslatingId] = useState<string | null>(null)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [recognizingId, setRecognizingId] = useState<string | null>(null)
  const [bulkRecognizing, setBulkRecognizing] = useState(false)
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const pageInputRef = useRef<HTMLInputElement>(null)
  const uploadTargetRef = useRef<string | null>(null)

  // Združevanje računov
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [merging, setMerging] = useState(false)
  const [splittingId, setSplittingId] = useState<string | null>(null)
  const [openTranslations, setOpenTranslations] = useState<Set<string>>(new Set())

  // Pošiljanje v računovodstvo
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [sentOk, setSentOk] = useState<string | null>(null)
  const [showAccountingSettings, setShowAccountingSettings] = useState(false)
  const [accountingEmail, setAccountingEmailState] = useState('')
  const [accountingDraft, setAccountingDraft] = useState('')
  const [savingEmail, setSavingEmail] = useState(false)

  // Način plačila
  const [payingId, setPayingId] = useState<string | null>(null)
  const [cashConfirmId, setCashConfirmId] = useState<string | null>(null)
  const [omMatches, setOmMatches] = useState<Record<string, OmMatch[]>>({})
  const [omChecking, setOmChecking] = useState<string | null>(null)
  const [bankMatches, setBankMatches] = useState<Record<string, BankMatch[]>>({})
  const [bankChecking, setBankChecking] = useState<string | null>(null)

  // Osnovno sredstvo (knjiženje računa kot osnovno sredstvo z amortizacijo)
  const [assetForId, setAssetForId] = useState<string | null>(null)
  const [assetRate, setAssetRate] = useState('')
  const [assetSaving, setAssetSaving] = useState(false)
  const [assetDoneId, setAssetDoneId] = useState<string | null>(null)
  const [assetReceiptIds, setAssetReceiptIds] = useState<string[]>([])

  // Ogled strani (lightbox)
  const [viewer, setViewer] = useState<{ pages: { pathname: string; fileName: string | null }[]; index: number; title: string } | null>(null)

  useEffect(() => {
    getExchangeRate().then(setRate).catch(() => {})
    getAccountingEmail().then((e) => {
      setAccountingEmailState(e)
      setAccountingDraft(e)
    }).catch(() => {})
    getFixedAssetReceiptIds().then(setAssetReceiptIds).catch(() => {})
  }, [])

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function exitSelectMode() {
    setSelectMode(false)
    setSelectedIds(new Set())
  }

  async function handleMerge() {
    if (selectedIds.size < 2 || merging) return
    setMerging(true)
    setActionError(null)
    try {
      const res = await mergeStroskiReceipts(Array.from(selectedIds))
      if (res && 'error' in res && res.error) {
        setActionError(res.error)
      } else {
        exitSelectMode()
        refresh()
      }
    } catch {
      setActionError('Združevanje ni uspelo. Poskusi znova.')
    } finally {
      setMerging(false)
    }
  }

  async function handleSplit(r: StroskiReceipt) {
    if (splittingId) return
    if (
      !confirm(
        `Razdružiti ta račun na ${r.pages.length} ločene enostranske račune? Znesek, prepis in način plačila se ponastavijo — vsako stran nato znova prepoznaš.`,
      )
    )
      return
    setSplittingId(r.id)
    setActionError(null)
    try {
      const res = await splitStroskiReceipt(r.id)
      if (res && 'error' in res && res.error) {
        setActionError(res.error)
      } else {
        refresh()
      }
    } catch {
      setActionError('Razdruževanje ni uspelo. Poskusi znova.')
    } finally {
      setSplittingId(null)
    }
  }

  async function handleSaveEmail() {
    setSavingEmail(true)
    try {
      await setAccountingEmail(accountingDraft)
      setAccountingEmailState(accountingDraft.trim())
      setShowAccountingSettings(false)
    } catch {
      setActionError('Shranjevanje e-naslova ni uspelo.')
    } finally {
      setSavingEmail(false)
    }
  }

  async function handleSetPayment(r: StroskiReceipt, method: PaymentMethod) {
    if (payingId) return
    // Klik na že izbran način ga odstrani (razveljavi).
    const next = r.paymentMethod === method ? null : method
    setPayingId(r.id)
    setActionError(null)
    try {
      await setReceiptPaymentMethod(r.id, next)
      if (next === 'orange_money') {
        setOmChecking(r.id)
        const matches = await getOmMatchesForReceipt(r.id)
        setOmMatches((prev) => ({ ...prev, [r.id]: matches }))
        setOmChecking(null)
      } else {
        setOmMatches((prev) => {
          const cp = { ...prev }
          delete cp[r.id]
          return cp
        })
      }
      if (next === 'card') {
        setBankChecking(r.id)
        const matches = await getBankMatchesForReceipt(r.id)
        setBankMatches((prev) => ({ ...prev, [r.id]: matches }))
        setBankChecking(null)
      } else {
        setBankMatches((prev) => {
          const cp = { ...prev }
          delete cp[r.id]
          return cp
        })
      }
      refresh()
    } catch {
      setActionError('Nastavitev načina plačila ni uspela.')
    } finally {
      setPayingId(null)
    }
  }

  function startAsset(r: StroskiReceipt) {
    setAssetForId((prev) => (prev === r.id ? null : r.id))
    setAssetRate('')
    setActionError(null)
  }

  async function handleAddAsset(r: StroskiReceipt) {
    const ratePct = parseFloat(assetRate)
    if (!ratePct || ratePct <= 0) {
      setActionError('Vpiši letno amortizacijsko stopnjo (%).')
      return
    }
    const amountAr = r.currency === 'Ar' ? r.amountOriginal : Math.round(Number(r.amountEur) * rate)
    if (!(amountAr > 0)) {
      setActionError('Račun nima zneska — najprej prepoznaj ali vpiši znesek.')
      return
    }
    setAssetSaving(true)
    setActionError(null)
    try {
      await addFixedAsset({
        name: r.description?.trim() || 'Osnovno sredstvo',
        purchaseDate: r.date,
        amountAr,
        annualRatePct: ratePct,
        receiptId: r.id,
      })
      setAssetForId(null)
      setAssetDoneId(r.id)
      setAssetReceiptIds((prev) => (prev.includes(r.id) ? prev : [...prev, r.id]))
      setTimeout(() => setAssetDoneId((s) => (s === r.id ? null : s)), 4000)
    } catch {
      setActionError('Dodajanje osnovnega sredstva ni uspelo. Poskusi znova.')
    } finally {
      setAssetSaving(false)
    }
  }

  async function handleSendToAccounting(r: StroskiReceipt) {
    if (!accountingEmail) {
      setAccountingDraft(accountingEmail)
      setShowAccountingSettings(true)
      return
    }
    setSendingId(r.id)
    setActionError(null)
    setSentOk(null)
    try {
      const res = await sendReceiptToAccounting(r.id)
      if (res.success) {
        setSentOk(r.id)
        setTimeout(() => setSentOk((s) => (s === r.id ? null : s)), 4000)
        refresh()
      } else {
        setActionError(res.error || 'Pošiljanje ni uspelo.')
      }
    } catch {
      setActionError('Pošiljanje ni uspelo. Poskusi znova.')
    } finally {
      setSendingId(null)
    }
  }

  const toggleExpand = (id: string) => setExpandedId((prev) => (prev === id ? null : id))

  // Natisni vse strani računa
  function handlePrintReceipt(r: StroskiReceipt) {
    const pages = r.pages.length > 0 ? r.pages : [{ pathname: r.pathname, fileName: r.fileName }]
    const w = window.open('', '_blank')
    if (!w) return
    const title = r.description || 'Račun'
    const imgs = pages
      .map((p) => `<img src="/api/image?pathname=${encodeURIComponent(p.pathname)}" alt="Stran" />`)
      .join('')
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
      <style>
        @page { margin: 12mm; }
        body { margin: 0; font-family: system-ui, sans-serif; }
        h1 { font-size: 16px; margin: 0 0 4mm; }
        .meta { font-size: 12px; color: #555; margin: 0 0 6mm; }
        img { display: block; width: 100%; max-width: 100%; page-break-after: always; margin-bottom: 6mm; }
        img:last-child { page-break-after: auto; }
      </style></head><body>
      <h1>${title}</h1>
      <div class="meta">${formatDate(r.date)} &middot; ${r.currency === 'Ar' ? formatAr(r.amountOriginal) + ' (' + formatEur(Number(r.amountEur)) + ')' : formatEur(Number(r.amountEur))}</div>
      ${imgs}
      <script>
        (function(){
          var imgs = Array.prototype.slice.call(document.images);
          var left = imgs.length;
          if (left === 0) { window.print(); return; }
          imgs.forEach(function(im){
            if (im.complete) { if(--left===0) window.print(); }
            else { im.onload = im.onerror = function(){ if(--left===0) window.print(); }; }
          });
        })();
      </script>
      </body></html>`)
    w.document.close()
  }

  const openViewer = (r: StroskiReceipt, index: number) => {
    const pages = r.pages.length > 0 ? r.pages : [{ pathname: r.pathname, fileName: r.fileName }]
    setViewer({ pages, index, title: r.description || 'Račun' })
  }
  const viewerPrev = () => setViewer((v) => (v ? { ...v, index: (v.index - 1 + v.pages.length) % v.pages.length } : v))
  const viewerNext = () => setViewer((v) => (v ? { ...v, index: (v.index + 1) % v.pages.length } : v))

  // Doda nove strani (fotografije) k obstoječemu računu
  async function handleAddPages(id: string, files: FileList | null) {
    if (!files || files.length === 0) return
    setUploadingId(id)
    setActionError(null)
    try {
      const uploaded: { pathname: string; fileName: string | null }[] = []
      for (const f of Array.from(files)) {
        const blob = await downscaleFileToBlob(f)
        const fd = new FormData()
        fd.append('file', blob, f.name || 'stran.jpg')
        const res = await fetch('/api/upload-stroski-document', { method: 'POST', body: fd })
        if (!res.ok) throw new Error('upload')
        const { pathname } = await res.json()
        uploaded.push({ pathname, fileName: f.name || 'stran.jpg' })
      }
      await addStroskiReceiptPages(id, uploaded)
      refresh()
    } catch {
      setActionError('Dodajanje strani ni uspelo. Poskusi znova.')
    } finally {
      setUploadingId(null)
    }
  }

  // Prepozna vsebino računa (vse strani) in jo prevede v slovenščino
  async function handleTranslate(r: StroskiReceipt) {
    setTranslatingId(r.id)
    setActionError(null)
    try {
      const fd = new FormData()
      const pages = r.pages.length > 0 ? r.pages : [{ pathname: r.pathname, fileName: r.fileName }]
      for (let i = 0; i < pages.length; i++) {
        const res = await fetch(`/api/image?pathname=${encodeURIComponent(pages[i].pathname)}`)
        if (!res.ok) throw new Error('image')
        const blob = await res.blob()
        fd.append('files', blob, `stran-${i + 1}.jpg`)
      }
      const res = await fetch('/api/translate-receipt', { method: 'POST', body: fd })
      if (!res.ok) throw new Error('translate')
      const { translation } = await res.json()
      await saveStroskiTranslation(r.id, translation || '')
      setExpandedId(r.id)
      refresh()
    } catch {
      setActionError('Prepoznava ni uspela. Poskusi znova.')
    } finally {
      setTranslatingId(null)
    }
  }

  // Prepozna datum + znesek + valuto na (prvi strani) računa in posodobi zapis.
  // Vrne true, če je bilo kaj posodobljeno.
  async function recognizeOne(r: StroskiReceipt): Promise<boolean> {
    const res = await fetch(`/api/image?pathname=${encodeURIComponent(r.pathname)}`)
    if (!res.ok) throw new Error('image')
    const blob = await res.blob()
    const fd = new FormData()
    fd.append('file', blob, 'receipt.jpg')
    const ocrRes = await fetch('/api/read-receipt', { method: 'POST', body: fd })
    if (!ocrRes.ok) throw new Error('ocr')
    const result: { amount: number | null; currency: Currency | null; date: string | null; description: string | null } =
      await ocrRes.json()

    let newDate = r.date
    if (result.date && /^\d{4}-\d{2}-\d{2}$/.test(result.date)) newDate = result.date

    let newAmountEur = r.amountEur
    let newCurrency: Currency = r.currency
    let newAmountOriginal = r.amountOriginal
    if (typeof result.amount === 'number' && result.amount > 0) {
      newCurrency = result.currency === 'Ar' ? 'Ar' : 'EUR'
      newAmountOriginal = Math.round(result.amount * 100) / 100
      newAmountEur = newCurrency === 'Ar' ? Math.round((result.amount / rate) * 100) / 100 : Math.round(result.amount * 100) / 100
    }

    const newDesc = r.description.trim() ? r.description : (result.description || '').trim()

    const changed =
      newDate !== r.date ||
      newAmountEur !== r.amountEur ||
      newCurrency !== r.currency ||
      newAmountOriginal !== r.amountOriginal ||
      newDesc !== r.description
    if (!changed) return false

    await updateStroskiReceipt(r.id, {
      date: newDate,
      description: newDesc,
      amountEur: newAmountEur,
      currency: newCurrency,
      amountOriginal: newAmountOriginal,
      categories: r.categories,
    })
    return true
  }

  // Prepoznava za en račun (gumb v vrstici)
  async function handleRecognize(r: StroskiReceipt) {
    setRecognizingId(r.id)
    setActionError(null)
    try {
      await recognizeOne(r)
      refresh()
    } catch {
      setActionError('Prepoznava datuma/zneska ni uspela. Poskusi znova.')
    } finally {
      setRecognizingId(null)
    }
  }

  // Množična prepoznava za vse račune leta — teče STREŽNIŠKO (robustno, se ne prekine ob brskalniku).
  async function handleRecognizeAll() {
    const list = receipts || []
    if (list.length === 0 || bulkRecognizing) return
    const missing = list.filter((r) => !(r.amountEur > 0)).length
    setBulkRecognizing(true)
    setActionError(null)
    setBulkProgress({ done: 0, total: missing > 0 ? missing : list.length })
    try {
      const res = await recognizeAllStroskiReceipts(year, missing > 0)
      setBulkProgress({ done: res.recognized, total: res.processed })
      if (res.failed > 0) {
        setActionError(`Prepoznanih ${res.recognized} od ${res.processed}. Za ${res.failed} ni bilo mogoče razbrati zneska (ročni vnos).`)
      }
    } catch {
      setActionError('Množična prepoznava ni uspela. Poskusi znova.')
    } finally {
      setBulkRecognizing(false)
      setBulkProgress(null)
      refresh()
    }
  }

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
    setExpandedId(r.id) // razpri, da sta med urejanjem vidna tudi način plačila in slike računa
    setEditDate(r.date)
    setEditDesc(r.description)
    setEditCurrency(r.currency)
    const total = r.currency === 'Ar' ? r.amountOriginal : r.amountEur
    setEditAmount(String(total))
    const a = emptyAlloc()
    if (r.currency === 'Ar') {
      // Osnova ostane v ariarijih: raje uporabi shranjeno izvirno alokacijo, sicer pretvori iz EUR.
      let anyFallback = false
      for (const c of r.categories) {
        if (c.amountOriginal != null) {
          a[c.category] = String(Math.round(c.amountOriginal))
        } else {
          a[c.category] = String(Math.round(c.amountEur * rate))
          anyFallback = true
        }
      }
      // Pri starih zapisih (brez izvirne alokacije) poravnaj morebitni centni zaokrožitveni odklon,
      // da vsota alokacij natančno ustreza znesku računa v Ar.
      if (anyFallback) {
        const used = r.categories.filter((c) => (parseFloat(a[c.category]) || 0) > 0)
        const sum = used.reduce((s, c) => s + (parseFloat(a[c.category]) || 0), 0)
        const diff = Math.round(total) - sum
        if (diff !== 0 && used.length > 0) {
          let biggest = used[0]
          for (const c of used) {
            if ((parseFloat(a[c.category]) || 0) > (parseFloat(a[biggest.category]) || 0)) biggest = c
          }
          a[biggest.category] = String((parseFloat(a[biggest.category]) || 0) + diff)
        }
      }
    } else {
      for (const c of r.categories) a[c.category] = String(c.amountEur)
    }
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
      .map((c) => {
        const orig = parseFloat(editAlloc[c]) || 0
        return {
          category: c,
          amountEur: Math.round(editToEur(orig) * 100) / 100,
          amountOriginal: editCurrency === 'Ar' ? Math.round(orig) : Math.round(orig * 100) / 100,
        }
      })
      .filter((c) => c.amountEur > 0)
    await updateStroskiReceipt(id, {
      date: editDate,
      description: editDesc.trim(),
      amountEur: editTotalEur,
      currency: editCurrency,
      amountOriginal: editTotal,
      categories,
    })
    setEditId(null)
    setExpandedId((prev) => (prev === id ? null : prev)) // po shranjevanju zloži račun
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
            onClick={handleRecognizeAll}
            disabled={bulkRecognizing || (receipts || []).length === 0}
            className="flex items-center gap-2 rounded-xl border border-[#c59b5b]/30 bg-[#c59b5b]/10 px-4 py-3 text-sm font-semibold text-[#c59b5b] transition-all hover:bg-[#c59b5b]/20 disabled:opacity-50"
            title="Prepozna datum, znesek in valuto na vseh računih tega leta"
          >
            {bulkRecognizing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
            {bulkRecognizing && bulkProgress
              ? `Prepoznavam ${bulkProgress.done}/${bulkProgress.total}`
              : 'Prepoznaj vse'}
          </button>
          <button
            onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
            disabled={(receipts || []).length < 2}
            className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-all disabled:opacity-50 ${
              selectMode
                ? 'border-[#7fa8b8]/50 bg-[#7fa8b8]/20 text-[#7fa8b8]'
                : 'border-[#7fa8b8]/30 bg-[#7fa8b8]/10 text-[#7fa8b8] hover:bg-[#7fa8b8]/20'
            }`}
            title="Izberi več računov in jih združi v enega"
          >
            <Merge className="h-4 w-4" />
            {selectMode ? 'Prekliči izbor' : 'Združi'}
          </button>
          <button
            onClick={() => {
              setAccountingDraft(accountingEmail)
              setShowAccountingSettings(true)
            }}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white/70 transition-all hover:bg-white/10 hover:text-white"
            title="Nastavi e-naslov računovodstva"
          >
            <Building2 className="h-4 w-4" />
            Računovodstvo
          </button>
          <button
            onClick={() => setShowCapture(true)}
            className="flex items-center gap-2 rounded-xl bg-[#c59b5b] px-4 py-3 text-sm font-semibold text-[#152329] transition-all hover:bg-[#c59b5b]/90"
          >
            <Plus className="h-4 w-4" />
            Nov račun
          </button>
        </div>
      </div>

      {/* Vrstica za združevanje (ko je aktiven izbor) */}
      {selectMode && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#7fa8b8]/30 bg-[#7fa8b8]/10 px-4 py-3">
          <span className="text-sm text-[#7fa8b8]">
            Izbrani računi: <strong>{selectedIds.size}</strong>. Označi dva ali več računov (npr. Leader Price na dveh vnosih), nato klikni Združi.
          </span>
          <button
            onClick={handleMerge}
            disabled={selectedIds.size < 2 || merging}
            className="flex items-center gap-2 rounded-lg bg-[#7fa8b8] px-4 py-2 text-sm font-semibold text-[#152329] transition-all hover:bg-[#7fa8b8]/90 disabled:opacity-50"
          >
            {merging ? <Loader2 className="h-4 w-4 animate-spin" /> : <Merge className="h-4 w-4" />}
            Združi {selectedIds.size >= 2 ? `(${selectedIds.size})` : ''}
          </button>
        </div>
      )}

      {/* Nastavitve računovodstva */}
      {showAccountingSettings && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-white">
            <Mail className="h-4 w-4 text-[#7fa8b8]" />
            E-naslov računovodstva
          </div>
          <p className="mb-3 text-xs text-white/40">Račun se pošlje na ta naslov (slike vseh strani + prepis vsebine).</p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="email"
              value={accountingDraft}
              onChange={(e) => setAccountingDraft(e.target.value)}
              placeholder="racunovodstvo@primer.si"
              className="min-w-[220px] flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-[#7fa8b8]/40 focus:outline-none"
            />
            <button
              onClick={handleSaveEmail}
              disabled={savingEmail}
              className="flex items-center gap-1.5 rounded-lg bg-[#7fa8b8] px-4 py-2 text-sm font-semibold text-[#152329] transition-all hover:bg-[#7fa8b8]/90 disabled:opacity-50"
            >
              {savingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Shrani
            </button>
            <button
              onClick={() => setShowAccountingSettings(false)}
              className="rounded-lg bg-white/5 px-3 py-2 text-sm text-white/50 transition-all hover:bg-white/10 hover:text-white"
            >
              Zapri
            </button>
          </div>
        </div>
      )}

      {actionError && !expandedId && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-400">{actionError}</div>
      )}

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
                      <div key={r.id}>
                      <div className={`flex items-center gap-3 px-4 py-3 ${selectMode && selectedIds.has(r.id) ? 'bg-[#7fa8b8]/10' : ''}`}>
                        {/* Izbirni kvadratek za združevanje */}
                        {selectMode && (
                          <button
                            onClick={() => toggleSelect(r.id)}
                            className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border transition-all ${
                              selectedIds.has(r.id)
                                ? 'border-[#7fa8b8] bg-[#7fa8b8] text-[#152329]'
                                : 'border-white/30 hover:border-[#7fa8b8]/60'
                            }`}
                            title={selectedIds.has(r.id) ? 'Odstrani iz izbora' : 'Dodaj v izbor'}
                          >
                            {selectedIds.has(r.id) && <Check className="h-3.5 w-3.5" />}
                          </button>
                        )}
                        {/* Sličica / ikona (z značko števila strani) */}
                        <a
                          href={`/api/image?pathname=${encodeURIComponent(r.pathname)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="relative flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-black/30"
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
                          {r.pages.length > 1 && (
                            <span className="absolute bottom-0 right-0 flex items-center gap-0.5 rounded-tl-md bg-[#c59b5b] px-1 py-0.5 text-[9px] font-bold text-[#152329]">
                              <Layers className="h-2.5 w-2.5" />
                              {r.pages.length}
                            </span>
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
                            <div className="flex flex-col items-end whitespace-nowrap leading-tight">
                              {r.currency === 'Ar' ? (
                                <>
                                  <span className="text-sm font-semibold tabular-nums text-white/80">{formatAr(r.amountOriginal)}</span>
                                  <span className="text-[11px] tabular-nums text-[#8fae92]">{formatEur(Number(r.amountEur))}</span>
                                </>
                              ) : (
                                <span className="text-sm font-semibold tabular-nums text-white/80">{formatEur(Number(r.amountEur))}</span>
                              )}
                              {r.paymentMethod && (() => {
                                const meta = PAYMENT_META[r.paymentMethod]
                                const Icon = meta.icon
                                return (
                                  <span className="mt-0.5 flex items-center gap-1 text-[10px]" style={{ color: meta.color }} title={`Plačano: ${meta.label}`}>
                                    <Icon className="h-3 w-3" /> {meta.label}
                                  </span>
                                )
                              })()}
                              {assetReceiptIds.includes(r.id) && (
                                <span className="mt-0.5 flex items-center gap-1 rounded-full bg-[#c9a86a]/15 px-1.5 py-0.5 text-[10px] font-medium text-[#d8b877]" title="Ta račun je knjižen kot osnovno sredstvo (amortizacija)">
                                  <Layers className="h-3 w-3" /> Osnovno sredstvo
                                </span>
                              )}
                            </div>
                            <button
                              onClick={() => handleSendToAccounting(r)}
                              disabled={sendingId === r.id}
                              className={`rounded-lg p-2 transition-all disabled:opacity-60 ${
                                sentOk === r.id
                                  ? 'text-[#8fae92]'
                                  : r.sentToAccountingAt
                                    ? 'text-[#7fa8b8] hover:bg-[#7fa8b8]/15'
                                    : 'text-white/40 hover:bg-white/10 hover:text-[#7fa8b8]'
                              }`}
                              title={r.sentToAccountingAt ? `Poslano računovodstvu ${formatDate(r.sentToAccountingAt)} — pošlji znova` : 'Pošlji v računovodstvo'}
                            >
                              {sendingId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : sentOk === r.id ? <Check className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                            </button>
                            <button
                              onClick={() => handleRecognize(r)}
                              disabled={recognizingId === r.id || bulkRecognizing}
                              className="rounded-lg p-2 text-white/40 transition-all hover:bg-white/10 hover:text-[#c59b5b] disabled:opacity-60"
                              title="Prepoznaj datum in znesek z računa"
                            >
                              {recognizingId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
                            </button>
                            <button
                              onClick={() => handleTranslate(r)}
                              disabled={translatingId === r.id}
                              className={`rounded-lg p-2 transition-all disabled:opacity-60 ${r.translation ? 'text-[#8fae92] hover:bg-[#8fae92]/15' : 'text-white/40 hover:bg-white/10 hover:text-[#8fae92]'}`}
                              title={r.translation ? 'Znova prepoznaj + prevedi' : 'Prepoznaj vsebino + prevedi v slovenščino'}
                            >
                              {translatingId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Languages className="h-4 w-4" />}
                            </button>
                            <button
                              onClick={() => toggleExpand(r.id)}
                              className={`rounded-lg p-2 transition-all ${expandedId === r.id ? 'bg-white/10 text-white' : 'text-white/40 hover:bg-white/10 hover:text-white'}`}
                              title="Strani in prepis"
                            >
                              <Layers className="h-4 w-4" />
                            </button>
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

                      {/* Razširjen pogled: način plačila + strani računa + prepis/prevod (viden tudi med urejanjem) */}
                      {expandedId === r.id && (
                        <div className="space-y-4 border-t border-white/[0.06] bg-black/20 px-4 py-4">
                          {/* Način plačila */}
                          <div>
                            <div className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-white/40">
                              <CreditCard className="h-3.5 w-3.5" />
                              Način plačila
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {PAYMENT_OPTIONS.map((opt) => {
                                const active = r.paymentMethod === opt.method
                                const Icon = opt.icon
                                return (
                                  <button
                                    key={opt.method}
                                    onClick={() => {
                                      // Gotovina ustvari odliv iz blagajne → zahtevaj potrditev (razen ob odznačitvi).
                                      if (opt.method === 'cash' && r.paymentMethod !== 'cash') {
                                        setCashConfirmId((prev) => (prev === r.id ? null : r.id))
                                        return
                                      }
                                      setCashConfirmId(null)
                                      handleSetPayment(r, opt.method)
                                    }}
                                    disabled={payingId === r.id}
                                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all disabled:opacity-60 ${
                                      active
                                        ? 'text-white'
                                        : 'border-white/10 bg-white/[0.03] text-white/50 hover:bg-white/10 hover:text-white/80'
                                    }`}
                                    style={active ? { borderColor: `${opt.color}80`, backgroundColor: `${opt.color}22`, color: opt.color } : undefined}
                                  >
                                    {payingId === r.id && active ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
                                    {opt.label}
                                    {active && <Check className="h-3.5 w-3.5" />}
                                  </button>
                                )
                              })}
                            </div>
                            {/* Potrditev gotovinskega odliva iz blagajne */}
                            {cashConfirmId === r.id && (
                              <div className="mt-2 rounded-lg border border-[#8fae92]/40 bg-[#8fae92]/10 p-3">
                                <p className="mb-2 text-[13px] text-white/80">
                                  Potrdi odliv iz gotovinske blagajne (Tourism)
                                  {(() => {
                                    const amountAr = r.currency === 'Ar' ? r.amountOriginal : Math.round(Number(r.amountEur) * rate)
                                    return amountAr > 0 ? <> — <span className="font-semibold tabular-nums text-[#8fae92]">{formatAr(amountAr)}</span></> : null
                                  })()}
                                  ?
                                </p>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => {
                                      setCashConfirmId(null)
                                      handleSetPayment(r, 'cash')
                                    }}
                                    disabled={payingId === r.id}
                                    className="flex items-center gap-1.5 rounded-lg border border-[#8fae92]/50 bg-[#8fae92]/20 px-3 py-1.5 text-sm font-medium text-[#8fae92] transition-all hover:bg-[#8fae92]/30 disabled:opacity-60"
                                  >
                                    {payingId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                    Potrdi odliv
                                  </button>
                                  <button
                                    onClick={() => setCashConfirmId(null)}
                                    disabled={payingId === r.id}
                                    className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm font-medium text-white/60 transition-all hover:bg-white/10 hover:text-white/80 disabled:opacity-60"
                                  >
                                    Prekliči
                                  </button>
                                </div>
                              </div>
                            )}
                            {/* Namigi glede na način */}
                            {r.paymentMethod === 'card' && (
                              <div className="mt-2">
                                {bankChecking === r.id ? (
                                  <p className="flex items-center gap-2 text-[12px] text-white/40"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Preverjam ujemanje z bančnimi izpiski…</p>
                                ) : (bankMatches[r.id]?.length ?? 0) > 0 ? (
                                  <div className="rounded-lg border border-[#7fa8b8]/30 bg-[#7fa8b8]/10 p-2.5">
                                    <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-[#7fa8b8]"><Check className="h-3.5 w-3.5" /> Plačano s kreditno kartico — najdeno v bančnih izpiskih</p>
                                    <div className="space-y-1">
                                      {bankMatches[r.id].map((m) => (
                                        <div key={m.id} className="flex items-center justify-between gap-3 text-[13px]">
                                          <span className="text-white/70">{formatDate(m.date)} · {m.company === 'sarl' ? 'SARL' : 'Tourism'} · {m.description || 'brez opisa'}</span>
                                          <span className="flex items-center gap-1.5 whitespace-nowrap tabular-nums text-white/90">
                                            {formatAr(m.amount)}
                                            {m.exact && <span className="rounded bg-[#8fae92]/20 px-1.5 py-0.5 text-[10px] font-medium text-[#8fae92]">točno</span>}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-[12px] text-white/40">Ni najdenega ujemajočega odliva v bančnih izpiskih za ta znesek — preveri ročno.</p>
                                )}
                              </div>
                            )}
                            {r.paymentMethod === 'cash' && (
                              <p className="mt-2 text-[12px] text-[#8fae92]">Odšteto iz gotovinske blagajne (Tourism){r.cashLedgerId ? '' : ' — znesek ni bil zabeležen (manjka znesek).'}</p>
                            )}
                            {r.paymentMethod === 'orange_money' && (
                              <div className="mt-2">
                                {omChecking === r.id ? (
                                  <p className="flex items-center gap-2 text-[12px] text-white/40"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Preverjam ujemanje z Orange Money odlivi…</p>
                                ) : (omMatches[r.id]?.length ?? 0) > 0 ? (
                                  <div className="rounded-lg border border-[#d09681]/30 bg-[#d09681]/10 p-2.5">
                                    <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-[#d09681]">Najdeni ujemajoči odlivi (Orange Money)</p>
                                    <div className="space-y-1">
                                      {omMatches[r.id].map((m) => (
                                        <div key={m.id} className="flex items-center justify-between gap-3 text-[13px]">
                                          <span className="text-white/70">{formatDate(m.date)} · {m.description || 'brez opisa'}</span>
                                          <span className="flex items-center gap-1.5 whitespace-nowrap tabular-nums text-white/90">
                                            {formatAr(m.amount)}
                                            {m.exact && <span className="rounded bg-[#8fae92]/20 px-1.5 py-0.5 text-[10px] font-medium text-[#8fae92]">točno</span>}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-[12px] text-white/40">Ni najdenega ujemajočega odliva v Orange Money za ta znesek.</p>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Osnovno sredstvo (amortizacija) */}
                          <div>
                            <div className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-white/40">
                              <Layers className="h-3.5 w-3.5" />
                              Osnovno sredstvo
                            </div>
                            {assetDoneId === r.id ? (
                              <p className="flex items-center gap-1.5 text-[13px] text-[#c59b5b]">
                                <Check className="h-3.5 w-3.5" /> Dodano med osnovna sredstva — mesečna amortizacija se knjiži v Kalkulacijah.
                              </p>
                            ) : assetForId === r.id ? (
                              <div className="rounded-lg border border-[#c59b5b]/30 bg-[#c59b5b]/[0.06] p-3">
                                <p className="mb-2 text-[12px] text-white/50">
                                  Knjiži kot osnovno sredstvo (npr. pralni stroj). Mesečni strošek je amortizacija — vpiši letno stopnjo.
                                </p>
                                <div className="flex flex-wrap items-end gap-3">
                                  <div>
                                    <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/40">Nabavna vrednost</label>
                                    <span className="block text-sm font-semibold tabular-nums text-white/80">
                                      {r.currency === 'Ar' ? formatAr(r.amountOriginal) : formatAr(Math.round(Number(r.amountEur) * rate))}
                                    </span>
                                  </div>
                                  <div>
                                    <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/40">Letna stopnja (%)</label>
                                    <input
                                      type="number"
                                      inputMode="decimal"
                                      value={assetRate}
                                      onChange={(e) => setAssetRate(e.target.value)}
                                      placeholder="npr. 20"
                                      className="w-24 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-sm text-white outline-none focus:border-[#c59b5b]/50"
                                    />
                                  </div>
                                  {(() => {
                                    const ratePct = parseFloat(assetRate)
                                    if (!ratePct || ratePct <= 0) return null
                                    const amountAr = r.currency === 'Ar' ? r.amountOriginal : Math.round(Number(r.amountEur) * rate)
                                    const life = Math.max(1, Math.round(1200 / ratePct))
                                    const monthlyEur = Math.round((amountAr / rate / life) * 100) / 100
                                    return (
                                      <div>
                                        <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/40">Amortizacija</label>
                                        <span className="block text-sm font-semibold tabular-nums text-[#c59b5b]">
                                          {formatEur(monthlyEur)}/mes · {life} mes
                                        </span>
                                      </div>
                                    )
                                  })()}
                                  <button
                                    onClick={() => handleAddAsset(r)}
                                    disabled={assetSaving}
                                    className="flex items-center gap-1.5 rounded-lg bg-[#c59b5b] px-3 py-1.5 text-sm font-medium text-black transition-all hover:bg-[#d3ad6f] disabled:opacity-60"
                                  >
                                    {assetSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Dodaj
                                  </button>
                                  <button
                                    onClick={() => setAssetForId(null)}
                                    className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-white/50 transition-all hover:bg-white/10 hover:text-white/80"
                                  >
                                    Prekliči
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => startAsset(r)}
                                className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm font-medium text-white/50 transition-all hover:bg-white/10 hover:text-white/80"
                              >
                                <Layers className="h-4 w-4" /> Dodaj kot osnovno sredstvo
                              </button>
                            )}
                          </div>

                          {/* Strani računa */}
                          <div>
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <span className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-white/40">
                                <Layers className="h-3.5 w-3.5" />
                                Strani računa ({r.pages.length})
                              </span>
                              <div className="flex items-center gap-2">
                                {r.pages.length > 1 && (
                                  <button
                                    onClick={() => handleSplit(r)}
                                    disabled={splittingId === r.id}
                                    className="flex items-center gap-1.5 rounded-lg bg-[#c07a5b]/15 px-2.5 py-1 text-[11px] font-medium text-[#d59578] transition-all hover:bg-[#c07a5b]/25 disabled:opacity-60"
                                    title="Razdruži v ločene račune (vsaka stran svoj račun)"
                                  >
                                    {splittingId === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Scissors className="h-3.5 w-3.5" />} Razdruži
                                  </button>
                                )}
                                <button
                                  onClick={() => handlePrintReceipt(r)}
                                  className="flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1 text-[11px] font-medium text-white/60 transition-all hover:bg-white/10 hover:text-white"
                                  title="Natisni vse strani"
                                >
                                  <Printer className="h-3.5 w-3.5" /> Natisni vse strani
                                </button>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {r.pages.map((p, i) => (
                                <button
                                  key={i}
                                  onClick={() => openViewer(r, i)}
                                  className="group relative h-28 w-24 overflow-hidden rounded-lg border border-white/10 bg-black/30 transition-all hover:border-[#c59b5b]/50"
                                  title={`Poglej stran ${i + 1}`}
                                >
                                  {isImage(p.pathname) ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={`/api/image?pathname=${encodeURIComponent(p.pathname)}`} alt={`Stran ${i + 1}`} className="h-full w-full object-cover" />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center"><FileText className="h-5 w-5 text-white/40" /></div>
                                  )}
                                  <span className="absolute left-0 top-0 rounded-br-md bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">Stran {i + 1}</span>
                                  <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                                    <Maximize2 className="h-5 w-5 text-white" />
                                  </span>
                                </button>
                              ))}
                              {/* Dodaj stran k obstoječemu računu */}
                              <button
                                onClick={() => {
                                  uploadTargetRef.current = r.id
                                  pageInputRef.current?.click()
                                }}
                                disabled={uploadingId === r.id}
                                className="flex h-24 w-20 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-[#c59b5b]/40 bg-[#c59b5b]/5 text-[#c59b5b] transition-all hover:bg-[#c59b5b]/15 disabled:opacity-60"
                                title="Dodaj stran"
                              >
                                {uploadingId === r.id ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
                                <span className="text-[10px] font-medium">Dodaj stran</span>
                              </button>
                            </div>
                          </div>

                          {/* Prepis + prevod v slovenščino */}
                          <div>
                            <div className="mb-2 flex items-center justify-between">
                              {r.translation ? (
                                <button
                                  onClick={() =>
                                    setOpenTranslations((prev) => {
                                      const next = new Set(prev)
                                      if (next.has(r.id)) next.delete(r.id)
                                      else next.add(r.id)
                                      return next
                                    })
                                  }
                                  className="flex items-center gap-2 rounded-md px-1 py-0.5 text-[11px] font-medium uppercase tracking-wider text-white/40 transition-colors hover:text-white/70"
                                  title={openTranslations.has(r.id) ? 'Skrij prepis' : 'Pokaži prepis'}
                                >
                                  <ChevronRight className={`h-3.5 w-3.5 transition-transform ${openTranslations.has(r.id) ? 'rotate-90' : ''}`} />
                                  <Languages className="h-3.5 w-3.5" />
                                  Prepis in prevod (slovenščina)
                                </button>
                              ) : (
                                <span className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-white/40">
                                  <Languages className="h-3.5 w-3.5" />
                                  Prepis in prevod (slovenščina)
                                </span>
                              )}
                              <button
                                onClick={() => handleTranslate(r)}
                                disabled={translatingId === r.id}
                                className="flex items-center gap-1.5 rounded-md bg-[#8fae92]/15 px-2.5 py-1 text-xs font-medium text-[#8fae92] transition-all hover:bg-[#8fae92]/25 disabled:opacity-60"
                              >
                                {translatingId === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Languages className="h-3.5 w-3.5" />}
                                {translatingId === r.id ? 'Berem...' : r.translation ? 'Osveži prepis' : 'Prepoznaj + prevedi'}
                              </button>
                            </div>
                            {r.translation ? (
                              openTranslations.has(r.id) ? (
                                <div className="whitespace-pre-line rounded-xl border border-white/10 bg-white/[0.02] p-3 text-sm leading-relaxed text-white/80">
                                  {r.translation}
                                </div>
                              ) : (
                                <button
                                  onClick={() => setOpenTranslations((prev) => new Set(prev).add(r.id))}
                                  className="w-full rounded-xl border border-dashed border-white/10 px-3 py-2.5 text-center text-xs text-white/40 transition-colors hover:border-white/20 hover:text-white/60"
                                >
                                  Prepis je skrit — klikni za prikaz
                                </button>
                              )
                            ) : (
                              <p className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-center text-xs text-white/30">
                                Ni še prepisa. Klikni „Prepoznaj + prevedi", da preberem vsebino računa in jo prevedem v slovenščino.
                              </p>
                            )}
                          </div>

                          {actionError && <p className="text-xs text-red-400">{actionError}</p>}
                        </div>
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

      {/* Skriti vhod za dodajanje strani k obstoječemu računu */}
      <input
        ref={pageInputRef}
        type="file"
        accept="image/*,application/pdf"
        multiple
        className="hidden"
        onChange={(e) => {
          const id = uploadTargetRef.current
          if (id) handleAddPages(id, e.target.files)
          uploadTargetRef.current = null
          e.target.value = ''
        }}
      />

      <StroskiReceiptCaptureModal isOpen={showCapture} onClose={() => setShowCapture(false)} onSaved={refresh} />

      {/* Ogled strani (lightbox) */}
      {viewer && (
        <div
          className="fixed inset-0 z-[100] flex flex-col bg-black/90 backdrop-blur-sm"
          onClick={() => setViewer(null)}
        >
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3" onClick={(e) => e.stopPropagation()}>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{viewer.title}</p>
              <p className="text-xs text-white/50">Stran {viewer.index + 1} od {viewer.pages.length}</p>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={`/api/image?pathname=${encodeURIComponent(viewer.pages[viewer.index].pathname)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg bg-white/5 p-2 text-white/60 transition-all hover:bg-white/10 hover:text-white"
                title="Odpri v novem zavihku"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
              <button onClick={() => setViewer(null)} className="rounded-lg bg-white/5 p-2 text-white/60 transition-all hover:bg-white/10 hover:text-white" title="Zapri">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="relative flex flex-1 items-center justify-center overflow-hidden p-4" onClick={(e) => e.stopPropagation()}>
            {viewer.pages.length > 1 && (
              <button
                onClick={viewerPrev}
                className="absolute left-4 z-10 rounded-full bg-white/10 p-3 text-white transition-all hover:bg-white/20"
                title="Prejšnja stran"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
            )}
            {isImage(viewer.pages[viewer.index].pathname) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/image?pathname=${encodeURIComponent(viewer.pages[viewer.index].pathname)}`}
                alt={`Stran ${viewer.index + 1}`}
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <iframe
                src={`/api/image?pathname=${encodeURIComponent(viewer.pages[viewer.index].pathname)}`}
                className="h-full w-full rounded-lg bg-white"
                title={`Stran ${viewer.index + 1}`}
              />
            )}
            {viewer.pages.length > 1 && (
              <button
                onClick={viewerNext}
                className="absolute right-4 z-10 rounded-full bg-white/10 p-3 text-white transition-all hover:bg-white/20"
                title="Naslednja stran"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            )}
          </div>
          {viewer.pages.length > 1 && (
            <div className="flex justify-center gap-2 border-t border-white/10 px-4 py-3" onClick={(e) => e.stopPropagation()}>
              {viewer.pages.map((p, i) => (
                <button
                  key={i}
                  onClick={() => setViewer((v) => (v ? { ...v, index: i } : v))}
                  className={`h-14 w-11 overflow-hidden rounded border transition-all ${i === viewer.index ? 'border-[#c59b5b]' : 'border-white/15 opacity-50 hover:opacity-100'}`}
                >
                  {isImage(p.pathname) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/image?pathname=${encodeURIComponent(p.pathname)}`} alt={`Stran ${i + 1}`} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-black/40"><FileText className="h-4 w-4 text-white/40" /></div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
