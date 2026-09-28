'use client'

import React, { useMemo, useState, useEffect } from 'react'
import useSWR from 'swr'
import { Calculator, Save, Printer, AlertTriangle, Check, Settings2, UserRound, ChevronDown, CalendarClock, Download } from 'lucide-react'
import {
  getMgPayrollConfig,
  getMgPayrollStaff,
  getMgPayrollEntries,
  upsertMgPayrollEntry,
  getMgAttendanceSummary,
  type MgStaffOption,
  type MgEntry,
} from '@/app/actions/payroll-mg'
import {
  calcMgPayslip,
  minWageForCategory,
  isBelowMinimum,
  formatMgAr,
  getMgCompany,
  completedYearsBetween,
  seniorityRateForYears,
  DEFAULT_MG_CONFIG,
  type MgPayrollConfig,
  type MgPayslipInput,
} from '@/lib/payroll-mg'
import { buildBulletinHtml, type BulletinMeta } from '@/lib/bulletin-paie'
import MgPayrollSettings from '@/components/mg-payroll-settings'

const MONTHS_SL = [
  'Januar', 'Februar', 'Marec', 'April', 'Maj', 'Junij',
  'Julij', 'Avgust', 'September', 'Oktober', 'November', 'December',
]

type FormState = {
  staffId: string | null
  fullName: string
  fonction: string
  category: string
  hireDate: string
  companyId: string
  cnapsNumber: string
  ominoNumber: string
  baseSalary: string
  monthlyHours: string
  normalHours: string
  sundayHours: string
  holidayHours: string
  overtimeHours: string
  sundayRate: string
  holidayRate: string
  overtimeRate: string
  otherBonuses: string
  targetNet: string
  contributionBaseManual: string // prazno = privzeto (osnovna placa)
  irsa: string
  advances: string
  otherDeductions: string
  leaveDays: string
  seniorityYears: string      // dopolnjena leta dobe (samodejno iz datuma zaposlitve, moznost override)
  grossUpLabelFr: string
}

function emptyForm(config: MgPayrollConfig): FormState {
  return {
    staffId: null,
    fullName: '',
    fonction: '',
    category: '',
    hireDate: '',
    companyId: 'tourism',
    cnapsNumber: '',
    ominoNumber: '',
    baseSalary: '',
    monthlyHours: String(config.monthlyHours),
    normalHours: '',
    sundayHours: '',
    holidayHours: '',
    overtimeHours: '',
    sundayRate: String(config.sundayRate * 100),
    holidayRate: String(config.holidayRate * 100),
    overtimeRate: String(config.overtimeRate * 100),
    otherBonuses: '',
  targetNet: '',
    contributionBaseManual: '',
    irsa: String(config.defaultIrsa),
    advances: '',
    otherDeductions: '',
    leaveDays: '',
    seniorityYears: '',
    grossUpLabelFr: config.defaultGrossUpLabelFr,
  }
}

function nv(s: string): number {
  const n = Number(String(s).replace(',', '.'))
  return isNaN(n) ? 0 : n
}

