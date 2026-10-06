'use client'

import { useState } from 'react'
import useSWR, { mutate } from 'swr'
import { CalendarPlus, Printer, Trash2, X, Check, Upload, FileText, ChevronDown, Pencil } from 'lucide-react'
import { getAllStaffMembers, setPriorLeaveYear } from '@/app/actions/statistics'
import { formatAr, getCompany } from '@/lib/payroll'
import {
  getLeaveRequests,
  createLeaveRequest,
  updateLeaveRequest,
  deleteLeaveRequest,
  setLeaveSigned,
  setLeaveSignedDocument,
  setLeaveDoctorCertificate,
  setLeaveAdvancePay,
} from '@/app/actions/leave'
import {
  LeaveDepartment,
  LEAVE_DEPARTMENTS,
  LEAVE_TYPES,
  LeaveType,
  daysBetween,
  isLongLeave,
  leaveDateSl,
  leaveDateFr,
  LeaveRequest,
  proratedAnnualQuota,
  usedDaysInYear,
} from '@/lib/leave'
import { kitchenLeaveAdvancePay, type KitchenLeaveAdvance } from '@/lib/kitchen'
import { salaryForMonth } from '@/lib/employment'

const todayStr = () => new Date().toISOString().slice(0, 10)

const MONTHS_SL = [
  'januar', 'februar', 'marec', 'april', 'maj', 'junij',
  'julij', 'avgust', 'september', 'oktober', 'november', 'december',
]
const WEEKDAYS_SL = ['nedelja', 'ponedeljek', 'torek', 'sreda', 'četrtek', 'petek', 'sobota']

function joinSl(items: string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  return `${items.slice(0, -1).join(', ')} in ${items[items.length - 1]}`
}

function nextIso(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d + 1)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

function dayLabel(iso: string, withWeekday = false): string {
  const [y, m, d] = iso.split('-').map(Number)
  const base = `${d}. ${MONTHS_SL[m - 1]}`
  if (!withWeekday) return base
  return `${base} (${WEEKDAYS_SL[new Date(y, m - 1, d).getDay()]})`
}

function compactRanges(dates: string[]): string {
  const groups: string[][] = []
  for (const date of dates) {
    const prev = groups[groups.length - 1]
    if (prev && nextIso(prev[prev.length - 1]) === date) prev.push(date)
    else groups.push([date])
  }
  return joinSl(groups.map((group) => {
    if (group.length === 1) return dayLabel(group[0])
    const [, ma, da] = group[0].split('-').map(Number)
    const [, mb, db] = group[group.length - 1].split('-').map(Number)
    if (ma === mb) return `${da}.–${db}. ${MONTHS_SL[ma - 1]}`
    return `${dayLabel(group[0])} – ${dayLabel(group[group.length - 1])}`
  }))
}

