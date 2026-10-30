'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import useSWR from 'swr'
import { ChevronDown, ClipboardPaste, Download, FileText, ImagePlus, Loader2, Trash2, X } from 'lucide-react'
import { COMPANIES, type CompanyId } from '@/lib/payroll'
import { isPdfCompanyDocument, isPdfUpload, pdfStorageName } from '@/lib/company-document-file'
import { openPdfDocument, rasterizePdfBytes } from '@/lib/pdfjs-browser'
import {
  NOTHING_TO_SAVE,
  PDF_FILENAME,
  buildCompanyDocumentsPdf,
  documentsForPdf,
} from '@/lib/company-documents-pdf'
import {
  addCompanyDocument,
  deleteCompanyDocument,
  getCompanyDocuments,
  type CompanyDocument,
} from '@/app/actions/company-documents'

const COMPANIES_IN_ORDER: CompanyId[] = ['tourism', 'sarl']

function isImageFile(file: File) {
  if (file.type.startsWith('image/')) return true
  return /\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name)
}

function filesFromClipboard(data: DataTransfer | null): File[] {
  if (!data) return []
  const found: File[] = []
  const seen = new Set<string>()
  const push = (file: File | null) => {
    if (!file || !isImageFile(file)) return
    const key = `${file.name}:${file.size}:${file.type}:${file.lastModified}`
    if (seen.has(key)) return
    seen.add(key)
    found.push(file)
  }
  for (const file of Array.from(data.files)) push(file)
  for (const item of Array.from(data.items)) {
    if (item.kind === 'file') push(item.getAsFile())
  }
  return found
}

// Posnetke pomanjšamo pred nalaganjem, da telefonski zajem ostane berljiv in
// ne poje pomnilnika. 2000 px ohrani besedilo na dokumentu.
async function fileToDownscaledBlob(file: File, maxDim = 2000, quality = 0.86): Promise<Blob> {
  if (file.size < 1_200_000) return file
  const srcUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
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
  if (!ctx) return file
  ctx.drawImage(img, 0, 0, width, height)
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/jpeg', quality),
  )
  return blob ?? file
}

async function readClipboardImage(): Promise<File | null> {
  if (!navigator.clipboard?.read) {
    throw new Error('Brskalnik ne dovoli branja odložišča. Klikni polje in prilepi s Ctrl+V, ali naloži sliko.')
  }
  let timer = 0
  let items: ClipboardItem[]
  try {
    items = await Promise.race([
      navigator.clipboard.read(),
      new Promise<ClipboardItem[]>((_, reject) => {
        timer = window.setTimeout(() => reject(new Error('Dostop do odložišča je zavrnjen. Klikni polje in prilepi s Ctrl+V.')), 4000)
      }),
    ])
  } finally {
    window.clearTimeout(timer)
  }
  for (const item of items) {
    const type = item.types.find((t) => t.startsWith('image/'))
    if (!type) continue
    const blob = await item.getType(type)
    const ext = type.split('/')[1]?.replace('jpeg', 'jpg') || 'png'
    return new File([blob], `posnetek-${Date.now()}.${ext}`, { type })
  }
  return null
}

function PdfFirstPage({ src }: { src: string }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    let pdf: { destroy: () => Promise<void> } | null = null
    setPreviewUrl(null)
    setFailed(false)
    ;(async () => {
      try {
        const res = await fetch(src)
        if (!res.ok) throw new Error('pdf')
        const data = new Uint8Array(await res.arrayBuffer())
        const doc = await openPdfDocument(data)
        pdf = doc
        if (cancelled) return
        const page = await doc.getPage(1)
        const base = page.getViewport({ scale: 1 })
        const viewport = page.getViewport({ scale: 720 / Math.max(base.width, 1) })
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.ceil(viewport.width))
        canvas.height = Math.max(1, Math.ceil(viewport.height))
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('pdf')
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        await page.render({ canvasContext: ctx, viewport }).promise
        const url = canvas.toDataURL('image/jpeg', 0.86)
        page.cleanup()
        if (cancelled) return
        setPreviewUrl(url)
      } catch {
        if (!cancelled) setFailed(true)
      }
    })()
    return () => {
      cancelled = true
      void pdf?.destroy()
    }
  }, [src])

  return (
    <div className="relative h-36 w-full overflow-hidden bg-white">
      {previewUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={previewUrl} alt="" className="block w-full h-auto" />
      ) : null}
      {!previewUrl && !failed ? <div className="absolute inset-0 animate-pulse bg-[#f4f1ea]" /> : null}
      {failed ? (
        <div className="absolute inset-0 flex items-end bg-white p-2 text-left text-[11px] font-medium text-neutral-700">
          PDF
        </div>
      ) : null}
    </div>
  )
}

