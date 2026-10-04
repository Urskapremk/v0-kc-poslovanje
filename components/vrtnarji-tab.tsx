'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { themeFor, PILL, SWATCH } from '@/lib/schedule-theme'
import useSWR from 'swr'
import { Calendar, Printer, Info, FileText, ChevronDown } from 'lucide-react'
import {
  GARDENERS,
  POST_LABELS,
  POST_LABELS_FR,
  hoursForPost,
  generateGardenerSchedule,
  computeGardenerStats,
  type GardenPost,
} from '@/lib/gardening'
import { getLeaveRequests } from '@/app/actions/leave'
import { getAllStaffMembers } from '@/app/actions/statistics'
import { employedOn, endDatesFor, keptInMonth } from '@/lib/employment'
import { defaultPrintFrom, printAfterDialog, printStartDay, printWithClass } from '@/lib/print-from'
import { PrintFromDialog } from '@/components/print-from-dialog'
import { leaveDaysForStaff, LEAVE_TYPES, type LeaveType } from '@/lib/leave'
import { getHolidayName, isSunday } from '@/lib/holidays'
import { summarizeMonthHours, type HoursBreakdown } from '@/lib/work-hours'
import { HoursBreakdownLines } from '@/components/hours-breakdown-lines'

const MONTHS = [
  'Januar', 'Februar', 'Marec', 'April', 'Maj', 'Junij',
  'Julij', 'Avgust', 'September', 'Oktober', 'November', 'December',
]
const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]
const DAY_NAMES = ['Ned', 'Pon', 'Tor', 'Sre', 'Čet', 'Pet', 'Sob']
const DAY_NAMES_FR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

