'use client'

import React, { useState } from 'react'
import useSWR from 'swr'
import { Landmark, Wallet, ArrowDownLeft, ArrowUpRight, Users, BookText } from 'lucide-react'
import {
  getBankAccount,
  getBankTransactions,
  getCashExpenses,
  getCashIncome,
  type BankCompany,
} from '@/app/actions/banka'

const COMPANY_LABELS: Record<BankCompany, string> = {
  tourism: 'KOMBA CABANA TOURISM SARL',
  sarl: 'KOMBA CABANA SARL',
}

const MONTHS_SL = ['januar', 'februar', 'marec', 'april', 'maj', 'junij', 'julij', 'avgust', 'september', 'oktober', 'november', 'december']

function monthLabel(ym: string) {
  const [y, m] = ym.split('-')
  return `${MONTHS_SL[parseInt(m, 10) - 1] ?? m} ${y}`
}

function formatDate(d: string) {
  const parts = d.split('-')
  if (parts.length === 3) return `${parts[2]}. ${parts[1]}. ${parts[0]}`
  return d
}

export default function BlagajniskiDnevnik({ year }: { year: number }) {
  const [company, setCompany] = useState<BankCompany>('tourism')

  const { data: account } = useSWR(['bank-account', company], () => getBankAccount(company))
  const { data: txs } = useSWR(['bank-txs', company, year], () => getBankTransactions(company, year))
  const { data: expenseData } = useSWR(['cash-expenses', company, year], () => getCashExpenses(company, year))
  const { data: incomeData } = useSWR(['cash-income', company, year], () => getCashIncome(company, year))

  const cur = account?.currency === 'Ar' ? 'Ar' : '€'
  const fmt = (v: number) =>
    `${new Intl.NumberFormat('sl-SI', { minimumFractionDigits: cur === 'Ar' ? 0 : 2, maximumFractionDigits: cur === 'Ar' ? 0 : 2 }).format(v)} ${cur}`

  const list = expenseData ?? []
  const incomeList = incomeData ?? []
  const withdrawals = (txs ?? [])
    .filter((t) => t.direction === 'out' && t.category === 'dvig')
    .map((t) => ({ date: t.date, amount: Number(t.amount), description: t.description || 'Dvig gotovine' }))

  const total = list.reduce((s, e) => s + Number(e.amount), 0)
  const totalWithdrawn = withdrawals.reduce((s, w) => s + w.amount, 0)
  const totalIncome = incomeList.reduce((s, e) => s + Number(e.amount), 0)
  const tillBalance = totalWithdrawn + totalIncome - total

  // Blagajniški dnevnik: združi dvige (priliv v blagajno), gotovino strank (priliv) in gotovinska plačila (odliv)
  type JournalEntry = { date: string; label: string; kind: 'in' | 'out'; amount: number; seq: number; balance: number }
  const journalRaw: Omit<JournalEntry, 'balance'>[] = [
    ...withdrawals.map((w, i) => ({ date: w.date, label: w.description, kind: 'in' as const, amount: w.amount, seq: i })),
    ...incomeList.map((e, i) => ({ date: e.date, label: e.source || 'Gotovina stranke', kind: 'in' as const, amount: Number(e.amount), seq: 500 + i })),
    ...list.map((e, i) => ({ date: e.date, label: e.purpose || 'Gotovinsko plačilo', kind: 'out' as const, amount: Number(e.amount), seq: 1000 + i })),
  ]
  journalRaw.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1
    if (a.kind !== b.kind) return a.kind === 'in' ? -1 : 1
    return a.seq - b.seq
  })
  let running = 0
  const journal: JournalEntry[] = journalRaw.map((j) => {
    running += j.kind === 'in' ? j.amount : -j.amount
    return { ...j, balance: running }
  })

  const journalMonthMap = new Map<string, JournalEntry[]>()
  for (const j of journal) {
    const ym = j.date.slice(0, 7)
    if (!journalMonthMap.has(ym)) journalMonthMap.set(ym, [])
    journalMonthMap.get(ym)!.push(j)
  }
  const journalMonths = [...journalMonthMap.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1))

  return (
    <div className="space-y-6">
      {/* Izbira podjetja */}
      <div className="flex flex-wrap gap-2">
        {(['tourism', 'sarl'] as BankCompany[]).map((c) => (
          <button
            key={c}
            onClick={() => setCompany(c)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              company === c ? 'bg-[#c59b5b]/20 text-[#c59b5b] border border-[#c59b5b]/30' : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            <Landmark className="h-4 w-4" />
            {COMPANY_LABELS[c]}
          </button>
        ))}
      </div>

      {/* Povzetek blagajne */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#c59b5b]/15 text-[#c59b5b]">
            <BookText className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-white/40">Blagajniški dnevnik</p>
            <h2 className="text-lg font-bold text-white">{COMPANY_LABELS[company]} · {year}</h2>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-lg border border-[#d9a68f]/20 bg-[#d9a68f]/[0.06] p-2.5">
            <div className="mb-0.5 flex items-center gap-1 text-[#d9a68f]"><ArrowDownLeft className="h-3.5 w-3.5" /><span className="text-[10px] uppercase tracking-wider">Dvigi gotovine</span></div>
            <p className="text-sm font-bold tabular-nums text-white">{fmt(totalWithdrawn)}</p>
          </div>
          <div className="rounded-lg border border-[#7fa8b8]/20 bg-[#7fa8b8]/[0.06] p-2.5">
            <div className="mb-0.5 flex items-center gap-1 text-[#7fa8b8]"><Users className="h-3.5 w-3.5" /><span className="text-[10px] uppercase tracking-wider">Gotovina strank</span></div>
            <p className="text-sm font-bold tabular-nums text-white">{fmt(totalIncome)}</p>
          </div>
          <div className="rounded-lg border border-[#8fae92]/20 bg-[#8fae92]/[0.06] p-2.5">
            <div className="mb-0.5 flex items-center gap-1 text-[#8fae92]"><ArrowUpRight className="h-3.5 w-3.5" /><span className="text-[10px] uppercase tracking-wider">Porabljeno</span></div>
            <p className="text-sm font-bold tabular-nums text-white">{fmt(total)}</p>
          </div>
          <div className="rounded-lg border border-[#c59b5b]/30 bg-[#c59b5b]/10 p-2.5">
            <div className="mb-0.5 flex items-center gap-1 text-[#c59b5b]"><Wallet className="h-3.5 w-3.5" /><span className="text-[10px] uppercase tracking-wider">Saldo v blagajni</span></div>
            <p className={`text-sm font-bold tabular-nums ${tillBalance < 0 ? 'text-[#c98f7d]' : 'text-[#c59b5b]'}`}>{fmt(tillBalance)}</p>
          </div>
        </div>
      </div>

      {/* Dnevnik po mesecih */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        {journal.length === 0 ? (
          <p className="py-10 text-center text-sm text-white/30">Ni prometa v blagajni za {year}.</p>
        ) : (
          <div className="space-y-3">
            {journalMonths.map(([ym, entries]) => {
              const endBal = entries[entries.length - 1]?.balance ?? 0
              return (
                <div key={ym} className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
                  <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3">
                    <span className="text-sm font-semibold capitalize text-white">{monthLabel(ym)}</span>
                    <span className="ml-auto flex items-center gap-1.5 rounded-lg bg-[#c59b5b]/10 px-2.5 py-1 text-xs">
                      <Wallet className="h-3.5 w-3.5 text-[#c59b5b]" />
                      <span className="text-[10px] uppercase tracking-wider text-[#c59b5b]/60">Saldo ob koncu</span>
                      <span className={`font-bold tabular-nums ${endBal < 0 ? 'text-[#c98f7d]' : 'text-[#c59b5b]'}`}>{fmt(endBal)}</span>
                    </span>
                  </div>
                  <div className="hidden items-center gap-3 px-4 py-2 text-[10px] uppercase tracking-wider text-white/30 sm:flex">
                    <span className="w-20 shrink-0">Datum</span>
                    <span className="flex-1">Opis</span>
                    <span className="w-28 shrink-0 text-right text-[#d9a68f]">Priliv</span>
                    <span className="w-28 shrink-0 text-right text-[#8fae92]">Odliv</span>
                    <span className="w-28 shrink-0 text-right text-[#c59b5b]">Saldo</span>
                  </div>
                  <div className="divide-y divide-white/[0.04] px-4 pb-2">
                    {entries.map((j, i) => (
                      <div key={i} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 py-2">
                        <span className="w-20 shrink-0 text-xs text-white/50">{formatDate(j.date)}</span>
                        <span className="flex min-w-0 flex-[1_1_100%] items-center gap-1.5 sm:flex-1">
                          {j.kind === 'in'
                            ? <ArrowDownLeft className="h-3.5 w-3.5 shrink-0 text-[#d9a68f]" />
                            : <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-[#8fae92]" />}
                          <span className="truncate text-sm text-white/80">{j.label}</span>
                        </span>
                        <span className="w-28 shrink-0 text-right text-sm tabular-nums text-[#d9a68f]">{j.kind === 'in' ? fmt(j.amount) : ''}</span>
                        <span className="w-28 shrink-0 text-right text-sm tabular-nums text-[#8fae92]">{j.kind === 'out' ? fmt(j.amount) : ''}</span>
                        <span className={`w-28 shrink-0 text-right text-sm font-semibold tabular-nums ${j.balance < 0 ? 'text-[#c98f7d]' : 'text-[#c59b5b]'}`}>{fmt(j.balance)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
