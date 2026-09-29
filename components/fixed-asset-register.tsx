'use client'

import useSWR from 'swr'
import { BookOpen, Printer } from 'lucide-react'
import { getFixedAssetRegister, type FixedAssetRegisterRow } from '@/app/actions/statistics'

const MONTH_NAMES = ['januar', 'februar', 'marec', 'april', 'maj', 'junij', 'julij', 'avgust', 'september', 'oktober', 'november', 'december']

function formatEur(n: number) {
  return new Intl.NumberFormat('sl-SI', { style: 'currency', currency: 'EUR' }).format(n || 0)
}
function formatAr(n: number) {
  return `${new Intl.NumberFormat('sl-SI').format(Math.round(n || 0))} Ar`
}
function formatDate(d: string | null) {
  if (!d) return '—'
  return new Intl.DateTimeFormat('sl-SI', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(d))
}
function formatMonth(ym: string | null) {
  if (!ym) return '—'
  const [y, m] = ym.split('-').map(Number)
  return `${MONTH_NAMES[m - 1]} ${y}`
}

function statusLabel(r: FixedAssetRegisterRow) {
  if (r.status === 'in_progress') return 'V izdelavi'
  if (r.fullyDepreciated) return 'Amortizirano'
  return 'V uporabi'
}

export default function FixedAssetRegister({ year, month }: { year: number; month: number }) {
  const { data: rows = [], isLoading } = useSWR(['fixed-asset-register', year, month], () =>
    getFixedAssetRegister(year, month),
  )

  const totals = rows.reduce(
    (s, r) => ({
      eur: s.eur + r.amountEur,
      ar: s.ar + r.amountAr,
      acc: s.acc + r.accumulatedEur,
      net: s.net + r.netBookEur,
    }),
    { eur: 0, ar: 0, acc: 0, net: 0 },
  )
  const asOf = `${MONTH_NAMES[month - 1]} ${year}`

  const statusClass = (r: FixedAssetRegisterRow) =>
    r.status === 'in_progress'
      ? 'border-[#e0a561]/40 bg-[#e0a561]/10 text-[#e0a561]'
      : r.fullyDepreciated
        ? 'border-white/15 bg-white/5 text-white/45'
        : 'border-[#8fae92]/40 bg-[#8fae92]/10 text-[#8fae92]'

  return (
    <div className="asset-register-root rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 12mm; }
          body * { visibility: hidden; }
          .asset-register-root, .asset-register-root * { visibility: visible; }
          .asset-register-root { position: absolute; left: 0; top: 0; width: 100%; background: #fff !important; color: #111 !important; border: none !important; padding: 0 !important; }
          .asset-register-root * { color: #111 !important; background: transparent !important; border-color: #bbb !important; }
          .asset-register-root table { font-size: 10px; }
          .asset-register-root th, .asset-register-root td { border: 1px solid #bbb !important; padding: 4px 6px !important; }
          .asset-register-root .no-print { display: none !important; }
        }
      `}</style>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-white/70">
            <BookOpen className="h-4 w-4 text-[#c59b5b]" />
            Register osnovnih sredstev
          </h4>
          <p className="mt-1 text-xs text-white/45">
            Komba Cabana · stanje na konec meseca {asOf} · {rows.length} sredstev
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="no-print flex items-center gap-2 rounded-xl border border-[#c59b5b]/40 bg-[#c59b5b]/10 px-4 py-2 text-sm font-medium text-[#c59b5b] hover:bg-[#c59b5b]/20"
        >
          <Printer className="h-4 w-4" />
          Natisni register
        </button>
      </div>

      {isLoading ? (
        <p className="mt-4 text-sm text-white/40">Nalagam...</p>
      ) : rows.length === 0 ? (
        <p className="mt-4 text-sm text-white/40">V registru še ni osnovnih sredstev.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[10px] uppercase tracking-wider text-white/40">
                <th className="px-3 py-2 font-medium">Inv. št.</th>
                <th className="px-3 py-2 font-medium">Naziv</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Nabava / aktivacija</th>
                <th className="px-3 py-2 text-right font-medium">Nabavna vrednost</th>
                <th className="px-3 py-2 text-right font-medium">Stopnja</th>
                <th className="px-3 py-2 text-right font-medium">Amortizirano</th>
                <th className="px-3 py-2 text-right font-medium">Popravek vred.</th>
                <th className="px-3 py-2 text-right font-medium">Neodpisana vred.</th>
                <th className="px-3 py-2 font-medium">Konec amort.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-white/55">{r.inventoryNo}</td>
                  <td className="px-3 py-2.5 text-white/85">
                    {r.name}
                    {(r.contractor || r.costCount > 0) && (
                      <span className="block text-[10px] text-white/40">
                        {r.contractor && `Izvajalec: ${r.contractor}`}
                        {r.contractor && r.costCount > 0 && ' · '}
                        {r.costCount > 0 && `${r.costCount} stroškov`}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusClass(r)}`}>
                      {statusLabel(r)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-white/60">
                    {r.status === 'in_progress' ? `začeto ${formatDate(r.acquiredDate)}` : formatDate(r.acquiredDate)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-white/75">
                    {formatAr(r.amountAr)}
                    <span className="block text-[10px] text-white/40">{formatEur(r.amountEur)}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right text-white/65">
                    {r.annualRatePct > 0 ? `${new Intl.NumberFormat('sl-SI').format(r.annualRatePct)} %` : '—'}
                    {r.lifeMonths > 0 && <span className="block text-[10px] text-white/40">{r.lifeMonths} mes.</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right text-white/60">
                    {r.status === 'in_progress' ? '—' : `${r.monthsDepreciated} / ${r.lifeMonths} mes.`}
                  </td>
                  <td className="px-3 py-2.5 text-right text-white/65">{formatEur(r.accumulatedEur)}</td>
                  <td className="px-3 py-2.5 text-right font-semibold text-[#c59b5b]">{formatEur(r.netBookEur)}</td>
                  <td className="px-3 py-2.5 text-white/55">{r.status === 'in_progress' ? 'po aktivaciji' : formatMonth(r.endDate)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-white/15 text-sm font-semibold">
                <td className="px-3 py-2.5 text-white/70" colSpan={4}>Skupaj</td>
                <td className="px-3 py-2.5 text-right text-white/80">
                  {formatAr(totals.ar)}
                  <span className="block text-[10px] font-normal text-white/40">{formatEur(totals.eur)}</span>
                </td>
                <td colSpan={2}></td>
                <td className="px-3 py-2.5 text-right text-white/75">{formatEur(totals.acc)}</td>
                <td className="px-3 py-2.5 text-right text-[#c59b5b]">{formatEur(totals.net)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
          <p className="mt-3 text-[11px] text-white/40">
            Popravek vrednosti = nabrana amortizacija do konca meseca {asOf}. Sredstva v izdelavi se ne amortizirajo, dokler niso aktivirana.
          </p>
        </div>
      )}
    </div>
  )
}
