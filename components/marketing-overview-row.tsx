'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { getMarketingExpenses } from '@/app/actions/statistics'

function formatEur(value: number) {
  return new Intl.NumberFormat('sl-SI', { style: 'currency', currency: 'EUR' }).format(value || 0)
}

function formatDate(d: string | null) {
  if (!d) return '-'
  return new Intl.DateTimeFormat('sl-SI', { day: '2-digit', month: '2-digit' }).format(new Date(d))
}

export default function MarketingOverviewRow({
  year,
  month,
  amount,
  category = 'marketing',
  label = 'Marketing',
}: {
  year: number
  month: number
  amount: number
  category?: string
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const { data: expenses, isLoading } = useSWR(
    open ? ['expense-overview', category, year, month] : null,
    () => getMarketingExpenses(year, month, category)
  )

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-sm group"
        aria-expanded={open}
      >
        <span className="flex items-center gap-1 text-white/50 group-hover:text-white/80 transition-colors">
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          {label}
        </span>
        <span className="text-white">{formatEur(amount)}</span>
      </button>

      {open && (
        <div className="mt-2 ml-4 space-y-1 border-l border-white/10 pl-3">
          {isLoading ? (
            <p className="text-xs text-white/30 py-1">Nalaganje...</p>
          ) : !expenses || expenses.length === 0 ? (
            <p className="text-xs text-white/30 py-1">Za ta mesec ni vnosov.</p>
          ) : (
            expenses.map((e) => (
              <div key={e.id} className="flex items-center justify-between text-xs">
                <span className="text-white/45">
                  <span className="text-white/30 mr-2">{formatDate(e.date)}</span>
                  {e.description}
                </span>
                <span className="text-white/70">{formatEur(Number(e.amount))}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
