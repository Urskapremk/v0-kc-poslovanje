'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import useSWR from 'swr'
import { Calendar, Printer, Info, FileText, Coffee, Sun, Moon, X, ChevronDown } from 'lucide-react'
import {
  getActiveBarStaff,
  SHIFT_LABELS,
  SHIFT_LABELS_FR,
  SHIFT_HOURS,
  generateBarSchedule,
  computeBarStats,
  barDayHours,
  barExtrasFor,
  type BarShift,
} from '@/lib/bar'
import { getLeaveRequests } from '@/app/actions/leave'
import { getAllStaffMembers } from '@/app/actions/statistics'
import { leaveDaysForStaff, LEAVE_TYPES, scheduleLeaveLabel, scheduleLeaveShort, type LeaveType } from '@/lib/leave'
import { getHolidayName, isSunday } from '@/lib/holidays'
import { summarizeMonthHours, type HoursBreakdown } from '@/lib/work-hours'
import { HoursBreakdownLines } from '@/components/hours-breakdown-lines'
import { themeFor, PILL, type SchedulePill } from '@/lib/schedule-theme'
import { employedOn, endDatesFor, keptInMonth } from '@/lib/employment'
import { defaultPrintFrom, printAfterDialog, printStartDay, printWithClass } from '@/lib/print-from'
import { PrintFromDialog } from '@/components/print-from-dialog'

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

// Color per shift (on-screen only). Palette comes from the caller so the sand
// view-only table and the navy editing table share one lookup.
function shiftClasses(shift: BarShift, pill: SchedulePill, offText: string): string {
  switch (shift) {
    case 'MORNING':
      return pill.gold
    case 'MIDDAY':
      return pill.green
    case 'EVENING':
      return pill.sky
    default:
      return offText
  }
}

// Color per extra segment, matching its time-of-day shift: morning/breakfast =
// gold (like morning), evening = blue (like evening), midday = green. Written as
// bare hex because these badges are painted through inline style. The sand set
// is darker so it stays legible on the light panel.
function extraColor(label: string, sand: boolean): string {
  if (label.startsWith('Zajtrk') || label.startsWith('Jutro')) return sand ? '#8f6d3a' : '#c59b5b'
  if (label.startsWith('Večer')) return sand ? '#3f6b7d' : '#9ecbdd'
  return sand ? '#4f7a54' : '#9ab39d'
}

function ShiftIcon({ shift }: { shift: BarShift }) {
  if (shift === 'MORNING') return <Coffee className="h-3.5 w-3.5" />
  if (shift === 'MIDDAY') return <Sun className="h-3.5 w-3.5" />
  if (shift === 'EVENING') return <Moon className="h-3.5 w-3.5" />
  return <X className="h-3.5 w-3.5" />
}

