'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { getIssuedGuestInvoices, type IssuedGuestInvoice } from '@/app/actions/guest-invoices'
import { getMonthlyFinanceSummary } from '@/app/actions/statistics'
import {
  COST_TYPES,
  INCOME_TYPES,
  sumCostTypes,
  sumFinanceMonths,
  type MonthFinanceSummary,
} from '@/lib/letni-pregled'

const MONTHS = [
  'Januar', 'Februar', 'Marec', 'April', 'Maj', 'Junij',
  'Julij', 'Avgust', 'September', 'Oktober', 'November', 'December',
]

function formatEur(value: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value)
}

function profitClass(value: number) {
  return value >= 0 ? 'text-[#8fae92]' : 'text-[#c8846b]'
}

function formatIssuedDate(iso: string) {
  return new Intl.DateTimeFormat('sl-SI', {
    timeZone: 'Indian/Antananarivo',
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  }).format(new Date(iso))
}

function MonthName({
  month,
  selected,
  onSelect,
}: {
  month: number
  selected: boolean
  onSelect: (month: number) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(month)}
      aria-pressed={selected}
      data-testid={`letni-mesec-gumb-${month}`}
      className={`text-left font-medium whitespace-nowrap underline-offset-2 hover:text-[#c59b5b] ${selected ? 'text-[#c59b5b] underline' : 'text-white'}`}
    >
      {MONTHS[month - 1]}
    </button>
  )
}

