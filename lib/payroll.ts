// Madagascar payroll engine 2026 - Komba Cabana
// Cisti izracuni in konstante (BREZ 'use server')
// Specifikacija: progresivni IRSA, nadure, nocno delo, nedelje, prazniki, strop prispevkov.
// VSE stopnje/lestvice so urejljive prek PayrollSettings (shranjeno v bazi).

// --- Podjetja (2 podjetji na istem naslovu) ---
export const COMPANY_ADDRESS =
  'Villa MADINA I EMPHYTEOSE TN°4507-BO ANDREKAREKA BE'

export type CompanyId = 'tourism' | 'sarl'

export const COMPANIES: Record<CompanyId, { name: string; address: string }> = {
  tourism: {
    name: 'KOMBA CABANA TOURISM SARL',
    address: COMPANY_ADDRESS,
  },
  sarl: {
    name: 'KOMBA CABANA SARL',
    address: COMPANY_ADDRESS,
  },
}

export function getCompany(id: string | null | undefined) {
  return COMPANIES[(id as CompanyId) || 'tourism'] || COMPANIES.tourism
}

// Privzeta osnovna placa (Ar)
export const DEFAULT_NET_SALARY = 300000

// =====================================================================
// NASTAVITVE PLAC (urejljivo v Nastavitvah - Madagaskar 2026)
// =====================================================================
export type IrsaBracket = {
  from: number
  to: number | null // null = brez zgornje meje
  rate: number       // npr. 0.05 = 5%
}

export type PayrollSettings = {
  // Splosno
  monthlyHours: number          // mesecne ure (privzeto 173.33)
  // Koeficienti nadur in posebnega dela
  overtimeFirst8: number        // prvih 8 nadur (privzeto 1.30)
  overtimeAfter8: number        // nadure nad 8 (privzeto 1.50)
  nightRegular: number          // redno nocno (privzeto 1.30)
  nightOccasional: number       // obcasno nocno (privzeto 1.50)
  sundayWork: number            // nedeljsko delo (privzeto 1.40)
  publicHoliday: number         // prazniki (privzeto 1.50)
  // Prispevki - osnova
  sme: number                   // SME 2026 (privzeto 262680)
  ceilingMultiplier: number     // mnozitelj stropa (privzeto 8)
  // Zaposleni
  employeeCNAPS: number         // privzeto 0.01
  employeeOSTIE: number         // privzeto 0.01
  // Delodajalec
  employerCNAPS: number         // privzeto 0.13
  employerOSTIE: number         // privzeto 0.05
  employerFMFP: number          // privzeto 0.01
  // IRSA
  irsaBrackets: IrsaBracket[]
  dependentAllowance: number    // privzeto 0 (brez olajsave za vzdrzevane osebe)
  maxDependents: number         // privzeto 6
  minimumIRSA: number           // privzeto 3000
  // Dopust (placan letni dopust - Code du Travail Madagascar, clen 131)
  monthlyLeaveAccrual: number   // dnevi dopusta na mesec dela (privzeto 2.5)
  annualLeaveEntitlement: number// letna kvota dni (privzeto 30)
  // Zakon NE doloca formule dnevnega dopusta -> nastavljiva metoda:
  //  SALARY_MAINTENANCE  - delavec ohrani normalno placo, dopust zmanjsa le saldo
  //  ALLOWANCE_ONLY      - nadomestilo dopusta se PRISTEJE vsem (brez odbitka; osnova ze krije cel mesec)
  //  CUSTOM              - administrator doloci oba delitelja (lahko vkljucno z odbitkom)
  leaveCalculationMethod: LeaveCalculationMethod  // privzeto SALARY_MAINTENANCE
  leaveDeductionDivisor: number // delitelj za odbitek dopusta (privzeto 30)
  leaveAllowanceDivisor: number // delitelj za nadomestilo dopusta (privzeto 30)
  // ZAKON (potrjeno racunovodkinja Claudia): indemnité de congé payé NI obdavcljiva.
  //  congeTaxable=false (privzeto): nadomestilo dopusta NI v osnovi za CNAPS/OSTIE/FMFP/IRSA,
  //   pristejemo ga sele po izracunu neto place (NET A PAYER = net imposable + indemnité de congé).
  //  congeTaxable=true: nadomestilo se obravnava kot obdavcljivi del bruto (staro vedenje).
  congeTaxable: boolean         // privzeto false
  allowCarryForward: boolean    // dovoljen prenos dopusta (privzeto true)
  maxCarryForwardDays: number   // najvec prenesenih dni (0 = brez omejitve)
}

export type LeaveCalculationMethod = 'SALARY_MAINTENANCE' | 'ALLOWANCE_ONLY' | 'CUSTOM'

