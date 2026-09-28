"use client"

import { useEffect, useState, useCallback } from "react"
import { RefreshCw, Trash2, MessageSquare } from "lucide-react"
import {
  getSurveyResponses,
  getSurveySummary,
  deleteSurveyResponse,
  type SurveyResponseRecord,
  type SurveySummaryRow,
} from "@/app/actions/survey"
import { findSurveySource } from "@/lib/survey-sources"
import { bungalowDisplayName } from "@/lib/bungalow"

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("sl-SI", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return iso
  }
}

export function SurveyResponsesBox() {
  const [responses, setResponses] = useState<SurveyResponseRecord[]>([])
  const [summary, setSummary] = useState<SurveySummaryRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [r, s] = await Promise.all([getSurveyResponses(), getSurveySummary()])
      setResponses(r)
      setSummary(s)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const total = summary.reduce((acc, s) => acc + s.count, 0)

  async function handleDelete(id: string) {
    if (!confirm("Izbrišem ta odgovor?")) return
    await deleteSurveyResponse(id)
    load()
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="text-sm text-white/50">
          {total > 0 ? `Skupaj ${total} odgovorov` : "Ni odgovorov"}
        </p>
        <button
          onClick={load}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-white/70 transition-colors hover:bg-white/5"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Osveži
        </button>
      </div>

      {/* Summary by source */}
      {summary.length > 0 && (
        <div className="mb-6 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {summary.map((s) => {
            const src = findSurveySource(s.source)
            const pct = total > 0 ? Math.round((s.count / total) * 100) : 0
            return (
              <div
                key={s.source}
                className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm text-white/80">
                    <span className="mr-1.5">{src?.emoji || "•"}</span>
                    {s.sourceLabel || s.source}
                  </span>
                  <span className="shrink-0 text-sm font-semibold text-[#c59b5b]">{s.count}</span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-[#c59b5b]"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="mt-1 text-[11px] text-white/40">{pct}%</p>
              </div>
            )
          })}
        </div>
      )}

      {/* Individual responses */}
      {loading && responses.length === 0 ? (
        <p className="text-sm text-white/40">Nalagam...</p>
      ) : responses.length === 0 ? (
        <p className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 text-center text-sm text-white/40">
          Ko gostje odgovorijo na anketo, se bodo odgovori prikazali tukaj.
        </p>
      ) : (
        <div className="space-y-2">
          {responses.map((r) => {
            const src = findSurveySource(r.source)
            return (
              <div
                key={r.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md border border-[#c59b5b]/25 bg-[#c59b5b]/10 px-2 py-0.5 text-xs font-medium text-[#c59b5b]">
                      {src?.emoji || "•"} {r.sourceLabel || r.source}
                    </span>
                    {r.guestName && (
                      <span className="text-sm font-medium text-white">{r.guestName}</span>
                    )}
                    {r.bungalow && (
                      <span className="truncate text-xs text-white/40">{bungalowDisplayName(r.bungalow)}</span>
                    )}
                  </div>
                  {r.comment && (
                    <p className="mt-1.5 flex items-start gap-1.5 text-sm text-white/60">
                      <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/30" />
                      <span className="italic">{r.comment}</span>
                    </p>
                  )}
                  <p className="mt-1 text-[11px] text-white/30">{formatDateTime(r.createdAt)}</p>
                </div>
                <button
                  onClick={() => handleDelete(r.id)}
                  className="shrink-0 rounded-lg p-1.5 text-white/30 transition-colors hover:bg-red-500/10 hover:text-red-300"
                  aria-label="Izbriši odgovor"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
