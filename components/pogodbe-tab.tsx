'use client'

import React, { useMemo, useState } from 'react'
import useSWR from 'swr'
import {
  FileText, Plus, Search, Printer, Archive, Check, Trash2, X,
  Building2, Pencil, Settings2, RefreshCw,
} from 'lucide-react'
import { getAllStaffMembers } from '@/app/actions/statistics'
import {
  getContracts, getArchivedContracts, createContract, updateContract, refreshContractSnapshot,
  setContractStatus, deleteContract, getCompanySettings, updateCompanySettings,
} from '@/app/actions/contracts'
import {
  CONTRACT_TYPES, CONTRACT_LANGUAGES, CONTRACT_STATUSES, JOB_TITLES, DEFAULT_CATEGORY, DEFAULT_INDEX,
  DEFAULT_WORK_HOURS, DEFAULT_WORK_LOCATION,
  formatDateFr, formatDateSl, genderLabelFr, fullNameFromSnapshot, buildContractArticles,
  type Contract, type ContractType, type ContractLanguage, type ContractSnapshot,
  type CompanySettings,
} from '@/lib/contracts'

const inputClass =
  'w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 text-sm text-white focus:border-[#7fa8b8]/40 focus:outline-none'
const labelClass = 'mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-white/40'

export default function PogodbeTab() {
  const [view, setView] = useState<'active' | 'archive'>('active')
  const [search, setSearch] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [editContract, setEditContract] = useState<Contract | null>(null)
  const [printContract, setPrintContract] = useState<Contract | null>(null)

  const { data: allStaff } = useSWR('all-staff', () => getAllStaffMembers(), { refreshInterval: 0 })
  const { data: contracts, mutate: mutateContracts } = useSWR('contracts', () => getContracts(), { refreshInterval: 0 })
  const { data: archived, mutate: mutateArchived } = useSWR('contracts-archive', () => getArchivedContracts(), { refreshInterval: 0 })
  const { data: companies, mutate: mutateCompanies } = useSWR('company-settings', () => getCompanySettings(), { refreshInterval: 0 })

  const list = view === 'active' ? contracts : archived
  const companyById = useMemo(() => {
    const map: Record<string, CompanySettings> = {}
    for (const c of companies ?? []) map[c.id] = c
    return map
  }, [companies])

  const filtered = useMemo(() => {
    if (!list) return []
    const q = search.trim().toLowerCase()
    if (!q) return list
    return list.filter(
      (c) =>
        c.staffName.toLowerCase().includes(q) ||
        c.contractNumber.toLowerCase().includes(q) ||
        (c.jobTitle || '').toLowerCase().includes(q),
    )
  }, [list, search])

  const handlePrint = (c: Contract) => {
    setPrintContract(c)
    setTimeout(() => {
      document.body.classList.add('printing-contract')
      window.print()
      document.body.classList.remove('printing-contract')
    }, 60)
  }

  const refresh = () => {
    mutateContracts()
    mutateArchived()
  }

  return (
    <div className="space-y-6">
      {/* Glava */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-bold text-[#c59b5b] sm:text-lg">
          <FileText className="h-5 w-5" />
          Pogodbe o zaposlitvi
        </h2>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-white/70 transition hover:bg-white/10"
          >
            <Settings2 className="h-4 w-4" />
            Podatki podjetij
          </button>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 rounded-xl border border-[#8fae92]/30 bg-[#8fae92]/10 px-4 py-2 text-sm font-medium text-[#8fae92] transition hover:bg-[#8fae92]/20"
          >
            <Plus className="h-4 w-4" />
            Nova pogodba
          </button>
        </div>
      </div>

      {/* Podstikalo aktivne/arhiv + iskanje */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <button
            onClick={() => setView('active')}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
              view === 'active' ? 'bg-[#8fae92]/20 text-[#8fae92] border border-[#8fae92]/30' : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            Aktivne pogodbe
          </button>
          <button
            onClick={() => setView('archive')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
              view === 'archive' ? 'bg-[#7fa8b8]/20 text-[#7fa8b8] border border-[#7fa8b8]/30' : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            <Archive className="h-4 w-4" />
            Arhiv
          </button>
        </div>
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Iskanje po imenu, številki, delovnem mestu..."
            className={`${inputClass} pl-9`}
          />
        </div>
      </div>

      {/* Seznam pogodb */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center text-sm text-white/40">
            {view === 'active' ? 'Ni aktivnih pogodb.' : 'Arhiv je prazen.'}
          </div>
        )}
        {filtered.map((c) => {
          const st = CONTRACT_STATUSES[c.status]
          return (
            <div key={c.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-white">{c.staffName}</span>
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                      style={{ backgroundColor: `${st.color}22`, color: st.color }}
                    >
                      {st.label}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-white/50">
                    {c.contractNumber} · {CONTRACT_TYPES[c.contractType].fr}
                    {c.jobTitle ? ` · ${c.jobTitle}` : ''}
                  </div>
                  <div className="mt-0.5 text-xs text-white/40">
                    {companyById[c.company]?.name ?? c.company}
                    {c.startDate ? ` · od ${formatDateSl(c.startDate)}` : ''}
                    {c.endDate ? ` do ${formatDateSl(c.endDate)}` : ''}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setEditContract(c)}
                    className="flex items-center gap-1.5 rounded-lg border border-[#c59b5b]/30 bg-[#c59b5b]/10 px-3 py-2 text-xs font-medium text-[#c59b5b] transition hover:bg-[#c59b5b]/20"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Uredi
                  </button>
                  <button
                    onClick={() => handlePrint(c)}
                    className="flex items-center gap-1.5 rounded-lg border border-[#7fa8b8]/30 bg-[#7fa8b8]/10 px-3 py-2 text-xs font-medium text-[#7fa8b8] transition hover:bg-[#7fa8b8]/20"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    Natisni
                  </button>
                  {c.status === 'draft' && (
                    <button
                      onClick={async () => { await setContractStatus(c.id, 'active'); refresh() }}
                      className="flex items-center gap-1.5 rounded-lg border border-[#8fae92]/30 bg-[#8fae92]/10 px-3 py-2 text-xs font-medium text-[#8fae92] transition hover:bg-[#8fae92]/20"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Aktiviraj
                    </button>
                  )}
                  {view === 'active' && c.status !== 'draft' && (
                    <button
                      onClick={async () => { await setContractStatus(c.id, 'archived'); refresh() }}
                      className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white/60 transition hover:bg-white/10"
                    >
                      <Archive className="h-3.5 w-3.5" />
                      Arhiviraj
                    </button>
                  )}
                  <button
                    onClick={async () => {
                      if (confirm(`Izbrišem pogodbo ${c.contractNumber}? Tega ni mogoče razveljaviti.`)) {
                        await deleteContract(c.id); refresh()
                      }
                    }}
                    className="flex items-center gap-1.5 rounded-lg border border-red-400/20 bg-red-400/5 px-3 py-2 text-xs font-medium text-red-300/70 transition hover:bg-red-400/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal: nova pogodba */}
      {showNew && (
        <NewContractModal
          staff={allStaff ?? []}
          companies={companies ?? []}
          onClose={() => setShowNew(false)}
          onCreated={() => { setShowNew(false); refresh() }}
        />
      )}

      {/* Modal: nastavitve podjetij */}
      {showSettings && (
        <CompanySettingsModal
          companies={companies ?? []}
          onClose={() => setShowSettings(false)}
          onSaved={() => mutateCompanies()}
        />
      )}

      {/* Modal: urejanje pogodbe */}
      {editContract && (
        <EditContractModal
          contract={editContract}
          companies={companies ?? []}
          onClose={() => setEditContract(null)}
          onSaved={() => { setEditContract(null); refresh() }}
        />
      )}

      {/* Print pogodbe */}
      {printContract && (
        <ContractPrint
          contract={printContract}
          company={companyById[printContract.company]}
        />
      )}
    </div>
  )
}

// ---------- Nova pogodba ----------
function NewContractModal({
  staff, companies, onClose, onCreated,
}: {
  staff: Awaited<ReturnType<typeof getAllStaffMembers>>
  companies: CompanySettings[]
  onClose: () => void
  onCreated: () => void
}) {
  const [staffId, setStaffId] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [contractType, setContractType] = useState<ContractType>('CDI')
  const [language, setLanguage] = useState<ContractLanguage>('fr')
  const [jobTitle, setJobTitle] = useState('')
  const [category, setCategory] = useState(DEFAULT_CATEGORY)
  const [index, setIndex] = useState(DEFAULT_INDEX)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [trialMonths, setTrialMonths] = useState(0)
  const [salary, setSalary] = useState(0)
  const [workLocation, setWorkLocation] = useState(DEFAULT_WORK_LOCATION)
  const [workHours, setWorkHours] = useState(DEFAULT_WORK_HOURS)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const selected = staff.find((s) => s.id === staffId)
  const effectiveCompanyId = companyId || selected?.company || companies[0]?.id || ''
  const company = companies.find((c) => c.id === effectiveCompanyId) ?? companies[0]

  // Ko izberes zaposlenega, privzeto nastavi njegovo podjetje (lahko se rocno spremeni)
  const handleSelectStaff = (id: string) => {
    setStaffId(id)
    const s = staff.find((x) => x.id === id)
    if (s) setCompanyId(s.company)
  }

  // Ko izberes delovno mesto, samodejno predlagaj privzeto kategorijo in indeks (ostaneta urejljiva)
  const handleSelectJob = (fr: string) => {
    setJobTitle(fr)
    const job = JOB_TITLES.find((j) => j.fr === fr)
    setCategory(job?.defaultCategory ?? DEFAULT_CATEGORY)
    setIndex(job?.defaultIndex ?? DEFAULT_INDEX)
  }

  const handleCreate = async () => {
    if (!selected) { alert('Izberi zaposlenega.'); return }
    setSaving(true)
    try {
      const snapshot: ContractSnapshot = {
        firstName: selected.firstName,
        lastName: selected.lastName,
        staffName: selected.staffName,
        gender: selected.gender,
        dateOfBirth: selected.dateOfBirth,
        placeOfBirth: selected.placeOfBirth,
        nationality: selected.nationality,
        fatherName: selected.fatherName,
        motherName: selected.motherName,
        documentNumber: selected.documentNumber,
        cnapsNumber: selected.cnapsNumber,
        ominoNumber: selected.ominoNumber,
        address: selected.address,
        phone: selected.phone,
        email: selected.email,
      }
      await createContract({
        staffId: selected.id,
        staffName: selected.staffName,
        company: effectiveCompanyId,
        contractType,
        jobTitle,
        category,
        index,
        startDate: startDate || null,
        endDate: contractType === 'CDI' ? null : endDate || null,
        trialMonths,
        salary,
        workLocation,
        workHours,
        language,
        snapshot,
        notes,
      })
      onCreated()
    } catch (err) {
      console.error('[v0] createContract error:', err)
      alert('Napaka pri ustvarjanju pogodbe.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4">
      <div className="my-8 w-full max-w-2xl rounded-2xl border border-white/10 bg-[#131c20] p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">Nova pogodba</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-white/50 hover:bg-white/10 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelClass}>Zaposleni</label>
            <select className={`${inputClass} [color-scheme:dark]`} value={staffId} onChange={(e) => handleSelectStaff(e.target.value)}>
              <option value="" className="bg-[#143a49]">— Izberi zaposlenega —</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id} className="bg-[#143a49]">{s.staffName}</option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className={labelClass}>Podjetje (delodajalec)</label>
            <select className={`${inputClass} [color-scheme:dark]`} value={effectiveCompanyId} onChange={(e) => setCompanyId(e.target.value)}>
              {companies.map((c) => (
                <option key={c.id} value={c.id} className="bg-[#143a49]">{c.name}</option>
              ))}
            </select>
          </div>

          {selected && (
            <div className="sm:col-span-2 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-xs text-white/50">
              <div className="flex items-center gap-2 text-white/70">
                <Building2 className="h-4 w-4" />
                {company?.name ?? '—'}
              </div>
              <div className="mt-1">
                {fullNameFromSnapshot({ firstName: selected.firstName, lastName: selected.lastName, staffName: selected.staffName }, selected.staffName)}
                {selected.documentNumber ? ` · CIN: ${selected.documentNumber}` : ''}
                {selected.cnapsNumber ? ` · CNAPS: ${selected.cnapsNumber}` : ''}
              </div>
              <div className="mt-1 text-white/30">Osebni podatki se samodejno prenesejo iz Osebnih podatkov. Podjetje lahko spremeniš zgoraj.</div>
            </div>
          )}

          <div>
            <label className={labelClass}>Vrsta pogodbe</label>
            <select className={`${inputClass} [color-scheme:dark]`} value={contractType} onChange={(e) => setContractType(e.target.value as ContractType)}>
              {(Object.keys(CONTRACT_TYPES) as ContractType[]).map((t) => (
                <option key={t} value={t} className="bg-[#143a49]">{CONTRACT_TYPES[t].sl}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Jezik pogodbe</label>
            <select className={`${inputClass} [color-scheme:dark]`} value={language} onChange={(e) => setLanguage(e.target.value as ContractLanguage)}>
              {(Object.keys(CONTRACT_LANGUAGES) as ContractLanguage[]).map((l) => (
                <option key={l} value={l} className="bg-[#143a49]">{CONTRACT_LANGUAGES[l]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Delovno mesto</label>
            <select
              className={`${inputClass} [color-scheme:dark]`}
              value={JOB_TITLES.some((j) => j.fr === jobTitle) ? jobTitle : (jobTitle ? '__custom__' : '')}
              onChange={(e) => e.target.value === '__custom__' ? setJobTitle(' ') : handleSelectJob(e.target.value)}
            >
              <option value="" className="bg-[#143a49]">— Izberi delovno mesto —</option>
              {JOB_TITLES.map((j) => (
                <option key={j.fr} value={j.fr} className="bg-[#143a49]">{j.sl} ({j.fr})</option>
              ))}
              <option value="__custom__" className="bg-[#143a49]">Drugo (vpiši ročno) ...</option>
            </select>
            {jobTitle !== '' && !JOB_TITLES.some((j) => j.fr === jobTitle) && (
              <input
                className={`${inputClass} mt-2`}
                value={jobTitle.trim()}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="Naziv delovnega mesta (FR) — izpiše se na pogodbo"
                autoFocus
              />
            )}
          </div>
          <div>
            <label className={labelClass}>Kategorija</label>
            <input className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)} placeholder="npr. OS1-2A" />
            <p className="mt-1 text-[11px] text-white/30">Samodejno predlagano (OS1-2A). Spremeni, če računovodja določi drugače.</p>
          </div>
          <div>
            <label className={labelClass}>Indeks</label>
            <input className={inputClass} value={index} onChange={(e) => setIndex(e.target.value)} placeholder="npr. 1773" />
            <p className="mt-1 text-[11px] text-white/30">Ročni vnos po podatkih računovodje.</p>
          </div>
          <div>
            <label className={labelClass}>Datum začetka</label>
            <input type="date" className={`${inputClass} [color-scheme:dark]`} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Datum konca {contractType === 'CDI' ? '(ni za CDI)' : ''}</label>
            <input type="date" disabled={contractType === 'CDI'} className={`${inputClass} [color-scheme:dark] disabled:opacity-40`} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Poskusna doba (mesecev)</label>
            <input type="number" min={0} className={inputClass} value={trialMonths} onChange={(e) => setTrialMonths(Number(e.target.value) || 0)} />
          </div>
          <div>
            <label className={labelClass}>Plača (Ar)</label>
            <input type="number" min={0} className={inputClass} value={salary} onChange={(e) => setSalary(Number(e.target.value) || 0)} />
          </div>
          <div>
            <label className={labelClass}>Kraj dela</label>
            <input className={inputClass} value={workLocation} onChange={(e) => setWorkLocation(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Delovni čas</label>
            <input className={inputClass} value={workHours} onChange={(e) => setWorkHours(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Opombe</label>
            <textarea className={`${inputClass} min-h-[60px] resize-y`} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/10">
            Prekliči
          </button>
          <button onClick={handleCreate} disabled={saving || !staffId} className="rounded-xl border border-[#8fae92]/30 bg-[#8fae92]/10 px-5 py-2.5 text-sm font-medium text-[#8fae92] transition hover:bg-[#8fae92]/20 disabled:opacity-40">
            {saving ? 'Shranjevanje...' : 'Ustvari pogodbo'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------- Nastavitve podjetij ----------
function CompanySettingsModal({
  companies, onClose, onSaved,
}: {
  companies: CompanySettings[]
  onClose: () => void
  onSaved: () => void
}) {
  const save = async (id: string, field: keyof Omit<CompanySettings, 'id'>, value: string) => {
    await updateCompanySettings(id, { [field]: value })
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4">
      <div className="my-8 w-full max-w-2xl rounded-2xl border border-white/10 bg-[#131c20] p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">Podatki podjetij</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-white/50 hover:bg-white/10 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-4 text-xs text-white/40">Ti podatki se izpišejo v glavi pogodbe. Spremembe se shranijo samodejno.</p>

        <div className="space-y-6">
          {companies.map((c) => (
            <div key={c.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <h4 className="mb-3 flex items-center gap-2 font-semibold text-[#c59b5b]">
                <Building2 className="h-4 w-4" />
                {c.name}
              </h4>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className={labelClass}>Naslov</label>
                  <input className={inputClass} defaultValue={c.address} onBlur={(e) => save(c.id, 'address', e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>NIF (davčna št.)</label>
                  <input className={inputClass} defaultValue={c.nifNumber} onBlur={(e) => save(c.id, 'nifNumber', e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>STAT številka</label>
                  <input className={inputClass} defaultValue={c.statNumber} onBlur={(e) => save(c.id, 'statNumber', e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>RCS številka</label>
                  <input className={inputClass} defaultValue={c.rcsNumber} onBlur={(e) => save(c.id, 'rcsNumber', e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>Funkcija zastopnika</label>
                  <input className={inputClass} defaultValue={c.repTitle} onBlur={(e) => save(c.id, 'repTitle', e.target.value)} placeholder="Gérant" />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass}>Ime zastopnika</label>
                  <input className={inputClass} defaultValue={c.repName} onBlur={(e) => save(c.id, 'repName', e.target.value)} placeholder="Ime in priimek zastopnika" />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-end">
          <button onClick={onClose} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/10">
            Zapri
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------- Urejanje pogodbe ----------
function EditContractModal({
  contract, companies, onClose, onSaved,
}: {
  contract: Contract
  companies: CompanySettings[]
  onClose: () => void
  onSaved: () => void
}) {
  const [contractType, setContractType] = useState<ContractType>(contract.contractType)
  const [language, setLanguage] = useState<ContractLanguage>(contract.language)
  const [jobTitle, setJobTitle] = useState(contract.jobTitle)
  const [category, setCategory] = useState(contract.category)
  const [index, setIndex] = useState(contract.index)
  const [startDate, setStartDate] = useState(contract.startDate ?? '')
  const [endDate, setEndDate] = useState(contract.endDate ?? '')
  const [trialMonths, setTrialMonths] = useState(contract.trialMonths)
  const [salary, setSalary] = useState(contract.salary)
  const [workLocation, setWorkLocation] = useState(contract.workLocation)
  const [workHours, setWorkHours] = useState(contract.workHours)
  const [notes, setNotes] = useState(contract.notes)
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [snap, setSnap] = useState(contract.snapshot)

  const company = companies.find((c) => c.id === contract.company)
  const fullName = fullNameFromSnapshot(snap, contract.staffName)

  const handleRefreshSnapshot = async () => {
    setRefreshing(true)
    try {
      const updated = await refreshContractSnapshot(contract.id)
      if (updated) setSnap(updated.snapshot)
    } catch (err) {
      console.error('[v0] refreshContractSnapshot error:', err)
      alert('Napaka pri osveževanju osebnih podatkov.')
    } finally {
      setRefreshing(false)
    }
  }

  const handleSelectJob = (fr: string) => {
    setJobTitle(fr)
    const job = JOB_TITLES.find((j) => j.fr === fr)
    if (job) { setCategory(job.defaultCategory); setIndex(job.defaultIndex) }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateContract(contract.id, {
        contractType,
        jobTitle,
        category,
        index,
        startDate: startDate || null,
        endDate: contractType === 'CDI' ? null : endDate || null,
        trialMonths,
        salary,
        workLocation,
        workHours,
        language,
        notes,
      })
      onSaved()
    } catch (err) {
      console.error('[v0] updateContract error:', err)
      alert('Napaka pri shranjevanju pogodbe.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4">
      <div className="my-8 w-full max-w-2xl rounded-2xl border border-white/10 bg-[#131c20] p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white">Uredi pogodbo</h3>
            <p className="mt-0.5 text-xs text-white/40">{contract.contractNumber} · {fullName}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-white/50 hover:bg-white/10 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-xs text-white/50">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-white/70">
              <Building2 className="h-4 w-4" />
              {company?.name ?? contract.company}
            </div>
            <button
              onClick={handleRefreshSnapshot}
              disabled={refreshing}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] font-medium text-white/70 transition hover:bg-white/10 disabled:opacity-40"
              title="Ponovno prenese aktualne osebne podatke iz kadrovske evidence (npr. ime očeta/matere)"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Osveževanje...' : 'Osveži podatke delavke'}
            </button>
          </div>
          <div className="mt-2 grid grid-cols-1 gap-0.5 text-white/50 sm:grid-cols-2">
            <div>Ime in priimek: <span className="text-white/70">{fullName}</span></div>
            {snap?.documentNumber && <div>CIN: <span className="text-white/70">{snap.documentNumber}</span></div>}
            <div>Oče: <span className="text-white/70">{snap?.fatherName || '— (ni vneseno)'}</span></div>
            <div>Mati: <span className="text-white/70">{snap?.motherName || '— (ni vneseno)'}</span></div>
          </div>
          <div className="mt-2 text-white/30">Osebni podatki se zaklenejo ob sklenitvi. Če si jih dodala kasneje (npr. imena staršev), klikni &laquo;Osveži podatke delavke&raquo;, da se prenesejo v pogodbo.</div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Vrsta pogodbe</label>
            <select className={`${inputClass} [color-scheme:dark]`} value={contractType} onChange={(e) => setContractType(e.target.value as ContractType)}>
              {(Object.keys(CONTRACT_TYPES) as ContractType[]).map((t) => (
                <option key={t} value={t} className="bg-[#143a49]">{CONTRACT_TYPES[t].sl}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Jezik pogodbe</label>
            <select className={`${inputClass} [color-scheme:dark]`} value={language} onChange={(e) => setLanguage(e.target.value as ContractLanguage)}>
              {(Object.keys(CONTRACT_LANGUAGES) as ContractLanguage[]).map((l) => (
                <option key={l} value={l} className="bg-[#143a49]">{CONTRACT_LANGUAGES[l]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Delovno mesto</label>
            <select
              className={`${inputClass} [color-scheme:dark]`}
              value={JOB_TITLES.some((j) => j.fr === jobTitle) ? jobTitle : (jobTitle ? '__custom__' : '')}
              onChange={(e) => e.target.value === '__custom__' ? setJobTitle(' ') : handleSelectJob(e.target.value)}
            >
              <option value="" className="bg-[#143a49]">— Izberi delovno mesto —</option>
              {JOB_TITLES.map((j) => (
                <option key={j.fr} value={j.fr} className="bg-[#143a49]">{j.sl} ({j.fr})</option>
              ))}
              <option value="__custom__" className="bg-[#143a49]">Drugo (vpiši ročno) ...</option>
            </select>
            {jobTitle !== '' && !JOB_TITLES.some((j) => j.fr === jobTitle) && (
              <input
                className={`${inputClass} mt-2`}
                value={jobTitle.trim()}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="Naziv delovnega mesta (FR) — izpiše se na pogodbo"
              />
            )}
          </div>
          <div>
            <label className={labelClass}>Kategorija</label>
            <input className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)} placeholder="npr. OS1-2A" />
          </div>
          <div>
            <label className={labelClass}>Indeks</label>
            <input className={inputClass} value={index} onChange={(e) => setIndex(e.target.value)} placeholder="npr. 1773" />
          </div>
          <div>
            <label className={labelClass}>Datum začetka</label>
            <input type="date" className={`${inputClass} [color-scheme:dark]`} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Datum konca {contractType === 'CDI' ? '(ni za CDI)' : ''}</label>
            <input type="date" disabled={contractType === 'CDI'} className={`${inputClass} [color-scheme:dark] disabled:opacity-40`} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Poskusna doba (mesecev)</label>
            <input type="number" min={0} className={inputClass} value={trialMonths} onChange={(e) => setTrialMonths(Number(e.target.value) || 0)} />
          </div>
          <div>
            <label className={labelClass}>Plača (Ar)</label>
            <input type="number" min={0} className={inputClass} value={salary} onChange={(e) => setSalary(Number(e.target.value) || 0)} />
          </div>
          <div>
            <label className={labelClass}>Kraj dela</label>
            <input className={inputClass} value={workLocation} onChange={(e) => setWorkLocation(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Delovni čas</label>
            <input className={inputClass} value={workHours} onChange={(e) => setWorkHours(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Opombe</label>
            <textarea className={`${inputClass} min-h-[60px] resize-y`} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/10">
            Prekliči
          </button>
          <button onClick={handleSave} disabled={saving} className="rounded-xl border border-[#c59b5b]/30 bg-[#c59b5b]/10 px-5 py-2.5 text-sm font-medium text-[#c59b5b] transition hover:bg-[#c59b5b]/20 disabled:opacity-40">
            {saving ? 'Shranjevanje...' : 'Shrani spremembe'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------- Tisk pogodbe ----------
function ContractPrint({ contract, company }: { contract: Contract; company?: CompanySettings }) {
  const s = contract.snapshot
  const fullName = fullNameFromSnapshot(s, contract.staffName)
  const civilite = genderLabelFr(s?.gender)
  const articles = buildContractArticles(contract, company)

  return (
    <div className="contract-print">
      <style>{`
        @media print {
          body.printing-contract * { visibility: hidden; }
          body.printing-contract .contract-print, body.printing-contract .contract-print * { visibility: visible; }
          body.printing-contract .contract-print { position: absolute; left: 0; top: 0; width: 100%; }
          @page { size: A4 portrait; margin: 18mm 16mm; }
        }
        .contract-print { display: none; }
        body.printing-contract .contract-print { display: block; color: #000; font-family: Georgia, 'Times New Roman', serif; font-size: 12px; line-height: 1.5; }
        .contract-print .c-header { text-align: center; margin-bottom: 14px; }
        .contract-print .c-logo { display: block; margin: 0 auto 6px; height: 56px; width: auto; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .contract-print .c-company { font-size: 14px; font-weight: 700; letter-spacing: 0.5px; }
        .contract-print .c-meta { font-size: 11px; color: #333; margin-top: 2px; }
        .contract-print .c-title { text-align: center; font-size: 15px; font-weight: 700; text-transform: uppercase; margin: 16px 0; letter-spacing: 1px; }
        .contract-print .c-num { text-align: center; font-size: 11px; color: #444; margin-top: -10px; margin-bottom: 14px; }
        .contract-print .c-parties p { margin: 3px 0; }
        .contract-print .c-section-title { font-weight: 700; margin: 12px 0 4px; }
        .contract-print table.c-terms { width: 100%; border-collapse: collapse; margin: 8px 0; }
        .contract-print table.c-terms td { border: 1px solid #999; padding: 5px 8px; }
        .contract-print table.c-terms td:first-child { width: 40%; font-weight: 600; background: #f2f1f0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .contract-print .c-articles { margin-top: 14px; }
        .contract-print .c-article { margin-bottom: 9px; }
        .contract-print .c-article-title { font-weight: 700; margin: 0 0 2px; }
        .contract-print .c-article-body { margin: 0 0 2px; text-align: justify; }
        .contract-print .c-closing { margin-top: 16px; font-weight: 600; }
        .contract-print .c-copies { margin-top: 6px; font-size: 11px; }
        .contract-print .c-copies p { margin: 1px 0; }
        .contract-print .c-note { margin-top: 10px; font-size: 11px; font-style: italic; color: #555; }
        .contract-print .c-signatures { display: flex; justify-content: space-between; margin-top: 48px; }
        .contract-print .c-sign { width: 45%; text-align: center; }
        .contract-print .c-sign .line { border-top: 1px solid #000; margin-top: 40px; padding-top: 4px; font-size: 11px; }
      `}</style>

      <div className="c-header">
        <img className="c-logo" src="/images/komba-logo-color.png" alt="Komba Cabana" />
        <div className="c-company">{company?.name ?? contract.company}</div>
        <div className="c-meta">{company?.address ?? ''}</div>
        <div className="c-meta">
          {company?.nifNumber ? `NIF: ${company.nifNumber}` : ''}
          {company?.statNumber ? `  ·  STAT: ${company.statNumber}` : ''}
          {company?.rcsNumber ? `  ·  RCS: ${company.rcsNumber}` : ''}
        </div>
      </div>

      <div className="c-title">{CONTRACT_TYPES[contract.contractType].fr}</div>
      <div className="c-num">N° {contract.contractNumber}</div>

      <div className="c-parties">
        <p className="c-section-title">Les parties soussignées :</p>
        <p style={{ marginTop: 6, fontWeight: 700 }}>Employeur :</p>
        <p>— Raison sociale : {company?.name ?? contract.company}</p>
        <p>— Adresse : {company?.address ?? '—'}</p>
        {company?.repName && <p>— Représentée par : {company.repName}</p>}
        {(company?.nifNumber || company?.statNumber || company?.rcsNumber) && (
          <p>
            {company?.nifNumber ? `NIF : ${company.nifNumber}` : ''}
            {company?.statNumber ? `   STAT : ${company.statNumber}` : ''}
            {company?.rcsNumber ? `   RCS : ${company.rcsNumber}` : ''}
          </p>
        )}
        <p style={{ marginTop: 8, fontWeight: 700 }}>Travailleur :</p>
        <p>— Noms et prénoms : {fullName}</p>
        {s?.dateOfBirth && <p>— Né(e) le : {formatDateFr(s.dateOfBirth)}{s?.placeOfBirth ? ` à ${s.placeOfBirth}` : ''}</p>}
        {(s?.fatherName || s?.motherName) && (
          <p>
            — {civilite === 'Madame' ? 'Fille de' : 'Fils de'} : {s?.fatherName || '—'}
            {s?.motherName ? ` et de ${s.motherName}` : ''}
          </p>
        )}
        {s?.nationality && <p>— De nationalité : {s.nationality}</p>}
        {s?.documentNumber && <p>— CIN : {s.documentNumber}</p>}
        {s?.cnapsNumber && <p>— N° CNAPS : {s.cnapsNumber}</p>}
        {s?.address && <p>— Domicile à Madagascar : {s.address}</p>}
      </div>

      <div className="c-articles">
        {articles.map((a) => (
          <div className="c-article" key={a.num}>
            <p className="c-article-title">Article {a.num}. {a.title}</p>
            {a.body.split('\n').map((line, i) => (
              <p className="c-article-body" key={i}>{line}</p>
            ))}
          </div>
        ))}
      </div>

      {contract.notes && <p className="c-note">Notes : {contract.notes}</p>}

      <p className="c-closing">
        Fait et signé en quatre (4) exemplaires originaux, à Nosy-Be{contract.signedAt ? `, le ${formatDateFr(contract.signedAt)}` : ''}.
      </p>
      <div className="c-copies">
        <p>Copie :</p>
        <p>— Travailleur (01)</p>
        <p>— Chrono (01)</p>
        <p>— Archives (01)</p>
        <p>— Inspection du travail du ressort (01)</p>
      </div>

      <div className="c-signatures">
        <div className="c-sign"><div className="line">Le Travailleur</div></div>
        <div className="c-sign"><div className="line">L&apos;Employeur</div></div>
      </div>
    </div>
  )
}