export default function LetniPregledTab({
  year,
  years,
  onYear,
  pinnedMonth,
  pinned,
}: {
  year: number
  years: number[]
  onYear: (year: number) => void
  pinnedMonth: number
  pinned: MonthFinanceSummary
}) {
  const [rows, setRows] = useState<MonthFinanceSummary[] | null>(null)
  const [loaded, setLoaded] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [invoiceMonth, setInvoiceMonth] = useState<number | null>(null)
  const [invoices, setInvoices] = useState<IssuedGuestInvoice[] | null>(null)
  const [invoiceError, setInvoiceError] = useState<string | null>(null)
  const invoiceListRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    setRows(null)
    setLoaded(0)
    setError(null)

    const run = async () => {
      // One month at a time. The monthly calculation reads many queries, and
      // overlapping calls have returned another month's costs.
      const next: MonthFinanceSummary[] = []
      for (let month = 1; month <= 12; month++) {
        const row = await getMonthlyFinanceSummary(year, month)
        if (cancelled) return
        next.push(row)
        setLoaded(next.length)
      }
      if (!cancelled) setRows(next)
    }

    run().catch((err: unknown) => {
      if (cancelled) return
      setError(err instanceof Error ? err.message : 'Letnega pregleda ni bilo mogoče naložiti.')
    })

    return () => {
      cancelled = true
    }
  }, [year, attempt])

  useEffect(() => {
    if (invoiceMonth == null) return
    let cancelled = false
    setInvoices(null)
    setInvoiceError(null)
    getIssuedGuestInvoices(year, invoiceMonth)
      .then((list) => {
        if (!cancelled) setInvoices(list)
      })
      .catch(() => {
        if (!cancelled) setInvoiceError('Računov ni bilo mogoče naložiti.')
      })
    return () => {
      cancelled = true
    }
  }, [year, invoiceMonth])

  useEffect(() => {
    if (invoiceMonth != null) invoiceListRef.current?.scrollIntoView({ block: 'start' })
  }, [invoiceMonth, invoices])

  const shown = rows
    ?.slice()
    .sort((a, b) => a.month - b.month)
    .map((row) => (row.month === pinnedMonth ? { ...pinned, month: pinnedMonth } : row))
  const totals = shown && shown.length === 12 ? sumFinanceMonths(shown) : null
  const incomeColumns = totals
    ? INCOME_TYPES.filter((type) => totals.prihodkiPoVrsti[type.key] !== 0)
    : []
  const costColumns = totals
    ? COST_TYPES.filter((type) => type.parallel || totals.stroskiPoVrsti[type.key] !== 0)
    : []

  return (
    <div className="space-y-4" data-testid="letni-pregled">
      <div className="p-4 sm:p-6 rounded-2xl bg-white/[0.03] border border-white/10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-[#c59b5b]">Letni pregled prihodkov in stroškov</h2>
            <p className="text-white/40 text-sm mt-1">Iste številke kot na mesečnem pregledu.</p>
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
            <span>Letnega pregleda ni bilo mogoče naložiti.</span>
            <button
              type="button"
              onClick={() => setAttempt((value) => value + 1)}
              className="px-3 py-1.5 rounded-lg bg-white/5 text-white/80 hover:bg-white/10"
            >
              Poskusi znova
            </button>
          </div>
        )}

        {!totals && !error && (
          <p className="mt-4 text-sm text-white/50">Nalagam kalkulacije po mesecih ({loaded}/12)…</p>
        )}

        {totals && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
            <div className="p-3 sm:p-4 rounded-2xl bg-white/[0.03] border border-white/10">
              <p className="text-white/40 text-xs uppercase tracking-wider mb-1">Prihodki</p>
              <p className="text-xl sm:text-2xl font-bold text-[#7fa8b8]" data-testid="letni-skupaj-prihodki">{formatEur(totals.prihodki)}</p>
            </div>
            <div className="p-3 sm:p-4 rounded-2xl bg-white/[0.03] border border-white/10">
              <p className="text-white/40 text-xs uppercase tracking-wider mb-1">Stroški</p>
              <p className="text-xl sm:text-2xl font-bold text-[#c8846b]" data-testid="letni-skupaj-stroski">{formatEur(totals.stroski)}</p>
            </div>
            <div className="p-3 sm:p-4 rounded-2xl bg-white/[0.03] border border-white/10">
              <p className="text-white/40 text-xs uppercase tracking-wider mb-1">Dobiček</p>
              <p className={`text-xl sm:text-2xl font-bold ${profitClass(totals.dobicek)}`} data-testid="letni-skupaj-dobicek">{formatEur(totals.dobicek)}</p>
            </div>
          </div>
        )}
      </div>

      {invoiceMonth != null && (
        <div ref={invoiceListRef} className="rounded-2xl bg-white/[0.03] border border-white/10 overflow-hidden" data-testid="letni-racuni">
          <div className="px-4 pt-4 sm:px-5 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-[#c59b5b]">Računi, {MONTHS[invoiceMonth - 1]} {year}</h2>
              <p className="text-white/40 text-sm mt-1">Izdani računi gostov v tem mesecu.</p>
            </div>
            <button
              type="button"
              onClick={() => setInvoiceMonth(null)}
              className="px-3 py-1.5 rounded-lg bg-white/5 text-white/70 hover:bg-white/10 text-sm"
            >
              Zapri
            </button>
          </div>
          {invoiceError && <p className="px-4 py-6 sm:px-5 text-sm text-[#c8846b]">{invoiceError}</p>}
          {!invoiceError && !invoices && <p className="px-4 py-6 sm:px-5 text-sm text-white/50">Nalagam račune…</p>}
          {invoices && invoices.length === 0 && (
            <p className="px-4 py-6 sm:px-5 text-sm text-white/50" data-testid="letni-racuni-prazno">V tem mesecu ni izdanih računov.</p>
          )}
          {invoices && invoices.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-white/40">
                    <th className="px-4 py-3 font-medium sm:px-5">Gost</th>
                    <th className="px-3 py-3 font-medium">Številka</th>
                    <th className="px-3 py-3 font-medium">Datum</th>
                    <th className="px-3 py-3 font-medium text-right">Znesek</th>
                    <th className="px-4 py-3 font-medium text-right sm:px-5">Račun</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr key={invoice.reservationId} className="border-t border-white/5" data-testid={`letni-racun-${invoice.reservationId}`}>
                      <td className="px-4 py-2.5 sm:px-5 text-white">{invoice.guestName}</td>
                      <td className="px-3 py-2.5 text-white/75 whitespace-nowrap">{invoice.reference}</td>
                      <td className="px-3 py-2.5 text-white/75 whitespace-nowrap">{formatIssuedDate(invoice.issuedAt)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-[#7fa8b8] whitespace-nowrap" data-value={invoice.amountEur}>{formatEur(invoice.amountEur)}</td>
                      <td className="px-4 py-2.5 sm:px-5 text-right whitespace-nowrap">
                        <Link href={`/racun/${invoice.reservationId}?view=true`} className="text-[#c59b5b] hover:underline" data-testid={`letni-racun-odpri-${invoice.reservationId}`}>
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
      )}

      {shown && totals && (
        <div className="rounded-2xl bg-white/[0.03] border border-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm border-collapse">
              <caption className="absolute w-px h-px p-0 -m-px overflow-hidden whitespace-nowrap border-0">Letni pregled prihodkov in stroškov {year}</caption>
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-white/40">
                  <th className="sticky left-0 z-10 bg-[#102833] px-3 py-3 font-medium" rowSpan={2}>Mesec</th>
                  <th className="px-3 py-3 font-medium text-right" rowSpan={2}>Prihodki</th>
                  <th className="px-3 py-3 font-medium text-right" rowSpan={2}>Stroški</th>
                  <th className="px-3 py-3 font-medium text-right" rowSpan={2}>Dobiček</th>
                  {incomeColumns.length > 0 && (
                    <th className="px-3 pt-3 pb-1 font-medium text-center" colSpan={incomeColumns.length}>Prihodki po vrstah</th>
                  )}
                </tr>
                <tr className="text-[11px] uppercase tracking-wider text-white/40">
                  {incomeColumns.map((type) => (
                    <th key={type.key} className="px-3 pb-3 font-medium text-right">{type.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((row) => (
                  <tr key={row.month} className="border-t border-white/5" data-testid={`letni-mesec-${row.month}`}>
                    <th className="sticky left-0 z-10 bg-[#0c2430] px-3 py-2.5 text-left whitespace-nowrap" scope="row">
                      <MonthName month={row.month} selected={invoiceMonth === row.month} onSelect={setInvoiceMonth} />
                    </th>
                    <td className="px-3 py-2.5 text-right tabular-nums text-[#7fa8b8] font-medium whitespace-nowrap" data-testid={`letni-mesec-${row.month}-prihodki`} data-value={row.prihodki}>
                      {formatEur(row.prihodki)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-[#c8846b] whitespace-nowrap" data-testid={`letni-mesec-${row.month}-stroski`} data-value={row.stroski}>
                      {formatEur(row.stroski)}
                    </td>
                    <td className={`px-3 py-2.5 text-right tabular-nums whitespace-nowrap ${profitClass(row.dobicek)}`}>
                      {formatEur(row.dobicek)}
                    </td>
                    {incomeColumns.map((type) => (
                      <td
                        key={type.key}
                        className="px-3 py-2.5 text-right tabular-nums text-white/75 whitespace-nowrap"
                        data-testid={`letni-mesec-${row.month}-prihodek-${type.key}`}
                        data-value={row.prihodkiPoVrsti[type.key]}
                      >
                        {formatEur(row.prihodkiPoVrsti[type.key])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-[#8fae92]/30 bg-[#8fae92]/10 font-semibold" data-testid="letni-skupaj">
                  <th className="sticky left-0 z-10 bg-[#16342c] px-3 py-3 text-left text-white" scope="row">Skupaj</th>
                  <td className="px-3 py-3 text-right tabular-nums text-[#7fa8b8] whitespace-nowrap" data-testid="letni-skupaj-prihodki-vrstica" data-value={totals.prihodki}>{formatEur(totals.prihodki)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-[#c8846b] whitespace-nowrap" data-testid="letni-skupaj-stroski-vrstica" data-value={totals.stroski}>{formatEur(totals.stroski)}</td>
                  <td className={`px-3 py-3 text-right tabular-nums whitespace-nowrap ${profitClass(totals.dobicek)}`}>{formatEur(totals.dobicek)}</td>
                  {incomeColumns.map((type) => (
                    <td
                      key={type.key}
                      className="px-3 py-3 text-right tabular-nums text-white whitespace-nowrap"
                      data-testid={`letni-skupaj-prihodek-${type.key}`}
                      data-value={totals.prihodkiPoVrsti[type.key]}
                    >
                      {formatEur(totals.prihodkiPoVrsti[type.key])}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {shown && totals && (
        <div className="rounded-2xl bg-white/[0.03] border border-white/10 overflow-hidden">
          <div className="px-4 pt-4 sm:px-5">
            <h2 className="text-base font-bold text-[#c59b5b]">Stroški po vrstah</h2>
            <p className="text-white/40 text-sm mt-1">Iste vrste kot na mesečnem pregledu. Vsota vrst je enaka stroškom.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm border-collapse">
              <caption className="absolute w-px h-px p-0 -m-px overflow-hidden whitespace-nowrap border-0">Stroški po vrstah {year}</caption>
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-white/40">
                  <th className="sticky left-0 z-10 bg-[#102833] px-3 py-3 font-medium">Mesec</th>
                  <th className="px-3 py-3 font-medium text-right">Stroški</th>
                  {costColumns.map((type) => (
                    <th key={type.key} className="px-3 py-3 font-medium text-right">{type.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((row) => (
                  <tr key={row.month} className="border-t border-white/5" data-testid={`letni-stroski-${row.month}`}>
                    <th className="sticky left-0 z-10 bg-[#0c2430] px-3 py-2.5 text-left whitespace-nowrap" scope="row">
                      <MonthName month={row.month} selected={invoiceMonth === row.month} onSelect={setInvoiceMonth} />
                    </th>
                    <td className="px-3 py-2.5 text-right tabular-nums text-[#c8846b] font-medium whitespace-nowrap" data-testid={`letni-stroski-${row.month}-skupaj`} data-value={row.stroski}>
                      {formatEur(row.stroski)}
                    </td>
                    {costColumns.map((type) => (
                      <td
                        key={type.key}
                        className="px-3 py-2.5 text-right tabular-nums text-white/75 whitespace-nowrap"
                        data-testid={`letni-stroski-${row.month}-${type.key}`}
                        data-value={row.stroskiPoVrsti[type.key]}
                      >
                        {formatEur(row.stroskiPoVrsti[type.key])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-[#c8846b]/30 bg-[#c8846b]/10 font-semibold" data-testid="letni-stroski-skupaj">
                  <th className="sticky left-0 z-10 bg-[#3a2420] px-3 py-3 text-left text-white" scope="row">Skupaj</th>
                  <td className="px-3 py-3 text-right tabular-nums text-[#c8846b] whitespace-nowrap" data-testid="letni-stroski-skupaj-sestevek" data-value={sumCostTypes(totals.stroskiPoVrsti)}>
                    {formatEur(totals.stroski)}
                  </td>
                  {costColumns.map((type) => (
                    <td
                      key={type.key}
                      className="px-3 py-3 text-right tabular-nums text-white whitespace-nowrap"
                      data-testid={`letni-stroski-skupaj-${type.key}`}
                      data-value={totals.stroskiPoVrsti[type.key]}
                    >
                      {formatEur(totals.stroskiPoVrsti[type.key])}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
