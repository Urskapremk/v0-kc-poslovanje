'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getSarlBankInvoices, type SarlBankInvoiceRow } from '@/app/actions/sarl-bank-invoices'

function formatEur(value: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value)
}

function formatDay(iso: string) {
  const [year, month, day] = iso.split('-').map(Number)
  if (!year || !month || !day) return iso
  return new Intl.DateTimeFormat('sl-SI', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  }).format(new Date(Date.UTC(year, month - 1, day)))
}

export default function RacuniBancniRacunTab({
  year,
  years,
  onYear,
}: {
  year: number
  years: number[]
  onYear: (year: number) => void
}) {
  const [rows, setRows] = useState<SarlBankInvoiceRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setRows(null)
    setError(null)
    getSarlBankInvoices(year)
      .then((list) => {
        if (!cancelled) setRows(list)
      })
      .catch(() => {
        if (!cancelled) setError('Računov ni bilo mogoče naložiti.')
      })
    return () => {
      cancelled = true
    }
  }, [year, attempt])

  const invoiceCount = rows ? new Set(rows.map((row) => row.reservationId)).size : 0
  const totalEur = rows ? Math.round(rows.reduce((sum, row) => sum + row.amountEur, 0) * 100) / 100 : 0

  return (
    <div className="space-y-4" data-testid="racuni-bancni-racun">
      <div className="p-4 sm:p-6 rounded-2xl bg-white/[0.03] border border-white/10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-[#c59b5b]">Izdani računi na bančnem računu SARL</h2>
            <p className="text-white/40 text-sm mt-1">
              Samo nakazila na KOMBA CABANA SARL, 00026 03074120101 87, BMOI. Vsako plačilo je preverjeno z vknjiženo vrstico izpiska.
            </p>
          </div>
          <div className="flex gap-2" role="group" aria-label="Leto">
            {years.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => onYear(item)}
                className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                  item === year
                    ? 'bg-[#c59b5b]/20 text-[#c59b5b] border border-[#c59b5b]/30'
                    : 'bg-white/5 text-white/60 hover:bg-white/10'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-[#c8846b]">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setAttempt((value) => value + 1)}
              className="px-3 py-1.5 rounded-lg bg-white/5 text-white/80 hover:bg-white/10"
            >
              Poskusi znova
            </button>
          </div>
        )}

        {rows && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
            <div className="p-3 sm:p-4 rounded-2xl bg-white/[0.03] border border-white/10">
              <p className="text-white/40 text-xs uppercase tracking-wider mb-1">Računi</p>
              <p className="text-xl sm:text-2xl font-bold text-white" data-testid="racuni-bancni-stevilo">{invoiceCount}</p>
            </div>
            <div className="p-3 sm:p-4 rounded-2xl bg-white/[0.03] border border-white/10">
              <p className="text-white/40 text-xs uppercase tracking-wider mb-1">Nakazila</p>
              <p className="text-xl sm:text-2xl font-bold text-white" data-testid="racuni-bancni-vrstice">{rows.length}</p>
            </div>
            <div className="p-3 sm:p-4 rounded-2xl bg-white/[0.03] border border-white/10">
              <p className="text-white/40 text-xs uppercase tracking-wider mb-1">Skupaj na SARL</p>
              <p className="text-xl sm:text-2xl font-bold text-[#7fa8b8]" data-testid="racuni-bancni-skupaj" data-value={totalEur}>{formatEur(totalEur)}</p>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl bg-white/[0.03] border border-white/10 overflow-hidden">
        {!error && !rows && <p className="px-4 py-6 sm:px-5 text-sm text-white/50">Nalagam račune…</p>}
        {rows && rows.length === 0 && (
          <p className="px-4 py-6 sm:px-5 text-sm text-white/50" data-testid="racuni-bancni-prazno">
            V tem letu ni izdanih računov, plačanih z nakazilom na bančni račun SARL.
          </p>
        )}
        {rows && rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-white/40">
                  <th className="px-4 py-3 font-medium sm:px-5">Številka</th>
                  <th className="px-3 py-3 font-medium">Datum</th>
                  <th className="px-3 py-3 font-medium">Gost</th>
                  <th className="px-3 py-3 font-medium text-right">Znesek</th>
                  <th className="px-3 py-3 font-medium">Datum plačila</th>
                  <th className="px-3 py-3 font-medium">RPT</th>
                  <th className="px-4 py-3 font-medium text-right sm:px-5">Račun</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.paymentId} className="border-t border-white/5" data-testid={`racuni-bancni-${row.paymentId}`}>
                    <td className="px-4 py-2.5 sm:px-5 text-white/75 whitespace-nowrap">{row.invoiceNumber}</td>
                    <td className="px-3 py-2.5 text-white/75 whitespace-nowrap">{formatDay(row.invoiceDate)}</td>
                    <td className="px-3 py-2.5 text-white">{row.guestName}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-[#7fa8b8] whitespace-nowrap" data-value={row.amountEur}>{formatEur(row.amountEur)}</td>
                    <td className="px-3 py-2.5 text-white/75 whitespace-nowrap">{formatDay(row.paymentDate)}</td>
                    <td className="px-3 py-2.5 text-white/75 whitespace-nowrap">{row.bankReference || ''}</td>
                    <td className="px-4 py-2.5 sm:px-5 text-right whitespace-nowrap">
                      <Link href={`/racun/${row.reservationId}?view=true`} className="text-[#c59b5b] hover:underline">
                        Odpri račun
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
