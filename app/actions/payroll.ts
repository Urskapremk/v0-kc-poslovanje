'use server'

import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import {
  calcPayslip,
  calcQuarterlyContributions,
  getQuarterMonths,
  getQuarterDeadline,
  getQuarter,
  DEFAULT_NET_SALARY,
  DEFAULT_PAYROLL_SETTINGS,
  type PayrollSettings,
} from '@/lib/payroll'
import {
  computeLeaveSummary,
  type LeaveRequest,
  type LeaveSummary,
} from '@/lib/leave'
import { generateKitchenSchedule } from '@/lib/kitchen'
import { generateGardenerSchedule } from '@/lib/gardening'
import { generateBarSchedule } from '@/lib/bar'
import { getHousekeepingSchedule } from './housekeeping'
import { housekeepingDay } from '@/lib/housekeeping'

// --- Mesecni obracun (payroll_entries) ---

function num(v: unknown): number {
  const n = Number(v)
  return isNaN(n) ? 0 : n
}

// Bruto iz shranjene vrstice payroll_entries (osnova za referencni znesek dopusta).
function grossOfRow(r: Record<string, unknown>, settings: PayrollSettings): number {
  return calcPayslip(
    {
      baseGrossSalary: num(r.baseSalary),
      overtimeFirst8Hours: num(r.overtimeFirst8Hours),
      overtimeAfter8Hours: num(r.overtimeAfter8Hours),
      nightRegularHours: num(r.nightRegularHours),
      nightOccasionalHours: num(r.nightOccasionalHours),
      sundayHours: num(r.sundayHours),
      publicHolidayHours: num(r.publicHolidayHours),
      bonuses: num(r.bonus),
      taxableBenefits: num(r.taxableBenefits),
      unusedLeaveCompensation: num(r.unusedLeaveCompensation),
    },
    settings,
  ).grossSalary
}

// Zakonski referencni znesek dopusta (Code du Travail clen 131):
// povprecna mesecna remuneracija prejsnjih (do) 12 mesecev = 1/12 letnega placila.
// Ce ni zgodovine, vrne fallbackBase (npr. trenutno osnovo).
export async function computeLeaveReferenceAmount(
  staffId: string,
  year: number,
  month: number,
  settings?: PayrollSettings,
  fallbackBase = 0,
): Promise<number> {
  const cfg = settings ?? (await getPayrollSettings())
  const endKey = year * 12 + (month - 1) - 1 // prejsnji mesec
  const startKey = endKey - 11 // 12 mesecev nazaj
  const rows = await db.execute(
    sql`SELECT * FROM payroll_entries
        WHERE "staffId" = ${staffId}
          AND (year * 12 + month - 1) BETWEEN ${startKey} AND ${endKey}`
  )
  if (rows.rows.length === 0) return Math.round(fallbackBase)
  const total = rows.rows.reduce(
    (s, r) => s + grossOfRow(r as Record<string, unknown>, cfg),
    0,
  )
  return Math.round(total / Math.min(12, rows.rows.length))
}

export async function getPayrollEntries(year: number, month: number) {
  const result = await db.execute(
    sql`SELECT * FROM payroll_entries WHERE year = ${year} AND month = ${month}`
  )
  return result.rows.map((r) => ({
    id: r.id as string,
    staffId: r.staffId as string,
    staffName: r.staffName as string,
    year: r.year as number,
    month: r.month as number,
    baseSalary: num(r.baseSalary),
    overtimeFirst8Hours: num(r.overtimeFirst8Hours),
    overtimeAfter8Hours: num(r.overtimeAfter8Hours),
    nightRegularHours: num(r.nightRegularHours),
    nightOccasionalHours: num(r.nightOccasionalHours),
    sundayHours: num(r.sundayHours),
    publicHolidayHours: num(r.publicHolidayHours),
    bonus: num(r.bonus),
    taxableBenefits: num(r.taxableBenefits),
    advances: num(r.advances),
    otherDeductions: num(r.otherDeductions),
    netPayout: num(r.netPayout),
    tips: num(r.tips),
    unusedLeaveCompensation: num(r.unusedLeaveCompensation),
    leaveReferenceAmount: num(r.leaveReferenceAmount),
    classification: (r.classification as string) ?? null,
    indexValue: (r.indexValue as string) ?? null,
    cashPaidExpenseId: (r.cashPaidExpenseId as string) ?? null,
    cashPaidDate: (r.cashPaidDate as string) ?? null,
  }))
}

