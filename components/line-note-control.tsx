'use client'

import { useId, useState } from 'react'
import { LINE_NOTE_MAX, lineNoteButtonLabel } from '@/lib/line-note'

type Tone = 'light' | 'dark'
type Mode = 'view' | 'edit' | 'ask'

/**
 * Short note on one payment line. Shrani stores it and shows it on the line,
 * then asks whether it prints on the guest invoice. Popravi loads that text
 * again, saves the change, and asks about the invoice once more.
 */
export function LineNoteControl({
  note,
  onInvoice,
  asking,
  tone,
  draftSeed,
  editOnOpen,
  initialError,
  onDraft,
  onEditStart,
  onLeaveEdit,
  onFail,
  onSave,
}: {
  note?: string | null
  onInvoice?: boolean | null
  asking?: boolean
  tone: Tone
  draftSeed?: string
  editOnOpen?: boolean
  initialError?: string
  onDraft: (value: string) => void
  onEditStart: () => void
  onLeaveEdit: () => void
  onFail: (text: string, message: string) => void
  onSave: (note: string, onInvoice: boolean, asking: boolean) => Promise<void>
}) {
  const savedNote = (note || '').trim()
  const [localSaved, setLocalSaved] = useState<string | null>(null)
  const saved = localSaved !== null ? localSaved : savedNote
  const fieldId = useId()
  const [mode, setMode] = useState<Mode>(() => (editOnOpen ? 'edit' : asking ? 'ask' : 'view'))
  const [draft, setDraft] = useState(() => (draftSeed ?? savedNote))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(initialError || '')
  const [chosen, setChosen] = useState<boolean | null>(null)
  const onBill = (chosen ?? (onInvoice === true)) && saved.length > 0

  const light = tone === 'light'
  const label = light ? 'text-[#2b2622]/55' : 'text-white/70'
  const quiet = light
    ? 'border-[#0f2e3a]/20 text-[#2b2622]/70 hover:bg-[#0f2e3a]/5'
    : 'border-white/20 text-white/80 hover:bg-white/10'
  const yes = 'border-[#3f6b7d]/40 bg-[#efe8da] text-[#0f2e3a] hover:bg-white'
  const no = light
    ? 'border-[#0f2e3a]/25 text-[#0f2e3a] hover:bg-[#0f2e3a]/5'
    : 'border-white/25 text-white hover:bg-white/10'

  function remember(text: string) {
    setDraft(text)
    onDraft(text)
  }

  async function run(next: string, printOnInvoice: boolean, after: 'view' | 'ask') {
    const trimmed = next.trim()
    if (!trimmed && after === 'ask') {
      setError('Vpišite opombo.')
      return
    }
    setBusy(true)
    setError('')
    setLocalSaved(trimmed)
    setChosen(trimmed ? printOnInvoice : null)
    setMode(after)
    remember(trimmed)
    onLeaveEdit()
    try {
      await onSave(trimmed, trimmed ? printOnInvoice : false, after === 'ask' && trimmed.length > 0)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Shranjevanje ni uspelo.'
      onFail(trimmed || next, message)
      setLocalSaved(null)
      setMode('edit')
      remember(trimmed || next)
      setError(message)
    } finally {
      setBusy(false)
    }
  }

  function openEdit() {
    const text = saved
    onEditStart()
    remember(text)
    setError('')
    setMode('edit')
  }

  const chip = (text: string) => (
    text ? (
      <p
        className="whitespace-pre-line rounded-lg px-2.5 py-1.5 text-[13px] text-[#0f2e3a]"
        style={{ backgroundColor: '#efe8da', color: '#0f2e3a' }}
      >
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#2b2622]/55">Opomba: </span>
        {text}
      </p>
    ) : null
  )

  const errorLine = error ? (
    <p className="rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-[#b0203a]" style={{ backgroundColor: '#fffdf8' }}>
      {error}
    </p>
  ) : null

  if (mode === 'ask') {
    const text = saved || draft.trim()
    return (
      <div className="space-y-2">
        {chip(text)}
        <p className="text-[12px] font-medium" style={{ color: light ? '#0f2e3a' : '#f8f5ef' }}>
          Naj se ta opomba izpiše na računu?
        </p>
        <p className={`text-[11px] ${label}`}>Da — izpiše se pod to postavko. Ne — ostane samo v aplikaciji.</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => run(text, true, 'view')}
            className={`rounded-lg border px-3 py-1.5 text-[12px] font-semibold disabled:opacity-50 ${yes}`}
          >
            {busy ? 'Shranjujem...' : 'Da'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => run(text, false, 'view')}
            className={`rounded-lg border px-3 py-1.5 text-[12px] font-semibold disabled:opacity-50 ${no}`}
          >
            Ne
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={openEdit}
            className={`rounded-lg border px-3 py-1.5 text-[12px] font-semibold disabled:opacity-50 ${yes}`}
          >
            Popravi
          </button>
        </div>
        {errorLine}
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
          onChange={(e) => {
            setError('')
            remember(e.target.value)
            onEditStart()
          }}
          placeholder="Kratka opomba"
          style={{ color: '#0f2e3a', backgroundColor: '#fffdf8', caretColor: '#0f2e3a', colorScheme: 'light' }}
          className="w-full resize-y rounded-lg border border-[#0f2e3a]/20 px-2.5 py-1.5 text-[13px] text-[#0f2e3a] placeholder:text-[#2b2622]/45 focus:outline-none"
        />
        {chip(draft.trim())}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => run(draft, false, 'ask')}
            className={`rounded-lg border px-3 py-1 text-[12px] font-semibold disabled:opacity-50 ${yes}`}
          >
            {busy ? 'Shranjujem...' : 'Shrani'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => { onLeaveEdit(); setError(''); setMode('view') }}
            className={`rounded-lg border px-3 py-1 text-[12px] font-medium disabled:opacity-50 ${quiet}`}
          >
            Prekliči
          </button>
          {saved && (
            <button
              type="button"
              disabled={busy}
              onClick={() => run('', false, 'view')}
              className="rounded-lg border border-[#b0203a]/30 bg-[#fffdf8] px-3 py-1 text-[12px] font-medium text-[#b0203a] hover:bg-[#b0203a]/10 disabled:opacity-50"
            >
              Odstrani
            </button>
          )}
          <span className={`ml-auto text-[10px] tabular-nums ${label}`}>{draft.trim().length}/{LINE_NOTE_MAX}</span>
        </div>
        {errorLine}
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      {saved ? chip(saved) : null}
      {saved ? <p className={`text-[11px] ${label}`}>Na računu: {onBill ? 'da' : 'ne'}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={openEdit}
          className={`rounded-lg border px-3 py-1 text-[12px] font-semibold ${saved ? yes : quiet}`}
        >
          {lineNoteButtonLabel(saved)}
        </button>
        {saved && (
          <button
            type="button"
            disabled={busy}
            onClick={() => run('', false, 'view')}
            className="rounded-lg border border-[#b0203a]/30 bg-[#fffdf8] px-3 py-1 text-[12px] font-medium text-[#b0203a] hover:bg-[#b0203a]/10 disabled:opacity-50"
          >
            Odstrani
          </button>
        )}
      </div>
      {errorLine}
    </div>
  )
}
