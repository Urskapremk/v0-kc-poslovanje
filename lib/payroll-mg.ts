// =====================================================================
// Obracun place - Madagaskar (Claudiin obracun / grossing-up)
// Cisti izracuni (BREZ 'use server'). Vse denarne vrednosti = cela stevila v Ariaryjih.
// NE uporabljaj floating-point za denar: vsi zneski se zaokrozijo na cele Ar.
//
// Kljucna logika (potrjeno z racunovodkinjo Claudia):
//   Osnovna placa = znesek, ki ga mora zaposleni PREJETI (neto).
//   Prispevki zaposlenega (CNAPS, OMINO) in IRSA se vracunajo NAD osnovno placo
//   ("Bruto povecanje za prispevke in IRSA") in se nato prikazejo kot odbitki.
//   Zato pri obracunu brez dodatkov velja: Koncno izplacilo = Osnovna placa.
// =====================================================================

// --- Podjetja (2 podjetji na istem naslovu) ---
// Naslov s davcne kartice (Carte fiscale 2026): Villa Madina I, TFN-4507-E, Andrekareka Be.
export const MG_COMPANY_ADDRESS =
  'Villa Madina I, TFN-4507-E, Andrekareka Be – Nosy Be'

export type MgCompanyId = 'tourism' | 'sarl'

export type MgCompany = {
  name: string
  address: string
  nif?: string        // Numero d'Identification Fiscale (davcna)
  rcs?: string        // Numero RCS
  stat?: string       // Numero Statistique
  taxCenter?: string  // Centre fiscal
}

export const MG_COMPANIES: Record<MgCompanyId, MgCompany> = {
  // Podatki s Carte fiscale 2026 za KOMBA CABANA TOURISM.
  tourism: {
    name: 'KOMBA CABANA TOURISM SARL',
    address: MG_COMPANY_ADDRESS,
    nif: '2003136139',
    rcs: 'NB2018B046',
    stat: '56101 71 2018 0 10452',
    taxCenter: 'Centre Fiscal Nosy Be',
  },
  sarl: {
    name: 'KOMBA CABANA SARL',
    address: MG_COMPANY_ADDRESS,
    taxCenter: 'Centre Fiscal Nosy Be',
  },
}

export function getMgCompany(id: string | null | undefined): MgCompany {
  return MG_COMPANIES[(id as MgCompanyId) || 'tourism'] || MG_COMPANIES.tourism
}

// --- Privzeti mesecni fond ur ---
export const DEFAULT_MONTHLY_HOURS = 173.33

// Delovne ure na dan (za vrednost enega dne dopusta = urna postavka * 8)
export const HOURS_PER_DAY = 8

// --- Saldo dopusta (conges payes) ---
// Malgaski zakon: 2,5 dni dopusta na dopolnjeni mesec dela. Kumulativa od zacetka
// koledarskega leta (oz. meseca zaposlitve, ce je delavec zaposlen sredi leta).
export const LEAVE_ACCRUAL_PER_MONTH = 2.5

export type LeaveBalance = {
  monthsAccrued: number
  accrued: number         // pridobljeni dnevi do konca meseca (2,5 x meseci + prenos)
  used: number            // koristeni dnevi v letu do konca meseca
  remaining: number       // preostali saldo
  asOfISO: string         // zadnji dan meseca (YYYY-MM-DD)
  opening: number         // prenos/popravek dopusta (dni) iz preteklih let
  priorByYear: { year: string; days: number }[]  // razclemba prenosa po letih (npr. 2025: 3, 2024: 2)
}

/**
 * Saldo dopusta za koledarsko leto do KONCA izbranega meseca (vkljucno).
 * accrued = prenos + stevilo mesecev x 2,5 (od januarja oz. meseca zaposlitve).
 * remaining = accrued - used.
 * opening = prenos/popravek dopusta (dni) iz preteklih let ali rocni popravek
 *           (npr. delavec, ki je delal a ni bil pravocasno prijavljen).
 */
