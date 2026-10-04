'use client'

import React, { useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import { Calendar, Wand2, Printer, Sun, Sunset, Moon, FileText, ChevronDown } from 'lucide-react'
import {
  getHousekeepingSchedule,
  generateHousekeepingSchedule,
  setHousekeepingShift,
} from '@/app/actions/housekeeping'
import { HOUSEKEEPERS, HOUSEKEEPING_NEW_FROM, housekeepingHours, housekeepingLabels, type Shift } from '@/lib/housekeeping'
import { getLeaveRequests } from '@/app/actions/leave'
import { getAllStaffMembers } from '@/app/actions/statistics'
import { employedOn, endDatesFor, keptInMonth } from '@/lib/employment'
import { leaveDaysForStaff, LEAVE_TYPES, type LeaveType } from '@/lib/leave'
import { getHolidayName, isSunday } from '@/lib/holidays'
import { summarizeMonthHours, type HoursBreakdown } from '@/lib/work-hours'
import { HoursBreakdownLines } from '@/components/hours-breakdown-lines'
import { themeFor } from '@/lib/schedule-theme'
import { GuestArrivalsLinen } from '@/components/guest-arrivals-linen'
import { defaultPrintFrom, printStartDay } from '@/lib/print-from'
import { PrintFromDialog } from '@/components/print-from-dialog'

const MONTHS = [
  'Januar', 'Februar', 'Marec', 'April', 'Maj', 'Junij',
  'Julij', 'Avgust', 'September', 'Oktober', 'November', 'December',
]

const DAY_NAMES = ['Ned', 'Pon', 'Tor', 'Sre', 'Čet', 'Pet', 'Sob']

// French labels for the printed sheets (housekeepers only read French)
const DAY_NAMES_FR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

// Color per housekeeper for easy visual scanning
const STAFF_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Eniki: { bg: 'bg-[#7fa8b8]/15', text: 'text-[#7fa8b8]', border: 'border-[#7fa8b8]/30' },
  Felicia: { bg: 'bg-[#8fae92]/15', text: 'text-[#8fae92]', border: 'border-[#8fae92]/30' },
  Christaline: { bg: 'bg-[#c59b5b]/15', text: 'text-[#c59b5b]', border: 'border-[#c59b5b]/30' },
  Mela: { bg: 'bg-[#cc8e77]/15', text: 'text-[#cc8e77]', border: 'border-[#cc8e77]/30' },
}

// Color per SHIFT (same logic as kitchen): morning one color, afternoon another.
// Editing view (Urška, Kadrovski oddelek) keeps the original navy table.
const SHIFT_COLORS: Record<Shift, { bg: string; text: string; border: string }> = {
  MORNING: { bg: 'bg-[#c59b5b]/15', text: 'text-[#c59b5b]', border: 'border-[#c59b5b]/30' },
  AFTERNOON: { bg: 'bg-[#7fa8b8]/15', text: 'text-[#7fa8b8]', border: 'border-[#7fa8b8]/30' },
  OFF: { bg: 'bg-white/[0.03]', text: 'text-white/40', border: 'border-white/10' },
}

// View-only sand table (Borut). Darker variants, because the light navy/gold
// used on dark backgrounds would wash out on the sand panel.
const SHIFT_COLORS_SAND: Record<Shift, { bg: string; text: string; border: string }> = {
  MORNING: { bg: 'bg-[#8f6d3a]/12', text: 'text-[#8f6d3a]', border: 'border-[#8f6d3a]/35' },
  AFTERNOON: { bg: 'bg-[#3f6b7d]/12', text: 'text-[#3f6b7d]', border: 'border-[#3f6b7d]/35' },
  OFF: { bg: 'bg-white', text: 'text-[#2b2622]/45', border: 'border-[#0f2e3a]/[0.08]' },
}

// Everything else the table paints now lives in lib/schedule-theme, shared by
// all four schedules.

