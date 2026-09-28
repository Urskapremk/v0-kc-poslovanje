'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import useSWR from 'swr'
import { Camera, ImagePlus, Loader2, Trash2, X, MessageSquare, Save } from 'lucide-react'
import {
  getMessageShots,
  addMessageShot,
  updateMessageShotCaption,
  deleteMessageShot,
} from '@/app/actions/message-shots'

// Posnetke pomanjšamo pred nalaganjem: telefonski zajemi so lahko 3-7 MB, kar
// brskalniku na telefonu poje pomnilnik. 1600 px je še vedno berljivo besedilo.
async function fileToDownscaledBlob(f: File, maxDim = 1600, quality = 0.82): Promise<Blob> {
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
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/jpeg', quality),
  )
  return blob ?? f
}

export default function MessageShotsBox({ reservationId }: { reservationId: string }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  const { data: shots, mutate } = useSWR(
    reservationId ? ['message-shots', reservationId] : null,
    () => getMessageShots(reservationId),
    { refreshInterval: 0 },
  )

  const list = shots || []

  const uploadFiles = useCallback(
    async (files: File[]) => {
      const images = files.filter((f) => f.type.startsWith('image/'))
      if (images.length === 0) return
      setUploading(true)
      setError(null)
      try {
        for (const f of images) {
          const blob = await fileToDownscaledBlob(f)
          const fd = new FormData()
          fd.append('file', blob, 'sporocilo.jpg')
          const res = await fetch('/api/upload-message-shot', { method: 'POST', body: fd })
          if (!res.ok) throw new Error('upload')
          const { pathname } = (await res.json()) as { pathname: string }
          await addMessageShot({ reservationId, pathname, fileName: f.name })
        }
        await mutate()
      } catch {
        setError('Slike ni bilo mogoče naložiti. Poskusi znova.')
      } finally {
        setUploading(false)
      }
    },
    [reservationId, mutate],
  )

  // Posnetek zaslona je skoraj vedno v odložišču, zato podpremo Ctrl+V kjer koli
  // v kartici — razen ko uporabnica tipka v polje, da ne prevzamemo lepljenja besedila.
  useEffect(() => {
    if (!reservationId) return
    const onPaste = (e: ClipboardEvent) => {
      const el = e.target as HTMLElement | null
      const tag = el?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || el?.isContentEditable) return
      const files = Array.from(e.clipboardData?.files || [])
      const images = files.filter((f) => f.type.startsWith('image/'))
      if (images.length === 0) return
      e.preventDefault()
      void uploadFiles(images)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [reservationId, uploadFiles])

  async function handleSaveCaption(id: string) {
    await updateMessageShotCaption(id, editText.trim())
    setEditingId(null)
    setEditText('')
    await mutate()
  }

  async function handleDelete(id: string) {
    await deleteMessageShot(id)
    setConfirmDelete(null)
    await mutate()
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#9dafb5]">
          <span aria-hidden className="h-px w-4 bg-[#c59b5b]/60" />
          Posnetki sporočil
        </label>
        {list.length > 0 ? (
          <span className="rounded-md bg-[#c59b5b]/15 px-2 py-0.5 text-[10px] font-medium tabular-nums text-[#e8c88a]">
            {list.length}
          </span>
        ) : null}
      </div>

      {/* Območje za dodajanje: klik, povleci-in-spusti ali Ctrl+V */}
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
        className={`rounded-xl border border-dashed px-4 py-4 transition-colors ${
          dragOver ? 'border-[#c59b5b]/60 bg-[#c59b5b]/[0.08]' : 'border-white/15 bg-white/[0.02]'
        }`}
      >
        <p className="text-center text-[11px] leading-relaxed text-white/45">
          Prilepi posnetek s <span className="text-[#e8c88a]">Ctrl+V</span>, ga povleci sem ali izberi spodaj.
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#c59b5b]/40 bg-[#c59b5b]/10 px-3 py-2 text-xs font-medium text-[#e8c88a] transition-colors hover:bg-[#c59b5b]/20 disabled:opacity-50"
          >
            <ImagePlus className="h-3.5 w-3.5" /> Naloži sliko
          </button>
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            disabled={uploading}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2 text-xs text-white/60 transition-colors hover:bg-white/[0.08] disabled:opacity-50"
          >
            <Camera className="h-3.5 w-3.5" /> Fotografiraj
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            void uploadFiles(Array.from(e.target.files || []))
            e.target.value = ''
          }}
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            void uploadFiles(Array.from(e.target.files || []))
            e.target.value = ''
          }}
        />
      </div>

      {uploading ? (
        <p className="flex items-center gap-2 text-[11px] text-[#7fa8b8]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Nalagam posnetek...
        </p>
      ) : null}
      {error ? <p className="text-[11px] text-[#c8846b]">{error}</p> : null}

      {list.length === 0 && !uploading ? (
        <p className="flex items-center gap-2 px-1 text-[11px] font-light italic text-white/35">
          <MessageSquare className="h-3.5 w-3.5" /> Še ni posnetkov korespondence.
        </p>
      ) : null}

      {list.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {list.map((s) => (
            <div
              key={s.id}
              className="overflow-hidden rounded-xl border border-white/[0.10] bg-white/[0.03]"
            >
              <button
                type="button"
                onClick={() => setLightbox(s.pathname)}
                className="block w-full cursor-pointer"
                aria-label="Povečaj posnetek sporočila"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/image?pathname=${encodeURIComponent(s.pathname)}`}
                  alt={s.caption || 'Posnetek sporočila'}
                  className="h-32 w-full object-cover object-top transition-opacity hover:opacity-85"
                />
              </button>
              <div className="space-y-2 px-2.5 py-2">
                {editingId === s.id ? (
                  <div className="space-y-1.5">
                    <input
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      placeholder="Opis posnetka"
                      autoFocus
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-[11px] text-white placeholder:text-white/30 focus:border-[#c59b5b]/50 focus:outline-none"
                    />
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => void handleSaveCaption(s.id)}
                        className="inline-flex cursor-pointer items-center gap-1 rounded-md bg-[#c59b5b]/20 px-2 py-1 text-[10px] font-medium text-[#e8c88a] hover:bg-[#c59b5b]/30"
                      >
                        <Save className="h-3 w-3" /> Shrani
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="cursor-pointer rounded-md px-2 py-1 text-[10px] text-white/40 hover:text-white/70"
                      >
                        Prekliči
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(s.id)
                      setEditText(s.caption)
                    }}
                    className="block w-full cursor-pointer text-left text-[11px] leading-snug text-white/60 hover:text-white/85"
                  >
                    {s.caption || <span className="italic text-white/30">Dodaj opis...</span>}
                  </button>
                )}

                <div className="flex items-center justify-between gap-2">
                  <span className="text-[9px] uppercase tracking-wider tabular-nums text-white/25">
                    {s.createdAt ? new Date(s.createdAt).toLocaleDateString('sl-SI') : ''}
                  </span>
                  {confirmDelete === s.id ? (
                    <span className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => void handleDelete(s.id)}
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
                      onClick={() => setConfirmDelete(s.id)}
                      className="cursor-pointer text-white/25 transition-colors hover:text-[#c8846b]"
                      aria-label="Izbriši posnetek"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* Povečan pogled */}
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
                className="absolute right-4 top-4 cursor-pointer rounded-full border border-white/15 bg-white/[0.06] p-2 text-white/70 hover:text-white"
                aria-label="Zapri"
              >
                <X className="h-5 w-5" />
              </button>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/image?pathname=${encodeURIComponent(lightbox)}`}
                alt="Posnetek sporočila"
                className="max-h-[90vh] max-w-full rounded-lg object-contain"
                onClick={(e) => e.stopPropagation()}
              />
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