export function computeLeaveBalance(opts: {
  year: number
  month: number            // 1-12
  hireISO?: string | null
  usedYtd?: number
  opening?: number         // prenos/popravek dopusta v dnevih (privzeto 0)
  priorByYear?: { year: string; days: number }[]  // razclemba prenosa po letih
}): LeaveBalance {
  const { year, month } = opts
  const used = n(opts.usedYtd)
  const priorByYear = (opts.priorByYear ?? []).filter((p) => n(p.days) > 0)
  // Ce je podana razclemba po letih, je prenos njena vsota; sicer enotno polje opening.
  const opening = priorByYear.length
    ? priorByYear.reduce((a, p) => a + n(p.days), 0)
    : n(opts.opening)
  // Zacetni mesec prirasta: januar, razen ce je delavec zaposlen v tekocem letu.
  let startMonth = 1
  if (opts.hireISO) {
    const h = new Date(opts.hireISO + (opts.hireISO.length <= 10 ? 'T00:00:00Z' : ''))
    if (!isNaN(h.getTime())) {
      const hy = h.getUTCFullYear()
      if (hy > year) startMonth = month + 1           // zaposlen po tem letu -> brez prirasta
      else if (hy === year) startMonth = h.getUTCMonth() + 1
    }
  }
  const monthsAccrued = Math.max(0, month - startMonth + 1)
  const accrued = monthsAccrued * LEAVE_ACCRUAL_PER_MONTH + opening
  const remaining = accrued - used
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const asOfISO = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { monthsAccrued, accrued, used, remaining, asOfISO, opening, priorByYear }
}

// --- Dodatek za delovno dobo (prime d'anciennete) ---
// Malgaski zakon: po 2 dopolnjenih letih 3 %, nato +1 % za vsako nadaljnje leto.
//   < 2 leti = 0 %, 2 leti = 3 %, 3 leta = 4 %, 4 leta = 5 %, ...
export function seniorityRateForYears(years: number): number {
  const y = Math.floor(n(years))
  if (y < 2) return 0
  return (3 + (y - 2)) / 100
}

/** Stevilo DOPOLNJENIH let med zacetkom in datumom obracuna (YYYY-MM-DD). */
export function completedYearsBetween(startISO?: string | null, endISO?: string | null): number {
  if (!startISO) return 0
  const start = new Date(startISO + (startISO.length <= 10 ? 'T00:00:00Z' : ''))
  const end = endISO ? new Date(endISO + (endISO.length <= 10 ? 'T00:00:00Z' : '')) : new Date()
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return 0
  let years = end.getUTCFullYear() - start.getUTCFullYear()
  const mDiff = end.getUTCMonth() - start.getUTCMonth()
  if (mDiff < 0 || (mDiff === 0 && end.getUTCDate() < start.getUTCDate())) years--
  return Math.max(0, years)
}

// --- Kategorije zaposlenih + minimalne place od 1. marca 2026 (Ar) ---
export type WageCategory = {
  code: string
  minWage: number
}

export const DEFAULT_WAGE_CATEGORIES: WageCategory[] = [
  { code: 'M1-1A', minWage: 300000 },
  { code: 'M2-1B', minWage: 305000 },
  { code: 'OS1-2A', minWage: 310000 },
  { code: 'OS2-2B', minWage: 315000 },
  { code: 'OS3-3A', minWage: 320000 },
  { code: 'OP1A-3B', minWage: 325000 },
  { code: 'OP1B-4A', minWage: 330000 },
  { code: 'OP2A-4B', minWage: 335000 },
  { code: 'OP2B-5A', minWage: 378600 },
  { code: 'OP3-5B', minWage: 432100 },
]

// --- Vrste prispevkov (nastavljivo v administraciji) ---
// Vsaka vrsta ima odstotek zaposlenega + delodajalca + datum veljavnosti.
// Prispevki DELODAJALCA se NE odstejejo od izplacila zaposlenega.
export type MgContributionType = {
  id: string
  name: string            // CNAPS, OMINO, FMFP, ...
  employeeRate: number    // delez zaposlenega (npr. 0.01 = 1 %)
  employerRate: number    // delez delodajalca (npr. 0.13 = 13 %)
  startDate: string | null // ISO datum zacetka veljavnosti (npr. "2026-03-01")
  endDate: string | null   // ISO datum konca veljavnosti (null = velja)
}