// Napitnina od gostov (samo zapis pri delavcu — NE gre iz blagajne, NE vpliva
// na obračun/davke). Lahek upsert samo za stolpec tips; če vnos za mesec še
// ne obstaja, ustvari minimalno vrstico (baseSalary 0).
export async function setStaffTips(params: {
  staffId: string
  staffName: string
  year: number
  month: number
  amount: number
}) {
  const { staffId, staffName, year, month } = params
  const amount = Math.round(params.amount || 0)
  const existing = await db.execute(
    sql`SELECT id FROM payroll_entries
        WHERE "staffId" = ${staffId} AND year = ${year} AND month = ${month} LIMIT 1`
  )
  if (existing.rows[0]?.id) {
    await db.execute(
      sql`UPDATE payroll_entries SET "tips" = ${amount}
          WHERE "staffId" = ${staffId} AND year = ${year} AND month = ${month}`
    )
  } else {
    const id = `pay-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    await db.execute(
      sql`INSERT INTO payroll_entries (id, "staffId", "staffName", year, month, "baseSalary", "tips")
          VALUES (${id}, ${staffId}, ${staffName}, ${year}, ${month}, 0, ${amount})`
    )
  }
  revalidatePath('/statistika')
  return { ok: true }
}

// Vpiši isto napitnino vsem naštetim delavcem za dani mesec (npr. 180.000 vsem).
export async function setTipsForAll(params: {
  staff: { id: string; staffName: string }[]
  year: number
  month: number
  amount: number
}) {
  const { staff, year, month, amount } = params
  for (const s of staff) {
    await setStaffTips({ staffId: s.id, staffName: s.staffName, year, month, amount })
  }
  revalidatePath('/statistika')
  return { count: staff.length }
}

// Označi plačo delavca kot izplačano z gotovino → ustvari odhodek v blagajni
// (bank_cash_expenses) in shrani njegov id na payroll_entries za razveljavitev.
// Idempotentno: če je že plačano (cashPaidExpenseId), ne naredi nič.
export async function markSalaryPaidCash(params: {
  staffId: string
  staffName: string
  year: number
  month: number
  amount: number
  date: string
  company?: string
}) {
  const { staffId, staffName, year, month, amount, date } = params
  const company = params.company || 'tourism'
  const existing = await db.execute(
    sql`SELECT "cashPaidExpenseId" FROM payroll_entries
        WHERE "staffId" = ${staffId} AND year = ${year} AND month = ${month} LIMIT 1`
  )
  const already = existing.rows[0]?.cashPaidExpenseId as string | null | undefined
  if (already) return { id: already }

  const { addCashExpense } = await import('./banka')
  const monthNames = ['januar', 'februar', 'marec', 'april', 'maj', 'junij', 'julij', 'avgust', 'september', 'oktober', 'november', 'december']
  const purpose = `Plača ${monthNames[month - 1]} ${year} — ${staffName}`

  // Dedup pred blagajno: če za tega delavca/mesec v blagajni ŽE obstaja odhodek
  // plače z enakim (determinističnim) opisom, ga PONOVNO uporabimo namesto
  // ustvarjanja novega. Tako večkratni klik ali manjkajoča/izbrisana oznaka
  // ne ustvari dvojnih vnosov v blagajno.
  const dup = await db.execute(
    sql`SELECT id FROM bank_cash_expenses WHERE purpose = ${purpose} ORDER BY "createdAt" ASC LIMIT 1`
  )
  let id = dup.rows[0]?.id as string | undefined
  if (!id) {
    const created = await addCashExpense({ company, date, purpose, amount: Math.round(amount) })
    id = created.id
  }

  // Če vnos plače za ta mesec še ne obstaja (npr. „ostali" delavec brez shranjenega
  // vnosa), ga ustvarimo — sicer UPDATE ne bi zadel nobene vrstice in oznaka
  // „plačano" se ne bi shranila (gumb bi ostal, žiga ne bi bilo).
  const hasRow = existing.rows.length > 0
  if (hasRow) {
    await db.execute(
      sql`UPDATE payroll_entries
          SET "cashPaidExpenseId" = ${id}, "cashPaidDate" = ${date}
          WHERE "staffId" = ${staffId} AND year = ${year} AND month = ${month}`
    )
  } else {
    const newId = `pay-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    await db.execute(
      sql`INSERT INTO payroll_entries (id, "staffId", "staffName", year, month, "baseSalary", "cashPaidExpenseId", "cashPaidDate")
          VALUES (${newId}, ${staffId}, ${staffName}, ${year}, ${month}, ${Math.round(amount)}, ${id}, ${date})`
    )
  }
  revalidatePath('/statistika')
  return { id }
}

// Razveljavi gotovinsko izplačilo: izbriši blagajniški odhodek in počisti oznako.
export async function unmarkSalaryPaidCash(params: {
  staffId: string
  year: number
  month: number
}) {
  const { staffId, year, month } = params
  const existing = await db.execute(
    sql`SELECT "cashPaidExpenseId" FROM payroll_entries
        WHERE "staffId" = ${staffId} AND year = ${year} AND month = ${month} LIMIT 1`
  )
  const expenseId = existing.rows[0]?.cashPaidExpenseId as string | null | undefined
  if (expenseId) {
    const { deleteCashExpense } = await import('./banka')
    await deleteCashExpense(expenseId)
  }
  await db.execute(
    sql`UPDATE payroll_entries
        SET "cashPaidExpenseId" = NULL, "cashPaidDate" = NULL
        WHERE "staffId" = ${staffId} AND year = ${year} AND month = ${month}`
  )
  revalidatePath('/statistika')
  return { ok: true }
}

export type PayrollEntryInput = {
  staffId: string
  staffName: string
  year: number
  month: number
  baseSalary: number
  overtimeFirst8Hours?: number
  overtimeAfter8Hours?: number
  nightRegularHours?: number
  nightOccasionalHours?: number
  sundayHours?: number
  publicHolidayHours?: number
  bonus?: number
  taxableBenefits?: number
  advances?: number
  otherDeductions?: number
  netPayout?: number
  unusedLeaveCompensation?: number
  classification?: string | null
  indexValue?: string | null
}

