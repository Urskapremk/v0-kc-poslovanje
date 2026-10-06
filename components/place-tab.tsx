'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { createPortal } from 'react-dom'
import useSWR from 'swr'
  import { Printer, Wallet, AlertTriangle, Check, Receipt, ChevronDown, ChevronUp, Save, Palmtree, LogOut, ImageIcon, Upload, X, Trash2, CalendarClock, Mail, Send, History, Sparkles, ClipboardPaste, Search, Coins } from 'lucide-react'
import { getAllStaffMembers, setPriorLeaveYear } from '@/app/actions/statistics'
import {
  getPayrollEntries,
  upsertPayrollEntry,
  getQuarterlyContributions,
  setContributionPaid,
  getPayrollSettings,
  getAllStaffPayrollInfo,
  getStaffLeaveSummaries,
  getAttendanceImages,
  saveAttendanceImage,
  deleteAttendanceImage,
  getPayslipImages,
  savePayslipImage,
  deletePayslipImage,
  getPayslipExtraImages,
  addPayslipExtraImage,
  deletePayslipExtraImage,
  getAttendanceDays,
  saveAttendanceDay,
  getSignedLeaveDays,
  getPlannedWorkDays,
  markSalaryPaidCash,
  unmarkSalaryPaidCash,
  setStaffTips,
  setTipsForAll,
} from '@/app/actions/payroll'
import {
  getAttendanceReportPreview,
  sendAttendanceReport,
  getCombinedReportPreview,
  sendCombinedReport,
} from '@/app/actions/attendance-email'
import { parseAttendanceFromImage } from '@/app/actions/attendance-parse'
import { AccountingEmailsBox } from '@/components/accounting-emails-box'
import {
  computeAttendanceSummary,
  computeNorm,
  MONTHLY_NORM_HOURS,
  LEAVE_DAY_HOURS,
  formatHours,
  daysInMonth as getDaysInMonth,
  WEEKDAYS_SL_SHORT,
  type AttendanceMonth,
  type AttendanceStatus,
} from '@/lib/attendance'
import {
  calcPayslip,
  getQuarter,
  getQuarterDeadline,
  DEFAULT_NET_SALARY,
  DEFAULT_PAYROLL_SETTINGS,
  formatAr,
  getCompany,
  type PayslipInput,
  type PayrollSettings,
} from '@/lib/payroll'
  import { dailyLeaveAllowance, type LeaveSummary } from '@/lib/leave'

const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

const QUARTER_DEADLINE_LABEL: Record<number, string> = {
  1: 'do konca aprila',
  2: 'do konca julija',
  3: 'do konca oktobra',
  4: 'do konca januarja (naslednje leto)',
}

function formatDateSl(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('sl-SI', { day: 'numeric', month: 'long', year: 'numeric' })
}