export default function ObracunPlaceMg({ year, month }: { year: number; month: number }) {
  const { data: config } = useSWR('mg-config', getMgPayrollConfig)
  const { data: staff } = useSWR('mg-staff', getMgPayrollStaff)
  const { data: entries, mutate: mutateEntries } = useSWR(
    ['mg-entries', year, month],
    () => getMgPayrollEntries(year, month),
  )

  const cfg = config ?? DEFAULT_MG_CONFIG
  const [f, setF] = useState<FormState>(() => emptyForm(DEFAULT_MG_CONFIG))

  // Obracun ur iz liste prisotnosti za izbranega delavca + mesec.
  const { data: attendance } = useSWR(
    f.staffId ? ['mg-attendance', f.staffId, year, month] : null,
    () => getMgAttendanceSummary(f.staffId as string, year, month),
  )

  // Prenese ure iz liste prisotnosti v obrazec (redne/nedelja/praznik/dopust).
  function applyAttendance() {
    if (!attendance) return
    setF((prev) => ({
      ...prev,
      normalHours: attendance.normalHours ? String(attendance.normalHours) : '',
      sundayHours: attendance.sundayHours ? String(attendance.sundayHours) : '',
      holidayHours: attendance.holidayHours ? String(attendance.holidayHours) : '',
      leaveDays: attendance.leaveDays ? String(attendance.leaveDays) : '',
    }))
    setMsg('Ure prenesene iz liste prisotnosti.')
  }
  const [showSettings, setShowSettings] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [loadedConfigOnce, setLoadedConfigOnce] = useState(false)

  // Ko se nalozijo nastavitve, osvezi privzete vrednosti praznega obrazca (samo enkrat)
  useEffect(() => {
    if (config && !loadedConfigOnce) {
      setF((prev) => ({
        ...prev,
        monthlyHours: prev.monthlyHours || String(config.monthlyHours),
        sundayRate: prev.sundayRate || String(config.sundayRate * 100),
        holidayRate: prev.holidayRate || String(config.holidayRate * 100),
        overtimeRate: prev.overtimeRate || String(config.overtimeRate * 100),
        irsa: prev.irsa || String(config.defaultIrsa),
        grossUpLabelFr: prev.grossUpLabelFr || config.defaultGrossUpLabelFr,
      }))
      setLoadedConfigOnce(true)
    }
  }, [config, loadedConfigOnce])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setF((prev) => ({ ...prev, [key]: value }))
    setMsg(null)
  }

  function loadStaff(s: MgStaffOption) {
    const periodEnd = `${year}-${String(month).padStart(2, '0')}-28`
    const years = completedYearsBetween(s.hireDate, periodEnd)
    setF((prev) => ({
      ...prev,
      staffId: s.id,
      fullName: s.fullName,
      fonction: s.fonction,
      category: s.category || prev.category,
      hireDate: s.hireDate || '',
      companyId: s.company === 'sarl' ? 'sarl' : 'tourism',
      cnapsNumber: s.cnapsNumber,
      ominoNumber: s.ominoNumber,
      baseSalary: String(s.officialSalary || ''),
      contributionBaseManual: '',
      seniorityYears: years > 0 ? String(years) : '',
    }))
    setMsg(null)
  }

  function loadEntry(e: MgEntry) {
    setF({
      staffId: e.staffId,
      fullName: e.staffName,
      fonction: e.fonction || '',
      category: e.category || '',
      hireDate: e.hireDate || '',
      companyId: e.companyId || 'tourism',
      cnapsNumber: staff?.find((s) => s.id === e.staffId)?.cnapsNumber || '',
      ominoNumber: staff?.find((s) => s.id === e.staffId)?.ominoNumber || '',
      baseSalary: String(e.baseSalary || ''),
      monthlyHours: String(e.monthlyHours || cfg.monthlyHours),
      normalHours: e.normalHours ? String(e.normalHours) : '',
      sundayHours: e.sundayHours ? String(e.sundayHours) : '',
      holidayHours: e.holidayHours ? String(e.holidayHours) : '',
      overtimeHours: e.overtimeHours ? String(e.overtimeHours) : '',
      sundayRate: String((e.sundayRate ?? cfg.sundayRate) * 100),
      holidayRate: String((e.holidayRate ?? cfg.holidayRate) * 100),
      overtimeRate: String((e.overtimeRate ?? cfg.overtimeRate) * 100),
      otherBonuses: e.otherBonuses ? String(e.otherBonuses) : '',
      targetNet: '',
      contributionBaseManual:
        e.contributionBase != null && e.contributionBase !== e.baseSalary
          ? String(e.contributionBase)
          : '',
      irsa: String(e.irsa ?? cfg.defaultIrsa),
      advances: e.advances ? String(e.advances) : '',
      otherDeductions: e.otherDeductions ? String(e.otherDeductions) : '',
      leaveDays: e.leaveDays ? String(e.leaveDays) : '',
      seniorityYears: e.seniorityYears ? String(e.seniorityYears) : '',
      grossUpLabelFr: e.grossUpLabelFr || cfg.defaultGrossUpLabelFr,
    })
    setMsg(null)
  }

  // --- Sprotni izracun ---
  const periodDate = `${year}-${String(month).padStart(2, '0')}-28`
  const baseSalary = Math.round(nv(f.baseSalary))
  const contribBaseManual = f.contributionBaseManual.trim() === '' ? null : Math.round(nv(f.contributionBaseManual))

  const input: MgPayslipInput = {
    baseSalary,
    monthlyHours: nv(f.monthlyHours) || cfg.monthlyHours,
    normalHours: nv(f.normalHours),
    sundayHours: nv(f.sundayHours),
    holidayHours: nv(f.holidayHours),
    overtimeHours: nv(f.overtimeHours),
    sundayRate: nv(f.sundayRate) / 100,
    holidayRate: nv(f.holidayRate) / 100,
    overtimeRate: nv(f.overtimeRate) / 100,
    otherBonuses: Math.round(nv(f.otherBonuses)),
    contributionBase: contribBaseManual,
    irsa: Math.round(nv(f.irsa)),
    advances: Math.round(nv(f.advances)),
    otherDeductions: Math.round(nv(f.otherDeductions)),
    leaveDays: nv(f.leaveDays),
    seniorityYears: Math.floor(nv(f.seniorityYears)),
  }
  const slip = useMemo(() => calcMgPayslip(input, cfg, periodDate), [JSON.stringify(input), cfg, periodDate])

  const minWage = minWageForCategory(f.category, cfg)
  const belowMin = f.category !== '' && baseSalary > 0 && isBelowMinimum(baseSalary, f.category, cfg)

  async function handleSave() {
    if (!f.fullName.trim()) {
      setMsg('Vnesite ime in priimek zaposlenega.')
      return
    }
    setSaving(true)
    try {
      await upsertMgPayrollEntry({
        staffId: f.staffId,
        staffName: f.fullName.trim(),
        fonction: f.fonction || null,
        category: f.category || null,
        hireDate: f.hireDate || null,
        companyId: f.companyId,
        year,
        month,
        baseSalary,
        monthlyHours: nv(f.monthlyHours) || cfg.monthlyHours,
        normalHours: nv(f.normalHours),
        sundayHours: nv(f.sundayHours),
        holidayHours: nv(f.holidayHours),
        overtimeHours: nv(f.overtimeHours),
        sundayRate: nv(f.sundayRate) / 100,
        holidayRate: nv(f.holidayRate) / 100,
        overtimeRate: nv(f.overtimeRate) / 100,
        otherBonuses: Math.round(nv(f.otherBonuses)),
        contributionBase: contribBaseManual,
        irsa: Math.round(nv(f.irsa)),
        advances: Math.round(nv(f.advances)),
        otherDeductions: Math.round(nv(f.otherDeductions)),
        leaveDays: nv(f.leaveDays),
        seniorityYears: Math.floor(nv(f.seniorityYears)),
        grossUpLabelFr: f.grossUpLabelFr || null,
      })
      await mutateEntries()
      setMsg('Obračun shranjen.')
    } catch (e) {
      setMsg('Napaka pri shranjevanju.')
    } finally {
      setSaving(false)
    }
  }

  async function handlePrint() {
    const company = getMgCompany(f.companyId)
    const person = staff?.find((s) => s.id === f.staffId)
    // Barvni logo vgradimo kot data URI, da se ZANESLJIVO natisne (brez mrezne zamude v iframe).
    const logoDataUrl = await loadLogoDataUrl()
    const meta: BulletinMeta = {
      employer: company.name,
      employerAddress: company.address,
      employerNif: company.nif,
      employerRcs: company.rcs,
      employerStat: company.stat,
      employerTaxCenter: company.taxCenter,
      fullName: f.fullName || '—',
      fonction: f.fonction,
      category: f.category,
      hireDate: f.hireDate,
      year,
      month,
      cnapsNumber: f.cnapsNumber,
      ominoNumber: f.ominoNumber,
      dateOfBirth: person?.dateOfBirth || '',
      placeOfBirth: person?.placeOfBirth || '',
      cin: person?.cin || '',
      domicile: person?.domicile || '',
      leaveAccrued: attendance?.leaveBalance?.accrued,
      leaveUsed: attendance?.leaveBalance?.used,
      leaveRemaining: attendance?.leaveBalance?.remaining,
      leaveAsOf: attendance?.leaveBalance?.asOfISO,
      leavePriorByYear: attendance?.leaveBalance?.priorByYear,
      logoDataUrl,
      grossUpLabelFr: f.grossUpLabelFr || cfg.defaultGrossUpLabelFr,
    }
    const html = buildBulletinHtml(slip, meta)
    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    document.body.appendChild(iframe)
    const doc = iframe.contentWindow?.document
    if (!doc) return
    doc.open()
    doc.write(html)
    doc.close()
    setTimeout(() => {
      iframe.contentWindow?.focus()
      iframe.contentWindow?.print()
      setTimeout(() => document.body.removeChild(iframe), 1000)
    }, 300)
  }

  const inputCls =
    'w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/25 focus:border-[#7fa8b8]/50 focus:outline-none'
  const labelCls = 'block text-[11px] uppercase tracking-wide text-white/40 mb-1'

  return (
    <div className="space-y-4">
      {/* Glava */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Calculator className="h-5 w-5 text-[#7fa8b8]" />
          <div>
            <h2 className="text-lg font-semibold text-white">Obračun plače – Madagaskar</h2>
            <p className="text-xs text-white/40">
              Obdobje: {MONTHS_SL[(month - 1) % 12]} {year} · osnovna plača = neto, ki ga prejme zaposleni
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowSettings((v) => !v)}
          className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm text-white/70 hover:bg-white/10"
        >
          <Settings2 className="h-4 w-4" />
          Nastavitve stopenj
          <ChevronDown className={`h-4 w-4 transition-transform ${showSettings ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {showSettings && <MgPayrollSettings />}

      {/* Hitri izbor shranjenih obračunov tega meseca */}
      {entries && entries.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-white/40 self-center">Shranjeni obračuni:</span>
          {entries.map((e) => (
            <button
              key={e.id}
              onClick={() => loadEntry(e)}
              className="rounded-full bg-[#7fa8b8]/10 px-3 py-1 text-xs text-[#7fa8b8] hover:bg-[#7fa8b8]/20"
            >
              {e.staffName} · {formatMgAr(e.baseSalary)}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        {/* ===== OBRAZEC ===== */}
        <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          {/* Zaposleni */}
          <div>
            <label className={labelCls}>Zaposleni (samodejno izpolni podatke)</label>
            <div className="relative">
              <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
              <select
                value={f.staffId ?? ''}
                onChange={(e) => {
                  const s = staff?.find((x) => x.id === e.target.value)
                  if (s) loadStaff(s)
                  else set('staffId', null)
                }}
                className={`${inputCls} pl-9`}
              >
                <option value="">— ročni vnos —</option>
                {staff?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName} ({getMgCompany(s.company).name})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Ime in priimek</label>
              <input className={inputCls} value={f.fullName} onChange={(e) => set('fullName', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Delovno mesto</label>
              <input className={inputCls} value={f.fonction} onChange={(e) => set('fonction', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Kategorija zaposlenega</label>
              <select className={inputCls} value={f.category} onChange={(e) => set('category', e.target.value)}>
                <option value="">— brez —</option>
                {cfg.categories.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} — min. {formatMgAr(c.minWage)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Datum zaposlitve</label>
              <input
                type="date"
                className={`${inputCls} [color-scheme:dark]`}
                value={f.hireDate}
                onChange={(e) => set('hireDate', e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Podjetje</label>
              <select className={inputCls} value={f.companyId} onChange={(e) => set('companyId', e.target.value)}>
                <option value="tourism">{getMgCompany('tourism').name}</option>
                <option value="sarl">{getMgCompany('sarl').name}</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Mesečni fond ur</label>
              <input
                type="number"
                step="0.01"
                className={inputCls}
                value={f.monthlyHours}
                onChange={(e) => set('monthlyHours', e.target.value)}
              />
            </div>
          </div>

          {/* Osnovna placa */}
          <div>
            <label className={labelCls}>Osnovna mesečna plača (Ar) — neto, ki ga prejme zaposleni</label>
            <input
              type="number"
              className={`${inputCls} ${belowMin ? 'border-amber-400/60' : ''}`}
              value={f.baseSalary}
              onChange={(e) => set('baseSalary', e.target.value)}
              placeholder="npr. 300000"
            />
            {minWage != null && (
              <p className="mt-1 text-[11px] text-white/35">
                Minimalna plača za {f.category}: {formatMgAr(minWage)}
              </p>
            )}
            {belowMin && (
              <p className="mt-1 flex items-start gap-1 text-[11px] text-amber-300">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Osnovna plača je nižja od zakonsko določene minimalne plače za izbrano kategorijo.
              </p>
            )}
          </div>

          {/* Ure / dodatki */}
          <div className="rounded-xl border border-white/10 p-3">
            <p className="mb-2 text-[11px] uppercase tracking-wide text-white/40">Ure in dodatki</p>

            {/* Obracun ur iz liste prisotnosti */}
            {f.staffId && attendance?.hasData && (
              <div className="mb-3 rounded-lg border border-[#c59b5b]/30 bg-[#c59b5b]/[0.05] p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-[12px] font-medium text-[#c59b5b]">
                    <CalendarClock className="h-3.5 w-3.5" />
                    Obračun ur (iz liste prisotnosti)
                  </span>
                  <button
                    type="button"
                    onClick={applyAttendance}
                    className="flex items-center gap-1 rounded-md bg-[#c59b5b] px-2.5 py-1 text-[11px] font-semibold text-[#1d1b17] transition hover:bg-[#d4a770]"
                  >
                    <Download className="h-3 w-3" /> Prenesi ure
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12px] sm:grid-cols-4">
                  <div className="flex justify-between sm:block">
                    <span className="text-white/50">Redne</span>
                    <span className="font-medium tabular-nums sm:ml-1">{attendance.normalHours} h</span>
                  </div>
                  <div className="flex justify-between sm:block">
                    <span className="text-white/50">Nedelja</span>
                    <span className="font-medium tabular-nums sm:ml-1">{attendance.sundayHours} h</span>
                  </div>
                  <div className="flex justify-between sm:block">
                    <span className="text-white/50">Praznik</span>
                    <span className="font-medium tabular-nums sm:ml-1">{attendance.holidayHours} h</span>
                  </div>
                  <div className="flex justify-between sm:block">
                    <span className="text-white/50">Dopust</span>
                    <span className="font-medium tabular-nums sm:ml-1">{attendance.leaveDays} dni</span>
                  </div>
                </div>
                <p className="mt-2 border-t border-white/10 pt-1.5 text-[11px] text-white/40">
                  Skupaj priznano {attendance.creditedHours} h / norma {attendance.norm} h
                  {attendance.diff < 0
                    ? ` · manjka ${Math.abs(attendance.diff)} h`
                    : attendance.diff > 0
                      ? ` · presežek ${attendance.diff} h`
                      : ' · norma dosežena'}
                </p>
                <p className="mt-1 text-[11px] text-white/40">
                  Dopust {year}: pripada {fmtDays(attendance.leaveBalance.accrued)} dni · koriščeno{' '}
                  {fmtDays(attendance.leaveBalance.used)} dni ·{' '}
                  <span className="font-medium text-[#c59b5b]">
                    ostane {fmtDays(attendance.leaveBalance.remaining)} dni
                  </span>{' '}
                  (na dan {formatDateSlo(attendance.leaveBalance.asOfISO)})
                </p>
                {attendance.leaveBalance.priorByYear?.length > 0 && (
                  <p className="mt-1 text-[11px] text-white/40">
                    Od tega prenos iz preteklih let:{' '}
                    {attendance.leaveBalance.priorByYear.map((pr, i) => (
                      <span key={pr.year}>
                        {i > 0 ? ' · ' : ''}
                        {pr.year}:{' '}
                        <span className="font-medium text-white/70">{fmtDays(pr.days)} dni</span>
                      </span>
                    ))}
                  </p>
                )}
              </div>
            )}
            {f.staffId && attendance && !attendance.hasData && (
              <p className="mb-3 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-[11px] text-white/40">
                Za tega delavca v {MONTHS_SL[month - 1].toLowerCase()} {year} še ni vpisane liste prisotnosti (obračuna ur).
              </p>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Redne ure</label>
                <input type="number" className={inputCls} value={f.normalHours} onChange={(e) => set('normalHours', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Nedeljske ure</label>
                <input type="number" className={inputCls} value={f.sundayHours} onChange={(e) => set('sundayHours', e.target.value)} />
                {slip.sundayHours > 0 && (
                  <p className="mt-1 text-[11px] text-[#8fae92]">
                    Dodatek: {formatMgAr(slip.sundayAmount)} ({Math.round(slip.sundayRate * 100)}%)
                  </p>
                )}
              </div>
              <div>
                <label className={labelCls}>Ure na praznik</label>
                <input type="number" className={inputCls} value={f.holidayHours} onChange={(e) => set('holidayHours', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Nadure</label>
                <input type="number" className={inputCls} value={f.overtimeHours} onChange={(e) => set('overtimeHours', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Stopnja nedelja (%)</label>
                <input type="number" className={inputCls} value={f.sundayRate} onChange={(e) => set('sundayRate', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Stopnja praznik (%)</label>
                <input type="number" className={inputCls} value={f.holidayRate} onChange={(e) => set('holidayRate', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Stopnja nadure (%)</label>
                <input type="number" className={inputCls} value={f.overtimeRate} onChange={(e) => set('overtimeRate', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Delovna doba (leta)</label>
                <input
                  type="number"
                  min="0"
                  className={inputCls}
                  value={f.seniorityYears}
                  onChange={(e) => set('seniorityYears', e.target.value)}
                  placeholder="samodejno iz datuma zaposlitve"
                />
                {slip.seniorityRate > 0 ? (
                  <p className="mt-1 text-[11px] text-[#8fae92]">
                    Dodatek za dobo: {formatMgAr(slip.seniorityAmount)} ({Math.round(slip.seniorityRate * 100)}% · {slip.seniorityYears} let)
                  </p>
                ) : (
                  <p className="mt-1 text-[11px] text-white/30">Pod 2 leti = brez dodatka (3% po 2 letih, +1%/leto)</p>
                )}
              </div>
              <div>
                <label className={labelCls}>Bonus / dodatek (Ar)</label>
                <input type="number" className={inputCls} value={f.otherBonuses} onChange={(e) => set('otherBonuses', e.target.value)} />
                {slip.otherBonuses > 0 && (
                  <p className="mt-1 text-[11px] text-[#8fae92]">
                    Bonus: {formatMgAr(slip.otherBonuses)} · končno izplačilo {formatMgAr(slip.netToPay)}
                  </p>
                )}
              </div>
              <div>
                <label className={labelCls}>Cilj izplačila (Ar) — koliko naj dejansko dobi</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    className={inputCls}
                    value={f.targetNet}
                    onChange={(e) => set('targetNet', e.target.value)}
                    placeholder="npr. 500000"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const target = Math.round(nv(f.targetNet))
                      if (target <= 0) return
                      // Bonus, ki dvigne koncno izplacilo na ciljni znesek.
                      const netWithoutBonus = slip.netToPay - slip.otherBonuses
                      const neededBonus = Math.max(0, target - netWithoutBonus)
                      set('otherBonuses', String(neededBonus))
                    }}
                    className="shrink-0 rounded-lg bg-[#8fae92] px-3 text-[12px] font-semibold text-[#111a11] transition hover:bg-[#77a07b]"
                  >
                    Izračunaj bonus
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-white/30">
                  Vnesi želeno izplačilo in klikni — bonus se izračuna, da doseže ta znesek.
                </p>
              </div>
            </div>
          </div>

          {/* Prispevki / IRSA / odbitki */}
          <div className="rounded-xl border border-white/10 p-3">
            <p className="mb-2 text-[11px] uppercase tracking-wide text-white/40">Prispevki, IRSA in odbitki</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Prispevna osnova (Ar)</label>
                <input
                  type="number"
                  className={inputCls}
                  value={f.contributionBaseManual}
                  onChange={(e) => set('contributionBaseManual', e.target.value)}
                  placeholder={`privzeto ${formatMgAr(baseSalary)}`}
                />
              </div>
              <div>
                <label className={labelCls}>IRSA (Ar) — ročni vnos</label>
                <input type="number" className={inputCls} value={f.irsa} onChange={(e) => set('irsa', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Predujmi (Ar)</label>
                <input type="number" className={inputCls} value={f.advances} onChange={(e) => set('advances', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Drugi odbitki (Ar)</label>
                <input type="number" className={inputCls} value={f.otherDeductions} onChange={(e) => set('otherDeductions', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Dnevi dopusta</label>
                <input type="number" className={inputCls} value={f.leaveDays} onChange={(e) => set('leaveDays', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Naziv postavke povečanja (francoski izpis)</label>
                <input className={inputCls} value={f.grossUpLabelFr} onChange={(e) => set('grossUpLabelFr', e.target.value)} />
              </div>
            </div>
          </div>

          {/* Gumbi */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-[#8fae92] px-4 py-2 text-sm font-medium text-[#0f1a10] hover:bg-[#759f79] disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Shranjujem…' : 'Shrani obračun'}
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 rounded-lg bg-[#7fa8b8]/15 px-4 py-2 text-sm font-medium text-[#7fa8b8] hover:bg-[#7fa8b8]/25"
            >
              <Printer className="h-4 w-4" />
              Natisni / izvozi PDF (Bulletin de paie)
            </button>
            {msg && (
              <span className={`text-sm ${msg.includes('Napaka') || msg.includes('Vnesite') ? 'text-amber-300' : 'text-[#8fae92]'}`}>
                {msg}
              </span>
            )}
          </div>
        </div>

        {/* ===== PREDOGLED ===== */}
        <div className="lg:sticky lg:top-4 self-start space-y-4">
          <div className="rounded-2xl border border-[#7fa8b8]/20 bg-[#7fa8b8]/[0.04] p-4">
            <p className="mb-3 text-[11px] uppercase tracking-wide text-[#7fa8b8]">Predogled obračuna</p>
            <div className="space-y-1.5 text-sm">
              <Row label="Osnovna plača" value={formatMgAr(slip.baseSalary)} />
              <Row label="Osnovna urna postavka" value={formatMgAr(Math.round(slip.hourlyRate))} muted />
              {slip.sundayHours > 0 && (
                <div>
                  <Row label="+ Nedeljski dodatek" value={formatMgAr(slip.sundayAmount)} />
                  <p className="pl-3 text-[11px] text-white/40">
                    {slip.sundayHours} h × {formatMgAr(Math.round(slip.hourlyRate))} × {Math.round(slip.sundayRate * 100)}%
                  </p>
                </div>
              )}
              {slip.holidayHours > 0 && (
                <div>
                  <Row label="+ Praznični dodatek" value={formatMgAr(slip.holidayAmount)} />
                  <p className="pl-3 text-[11px] text-white/40">
                    {slip.holidayHours} h × {formatMgAr(Math.round(slip.hourlyRate))} × {Math.round(slip.holidayRate * 100)}%
                  </p>
                </div>
              )}
              {slip.overtimeHours > 0 && (
                <div>
                  <Row label="+ Nadure" value={formatMgAr(slip.overtimeAmount)} />
                  <p className="pl-3 text-[11px] text-white/40">
                    {slip.overtimeHours} h × {formatMgAr(Math.round(slip.hourlyRate))} × {Math.round(slip.overtimeRate * 100)}%
                  </p>
                </div>
              )}
              {slip.seniorityAmount > 0 && (
                <div>
                  <Row label="+ Dodatek za delovno dobo" value={formatMgAr(slip.seniorityAmount)} />
                  <p className="pl-3 text-[11px] text-white/40">
                    {slip.seniorityYears} let × {Math.round(slip.seniorityRate * 100)}% od osnovne plače
                  </p>
                </div>
              )}
              {slip.otherBonuses > 0 && <Row label="+ Bonus / dodatek" value={formatMgAr(slip.otherBonuses)} />}
              <Row label="+ Povečanje za prispevke in IRSA" value={formatMgAr(slip.grossUp)} accent />
              <div className="my-1 border-t border-white/10" />
              <Row label="= Bruto obračunska plača" value={formatMgAr(slip.grossPay)} bold />
              <div className="my-1 border-t border-white/10" />
              {slip.contributions
                .filter((c) => c.employeeAmount > 0)
                .map((c) => (
                  <Row key={c.id} label={`− ${c.name} zaposlenega`} value={formatMgAr(c.employeeAmount)} minus />
                ))}
              <Row label="− IRSA" value={formatMgAr(slip.irsa)} minus />
              {slip.advances > 0 && <Row label="− Predujmi" value={formatMgAr(slip.advances)} minus />}
              {slip.otherDeductions > 0 && <Row label="− Drugi odbitki" value={formatMgAr(slip.otherDeductions)} minus />}
              <div className="my-1 border-t border-white/10" />
              <div className="flex items-center justify-between rounded-lg bg-[#8fae92]/15 px-3 py-2">
                <span className="font-semibold text-[#8fae92]">Končno izplačilo</span>
                <span className="font-bold text-[#8fae92] tabular-nums">{formatMgAr(slip.netToPay)}</span>
              </div>
              {slip.totalAdditions === 0 && slip.advances === 0 && slip.otherDeductions === 0 && (
                <p className="flex items-center gap-1 pt-1 text-[11px] text-white/40">
                  <Check className="h-3 w-3 text-[#8fae92]" />
                  Brez dodatkov: končno izplačilo = osnovna plača.
                </p>
              )}
              {slip.leaveDays > 0 && (
                <div className="mt-2 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
                  <p className="mb-1 text-[11px] uppercase tracking-wide text-white/40">
                    Razčlemba osnovne plače
                  </p>
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-white/70">Redno delo (dejansko)</span>
                    <span className="tabular-nums text-white/90">{formatMgAr(Math.max(0, slip.baseSalary - slip.leaveAmount))}</span>
                  </div>
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-white/70">
                      Plačan dopust ({slip.leaveDays} {slip.leaveDays === 1 ? 'dan' : 'dni'})
                    </span>
                    <span className="tabular-nums text-white/90">{formatMgAr(slip.leaveAmount)}</span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-white/40">
                    Vrednost dneva {formatMgAr(Math.round(slip.dailyRate))} · skupaj = osnovna plača {formatMgAr(slip.baseSalary)}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Prispevki delodajalca */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <p className="mb-3 text-[11px] uppercase tracking-wide text-white/40">Prispevki delodajalca (ne odbije se od izplačila)</p>
            <div className="space-y-1.5 text-sm">
              {slip.contributions
                .filter((c) => c.employerAmount > 0)
                .map((c) => (
                  <Row
                    key={c.id}
                    label={`${c.name} (${(c.employerRate * 100).toFixed(2)} %)`}
                    value={formatMgAr(c.employerAmount)}
                  />
                ))}
              <div className="my-1 border-t border-white/10" />
              <Row label="Skupaj prispevki delodajalca" value={formatMgAr(slip.employerContributions)} bold />
              <Row label="Skupni strošek delodajalca" value={formatMgAr(slip.totalEmployerCost)} muted />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Barvni logo naredimo v data URI (medpomnjeno), da se zanesljivo natisne.
let _logoDataUrlCache: string | null = null
async function loadLogoDataUrl(): Promise<string | undefined> {
  if (_logoDataUrlCache) return _logoDataUrlCache
  try {
    const res = await fetch('/komba-logo-print.png')
    if (!res.ok) return undefined
    const blob = await res.blob()
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
    _logoDataUrlCache = dataUrl
    return dataUrl
  } catch {
    return undefined
  }
}

function fmtDays(v?: number): string {
  return Number(v ?? 0).toLocaleString('fr-FR', { maximumFractionDigits: 1 })
}

function formatDateSlo(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso + (iso.length <= 10 ? 'T00:00:00Z' : ''))
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('sl-SI', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}

function Row({
  label,
  value,
  bold,
  muted,
  minus,
  accent,
}: {
  label: string
  value: string
  bold?: boolean
  muted?: boolean
  minus?: boolean
  accent?: boolean
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={`${muted ? 'text-white/40' : accent ? 'text-[#c59b5b]' : minus ? 'text-white/70' : 'text-white/80'} ${bold ? 'font-semibold text-white' : ''}`}>
        {label}
      </span>
      <span
        className={`tabular-nums ${bold ? 'font-bold text-white' : muted ? 'text-white/40' : minus ? 'text-red-300/80' : accent ? 'text-[#c59b5b]' : 'text-white/90'}`}
      >
        {value}
      </span>
    </div>
  )
}
