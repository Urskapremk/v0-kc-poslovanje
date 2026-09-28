'use client'

import React, { useState } from 'react'
import useSWR from 'swr'
import { Ship, Truck, Compass } from 'lucide-react'
import { getCarrierStatistics, getCarrierStatisticsYearly } from '@/app/actions/statistics'

const MONTH_NAMES = ['januar', 'februar', 'marec', 'april', 'maj', 'junij', 'julij', 'avgust', 'september', 'oktober', 'november', 'december']

function formatEur(n: number) {
  return new Intl.NumberFormat('sl-SI', { style: 'currency', currency: 'EUR' }).format(n || 0)
}

function formatAr(n: number) {
  return new Intl.NumberFormat('sl-SI').format(Math.round(n || 0)) + ' Ar'
}

export default function PrevozinkiTab({ year, month }: { year: number; month: number }) {
  const [scope, setScope] = useState<'month' | 'year'>('month')
  const { data, isLoading } = useSWR(
    ['carrier-stats', year, month, scope],
    () => scope === 'year' ? getCarrierStatisticsYearly(year) : getCarrierStatistics(year, month)
  )

  const carriers = data?.carriers || []
  const totals = data?.totals

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-[#8fae92]">Prevozniki</h2>
          <p className="text-white/50 text-sm mt-1">
            Koliko prometa smo dali posameznemu prevozniku (čolnarju), število prevozov in koliko smo mu plačali.
          </p>
        </div>
        {/* Scope toggle: izbran mesec / celo leto */}
        <div className="flex gap-1 rounded-xl bg-white/5 p-1">
          <button
            onClick={() => setScope('month')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              scope === 'month' ? 'bg-[#8fae92]/20 text-[#8fae92]' : 'text-white/50 hover:text-white/80'
            }`}
          >
            {MONTH_NAMES[month - 1]} {year}
          </button>
          <button
            onClick={() => setScope('year')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              scope === 'year' ? 'bg-[#8fae92]/20 text-[#8fae92]' : 'text-white/50 hover:text-white/80'
            }`}
          >
            Celo leto {year}
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10">
          <div className="flex items-center gap-2 text-white/50 text-xs uppercase tracking-wider">
            <Ship className="h-4 w-4" /> Skupaj prevozov
          </div>
          <p className="text-2xl font-bold text-white mt-2">{totals?.totalTrips ?? 0}</p>
          <p className="text-white/40 text-xs mt-1">
            {totals?.transferTrips ?? 0} transferjev · {totals?.excursionTrips ?? 0} izletov
          </p>
        </div>
        <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10">
          <div className="flex items-center gap-2 text-white/50 text-xs uppercase tracking-wider">
            <Truck className="h-4 w-4" /> Število prevoznikov
          </div>
          <p className="text-2xl font-bold text-white mt-2">{carriers.length}</p>
        </div>
        <div className="p-5 rounded-2xl bg-[#8fae92]/10 border border-[#8fae92]/30">
          <div className="flex items-center gap-2 text-[#8fae92]/80 text-xs uppercase tracking-wider">
            <Compass className="h-4 w-4" /> Skupaj plačano
          </div>
          <p className="text-2xl font-bold text-[#8fae92] mt-2">{formatEur(totals?.totalPaid ?? 0)}</p>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-white/[0.03] border border-white/10 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-white/40 text-sm">Nalaganje…</div>
        ) : carriers.length === 0 ? (
          <div className="p-8 text-center text-white/40 text-sm">
            {scope === 'year' ? 'V tem letu ni zabeleženih prevozov.' : 'V tem mesecu ni zabeleženih prevozov.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-white/40 text-xs uppercase tracking-wider border-b border-white/10">
                  <th className="text-left font-medium px-4 py-3">Prevoznik</th>
                  <th className="text-right font-medium px-4 py-3">Transferji</th>
                  <th className="text-right font-medium px-4 py-3">Izleti</th>
                  <th className="text-right font-medium px-4 py-3">Skupaj prevozov</th>
                  <th className="text-right font-medium px-4 py-3">Plačano (Ar)</th>
                  <th className="text-right font-medium px-4 py-3">Plačano (EUR)</th>
                </tr>
              </thead>
              <tbody>
                {carriers.map((c) => (
                  <tr key={c.boatId} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-medium text-white">{c.name}</td>
                    <td className="px-4 py-3 text-right text-white/70">{c.transferTrips}</td>
                    <td className="px-4 py-3 text-right text-white/70">{c.excursionTrips}</td>
                    <td className="px-4 py-3 text-right text-white/90 font-medium">{c.totalTrips}</td>
                    <td className="px-4 py-3 text-right text-white/50">{formatAr(c.totalPaidAr)}</td>
                    <td className="px-4 py-3 text-right text-[#8fae92] font-medium">{formatEur(c.totalPaid)}</td>
                  </tr>
                ))}
              </tbody>
              {totals && (
                <tfoot>
                  <tr className="border-t border-white/10 font-bold text-white">
                    <td className="px-4 py-3">SKUPAJ</td>
                    <td className="px-4 py-3 text-right">{totals.transferTrips}</td>
                    <td className="px-4 py-3 text-right">{totals.excursionTrips}</td>
                    <td className="px-4 py-3 text-right">{totals.totalTrips}</td>
                    <td className="px-4 py-3 text-right" />
                    <td className="px-4 py-3 text-right text-[#8fae92]">{formatEur(totals.totalPaid)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
