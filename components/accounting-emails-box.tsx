"use client"

import React from "react"
import { createPortal } from "react-dom"
import { Mail, Users, User, RefreshCw, Trash2, Eye, X } from "lucide-react"
import {
  getAccountingEmails,
  deleteAccountingEmail,
  getAccountingEmailHtml,
  type AccountingEmailRecord,
} from "@/app/actions/attendance-email"

const MONTHS_SL = [
  "januar", "februar", "marec", "april", "maj", "junij",
  "julij", "avgust", "september", "oktober", "november", "december",
]

const TYPE_META: Record<string, { label: string; className: string; Icon: typeof Mail }> = {
  "attendance-combined": {
    label: "Obračun vseh",
    className: "bg-[#7fa8b8]/15 border-[#7fa8b8]/25 text-[#7fa8b8]",
    Icon: Users,
  },
  attendance: {
    label: "Obračun delavca",
    className: "bg-[#8fae92]/15 border-[#8fae92]/25 text-[#8fae92]",
    Icon: User,
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
 * Pregled emailov, poslanih računovodstvu (obračuni ur).
 * `refreshKey` starš poveča po pošiljanju, da se seznam osveži.
 */
export function AccountingEmailsBox({ refreshKey = 0 }: { refreshKey?: number }) {
  const [rows, setRows] = React.useState<AccountingEmailRecord[]>([])
  const [loading, setLoading] = React.useState(true)
  const [reloadTick, setReloadTick] = React.useState(0)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const [preview, setPreview] = React.useState<{ title: string; html: string } | null>(null)
  const [loadingPreview, setLoadingPreview] = React.useState<string | null>(null)

  async function handlePreview(r: AccountingEmailRecord) {
    setLoadingPreview(r.id)
    try {
      const res = await getAccountingEmailHtml(r.id)
      if (res.html) {
        setPreview({ title: r.subject || "Predogled emaila", html: res.html })
      } else {
        window.alert("Za ta email vsebina ni shranjena (poslan pred uvedbo predogleda).")
      }
    } finally {
      setLoadingPreview(null)
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Izbrisati ta email iz seznama?")) return
    setDeletingId(id)
    try {
      const res = await deleteAccountingEmail(id)
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
    getAccountingEmails()
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
  }, [refreshKey, reloadTick])

  return (
    <div className="rounded-2xl border border-white/10 bg-[rgba(15,46,58,0.82)] p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-[#9dafb5]" />
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c9d1cf]">
            Poslani emaili računovodstvu
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
        <p className="py-4 text-center text-xs text-white/40">Ni poslanih emailov računovodstvu.</p>
      ) : (
        <div className="max-h-[65vh] space-y-2 overflow-y-auto">
          {rows.map((r) => {
            const meta = TYPE_META[r.type] || {
              label: r.type,
              className: "bg-white/5 border-white/10 text-white/70",
              Icon: Mail,
            }
            const Icon = meta.Icon
            const period = `${MONTHS_SL[r.month - 1] ?? r.month} ${r.year}`
            return (
              <div
                key={r.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${meta.className}`}
                    >
                      <Icon className="h-3 w-3" />
                      {meta.label}
                    </span>
                    {r.staffName && (
                      <span className="truncate text-xs font-medium text-white/80">{r.staffName}</span>
                    )}
                    <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] text-white/50">
                      {period}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-white/50">{r.recipient}</p>
                  {r.subject && (
                    <p className="mt-0.5 truncate text-[11px] text-white/30">{r.subject}</p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className="whitespace-nowrap text-[11px] text-white/40">
                    {formatWhen(r.sentAt)}
                  </span>
                  <button
                    onClick={() => handlePreview(r)}
                    disabled={loadingPreview === r.id}
                    className="flex items-center gap-1 rounded-lg border border-[#7fa8b8]/25 px-2 py-1 text-[10px] text-[#7fa8b8]/80 transition-colors hover:bg-[#7fa8b8]/10 hover:text-[#7fa8b8] disabled:opacity-50"
                    aria-label="Predogled poslanega emaila"
                  >
                    <Eye className="h-3 w-3" />
                    {loadingPreview === r.id ? "Odpiram..." : "Predogled"}
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
              className="flex h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0a2029] shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
                <span className="truncate text-sm font-semibold text-white/85">{preview.title}</span>
                <button
                  onClick={() => setPreview(null)}
                  className="flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-xs text-white/60 transition-colors hover:bg-white/5 hover:text-white"
                  aria-label="Zapri predogled"
                >
                  <X className="h-4 w-4" />
                  Zapri
                </button>
              </div>
              <iframe
                srcDoc={preview.html}
                title="Predogled poslanega emaila"
                className="h-full w-full flex-1 bg-white"
              />
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
