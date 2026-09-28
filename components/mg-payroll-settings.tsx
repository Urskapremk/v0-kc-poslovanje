'use client'

import React, { useState, useEffect } from 'react'
import useSWR from 'swr'
import { Plus, Trash2, Save, Check } from 'lucide-react'
import { getMgPayrollConfig, updateMgPayrollConfig } from '@/app/actions/payroll-mg'
import {
  DEFAULT_MG_CONFIG,
  type MgPayrollConfig,
  type WageCategory,
  type MgContributionType,
} from '@/lib/payroll-mg'

function nv(s: string | number): number {
  const n = Number(String(s).replace(',', '.'))
  return isNaN(n) ? 0 : n
}

export default function MgPayrollSettings() {
  const { data, mutate } = useSWR('mg-config', getMgPayrollConfig)
  const [cfg, setCfg] = useState<MgPayrollConfig | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (data && !cfg) setCfg(JSON.parse(JSON.stringify(data)))
  }, [data, cfg])

  if (!cfg) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-sm text-white/40">
        Nalagam nastavitve…
      </div>
    )
  }

  function upd(patch: Partial<MgPayrollConfig>) {
    setCfg((prev) => (prev ? { ...prev, ...patch } : prev))
    setSaved(false)
  }

  function updCategory(i: number, patch: Partial<WageCategory>) {
    setCfg((prev) => {
      if (!prev) return prev
      const categories = prev.categories.map((c, idx) => (idx === i ? { ...c, ...patch } : c))
      return { ...prev, categories }
    })
    setSaved(false)
  }

  function updContribution(i: number, patch: Partial<MgContributionType>) {
    setCfg((prev) => {
      if (!prev) return prev
      const contributionTypes = prev.contributionTypes.map((c, idx) => (idx === i ? { ...c, ...patch } : c))
      return { ...prev, contributionTypes }
    })
    setSaved(false)
  }

  async function handleSave() {
    if (!cfg) return
    setSaving(true)
    try {
      await updateMgPayrollConfig(cfg)
      await mutate()
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  const inputCls =
    'w-full rounded-lg bg-white/5 border border-white/10 px-2.5 py-1.5 text-sm text-white focus:border-[#7fa8b8]/50 focus:outline-none'
  const labelCls = 'block text-[11px] uppercase tracking-wide text-white/40 mb-1'

  return (
    <div className="space-y-5 rounded-2xl border border-[#c59b5b]/20 bg-[#c59b5b]/[0.03] p-4">
      <p className="text-[11px] uppercase tracking-wide text-[#c59b5b]">Nastavitve obračuna (Madagaskar)</p>

      {/* Splosno */}
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <div>
          <label className={labelCls}>Mesečni fond ur</label>
          <input type="number" step="0.01" className={inputCls} value={cfg.monthlyHours} onChange={(e) => upd({ monthlyHours: nv(e.target.value) })} />
        </div>
        <div>
          <label className={labelCls}>Nedelja (%)</label>
          <input type="number" className={inputCls} value={cfg.sundayRate * 100} onChange={(e) => upd({ sundayRate: nv(e.target.value) / 100 })} />
        </div>
        <div>
          <label className={labelCls}>Praznik (%)</label>
          <input type="number" className={inputCls} value={cfg.holidayRate * 100} onChange={(e) => upd({ holidayRate: nv(e.target.value) / 100 })} />
        </div>
        <div>
          <label className={labelCls}>Nadure (%)</label>
          <input type="number" className={inputCls} value={cfg.overtimeRate * 100} onChange={(e) => upd({ overtimeRate: nv(e.target.value) / 100 })} />
        </div>
        <div>
          <label className={labelCls}>Privzeta IRSA (Ar)</label>
          <input type="number" className={inputCls} value={cfg.defaultIrsa} onChange={(e) => upd({ defaultIrsa: nv(e.target.value) })} />
        </div>
      </div>

      <div>
        <label className={labelCls}>Privzeti naziv postavke povečanja (francoski izpis)</label>
        <input className={inputCls} value={cfg.defaultGrossUpLabelFr} onChange={(e) => upd({ defaultGrossUpLabelFr: e.target.value })} />
      </div>

      {/* Prispevki */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[11px] uppercase tracking-wide text-white/50">Vrste prispevkov (odstotek zaposlenega / delodajalca + veljavnost)</p>
          <button
            onClick={() =>
              upd({
                contributionTypes: [
                  ...cfg.contributionTypes,
                  { id: `c-${Date.now()}`, name: 'Nov prispevek', employeeRate: 0, employerRate: 0, startDate: null, endDate: null },
                ],
              })
            }
            className="flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1 text-xs text-white/70 hover:bg-white/10"
          >
            <Plus className="h-3.5 w-3.5" /> Dodaj
          </button>
        </div>
        <div className="space-y-2">
          {cfg.contributionTypes.map((c, i) => (
            <div key={c.id} className="grid grid-cols-2 gap-2 rounded-lg border border-white/10 p-2 sm:grid-cols-6">
              <div className="col-span-2 sm:col-span-1">
                <label className={labelCls}>Naziv</label>
                <input className={inputCls} value={c.name} onChange={(e) => updContribution(i, { name: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Zaposleni %</label>
                <input type="number" step="0.01" className={inputCls} value={c.employeeRate * 100} onChange={(e) => updContribution(i, { employeeRate: nv(e.target.value) / 100 })} />
              </div>
              <div>
                <label className={labelCls}>Delodajalec %</label>
                <input type="number" step="0.01" className={inputCls} value={c.employerRate * 100} onChange={(e) => updContribution(i, { employerRate: nv(e.target.value) / 100 })} />
              </div>
              <div>
                <label className={labelCls}>Velja od</label>
                <input type="date" className={`${inputCls} [color-scheme:dark]`} value={c.startDate ?? ''} onChange={(e) => updContribution(i, { startDate: e.target.value || null })} />
              </div>
              <div className="flex items-end gap-1">
                <div className="flex-1">
                  <label className={labelCls}>Velja do</label>
                  <input type="date" className={`${inputCls} [color-scheme:dark]`} value={c.endDate ?? ''} onChange={(e) => updContribution(i, { endDate: e.target.value || null })} />
                </div>
                <button
                  onClick={() => upd({ contributionTypes: cfg.contributionTypes.filter((_, idx) => idx !== i) })}
                  className="mb-0.5 rounded-lg bg-red-500/10 p-2 text-red-300 hover:bg-red-500/20"
                  aria-label="Izbriši prispevek"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Kategorije */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[11px] uppercase tracking-wide text-white/50">Kategorije in minimalne plače (od 1. 3. 2026)</p>
          <button
            onClick={() => upd({ categories: [...cfg.categories, { code: 'NOVA', minWage: 300000 }] })}
            className="flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1 text-xs text-white/70 hover:bg-white/10"
          >
            <Plus className="h-3.5 w-3.5" /> Dodaj
          </button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {cfg.categories.map((c, i) => (
            <div key={i} className="flex items-end gap-2 rounded-lg border border-white/10 p-2">
              <div className="flex-1">
                <label className={labelCls}>Koda</label>
                <input className={inputCls} value={c.code} onChange={(e) => updCategory(i, { code: e.target.value })} />
              </div>
              <div className="flex-1">
                <label className={labelCls}>Min. plača (Ar)</label>
                <input type="number" className={inputCls} value={c.minWage} onChange={(e) => updCategory(i, { minWage: nv(e.target.value) })} />
              </div>
              <button
                onClick={() => upd({ categories: cfg.categories.filter((_, idx) => idx !== i) })}
                className="mb-0.5 rounded-lg bg-red-500/10 p-2 text-red-300 hover:bg-red-500/20"
                aria-label="Izbriši kategorijo"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-[#c59b5b] px-4 py-2 text-sm font-medium text-[#25190b] hover:bg-[#d6aa74] disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Shranjujem…' : 'Shrani nastavitve'}
        </button>
        {saved && (
          <span className="flex items-center gap-1 text-sm text-[#8fae92]">
            <Check className="h-4 w-4" /> Shranjeno
          </span>
        )}
        <button
          onClick={() => { setCfg(JSON.parse(JSON.stringify(DEFAULT_MG_CONFIG))); setSaved(false) }}
          className="text-xs text-white/40 hover:text-white/70"
        >
          Ponastavi na privzeto
        </button>
      </div>
    </div>
  )
}