function formatDateFr(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// Kartica povzetka v obracunu ur prisotnosti.
function SummaryCell({
  label,
  value,
  sub,
  color = '#e8e3d9',
  strong = false,
}: {
  label: string
  value: string
  sub?: string
  color?: string
  strong?: boolean
}) {
  return (
    <div className={`rounded-lg border p-2 ${strong ? 'border-[#c59b5b]/30 bg-[#c59b5b]/[0.06]' : 'border-white/10 bg-white/[0.03]'}`}>
      <p className="text-[10px] uppercase tracking-wide text-white/40">{label}</p>
      <p className="text-lg font-bold leading-tight" style={{ color }}>{value}</p>
      {sub && <p className="text-[10px] text-white/40">{sub}</p>}
    </div>
  )
}

// Mesecni vnos delavca (obrazec)
type EntryForm = {
  baseGrossSalary: number
  overtimeFirst8Hours: number
  overtimeAfter8Hours: number
  nightRegularHours: number
  nightOccasionalHours: number
  sundayHours: number
  publicHolidayHours: number
  bonuses: number
  taxableBenefits: number
  unusedLeaveCompensation: number
  employeeAdvances: number
  otherEmployeeDeductions: number
  netPayout: number
}

const EMPTY_FORM: EntryForm = {
  baseGrossSalary: DEFAULT_NET_SALARY,
  overtimeFirst8Hours: 0,
  overtimeAfter8Hours: 0,
  nightRegularHours: 0,
  nightOccasionalHours: 0,
  sundayHours: 0,
  publicHolidayHours: 0,
  bonuses: 0,
  taxableBenefits: 0,
  unusedLeaveCompensation: 0,
  employeeAdvances: 0,
  otherEmployeeDeductions: 0,
  netPayout: 0,
}

type PrintStaff = {
  id: string
  name: string
  form: EntryForm
  dependents: number
  firstName: string
  lastName: string
  dateOfBirth: string | null
  placeOfBirth: string
  documentNumber: string
  company: string
  position: string
  cnapsNumber: string
  leave: LeaveSummary | null
}

export default function PlaceTab({
  year,
  month,
  initialQuarter,
}: {
  year: number
  month: number
  // Set when arriving from a contribution deadline alert, so the quarter shown
  // is the one the alert is about rather than the current one.
  initialQuarter?: number
}) {
  const [printStaff, setPrintStaff] = useState<PrintStaff | null>(null)
  const [printOther, setPrintOther] = useState<{
    name: string
    firstName: string
    lastName: string
    company: string
    position: string
    documentNumber: string
    amount: number
  } | null>(null)
  const [selectedQuarter, setSelectedQuarter] = useState<number>(initialQuarter ?? getQuarter(month))
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [staffSearch, setStaffSearch] = useState('')
  const [drafts, setDrafts] = useState<Record<string, EntryForm>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})

  const { data: allStaff } = useSWR('all-staff', () => getAllStaffMembers(), { refreshInterval: 0 })
  const { data: settings } = useSWR('payroll-settings', () => getPayrollSettings(), { refreshInterval: 0 })
  const { data: staffInfo } = useSWR('staff-payroll-info', () => getAllStaffPayrollInfo(), { refreshInterval: 0 })

  const { data: entries, mutate: mutateEntries } = useSWR(
    ['payroll', year, month],
    () => getPayrollEntries(year, month),
    { refreshInterval: 0 }
  )

  const { data: quarterly, mutate: mutateQuarterly } = useSWR(
    ['quarterly', year, selectedQuarter],
    () => getQuarterlyContributions(year, selectedQuarter),
    { refreshInterval: 0 }
  )

  const { data: leaveSummaries, mutate: mutateLeave } = useSWR(
    ['leave-summaries', year, month],
    () => getStaffLeaveSummaries(year, month),
    { refreshInterval: 0 }
  )

  // Shrani dopust preteklih let za DOLOCENO leto (2025/2024/2023) za delavca.
  const [savingPriorLeave, setSavingPriorLeave] = useState<string | null>(null)
  const handleSavePriorLeave = async (staffId: string, yearKey: number, value: number) => {
    setSavingPriorLeave(staffId)
    try {
      await setPriorLeaveYear(staffId, yearKey, value)
      await mutateLeave()
    } finally {
      setSavingPriorLeave(null)
    }
  }

  // Slike list prisotnosti (po delavcu za izbrani mesec)
  const { data: attendanceImages, mutate: mutateAttendance } = useSWR(
    ['attendance-images', year, month],
    () => getAttendanceImages(year, month),
    { refreshInterval: 0 }
  )
  const [uploadingAttendance, setUploadingAttendance] = useState<Record<string, boolean>>({})
  const [parsingAttendance, setParsingAttendance] = useState<Record<string, boolean>>({})
  const [parseMsg, setParseMsg] = useState<Record<string, string>>({})
  const [previewImage, setPreviewImage] = useState<{ name: string; pathname: string } | null>(null)

  const handleAttendanceUpload = async (staffId: string, file: File) => {
    setUploadingAttendance((p) => ({ ...p, [staffId]: true }))
    setParseMsg((p) => ({ ...p, [staffId]: '' }))
    let uploadedPathname: string | null = null
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/upload-attendance-image', { method: 'POST', body: fd })
      if (!res.ok) throw new Error('Upload failed')
      const { pathname } = await res.json()
      uploadedPathname = pathname
      await saveAttendanceImage(staffId, year, month, file.name, pathname)
      await mutateAttendance()
    } catch (e) {
      window.alert('Nalaganje slike ni uspelo.')
    } finally {
      setUploadingAttendance((p) => ({ ...p, [staffId]: false }))
    }
    // Samodejna AI razclemba slike -> obračun ur.
    if (uploadedPathname) {
      await autoParseAttendance(staffId, uploadedPathname)
    }
  }

  // Prebere naloženo sliko z AI in samodejno napolni tabelo obračuna ur.
  const autoParseAttendance = async (staffId: string, pathname: string) => {
    setParsingAttendance((p) => ({ ...p, [staffId]: true }))
    setParseMsg((p) => ({ ...p, [staffId]: 'Berem listo prisotnosti z AI...' }))
    try {
      const result = await parseAttendanceFromImage(staffId, year, month, pathname)
      if (!result.ok) {
        setParseMsg((p) => ({ ...p, [staffId]: result.error || 'Razclemba ni uspela.' }))
        return
      }
      // Pocisti lokalni osnutek za tega delavca -> prikaz prebere sveze iz baze.
      setAttDraft((s) => {
        const next = { ...s }
        delete next[staffId]
        return next
      })
      await mutateAttendanceDays()
      setAttDetailOpen((s) => ({ ...s, [staffId]: true }))
      const { workDays, leaveDays, offDays } = result.summary
      setParseMsg((p) => ({
        ...p,
        [staffId]: `Obračun ur ustvarjen: ${workDays} delovnih dni, ${leaveDays} dopust, ${offDays} prosto. Preverite in po potrebi popravite.`,
      }))
    } catch (e) {
      setParseMsg((p) => ({ ...p, [staffId]: 'Razclemba ni uspela. Poskusite znova.' }))
    } finally {
      setParsingAttendance((p) => ({ ...p, [staffId]: false }))
    }
  }

  const handleAttendanceDelete = async (staffId: string) => {
    if (!window.confirm('Odstraniti sliko liste prisotnosti za ta mesec?')) return
    await deleteAttendanceImage(staffId, year, month)
    await mutateAttendance()
  }

  // Slike podpisanih placilnih list (po delavcu za izbrani mesec)
  const { data: payslipImages, mutate: mutatePayslip } = useSWR(
    ['payslip-images', year, month],
    () => getPayslipImages(year, month),
    { refreshInterval: 0 }
  )
  const [uploadingPayslip, setUploadingPayslip] = useState<Record<string, boolean>>({})

  const handlePayslipUpload = async (staffId: string, file: File) => {
    setUploadingPayslip((p) => ({ ...p, [staffId]: true }))
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/upload-payslip-image', { method: 'POST', body: fd })
      if (!res.ok) throw new Error('Upload failed')
      const { pathname } = await res.json()
      await savePayslipImage(staffId, year, month, file.name, pathname)
      await mutatePayslip()
    } catch (e) {
      window.alert('Nalaganje plačilne liste ni uspelo.')
    } finally {
      setUploadingPayslip((p) => ({ ...p, [staffId]: false }))
    }
  }

  const handlePayslipDelete = async (staffId: string) => {
    if (!window.confirm('Odstraniti podpisano plačilno listo za ta mesec?')) return
    await deletePayslipImage(staffId, year, month)
    await mutatePayslip()
  }

  // Prebere sliko (posnetek zaslona) iz odložišča in vrne datoteko, ali null.
  const readImageFromClipboard = async (): Promise<File | null> => {
    try {
      if (!navigator.clipboard || !navigator.clipboard.read) {
        window.alert('Vaš brskalnik ne podpira lepljenja iz odložišča. Uporabite gumb za nalaganje datoteke.')
        return null
      }
      const items = await navigator.clipboard.read()
      for (const item of items) {
        const type = item.types.find((t) => t.startsWith('image/'))
        if (type) {
          const blob = await item.getType(type)
          const ext = type.split('/')[1] || 'png'
          return new File([blob], `posnetek-${Date.now()}.${ext}`, { type })
        }
      }
      window.alert('V odložišču ni slike. Najprej naredite posnetek zaslona (Print Screen), nato kliknite Prilepi posnetek.')
      return null
    } catch {
      window.alert('Lepljenje iz odložišča ni uspelo. Dovolite dostop do odložišča ali uporabite nalaganje datoteke.')
      return null
    }
  }

  const handlePayslipPaste = async (staffId: string) => {
    const file = await readImageFromClipboard()
    if (file) await handlePayslipUpload(staffId, file)
  }

  const handleAttendancePaste = async (staffId: string) => {
    const file = await readImageFromClipboard()
    if (file) await handleAttendanceUpload(staffId, file)
  }

  // Dodatni dokumenti k placilni listi (vec na delavca za izbrani mesec)
  const { data: payslipExtraImages, mutate: mutatePayslipExtra } = useSWR(
    ['payslip-extra-images', year, month],
    () => getPayslipExtraImages(year, month),
    { refreshInterval: 0 }
  )
  const [uploadingPayslipExtra, setUploadingPayslipExtra] = useState<Record<string, boolean>>({})

  const handlePayslipExtraUpload = async (staffId: string, file: File) => {
    setUploadingPayslipExtra((p) => ({ ...p, [staffId]: true }))
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/upload-payslip-image', { method: 'POST', body: fd })
      if (!res.ok) throw new Error('Upload failed')
      const { pathname } = await res.json()
      await addPayslipExtraImage(staffId, year, month, file.name, pathname)
      await mutatePayslipExtra()
    } catch (e) {
      window.alert('Nalaganje dokumenta ni uspelo.')
    } finally {
      setUploadingPayslipExtra((p) => ({ ...p, [staffId]: false }))
    }
  }

  const handlePayslipExtraDelete = async (id: string) => {
    if (!window.confirm('Odstraniti ta dokument?')) return
    await deletePayslipExtraImage(id)
    await mutatePayslipExtra()
  }

  const handlePayslipExtraPaste = async (staffId: string) => {
    const file = await readImageFromClipboard()
    if (file) await handlePayslipExtraUpload(staffId, file)
  }

  // --- Dnevni obracun ur prisotnosti (tabela po dnevih) ---
  const { data: attendanceDays, mutate: mutateAttendanceDays } = useSWR(
    ['attendance-days', year, month],
    () => getAttendanceDays(year, month),
    { refreshInterval: 0 }
  )
  // Podpisani (odobreni) dopusti iz razporeda za primerjavo z vneseno prisotnostjo.
  const { data: signedLeave } = useSWR(
    ['signed-leave-days', year, month],
    () => getSignedLeaveDays(year, month),
    { refreshInterval: 0 }
  )
  // Nacrtovani delovni dnevi iz razporeda (plan) po IMENU delavca.
  const { data: plannedDays } = useSWR(
    ['planned-work-days', year, month],
    () => getPlannedWorkDays(year, month),
    { refreshInterval: 0 }
  )
  // Lokalni osnutek vnosov (da urejanje ne izgubi fokusa); resetira se ob menjavi obdobja.
  const [attDraft, setAttDraft] = useState<Record<string, AttendanceMonth>>({})
  const [attDetailOpen, setAttDetailOpen] = useState<Record<string, boolean>>({})
  useEffect(() => { setAttDraft({}) }, [year, month])

  const getEntries = (staffId: string): AttendanceMonth => {
    if (attDraft[staffId]) return attDraft[staffId]
    const fromDb = attendanceDays?.[staffId]
    if (!fromDb) return {}
    const conv: AttendanceMonth = {}
    for (const [d, v] of Object.entries(fromDb)) {
      conv[Number(d)] = {
        status: (v.status as AttendanceStatus) || 'work',
        from: v.from,
        to: v.to,
        breakMinutes: v.breakMinutes ?? 0,
      }
    }
    return conv
  }

  const setDay = (
    staffId: string,
    day: number,
    patch: Partial<{ status: AttendanceStatus | null; from: string | null; to: string | null; breakMinutes: number }>,
  ) => {
    const current = getEntries(staffId)
    const prev = current[day] ?? { status: 'work' as AttendanceStatus, from: null, to: null, breakMinutes: 0 }
    const nextStatus = patch.status !== undefined ? patch.status : prev.status
    const next = { ...current }
    if (!nextStatus) {
      delete next[day]
    } else {
      next[day] = {
        status: nextStatus,
        from: patch.from !== undefined ? patch.from : prev.from,
        to: patch.to !== undefined ? patch.to : prev.to,
        breakMinutes: patch.breakMinutes !== undefined ? patch.breakMinutes : (prev.breakMinutes ?? 0),
      }
    }
    setAttDraft((s) => ({ ...s, [staffId]: next }))
    const row = next[day]
    saveAttendanceDay(staffId, year, month, day, row?.status ?? null, row?.from ?? null, row?.to ?? null, row?.breakMinutes ?? 0)
  }

  // Vpiši podpisane dneve dopusta iz razporeda kot 'leave' (samo dni, ki še niso dopust).
  const handleApplySignedLeave = async (staffId: string, days: number[]) => {
    const current = getEntries(staffId)
    const next = { ...current }
    let changed = 0
    for (const d of days) {
      if (next[d]?.status === 'leave') continue
      next[d] = { status: 'leave', from: null, to: null }
      changed++
      await saveAttendanceDay(staffId, year, month, d, 'leave', null, null)
    }
    setAttDraft((s) => ({ ...s, [staffId]: next }))
    if (changed === 0) window.alert('Vsi podpisani dnevi dopusta so že vpisani.')
  }

  // Email predogled obracuna za racunovodstvo
  const [reportPreview, setReportPreview] = useState<
    { staffId: string; staffName: string; html: string; to: string; combined?: boolean } | null
  >(null)
  const [loadingReport, setLoadingReport] = useState<string | null>(null)
  const [loadingCombined, setLoadingCombined] = useState(false)
  const [sendingReport, setSendingReport] = useState(false)
  const [showEmails, setShowEmails] = useState(false)
  const [emailsRefresh, setEmailsRefresh] = useState(0)

  const handleOpenReport = async (staffId: string) => {
    setLoadingReport(staffId)
    try {
      const res = await getAttendanceReportPreview(staffId, year, month)
      if (res.error || !res.html) {
        window.alert(res.error || 'Predogleda ni bilo mogoče pripraviti.')
        return
      }
      setReportPreview({
          staffId,
          staffName: res.staffName || 'Delavec',
          html: res.html,
          to: res.to || '',
        })
    } finally {
      setLoadingReport(null)
    }
  }

  const handleOpenCombined = async () => {
    setLoadingCombined(true)
    try {
      const res = await getCombinedReportPreview(year, month)
      if (res.error || !res.html) {
        window.alert(res.error || 'Predogleda ni bilo mogoče pripraviti.')
        return
      }
      setReportPreview({
        staffId: '',
        staffName: 'vsi zaposleni',
        html: res.html,
        to: res.to || '',
        combined: true,
      })
    } finally {
      setLoadingCombined(false)
    }
  }

  const handleSendReport = async () => {
    if (!reportPreview) return
    if (!reportPreview.to.trim()) {
      window.alert('Vpiši email naslov računovodstva.')
      return
    }
    setSendingReport(true)
    try {
      const res = reportPreview.combined
        ? await sendCombinedReport(year, month, reportPreview.to.trim())
        : await sendAttendanceReport(reportPreview.staffId, year, month, reportPreview.to.trim())
      if (res.success) {
        window.alert('Obračun ur je bil poslan računovodstvu.')
        setReportPreview(null)
        setEmailsRefresh((n) => n + 1)
        setShowEmails(true)
      } else {
        window.alert(res.error || 'Pošiljanje ni uspelo.')
      }
    } finally {
      setSendingReport(false)
    }
  }

  // Natisni sliko liste prisotnosti (samo slika, cez celo stran)
  const handlePrintAttendance = () => {
    const img = document.querySelector<HTMLImageElement>('.attendance-print img')
    const doPrint = () => {
      document.body.classList.add('printing-attendance')
      window.print()
      document.body.classList.remove('printing-attendance')
    }
    // pocakaj da se slika nalozi (drugace se natisne prazno)
    if (img && !img.complete) {
      img.addEventListener('load', () => setTimeout(doPrint, 50), { once: true })
      img.addEventListener('error', () => setTimeout(doPrint, 50), { once: true })
    } else {
      setTimeout(doPrint, 50)
    }
  }

  // Kontrola za nalaganje/ogled slike liste prisotnosti (na delavca + mesec)
  const renderAttendanceControl = (staffId: string) => {
    const img = attendanceImages?.[staffId]
    const inputId = `att-file-${staffId}`
    const busy = uploadingAttendance[staffId]
    const detailOpen = !!attDetailOpen[staffId]
    return (
      <div className="mt-3 border-t border-white/[0.06] pt-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-white/40">
            <ImageIcon className="h-3.5 w-3.5" /> Lista prisotnosti ({MONTHS_FR[month - 1]} {year})
          </span>
          {img ? (
            <>
              <button
                onClick={() => setPreviewImage({ name: img.fileName ?? 'Lista prisotnosti', pathname: img.pathname })}
                className="flex items-center gap-1 rounded-lg border border-[#7fa8b8]/30 bg-[#7fa8b8]/10 px-2.5 py-1 text-[11px] font-medium text-[#7fa8b8] transition hover:bg-[#7fa8b8]/20"
              >
                <ImageIcon className="h-3.5 w-3.5" /> Ogled
              </button>
              <label
                htmlFor={inputId}
                className="flex cursor-pointer items-center gap-1 rounded-lg border border-white/15 px-2.5 py-1 text-[11px] font-medium text-white/60 transition hover:bg-white/10 hover:text-white"
              >
                <Upload className="h-3.5 w-3.5" /> {busy ? 'Nalagam…' : 'Zamenjaj'}
              </label>
              <button
                onClick={() => handleAttendancePaste(staffId)}
                className="flex items-center gap-1 rounded-lg border border-[#8fae92]/30 bg-[#8fae92]/10 px-2.5 py-1 text-[11px] font-medium text-[#8fae92] transition hover:bg-[#8fae92]/20"
              >
                <ClipboardPaste className="h-3.5 w-3.5" /> Prilepi posnetek
              </button>
              <button
                onClick={() => autoParseAttendance(staffId, img.pathname)}
                disabled={busy || parsingAttendance[staffId]}
                className="flex items-center gap-1 rounded-lg border border-[#9ecbdd]/35 bg-[#9ecbdd]/10 px-2.5 py-1 text-[11px] font-medium text-[#9ecbdd] transition hover:bg-[#9ecbdd]/20 disabled:opacity-50"
                title="Ponovno razcleni sliko z AI in ustvari obračun ur"
              >
                <Sparkles className="h-3.5 w-3.5" /> {parsingAttendance[staffId] ? 'Berem…' : 'Razčleni z AI'}
              </button>
              <button
                onClick={() => handleAttendanceDelete(staffId)}
                className="flex items-center gap-1 rounded-lg border border-[#bc7d67]/25 px-2.5 py-1 text-[11px] font-medium text-[#bc7d67]/80 transition hover:bg-[#bc7d67]/10 hover:text-[#bc7d67]"
                aria-label="Odstrani sliko"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              {img.fileName && <span className="truncate text-[10px] text-white/30">{img.fileName}</span>}
            </>
          ) : (
            <>
              <label
                htmlFor={inputId}
                className="flex cursor-pointer items-center gap-1 rounded-lg border border-[#c59b5b]/30 bg-[#c59b5b]/10 px-2.5 py-1 text-[11px] font-medium text-[#c59b5b] transition hover:bg-[#c59b5b]/20"
              >
                <Upload className="h-3.5 w-3.5" /> {busy ? 'Nalagam…' : 'Dodaj sliko'}
              </label>
              <button
                onClick={() => handleAttendancePaste(staffId)}
                className="flex items-center gap-1 rounded-lg border border-[#8fae92]/30 bg-[#8fae92]/10 px-2.5 py-1 text-[11px] font-medium text-[#8fae92] transition hover:bg-[#8fae92]/20"
              >
                <ClipboardPaste className="h-3.5 w-3.5" /> {busy ? 'Nalagam…' : 'Prilepi posnetek'}
              </button>
            </>
          )}
          <input
            id={inputId}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleAttendanceUpload(staffId, f)
              e.target.value = ''
            }}
          />

          {/* obracun ur (tabela po dnevih) */}
          <button
            onClick={() => setAttDetailOpen((s) => ({ ...s, [staffId]: !s[staffId] }))}
            className={`ml-auto flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition ${
              detailOpen
                ? 'border-[#8fae92]/40 bg-[#8fae92]/15 text-[#8fae92]'
                : 'border-white/15 text-white/60 hover:bg-white/10 hover:text-white'
            }`}
          >
            <CalendarClock className="h-3.5 w-3.5" /> Obračun ur
            {detailOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>

        {(parsingAttendance[staffId] || parseMsg[staffId]) && (
          <div
            className={`mt-2 flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[11px] ${
              parsingAttendance[staffId]
                ? 'border-[#9ecbdd]/30 bg-[#9ecbdd]/10 text-[#9ecbdd]'
                : 'border-[#8fae92]/30 bg-[#8fae92]/10 text-[#8fae92]'
            }`}
          >
            <Sparkles className={`h-3.5 w-3.5 shrink-0 ${parsingAttendance[staffId] ? 'animate-pulse' : ''}`} />
            <span>{parseMsg[staffId] || 'Berem listo prisotnosti z AI...'}</span>
          </div>
        )}

        {detailOpen && renderAttendanceDetail(staffId)}
      </div>
    )
  }

  // Kontrola za nalaganje/ogled/zamenjavo podpisane placilne liste (po delavcu + mesecu)
  const renderPayslipControl = (staffId: string) => {
    const img = payslipImages?.[staffId]
    const inputId = `payslip-file-${staffId}`
    const busy = uploadingPayslip[staffId]
    const extras = payslipExtraImages?.[staffId] ?? []
    const extraInputId = `payslip-extra-file-${staffId}`
    const busyExtra = uploadingPayslipExtra[staffId]
    return (
      <div className="mt-2 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-white/40">
          <Receipt className="h-3.5 w-3.5" /> Podpisana plačilna lista ({MONTHS_FR[month - 1]} {year})
        </span>
        {img ? (
          <>
            <button
              onClick={() => setPreviewImage({ name: img.fileName ?? 'Plačilna lista', pathname: img.pathname })}
              className="flex items-center gap-1 rounded-lg border border-[#7fa8b8]/30 bg-[#7fa8b8]/10 px-2.5 py-1 text-[11px] font-medium text-[#7fa8b8] transition hover:bg-[#7fa8b8]/20"
            >
              <ImageIcon className="h-3.5 w-3.5" /> Ogled
            </button>
            <label
              htmlFor={inputId}
              className="flex cursor-pointer items-center gap-1 rounded-lg border border-white/15 px-2.5 py-1 text-[11px] font-medium text-white/60 transition hover:bg-white/10 hover:text-white"
            >
              <Upload className="h-3.5 w-3.5" /> {busy ? 'Nalagam…' : 'Zamenjaj'}
            </label>
            <button
              onClick={() => handlePayslipPaste(staffId)}
              className="flex items-center gap-1 rounded-lg border border-[#8fae92]/30 bg-[#8fae92]/10 px-2.5 py-1 text-[11px] font-medium text-[#8fae92] transition hover:bg-[#8fae92]/20"
            >
              <ClipboardPaste className="h-3.5 w-3.5" /> Prilepi posnetek
            </button>
            <button
              onClick={() => handlePayslipDelete(staffId)}
              className="flex items-center gap-1 rounded-lg border border-[#bc7d67]/25 px-2.5 py-1 text-[11px] font-medium text-[#bc7d67]/80 transition hover:bg-[#bc7d67]/10 hover:text-[#bc7d67]"
              aria-label="Odstrani plačilno listo"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
            {img.fileName && <span className="truncate text-[10px] text-white/30">{img.fileName}</span>}
          </>
        ) : (
          <>
            <label
              htmlFor={inputId}
              className="flex cursor-pointer items-center gap-1 rounded-lg border border-[#c59b5b]/30 bg-[#c59b5b]/10 px-2.5 py-1 text-[11px] font-medium text-[#c59b5b] transition hover:bg-[#c59b5b]/20"
            >
              <Upload className="h-3.5 w-3.5" /> {busy ? 'Nalagam…' : 'Naloži plačilno listo'}
            </label>
            <button
              onClick={() => handlePayslipPaste(staffId)}
              className="flex items-center gap-1 rounded-lg border border-[#8fae92]/30 bg-[#8fae92]/10 px-2.5 py-1 text-[11px] font-medium text-[#8fae92] transition hover:bg-[#8fae92]/20"
            >
              <ClipboardPaste className="h-3.5 w-3.5" /> {busy ? 'Nalagam…' : 'Prilepi posnetek'}
            </button>
          </>
        )}
        <input
          id={inputId}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handlePayslipUpload(staffId, f)
            e.target.value = ''
          }}
        />
      </div>

      {/* Dodatni dokumenti (potrdila o placilu ipd.) — vec na delavca/mesec */}
      <div className="flex flex-wrap items-center gap-2 pl-1">
        <span className="text-[11px] uppercase tracking-wider text-white/30">Dodatni dokumenti</span>
        {extras.map((doc) => (
          <span
            key={doc.id}
            className="flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-white/70"
          >
            <button
              onClick={() => setPreviewImage({ name: doc.fileName ?? 'Dokument', pathname: doc.pathname })}
              className="flex items-center gap-1 hover:text-white"
            >
              <ImageIcon className="h-3.5 w-3.5" />
              <span className="max-w-[140px] truncate">{doc.fileName ?? 'Dokument'}</span>
            </button>
            <button
              onClick={() => handlePayslipExtraDelete(doc.id)}
              className="text-[#bc7d67]/70 hover:text-[#bc7d67]"
              aria-label="Odstrani dokument"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </span>
        ))}
        <label
          htmlFor={extraInputId}
          className="flex cursor-pointer items-center gap-1 rounded-lg border border-[#8fae92]/30 bg-[#8fae92]/10 px-2.5 py-1 text-[11px] font-medium text-[#8fae92] transition hover:bg-[#8fae92]/20"
        >
          <Upload className="h-3.5 w-3.5" /> {busyExtra ? 'Nalagam…' : 'Dodaj dokument'}
        </label>
        <button
          onClick={() => handlePayslipExtraPaste(staffId)}
          className="flex items-center gap-1 rounded-lg border border-[#8fae92]/30 bg-[#8fae92]/10 px-2.5 py-1 text-[11px] font-medium text-[#8fae92] transition hover:bg-[#8fae92]/20"
        >
          <ClipboardPaste className="h-3.5 w-3.5" /> {busyExtra ? 'Nalagam…' : 'Prilepi posnetek'}
        </button>
        <input
          id={extraInputId}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handlePayslipExtraUpload(staffId, f)
            e.target.value = ''
          }}
        />
      </div>
      </div>
    )
  }

  // Dnevna tabela prisotnosti + povzetek obracuna za racunovodstvo
  const renderAttendanceDetail = (staffId: string) => {
    const entries = getEntries(staffId)
    const summary = computeAttendanceSummary(entries, year, month)
    const norm = computeNorm(summary)
    const dim = getDaysInMonth(year, month)

    // Primerjava s PODPISANIM dopustom iz razporeda
    const signedDays = signedLeave?.[staffId] ?? []
    const missingSignedLeave = signedDays.filter((d) => entries[d]?.status !== 'leave')

    // Primerjava z RAZPOREDOM (planom): plan pravi delo, a ni vpisano; ali plan prosto, a vpisano delo.
    const staffName = (allStaff || []).find((s) => s.id === staffId)?.staffName ?? ''
    const plan = plannedDays?.[staffName]
    let planMissingWork: number[] = [] // plan=delo, dejansko NI delo (in ni dopust)
    let planUnexpectedWork: number[] = [] // plan=prosto, dejansko DELO
    if (plan) {
      for (let d = 1; d <= dim; d++) {
        const planned = plan[d] // true=delo, false=prosto, undefined=ni v planu
        const actual = entries[d]?.status // 'work'|'leave'|'off'|undefined
        if (planned === true && actual !== 'work' && actual !== 'leave') planMissingWork.push(d)
        if (planned === false && actual === 'work') planUnexpectedWork.push(d)
      }
    }
    const planHasIssue = planMissingWork.length > 0 || planUnexpectedWork.length > 0

    return (
      <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
        {/* opozorilo: podpisan dopust iz razporeda se ne ujema z vpisom */}
        {signedDays.length > 0 && (
          <div
            className={`mb-3 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
              missingSignedLeave.length > 0
                ? 'border-amber-400/40 bg-amber-400/10 text-amber-300'
                : 'border-[#8fae92]/30 bg-[#8fae92]/10 text-[#8fae92]'
            }`}
          >
            {missingSignedLeave.length > 0 ? (
              <>
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>
                  Podpisan dopust v razporedu ({signedDays.map((d) => `${d}.`).join(' ')}), a{' '}
                  {missingSignedLeave.map((d) => `${d}.`).join(' ')} ni označen kot dopust.
                </span>
                <button
                  onClick={() => handleApplySignedLeave(staffId, signedDays)}
                  className="ml-auto rounded-md border border-amber-400/40 bg-amber-400/15 px-2.5 py-1 font-medium text-amber-200 transition hover:bg-amber-400/25"
                >
                  Vpiši dopust iz razporeda
                </button>
              </>
            ) : (
              <>
                <Check className="h-4 w-4 shrink-0" />
                <span>Ujema se s podpisanim dopustom v razporedu ({signedDays.map((d) => `${d}.`).join(' ')}).</span>
              </>
            )}
          </div>
        )}

        {/* opozorilo: odstopanje od RAZPOREDA (plana) */}
        {plan && planHasIssue && (
          <div className="mb-3 flex flex-wrap items-start gap-2 rounded-lg border border-[#7fa8b8]/40 bg-[#7fa8b8]/10 px-3 py-2 text-xs text-[#a6d4e6]">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="space-y-0.5">
              <p className="font-medium text-[#7fa8b8]">Odstopanje od razporeda (plana):</p>
              {planMissingWork.length > 0 && (
                <p>Po razporedu bi delal(a), a ni vpisano delo/dopust: {planMissingWork.map((d) => `${d}.`).join(' ')}</p>
              )}
              {planUnexpectedWork.length > 0 && (
                <p>Po razporedu prosto, a vpisano delo: {planUnexpectedWork.map((d) => `${d}.`).join(' ')}</p>
              )}
            </div>
          </div>
        )}

        {/* povzetek */}
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <SummaryCell label="Navadni dnevi" value={`${summary.normalDays}`} sub={formatHours(summary.normalHours)} />
          <SummaryCell label="Nedelja +dodatek" value={`${summary.sundayDays}`} sub={formatHours(summary.sundayHours)} color="#8ec6dc" />
          <SummaryCell label="Praznik +dodatek" value={`${summary.holidayDays}`} sub={formatHours(summary.holidayHours)} color="#d09f63" />
          <SummaryCell label="Dopust" value={`${summary.leaveDays}`} sub="dni" color="#8fae92" />
          <SummaryCell label="Prosti dnevi" value={`${summary.offDays}`} sub="dni" color="#9dafb5" />
          <SummaryCell label="Skupaj delo" value={`${summary.totalWorkDays}`} sub={formatHours(summary.totalWorkHours)} color="#c59b5b" strong />
        </div>

        {/* norma ur na mesec */}
        <div className="mb-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-wider text-white/40">
              Norma ur ({MONTHLY_NORM_HOURS.toFixed(2).replace('.', ',')} h/mesec · dopust = {LEAVE_DAY_HOURS} h/dan)
            </p>
            <span
              className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                norm.diff < -0.005
                  ? 'bg-[#bc7d67]/15 text-[#bc7d67]'
                  : 'bg-[#8fae92]/15 text-[#8fae92]'
              }`}
            >
              {norm.diff < -0.005
                ? `Manjka ${formatHours(Math.abs(norm.diff))}`
                : `Presežek ${formatHours(norm.diff)}`}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
            <div className="flex justify-between sm:block">
              <span className="text-white/40">Opravljeno</span>
              <span className="font-medium text-white/80 sm:ml-2">{formatHours(norm.workHours)}</span>
            </div>
            <div className="flex justify-between sm:block">
              <span className="text-white/40">Dopust ({norm.leaveDays} × {LEAVE_DAY_HOURS}h)</span>
              <span className="font-medium text-[#8fae92] sm:ml-2">{formatHours(norm.leaveHours)}</span>
            </div>
            <div className="flex justify-between sm:block">
              <span className="text-white/40">Skupaj priznano</span>
              <span className="font-semibold text-[#c59b5b] sm:ml-2">{formatHours(norm.creditedHours)}</span>
            </div>
            <div className="flex justify-between sm:block">
              <span className="text-white/40">Norma</span>
              <span className="font-medium text-white/80 sm:ml-2">{formatHours(norm.norm)}</span>
            </div>
          </div>
        </div>

        {/* tabela po dnevih */}
        <div className="max-h-[420px] overflow-auto rounded-lg border border-white/[0.06]">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-[#12232a] text-white/50">
              <tr>
                <th className="px-2 py-1.5 font-medium">Dan</th>
                <th className="px-2 py-1.5 font-medium">Status</th>
                <th className="px-2 py-1.5 font-medium">Od</th>
                <th className="px-2 py-1.5 font-medium">Do</th>
                <th className="px-2 py-1.5 font-medium">Odmor (min)</th>
                <th className="px-2 py-1.5 text-right font-medium">Ure</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: dim }, (_, i) => i + 1).map((day) => {
                const weekday = new Date(year, month - 1, day).getDay()
                const row = summary.rows[day - 1]
                const e = entries[day]
                const status = e?.status ?? ''
                const rowBg = row.holidayName ? 'bg-[#bc7d67]/[0.07]' : row.isSunday ? 'bg-[#7fa8b8]/[0.06]' : ''
                const hoursColor =
                  row.kind === 'holiday' ? 'text-[#d09f63]' : row.kind === 'sunday' ? 'text-[#7fa8b8]' : 'text-white/80'
                return (
                  <tr key={day} className={`border-t border-white/[0.05] ${rowBg}`}>
                    <td className="whitespace-nowrap px-2 py-1 text-white/70">
                      {day}. {WEEKDAYS_SL_SHORT[weekday]}
                      {row.holidayName && <span className="ml-1 text-[10px] text-[#c9a79b]">· {row.holidayName}</span>}
                      {!row.holidayName && row.isSunday && <span className="ml-1 text-[10px] text-[#8ec6dc]">· nedelja</span>}
                    </td>
                    <td className="px-2 py-1">
                      <select
                        value={status}
                        onChange={(ev) => setDay(staffId, day, { status: (ev.target.value || null) as AttendanceStatus | null })}
                        className="rounded-md border border-white/10 bg-white/5 px-1.5 py-1 text-xs text-white focus:border-[#8fae92]/40 focus:outline-none"
                      >
                        <option value="" className="bg-[#0b2731]">—</option>
                        <option value="work" className="bg-[#0b2731]">Delo</option>
                        <option value="leave" className="bg-[#0b2731]">Dopust</option>
                        <option value="off" className="bg-[#0b2731]">Prosto</option>
                      </select>
                    </td>
                    <td className="px-2 py-1">
                      <input
                        type="time"
                        defaultValue={e?.from ?? ''}
                        key={`from-${staffId}-${day}-${e?.from ?? ''}`}
                        disabled={status !== 'work'}
                        onBlur={(ev) => setDay(staffId, day, { from: ev.target.value || null })}
                        className="w-[92px] rounded-md border border-white/10 bg-white/5 px-1.5 py-1 text-xs text-white [color-scheme:dark] focus:border-[#8fae92]/40 focus:outline-none disabled:opacity-30"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        type="time"
                        defaultValue={e?.to ?? ''}
                        key={`to-${staffId}-${day}-${e?.to ?? ''}`}
                        disabled={status !== 'work'}
                        onBlur={(ev) => setDay(staffId, day, { to: ev.target.value || null })}
                        className="w-[92px] rounded-md border border-white/10 bg-white/5 px-1.5 py-1 text-xs text-white [color-scheme:dark] focus:border-[#8fae92]/40 focus:outline-none disabled:opacity-30"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        type="number"
                        min={0}
                        step={15}
                        inputMode="numeric"
                        defaultValue={e?.breakMinutes ? String(e.breakMinutes) : ''}
                        key={`brk-${staffId}-${day}-${e?.breakMinutes ?? 0}`}
                        disabled={status !== 'work'}
                        placeholder="0"
                        onBlur={(ev) => setDay(staffId, day, { breakMinutes: Math.max(0, Number.parseInt(ev.target.value || '0', 10) || 0) })}
                        className="w-[64px] rounded-md border border-white/10 bg-white/5 px-1.5 py-1 text-xs text-white focus:border-[#8fae92]/40 focus:outline-none disabled:opacity-30"
                      />
                    </td>
                    <td className={`whitespace-nowrap px-2 py-1 text-right font-medium ${hoursColor}`}>
                      {row.hours > 0 ? formatHours(row.hours) : ''}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* poslji racunovodstvu */}
        <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
          <button
            onClick={() => handleOpenReport(staffId)}
            disabled={loadingReport === staffId}
            className="flex items-center gap-1.5 rounded-lg border border-[#c59b5b]/30 bg-[#c59b5b]/10 px-3 py-1.5 text-xs font-medium text-[#c59b5b] transition hover:bg-[#c59b5b]/20 disabled:opacity-50"
          >
            <Mail className="h-4 w-4" />
            {loadingReport === staffId ? 'Pripravljam predogled…' : 'Pošlji računovodstvu'}
          </button>
        </div>
      </div>
    )
  }

  const cfg: PayrollSettings = settings || DEFAULT_PAYROLL_SETTINGS
  // Razvrsti po oddelku (kuhinja, bar, nočitve, management), nato po imenu —
  // enako kot Seznam osebja.
  const sortByDept = <T extends { allocateTo?: string | null; staffName: string }>(list: T[]): T[] => {
    const categoryOrder: Record<string, number> = { kuhinja: 0, bar: 1, accommodation: 2, management: 3 }
    return list.slice().sort((a, b) => {
      const catA = categoryOrder[a.allocateTo as string] ?? 4
      const catB = categoryOrder[b.allocateTo as string] ?? 4
      if (catA !== catB) return catA - catB
      return a.staffName.localeCompare(b.staffName)
    })
  }
  // Ali je delavec zaposlen v izbranem mesecu: izloci tiste, ki so ODSLI pred
  // prvim dnem meseca (endDate < zacetek meseca) ali se NISO zaceli (startDate po
  // koncu meseca). Pretekli meseci, ko je delavec se delal, ostanejo pravilni.
  const monthStart = new Date(year, month - 1, 1)
  const monthEnd = new Date(year, month, 0)
  const employedInMonth = (s: { startDate?: string | null; endDate?: string | null }) => {
    if (s.endDate) {
      const end = new Date(s.endDate)
      if (!isNaN(end.getTime()) && end < monthStart) return false
    }
    if (s.startDate) {
      const start = new Date(s.startDate)
      if (!isNaN(start.getTime()) && start > monthEnd) return false
    }
    return true
  }
  const regularStaff = sortByDept((allStaff || []).filter((s) => s.isRegularEmployee && employedInMonth(s)))
  // "Ostali" delavci (ne redno zaposleni): poenostavljen obracun bruto = neto,
  // brez prispevkov delodajalca, brez IRSA in brez dopusta; NE stejejo v cetrtletne prispevke.
  const otherStaff = sortByDept((allStaff || []).filter((s) => !s.isRegularEmployee && employedInMonth(s)))

  // Iskanje po imenu (ali vzdevku) delavca — filtrira SAMO prikaz seznamov,
  // vsote in števci ostanejo na polnih seznamih.
  const searchQ = staffSearch.trim().toLowerCase()
  const matchesSearch = (s: (typeof otherStaff)[number]) =>
    !searchQ ||
    (s.staffName || '').toLowerCase().includes(searchQ) ||
    (s.nickname || '').toLowerCase().includes(searchQ)
  const shownRegular = regularStaff.filter(matchesSearch)
  const shownOther = otherStaff.filter(matchesSearch)

  // Oznaka in barva oddelka za naslove skupin v seznamu obracuna.
  const deptLabel = (a?: string | null) =>
    a === 'accommodation' ? 'Nočitve' : a === 'bar' ? 'Bar' : a === 'kuhinja' ? 'Kuhinja' : 'Management'
  const deptTextColor = (a?: string | null) =>
    a === 'accommodation' ? 'text-[#7fa8b8]' : a === 'bar' ? 'text-[#8fae92]' : a === 'kuhinja' ? 'text-[#c59b5b]' : 'text-white/70'
  const deptDotColor = (a?: string | null) =>
    a === 'accommodation' ? 'bg-[#7fa8b8]' : a === 'bar' ? 'bg-[#8fae92]' : a === 'kuhinja' ? 'bg-[#c59b5b]' : 'bg-white/50'

  // map staffId -> shranjeni vnos za izbrani mesec
  const entryByStaff = useMemo(() => {
    const m: Record<string, EntryForm> = {}
    for (const e of entries || []) {
      m[e.staffId] = {
        baseGrossSalary: e.baseSalary,
        overtimeFirst8Hours: e.overtimeFirst8Hours,
        overtimeAfter8Hours: e.overtimeAfter8Hours,
        nightRegularHours: e.nightRegularHours,
        nightOccasionalHours: e.nightOccasionalHours,
        sundayHours: e.sundayHours,
        publicHolidayHours: e.publicHolidayHours,
        bonuses: e.bonus,
        taxableBenefits: e.taxableBenefits,
        unusedLeaveCompensation: e.unusedLeaveCompensation,
        employeeAdvances: e.advances,
        otherEmployeeDeductions: e.otherDeductions,
        netPayout: e.netPayout,
      }
    }
    return m
  }, [entries])

  // Stanje gotovinskega izplačila (iz DB vnosov): staffId -> {expenseId, date}
  const paidByStaff = useMemo(() => {
    const m: Record<string, { expenseId: string; date: string | null }> = {}
    for (const e of entries || []) {
      if (e.cashPaidExpenseId) m[e.staffId] = { expenseId: e.cashPaidExpenseId, date: e.cashPaidDate }
    }
    return m
  }, [entries])

  // Privzeti datum izplačila = 5. naslednjega meseca (plača se izplača mesec nazaj).
  // Za avgust (month=8) → 2026-09-05; december → januar naslednjega leta.
  const defaultPayDate = (() => {
    const d = new Date(year, month, 5) // month je 1-based → indeks month = naslednji mesec
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-05`
  })()

  const [payingId, setPayingId] = useState<string | null>(null)

  // Napitnina od gostov (samo zapis pri delavcu — NE gre iz blagajne).
  const tipsByStaff = useMemo(() => {
    const m: Record<string, number> = {}
    for (const e of entries || []) {
      if (e.tips) m[e.staffId] = e.tips
    }
    return m
  }, [entries])
  const [tipDrafts, setTipDrafts] = useState<Record<string, string>>({})
  const [savingTipId, setSavingTipId] = useState<string | null>(null)
  const [bulkTip, setBulkTip] = useState('')
  const [bulkTipBusy, setBulkTipBusy] = useState(false)

  const handleSaveTip = async (s: { id: string; staffName: string }, raw: string) => {
    const amount = Number(raw.replace(/[^\d]/g, '')) || 0
    if (amount === (tipsByStaff[s.id] || 0)) return
    setSavingTipId(s.id)
    try {
      await setStaffTips({ staffId: s.id, staffName: s.staffName, year, month, amount })
      await mutateEntries()
    } finally {
      setSavingTipId(null)
    }
  }

  const handleBulkTips = async () => {
    const amount = Number(bulkTip.replace(/[^\d]/g, '')) || 0
    const all = [...regularStaff, ...otherStaff].map((s) => ({ id: s.id, staffName: s.staffName }))
    if (all.length === 0) return
    if (!window.confirm(`Vpisati napitnino ${formatAr(amount)} vsem delavcem (${all.length}) za izbrani mesec?`)) return
    setBulkTipBusy(true)
    try {
      await setTipsForAll({ staff: all, year, month, amount })
      await mutateEntries()
      setTipDrafts({})
      setBulkTip('')
    } finally {
      setBulkTipBusy(false)
    }
  }

  const handlePaySalaryCash = async (s: { id: string; staffName: string }, amount: number) => {
    if (amount <= 0) {
      window.alert('Najprej vpišite znesek plače in shranite.')
      return
    }
    setPayingId(s.id)
    try {
      await markSalaryPaidCash({
        staffId: s.id,
        staffName: s.staffName,
        year,
        month,
        amount,
        date: defaultPayDate,
        company: 'tourism',
      })
      await mutateEntries()
    } finally {
      setPayingId(null)
    }
  }

  const handleUnpaySalaryCash = async (staffId: string) => {
    if (!window.confirm('Razveljaviti gotovinsko izplačilo? Odhodek se bo izbrisal iz blagajne.')) return
    setPayingId(staffId)
    try {
      await unmarkSalaryPaidCash({ staffId, year, month })
      await mutateEntries()
    } finally {
      setPayingId(null)
    }
  }

  const fmtDateSl = (iso: string | null) => {
    if (!iso) return ''
    const [y, m, d] = iso.split('-')
    return `${Number(d)}.${Number(m)}.${y}`
  }

  // Žig „PLAČANO" postrani v desnem spodnjem kotu kartice, ko je izplačano z gotovino.
  const renderPaidStamp = (staffId: string) => {
    if (!paidByStaff[staffId]) return null
    return (
      <div className="pointer-events-none absolute bottom-4 right-4 z-10 -rotate-12 select-none">
        <span className="inline-block rounded-md border-2 border-[#8fae92]/70 px-3 py-1 text-lg font-extrabold uppercase tracking-[0.2em] text-[#8fae92]/70">
          Plačano
        </span>
      </div>
    )
  }

  // Gumb „Plačano z gotovino" (+ razveljavitev). amount = dejansko izplačilo v roke.
  const renderCashPayControl = (s: { id: string; staffName: string }, amount: number) => {
    const paid = paidByStaff[s.id]
    const busy = payingId === s.id
    if (paid) {
      return (
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-lg border border-[#8fae92]/40 bg-[#8fae92]/15 px-3 py-1.5 text-xs font-medium text-[#8fae92]">
            <Check className="h-3.5 w-3.5" /> Izplačano z gotovino{paid.date ? ` · ${fmtDateSl(paid.date)}` : ''}
          </span>
          <button
            onClick={() => handleUnpaySalaryCash(s.id)}
            disabled={busy}
            className="rounded-lg border border-white/15 px-2.5 py-1.5 text-[11px] font-medium text-white/50 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
          >
            {busy ? '…' : 'Razveljavi'}
          </button>
        </div>
      )
    }
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => handlePaySalaryCash(s, amount)}
          disabled={busy}
          title={`Prenese ${formatAr(amount)} kot odhodek iz blagajne (Tourism) z datumom ${fmtDateSl(defaultPayDate)}`}
          className="flex items-center gap-1.5 rounded-lg border border-[#c59b5b]/40 bg-[#c59b5b]/10 px-3 py-1.5 text-xs font-medium text-[#c59b5b] transition hover:bg-[#c59b5b]/20 disabled:opacity-50"
        >
          <Wallet className="h-3.5 w-3.5" /> {busy ? 'Prenašam…' : 'Plačano z gotovino'}
        </button>
        <span className="text-xs text-white/50">
          iz blagajne: <span className="font-semibold text-white/80 tabular-nums">{formatAr(amount)}</span>
          {' · '}
          {fmtDateSl(defaultPayDate)}
        </span>
      </div>
    )
  }

  // Vnos napitnine od gostov pri delavcu (shrani se ob izgubi fokusa).
  const renderTipsControl = (s: { id: string; staffName: string }) => {
    const saved = tipsByStaff[s.id] || 0
    const draft = tipDrafts[s.id]
    const value = draft !== undefined ? draft : saved ? String(saved) : ''
    const busy = savingTipId === s.id
    return (
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-lg border border-[#8fb0c9]/30 bg-[#8fb0c9]/10 px-2.5 py-1">
          <Coins className="h-3.5 w-3.5 text-[#8fb0c9]" />
          <input
            type="text"
            inputMode="numeric"
            value={value}
            placeholder="0"
            onChange={(e) => setTipDrafts((prev) => ({ ...prev, [s.id]: e.target.value }))}
            onBlur={(e) => handleSaveTip(s, e.target.value)}
            className="w-24 bg-transparent text-sm text-white placeholder:text-white/30 focus:outline-none"
          />
          <span className="text-[11px] text-white/40">Ar</span>
        </div>
        {busy && <span className="text-[11px] text-white/40">Shranjujem…</span>}
        {!busy && saved > 0 && <Check className="h-3.5 w-3.5 text-[#8fb0c9]" />}
      </div>
    )
  }

  const leaveOf = (staffId: string): LeaveSummary | null => leaveSummaries?.[staffId] ?? null

  // Vrne obrazec: draft (ce obstaja) -> shranjeni vnos -> prazno
  const getForm = (staffId: string): EntryForm =>
    drafts[staffId] ?? entryByStaff[staffId] ?? EMPTY_FORM

  const dependentsOf = (staffId: string) => staffInfo?.[staffId]?.numberOfDependents ?? 0

  const updateDraft = (staffId: string, patch: Partial<EntryForm>) => {
    setDrafts((prev) => ({
      ...prev,
      [staffId]: { ...getForm(staffId), ...patch },
    }))
  }

  // Poracun ob odhodu: preostali dopust x dnevno nadomestilo (zakonska referenca / delitelj).
  // Referenca = 1/12 placila prejsnjih 12 mesecev (LeaveSummary.referenceAmount).
  const dailyLeaveRate = (referenceAmount: number) =>
    dailyLeaveAllowance(referenceAmount, cfg.leaveAllowanceDivisor)

  const handleSettlement = (staffId: string, referenceAmount: number, remainingDays: number) => {
    const comp = Math.round(Math.max(0, remainingDays) * dailyLeaveRate(referenceAmount))
    updateDraft(staffId, { unusedLeaveCompensation: comp })
    setExpanded((p) => ({ ...p, [staffId]: true }))
  }

  const handleSave = async (staffId: string, staffName: string) => {
    const form = getForm(staffId)
    setSaving((p) => ({ ...p, [staffId]: true }))
    try {
      await upsertPayrollEntry({
        staffId,
        staffName,
        year,
        month,
        baseSalary: form.baseGrossSalary,
        overtimeFirst8Hours: form.overtimeFirst8Hours,
        overtimeAfter8Hours: form.overtimeAfter8Hours,
        nightRegularHours: form.nightRegularHours,
        nightOccasionalHours: form.nightOccasionalHours,
        sundayHours: form.sundayHours,
        publicHolidayHours: form.publicHolidayHours,
        bonus: form.bonuses,
        taxableBenefits: form.taxableBenefits,
        unusedLeaveCompensation: form.unusedLeaveCompensation,
        advances: form.employeeAdvances,
        otherDeductions: form.otherEmployeeDeductions,
        netPayout: form.netPayout,
      })
      await mutateEntries()
      await mutateQuarterly()
      setDrafts((prev) => {
        const next = { ...prev }
        delete next[staffId]
        return next
      })
    } finally {
      setSaving((p) => ({ ...p, [staffId]: false }))
    }
  }

  const handleTogglePaid = async (paid: boolean) => {
    await setContributionPaid(year, selectedQuarter, paid)
    mutateQuarterly()
  }

  const handlePrint = (staff: PrintStaff) => {
    setPrintOther(null)
    setPrintStaff(staff)
    setTimeout(() => {
      document.body.classList.add('printing-payslip')
      window.print()
      document.body.classList.remove('printing-payslip')
    }, 50)
  }

  // Dopust vodimo SAMO kot evidenco porabljenih dni — NE vpliva na obračun plače.
  // Plača teče kot pri rednem delu (nadomestilo/odbitek dopusta = 0). Poračun
  // neizkoriščenega dopusta ob ODHODU (unusedLeaveCompensation) ostane ločen.
  // Parameter `leave` je ohranjen zaradi obstoječih klicev, a se tu ne uporablja.
  const toInput = (form: EntryForm, dependents: number, leave: LeaveSummary | null = null): PayslipInput => {
    void leave
    return {
      baseGrossSalary: form.baseGrossSalary,
      overtimeFirst8Hours: form.overtimeFirst8Hours,
      overtimeAfter8Hours: form.overtimeAfter8Hours,
      nightRegularHours: form.nightRegularHours,
      nightOccasionalHours: form.nightOccasionalHours,
      sundayHours: form.sundayHours,
      publicHolidayHours: form.publicHolidayHours,
      bonuses: form.bonuses,
      taxableBenefits: form.taxableBenefits,
      unusedLeaveCompensation: form.unusedLeaveCompensation,
      leaveAllowance: 0,
      leaveDeduction: 0,
      employeeAdvances: form.employeeAdvances,
      otherEmployeeDeductions: form.otherEmployeeDeductions,
      numberOfDependents: dependents,
    }
  }

  // skupni mesecni stroski (vsi redni zaposleni)
  let monthTotalNet = 0
  let monthTotalEmployerCost = 0
  for (const s of regularStaff) {
    const slip = calcPayslip(toInput(getForm(s.id), dependentsOf(s.id), leaveOf(s.id)), cfg)
    monthTotalNet += slip.netToPay
    monthTotalEmployerCost += slip.totalEmployerCost
  }

  // skupni mesecni znesek za ostale delavce (bruto = neto = strosek)
  let otherTotal = 0
  for (const s of otherStaff) {
    otherTotal += getForm(s.id).baseGrossSalary
  }

  const handlePrintOther = (s: (typeof otherStaff)[number], amount: number) => {
    setPrintStaff(null)
    setPrintOther({
      name: s.staffName,
      firstName: s.firstName,
      lastName: s.lastName,
      company: s.company,
      position: s.staffType ?? '',
      documentNumber: s.documentNumber,
      amount,
    })
    setTimeout(() => {
      document.body.classList.add('printing-payslip')
      window.print()
      document.body.classList.remove('printing-payslip')
    }, 50)
  }

  const printPayslip = printStaff
    ? calcPayslip(toInput(printStaff.form, printStaff.dependents, printStaff.leave), cfg)
    : null

  const deadlineDate = quarterly ? new Date(quarterly.deadline) : null
  const daysLeft = deadlineDate
    ? Math.ceil((deadlineDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null
  const deadlineUrgent = quarterly && !quarterly.paid && daysLeft !== null && daysLeft <= 30

  const pct = (r: number) => `${(r * 100).toFixed(r * 100 % 1 === 0 ? 0 : 1)}%`

  return (
    <div className="space-y-6">
      {/* Header / povzetek */}
      <div className="no-print rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#7fa8b8]/15">
              <Wallet className="h-5 w-5 text-[#7fa8b8]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Obračun plač</h3>
              <p className="text-xs text-white/40">
                {MONTHS_FR[month - 1]} {year} — redno zaposleni ({regularStaff.length}) · ostali ({otherStaff.length})
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-6">
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-wider text-white/40">Skupaj neto (zaposleni)</p>
              <p className="text-lg font-bold text-white">{formatAr(monthTotalNet)}</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-wider text-white/40">Strošek delodajalca (zaposleni)</p>
              <p className="text-lg font-bold text-[#8fae92]">{formatAr(monthTotalEmployerCost)}</p>
            </div>
            {otherStaff.length > 0 && (
              <div className="text-right">
                <p className="text-[11px] uppercase tracking-wider text-white/40">Skupaj ostali (bruto = neto)</p>
                <p className="text-lg font-bold text-[#c59b5b]">{formatAr(otherTotal)}</p>
              </div>
            )}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4 border-t border-white/5 pt-4">
          <div className="relative max-w-xs flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
            <input
              type="text"
              value={staffSearch}
              onChange={(e) => setStaffSearch(e.target.value)}
              placeholder="Iskanje po imenu delavca…"
              className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-9 pr-8 text-sm text-white placeholder:text-white/30 focus:border-[#c59b5b]/40 focus:outline-none"
            />
            {staffSearch && (
              <button
                onClick={() => setStaffSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-white/40 transition hover:bg-white/10 hover:text-white"
                aria-label="Počisti iskanje"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {/* Napitnina vsem — hitro vpiši isti znesek napitnine vsem delavcem za mesec */}
          <div className="flex items-end gap-2">
            <div>
              <label className="mb-1 block text-[11px] uppercase tracking-wide text-white/40">Napitnina vsem (Ar)</label>
              <div className="flex items-center gap-1.5 rounded-lg border border-[#8fb0c9]/30 bg-[#8fb0c9]/10 px-2.5 py-2">
                <Coins className="h-4 w-4 text-[#8fb0c9]" />
                <input
                  type="text"
                  inputMode="numeric"
                  value={bulkTip}
                  onChange={(e) => setBulkTip(e.target.value)}
                  placeholder="npr. 180000"
                  className="w-28 bg-transparent text-sm text-white placeholder:text-white/30 focus:outline-none"
                />
              </div>
            </div>
            <button
              onClick={handleBulkTips}
              disabled={bulkTipBusy || !bulkTip.trim()}
              className="rounded-lg border border-[#8fb0c9]/40 bg-[#8fb0c9]/15 px-4 py-2 text-sm font-medium text-[#8fb0c9] transition hover:bg-[#8fb0c9]/25 disabled:opacity-40"
            >
              {bulkTipBusy ? 'Vpisujem…' : 'Vpiši vsem'}
            </button>
          </div>
        </div>
        {regularStaff.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/5 pt-4">
            <p className="text-xs text-white/40">
              Skupni obračun za računovodstvo: ure dela v nedeljo in na praznik ter dnevi dopusta z datumi — za vsakega zaposlenega.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setShowEmails((v) => !v)}
                className="flex items-center gap-1.5 rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-white/70 transition hover:bg-white/5 hover:text-white"
              >
                <History className="h-4 w-4" />
                {showEmails ? 'Skrij pregled emailov' : 'Pregled poslanih emailov'}
              </button>
              <button
                onClick={handleOpenCombined}
                disabled={loadingCombined}
                className="flex items-center gap-1.5 rounded-lg bg-[#7fa8b8]/15 px-4 py-2 text-sm font-semibold text-[#7fa8b8] transition hover:bg-[#7fa8b8]/25 disabled:opacity-50"
              >
                <Mail className="h-4 w-4" />
                {loadingCombined ? 'Pripravljam…' : 'Pošlji obračun vseh računovodstvu'}
              </button>
            </div>
          </div>
        )}
        {showEmails && (
          <div className="mt-4">
            <AccountingEmailsBox refreshKey={emailsRefresh} />
          </div>
        )}
      </div>

      {searchQ && shownRegular.length === 0 && shownOther.length === 0 && (
        <div className="no-print rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
          <p className="text-sm text-white/50">
            Ni delavca z imenom &quot;{staffSearch}&quot;.
          </p>
        </div>
      )}

      {regularStaff.length === 0 && (
        <div className="no-print rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
          <p className="text-sm text-white/50">
            Ni rednih zaposlenih. Označite delavce kot &quot;redno zaposlen&quot; v zavihku &quot;Seznam osebja&quot;.
          </p>
        </div>
      )}

      {/* Seznam rednih zaposlenih z obracunom */}
      <div className="no-print space-y-3">
        {shownRegular.map((s, idx, arr) => {
          const form = getForm(s.id)
          const dependents = dependentsOf(s.id)
          const leave = leaveOf(s.id)
          const slip = calcPayslip(toInput(form, dependents, leave), cfg)
          // Neto izplačilo, ki ga uporabnica dejansko da delavcu v roke.
          // Razlika nad izračunanim neto (netToPay) = bonus (neobdavčen).
          const bonusFromPayout = form.netPayout > 0 ? form.netPayout - slip.netToPay : 0
          const isOpen = expanded[s.id]
          const isDirty = !!drafts[s.id]
          const isComplete = !!attendanceImages?.[s.id] && form.baseGrossSalary > 0
          const showHeader = idx === 0 || arr[idx - 1].allocateTo !== s.allocateTo
          const groupCount = arr.filter((x) => x.allocateTo === s.allocateTo).length
          return (
            <React.Fragment key={s.id}>
            {showHeader && (
              <div className={`flex items-center gap-2 pt-4 pb-1 ${idx === 0 ? '' : 'mt-2 border-t border-white/10'}`}>
                <span className={`inline-block h-2.5 w-2.5 rounded-full ${deptDotColor(s.allocateTo)}`} />
                <h3 className={`text-sm font-bold uppercase tracking-wider ${deptTextColor(s.allocateTo)}`}>{deptLabel(s.allocateTo)}</h3>
                <span className="text-xs text-white/40">({groupCount})</span>
              </div>
            )}
            <div className={`relative overflow-hidden rounded-2xl border p-5 transition-colors ${isComplete ? 'border-[#c9a86a]/50' : 'border-white/[0.06]'} bg-white/[0.02]`}>
              {renderPaidStamp(s.id)}
              {/* glava vrstice */}
              <div className="flex flex-wrap items-center justify-between gap-4">
                <button
                  onClick={() => setExpanded((p) => ({ ...p, [s.id]: !p[s.id] }))}
                  className="flex items-center gap-2 text-left"
                >
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4 text-white/40" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-white/40" />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-[#c59b5b]">{s.staffName}</p>
                      {isComplete && (
                        <span className="flex items-center gap-1 rounded-full border border-[#c9a86a]/40 bg-[#c9a86a]/15 px-2 py-0.5 text-[10px] font-medium text-[#d8b877]">
                          <Check className="h-3 w-3" /> Vneseno
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-white/40">
                      {dependents > 0 ? `${dependents} vzdrževanih oseb` : 'Brez vzdrževanih oseb'}
                      {leave && <span className="text-[#8fae92]"> · dopust: {leave.remaining.toFixed(1)} dni</span>}
                    </p>
                  </div>
                </button>

                <div className="flex flex-wrap items-center gap-5">
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-wider text-white/40">Bruto</p>
                    <p className="text-sm font-semibold text-white tabular-nums">{formatAr(slip.grossSalary)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-wider text-white/40">Neto za izplačilo (plačilo delavcu)</p>
                    <p className="text-sm font-bold text-[#7fa8b8] tabular-nums">{formatAr(slip.netToPay)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-wider text-white/40">Strošek delodajalca</p>
                    <p className="text-sm font-semibold text-[#8fae92] tabular-nums">{formatAr(slip.totalEmployerCost)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isDirty && (
                      <button
                        onClick={() => handleSave(s.id, s.staffName)}
                        disabled={saving[s.id]}
                        className="flex items-center gap-2 rounded-xl border border-[#8fae92]/30 bg-[#8fae92]/10 px-3 py-2 text-sm font-medium text-[#8fae92] transition hover:bg-[#8fae92]/20 disabled:opacity-50"
                      >
                        <Save className="h-4 w-4" />
                        {saving[s.id] ? 'Shranjujem…' : 'Shrani'}
                      </button>
                    )}
                    <button
                      onClick={() =>
                        handlePrint({
                          id: s.id,
                          name: s.staffName,
                          form,
                          dependents,
                          firstName: s.firstName,
                          lastName: s.lastName,
                          dateOfBirth: s.dateOfBirth,
                          placeOfBirth: s.placeOfBirth,
                          documentNumber: s.documentNumber,
                          company: s.company,
                          position: staffInfo?.[s.id]?.position ?? '',
                          cnapsNumber: s.cnapsNumber,
                          leave,
                        } as PrintStaff)
                      }
                      className="flex items-center gap-2 rounded-xl border border-[#7fa8b8]/30 bg-[#7fa8b8]/10 px-3 py-2 text-sm font-medium text-[#7fa8b8] transition hover:bg-[#7fa8b8]/20"
                    >
                      <Printer className="h-4 w-4" />
                      Lista
                    </button>
                  </div>
                </div>
              </div>

              {/* Lista prisotnosti (slika) */}
                    {renderAttendanceControl(s.id)}
                    {renderPayslipControl(s.id)}

              {/* Gotovinsko izplačilo → odhodek iz blagajne */}
              <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-white/[0.06] pt-3">
                <span className="text-[11px] uppercase tracking-wide text-white/40">Izplačilo plače</span>
                {renderCashPayControl(s, form.netPayout > 0 ? form.netPayout : slip.netToPay)}
              </div>

              {/* Napitnina od gostov — samo zapis (ne iz blagajne) */}
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span className="text-[11px] uppercase tracking-wide text-white/40">Napitnina od gostov</span>
                {renderTipsControl(s)}
              </div>

              {/* razsirjeni vnos + razclenitev */}
              {isOpen && (
                <div className="mt-5 grid gap-6 lg:grid-cols-2">
                  {/* VNOS */}
                  <div>
                    <p className="mb-3 text-[11px] uppercase tracking-wider text-white/40">Mesečni vnos</p>
                    <div className="grid grid-cols-2 gap-3">
                      <NumInput label="Osnovna bruto plača (Ar)" value={form.baseGrossSalary} onChange={(v) => updateDraft(s.id, { baseGrossSalary: v })} wide />
                      <NumInput label="Nadure 1–8 (ure)" value={form.overtimeFirst8Hours} onChange={(v) => updateDraft(s.id, { overtimeFirst8Hours: v })} />
                      <NumInput label="Nadure nad 8 (ure)" value={form.overtimeAfter8Hours} onChange={(v) => updateDraft(s.id, { overtimeAfter8Hours: v })} />
                      <NumInput label="Redno nočno (ure)" value={form.nightRegularHours} onChange={(v) => updateDraft(s.id, { nightRegularHours: v })} />
                      <NumInput label="Občasno nočno (ure)" value={form.nightOccasionalHours} onChange={(v) => updateDraft(s.id, { nightOccasionalHours: v })} />
                      <NumInput label="Nedeljsko delo (ure)" value={form.sundayHours} onChange={(v) => updateDraft(s.id, { sundayHours: v })} />
                      <NumInput label="Praznično delo (ure)" value={form.publicHolidayHours} onChange={(v) => updateDraft(s.id, { publicHolidayHours: v })} />
                      <NumInput label="Bonusi (Ar)" value={form.bonuses} onChange={(v) => updateDraft(s.id, { bonuses: v })} />
                      <NumInput label="Obdavčljive ugodnosti (Ar)" value={form.taxableBenefits} onChange={(v) => updateDraft(s.id, { taxableBenefits: v })} />
                      <NumInput label="Poračun dopusta ob odhodu (Ar)" value={form.unusedLeaveCompensation} onChange={(v) => updateDraft(s.id, { unusedLeaveCompensation: v })} wide />
                      <NumInput label="Predujmi (Ar)" value={form.employeeAdvances} onChange={(v) => updateDraft(s.id, { employeeAdvances: v })} />
                      <NumInput label="Ostali odbitki (Ar)" value={form.otherEmployeeDeductions} onChange={(v) => updateDraft(s.id, { otherEmployeeDeductions: v })} />
                      <NumInput label="Neto izplačilo — v roke (Ar)" value={form.netPayout} onChange={(v) => updateDraft(s.id, { netPayout: v })} wide />
                    </div>
                    {form.netPayout > 0 && (
                      <div className="mt-3 rounded-xl border border-[#c9a86a]/30 bg-[#c9a86a]/[0.06] p-3 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-white/60">Neto izplačilo (v roke)</span>
                          <span className="font-semibold text-white tabular-nums">{formatAr(form.netPayout)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-white/60">Izračunani neto</span>
                          <span className="tabular-nums text-white/70">{formatAr(slip.netToPay)}</span>
                        </div>
                        <div className="mt-1 flex items-center justify-between border-t border-white/10 pt-1">
                          <span className="font-medium text-[#d8b877]">
                            {bonusFromPayout >= 0 ? 'Od tega bonus (neobdavčen)' : 'Manjko do izračunanega neto'}
                          </span>
                          <span className={`font-bold tabular-nums ${bonusFromPayout >= 0 ? 'text-[#d8b877]' : 'text-[#c98f7d]'}`}>
                            {bonusFromPayout >= 0 ? '' : '− '}{formatAr(Math.abs(bonusFromPayout))}
                          </span>
                        </div>
                      </div>
                    )}
                    <p className="mt-2 text-[11px] text-white/30">
                      Urna postavka: {formatAr(slip.hourlyRate)} ({cfg.monthlyHours} h/mesec)
                    </p>
                  </div>

                  {/* RAZCLENITEV */}
                  <div className="space-y-4">
                    <div>
                      <p className="mb-2 text-[11px] uppercase tracking-wider text-white/40">Zaslužek</p>
                      <div className="space-y-1 text-sm">
                        <Row label="Osnovna bruto plača" value={formatAr(slip.baseGrossSalary)} />
                        {slip.overtimeFirst8Amount > 0 && <Row label={`Nadure 1–8 (×${cfg.overtimeFirst8})`} value={formatAr(slip.overtimeFirst8Amount)} />}
                        {slip.overtimeAfter8Amount > 0 && <Row label={`Nadure nad 8 (×${cfg.overtimeAfter8})`} value={formatAr(slip.overtimeAfter8Amount)} />}
                        {slip.nightRegularAmount > 0 && <Row label={`Redno nočno (×${cfg.nightRegular})`} value={formatAr(slip.nightRegularAmount)} />}
                        {slip.nightOccasionalAmount > 0 && <Row label={`Občasno nočno (×${cfg.nightOccasional})`} value={formatAr(slip.nightOccasionalAmount)} />}
                        {slip.sundayAmount > 0 && <Row label={`Nedelje (×${cfg.sundayWork})`} value={formatAr(slip.sundayAmount)} />}
                        {slip.publicHolidayAmount > 0 && <Row label={`Prazniki (×${cfg.publicHoliday})`} value={formatAr(slip.publicHolidayAmount)} />}
                        {slip.bonuses > 0 && <Row label="Bonusi" value={formatAr(slip.bonuses)} />}
                        {slip.taxableBenefits > 0 && <Row label="Obdavčljive ugodnosti" value={formatAr(slip.taxableBenefits)} />}
                        {slip.unusedLeaveCompensation > 0 && <Row label="Poračun neizkoriščenega dopusta" value={formatAr(slip.unusedLeaveCompensation)} />}
                        {/* Obdavcljivo nadomestilo dopusta (samo ce congeTaxable=true) */}
                        {slip.leaveAllowance > 0 && slip.nonTaxableLeaveAllowance === 0 && <Row label={`Nadomestilo dopusta (${(leave?.takenThisMonth ?? 0).toFixed(1)} dni)`} value={formatAr(slip.leaveAllowance)} />}
                        {slip.leaveDeduction > 0 && <Row label={`Odbitek dopusta (${(leave?.takenThisMonth ?? 0).toFixed(1)} dni)`} value={`− ${formatAr(slip.leaveDeduction)}`} />}
                        <Row label="BRUTO IMPOSABLE (obdavčljiva)" value={formatAr(slip.taxableGross)} strong />
                      </div>
                    </div>
                    <div>
                      <p className="mb-2 text-[11px] uppercase tracking-wider text-white/40">Odbitki zaposlenega</p>
                      <div className="space-y-1 text-sm">
                        <Row label={`CNAPS zaposleni (${pct(cfg.employeeCNAPS)})`} value={formatAr(slip.employeeCNAPS)} />
                        <Row label={`OSTIE zaposleni (${pct(cfg.employeeOSTIE)})`} value={formatAr(slip.employeeOSTIE)} />
                        <Row label="IRSA (dohodnina)" value={formatAr(slip.finalIRSA)} />
                        {slip.employeeAdvances > 0 && <Row label="Predujmi" value={formatAr(slip.employeeAdvances)} />}
                        {slip.otherEmployeeDeductions > 0 && <Row label="Ostali odbitki" value={formatAr(slip.otherEmployeeDeductions)} />}
                        <Row label="Skupaj odbitki" value={formatAr(slip.totalEmployeeDeductions)} muted />
                        <Row label="NET IMPOSABLE (neto obdavčljive)" value={formatAr(slip.netSalary)} strong />
                        {slip.nonTaxableLeaveAllowance > 0 && <Row label={`Nadomestilo dopusta — neobdavčljivo (${(leave?.takenThisMonth ?? 0).toFixed(1)} dni)`} value={`+ ${formatAr(slip.nonTaxableLeaveAllowance)}`} />}
                        <Row label="NETO ZA IZPLAČILO (PLAČILO DELAVCU)" value={formatAr(slip.netToPay)} strong accent />
                      </div>
                    </div>
                    <div>
                      <p className="mb-2 text-[11px] uppercase tracking-wider text-white/40">Prispevki delodajalca</p>
                      <div className="space-y-1 text-sm">
                        <Row label={`CNAPS delodajalec (${pct(cfg.employerCNAPS)})`} value={formatAr(slip.employerCNAPS)} />
                        <Row label={`OSTIE delodajalec (${pct(cfg.employerOSTIE)})`} value={formatAr(slip.employerOSTIE)} />
                        <Row label={`FMFP (${pct(cfg.employerFMFP)})`} value={formatAr(slip.employerFMFP)} />
                        <Row label="Skupaj prispevki" value={formatAr(slip.employerContributions)} muted />
                        <Row label="SKUPNI STROŠEK" value={formatAr(slip.totalEmployerCost)} strong />
                      </div>
                    </div>

                    {/* DOPUST */}
                    <div className="rounded-xl border border-[#8fae92]/20 bg-[#8fae92]/[0.04] p-4">
                      <div className="mb-2 flex items-center gap-2">
                        <Palmtree className="h-4 w-4 text-[#8fae92]" />
                        <p className="text-[11px] uppercase tracking-wider text-[#8fae92]">Dopust (letni plačan)</p>
                      </div>
                      <div className="space-y-1 text-sm">
                        <Row label="Stanje pred mesecem" value={`${(leave?.balanceBefore ?? 0).toFixed(1)} dni`} muted />
                        <Row label="Priraslo ta mesec" value={`+ ${(leave?.earnedThisMonth ?? 0).toFixed(1)} dni`} />
                        <Row label="Izkoriščeno ta mesec" value={`− ${(leave?.takenThisMonth ?? 0).toFixed(1)} dni`} />
                        {(leave?.sickDaysThisMonth ?? 0) > 0 && (
                          <Row
                            label={`Bolniška (${leave?.sickDaysThisMonth} ${leave?.sickDaysThisMonth === 1 ? 'dan' : 'dni'}) — 100 % plačano`}
                            value="plača se ne zmanjša"
                          />
                        )}
                        <Row label="PREOSTALO STANJE" value={`${(leave?.remaining ?? 0).toFixed(1)} dni`} strong accent />
                        <Row label="Referenca (1/12 zadnjih 12 mes)" value={formatAr(leave?.referenceAmount ?? 0)} muted />
                      </div>

                      {/* Vnos dopusta preteklih let PO LETIH + razclenitev koriscenja */}
                      <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3">
                        <p className="mb-2 text-[11px] uppercase tracking-wider text-white/50">
                          Dopust preteklih let (dni) — po letu
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                          {[year - 1, year - 2, year - 3].map((yk) => (
                            <div key={`prior-${s.id}-${yk}`} className="flex flex-col gap-1">
                              <label className="text-center text-[10px] text-white/40">{yk}</label>
                              <input
                                type="number"
                                step={0.5}
                                min={0}
                                inputMode="decimal"
                                defaultValue={(leave?.priorByYear?.[String(yk)] ?? 0).toString()}
                                key={`prior-inp-${s.id}-${yk}-${leave?.priorByYear?.[String(yk)] ?? 0}`}
                                onBlur={(e) => {
                                  const v = Math.max(0, Number.parseFloat(e.target.value || '0') || 0)
                                  if (v !== (leave?.priorByYear?.[String(yk)] ?? 0)) handleSavePriorLeave(s.id, yk, v)
                                }}
                                className="w-full rounded-md border border-white/10 bg-white/5 px-2 py-1 text-right text-sm text-white focus:border-[#8fae92]/40 focus:outline-none"
                              />
                            </div>
                          ))}
                        </div>
                        <div className="mt-2 flex items-center justify-between text-[11px]">
                          <span className="text-white/40">Skupaj pretekla leta</span>
                          <span className="font-semibold text-[#c59b5b]">{(leave?.priorYearsBalance ?? 0).toFixed(1)} dni</span>
                        </div>
                        {savingPriorLeave === s.id && (
                          <p className="mt-1 text-right text-[10px] text-white/40">Shranjujem…</p>
                        )}
                        <div className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
                          <div className="rounded-md bg-white/[0.03] p-2">
                            <p className="mb-1 text-[10px] uppercase tracking-wider text-[#8fae92]">Tekoče leto {year}</p>
                            <div className="flex justify-between text-white/60"><span>Prislužено</span><span>{(leave?.currentYearEarned ?? 0).toFixed(1)}</span></div>
                            <div className="flex justify-between text-white/60"><span>Koriščeno</span><span>− {(leave?.takenFromCurrent ?? 0).toFixed(1)}</span></div>
                            <div className="flex justify-between font-semibold text-white"><span>Ostane</span><span>{(leave?.currentYearRemaining ?? 0).toFixed(1)}</span></div>
                          </div>
                          <div className="rounded-md bg-white/[0.03] p-2">
                            <p className="mb-1 text-[10px] uppercase tracking-wider text-[#c59b5b]">Pretekla leta</p>
                            <div className="flex justify-between text-white/60"><span>Na voljo</span><span>{(leave?.priorYearsBalance ?? 0).toFixed(1)}</span></div>
                            <div className="flex justify-between text-white/60"><span>Koriščeno</span><span>− {(leave?.takenFromPrior ?? 0).toFixed(1)}</span></div>
                            <div className={`flex justify-between font-semibold ${(leave?.priorYearsRemaining ?? 0) < 0 ? 'text-red-400' : 'text-white'}`}><span>Ostane</span><span>{(leave?.priorYearsRemaining ?? 0).toFixed(1)}</span></div>
                          </div>
                        </div>
                        <p className="mt-2 text-[10px] text-white/30">
                          Najprej se koristi dopust tekočega leta, ko ga zmanjka, se porablja dopust preteklih let.
                        </p>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-3">
                        <p className="text-[11px] text-white/40">
                          Dnevno nadomestilo: {formatAr(dailyLeaveRate(leave?.referenceAmount ?? 0))}
                        </p>
                        <button
                          onClick={() => handleSettlement(s.id, leave?.referenceAmount ?? 0, leave?.remaining ?? 0)}
                          disabled={(leave?.remaining ?? 0) <= 0}
                          className="flex items-center gap-2 rounded-lg border border-[#c59b5b]/30 bg-[#c59b5b]/10 px-3 py-1.5 text-xs font-medium text-[#c59b5b] transition hover:bg-[#c59b5b]/20 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <LogOut className="h-3.5 w-3.5" />
                          Poračun ob odhodu
                        </button>
                      </div>
                      <p className="mt-2 text-[11px] text-white/30">
                        Poračun = preostali dnevi × dnevna postavka. Doda se v bruto (obdavčeno + prispevki).
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            </React.Fragment>
          )
        })}
      </div>

      {/* ===== Ostali delavci (poenostavljeno: bruto = neto) ===== */}
      {shownOther.length > 0 && (
        <div className="no-print space-y-3">
          <div className="flex items-center gap-3 pt-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#c59b5b]/15">
              <Wallet className="h-5 w-5 text-[#c59b5b]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Ostali delavci ({otherStaff.length})</h3>
              <p className="text-xs text-white/40">
                Poenostavljen obračun — bruto = neto, brez prispevkov, IRSA in dopusta. Ne šteje v četrtletne prispevke.
              </p>
            </div>
          </div>

          {shownOther.map((s, idx, arr) => {
            const form = getForm(s.id)
            const amount = form.baseGrossSalary
            const isDirty = !!drafts[s.id]
            const isComplete = !!attendanceImages?.[s.id] && amount > 0
            const showHeader = idx === 0 || arr[idx - 1].allocateTo !== s.allocateTo
            const groupCount = arr.filter((x) => x.allocateTo === s.allocateTo).length
            return (
              <React.Fragment key={s.id}>
              {showHeader && (
                <div className={`flex items-center gap-2 pt-3 pb-1 ${idx === 0 ? '' : 'mt-2 border-t border-white/10'}`}>
                  <span className={`inline-block h-2.5 w-2.5 rounded-full ${deptDotColor(s.allocateTo)}`} />
                  <h3 className={`text-sm font-bold uppercase tracking-wider ${deptTextColor(s.allocateTo)}`}>{deptLabel(s.allocateTo)}</h3>
                  <span className="text-xs text-white/40">({groupCount})</span>
                </div>
              )}
              <div className={`relative overflow-hidden rounded-2xl border p-5 transition-colors ${isComplete ? 'border-[#c9a86a]/50' : 'border-white/[0.06]'} bg-white/[0.02]`}>
              {renderPaidStamp(s.id)}
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-[#c59b5b]">{s.staffName}</p>
                      {isComplete && (
                        <span className="flex items-center gap-1 rounded-full border border-[#c9a86a]/40 bg-[#c9a86a]/15 px-2 py-0.5 text-[10px] font-medium text-[#d8b877]">
                          <Check className="h-3 w-3" /> Vneseno
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-white/40">
                      {s.staffType || 'Priložnostni delavec'}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-end gap-4">
                    <div className="w-48">
                      <NumInput
                        label="Znesek — bruto = neto (Ar)"
                        value={amount}
                        onChange={(v) => updateDraft(s.id, { baseGrossSalary: v })}
                        wide
                      />
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-wider text-white/40">Za izplačilo</p>
                      <p className="text-sm font-bold text-[#7fa8b8] tabular-nums">{formatAr(amount)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {isDirty && (
                        <button
                          onClick={() => handleSave(s.id, s.staffName)}
                          disabled={saving[s.id]}
                          className="flex items-center gap-2 rounded-xl border border-[#8fae92]/30 bg-[#8fae92]/10 px-3 py-2 text-sm font-medium text-[#8fae92] transition hover:bg-[#8fae92]/20 disabled:opacity-50"
                        >
                          <Save className="h-4 w-4" />
                          {saving[s.id] ? 'Shranjujem…' : 'Shrani'}
                        </button>
                      )}
                      <button
                        onClick={() => handlePrintOther(s, amount)}
                        className="flex items-center gap-2 rounded-xl border border-[#7fa8b8]/30 bg-[#7fa8b8]/10 px-3 py-2 text-sm font-medium text-[#7fa8b8] transition hover:bg-[#7fa8b8]/20"
                      >
                        <Printer className="h-4 w-4" />
                        Lista
                      </button>
                    </div>
                  </div>
                </div>
                {/* Lista prisotnosti (slika) */}
                      {renderAttendanceControl(s.id)}
                    {renderPayslipControl(s.id)}

              {/* Gotovinsko izplačilo → odhodek iz blagajne */}
              <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-white/[0.06] pt-3">
                <span className="text-[11px] uppercase tracking-wide text-white/40">Izplačilo plače</span>
                {renderCashPayControl(s, amount)}
              </div>

              {/* Napitnina od gostov — samo zapis (ne iz blagajne) */}
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span className="text-[11px] uppercase tracking-wide text-white/40">Napitnina od gostov</span>
                {renderTipsControl(s)}
              </div>
              </div>
              </React.Fragment>
            )
          })}
        </div>
      )}

      {/* Cetrtletni prispevki */}
      <div className="no-print rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#8fae92]/15">
              <Receipt className="h-5 w-5 text-[#8fae92]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Četrtletni prispevki</h3>
              <p className="text-xs text-white/40">Za plačilo prispevkov državi (osnova = bruto s stropom)</p>
            </div>
          </div>
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((q) => (
              <button
                key={q}
                onClick={() => setSelectedQuarter(q)}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                  selectedQuarter === q
                    ? 'bg-[#7fa8b8]/20 text-[#7fa8b8]'
                    : 'border border-white/[0.06] text-white/50 hover:bg-white/[0.04]'
                }`}
              >
                Q{q}
              </button>
            ))}
          </div>
        </div>

        {quarterly && (
          <div className="mt-5">
            {deadlineUrgent && (
              <div className="mb-4 flex items-center gap-3 rounded-xl border border-[#c98f7d]/30 bg-[#c98f7d]/10 px-4 py-3">
                <AlertTriangle className="h-5 w-5 shrink-0 text-[#c98f7d]" />
                <p className="text-sm text-[#c98f7d]">
                  {daysLeft !== null && daysLeft < 0
                    ? `Rok za plačilo je potekel pred ${Math.abs(daysLeft)} dnevi!`
                    : `Rok za plačilo čez ${daysLeft} dni!`}{' '}
                  Rok: {formatDateSl(quarterly.deadline)}
                </p>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-4">
              <StatBox label={`CNAPS (${pct(cfg.employerCNAPS)})`} value={formatAr(quarterly.cnaps)} />
              <StatBox label={`OSTIE (${pct(cfg.employerOSTIE)})`} value={formatAr(quarterly.omino)} />
              <StatBox label={`FMFP (${pct(cfg.employerFMFP)})`} value={formatAr(quarterly.fmfp)} />
              <StatBox label="SKUPAJ" value={formatAr(quarterly.total)} accent />
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
              <div className="text-sm text-white/50">
                <p>
                  Osnova prispevkov v Q{selectedQuarter}:{' '}
                  <span className="text-white">{formatAr(quarterly.sumOfBaseSalaries)}</span>
                </p>
                <p>
                  Rok plačila: <span className="text-white">{QUARTER_DEADLINE_LABEL[selectedQuarter]}</span>{' '}
                  ({formatDateSl(quarterly.deadline)})
                </p>
              </div>
              <div className="flex items-center gap-3">
                {quarterly.paid ? (
                  <span className="flex items-center gap-2 rounded-xl border border-[#8fae92]/30 bg-[#8fae92]/10 px-4 py-2 text-sm font-medium text-[#8fae92]">
                    <Check className="h-4 w-4" /> Plačano
                    {quarterly.paidAt && ` (${formatDateSl(quarterly.paidAt)})`}
                  </span>
                ) : (
                  <span className="rounded-xl border border-[#c98f7d]/30 bg-[#c98f7d]/10 px-4 py-2 text-sm font-medium text-[#c98f7d]">
                    Neplačano
                  </span>
                )}
                <button
                  onClick={() => handleTogglePaid(!quarterly.paid)}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.04] px-4 py-2 text-sm font-medium text-white transition hover:bg-white/[0.08]"
                >
                  {quarterly.paid ? 'Označi kot neplačano' : 'Označi kot plačano'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ===== PRINT: Bulletin de paie (francosko, brez barv) ===== */}
      {printStaff && printPayslip && (
        <div className="payslip-print" aria-hidden="true">
          <div className="doc-page">
            <div className="doc-header">
              <img className="doc-logo" src="/images/komba-logo-color.png" alt="Komba Cabana" />
              <p className="doc-company">{getCompany(printStaff.company).name}</p>
              <p className="doc-location">{getCompany(printStaff.company).address}</p>
              <p className="doc-location">Nosy Komba, Madagascar</p>
            </div>
            <div className="doc-title-block">
              <h2 className="doc-title">BULLETIN DE PAIE</h2>
              <p className="doc-subtitle">Fiche de paie mensuelle</p>
            </div>
            <div className="doc-fields">
              {(() => {
                const fullName =
                  [printStaff.lastName, printStaff.firstName].filter(Boolean).join(' ').trim() ||
                  printStaff.name
                const dob = formatDateFr(printStaff.dateOfBirth)
                return (
                  <>
                    <p><span className="doc-label">Nom et prénom:</span> <strong>{fullName}</strong></p>
                    {printStaff.position && (
                      <p><span className="doc-label">Poste:</span> <strong>{printStaff.position}</strong></p>
                    )}
                    {dob && <p><span className="doc-label">Date de naissance:</span> <strong>{dob}</strong></p>}
                    {printStaff.placeOfBirth && (
                      <p><span className="doc-label">Lieu de naissance:</span> <strong>{printStaff.placeOfBirth}</strong></p>
                    )}
                    {printStaff.documentNumber && (
                      <p><span className="doc-label">N° pièce d&apos;identité:</span> <strong>{printStaff.documentNumber}</strong></p>
                    )}
                    {printStaff.cnapsNumber && (
                      <p><span className="doc-label">N° CNAPS:</span> <strong>{printStaff.cnapsNumber}</strong></p>
                    )}
                    <p><span className="doc-label">Personnes à charge:</span> <strong>{printStaff.dependents}</strong></p>
                    <p><span className="doc-label">Mois:</span> <strong>{MONTHS_FR[month - 1]} {year}</strong></p>
                  </>
                )
              })()}
            </div>

            <table className="doc-table pay-table">
              <thead>
                <tr><th>Désignation</th><th className="pay-amount">Montant (Ar)</th></tr>
              </thead>
              <tbody>
                <tr><td>Salaire de base brut</td><td className="pay-amount">{formatAr(printPayslip.baseGrossSalary)}</td></tr>
                <tr><td>Taux horaire</td><td className="pay-amount">{formatAr(printPayslip.hourlyRate)}</td></tr>
                {printPayslip.overtimeFirst8Amount > 0 && <tr><td>Heures supp. (1–8)</td><td className="pay-amount">{formatAr(printPayslip.overtimeFirst8Amount)}</td></tr>}
                {printPayslip.overtimeAfter8Amount > 0 && <tr><td>Heures supp. (au-delà de 8)</td><td className="pay-amount">{formatAr(printPayslip.overtimeAfter8Amount)}</td></tr>}
                {printPayslip.nightRegularAmount > 0 && <tr><td>Travail de nuit régulier</td><td className="pay-amount">{formatAr(printPayslip.nightRegularAmount)}</td></tr>}
                {printPayslip.nightOccasionalAmount > 0 && <tr><td>Travail de nuit occasionnel</td><td className="pay-amount">{formatAr(printPayslip.nightOccasionalAmount)}</td></tr>}
                {printPayslip.sundayAmount > 0 && <tr><td>Travail du dimanche</td><td className="pay-amount">{formatAr(printPayslip.sundayAmount)}</td></tr>}
                {printPayslip.publicHolidayAmount > 0 && <tr><td>Jours fériés</td><td className="pay-amount">{formatAr(printPayslip.publicHolidayAmount)}</td></tr>}
                {printPayslip.bonuses > 0 && <tr><td>Primes</td><td className="pay-amount">{formatAr(printPayslip.bonuses)}</td></tr>}
                {printPayslip.taxableBenefits > 0 && <tr><td>Avantages imposables</td><td className="pay-amount">{formatAr(printPayslip.taxableBenefits)}</td></tr>}
                {printPayslip.unusedLeaveCompensation > 0 && <tr><td>Indemnité de congé non pris</td><td className="pay-amount">{formatAr(printPayslip.unusedLeaveCompensation)}</td></tr>}
                {/* Obdavcljivo nadomestilo dopusta (samo ce congeTaxable=true) */}
                {printPayslip.leaveAllowance > 0 && printPayslip.nonTaxableLeaveAllowance === 0 && <tr><td>Indemnité de congé{printStaff.leave ? ` (${printStaff.leave.takenThisMonth.toFixed(1)} j)` : ''}</td><td className="pay-amount">{formatAr(printPayslip.leaveAllowance)}</td></tr>}
                {printPayslip.leaveDeduction > 0 && <tr><td>Retenue congé{printStaff.leave ? ` (${printStaff.leave.takenThisMonth.toFixed(1)} j)` : ''}</td><td className="pay-amount">− {formatAr(printPayslip.leaveDeduction)}</td></tr>}
                <tr className="pay-total"><td>SALAIRE BRUT IMPOSABLE</td><td className="pay-amount">{formatAr(printPayslip.taxableGross)}</td></tr>
                <tr className="pay-section"><td colSpan={2}>Retenues salariales</td></tr>
                <tr><td>CNAPS salarié</td><td className="pay-amount">{formatAr(printPayslip.employeeCNAPS)}</td></tr>
                <tr><td>OSTIE salarié</td><td className="pay-amount">{formatAr(printPayslip.employeeOSTIE)}</td></tr>
                <tr><td>IRSA</td><td className="pay-amount">{formatAr(printPayslip.finalIRSA)}</td></tr>
                {printPayslip.employeeAdvances > 0 && <tr><td>Avances</td><td className="pay-amount">{formatAr(printPayslip.employeeAdvances)}</td></tr>}
                {printPayslip.otherEmployeeDeductions > 0 && <tr><td>Autres retenues</td><td className="pay-amount">{formatAr(printPayslip.otherEmployeeDeductions)}</td></tr>}
                <tr className="pay-subtotal"><td>Total des retenues</td><td className="pay-amount">{formatAr(printPayslip.totalEmployeeDeductions)}</td></tr>
                <tr className="pay-subtotal"><td>NET IMPOSABLE</td><td className="pay-amount">{formatAr(printPayslip.netSalary)}</td></tr>
                {printPayslip.nonTaxableLeaveAllowance > 0 && <tr><td>Indemnité de congé payé{printStaff.leave ? ` (${printStaff.leave.takenThisMonth.toFixed(1)} j)` : ''}</td><td className="pay-amount">+ {formatAr(printPayslip.nonTaxableLeaveAllowance)}</td></tr>}
                <tr className="pay-total"><td>SALAIRE NET À PAYER</td><td className="pay-amount">{formatAr(printPayslip.netToPay)}</td></tr>
                <tr className="pay-section"><td colSpan={2}>Charges patronales</td></tr>
                <tr><td>CNAPS employeur</td><td className="pay-amount">{formatAr(printPayslip.employerCNAPS)}</td></tr>
                <tr><td>OSTIE employeur</td><td className="pay-amount">{formatAr(printPayslip.employerOSTIE)}</td></tr>
                <tr><td>FMFP employeur</td><td className="pay-amount">{formatAr(printPayslip.employerFMFP)}</td></tr>
                <tr className="pay-total"><td>COÛT TOTAL EMPLOYEUR</td><td className="pay-amount">{formatAr(printPayslip.totalEmployerCost)}</td></tr>
              </tbody>
            </table>

            {/* CONGÉ PAYÉ — informativni prikaz stanja dopusta */}
            {printStaff.leave && (
              <div className="contrib-note">
                <p className="contrib-title">Congé annuel payé</p>
                <table className="doc-table pay-table">
                  <tbody>
                    <tr className="pay-section"><td colSpan={2}>Année en cours ({year})</td></tr>
                    <tr><td>Congé acquis {year}</td><td className="pay-amount">{printStaff.leave.currentYearEarned.toFixed(1)} j</td></tr>
                    <tr><td>Congé pris (année en cours)</td><td className="pay-amount">− {printStaff.leave.takenFromCurrent.toFixed(1)} j</td></tr>
                    <tr className="pay-subtotal"><td>Reste année en cours</td><td className="pay-amount">{printStaff.leave.currentYearRemaining.toFixed(1)} j</td></tr>
                    {(printStaff.leave.priorYearsBalance > 0 || printStaff.leave.takenFromPrior > 0) && (
                      <>
                        <tr className="pay-section"><td colSpan={2}>Années précédentes</td></tr>
                        <tr><td>Congé reporté (années précédentes)</td><td className="pay-amount">{printStaff.leave.priorYearsBalance.toFixed(1)} j</td></tr>
                        <tr><td>Congé pris (années précédentes)</td><td className="pay-amount">− {printStaff.leave.takenFromPrior.toFixed(1)} j</td></tr>
                        <tr className="pay-subtotal"><td>Reste années précédentes</td><td className="pay-amount">{printStaff.leave.priorYearsRemaining.toFixed(1)} j</td></tr>
                      </>
                    )}
                    <tr className="pay-total"><td>CONGÉ DISPONIBLE (mois suivants)</td><td className="pay-amount">{printStaff.leave.remaining.toFixed(1)} j</td></tr>
                    {printStaff.leave.sickDaysThisMonth > 0 && (
                      <tr>
                        <td>Congé de maladie — indemnité 100 % (salaire maintenu, ne réduit pas le congé)</td>
                        <td className="pay-amount">{printStaff.leave.sickDaysThisMonth} j</td>
                      </tr>
                    )}
                    {printPayslip.unusedLeaveCompensation > 0 && (
                      <tr><td>Indemnité de congé non pris</td><td className="pay-amount">{formatAr(printPayslip.unusedLeaveCompensation)}</td></tr>
                    )}
                  </tbody>
                </table>
                <p className="contrib-hint">
                  Le congé payé pris est rémunéré comme salaire normal (acquisition 2,5 jours par mois travaillé).
                  Le congé de l&apos;année en cours est utilisé en premier, puis le congé reporté des années précédentes.
                  Il reste {printStaff.leave.remaining.toFixed(1)} jour(s) de congé disponible(s) pour les mois suivants.
                </p>
              </div>
            )}

            {/* TEST: ÉCHÉANCIER DES COTISATIONS — samo na testni placilni listi */}
            {printStaff.id === 'staff-test-DELETE-ME' && (() => {
              const q = getQuarter(month)
              const dl = getQuarterDeadline(year, q)
              const quarterDeadlineFr = dl.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
              const irsaMonth = month === 12 ? 1 : month + 1
              const irsaYear = month === 12 ? year + 1 : year
              const irsaDeadline = new Date(irsaYear, irsaMonth - 1, 15).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
              const cnapsTotal = printPayslip.employeeCNAPS + printPayslip.employerCNAPS
              const ostieTotal = printPayslip.employeeOSTIE + printPayslip.employerOSTIE
              return (
                <div className="contrib-note">
                  <p className="contrib-title">ÉCHÉANCIER DES COTISATIONS (TEST) — Quand &amp; à qui payer</p>
                  <table className="doc-table pay-table">
                    <thead>
                      <tr>
                        <th>Organisme</th>
                        <th className="pay-amount">Part salarié</th>
                        <th className="pay-amount">Part employeur</th>
                        <th className="pay-amount">Total</th>
                        <th>Échéance</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>CNAPS (retraite)</td>
                        <td className="pay-amount">{formatAr(printPayslip.employeeCNAPS)}</td>
                        <td className="pay-amount">{formatAr(printPayslip.employerCNAPS)}</td>
                        <td className="pay-amount">{formatAr(cnapsTotal)}</td>
                        <td>Trimestriel — avant le {quarterDeadlineFr} (T{q})</td>
                      </tr>
                      <tr>
                        <td>OSTIE (santé)</td>
                        <td className="pay-amount">{formatAr(printPayslip.employeeOSTIE)}</td>
                        <td className="pay-amount">{formatAr(printPayslip.employerOSTIE)}</td>
                        <td className="pay-amount">{formatAr(ostieTotal)}</td>
                        <td>Trimestriel — avant le {quarterDeadlineFr} (T{q})</td>
                      </tr>
                      <tr>
                        <td>FMFP (formation)</td>
                        <td className="pay-amount">—</td>
                        <td className="pay-amount">{formatAr(printPayslip.employerFMFP)}</td>
                        <td className="pay-amount">{formatAr(printPayslip.employerFMFP)}</td>
                        <td>Trimestriel — avant le {quarterDeadlineFr} (T{q})</td>
                      </tr>
                      <tr>
                        <td>IRSA (impôt)</td>
                        <td className="pay-amount">{formatAr(printPayslip.finalIRSA)}</td>
                        <td className="pay-amount">—</td>
                        <td className="pay-amount">{formatAr(printPayslip.finalIRSA)}</td>
                        <td>Mensuel — avant le {irsaDeadline}</td>
                      </tr>
                    </tbody>
                  </table>
                  <p className="contrib-hint">
                    CNAPS, OSTIE et FMFP sont versés trimestriellement aux caisses respectives ;
                    l&apos;IRSA est reversé mensuellement à l&apos;administration fiscale (impôts).
                  </p>
                </div>
              )
            })()}

            <div className="doc-signatures">
              <div><p className="doc-sign-line">Signature de l&apos;employé</p></div>
              <div><p className="doc-sign-line">Signature de l&apos;employeur</p></div>
            </div>
          </div>
        </div>
      )}

      {/* ===== Predogled slike liste prisotnosti ===== */}
      {previewImage && typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 no-print"
            onClick={() => setPreviewImage(null)}
          >
            <div
              className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#101d22] shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
                <h3 className="flex items-center gap-2 truncate text-sm font-semibold text-white">
                  <ImageIcon className="h-4 w-4 text-[#7fa8b8]" />
                  {previewImage.name}
                </h3>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handlePrintAttendance}
                    className="flex items-center gap-1.5 rounded-lg border border-[#c59b5b]/30 bg-[#c59b5b]/10 px-3 py-1.5 text-xs font-medium text-[#c59b5b] transition hover:bg-[#c59b5b]/20"
                  >
                    <Printer className="h-4 w-4" /> Natisni
                  </button>
                  <a
                    href={`/api/image?pathname=${encodeURIComponent(previewImage.pathname)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
                  >
                    Odpri v novem zavihku
                  </a>
                  <button
                    onClick={() => setPreviewImage(null)}
                    className="rounded-lg p-1.5 text-white/50 transition hover:bg-white/10 hover:text-white"
                    aria-label="Zapri predogled"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-auto bg-black/40 p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/image?pathname=${encodeURIComponent(previewImage.pathname)}`}
                  alt={previewImage.name}
                  className="mx-auto h-auto max-w-full rounded-lg"
                />
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* ===== PRINT: samo slika liste prisotnosti (cez celo stran) ===== */}
      {previewImage && typeof document !== 'undefined' &&
        createPortal(
          <div className="attendance-print" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/image?pathname=${encodeURIComponent(previewImage.pathname)}`}
              alt={previewImage.name}
            />
          </div>,
          document.body
        )}

      {/* ===== Predogled emaila za racunovodstvo ===== */}
      {reportPreview && typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 no-print"
            onClick={() => setReportPreview(null)}
          >
            <div
              className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#101d22] shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Mail className="h-4 w-4 text-[#c59b5b]" />
                  Pošlji obračun ur računovodstvu — {reportPreview.staffName}
                </h3>
                <button
                  onClick={() => setReportPreview(null)}
                  className="rounded-lg p-1.5 text-white/50 transition hover:bg-white/10 hover:text-white"
                  aria-label="Zapri"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-3 border-b border-white/10 px-5 py-3">
                <label className="text-xs font-medium text-white/60">Email računovodstva:</label>
                <input
                  type="email"
                  value={reportPreview.to}
                  onChange={(e) => setReportPreview((p) => (p ? { ...p, to: e.target.value } : p))}
                  placeholder="racunovodstvo@primer.si"
                  className="min-w-[220px] flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white placeholder:text-white/30 focus:border-[#c59b5b]/40 focus:outline-none"
                />
              </div>

              <div className="flex-1 overflow-auto bg-black/40 p-3">
                <iframe
                  srcDoc={reportPreview.html}
                  title="Predogled emaila"
                  className="h-[52vh] w-full rounded-lg border border-white/10 bg-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-white/10 px-5 py-4">
                <button
                  onClick={() => setReportPreview(null)}
                  className="rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-white/60 transition hover:bg-white/10 hover:text-white"
                >
                  Prekliči
                </button>
                <button
                  onClick={handleSendReport}
                  disabled={sendingReport}
                  className="flex items-center gap-1.5 rounded-lg bg-[#c59b5b] px-4 py-2 text-sm font-semibold text-[#171007] transition hover:bg-[#d6aa75] disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                  {sendingReport ? 'Pošiljam…' : 'Pošlji email'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* ===== PRINT: Fiche de paie simplifiée (ostali — bruto = neto) ===== */}
      {printOther && (
        <div className="payslip-print" aria-hidden="true">
          <div className="doc-page">
            <div className="doc-header">
              <img className="doc-logo" src="/images/komba-logo-color.png" alt="Komba Cabana" />
              <p className="doc-company">{getCompany(printOther.company).name}</p>
              <p className="doc-location">{getCompany(printOther.company).address}</p>
              <p className="doc-location">Nosy Komba, Madagascar</p>
            </div>
            <div className="doc-title-block">
              <h2 className="doc-title">FICHE DE PAIE</h2>
              <p className="doc-subtitle">Travailleur occasionnel — montant net</p>
            </div>
            <div className="doc-fields">
              {(() => {
                const fullName =
                  [printOther.lastName, printOther.firstName].filter(Boolean).join(' ').trim() ||
                  printOther.name
                return (
                  <>
                    <p><span className="doc-label">Nom et prénom:</span> <strong>{fullName}</strong></p>
                    {printOther.position && (
                      <p><span className="doc-label">Poste:</span> <strong>{printOther.position}</strong></p>
                    )}
                    {printOther.documentNumber && (
                      <p><span className="doc-label">N° pièce d&apos;identité:</span> <strong>{printOther.documentNumber}</strong></p>
                    )}
                    <p><span className="doc-label">Mois:</span> <strong>{MONTHS_FR[month - 1]} {year}</strong></p>
                  </>
                )
              })()}
            </div>

            <table className="doc-table pay-table">
              <thead>
                <tr><th>Désignation</th><th className="pay-amount">Montant (Ar)</th></tr>
              </thead>
              <tbody>
                <tr><td>Rémunération</td><td className="pay-amount">{formatAr(printOther.amount)}</td></tr>
                <tr className="pay-total"><td>NET À PAYER</td><td className="pay-amount">{formatAr(printOther.amount)}</td></tr>
              </tbody>
            </table>

            <div className="contrib-note">
              <p className="contrib-hint">
                Travailleur occasionnel : montant versé net, sans cotisations sociales (CNAPS / OSTIE / FMFP),
                sans IRSA ni congé payé.
              </p>
            </div>

            <div className="doc-signatures">
              <div><p className="doc-sign-line">Signature de l&apos;employé</p></div>
              <div><p className="doc-sign-line">Signature de l&apos;employeur</p></div>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .payslip-print { display: none; }
        .attendance-print { display: none; }

        @media print {
          @page { size: portrait; margin: 14mm; }
          body { background: #fff !important; }
          .no-print { display: none !important; }

          body.printing-payslip * { visibility: hidden; }
          body.printing-payslip .payslip-print,
          body.printing-payslip .payslip-print * { visibility: visible; }
          body.printing-payslip .payslip-print {
            display: block !important;
            position: absolute; left: 0; top: 0; width: 100%;
          }

          body.printing-attendance * { visibility: hidden; }
          body.printing-attendance .attendance-print,
          body.printing-attendance .attendance-print * { visibility: visible; }
          body.printing-attendance .attendance-print {
            display: block !important;
            position: absolute; left: 0; top: 0; width: 100%;
          }
          body.printing-attendance .attendance-print img {
            display: block;
            width: 100%;
            max-width: 100%;
            height: auto;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .payslip-print .doc-page { color: #111; font-family: Georgia, 'Times New Roman', serif; }
          .payslip-print .doc-header { text-align: center; border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 4px; }
          .payslip-print .doc-logo { display: block; margin: 0 auto; height: 56px; width: auto; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .payslip-print .doc-company { font-size: 14px; font-weight: 700; letter-spacing: 0.5px; margin: 6px 0 0; }
          .payslip-print .doc-location { font-size: 12px; font-style: italic; color: #333; margin: 2px 0 0; }
          .payslip-print .doc-title-block { text-align: center; border-bottom: 1px solid #111; padding-bottom: 10px; margin-bottom: 16px; }
          .payslip-print .doc-title { font-size: 20px; font-weight: 700; letter-spacing: 1px; margin: 12px 0 0; }
          .payslip-print .doc-subtitle { font-size: 12px; color: #777; margin: 3px 0 0; }
          .payslip-print .doc-fields { font-size: 13px; line-height: 1.7; margin-bottom: 16px; }
          .payslip-print .doc-fields p { margin: 0; }
          .payslip-print .doc-label { display: inline-block; min-width: 150px; }
          .payslip-print .pay-table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 4px; }
          .payslip-print .pay-table th, .payslip-print .pay-table td { border: 1px solid #999; padding: 5px 10px; }
          .payslip-print .pay-table th { background: #f8f5ef !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-size: 12px; text-align: left; }
          .payslip-print .pay-amount { text-align: right; white-space: nowrap; }
          .payslip-print .pay-section td { font-weight: 700; background: #f3f2f1 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
          .payslip-print .pay-subtotal td { font-weight: 600; background: #f7f6f5 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .payslip-print .pay-total td { font-weight: 700; background: #f8f5ef !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .payslip-print .doc-signatures { display: flex; justify-content: space-between; margin-top: 48px; gap: 40px; }
          .payslip-print .doc-signatures > div { flex: 1; }
          .payslip-print .doc-sign-line { border-top: 1px solid #111; padding-top: 4px; font-size: 12px; text-align: center; }
          .payslip-print .contrib-note { margin-top: 18px; border: 1px solid #999; padding: 10px 12px; }
          .payslip-print .contrib-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 8px; }
          .payslip-print .contrib-hint { font-size: 11px; font-style: italic; color: #444; margin: 8px 0 0; }
        }
      `}</style>
    </div>
  )
}

function NumInput({
  label,
  value,
  onChange,
  wide,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  wide?: boolean
}) {
  return (
    <div className={wide ? 'col-span-2' : ''}>
      <label className="block text-[11px] font-medium uppercase tracking-wider text-white/40">{label}</label>
      <input
        type="number"
        className="mt-1 w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-sm text-white focus:border-[#7fa8b8]/40 focus:outline-none"
        value={value === 0 ? '' : value}
        placeholder="0"
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </div>
  )
}

function Row({
  label,
  value,
  muted,
  strong,
  accent,
}: {
  label: string
  value: string
  muted?: boolean
  strong?: boolean
  accent?: boolean
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={`${muted ? 'text-white/40' : 'text-white/60'}`}>{label}</span>
      <span
        className={`tabular-nums ${
          accent ? 'text-[#8fae92]' : strong ? 'text-white' : 'text-white/80'
        } ${strong ? 'font-semibold' : ''}`}
      >
        {value}
      </span>
    </div>
  )
}

function StatBox({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        accent ? 'border-[#8fae92]/30 bg-[#8fae92]/10' : 'border-white/[0.06] bg-white/[0.02]'
      }`}
    >
      <p className="text-[11px] uppercase tracking-wider text-white/40">{label}</p>
      <p className={`mt-1 text-base font-bold ${accent ? 'text-[#8fae92]' : 'text-white'}`}>{value}</p>
    </div>
  )
}