export default function BarTab({
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
  // Pogled zaslonske tabele: 'staff' = mreža po osebah (kot doslej),
  // 'shift' = pari po smenah (za vsak dan kdo je skupaj v jutro/opoldne/večer).
  const [viewMode, setViewMode] = useState<'staff' | 'shift'>('staff')
  // Editing tools collapsed by default — the phone view only needs the table.
  const [showTools, setShowTools] = useState(false)
  // Never open the tools block in view-only mode.
  const toolsVisible = showTools && !readOnly
  // Per-person collapse for the hours breakdown (see razpored-tab for the same pattern).
  const [hiddenHours, setHiddenHours] = useState<Record<string, boolean>>({})
  const [printFrom, setPrintFrom] = useState(() => defaultPrintFrom(year, month))
  const [printAsk, setPrintAsk] = useState<null | 'bar' | 'bar-screen'>(null)
  const printStart = printStartDay(printFrom, year, month)
  const toggleHours = (name: string) => setHiddenHours((prev) => ({ ...prev, [name]: !prev[name] }))

  const activeStaff = useMemo<string[]>(() => getActiveBarStaff(year, month), [year, month])

  // Vzdevki (nickname) iz seznama osebja — prikažemo jih v glavah stolpcev in
  // filtrih namesto uradnega imena, kadar so vpisani. Uradno ime ostane v podatkih.
  const { data: staffMembers } = useSWR('all-staff-members', getAllStaffMembers)
  const nickByName = useMemo(() => {
    const map: Record<string, string> = {}
    for (const s of staffMembers ?? []) {
      if (s.nickname) map[s.staffName] = s.nickname
    }
    return map
  }, [staffMembers])
  const displayName = (p: string) => nickByName[p] || p
  const endByName = useMemo(() => endDatesFor(activeStaff, staffMembers ?? []), [activeStaff, staffMembers])
  const roster = useMemo(() => keptInMonth(activeStaff, endByName, year, month), [activeStaff, endByName, year, month])
  const schedule = useMemo(() => generateBarSchedule(year, month), [year, month])
  const stats = useMemo(() => computeBarStats(schedule), [schedule])
  const printStats = useMemo(
    () => computeBarStats(schedule.filter((day) => day.date >= printFrom)),
    [schedule, printFrom],
  )
  const lastDay = schedule.length

  // Dopust bara se v LeaveDocument shranjuje pod oddelkom "barman" (glej app/statistika/page.tsx),
  // zato ga tudi tukaj beremo pod istim ključem — sicer se dopust ne bi prikazal na razporedu.
  const { data: leaves } = useSWR(['leave', 'barman'], () => getLeaveRequests('barman'))
  const leaveByStaff = useMemo(() => {
    const map: Record<string, ReturnType<typeof leaveDaysForStaff>> = {}
    for (const p of activeStaff) map[p] = leaveDaysForStaff(leaves ?? [], p, year, month)
    return map
  }, [leaves, year, month, activeStaff])

  // Per-staff monthly breakdown: regular / Sunday / holiday work + leave.
  const breakdowns = useMemo(() => {
    const map: Record<string, HoursBreakdown> = {}
    for (const p of roster) {
      const entries = schedule.map((day, i) => {
        const away = !employedOn(endByName[p], day.date)
        const info = leaveByStaff[p]?.[i + 1]
        return { day: i + 1, hours: away ? 0 : barDayHours(day, p), onLeave: !away && !!info, leaveType: info?.type }
      })
      map[p] = summarizeMonthHours(year, month, entries)
    }
    return map
  }, [schedule, roster, leaveByStaff, year, month, endByName])

  const visibleStaff = roster.filter((p) => !selected || p === selected)

  // Sand table for Borut's read-only view, original navy for editing.
  const t = themeFor(readOnly)
  const pill = readOnly ? PILL.sand : PILL.navy

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

  function printDoc(target: 'bar' | 'bar-attendance' | 'bar-screen') {
    const sheet = target === 'bar' ? '.bar-print' : target === 'bar-screen' ? '.bar-color-print' : '.bar-att-print'
    printWithClass(`printing-${target}`, sheet)
  }

  function askPrint(target: 'bar' | 'bar-screen') {
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
          body.printing-bar .no-print,
          body.printing-bar .bar-screen,
          body.printing-bar-attendance .no-print,
          body.printing-bar-attendance .bar-screen,
          body.printing-bar-screen .no-print,
          body.printing-bar-screen .bar-screen { display: none !important; }

          /* ===== Color schedule (looks like screen, white paper, colored shifts) ===== */
          body.printing-bar-screen * { visibility: hidden; }
          body.printing-bar-screen .bar-color-print,
          body.printing-bar-screen .bar-color-print * { visibility: visible; }
          body.printing-bar-screen .bar-color-print {
            display: flex !important; flex-direction: column;
            position: absolute; left: 0; top: 0; width: 100%;
            box-sizing: border-box;
          }
          .bar-color-print .doc-header { text-align: center; border-bottom: 2px solid #111; padding-bottom: 6px; margin-bottom: 4px; }
          .bar-color-print .doc-logo { display: block; margin: 0 auto; height: 48px; width: auto; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .bar-color-print .doc-location { font-size: 12px; font-style: italic; color: #333; margin: 2px 0 0; }
          .bar-color-print .doc-title-block { text-align: center; border-bottom: 1px solid #111; padding-bottom: 6px; margin-bottom: 6px; }
          .bar-color-print .doc-title { font-size: 17px; font-weight: 700; letter-spacing: 1px; margin: 6px 0 0; color: #111; }
          .bar-color-print .doc-subtitle { font-size: 12px; color: #777; margin: 2px 0 0; }
          .bar-color-print table { width: 100%; border-collapse: collapse; font-size: 11px; color: #111; font-family: Georgia, 'Times New Roman', serif; }
          .bar-color-print th, .bar-color-print td { border: 1px solid #bbb; padding: 3px 6px; line-height: 1.25; text-align: center; vertical-align: middle; }
          .bar-color-print th { background: #f8f5ef !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-size: 10px; text-transform: uppercase; letter-spacing: .5px; }
          .bar-color-print .bc-day, .bar-color-print .bc-date { text-align: left; color: #333; }
          .bar-color-print .bc-cell { font-weight: 600; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .bar-color-print .bc-morning { background: #f3e7d8 !important; color: #785224 !important; }
          .bar-color-print .bc-midday { background: #e7eee7 !important; color: #446547 !important; }
          .bar-color-print .bc-evening { background: #eaf5f9 !important; color: #4e7f92 !important; }
          .bar-color-print .bc-off { color: #aaa !important; }
          .bar-color-print .bc-leave { background: #f0e0da !important; color: #975b45 !important; }
          .bar-color-print .bc-leave small { display: block; font-weight: 400; font-size: 9px; opacity: .75; }
          .bar-color-print .bc-sick { background: #ebe4f4 !important; color: #5c3d78 !important; }
          .bar-color-print .bc-sick small { display: block; font-weight: 400; font-size: 9px; opacity: .75; }
          .bar-color-print .g-total td { font-weight: 700; background: #f8f5ef !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .bar-color-print .doc-legend { display: flex; gap: 18px; flex-wrap: wrap; font-size: 11px; margin-top: 10px; }
          .bar-color-print .doc-legend .lg { display: inline-flex; align-items: center; gap: 5px; }
          .bar-color-print .doc-legend .sw { display: inline-block; width: 11px; height: 11px; border-radius: 2px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

          /* ===== French schedule (no colors) ===== */
          body.printing-bar * { visibility: hidden; }
          body.printing-bar .bar-print,
          body.printing-bar .bar-print * { visibility: visible; }
          body.printing-bar .bar-print {
            display: flex !important; flex-direction: column;
            position: absolute; left: 0; top: 0; width: 100%;
            height: 248mm; box-sizing: border-box; overflow: hidden;
          }
          .bar-print .doc-header { text-align: center; border-bottom: 2px solid #111; padding-bottom: 6px; margin-bottom: 4px; flex: 0 0 auto; }
          .bar-print .doc-logo { display: block; margin: 0 auto; height: 48px; width: auto; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .bar-print .doc-location { font-size: 12px; font-style: italic; color: #333; margin: 2px 0 0; }
          .bar-print .doc-title-block { text-align: center; border-bottom: 1px solid #111; padding-bottom: 6px; margin-bottom: 6px; flex: 0 0 auto; }
          .bar-print .doc-title { font-size: 17px; font-weight: 700; letter-spacing: 1px; margin: 6px 0 0; }
          .bar-print .doc-subtitle { font-size: 12px; color: #777; margin: 2px 0 0; }
          .bar-print .doc-fields { font-size: 13px; line-height: 1.4; margin-bottom: 6px; flex: 0 0 auto; }
          .bar-print .doc-fields p { margin: 0; }
          .bar-print table { width: 100%; border-collapse: collapse; font-size: 11px; color: #111; font-family: Georgia, 'Times New Roman', serif; flex: 1 1 auto; height: 100%; }
          .bar-print th, .bar-print td { border: 1px solid #999; padding: 2px 5px; line-height: 1.2; text-align: center; vertical-align: middle; }
          .bar-print th { background: #f8f5ef !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-size: 10px; }
          .bar-print .g-day { text-align: left; }
          .bar-print .g-total td { font-weight: 700; background: #f8f5ef !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .bar-print .doc-legend { font-size: 11px; margin-top: 8px; flex: 0 0 auto; }

          /* ===== Attendance sheets (one page per person) ===== */
          body.printing-bar-attendance * { visibility: hidden; }
          body.printing-bar-attendance .bar-att-print,
          body.printing-bar-attendance .bar-att-print * { visibility: visible; }
          body.printing-bar-attendance .bar-att-print {
            display: block !important;
            position: absolute; left: 0; top: 0; width: 100%;
          }
          .bar-att-print .att-page { page-break-after: always; break-after: page; color: #111; font-family: Georgia, 'Times New Roman', serif; height: 248mm; box-sizing: border-box; display: flex; flex-direction: column; overflow: hidden; }
          .bar-att-print .att-page:last-child { page-break-after: auto; break-after: auto; }
          .bar-att-print .doc-header { text-align: center; border-bottom: 2px solid #111; padding-bottom: 4px; margin-bottom: 4px; flex: 0 0 auto; }
          .bar-att-print .doc-logo { display: block; margin: 0 auto; height: 40px; width: auto; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .bar-att-print .doc-location { font-size: 11px; font-style: italic; color: #333; margin: 1px 0 0; }
          .bar-att-print .doc-title-block { text-align: center; border-bottom: 1px solid #111; padding-bottom: 4px; margin-bottom: 5px; flex: 0 0 auto; }
          .bar-att-print .doc-title { font-size: 16px; font-weight: 700; letter-spacing: 1px; margin: 4px 0 0; }
          .bar-att-print .doc-subtitle { font-size: 11px; color: #777; margin: 2px 0 0; }
          .bar-att-print .doc-fields { font-size: 12px; line-height: 1.4; margin-bottom: 5px; flex: 0 0 auto; }
          .bar-att-print .doc-fields p { margin: 0; }
          .bar-att-print .doc-label { display: inline-block; min-width: 150px; }
          .bar-att-print table { width: 100%; border-collapse: collapse; font-size: 11px; color: #111; flex: 1 1 auto; }
          .bar-att-print th, .bar-att-print td { border: 1px solid #999; padding: 0 8px; line-height: 1.25; text-align: center; vertical-align: middle; }
          .bar-att-print th { background: #f8f5ef !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-size: 10px; }
          .bar-att-print .att-col-day, .bar-att-print .att-col-date { text-align: left; }
          .bar-att-print .doc-legend { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 12px; font-size: 11px; margin-top: 6px; flex: 0 0 auto; }
          .bar-att-print .doc-note { font-size: 10px; color: #333; margin: 3px 0 0; flex: 0 0 auto; }
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
            <h2 className="text-lg font-bold text-[#c59b5b] flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Razpored bara
            </h2>
            <p className="text-white/40 text-sm">{MONTHS[month - 1]} {year} · {roster.map(displayName).join(', ')}</p>
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
            onClick={() => askPrint('bar-screen')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#c59b5b]/20 text-[#c59b5b] border border-[#c59b5b]/30 hover:bg-[#c59b5b]/30 transition-colors text-sm font-medium"
          >
            <Printer className="h-4 w-4" />
            Natisni razpored (barvno)
          </button>
          <button
            onClick={() => askPrint('bar')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#7fa8b8]/20 text-[#7fa8b8] border border-[#7fa8b8]/30 hover:bg-[#7fa8b8]/30 transition-colors text-sm font-medium"
          >
            <Printer className="h-4 w-4" />
            Natisni razpored (FR)
          </button>
          <button
            onClick={() => printDoc('bar-attendance')}
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
        person={selected ? displayName(selected) : null}
        onChange={setPrintFrom}
        onCancel={() => setPrintAsk(null)}
        onPrint={confirmPrint}
      />

      {/* Notice */}
      {toolsVisible && (
      <div className="no-print flex items-start gap-2 rounded-xl border border-[#c59b5b]/30 bg-[#c59b5b]/10 px-3 py-2 text-xs text-[#c59b5b]">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <span>
          Razpored se samodejno izračuna: 3 izmene (jutro 6-12:30, opoldne 11-17, večer 15:30-22), vsak dan ena oseba prosta.
          Fransia je vedno opoldanska izmena, večerno izmeno dela vedno fant (Alex ali Walas), da nobeno dekle ne dela zvečer samo.
        </span>
      </div>
      )}

      {/* Legend / filter — always visible, it is how you pick one person's schedule. */}
      <div className="no-print flex flex-wrap items-center gap-2 text-xs">
        {roster.map((p) => {
          const active = selected === p
          return (
            <button
              key={p}
              type="button"
              onClick={() => setSelected(active ? null : p)}
              className={`px-3 py-1.5 rounded-lg border transition-all ${
                active
                  ? 'bg-[#c59b5b]/20 text-[#c59b5b] border-[#c59b5b]/40'
                  : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'
              } ${selected && !active ? 'opacity-40' : ''}`}
            >
              {displayName(p)}
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

      {/* Hours summary — respects the selected person, like the tables below. */}
      {toolsVisible && (
      <div className="no-print grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 items-start">
        {visibleStaff.map((p) => {
          const s = stats[p] ?? { hours: 0, shifts: 0 }
          return (
            <button
              key={p}
              type="button"
              onClick={() => toggleHours(p)}
              aria-expanded={!hiddenHours[p]}
              title={hiddenHours[p] ? 'Pokaži razčlenitev ur' : 'Skrij razčlenitev ur'}
              className="w-full cursor-pointer rounded-2xl border border-[#c59b5b]/20 bg-[#c59b5b]/5 p-4 text-left transition-colors"
            >
              <div className="font-semibold text-[#c59b5b] mb-1">{displayName(p)}</div>
              <div className="text-2xl font-bold text-[#c59b5b]">{breakdowns[p]?.totalHours ?? s.hours} <span className="text-sm font-medium opacity-70">ur</span></div>
              <div className="text-xs text-white/40 mt-1">{(breakdowns[p] ? breakdowns[p].regularDays + breakdowns[p].sundayDays + breakdowns[p].holidayDays : s.shifts)} izmen</div>
              {breakdowns[p] && !hiddenHours[p] && <HoursBreakdownLines b={breakdowns[p]} />}
            </button>
          )
        })}
      </div>
      )}

      {/* View toggle — po osebah (mreža) vs. po smenah (pari) */}
      <div className="no-print flex flex-wrap items-center gap-2 text-xs">
        <span className={`mr-1 ${readOnly ? 'text-[#2b2622]/45' : 'text-white/40'}`}>Pogled:</span>
        {([['staff', 'Po osebah'], ['shift', 'Po smenah (pari)']] as const).map(([mode, label]) => {
          const active = viewMode === mode
          return (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1.5 rounded-lg border transition-all ${
                active
                  ? 'bg-[#c59b5b]/20 text-[#c59b5b] border-[#c59b5b]/40'
                  : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'
              }`}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* On-screen schedule table */}
      <div className={`no-print rounded-2xl border p-3 sm:p-4 overflow-x-auto ${t.card}`}>
        {/* Legend icons carry the shift colour, so they follow the palette too. */}
        <div className={`no-print flex flex-wrap items-center gap-4 mb-3 text-xs ${t.legend}`}>
          <span className="flex items-center gap-1.5"><Coffee className={`h-3.5 w-3.5 ${readOnly ? 'text-[#8f6d3a]' : 'text-[#c59b5b]'}`} /> Jutro 6-12:30</span>
          <span className="flex items-center gap-1.5"><Sun className={`h-3.5 w-3.5 ${readOnly ? 'text-[#4f7a54]' : 'text-[#9ab39d]'}`} /> Opoldne 11-17</span>
          <span className="flex items-center gap-1.5"><Moon className={`h-3.5 w-3.5 ${readOnly ? 'text-[#3f6b7d]' : 'text-[#9ecbdd]'}`} /> Večer 15:30-22</span>
          <span className={`flex items-center gap-1.5 ${readOnly ? 'text-[#2b2622]/45' : ''}`}><X className={`h-3.5 w-3.5 ${readOnly ? 'text-[#2b2622]/40' : 'text-white/30'}`} /> Prosto</span>
        </div>
        {/* Drop the width floor when one person is selected (see razpored-tab). */}
        {viewMode === 'staff' && (
        <table className={`w-full border-collapse text-sm ${selected ? '' : 'min-w-[720px]'}`}>
          <thead>
            <tr className={`text-xs uppercase tracking-wider ${t.head}`}>
              <th className="text-left py-2 px-2 font-semibold">Dan</th>
              <th className="text-left py-2 px-2 font-semibold">Datum</th>
              {visibleStaff.map((p) => (
                <th key={p} className="text-left py-2 px-2 font-semibold">{displayName(p)}</th>
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
                  {visibleStaff.map((p) => {
                    if (!employedOn(endByName[p], day.date)) {
                      return <td key={p} className="py-1.5 px-2 text-white/25">—</td>
                    }
                    const shift = (day.assignments[p] || 'OFF') as BarShift
                    const leave = leaveByStaff[p]?.[dayNum]
                    return (
                      <td key={p} className="py-1.5 px-2">
                        {leave ? (
                          <span
                            className={`inline-flex flex-col gap-0.5 rounded-md border px-2 py-0.5 text-xs ${leave.type === 'sick' ? t.sickBadge : t.leaveBadge}`}
                            title={LEAVE_TYPES[leave.type as LeaveType]?.sl}
                          >
                            <span className="font-semibold">{scheduleLeaveLabel(leave.type)}</span>
                            <span className="text-[10px] opacity-70">{SHIFT_LABELS[shift]}</span>
                          </span>
                        ) : (
                          <span className="inline-flex flex-col items-start gap-0.5">
                            <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs ${shiftClasses(shift, pill, t.offText)}`}>
                              <ShiftIcon shift={shift} />
                              {shift === 'OFF' ? 'Prosto' : SHIFT_LABELS[shift]}
                            </span>
                            {barExtrasFor(day, p).map((e) => (
                              <span
                                key={e.label}
                                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px]"
                                style={{
                                  color: extraColor(e.label, readOnly),
                                  backgroundColor: `${extraColor(e.label, readOnly)}1a`,
                                  border: `1px solid ${extraColor(e.label, readOnly)}4d`,
                                }}
                                title={`Dodatna izmena +${e.hours} h`}
                              >
                                + {e.label}
                              </span>
                            ))}
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

        {/* By-shift view: for each day, who is together in each shift (pari) */}
        {viewMode === 'shift' && (
        <table className="w-full border-collapse text-sm min-w-[720px]">
          <thead>
            <tr className={`text-xs uppercase tracking-wider ${t.head}`}>
              <th className="text-left py-2 px-2 font-semibold">Dan</th>
              <th className="text-left py-2 px-2 font-semibold">Datum</th>
              <th className="text-left py-2 px-2 font-semibold"><span className="inline-flex items-center gap-1.5"><Coffee className={`h-3.5 w-3.5 ${readOnly ? 'text-[#8f6d3a]' : 'text-[#c59b5b]'}`} /> Jutro 6-12:30</span></th>
              <th className="text-left py-2 px-2 font-semibold"><span className="inline-flex items-center gap-1.5"><Sun className={`h-3.5 w-3.5 ${readOnly ? 'text-[#4f7a54]' : 'text-[#9ab39d]'}`} /> Opoldne 11-17</span></th>
              <th className="text-left py-2 px-2 font-semibold"><span className="inline-flex items-center gap-1.5"><Moon className={`h-3.5 w-3.5 ${readOnly ? 'text-[#3f6b7d]' : 'text-[#9ecbdd]'}`} /> Večer 15:30-22</span></th>
              <th className="text-left py-2 px-2 font-semibold"><span className={`inline-flex items-center gap-1.5 ${readOnly ? 'text-[#2b2622]/45' : 'text-white/40'}`}><X className="h-3.5 w-3.5" /> Prosto</span></th>
            </tr>
          </thead>
          <tbody>
            {schedule.map((day, i) => {
              const dayNum = i + 1
              const weekday = new Date(year, month - 1, dayNum).getDay()
              const holiday = getHolidayName(year, month, dayNum)
              const sunday = isSunday(year, month, dayNum)
              const isToday = todayDay === dayNum
              // Razvrsti aktivno osebje po smenah tega dne.
              const groups: Record<BarShift, string[]> = { MORNING: [], MIDDAY: [], EVENING: [], OFF: [] }
              for (const p of roster) {
                if (!employedOn(endByName[p], day.date)) continue
                const shift = (day.assignments[p] || 'OFF') as BarShift
                groups[shift].push(p)
              }
              const renderCell = (shift: BarShift) => (
                <div className="flex flex-wrap gap-1">
                  {groups[shift].length === 0 ? (
                    <span className={readOnly ? 'text-[#2b2622]/30' : 'text-white/25'}>—</span>
                  ) : (
                    groups[shift].map((p) => {
                      const leaveInfo = leaveByStaff[p]?.[dayNum]
                      const onLeave = !!leaveInfo
                      return (
                        <span
                          key={p}
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs ${
                            onLeave ? (leaveInfo?.type === 'sick' ? t.sickBadge : t.leaveBadge) : shiftClasses(shift, pill, t.offText)
                          }`}
                          title={onLeave ? (leaveInfo?.type === 'sick' ? 'Na bolniški' : 'Na dopustu') : undefined}
                        >
                          {displayName(p)}{onLeave && <span className="opacity-60">{scheduleLeaveShort(leaveInfo?.type)}</span>}
                        </span>
                      )
                    })
                  )}
                </div>
              )
              return (
                <tr
                  key={day.date}
                  ref={isToday ? todayRowRef : undefined}
                  className={`border-t ${t.rowBorder} ${holiday ? t.holidayRow : sunday ? t.sundayRow : ''}`}
                >
                  <td className={`py-1.5 px-2 align-top ${isToday ? `border-l-[3px] ${t.todayBar}` : ''} ${sunday || holiday ? `${t.dayAccent} font-semibold` : t.dayMuted}`}>{DAY_NAMES[weekday]}</td>
                  <td className={`py-1.5 px-2 align-top tabular-nums ${t.dateText}`}>
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
                        <span className={`text-[9px] font-semibold uppercase tracking-[0.18em] ${t.todayLabel}`}>Danes</span>
                      )}
                    </div>
                  </td>
                  <td className="py-1.5 px-2 align-top">{renderCell('MORNING')}</td>
                  <td className="py-1.5 px-2 align-top">{renderCell('MIDDAY')}</td>
                  <td className="py-1.5 px-2 align-top">{renderCell('EVENING')}</td>
                  <td className="py-1.5 px-2 align-top">{renderCell('OFF')}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        )}
      </div>

      {/* Hidden color print sheet — same layout as screen, white paper, colored shifts */}
      <div className="bar-color-print" aria-hidden="true" style={{ display: 'none' }}>
        <div className="doc-header">
          <img className="doc-logo" src="/images/komba-logo-color.png" alt="Komba Cabana" />
          <p className="doc-location">Nosy Komba, Madagascar</p>
        </div>
        <div className="doc-title-block">
          <h2 className="doc-title">RAZPORED BARA</h2>
          <p className="doc-subtitle">{MONTHS[month - 1]} {year}{printStart ? ` · od ${printStart}. ${MONTHS[month - 1].toLowerCase()}` : ''}{selected ? ` · ${displayName(selected)}` : ''}</p>
        </div>
        <table>
          <thead>
            <tr>
              <th className="bc-day">Dan</th>
              <th className="bc-date">Datum</th>
              {visibleStaff.map((p) => (
                <th key={p}>{displayName(p)}</th>
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
                  <td className="bc-day" style={sunday || holiday ? { color: '#a56650', fontWeight: 700 } : undefined}>{DAY_NAMES[weekday]}</td>
                  <td className="bc-date">
                    {dayNum}. {MONTHS[month - 1].slice(0, 3).toLowerCase()}
                    {holiday && <small style={{ display: 'block', color: '#a56650', fontWeight: 600 }}>{holiday}</small>}
                    {!holiday && sunday && <small style={{ display: 'block', color: '#28708d' }}>Dimanche</small>}
                  </td>
                  {visibleStaff.map((p) => {
                    if (!employedOn(endByName[p], day.date)) return <td key={p} className="bc-cell" />
                    const shift = (day.assignments[p] || 'OFF') as BarShift
                    const leave = leaveByStaff[p]?.[dayNum]
                    if (leave) {
                      return (
                        <td key={p} className={`bc-cell ${leave.type === 'sick' ? 'bc-sick' : 'bc-leave'}`}>
                          {scheduleLeaveLabel(leave.type)}
                          <small>{SHIFT_LABELS[shift]}</small>
                        </td>
                      )
                    }
                    const cls = shift === 'MORNING' ? 'bc-morning' : shift === 'MIDDAY' ? 'bc-midday' : shift === 'EVENING' ? 'bc-evening' : 'bc-off'
                    const extras = barExtrasFor(day, p)
                    return (
                      <td key={p} className={`bc-cell ${cls}`}>
                        {shift === 'OFF' ? 'Prosto' : SHIFT_LABELS[shift]}
                        {extras.map((e) => {
                          const pc = e.label.startsWith('Zajtrk') ? '#7c5628' : e.label.startsWith('Večer') ? '#4e7f92' : '#4f6a52'
                          return (
                            <small key={e.label} style={{ display: 'block', fontWeight: 600, color: pc }}>+ {e.label}</small>
                          )
                        })}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
            <tr className="g-total">
              <td colSpan={2} style={{ textAlign: 'right' }}>Skupaj ur</td>
              {visibleStaff.map((p) => (
                <td key={p}>{printStats[p]?.hours ?? 0} h</td>
              ))}
            </tr>
          </tbody>
        </table>
        <div className="doc-legend">
          <span className="lg"><span className="sw" style={{ background: '#f3e7d8', border: '1px solid #785224' }} /> Jutro 6-12:30</span>
          <span className="lg"><span className="sw" style={{ background: '#e7eee7', border: '1px solid #446547' }} /> Opoldne 11-17</span>
          <span className="lg"><span className="sw" style={{ background: '#eaf5f9', border: '1px solid #4e7f92' }} /> Večer 15:30-22</span>
          <span className="lg"><span className="sw" style={{ background: '#f0e0da', border: '1px solid #975b45' }} /> Dopust</span>
          <span className="lg"><span className="sw" style={{ background: '#fff', border: '1px solid #aaa' }} /> Prosto</span>
          <span className="lg"><span className="sw" style={{ background: '#f7ece8', border: '1px solid #a56650' }} /> Jour férié / Dimanche</span>
        </div>
      </div>

      {/* Hidden French print sheet (no colors) */}
      <div className="bar-print" aria-hidden="true" style={{ display: 'none' }}>
        <div className="doc-header">
          <img className="doc-logo" src="/images/komba-logo-color.png" alt="Komba Cabana" />
          <p className="doc-location">Nosy Komba, Madagascar</p>
        </div>
        <div className="doc-title-block">
          <h2 className="doc-title">PLANNING DU BAR {year}</h2>
          <p className="doc-subtitle">Bar</p>
        </div>
        <div className="doc-fields">
          {selected && <p><strong>Nom:</strong> {displayName(selected)}</p>}
          <p><strong>Mois:</strong> {MONTHS_FR[month - 1]} {year}</p>
          {printStart && <p><strong>À partir du:</strong> {printStart} {MONTHS_FR[month - 1].toLowerCase()}</p>}
        </div>
        <table>
          <thead>
            <tr>
              <th>Jour</th>
              <th>Date</th>
              {visibleStaff.map((p) => (
                <th key={p}>{displayName(p)}</th>
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
                  {visibleStaff.map((p) => {
                    if (!employedOn(endByName[p], day.date)) return <td key={p} />
                    const shift = (day.assignments[p] || 'OFF') as BarShift
                    const extras = barExtrasFor(day, p)
                    return (
                      <td key={p}>
                        {shift === 'OFF' ? '—' : SHIFT_LABELS_FR[shift]}
                        {extras.map((e) => (
                          <small key={e.label} style={{ display: 'block' }}>+ {e.labelFr}</small>
                        ))}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
            <tr className="g-total">
              <td colSpan={2} style={{ textAlign: 'right' }}>Total heures</td>
              {visibleStaff.map((p) => (
                <td key={p}>{printStats[p]?.hours ?? 0} h</td>
              ))}
            </tr>
          </tbody>
        </table>
        <div className="doc-legend">
          <span><strong>Matin</strong> 6h-12h30 &nbsp;·&nbsp; <strong>Midi</strong> 11h-17h &nbsp;·&nbsp; <strong>Soir</strong> 15h30-22h &nbsp;·&nbsp; <strong>—</strong> Repos</span>
        </div>
      </div>

      {/* Hidden French attendance sheets — one full page per person (no colors) */}
      <div className="bar-att-print" aria-hidden="true" style={{ display: 'none' }}>
        {visibleStaff.map((p) => (
          <div key={p} className="att-page">
            <div className="doc-header">
              <img className="doc-logo" src="/images/komba-logo-color.png" alt="Komba Cabana" />
              <p className="doc-location">Nosy Komba, Madagascar</p>
            </div>
            <div className="doc-title-block">
              <h2 className="doc-title">REGISTRE DE PRÉSENCE {year}</h2>
              <p className="doc-subtitle">Bar</p>
            </div>
            <div className="doc-fields">
              <p><span className="doc-label">Nom:</span> <strong>{p}</strong></p>
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
              <span>Total heures prévues: <strong>{stats[p]?.hours ?? 0} h</strong> ({stats[p]?.shifts ?? 0} services)</span>
              <span>Signature du responsable: ______________________</span>
            </div>
            <p className="doc-note">Par ma signature, je confirme ma présence au travail pour les jours indiqués.</p>
          </div>
        ))}
      </div>
    </div>
  )
}
