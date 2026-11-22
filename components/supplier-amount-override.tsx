'use client'

import { useState } from 'react'
import { parseSupplierAmountAr } from '@/lib/supplier-override'

// Short correction on one pending carrier line. Shrani stores that booking only.
// Cenik clears it, and the card goes back to the price-list amount.
export function SupplierAmountOverride({
  overrideAr,
  onSave,
}: {
  overrideAr: number | null
  onSave: (amountAr: number | null) => Promise<void>
}) {
  const manual = overrideAr != null
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function save(amount: number | null) {
    setBusy(true)
    setError('')
    try {
      await onSave(amount)
      setOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Shranjevanje ni uspelo.')
    } finally {
      setBusy(false)
    }
  }

  if (open) {
    const parsed = parseSupplierAmountAr(draft)
    return (
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        <input
          inputMode="numeric"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Znesek"
          aria-label="Ročni znesek dobavitelja"
          className="w-24 rounded-lg border border-[#0f2e3a]/15 bg-white/80 px-2 py-1 text-[11px] text-[#0f2e3a] focus:outline-none"
        />
        <span className="text-[10px] text-[#2b2622]/55">Ar</span>
        <button
          type="button"
          disabled={busy || parsed == null}
          onClick={() => { if (parsed != null) void save(parsed) }}
          className="rounded-full border border-[#3f6b7d]/35 bg-[#3f6b7d]/10 px-2.5 py-1 text-[10px] font-semibold text-[#3f6b7d] disabled:opacity-50"
        >
          Shrani
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => { setOpen(false); setError('') }}
          className="rounded-full border border-[#0f2e3a]/15 bg-[#0f2e3a]/5 px-2.5 py-1 text-[10px] font-medium text-[#2b2622]/70"
        >
          Prekliči
        </button>
        {error && <span className="text-[10px] text-[#b0203a]">{error}</span>}
      </div>
    )
  }

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5">
      {manual && <span className="text-[9px] font-semibold uppercase tracking-wide text-[#8f6d3a]">ročno</span>}
      <button
        type="button"
        onClick={() => {
          setDraft(manual ? String(overrideAr) : '')
          setError('')
          setOpen(true)
        }}
        className="rounded-full border border-[#8f6d3a]/35 bg-[#8f6d3a]/10 px-2.5 py-1 text-[10px] font-semibold text-[#8f6d3a]"
      >
        Popravi
      </button>
      {manual && (
        <button
          type="button"
          disabled={busy}
          title="Nazaj na znesek iz cenika"
          onClick={() => void save(null)}
          className="rounded-full border border-[#0f2e3a]/15 bg-[#0f2e3a]/5 px-2.5 py-1 text-[10px] font-medium text-[#2b2622]/70 disabled:opacity-50"
        >
          Cenik
        </button>
      )}
      {error && <span className="text-[10px] text-[#b0203a]">{error}</span>}
    </div>
  )
}