export async function upsertPayrollEntry(data: PayrollEntryInput) {
  const n = (v: number | undefined) => (v == null || isNaN(v) ? 0 : v)
  const overtimeFirst8Hours = n(data.overtimeFirst8Hours)
  const overtimeAfter8Hours = n(data.overtimeAfter8Hours)
  const nightRegularHours = n(data.nightRegularHours)
  const nightOccasionalHours = n(data.nightOccasionalHours)
  const sundayHours = n(data.sundayHours)
  const publicHolidayHours = n(data.publicHolidayHours)
  const bonus = n(data.bonus)
  const taxableBenefits = n(data.taxableBenefits)
  const advances = n(data.advances)
  const otherDeductions = n(data.otherDeductions)
  const netPayout = n(data.netPayout)
  const unusedLeaveCompensation = n(data.unusedLeaveCompensation)
  const classification = data.classification ?? null
  const indexValue = data.indexValue ?? null
  // ZAKONSKO: shrani 1/12 placila prejsnjih 12 mesecev (referenca za dopust)
  const leaveReferenceAmount = await computeLeaveReferenceAmount(
    data.staffId, data.year, data.month, undefined, data.baseSalary,
  )

  const existing = await db.execute(
    sql`SELECT id FROM payroll_entries WHERE "staffId" = ${data.staffId} AND year = ${data.year} AND month = ${data.month} LIMIT 1`
  )

  if (existing.rows.length > 0) {
    const id = existing.rows[0].id as string
    await db.execute(
      sql`UPDATE payroll_entries SET
            "baseSalary" = ${data.baseSalary},
            "staffName" = ${data.staffName},
            "overtimeFirst8Hours" = ${overtimeFirst8Hours},
            "overtimeAfter8Hours" = ${overtimeAfter8Hours},
            "nightRegularHours" = ${nightRegularHours},
            "nightOccasionalHours" = ${nightOccasionalHours},
            "sundayHours" = ${sundayHours},
            "publicHolidayHours" = ${publicHolidayHours},
            "bonus" = ${bonus},
            "taxableBenefits" = ${taxableBenefits},
            "advances" = ${advances},
            "otherDeductions" = ${otherDeductions},
            "netPayout" = ${netPayout},
            "unusedLeaveCompensation" = ${unusedLeaveCompensation},
            "leaveReferenceAmount" = ${leaveReferenceAmount},
            "classification" = ${classification},
            "indexValue" = ${indexValue}
          WHERE id = ${id}`
    )
    revalidatePath('/statistika')
    return id
  }

  const id = `pay-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  await db.execute(
    sql`INSERT INTO payroll_entries
          (id, "staffId", "staffName", year, month, "baseSalary",
           "overtimeFirst8Hours", "overtimeAfter8Hours", "nightRegularHours", "nightOccasionalHours",
           "sundayHours", "publicHolidayHours", "bonus", "taxableBenefits",
           "advances", "otherDeductions", "netPayout", "unusedLeaveCompensation", "leaveReferenceAmount", "classification", "indexValue")
        VALUES (${id}, ${data.staffId}, ${data.staffName}, ${data.year}, ${data.month}, ${data.baseSalary},
           ${overtimeFirst8Hours}, ${overtimeAfter8Hours}, ${nightRegularHours}, ${nightOccasionalHours},
           ${sundayHours}, ${publicHolidayHours}, ${bonus}, ${taxableBenefits},
           ${advances}, ${otherDeductions}, ${netPayout}, ${unusedLeaveCompensation}, ${leaveReferenceAmount}, ${classification}, ${indexValue})`
  )
  revalidatePath('/statistika')
  return id
}

export async function deletePayrollEntry(id: string) {
  await db.execute(sql`DELETE FROM payroll_entries WHERE id = ${id}`)
  revalidatePath('/statistika')
}

// --- Nastavitve plac (urejljive formule + IRSA lestvica) ---

const PAYROLL_SETTINGS_KEY = 'payroll_settings'

export async function getPayrollSettings(): Promise<PayrollSettings> {
  const result = await db.execute(
    sql`SELECT value FROM settings WHERE key = ${PAYROLL_SETTINGS_KEY} LIMIT 1`
  )
  if (result.rows.length === 0) return { ...DEFAULT_PAYROLL_SETTINGS }
  try {
    const parsed = JSON.parse(result.rows[0].value as string)
    return {
      ...DEFAULT_PAYROLL_SETTINGS,
      ...parsed,
      irsaBrackets:
        Array.isArray(parsed.irsaBrackets) && parsed.irsaBrackets.length > 0
          ? parsed.irsaBrackets
          : DEFAULT_PAYROLL_SETTINGS.irsaBrackets,
    }
  } catch {
    return { ...DEFAULT_PAYROLL_SETTINGS }
  }
}

export async function updatePayrollSettings(settings: PayrollSettings) {
  const value = JSON.stringify(settings)
  const existing = await db.execute(
    sql`SELECT id FROM settings WHERE key = ${PAYROLL_SETTINGS_KEY} LIMIT 1`
  )
  if (existing.rows.length > 0) {
    await db.execute(
      sql`UPDATE settings SET value = ${value}, "updatedAt" = ${new Date().toISOString()} WHERE key = ${PAYROLL_SETTINGS_KEY}`
    )
  } else {
    const id = `set-${PAYROLL_SETTINGS_KEY}`
    await db.execute(
      sql`INSERT INTO settings (id, key, value) VALUES (${id}, ${PAYROLL_SETTINGS_KEY}, ${value})`
    )
  }
  revalidatePath('/statistika')
}

// --- Master data delavca za placilno listo ---
// Klasifikacija + indeks iz pogodbe; CNAPS/OSTIE st., vzdrzevane osebe, datum zaposlitve iz kadrovske evidence
export async function getStaffPayrollInfo(staffId: string) {
  const contract = await db.execute(
    sql`SELECT category, "index", "jobTitle" FROM contracts
        WHERE "staffId" = ${staffId}
        ORDER BY (status = 'active') DESC, "startDate" DESC
        LIMIT 1`
  )
  const staff = await db.execute(
    sql`SELECT "cnapsNumber", "ostieNumber", "ominoNumber", "numberOfDependents", "startDate", "openingLeaveBalance"
        FROM staff_members WHERE id = ${staffId} LIMIT 1`
  )
  return {
    classification: (contract.rows[0]?.category as string) ?? null,
    indexValue: (contract.rows[0]?.index as string) ?? null,
    cnapsNumber: (staff.rows[0]?.cnapsNumber as string) ?? null,
    ostieNumber:
      (staff.rows[0]?.ostieNumber as string) ?? (staff.rows[0]?.ominoNumber as string) ?? null,
    numberOfDependents: num(staff.rows[0]?.numberOfDependents),
    startDate: (staff.rows[0]?.startDate as string) ?? null,
    openingLeaveBalance: num(staff.rows[0]?.openingLeaveBalance),
    position: (contract.rows[0]?.jobTitle as string) ?? null,
  }
}

// Vsi master podatki rednih zaposlenih (za hitri prikaz v obracunu)
export async function getAllStaffPayrollInfo() {
  const rows = await db.execute(
    sql`SELECT id, "cnapsNumber", "ostieNumber", "ominoNumber", "numberOfDependents" FROM staff_members`
  )
  const map: Record<string, { cnapsNumber: string | null; ostieNumber: string | null; numberOfDependents: number }> = {}
  for (const r of rows.rows) {
    map[r.id as string] = {
      cnapsNumber: (r.cnapsNumber as string) ?? null,
      ostieNumber: (r.ostieNumber as string) ?? (r.ominoNumber as string) ?? null,
      numberOfDependents: num(r.numberOfDependents),
    }
  }
  return map
}

// --- Stanje dopusta (za obracun plac) ---
// Vrne mapo staffId -> LeaveSummary za dani mesec/leto.
// Upostevani so SAMO redni letni dopusti (annual) iz leave_requests.
export async function getStaffLeaveSummaries(
  year: number,
  month: number,
): Promise<Record<string, LeaveSummary>> {
  const settings = await getPayrollSettings()
  const params = {
    monthlyAccrual: settings.monthlyLeaveAccrual,
    annualEntitlement: settings.annualLeaveEntitlement,
    allowCarryForward: settings.allowCarryForward,
    maxCarryForwardDays: settings.maxCarryForwardDays,
  }

  const staffResult = await db.execute(
    sql`SELECT id, "startDate", "openingLeaveBalance", "monthlySalary", "activeMonths", "priorLeaveByYear" FROM staff_members WHERE "isRegularEmployee" = true`
  )
  // Zadnja 3 pretekla leta glede na izbrano leto (npr. 2026 -> 2025, 2024, 2023)
  const priorYearKeys = [year - 1, year - 2, year - 3].map(String)

  // Referencni znesek dopusta (povprecna mesecna remuneracija prejsnjih do 12 mesecev) za vse zaposlene v eni poizvedbi.
  const endKey = year * 12 + (month - 1) - 1
  const startKey = endKey - 11
  const histResult = await db.execute(
    sql`SELECT * FROM payroll_entries WHERE (year * 12 + month - 1) BETWEEN ${startKey} AND ${endKey}`
  )
  const histByStaff: Record<string, { total: number; count: number }> = {}
  for (const r of histResult.rows) {
    const sid = r.staffId as string
    if (!histByStaff[sid]) histByStaff[sid] = { total: 0, count: 0 }
    histByStaff[sid].total += grossOfRow(r as Record<string, unknown>, settings)
    histByStaff[sid].count += 1
  }
  const referenceOf = (sid: string, fallbackBase: number): number => {
    const h = histByStaff[sid]
    if (!h || h.count === 0) return Math.round(fallbackBase)
    return Math.round(h.total / Math.min(12, h.count))
  }

  // vsi dopusti tega leta za redne zaposlene
  const leaveResult = await db.execute(
    sql`SELECT id, "staffId", "staffName", department, company, "leaveType",
               "startDate", "endDate", days, reason, status, "signedAt", "createdAt"
        FROM leave_requests
        WHERE EXTRACT(YEAR FROM "startDate") = ${year}`
  )
  const leavesByStaff: Record<string, LeaveRequest[]> = {}
  for (const r of leaveResult.rows) {
    const sid = r.staffId as string
    if (!leavesByStaff[sid]) leavesByStaff[sid] = []
    leavesByStaff[sid].push({
      id: r.id as string,
      staffId: sid,
      staffName: r.staffName as string,
      department: r.department as string,
      company: (r.company as string) ?? '',
      leaveType: r.leaveType as string,
      startDate: String(r.startDate).slice(0, 10),
      endDate: String(r.endDate).slice(0, 10),
      days: num(r.days),
      reason: (r.reason as string) ?? '',
      status: (r.status as string) ?? '',
      signedAt: (r.signedAt as string) ?? null,
      createdAt: String(r.createdAt ?? ''),
    })
  }

  const out: Record<string, LeaveSummary> = {}
  for (const r of staffResult.rows) {
    const sid = r.id as string
    // Dopust preteklih let, razclenjen po letu; vsota zadnjih 3 let = razpolozljiv prenos.
    const rawMap = (r.priorLeaveByYear as Record<string, unknown> | null) ?? {}
    const priorByYear: Record<string, number> = {}
    let priorSum = 0
    for (const yk of priorYearKeys) {
      const v = Math.max(0, num(rawMap[yk]))
      priorByYear[yk] = v
      priorSum += v
    }
    // Zdruzljivost: ce razclenitev po letih ni vnesena, uporabi staro enotno polje openingLeaveBalance.
    const hasBreakdown = priorYearKeys.some((yk) => rawMap[yk] !== undefined && rawMap[yk] !== null)
    const openingBalance = hasBreakdown ? priorSum : num(r.openingLeaveBalance)
    out[sid] = computeLeaveSummary({
      rawOpeningBalance: openingBalance,
      startDate: r.startDate ? String(r.startDate).slice(0, 10) : null,
      requests: leavesByStaff[sid] ?? [],
      year,
      month,
      params,
      referenceAmount: referenceOf(sid, num(r.monthlySalary)),
      activeMonths: Array.isArray(r.activeMonths) ? (r.activeMonths as number[]) : null,
      priorByYear,
    })
  }
  return out
}

// --- Cetrtletni prispevki ---
// Sesteje OSNOVO PRISPEVKOV (gross s stropom) rednih zaposlenih v cetrtletju.
export async function getQuarterlyContributions(year: number, quarter: number) {
  const months = getQuarterMonths(quarter)
  const settings = await getPayrollSettings()
  const ceiling = settings.sme * settings.ceilingMultiplier

  const staffResult = await db.execute(
    sql`SELECT id, "numberOfDependents" FROM staff_members WHERE "isRegularEmployee" = true`
  )
  const regular = staffResult.rows.map((r) => ({
    id: r.id as string,
    dependents: num(r.numberOfDependents),
  }))

  // shranjeni vnosi za cetrtletje (polni za izracun bruto)
  const entriesResult = await db.execute(
    sql`SELECT * FROM payroll_entries
        WHERE year = ${year} AND month = ANY(${sql.raw(`'{${months.join(',')}}'::integer[]`)})`
  )
  const baseByKey: Record<string, number> = {} // contributionBase
  for (const r of entriesResult.rows) {
    const slip = calcPayslip(
      {
        baseGrossSalary: num(r.baseSalary),
        overtimeFirst8Hours: num(r.overtimeFirst8Hours),
        overtimeAfter8Hours: num(r.overtimeAfter8Hours),
        nightRegularHours: num(r.nightRegularHours),
        nightOccasionalHours: num(r.nightOccasionalHours),
        sundayHours: num(r.sundayHours),
        publicHolidayHours: num(r.publicHolidayHours),
        bonuses: num(r.bonus),
        taxableBenefits: num(r.taxableBenefits),
        unusedLeaveCompensation: num(r.unusedLeaveCompensation),
      },
      settings,
    )
    baseByKey[`${r.staffId as string}-${r.month as number}`] = slip.contributionBase
  }

  // sestej osnovo prispevkov: shranjeni vnos -> njegova osnova, sicer privzeta placa (s stropom)
  let sumOfContributionBases = 0
  const defaultBase = Math.min(DEFAULT_NET_SALARY, ceiling)
  for (const s of regular) {
    for (const m of months) {
      sumOfContributionBases += baseByKey[`${s.id}-${m}`] ?? defaultBase
    }
  }

  const contributions = calcQuarterlyContributions(sumOfContributionBases, settings)
  const deadline = getQuarterDeadline(year, quarter)

  const statusResult = await db.execute(
    sql`SELECT paid, "paidAt" FROM contribution_payments WHERE year = ${year} AND quarter = ${quarter} LIMIT 1`
  )
  const paid = statusResult.rows[0]?.paid === true
  const paidAt = (statusResult.rows[0]?.paidAt as string) ?? null

  return {
    year,
    quarter,
    months,
    sumOfBaseSalaries: sumOfContributionBases,
    cnaps: contributions.cnaps,
    omino: contributions.omino,
    fmfp: contributions.fmfp,
    total: contributions.total,
    deadline: deadline.toISOString(),
    paid,
    paidAt,
  }
}

export async function setContributionPaid(
  year: number,
  quarter: number,
  paid: boolean
) {
  const data = await getQuarterlyContributions(year, quarter)

  const existing = await db.execute(
    sql`SELECT id FROM contribution_payments WHERE year = ${year} AND quarter = ${quarter} LIMIT 1`
  )

  if (existing.rows.length > 0) {
    const id = existing.rows[0].id as string
    await db.execute(
      sql`UPDATE contribution_payments
          SET paid = ${paid},
              "paidAt" = ${paid ? new Date().toISOString() : null},
              "cnapsAmount" = ${data.cnaps},
              "ominoAmount" = ${data.omino},
              "fmfpAmount" = ${data.fmfp},
              "totalAmount" = ${data.total}
          WHERE id = ${id}`
    )
  } else {
    const id = `contrib-${year}-${quarter}`
    await db.execute(
      sql`INSERT INTO contribution_payments (id, year, quarter, "cnapsAmount", "ominoAmount", "fmfpAmount", "totalAmount", paid, "paidAt")
          VALUES (${id}, ${year}, ${quarter}, ${data.cnaps}, ${data.omino}, ${data.fmfp}, ${data.total}, ${paid}, ${paid ? new Date().toISOString() : null})`
    )
  }

  revalidatePath('/statistika')
}

// Opozorila za dashboard: prispevki z rokom <= 30 dni in se neplacani
export async function getUpcomingContributionAlerts() {
  const now = new Date()
  const alerts: {
    year: number
    quarter: number
    cnaps: number
    omino: number
    fmfp: number
    total: number
    deadline: string
    daysLeft: number
    paid: boolean
  }[] = []

  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  const currentQuarter = getQuarter(currentMonth)

  const periods: { year: number; quarter: number }[] = []
  for (let i = 0; i < 4; i++) {
    let q = currentQuarter - i
    let y = currentYear
    while (q < 1) {
      q += 4
      y -= 1
    }
    periods.push({ year: y, quarter: q })
  }

  for (const p of periods) {
    const months = getQuarterMonths(p.quarter)
    const hasEntries = await db.execute(
      sql`SELECT 1 FROM payroll_entries
          WHERE year = ${p.year} AND month = ANY(${sql.raw(`'{${months.join(',')}}'::integer[]`)})
          LIMIT 1`
    )
    if (hasEntries.rows.length === 0) continue

    const data = await getQuarterlyContributions(p.year, p.quarter)
    if (data.total <= 0) continue
    if (data.paid) continue

    const deadline = new Date(data.deadline)
    const daysLeft = Math.ceil(
      (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    )

    if (daysLeft <= 30) {
      alerts.push({
        year: p.year,
        quarter: p.quarter,
        cnaps: data.cnaps,
        omino: data.omino,
        fmfp: data.fmfp,
        total: data.total,
        deadline: data.deadline,
        daysLeft,
        paid: data.paid,
      })
    }
  }

  alerts.sort((a, b) => a.daysLeft - b.daysLeft)
  return alerts
}

// --- Slike list prisotnosti (attendance_images), po delavcu + mesecu ---

export type AttendanceImage = { fileName: string | null; pathname: string }

// Vrne mapo staffId -> {fileName, pathname} za izbrani mesec.
export async function getAttendanceImages(
  year: number,
  month: number,
): Promise<Record<string, AttendanceImage>> {
  const result = await db.execute(
    sql`SELECT "staffId", "fileName", pathname FROM attendance_images WHERE year = ${year} AND month = ${month}`
  )
  const map: Record<string, AttendanceImage> = {}
  for (const r of result.rows) {
    map[r.staffId as string] = {
      fileName: (r.fileName as string) ?? null,
      pathname: r.pathname as string,
    }
  }
  return map
}

// Shrani (ali zamenja) sliko liste prisotnosti za delavca v mesecu.
export async function saveAttendanceImage(
  staffId: string,
  year: number,
  month: number,
  fileName: string,
  pathname: string,
) {
  const existing = await db.execute(
    sql`SELECT id FROM attendance_images WHERE "staffId" = ${staffId} AND year = ${year} AND month = ${month} LIMIT 1`
  )
  if (existing.rows.length > 0) {
    await db.execute(
      sql`UPDATE attendance_images SET "fileName" = ${fileName}, pathname = ${pathname}, "uploadedAt" = now() WHERE id = ${existing.rows[0].id as string}`
    )
  } else {
    const id = `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    await db.execute(
      sql`INSERT INTO attendance_images (id, "staffId", year, month, "fileName", pathname)
          VALUES (${id}, ${staffId}, ${year}, ${month}, ${fileName}, ${pathname})`
    )
  }
  revalidatePath('/statistika')
}