export const DEFAULT_CONTRIBUTION_TYPES: MgContributionType[] = [
  { id: 'cnaps', name: 'CNAPS', employeeRate: 0.01, employerRate: 0.13, startDate: '2026-01-01', endDate: null },
  { id: 'omino', name: 'OMINO', employeeRate: 0.01, employerRate: 0.065, startDate: '2026-01-01', endDate: null },
  { id: 'fmfp', name: 'FMFP', employeeRate: 0.0, employerRate: 0.01, startDate: '2026-01-01', endDate: null },
]

// --- Nastavitve modula (nastavljivo v administraciji) ---
export type MgPayrollConfig = {
  monthlyHours: number       // privzeto 173.33
  sundayRate: number         // dodatek za nedeljo (privzeto 0.40)
  holidayRate: number        // dodatek za praznik (privzeto 0.40)
  overtimeRate: number       // dodatek za nadure (privzeto 0.30)
  defaultIrsa: number        // privzeta IRSA (privzeto 3000)
  categories: WageCategory[]
  contributionTypes: MgContributionType[]
  // Privzeti francoski naziv postavke povecanja (uporabnik lahko spremeni na izpisu)
  defaultGrossUpLabelFr: string
}

export const DEFAULT_MG_CONFIG: MgPayrollConfig = {
  monthlyHours: DEFAULT_MONTHLY_HOURS,
  sundayRate: 0.4,
  holidayRate: 0.4,
  overtimeRate: 0.3,
  defaultIrsa: 3000,
  categories: DEFAULT_WAGE_CATEGORIES,
  contributionTypes: DEFAULT_CONTRIBUTION_TYPES,
  defaultGrossUpLabelFr: 'Complément brut (cotisations et IRSA)',
}

// --- Vhod obracuna ---
export type MgPayslipInput = {
  baseSalary: number          // osnovna placa (= neto, ki ga prejme zaposleni)
  monthlyHours?: number       // mesecni fond (privzeto config.monthlyHours)
  normalHours?: number        // redne ure (informativno)
  sundayHours?: number        // nedeljske ure
  holidayHours?: number       // ure na praznik
  overtimeHours?: number      // nadure
  sundayRate?: number         // override stopnje (sicer config)
  holidayRate?: number
  overtimeRate?: number
  otherBonuses?: number       // drugi dodatki (Ar)
  contributionBase?: number   // prispevna osnova (privzeto = baseSalary)
  irsa?: number               // IRSA (rocni vnos; privzeto config.defaultIrsa)
  advances?: number           // predujmi
  otherDeductions?: number    // drugi odbitki
  leaveDays?: number          // dnevi dopusta (placani kot navaden delovni dan, informativno)
  seniorityYears?: number     // dopolnjena leta delovne dobe (za dodatek za dobo)
  seniorityRate?: number      // override stopnje dobe (sicer izracun iz let)
}

export type MgContributionLine = {
  id: string
  name: string
  employeeRate: number
  employerRate: number
  employeeAmount: number
  employerAmount: number
}

export type MgPayslip = {
  baseSalary: number
  monthlyHours: number
  hourlyRate: number          // urna postavka (float, le za prikaz)
  dailyRate: number           // vrednost enega navadnega delovnega dne (= hourlyRate * 8)
  // Dopust (placan kot navaden delovni dan; INFORMATIVNO, ne spremeni bruto/izplacila)
  leaveDays: number
  leaveAmount: number
  // Dodatki (z razclembo ur in stopenj za prikaz)
  sundayHours: number
  sundayRate: number          // stopnja kot delez (npr. 0.40 = +40%)
  sundayAmount: number
  holidayHours: number
  holidayRate: number
  holidayAmount: number
  overtimeHours: number
  overtimeRate: number
  overtimeAmount: number
  // Dodatek za delovno dobo (prime d'anciennete)
  seniorityYears: number
  seniorityRate: number       // stopnja kot delez (npr. 0.05 = 5%)
  seniorityAmount: number
  otherBonuses: number
  totalAdditions: number
  // Prispevki
  contributionBase: number
  contributions: MgContributionLine[]
  employeeCnaps: number
  employeeOmino: number
  totalEmployeeContributions: number
  irsa: number
  grossUp: number             // povecanje za prispevke in IRSA
  // Rezultat
  grossPay: number            // bruto obracunska placa
  advances: number
  otherDeductions: number
  totalDeductions: number     // odbitki, ki znizajo bruto -> izplacilo
  netToPay: number            // koncno izplacilo
  // Delodajalec
  employerContributions: number
  totalEmployerCost: number
}