export default function RazporedTab({
  year,
  month,
  readOnly = false,
}: {
  year: number
  month: number
  // View-only mode: hides the editing tools and payroll hour cards, and turns
  // the shift cells into plain text so the schedule cannot be changed.
  readOnly?: boolean
}) {
  const [generating, setGenerating] = useState(false)
  const [selectedStaff, setSelectedStaff] = useState<string | null>(null)
  // The editing tools (action buttons, person filter, hours cards) are only
  // needed while building the schedule on a desktop. Closed by default so the
  // read-only phone view shows just the title and the table.
  const [showTools, setShowTools] = useState(false)
  const [printFrom, setPrintFrom] = useState(() => defaultPrintFrom(year, month))
  const [printAsk, setPrintAsk] = useState<null | 'schedule' | 'schedule-color'>(null)
  const printStart = printStartDay(printFrom, year, month)
  // Never open the tools block in view-only mode.
  const toolsVisible = showTools && !readOnly

  // Sand table for Borut's read-only view, original navy for editing.
  const t = themeFor(readOnly)
  const shiftColors = readOnly ? SHIFT_COLORS_SAND : SHIFT_COLORS

  // Open the schedule on today's row instead of at the 1st of the month, so the
  // current day is what you see first. Local date parts on purpose — toISOString
  // would shift the day in our timezone.
  const nowDate = new Date()
  const todayDay =
    nowDate.getFullYear() === year && nowDate.getMonth() + 1 === month ? nowDate.getDate() : null
  const todayRowRef = useRef<HTMLTableRowElement | null>(null)
  // Per-person collapse for the hours breakdown. Keyed by name so each card
  // remembers its own state while several are on screen at once.
  const [hiddenHours, setHiddenHours] = useState<Record<string, boolean>>({})
  const toggleHours = (name: string) => setHiddenHours((prev) => ({ ...prev, [name]: !prev[name] }))
  const { data: schedule, mutate, isLoading } = useSWR(
    ['housekeeping', year, month],
    () => getHousekeepingSchedule(year, month),
    { refreshInterval: 0 }
  )

  const lastDay = new Date(year, month, 0).getDate()

  // Scroll today's row into view once the schedule is on screen, and again when a
  // person is picked (the table is rebuilt with a single column).
  useEffect(() => {
    const row = todayRowRef.current
    if (!row) return
    row.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [schedule, selectedStaff, todayDay])

  const { data: staffMembers } = useSWR('all-staff-members', getAllStaffMembers)
  const endByName = endDatesFor(HOUSEKEEPERS, staffMembers ?? [])
  const roster = keptInMonth(HOUSEKEEPERS, endByName, year, month)
  const { data: leaves } = useSWR(['leave', 'housekeeper'], () => getLeaveRequests('housekeeper'))
  const leaveByStaff: Record<string, ReturnType<typeof leaveDaysForStaff>> = {}
  for (const name of HOUSEKEEPERS) leaveByStaff[name] = leaveDaysForStaff(leaves ?? [], name, year, month)

  // Map: date -> { staffName -> shift }
  const byDate: Record<string, Record<string, Shift>> = {}
  for (const e of schedule || []) {
    if (!byDate[e.date]) byDate[e.date] = {}
    byDate[e.date][e.staffName] = e.shift
  }

  const stats: Record<string, { shifts: number; hours: number }> = {}
  for (const name of HOUSEKEEPERS) stats[name] = { shifts: 0, hours: 0 }
  for (const e of schedule || []) {
    if (!employedOn(endByName[e.staffName], e.date)) continue
    if (e.shift === 'MORNING' || e.shift === 'AFTERNOON') {
      if (!stats[e.staffName]) stats[e.staffName] = { shifts: 0, hours: 0 }
      stats[e.staffName].shifts += 1
      stats[e.staffName].hours += housekeepingHours(e.date)
    }
  }
  const printHours: Record<string, number> = {}
  for (const name of HOUSEKEEPERS) printHours[name] = 0
  for (const e of schedule || []) {
    if (e.date < printFrom) continue
    if (!employedOn(endByName[e.staffName], e.date)) continue
    if (e.shift === 'MORNING' || e.shift === 'AFTERNOON') {
      printHours[e.staffName] = (printHours[e.staffName] || 0) + housekeepingHours(e.date)
    }
  }

  // Per-housekeeper monthly breakdown: regular / Sunday / holiday work + leave.
  const breakdowns: Record<string, HoursBreakdown> = {}
  for (const name of HOUSEKEEPERS) {
    const entries = []
    for (let d = 1; d <= lastDay; d++) {
      const ds = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const shift = employedOn(endByName[name], ds) ? byDate[ds]?.[name] : undefined
      const worked = shift === 'MORNING' || shift === 'AFTERNOON'
      entries.push({ day: d, hours: worked ? housekeepingHours(ds) : 0, onLeave: !!leaveByStaff[name]?.[d] })
    }
    breakdowns[name] = summarizeMonthHours(year, month, entries)
  }

  const handleGenerate = async () => {
    if (!confirm(`Ustvarim razpored za ${MONTHS[month - 1]} ${year}? To bo prepisalo obstoječi razpored tega meseca.`)) return
    setGenerating(true)
    await generateHousekeepingSchedule(year, month)
    await mutate()
    setGenerating(false)
  }

  const handleCellChange = async (date: string, staffName: string, shift: Shift) => {
    await setHousekeepingShift(date, staffName, shift)
    mutate()
  }

  // Print either the schedule calendar or the attendance sheets.
  const printDoc = (target: 'schedule' | 'attendance' | 'schedule-color') => {
    document.body.classList.add(`printing-${target}`)
    window.print()
    setTimeout(() => document.body.classList.remove(`printing-${target}`), 100)
  }

  const askPrint = (target: 'schedule' | 'schedule-color') => {
    setPrintFrom(defaultPrintFrom(year, month))
    setPrintAsk(target)
  }

  const confirmPrint = () => {
    const target = printAsk
    if (!target) return
    setPrintAsk(null)
    window.setTimeout(() => printDoc(target), 80)
  }

  const dateStr = (d: number) =>
    `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`

  const hasSchedule = (schedule || []).length > 0

  return (
    <div className="space-y-4">
      {/* Toolbar — the title row stays, everything else collapses. */}
      <div className="no-print rounded-2xl bg-white/[0.03] border border-white/10">
        <button
          type="button"
          onClick={readOnly ? undefined : () => setShowTools((v) => !v)}
          aria-expanded={readOnly ? undefined : showTools}
          title={readOnly ? undefined : showTools ? 'Skrij orodja' : 'Prikaži orodja'}
          className={`w-full flex items-center justify-between gap-3 p-4 text-left ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}
        >
          <div>
            <h2 className="text-lg font-bold text-[#c59b5b] flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Razpored sobaric
            </h2>
            <p className="text-white/40 text-sm">{MONTHS[month - 1]} {year} · {roster.join(', ')}</p>
            {`${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}` >= HOUSEKEEPING_NEW_FROM && (
              <p className="mt-1 text-xs text-white/45">Od 6. oktobra: dopoldan 7–13, popoldan 13–19. Christaline je dopoldan pomoč. Eniki in Felicia se vsak teden zamenjata. Če je popoldanska prosta, jo zamenja druga.</p>
            )}
          </div>
          {!readOnly && (
            <span className="flex flex-shrink-0 items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
              Orodja
              <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${showTools ? 'rotate-180' : ''}`} />
            </span>
          )}
        </button>
        {toolsVisible && (
        <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.08] px-4 py-3">
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#8fae92]/20 text-[#8fae92] border border-[#8fae92]/30 hover:bg-[#8fae92]/30 transition-colors text-sm font-medium disabled:opacity-50"
          >
            <Wand2 className="h-4 w-4" />
            {generating ? 'Ustvarjam...' : hasSchedule ? 'Ponovno ustvari' : 'Ustvari razpored'}
          </button>
          {hasSchedule && (
            <button
              onClick={() => askPrint('schedule-color')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#8fae92]/20 text-[#8fae92] border border-[#8fae92]/30 hover:bg-[#8fae92]/30 transition-colors text-sm font-medium"
            >
              <Printer className="h-4 w-4" />
              Natisni razpored (barvno)
            </button>
          )}
          {hasSchedule && (
            <button
              onClick={() => askPrint('schedule')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#7fa8b8]/20 text-[#7fa8b8] border border-[#7fa8b8]/30 hover:bg-[#7fa8b8]/30 transition-colors text-sm font-medium"
            >
              <Printer className="h-4 w-4" />
              Natisni razpored (FR)
            </button>
          )}
          <button
            onClick={() => printDoc('attendance')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#c59b5b]/20 text-[#c59b5b] border border-[#c59b5b]/30 hover:bg-[#c59b5b]/30 transition-colors text-sm font-medium"
          >
            <FileText className="h-4 w-4" />
            Natisni evidenco prisotnosti
          </button>
        </div>
        )}
      </div>

      <PrintFromDialog
        open={printAsk !== null}
        year={year}
        month={month}
        value={printFrom}
        person={selectedStaff}
        onChange={setPrintFrom}
        onCancel={() => setPrintAsk(null)}
        onPrint={confirmPrint}
      />

      {/* Legend (click a name to show only that housekeeper) — always visible,
          it is how you pick a single person's schedule while viewing. */}
      <div className="no-print flex flex-wrap items-center gap-3 text-xs">
        {roster.map((name) => {
          const active = selectedStaff === name
          return (
            <button
              key={name}
              type="button"
              onClick={() => setSelectedStaff(active ? null : name)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${STAFF_COLORS[name].bg} ${STAFF_COLORS[name].border} ${active ? 'ring-2 ring-offset-1 ring-offset-[#0b2731] ' + STAFF_COLORS[name].text.replace('text-', 'ring-') : 'opacity-100'} ${selectedStaff && !active ? 'opacity-40' : ''}`}
            >
              <span className={`h-2.5 w-2.5 rounded-full ${STAFF_COLORS[name].text}`} style={{ backgroundColor: 'currentColor' }} />
              <span className={STAFF_COLORS[name].text}>{name}</span>
            </button>
          )
        })}
        {selectedStaff && (
          <button
            type="button"
            onClick={() => setSelectedStaff(null)}
            className="px-3 py-1.5 rounded-lg border border-white/15 text-white/50 hover:text-white hover:bg-white/5 transition-colors"
          >
            Pokaži vse
          </button>
        )}
              {`${year}-${String(month).padStart(2, '0')}-01` < HOUSEKEEPING_NEW_FROM && (
                <>
                  <div className="flex items-center gap-1 text-white/40"><Sun className="h-3.5 w-3.5" /> Dopoldan 6-12:30</div>
                  <div className="flex items-center gap-1 text-white/40"><Sunset className="h-3.5 w-3.5" /> Popoldan 12-18:30</div>
                </>
              )}
              {`${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}` >= HOUSEKEEPING_NEW_FROM && (
                <>
                  <div className="flex items-center gap-1 text-white/40"><Sun className="h-3.5 w-3.5" /> Dopoldan 7-13</div>
                  <div className="flex items-center gap-1 text-white/40"><Sunset className="h-3.5 w-3.5" /> Popoldan 13-19</div>
                </>
              )}
        <div className="flex items-center gap-1 text-white/40"><Moon className="h-3.5 w-3.5" /> Prosto</div>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-white/40">Nalagam razpored...</div>
      ) : !hasSchedule ? (
        <div className={`p-8 text-center rounded-2xl border ${t.empty}`}>
          {readOnly
            ? 'Za ta mesec razpored še ni pripravljen.'
            : 'Za ta mesec še ni razporeda. Kliknite "Ustvari razpored".'}
        </div>
      ) : (
        <>
          {/* Hours summary per housekeeper (each shift = 6h). Follows the same
              selection filter as the tables below, so picking one person shows
              only her own figures. */}
          {/* items-start: without it the grid stretches every card to the tallest one,
              so a collapsed card would keep its full height and leave a blank gap. */}
          {toolsVisible && (
          <div className="no-print grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
            {roster.filter((name) => !selectedStaff || name === selectedStaff).map((name) => {
              const c = STAFF_COLORS[name]
              const s = stats[name] || { shifts: 0, hours: 0 }
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => toggleHours(name)}
                  aria-expanded={!hiddenHours[name]}
                  title={hiddenHours[name] ? 'Pokaži razčlenitev ur' : 'Skrij razčlenitev ur'}
                  className={`w-full cursor-pointer rounded-2xl border p-4 text-left transition-colors ${c.bg} ${c.border}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${c.text}`} style={{ backgroundColor: 'currentColor' }} />
                    <span className={`font-semibold ${c.text}`}>{name}</span>
                  </div>
                  <div className={`text-2xl font-bold ${c.text}`}>{breakdowns[name]?.totalHours ?? s.hours} <span className="text-sm font-medium opacity-70">ur</span></div>
                  <div className="text-xs text-white/40 mt-1">{(breakdowns[name] ? breakdowns[name].regularDays + breakdowns[name].sundayDays + breakdowns[name].holidayDays : s.shifts)} izmen × 6 ur</div>
                  {breakdowns[name] && !hiddenHours[name] && <HoursBreakdownLines b={breakdowns[name]} />}
                </button>
              )
            })}
          </div>
          )}

          <div className={`no-print print-area rounded-2xl border p-3 sm:p-4 overflow-x-auto ${t.card}`}>
          <h3 className="print-title hidden text-center text-lg font-bold mb-4">
            Razpored sobaric — {MONTHS[month - 1]} {year}
          </h3>
          {/* On-screen schedule table (rows = days, columns = housekeepers) */}
          {/* The 640px floor is sized for all four columns. With one person selected
              it would push the single shift column off a phone screen, so drop it. */}
          <table className={`w-full border-collapse text-sm ${selectedStaff ? '' : 'min-w-[640px]'}`}>
            <thead>
              <tr className={`text-xs uppercase tracking-wider ${t.head}`}>
                <th className="text-left py-2 px-2 font-semibold">Dan</th>
                <th className="text-left py-2 px-2 font-semibold">Datum</th>
                {roster.filter((name) => !selectedStaff || name === selectedStaff).map((name) => (
                  <th key={name} className="text-left py-2 px-2 font-semibold">{name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: lastDay }).map((_, i) => {
                const day = i + 1
                const ds = dateStr(day)
                const shifts = byDate[ds] || {}
                const weekday = new Date(year, month - 1, day).getDay()
                const holiday = getHolidayName(year, month, day)
                const sunday = isSunday(year, month, day)
                const isToday = todayDay === day
                return (
                  // Today keeps the Sunday/holiday background (those carry pay
                  // meaning) and is marked with a gold bar plus a DANES label.
                  <tr
                    key={ds}
                    ref={isToday ? todayRowRef : undefined}
                    className={`border-t ${t.rowBorder} ${holiday ? t.holidayRow : sunday ? t.sundayRow : ''}`}
                  >
                    <td className={`py-1.5 px-2 ${isToday ? `border-l-[3px] ${t.todayBar}` : ''} ${sunday || holiday ? `${t.dayAccent} font-semibold` : t.dayMuted}`}>{DAY_NAMES[weekday]}</td>
                    <td className={`py-1.5 px-2 tabular-nums ${t.dateText}`}>
                      <div className="flex flex-col gap-0.5">
                        <span>{day}. {MONTHS[month - 1].slice(0, 3).toLowerCase()}</span>
                        {holiday && (
                          <span className={`inline-flex w-fit items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${t.holidayBadge}`} title={holiday}>
                            {holiday}
                          </span>
                        )}
                        {!holiday && sunday && (
                          <span className={`text-[10px] font-medium ${t.sundayLabel}`}>Nedelja</span>
                        )}
                        {isToday && (
                          <span className={`text-[9px] font-semibold uppercase tracking-[0.18em] ${t.todayLabel}`}>
                            Danes
                          </span>
                        )}
                      </div>
                    </td>
                    {roster.filter((name) => !selectedStaff || name === selectedStaff).map((name) => {
                      if (!employedOn(endByName[name], ds)) {
                        return <td key={name} className="py-1.5 px-2 text-white/25">—</td>
                      }
                      const shift = shifts[name] || 'OFF'
                      const c = shiftColors[shift as Shift] ?? shiftColors.OFF
                      const leave = leaveByStaff[name]?.[day]
                      return (
                        <td key={name} className="py-1.5 px-2">
                          <div className="flex flex-col gap-1">
                            {leave && (
                              <span
                                className={`inline-flex w-fit items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${t.leaveBadge}`}
                                title={LEAVE_TYPES[leave.type as LeaveType]?.sl}
                              >
                                Dopust
                              </span>
                            )}
                            {readOnly ? (
                              <span
                                className={`inline-flex w-full items-center rounded-md border px-1.5 py-1 text-[11px] ${
                                  leave ? t.leaveCell : `${c.bg} ${c.text} ${c.border}`
                                } ${shift === 'OFF' && !leave ? t.offDim : ''}`}
                              >
                                {shift === 'MORNING' ? housekeepingLabels(ds).morningShort : shift === 'AFTERNOON' ? housekeepingLabels(ds).afternoonShort : 'Prosto'}
                              </span>
                            ) : (
                            <select
                              value={shift}
                              onChange={(e) => handleCellChange(ds, name, e.target.value as Shift)}
                              className={`shift-select w-full text-[11px] rounded-md px-1.5 py-1 border cursor-pointer ${
                                leave ? t.leaveCell : `${c.bg} ${c.text} ${c.border}`
                              } ${shift === 'OFF' && !leave ? t.offDim : ''}`}
                            >
              <option value="MORNING" className="bg-[#0b2731] text-white">{housekeepingLabels(ds).morningShort}</option>
              <option value="AFTERNOON" className="bg-[#0b2731] text-white">{housekeepingLabels(ds).afternoonShort}</option>
                              <option value="OFF" className="bg-[#0b2731] text-white">Prosto</option>
                            </select>
                            )}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        </>
      )}

      <GuestArrivalsLinen year={year} month={month} />

      {/* Color print sheet — same layout as screen, white paper, colored shifts. */}
      <div className="schedule-color-print" aria-hidden="true">
        <div className="doc-header">
          <img className="doc-logo" src="/images/komba-logo-color.png" alt="Komba Cabana" />
          <p className="doc-location">Nosy Komba, Madagascar</p>
        </div>
        <div className="doc-title-block">
          <h2 className="doc-title">RAZPORED SOBARIC</h2>
          <p className="doc-subtitle">{MONTHS[month - 1]} {year}{printStart ? ` · od ${printStart}. ${MONTHS[month - 1].toLowerCase()}` : ''}{selectedStaff ? ` · ${selectedStaff}` : ''}</p>
        </div>
        <table>
          <thead>
            <tr>
              <th className="sc-day">Dan</th>
              <th className="sc-date">Datum</th>
              {roster.filter((name) => !selectedStaff || name === selectedStaff).map((name) => (
                <th key={name}>{name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: lastDay }).map((_, i) => {
              const day = i + 1
              const ds = dateStr(day)
              if (ds < printFrom) return null
              const shifts = byDate[ds] || {}
              const weekday = new Date(year, month - 1, day).getDay()
              const holiday = getHolidayName(year, month, day)
              const sunday = isSunday(year, month, day)
              return (
                <tr key={ds} style={holiday ? { background: '#f7ece8' } : sunday ? { background: '#ecf6fa' } : undefined}>
                  <td className="sc-day" style={sunday || holiday ? { color: '#a56650', fontWeight: 700 } : undefined}>{DAY_NAMES[weekday]}</td>
                  <td className="sc-date">
                    {day}. {MONTHS[month - 1].slice(0, 3).toLowerCase()}
                    {holiday && <small style={{ display: 'block', color: '#a56650', fontWeight: 600 }}>{holiday}</small>}
                    {!holiday && sunday && <small style={{ display: 'block', color: '#28708d' }}>Dimanche</small>}
                  </td>
                  {roster.filter((name) => !selectedStaff || name === selectedStaff).map((name) => {
                    if (!employedOn(endByName[name], ds)) return <td key={name} className="sc-cell" />
                    const shift = (shifts[name] || 'OFF') as Shift
                    const leave = leaveByStaff[name]?.[day]
                    if (leave) {
                      return (
                        <td key={name} className="sc-cell sc-leave">
                          DOPUST
                          <small>{shift === 'MORNING' ? 'Dop' : shift === 'AFTERNOON' ? 'Pop' : '—'}</small>
                        </td>
                      )
                    }
                    const cls = shift === 'MORNING' ? 'sc-morning' : shift === 'AFTERNOON' ? 'sc-afternoon' : 'sc-off'
                    return (
                      <td key={name} className={`sc-cell ${cls}`}>
                        {shift === 'MORNING' ? housekeepingLabels(ds).morning : shift === 'AFTERNOON' ? housekeepingLabels(ds).afternoon : '—'}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
            <tr className="sc-total">
              <td colSpan={2} style={{ textAlign: 'right' }}>Skupaj ur</td>
              {roster.filter((name) => !selectedStaff || name === selectedStaff).map((name) => (
                <td key={name}>{printHours[name] ?? 0} h</td>
              ))}
            </tr>
          </tbody>
        </table>
        <div className="sc-legend">
              {printFrom < HOUSEKEEPING_NEW_FROM && (
                <>
                  <span className="lg"><span className="sw" style={{ background: '#f3e7d8', border: '1px solid #785224' }} /> Dopoldan 6-12:30</span>
                  <span className="lg"><span className="sw" style={{ background: '#e5f3f8', border: '1px solid #28708d' }} /> Popoldan 12-18:30</span>
                </>
              )}
              {dateStr(lastDay) >= HOUSEKEEPING_NEW_FROM && (
                <>
                  <span className="lg"><span className="sw" style={{ background: '#f3e7d8', border: '1px solid #785224' }} /> Dopoldan 7-13</span>
                  <span className="lg"><span className="sw" style={{ background: '#e5f3f8', border: '1px solid #28708d' }} /> Popoldan 13-19</span>
                </>
              )}
          <span className="lg"><span className="sw" style={{ background: '#f0e0da', border: '1px solid #975b45' }} /> Dopust</span>
          <span className="lg"><span className="sw" style={{ background: '#fff', border: '1px solid #aaa' }} /> Prosto</span>
          <span className="lg"><span className="sw" style={{ background: '#f7ece8', border: '1px solid #a56650' }} /> Jour férié / Dimanche</span>
        </div>
      </div>

      {/* Schedule print sheet — clean table, one row per day. Hidden on screen, shown only when printing schedule. */}
      <div className="schedule-print" aria-hidden="true">
        <div className="doc-page">
          <div className="doc-header">
            <img className="doc-logo" src="/images/komba-logo-color.png" alt="Komba Cabana" />
            <p className="doc-location">Nosy Komba, Madagascar</p>
          </div>
          <div className="doc-title-block">
            <h2 className="doc-title">PLANNING DE MÉNAGE {year}</h2>
            <p className="doc-subtitle">Femmes de chambre</p>
          </div>
          <div className="doc-fields">
            {selectedStaff && (
              <p><span className="doc-label">Nom:</span> <strong>{selectedStaff}</strong></p>
            )}
            <p><span className="doc-label">Mois:</span> <strong>{MONTHS_FR[month - 1]} {year}</strong></p>
            {printStart && <p><span className="doc-label">À partir du:</span> <strong>{printStart} {MONTHS_FR[month - 1].toLowerCase()}</strong></p>}
          </div>
          <table className="doc-table sched-table">
            <thead>
              <tr>
                <th className="sched-col-day">Jour</th>
                <th className="sched-col-date">Date</th>
                {roster.filter((name) => !selectedStaff || name === selectedStaff).map((name) => (
                  <th key={name}>{name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: lastDay }).map((_, i) => {
                const day = i + 1
                const ds = dateStr(day)
                if (ds < printFrom) return null
                const shifts = byDate[ds] || {}
                const weekday = new Date(year, month - 1, day).getDay()
                return (
                  <tr key={day}>
                    <td className="sched-col-day">{DAY_NAMES_FR[weekday]}</td>
                    <td className="sched-col-date">{day} {MONTHS_FR[month - 1].slice(0, 4).toLowerCase()}.</td>
                    {roster.filter((name) => !selectedStaff || name === selectedStaff).map((name) => {
                      if (!employedOn(endByName[name], ds)) return <td key={name} className="sched-shift" />
                      const shift = (shifts[name] || 'OFF') as Shift
                      return (
                        <td key={name} className="sched-shift">
                                {shift === 'MORNING' ? housekeepingLabels(ds).morningFr : shift === 'AFTERNOON' ? housekeepingLabels(ds).afternoonFr : '—'}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="sched-total-row">
                <td colSpan={2} className="sched-total-label">Total heures</td>
                {roster.filter((name) => !selectedStaff || name === selectedStaff).map((name) => (
                  <td key={name} className="sched-total-val">{(printHours[name] ?? 0)} h</td>
                ))}
              </tr>
            </tfoot>
          </table>
          <div className="doc-legend">
              {printFrom < HOUSEKEEPING_NEW_FROM && <span><strong>Matin</strong> 6h-12h30 · <strong>Après-midi</strong> 12h-18h30</span>}
              {dateStr(lastDay) >= HOUSEKEEPING_NEW_FROM && <span><strong>Matin</strong> 7h-13h · <strong>Après-midi</strong> 13h-19h</span>}
            <span><strong>—</strong> Repos</span>
          </div>
        </div>
      </div>

      {/* Attendance sheets — one full page per housekeeper. Hidden on screen, shown only when printing attendance. */}
      <div className="attendance-print" aria-hidden="true">
        {roster.filter((name) => !selectedStaff || name === selectedStaff).map((name) => (
          <div key={name} className="attendance-page doc-page">
            <div className="doc-header">
              <img className="doc-logo" src="/images/komba-logo-color.png" alt="Komba Cabana" />
              <p className="doc-location">Nosy Komba, Madagascar</p>
            </div>
            <div className="doc-title-block">
              <h2 className="doc-title">REGISTRE DE PRÉSENCE {year}</h2>
              <p className="doc-subtitle">Femme de chambre</p>
            </div>
            <div className="doc-fields">
              <p><span className="doc-label">Nom:</span> <strong>{name}</strong></p>
              <p><span className="doc-label">Poste:</span> <strong>Femme de chambre</strong></p>
              <p><span className="doc-label">Mois:</span> <strong>{MONTHS_FR[month - 1]} {year}</strong></p>
            </div>
            <table className="doc-table att-table">
              <thead>
                <tr>
                  <th className="att-col-day">Jour</th>
                  <th className="att-col-date">Date</th>
                  <th className="att-col-time">Arrivée</th>
                  <th className="att-col-time">Départ</th>
                  <th className="att-col-sign">Signature</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: lastDay }).map((_, i) => {
                  const day = i + 1
                  const weekday = new Date(year, month - 1, day).getDay()
                  return (
                    <tr key={day}>
                      <td className="att-col-day">{DAY_NAMES_FR[weekday]}</td>
                      <td className="att-col-date">{day} {MONTHS_FR[month - 1].slice(0, 4).toLowerCase()}.</td>
                      <td></td>
                      <td></td>
                      <td></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className="doc-legend">
              <span>Total heures prévues: <strong>{stats[name]?.hours ?? 0} h</strong> ({stats[name]?.shifts ?? 0} services)</span>
              <span>Signature du responsable: ______________________</span>
            </div>
            <p className="doc-note">Par ma signature, je confirme ma présence au travail pour les jours indiqués.</p>
          </div>
        ))}
      </div>

      <style jsx global>{`
        /* Print-only sheets are hidden on screen */
        .attendance-print { display: none; }
        .schedule-print { display: none; }
        .schedule-color-print { display: none; }

        @media print {
          @page { size: portrait; margin: 12mm; }
          body { background: #fff !important; }
          .no-print { display: none !important; }

          /* ===== Shared document style (matches Salary Receipt) ===== */
          .doc-page { color: #111; font-family: Georgia, 'Times New Roman', serif; }
          .doc-header { text-align: center; border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 4px; }
          .doc-logo { display: block; margin: 0 auto; height: 56px; width: auto; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .doc-brand { font-size: 24px; font-weight: 700; letter-spacing: 1px; margin: 0; }
          .doc-location { font-size: 12px; font-style: italic; color: #333; margin: 2px 0 0; }
          .doc-title-block { text-align: center; border-bottom: 1px solid #111; padding-bottom: 10px; margin-bottom: 14px; }
          .doc-title { font-size: 18px; font-weight: 700; letter-spacing: 1px; margin: 12px 0 0; }
          .doc-subtitle { font-size: 12px; color: #777; margin: 3px 0 0; }
          .doc-fields { font-size: 13px; line-height: 1.7; margin-bottom: 14px; }
          .doc-fields p { margin: 0; }
          .doc-label { display: inline-block; min-width: 170px; }
          .doc-table { width: 100%; border-collapse: collapse; font-size: 12px; }
          .doc-table th, .doc-table td { border: 1px solid #999; padding: 4px 8px; height: 22px; }
          .doc-table th { background: #f8f5ef !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-size: 11px; }
          .doc-legend { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 16px; font-size: 12px; margin-top: 12px; }
          .doc-note { font-size: 11px; color: #333; margin: 2px 0 0; }

          /* ===== Printing the schedule ===== */
          body.printing-schedule * { visibility: hidden; }
          body.printing-schedule .schedule-print,
          body.printing-schedule .schedule-print * { visibility: visible; }
          body.printing-schedule .schedule-print {
            display: flex !important; flex-direction: column;
            position: absolute; left: 0; top: 0; width: 100%;
            height: 248mm; box-sizing: border-box; overflow: hidden;
          }
          .schedule-print .doc-page { display: flex; flex-direction: column; flex: 1 1 auto; height: 100%; min-height: 0; }
          .sched-table th, .sched-table td { text-align: center; vertical-align: middle; }
          .sched-table { font-size: 11px; flex: 1 1 auto; height: 100%; }
          .sched-table th { font-size: 10px; }
          .sched-table td, .sched-table th { padding: 2px 5px; line-height: 1.2; }
          .schedule-print .doc-header { padding-bottom: 6px; margin-bottom: 4px; flex: 0 0 auto; }
          .schedule-print .doc-logo { height: 48px; }
          .schedule-print .doc-title-block { margin-bottom: 6px; padding-bottom: 6px; flex: 0 0 auto; }
          .schedule-print .doc-title { font-size: 17px; margin: 6px 0 0; }
          .schedule-print .doc-fields { margin-bottom: 6px; line-height: 1.4; font-size: 13px; flex: 0 0 auto; }
          .schedule-print .doc-legend { margin-top: 8px; font-size: 11px; flex: 0 0 auto; }
          .sched-col-day { width: 9%; }
          .sched-col-date { width: 15%; text-align: left !important; }
          .sched-off { color: #aaa; }
          .sched-total-row td { font-weight: 700; background: #f8f5ef !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .sched-total-label { text-align: right !important; }
          .sched-total-val { text-align: center; }

          /* ===== Printing the color schedule (looks like screen, colored shifts) ===== */
          body.printing-schedule-color * { visibility: hidden; }
          body.printing-schedule-color .schedule-color-print,
          body.printing-schedule-color .schedule-color-print * { visibility: visible; }
          body.printing-schedule-color .schedule-color-print {
            display: flex !important; flex-direction: column;
            position: absolute; left: 0; top: 0; width: 100%;
            box-sizing: border-box;
          }
          .schedule-color-print .doc-header { text-align: center; border-bottom: 2px solid #111; padding-bottom: 6px; margin-bottom: 4px; }
          .schedule-color-print .doc-logo { display: block; margin: 0 auto; height: 48px; width: auto; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .schedule-color-print .doc-location { font-size: 12px; font-style: italic; color: #333; margin: 2px 0 0; }
          .schedule-color-print .doc-title-block { text-align: center; border-bottom: 1px solid #111; padding-bottom: 6px; margin-bottom: 6px; }
          .schedule-color-print .doc-title { font-size: 17px; font-weight: 700; letter-spacing: 1px; margin: 6px 0 0; color: #111; }
          .schedule-color-print .doc-subtitle { font-size: 12px; color: #777; margin: 2px 0 0; }
          .schedule-color-print table { width: 100%; border-collapse: collapse; font-size: 11px; color: #111; font-family: Georgia, 'Times New Roman', serif; }
          .schedule-color-print th, .schedule-color-print td { border: 1px solid #bbb; padding: 3px 6px; line-height: 1.25; text-align: center; vertical-align: middle; }
          .schedule-color-print th { background: #f8f5ef !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-size: 10px; text-transform: uppercase; letter-spacing: .5px; }
          .schedule-color-print .sc-day, .schedule-color-print .sc-date { text-align: left; color: #333; }
          .schedule-color-print .sc-cell { font-weight: 600; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .schedule-color-print .sc-morning { background: #f3e7d8 !important; color: #785224 !important; }
          .schedule-color-print .sc-afternoon { background: #e5f3f8 !important; color: #28708d !important; }
          .schedule-color-print .sc-off { color: #aaa !important; }
          .schedule-color-print .sc-leave { background: #f0e0da !important; color: #975b45 !important; }
          .schedule-color-print .sc-leave small { display: block; font-weight: 400; font-size: 9px; opacity: .75; }
          .schedule-color-print .sc-total td { font-weight: 700; background: #f8f5ef !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .schedule-color-print .sc-legend { display: flex; gap: 18px; flex-wrap: wrap; font-size: 11px; margin-top: 10px; }
          .schedule-color-print .sc-legend .lg { display: inline-flex; align-items: center; gap: 5px; }
          .schedule-color-print .sc-legend .sw { display: inline-block; width: 11px; height: 11px; border-radius: 2px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

          /* ===== Printing the attendance sheets ===== */
          body.printing-attendance * { visibility: hidden; }
          body.printing-attendance .attendance-print,
          body.printing-attendance .attendance-print * { visibility: visible; }
          body.printing-attendance .attendance-print {
            display: block !important;
            position: absolute; left: 0; top: 0; width: 100%;
          }
          .attendance-page {
            page-break-after: always;
            break-after: page;
            height: 248mm; box-sizing: border-box;
            display: flex; flex-direction: column; overflow: hidden;
          }
          .attendance-page:last-child { page-break-after: auto; break-after: auto; }
          .att-table th, .att-table td { text-align: left; vertical-align: middle; }
          .att-table { font-size: 11px; flex: 1 1 auto; }
          .att-table th { font-size: 10px; }
          .att-table td, .att-table th { padding: 0 8px; line-height: 1.25; }
          .attendance-page .doc-header { flex: 0 0 auto; }
          .attendance-page .doc-title-block { margin-bottom: 5px; flex: 0 0 auto; }
          .attendance-page .doc-fields { margin-bottom: 5px; line-height: 1.4; flex: 0 0 auto; }
          .attendance-page .doc-legend { margin-top: 6px; flex: 0 0 auto; }
          .attendance-page .doc-note { flex: 0 0 auto; }
          .att-col-day { width: 9%; text-align: center; }
          .att-col-date { width: 15%; }
          .att-col-time { width: 18%; }
          .att-col-sign { width: 40%; }
        }
      `}</style>
    </div>
  )
}
