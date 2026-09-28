'use client'

// =====================================================================
// Registre d'employeur — glavni vmesnik (samo Kadrovski oddelek).
// Funkcionalno jedro (spec §1–§15). Postavitev izpisov je ZAČASNA
// (MODÈLE PROVISOIRE) do uskladitve po fotografijah originalov.
// Pravice: admin PIN (2580) + izbira vloge; vloga se beleži v revizijo.
// Inspection = lecture seule (samo branje).
// =====================================================================

import React, { useState, useMemo } from 'react'
import useSWR from 'swr'
import {
  Landmark, LayoutDashboard, Users, Briefcase, ShieldCheck, FileText, ScrollText,
  Download, Building2, Layers, Plus, Search, AlertTriangle, Lock, Check, X,
  Printer, Upload, Trash2, Pencil, ChevronDown, Info, ClipboardList, ClipboardCheck,
} from 'lucide-react'
import {
  getEstablishments, ensureDefaultEstablishment, updateEstablishment,
  getRegisterEntries, getUnregisteredStaff, checkWorkerDuplicates, inscribeWorker,
  rectifyEntry, changeEntryStatus, getRelations, addRelationRow,
  getInspections, addInspection, updateInspection, lockInspection,
  getDocuments, addDocument, removeDocument, getAuditLog, getDashboardStats,
  getExports, createOfficialExport, getSpecialRegisters, addToSpecialRegister,
  getDeclarations, createDeclaration, saveDeclaration, setDeclarationStatus,
  attachDeclarationDocument, exportDeclaration,
  getPeriodicReports, createPeriodicReport, savePeriodicReport, setPeriodicStatus,
  attachPeriodicDocument, exportPeriodicReport,
} from '@/app/actions/employer-register'
import {
  REGISTER_ROLES, isReadOnlyRole, PART1_FIELDS, PART2_FIELDS, PART3_FIELDS, PART3_REQUIRED,
  ENTRY_STATUS_LABELS, INSPECTION_STATUS_LABELS, AUDIT_ACTION_LABELS,
  ENTRY_STATUS_LABELS_SL, INSPECTION_STATUS_LABELS_SL, AUDIT_ACTION_LABELS_SL,
  SPECIAL_CATEGORIES, DUPLICATE_REASON_LABELS, DUPLICATE_REASON_LABELS_SL,
  GROUP_LABELS_SL, PROVISIONAL_WATERMARK,
  DECLARATION_OBJET_OPTIONS, DECLARATION_FIELDS, DECLARATION_STATUS_LABELS, DECLARATION_STATUS_LABELS_SL,
  PERIODIC_HEADER_FIELDS, PERIODIC_MERE_FIELDS, PERIODIC_ETAB_FIELDS,
  PERIODIC_STATUS_LABELS, PERIODIC_STATUS_LABELS_SL, PERIODIC_COMPLEMENTARY_NOTICE,
  type RegisterRole, type FieldDef, type RegisterEntry, type Establishment,
  type Inspection, type DuplicateMatch, type EmployerDeclaration, type DeclarationStatus,
  type PeriodicReport, type PeriodicStatus,
} from '@/lib/employer-register'
import { buildRegisterPrintHtml, buildDocumentPrintHtml, fmtCell, type PrintColumn, type DocSection } from '@/lib/employer-register-pdf'

const ADMIN_PIN = '2580'
const EST_ID = 'est-komba-cabana-lodge'

type SubView = 'dashboard' | 'part1' | 'part2' | 'part3' | 'documents' | 'journal' | 'exports' | 'etablissement' | 'special' | 'declaration' | 'periodique'

const SUB_NAV: { id: SubView; label: string; labelSl: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Tableau de bord', labelSl: 'Nadzorna plošča', icon: LayoutDashboard },
  { id: 'part1', label: '1ère Partie — Personnel', labelSl: '1. del — Osebje', icon: Users },
  { id: 'part2', label: '2ème Partie — Relations', labelSl: '2. del — Razmerja', icon: Briefcase },
  { id: 'part3', label: '3ème Partie — Inspection', labelSl: '3. del — Inšpekcija', icon: ShieldCheck },
  { id: 'special', label: 'Registres spéciaux', labelSl: 'Posebni registri', icon: Layers },
  { id: 'documents', label: 'Documents', labelSl: 'Dokumenti', icon: FileText },
  { id: 'journal', label: 'Journal (audit)', labelSl: 'Dnevnik (revizija)', icon: ScrollText },
  { id: 'exports', label: 'Exports officiels', labelSl: 'Uradni izvozi', icon: Download },
  { id: 'etablissement', label: 'Établissement', labelSl: 'Obrat', icon: Building2 },
  { id: 'declaration', label: 'Déclaration d’établissement', labelSl: 'Prijava obrata', icon: ClipboardCheck },
  { id: 'periodique', label: 'Renseignements périodiques', labelSl: 'Periodični podatki', icon: ClipboardList },
]

const GOLD = '#c59b5b'
const GREEN = '#8fae92'
const BLUE = '#7fa8b8'
const PINK = '#d9a68f'

// ---------------------------------------------------------------- helpers

function labelCls() {
  return 'block text-[11px] uppercase tracking-wider text-white/40 mb-1'
}
function inputCls() {
  return 'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/25 focus:border-white/30 focus:outline-none [color-scheme:dark]'
}

