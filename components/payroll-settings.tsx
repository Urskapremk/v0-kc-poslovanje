'use client'

import React, { useEffect, useState } from 'react'
import useSWR from 'swr'
import { Check, Settings2, RotateCcw, Plus, Trash2 } from 'lucide-react'
import { getPayrollSettings, updatePayrollSettings } from '@/app/actions/payroll'
import { DEFAULT_PAYROLL_SETTINGS, formatAr, type PayrollSettings, type IrsaBracket } from '@/lib/payroll'

type NumKey = Exclude<keyof PayrollSettings, 'irsaBrackets'>

type FieldDef = {
  key: NumKey
  label: string
  kind: 'percent' | 'number'
  hint?: string
}

const BASE_FIELDS: FieldDef[] = [
  { key: 'monthlyHours', label: 'Mesečne ure', kind: 'number', hint: 'Privzeto 173,33' },
  { key: 'sme', label: 'SME 2026 (Ar)', kind: 'number', hint: 'Privzeto 262 680' },
  { key: 'ceilingMultiplier', label: 'Množitelj stropa prispevkov', kind: 'number', hint: 'Privzeto 8 (= SME × 8)' },
]

const RATE_FIELDS: FieldDef[] = [
  { key: 'overtimeFirst8', label: 'Nadure 1–8', kind: 'number', hint: 'Privzeto 1,30' },
  { key: 'overtimeAfter8', label: 'Nadure nad 8', kind: 'number', hint: 'Privzeto 1,50' },
  { key: 'nightRegular', label: 'Redno nočno', kind: 'number', hint: 'Privzeto 1,30' },
  { key: 'nightOccasional', label: 'Občasno nočno', kind: 'number', hint: 'Privzeto 1,50' },
  { key: 'sundayWork', label: 'Nedeljsko delo', kind: 'number', hint: 'Privzeto 1,40' },
  { key: 'publicHoliday', label: 'Praznično delo', kind: 'number', hint: 'Privzeto 1,50' },
]

const EMPLOYEE_FIELDS: FieldDef[] = [
  { key: 'employeeCNAPS', label: 'CNAPS zaposleni', kind: 'percent' },
  { key: 'employeeOSTIE', label: 'OSTIE zaposleni', kind: 'percent' },
]

const EMPLOYER_FIELDS: FieldDef[] = [
  { key: 'employerCNAPS', label: 'CNAPS delodajalec', kind: 'percent' },
  { key: 'employerOSTIE', label: 'OSTIE delodajalec', kind: 'percent' },
  { key: 'employerFMFP', label: 'FMFP', kind: 'percent' },
]

const IRSA_FIELDS: FieldDef[] = [
  { key: 'dependentAllowance', label: 'Olajšava / vzdrževano osebo (Ar)', kind: 'number' },
  { key: 'maxDependents', label: 'Maks. vzdrževanih oseb', kind: 'number' },
  { key: 'minimumIRSA', label: 'Minimalni IRSA (Ar)', kind: 'number' },
]

const LEAVE_FIELDS: FieldDef[] = [
  { key: 'monthlyLeaveAccrual', label: 'Priraščanje na mesec (dni)', kind: 'number', hint: 'Privzeto 2,5' },
  { key: 'annualLeaveEntitlement', label: 'Letna kvota (dni)', kind: 'number', hint: 'Privzeto 30' },
  { key: 'maxCarryForwardDays', label: 'Maks. prenos dni', kind: 'number', hint: '0 = brez omejitve' },
]

const LEAVE_ALLOWANCE_FIELD: FieldDef[] = [
  { key: 'leaveAllowanceDivisor', label: 'Delitelj nadomestila dopusta', kind: 'number', hint: 'Privzeto 30 (referenca / 30)' },
]

const LEAVE_DEDUCTION_FIELD: FieldDef[] = [
  { key: 'leaveDeductionDivisor', label: 'Delitelj odbitka dopusta', kind: 'number', hint: 'Privzeto 30 (osnova / 30)' },
]

const LEAVE_METHODS: { value: PayrollSettings['leaveCalculationMethod']; label: string; desc: string }[] = [
  { value: 'SALARY_MAINTENANCE', label: 'Ohranitev plače', desc: 'Delavec ohrani normalno plačo, dopust zmanjša le saldo dni.' },
  { value: 'ALLOWANCE_ONLY', label: 'Nadomestilo dopusta', desc: 'Nadomestilo se prišteje plači za dneve dopusta (brez odbitka).' },
  { value: 'CUSTOM', label: 'Po meri (z odbitkom)', desc: 'Nadomestilo + odbitek; administrator določi oba delitelja.' },
]