function n(v: number | undefined | null): number {
  return v == null || isNaN(v) ? 0 : v
}

/**
 * Ali je vrsta prispevka veljavna na dani datum obracuna (YYYY-MM-DD).
 * Ce datum obracuna ni podan, upostevamo vse vrste.
 */
export function isContributionActive(t: MgContributionType, onDate?: string | null): boolean {
  if (!onDate) return true
  if (t.startDate && onDate < t.startDate) return false
  if (t.endDate && onDate > t.endDate) return false
  return true
}

/**
 * Glavni izracun placilne liste po Claudiinem obracunu (grossing-up).
 * @param periodDate ISO datum obracuna (za veljavnost stopenj), npr. "2026-06-30".
 */
export function calcMgPayslip(
  input: MgPayslipInput,
  config: MgPayrollConfig = DEFAULT_MG_CONFIG,
  periodDate?: string | null,
): MgPayslip {
  const baseSalary = Math.round(n(input.baseSalary))
  const monthlyHours = (input.monthlyHours ?? config.monthlyHours) || DEFAULT_MONTHLY_HOURS
  const hourlyRate = monthlyHours > 0 ? baseSalary / monthlyHours : 0
  const dailyRate = hourlyRate * HOURS_PER_DAY

  // Dopust: placan kot navaden delovni dan. Ker osnovna placa ze zajema cel mesec
  // (vsi dnevi placani), dopust NE doda dodatnega zneska -> je le informativen
  // (koliko dni je bilo dopusta in kaksna je vrednost enega dne).
  const leaveDays = n(input.leaveDays)
  const leaveAmount = Math.round(leaveDays * dailyRate)

  const sundayRate = input.sundayRate ?? config.sundayRate
  const holidayRate = input.holidayRate ?? config.holidayRate
  const overtimeRate = input.overtimeRate ?? config.overtimeRate

  // Dodatki (zaokrozeni na cele Ar)
  const sundayAmount = Math.round(n(input.sundayHours) * hourlyRate * sundayRate)
  const holidayAmount = Math.round(n(input.holidayHours) * hourlyRate * holidayRate)
  const overtimeAmount = Math.round(n(input.overtimeHours) * hourlyRate * overtimeRate)

  // Dodatek za delovno dobo (prime d'anciennete): odstotek OSNOVNE place.
  // Stopnja iz dopolnjenih let (3 % po 2 letih, +1 %/leto), lahko rocni override.
  const seniorityYears = Math.floor(n(input.seniorityYears))
  const seniorityRate =
    input.seniorityRate != null ? n(input.seniorityRate) : seniorityRateForYears(seniorityYears)
  const seniorityAmount = Math.round(baseSalary * seniorityRate)

  const otherBonuses = Math.round(n(input.otherBonuses))
  const totalAdditions = sundayAmount + holidayAmount + overtimeAmount + seniorityAmount + otherBonuses

  // Prispevna osnova (privzeto = osnovna placa)
  const contributionBase = Math.round(
    input.contributionBase != null ? n(input.contributionBase) : baseSalary,
  )

  // Prispevki po vrstah (samo veljavne na datum obracuna)
  const activeTypes = config.contributionTypes.filter((t) => isContributionActive(t, periodDate))
  const contributions: MgContributionLine[] = activeTypes.map((t) => ({
    id: t.id,
    name: t.name,
    employeeRate: t.employeeRate,
    employerRate: t.employerRate,
    employeeAmount: Math.round(contributionBase * t.employeeRate),
    employerAmount: Math.round(contributionBase * t.employerRate),
  }))

  const employeeCnaps =
    contributions.find((c) => c.id === 'cnaps')?.employeeAmount ??
    contributions.find((c) => /cnaps/i.test(c.name))?.employeeAmount ??
    0
  const employeeOmino =
    contributions.find((c) => c.id === 'omino')?.employeeAmount ??
    contributions.find((c) => /omino|ostie/i.test(c.name))?.employeeAmount ??
    0
  const totalEmployeeContributions = contributions.reduce((s, c) => s + c.employeeAmount, 0)

  // IRSA (rocni vnos; privzeto iz nastavitev).
  // Ce ni osnovne place ne dodatkov (prazen obracun), IRSA = 0 (ni obracuna).
  const hasEarnings = baseSalary > 0 || totalAdditions > 0
  const irsa = !hasEarnings
    ? 0
    : Math.round(input.irsa != null ? n(input.irsa) : config.defaultIrsa)

  // Bruto povecanje za prispevke in IRSA (grossing-up)
  const grossUp = totalEmployeeContributions + irsa

  // Bruto obracunska placa
  const grossPay = baseSalary + totalAdditions + grossUp

  // Odbitki
  const advances = Math.round(n(input.advances))
  const otherDeductions = Math.round(n(input.otherDeductions))
  const totalDeductions = totalEmployeeContributions + irsa + advances + otherDeductions

  // Koncno izplacilo = bruto - odbitki
  //  = osnovna placa + dodatki - predujmi - drugi odbitki
  const netToPay = grossPay - totalDeductions

  // Prispevki delodajalca (NE znizajo izplacila)
  const employerContributions = contributions.reduce((s, c) => s + c.employerAmount, 0)
  const totalEmployerCost = grossPay + employerContributions

  return {
    baseSalary,
    monthlyHours,
    hourlyRate,
    dailyRate,
    leaveDays,
    leaveAmount,
    sundayHours: n(input.sundayHours),
    sundayRate,
    sundayAmount,
    holidayHours: n(input.holidayHours),
    holidayRate,
    overtimeHours: n(input.overtimeHours),
    overtimeRate,
    holidayAmount,
    overtimeAmount,
    seniorityYears,
    seniorityRate,
    seniorityAmount,
    otherBonuses,
    totalAdditions,
    contributionBase,
    contributions,
    employeeCnaps,
    employeeOmino,
    totalEmployeeContributions,
    irsa,
    grossUp,
    grossPay,
    advances,
    otherDeductions,
    totalDeductions,
    netToPay,
    employerContributions,
    totalEmployerCost,
  }
}