// Splošni obrazec, voden po FieldDef[]. Vrne vrednosti prek onChange.
function FieldGrid({
  fields, values, onChange, disabled,
}: {
  fields: FieldDef[]
  values: Record<string, string | boolean>
  onChange: (key: string, value: string | boolean) => void
  disabled?: boolean
}) {
  const groups = useMemo(() => {
    const map = new Map<string, FieldDef[]>()
    for (const f of fields) {
      const g = f.group || 'Autres'
      if (!map.has(g)) map.set(g, [])
      map.get(g)!.push(f)
    }
    return Array.from(map.entries())
  }, [fields])

  return (
    <div className="space-y-5">
      {groups.map(([group, gfields]) => (
        <div key={group}>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: GOLD }}>
            {group}
            {GROUP_LABELS_SL[group] && <span className="ml-2 font-normal normal-case tracking-normal text-white/40">· {GROUP_LABELS_SL[group]}</span>}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {gfields.map((f) => (
              <div key={f.key} className={f.type === 'textarea' ? 'sm:col-span-2 lg:col-span-3' : ''}>
                <label className={labelCls()}>
                  {f.label}
                  {f.labelSl && <span className="ml-1 normal-case tracking-normal text-white/30">· {f.labelSl}</span>}
                </label>
                {f.type === 'textarea' ? (
                  <textarea
                    className={inputCls()} rows={2} disabled={disabled}
                    value={(values[f.key] as string) || ''}
                    onChange={(e) => onChange(f.key, e.target.value)}
                  />
                ) : f.type === 'boolean' ? (
                  <button
                    type="button" disabled={disabled}
                    onClick={() => onChange(f.key, !values[f.key])}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${values[f.key] ? 'border-[#8fae92]/40 text-[#8fae92]' : 'border-white/10 text-white/50'}`}
                  >
                    <span className={`flex h-4 w-4 items-center justify-center rounded ${values[f.key] ? 'bg-[#8fae92]/30' : 'bg-white/10'}`}>
                      {values[f.key] ? <Check className="h-3 w-3" /> : null}
                    </span>
                    {values[f.key] ? 'Oui' : 'Non'}
                  </button>
                ) : f.type === 'select' ? (
                  <select
                    className={inputCls()} disabled={disabled}
                    value={(values[f.key] as string) || ''}
                    onChange={(e) => onChange(f.key, e.target.value)}
                  >
                    <option value="" className="bg-[#123543]">—</option>
                    {(f.options || []).map((o) => <option key={o} value={o} className="bg-[#123543]">{o}</option>)}
                  </select>
                ) : (
                  <input
                    type={f.type === 'date' ? 'date' : f.type === 'number' ? 'number' : 'text'}
                    className={inputCls()} disabled={disabled}
                    value={(values[f.key] as string) || ''}
                    onChange={(e) => onChange(f.key, e.target.value)}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function StatCard({ label, labelSl, value, tone, hint }: { label: string; labelSl?: string; value: number; tone?: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="text-2xl font-bold tabular-nums" style={{ color: tone || '#fff' }}>{value}</div>
      <div className="mt-1 text-xs text-white/60">{label}</div>
      {labelSl && <div className="text-[10px] text-white/35">{labelSl}</div>}
      {hint && <div className="mt-0.5 text-[10px] text-white/35">{hint}</div>}
    </div>
  )
}

function openPrintWindow(html: string) {
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
  }, 400)
}

// ================================================================ MAIN

export default function RegistreEmployeurTab() {
  // --- Gate: admin PIN + izbira vloge ---
  const [authed, setAuthed] = useState(false)
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState('')
  const [role, setRole] = useState<RegisterRole | null>(null)

  React.useEffect(() => {
    if (localStorage.getItem('kc_admin_auth') === 'true') setAuthed(true)
    const savedRole = localStorage.getItem('kc_register_role') as RegisterRole | null
    if (savedRole) setRole(savedRole)
  }, [])

  const [sub, setSub] = useState<SubView>('dashboard')

  const readOnly = isReadOnlyRole(role)

  // Ensure default establishment exists once.
  React.useEffect(() => { ensureDefaultEstablishment().catch(() => {}) }, [])

  if (!authed) {
    return (
      <div className="mx-auto max-w-sm py-10">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center">
          <Landmark className="mx-auto h-8 w-8" style={{ color: GOLD }} />
          <h3 className="mt-3 text-lg font-semibold text-white">Registre d’employeur</h3>
          <p className="text-xs text-white/40">Register delodajalca</p>
          <p className="mt-1 text-sm text-white/50">Accès protégé — saisissez le code administrateur.<br /><span className="text-white/35">Zaščiten dostop — vnesite skrbniško kodo.</span></p>
          <input
            autoFocus type="password" inputMode="numeric" value={pin}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '').slice(0, 4)
              setPin(v); setPinError('')
              if (v.length === 4) {
                if (v === ADMIN_PIN) { setAuthed(true); localStorage.setItem('kc_admin_auth', 'true') }
                else { setPinError('Code incorrect · Napačna koda'); setTimeout(() => setPin(''), 500) }
              }
            }}
            className={`${inputCls()} mt-4 text-center text-2xl tracking-[0.5em]`}
            placeholder="••••"
          />
          {pinError && <p className="mt-2 text-sm text-red-400">{pinError}</p>}
        </div>
      </div>
    )
  }

  if (!role) {
    return (
      <div className="mx-auto max-w-md py-10">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h3 className="text-center text-lg font-semibold text-white">Sélectionnez votre rôle</h3>
          <p className="mt-0.5 text-center text-xs text-white/40">Izberite svojo vlogo</p>
          <p className="mt-1 text-center text-sm text-white/50">Le rôle est enregistré dans le journal d’audit.<br /><span className="text-white/35">Vloga se zabeleži v revizijski dnevnik.</span></p>
          <div className="mt-4 space-y-2">
            {REGISTER_ROLES.map((r) => (
              <button
                key={r.id}
                onClick={() => { setRole(r.id); localStorage.setItem('kc_register_role', r.id) }}
                className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left transition-colors hover:bg-white/10"
              >
                <div>
                  <div className="text-sm font-medium text-white">{r.label} <span className="text-white/40">· {r.labelSl}</span></div>
                  <div className="text-xs text-white/45">{r.description} <span className="text-white/30">· {r.descriptionSl}</span></div>
                </div>
                <ChevronDown className="h-4 w-4 -rotate-90 text-white/30" />
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const roleLabel = REGISTER_ROLES.find((r) => r.id === role)?.label || role

  return (
    <div className="space-y-4">
      {/* Glava modula */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
        <div className="flex items-center gap-2">
          <Landmark className="h-5 w-5" style={{ color: GOLD }} />
          <div>
            <div className="text-sm font-semibold text-white">Registre d’employeur <span className="font-normal text-white/40">· Register delodajalca</span></div>
            <div className="text-[11px] text-white/45">Komba Cabana Lodge · Nosy Komba — Madagascar</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/60">
            Rôle / Vloga : <strong className="text-white/80">{roleLabel}</strong>
          </span>
          {readOnly && (
            <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs text-amber-300">
              Lecture seule · Samo branje
            </span>
          )}
          <button
            onClick={() => { setRole(null); localStorage.removeItem('kc_register_role') }}
            className="rounded-lg border border-white/10 px-3 py-1 text-xs text-white/60 hover:bg-white/10"
          >
            Changer de rôle · Zamenjaj vlogo
          </button>
        </div>
      </div>

      {/* Opozorilo o začasni postavitvi */}
      <div className="flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-2.5 text-xs text-amber-200/90">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>{PROVISIONAL_WATERMARK}. Les exports PDF portent cette mention jusqu’à la validation de la mise en page sur les modèles officiels.<br /><span className="text-amber-200/60">Začasna postavitev — izvozi PDF nosijo to oznako, dokler postavitve ne uskladimo po uradnih obrazcih.</span></span>
      </div>

      {/* Pod-navigacija */}
      <div className="flex flex-wrap gap-2">
        {SUB_NAV.map((n) => {
          const Icon = n.icon
          const active = sub === n.id
          return (
            <button
              key={n.id}
              onClick={() => setSub(n.id)}
              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                active ? 'bg-[#c59b5b]/20 text-[#c59b5b] border border-[#c59b5b]/30' : 'bg-white/5 text-white/60 hover:bg-white/10'
              }`}
              title={n.labelSl}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex flex-col items-start leading-tight">
                <span>{n.label}</span>
                <span className="text-[10px] font-normal text-white/40">{n.labelSl}</span>
              </span>
            </button>
          )
        })}
      </div>

      {sub === 'dashboard' && <DashboardView />}
      {sub === 'part1' && <Part1View role={role} readOnly={readOnly} />}
      {sub === 'part2' && <Part2View role={role} readOnly={readOnly} />}
      {sub === 'part3' && <Part3View role={role} readOnly={readOnly} />}
      {sub === 'special' && <SpecialView role={role} readOnly={readOnly} />}
      {sub === 'documents' && <DocumentsView role={role} readOnly={readOnly} />}
      {sub === 'journal' && <JournalView />}
      {sub === 'exports' && <ExportsView role={role} readOnly={readOnly} />}
      {sub === 'etablissement' && <EtablissementView role={role} readOnly={readOnly} />}
      {sub === 'declaration' && <DeclarationView role={role} readOnly={readOnly} />}
      {sub === 'periodique' && <PeriodicReportView role={role} readOnly={readOnly} />}
    </div>
  )
}

// ============================================================ Tableau de bord

function DashboardView() {
  const { data: stats } = useSWR(['er-dashboard'], () => getDashboardStats(EST_ID))
  if (!stats) return <div className="py-8 text-center text-sm text-white/40">Chargement… · Nalaganje…</div>
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard label="Total inscrits" labelSl="Vseh vpisanih" value={stats.total} tone="#fff" />
        <StatCard label="Actifs" labelSl="Aktivni" value={stats.active} tone={GREEN} />
        <StatCard label="Sortis" labelSl="Odšli" value={stats.sorti} tone="#fff" />
        <StatCard label="Contrôles inspection" labelSl="Inšpekcijski nadzori" value={stats.inspectionsTotal} tone={BLUE} />
      </div>
      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">Alertes de conformité · Opozorila skladnosti</div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <StatCard label="Dossiers incomplets" labelSl="Nepopolni dosjeji" value={stats.incomplete} tone={stats.incomplete ? PINK : GREEN} hint="Nom, naissance, entrée · ime, rojstvo, vstop" />
          <StatCard label="Sans CIN" labelSl="Brez osebne izkaznice" value={stats.missingCin} tone={stats.missingCin ? PINK : GREEN} />
          <StatCard label="Sans CNAPS" labelSl="Brez številke CNAPS" value={stats.missingCnaps} tone={stats.missingCnaps ? PINK : GREEN} />
          <StatCard label="CDD expirant (30 j)" labelSl="Pogodbe za dol. čas potekajo (30 dni)" value={stats.contractsExpiringSoon} tone={stats.contractsExpiringSoon ? GOLD : GREEN} />
          <StatCard label="Mises en demeure ouvertes" labelSl="Odprti opomini" value={stats.openMiseEnDemeure} tone={stats.openMiseEnDemeure ? PINK : GREEN} />
          <StatCard label="Échéances à venir (30 j)" labelSl="Prihajajoči roki (30 dni)" value={stats.upcomingDeadlines} tone={stats.upcomingDeadlines ? GOLD : GREEN} />
          <StatCard label="Mesures en retard" labelSl="Zamujeni ukrepi" value={stats.overdueMeasures} tone={stats.overdueMeasures ? '#d7a592' : GREEN} />
        </div>
      </div>
    </div>
  )
}

// ============================================================ 1ère Partie