export default function LeaveDocument({ department }: { department: LeaveDepartment }) {
  const { data: allStaff } = useSWR('all-staff', getAllStaffMembers)
  const { data: leaves } = useSWR(`leaves-${department}`, () => getLeaveRequests(department))

  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [printDoc, setPrintDoc] = useState<LeaveRequest | null>(null)
  const [printKind, setPrintKind] = useState<'leave' | 'advance'>('leave')
  const [advanceInputs, setAdvanceInputs] = useState<Record<string, string>>({})
  const [advanceError, setAdvanceError] = useState<string | null>(null)
  const [printPay, setPrintPay] = useState<KitchenLeaveAdvance | null>(null)
  const [selectedStaffId, setSelectedStaffId] = useState<string>('')
  const [year, setYear] = useState(new Date().getFullYear())
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [savingPrior, setSavingPrior] = useState(false)

  async function handleSavePriorLeave(staffId: string, yearKey: number, value: number) {
    setSavingPrior(true)
    try {
      await setPriorLeaveYear(staffId, yearKey, value)
      await mutate('all-staff')
    } catch (e) {
      console.error('[v0] prior leave save error', e)
    } finally {
      setSavingPrior(false)
    }
  }

  async function handleUploadSigned(leaveId: string, file: File) {
    setUploadingId(leaveId)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/upload-leave-document', { method: 'POST', body: fd })
      if (!res.ok) throw new Error('Upload failed')
      const { pathname } = await res.json()
      await setLeaveSignedDocument(leaveId, pathname)
      await refreshLeaves()
    } catch (e) {
      console.error('[v0] leave signed upload error:', e)
      alert('Nalaganje podpisanega dokumenta ni uspelo.')
    } finally {
      setUploadingId(null)
    }
  }

  async function refreshLeaves() {
    await mutate(`leaves-${department}`)
    await mutate(['leave', department])
    await mutate(
      (key) => Array.isArray(key) && (key[0] === 'leave-summaries' || key[0] === 'mg-attendance'),
      undefined,
      { revalidate: true },
    )
  }

  async function handleUploadCertificate(leaveId: string, file: File) {
    setUploadingId(leaveId)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('kind', 'doctor')
      const res = await fetch('/api/upload-leave-document', { method: 'POST', body: fd })
      if (!res.ok) throw new Error('Upload failed')
      const { pathname } = await res.json()
      await setLeaveDoctorCertificate(leaveId, pathname)
      await refreshLeaves()
    } catch (e) {
      console.error('[v0] doctor certificate upload error:', e)
      alert('Nalaganje potrdila zdravnika ni uspelo.')
    } finally {
      setUploadingId(null)
    }
  }

  const [editingId, setEditingId] = useState<string | null>(null)
  const [daysInput, setDaysInput] = useState('1')
  const [form, setForm] = useState({
    staffId: '',
    leaveType: 'annual' as LeaveType,
    startDate: todayStr(),
    endDate: todayStr(),
    reason: '',
  })

  // Osebje tega oddelka
  const deptStaff = (allStaff ?? []).filter(
    s => s.active && (s.staffType === department || s.allocateTo === department)
  )

  const selectedStaff = deptStaff.find(s => s.id === form.staffId)
  const calendarDays = daysBetween(form.startDate, form.endDate)
  const days = Number(daysInput)

  function openNew(leaveType: LeaveType = 'annual') {
    setEditingId(null)
    const today = todayStr()
    setForm({ staffId: '', leaveType, startDate: today, endDate: today, reason: '' })
    setDaysInput('1')
    setShowForm(true)
  }

  function openEdit(leave: LeaveRequest) {
    setEditingId(leave.id)
    setForm({
      staffId: leave.staffId,
      leaveType: (leave.leaveType as LeaveType) || 'annual',
      startDate: String(leave.startDate).slice(0, 10),
      endDate: String(leave.endDate).slice(0, 10),
      reason: leave.reason || '',
    })
    setDaysInput(String(leave.days ?? daysBetween(leave.startDate, leave.endDate)))
    setShowForm(true)
  }

  function changeDates(patch: { startDate?: string; endDate?: string }) {
    setForm(prev => {
      const next = { ...prev, ...patch }
      setDaysInput(String(daysBetween(next.startDate, next.endDate)))
      return next
    })
  }

  // Pregled po delavcu
  const viewedStaff = deptStaff.find(s => s.id === selectedStaffId)
  const allLeaves = leaves ?? []
  const viewedLeaves = selectedStaffId
    ? allLeaves.filter(l => l.staffId === selectedStaffId)
    : allLeaves
  // Dopusti izbranega delavca v izbranem letu
  const staffLeavesAllYears = selectedStaffId
    ? allLeaves.filter(l => l.staffId === selectedStaffId)
    : []
  const usedDays = usedDaysInYear(staffLeavesAllYears, year)
  const activeMonthsCount = viewedStaff?.activeMonths?.filter((m) => m >= 1 && m <= 12).length ?? 0
  const hasPartialActiveMonths = activeMonthsCount > 0 && activeMonthsCount < 12
  const annualQuota = proratedAnnualQuota(year, viewedStaff?.startDate, viewedStaff?.activeMonths)
  const isProrated = hasPartialActiveMonths
    ? true
    : viewedStaff?.startDate
      ? new Date(viewedStaff.startDate + 'T00:00:00').getFullYear() === year
      : false
  // Razclenitev po letih: najprej koristimo tekoce leto, nato pretekla leta.
  // Dopust preteklih let po letu (zadnja 3 leta); vsota = razpolozljivo iz preteklih let.
  const priorYearKeys = [year - 1, year - 2, year - 3]
  const priorMap = (viewedStaff?.priorLeaveByYear ?? {}) as Record<string, number>
  const hasPriorBreakdown = priorYearKeys.some((yk) => priorMap[String(yk)] !== undefined && priorMap[String(yk)] !== null)
  const priorYearsBalance = hasPriorBreakdown
    ? priorYearKeys.reduce((sum, yk) => sum + Math.max(0, Number(priorMap[String(yk)]) || 0), 0)
    : (viewedStaff?.openingLeaveBalance ?? 0)
  const takenFromCurrent = Math.min(usedDays, annualQuota)
  const takenFromPrior = Math.max(0, usedDays - annualQuota)
  const currentYearRemaining = annualQuota - takenFromCurrent
  const priorYearsRemaining = priorYearsBalance - takenFromPrior
  const remainingDays = currentYearRemaining + priorYearsRemaining
  // Leta, ki se pojavijo (za izbirnik)
  const availableYears = Array.from(
    new Set(allLeaves.map(l => new Date(l.startDate + 'T00:00:00').getFullYear()))
  ).sort((a, b) => b - a)
  if (!availableYears.includes(new Date().getFullYear())) availableYears.unshift(new Date().getFullYear())

  async function handleSave() {
    if (!selectedStaff || !(days > 0)) return
    setSaving(true)
    try {
      const payload = {
        staffId: selectedStaff.id,
        staffName: selectedStaff.staffName,
        department,
        company: selectedStaff.company || 'tourism',
        leaveType: form.leaveType,
        startDate: form.startDate,
        endDate: form.endDate,
        days,
        reason: form.reason,
      }
      if (editingId) await updateLeaveRequest(editingId, payload)
      else await createLeaveRequest(payload)
      await refreshLeaves()
      setEditingId(null)
      setForm({ staffId: '', leaveType: 'annual', startDate: todayStr(), endDate: todayStr(), reason: '' })
      setDaysInput('1')
      setShowForm(false)
    } catch (e) {
      console.error('[v0] leave save error', e)
    }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    await deleteLeaveRequest(id)
    await refreshLeaves()
  }

  function advanceValue(leave: LeaveRequest) {
    if (advanceInputs[leave.id] !== undefined) return advanceInputs[leave.id]
    return leave.advancePayAr ? String(leave.advancePayAr) : ''
  }

  function parseAr(raw: string) {
    const n = Number(String(raw).replace(/[^\d]/g, ''))
    return Number.isFinite(n) && n > 0 ? Math.round(n) : 0
  }

  function handlePrint(leave: LeaveRequest) {
    const staff = (allStaff ?? []).find(s => s.id === leave.staffId)
    setPrintKind('leave')
    setPrintDoc({ ...leave })
    // Sklicujemo se na HR podatke prek staffId; shranimo tudi za print
    ;(window as any).__leaveStaff = staff
    document.body.classList.add('printing-leave')
    setTimeout(() => {
      window.print()
      document.body.classList.remove('printing-leave')
      if (!leave.signedAt && leave.leaveType !== 'sick') {
        setLeaveSigned(leave.id).then(() => refreshLeaves())
      }
    }, 100)
  }

  function advanceFor(leave: LeaveRequest): KitchenLeaveAdvance | null {
    if (department !== 'kitchen') return null
    const staff = (allStaff ?? []).find(s => s.id === leave.staffId)
    const monthly = Number(staff?.monthlySalary)
    const official = Number(staff?.officialSalary)
    const salary = monthly > 0 ? monthly : official
    if (!(salary > 0)) return null
    return kitchenLeaveAdvancePay(
      leave.staffName,
      String(leave.startDate).slice(0, 10),
      String(leave.endDate).slice(0, 10),
      (year, month) => salaryForMonth(salary, staff?.salaryChanges, year, month, staff?.endDate),
    )
  }

  async function handlePrintAdvance(leave: LeaveRequest, pay: KitchenLeaveAdvance | null) {
    const amount = pay ? pay.amountAr : parseAr(advanceValue(leave))
    if (!amount) {
      setAdvanceError(leave.id)
      return
    }
    setAdvanceError(null)
    await setLeaveAdvancePay(leave.id, amount)
    await mutate(`leaves-${department}`)
    const staff = (allStaff ?? []).find(s => s.id === leave.staffId)
    setPrintKind('advance')
    setPrintPay(pay)
    setPrintDoc({ ...leave, advancePayAr: amount })
    ;(window as any).__leaveStaff = staff
    document.body.classList.add('printing-leave')
    setTimeout(() => {
      window.print()
      document.body.classList.remove('printing-leave')
    }, 100)
  }

  const printStaff: any = printDoc ? (window as any).__leaveStaff : null
  const printCompany = printDoc ? getCompany(printDoc.company) : null

  return (
    <>
    <details className="group rounded-2xl border border-[#7fa8b8]/20 bg-[#7fa8b8]/[0.04] p-4 no-print">
      <summary className="flex cursor-pointer list-none items-center justify-between [&::-webkit-details-marker]:hidden">
        <div>
          <h3 className="text-sm font-medium text-white">Dopust in bolniška — {LEAVE_DEPARTMENTS[department].sl}</h3>
          <p className="text-xs text-white/50">Dopust, bolniška in potrdilo zdravnika. Bolniška se zapiše v razpored in ostane plačan dan.</p>
        </div>
        <span className="flex items-center gap-2 rounded-xl bg-[#7fa8b8]/15 px-3 py-1.5 text-xs font-medium text-[#7fa8b8] border border-[#7fa8b8]/30">
          Odpri
          <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
        </span>
      </summary>

      <div className="mt-4 flex justify-end gap-2">
        <button
          onClick={() => (showForm && !editingId && form.leaveType !== 'sick' ? setShowForm(false) : openNew('annual'))}
          className="flex items-center gap-2 rounded-xl bg-[#7fa8b8]/20 px-4 py-2 text-sm font-medium text-[#7fa8b8] border border-[#7fa8b8]/30 hover:bg-[#7fa8b8]/30 transition-colors"
        >
          <CalendarPlus className="h-4 w-4" />
          Dopust
        </button>
        <button
          onClick={() => (showForm && !editingId && form.leaveType === 'sick' ? setShowForm(false) : openNew('sick'))}
          className="flex items-center gap-2 rounded-xl bg-[#b7a0d4]/20 px-4 py-2 text-sm font-medium text-[#d4c4ea] border border-[#b7a0d4]/40 hover:bg-[#b7a0d4]/30 transition-colors"
        >
          <CalendarPlus className="h-4 w-4" />
          Bolniška
        </button>
      </div>

      {/* Obrazec */}
      {showForm && (
        <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
          <p className="mb-3 text-sm font-medium text-white">
            {editingId ? 'Popravi' : form.leaveType === 'sick' ? 'Nova bolniška' : 'Nov dopust'}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/40">Delavec</label>
              <select
                value={form.staffId}
                onChange={e => setForm(p => ({ ...p, staffId: e.target.value }))}
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white focus:border-[#7fa8b8]/40 focus:outline-none"
              >
                <option value="">Izberi delavca</option>
                {deptStaff.map(s => (
                  <option key={s.id} value={s.id}>{s.staffName}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/40">Vrsta dopusta</label>
              <select
                value={form.leaveType}
                onChange={e => setForm(p => ({ ...p, leaveType: e.target.value as LeaveType }))}
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white focus:border-[#7fa8b8]/40 focus:outline-none"
              >
                {Object.entries(LEAVE_TYPES).map(([k, v]) => (
                  <option key={k} value={k}>{v.sl}</option>
                ))}
              </select>
              {form.leaveType === 'sick' && (
                <p className="mt-2 text-[11px] leading-snug text-[#d4c4ea]">
                  Bolniška se takoj zapiše v razpored. Dan ostane plačan v celoti (100 %) in ne zmanjša rednega dopusta.
                  Potrdilo zdravnika dodaš po shranitvi.
                </p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/40">Od</label>
              <input
                type="date"
                value={form.startDate}
                onChange={e => changeDates({ startDate: e.target.value })}
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white focus:border-[#7fa8b8]/40 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/40">Do</label>
              <input
                type="date"
                value={form.endDate}
                onChange={e => changeDates({ endDate: e.target.value })}
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white focus:border-[#7fa8b8]/40 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/40">Opomba (neobvezno)</label>
              <input
                type="text"
                value={form.reason}
                onChange={e => setForm(p => ({ ...p, reason: e.target.value }))}
                placeholder="npr. razlog ali opomba"
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white focus:border-[#7fa8b8]/40 focus:outline-none"
              />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/40">Št. dni</label>
              <input
                type="number"
                min={0.5}
                step={0.5}
                value={daysInput}
                onChange={e => setDaysInput(e.target.value)}
                className="w-28 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-sm text-white focus:border-[#7fa8b8]/40 focus:outline-none"
              />
              {calendarDays > 0 && calendarDays !== days && (
                <p className="mt-1 text-[11px] text-white/40">Od datuma do datuma je {calendarDays} dni. Tukaj lahko vpišeš manj, če prosti dnevi ne štejejo.</p>
              )}
              {!form.staffId && (
                <p className="mt-1 text-xs text-amber-400/80">Izberi delavca za shranjevanje.</p>
              )}
              {form.staffId && !(days > 0) && (
                <p className="mt-1 text-xs text-amber-400/80">
                  Vnesi veljaven datum &quot;Od&quot; in &quot;Do&quot; in število dni.
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setShowForm(false); setEditingId(null) }}
                className="flex items-center gap-1 rounded-xl bg-white/5 px-4 py-2 text-sm text-white/60 hover:bg-white/10"
              >
                <X className="h-4 w-4" /> Prekliči
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.staffId || !(days > 0)}
                className="flex items-center gap-1 rounded-xl bg-[#7fa8b8] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                <Check className="h-4 w-4" /> {saving ? 'Shranjujem…' : editingId ? 'Shrani popravek' : form.leaveType === 'sick' ? 'Shrani bolniško' : 'Shrani dopust'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Izbira delavca za pregled dopustov */}
      {deptStaff.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedStaffId('')}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              selectedStaffId === ''
                ? 'bg-[#7fa8b8] text-white'
                : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            Vsi
          </button>
          {deptStaff.map(s => (
            <button
              key={s.id}
              onClick={() => setSelectedStaffId(s.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                selectedStaffId === s.id
                  ? 'bg-[#7fa8b8] text-white'
                  : 'bg-white/5 text-white/60 hover:bg-white/10'
              }`}
            >
              {s.staffName}
            </button>
          ))}
        </div>
      )}

      {/* Stevec dopusta za izbranega delavca */}
      {viewedStaff && (
        <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium text-white">{viewedStaff.staffName}</p>
            <select
              value={year}
              onChange={e => setYear(Number(e.target.value))}
              className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-white focus:border-[#7fa8b8]/40 focus:outline-none"
            >
              {availableYears.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg bg-white/[0.03] py-3">
              <p className="text-2xl font-semibold text-white">{annualQuota}</p>
              <p className="mt-1 text-[10px] uppercase tracking-wider text-white/40">Na razpolago</p>
            </div>
            <div className="rounded-lg bg-white/[0.03] py-3">
              <p className="text-2xl font-semibold text-[#7fa8b8]">{usedDays}</p>
              <p className="mt-1 text-[10px] uppercase tracking-wider text-white/40">Koriščeno</p>
            </div>
            <div className="rounded-lg bg-white/[0.03] py-3">
              <p className={`text-2xl font-semibold ${remainingDays < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                {remainingDays}
              </p>
              <p className="mt-1 text-[10px] uppercase tracking-wider text-white/40">Preostalo (skupaj)</p>
            </div>
          </div>

          {/* Dopust preteklih let PO LETIH + razclenitev koriscenja */}
          <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3">
            <p className="mb-2 text-[11px] uppercase tracking-wider text-white/50">Dopust preteklih let (dni) — po letu</p>
            <div className="grid grid-cols-3 gap-2">
              {priorYearKeys.map((yk) => (
                <div key={`prior-${viewedStaff.id}-${yk}`} className="flex flex-col gap-1">
                  <label className="text-center text-[10px] text-white/40">{yk}</label>
                  <input
                    type="number"
                    step={0.5}
                    min={0}
                    inputMode="decimal"
                    defaultValue={(priorMap[String(yk)] ?? 0).toString()}
                    key={`prior-inp-${viewedStaff.id}-${yk}-${priorMap[String(yk)] ?? 0}`}
                    onBlur={(e) => {
                      const v = Math.max(0, Number.parseFloat(e.target.value || '0') || 0)
                      if (v !== (Number(priorMap[String(yk)]) || 0)) handleSavePriorLeave(viewedStaff.id, yk, v)
                    }}
                    className="w-full rounded-md border border-white/10 bg-white/5 px-2 py-1 text-right text-sm text-white focus:border-[#7fa8b8]/40 focus:outline-none"
                  />
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px]">
              <span className="text-white/40">Skupaj pretekla leta</span>
              <span className="font-semibold text-[#c59b5b]">{priorYearsBalance.toFixed(1)} dni</span>
            </div>
            {savingPrior && <p className="mt-1 text-right text-[10px] text-white/40">Shranjujem…</p>}
            <div className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
              <div className="rounded-md bg-white/[0.03] p-2">
                <p className="mb-1 text-[10px] uppercase tracking-wider text-emerald-400">Tekoče leto {year}</p>
                <div className="flex justify-between text-white/60"><span>Na razpolago</span><span>{annualQuota}</span></div>
                <div className="flex justify-between text-white/60"><span>Koriščeno</span><span>− {takenFromCurrent}</span></div>
                <div className="flex justify-between font-semibold text-white"><span>Ostane</span><span>{currentYearRemaining}</span></div>
              </div>
              <div className="rounded-md bg-white/[0.03] p-2">
                <p className="mb-1 text-[10px] uppercase tracking-wider text-[#c59b5b]">Pretekla leta</p>
                <div className="flex justify-between text-white/60"><span>Na voljo</span><span>{priorYearsBalance}</span></div>
                <div className="flex justify-between text-white/60"><span>Koriščeno</span><span>− {takenFromPrior}</span></div>
                <div className={`flex justify-between font-semibold ${priorYearsRemaining < 0 ? 'text-red-400' : 'text-white'}`}><span>Ostane</span><span>{priorYearsRemaining}</span></div>
              </div>
            </div>
            <p className="mt-2 text-[10px] text-white/30">
              Najprej se koristi dopust tekočega leta, ko ga zmanjka, se porablja dopust preteklih let.
            </p>
          </div>
          <p className="mt-3 text-[11px] text-white/40">
            V kvoto šteje redni dopust v koledarskem letu {year}. Bolniška se ne odšteje — dan je plačan v celoti (100 %).{' '}
            {hasPartialActiveMonths ? (
              <>
                Sorazmerna kvota: {activeMonthsCount} aktivnih mesecev v službi → {annualQuota} dni
                (2,5 dni/mesec).
              </>
            ) : isProrated && viewedStaff?.startDate ? (
              <>
                Sorazmerna kvota: zaposlitev {leaveDateSl(viewedStaff.startDate)} → {annualQuota} dni
                (2,5 dni/mesec).
              </>
            ) : (
              <>Letna kvota: {annualQuota} dni (Madagaskar, 2,5 dni/mesec).</>
            )}
          </p>
        </div>
      )}

      {/* Seznam dopustov */}
      {viewedLeaves && viewedLeaves.length > 0 && (
        <div className="mt-4 space-y-2">
          {viewedLeaves.map(l => {
            const longLeave = l.leaveType === 'annual' && isLongLeave(l.startDate, l.endDate)
            const pay = longLeave ? advanceFor(l) : null
            const start = String(l.startDate).slice(0, 10)
            const end = String(l.endDate).slice(0, 10)
            const workedBefore = pay?.workedDates.filter(d => d < start) ?? []
            const workedAfter = pay?.workedDates.filter(d => d > end) ?? []
            const oneMonth = pay?.months.length === 1 ? pay.months[0] : null
            return (
            <div
              key={l.id}
              className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3"
            >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">
                  {l.staffName}
                  <span className="ml-2 text-xs text-[#7fa8b8]">{LEAVE_TYPES[l.leaveType as LeaveType]?.sl}</span>
                </p>
                <p className="text-xs text-white/50">
                  {leaveDateSl(l.startDate)} – {leaveDateSl(l.endDate)} · {l.days} dni
                  {l.leaveType === 'sick' ? ' · 100 % plačano' : ''}
                  {l.signedAt ? ' · izdano' : ''}
                  {l.signedDocumentPath ? ' · podpisano ✓' : ''}
                  {l.doctorCertificatePath ? ' · potrdilo zdravnika ✓' : ''}
                </p>
                {l.reason ? <p className="mt-0.5 text-xs text-white/70">{l.reason}</p> : null}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => openEdit(l)}
                  className="flex items-center gap-1 rounded-lg bg-[#c59b5b]/15 px-3 py-2 text-xs text-[#c59b5b] hover:bg-[#c59b5b]/25"
                >
                  <Pencil className="h-3.5 w-3.5" /> Popravi
                </button>
                {l.leaveType === 'sick' ? (
                  <>
                    {l.doctorCertificatePath ? (
                      <a
                        href={`/api/image?pathname=${encodeURIComponent(l.doctorCertificatePath)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 rounded-lg bg-[#8fae92]/15 px-3 py-2 text-xs text-[#8fae92] hover:bg-[#8fae92]/25"
                      >
                        <FileText className="h-3.5 w-3.5" /> Poglej potrdilo
                      </a>
                    ) : null}
                    <label
                      className={`flex cursor-pointer items-center gap-1 rounded-lg px-3 py-2 text-xs ${
                        l.doctorCertificatePath
                          ? 'bg-white/5 text-white/60 hover:bg-white/10'
                          : 'bg-[#b7a0d4]/20 text-[#d4c4ea] hover:bg-[#b7a0d4]/30'
                      } ${uploadingId === l.id ? 'pointer-events-none opacity-60' : ''}`}
                    >
                      <Upload className="h-3.5 w-3.5" />
                      {uploadingId === l.id
                        ? 'Nalagam…'
                        : l.doctorCertificatePath
                          ? 'Zamenjaj potrdilo'
                          : 'Potrdilo zdravnika'}
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        className="hidden"
                        onChange={e => {
                          const f = e.target.files?.[0]
                          if (f) handleUploadCertificate(l.id, f)
                          e.target.value = ''
                        }}
                      />
                    </label>
                  </>
                ) : (
                  <>
                    {l.signedDocumentPath ? (
                      <a
                        href={`/api/image?pathname=${encodeURIComponent(l.signedDocumentPath)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 rounded-lg bg-[#8fae92]/15 px-3 py-2 text-xs text-[#8fae92] hover:bg-[#8fae92]/25"
                      >
                        <FileText className="h-3.5 w-3.5" /> Poglej
                      </a>
                    ) : null}
                    <label
                      className={`flex cursor-pointer items-center gap-1 rounded-lg px-3 py-2 text-xs ${
                        l.signedDocumentPath
                          ? 'bg-white/5 text-white/60 hover:bg-white/10'
                          : 'bg-[#7fa8b8]/15 text-[#7fa8b8] hover:bg-[#7fa8b8]/25'
                      } ${uploadingId === l.id ? 'pointer-events-none opacity-60' : ''}`}
                    >
                      <Upload className="h-3.5 w-3.5" />
                      {uploadingId === l.id
                        ? 'Nalagam…'
                        : l.signedDocumentPath
                          ? 'Zamenjaj'
                          : 'Dodaj podpisano'}
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        className="hidden"
                        onChange={e => {
                          const f = e.target.files?.[0]
                          if (f) handleUploadSigned(l.id, f)
                          e.target.value = ''
                        }}
                      />
                    </label>
                  </>
                )}
                <button
                  onClick={() => handlePrint(l)}
                  className="flex items-center gap-1 rounded-lg bg-white/5 px-3 py-2 text-xs text-white/70 hover:bg-white/10"
                >
                  <Printer className="h-3.5 w-3.5" /> Natisni
                </button>
                <button
                  onClick={() => handleDelete(l.id)}
                  className="flex items-center gap-1 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300 hover:bg-red-500/20"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            {longLeave && (
              <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-white/10 pt-3">
                {pay ? (
                  <div className="w-full space-y-1 text-[12px] leading-relaxed text-white/70">
                    <p className="text-[10px] uppercase tracking-wider text-white/40">Plačilo dopusta vnaprej</p>
                    <p>Plača za cel mesec je <span className="text-white">{formatAr(pay.salaryAr)}</span>.</p>
                    <p>
                      {oneMonth
                        ? `Po razporedu je v mesecu ${MONTHS_SL[oneMonth.month - 1]} ${oneMonth.scheduledDays} delovnih dni.`
                        : `Po razporedu je v teh mesecih skupaj ${pay.scheduledDays} delovnih dni.`}
                    </p>
                    {workedBefore.length > 0 && (
                      <p>Do začetka dopusta je po razporedu {workedBefore.length} delovnih dni ({compactRanges(workedBefore)}).</p>
                    )}
                    {workedAfter.length > 0 && (
                      <p>Po dopustu je po razporedu še {workedAfter.length} delovnih dni ({compactRanges(workedAfter)}).</p>
                    )}
                    {pay.freeDates.length > 0 && (
                      <p>Prosti dnevi ostanejo prosti in niso dopust: {joinSl(pay.freeDates.map(d => dayLabel(d, true)))}.</p>
                    )}
                    <p>Dopust je {pay.leaveWorkDays} delovnih dni.</p>
                    <p className="text-base font-medium text-[#c59b5b]">
                      {oneMonth
                        ? `Plačilo vnaprej: ${formatAr(pay.salaryAr)} × ${oneMonth.leaveWorkDays} / ${oneMonth.scheduledDays} = ${formatAr(pay.amountAr)}`
                        : `Plačilo vnaprej: ${formatAr(pay.amountAr)}`}
                    </p>
                  </div>
                ) : (
                  <div>
                    <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/40">Plačilo dopusta vnaprej (Ar)</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={advanceValue(l)}
                      onChange={e => {
                        setAdvanceError(null)
                        setAdvanceInputs(prev => ({ ...prev, [l.id]: e.target.value }))
                      }}
                      placeholder="npr. 450000"
                      className="w-40 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-[#c59b5b]/50 focus:outline-none"
                    />
                  </div>
                )}
                <button
                  onClick={() => handlePrintAdvance(l, pay)}
                  className="flex items-center gap-1 rounded-lg bg-[#c59b5b]/20 px-3 py-2 text-xs font-medium text-[#c59b5b] hover:bg-[#c59b5b]/30"
                >
                  <Printer className="h-3.5 w-3.5" /> Natisni potrdilo
                </button>
                <p className="w-full text-[11px] text-white/40">
                  Plača je za mesec nazaj. Pri tako dolgem dopustu delavec s podpisom potrdi, da je plačilo za cel dopust prejel vnaprej.
                </p>
                {advanceError === l.id && (
                  <p className="w-full text-[11px] text-amber-300">
                    {pay ? 'Po razporedu ni delovnih dni dopusta, zato zneska ni.' : 'Najprej vpiši znesek v ariarijih.'}
                  </p>
                )}
              </div>
            )}
            </div>
            )
          })}
        </div>
      )}
    </details>

      {/* Tiskovni dokument (skrit, viden samo pri tisku) — IZVEN no-print ovoja */}
      {printDoc && printCompany && printKind === 'advance' && (
        <div className="leave-print">
          <div className="doc-page">
            <div className="doc-header">
              <img src="/images/komba-logo-color.png" alt="Komba Cabana" className="doc-logo" />
              <p className="doc-company">{printCompany.name}</p>
              <p className="doc-location">{printCompany.address}</p>
              <p className="doc-location">Nosy Komba, Madagascar</p>
            </div>
            <div className="doc-title-block">
              <p className="doc-title">REÇU DE PAIEMENT ANTICIPÉ DU CONGÉ</p>
              <p className="doc-subtitle">Potrdilo o vnaprejšnjem plačilu dopusta / Advance leave payment receipt</p>
            </div>
            <div className="doc-fields">
              <p><span className="doc-label">Nom / Ime / Name :</span>
                {' '}
                {printStaff
                  ? `${printStaff.lastName || ''} ${printStaff.firstName || ''}`.trim() || printDoc.staffName
                  : printDoc.staffName}
              </p>
              <p><span className="doc-label">Poste / Delovno mesto :</span> {LEAVE_DEPARTMENTS[department].fr}</p>
              <p><span className="doc-label">Période / Obdobje :</span> {leaveDateFr(String(printDoc.startDate).slice(0, 10))} – {leaveDateFr(String(printDoc.endDate).slice(0, 10))} ({printDoc.days} jours)</p>
            </div>
            <p className="doc-amount">{formatAr(printDoc.advancePayAr || 0)}</p>
            {printPay && printPay.months.length === 1 && (
              <>
                <p className="doc-para">
                  Calcul selon le planning : salaire du mois entier {formatAr(printPay.salaryAr)} × {printPay.months[0].leaveWorkDays} jours de congé / {printPay.months[0].scheduledDays} jours de travail prévus. Les jours de repos ne sont pas comptés comme congé.
                </p>
                <p className="doc-para doc-para-en">
                  Izračun po razporedu: plača za cel mesec {formatAr(printPay.salaryAr)} × {printPay.months[0].leaveWorkDays} dni dopusta / {printPay.months[0].scheduledDays} predvidenih delovnih dni. Prosti dnevi niso dopust.
                </p>
              </>
            )}
            <p className="doc-para">
              Je soussigné(e) confirme avoir reçu à l&apos;avance le paiement de la totalité de mon congé payé pour la période indiquée. Le salaire étant versé pour le mois précédent, ce montant couvre le congé de ce mois.
            </p>
            <p className="doc-para">Par ma signature, je confirme avoir reçu ce paiement.</p>
            <p className="doc-para doc-para-en">S podpisom potrjujem, da sem vnaprej prejel(a) plačilo za celoten plačani dopust.</p>
            <p className="doc-para doc-para-en">By signing I confirm that I have received this payment for the whole paid leave in advance.</p>
            <p className="doc-para">Fait à Nosy Komba, le {leaveDateFr(todayStr())}.</p>
            <div className="doc-signatures">
              <div>
                <div className="doc-sign-line">L&apos;employé(e)<br />Podpis delavca / The employee</div>
              </div>
              <div>
                <div className="doc-sign-line">Date<br />Datum / Date</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {printDoc && printCompany && printKind === 'leave' && (
        <div className="leave-print">
          <div className="doc-page">
            <div className="doc-header">
              <img src="/images/komba-logo-color.png" alt="Komba Cabana" className="doc-logo" />
              <p className="doc-company">{printCompany.name}</p>
              <p className="doc-location">{printCompany.address}</p>
              <p className="doc-location">Nosy Komba, Madagascar</p>
            </div>

            <div className="doc-title-block">
              <p className="doc-title">AUTORISATION DE CONGÉ</p>
              <p className="doc-title-en">LEAVE AUTHORISATION</p>
              <p className="doc-subtitle">
                {LEAVE_TYPES[printDoc.leaveType as LeaveType]?.fr} / {LEAVE_TYPES[printDoc.leaveType as LeaveType]?.en}
              </p>
            </div>

            <div className="doc-fields">
              <p><span className="doc-label">Nom et prénom / Full name :</span>
                {' '}
                {printStaff
                  ? `${printStaff.lastName || ''} ${printStaff.firstName || ''}`.trim() || printDoc.staffName
                  : printDoc.staffName}
              </p>
              {printStaff?.dateOfBirth && (
                <p><span className="doc-label">Date de naissance / Date of birth :</span> {leaveDateFr(printStaff.dateOfBirth)}</p>
              )}
              {printStaff?.placeOfBirth && (
                <p><span className="doc-label">Lieu de naissance / Place of birth :</span> {printStaff.placeOfBirth}</p>
              )}
              {printStaff?.documentNumber && (
                <p><span className="doc-label">N° pièce d&apos;identité / ID number :</span> {printStaff.documentNumber}</p>
              )}
              <p><span className="doc-label">Poste / Position :</span> {LEAVE_DEPARTMENTS[department].fr} / {LEAVE_DEPARTMENTS[department].en}</p>
            </div>

            <p className="doc-para">
              {`L'employé(e) susnommé(e) est autorisé(e) à prendre un ${LEAVE_TYPES[printDoc.leaveType as LeaveType]?.fr.toLowerCase()} `}
              <strong>{`du ${leaveDateFr(printDoc.startDate)} au ${leaveDateFr(printDoc.endDate)}`}</strong>
              {`, soit ${printDoc.days} jour(s).`}
            </p>
            <p className="doc-para doc-para-en">
              {`The above-named employee is authorised to take ${LEAVE_TYPES[printDoc.leaveType as LeaveType]?.en.toLowerCase()} `}
              <strong>{`from ${leaveDateFr(printDoc.startDate)} to ${leaveDateFr(printDoc.endDate)}`}</strong>
              {`, i.e. ${printDoc.days} day(s).`}
            </p>

            {printDoc.reason && (
              <p className="doc-para">
                <span className="doc-label">Observation / Note :</span> {printDoc.reason}
              </p>
            )}

            <div className="doc-signatures">
              <div>
                <div className="doc-sign-line">L&apos;employé(e) / The employee</div>
              </div>
              <div>
                <div className="doc-sign-line">L&apos;employeur / The employer</div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .leave-print { display: none; }

        @media print {
          @page { size: portrait; margin: 14mm; }
          body { background: #fff !important; }
          .no-print { display: none !important; }

          body.printing-leave * { visibility: hidden; }
          body.printing-leave .leave-print,
          body.printing-leave .leave-print * { visibility: visible; }
          body.printing-leave .leave-print {
            display: block !important;
            position: absolute; left: 0; top: 0; width: 100%;
          }

          .leave-print .doc-page { color: #111; font-family: Georgia, 'Times New Roman', serif; }
          .leave-print .doc-header { text-align: center; border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 4px; }
          .leave-print .doc-logo { display: block; margin: 0 auto; height: 56px; width: auto; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .leave-print .doc-company { font-size: 14px; font-weight: 700; letter-spacing: 0.5px; margin: 6px 0 0; }
          .leave-print .doc-location { font-size: 12px; font-style: italic; color: #333; margin: 2px 0 0; }
          .leave-print .doc-title-block { text-align: center; border-bottom: 1px solid #111; padding-bottom: 10px; margin-bottom: 16px; }
          .leave-print .doc-title { font-size: 20px; font-weight: 700; letter-spacing: 1px; margin: 12px 0 0; }
          .leave-print .doc-title-en { font-size: 14px; font-weight: 700; letter-spacing: 1px; color: #444; margin: 2px 0 0; }
          .leave-print .doc-subtitle { font-size: 12px; color: #777; margin: 3px 0 0; }
          .leave-print .doc-fields { font-size: 13px; line-height: 1.8; margin-bottom: 16px; }
          .leave-print .doc-fields p { margin: 0; }
          .leave-print .doc-label { display: inline-block; min-width: 220px; }
          .leave-print .doc-para { font-size: 13px; line-height: 1.8; margin: 8px 0 12px; }
          .leave-print .doc-para-en { color: #444; font-style: italic; }
          .leave-print .doc-signatures { display: flex; justify-content: space-between; margin-top: 64px; gap: 40px; }
          .leave-print .doc-signatures > div { flex: 1; }
          .leave-print .doc-sign-line { border-top: 1px solid #111; padding-top: 4px; font-size: 12px; text-align: center; }
          .leave-print .doc-amount { text-align: center; font-size: 22px; font-weight: 700; margin: 8px 0 16px; letter-spacing: 0.5px; }
        }
      `}</style>
    </>
  )
}
