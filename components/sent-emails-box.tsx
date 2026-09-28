"use client"

import React from "react"
import { createPortal } from "react-dom"
import { Mail, FileText, Ship, ShieldCheck, RefreshCw, Trash2, Eye, X, Compass } from "lucide-react"
import {
  getSentEmailsForReservation,
  getAllSentEmails,
  deleteSentEmail,
  type SentEmailRecord,
} from "@/app/actions/sent-emails"
import { getSentEmailPreview } from "@/app/actions/sent-email-preview"
import { bungalowDisplayName } from "@/lib/bungalow"

const TYPE_META: Record<
  string,
  { label: string; className: string; Icon: typeof Mail }
> = {
  checkin: {
    label: "Prijava (policija)",
    className: "bg-[#c59b5b]/15 border-[#c59b5b]/25 text-[#c59b5b]",
    Icon: ShieldCheck,
  },
  invoice: {
    label: "Račun",
    className: "bg-[#8fae92]/15 border-[#8fae92]/25 text-[#8fae92]",
    Icon: FileText,
  },
  voucher: {
    label: "Vaučer transfer",
    className: "bg-[#7fa8b8]/15 border-[#7fa8b8]/25 text-[#7fa8b8]",
    Icon: Ship,
  },
  feedback: {
    label: "Anketa (kje so nas našli)",
    className: "bg-[#c59b5b]/15 border-[#c59b5b]/25 text-[#c59b5b]",
    Icon: Mail,
  },
  "excursion-offer": {
    label: "Ponudba izletov",
    className: "bg-[#7fa8b8]/15 border-[#7fa8b8]/25 text-[#7fa8b8]",
    Icon: Compass,
  },
}

