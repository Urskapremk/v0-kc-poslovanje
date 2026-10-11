'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, X } from 'lucide-react'

export type KuhinjaRacunLine = {
  id: string
  date: string
  name: string
  amountEur: number
  source: string
}

function kindLabel(source: string) {
  if (source === 'gotovina') return 'Gotovina'
  if (source === 'arhiv') return 'Arhiv'
  if (source === 'placa') return 'Plača'
  return source
}

function kindClass(source: string) {
  if (source === 'gotovina' || source === 'placa') return 'border-[#c59b5b]/40 bg-[#c59b5b]/10 text-[#c59b5b]'
  if (source === 'arhiv') return 'border-[#7fa8b8]/40 bg-[#7fa8b8]/10 text-[#7fa8b8]'
  return 'border-white/15 bg-white/5 text-white/60'
}

function formatEur(value: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value || 0)
}

function formatSlDate(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return iso || '—'
  return `${m[3]}. ${m[2]}. ${m[1]}`
}

export default function KuhinjaRacuniRow({
  amount,
  items,
  label = 'Računi nabava Kuhinja',
  listId = 'kuhinja-racuni-seznam',
  amountClassName = 'text-white',
  variant = 'row',
}: {
  amount: number
  items: KuhinjaRacunLine[]
  label?: string
  listId?: string
  amountClassName?: string
  variant?: 'row' | 'total'
}) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const list = (
        open && (
        <div
          id={listId}
          className="mt-2 overflow-hidden rounded-xl border border-white/10 bg-[#0b2731]"
        >
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-3 py-2">
            <p className="text-xs font-medium uppercase tracking-wider text-[#c59b5b]">Všteti stroški</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-xs text-white/50 hover:bg-white/5 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
              Zapri
            </button>
          </div>

          {items.length === 0 ? (
            <p className="px-3 py-4 text-sm text-white/40">Ni vštetih stroškov.</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-start justify-between gap-3 border-b border-white/5 px-3 py-2.5 last:border-b-0"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-xs tabular-nums text-white/40">{formatSlDate(item.date)}</span>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${kindClass(item.source)}`}>
                        {kindLabel(item.source)}
                      </span>
                    </div>
                    <p className="mt-0.5 break-words text-sm text-white/85">{item.name}</p>
                  </div>
                  <span className="shrink-0 text-sm font-medium tabular-nums text-white">{formatEur(item.amountEur)}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-center justify-between gap-3 border-t border-white/10 bg-white/[0.03] px-3 py-2.5">
            <span className="text-xs uppercase tracking-wider text-white/40">Skupaj</span>
            <span className="text-sm font-semibold tabular-nums text-white" data-kuhinja-racuni-total={amount}>
              {formatEur(amount)}
            </span>
          </div>
        </div>
        )
  )

  if (variant === 'total') {
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="cursor-pointer text-left group"
          aria-expanded={open}
          aria-controls={listId}
        >
          <p className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wider text-white/40 sm:mb-2 sm:text-xs">
            {open ? <ChevronDown className="h-3.5 w-3.5 text-[#c59b5b]" /> : <ChevronRight className="h-3.5 w-3.5 text-[#c59b5b]" />}
            {label}
          </p>
          <p className={`text-base font-bold tabular-nums sm:text-2xl ${amountClassName}`}>{formatEur(amount)}</p>
        </button>
        {list}
      </div>
    )
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full cursor-pointer items-center justify-between gap-3 text-left text-sm group"
        aria-expanded={open}
        aria-controls={listId}
      >
        <span className="flex min-w-0 items-center gap-1 text-white/50 group-hover:text-white/90 transition-colors">
          {open
            ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#c59b5b]" />
            : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#c59b5b]" />}
          <span className="underline decoration-white/20 underline-offset-2 group-hover:decoration-[#c59b5b]">{label}</span>
        </span>
        <span className={`shrink-0 tabular-nums ${amountClassName}`}>{formatEur(amount)}</span>
      </button>
      {list}
    </div>
  )
}
