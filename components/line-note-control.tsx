'use client'

import { useId, useState } from 'react'
import { LINE_NOTE_MAX } from '@/lib/line-note'

type Tone = 'light' | 'dark'

/**
 * Short note on one payment line. Saving always asks whether it prints on the
 * guest invoice. Until she answers Da, the note stays in the app.
 */
export function LineNoteControl({
  note,
  onInvoice,
  tone,
  onSave,
}: {
  note?: string | null
  onInvoice?: boolean | null
  tone: Tone
  onSave: (note: string, onInvoice: boolean) => Promise<void>
}) {
  const [localSaved, setLocalSaved] = useState<string | null>(null)
  const saved = localSaved !== null ? localSaved : (note || '').trim()
  const fieldId = useId()
  const [mode, setMode] = useState<'view' | 'edit' | 'ask'>('view')
  const [draft, setDraft] = useState(saved)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  // The answer she just gave, until the refreshed line catches up.
  const [chosen, setChosen] = useState<boolean | null>(null)
  const onBill = (chosen ?? (onInvoice === true)) && saved.length > 0

  const light = tone === 'light'
  const label = light ? 'text-[#2b2622]/55' : 'text-white/45'
  const body = light ? 'text-[#0f2e3a]' : 'text-white/85'
  const field = light
    ? 'border-[#0f2e3a]/20 bg-white/70 text-[#0f2e3a] placeholder:text-[#2b2622]/35'
    : 'border-white/15 bg-white/5 text-white placeholder:text-white/30'
  const quiet = light
    ? 'border-[#0f2e3a]/20 text-[#2b2622]/70 hover:bg-[#0f2e3a]/5'
    : 'border-white/15 text-white/70 hover:bg-white/10'
  const yes = light
    ? 'border-[#4f7a54]/50 bg-[#4f7a54]/15 text-[#4f7a54] hover:bg-[#4f7a54]/25'
    : 'border-[#8fae92]/50 bg-[#8fae92]/15 text-[#8fae92] hover:bg-[#8fae92]/25'
  const no = light
    ? 'border-[#0f2e3a]/25 text-[#0f2e3a] hover:bg-[#0f2e3a]/5'
    : 'border-white/20 text-white hover:bg-white/10'

  async function run(next: string, printOnInvoice: boolean, after: 'view' | 'ask') {
    setBusy(true)
    setError('')
    try {
      await onSave(next, printOnInvoice)
      setLocalSaved(next.trim())
      setChosen(next.trim() ? printOnInvoice : null)
      setMode(after)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Shranjevanje ni uspelo.')
    } finally {
      setBusy(false)
    }
  }

  if (mode === 'ask') {
    return (
      <div className="space-y-2">
        <p className={`text-[13px] ${body}`}>{draft.trim()}</p>
        <p className={`text-[12px] font-medium ${body}`}>Naj se ta opomba izpiše na računu?</p>
        <p className={`text-[11px] ${label}`}>Da — izpiše se pod to postavko. Ne — ostane samo v aplikaciji.</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => run(draft.trim(), true, 'view')}
            className={`rounded-lg border px-3 py-1.5 text-[12px] font-semibold disabled:opacity-50 ${yes}`}
          >
            Da
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => { setChosen(false); setMode('view') }}
            className={`rounded-lg border px-3 py-1.5 text-[12px] font-semibold disabled:opacity-50 ${no}`}
          >
            Ne
          </button>
        </div>
        {error && <p className="text-[11px] text-[#b0203a]">{error}</p>}
      </div>
    )
  }

  if (mode === 'edit') {
    return (
      <div className="space-y-2">
        <label htmlFor={fieldId} className={`block text-[11px] font-medium uppercase tracking-[0.1em] ${label}`}>
          Opomba
        </label>
        <textarea
          id={fieldId}
          value={draft}
          maxLength={LINE_NOTE_MAX}
          rows={2}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Kratka opomba"
          className={`w-full resize-y rounded-lg border px-2.5 py-1.5 text-[13px] focus:outline-none ${field}`}
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy || !draft.trim()}
            onClick={() => run(draft.trim(), false, 'ask')}
            className={`rounded-lg border px-3 py-1 text-[12px] font-semibold disabled:opacity-50 ${yes}`}
          >
            {busy ? 'Shranjujem...' : 'Shrani'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => { setError(''); setMode('view') }}
            className={`rounded-lg border px-3 py-1 text-[12px] font-medium disabled:opacity-50 ${quiet}`}
          >
            Prekliči
          </button>
          {saved && (
            <button
              type="button"
              disabled={busy}
              onClick={() => run('', false, 'view')}
              className="rounded-lg border border-[#b0203a]/30 px-3 py-1 text-[12px] font-medium text-[#b0203a] hover:bg-[#b0203a]/10 disabled:opacity-50"
            >
              Odstrani
            </button>
          )}
          <span className={`ml-auto text-[10px] tabular-nums ${label}`}>{draft.trim().length}/{LINE_NOTE_MAX}</span>
        </div>
        {error && <p className="text-[11px] text-[#b0203a]">{error}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      {saved ? (
        <>
          <p className={`text-[13px] whitespace-pre-line ${body}`}>
            <span className={`text-[11px] font-medium uppercase tracking-[0.1em] ${label}`}>Opomba: </span>
            {saved}
          </p>
          <p className={`text-[11px] ${label}`}>Na računu: {onBill ? 'da' : 'ne'}</p>
        </>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => { setDraft(saved); setChosen(null); setError(''); setMode('edit') }}
          className={`rounded-lg border px-3 py-1 text-[12px] font-semibold ${quiet}`}
        >
          {saved ? 'Uredi' : 'Opomba'}
        </button>
        {saved && (
          <button
            type="button"
            disabled={busy}
            onClick={() => run('', false, 'view')}
            className="rounded-lg border border-[#b0203a]/30 px-3 py-1 text-[12px] font-medium text-[#b0203a] hover:bg-[#b0203a]/10 disabled:opacity-50"
          >
            Odstrani
          </button>
        )}
      </div>
      {error && <p className="text-[11px] text-[#b0203a]">{error}</p>}
    </div>
  )
}
