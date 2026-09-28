// Dopusti (Leave / Congé) - Komba Cabana
// Cisti tipi/konstante/pomozne funkcije (BREZ 'use server')

export type LeaveDepartment = 'housekeeper' | 'gardener' | 'kitchen' | 'barman'

// Madagaskar: 2,5 dni/mesec = 30 dni rednega letnega dopusta
export const LEAVE_ANNUAL_QUOTA = 30
export const LEAVE_DAYS_PER_MONTH = 2.5

// Ali je seznam aktivnih mesecev "delna" oznaka (delavec ni celo leto v službi).
// Prazno ali polnih 12 mesecev = ni omejitve -> uporabi datum zaposlitve.
function partialActiveMonths(activeMonths?: number[] | null): number[] | null {
  if (!activeMonths || activeMonths.length === 0) return null
  const valid = activeMonths.filter((m) => m >= 1 && m <= 12)
  if (valid.length === 0 || valid.length >= 12) return null
  return valid
}

// Sorazmerna letna kvota glede na datum zaposlitve (startDate) ali označene aktivne mesece.
// Madagaskar: 2,5 dni za vsak mesec dela v koledarskem letu.
// - ce so v seznamu osebja označeni aktivni meseci (od kdaj je v službi) -> šteje te mesece
// - sicer: zaposlen pred tem letom (ali brez datuma) -> polnih 30 dni
// - ce zacne sredi leta -> steje od zacetnega meseca do decembra
// - ce zacne sele naslednje leto -> 0 dni
export function proratedAnnualQuota(
  year: number,
  startDate?: string | null,
  activeMonths?: number[] | null,
): number {
  const active = partialActiveMonths(activeMonths)
  if (active) {
    return Math.round(active.length * LEAVE_DAYS_PER_MONTH * 2) / 2
  }
  if (!startDate) return LEAVE_ANNUAL_QUOTA
  const s = new Date(startDate + 'T00:00:00')
  if (isNaN(s.getTime())) return LEAVE_ANNUAL_QUOTA
  const startYear = s.getFullYear()
  if (startYear < year) return LEAVE_ANNUAL_QUOTA
  if (startYear > year) return 0
  // zacetni mesec v tem letu se steje kot cel mesec
  const months = 12 - s.getMonth() // getMonth: 0=jan ... za maj(4) -> 8
  return Math.round(months * LEAVE_DAYS_PER_MONTH * 2) / 2
}

export const LEAVE_DEPARTMENTS: Record<LeaveDepartment, { sl: string; fr: string; en: string }> = {
  housekeeper: { sl: 'Sobarice', fr: 'Femme de chambre', en: 'Housekeeping' },
  gardener: { sl: 'Vrtnarji', fr: 'Jardinier', en: 'Gardener' },
  kitchen: { sl: 'Kuhinja', fr: 'Cuisine', en: 'Kitchen' },
  barman: { sl: 'Bar', fr: 'Bar', en: 'Bar' },
}

export type LeaveType = 'annual' | 'sick' | 'unpaid'

export const LEAVE_TYPES: Record<LeaveType, { sl: string; fr: string; en: string }> = {
  annual: { sl: 'Redni dopust', fr: 'Congé annuel payé', en: 'Paid annual leave' },
  sick: { sl: 'Bolniški dopust', fr: 'Congé de maladie', en: 'Sick leave' },
  unpaid: { sl: 'Neplačan dopust', fr: 'Congé sans solde', en: 'Unpaid leave' },
}

export interface LeaveRequest {
  id: string
  staffId: string
  staffName: string
  department: string
  company: string
  leaveType: string
  startDate: string
  endDate: string
  days: number
  reason: string
  status: string
  signedAt: string | null
  signedDocumentPath?: string | null
  createdAt: string
}

// Stevilo dni (vkljucno z obema datumoma)
export function daysBetween(start: string, end: string): number {
  if (!start || !end) return 0
  const s = new Date(start + 'T00:00:00')
  const e = new Date(end + 'T00:00:00')
  const diff = Math.round((e.getTime() - s.getTime()) / 86400000)
  return diff >= 0 ? diff + 1 : 0
}

const MONTHS_FR = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
]

const MONTHS_SL = [
  'januar', 'februar', 'marec', 'april', 'maj', 'junij',
  'julij', 'avgust', 'september', 'oktober', 'november', 'december',
]

export function leaveDateFr(d: string | null): string {
  if (!d) return ''
  const dt = new Date(d + 'T00:00:00')
  return `${dt.getDate()} ${MONTHS_FR[dt.getMonth()]} ${dt.getFullYear()}`
}

export function leaveDateSl(d: string | null): string {
  if (!d) return ''
  const dt = new Date(d + 'T00:00:00')
  return `${dt.getDate()}. ${MONTHS_SL[dt.getMonth()]} ${dt.getFullYear()}`
}