export const DEFAULT_IRSA_BRACKETS: IrsaBracket[] = [
  { from: 0, to: 350000, rate: 0.0 },
  { from: 350001, to: 400000, rate: 0.05 },
  { from: 400001, to: 500000, rate: 0.1 },
  { from: 500001, to: 600000, rate: 0.15 },
  { from: 600001, to: 4000000, rate: 0.2 },
  { from: 4000001, to: null, rate: 0.25 },
]

export const DEFAULT_PAYROLL_SETTINGS: PayrollSettings = {
  monthlyHours: 173.33,
  overtimeFirst8: 1.3,
  overtimeAfter8: 1.5,
  nightRegular: 1.3,
  nightOccasional: 1.5,
  sundayWork: 1.4,
  publicHoliday: 1.5,
  sme: 262680,
  ceilingMultiplier: 8,
  employeeCNAPS: 0.01,
  employeeOSTIE: 0.01,
  employerCNAPS: 0.13,
  employerOSTIE: 0.05,
  employerFMFP: 0.01,
  irsaBrackets: DEFAULT_IRSA_BRACKETS,
  dependentAllowance: 0, // brez izracuna olajsave za vzdrzevane osebe (po popravku spec)
  maxDependents: 6,
  minimumIRSA: 3000,
  monthlyLeaveAccrual: 2.5,
  annualLeaveEntitlement: 30,
  leaveCalculationMethod: 'SALARY_MAINTENANCE',
  leaveDeductionDivisor: 30,
  leaveAllowanceDivisor: 30,
  congeTaxable: false,
  allowCarryForward: true,
  maxCarryForwardDays: 0,
}

// Ohranjene konstante za zdruzljivost (privzete vrednosti)
export const EMPLOYER_CNAPS_RATE = DEFAULT_PAYROLL_SETTINGS.employerCNAPS
export const EMPLOYER_OMINO_RATE = DEFAULT_PAYROLL_SETTINGS.employerOSTIE
export const EMPLOYER_FMFP_RATE = DEFAULT_PAYROLL_SETTINGS.employerFMFP

// --- Tipi ---
export type PayslipInput = {
  baseGrossSalary: number
  overtimeFirst8Hours?: number
  overtimeAfter8Hours?: number
  nightRegularHours?: number
  nightOccasionalHours?: number
  sundayHours?: number
  publicHolidayHours?: number
  bonuses?: number
  taxableBenefits?: number
  unusedLeaveCompensation?: number  // poracun neizkoriscenega dopusta (ob odhodu)
  leaveAllowance?: number           // nadomestilo dopusta (ALLOWANCE_ONLY / CUSTOM)
  leaveDeduction?: number           // odbitek dopusta (samo CUSTOM)
  employeeAdvances?: number
  otherEmployeeDeductions?: number
  numberOfDependents?: number
}

export type Payslip = {
  baseGrossSalary: number
  hourlyRate: number
  // Dodatki
  overtimeFirst8Amount: number
  overtimeAfter8Amount: number
  nightRegularAmount: number
  nightOccasionalAmount: number
  sundayAmount: number
  publicHolidayAmount: number
  bonuses: number
  taxableBenefits: number
  unusedLeaveCompensation: number
  leaveAllowance: number
  leaveDeduction: number
  nonTaxableLeaveAllowance: number  // del nadomestila dopusta, ki NI obdavcen (congeTaxable=false)
  taxableGross: number              // SALAIRE BRUT IMPOSABLE (osnova za prispevke + IRSA)
  grossSalary: number               // skupni bruto = taxableGross + nonTaxableLeaveAllowance
  // Osnova prispevkov
  contributionBase: number
  contributionCeiling: number
  // Odbitki zaposlenega
  employeeCNAPS: number
  employeeOSTIE: number
  irsaBase: number
  grossIRSA: number
  dependentDeduction: number
  finalIRSA: number
  employeeAdvances: number
  otherEmployeeDeductions: number
  totalEmployeeDeductions: number
  // Rezultat
  netSalary: number   // NET IMPOSABLE (obdavcljivi neto, po prispevkih in IRSA)
  netToPay: number    // NET A PAYER = netSalary + nonTaxableLeaveAllowance
  // Delodajalec
  employerCNAPS: number
  employerOSTIE: number
  employerFMFP: number
  employerContributions: number
  totalEmployerCost: number
}

function n(v: number | undefined | null): number {
  return v == null || isNaN(v) ? 0 : v
}

function toInput(input: number | PayslipInput): PayslipInput {
  return typeof input === 'number' ? { baseGrossSalary: input } : input
}