function PdfFrame({ src, title }: { src: string; title: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    let objectUrl: string | null = null
    setUrl(null)
    setFailed(false)
    ;(async () => {
      try {
        const res = await fetch(src)
        if (!res.ok) throw new Error('pdf')
        const bytes = await res.arrayBuffer()
        objectUrl = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
        if (cancelled) {
          URL.revokeObjectURL(objectUrl)
          return
        }
        setUrl(objectUrl)
      } catch {
        if (!cancelled) setFailed(true)
      }
    })()
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [src])

  if (failed) {
    return (
      <p className="text-sm text-white/70" onClick={(e) => e.stopPropagation()}>
        PDF-ja ni bilo mogoče odpreti.
      </p>
    )
  }
  if (!url) {
    return <Loader2 className="h-6 w-6 animate-spin text-white/70" />
  }
  return (
    <iframe
      src={url}
      title={title}
      className="h-[90vh] w-full max-w-5xl rounded-lg bg-white"
      onClick={(e) => e.stopPropagation()}
    />
  )
}

function CompanyCard({
  company,
  documents,
  onChange,
}: {
  company: CompanyId
  documents: CompanyDocument[] | null
  onChange: () => Promise<unknown>
}) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [lightbox, setLightbox] = useState<{ src: string; kind: 'image' | 'pdf' } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [documentsOpen, setDocumentsOpen] = useState(true)
  const name = COMPANIES[company].name

  const uploadFiles = useCallback(async (files: File[]) => {
    const accepted = files.filter((file) => isImageFile(file) || isPdfUpload(file))
    if (accepted.length === 0) {
      setError('V odložišču ni slike. Najprej naredi posnetek zaslona.')
      return
    }
    const onlyPdf = accepted.every((file) => isPdfUpload(file))
    setUploading(true)
    setError(null)
    try {
      for (const file of accepted) {
        const pdf = isPdfUpload(file)
        const blob = pdf ? file : await fileToDownscaledBlob(file)
        const uploadName = pdf
          ? pdfStorageName(file.name)
          : blob.type === 'image/jpeg' ? 'dokument.jpg' : (file.name || 'dokument.jpg')
        const body = new FormData()
        body.append('file', blob, uploadName)
        body.append('company', company)
        const res = await fetch('/api/upload-company-document', { method: 'POST', body })
        if (!res.ok) throw new Error('upload')
        const { pathname } = (await res.json()) as { pathname: string }
        await addCompanyDocument({
          company,
          pathname,
          fileName: pdf ? pdfStorageName(file.name) : file.name,
        })
      }
      await onChange()
    } catch {
      setError(onlyPdf
        ? 'PDF-ja ni bilo mogoče naložiti. Poskusi znova.'
        : 'Slike ni bilo mogoče naložiti. Poskusi znova.')
    } finally {
      setUploading(false)
    }
  }, [company, onChange])

  async function pasteFromClipboard() {
    setError(null)
    try {
      const file = await readClipboardImage()
      if (!file) {
        setError('V odložišču ni slike. Najprej naredi posnetek zaslona.')
        return
      }
      await uploadFiles([file])
    } catch (err) {
      const denied = err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'SecurityError')
      setError(denied
        ? 'Dostop do odložišča je zavrnjen. Klikni polje in prilepi s Ctrl+V.'
        : err instanceof Error ? err.message : 'Prilepljenje ni uspelo.')
    }
  }

  function onPaste(e: React.ClipboardEvent<HTMLDivElement>) {
    const native = e.nativeEvent.clipboardData
    const images = filesFromClipboard(e.clipboardData?.files?.length ? e.clipboardData : native)
    if (images.length === 0) return
    e.preventDefault()
    void uploadFiles(images)
  }

  return (
    <div className="rounded-xl border border-white/[0.12] bg-white/[0.07] px-4 py-4">
      <h3>
        <button
          type="button"
          onClick={() => setDocumentsOpen((open) => !open)}
          aria-expanded={documentsOpen}
          aria-controls={`dokumenti-${company}`}
          className="flex w-full cursor-pointer items-center justify-between gap-3 text-left"
        >
          <span className="text-[15px] font-medium tracking-[0.02em] text-[#f8f5ef]">
            {name}
          </span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-white/40 transition-transform ${documentsOpen ? 'rotate-180' : ''}`}
            aria-hidden
          />
        </button>
      </h3>
      <p className="mt-1 text-[11px] tracking-[0.04em] text-[#9dafb5]/75">
        Posnetki dokumentov
      </p>

      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          void uploadFiles(Array.from(e.dataTransfer.files || []))
        }}
        className={`relative mt-3 rounded-xl border border-dashed transition-colors ${
          dragOver ? 'border-[#c59b5b]/60 bg-[#c59b5b]/[0.08]' : 'border-white/15 bg-white/[0.02]'
        }`}
      >
        <div
          contentEditable
          suppressContentEditableWarning
          inputMode="none"
          role="textbox"
          aria-label={`Prilepi posnetek dokumenta za ${name}`}
          aria-multiline="false"
          onPaste={onPaste}
          onInput={(e) => {
            e.currentTarget.replaceChildren()
          }}
          className="min-h-[4.5rem] w-full cursor-text rounded-xl px-4 py-4 text-transparent caret-transparent outline-none focus:bg-[#c59b5b]/[0.04]"
        />
        <p className="pointer-events-none absolute inset-0 flex items-center justify-center px-4 text-center text-[11px] leading-relaxed text-white/45">
          Prilepi posnetek dokumenta s <span className="text-[#e8c88a]">Ctrl+V</span>
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void pasteFromClipboard()}
          disabled={uploading}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#c59b5b]/40 bg-[#c59b5b]/10 px-3 py-2 text-xs font-medium text-[#e8c88a] transition-colors hover:bg-[#c59b5b]/20 disabled:opacity-50"
        >
          <ClipboardPaste className="h-3.5 w-3.5" /> Prilepi sliko
        </button>
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2 text-xs text-white/60 transition-colors hover:bg-white/[0.08]">
          <ImagePlus className="h-3.5 w-3.5" /> Naloži sliko
          <input
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            disabled={uploading}
            onChange={(e) => {
              void uploadFiles(Array.from(e.target.files || []))
              e.target.value = ''
            }}
          />
        </label>
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2 text-xs text-white/60 transition-colors hover:bg-white/[0.08]">
          <FileText className="h-3.5 w-3.5" /> Naloži PDF
          <input
            type="file"
            accept="application/pdf,.pdf"
            multiple
            className="sr-only"
            disabled={uploading}
            onChange={(e) => {
              const picked = Array.from(e.target.files || [])
              const pdfs = picked.filter((file) => isPdfUpload(file))
              if (picked.length > 0 && pdfs.length === 0) {
                setError('Izberi PDF datoteko.')
              } else {
                void uploadFiles(pdfs)
              }
              e.target.value = ''
            }}
          />
        </label>
      </div>

      {uploading ? (
        <p className="mt-3 flex items-center gap-2 text-[11px] text-[#7fa8b8]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Nalagam posnetek…
        </p>
      ) : null}
      {error ? <p className="mt-3 text-[11px] text-[#c8846b]">{error}</p> : null}

      {documentsOpen ? (
        <div id={`dokumenti-${company}`}>
          {documents && documents.length === 0 && !uploading ? (
            <p className="mt-3 text-[11px] font-light italic text-white/35">
              Še ni posnetkov dokumentov.
            </p>
          ) : null}

          {documents && documents.length > 0 ? (
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {documents.map((doc) => {
            const src = `/api/image?pathname=${encodeURIComponent(doc.pathname)}`
            const pdf = isPdfCompanyDocument(doc)
            return (
            <div
              key={doc.id}
              className="overflow-hidden rounded-xl border border-white/[0.10] bg-white/[0.03]"
            >
              <button
                type="button"
                onClick={() => setLightbox({ src, kind: pdf ? 'pdf' : 'image' })}
                className="block w-full cursor-pointer bg-black/20"
                aria-label={pdf ? `Odpri PDF ${name}` : `Povečaj dokument ${name}`}
              >
                {pdf ? (
                  <PdfFirstPage src={src} />
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={src}
                    alt={doc.fileName || `Dokument ${name}`}
                    className="h-36 w-full object-contain object-top"
                  />
                )}
              </button>
              <div className="flex items-center justify-between gap-2 px-2.5 py-2">
                <span className="text-[9px] uppercase tracking-wider tabular-nums text-white/25">
                  {doc.createdAt ? new Date(doc.createdAt).toLocaleDateString('sl-SI') : ''}
                </span>
                {confirmDelete === doc.id ? (
                  <span className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        void deleteCompanyDocument(doc.id).then(() => onChange())
                        setConfirmDelete(null)
                      }}
                      className="cursor-pointer rounded-md bg-[#c8846b]/20 px-2 py-0.5 text-[10px] font-medium text-[#c8846b]"
                    >
                      Res izbriši
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(null)}
                      className="cursor-pointer rounded-md px-1.5 py-0.5 text-[10px] text-white/40"
                    >
                      Ne
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(doc.id)}
                    className="cursor-pointer text-white/25 transition-colors hover:text-[#c8846b]"
                    aria-label={`Izbriši dokument ${name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
            )
              })}
            </div>
          ) : null}
        </div>
      ) : null}

      {lightbox && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 p-4"
              onClick={() => setLightbox(null)}
              role="dialog"
              aria-modal="true"
            >
              <button
                type="button"
                onClick={() => setLightbox(null)}
                className="absolute right-4 top-4 z-10 cursor-pointer rounded-full border border-white/15 bg-white/[0.06] p-2 text-white/70 hover:text-white"
                aria-label="Zapri"
              >
                <X className="h-5 w-5" />
              </button>
              {lightbox.kind === 'pdf' ? (
                <PdfFrame src={lightbox.src} title={`PDF ${name}`} />
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={lightbox.src}
                  alt={`Dokument ${name}`}
                  className="max-h-[90vh] max-w-full rounded-lg object-contain"
                  onClick={(e) => e.stopPropagation()}
                />
              )}
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}