function Part1View({ role, readOnly }: { role: RegisterRole; readOnly: boolean }) {
  const { data: entries, mutate } = useSWR(['er-entries'], () => getRegisterEntries(EST_ID))
  const { data: establishments } = useSWR(['er-est'], () => getEstablishments())
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [rectifyId, setRectifyId] = useState<string | null>(null)

  const est = establishments?.find((e) => e.id === EST_ID) || null
  const filtered = (entries || []).filter((e) => {
    if (!search.trim()) return true
    const s = search.toLowerCase()
    return `${e.nom} ${e.prenoms} ${e.cin} ${e.passeport} ${e.cnaps}`.toLowerCase().includes(s)
  })

  const handlePrint = () => {
    if (!est) return
    const columns: PrintColumn[] = [
      { key: 'ordre', label: 'N°', width: '36px' },
      { key: 'nom', label: 'Nom' }, { key: 'prenoms', label: 'Prénoms' },
      { key: 'sexe', label: 'Sexe' }, { key: 'dateNaissance', label: 'Naissance' },
      { key: 'nationalite', label: 'Nationalité' }, { key: 'cin', label: 'CIN' },
      { key: 'passeport', label: 'Passeport' }, { key: 'cnaps', label: 'CNAPS' },
      { key: 'dateEntree', label: 'Entrée' }, { key: 'status', label: 'Statut' },
    ]
    const rows = (entries || []).map((e) => ({
      ordre: String(e.ordreNumber), nom: fmtCell(e.nom), prenoms: fmtCell(e.prenoms),
      sexe: fmtCell(e.sexe), dateNaissance: fmtCell(e.dateNaissance), nationalite: fmtCell(e.nationalite),
      cin: fmtCell(e.cin), passeport: fmtCell(e.passeport), cnaps: fmtCell(e.cnaps),
      dateEntree: fmtCell(e.dateEntree), status: ENTRY_STATUS_LABELS[e.status],
    }))
    openPrintWindow(buildRegisterPrintHtml({ establishment: est, partLabel: '1ère Partie — Identité et chronologie', columns, rows }))
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher · Iskanje (nom, CIN, CNAPS…)" className={`${inputCls()} pl-9`} />
        </div>
        <button onClick={handlePrint} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70 hover:bg-white/10" title="Natisni">
          <Printer className="h-4 w-4" /> Imprimer · Natisni
        </button>
        {!readOnly && (
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium" style={{ background: `${GREEN}33`, color: GREEN }} title="Vpiši zaposlenega">
            <Plus className="h-4 w-4" /> Inscrire un salarié · Vpiši zaposlenega
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-white/5 text-left text-xs uppercase tracking-wider text-white/40">
              <th className="px-3 py-2">N°</th><th className="px-3 py-2">Nom et prénoms · Ime in priimek</th>
              <th className="px-3 py-2">Naissance · Rojstvo</th><th className="px-3 py-2">Pièce · Dokument</th>
              <th className="px-3 py-2">CNAPS</th><th className="px-3 py-2">Entrée · Vstop</th>
              <th className="px-3 py-2">Statut · Status</th><th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-white/40">Aucun salarié inscrit · Ni vpisanih zaposlenih</td></tr>
            )}
            {filtered.map((e) => (
              <tr key={e.id} className={`border-t border-white/[0.06] ${e.status !== 'active' ? 'opacity-50' : ''}`}>
                <td className="px-3 py-2 tabular-nums text-white/70">{e.ordreNumber}</td>
                <td className="px-3 py-2 text-white/85">{e.nom} {e.prenoms}
                  {(!e.cin && e.typePiece !== 'Passeport') || !e.cnaps ? (
                    <AlertTriangle className="ml-1 inline h-3.5 w-3.5" style={{ color: PINK }} />
                  ) : null}
                </td>
                <td className="px-3 py-2 text-white/60">{e.dateNaissance || '—'}</td>
                <td className="px-3 py-2 text-white/60">{e.cin || e.passeport || '—'}</td>
                <td className="px-3 py-2 text-white/60">{e.cnaps || '—'}</td>
                <td className="px-3 py-2 text-white/60">{e.dateEntree || '—'}</td>
                <td className="px-3 py-2">
                  <span className="rounded-full border border-white/10 px-2 py-0.5 text-xs text-white/70" title={ENTRY_STATUS_LABELS_SL[e.status]}>{ENTRY_STATUS_LABELS[e.status]} · {ENTRY_STATUS_LABELS_SL[e.status]}</span>
                </td>
                <td className="px-3 py-2 text-right">
                  {!readOnly && (
                    <button onClick={() => setRectifyId(e.id)} className="rounded-md p-1 text-white/40 hover:bg-white/10 hover:text-white" title="Rectifier / statut · Popravek / status">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAdd && !readOnly && (
        <AddWorkerModal role={role} onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); mutate() }} />
      )}
      {rectifyId && !readOnly && (
        <RectifyModal role={role} entry={(entries || []).find((e) => e.id === rectifyId)!} onClose={() => setRectifyId(null)} onSaved={() => { setRectifyId(null); mutate() }} />
      )}
    </div>
  )
}

function AddWorkerModal({ role, onClose, onSaved }: { role: RegisterRole; onClose: () => void; onSaved: () => void }) {
  const { data: candidates } = useSWR(['er-unregistered'], () => getUnregisteredStaff(EST_ID))
  const [values, setValues] = useState<Record<string, string | boolean>>({})
  const [dups, setDups] = useState<DuplicateMatch[] | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [ackDup, setAckDup] = useState(false)

  const set = (k: string, v: string | boolean) => { setValues((p) => ({ ...p, [k]: v })); setDups(null); setAckDup(false) }

  const prefillFromStaff = (id: string) => {
    const c = candidates?.find((x) => x.id === id)
    if (!c) return
    setValues((p) => ({
      ...p,
      employeeId: c.id,
      nom: c.lastName || c.staffName || '',
      prenoms: c.firstName || '',
      sexe: c.gender === 'F' || c.gender === 'M' ? c.gender : '',
      dateNaissance: c.dateOfBirth || '',
      lieuNaissance: c.placeOfBirth || '',
      nationalite: c.nationality || '',
      adresse: c.address || '',
      telephone: c.phone || '',
      cin: c.documentNumber || '',
      cnaps: c.cnapsNumber || '',
      organismeMedical: c.ostieNumber || '',
      dateEntree: c.startDate || '',
    }))
    setDups(null)
  }

  const runDupCheck = async () => {
    const matches = await checkWorkerDuplicates({
      cin: values.cin as string, passeport: values.passeport as string,
      nom: values.nom as string, prenoms: values.prenoms as string,
      dateNaissance: values.dateNaissance as string, cnaps: values.cnaps as string,
    }, EST_ID)
    setDups(matches)
    return matches
  }

  const handleSave = async () => {
    setError('')
    if (!values.nom || !values.prenoms) { setError('Nom et prénoms obligatoires · Priimek in ime sta obvezna'); return }
    const matches = dups ?? await runDupCheck()
    if (matches.length > 0 && !ackDup) { setDups(matches); return }
    setSaving(true)
    try {
      const payload: Record<string, string | null> = {}
      for (const [k, v] of Object.entries(values)) payload[k] = typeof v === 'boolean' ? String(v) : (v || null)
      await inscribeWorker({ ...(payload as Partial<RegisterEntry>), role }, EST_ID)
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur')
    } finally { setSaving(false) }
  }

  return (
    <ModalShell title="Inscrire un salarié au registre · Vpiši zaposlenega v register" onClose={onClose} wide>
      {(candidates?.length ?? 0) > 0 && (
        <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <label className={labelCls()}>Pré-remplir depuis le personnel existant · Predizpolni iz obstoječega osebja</label>
          <select className={inputCls()} defaultValue="" onChange={(e) => e.target.value && prefillFromStaff(e.target.value)}>
            <option value="" className="bg-[#123543]">— Nouveau salarié · Nov zaposleni —</option>
            {candidates!.map((c) => (
              <option key={c.id} value={c.id} className="bg-[#123543]">{c.lastName || c.staffName} {c.firstName}</option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-white/35">Les données proviennent de la fiche du personnel (pas de double saisie). · Podatki so iz kartice osebja (brez dvojnega vnosa).</p>
        </div>
      )}

      <FieldGrid fields={PART1_FIELDS} values={values} onChange={set} />

      {dups && dups.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/[0.08] p-3">
          <div className="flex items-center gap-2 text-sm font-medium text-amber-300">
            <AlertTriangle className="h-4 w-4" /> Doublon possible détecté · Zaznan možen dvojnik
          </div>
          <ul className="mt-2 space-y-1 text-xs text-amber-200/90">
            {dups.map((d) => (
              <li key={d.entryId}>N° {d.ordreNumber} — {d.nom} {d.prenoms} · {DUPLICATE_REASON_LABELS[d.reason]} · {DUPLICATE_REASON_LABELS_SL[d.reason]}</li>
            ))}
          </ul>
          <label className="mt-2 flex items-center gap-2 text-xs text-amber-200">
            <input type="checkbox" checked={ackDup} onChange={(e) => setAckDup(e.target.checked)} />
            Je confirme qu’il s’agit bien d’un salarié distinct · Potrjujem, da gre za drugega zaposlenega
          </label>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white/60 hover:bg-white/10">Annuler · Prekliči</button>
        <button onClick={runDupCheck} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white/70 hover:bg-white/10">Vérifier les doublons · Preveri dvojnike</button>
        <button onClick={handleSave} disabled={saving} className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50" style={{ background: `${GREEN}33`, color: GREEN }}>
          {saving ? 'Enregistrement… · Shranjujem…' : 'Inscrire · Vpiši'}
        </button>
      </div>
    </ModalShell>
  )
}

function RectifyModal({ role, entry, onClose, onSaved }: { role: RegisterRole; entry: RegisterEntry; onClose: () => void; onSaved: () => void }) {
  const [values, setValues] = useState<Record<string, string | boolean>>(() => {
    const v: Record<string, string | boolean> = {}
    for (const f of PART1_FIELDS) v[f.key] = (entry[f.key as keyof RegisterEntry] as string) || ''
    return v
  })
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [statusAction, setStatusAction] = useState<'cancelled' | 'closed' | 'sorti' | ''>('')
  const [statusReason, setStatusReason] = useState('')

  const set = (k: string, v: string | boolean) => setValues((p) => ({ ...p, [k]: v }))

  const handleRectify = async () => {
    setError('')
    if (!reason.trim()) { setError('Motif de rectification obligatoire · Razlog popravka je obvezen'); return }
    setSaving(true)
    try {
      const changes: Record<string, string | null> = {}
      for (const f of PART1_FIELDS) changes[f.key] = (values[f.key] as string) || null
      await rectifyEntry(entry.id, changes, reason, role)
      onSaved()
    } catch (e) { setError(e instanceof Error ? e.message : 'Erreur') } finally { setSaving(false) }
  }

  const handleStatus = async () => {
    setError('')
    if (!statusAction) return
    if (!statusReason.trim()) { setError('Motif obligatoire · Razlog je obvezen'); return }
    setSaving(true)
    try {
      await changeEntryStatus(entry.id, statusAction, statusReason, role)
      onSaved()
    } catch (e) { setError(e instanceof Error ? e.message : 'Erreur') } finally { setSaving(false) }
  }

  return (
    <ModalShell title={`Rectifier · Popravek — N° ${entry.ordreNumber} ${entry.nom || ''} ${entry.prenoms || ''}`} onClose={onClose} wide>
      <div className="mb-3 flex items-start gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-2.5 text-xs text-white/50">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>Aucune suppression physique. Toute modification est tracée (ancienne/nouvelle valeur + motif) dans le journal d’audit.<br /><span className="text-white/35">Brez fizičnega brisanja. Vsaka sprememba se zabeleži (stara/nova vrednost + razlog) v revizijski dnevnik.</span></span>
      </div>

      <FieldGrid fields={PART1_FIELDS} values={values} onChange={set} />

      <div className="mt-4">
        <label className={labelCls()}>Motif de la rectification (obligatoire) · Razlog popravka (obvezno)</label>
        <input value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls()} placeholder="Ex. : correction d’une erreur de saisie du CIN · npr. popravek napačno vnesene številke CIN" />
      </div>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button onClick={onClose} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white/60 hover:bg-white/10">Fermer · Zapri</button>
        <button onClick={handleRectify} disabled={saving} className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50" style={{ background: `${BLUE}33`, color: BLUE }}>
          Enregistrer la rectification · Shrani popravek
        </button>
      </div>

      <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.02] p-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-white/40">Changement de statut (sans suppression) · Sprememba statusa (brez brisanja)</div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select value={statusAction} onChange={(e) => setStatusAction(e.target.value as typeof statusAction)} className={`${inputCls()} max-w-[280px]`}>
            <option value="" className="bg-[#123543]">— Choisir · Izberi —</option>
            <option value="sorti" className="bg-[#123543]">Marquer comme sorti · Označi kot odšel</option>
            <option value="closed" className="bg-[#123543]">Clôturer · Zaključi</option>
            <option value="cancelled" className="bg-[#123543]">Annuler l’inscription · Razveljavi vpis</option>
          </select>
          <input value={statusReason} onChange={(e) => setStatusReason(e.target.value)} className={`${inputCls()} flex-1 min-w-[180px]`} placeholder="Motif (obligatoire) · Razlog (obvezno)" />
          <button onClick={handleStatus} disabled={saving || !statusAction} className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50" style={{ background: `${PINK}22`, color: PINK }}>
            Appliquer · Uporabi
          </button>
        </div>
      </div>
    </ModalShell>
  )
}

// ============================================================ 2ème Partie

function Part2View({ role, readOnly }: { role: RegisterRole; readOnly: boolean }) {
  const { data: entries } = useSWR(['er-entries'], () => getRegisterEntries(EST_ID))
  const [selId, setSelId] = useState<string | null>(null)
  const active = (entries || []).filter((e) => e.status !== 'cancelled')
  const sel = active.find((e) => e.id === selId) || null

  return (
    <div className="space-y-3">
      <div className="max-w-md">
        <label className={labelCls()}>Salarié · Zaposleni</label>
        <select value={selId || ''} onChange={(e) => setSelId(e.target.value || null)} className={inputCls()}>
          <option value="" className="bg-[#123543]">— Sélectionner un salarié · Izberi zaposlenega —</option>
          {active.map((e) => <option key={e.id} value={e.id} className="bg-[#123543]">N° {e.ordreNumber} — {e.nom} {e.prenoms}</option>)}
        </select>
      </div>
      {sel ? <RelationHistory entry={sel} role={role} readOnly={readOnly} /> : (
        <div className="py-8 text-center text-sm text-white/40">Sélectionnez un salarié pour voir et compléter sa relation de travail.<br />Izberite zaposlenega za pregled in dopolnitev delovnega razmerja.</div>
      )}
    </div>
  )
}

function RelationHistory({ entry, role, readOnly }: { entry: RegisterEntry; role: RegisterRole; readOnly: boolean }) {
  const { data: rows, mutate } = useSWR(['er-relations', entry.id], () => getRelations(entry.id))
  const [showAdd, setShowAdd] = useState(false)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm text-white/60">Historique de la relation de travail (chaque changement = nouvelle ligne) · Zgodovina delovnega razmerja (vsaka sprememba = nova vrstica)</div>
        {!readOnly && (
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium" style={{ background: `${GREEN}33`, color: GREEN }}>
            <Plus className="h-4 w-4" /> Ajouter un évènement · Dodaj dogodek
          </button>
        )}
      </div>

      <div className="space-y-2">
        {(rows || []).length === 0 && <div className="py-6 text-center text-sm text-white/40">Aucun évènement enregistré · Ni zabeleženih dogodkov</div>}
        {(rows || []).map((r) => (
          <div key={r.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="flex items-center justify-between">
              <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: `${BLUE}22`, color: BLUE }}>{String(r.rowType || 'initial')}</span>
              <span className="text-xs text-white/40">{r.effectiveDate || (r.createdAt as string)?.slice(0, 10)}</span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3 lg:grid-cols-4">
              {PART2_FIELDS.filter((f) => f.key !== 'effectiveDate').map((f) => {
                const v = r[f.key]
                if (v === null || v === undefined || v === '' || v === false) return null
                return (
                  <div key={f.key}>
                    <span className="text-white/35" title={f.labelSl}>{f.labelSl || f.label}: </span>
                    <span className="text-white/80">{typeof v === 'boolean' ? (v ? 'Oui · Da' : 'Non · Ne') : String(v)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {showAdd && !readOnly && (
        <AddRelationModal entry={entry} role={role} onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); mutate() }} />
      )}
    </div>
  )
}

function AddRelationModal({ entry, role, onClose, onSaved }: { entry: RegisterEntry; role: RegisterRole; onClose: () => void; onSaved: () => void }) {
  const [values, setValues] = useState<Record<string, string | boolean>>({ rowType: 'initial' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k: string, v: string | boolean) => setValues((p) => ({ ...p, [k]: v }))

  const handleSave = async () => {
    setSaving(true); setError('')
    try {
      const payload: Record<string, string | number | boolean | null> = {}
      for (const [k, v] of Object.entries(values)) {
        if (v === '' || v === undefined) continue
        payload[k] = v
      }
      await addRelationRow(entry.id, payload, role, EST_ID)
      onSaved()
    } catch (e) { setError(e instanceof Error ? e.message : 'Erreur') } finally { setSaving(false) }
  }

  return (
    <ModalShell title={`Relation de travail · Delovno razmerje — N° ${entry.ordreNumber} ${entry.nom || ''}`} onClose={onClose} wide>
      <div className="mb-3">
        <label className={labelCls()}>Type d’évènement · Vrsta dogodka</label>
        <select value={values.rowType as string} onChange={(e) => set('rowType', e.target.value)} className={`${inputCls()} max-w-md`}>
          <option value="initial" className="bg-[#123543]">Engagement initial · Prva zaposlitev</option>
          <option value="avenant" className="bg-[#123543]">Avenant / changement · Aneks / sprememba</option>
          <option value="salaire" className="bg-[#123543]">Changement de salaire · Sprememba plače</option>
          <option value="poste" className="bg-[#123543]">Changement de poste · Sprememba delovnega mesta</option>
          <option value="suspension" className="bg-[#123543]">Suspension / congé · Suspenz / dopust</option>
          <option value="sortie" className="bg-[#123543]">Sortie / fin de contrat · Odhod / konec pogodbe</option>
        </select>
      </div>
      <FieldGrid fields={PART2_FIELDS} values={values} onChange={set} />
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white/60 hover:bg-white/10">Annuler · Prekliči</button>
        <button onClick={handleSave} disabled={saving} className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50" style={{ background: `${GREEN}33`, color: GREEN }}>
          {saving ? 'Enregistrement… · Shranjujem…' : 'Enregistrer · Shrani'}
        </button>
      </div>
    </ModalShell>
  )
}

// ============================================================ 3ème Partie

function Part3View({ role, readOnly }: { role: RegisterRole; readOnly: boolean }) {
  const { data: inspections, mutate } = useSWR(['er-inspections'], () => getInspections(EST_ID))
  const [showAdd, setShowAdd] = useState(false)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm text-white/60">Contrôles de l’inspection du travail · Nadzori inšpekcije dela</div>
        {!readOnly && (
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium" style={{ background: `${BLUE}33`, color: BLUE }}>
            <Plus className="h-4 w-4" /> Nouveau contrôle · Nov nadzor
          </button>
        )}
      </div>

      <div className="space-y-2">
        {(inspections || []).length === 0 && <div className="py-6 text-center text-sm text-white/40">Aucun contrôle enregistré · Ni zabeleženih nadzorov</div>}
        {(inspections || []).map((i) => (
          <InspectionCard key={i.id} insp={i} role={role} readOnly={readOnly} onChanged={mutate} />
        ))}
      </div>

      {showAdd && !readOnly && (
        <AddInspectionModal role={role} onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); mutate() }} />
      )}
    </div>
  )
}

function InspectionCard({ insp, role, readOnly, onChanged }: { insp: Inspection; role: RegisterRole; readOnly: boolean; onChanged: () => void }) {
  const [busy, setBusy] = useState(false)
  const overdue = insp.delaiExecution < new Date().toISOString().slice(0, 10) && insp.status !== 'cloture' && insp.status !== 'regularise' && insp.status !== 'verifie'

  const setStatus = async (status: Inspection['status']) => {
    setBusy(true)
    try { await updateInspection(insp.id, { status }, role); onChanged() } finally { setBusy(false) }
  }
  const doLock = async () => {
    setBusy(true)
    try { await lockInspection(insp.id, role); onChanged() } finally { setBusy(false) }
  }

  return (
    <div className={`rounded-xl border p-3 ${overdue ? 'border-red-400/30 bg-red-400/[0.05]' : 'border-white/10 bg-white/[0.03]'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" style={{ color: BLUE }} />
          <span className="text-sm font-medium text-white">{insp.visitDate} · {insp.inspecteurNom}</span>
          {insp.locked && <Lock className="h-3.5 w-3.5 text-white/40" />}
          {insp.miseEnDemeure && <span className="rounded-full bg-red-400/15 px-2 py-0.5 text-[10px] text-red-300">Mise en demeure · Opomin</span>}
        </div>
        <span className="rounded-full border border-white/10 px-2 py-0.5 text-xs text-white/70" title={INSPECTION_STATUS_LABELS_SL[insp.status]}>{INSPECTION_STATUS_LABELS[insp.status]} · {INSPECTION_STATUS_LABELS_SL[insp.status]}</span>
      </div>
      <div className="mt-2 grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
        <div><span className="text-white/35">Infractions · Kršitve : </span><span className="text-white/80">{insp.infractions}</span></div>
        <div><span className="text-white/35">Mesures prescrites · Predpisani ukrepi : </span><span className="text-white/80">{insp.mesuresPrescrites}</span></div>
        <div><span className="text-white/35">Délai · Rok : </span><span className={overdue ? 'text-red-300' : 'text-white/80'}>{insp.delaiExecution}{overdue ? ' (dépassé · zamujeno)' : ''}</span></div>
        {insp.baseLegale && <div><span className="text-white/35">Base légale · Pravna podlaga : </span><span className="text-white/80">{insp.baseLegale}</span></div>}
      </div>
      {!readOnly && !insp.locked && (
        <div className="mt-3 flex flex-wrap gap-2">
          {(['en_cours', 'regularise', 'verifie', 'cloture'] as const).map((s) => (
            <button key={s} onClick={() => setStatus(s)} disabled={busy} className="rounded-lg border border-white/10 px-2.5 py-1 text-xs text-white/60 hover:bg-white/10 disabled:opacity-40" title={INSPECTION_STATUS_LABELS_SL[s]}>
              {INSPECTION_STATUS_LABELS[s]} · {INSPECTION_STATUS_LABELS_SL[s]}
            </button>
          ))}
          <button onClick={doLock} disabled={busy} className="flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1 text-xs text-white/60 hover:bg-white/10 disabled:opacity-40">
            <Lock className="h-3 w-3" /> Verrouiller (signé) · Zakleni (podpisano)
          </button>
        </div>
      )}
    </div>
  )
}

function AddInspectionModal({ role, onClose, onSaved }: { role: RegisterRole; onClose: () => void; onSaved: () => void }) {
  const [values, setValues] = useState<Record<string, string | boolean>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k: string, v: string | boolean) => setValues((p) => ({ ...p, [k]: v }))

  const handleSave = async () => {
    setError('')
    for (const req of PART3_REQUIRED) {
      if (!values[req]) { setError('Champs obligatoires · Obvezna polja: date, inspecteur, infractions, mesures, délai'); return }
    }
    setSaving(true)
    try {
      await addInspection({
        role,
        visitDate: values.visitDate as string,
        inspecteurNom: values.inspecteurNom as string,
        inspecteurFonction: (values.inspecteurFonction as string) || null,
        inspecteurService: (values.inspecteurService as string) || null,
        typeVisite: (values.typeVisite as string) || null,
        objetVisite: (values.objetVisite as string) || null,
        constatations: (values.constatations as string) || null,
        infractions: values.infractions as string,
        mesuresPrescrites: values.mesuresPrescrites as string,
        baseLegale: (values.baseLegale as string) || null,
        delaiExecution: values.delaiExecution as string,
        observationsEmployeur: (values.observationsEmployeur as string) || null,
        suiteDonnee: (values.suiteDonnee as string) || null,
        dateRegularisation: (values.dateRegularisation as string) || null,
        referenceProcesVerbal: (values.referenceProcesVerbal as string) || null,
        miseEnDemeure: values.miseEnDemeure === true,
      }, EST_ID)
      onSaved()
    } catch (e) { setError(e instanceof Error ? e.message : 'Erreur') } finally { setSaving(false) }
  }

  return (
    <ModalShell title="Nouveau contrôle de l’inspection du travail · Nov inšpekcijski nadzor" onClose={onClose} wide>
      <FieldGrid fields={PART3_FIELDS} values={values} onChange={set} />
      <label className="mt-3 flex items-center gap-2 text-sm text-white/70">
        <input type="checkbox" checked={values.miseEnDemeure === true} onChange={(e) => set('miseEnDemeure', e.target.checked)} />
        Mise en demeure · Opomin
      </label>
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white/60 hover:bg-white/10">Annuler · Prekliči</button>
        <button onClick={handleSave} disabled={saving} className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50" style={{ background: `${BLUE}33`, color: BLUE }}>
          {saving ? 'Enregistrement… · Shranjujem…' : 'Enregistrer · Shrani'}
        </button>
      </div>
    </ModalShell>
  )
}

// ============================================================ Registres spéciaux

function SpecialView({ role, readOnly }: { role: RegisterRole; readOnly: boolean }) {
  const { data: rows, mutate } = useSWR(['er-special'], () => getSpecialRegisters(EST_ID))
  const { data: entries } = useSWR(['er-entries'], () => getRegisterEntries(EST_ID))
  const [cat, setCat] = useState(SPECIAL_CATEGORIES[0].id)
  const [entryId, setEntryId] = useState('')
  const [saving, setSaving] = useState(false)

  const add = async () => {
    if (!entryId) return
    setSaving(true)
    try { await addToSpecialRegister(entryId, cat, {}, role, EST_ID); setEntryId(''); mutate() } finally { setSaving(false) }
  }

  return (
    <div className="space-y-3">
      {!readOnly && (
        <div className="flex flex-wrap items-end gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <div className="flex-1 min-w-[220px]">
            <label className={labelCls()}>Catégorie · Kategorija</label>
            <select value={cat} onChange={(e) => setCat(e.target.value as typeof cat)} className={inputCls()}>
              {SPECIAL_CATEGORIES.map((c) => <option key={c.id} value={c.id} className="bg-[#123543]">{c.label} · {c.labelSl}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[220px]">
            <label className={labelCls()}>Salarié · Zaposleni</label>
            <select value={entryId} onChange={(e) => setEntryId(e.target.value)} className={inputCls()}>
              <option value="" className="bg-[#123543]">— Choisir · Izberi —</option>
              {(entries || []).map((e) => <option key={e.id} value={e.id} className="bg-[#123543]">N° {e.ordreNumber} — {e.nom} {e.prenoms}</option>)}
            </select>
          </div>
          <button onClick={add} disabled={saving || !entryId} className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50" style={{ background: `${GREEN}33`, color: GREEN }}>
            Ajouter · Dodaj
          </button>
        </div>
      )}

      <div className="space-y-3">
        {SPECIAL_CATEGORIES.map((c) => {
          const catRows = (rows || []).filter((r) => r.category === c.id)
          if (catRows.length === 0) return null
          return (
            <div key={c.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="mb-2 text-sm font-medium" style={{ color: GOLD }}>{c.label} <span className="font-normal text-white/40">· {c.labelSl}</span></div>
              <div className="flex flex-wrap gap-2">
                {catRows.map((r) => {
                  const e = (entries || []).find((x) => x.id === r.entryId)
                  return <span key={r.id} className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-white/70">N° {e?.ordreNumber ?? '?'} — {e?.nom} {e?.prenoms}</span>
                })}
              </div>
            </div>
          )
        })}
        {(rows || []).length === 0 && <div className="py-6 text-center text-sm text-white/40">Aucun registre spécial · Ni posebnih registrov</div>}
      </div>
    </div>
  )
}

// ============================================================ Documents

function DocumentsView({ role, readOnly }: { role: RegisterRole; readOnly: boolean }) {
  const { data: docs, mutate } = useSWR(['er-docs'], () => getDocuments(EST_ID))
  const { data: entries } = useSWR(['er-entries'], () => getRegisterEntries(EST_ID))
  const [uploading, setUploading] = useState(false)
  const [entryId, setEntryId] = useState('')
  const [docType, setDocType] = useState('')

  const handleUpload = async (file: File) => {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/upload-employer-document', { method: 'POST', body: fd })
      const json = await res.json()
      if (json.pathname) {
        await addDocument({ entryId: entryId || null, docType: docType || undefined, fileName: file.name, pathname: json.pathname }, role, EST_ID)
        mutate()
      }
    } finally { setUploading(false) }
  }

  return (
    <div className="space-y-3">
      {!readOnly && (
        <div className="flex flex-wrap items-end gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <div className="min-w-[200px] flex-1">
            <label className={labelCls()}>Rattacher au salarié (optionnel) · Pripni k zaposlenemu (neobvezno)</label>
            <select value={entryId} onChange={(e) => setEntryId(e.target.value)} className={inputCls()}>
              <option value="" className="bg-[#123543]">— Établissement · Obrat —</option>
              {(entries || []).map((e) => <option key={e.id} value={e.id} className="bg-[#123543]">N° {e.ordreNumber} — {e.nom} {e.prenoms}</option>)}
            </select>
          </div>
          <div className="min-w-[160px] flex-1">
            <label className={labelCls()}>Type de document · Vrsta dokumenta</label>
            <input value={docType} onChange={(e) => setDocType(e.target.value)} className={inputCls()} placeholder="Contrat, CIN, PV… · Pogodba, osebna, zapisnik…" />
          </div>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium" style={{ background: `${GREEN}33`, color: GREEN }}>
            <Upload className="h-4 w-4" /> {uploading ? 'Téléversement… · Nalagam…' : 'Téléverser · Naloži'}
            <input type="file" accept="image/*,application/pdf" className="hidden" disabled={uploading}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.currentTarget.value = '' }} />
          </label>
        </div>
      )}

      <div className="space-y-2">
        {(docs || []).length === 0 && <div className="py-6 text-center text-sm text-white/40">Aucun document · Ni dokumentov</div>}
        {(docs || []).map((d) => {
          const e = (entries || []).find((x) => x.id === d.entryId)
          return (
            <div key={d.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="flex items-center gap-3">
                <FileText className="h-4 w-4 text-white/50" />
                <div>
                  <div className="text-sm text-white/85">{d.fileName || d.pathname}</div>
                  <div className="text-[11px] text-white/40">
                    {d.docType || 'Document · Dokument'}{e ? ` · N° ${e.ordreNumber} ${e.nom}` : ''} · {(d.uploadedAt || '').slice(0, 10)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a href={`/api/image?pathname=${encodeURIComponent(d.pathname)}`} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10">Voir · Poglej</a>
                {!readOnly && (
                  <button onClick={async () => { await removeDocument(d.id, role); mutate() }} className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-red-300" title="Retirer (archivé, non supprimé) · Umakni (arhivirano, ne izbrisano)">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ============================================================ Journal (audit)

function JournalView() {
  const { data: log } = useSWR(['er-audit'], () => getAuditLog({ establishmentId: EST_ID, limit: 500 }))
  return (
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-white/5 text-left text-xs uppercase tracking-wider text-white/40">
            <th className="px-3 py-2">Date · Datum</th><th className="px-3 py-2">Action · Dejanje</th>
            <th className="px-3 py-2">Champ · Polje</th><th className="px-3 py-2">Ancienne · Stara</th>
            <th className="px-3 py-2">Nouvelle · Nova</th><th className="px-3 py-2">Motif · Razlog</th>
            <th className="px-3 py-2">Utilisateur · Uporabnik</th><th className="px-3 py-2">Rôle · Vloga</th>
          </tr>
        </thead>
        <tbody>
          {(log || []).length === 0 && <tr><td colSpan={8} className="px-3 py-6 text-center text-white/40">Journal vide · Dnevnik je prazen</td></tr>}
          {(log || []).map((a) => (
            <tr key={a.id} className="border-t border-white/[0.06]">
              <td className="px-3 py-2 whitespace-nowrap text-white/55">{(a.createdAt || '').replace('T', ' ').slice(0, 16)}</td>
              <td className="px-3 py-2 text-white/80" title={AUDIT_ACTION_LABELS_SL[a.actionType]}>{AUDIT_ACTION_LABELS[a.actionType] || a.actionType}{AUDIT_ACTION_LABELS_SL[a.actionType] ? ` · ${AUDIT_ACTION_LABELS_SL[a.actionType]}` : ''}</td>
              <td className="px-3 py-2 text-white/55">{a.fieldName || '—'}</td>
              <td className="px-3 py-2 text-white/45">{a.oldValue || '—'}</td>
              <td className="px-3 py-2 text-white/70">{a.newValue || '—'}</td>
              <td className="px-3 py-2 text-white/55">{a.reason || '—'}</td>
              <td className="px-3 py-2 text-white/55">{a.createdBy || '—'}</td>
              <td className="px-3 py-2 text-white/45">{a.userRole || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ============================================================ Exports

function ExportsView({ role, readOnly }: { role: RegisterRole; readOnly: boolean }) {
  const { data: exports, mutate } = useSWR(['er-exports'], () => getExports(EST_ID))
  const { data: entries } = useSWR(['er-entries'], () => getRegisterEntries(EST_ID))
  const [busy, setBusy] = useState(false)

  const createExport = async () => {
    setBusy(true)
    try {
      const content = (entries || []).map((e) => `${e.ordreNumber}|${e.nom}|${e.prenoms}|${e.cin}|${e.cnaps}|${e.status}`).join('\n')
      await createOfficialExport('1', content, (entries || []).map((e) => e.id), role, EST_ID)
      mutate()
    } finally { setBusy(false) }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-white/55">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>Chaque export officiel est verrouillé : il reçoit un numéro, une version et une somme de contrôle (checksum) enregistrés dans le journal. Les exports actuels portent la mention {PROVISIONAL_WATERMARK}.<br /><span className="text-white/35">Vsak uradni izvoz je zaklenjen: dobi številko, različico in kontrolno vsoto (checksum), zabeležene v dnevniku. Trenutni izvozi nosijo oznako začasne postavitve.</span></span>
      </div>
      {!readOnly && (
        <button onClick={createExport} disabled={busy} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium disabled:opacity-50" style={{ background: `${GOLD}22`, color: GOLD }}>
          <Download className="h-4 w-4" /> Générer un export officiel (1ère Partie) · Ustvari uradni izvoz (1. del)
        </button>
      )}
      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-white/5 text-left text-xs uppercase tracking-wider text-white/40">
              <th className="px-3 py-2">N°</th><th className="px-3 py-2">Partie · Del</th>
              <th className="px-3 py-2">Version · Različica</th><th className="px-3 py-2">Checksum · Kontr. vsota</th>
              <th className="px-3 py-2">Salariés · Zaposleni</th><th className="px-3 py-2">Date · Datum</th><th className="px-3 py-2">Par · Kdo</th>
            </tr>
          </thead>
          <tbody>
            {(exports || []).length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-white/40">Aucun export · Ni izvozov</td></tr>}
            {(exports || []).map((x) => (
              <tr key={x.id} className="border-t border-white/[0.06]">
                <td className="px-3 py-2 tabular-nums text-white/70">{x.exportNumber}</td>
                <td className="px-3 py-2 text-white/70">{x.registerPart}</td>
                <td className="px-3 py-2 tabular-nums text-white/70">v{x.version}</td>
                <td className="px-3 py-2 font-mono text-xs text-white/55">{x.checksum}</td>
                <td className="px-3 py-2 tabular-nums text-white/55">{x.includedEntryIds.length}</td>
                <td className="px-3 py-2 whitespace-nowrap text-white/55">{(x.createdAt || '').replace('T', ' ').slice(0, 16)}</td>
                <td className="px-3 py-2 text-white/55">{x.createdBy || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ============================================================ Établissement

function EtablissementView({ role, readOnly }: { role: RegisterRole; readOnly: boolean }) {
  const { data: establishments, mutate } = useSWR(['er-est'], () => getEstablishments())
  const est = establishments?.find((e) => e.id === EST_ID) || null
  const [form, setForm] = useState<Partial<Establishment>>({})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  React.useEffect(() => { if (est) setForm(est) }, [est])

  const fields: { key: keyof Establishment; label: string; labelSl: string }[] = [
    { key: 'name', label: 'Nom de l’établissement', labelSl: 'Ime obrata' },
    { key: 'nomCommercial', label: 'Nom commercial', labelSl: 'Komercialno ime' },
    { key: 'raisonSociale', label: 'Raison sociale', labelSl: 'Firma / naziv podjetja' },
    { key: 'nif', label: 'NIF', labelSl: 'Davčna številka (NIF)' },
    { key: 'stat', label: 'STAT', labelSl: 'Statistična številka (STAT)' },
    { key: 'rcs', label: 'RCS', labelSl: 'Sodni register (RCS)' },
    { key: 'adresseSiege', label: 'Adresse du siège', labelSl: 'Naslov sedeža' },
    { key: 'adresseEtablissement', label: 'Adresse de l’établissement', labelSl: 'Naslov obrata' },
    { key: 'activitePrincipale', label: 'Activité principale', labelSl: 'Glavna dejavnost' },
    { key: 'responsableLegal', label: 'Responsable légal', labelSl: 'Zakoniti zastopnik' },
    { key: 'responsableEtablissement', label: 'Responsable de l’établissement', labelSl: 'Odgovorna oseba obrata' },
    { key: 'inspectionOffice', label: 'Bureau d’inspection compétent', labelSl: 'Pristojni inšpekcijski urad' },
    { key: 'registerNumber', label: 'Numéro du registre', labelSl: 'Številka registra' },
    { key: 'openingDate', label: 'Date d’ouverture', labelSl: 'Datum odprtja' },
  ]

  const save = async () => {
    if (!est) return
    setSaving(true); setMsg('')
    try {
      await updateEstablishment(est.id, form, role)
      setMsg('Enregistré · Shranjeno')
      mutate()
      setTimeout(() => setMsg(''), 2500)
    } finally { setSaving(false) }
  }

  if (!est) return <div className="py-8 text-center text-sm text-white/40">Chargement… · Nalaganje…</div>

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {fields.map((f) => (
          <div key={f.key} className={f.key === 'adresseSiege' || f.key === 'adresseEtablissement' ? 'sm:col-span-2' : ''}>
            <label className={labelCls()}>{f.label} <span className="normal-case tracking-normal text-white/30">· {f.labelSl}</span></label>
            <input
              type={f.key === 'openingDate' ? 'date' : 'text'}
              disabled={readOnly}
              value={(form[f.key] as string) || ''}
              onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
              className={inputCls()}
            />
          </div>
        ))}
      </div>
      {!readOnly && (
        <div className="flex items-center gap-3">
          <button onClick={save} disabled={saving} className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50" style={{ background: `${GREEN}33`, color: GREEN }}>
            {saving ? 'Enregistrement… · Shranjujem…' : 'Enregistrer · Shrani'}
          </button>
          {msg && <span className="text-sm text-[#8fae92]">{msg}</span>}
        </div>
      )}
    </div>
  )
}

// ============================================================ Modal shell

function ModalShell({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/60 p-4" onClick={onClose}>
      <div
        className={`my-8 w-full ${wide ? 'max-w-4xl' : 'max-w-lg'} rounded-2xl border border-white/10 bg-[#123543] shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-white/50 hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  )
}

// ============================================================ shared: obrazci uradnih dokumentov

// Naloži datoteko na obstoječi upload route (isti vzorec kot DocumentsView).
async function uploadOfficialFile(file: File): Promise<{ pathname: string } | null> {
  const fd = new FormData()
  fd.append('file', file)
  const res = await fetch('/api/upload-employer-document', { method: 'POST', body: fd })
  if (!res.ok) return null
  return res.json()
}

// Statusna značka (FR · SL)
function StatusPill({ fr, sl, tone }: { fr: string; sl: string; tone: string }) {
  return (
    <span className="rounded-full border px-2.5 py-0.5 text-xs" style={{ borderColor: `${tone}55`, color: tone }} title={sl}>
      {fr} · {sl}
    </span>
  )
}

// ============================================================ Déclaration d'établissement

function DeclarationView({ role, readOnly }: { role: RegisterRole; readOnly: boolean }) {
  const { data: decls, mutate } = useSWR(['er-declarations'], () => getDeclarations(EST_ID))
  const { data: establishments } = useSWR(['er-est'], () => getEstablishments())
  const est = establishments?.[0]
  const [openId, setOpenId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const active = (decls || []).find((d) => d.id === openId) || null

  const create = async () => {
    setBusy(true)
    try { const rec = await createDeclaration(role, EST_ID); await mutate(); setOpenId(rec.id) }
    finally { setBusy(false) }
  }

  if (active && est) {
    return <DeclarationEditor decl={active} est={est} role={role} readOnly={readOnly} onBack={() => { setOpenId(null); mutate() }} onChanged={mutate} />
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-xs text-white/50">
        <Info className="mr-1 inline h-3.5 w-3.5" style={{ color: GOLD }} />
        Formulaire officiel de déclaration d’établissement. Les données de l’établissement sont reprises automatiquement.
        <span className="mt-1 block text-white/35">Uradni obrazec za prijavo obrata. Podatki obrata se prevzamejo samodejno; postavitev izpisa je začasna (MODÈLE PROVISOIRE) do uskladitve po originalu.</span>
      </div>

      {!readOnly && (
        <button onClick={create} disabled={busy} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium disabled:opacity-50" style={{ background: `${GOLD}22`, color: GOLD }}>
          <Plus className="h-4 w-4" /> Nouvelle déclaration · Nova prijava
        </button>
      )}

      <div className="space-y-2">
        {(decls || []).length === 0 && <div className="py-6 text-center text-sm text-white/40">Aucune déclaration · Ni prijav</div>}
        {(decls || []).map((d) => {
          const objet = DECLARATION_OBJET_OPTIONS.find((o) => o.id === d.objet)
          return (
            <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5">
              <div className="min-w-0">
                <div className="text-sm text-white/85">{objet ? `${objet.label} · ${objet.labelSl}` : 'Objet non défini · Predmet ni določen'}</div>
                <div className="text-[11px] text-white/40">{(d.createdAt || '').slice(0, 10)} · {(d.data?.faitA as string) || ''}</div>
              </div>
              <div className="flex items-center gap-2">
                <StatusPill fr={DECLARATION_STATUS_LABELS[d.status]} sl={DECLARATION_STATUS_LABELS_SL[d.status]} tone={d.status === 'archived' ? '#fff' : d.status === 'deposited' ? GREEN : d.status === 'signed' ? BLUE : GOLD} />
                <button onClick={() => setOpenId(d.id)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10">Ouvrir · Odpri</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DeclarationEditor({
  decl, est, role, readOnly, onBack, onChanged,
}: {
  decl: EmployerDeclaration; est: Establishment; role: RegisterRole; readOnly: boolean
  onBack: () => void; onChanged: () => void
}) {
  const locked = readOnly || decl.status === 'archived'
  const [objet, setObjet] = useState(decl.objet || '')
  const [objetPrecisions, setObjetPrecisions] = useState(decl.objetPrecisions || '')
  const [values, setValues] = useState<Record<string, string | boolean>>(() => {
    const v: Record<string, string | boolean> = {}
    for (const f of DECLARATION_FIELDS) {
      const raw = decl.data?.[f.key]
      v[f.key] = f.type === 'boolean' ? raw === true : (raw as string) ?? ''
    }
    return v
  })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [uploading, setUploading] = useState(false)

  const set = (k: string, val: string | boolean) => setValues((p) => ({ ...p, [k]: val }))

  const save = async () => {
    setSaving(true); setMsg('')
    try {
      await saveDeclaration(decl.id, { objet: objet || null, objetPrecisions: objetPrecisions || null, data: values }, role)
      setMsg('Enregistré · Shranjeno'); onChanged(); setTimeout(() => setMsg(''), 2500)
    } finally { setSaving(false) }
  }

  const buildSections = (): DocSection[] => {
    const objetOpt = DECLARATION_OBJET_OPTIONS.find((o) => o.id === objet)
    const sections: DocSection[] = [
      { title: 'Objet de la déclaration', rows: [
        { label: 'Objet', value: objetOpt ? objetOpt.label : '' },
        { label: 'Précisions', value: objetPrecisions },
      ] },
    ]
    const groups = new Map<string, { label: string; value: string }[]>()
    for (const f of DECLARATION_FIELDS) {
      const g = f.group || 'Autres'
      if (!groups.has(g)) groups.set(g, [])
      const raw = values[f.key]
      groups.get(g)!.push({ label: f.label, value: f.type === 'boolean' ? (raw ? 'Oui' : 'Non') : String(raw ?? '') })
    }
    for (const [g, rows] of groups) sections.push({ title: g, rows })
    return sections
  }

  const doPrint = async () => {
    const html = buildDocumentPrintHtml({
      establishment: est,
      title: 'Déclaration d’établissement',
      subtitle: 'Ministère du Travail — Inspection du Travail',
      sections: buildSections(),
      provisional: !decl.hideProvisional,
      pageLabel: 'Page 1',
    })
    openPrintWindow(html)
    try { await exportDeclaration(decl.id, JSON.stringify({ objet, objetPrecisions, values }), role, EST_ID); onChanged() } catch {}
  }

  const onUpload = async (file: File) => {
    setUploading(true)
    try {
      const up = await uploadOfficialFile(file)
      if (up) { await attachDeclarationDocument(decl.id, up.pathname, file.name, role, EST_ID); onChanged() }
    } finally { setUploading(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button onClick={onBack} className="flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10">
          <ChevronDown className="h-3.5 w-3.5 rotate-90" /> Retour · Nazaj
        </button>
        <StatusPill fr={DECLARATION_STATUS_LABELS[decl.status]} sl={DECLARATION_STATUS_LABELS_SL[decl.status]} tone={decl.status === 'deposited' ? GREEN : decl.status === 'signed' ? BLUE : GOLD} />
      </div>

      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: GOLD }}>Objet de la déclaration <span className="ml-2 font-normal normal-case tracking-normal text-white/40">· Predmet prijave</span></div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls()}>Objet · Predmet</label>
            <select value={objet} onChange={(e) => setObjet(e.target.value)} disabled={locked} className={inputCls()}>
              <option value="" className="bg-[#123543]">— Choisir · Izberi —</option>
              {DECLARATION_OBJET_OPTIONS.map((o) => <option key={o.id} value={o.id} className="bg-[#123543]">{o.label} · {o.labelSl}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls()}>Précisions · Podrobnosti</label>
            <input value={objetPrecisions} onChange={(e) => setObjetPrecisions(e.target.value)} disabled={locked} className={inputCls()} />
          </div>
        </div>
      </div>

      <FieldGrid fields={DECLARATION_FIELDS} values={values} onChange={set} disabled={locked} />

      <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
        {!locked && (
          <button onClick={save} disabled={saving} className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50" style={{ background: `${GREEN}33`, color: GREEN }}>
            {saving ? 'Enregistrement… · Shranjujem…' : 'Enregistrer · Shrani'}
          </button>
        )}
        <button onClick={doPrint} className="flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm text-white/70 hover:bg-white/10">
          <Printer className="h-4 w-4" /> Imprimer / PDF · Natisni / PDF
        </button>
        {!locked && (
          <>
            <button onClick={async () => { await setDeclarationStatus(decl.id, 'signed', role); onChanged() }} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/70 hover:bg-white/10">Marquer signé · Označi podpisano</button>
            <button onClick={async () => { await setDeclarationStatus(decl.id, 'deposited', role); onChanged() }} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/70 hover:bg-white/10">Marquer déposé · Označi vloženo</button>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium" style={{ background: `${BLUE}22`, color: BLUE }}>
              <Upload className="h-3.5 w-3.5" /> {uploading ? 'Téléversement… · Nalagam…' : 'Joindre le document signé · Priloži podpisano'}
              <input type="file" accept="image/*,application/pdf" className="hidden" disabled={uploading}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.currentTarget.value = '' }} />
            </label>
          </>
        )}
        {msg && <span className="text-sm text-[#8fae92]">{msg}</span>}
      </div>

      {!locked && (
        <label className="flex items-center gap-2 text-xs text-white/50">
          <input type="checkbox" checked={decl.hideProvisional} onChange={async (e) => { await saveDeclaration(decl.id, { hideProvisional: e.target.checked }, role); onChanged() }} />
          Masquer la mention « {PROVISIONAL_WATERMARK} » à l’impression · Skrij oznako začasne postavitve pri tisku
        </label>
      )}
    </div>
  )
}

// ============================================================ Renseignements périodiques (1. stran)

function PeriodicReportView({ role, readOnly }: { role: RegisterRole; readOnly: boolean }) {
  const { data: reports, mutate } = useSWR(['er-periodic'], () => getPeriodicReports(EST_ID))
  const { data: establishments } = useSWR(['er-est'], () => getEstablishments())
  const est = establishments?.[0]
  const [openId, setOpenId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const active = (reports || []).find((r) => r.id === openId) || null

  const create = async () => {
    setBusy(true)
    try { const rec = await createPeriodicReport(role, EST_ID); await mutate(); setOpenId(rec.id) }
    finally { setBusy(false) }
  }

  if (active && est) {
    return <PeriodicEditor report={active} est={est} role={role} readOnly={readOnly} onBack={() => { setOpenId(null); mutate() }} onChanged={mutate} />
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-xs text-white/50">
        <Info className="mr-1 inline h-3.5 w-3.5" style={{ color: GOLD }} />
        Formulaire officiel des renseignements périodiques (1ère page). Entreprise mère et établissement enquêté repris automatiquement.
        <span className="mt-1 block text-white/35">Uradni obrazec periodičnih podatkov (1. stran). Matično podjetje in anketirani obrat se prevzameta samodejno. {PERIODIC_COMPLEMENTARY_NOTICE}</span>
      </div>

      {!readOnly && (
        <button onClick={create} disabled={busy} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium disabled:opacity-50" style={{ background: `${GOLD}22`, color: GOLD }}>
          <Plus className="h-4 w-4" /> Nouveau document · Nov dokument
        </button>
      )}

      <div className="space-y-2">
        {(reports || []).length === 0 && <div className="py-6 text-center text-sm text-white/40">Aucun document · Ni dokumentov</div>}
        {(reports || []).map((r) => (
          <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5">
            <div className="min-w-0">
              <div className="text-sm text-white/85">{r.year || '—'}{r.periode ? ` · ${r.periode}` : ''}{r.documentNumber ? ` · N° ${r.documentNumber}` : ''}</div>
              <div className="text-[11px] text-white/40">{(r.createdAt || '').slice(0, 10)}</div>
            </div>
            <div className="flex items-center gap-2">
              <StatusPill fr={PERIODIC_STATUS_LABELS[r.status]} sl={PERIODIC_STATUS_LABELS_SL[r.status]} tone={r.status === 'archive' ? '#fff' : r.status === 'envoye' ? GREEN : r.status === 'signe' ? BLUE : GOLD} />
              <button onClick={() => setOpenId(r.id)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10">Ouvrir · Odpri</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function PeriodicEditor({
  report, est, role, readOnly, onBack, onChanged,
}: {
  report: PeriodicReport; est: Establishment; role: RegisterRole; readOnly: boolean
  onBack: () => void; onChanged: () => void
}) {
  const locked = readOnly || report.status === 'archive'
  const allFields = useMemo(() => [...PERIODIC_HEADER_FIELDS, ...PERIODIC_MERE_FIELDS, ...PERIODIC_ETAB_FIELDS], [])
  const [values, setValues] = useState<Record<string, string | boolean>>(() => {
    const v: Record<string, string | boolean> = {}
    for (const f of allFields) {
      const raw = report.data?.[f.key]
      v[f.key] = f.type === 'boolean' ? raw === true : (raw as string) ?? ''
    }
    return v
  })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [uploading, setUploading] = useState(false)

  const set = (k: string, val: string | boolean) => setValues((p) => ({ ...p, [k]: val }))

  const save = async () => {
    setSaving(true); setMsg('')
    try {
      const yr = values.annee ? Number(values.annee) : null
      await savePeriodicReport(report.id, {
        year: yr && !Number.isNaN(yr) ? yr : null,
        periode: (values.periode as string) || null,
        documentNumber: (values.documentNumber as string) || null,
        dateEnvoi: (values.dateEnvoiQuestionnaire as string) || null,
        data: values,
      }, role)
      setMsg('Enregistré · Shranjeno'); onChanged(); setTimeout(() => setMsg(''), 2500)
    } finally { setSaving(false) }
  }

  const sectionsFrom = (fields: FieldDef[], title: string): DocSection => ({
    title,
    rows: fields.map((f) => {
      const raw = values[f.key]
      return { label: f.label, value: f.type === 'boolean' ? (raw ? 'Oui' : 'Non') : String(raw ?? '') }
    }),
  })

  const doPrint = async () => {
    const html = buildDocumentPrintHtml({
      establishment: est,
      title: 'Renseignements périodiques',
      subtitle: 'Ministère du Travail — Enquête périodique',
      sections: [
        sectionsFrom(PERIODIC_HEADER_FIELDS, 'Document'),
        sectionsFrom(PERIODIC_MERE_FIELDS, '2 — Entreprise mère'),
        sectionsFrom(PERIODIC_ETAB_FIELDS, '3 — Établissement enquêté'),
      ],
      provisional: !report.hideProvisional,
      notice: PERIODIC_COMPLEMENTARY_NOTICE,
      pageLabel: 'Page 1',
    })
    openPrintWindow(html)
    try { await exportPeriodicReport(report.id, JSON.stringify(values), role, EST_ID); onChanged() } catch {}
  }

  const onUpload = async (file: File) => {
    setUploading(true)
    try {
      const up = await uploadOfficialFile(file)
      if (up) { await attachPeriodicDocument(report.id, up.pathname, file.name, role, EST_ID); onChanged() }
    } finally { setUploading(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button onClick={onBack} className="flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10">
          <ChevronDown className="h-3.5 w-3.5 rotate-90" /> Retour · Nazaj
        </button>
        <StatusPill fr={PERIODIC_STATUS_LABELS[report.status]} sl={PERIODIC_STATUS_LABELS_SL[report.status]} tone={report.status === 'envoye' ? GREEN : report.status === 'signe' ? BLUE : GOLD} />
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-[11px] italic text-white/40">
        {PERIODIC_COMPLEMENTARY_NOTICE}
      </div>

      <FieldGrid fields={PERIODIC_HEADER_FIELDS} values={values} onChange={set} disabled={locked} />
      <FieldGrid fields={PERIODIC_MERE_FIELDS} values={values} onChange={set} disabled={locked} />
      <FieldGrid fields={PERIODIC_ETAB_FIELDS} values={values} onChange={set} disabled={locked} />

      <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
        {!locked && (
          <button onClick={save} disabled={saving} className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50" style={{ background: `${GREEN}33`, color: GREEN }}>
            {saving ? 'Enregistrement… · Shranjujem…' : 'Enregistrer · Shrani'}
          </button>
        )}
        <button onClick={doPrint} className="flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm text-white/70 hover:bg-white/10">
          <Printer className="h-4 w-4" /> Imprimer / PDF · Natisni / PDF
        </button>
        {!locked && (
          <>
            <button onClick={async () => { await setPeriodicStatus(report.id, 'signe', role); onChanged() }} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/70 hover:bg-white/10">Marquer signé · Označi podpisano</button>
            <button onClick={async () => { await setPeriodicStatus(report.id, 'envoye', role); onChanged() }} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/70 hover:bg-white/10">Marquer envoyé · Označi poslano</button>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium" style={{ background: `${BLUE}22`, color: BLUE }}>
              <Upload className="h-3.5 w-3.5" /> {uploading ? 'Téléversement… · Nalagam…' : 'Joindre le document signé · Priloži podpisano'}
              <input type="file" accept="image/*,application/pdf" className="hidden" disabled={uploading}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.currentTarget.value = '' }} />
            </label>
          </>
        )}
        {msg && <span className="text-sm text-[#8fae92]">{msg}</span>}
      </div>

      {!locked && (
        <label className="flex items-center gap-2 text-xs text-white/50">
          <input type="checkbox" checked={report.hideProvisional} onChange={async (e) => { await savePeriodicReport(report.id, { hideProvisional: e.target.checked }, role); onChanged() }} />
          Masquer la mention « {PROVISIONAL_WATERMARK} » à l’impression · Skrij oznako začasne postavitve pri tisku
        </label>
      )}
    </div>
  )
}
