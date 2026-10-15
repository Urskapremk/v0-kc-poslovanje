'use client'

import React, { useMemo } from 'react'
import { Droplets, Printer } from 'lucide-react'
import { HOUSEKEEPERS, housekeepingLabels, type Shift } from '@/lib/housekeeping'
import {
  WC_CLEANING_FROM,
  WC_MORNING_TIME,
  WC_AFTERNOON_TIME,
  generateWcCleaningMonth,
  combinedScheduleForStaff,
  type WcCleaningDay,
} from '@/lib/wc-cleaning'
import { employedOn } from '@/lib/employment'
import { leaveDaysForStaff, scheduleLeaveLabel } from '@/lib/leave'
import { printWithClass } from '@/lib/print-from'
import type { ScheduleEntry } from '@/lib/housekeeping'

const MONTHS = [
  'Januar', 'Februar', 'Marec', 'April', 'Maj', 'Junij',
  'Julij', 'Avgust', 'September', 'Oktober', 'November', 'December',
]
const DAY_NAMES = ['Ned', 'Pon', 'Tor', 'Sre', 'Čet', 'Pet', 'Sob']

type Props = {
  year: number
  month: number
  schedule: ScheduleEntry[] | undefined
  leaves: import('@/lib/leave').LeaveRequest[] | undefined
  roster: string[]
  endByName: Record<string, string | undefined>
  readOnly?: boolean
  selectedStaff: string | null
  cardClass?: string
}