export default function PayrollSettingsPanel() {
  const { data, mutate } = useSWR('payroll-settings', () => getPayrollSettings(), {
    refreshInterval: 0,
    fallbackData: DEFAULT_PAYROLL_SETTINGS,
  })
  const [draft, setDraft] = useState<PayrollSettings>(DEFAULT_PAYROLL_SETTINGS)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (data) setDraft(data)
  }, [data])

  const setField = (key: NumKey, kind: 'percent' | 'number', raw: string) => {
    const num = Number(raw)
    const value = kind === 'percent' ? (isNaN(num) ? 0 : num / 100) : isNaN(num) ? 0 : num
    setDraft((p) => ({ ...p, [key]: value }))
    setSaved(false)
  }

  const setBracket = (idx: number, field: keyof IrsaBracket, raw: string) => {
    setDraft((p) => {
      const brackets = [...p.irsaBrackets]
      const b = { ...brackets[idx] }
      if (field === 'rate') {
        const num = Number(raw)
        b.rate = isNaN(num) ? 0 : num / 100
      } else if (field === 'to') {
        b.to = raw.trim() === '' ? null : Number(raw)
      } else {
        b.from = Number(raw) || 0
      }
      brackets[idx] = b
      return { ...p, irsaBrackets: brackets }
    })
    setSaved(false)
  }

  const addBracket = () => {
    setDraft((p) => {
      const last = p.irsaBrackets[p.irsaBrackets.length - 1]
      const from = last ? (last.to ?? last.from + 1) + 1 : 0
      return { ...p, irsaBrackets: [...p.irsaBrackets, { from, to: null, rate: 0 }] }
    })
    setSaved(false)
  }

  const removeBracket = (idx: number) => {
    setDraft((p) => ({ ...p, irsaBrackets: p.irsaBrackets.filter((_, i) => i !== idx) }))
    setSaved(false)
  }

  const handleSave = async () => {
    setSaving(true)
    await updatePayrollSettings(draft)
    await mutate()
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const handleReset = () => {
    setDraft({ ...DEFAULT_PAYROLL_SETTINGS, irsaBrackets: DEFAULT_PAYROLL_SETTINGS.irsaBrackets.map((b) => ({ ...b })) })
    setSaved(false)
  }

  const renderField = (f: FieldDef) => {
    const v = draft[f.key] as number
    const display = f.kind === 'percent' ? Number((v * 100).toFixed(4)) : v
    return (
      <div key={String(f.key)} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-white/5">
        <div>
          <label className="text-white/70 text-sm">{f.label}</label>
          {f.hint && <p className="text-white/30 text-[11px]">{f.hint}</p>}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            step={f.kind === 'percent' ? '0.01' : 'any'}
            value={display}
            onChange={(e) => setField(f.key, f.kind, e.target.value)}
            className="w-28 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-right text-sm"
          />
          <span className="text-white/50 w-5 text-sm">{f.kind === 'percent' ? '%' : ''}</span>
        </div>
      </div>
    )
  }

  const ceiling = draft.sme * draft.ceilingMultiplier

  return (
    <div className="mt-6 p-6 rounded-2xl bg-white/[0.03] border border-white/10">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#7fa8b8]/15">
            <Settings2 className="h-4 w-4 text-[#7fa8b8]" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#c59b5b]">Nastavitve plač (Madagaskar 2026)</h2>
            <p className="text-white/40 text-xs">
              Vse formule, koeficienti in IRSA lestvica so urejljivi. Spremembe veljajo za vse obračune.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/70 transition hover:bg-white/[0.08]"
          >
            <RotateCcw className="h-4 w-4" /> Privzeto
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-xl border border-[#8fae92]/30 bg-[#8fae92]/10 px-4 py-2 text-sm font-medium text-[#8fae92] transition hover:bg-[#8fae92]/20 disabled:opacity-50"
          >
            {saved ? <Check className="h-4 w-4" /> : null}
            {saving ? 'Shranjujem…' : saved ? 'Shranjeno' : 'Shrani nastavitve'}
          </button>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-medium text-white/60 uppercase tracking-wider mb-4">Splošno</h3>
          <div className="space-y-3">{BASE_FIELDS.map(renderField)}</div>
          <p className="mt-2 text-[11px] text-white/30">Strop prispevkov: {formatAr(ceiling)} (SME × {draft.ceilingMultiplier})</p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-white/60 uppercase tracking-wider mb-4">Koeficienti dela</h3>
          <div className="grid grid-cols-2 gap-3">{RATE_FIELDS.map(renderField)}</div>
        </div>
        <div>
          <h3 className="text-sm font-medium text-white/60 uppercase tracking-wider mb-4">Odbitki zaposlenega</h3>
          <div className="space-y-3">{EMPLOYEE_FIELDS.map(renderField)}</div>
        </div>
        <div>
          <h3 className="text-sm font-medium text-white/60 uppercase tracking-wider mb-4">Prispevki delodajalca</h3>
          <div className="space-y-3">{EMPLOYER_FIELDS.map(renderField)}</div>
        </div>
      </div>

      {/* Dopust */}
      <div className="mt-8">
        <h3 className="text-sm font-medium text-white/60 uppercase tracking-wider mb-4">Dopust (letni plačan – Code du Travail, čl. 131)</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{LEAVE_FIELDS.map(renderField)}</div>

        {/* Metoda izracuna dopusta */}
        <div className="mt-4">
          <label className="text-white/70 text-sm">Metoda izračuna dopusta</label>
          <p className="text-white/30 text-[11px] mb-2">Zakon ne predpisuje formule dnevnega dopusta – izberite metodo.</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {LEAVE_METHODS.map((m) => {
              const active = draft.leaveCalculationMethod === m.value
              return (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => { setDraft((p) => ({ ...p, leaveCalculationMethod: m.value })); setSaved(false) }}
                  className={`text-left rounded-lg border p-3 transition ${active ? 'border-[#8fae92] bg-[#8fae92]/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
                  aria-pressed={active}
                >
                  <p className={`text-sm font-medium ${active ? 'text-[#8fae92]' : 'text-white/80'}`}>{m.label}</p>
                  <p className="text-[11px] text-white/40 mt-1">{m.desc}</p>
                </button>
              )
            })}
          </div>
        </div>

        {/* Delitelj nadomestila (nadomestilo + po meri) */}
        {draft.leaveCalculationMethod !== 'SALARY_MAINTENANCE' && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {LEAVE_ALLOWANCE_FIELD.map(renderField)}
            {/* Delitelj odbitka samo pri metodi Po meri */}
            {draft.leaveCalculationMethod === 'CUSTOM' && LEAVE_DEDUCTION_FIELD.map(renderField)}
          </div>
        )}

        <p className="mt-3 text-[11px] text-white/30">
          Referenčni znesek dopusta (1/12 plačila prejšnjih 12 mesecev) se samodejno izračuna in shrani ob vsakem obračunu.
        </p>

        <div className="mt-3 flex items-center justify-between gap-3 p-3 rounded-lg bg-white/5">
          <div>
            <label className="text-white/70 text-sm">Dovoli prenos dopusta</label>
            <p className="text-white/30 text-[11px]">Če je izklopljeno, se začetno stanje (prenos) ignorira.</p>
          </div>
          <button
            type="button"
            onClick={() => { setDraft((p) => ({ ...p, allowCarryForward: !p.allowCarryForward })); setSaved(false) }}
            className={`relative h-6 w-11 rounded-full transition ${draft.allowCarryForward ? 'bg-[#8fae92]' : 'bg-white/15'}`}
            aria-pressed={draft.allowCarryForward}
            aria-label="Dovoli prenos dopusta"
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${draft.allowCarryForward ? 'left-[22px]' : 'left-0.5'}`} />
          </button>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 p-3 rounded-lg bg-white/5">
          <div>
            <label className="text-white/70 text-sm">Nadomestilo dopusta je obdavčljivo</label>
            <p className="text-white/30 text-[11px]">
              Privzeto IZKLOPLJENO: indemnité de congé NI v osnovi za CNAPS/OSTIE/FMFP/IRSA, prišteje se po neto plači (potrdila računovodkinja Claudia).
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setDraft((p) => ({ ...p, congeTaxable: !p.congeTaxable })); setSaved(false) }}
            className={`relative h-6 w-11 rounded-full transition ${draft.congeTaxable ? 'bg-[#8fae92]' : 'bg-white/15'}`}
            aria-pressed={draft.congeTaxable}
            aria-label="Nadomestilo dopusta je obdavčljivo"
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${draft.congeTaxable ? 'left-[22px]' : 'left-0.5'}`} />
          </button>
        </div>
      </div>

      {/* IRSA lestvica */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-white/60 uppercase tracking-wider">IRSA lestvica (dohodnina)</h3>
          <button
            onClick={addBracket}
            className="flex items-center gap-2 rounded-lg border border-[#7fa8b8]/30 bg-[#7fa8b8]/10 px-3 py-1.5 text-xs font-medium text-[#7fa8b8] transition hover:bg-[#7fa8b8]/20"
          >
            <Plus className="h-3.5 w-3.5" /> Dodaj razred
          </button>
        </div>
        <div className="overflow-hidden rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-white/[0.04] text-left text-[11px] uppercase tracking-wider text-white/40">
                <th className="px-4 py-2 font-medium">Od (Ar)</th>
                <th className="px-4 py-2 font-medium">Do (Ar)</th>
                <th className="px-4 py-2 font-medium">Stopnja %</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {draft.irsaBrackets.map((b, idx) => (
                <tr key={idx} className="border-t border-white/[0.06]">
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      value={b.from}
                      onChange={(e) => setBracket(idx, 'from', e.target.value)}
                      className="w-28 px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-right"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      value={b.to ?? ''}
                      placeholder="∞ (brez meje)"
                      onChange={(e) => setBracket(idx, 'to', e.target.value)}
                      className="w-32 px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-right"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      step="0.1"
                      value={Number((b.rate * 100).toFixed(4))}
                      onChange={(e) => setBracket(idx, 'rate', e.target.value)}
                      className="w-20 px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-right"
                    />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => removeBracket(idx)}
                      className="rounded-lg p-1.5 text-white/40 transition hover:bg-[#c98f7d]/10 hover:text-[#c98f7d]"
                      aria-label="Odstrani razred"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">{IRSA_FIELDS.map(renderField)}</div>
      </div>
    </div>
  )
}
