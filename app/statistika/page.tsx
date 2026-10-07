'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import useSWR from 'swr'
import { ArrowLeft, TrendingUp, TrendingDown, Settings, Plus, Trash2, Users, Moon, Euro, BarChart3, UserCog, Edit2, Check, X, Printer, UserMinus, UserCheck, Calendar, AlertTriangle, FileText, Ship, Megaphone, Search, Calculator, Coins, Award, ChevronDown, Gavel, Landmark, Smartphone, BookText } from 'lucide-react'
import { 
  getMonthlyStatistics, 
  getCostSettings, 
  updateCostSetting,
  getStaffSalaries,
  upsertStaffSalary,
  deleteStaffSalary,
  getAllStaffMembers,
  upsertStaffMember,
  deleteStaffMember,
  toggleStaffActive,
  updateStaffStartDate,
  updateStaffEndDate,
  addStaffSalaryChange,
  removeStaffSalaryChange,
  setStaffRegularEmployee,
  setStaffEmploymentType
} from '@/app/actions/statistics'
import { isoDate, periodCovers, periodLabel, salaryHistory, salaryOn, slDate } from '@/lib/employment'
import RazporedTab from '@/components/razpored-tab'
import VrtnarjiTab from '@/components/vrtnarji-tab'
import KuhinjaTab from '@/components/kuhinja-tab'
import BarTab from '@/components/bar-tab'
import PlaceTab from '@/components/place-tab'
import ObracunPlaceMg from '@/components/obracun-place-mg'
import PogodbeTab from '@/components/pogodbe-tab'
import NapitninaTab from '@/components/napitnina-tab'
import CertifikatTab from '@/components/certifikat-tab'
import DisciplinaTab from '@/components/disciplina-tab'
import RegistreEmployeurTab from '@/components/registre-employeur-tab'
import StaffPersonalInfo from '@/components/staff-personal-info'
import GuestBreakdown from '@/components/guest-breakdown'
import PrevozinkiTab from '@/components/prevozniki-tab'
import MarketingTab from '@/components/marketing-tab'
import BankaTab from '@/components/banka-tab'
import OrangeMoneyTab from '@/components/orange-money-tab'
import BlagajniskiDnevnik from '@/components/blagajniski-dnevnik'
import MarketingOverviewRow from '@/components/marketing-overview-row'
import LeaveDocument from '@/components/leave-document'
import PayrollSettingsPanel from '@/components/payroll-settings'
import { getUpcomingContributionAlerts } from '@/app/actions/payroll'
import { formatAr } from '@/lib/payroll'
import { bungalowDisplayName } from '@/lib/bungalow'

const MONTHS = [
  'Januar', 'Februar', 'Marec', 'April', 'Maj', 'Junij',
  'Julij', 'Avgust', 'September', 'Oktober', 'November', 'December'
]

const STAFF_TYPES = [
  { value: 'gardener', label: 'Vrtnar', allocateTo: 'accommodation' },
  { value: 'housekeeper', label: 'Sobarica', allocateTo: 'accommodation' },
  { value: 'barman', label: 'Barman', allocateTo: 'bar' },
  { value: 'kitchen', label: 'Kuhinja', allocateTo: 'kuhinja' },
  { value: 'reception', label: 'Recepcija', allocateTo: 'management' },
  { value: 'maintenance', label: 'Vzdrževanje', allocateTo: 'management' },
  { value: 'other', label: 'Drugo', allocateTo: 'management' },
]

function formatEur(value: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value)
}

type StaffKind = 'all' | 'regular' | 'contract' | 'stagiaire'

function staffKindOf(staff: { isRegularEmployee: boolean; employmentType: string }): Exclude<StaffKind, 'all'> {
  if (staff.isRegularEmployee) return 'regular'
  if (staff.employmentType === 'stagiaire') return 'stagiaire'
  return 'contract'
}

type Tab = 'kalkulacije' | 'kadri'
type KalkulacijeView = 'pregled' | 'nastavitve' | 'prevozniki' | 'marketing' | 'finance'
type FinanceView = 'banka' | 'orange' | 'dnevnik'
  type KadriView = 'seznam' | 'place' | 'obracun' | 'pogodbe' | 'razpored' | 'napitnina' | 'certifikat' | 'disciplina' | 'registre'