async function rasterizeDocument(pathname: string): Promise<{ dataUrl: string; width: number; height: number }> {
  const res = await fetch(`/api/image?pathname=${encodeURIComponent(pathname)}`)
  if (!res.ok) throw new Error('image')
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new Image()
      im.onload = () => resolve(im)
      im.onerror = reject
      im.src = url
    })
    const width = img.naturalWidth || img.width
    const height = img.naturalHeight || img.height
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx || !width || !height) throw new Error('image')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(img, 0, 0)
    return { dataUrl: canvas.toDataURL('image/jpeg', 0.92), width, height }
  } finally {
    URL.revokeObjectURL(url)
  }
}

function downloadPdf(bytes: Uint8Array) {
  const blob = new Blob([bytes], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = PDF_FILENAME
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export default function PodatkiPodjetij() {
  const { data, error, mutate } = useSWR('company-documents', getCompanyDocuments, { refreshInterval: 0 })
  const [saving, setSaving] = useState(false)
  const [pdfNote, setPdfNote] = useState<{ tone: 'muted' | 'error'; text: string } | null>(null)
  const count = data?.length ?? -1

  useEffect(() => {
    setPdfNote(null)
  }, [count])

  async function savePdf() {
    if (!data) return
    const pages = documentsForPdf(data)
    if (pages.length === 0) {
      setPdfNote({ tone: 'muted', text: NOTHING_TO_SAVE })
      return
    }
    setSaving(true)
    setPdfNote(null)
    try {
      const images = []
      for (const page of pages) {
        if (isPdfCompanyDocument(page)) {
          const res = await fetch(`/api/image?pathname=${encodeURIComponent(page.pathname)}`)
          if (!res.ok) throw new Error('pdf')
          images.push(...await rasterizePdfBytes(new Uint8Array(await res.arrayBuffer())))
        } else {
          images.push(await rasterizeDocument(page.pathname))
        }
      }
      const bytes = await buildCompanyDocumentsPdf(images)
      if (!bytes) {
        setPdfNote({ tone: 'muted', text: NOTHING_TO_SAVE })
        return
      }
      downloadPdf(bytes)
    } catch {
      setPdfNote({ tone: 'error', text: 'PDF-ja ni bilo mogoče pripraviti.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <section aria-labelledby="podatki-podjetij-title">
      <p
        id="podatki-podjetij-title"
        className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.28em] text-[#9dafb5]/70"
      >
        <span aria-hidden className="h-px w-4 bg-[#c59b5b]/80" />
        Podatki podjetij
      </p>
      <div className="mt-3.5 flex flex-col gap-3">
        {error ? (
          <p className="text-[11px] text-[#c8846b]">Podatkov podjetij ni bilo mogoče naložiti.</p>
        ) : null}
        {COMPANIES_IN_ORDER.map((company) => (
          <CompanyCard
            key={company}
            company={company}
            documents={data ? data.filter((doc) => doc.company === company) : null}
            onChange={() => mutate()}
          />
        ))}
        <div>
          <button
            type="button"
            onClick={() => void savePdf()}
            disabled={saving || !data}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#c59b5b]/40 bg-[#c59b5b]/10 px-3 py-2 text-xs font-medium text-[#e8c88a] transition-colors hover:bg-[#c59b5b]/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Shrani PDF
          </button>
          {pdfNote ? (
            <p className={`mt-2 text-[11px] ${pdfNote.tone === 'error' ? 'text-[#c8846b]' : 'text-white/45'}`}>
              {pdfNote.text}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  )
}