function formatWhen(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleString("sl-SI", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/**
 * Shows the log of emails actually sent to guests.
 * - Pass `reservationId` for a single reservation's emails.
 * - Omit `reservationId` (or pass `all`) for the global overview.
 * `refreshKey` can be bumped by the parent to force a re-fetch after sending.
 */
export function SentEmailsBox({
  reservationId,
  all = false,
  refreshKey = 0,
  compact = false,
}: {
  reservationId?: string
  all?: boolean
  refreshKey?: number
  compact?: boolean
}) {
  const [rows, setRows] = React.useState<SentEmailRecord[]>([])
  const [loading, setLoading] = React.useState(true)
  const [reloadTick, setReloadTick] = React.useState(0)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const [previewingId, setPreviewingId] = React.useState<string | null>(null)
  const [preview, setPreview] = React.useState<{ rec: SentEmailRecord; html: string } | null>(null)

  async function handlePreview(rec: SentEmailRecord) {
    setPreviewingId(rec.id)
    try {
      const res = await getSentEmailPreview(rec.id)
      if (res.html) {
        setPreview({ rec, html: res.html })
      } else {
        window.alert(res.error || "Predogleda ni bilo mogoce obnoviti.")
      }
    } finally {
      setPreviewingId(null)
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Izbrisati ta email iz seznama?")) return
    setDeletingId(id)
    try {
      const res = await deleteSentEmail(id)
      if (res.success) {
        setRows((prev) => prev.filter((r) => r.id !== id))
      } else {
        window.alert(res.error || "Brisanje ni uspelo.")
      }
    } finally {
      setDeletingId(null)
    }
  }

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    const load = all || !reservationId
      ? getAllSentEmails()
      : getSentEmailsForReservation(reservationId)
    load
      .then((data) => {
        if (!cancelled) setRows(data)
      })
      .catch(() => {
        if (!cancelled) setRows([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [reservationId, all, refreshKey, reloadTick])

  return (
    <div
      className={
        compact
          ? "mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3"
          : "rounded-2xl border border-white/10 bg-[rgba(15,46,58,0.82)] p-5"
      }
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-[#9dafb5]" />
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c9d1cf]">
            {all || !reservationId ? "Poslani emaili (vsi)" : "Poslani emaili"}
          </span>
          {!loading && (
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white/60">
              {rows.length}
            </span>
          )}
        </div>
        <button
          onClick={() => setReloadTick((t) => t + 1)}
          className="flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-[10px] text-white/50 transition-colors hover:bg-white/5 hover:text-white/80"
          aria-label="Osveži seznam"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          Osveži
        </button>
      </div>

      {loading ? (
        <p className="py-4 text-center text-xs text-white/40">Nalagam...</p>
      ) : rows.length === 0 ? (
        <p className="py-4 text-center text-xs text-white/40">Ni poslanih emailov.</p>
      ) : (
        <div className={`space-y-2 ${all || !reservationId ? "max-h-[65vh] overflow-y-auto" : "max-h-72 overflow-y-auto"}`}>
          {rows.map((r) => {
            const meta = TYPE_META[r.type] || {
              label: r.type,
              className: "bg-white/5 border-white/10 text-white/70",
              Icon: Mail,
            }
            const Icon = meta.Icon
            return (
              <div
                key={r.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"
              >
                <button
                  type="button"
                  onClick={() => handlePreview(r)}
                  disabled={previewingId === r.id}
                  className="min-w-0 flex-1 text-left transition-colors hover:opacity-90 disabled:opacity-50"
                  title="Prikaži vsebino poslanega emaila"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${meta.className}`}
                    >
                      <Icon className="h-3 w-3" />
                      {meta.label}
                    </span>
                    {(all || !reservationId) && r.guestName && (
                      <span className="truncate text-xs font-medium text-white/80">
                        {r.guestName}
                        {r.bungalow ? ` · ${bungalowDisplayName(r.bungalow)}` : ""}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 truncate text-xs text-white/50">{r.recipient}</p>
                  {r.subject && (
                    <p className="mt-0.5 truncate text-[11px] text-white/30">{r.subject}</p>
                  )}
                </button>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className="whitespace-nowrap text-[11px] text-white/40">
                    {formatWhen(r.sentAt)}
                  </span>
                  <button
                    onClick={() => handlePreview(r)}
                    disabled={previewingId === r.id}
                    className="flex items-center gap-1 rounded-lg border border-white/15 px-2 py-1 text-[10px] text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
                    aria-label="Prikaži vsebino emaila"
                  >
                    <Eye className="h-3 w-3" />
                    {previewingId === r.id ? "Odpiram..." : "Ogled"}
                  </button>
                  <button
                    onClick={() => handleDelete(r.id)}
                    disabled={deletingId === r.id}
                    className="flex items-center gap-1 rounded-lg border border-[#bc7d67]/25 px-2 py-1 text-[10px] text-[#bc7d67]/80 transition-colors hover:bg-[#bc7d67]/10 hover:text-[#bc7d67] disabled:opacity-50"
                    aria-label="Izbriši email iz seznama"
                  >
                    <Trash2 className="h-3 w-3" />
                    {deletingId === r.id ? "Brišem..." : "Izbriši"}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {preview && typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
            onClick={() => setPreview(null)}
          >
            <div
              className="flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#101d22] shadow-2xl"
              style={{ maxHeight: "90vh" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-white">
                    {(TYPE_META[preview.rec.type]?.label || preview.rec.type)} — poslani email
                  </h3>
                  <p className="mt-0.5 truncate text-xs text-white/50">
                    Prejemnik: <span className="text-white/80">{preview.rec.recipient}</span> ·{" "}
                    {formatWhen(preview.rec.sentAt)}
                  </p>
                </div>
                <button
                  onClick={() => setPreview(null)}
                  className="rounded-lg p-1.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
                  aria-label="Zapri predogled"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-hidden bg-white">
                <iframe
                  title="Vsebina poslanega emaila"
                  srcDoc={preview.html}
                  className="h-full w-full border-0"
                  style={{ minHeight: "50vh" }}
                />
              </div>

              <div className="flex items-center justify-end border-t border-white/10 px-5 py-3">
                <button
                  onClick={() => setPreview(null)}
                  className="rounded-xl border border-white/15 px-4 py-2 text-sm font-medium text-white/70 transition-colors hover:bg-white/5"
                >
                  Zapri
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