// Sesteje porabljene dni dopusta za doloceno koledarsko leto (vse vrste skupaj).
// Dopust se steje v leto svojega zacetnega datuma.
export function usedDaysInYear(requests: LeaveRequest[], year: number): number {
  return requests
    .filter(r => new Date(r.startDate + 'T00:00:00').getFullYear() === year)
    .reduce((sum, r) => sum + (r.days || 0), 0)
}

// Normalizira ime za primerjavo (mala crka, brez sumnikov). Razporedi uporabljajo
// nekoliko drugacne zapise (npr. Nazira/Nazirah, Selvira/Selvera) kot HR baza.
function normName(name: string): string {
  return (name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

// Toleranten ujemalnik imen: ujema se, ce se prvih 4 crk ujema (Nazir~, Selv~ ...).
export function namesMatch(a: string, b: string): boolean {
  const na = normName(a)
  const nb = normName(b)
  if (!na || !nb) return false
  if (na === nb) return true
  const key = Math.min(4, na.length, nb.length)
  return na.slice(0, key) === nb.slice(0, key)
}

// =====================================================================
// IZRACUN STANJA DOPUSTA (za obracun plac)
// =====================================================================

// Stevilo (celih) mesecev dela v koledarskem letu do vkljucno danega meseca.
// - ce so označeni aktivni meseci (od kdaj je v službi) -> šteje aktivne mesece <= uptoMonth
// - zaposlen pred letom (ali brez datuma) -> od januarja (= uptoMonth)
// - zaposlen sredi leta -> od zacetnega meseca
// - zaposlen sele naslednje leto -> 0
export function monthsWorkedInYear(
  startDate: string | null | undefined,
  year: number,
  uptoMonth: number,
  activeMonths?: number[] | null,
): number {
  const active = partialActiveMonths(activeMonths)
  if (active) {
    return active.filter((m) => m <= uptoMonth).length
  }
  let startMonth = 1
  if (startDate) {
    const s = new Date(startDate + 'T00:00:00')
    if (!isNaN(s.getTime())) {
      if (s.getFullYear() > year) return 0
      if (s.getFullYear() === year) startMonth = s.getMonth() + 1
    }
  }
  return Math.max(0, uptoMonth - startMonth + 1)
}

// Sesteje SAMO redni letni dopust (annual), ki se zacne v danem letu in mesecu <= uptoMonth.
export function annualLeaveTaken(
  requests: LeaveRequest[],
  year: number,
  uptoMonth: number,
): number {
  return requests
    .filter(r => {
      if (r.leaveType !== 'annual') return false
      const d = new Date(r.startDate + 'T00:00:00')
      return d.getFullYear() === year && d.getMonth() + 1 <= uptoMonth
    })
    .reduce((sum, r) => sum + (r.days || 0), 0)
}

export type LeaveParams = {
  monthlyAccrual: number       // privzeto 2.5
  annualEntitlement: number    // privzeto 30
  allowCarryForward: boolean
  maxCarryForwardDays: number  // 0 = brez omejitve
}

export type LeaveSummary = {
  openingBalance: number       // upostevan prenos (po pravilih)
  earnedYtd: number            // priraslo od zacetka leta do tega meseca (vkljucno)
  takenYtd: number             // izkoriscen letni dopust do tega meseca (vkljucno)
  balanceBefore: number        // stanje pred tem mesecem
  earnedThisMonth: number      // priraslo ta mesec
  takenThisMonth: number       // izkoriscen letni dopust ta mesec
  remaining: number            // preostalo stanje po tem mesecu (tekoce + pretekla leta)
  referenceAmount: number      // ZAKONSKO: 1/12 placila prejsnjih 12 mesecev (povprecna mesecna osnova)
  // Razclenitev po letih (najprej koristimo tekoce leto, nato pretekla leta)
  priorYearsBalance: number      // dopust iz preteklih let (na voljo na zacetku leta)
  currentYearEarned: number      // priraslo v tekocem letu (do vkljucno tega meseca)
  takenFromCurrent: number       // koliko izkoriscenega je slo iz tekocega leta
  takenFromPrior: number         // koliko izkoriscenega je slo iz preteklih let
  currentYearRemaining: number   // preostalo iz tekocega leta
  priorYearsRemaining: number    // preostalo iz preteklih let
  priorByYear: Record<string, number>  // dopust preteklih let, razclenjen po letu (npr. {"2025":3,"2024":2,"2023":0})
}

// Zakonska referenca (Code du Travail clen 131): nadomestilo dopusta >= 1/12 placila zadnjih 12 mesecev.
export type LeaveCalcMethod = 'SALARY_MAINTENANCE' | 'ALLOWANCE_ONLY' | 'CUSTOM'

// Dnevno nadomestilo dopusta iz zakonske reference.
export function dailyLeaveAllowance(referenceAmount: number, allowanceDivisor: number): number {
  const d = allowanceDivisor > 0 ? allowanceDivisor : 30
  return referenceAmount / d
}

export type LeavePay = {
  deduction: number   // odbitek dopusta (zmanjsa bruto)
  allowance: number   // nadomestilo dopusta (poveca bruto)
  net: number         // neto ucinek na placo (allowance - deduction)
}

// Izracun placila dopusta za dane dni v mesecu po izbrani metodi.
export function computeLeavePay(args: {
  method: LeaveCalcMethod
  daysTaken: number
  baseSalary: number       // osnova za odbitek
  referenceAmount: number  // osnova za nadomestilo (1/12 zadnjih 12 mes)
  deductionDivisor: number
  allowanceDivisor: number
}): LeavePay {
  const { method, daysTaken, baseSalary, referenceAmount, deductionDivisor, allowanceDivisor } = args
  if (method === 'SALARY_MAINTENANCE' || daysTaken <= 0) {
    return { deduction: 0, allowance: 0, net: 0 }
  }
  const dedDiv = deductionDivisor > 0 ? deductionDivisor : 30
  const allDiv = allowanceDivisor > 0 ? allowanceDivisor : 30
  const allowance = Math.round((referenceAmount / allDiv) * daysTaken)
  // ALLOWANCE_ONLY: nadomestilo se PRISTEJE vsem, brez odbitka (osnova ze krije cel mesec).
  // CUSTOM: administrator lahko vklopi tudi odbitek (osnova / delitelj x dni).
  const deduction =
    method === 'CUSTOM' ? Math.round((baseSalary / dedDiv) * daysTaken) : 0
  return { deduction, allowance, net: allowance - deduction }
}

// Izracuna celovito stanje dopusta za delavca v danem mesecu/letu.
export function computeLeaveSummary(args: {
  rawOpeningBalance: number
  startDate: string | null | undefined
  requests: LeaveRequest[]
  year: number
  month: number
  params: LeaveParams
  referenceAmount?: number
  activeMonths?: number[] | null
  priorByYear?: Record<string, number> | null
}): LeaveSummary {
  const { rawOpeningBalance, startDate, requests, year, month, params, referenceAmount = 0, activeMonths, priorByYear } = args

  // Prenos po pravilih (dovoljen? omejen?)
  let openingBalance = params.allowCarryForward ? Math.max(0, rawOpeningBalance) : 0
  if (params.allowCarryForward && params.maxCarryForwardDays > 0) {
    openingBalance = Math.min(openingBalance, params.maxCarryForwardDays)
  }

  const monthsToPrev = monthsWorkedInYear(startDate, year, Math.max(0, month - 1), activeMonths)
  const monthsToNow = monthsWorkedInYear(startDate, year, month, activeMonths)
  const earnedThisMonth = monthsToNow > monthsToPrev ? params.monthlyAccrual : 0
  const earnedYtd = monthsToNow * params.monthlyAccrual

  const takenYtd = annualLeaveTaken(requests, year, month)
  const takenToPrev = annualLeaveTaken(requests, year, Math.max(0, month - 1))
  const takenThisMonth = Math.max(0, takenYtd - takenToPrev)

  const balanceBefore = openingBalance + monthsToPrev * params.monthlyAccrual - takenToPrev
  const remaining = openingBalance + earnedYtd - takenYtd

  // Razclenitev koriscenja po letih: NAJPREJ porabimo dopust tekocega leta,
  // sele ko ga zmanjka, porabljamo dopust iz preteklih let (openingBalance).
  const priorYearsBalance = openingBalance
  const currentYearEarned = earnedYtd
  const takenFromCurrent = Math.min(takenYtd, currentYearEarned)
  const takenFromPrior = Math.max(0, takenYtd - currentYearEarned)
  const currentYearRemaining = currentYearEarned - takenFromCurrent
  const priorYearsRemaining = priorYearsBalance - takenFromPrior

  return {
    openingBalance,
    earnedYtd,
    takenYtd,
    balanceBefore,
    earnedThisMonth,
    takenThisMonth,
    remaining,
    referenceAmount,
    priorYearsBalance,
    currentYearEarned,
    takenFromCurrent,
    takenFromPrior,
    currentYearRemaining,
    priorYearsRemaining,
    priorByYear: priorByYear ?? {},
  }
}

export type LeaveDayInfo = { type: string }

// Vrne mapo: stevilka dneva v mesecu (1..31) -> info o dopustu za danega delavca.
// Uporabi se za vizualno oznacevanje razporeda (izmena ostane nespremenjena).
export function leaveDaysForStaff(
  leaves: LeaveRequest[],
  staffName: string,
  year: number,
  month: number,
): Record<number, LeaveDayInfo> {
  const out: Record<number, LeaveDayInfo> = {}
  for (const l of leaves) {
    if (!namesMatch(l.staffName, staffName)) continue
    const start = new Date(l.startDate + 'T00:00:00')
    const end = new Date(l.endDate + 'T00:00:00')
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      if (d.getFullYear() === year && d.getMonth() === month - 1) {
        out[d.getDate()] = { type: l.leaveType }
      }
    }
  }
  return out
}
