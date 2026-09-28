"use client"

import { useState } from "react"
import { addSurveyComment, toggleSurveySource } from "@/app/actions/survey"
import { SURVEY_SOURCES } from "@/lib/survey-sources"

export function SurveyThankYou({
  reservationId,
  guestName,
  initialSource,
  initialSelected,
}: {
  reservationId: string
  guestName: string
  initialSource: string
  initialSelected: string[]
}) {
  const [selected, setSelected] = useState<string[]>(
    initialSelected.length ? initialSelected : [initialSource]
  )
  const [pending, setPending] = useState<string | null>(null)
  const [comment, setComment] = useState("")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const firstName = (guestName || "").trim().split(/\s+/)[0]

  async function toggle(key: string) {
    const isOn = selected.includes(key)
    // Optimistic update.
    setSelected((prev) => (isOn ? prev.filter((k) => k !== key) : [...prev, key]))
    setPending(key)
    try {
      const res = await toggleSurveySource(reservationId, key, !isOn)
      if (res.success) setSelected(res.selected)
    } finally {
      setPending(null)
    }
  }

  async function submitComment() {
    if (!comment.trim()) return
    setSaving(true)
    try {
      await addSurveyComment(reservationId, comment)
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0a2029] px-6 py-12">
      <div className="w-full max-w-md text-center">
        <img
          src="/images/komba-logo-gold.png"
          alt="Komba Cabana"
          width={140}
          className="mx-auto mb-8 h-auto w-[140px]"
        />

        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-[#c59b5b]/30 bg-[#c59b5b]/10 text-2xl text-[#c59b5b]">
            {"\u2713"}
          </div>
          <h1 className="mb-3 text-2xl font-semibold text-white text-balance">
            Thank you{firstName ? `, ${firstName}` : ""}!
          </h1>
          <p className="text-sm leading-relaxed text-white/60 text-pretty">
            Thanks for letting us know how you found Komba Cabana. Did you discover us in more
            than one place? Feel free to select all that apply.
          </p>

          <div className="mt-6 flex flex-col gap-2 text-left">
            {SURVEY_SOURCES.map((s) => {
              const on = selected.includes(s.key)
              return (
                <button
                  key={s.key}
                  onClick={() => toggle(s.key)}
                  disabled={pending === s.key}
                  aria-pressed={on}
                  className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition-colors disabled:opacity-60 ${
                    on
                      ? "border-[#c59b5b]/50 bg-[#c59b5b]/10 text-[#c59b5b]"
                      : "border-white/10 bg-white/[0.03] text-white/70 hover:border-white/20 hover:text-white"
                  }`}
                >
                  <span className="w-6 text-center text-base">{s.emoji}</span>
                  <span className="flex-1">{s.label}</span>
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-md border text-xs ${
                      on ? "border-[#c59b5b] bg-[#c59b5b] text-[#0a2029]" : "border-white/20 text-transparent"
                    }`}
                  >
                    {"\u2713"}
                  </span>
                </button>
              )
            })}
          </div>

          {!saved ? (
            <div className="mt-6 text-left">
              <label className="block text-xs font-medium text-white/50">
                Anything you&apos;d like to add? (optional)
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  disabled={saving}
                  rows={3}
                  placeholder="Tell us more about how you discovered us..."
                  className="mt-2 w-full resize-none rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-[#c59b5b]/50 focus:outline-none disabled:opacity-50"
                />
              </label>
              <button
                onClick={submitComment}
                disabled={saving || !comment.trim()}
                className="mt-3 w-full rounded-xl bg-[#c59b5b] px-5 py-2.5 text-sm font-semibold text-[#0a2029] transition-colors hover:bg-[#c59b5b]/90 disabled:opacity-40"
              >
                {saving ? "Sending..." : "Send"}
              </button>
            </div>
          ) : (
            <p className="mt-6 rounded-xl border border-[#8fae92]/25 bg-[#8fae92]/10 px-4 py-3 text-sm text-[#8fae92]">
              Thank you for the extra note — we truly appreciate it!
            </p>
          )}
        </div>

        <p className="mt-6 text-xs text-white/30">
          Komba Cabana &middot; Nosy Komba, Madagascar
        </p>
      </div>
    </main>
  )
}