// Odstrani sliko liste prisotnosti za delavca v mesecu.
export async function deleteAttendanceImage(staffId: string, year: number, month: number) {
  await db.execute(
    sql`DELETE FROM attendance_images WHERE "staffId" = ${staffId} AND year = ${year} AND month = ${month}`
  )
  revalidatePath('/statistika')
}

// --- Slike podpisanih placilnih list (payslip_images), po delavcu + mesecu ---

export type PayslipImage = { fileName: string | null; pathname: string }

// Vrne mapo staffId -> {fileName, pathname} za izbrani mesec.
export async function getPayslipImages(
  year: number,
  month: number,
): Promise<Record<string, PayslipImage>> {
  const result = await db.execute(
    sql`SELECT "staffId", "fileName", pathname FROM payslip_images WHERE year = ${year} AND month = ${month}`
  )
  const map: Record<string, PayslipImage> = {}
  for (const r of result.rows) {
    map[r.staffId as string] = {
      fileName: (r.fileName as string) ?? null,
      pathname: r.pathname as string,
    }
  }
  return map
}

// Shrani (ali zamenja) sliko podpisane placilne liste za delavca v mesecu.
export async function savePayslipImage(
  staffId: string,
  year: number,
  month: number,
  fileName: string,
  pathname: string,
) {
  const existing = await db.execute(
    sql`SELECT id FROM payslip_images WHERE "staffId" = ${staffId} AND year = ${year} AND month = ${month} LIMIT 1`
  )
  if (existing.rows.length > 0) {
    await db.execute(
      sql`UPDATE payslip_images SET "fileName" = ${fileName}, pathname = ${pathname}, "uploadedAt" = now() WHERE id = ${existing.rows[0].id as string}`
    )
  } else {
    const id = `pay-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    await db.execute(
      sql`INSERT INTO payslip_images (id, "staffId", year, month, "fileName", pathname)
          VALUES (${id}, ${staffId}, ${year}, ${month}, ${fileName}, ${pathname})`
    )
  }
  revalidatePath('/statistika')
}

// Odstrani sliko podpisane placilne liste za delavca v mesecu.
export async function deletePayslipImage(staffId: string, year: number, month: number) {
  await db.execute(
    sql`DELETE FROM payslip_images WHERE "staffId" = ${staffId} AND year = ${year} AND month = ${month}`
  )
  revalidatePath('/statistika')
}

// --- Dodatni dokumenti k placilni listi (payslip_extra_images), VEC na delavca + mesec ---

export type PayslipExtraImage = { id: string; fileName: string | null; pathname: string }

// Vrne mapo staffId -> seznam dodatnih dokumentov za izbrani mesec.
export async function getPayslipExtraImages(
  year: number,
  month: number,
): Promise<Record<string, PayslipExtraImage[]>> {
  const result = await db.execute(
    sql`SELECT id, "staffId", "fileName", pathname FROM payslip_extra_images WHERE year = ${year} AND month = ${month} ORDER BY "uploadedAt"`
  )
  const map: Record<string, PayslipExtraImage[]> = {}
  for (const r of result.rows) {
    const sid = r.staffId as string
    if (!map[sid]) map[sid] = []
    map[sid].push({
      id: r.id as string,
      fileName: (r.fileName as string) ?? null,
      pathname: r.pathname as string,
    })
  }
  return map
}

// Doda dodatni dokument k placilni listi (ne prepise obstojecih).
export async function addPayslipExtraImage(
  staffId: string,
  year: number,
  month: number,
  fileName: string,
  pathname: string,
): Promise<PayslipExtraImage> {
  const id = `payx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  await db.execute(
    sql`INSERT INTO payslip_extra_images (id, "staffId", year, month, "fileName", pathname)
        VALUES (${id}, ${staffId}, ${year}, ${month}, ${fileName}, ${pathname})`
  )
  revalidatePath('/statistika')
  return { id, fileName, pathname }
}

// Odstrani en dodatni dokument po id.
export async function deletePayslipExtraImage(id: string) {
  await db.execute(sql`DELETE FROM payslip_extra_images WHERE id = ${id}`)
  revalidatePath('/statistika')
}

// --- Dnevni vnos prisotnosti (attendance_days), delo / dopust / prosto ---

export type AttendanceDayRow = {
  status: string
  from: string | null
  to: string | null
  breakMinutes: number
}

// Vrne mapo staffId -> (day -> {status, from, to, breakMinutes}) za izbrani mesec.
export async function getAttendanceDays(
  year: number,
  month: number,
): Promise<Record<string, Record<number, AttendanceDayRow>>> {
  const result = await db.execute(
    sql`SELECT "staffId", day, status, "from", "to", "breakMinutes" FROM attendance_days WHERE year = ${year} AND month = ${month}`
  )
  const map: Record<string, Record<number, AttendanceDayRow>> = {}
  for (const r of result.rows) {
    const sid = r.staffId as string
    if (!map[sid]) map[sid] = {}
    map[sid][r.day as number] = {
      status: (r.status as string) ?? 'work',
      from: (r.from as string) ?? null,
      to: (r.to as string) ?? null,
      breakMinutes: Number(r.breakMinutes ?? 0),
    }
  }
  return map
}

// Shrani (upsert) en dan. Ce je status prazen -> izbrise vrstico.
export async function saveAttendanceDay(
  staffId: string,
  year: number,
  month: number,
  day: number,
  status: string | null,
  from: string | null,
  to: string | null,
  breakMinutes: number = 0,
) {
  if (!status) {
    await db.execute(
      sql`DELETE FROM attendance_days WHERE "staffId" = ${staffId} AND year = ${year} AND month = ${month} AND day = ${day}`
    )
    return
  }
  const brk = Math.max(0, Math.round(breakMinutes || 0))
  const existing = await db.execute(
    sql`SELECT id FROM attendance_days WHERE "staffId" = ${staffId} AND year = ${year} AND month = ${month} AND day = ${day} LIMIT 1`
  )
  if (existing.rows.length > 0) {
    await db.execute(
      sql`UPDATE attendance_days SET status = ${status}, "from" = ${from}, "to" = ${to}, "breakMinutes" = ${brk}, "updatedAt" = now() WHERE id = ${existing.rows[0].id as string}`
    )
  } else {
    const id = `attd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    await db.execute(
      sql`INSERT INTO attendance_days (id, "staffId", year, month, day, status, "from", "to", "breakMinutes")
          VALUES (${id}, ${staffId}, ${year}, ${month}, ${day}, ${status}, ${from}, ${to}, ${brk})`
    )
  }
}

// Vrne PODPISANE dneve dopusta po delavcu za izbrani mesec (staffId -> [dnevi]).
// Podpisan = signedAt ni NULL. Uporablja se za primerjavo z vneseno prisotnostjo.
export async function getSignedLeaveDays(
  year: number,
  month: number,
): Promise<Record<string, number[]>> {
  const result = await db.execute(
    sql`SELECT "staffId", "startDate", "endDate"
        FROM leave_requests
        WHERE "signedAt" IS NOT NULL
          AND COALESCE("leaveType", '') <> 'sick'
          AND "startDate" <= make_date(${year}, ${month}, ${daysInMonthSql(year, month)})
          AND "endDate" >= make_date(${year}, ${month}, 1)`
  )
  const map: Record<string, Set<number>> = {}
  const dim = daysInMonthSql(year, month)
  for (const r of result.rows) {
    const sid = r.staffId as string
    const start = new Date(String(r.startDate).slice(0, 10))
    const end = new Date(String(r.endDate).slice(0, 10))
    if (!map[sid]) map[sid] = new Set()
    for (let d = 1; d <= dim; d++) {
      const day = new Date(year, month - 1, d)
      if (day >= start && day <= end) map[sid].add(d)
    }
  }
  const out: Record<string, number[]> = {}
  for (const [sid, set] of Object.entries(map)) {
    out[sid] = Array.from(set).sort((a, b) => a - b)
  }
  return out
}

function daysInMonthSql(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

// Vrne NACRTOVANE delovne dni iz razporeda po delavcu (staffName -> {day -> true=delo}).
// Zdruzi vse oddelke (kuhinja, vrtnarji, bar, sobarice). Uporablja se za primerjavo
// razporeda (plana) z dejansko vpisano prisotnostjo (opozorilo za odstopanja).
export async function getPlannedWorkDays(
  year: number,
  month: number,
): Promise<Record<string, Record<number, boolean>>> {
  const out: Record<string, Record<number, boolean>> = {}
  const dayOf = (date: string) => Number(date.slice(8, 10))
  const add = (name: string, day: number, working: boolean) => {
    if (!out[name]) out[name] = {}
    out[name][day] = out[name][day] || working
  }

  // Kuhinja
  try {
    for (const d of generateKitchenSchedule(year, month)) {
      const day = dayOf(d.date)
      for (const [name, shift] of Object.entries(d.assignments)) add(name, day, shift !== 'OFF')
    }
  } catch {}

  // Vrtnarji
  try {
    for (const d of generateGardenerSchedule(year, month)) {
      const day = dayOf(d.date)
      for (const [name, post] of Object.entries(d.assignments)) add(name, day, post !== 'OFF')
    }
  } catch {}

  // Bar
  try {
    for (const d of generateBarSchedule(year, month)) {
      const day = dayOf(d.date)
      for (const [name, shift] of Object.entries(d.assignments)) add(name, day, shift !== 'OFF')
    }
  } catch {}

  // Sobarice: uporabi SHRANJEN razpored (NE generiraj — generiranje pise v bazo).
  // Ce shranjenega ni, uporabi housekeepingDay (do 5. 10. 2026 stiri osebe, od 6. 10. tri).
  try {
    const hk = await getHousekeepingSchedule(year, month)
    if (hk && hk.length > 0) {
      for (const e of hk) add(e.staffName, dayOf(e.date), e.shift !== 'OFF')
    } else {
      const dim = daysInMonthSql(year, month)
      for (let d = 1; d <= dim; d++) {
        const date = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
        for (const [name, shift] of Object.entries(housekeepingDay(date))) add(name, d, shift !== 'OFF')
      }
    }
  } catch {}

  return out
}

// --- Prijave osebja v bar blagajno (staff_logins) ---

export type StaffLoginRecord = {
  id: string
  staffId: string | null
  staffName: string | null
  role: string | null
  loggedInAt: string
}

// Vrne zadnje prijave osebja v bar blagajno (privzeto zadnjih 200).
export async function getStaffLogins(limit = 200): Promise<StaffLoginRecord[]> {
  const result = await db.execute(
    sql`SELECT id, "staffId", "staffName", role, "loggedInAt" FROM staff_logins ORDER BY "loggedInAt" DESC LIMIT ${limit}`
  )
  return result.rows.map((r) => ({
    id: r.id as string,
    staffId: (r.staffId as string) ?? null,
    staffName: (r.staffName as string) ?? null,
    role: (r.role as string) ?? null,
    loggedInAt: r.loggedInAt as string,
  }))
}

// Povzetek prijav po delavcu: koliko prijav in kdaj zadnja.
export async function getStaffLoginSummary(): Promise<
  { staffName: string | null; role: string | null; count: number; lastAt: string }[]
> {
  const result = await db.execute(
    sql`SELECT "staffName", role, COUNT(*)::int AS count, MAX("loggedInAt") AS "lastAt"
        FROM staff_logins GROUP BY "staffName", role ORDER BY count DESC`
  )
  return result.rows.map((r) => ({
    staffName: (r.staffName as string) ?? null,
    role: (r.role as string) ?? null,
    count: r.count as number,
    lastAt: r.lastAt as string,
  }))
}