export function WcCleaningSection({
  year,
  month,
  schedule,
  leaves,
  roster,
  endByName,
  selectedStaff,
  cardClass = 'rounded-2xl border border-white/10 bg-white/[0.03] p-3 sm:p-4',
}: Props) {
  const wcDays = useMemo(() => {
    if (!schedule) return [] as WcCleaningDay[]
    return generateWcCleaningMonth(
      year,
      month,
      schedule,
      leaves ?? [],
      roster,
      employedOn,
      endByName,
    )
  }, [year, month, schedule, leaves, roster, endByName])

  const wcInMonth = wcDays.filter((d) => d.date >= WC_CLEANING_FROM)
  const showBlock = `${year}-${String(month).padStart(2, '0')}-01`.slice(0, 7) >= WC_CLEANING_FROM.slice(0, 7) ||
    `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}` >= WC_CLEANING_FROM

  if (!showBlock || !schedule?.length) return null

  const filterPrintPages = (onlyStaff: string | null) => {
    document.querySelectorAll<HTMLElement>('.wc-combined-page').forEach((el) => {
      const staff = el.getAttribute('data-staff')
      if (onlyStaff && staff !== onlyStaff) el.setAttribute('data-print-skip', '1')
      else el.removeAttribute('data-print-skip')
    })
  }

  const printCombined = (name: string) => {
    filterPrintPages(name)
    printWithClass('printing-wc-combined', '.wc-combined-print')
    setTimeout(() => filterPrintPages(null), 800)
  }

  const printAllCombined = () => {
    filterPrintPages(null)
    printWithClass('printing-wc-combined', '.wc-combined-print')
  }

  return (
    <>
      <div className={`no-print space-y-3 ${cardClass}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-[#7fa8b8] flex items-center gap-2">
              <Droplets className="h-5 w-5" />
              Čiščenje WC in tuši
            </h3>
            <p className="text-xs text-white/45 mt-1">
              Od {WC_CLEANING_FROM.slice(8, 10)}.{WC_CLEANING_FROM.slice(5, 7)}.{WC_CLEANING_FROM.slice(0, 4)}: dopoldansko ob{' '}
              {WC_MORNING_TIME}, popoldansko ob {WC_AFTERNOON_TIME}. Rotacija med delavci na isti izmeni; upoštevani dopusti in bolniške.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {roster
              .filter((n) => !selectedStaff || n === selectedStaff)
              .map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => printCombined(name)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#7fa8b8]/15 text-[#7fa8b8] border border-[#7fa8b8]/30 hover:bg-[#7fa8b8]/25"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Skupni razpored — {name}
                </button>
              ))}
            {!selectedStaff && roster.length > 1 && (
              <button
                type="button"
                onClick={printAllCombined}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#c59b5b]/15 text-[#c59b5b] border border-[#c59b5b]/30 hover:bg-[#c59b5b]/25"
              >
                <Printer className="h-3.5 w-3.5" />
                Natisni vse (po osebah)
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm min-w-[480px]">
            <thead>
              <tr className="text-xs uppercase tracking-wider text-white/50">
                <th className="text-left py-2 px-2">Datum</th>
                <th className="text-left py-2 px-2">{WC_MORNING_TIME} (dopoldan)</th>
                <th className="text-left py-2 px-2">{WC_AFTERNOON_TIME} (popoldan)</th>
              </tr>
            </thead>
            <tbody>
              {wcInMonth.map((row) => {
                const day = Number(row.date.slice(8, 10))
                const weekday = new Date(year, month - 1, day).getDay()
                const cell = (slot: typeof row.morning) => {
                  if (slot.empty && !slot.assignee) {
                    return (
                      <span className="text-[#cc8e77] font-medium">ni nikogar</span>
                    )
                  }
                  return <span className="text-white/90 font-medium">{slot.assignee ?? '—'}</span>
                }
                return (
                  <tr key={row.date} className="border-t border-white/[0.06]">
                    <td className="py-1.5 px-2 tabular-nums text-white/70">
                      {DAY_NAMES[weekday]} {day}. {MONTHS[month - 1].slice(0, 3).toLowerCase()}
                    </td>
                    <td className="py-1.5 px-2">{cell(row.morning)}</td>
                    <td className="py-1.5 px-2">{cell(row.afternoon)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="wc-combined-print" aria-hidden="true">
        {roster.map((name) => {
            const rows = combinedScheduleForStaff(
              name,
              year,
              month,
              schedule ?? [],
              wcDays,
              leaves ?? [],
              employedOn,
              endByName,
            )
            const leaveByDay = leaveDaysForStaff(leaves ?? [], name, year, month)
            return (
              <div key={name} data-staff={name} className="wc-combined-page doc-page">
                <div className="doc-header">
                  <img className="doc-logo" src="/images/komba-logo-color.png" alt="Komba Cabana" />
                  <p className="doc-location">Nosy Komba, Madagascar</p>
                </div>
                <div className="doc-title-block">
                  <h2 className="doc-title">SKUPNI RAZPORED</h2>
                  <p className="doc-subtitle">
                    {name} · {MONTHS[month - 1]} {year}
                  </p>
                </div>
                <p className="wc-combined-note">
                  Izmena sobarice + čiščenje WC in tušev (od {WC_CLEANING_FROM.split('-').reverse().join('.')})
                </p>
                <table className="doc-table wc-combined-table">
                  <thead>
                    <tr>
                      <th>Dan</th>
                      <th>Datum</th>
                      <th>Izmena</th>
                      <th>WC in tuši</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const ds = r.date
                      const shift = schedule?.find((e) => e.date === ds && e.staffName === name)?.shift as
                        | Shift
                        | undefined
                      const labels = housekeepingLabels(ds)
                      let shiftDetail = r.shiftLabel
                      if (r.shift === 'MORNING') shiftDetail = labels.morning
                      else if (r.shift === 'AFTERNOON') shiftDetail = labels.afternoon
                      const leave = leaveByDay[r.day]
                      return (
                        <tr key={r.date}>
                          <td>{DAY_NAMES[r.weekday]}</td>
                          <td>
                            {r.day}. {MONTHS[month - 1].slice(0, 3).toLowerCase()}
                          </td>
                          <td>
                            {leave ? (
                              <>
                                {scheduleLeaveLabel(leave.type)}
                                <small style={{ display: 'block', opacity: 0.75 }}>
                                  {shift === 'MORNING'
                                    ? labels.morningShort
                                    : shift === 'AFTERNOON'
                                      ? labels.afternoonShort
                                      : '—'}
                                </small>
                              </>
                            ) : (
                              shiftDetail
                            )}
                          </td>
                          <td className="wc-duty">{r.wcLabel ?? '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <div className="doc-legend">
                  <span>
                    <strong>{WC_MORNING_TIME}</strong> — čiščenje ob začetku dopoldanske izmene ·{' '}
                    <strong>{WC_AFTERNOON_TIME}</strong> — ob popoldanski izmeni
                  </span>
                </div>
              </div>
            )
          })}
      </div>

      <style jsx global>{`
        .wc-combined-print { display: none; }
        @media print {
          body.printing-wc-combined * { visibility: hidden; }
          body.printing-wc-combined .wc-combined-print,
          body.printing-wc-combined .wc-combined-print * { visibility: visible; }
          body.printing-wc-combined .no-print,
          body.printing-wc-combined .schedule-print,
          body.printing-wc-combined .schedule-color-print,
          body.printing-wc-combined .attendance-print { display: none !important; }
          body.printing-wc-combined .wc-combined-print {
            display: block !important;
            position: static;
            width: 100%;
          }
          .wc-combined-page {
            page-break-after: always;
            break-after: page;
            color: #111;
            font-family: Georgia, 'Times New Roman', serif;
          }
          .wc-combined-page:last-child { page-break-after: auto; }
          .wc-combined-page[data-print-skip='1'] { display: none !important; }
          .wc-combined-note { font-size: 12px; margin: 0 0 10px; color: #444; }
          .wc-combined-table th, .wc-combined-table td {
            border: 1px solid #999;
            padding: 4px 8px;
            font-size: 11px;
            text-align: left;
          }
          .wc-combined-table th { background: #f8f5ef !important; print-color-adjust: exact; }
          .wc-duty { font-weight: 600; }
        }
      `}</style>
    </>
  )
}