export default function VrtnarjiTab({
  year,
  month,
  readOnly = false,
}: {
  year: number
  month: number
  // View-only mode: hides the tools block (printing and payroll hour cards).
  readOnly?: boolean
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'staff' | 'shift'>('staff')
  // Editing tools collapsed by default — the phone view only needs the table.
  const [showTools, setShowTools] = useState(false)
  // Never open the tools block in view-only mode.
  const toolsVisible = showTools && !readOnly
  // Per-person collapse for the hours breakdown (see razpored-tab for the same pattern).
  const [hiddenHours, setHiddenHours] = useState<Record<string, boolean>>({})
  const [printFrom, setPrintFrom] = useState(() => defaultPrintFrom(year, month))
  const [printAsk, setPrintAsk] = useState<null | 'gardeners' | 'gardeners-screen'>(null)
  const printStart = printStartDay(printFrom, year, month)
  const toggleHours = (name: string) => setHiddenHours((prev) => ({ ...prev, [name]: !prev[name] }))

  const { data: staffMembers } = useSWR('all-staff-members', getAllStaffMembers)
  const endByName = useMemo(() => endDatesFor(GARDENERS, staffMembers ?? []), [staffMembers])
  const roster = useMemo(() => keptInMonth(GARDENERS, endByName, year, month), [endByName, year, month])
  const schedule = useMemo(() => generateGardenerSchedule(year, month), [year, month])
  const stats = useMemo(() => computeGardenerStats(schedule), [schedule])
  const printStats = useMemo(
    () => computeGardenerStats(schedule.filter((day) => day.date >= printFrom)),
    [schedule, printFrom],
  )
  const lastDay = schedule.length

  const { data: leaves } = useSWR(['leave', 'gardener'], () => getLeaveRequests('gardener'))
  const leaveByStaff = useMemo(() => {
    const map: Record<string, ReturnType<typeof leaveDaysForStaff>> = {}
    for (const g of GARDENERS) map[g] = leaveDaysForStaff(leaves ?? [], g, year, month)
    return map
  }, [leaves, year, month])

  // Per-gardener monthly breakdown: regular / Sunday / holiday work + leave.
  const breakdowns = useMemo(() => {
    const map: Record<string, HoursBreakdown> = {}
    for (const g of roster) {
      const entries = schedule.map((day, i) => {
        const away = !employedOn(endByName[g], day.date)
        const post = away ? null : ((day.assignments[g] || 'OFF') as GardenPost)
        const worked = !!post && post !== 'OFF' && post !== 'RESERVE'
        return { day: i + 1, hours: worked ? hoursForPost(post) : 0, onLeave: !away && !!leaveByStaff[g]?.[i + 1] }
      })
      map[g] = summarizeMonthHours(year, month, entries)
    }
    return map
  }, [schedule, roster, leaveByStaff, year, month, endByName])

  const visibleGardeners = roster.filter((g) => !selected || g === selected)

  // Sand table for Borut's read-only view, original navy for editing.
  const t = themeFor(readOnly)
  const pill = readOnly ? PILL.sand : PILL.navy
  const swatch = readOnly ? SWATCH.sand : SWATCH.navy

  // Open the schedule on today's row instead of at the 1st of the month. Local
  // date parts on purpose — toISOString would shift the day in our timezone.
  const nowDate = new Date()
  const todayDay =
    nowDate.getFullYear() === year && nowDate.getMonth() + 1 === month ? nowDate.getDate() : null
  const todayRowRef = useRef<HTMLTableRowElement | null>(null)
  useEffect(() => {
    const row = todayRowRef.current
    if (!row) return
    row.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [schedule, selected, todayDay])

  function printDoc(target: 'gardeners' | 'gardeners-attendance' | 'gardeners-screen') {
    const sheet = target === 'gardeners' ? '.gardeners-print' : target === 'gardeners-screen' ? '.gardeners-color-print' : '.gardeners-att-print'
    printWithClass(`printing-${target}`, sheet)
  }

  function askPrint(target: 'gardeners' | 'gardeners-screen') {
    setPrintFrom(defaultPrintFrom(year, month))
    setPrintAsk(target)
  }

  function confirmPrint() {
    const target = printAsk
    if (!target) return
    setPrintAsk(null)
    printAfterDialog(() => printDoc(target))
  }

  return (
    <div className="space-y-4">
      <style>{`
        @media print {
          @page { size: portrait; margin: 12mm; }
          /* Hide the on-screen UI completely (display:none so it takes no space) */
          body.printing-gardeners .no-print,
          body.printing-gardeners .gardeners-screen,
          body.printing-gardeners-attendance .no-print,
          body.printing-gardeners-attendance .gardeners-screen,
          body.printing-gardeners-screen .no-print,
          body.printing-gardeners-screen .gardeners-screen { display: none !important; }

          /* ===== Color schedule (looks like screen, white paper, colored posts) ===== */
          body.printing-gardeners-screen * { visibility: hidden; }
          body.printing-gardeners-screen .gardeners-color-print,
          body.printing-gardeners-screen .gardeners-color-print * { visibility: visible; }
          body.printing-gardeners-screen .gardeners-color-print {
            display: flex !important; flex-direction: column;
            position: absolute; left: 0; top: 0; width: 100%;
            box-sizing: border-box;
          }
          .gardeners-color-print .doc-header { text-align: center; border-bottom: 2px solid #111; padding-bottom: 6px; margin-bottom: 4px; }
          .gardeners-color-print .doc-logo { display: block; margin: 0 auto; height: 48px; width: auto; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .gardeners-color-print .doc-location { font-size: 12px; font-style: italic; color: #333; margin: 2px 0 0; }
          .gardeners-color-print .doc-title-block { text-align: center; border-bottom: 1px solid #111; padding-bottom: 6px; margin-bottom: 6px; }
          .gardeners-color-print .doc-title { font-size: 17px; font-weight: 700; letter-spacing: 1px; margin: 6px 0 0; color: #111; }
          .gardeners-color-print .doc-subtitle { font-size: 12px; color: #777; margin: 2px 0 0; }
          .gardeners-color-print table { width: 100%; border-collapse: collapse; font-size: 11px; color: #111; font-family: Georgia, 'Times New Roman', serif; }
          .gardeners-color-print th, .gardeners-color-print td { border: 1px solid #bbb; padding: 3px 6px; line-height: 1.25; text-align: center; vertical-align: middle; }
          .gardeners-color-print th { background: #f8f5ef !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-size: 10px; text-transform: uppercase; letter-spacing: .5px; }
          .gardeners-color-print .gc-day, .gardeners-color-print .gc-date { text-align: left; color: #333; }
          .gardeners-color-print .gc-cell { font-weight: 600; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .gardeners-color-print .gc-beach { background: #e5f3f8 !important; color: #28708d !important; }
          .gardeners-color-print .gc-garden { background: #e3ece4 !important; color: #38613c !important; }
          .gardeners-color-print .gc-reserve { background: #f1f0ef !important; color: #555 !important; }
          .gardeners-color-print .gc-off { color: #aaa !important; }
          .gardeners-color-print .gc-leave { background: #f0e0da !important; color: #975b45 !important; }
          .gardeners-color-print .gc-leave small { display: block; font-weight: 400; font-size: 9px; opacity: .75; }
          .gardeners-color-print .g-total td { font-weight: 700; background: #f8f5ef !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .gardeners-color-print .doc-legend { display: flex; gap: 18px; flex-wrap: wrap; font-size: 11px; margin-top: 10px; }
          .gardeners-color-print .doc-legend .lg { display: inline-flex; align-items: center; gap: 5px; }
          .gardeners-color-print .doc-legend .sw { display: inline-block; width: 11px; height: 11px; border-radius: 2px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          body.printing-gardeners * { visibility: hidden; }
          body.printing-gardeners .gardeners-print,
          body.printing-gardeners .gardeners-print * { visibility: visible; }
          body.printing-gardeners .gardeners-print {
            display: flex !important; flex-direction: column;
            position: absolute; left: 0; top: 0; width: 100%;
            height: 248mm; box-sizing: border-box; overflow: hidden;
          }
          .gardeners-print .doc-header { text-align: center; border-bottom: 2px solid #111; padding-bottom: 6px; margin-bottom: 4px; flex: 0 0 auto; }
          .gardeners-print .doc-logo { display: block; margin: 0 auto; height: 48px; width: auto; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .gardeners-print .doc-brand { font-size: 24px; font-weight: 700; letter-spacing: 1px; margin: 0; }
          .gardeners-print .doc-location { font-size: 12px; font-style: italic; color: #333; margin: 2px 0 0; }
          .gardeners-print .doc-title-block { text-align: center; border-bottom: 1px solid #111; padding-bottom: 6px; margin-bottom: 6px; flex: 0 0 auto; }
          .gardeners-print .doc-title { font-size: 17px; font-weight: 700; letter-spacing: 1px; margin: 6px 0 0; }
          .gardeners-print .doc-subtitle { font-size: 12px; color: #777; margin: 2px 0 0; }
          .gardeners-print .doc-fields { font-size: 13px; line-height: 1.4; margin-bottom: 6px; flex: 0 0 auto; }
          .gardeners-print .doc-fields p { margin: 0; }
          .gardeners-print table { width: 100%; border-collapse: collapse; font-size: 11px; color: #111; font-family: Georgia, 'Times New Roman', serif; flex: 1 1 auto; height: 100%; }
          .gardeners-print th, .gardeners-print td { border: 1px solid #999; padding: 2px 5px; line-height: 1.2; text-align: center; vertical-align: middle; }
          .gardeners-print th { background: #f8f5ef !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-size: 10px; }
          .gardeners-print .g-day { text-align: left; }
          .gardeners-print .g-total td { font-weight: 700; background: #f8f5ef !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .gardeners-print .doc-legend { font-size: 11px; margin-top: 8px; flex: 0 0 auto; }

          /* ===== Attendance sheets (one page per gardener) ===== */
          body.printing-gardeners-attendance * { visibility: hidden; }
          body.printing-gardeners-attendance .gardeners-att-print,
          body.printing-gardeners-attendance .gardeners-att-print * { visibility: visible; }
          body.printing-gardeners-attendance .gardeners-att-print {
            display: block !important;
            position: absolute; left: 0; top: 0; width: 100%;
          }
          .gardeners-att-print .att-page { page-break-after: always; break-after: page; color: #111; font-family: Georgia, 'Times New Roman', serif; height: 248mm; box-sizing: border-box; display: flex; flex-direction: column; overflow: hidden; }
          .gardeners-att-print .att-page:last-child { page-break-after: auto; break-after: auto; }
          .gardeners-att-print .doc-header { text-align: center; border-bottom: 2px solid #111; padding-bottom: 4px; margin-bottom: 4px; flex: 0 0 auto; }
          .gardeners-att-print .doc-logo { display: block; margin: 0 auto; height: 40px; width: auto; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .gardeners-att-print .doc-brand { font-size: 22px; font-weight: 700; letter-spacing: 1px; margin: 0; }
          .gardeners-att-print .doc-location { font-size: 11px; font-style: italic; color: #333; margin: 1px 0 0; }
          .gardeners-att-print .doc-title-block { text-align: center; border-bottom: 1px solid #111; padding-bottom: 4px; margin-bottom: 5px; flex: 0 0 auto; }
          .gardeners-att-print .doc-title { font-size: 16px; font-weight: 700; letter-spacing: 1px; margin: 4px 0 0; }
          .gardeners-att-print .doc-subtitle { font-size: 11px; color: #777; margin: 2px 0 0; }
          .gardeners-att-print .doc-fields { font-size: 12px; line-height: 1.4; margin-bottom: 5px; flex: 0 0 auto; }
          .gardeners-att-print .doc-fields p { margin: 0; }
          .gardeners-att-print .doc-label { display: inline-block; min-width: 150px; }
          .gardeners-att-print table { width: 100%; border-collapse: collapse; font-size: 11px; color: #111; flex: 1 1 auto; }
          .gardeners-att-print th, .gardeners-att-print td { border: 1px solid #999; padding: 0 8px; line-height: 1.25; text-align: center; vertical-align: middle; }
          .gardeners-att-print th { background: #f8f5ef !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-size: 10px; }
          .gardeners-att-print .att-col-day, .gardeners-att-print .att-col-date { text-align: left; }
          .gardeners-att-print .doc-legend { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 12px; font-size: 11px; margin-top: 6px; flex: 0 0 auto; }
          .gardeners-att-print .doc-note { font-size: 10px; color: #333; margin: 3px 0 0; flex: 0 0 auto; }
        }
      `}</style>

      {/* Header — the title row stays, everything else collapses. */}
      <div className="no-print rounded-2xl bg-white/[0.03] border border-white/10">
        <button
          type="button"
          onClick={readOnly ? undefined : () => setShowTools((v) => !v)}
          aria-expanded={readOnly ? undefined : showTools}
          title={readOnly ? undefined : showTools ? 'Skrij orodja' : 'Prikaži orodja'}
          className={`w-full flex items-center justify-between gap-3 p-4 text-left ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}
        >
          <div>
            <h2 className="text-lg font-bold text-[#8fae92] flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Razpored vrtnarjev
            </h2>
            <p className="text-white/40 text-sm">{MONTHS[month - 1]} {year} · {roster.join(', ')}</p>
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
            onClick={() => askPrint('gardeners-screen')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#8fae92]/20 text-[#8fae92] border border-[#8fae92]/30 hover:bg-[#8fae92]/30 transition-colors text-sm font-medium"
          >
            <Printer className="h-4 w-4" />
            Natisni razpored (barvno)
          </button>
          <button
            onClick={() => askPrint('gardeners')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#7fa8b8]/20 text-[#7fa8b8] border border-[#7fa8b8]/30 hover:bg-[#7fa8b8]/30 transition-colors text-sm font-medium"
          >
            <Printer className="h-4 w-4" />
            Natisni razpored (FR)
          </button>
          <button
            onClick={() => printDoc('gardeners-attendance')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#c59b5b]/20 text-[#c59b5b] border border-[#c59b5b]/30 hover:bg-[#c59b5b]/30 transition-colors text-sm font-medium"
          >
            <FileText className="h-4 w-4" />
            Natisni evidenco prisotnosti (FR)
          </button>
        </div>
        )}
      </div>

      <PrintFromDialog
        open={printAsk !== null}
        year={year}
        month={month}
        value={printFrom}
        person={selected}
        onChange={setPrintFrom}
        onCancel={() => setPrintAsk(null)}
        onPrint={confirmPrint}
      />

      {/* Draft notice */}
      {toolsVisible && (
      <div className="no-print flex items-start gap-2 rounded-xl border border-[#c59b5b]/30 bg-[#c59b5b]/10 px-3 py-2 text-xs text-[#c59b5b]">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <span>
          Osnutek: razpored se samodejno izračuna po pravilih (6 dni delo / 1 prost, tedenska rotacija mest, KD pokriva prostega kot rezerva).
          Še se ne shranjuje in ni urejljiv — ko potrdiš logiko, dodava shranjevanje in ročno urejanje kot pri sobaricah.
        </span>
      </div>
      )}

      {/* Legend / filter — always visible, it is how you pick one person's schedule. */}
      <div className="no-print flex flex-wrap items-center gap-2 text-xs">
        {roster.map((g) => {
          const active = selected === g
          return (
            <button
              key={g}
              type="button"
              onClick={() => setSelected(active ? null : g)}
              className={`px-3 py-1.5 rounded-lg border transition-all ${
                active
                  ? 'bg-[#8fae92]/20 text-[#8fae92] border-[#8fae92]/40'
                  : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'
              } ${selected && !active ? 'opacity-40' : ''}`}
            >
              {g}
            </button>
          )
        })}
        {selected && (
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="px-3 py-1.5 rounded-lg border border-white/15 text-white/50 hover:text-white hover:bg-white/5 transition-colors"
          >
            Pokaži vse
          </button>
        )}
      </div>

      {/* Hours summary — respects the selected gardener, like the tables below. */}
      {toolsVisible && (
      <div className="no-print grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 items-start">
        {visibleGardeners.map((g) => {
          const s = stats[g]
          return (
            <button
              key={g}
              type="button"
              onClick={() => toggleHours(g)}
              aria-expanded={!hiddenHours[g]}
              title={hiddenHours[g] ? 'Pokaži razčlenitev ur' : 'Skrij razčlenitev ur'}
              className="w-full cursor-pointer rounded-2xl border border-[#8fae92]/20 bg-[#8fae92]/5 p-4 text-left transition-colors"
            >
              <div className="font-semibold text-[#8fae92] mb-1">{g}</div>
              <div className="text-2xl font-bold text-[#8fae92]">{breakdowns[g]?.totalHours ?? s.hours} <span className="text-sm font-medium opacity-70">ur</span></div>
              <div className="text-xs text-white/40 mt-1">{(breakdowns[g] ? breakdowns[g].regularDays + breakdowns[g].sundayDays + breakdowns[g].holidayDays : s.shifts)} izmen × 6 ur</div>
              {s.reserve > 0 && <div className="text-[11px] text-white/30 mt-0.5">+ {s.reserve} dni rezerva</div>}
              {breakdowns[g] && !hiddenHours[g] && <HoursBreakdownLines b={breakdowns[g]} />}
            </button>
          )
        })}
      </div>
      )}

      {/* On-screen schedule table */}
      <div className={`no-print rounded-2xl border p-3 sm:p-4 overflow-x-auto ${t.card}`}>
        <div className={`no-print flex flex-wrap items-center gap-4 mb-3 text-xs ${t.legend}`}>
          <span className="flex items-center gap-1.5">
            <span className={`inline-block h-3 w-3 rounded-sm border ${swatch.blue}`} />
            Plaža
          </span>
          <span className="flex items-center gap-1.5">
            <span className={`inline-block h-3 w-3 rounded-sm border ${swatch.sage}`} />
            Vrt
          </span>
          <span className="flex items-center gap-1.5">
            <span className={`inline-block h-3 w-3 rounded-sm border ${swatch.neutral}`} />
            Rezerva
          </span>
          <span className="flex items-center gap-1.5">
            <span className={`inline-block h-3 w-3 rounded-sm border ${swatch.terracotta}`} />
            Dopust
          </span>
        </div>
        <div className="no-print mb-3 flex flex-wrap gap-2 text-xs">
          {([
            ['staff', 'Po osebah'],
            ['shift', 'Po smenah (pari)'],
          ] as const).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              aria-pressed={viewMode === mode}
              className={`rounded-lg border px-3 py-1.5 font-medium transition-colors ${
                viewMode === mode
                  ? 'border-[#8fae92]/40 bg-[#8fae92]/20 text-[#8fae92]'
                  : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {viewMode === 'shift' && (
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className={`text-xs uppercase tracking-wider ${t.head}`}>
                <th className="text-left py-2 px-2 font-semibold">Dan</th>
                <th className="text-left py-2 px-2 font-semibold">Datum</th>
                <th className="text-left py-2 px-2 font-semibold">Plaža dopoldne</th>
                <th className="text-left py-2 px-2 font-semibold">Plaža popoldne</th>
                <th className="text-left py-2 px-2 font-semibold">Vrt dopoldne</th>
                <th className="text-left py-2 px-2 font-semibold">Vrt popoldne</th>
                <th className="text-left py-2 px-2 font-semibold">Rezerva</th>
                <th className="text-left py-2 px-2 font-semibold">Prosto</th>
              </tr>
            </thead>
            <tbody>
              {schedule.map((day, i) => {
                const dayNum = i + 1
                const weekday = new Date(year, month - 1, dayNum).getDay()
                const holiday = getHolidayName(year, month, dayNum)
                const sunday = isSunday(year, month, dayNum)
                const isToday = todayDay === dayNum
                const groups: Record<GardenPost, string[]> = {
                  BEACH_AM: [], BEACH_PM: [], GARDEN_AM: [], GARDEN_PM: [], RESERVE: [], OFF: [],
                }
                for (const g of roster) {
                  if (!employedOn(endByName[g], day.date)) continue
                  groups[(day.assignments[g] || 'OFF') as GardenPost].push(g)
                }
                const cell = (post: GardenPost) => {
                  const names = groups[post]
                  if (names.length === 0) return <span className={t.offText}>—</span>
                  const cls =
                    post === 'OFF' ? t.offText
                    : post === 'RESERVE' ? pill.neutral
                    : post === 'BEACH_AM' || post === 'BEACH_PM' ? pill.blue
                    : pill.sage
                  return (
                    <div className="flex flex-wrap gap-1">
                      {names.map((g) => {
                        const leave = leaveByStaff[g]?.[dayNum]
                        return (
                          <span key={g} className={`inline-block rounded-md px-2 py-0.5 text-xs ${leave ? `border ${t.leaveBadge}` : cls}`}>
                            {g}{leave ? ' (dopust)' : ''}
                          </span>
                        )
                      })}
                    </div>
                  )
                }
                return (
                  <tr
                    key={day.date}
                    ref={isToday ? todayRowRef : undefined}
                    className={`border-t ${t.rowBorder} ${holiday ? t.holidayRow : sunday ? t.sundayRow : ''}`}
                  >
                    <td className={`py-1.5 px-2 ${isToday ? `border-l-[3px] ${t.todayBar}` : ''} ${sunday || holiday ? `${t.dayAccent} font-semibold` : t.dayMuted}`}>{DAY_NAMES[weekday]}</td>
                    <td className={`py-1.5 px-2 tabular-nums ${t.dateText}`}>
                      <div className="flex flex-col gap-0.5">
                        <span>{dayNum}. {MONTHS[month - 1].slice(0, 3).toLowerCase()}</span>
                        {holiday && <span className={`text-[10px] font-medium ${t.sundayLabel}`}>{holiday}</span>}
                        {isToday && <span className={`text-[9px] font-semibold uppercase tracking-[0.18em] ${t.todayLabel}`}>Danes</span>}
                      </div>
                    </td>
                    <td className="py-1.5 px-2">{cell('BEACH_AM')}</td>
                    <td className="py-1.5 px-2">{cell('BEACH_PM')}</td>
                    <td className="py-1.5 px-2">{cell('GARDEN_AM')}</td>
                    <td className="py-1.5 px-2">{cell('GARDEN_PM')}</td>
                    <td className="py-1.5 px-2">{cell('RESERVE')}</td>
                    <td className="py-1.5 px-2">{cell('OFF')}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        {/* Drop the width floor when one person is selected (see razpored-tab). */}
        {viewMode === 'staff' && (
        <table className={`w-full border-collapse text-sm ${selected ? '' : 'min-w-[640px]'}`}>
          <thead>
            <tr className={`text-xs uppercase tracking-wider ${t.head}`}>
              <th className="text-left py-2 px-2 font-semibold">Dan</th>
              <th className="text-left py-2 px-2 font-semibold">Datum</th>
              {visibleGardeners.map((g) => (
                <th key={g} className="text-left py-2 px-2 font-semibold">{g}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {schedule.map((day, i) => {
                  const dayNum = i + 1
                  const weekday = new Date(year, month - 1, dayNum).getDay()
                  const holiday = getHolidayName(year, month, dayNum)
                  const sunday = isSunday(year, month, dayNum)
                  const isToday = todayDay === dayNum
                  return (
                    // Today keeps the Sunday/holiday background (those carry pay
                    // meaning) and is marked with a gold bar plus a DANES label.
                    <tr
                      key={day.date}
                      ref={isToday ? todayRowRef : undefined}
                      className={`border-t ${t.rowBorder} ${holiday ? t.holidayRow : sunday ? t.sundayRow : ''}`}
                    >
                      <td className={`py-1.5 px-2 ${isToday ? `border-l-[3px] ${t.todayBar}` : ''} ${sunday || holiday ? `${t.dayAccent} font-semibold` : t.dayMuted}`}>{DAY_NAMES[weekday]}</td>
                      <td className={`py-1.5 px-2 tabular-nums ${t.dateText}`}>
                        <div className="flex flex-col gap-0.5">
                          <span>{dayNum}. {MONTHS[month - 1].slice(0, 3).toLowerCase()}</span>
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
                  {visibleGardeners.map((g) => {
                    if (!employedOn(endByName[g], day.date)) {
                      return <td key={g} className="py-1.5 px-2 text-white/25">—</td>
                    }
                    const post = (day.assignments[g] || 'OFF') as GardenPost
                    const isOff = post === 'OFF'
                    const isReserve = post === 'RESERVE'
                    const isBeach = post === 'BEACH_AM' || post === 'BEACH_PM'
                    const isGarden = post === 'GARDEN_AM' || post === 'GARDEN_PM'
                    const leave = leaveByStaff[g]?.[dayNum]
                    return (
                      <td key={g} className="py-1.5 px-2">
                        {leave ? (
                          <span
                            className={`inline-flex flex-col gap-0.5 rounded-md border px-2 py-0.5 text-xs ${t.leaveBadge}`}
                            title={LEAVE_TYPES[leave.type as LeaveType]?.sl}
                          >
                            <span className="font-semibold">DOPUST</span>
                            <span className="text-[10px] opacity-70">{POST_LABELS[post]}</span>
                          </span>
                        ) : (
                          <span
                            className={`inline-block rounded-md px-2 py-0.5 text-xs ${
                              isOff
                                ? t.offText
                                : isReserve
                                  ? pill.neutral
                                  : isBeach
                                    ? pill.blue
                                    : pill.sage
                            }`}
                          >
                            {POST_LABELS[post]}
                          </span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
        )}
      </div>

      {/* Hidden color print sheet — same layout as screen, white paper, colored posts */}
      <div className="gardeners-color-print" aria-hidden="true" style={{ display: 'none' }}>
        <div className="doc-header">
          <img className="doc-logo" src="/images/komba-logo-color.png" alt="Komba Cabana" />
          <p className="doc-location">Nosy Komba, Madagascar</p>
        </div>
        <div className="doc-title-block">
          <h2 className="doc-title">RAZPORED VRTNARJEV</h2>
          <p className="doc-subtitle">{MONTHS[month - 1]} {year}{printStart ? ` · od ${printStart}. ${MONTHS[month - 1].toLowerCase()}` : ''}{selected ? ` · ${selected}` : ''}</p>
        </div>
        <table>
          <thead>
            <tr>
              <th className="gc-day">Dan</th>
              <th className="gc-date">Datum</th>
              {visibleGardeners.map((g) => (
                <th key={g}>{g}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {schedule.map((day, i) => {
              if (day.date < printFrom) return null
              const dayNum = i + 1
              const weekday = new Date(year, month - 1, dayNum).getDay()
              const holiday = getHolidayName(year, month, dayNum)
              const sunday = isSunday(year, month, dayNum)
              return (
                <tr key={day.date} style={holiday ? { background: '#f7ece8' } : sunday ? { background: '#ecf6fa' } : undefined}>
                  <td className="gc-day" style={sunday || holiday ? { color: '#a56650', fontWeight: 700 } : undefined}>{DAY_NAMES[weekday]}</td>
                  <td className="gc-date">
                    {dayNum}. {MONTHS[month - 1].slice(0, 3).toLowerCase()}
                    {holiday && <small style={{ display: 'block', color: '#a56650', fontWeight: 600 }}>{holiday}</small>}
                    {!holiday && sunday && <small style={{ display: 'block', color: '#28708d' }}>Dimanche</small>}
                  </td>
                  {visibleGardeners.map((g) => {
                    if (!employedOn(endByName[g], day.date)) return <td key={g} className="gc-cell" />
                    const post = (day.assignments[g] || 'OFF') as GardenPost
                    const leave = leaveByStaff[g]?.[dayNum]
                    if (leave) {
                      return (
                        <td key={g} className="gc-cell gc-leave">
                          DOPUST
                          <small>{POST_LABELS[post]}</small>
                        </td>
                      )
                    }
                    const isBeach = post === 'BEACH_AM' || post === 'BEACH_PM'
                    const isGarden = post === 'GARDEN_AM' || post === 'GARDEN_PM'
                    const cls = post === 'OFF'
                      ? 'gc-off'
                      : post === 'RESERVE'
                        ? 'gc-reserve'
                        : isBeach
                          ? 'gc-beach'
                          : isGarden
                            ? 'gc-garden'
                            : 'gc-off'
                    return <td key={g} className={`gc-cell ${cls}`}>{POST_LABELS[post]}</td>
                  })}
                </tr>
              )
            })}
            <tr className="g-total">
              <td colSpan={2} style={{ textAlign: 'right' }}>Skupaj ur</td>
              {visibleGardeners.map((g) => (
                <td key={g}>{printStats[g]?.hours ?? 0} h</td>
              ))}
            </tr>
          </tbody>
        </table>
        <div className="doc-legend">
          <span className="lg"><span className="sw" style={{ background: '#e5f3f8', border: '1px solid #28708d' }} /> Plaža</span>
          <span className="lg"><span className="sw" style={{ background: '#e3ece4', border: '1px solid #38613c' }} /> Vrt</span>
          <span className="lg"><span className="sw" style={{ background: '#f1f0ef', border: '1px solid #555' }} /> Rezerva</span>
                  <span className="lg"><span className="sw" style={{ background: '#f0e0da', border: '1px solid #975b45' }} /> Dopust</span>
                  <span className="lg"><span className="sw" style={{ background: '#fff', border: '1px solid #aaa' }} /> Prosto</span>
                  <span className="lg"><span className="sw" style={{ background: '#f7ece8', border: '1px solid #a56650' }} /> Jour férié / Dimanche</span>
                </div>
      </div>

      {/* Hidden French print sheet (no colors) */}
      <div className="gardeners-print" aria-hidden="true" style={{ display: 'none' }}>
        <div className="doc-header">
          <img className="doc-logo" src="/images/komba-logo-color.png" alt="Komba Cabana" />
          <p className="doc-location">Nosy Komba, Madagascar</p>
        </div>
        <div className="doc-title-block">
          <h2 className="doc-title">PLANNING DES JARDINIERS {year}</h2>
          <p className="doc-subtitle">Jardiniers</p>
        </div>
        <div className="doc-fields">
          {selected && <p><strong>Nom:</strong> {selected}</p>}
          <p><strong>Mois:</strong> {MONTHS_FR[month - 1]} {year}</p>
          {printStart && <p><strong>À partir du:</strong> {printStart} {MONTHS_FR[month - 1].toLowerCase()}</p>}
        </div>
        <table>
          <thead>
            <tr>
              <th>Jour</th>
              <th>Date</th>
              {visibleGardeners.map((g) => (
                <th key={g}>{g}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {schedule.map((day, i) => {
              if (day.date < printFrom) return null
              const dayNum = i + 1
              const weekday = new Date(year, month - 1, dayNum).getDay()
              return (
                <tr key={day.date}>
                  <td className="g-day">{DAY_NAMES_FR[weekday]}</td>
                  <td className="g-day">{dayNum} {MONTHS_FR[month - 1].slice(0, 4).toLowerCase()}.</td>
                  {visibleGardeners.map((g) => {
                    if (!employedOn(endByName[g], day.date)) return <td key={g} />
                    const post = (day.assignments[g] || 'OFF') as GardenPost
                    return <td key={g}>{post === 'OFF' ? '—' : POST_LABELS_FR[post]}</td>
                  })}
                </tr>
              )
            })}
            <tr className="g-total">
              <td colSpan={2} style={{ textAlign: 'right' }}>Total heures</td>
              {visibleGardeners.map((g) => (
                <td key={g}>{printStats[g]?.hours ?? 0} h</td>
              ))}
            </tr>
          </tbody>
        </table>
        <div className="doc-legend">
          <span><strong>Plage</strong> 6h-12h / 13h-19h &nbsp;·&nbsp; <strong>Jardin</strong> 7h-13h / 13h-19h &nbsp;·&nbsp; <strong>Réserve</strong> remplaçant &nbsp;·&nbsp; <strong>—</strong> Repos</span>
        </div>
      </div>

      {/* Hidden French attendance sheets — one full page per gardener (no colors) */}
      <div className="gardeners-att-print" aria-hidden="true" style={{ display: 'none' }}>
        {visibleGardeners.map((g) => (
          <div key={g} className="att-page">
            <div className="doc-header">
              <img className="doc-logo" src="/images/komba-logo-color.png" alt="Komba Cabana" />
              <p className="doc-location">Nosy Komba, Madagascar</p>
            </div>
            <div className="doc-title-block">
              <h2 className="doc-title">REGISTRE DE PRÉSENCE {year}</h2>
              <p className="doc-subtitle">Jardinier</p>
            </div>
            <div className="doc-fields">
              <p><span className="doc-label">Nom:</span> <strong>{g}</strong></p>
              <p><span className="doc-label">Poste:</span> <strong>Jardinier</strong></p>
              <p><span className="doc-label">Mois:</span> <strong>{MONTHS_FR[month - 1]} {year}</strong></p>
            </div>
            <table>
              <thead>
                <tr>
                  <th className="att-col-day">Jour</th>
                  <th className="att-col-date">Date</th>
                  <th>Arrivée</th>
                  <th>Départ</th>
                  <th>Signature</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: lastDay }).map((_, i) => {
                  const dayNum = i + 1
                  const weekday = new Date(year, month - 1, dayNum).getDay()
                  return (
                    <tr key={dayNum}>
                      <td className="att-col-day">{DAY_NAMES_FR[weekday]}</td>
                      <td className="att-col-date">{dayNum} {MONTHS_FR[month - 1].slice(0, 4).toLowerCase()}.</td>
                      <td></td>
                      <td></td>
                      <td></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className="doc-legend">
              <span>Total heures prévues: <strong>{stats[g].hours} h</strong> ({stats[g].shifts} services × 6 h)</span>
              <span>Signature du responsable: ______________________</span>
            </div>
            <p className="doc-note">Par ma signature, je confirme ma présence au travail pour les jours indiqués.</p>
          </div>
        ))}
      </div>
    </div>
  )
}
