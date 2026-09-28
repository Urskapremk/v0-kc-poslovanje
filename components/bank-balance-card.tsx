'use client'

import useSWR from 'swr'
import { Landmark } from 'lucide-react'
import { getBankAccount, getBankTransactions } from '@/app/actions/banka'

/**
 * Read-only bank balance for Borut: just the current balance on the account,
 * no individual transactions. Balance = opening balance + all inflows − all
 * outflows dated up to today (future-dated entries do not count toward "today").
 */
export default function BankBalanceCard({ company = 'tourism' }: { company?: string }) {
  const { data: account } = useSWR(['bank-account', company], () => getBankAccount(company))
  const { data: txs } = useSWR(['bank-txs-all', company], () => getBankTransactions(company))

  const today = new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10)
  const cur = account?.currency === 'Ar' ? 'Ar' : '€'
  const fmt = (v: number) =>
    `${new Intl.NumberFormat('sl-SI', {
      minimumFractionDigits: cur === 'Ar' ? 0 : 2,
      maximumFractionDigits: cur === 'Ar' ? 0 : 2,
    }).format(v)} ${cur}`

  const loading = !account || !txs
  const upToToday = (txs ?? []).filter((t) => String(t.date).slice(0, 10) <= today)
  const totalIn = upToToday.filter((t) => t.direction === 'in').reduce((s, t) => s + Number(t.amount), 0)
  const totalOut = upToToday.filter((t) => t.direction === 'out').reduce((s, t) => s + Number(t.amount), 0)
  const opening = Number(account?.openingBalance ?? 0)
  const balance = opening + totalIn - totalOut

  const todayLabel = new Date(`${today}T00:00:00`).toLocaleDateString('sl-SI', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const accountName = company === 'sarl' ? 'Komba Cabana Sarl' : 'Komba Cabana Tourism Sarl'
  const accountNameColor = company === 'sarl' ? 'text-[#7bb585]' : 'text-[#6aa9d6]'

  return (
    <section className="mx-auto max-w-md">
      <div className="rounded-2xl border border-[#c59b5b]/25 bg-[#0f2e3a]/60 p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[#c59b5b]/30 bg-[#c59b5b]/10">
          <Landmark className="h-5 w-5 text-[#c59b5b]" />
        </div>
        <p className="mt-4 flex items-center justify-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#e8c88a]">
          <span aria-hidden className="h-px w-4 bg-[#c59b5b]/60" />
          Stanje na bančnem računu
          <span aria-hidden className="h-px w-4 bg-[#c59b5b]/60" />
        </p>
        <p className="mt-1 text-sm tracking-wide text-white/50">
          <span className={`font-semibold ${accountNameColor}`}>{accountName}</span> · BMOI
        </p>

        {loading ? (
          <p className="mt-6 text-2xl font-light text-white/40">…</p>
        ) : (
          <p className="mt-6 text-4xl font-bold tabular-nums text-[#c59b5b]">{fmt(balance)}</p>
        )}

        <p className="mt-4 text-xs text-white/45">
          na današnji dan · <span className="text-white/70">{todayLabel}</span>
        </p>
      </div>
    </section>
  )
}