// --- Pomozne funkcije ---

/** Poisci minimalno placo za kategorijo. */
export function minWageForCategory(
  code: string | null | undefined,
  config: MgPayrollConfig = DEFAULT_MG_CONFIG,
): number | null {
  if (!code) return null
  const c = config.categories.find((x) => x.code === code)
  return c ? c.minWage : null
}

/** Ali je osnovna placa pod zakonskim minimumom kategorije. */
export function isBelowMinimum(
  baseSalary: number,
  code: string | null | undefined,
  config: MgPayrollConfig = DEFAULT_MG_CONFIG,
): boolean {
  const min = minWageForCategory(code, config)
  return min != null && baseSalary < min
}

/** Format Ariary (npr. "268 700 Ar"). */
export function formatMgAr(value: number): string {
  return new Intl.NumberFormat('fr-FR').format(Math.round(value)) + ' Ar'
}

// --- Kontrolni primer (navodilo, tocka 10) ---
// Osnovna placa 268.700, CNAPS 1 %, OMINO 1 %, IRSA 3.000
//  -> prispevki+IRSA = 8.374 ; bruto = 277.074 ; koncno = 268.700
export function runControlTest(): { ok: boolean; result: MgPayslip; expected: Record<string, number> } {
  const result = calcMgPayslip({ baseSalary: 268700, irsa: 3000 }, DEFAULT_MG_CONFIG, '2026-06-30')
  const expected = {
    employeeCnaps: 2687,
    employeeOmino: 2687,
    irsa: 3000,
    grossUp: 8374,
    grossPay: 277074,
    netToPay: 268700,
  }
  const ok =
    result.employeeCnaps === expected.employeeCnaps &&
    result.employeeOmino === expected.employeeOmino &&
    result.irsa === expected.irsa &&
    result.grossUp === expected.grossUp &&
    result.grossPay === expected.grossPay &&
    result.netToPay === expected.netToPay
  return { ok, result, expected }
}