// --- Progresivni izracun IRSA po lestvici ---
// Vsak razred obdavci le del osnove znotraj [from, to] po svoji stopnji.
export function progressiveTax(base: number, brackets: IrsaBracket[]): number {
  if (base <= 0) return 0
  let tax = 0
  for (const b of brackets) {
    const upper = b.to == null ? Infinity : b.to
    // spodnja meja pasu (npr. from=350001 -> pas se zacne nad 350000)
    const lowerBound = b.from <= 0 ? 0 : b.from - 1
    const portion = Math.max(0, Math.min(base, upper) - lowerBound)
    if (portion > 0) tax += portion * b.rate
    if (base <= upper) break
  }
  return tax
}

// --- Glavni izracun placilne liste ---
export function calcPayslip(
  input: number | PayslipInput,
  settings: PayrollSettings = DEFAULT_PAYROLL_SETTINGS,
): Payslip {
  const i = toInput(input)
  const baseGrossSalary = n(i.baseGrossSalary)
  const monthlyHours = settings.monthlyHours > 0 ? settings.monthlyHours : 173.33
  const hourlyRate = baseGrossSalary / monthlyHours

  // Dodatki
  const overtimeFirst8Amount = Math.round(n(i.overtimeFirst8Hours) * hourlyRate * settings.overtimeFirst8)
  const overtimeAfter8Amount = Math.round(n(i.overtimeAfter8Hours) * hourlyRate * settings.overtimeAfter8)
  const nightRegularAmount = Math.round(n(i.nightRegularHours) * hourlyRate * settings.nightRegular)
  const nightOccasionalAmount = Math.round(n(i.nightOccasionalHours) * hourlyRate * settings.nightOccasional)
  const sundayAmount = Math.round(n(i.sundayHours) * hourlyRate * settings.sundayWork)
  const publicHolidayAmount = Math.round(n(i.publicHolidayHours) * hourlyRate * settings.publicHoliday)
  const bonuses = n(i.bonuses)
  const taxableBenefits = n(i.taxableBenefits)
  // Poracun neizkoriscenega dopusta (ob odhodu) - del bruto, obdavcen + prispevki
  const unusedLeaveCompensation = n(i.unusedLeaveCompensation)
  // Dopust po metodi ALLOWANCE_ONLY / CUSTOM:
  //  nadomestilo (+) ; odbitek (-) zmanjsa obdavcljivi bruto (samo CUSTOM).
  //  Pri SALARY_MAINTENANCE sta oba 0 (placa ostane nespremenjena).
  const leaveAllowance = n(i.leaveAllowance)
  const leaveDeduction = n(i.leaveDeduction)

  // ZAKON: indemnité de congé NI obdavcljiva (congeTaxable=false) -> izloci jo iz osnove
  // za prispevke/IRSA in jo pristej sele po izracunu neto place.
  const nonTaxableLeaveAllowance = settings.congeTaxable ? 0 : leaveAllowance
  const taxableLeaveAllowance = settings.congeTaxable ? leaveAllowance : 0

  // SALAIRE BRUT IMPOSABLE = obdavcljivi elementi (BREZ neobdavcljivega nadomestila dopusta)
  const taxableGross =
    baseGrossSalary +
    overtimeFirst8Amount +
    overtimeAfter8Amount +
    nightRegularAmount +
    nightOccasionalAmount +
    sundayAmount +
    publicHolidayAmount +
    bonuses +
    taxableBenefits +
    unusedLeaveCompensation +
    taxableLeaveAllowance -
    leaveDeduction

  // Skupni bruto (za prikaz / strosek): obdavcljivi bruto + neobdavcljivo nadomestilo dopusta
  const grossSalary = taxableGross + nonTaxableLeaveAllowance

  // Osnova prispevkov (s stropom) - SAMO obdavcljivi bruto
  const contributionCeiling = settings.sme * settings.ceilingMultiplier
  const contributionBase = Math.min(taxableGross, contributionCeiling)

  // Prispevki zaposlenega
  const employeeCNAPS = Math.round(contributionBase * settings.employeeCNAPS)
  const employeeOSTIE = Math.round(contributionBase * settings.employeeOSTIE)

  // IRSA osnova (zaokrozeno navzdol na 100 Ar) - iz obdavcljivega bruto
  const irsaBaseRaw = taxableGross - employeeCNAPS - employeeOSTIE
  const irsaBase = Math.floor(irsaBaseRaw / 100) * 100

  // IRSA progresivno
  const grossIRSA = Math.round(progressiveTax(irsaBase, settings.irsaBrackets))
  const dependents = Math.min(n(i.numberOfDependents), settings.maxDependents)
  const dependentDeduction = dependents * settings.dependentAllowance
  const irsaAfterDependents = grossIRSA - dependentDeduction
  let finalIRSA: number
  if (irsaAfterDependents > 0 && irsaAfterDependents < settings.minimumIRSA) {
    finalIRSA = settings.minimumIRSA
  } else {
    finalIRSA = Math.max(irsaAfterDependents, 0)
  }

  // Odbitki + neto
  const employeeAdvances = n(i.employeeAdvances)
  const otherEmployeeDeductions = n(i.otherEmployeeDeductions)
  const totalEmployeeDeductions =
    employeeCNAPS + employeeOSTIE + finalIRSA + employeeAdvances + otherEmployeeDeductions
  // NET IMPOSABLE = obdavcljivi bruto - odbitki
  const netSalary = taxableGross - totalEmployeeDeductions
  // NET A PAYER = net imposable + neobdavcljivo nadomestilo dopusta
  const netToPay = netSalary + nonTaxableLeaveAllowance

  // Delodajalec - prispevki SAMO od obdavcljivega bruto (NE od nadomestila dopusta)
  const employerCNAPS = Math.round(contributionBase * settings.employerCNAPS)
  const employerOSTIE = Math.round(contributionBase * settings.employerOSTIE)
  const employerFMFP = Math.round(contributionBase * settings.employerFMFP)
  const employerContributions = employerCNAPS + employerOSTIE + employerFMFP
  // Skupni strosek = celotni bruto (vkljucno z nadomestilom dopusta) + prispevki delodajalca
  const totalEmployerCost = grossSalary + employerContributions

  return {
    baseGrossSalary,
    hourlyRate,
    overtimeFirst8Amount,
    overtimeAfter8Amount,
    nightRegularAmount,
    nightOccasionalAmount,
    sundayAmount,
    publicHolidayAmount,
    bonuses,
    taxableBenefits,
    unusedLeaveCompensation,
    leaveAllowance,
    leaveDeduction,
    nonTaxableLeaveAllowance,
    taxableGross,
    grossSalary,
    contributionBase,
    contributionCeiling,
    employeeCNAPS,
    employeeOSTIE,
    irsaBase,
    grossIRSA,
    dependentDeduction,
    finalIRSA,
    employeeAdvances,
    otherEmployeeDeductions,
    totalEmployeeDeductions,
    netSalary,
    netToPay,
    employerCNAPS,
    employerOSTIE,
    employerFMFP,
    employerContributions,
    totalEmployerCost,
  }
}

