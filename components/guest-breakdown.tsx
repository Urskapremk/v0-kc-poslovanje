'use client'

import React, { useState } from 'react'
import { ChevronDown, ChevronRight, TrendingUp, TrendingDown, Users } from 'lucide-react'
import { bungalowDisplayName } from '@/lib/bungalow'

type GuestRow = {
  reservationId: string
  guestName: string
  bungalow: string
  arrival: string | null
  departure: string | null
  nightsInMonth: number
  revenue: {
    accommodation: number
    bar: number
    mealPlan: number
    wellness: number
    ostalo: number
    excursions: number
    transfers: number
    total: number
  }
  costs: {
    direct: number
    salaries: number
    marketing: number
    starlink: number
    commissions: number
    total: number
  }
  profit: number
}

function formatEur(amount: number): string {
  return new Intl.NumberFormat('sl-SI', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

function formatDate(d: string | null): string {
  if (!d) return '-'
  const date = new Date(d)
  return date.toLocaleDateString('sl-SI', { day: '2-digit', month: '2-digit' })
}

export default function GuestBreakdown({ guests }: { guests: GuestRow[] }) {
  const [expanded, setExpanded] = useState<string | null>(null)

  if (!guests || guests.length === 0) {
    return (
      <div className="p-4 sm:p-6 rounded-2xl bg-white/[0.03] border border-white/10">
        <div className="flex items-center gap-2 mb-2">
          <Users className="h-5 w-5 text-[#7fa8b8]" />
          <h2 className="text-base sm:text-lg font-bold text-white">Rezultat po gostih</h2>
        </div>
        <p className="text-white/40 text-sm">V tem mesecu ni gostov za prikaz.</p>
      </div>
    )
  }

  const totalRevenue = guests.reduce((s, g) => s + g.revenue.total, 0)
  const totalProfit = guests.reduce((s, g) => s + g.profit, 0)

  return (
    <div className="p-4 sm:p-6 rounded-2xl bg-white/[0.03] border border-white/10">
      <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-[#7fa8b8]" />
          <h2 className="text-base sm:text-lg font-bold text-white">Rezultat po gostih</h2>
        </div>
        <div className="flex gap-4 text-xs sm:text-sm">
          <span className="text-white/40">Prihodek: <span className="text-[#7fa8b8] font-medium">{formatEur(totalRevenue)}</span></span>
          <span className="text-white/40">Dobiček: <span className={`font-medium ${totalProfit >= 0 ? 'text-[#8fae92]' : 'text-[#c8846b]'}`}>{formatEur(totalProfit)}</span></span>
        </div>
      </div>

      <p className="text-white/40 text-xs mb-4">
        Plače, marketing in Starlink so razdeljeni sorazmerno (plače po prihodku, marketing in Starlink po prihodku nočitev). Nočitve štejejo po dejanskih nočeh v mesecu.
      </p>

      <div className="space-y-2">
        {guests.map((g) => {
          const isOpen = expanded === g.reservationId
          const profitPositive = g.profit >= 0
          const margin = g.revenue.total > 0 ? (g.profit / g.revenue.total) * 100 : 0
          return (
            <div key={g.reservationId} className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
              <button
                onClick={() => setExpanded(isOpen ? null : g.reservationId)}
                className="w-full flex items-center gap-3 p-3 sm:p-4 text-left transition-colors hover:bg-white/[0.03]"
              >
                {isOpen ? <ChevronDown className="h-4 w-4 text-white/40 shrink-0" /> : <ChevronRight className="h-4 w-4 text-white/40 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white font-medium truncate">{g.guestName}</span>
                    {g.bungalow && <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 text-white/50">{bungalowDisplayName(g.bungalow)}</span>}
                  </div>
                  <div className="text-[11px] text-white/40 mt-0.5">
                    {formatDate(g.arrival)} - {formatDate(g.departure)} · {g.nightsInMonth} {g.nightsInMonth === 1 ? 'noč' : 'noči'} v mesecu
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[11px] text-white/40">{formatEur(g.revenue.total)}</div>
                  <div className={`flex items-center gap-1 justify-end font-bold text-sm ${profitPositive ? 'text-[#8fae92]' : 'text-[#c8846b]'}`}>
                    {profitPositive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                    {formatEur(g.profit)}
                  </div>
                </div>
              </button>

              {isOpen && (
                <div className="px-3 sm:px-4 pb-4 pt-1 border-t border-white/[0.06]">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
                    {/* Prihodki */}
                    <div>
                      <h4 className="text-[11px] font-medium uppercase tracking-wider text-[#7fa8b8] mb-2">Prihodki</h4>
                      <div className="space-y-1 text-xs">
                        <Row label="Nočitve" value={g.revenue.accommodation} />
                        <Row label="Bar (pijača + hrana)" value={g.revenue.bar} />
                        {g.revenue.mealPlan > 0 && <Row label="Polpenzion / penzion" value={g.revenue.mealPlan} />}
                        {g.revenue.wellness > 0 && <Row label="Wellness" value={g.revenue.wellness} />}
                        {g.revenue.excursions > 0 && <Row label="Izleti" value={g.revenue.excursions} />}
                        {g.revenue.transfers > 0 && <Row label="Transferji" value={g.revenue.transfers} />}
                        {g.revenue.ostalo > 0 && <Row label="Ostalo" value={g.revenue.ostalo} />}
                        <div className="flex justify-between pt-1 mt-1 border-t border-white/[0.06]">
                          <span className="text-white/60 font-medium">Skupaj</span>
                          <span className="text-[#7fa8b8] font-bold">{formatEur(g.revenue.total)}</span>
                        </div>
                      </div>
                    </div>
                    {/* Stroški */}
                    <div>
                      <h4 className="text-[11px] font-medium uppercase tracking-wider text-[#c8846b] mb-2">Stroški</h4>
                      <div className="space-y-1 text-xs">
                        <Row label="Neposredni (nabava, dobavitelji)" value={g.costs.direct} />
                        <Row label="Plače (sorazmerno)" value={g.costs.salaries} />
                        <Row label="Marketing (sorazmerno)" value={g.costs.marketing} />
                        {g.costs.commissions > 0 && <Row label="Provizija platform (sorazmerno)" value={g.costs.commissions} />}
                        <Row label="Starlink (sorazmerno)" value={g.costs.starlink} />
                        <div className="flex justify-between pt-1 mt-1 border-t border-white/[0.06]">
                          <span className="text-white/60 font-medium">Skupaj</span>
                          <span className="text-[#c8846b] font-bold">{formatEur(g.costs.total)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/10">
                    <span className="text-white/60 text-sm font-medium">Dobiček ({margin.toFixed(0)}% marža)</span>
                    <span className={`text-base font-bold ${profitPositive ? 'text-[#8fae92]' : 'text-[#c8846b]'}`}>{formatEur(g.profit)}</span>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Row({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className={muted ? 'text-white/30' : 'text-white/50'}>{label}</span>
      <span className={muted ? 'text-white/40' : 'text-white'}>{formatEur(value)}</span>
    </div>
  )
}