function StatistikaContent() {
  const currentDate = new Date()
  // Read live from the URL, not once via useState: navigating between the two
  // menu entries reuses this component, so a one-off initializer would keep
  // showing whichever section happened to load first.
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab')
  const viewParam = searchParams.get('view')
  const activeTab: Tab = tabParam === 'kadri' ? 'kadri' : 'kalkulacije'
  // Plače se vedno delajo za mesec nazaj → na Kadrovskem oddelku privzeto
  // prejšnji mesec (Kalkulacije ostanejo na tekočem mesecu). Date poskrbi za
  // prehod čez leto (januar → december prejšnjega leta).
  const defaultMonthDate =
    activeTab === 'kadri'
      ? new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)
      : currentDate
  const [year, setYear] = useState(defaultMonthDate.getFullYear())
  const [month, setMonth] = useState(defaultMonthDate.getMonth() + 1)
  const [kalkulacijeView, setKalkulacijeView] = useState<KalkulacijeView>(viewParam === 'finance' ? 'finance' : 'pregled')
  const [financeView, setFinanceView] = useState<FinanceView>('banka')
  const [razporedView, setRazporedView] = useState<'sobarice' | 'vrtnarji' | 'kuhinja' | 'bar'>('sobarice')
  const [kadriView, setKadriView] = useState<KadriView>('seznam')
  // Quarter to open the payroll module on, set when coming from a deadline alert.
  const [placeQuarter, setPlaceQuarter] = useState<number | null>(null)
  const [staffSearch, setStaffSearch] = useState('')
  const [staffKind, setStaffKind] = useState<StaffKind>('all')
  const [editingStaff, setEditingStaff] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    staffType: 'other',
    staffName: '',
    monthlySalary: '',
    allocateTo: 'management',
    activeMonths: [1,2,3,4,5,6,7,8,9,10,11,12] as number[],
    startDate: '',
    endDate: '',
  })
  const [savingEdit, setSavingEdit] = useState(false)
  const [salaryEditId, setSalaryEditId] = useState<string | null>(null)
  const [salaryFrom, setSalaryFrom] = useState('')
  const [salaryAmount, setSalaryAmount] = useState('')
  const [savingSalary, setSavingSalary] = useState(false)
  const [newStaff, setNewStaff] = useState({ 
    staffType: 'other', 
    staffName: '', 
    monthlySalary: '', 
    allocateTo: 'management',
    activeMonths: [1,2,3,4,5,6,7,8,9,10,11,12],
    startDate: ''
  })

  const { data: stats, mutate } = useSWR(
    ['statistics', year, month],
    () => getMonthlyStatistics(year, month),
    { refreshInterval: 0 }
  )

  const { data: allStaff, mutate: mutateStaff } = useSWR(
    'all-staff',
    () => getAllStaffMembers(),
    { refreshInterval: 0 }
  )

  const { data: contributionAlerts } = useSWR(
    'contribution-alerts',
    () => getUpcomingContributionAlerts(),
    { refreshInterval: 0 }
  )

  const handleCostUpdate = async (id: string, value: number) => {
    await updateCostSetting(id, value)
    mutate()
  }

  const handleAddStaff = async () => {
    if (!newStaff.staffName || !newStaff.monthlySalary) return
    await upsertStaffMember({
      staffType: newStaff.staffType,
      staffName: newStaff.staffName,
      monthlySalary: Number(newStaff.monthlySalary),
      allocateTo: newStaff.allocateTo,
      activeMonths: newStaff.activeMonths,
      startDate: newStaff.startDate || null
    })
    setNewStaff({ staffType: 'other', staffName: '', monthlySalary: '', allocateTo: 'management', activeMonths: [1,2,3,4,5,6,7,8,9,10,11,12], startDate: '' })
    mutateStaff()
    mutate()
  }

 const handleDeleteStaff = async (id: string) => {
  await deleteStaffMember(id)
  mutateStaff()
  mutate()
  }

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    await toggleStaffActive(id, !currentActive)
    mutateStaff()
    mutate()
  }

  const handleUpdateStartDate = async (id: string, startDate: string) => {
    await updateStaffStartDate(id, startDate || null)
    mutateStaff()
  }

  const handleUpdateEndDate = async (id: string, endDate: string) => {
    await updateStaffEndDate(id, endDate || null)
    mutateStaff()
  }

  const handleSaveSalaryChange = async (id: string) => {
    const amount = Number(salaryAmount)
    if (!salaryFrom || !(amount > 0)) return
    setSavingSalary(true)
    try {
      await addStaffSalaryChange(id, salaryFrom, amount)
      setSalaryEditId(null)
      setSalaryFrom('')
      setSalaryAmount('')
      mutateStaff()
      mutate()
    } finally {
      setSavingSalary(false)
    }
  }

  const handleRemoveSalaryChange = async (id: string, from: string) => {
    await removeStaffSalaryChange(id, from)
    mutateStaff()
    mutate()
  }

  const handleToggleRegular = async (id: string, current: boolean) => {
    await setStaffRegularEmployee(id, !current)
    mutateStaff()
  }

  // Cikel vrste zaposlitve: redno -> pogodbeno -> študent na praksi -> redno.
  const handleCycleEmployment = async (id: string, isRegular: boolean, employmentType: string) => {
    const current: 'regular' | 'contract' | 'stagiaire' =
      isRegular ? 'regular' : employmentType === 'stagiaire' ? 'stagiaire' : 'contract'
    const next: 'regular' | 'contract' | 'stagiaire' =
      current === 'regular' ? 'contract' : current === 'contract' ? 'stagiaire' : 'regular'
    await setStaffEmploymentType(id, next)
    mutateStaff()
  }

  const handleStartEdit = (staff: NonNullable<typeof allStaff>[number]) => {
    setEditingStaff(staff.id)
    setEditForm({
      staffType: staff.staffType || 'other',
      staffName: staff.staffName || '',
      monthlySalary: String(staff.monthlySalary ?? ''),
      allocateTo: staff.allocateTo || 'management',
      activeMonths: staff.activeMonths?.length ? staff.activeMonths : [1,2,3,4,5,6,7,8,9,10,11,12],
      startDate: staff.startDate ? staff.startDate.split('T')[0] : '',
      endDate: staff.endDate ? String(staff.endDate).slice(0, 10) : '',
    })
  }

  const handleCancelEdit = () => {
    setEditingStaff(null)
  }

  const handleSaveEdit = async (id: string) => {
    if (!editForm.staffName || !editForm.monthlySalary) return
    setSavingEdit(true)
    try {
      await upsertStaffMember({
        id,
        staffType: editForm.staffType,
        staffName: editForm.staffName,
        monthlySalary: Number(editForm.monthlySalary),
        allocateTo: editForm.allocateTo,
        activeMonths: editForm.activeMonths,
        startDate: editForm.startDate || null,
      })
      await updateStaffEndDate(id, editForm.endDate || null)
      setEditingStaff(null)
      mutateStaff()
      mutate()
    } finally {
      setSavingEdit(false)
    }
  }

  const handleToggleEditMonth = (monthNum: number) => {
    setEditForm(s => ({
      ...s,
      activeMonths: s.activeMonths.includes(monthNum)
        ? s.activeMonths.filter(m => m !== monthNum)
        : [...s.activeMonths, monthNum].sort((a,b) => a-b),
    }))
  }
  
  const handleToggleMonth = (monthNum: number) => {
    setNewStaff(s => ({
      ...s,
      activeMonths: s.activeMonths.includes(monthNum) 
        ? s.activeMonths.filter(m => m !== monthNum)
        : [...s.activeMonths, monthNum].sort((a,b) => a-b)
    }))
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-[#0a2029] flex items-center justify-center">
        <div className="animate-pulse text-white/50">Nalagam statistiko...</div>
      </div>
    )
  }

  const profitColor = stats.profit >= 0 ? 'text-[#8fae92]' : 'text-[#c8846b]'
  const ProfitIcon = stats.profit >= 0 ? TrendingUp : TrendingDown

  return (
    <div className="min-h-screen bg-[#0a2029] text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-[#0b2731]">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link href="/" className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-white/60 hover:text-white">
                <ArrowLeft className="h-4 w-4" />
                <span className="text-sm">Nazaj</span>
              </Link>
              <div className="flex items-center gap-2">
                {activeTab === 'kadri'
                  ? <UserCog className="h-5 w-5 shrink-0 text-[#8fae92]" />
                  : <BarChart3 className="h-5 w-5 shrink-0 text-[#7fa8b8]" />}
                <div>
                  <h1 className="text-xl font-bold text-[#c59b5b]">
                    {activeTab === 'kadri' ? 'Kadrovski oddelek' : 'Kalkulacije'}
                  </h1>
                  <p className="text-white/40 text-sm hidden sm:block">
                    {activeTab === 'kadri'
                      ? 'Osebje, obračun plač, razporedi in registri'
                      : 'Mesečni pregled prihodkov in stroškov'}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Month/Year Selector */}
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="flex-1 sm:flex-none px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm"
              >
                {MONTHS.map((m, i) => (
                  <option key={i} value={i + 1} className="bg-[#0b2731]">{m}</option>
                ))}
              </select>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm"
              >
                {[2024, 2025, 2026, 2027].map(y => (
                  <option key={y} value={y} className="bg-[#0b2731]">{y}</option>
                ))}
              </select>
            </div>
          </div>
          
          {/* No section switcher here on purpose: Kalkulacije and Kadrovski
              oddelek are separate entries in the personal menu, so offering both
              inside the page duplicated that navigation. The ?tab= param decides. */}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        
        {/* TAB: KALKULACIJE */}
        {activeTab === 'kalkulacije' && (
          <div className="space-y-6">
          {/* Sub-toggle: Pregled / Nastavitve */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setKalkulacijeView('pregled')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                kalkulacijeView === 'pregled'
                  ? 'bg-[#7fa8b8]/20 text-[#7fa8b8] border border-[#7fa8b8]/30'
                  : 'bg-white/5 text-white/60 hover:bg-white/10'
              }`}
            >
              <BarChart3 className="h-4 w-4" />
              Pregled
            </button>
            <button
              onClick={() => setKalkulacijeView('prevozniki')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                kalkulacijeView === 'prevozniki'
                  ? 'bg-[#8fae92]/20 text-[#8fae92] border border-[#8fae92]/30'
                  : 'bg-white/5 text-white/60 hover:bg-white/10'
              }`}
            >
              <Ship className="h-4 w-4" />
              Prevozniki
            </button>
            <button
              onClick={() => setKalkulacijeView('marketing')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                kalkulacijeView === 'marketing'
                  ? 'bg-[#c59b5b]/20 text-[#c59b5b] border border-[#c59b5b]/30'
                  : 'bg-white/5 text-white/60 hover:bg-white/10'
              }`}
            >
              <Megaphone className="h-4 w-4" />
              Stroški
            </button>
            <button
              onClick={() => setKalkulacijeView('nastavitve')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                kalkulacijeView === 'nastavitve'
                  ? 'bg-[#c59b5b]/20 text-[#c59b5b] border border-[#c59b5b]/30'
                  : 'bg-white/5 text-white/60 hover:bg-white/10'
              }`}
            >
              <Settings className="h-4 w-4" />
              Nastavitve
            </button>
            <button
              onClick={() => setKalkulacijeView('finance')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                kalkulacijeView === 'finance'
                  ? 'bg-[#c59b5b]/20 text-[#c59b5b] border border-[#c59b5b]/30'
                  : 'bg-white/5 text-white/60 hover:bg-white/10'
              }`}
            >
              <Landmark className="h-4 w-4" />
              Finance
            </button>
          </div>

          {kalkulacijeView === 'pregled' && (
          <>
            {/* Payroll contribution deadlines moved to the Kadrovski oddelek tab —
                they are an HR obligation, not a calculation. */}

            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
              <div className="p-3 sm:p-4 rounded-2xl bg-white/[0.03] border border-white/10">
                <div className="flex items-center gap-2 text-white/40 text-xs uppercase tracking-wider mb-1 sm:mb-2">
                  <Users className="h-3 w-3 sm:h-4 sm:w-4" />
                  Gostov
                </div>
                <p className="text-xl sm:text-2xl font-bold text-white">{stats.guests}</p>
              </div>
              <div className="p-3 sm:p-4 rounded-2xl bg-white/[0.03] border border-white/10">
                <div className="flex items-center gap-2 text-white/40 text-xs uppercase tracking-wider mb-1 sm:mb-2">
                  <Moon className="h-3 w-3 sm:h-4 sm:w-4" />
                  Nočitev
                </div>
                <p className="text-xl sm:text-2xl font-bold text-white">{stats.nights}</p>
              </div>
              <div className="p-3 sm:p-4 rounded-2xl bg-white/[0.03] border border-white/10">
                <div className="flex items-center gap-2 text-white/40 text-xs uppercase tracking-wider mb-1 sm:mb-2">
                  <Euro className="h-3 w-3 sm:h-4 sm:w-4" />
                  Prihodki
                </div>
                <p className="text-lg sm:text-2xl font-bold text-[#7fa8b8]">{formatEur(stats.revenue.total)}</p>
              </div>
              <div className="p-3 sm:p-4 rounded-2xl bg-white/[0.03] border border-white/10">
                <div className="flex items-center gap-2 text-white/40 text-xs uppercase tracking-wider mb-1 sm:mb-2">
                  <ProfitIcon className="h-3 w-3 sm:h-4 sm:w-4" />
                  Dobiček
                </div>
                <p className={`text-lg sm:text-2xl font-bold ${profitColor}`}>{formatEur(stats.profit)}</p>
              </div>
            </div>

            <div className="space-y-6">
              {/* NOČITVE */}
              <div className="p-4 sm:p-6 rounded-2xl bg-white/[0.03] border border-white/10">
                <h2 className="text-base sm:text-lg font-bold text-[#c59b5b] mb-4">NOČITVE</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8">
                  <div>
                    <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Prihodki</p>
                    <p className="text-xl sm:text-2xl font-bold text-[#7fa8b8]">{formatEur(stats.revenue.accommodation)}</p>
                  </div>
                  <div>
                    <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Stroški</p>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-white/50">Plače (vrtnar, sobarica)</span>
                        <span className="text-white">{formatEur((stats.salaryBreakdown as { accommodation?: number })?.accommodation || 0)}</span>
                      </div>
                      <MarketingOverviewRow year={year} month={month} category="marketing" label="Marketing" amount={(stats.costs as { marketing?: number }).marketing || 0} />
                      {/* Provizija prodajnih platform: Booking + Optima plus */}
                      <div className="pt-1">
                        <p className="text-[11px] uppercase tracking-wider text-white/35 mb-1">Provizija prodajnih platform</p>
                        <div className="ml-1 space-y-2">
                          <MarketingOverviewRow year={year} month={month} category="booking" label="Booking" amount={(stats.costs as { booking?: number }).booking || 0} />
                          <MarketingOverviewRow year={year} month={month} category="optimaplus" label="Optima plus" amount={(stats.costs as { optimaplus?: number }).optimaplus || 0} />
                        </div>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-white/50">Starlink</span>
                        <span className="text-white">{formatEur((stats.costs as { starlink?: number }).starlink || 0)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-white/50">Računi nabava Nočitve</span>
                        <span className="text-white">{formatEur((stats.costs as { receiptsNocitve?: number }).receiptsNocitve || 0)}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-white/10 flex flex-col sm:flex-row sm:justify-between gap-1">
                  <span className="text-white/70 font-medium">Dobiček nočitev</span>
                  <span className="text-[#8fae92] font-bold">{formatEur(stats.revenue.accommodation - ((stats.salaryBreakdown as { accommodation?: number })?.accommodation || 0) - ((stats.costs as { platformCommission?: number }).platformCommission || 0) - ((stats.costs as { marketing?: number }).marketing || 0) - ((stats.costs as { starlink?: number }).starlink || 0) - ((stats.costs as { receiptsNocitve?: number }).receiptsNocitve || 0))}</span>
                </div>
              </div>

              {/* BAR (samo pijača) */}
              <div className="p-4 sm:p-6 rounded-2xl bg-white/[0.03] border border-white/10">
                <h2 className="text-base sm:text-lg font-bold text-[#c59b5b] mb-4">BAR</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8">
                  <div>
                    <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Prihodki</p>
                    <p className="text-xl sm:text-2xl font-bold text-[#7fa8b8]">{formatEur(stats.revenue.bar.pijaca)}</p>
                  </div>
                  <div>
                    <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Stroški</p>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-white/50">Nabava pijača ({stats.costSettings?.find(c => c.category === 'bar_pijaca')?.value || 0}%)</span>
                        <span className="text-white">{formatEur(stats.costs.barPijaca)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-white/50">Plače (barman)</span>
                        <span className="text-white">{formatEur((stats.salaryBreakdown as { bar?: number })?.bar || 0)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-white/50">Računi nabava Bar</span>
                        <span className="text-white">{formatEur((stats.costs as { receiptsBar?: number }).receiptsBar || 0)}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-white/10 flex flex-col sm:flex-row sm:justify-between gap-1">
                  <span className="text-white/70 font-medium">Dobiček bar</span>
                  <span className="text-[#8fae92] font-bold">{formatEur(stats.revenue.bar.pijaca - stats.costs.barPijaca - ((stats.salaryBreakdown as { bar?: number })?.bar || 0) - ((stats.costs as { receiptsBar?: number }).receiptsBar || 0))}</span>
                </div>
              </div>

              {/* PRODAJA BAR — po artiklih (koliko katerega artikla se je prodalo) */}
              {(() => {
                const sales = ((stats as { barProductSales?: Array<{ name: string; category: string; costCategory: string; quantity: number; revenueEur: number; freeQuantity: number; coveredQuantity: number }> }).barProductSales) || []
                if (sales.length === 0) return null
                const catLabels: Record<string, string> = { pijaca: 'Pijača', prehrana: 'Prehrana', wellness: 'Wellness', ostalo: 'Ostalo' }
                const order = ['pijaca', 'prehrana', 'wellness', 'ostalo']
                const groups = order
                  .map(cc => ({ cc, items: sales.filter(s => s.costCategory === cc) }))
                  .filter(g => g.items.length > 0)
                const known = new Set(order)
                const leftover = sales.filter(s => !known.has(s.costCategory))
                if (leftover.length > 0) groups.push({ cc: 'ostalo', items: [...(groups.find(g => g.cc === 'ostalo')?.items || []), ...leftover].filter((v, i, a) => a.indexOf(v) === i) })
                const totalQty = sales.reduce((s, i) => s + i.quantity, 0)
                const totalRev = sales.reduce((s, i) => s + i.revenueEur, 0)
                const totalFree = sales.reduce((s, i) => s + i.freeQuantity, 0)
                return (
                  <div className="p-4 sm:p-6 rounded-2xl bg-white/[0.03] border border-white/10">
                    <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                      <h2 className="text-base sm:text-lg font-bold text-[#c59b5b]">PRODAJA BAR — PO ARTIKLIH</h2>
                      <div className="text-sm text-white/50">Skupaj <span className="text-white font-semibold tabular-nums">{totalQty}</span> kos · <span className="text-[#7fa8b8] font-semibold tabular-nums">{formatEur(totalRev)}</span></div>
                    </div>
                    <div className="space-y-5">
                      {groups.map(g => {
                        const gQty = g.items.reduce((s, i) => s + i.quantity, 0)
                        const gRev = g.items.reduce((s, i) => s + i.revenueEur, 0)
                        return (
                          <div key={g.cc}>
                            <div className="flex justify-between items-baseline mb-2">
                              <span className="text-xs uppercase tracking-wider text-[#c59b5b]/80 font-semibold">{catLabels[g.cc] || 'Ostalo'}</span>
                              <span className="text-xs text-white/40 tabular-nums">{gQty} kos · {formatEur(gRev)}</span>
                            </div>
                            <div className="rounded-xl overflow-hidden border border-white/5">
                              {g.items.map((it, idx) => (
                                <div key={it.name + idx} className={`flex items-center gap-3 px-3 py-2 ${idx % 2 === 0 ? 'bg-white/[0.02]' : ''}`}>
                                  <span className="text-sm font-bold text-white tabular-nums w-10 text-right shrink-0">{it.quantity}×</span>
                                  <span className="text-sm text-white/80 truncate flex-1 min-w-0">
                                    {it.name}
                                    {it.freeQuantity > 0 && <span className="ml-2 text-xs text-[#8fae92] whitespace-nowrap">{it.freeQuantity} On House</span>}
                                  </span>
                                  <span className="text-sm text-[#7fa8b8] font-medium tabular-nums whitespace-nowrap shrink-0">{formatEur(it.revenueEur)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    {totalFree > 0 && (
                      <p className="mt-4 text-xs text-white/40 text-pretty">Časne (On House) postavke so vštete v količino &quot;prodano&quot;, a ne prinašajo prihodka.</p>
                    )}
                  </div>
                )
              })()}

              {/* KUHINJA (prehrana iz bara + meal plan predplačilo) */}
              <div className="p-4 sm:p-6 rounded-2xl bg-white/[0.03] border border-white/10">
                <h2 className="text-base sm:text-lg font-bold text-[#c59b5b] mb-4">KUHINJA</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8">
                  <div>
                    <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Prihodki</p>
                    <p className="text-xl sm:text-2xl font-bold text-[#7fa8b8]">{formatEur(stats.revenue.bar.prehrana + stats.revenue.mealPlan)}</p>
                    <div className="mt-2 space-y-1 text-sm">
                      <div className="flex justify-between text-white/50">
                        <span>- Prehrana (bar)</span>
                        <span>{formatEur(stats.revenue.bar.prehrana)}</span>
                      </div>
                      <div className="flex justify-between text-white/50">
                        <span>- Predplačilo (meal plan)</span>
                        <span>{formatEur(stats.revenue.mealPlan)}</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Stroški</p>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-white/50">Nabava hrana ({stats.costSettings?.find(c => c.category === 'bar_prehrana')?.value || 0}%)</span>
                        <span className="text-white">{formatEur(stats.costs.barPrehrana + ((stats.costs as { mealPlan?: number }).mealPlan || 0))}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-white/50">Računi nabava Kuhinja</span>
                        <span className="text-white">{formatEur((stats.costs as { receiptsKuhinja?: number }).receiptsKuhinja || 0)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-white/50">Plače (kuhinja)</span>
                        <span className="text-white">{formatEur((stats.salaryBreakdown as { kuhinja?: number })?.kuhinja || 0)}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-white/10 flex flex-col sm:flex-row sm:justify-between gap-1">
                  <span className="text-white/70 font-medium">Dobiček kuhinja</span>
                  <span className="text-[#8fae92] font-bold">{formatEur(stats.revenue.bar.prehrana + stats.revenue.mealPlan - stats.costs.barPrehrana - ((stats.costs as { mealPlan?: number }).mealPlan || 0) - ((stats.costs as { receiptsKuhinja?: number }).receiptsKuhinja || 0) - ((stats.salaryBreakdown as { kuhinja?: number })?.kuhinja || 0))}</span>
                </div>
              </div>

              {/* PREVOZI */}
              {(() => {
                const carriers = (stats as { transferCarriers?: { dilip: { revenue: number; cost: number; profit: number }; herman: { revenue: number; cost: number; profit: number } } }).transferCarriers
                const dilip = carriers?.dilip ?? { revenue: 0, cost: 0, profit: 0 }
                const herman = carriers?.herman ?? { revenue: 0, cost: 0, profit: 0 }
                const totalCost = (stats.costs as { transfers?: number }).transfers || 0
                const totalProfit = stats.revenue.transfers - totalCost
                return (
              <div className="p-4 sm:p-6 rounded-2xl bg-white/[0.03] border border-white/10">
                <h2 className="text-base sm:text-lg font-bold text-[#c59b5b] mb-4">PREVOZI</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8">
                  <div>
                    <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Prihodki</p>
                    <p className="text-xl sm:text-2xl font-bold text-[#7fa8b8]">{formatEur(stats.revenue.transfers)}</p>
                  </div>
                  <div>
                    <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Stroški</p>
                    <div className="flex justify-between text-sm">
                      <span className="text-white/50">Dobavitelj prevozov</span>
                      <span className="text-white">{formatEur(totalCost)}</span>
                    </div>
                  </div>
                </div>

                {/* Zaslužek ločeno po prevozniku */}
                <div className="mt-4 pt-4 border-t border-white/10 space-y-3">
                  <p className="text-white/40 text-xs uppercase tracking-wider">Zaslužek po prevozniku</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10">
                      <p className="text-white/70 text-sm font-medium mb-2">Dilip (čoln)</p>
                      <div className="flex justify-between text-xs text-white/50"><span>Prihodki</span><span className="text-white/80">{formatEur(dilip.revenue)}</span></div>
                      <div className="flex justify-between text-xs text-white/50"><span>Stroški</span><span className="text-white/80">{formatEur(dilip.cost)}</span></div>
                      <div className="flex justify-between text-sm font-semibold mt-1 pt-1 border-t border-white/10"><span className="text-white/70">Dobiček</span><span className="text-[#8fae92]">{formatEur(dilip.profit)}</span></div>
                    </div>
                    <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10">
                      <p className="text-white/70 text-sm font-medium mb-2">Herman (avto)</p>
                      <div className="flex justify-between text-xs text-white/50"><span>Prihodki</span><span className="text-white/80">{formatEur(herman.revenue)}</span></div>
                      <div className="flex justify-between text-xs text-white/50"><span>Stroški</span><span className="text-white/80">{formatEur(herman.cost)}</span></div>
                      <div className="flex justify-between text-sm font-semibold mt-1 pt-1 border-t border-white/10"><span className="text-white/70">Dobiček</span><span className="text-[#8fae92]">{formatEur(herman.profit)}</span></div>
                    </div>
                  </div>
                </div>

                {(() => {
                  const rows = (stats.guestBreakdown || [])
                    .filter((g: { revenue: { transfers: number }; costs: { transfers?: number } }) => (g.revenue.transfers || 0) > 0 || (g.costs.transfers || 0) > 0)
                    .sort((a: { revenue: { transfers: number } }, b: { revenue: { transfers: number } }) => (b.revenue.transfers || 0) - (a.revenue.transfers || 0))
                  if (rows.length === 0) return null
                  return (
                    <div className="mt-4 pt-4 border-t border-white/10">
                      <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Specifikacija po gostih</p>
                      <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto] gap-x-6 gap-y-1 text-xs">
                        <span className="text-white/40">Gost</span>
                        <span className="text-white/40 text-right">Prihodek</span>
                        <span className="text-white/40 text-right">Strošek</span>
                        <span className="text-white/40 text-right">Dobiček</span>
                        {rows.map((g: { reservationId: string; guestName: string; bungalow: string; revenue: { transfers: number }; costs: { transfers?: number } }) => {
                          const rev = g.revenue.transfers || 0
                          const cost = g.costs.transfers || 0
                          return (
                            <React.Fragment key={g.reservationId}>
                              <span className="text-white/80 truncate">{g.guestName}<span className="text-white/30"> · {bungalowDisplayName(g.bungalow)}</span></span>
                              <span className="text-white/80 text-right tabular-nums">{formatEur(rev)}</span>
                              <span className="text-white/60 text-right tabular-nums">{formatEur(cost)}</span>
                              <span className="text-[#8fae92] text-right tabular-nums">{formatEur(rev - cost)}</span>
                            </React.Fragment>
                          )
                        })}
                      </div>
                      <div className="sm:hidden space-y-2">
                        {rows.map((g: { reservationId: string; guestName: string; bungalow: string; revenue: { transfers: number }; costs: { transfers?: number } }) => {
                          const rev = g.revenue.transfers || 0
                          const cost = g.costs.transfers || 0
                          return (
                            <div key={g.reservationId} className="rounded-lg bg-white/[0.02] border border-white/5 px-3 py-2 text-xs">
                              <p className="text-white/80 font-medium">{g.guestName}<span className="text-white/30"> · {bungalowDisplayName(g.bungalow)}</span></p>
                              <div className="flex justify-between mt-1 text-white/60"><span>Prihodek</span><span className="tabular-nums text-white/80">{formatEur(rev)}</span></div>
                              <div className="flex justify-between text-white/60"><span>Strošek</span><span className="tabular-nums">{formatEur(cost)}</span></div>
                              <div className="flex justify-between text-white/60"><span>Dobiček</span><span className="tabular-nums text-[#8fae92]">{formatEur(rev - cost)}</span></div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}
                <div className="mt-4 pt-4 border-t border-white/10 flex flex-col sm:flex-row sm:justify-between gap-1">
                  <span className="text-white/70 font-medium">Dobiček prevozi (skupaj)</span>
                  <span className="text-[#8fae92] font-bold">{formatEur(totalProfit)}</span>
                </div>
              </div>
                )
              })()}

              {/* IZLETI */}
              <div className="p-4 sm:p-6 rounded-2xl bg-white/[0.03] border border-white/10">
                <h2 className="text-base sm:text-lg font-bold text-[#c59b5b] mb-4">IZLETI</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8">
                  <div>
                    <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Prihodki</p>
                    <p className="text-xl sm:text-2xl font-bold text-[#7fa8b8]">{formatEur(stats.revenue.excursions)}</p>
                  </div>
                  <div>
                    <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Stroški</p>
                    <div className="flex justify-between text-sm">
                      <span className="text-white/50">Najem čolnov + vodič + vstop + kosilo</span>
                      <span className="text-white">{formatEur(((stats.costs as { excursions?: number }).excursions || 0) - ((stats.costs as { izletGotovina?: number }).izletGotovina || 0))}</span>
                    </div>
                    {((stats.costs as { izletGotovina?: number }).izletGotovina || 0) > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-white/50">Plačilo dobavitelju (gotovina)</span>
                        <span className="text-white">{formatEur((stats.costs as { izletGotovina?: number }).izletGotovina || 0)}</span>
                      </div>
                    )}
                  </div>
                </div>
                {(() => {
                  const rows = (stats.guestBreakdown || [])
                    .filter((g: { revenue: { excursions: number }; costs: { excursions?: number } }) => (g.revenue.excursions || 0) > 0 || (g.costs.excursions || 0) > 0)
                    .sort((a: { revenue: { excursions: number } }, b: { revenue: { excursions: number } }) => (b.revenue.excursions || 0) - (a.revenue.excursions || 0))
                  if (rows.length === 0) return null
                  return (
                    <div className="mt-4 pt-4 border-t border-white/10">
                      <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Specifikacija po gostih</p>
                      <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto] gap-x-6 gap-y-1 text-xs">
                        <span className="text-white/40">Gost</span>
                        <span className="text-white/40 text-right">Prihodek</span>
                        <span className="text-white/40 text-right">Strošek</span>
                        <span className="text-white/40 text-right">Dobiček</span>
                        {rows.map((g: { reservationId: string; guestName: string; bungalow: string; revenue: { excursions: number }; costs: { excursions?: number } }) => {
                          const rev = g.revenue.excursions || 0
                          const cost = g.costs.excursions || 0
                          return (
                            <React.Fragment key={g.reservationId}>
                              <span className="text-white/80 truncate">{g.guestName}<span className="text-white/30"> · {bungalowDisplayName(g.bungalow)}</span></span>
                              <span className="text-white/80 text-right tabular-nums">{formatEur(rev)}</span>
                              <span className="text-white/60 text-right tabular-nums">{formatEur(cost)}</span>
                              <span className="text-[#8fae92] text-right tabular-nums">{formatEur(rev - cost)}</span>
                            </React.Fragment>
                          )
                        })}
                      </div>
                      <div className="sm:hidden space-y-2">
                        {rows.map((g: { reservationId: string; guestName: string; bungalow: string; revenue: { excursions: number }; costs: { excursions?: number } }) => {
                          const rev = g.revenue.excursions || 0
                          const cost = g.costs.excursions || 0
                          return (
                            <div key={g.reservationId} className="rounded-lg bg-white/[0.02] border border-white/5 px-3 py-2 text-xs">
                              <p className="text-white/80 font-medium">{g.guestName}<span className="text-white/30"> · {bungalowDisplayName(g.bungalow)}</span></p>
                              <div className="flex justify-between mt-1 text-white/60"><span>Prihodek</span><span className="tabular-nums text-white/80">{formatEur(rev)}</span></div>
                              <div className="flex justify-between text-white/60"><span>Strošek</span><span className="tabular-nums">{formatEur(cost)}</span></div>
                              <div className="flex justify-between text-white/60"><span>Dobiček</span><span className="tabular-nums text-[#8fae92]">{formatEur(rev - cost)}</span></div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}
                <div className="mt-4 pt-4 border-t border-white/10 flex flex-col sm:flex-row sm:justify-between gap-1">
                  <span className="text-white/70 font-medium">Dobiček izleti</span>
                  <span className="text-[#8fae92] font-bold">{formatEur(stats.revenue.excursions - ((stats.costs as { excursions?: number }).excursions || 0))}</span>
                </div>
              </div>

              {/* WELLNESS */}
              <div className="p-4 sm:p-6 rounded-2xl bg-white/[0.03] border border-white/10">
                <h2 className="text-base sm:text-lg font-bold text-[#c59b5b] mb-4">WELLNESS</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8">
                  <div>
                    <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Prihodki</p>
                    <p className="text-xl sm:text-2xl font-bold text-[#7fa8b8]">{formatEur(stats.revenue.wellness)}</p>
                  </div>
                  <div>
                    <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Stroški</p>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-white/50">Maserke ({stats.costSettings?.find(c => c.category === 'wellness')?.value || 0} EUR/kos)</span>
                        <span className="text-white">{formatEur(stats.costs.wellness)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-white/50">Plačilo maserki (gotovina)</span>
                        <span className="text-white">{formatEur((stats.costs as { receiptsWellness?: number }).receiptsWellness || 0)}</span>
                      </div>
                    </div>
                  </div>
                </div>
                {(() => {
                  const rows = (stats.guestBreakdown || [])
                    .filter((g: { revenue: { wellness: number }; costs: { wellness?: number }; wellnessCount?: number }) => (g.revenue.wellness || 0) > 0 || (g.wellnessCount || 0) > 0)
                    .sort((a: { revenue: { wellness: number } }, b: { revenue: { wellness: number } }) => (b.revenue.wellness || 0) - (a.revenue.wellness || 0))
                  if (rows.length === 0) return null
                  return (
                    <div className="mt-4 pt-4 border-t border-white/10">
                      <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Specifikacija po gostih</p>
                      <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-6 gap-y-1 text-xs">
                        <span className="text-white/40">Gost</span>
                        <span className="text-white/40 text-right">Kom.</span>
                        <span className="text-white/40 text-right">Prihodek</span>
                        <span className="text-white/40 text-right">Strošek</span>
                        <span className="text-white/40 text-right">Dobiček</span>
                        {rows.map((g: { reservationId: string; guestName: string; bungalow: string; revenue: { wellness: number }; costs: { wellness?: number }; wellnessCount?: number }) => {
                          const rev = g.revenue.wellness || 0
                          const cost = g.costs.wellness || 0
                          return (
                            <React.Fragment key={g.reservationId}>
                              <span className="text-white/80 truncate">{g.guestName}<span className="text-white/30"> · {bungalowDisplayName(g.bungalow)}</span></span>
                              <span className="text-white/60 text-right tabular-nums">{g.wellnessCount || 0}</span>
                              <span className="text-white/80 text-right tabular-nums">{formatEur(rev)}</span>
                              <span className="text-white/60 text-right tabular-nums">{formatEur(cost)}</span>
                              <span className="text-[#8fae92] text-right tabular-nums">{formatEur(rev - cost)}</span>
                            </React.Fragment>
                          )
                        })}
                      </div>
                      <div className="sm:hidden space-y-2">
                        {rows.map((g: { reservationId: string; guestName: string; bungalow: string; revenue: { wellness: number }; costs: { wellness?: number }; wellnessCount?: number }) => {
                          const rev = g.revenue.wellness || 0
                          const cost = g.costs.wellness || 0
                          return (
                            <div key={g.reservationId} className="rounded-lg bg-white/[0.02] border border-white/5 px-3 py-2 text-xs">
                              <p className="text-white/80 font-medium">{g.guestName}<span className="text-white/30"> · {bungalowDisplayName(g.bungalow)}</span></p>
                              <div className="flex justify-between mt-1 text-white/60"><span>Masaže (kom.)</span><span className="tabular-nums text-white/80">{g.wellnessCount || 0}</span></div>
                              <div className="flex justify-between text-white/60"><span>Prihodek</span><span className="tabular-nums text-white/80">{formatEur(rev)}</span></div>
                              <div className="flex justify-between text-white/60"><span>Strošek</span><span className="tabular-nums">{formatEur(cost)}</span></div>
                              <div className="flex justify-between text-white/60"><span>Dobiček</span><span className="tabular-nums text-[#8fae92]">{formatEur(rev - cost)}</span></div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}
                <div className="mt-4 pt-4 border-t border-white/10 flex flex-col sm:flex-row sm:justify-between gap-1">
                  <span className="text-white/70 font-medium">Dobiček wellness</span>
                  <span className="text-[#8fae92] font-bold">{formatEur(stats.revenue.wellness - stats.costs.wellness - ((stats.costs as { receiptsWellness?: number }).receiptsWellness || 0))}</span>
                </div>
              </div>

              {/* OSTALO */}
              <div className="p-4 sm:p-6 rounded-2xl bg-white/[0.03] border border-white/10">
                <h2 className="text-base sm:text-lg font-bold text-[#c59b5b] mb-4">OSTALO (pranje, trgovina)</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8">
                  <div>
                    <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Prihodki</p>
                    <p className="text-xl sm:text-2xl font-bold text-[#7fa8b8]">{formatEur(stats.revenue.ostalo)}</p>
                  </div>
                  <div>
                    <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Stroški</p>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-white/50">Nabavna cena + pranje ({stats.costSettings?.find(c => c.category === 'ostalo')?.value || 0}%)</span>
                        <span className="text-white">{formatEur(stats.costs.ostalo)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-white/50">Računi ostalo</span>
                        <span className="text-white">{formatEur((stats.costs as { receiptsOstalo?: number }).receiptsOstalo || 0)}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-white/10 flex flex-col sm:flex-row sm:justify-between gap-1">
                  <span className="text-white/70 font-medium">Dobiček ostalo</span>
                  <span className="text-[#8fae92] font-bold">{formatEur(stats.revenue.ostalo - stats.costs.ostalo - ((stats.costs as { receiptsOstalo?: number }).receiptsOstalo || 0))}</span>
                </div>
              </div>

              {/* OSNOVNA SREDSTVA (amortizacija) */}
              {((stats.costs as { depreciation?: number }).depreciation || 0) > 0 && (
                <div className="p-4 sm:p-6 rounded-2xl bg-white/[0.03] border border-white/10">
                  <h2 className="text-base sm:text-lg font-bold text-[#c59b5b] mb-4">OSNOVNA SREDSTVA (amortizacija)</h2>
                  <div className="space-y-2">
                    {((stats.costs as { depreciationItems?: { id: string; name: string; monthlyEur: number }[] }).depreciationItems || []).map((it) => (
                      <div key={it.id} className="flex justify-between text-sm">
                        <span className="text-white/50">{it.name}</span>
                        <span className="text-white">{formatEur(it.monthlyEur)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t border-white/10 flex flex-col sm:flex-row sm:justify-between gap-1">
                    <span className="text-white/70 font-medium">Mesečna amortizacija skupaj</span>
                    <span className="text-[#c8846b] font-bold">{formatEur((stats.costs as { depreciation?: number }).depreciation || 0)}</span>
                  </div>
                </div>
              )}

              {/* REPREZENTANCA (kava, pijača v lokalu) */}
              {((stats.costs as { receiptsReprezentanca?: number }).receiptsReprezentanca || 0) > 0 && (
                <div className="p-4 sm:p-6 rounded-2xl bg-white/[0.03] border border-white/10">
                  <h2 className="text-base sm:text-lg font-bold text-[#c8846b] mb-4">REPREZENTANCA (kava, pijača v lokalu)</h2>
                  <p className="text-white/40 text-xs mb-3">Samostojen strošek podjetja — ne bremeni oddelkov, znižuje skupni dobiček.</p>
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                    <span className="text-white/50">Računi reprezentanca</span>
          <span className="text-[#c8846b] font-bold">{formatEur((stats.costs as { receiptsReprezentanca?: number }).receiptsReprezentanca || 0)}</span>
              </div>
            </div>
          )}

          {/* TEKOČE VZDRŽEVANJE NEPREMIČNIN */}
          {((stats.costs as { receiptsVzdrzevanje?: number }).receiptsVzdrzevanje || 0) > 0 && (
            <div className="p-4 sm:p-6 rounded-2xl bg-white/[0.03] border border-white/10">
              <h2 className="text-base sm:text-lg font-bold text-[#a3a36b] mb-4">TEKOČE VZDRŽEVANJE NEPREMIČNIN</h2>
              <p className="text-white/40 text-xs mb-3">Samostojen strošek — ne bremeni oddelkov, znižuje skupni poslovni rezultat.</p>
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                <span className="text-white/50">Računi vzdrževanje nepremičnin</span>
                <span className="text-[#a3a36b] font-bold">{formatEur((stats.costs as { receiptsVzdrzevanje?: number }).receiptsVzdrzevanje || 0)}</span>
              </div>
            </div>
          )}

          {/* NAJEMNINA HIŠA — samostojen strošek (Nabava Komba) */}
          {((stats.costs as { najemninaHisa?: number }).najemninaHisa || 0) > 0 && (
            <div className="p-4 sm:p-6 rounded-2xl bg-white/[0.03] border border-white/10">
              <h2 className="text-base sm:text-lg font-bold text-[#b07a9a] mb-4">NAJEMNINA HIŠA</h2>
              <p className="text-white/40 text-xs mb-3">Samostojen strošek — ne bremeni oddelkov, znižuje skupni poslovni rezultat.</p>
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                <span className="text-white/50">Najemnina hiša (gotovina, Nabava Komba)</span>
                <span className="text-[#b07a9a] font-bold">{formatEur((stats.costs as { najemninaHisa?: number }).najemninaHisa || 0)}</span>
              </div>
            </div>
          )}

          {/* ŠTIPENDIJA — šolnina, samostojen strošek */}
          {((stats.costs as { stipendija?: number }).stipendija || 0) > 0 && (
            <div className="p-4 sm:p-6 rounded-2xl bg-white/[0.03] border border-white/10">
              <h2 className="text-base sm:text-lg font-bold text-[#6d5a8a] mb-4">ŠTIPENDIJA</h2>
              <p className="text-white/40 text-xs mb-3">Šolnina. Samostojen strošek — ne bremeni oddelkov, znižuje skupni poslovni rezultat.</p>
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                <span className="text-white/50">Štipendija (gotovina)</span>
                <span className="text-[#6d5a8a] font-bold">{formatEur((stats.costs as { stipendija?: number }).stipendija || 0)}</span>
              </div>
            </div>
          )}

          {/* RAČUNOVODSTVO — samostojen strošek z Nabave HV */}
          {((stats.costs as { racunovodstvo?: number }).racunovodstvo || 0) > 0 && (
            <div className="p-4 sm:p-6 rounded-2xl bg-white/[0.03] border border-white/10">
              <h2 className="text-base sm:text-lg font-bold text-[#3d5c78] mb-4">RAČUNOVODSTVO</h2>
              <p className="text-white/40 text-xs mb-3">Samostojen strošek — ne bremeni oddelkov, znižuje skupni poslovni rezultat.</p>
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                <span className="text-white/50">Računovodstvo (gotovina ali Orange Money)</span>
                <span className="text-[#3d5c78] font-bold">{formatEur((stats.costs as { racunovodstvo?: number }).racunovodstvo || 0)}</span>
              </div>
            </div>
          )}

          {/* HRANA ZA ŠTUDENTE — samostojen strošek, ne kuhinja */}
          {((stats.costs as { hranaStudenti?: number }).hranaStudenti || 0) > 0 && (
            <div className="p-4 sm:p-6 rounded-2xl bg-white/[0.03] border border-white/10">
              <h2 className="text-base sm:text-lg font-bold text-[#c46a3a] mb-4">HRANA ZA ŠTUDENTE</h2>
              <p className="text-white/40 text-xs mb-3">Samostojen strošek — ne bremeni kuhinje ali drugih oddelkov, znižuje skupni poslovni rezultat.</p>
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                <span className="text-white/50">Hrana za študente (gotovina)</span>
                <span className="text-[#c46a3a] font-bold">{formatEur((stats.costs as { hranaStudenti?: number }).hranaStudenti || 0)}</span>
              </div>
            </div>
          )}

          {/* NOSAČI IN TUC TUC — vsak svoj samostojen strošek */}
          {(((stats.costs as { porters?: number }).porters || 0) > 0 || ((stats.costs as { tuctuc?: number }).tuctuc || 0) > 0) && (
            <div className="p-4 sm:p-6 rounded-2xl bg-white/[0.03] border border-white/10">
              <h2 className="text-base sm:text-lg font-bold text-[#8fae92] mb-4">NOSAČI IN TUC TUC</h2>
              <p className="text-white/40 text-xs mb-3">Vsak svoj strošek — zmanjšuje skupni dobiček, ne bremeni oddelkov.</p>
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                <span className="text-white/50">Nosači</span>
                <span className="text-[#8fae92] font-bold">{formatEur((stats.costs as { porters?: number }).porters || 0)}</span>
              </div>
              <div className="mt-1 flex flex-col sm:flex-row sm:justify-between gap-1">
                <span className="text-white/50">Tuc tuc</span>
                <span className="text-[#8fae92] font-bold">{formatEur((stats.costs as { tuctuc?: number }).tuctuc || 0)}</span>
              </div>
            </div>
          )}

              {/* MANAGEMENT PLAČE */}
              {(stats.salaryBreakdown?.management || 0) > 0 && (
                <div className="p-4 sm:p-6 rounded-2xl bg-white/[0.03] border border-white/10">
                  <h2 className="text-base sm:text-lg font-bold text-[#c8846b] mb-4">MANAGEMENT PLAČE</h2>
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                    <span className="text-white/50">Vodstvo (recepcija, vzdrževanje)</span>
                    <span className="text-white font-medium">{formatEur(stats.salaryBreakdown?.management || 0)}</span>
                  </div>
                </div>
              )}

              {/* SKUPAJ */}
              <div className="p-4 sm:p-6 rounded-2xl bg-gradient-to-r from-[#8fae92]/20 to-[#618865]/20 border border-[#8fae92]/30">
                <h2 className="text-base sm:text-lg font-bold text-white mb-4">SKUPAJ</h2>
                <div className="grid grid-cols-3 gap-2 sm:gap-8">
                  <div>
                    <p className="text-white/40 text-[10px] sm:text-xs uppercase tracking-wider mb-1 sm:mb-2">Prihodki</p>
                    <p className="text-base sm:text-2xl font-bold text-[#7fa8b8]">{formatEur(stats.revenue.total)}</p>
                  </div>
                  <div>
                    <p className="text-white/40 text-[10px] sm:text-xs uppercase tracking-wider mb-1 sm:mb-2">Stroški</p>
                    <p className="text-base sm:text-2xl font-bold text-[#c8846b]">{formatEur(stats.costs.total)}</p>
                  </div>
                  <div>
                    <p className="text-white/40 text-[10px] sm:text-xs uppercase tracking-wider mb-1 sm:mb-2">Dobiček</p>
                    <p className={`text-base sm:text-2xl font-bold ${profitColor}`}>{formatEur(stats.profit)}</p>
                  </div>
                </div>
              </div>

              {/* REZULTAT PO GOSTIH */}
              <GuestBreakdown guests={(stats as { guestBreakdown?: React.ComponentProps<typeof GuestBreakdown>['guests'] }).guestBreakdown || []} />
            </div>
          </>
          )}

          {kalkulacijeView === 'prevozniki' && (
            <PrevozinkiTab year={year} month={month} />
          )}

          {kalkulacijeView === 'marketing' && (
            <MarketingTab year={year} month={month} />
          )}

            {kalkulacijeView === 'finance' && (
              <div className="space-y-4">
                {/* Finance sub-toggle: Banka / Orange Money */}
                <div className="flex gap-2 overflow-x-auto pb-1">
                  <button
                    onClick={() => setFinanceView('banka')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                      financeView === 'banka'
                        ? 'bg-[#c59b5b]/20 text-[#c59b5b] border border-[#c59b5b]/30'
                        : 'bg-white/5 text-white/60 hover:bg-white/10'
                    }`}
                  >
                    <Landmark className="h-4 w-4" />
                    Banka
                  </button>
                  <button
                    onClick={() => setFinanceView('orange')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                      financeView === 'orange'
                        ? 'bg-[#ff7900]/20 text-[#d09681] border border-[#ff7900]/30'
                        : 'bg-white/5 text-white/60 hover:bg-white/10'
                    }`}
                  >
                    <Smartphone className="h-4 w-4" />
                    Orange Money
                  </button>
                  <button
                    onClick={() => setFinanceView('dnevnik')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                      financeView === 'dnevnik'
                        ? 'bg-[#c59b5b]/20 text-[#c59b5b] border border-[#c59b5b]/30'
                        : 'bg-white/5 text-white/60 hover:bg-white/10'
                    }`}
                  >
                    <BookText className="h-4 w-4" />
                    Blagajniški dnevnik
                  </button>
                </div>

                {financeView === 'banka' && <BankaTab year={year} />}
                {financeView === 'orange' && <OrangeMoneyTab year={year} />}
                {financeView === 'dnevnik' && <BlagajniskiDnevnik year={year} />}
              </div>
            )}

          {kalkulacijeView === 'nastavitve' && (
            <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10">
              <h2 className="text-lg font-bold text-[#c59b5b] mb-4">Nastavitve stroškov</h2>
              <p className="text-white/50 text-sm mb-6">
                Nastavite nabavne procente in fiksne stroške za izračun dobička.
              </p>
              
              <div className="grid grid-cols-2 gap-8">
                {/* Cost Percentages */}
                <div>
                  <h3 className="text-sm font-medium text-white/60 uppercase tracking-wider mb-4">Nabavni procenti</h3>
                  <p className="text-white/40 text-xs mb-4">Koliko % prodajne cene predstavlja nabavna cena</p>
                  
                  <div className="space-y-4">
                    {stats?.costSettings?.filter(c => c.costType === 'percentage').map(cost => (
                      <div key={cost.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                        <label className="text-white/70">{cost.description}</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            defaultValue={Number(cost.value)}
                            onBlur={(e) => handleCostUpdate(cost.id, Number(e.target.value))}
                            className="w-20 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-right"
                          />
                          <span className="text-white/50 w-8">%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Fixed Costs */}
                <div>
                  <h3 className="text-sm font-medium text-white/60 uppercase tracking-wider mb-4">Fiksni stroški</h3>
                  <p className="text-white/40 text-xs mb-4">Fiksna cena na enoto (npr. cena maserke)</p>
                  
                  <div className="space-y-4">
                    {stats?.costSettings?.filter(c => c.costType === 'fixed').map(cost => (
                      <div key={cost.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                        <label className="text-white/70">{cost.description}</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="0.01"
                            defaultValue={Number(cost.value)}
                            onBlur={(e) => handleCostUpdate(cost.id, Number(e.target.value))}
                            className="w-20 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-right"
                          />
                          <span className="text-white/50 w-8">EUR</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <PayrollSettingsPanel />
            </div>
          )}
        </div>
        )}

        {/* TAB: KADROVSKI ODDELEK */}
      {activeTab === 'kadri' && (
        <div className="space-y-6">
        {/* Payroll contribution deadlines (CNAPS / OMINO / FMFP) — an HR obligation,
            so it lives here rather than in Kalkulacije. */}
        {contributionAlerts && contributionAlerts.length > 0 && (
          <div className="space-y-3">
            {contributionAlerts.map((a) => {
              const deadline = new Date(a.deadline)
              const deadlineStr = deadline.toLocaleDateString('sl-SI', { day: 'numeric', month: 'long', year: 'numeric' })
              return (
                <div
                  key={`${a.year}-${a.quarter}`}
                  className="flex flex-wrap items-center gap-4 rounded-2xl border border-[#c98f7d]/30 bg-[#c98f7d]/10 p-4"
                >
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5 shrink-0 text-[#c98f7d]" />
                    <div>
                      <p className="text-sm font-semibold text-[#c98f7d]">
                        Prispevki Q{a.quarter} {a.year} —{' '}
                        {a.daysLeft < 0
                          ? `rok potekel pred ${Math.abs(a.daysLeft)} dnevi!`
                          : `rok čez ${a.daysLeft} dni`}
                      </p>
                      <p className="text-xs text-white/50">Rok plačila: {deadlineStr}</p>
                    </div>
                  </div>
                  <div className="ml-auto flex flex-wrap gap-x-6 gap-y-1 text-xs text-white/60">
                    <span>CNAPS: <span className="text-white">{formatAr(a.cnaps)}</span></span>
                    <span>OMINO: <span className="text-white">{formatAr(a.omino)}</span></span>
                    <span>FMFP: <span className="text-white">{formatAr(a.fmfp)}</span></span>
                    <span className="font-semibold">Skupaj: <span className="text-[#c98f7d]">{formatAr(a.total)}</span></span>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setPlaceQuarter(a.quarter); setKadriView('place') }}
                    className="cursor-pointer rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/[0.08]"
                  >
                    Odpri obračun
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* Sub-toggle: Seznam osebja / Obračun plač / Pogodbe / Razpored */}
        <div className="flex flex-wrap gap-2 pb-1">
          <details className="group relative">
            <summary
              className={`flex cursor-pointer list-none items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap [&::-webkit-details-marker]:hidden ${
                kadriView === 'seznam' || kadriView === 'pogodbe' || kadriView === 'certifikat' || kadriView === 'disciplina'
                  ? 'bg-[#8fae92]/20 text-[#8fae92] border border-[#8fae92]/30'
                  : 'bg-white/5 text-white/60 hover:bg-white/10'
              }`}
            >
              <Users className="h-4 w-4" />
              Seznam osebja
              <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
            </summary>
            <div className="absolute left-0 top-full z-20 mt-1 min-w-[220px] rounded-xl border border-white/10 bg-[#123543] p-1.5 shadow-xl">
              <button
                onClick={(e) => {
                  setKadriView('seznam')
                  e.currentTarget.closest('details')?.removeAttribute('open')
                }}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                  kadriView === 'seznam' ? 'bg-[#8fae92]/20 text-[#8fae92]' : 'text-white/70 hover:bg-white/10'
                }`}
              >
                <Users className="h-4 w-4" />
                Seznam osebja
              </button>
              <button
                onClick={(e) => {
                  setKadriView('pogodbe')
                  e.currentTarget.closest('details')?.removeAttribute('open')
                }}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                  kadriView === 'pogodbe' ? 'bg-[#c59b5b]/20 text-[#c59b5b]' : 'text-white/70 hover:bg-white/10'
                }`}
              >
                <FileText className="h-4 w-4" />
                Pogodbe
              </button>
              <button
                onClick={(e) => {
                  setKadriView('certifikat')
                  e.currentTarget.closest('details')?.removeAttribute('open')
                }}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                  kadriView === 'certifikat' ? 'bg-[#c59b5b]/20 text-[#c59b5b]' : 'text-white/70 hover:bg-white/10'
                }`}
              >
                <Award className="h-4 w-4" />
                Certifikat
              </button>
              <button
                onClick={(e) => {
                  setKadriView('disciplina')
                  e.currentTarget.closest('details')?.removeAttribute('open')
                }}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                  kadriView === 'disciplina' ? 'bg-[#c59b5b]/20 text-[#c59b5b]' : 'text-white/70 hover:bg-white/10'
                }`}
              >
                <Gavel className="h-4 w-4" />
                Disciplinski ukrepi
              </button>
            </div>
          </details>
          <details className="group relative">
            <summary
              className={`flex cursor-pointer list-none items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap [&::-webkit-details-marker]:hidden ${
                kadriView === 'place' || kadriView === 'obracun' || kadriView === 'napitnina'
                  ? 'bg-[#7fa8b8]/20 text-[#7fa8b8] border border-[#7fa8b8]/30'
                  : 'bg-white/5 text-white/60 hover:bg-white/10'
              }`}
            >
              <Euro className="h-4 w-4" />
              Obračun plač
              <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
            </summary>
            <div className="absolute left-0 top-full z-20 mt-1 min-w-[220px] rounded-xl border border-white/10 bg-[#123543] p-1.5 shadow-xl">
              <button
                  onClick={(e) => {
                    setPlaceQuarter(null)
                    setKadriView('place')
                    e.currentTarget.closest('details')?.removeAttribute('open')
                  }}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                  kadriView === 'place' ? 'bg-[#7fa8b8]/20 text-[#7fa8b8]' : 'text-white/70 hover:bg-white/10'
                }`}
              >
                <Euro className="h-4 w-4" />
                Obračun plač (SI)
              </button>
              <button
                onClick={(e) => {
                  setKadriView('obracun')
                  e.currentTarget.closest('details')?.removeAttribute('open')
                }}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                  kadriView === 'obracun' ? 'bg-[#8fae92]/20 text-[#8fae92]' : 'text-white/70 hover:bg-white/10'
                }`}
              >
                <Calculator className="h-4 w-4" />
                Obračun plače (MG)
              </button>
              <button
                onClick={(e) => {
                  setKadriView('napitnina')
                  e.currentTarget.closest('details')?.removeAttribute('open')
                }}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                  kadriView === 'napitnina' ? 'bg-[#c59b5b]/20 text-[#c59b5b]' : 'text-white/70 hover:bg-white/10'
                }`}
              >
                <Coins className="h-4 w-4" />
                Napitnina
              </button>
            </div>
          </details>
          <button
            onClick={() => {
              // Razpored vedno odpri na tekočem mesecu (plače ostanejo na prejšnjem).
              const now = new Date()
              setYear(now.getFullYear())
              setMonth(now.getMonth() + 1)
              setKadriView('razpored')
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
              kadriView === 'razpored'
                ? 'bg-[#7fa8b8]/20 text-[#7fa8b8] border border-[#7fa8b8]/30'
                : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            <Calendar className="h-4 w-4" />
            Razpored
          </button>
          <button
            onClick={() => setKadriView('registre')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
              kadriView === 'registre'
                ? 'bg-[#c59b5b]/20 text-[#c59b5b] border border-[#c59b5b]/30'
                : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            <Landmark className="h-4 w-4" />
            Registre d&apos;employeur
          </button>
        </div>

        {/* Prijave v blagajno lives under Bar on the personal landing page,
            so it is intentionally not repeated here. */}

        {kadriView === 'registre' && <RegistreEmployeurTab />}

          {/* key: remount so a different alert's quarter actually takes effect,
            since the quarter is picked in PlaceTab's own initial state. */}
        {kadriView === 'place' && (
          <PlaceTab
            key={`place-${placeQuarter ?? 'auto'}`}
            year={year}
            month={month}
            initialQuarter={placeQuarter ?? undefined}
          />
        )}

          {kadriView === 'napitnina' && <NapitninaTab year={year} month={month} />}

          {kadriView === 'certifikat' && <CertifikatTab />}

        {kadriView === 'disciplina' && <DisciplinaTab />}

          {kadriView === 'obracun' && <ObracunPlaceMg year={year} month={month} />}

        {kadriView === 'pogodbe' && <PogodbeTab />}

        {kadriView === 'razpored' && (
          <div className="space-y-4">
            {/* Sub-toggle: Sobarice / Vrtnarji / Kuhinja */}
            <div className="no-print flex gap-2 overflow-x-auto pb-1">
              <button
                onClick={() => setRazporedView('sobarice')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                  razporedView === 'sobarice'
                    ? 'bg-[#c59b5b]/20 text-[#c59b5b] border border-[#c59b5b]/30'
                    : 'bg-white/5 text-white/60 hover:bg-white/10'
                }`}
              >
                Sobarice
              </button>
              <button
                onClick={() => setRazporedView('vrtnarji')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                  razporedView === 'vrtnarji'
                    ? 'bg-[#8fae92]/20 text-[#8fae92] border border-[#8fae92]/30'
                    : 'bg-white/5 text-white/60 hover:bg-white/10'
                }`}
              >
                Vrtnarji
              </button>
              <button
                onClick={() => setRazporedView('kuhinja')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                  razporedView === 'kuhinja'
                    ? 'bg-[#c59b5b]/20 text-[#c59b5b] border border-[#c59b5b]/30'
                    : 'bg-white/5 text-white/60 hover:bg-white/10'
                }`}
              >
                Kuhinja
              </button>
              <button
                onClick={() => setRazporedView('bar')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                  razporedView === 'bar'
                    ? 'bg-[#7fa8b8]/20 text-[#7fa8b8] border border-[#7fa8b8]/30'
                    : 'bg-white/5 text-white/60 hover:bg-white/10'
                }`}
              >
                Bar
              </button>
            </div>

            {razporedView === 'sobarice' ? (
              <div className="space-y-4">
                <LeaveDocument department="housekeeper" />
                <RazporedTab year={year} month={month} />
              </div>
            ) : razporedView === 'vrtnarji' ? (
              <div className="space-y-4">
                <LeaveDocument department="gardener" />
                <VrtnarjiTab year={year} month={month} />
              </div>
            ) : razporedView === 'kuhinja' ? (
              <div className="space-y-4">
                <LeaveDocument department="kitchen" />
                <KuhinjaTab year={year} month={month} />
              </div>
            ) : (
              <div className="space-y-4">
                <LeaveDocument department="barman" />
                <BarTab year={year} month={month} />
              </div>
            )}
          </div>
        )}

        {kadriView === 'seznam' && (
        <div className="space-y-6">
        <div className="p-4 sm:p-6 rounded-2xl bg-white/[0.03] border border-white/10">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-base sm:text-lg font-bold text-[#8fae92]">Seznam osebja</h2>
          <Link 
            href="/potrdila" 
            className="flex items-center gap-2 rounded-xl bg-[#8fae92]/10 border border-[#8fae92]/30 px-4 py-2 text-sm font-medium text-[#8fae92] hover:bg-[#8fae92]/20 transition-colors"
          >
            <Printer className="h-4 w-4" />
            Potrdila o plači
          </Link>
        </div>
        <p className="text-white/50 text-sm mb-6">
                Definirajte osebje in njihove mesečne plače. Plače se bodo avtomatsko upoštevale v statistiki glede na razporeditev (nočitve, bar, management).
              </p>

              {/* Search by name, then by employment kind. */}
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                <input
                  type="text"
                  value={staffSearch}
                  onChange={(e) => setStaffSearch(e.target.value)}
                  placeholder="Išči po imenu..."
                  className="w-full rounded-xl bg-white/[0.03] border border-white/10 pl-10 pr-10 py-2.5 text-sm text-white placeholder-white/30 focus:border-[#8fae92]/40 focus:outline-none"
                />
                {staffSearch && (
                  <button
                    onClick={() => setStaffSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                    aria-label="Počisti iskanje"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="mb-6 flex flex-wrap gap-2">
                {([
                  { id: 'all', label: 'Vsi' },
                  { id: 'regular', label: 'Redno zaposleni' },
                  { id: 'contract', label: 'Pogodbeni' },
                  { id: 'stagiaire', label: 'Študenti' },
                ] as const).map((kind) => {
                  const count = (allStaff || []).filter((s) => kind.id === 'all' || staffKindOf(s) === kind.id).length
                  const on = staffKind === kind.id
                  const tone =
                    kind.id === 'regular'
                      ? on
                        ? 'bg-[#7fa8b8]/25 text-[#7fa8b8] border-[#7fa8b8]/50'
                        : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'
                      : kind.id === 'stagiaire'
                        ? on
                          ? 'bg-[#c59b5b]/25 text-[#c59b5b] border-[#c59b5b]/50'
                          : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'
                        : on
                          ? 'bg-[#8fae92]/25 text-[#8fae92] border-[#8fae92]/50'
                          : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'
                  return (
                    <button
                      key={kind.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setStaffKind(kind.id)}
                      className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors ${tone}`}
                    >
                      {kind.label} <span className="opacity-70">{count}</span>
                    </button>
                  )
                })}
              </div>
              
              {/* Staff List */}
              <div className="space-y-3 mb-6">
                {allStaff?.slice().filter(staff =>
                  staff.staffName.toLowerCase().includes(staffSearch.trim().toLowerCase()) &&
                  (staffKind === 'all' || staffKindOf(staff) === staffKind)
                ).sort((a, b) => {
                  // Sort inactive to bottom, then by category, then by name
                  if ((a.active !== false) !== (b.active !== false)) return (a.active !== false) ? -1 : 1
                  const categoryOrder = { kuhinja: 0, bar: 1, accommodation: 2, management: 3 }
                  const catA = categoryOrder[a.allocateTo as keyof typeof categoryOrder] ?? 4
                  const catB = categoryOrder[b.allocateTo as keyof typeof categoryOrder] ?? 4
                  if (catA !== catB) return catA - catB
                  return a.staffName.localeCompare(b.staffName)
                }).map((staff, idx, arr) => {
                  const typeInfo = STAFF_TYPES.find(t => t.value === staff.staffType) || STAFF_TYPES[6]
  const allocateLabel = staff.allocateTo === 'accommodation' ? 'Nočitve' : staff.allocateTo === 'bar' ? 'Bar' : staff.allocateTo === 'kuhinja' ? 'Kuhinja' : 'Management'
  const allocateColor = staff.allocateTo === 'accommodation' ? 'text-[#7fa8b8]' : staff.allocateTo === 'bar' ? 'text-[#8fae92]' : staff.allocateTo === 'kuhinja' ? 'text-[#c59b5b]' : 'text-white/70'
                  const isActive = staff.active !== false
                  // Naslov oddelka pred prvo osebo vsakega oddelka (upoštevaj tudi
                  // ločen blok neaktivnih spodaj → ključ vključuje aktivnost).
                  const prev = arr[idx - 1]
                  const groupKey = `${isActive ? 'a' : 'i'}:${staff.allocateTo}`
                  const prevKey = prev ? `${prev.active !== false ? 'a' : 'i'}:${prev.allocateTo}` : null
                  const showHeader = groupKey !== prevKey
                  const headerDotColor = staff.allocateTo === 'accommodation' ? 'bg-[#7fa8b8]' : staff.allocateTo === 'bar' ? 'bg-[#8fae92]' : staff.allocateTo === 'kuhinja' ? 'bg-[#c59b5b]' : 'bg-white/50'
                  const groupCount = arr.filter(s => `${s.active !== false ? 'a' : 'i'}:${s.allocateTo}` === groupKey).length

                  return (
                    <React.Fragment key={staff.id}>
                    {showHeader && (
                      <div className={`flex items-center gap-2 pt-4 pb-1 ${idx === 0 ? '' : 'mt-2 border-t border-white/10'}`}>
                        <span className={`inline-block h-2.5 w-2.5 rounded-full ${headerDotColor}`} />
                        <h3 className={`text-sm font-bold uppercase tracking-wider ${allocateColor}`}>{allocateLabel}</h3>
                        <span className="text-xs text-white/40">({groupCount})</span>
                        {!isActive && <span className="text-xs text-red-400/70">neaktivni</span>}
                      </div>
                    )}
                    <div className={`p-4 rounded-xl border ${isActive ? 'bg-white/5 border-white/10' : 'bg-red-500/5 border-red-500/20 opacity-60'}`}>
                    {editingStaff === staff.id ? (
                    /* ===== Urejanje osnovnih podatkov ===== */
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                        <input
                          type="text"
                          placeholder="Ime in priimek"
                          value={editForm.staffName}
                          onChange={(e) => setEditForm(s => ({ ...s, staffName: e.target.value }))}
                          className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/30 focus:border-[#8fae92]/40 focus:outline-none"
                        />
                        <select
                          value={editForm.staffType}
                          onChange={(e) => {
                            const type = STAFF_TYPES.find(t => t.value === e.target.value)
                            setEditForm(s => ({ ...s, staffType: e.target.value, allocateTo: type?.allocateTo || s.allocateTo }))
                          }}
                          className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:border-[#8fae92]/40 focus:outline-none"
                        >
                          {STAFF_TYPES.map(t => (
                            <option key={t.value} value={t.value} className="bg-[#0b2731]">{t.label}</option>
                          ))}
                        </select>
                        <input
                          type="number"
                          placeholder="Mesečna plača (Ar)"
                          value={editForm.monthlySalary}
                          onChange={(e) => setEditForm(s => ({ ...s, monthlySalary: e.target.value }))}
                          className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/30 focus:border-[#8fae92]/40 focus:outline-none"
                        />
                        <input
                          type="date"
                          value={editForm.startDate}
                          onChange={(e) => setEditForm(s => ({ ...s, startDate: e.target.value }))}
                          className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm [color-scheme:dark] focus:border-[#8fae92]/40 focus:outline-none"
                          title="Datum vstopa"
                        />
                        <input
                          type="date"
                          value={editForm.endDate}
                          onChange={(e) => setEditForm(s => ({ ...s, endDate: e.target.value }))}
                          className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm [color-scheme:dark] focus:border-[#8fae92]/40 focus:outline-none"
                          title="Datum izstopa. Od tega dne ga ni več v razporedu."
                        />
                        <select
                          value={editForm.allocateTo}
                          onChange={(e) => setEditForm(s => ({ ...s, allocateTo: e.target.value }))}
                          className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:border-[#8fae92]/40 focus:outline-none"
                        >
                          <option value="accommodation" className="bg-[#0b2731]">Strošek: Nočitve</option>
                          <option value="bar" className="bg-[#0b2731]">Strošek: Bar</option>
                          <option value="kuhinja" className="bg-[#0b2731]">Strošek: Kuhinja</option>
                          <option value="management" className="bg-[#0b2731]">Strošek: Management</option>
                        </select>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-white/50 text-sm">Aktivni meseci:</span>
                          <div className="flex flex-wrap gap-1">
                            {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                              <button
                                key={m}
                                onClick={() => handleToggleEditMonth(m)}
                                className={`w-7 h-7 rounded text-xs font-medium transition-colors ${
                                  editForm.activeMonths.includes(m)
                                    ? 'bg-[#8fae92] text-white'
                                    : 'bg-white/5 text-white/40 hover:bg-white/10'
                                }`}
                              >
                                {m}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleCancelEdit}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 text-white/60 text-sm font-medium hover:bg-white/10 transition-colors"
                          >
                            <X className="h-4 w-4" />
                            Prekliči
                          </button>
                          <button
                            onClick={() => handleSaveEdit(staff.id)}
                            disabled={savingEdit || !editForm.staffName || !editForm.monthlySalary}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#8fae92] text-white text-sm font-medium hover:bg-[#779f7b] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            <Check className="h-4 w-4" />
                            {savingEdit ? 'Shranjujem...' : 'Shrani'}
                          </button>
                        </div>
                      </div>
                    </div>
                    ) : (
                    <>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isActive ? 'bg-[#8fae92]/20' : 'bg-red-500/20'}`}>
                          {isActive ? <UserCog className="h-5 w-5 text-[#8fae92]" /> : <UserMinus className="h-5 w-5 text-red-400" />}
  </div>
  <div>
  <p className={`font-medium ${isActive ? 'text-white' : 'text-white/50 line-through'}`}>
    {staff.staffName}
    {staff.nickname && <span className="ml-2 text-[#c59b5b]">„{staff.nickname}"</span>}
  </p>
  <p className="text-white/50 text-sm">{typeInfo.label}</p>
  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
    <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/40">
      Vstop
      <input
        type="date"
        value={staff.startDate ? String(staff.startDate).slice(0, 10) : ''}
        onChange={(e) => handleUpdateStartDate(staff.id, e.target.value)}
        className="bg-transparent text-[#7fa8b8] text-xs normal-case tracking-normal border-none p-0 focus:outline-none [color-scheme:dark] cursor-pointer"
        title="Datum vstopa"
      />
    </label>
    <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/40">
      Izstop
      <input
        type="date"
        value={staff.endDate ? String(staff.endDate).slice(0, 10) : ''}
        onChange={(e) => handleUpdateEndDate(staff.id, e.target.value)}
        className="bg-transparent text-[#c8846b] text-xs normal-case tracking-normal border-none p-0 focus:outline-none [color-scheme:dark] cursor-pointer"
        title="Od tega dne ga ni več v razporedu"
      />
    </label>
  </div>
  {staff.endDate && (
    <p className="mt-1 text-[11px] text-[#c8846b]">Od {slDate(isoDate(String(staff.endDate)))} ni več v razporedu.</p>
  )}
  {!isActive && <span className="text-red-400 text-xs">Neaktiven</span>}
  </div>
  </div>
                      
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 sm:gap-6">
                        <div className="text-left sm:text-right">
                          {(() => {
                            const today = new Date()
                            const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
                            const inForce = salaryOn(Number(staff.monthlySalary), staff.salaryChanges, todayIso)
                            return (
                              <>
                                <p className="text-[#c59b5b] font-bold">{formatEur(inForce / (stats?.exchangeRate || 4800))}</p>
                                <p className="text-white/30 text-xs">{inForce.toLocaleString('sl-SI')} Ar</p>
                                {staff.officialSalary !== '' && Number(staff.officialSalary) !== inForce && (
                                  <p className="text-[#7fa8b8]/70 text-xs">Uradno: {Number(staff.officialSalary).toLocaleString('sl-SI')} Ar</p>
                                )}
                              </>
                            )
                          })()}
                          <p className={`text-xs ${allocateColor}`}>Strošek: {allocateLabel}</p>
                        </div>
                        
                        <div className="flex items-center gap-1 w-full sm:w-auto order-last sm:order-none">
                          {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                            <div 
                              key={m}
                              className={`w-5 h-5 rounded text-[10px] flex items-center justify-center shrink-0 ${
                                staff.activeMonths?.includes(m) 
                                  ? 'bg-[#8fae92]/30 text-[#8fae92]' 
                                  : 'bg-white/5 text-white/20'
                              }`}
                              title={MONTHS[m-1]}
                            >
                              {m}
                            </div>
                          ))}
                        </div>

                        <div className="flex items-center gap-1 ml-auto sm:ml-0">
                        <button
                          onClick={() => handleCycleEmployment(staff.id, staff.isRegularEmployee, staff.employmentType)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                            staff.isRegularEmployee
                              ? 'bg-[#7fa8b8]/15 text-[#7fa8b8] border-[#7fa8b8]/30'
                              : staff.employmentType === 'stagiaire'
                                ? 'bg-[#c59b5b]/15 text-[#c59b5b] border-[#c59b5b]/30'
                                : 'bg-white/5 text-white/40 border-white/10 hover:bg-white/10'
                          }`}
                          title="Vrsta zaposlitve (klik za preklop: Redno → Pogodbeno → Študent na praksi). Le redno zaposleni so v polnem obračunu plač."
                        >
                          {staff.isRegularEmployee
                            ? 'Redno zaposlen'
                            : staff.employmentType === 'stagiaire'
                              ? 'Študent na praksi'
                              : 'Pogodbeno'}
                        </button>

                        <button
                          onClick={() => handleStartEdit(staff)}
                          className="p-2 rounded-lg text-[#7fa8b8] hover:bg-[#7fa8b8]/20 transition-colors"
                          title="Uredi podatke"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>

                        <button
                          onClick={() => handleToggleActive(staff.id, isActive)}
                          className={`p-2 rounded-lg transition-colors ${isActive ? 'text-amber-400 hover:bg-amber-500/20' : 'text-[#8fae92] hover:bg-[#8fae92]/20'}`}
                          title={isActive ? 'Označi kot neaktiven' : 'Označi kot aktiven'}
                        >
                          {isActive ? <UserMinus className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                        </button>
                        
                        <button
                          onClick={() => handleDeleteStaff(staff.id)}
                          className="p-2 rounded-lg text-red-400 hover:bg-red-500/20 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        </div>
                      </div>
                    </div>
                    {(() => {
                      const today = new Date()
                      const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
                      const periods = salaryHistory(Number(staff.monthlySalary), staff.salaryChanges)
                      const hasChange = periods.some((period) => period.changeFrom)
                      return (
                        <div className="mt-3 border-t border-white/10 pt-3">
                          {hasChange && (
                            <div className="mb-2 space-y-1">
                              {periods.map((period) => {
                                const current = periodCovers(period, todayIso)
                                return (
                                  <div key={period.changeFrom || 'base'} className="flex flex-wrap items-center gap-2 text-xs">
                                    <span className={current ? 'text-white' : 'text-white/50'}>
                                      {periodLabel(period)}: {period.amount.toLocaleString('sl-SI')} Ar
                                      {current ? ' · velja zdaj' : ''}
                                    </span>
                                    {period.changeFrom && (
                                      <button
                                        onClick={() => handleRemoveSalaryChange(staff.id, period.changeFrom!)}
                                        className="text-[11px] text-red-300/80 hover:text-red-200"
                                      >
                                        Odstrani
                                      </button>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          )}
                          {salaryEditId === staff.id ? (
                            <div className="flex flex-wrap items-end gap-2">
                              <label className="text-[10px] uppercase tracking-wider text-white/40">
                                Od katerega dne velja nova plača
                                <input
                                  type="date"
                                  value={salaryFrom}
                                  onChange={(e) => setSalaryFrom(e.target.value)}
                                  className="mt-1 block rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm normal-case tracking-normal text-white [color-scheme:dark]"
                                />
                              </label>
                              <label className="text-[10px] uppercase tracking-wider text-white/40">
                                Nova plača (Ar)
                                <input
                                  type="number"
                                  value={salaryAmount}
                                  onChange={(e) => setSalaryAmount(e.target.value)}
                                  placeholder="npr. 350000"
                                  className="mt-1 block w-36 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm normal-case tracking-normal text-white"
                                />
                              </label>
                              <button
                                onClick={() => handleSaveSalaryChange(staff.id)}
                                disabled={savingSalary || !salaryFrom || !(Number(salaryAmount) > 0)}
                                className="rounded-lg bg-[#8fae92] px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
                              >
                                {savingSalary ? 'Shranjujem...' : 'Shrani spremembo'}
                              </button>
                              <button
                                onClick={() => setSalaryEditId(null)}
                                className="rounded-lg bg-white/5 px-3 py-2 text-xs text-white/60"
                              >
                                Prekliči
                              </button>
                              <p className="w-full text-[11px] text-white/40">Do vpisanega dne velja dosedanja plača. Od tega dne velja nova.</p>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setSalaryEditId(staff.id)
                                setSalaryFrom('')
                                setSalaryAmount('')
                              }}
                              className="text-xs font-medium text-[#c59b5b] hover:text-[#d7b27a]"
                            >
                              Sprememba plače
                            </button>
                          )}
                        </div>
                      )
                    })()}
                    </>
                    )}

<StaffPersonalInfo
  staffId={staff.id}
  nickname={staff.nickname}
  firstName={staff.firstName}
                      lastName={staff.lastName}
                      dateOfBirth={staff.dateOfBirth}
                      placeOfBirth={staff.placeOfBirth}
                      documentNumber={staff.documentNumber}
                      documentImagePath={staff.documentImagePath}
                      company={staff.company}
                      gender={staff.gender}
                      fatherName={staff.fatherName}
                      motherName={staff.motherName}
                      nationality={staff.nationality}
                      cnapsNumber={staff.cnapsNumber}
                      ominoNumber={staff.ominoNumber}
                      ostieNumber={staff.ostieNumber}
                    officialSalary={staff.officialSalary}
                    wageCategory={staff.wageCategory}
                    numberOfDependents={staff.numberOfDependents}
                      openingLeaveBalance={staff.openingLeaveBalance}
                      address={staff.address}
                      phone={staff.phone}
                      email={staff.email}
                      employeePhotoPath={staff.employeePhotoPath}
                      notes={staff.notes}
                      onImageChange={() => mutateStaff()}
                    />
                    </div>
                    </React.Fragment>
                  )
                })}
                
                {(!allStaff || allStaff.length === 0) && (
                  <div className="text-center py-8 text-white/40">
                    Ni še dodanega osebja. Dodajte prvega delavca spodaj.
                  </div>
                )}

                {allStaff && allStaff.length > 0 &&
                  allStaff.filter(s =>
                    s.staffName.toLowerCase().includes(staffSearch.trim().toLowerCase()) &&
                    (staffKind === 'all' || staffKindOf(s) === staffKind)
                  ).length === 0 && (
                  <div className="text-center py-8 text-white/40">
                    {staffSearch.trim()
                      ? `Ni zadetkov za "${staffSearch}".`
                      : 'V tej skupini ni nikogar.'}
                  </div>
                )}
              </div>
              
              {/* Add New Staff */}
              <div className="p-4 rounded-xl bg-[#0b2731] border border-[#8fae92]/30">
                <h3 className="text-sm font-medium text-[#8fae92] mb-4">Dodaj novega delavca</h3>
                
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-3">
  <input
  type="text"
  placeholder="Ime in priimek"
  value={newStaff.staffName}
  onChange={(e) => setNewStaff(s => ({ ...s, staffName: e.target.value }))}
  className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/30"
  />
  <select
  value={newStaff.staffType}
  onChange={(e) => {
  const type = STAFF_TYPES.find(t => t.value === e.target.value)
  setNewStaff(s => ({
  ...s,
  staffType: e.target.value,
  allocateTo: type?.allocateTo || 'management'
  }))
  }}
  className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm"
  >
  {STAFF_TYPES.map(t => (
  <option key={t.value} value={t.value} className="bg-[#0b2731]">{t.label}</option>
  ))}
  </select>
  <input
  type="number"
  placeholder="Mesečna plača (Ar)"
  value={newStaff.monthlySalary}
  onChange={(e) => setNewStaff(s => ({ ...s, monthlySalary: e.target.value }))}
  className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/30"
  />
  <input
  type="date"
  value={newStaff.startDate}
  onChange={(e) => setNewStaff(s => ({ ...s, startDate: e.target.value }))}
  className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm [color-scheme:dark]"
  title="Datum vstopa"
  />
  <select
  value={newStaff.allocateTo}
  onChange={(e) => setNewStaff(s => ({ ...s, allocateTo: e.target.value }))}
  className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm"
  >
  <option value="accommodation" className="bg-[#0b2731]">Strošek: Nočitve</option>
  <option value="bar" className="bg-[#0b2731]">Strošek: Bar</option>
  <option value="kuhinja" className="bg-[#0b2731]">Strošek: Kuhinja</option>
  <option value="management" className="bg-[#0b2731]">Strošek: Management</option>
  </select>
  </div>
                
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <span className="text-white/50 text-sm">Aktivni meseci:</span>
                    <div className="flex flex-wrap gap-1">
                      {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                        <button 
                          key={m}
                          onClick={() => handleToggleMonth(m)}
                          className={`w-7 h-7 rounded text-xs font-medium transition-colors ${
                            newStaff.activeMonths.includes(m) 
                              ? 'bg-[#8fae92] text-white' 
                              : 'bg-white/5 text-white/40 hover:bg-white/10'
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <button
                    onClick={handleAddStaff}
                    disabled={!newStaff.staffName || !newStaff.monthlySalary}
                    className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#8fae92] text-white font-medium hover:bg-[#779f7b] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    Dodaj
                  </button>
                </div>
              </div>
            </div>
            
            {/* Salary Allocation Info */}
            <div className="p-4 sm:p-6 rounded-2xl bg-white/[0.03] border border-white/10">
              <h3 className="text-sm font-medium text-white/60 uppercase tracking-wider mb-4">Kako se plače razporejajo</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-[#7fa8b8]/10 border border-[#7fa8b8]/20">
                  <h4 className="text-[#7fa8b8] font-medium mb-2">Nočitve (alikvotno)</h4>
                  <p className="text-white/50 text-sm">
                    Plača se deli glede na število nočitev v mesecu. Vrtnar in sobarica se razporedita sem.
                  </p>
                  <p className="text-white/30 text-xs mt-2">
                    Formula: plača / dni v mesecu * nočitev
                  </p>
                </div>
                
                <div className="p-4 rounded-xl bg-[#8fae92]/10 border border-[#8fae92]/20">
                  <h4 className="text-[#8fae92] font-medium mb-2">Bar (celotna)</h4>
                  <p className="text-white/50 text-sm">
                    Celotna mesečna plača se upošteva. Barman in kuhinja se razporedita sem.
                  </p>
                  <p className="text-white/30 text-xs mt-2">
                    Formula: celotna mesečna plača
                  </p>
                </div>
                
<div className="p-4 rounded-xl bg-[#c59b5b]/10 border border-[#c59b5b]/20">
<h4 className="text-[#c59b5b] font-medium mb-2">Management</h4>
<p className="text-white/50 text-sm">
Prikazano posebej, ne zmanjšuje dobička posamezne kategorije.
</p>
<p className="text-white/30 text-xs mt-2">
Recepcija, vzdrževanje...
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
        </div>
        )}

      </div>
    </div>
  )
}

// useSearchParams needs a Suspense boundary above it.
export default function StatistikaPage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen bg-[#071c24]" />}>
      <StatistikaContent />
    </React.Suspense>
  )
}