// --- Prispevki delodajalca (samostojno, na osnovo s stropom) ---
export function calcEmployerContributions(
  grossSalary: number,
  settings: PayrollSettings = DEFAULT_PAYROLL_SETTINGS,
) {
  const contributionCeiling = settings.sme * settings.ceilingMultiplier
  const contributionBase = Math.min(grossSalary, contributionCeiling)
  const cnapsEmployer = Math.round(contributionBase * settings.employerCNAPS)
  const ominoEmployer = Math.round(contributionBase * settings.employerOSTIE)
  const fmfpEmployer = Math.round(contributionBase * settings.employerFMFP)
  const totalContributions = cnapsEmployer + ominoEmployer + fmfpEmployer
  return {
    baseSalary: grossSalary,
    contributionBase,
    cnapsEmployer,
    ominoEmployer,
    fmfpEmployer,
    totalContributions,
    totalCost: grossSalary + totalContributions,
  }
}

// --- Cetrtletni prispevki ---
export function getQuarter(month: number): number {
  return Math.floor((month - 1) / 3) + 1
}

export function getQuarterMonths(quarter: number): number[] {
  const start = (quarter - 1) * 3 + 1
  return [start, start + 1, start + 2]
}

// Rok placila: Q1->30.apr, Q2->31.jul, Q3->31.okt, Q4->31.jan naslednje leto
export function getQuarterDeadline(year: number, quarter: number): Date {
  switch (quarter) {
    case 1:
      return new Date(year, 3, 30)
    case 2:
      return new Date(year, 6, 31)
    case 3:
      return new Date(year, 9, 31)
    case 4:
      return new Date(year + 1, 0, 31)
    default:
      return new Date(year, 11, 31)
  }
}

// Cetrtletni prispevki delodajalca iz vsote osnov (s stropom na posamezno osnovo)
export function calcQuarterlyContributions(
  sumOfContributionBases: number,
  settings: PayrollSettings = DEFAULT_PAYROLL_SETTINGS,
) {
  const cnaps = Math.round(sumOfContributionBases * settings.employerCNAPS)
  const omino = Math.round(sumOfContributionBases * settings.employerOSTIE)
  const fmfp = Math.round(sumOfContributionBases * settings.employerFMFP)
  return {
    sumOfBaseSalaries: sumOfContributionBases,
    cnaps,
    omino,
    fmfp,
    total: cnaps + omino + fmfp,
  }
}

// Format Ariary
export function formatAr(value: number): string {
  return new Intl.NumberFormat('fr-FR').format(Math.round(value)) + ' Ar'
}
