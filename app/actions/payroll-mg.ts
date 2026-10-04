'use server'

import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import {
  DEFAULT_MG_CONFIG,
  type MgPayrollConfig,
} from '@/lib/payroll-mg'
import {
  computeAttendanceSummary,
  computeNorm,
  type AttendanceMonth,
} from '@/lib/attendance'
import { computeLeaveBalance, type LeaveBalance } from '@/lib/payroll-mg'
import { parseSalaryChanges } from '@/lib/employment'

const MG_CONFIG_KEY = 'payroll_mg_config'

// Povzetek ur iz liste prisotnosti (attendance_days) za enega delavca v mesecu.
// Uporablja se v MG obracunu, da se ure (redne/nedelja/praznik/dopust) prenesejo v placilno listo.
export type MgAttendanceSummary = {
  hasData: boolean
  normalHours: number
  sundayHours: number
  holidayHours: number
  leaveDays: number
  offDays: number
  totalWorkHours: number
  creditedHours: number
  norm: number
  diff: number
  leaveBalance: LeaveBalance   // letni saldo dopusta (conges payes) do konca meseca
}

export async function getMgAttendanceSummary(
  staffId: string,
  year: number,
  month: number,
): Promise<MgAttendanceSummary> {
  const result = await db.execute(
    sql`SELECT day, status, "from", "to", "breakMinutes"
        FROM attendance_days
        WHERE "staffId" = ${staffId} AND year = ${year} AND month = ${month}`,
  )
  const entries: AttendanceMonth = {}
  for (const r of result.rows) {
    const day = Number(r.day)
    if (!day) continue
    entries[day] = {
      status: r.status as AttendanceMonth[number]['status'],
      from: (r.from as string) ?? null,
      to: (r.to as string) ?? null,
      breakMinutes: r.breakMinutes != null ? Number(r.breakMinutes) : 0,
    }
  }
  const summary = computeAttendanceSummary(entries, year, month)
  const norm = computeNorm(summary)

  // Koristeni dopust v LETU do konca izbranega meseca (vsi dnevi status='leave').
  const usedRes = await db.execute(
    sql`SELECT COUNT(*)::int AS used
        FROM attendance_days
        WHERE "staffId" = ${staffId} AND year = ${year} AND month <= ${month}
          AND status = 'leave'`,
  )
  const usedYtd = Number(usedRes.rows[0]?.used ?? 0)

  // Datum zaposlitve (za prirast dopusta pri delavcih zaposlenih sredi leta) +
  // prenos/popravek dopusta (openingLeaveBalance / priorLeaveByYear) iz preteklih let.
  const staffRes = await db.execute(
    sql`SELECT "startDate", "openingLeaveBalance", "priorLeaveByYear" FROM staff_members WHERE id = ${staffId}`,
  )
  const hireISO = (staffRes.rows[0]?.startDate as string) ?? null
  const opening = Number(staffRes.rows[0]?.openingLeaveBalance ?? 0)

  // Razclemba prenosa po letih (zadnja 3 leta pred izbranim), da je na placilni listi
  // razvidno, koliko dopusta je ostalo iz katerega leta.
  const rawPrior = (staffRes.rows[0]?.priorLeaveByYear as Record<string, unknown> | null) ?? {}
  const priorByYear = [year - 1, year - 2, year - 3]
    .map((y) => ({ year: String(y), days: Number(rawPrior[String(y)] ?? 0) }))
    .filter((p) => p.days > 0)

  const leaveBalance = computeLeaveBalance({ year, month, hireISO, usedYtd, opening, priorByYear })

  return {
    hasData: result.rows.length > 0,
    normalHours: summary.normalHours,
    sundayHours: summary.sundayHours,
    holidayHours: summary.holidayHours,
    leaveDays: summary.leaveDays,
    offDays: summary.offDays,
    totalWorkHours: summary.totalWorkHours,
    creditedHours: norm.creditedHours,
    norm: norm.norm,
    diff: norm.diff,
    leaveBalance,
  }
}

function num(v: unknown): number {
  const n = Number(v)
  return isNaN(n) ? 0 : n
}

// --- Nastavitve modula (stopnje prispevkov, kategorije, dodatki) ---

export async function getMgPayrollConfig(): Promise<MgPayrollConfig> {
  const result = await db.execute(
    sql`SELECT value FROM settings WHERE key = ${MG_CONFIG_KEY} LIMIT 1`,
  )
  if (result.rows.length === 0) return { ...DEFAULT_MG_CONFIG }
  try {
    const parsed = JSON.parse(result.rows[0].value as string)
    // Zdruzi s privzetimi, da nove nastavitve ne manjkajo
    return {
      ...DEFAULT_MG_CONFIG,
      ...parsed,
      categories: parsed.categories ?? DEFAULT_MG_CONFIG.categories,
      contributionTypes: parsed.contributionTypes ?? DEFAULT_MG_CONFIG.contributionTypes,
    }
  } catch {
    return { ...DEFAULT_MG_CONFIG }
  }
}

export async function updateMgPayrollConfig(config: MgPayrollConfig) {
  const value = JSON.stringify(config)
  const existing = await db.execute(
    sql`SELECT id FROM settings WHERE key = ${MG_CONFIG_KEY} LIMIT 1`,
  )
  if (existing.rows.length > 0) {
    await db.execute(
      sql`UPDATE settings SET value = ${value}, "updatedAt" = ${new Date().toISOString()} WHERE key = ${MG_CONFIG_KEY}`,
    )
  } else {
    await db.execute(
      sql`INSERT INTO settings (id, key, value) VALUES (${`set-${MG_CONFIG_KEY}`}, ${MG_CONFIG_KEY}, ${value})`,
    )
  }
  revalidatePath('/statistika')
  return { success: true }
}

// --- Seznam zaposlenih za obracun ---

export type MgStaffOption = {
  id: string
  staffName: string
  fullName: string
  fonction: string
  company: string
  cnapsNumber: string
  ominoNumber: string
  category: string | null
  hireDate: string | null
  officialSalary: number
  realSalary: number
  officialAmount: number
  salaryChanges: { from: string; amount: number }[]
  numberOfDependents: number
  // Osebni podatki za placilno listo (iz osebne izkaznice / kadrovske kartice)
  dateOfBirth: string
  placeOfBirth: string
  cin: string           // Numero CIN (osebna izkaznica)
  domicile: string      // prebivalisce
}

const STAFF_TYPE_FONCTION: Record<string, string> = {
  gardener: 'Jardinier',
  housekeeper: 'Femme de chambre',
  barman: 'Barman',
  kitchen: 'Cuisinier',
  reception: 'Réceptionniste',
  maintenance: 'Maintenance',
  other: 'Employé',
}

export async function getMgPayrollStaff(): Promise<MgStaffOption[]> {
  await db.execute(sql`ALTER TABLE staff_members ADD COLUMN IF NOT EXISTS "salaryChanges" jsonb NOT NULL DEFAULT '[]'::jsonb`)
  const result = await db.execute(
    sql`SELECT id, "staffName", "firstName", "lastName", "staffType", company,
               "cnapsNumber", "ominoNumber", "wageCategory", "startDate",
               "officialSalary", "monthlySalary", "salaryChanges", "numberOfDependents",
               "dateOfBirth", "placeOfBirth", "documentNumber", address
        FROM staff_members
        WHERE "isRegularEmployee" = true AND active IS NOT FALSE
        ORDER BY company, "lastName", "staffName"`,
  )
  return result.rows.map((r) => {
    const first = (r.firstName as string) || ''
    const last = (r.lastName as string) || ''
    const composed = `${first} ${last}`.trim()
    const official = num(r.officialSalary)
    const real = num(r.monthlySalary)
    return {
      id: r.id as string,
      staffName: r.staffName as string,
      fullName: composed || (r.staffName as string),
      fonction: STAFF_TYPE_FONCTION[(r.staffType as string) || 'other'] || 'Employé',
      company: (r.company as string) || 'tourism',
      cnapsNumber: (r.cnapsNumber as string) || '',
      ominoNumber: (r.ominoNumber as string) || '',
      category: (r.wageCategory as string) || null,
      hireDate: (r.startDate as string) || null,
      officialSalary: official > 0 ? official : real,
      officialAmount: official,
      realSalary: real,
      salaryChanges: parseSalaryChanges(r.salaryChanges),
      numberOfDependents: num(r.numberOfDependents),
      dateOfBirth: (r.dateOfBirth as string) || '',
      placeOfBirth: (r.placeOfBirth as string) || '',
      cin: (r.documentNumber as string) || '',
      domicile: (r.address as string) || '',
    }
  })
}

// --- Shranjeni obracuni (payroll_mg_entries) ---

export type MgEntryInput = {
  id?: string
  staffId: string | null
  staffName: string
  fonction?: string | null
  category?: string | null
  hireDate?: string | null
  companyId?: string | null
  year: number
  month: number
  baseSalary: number
  monthlyHours?: number
  normalHours?: number
  sundayHours?: number
  holidayHours?: number
  overtimeHours?: number
  sundayRate?: number | null
  holidayRate?: number | null
  overtimeRate?: number | null
  otherBonuses?: number
  contributionBase?: number | null
  irsa?: number
  advances?: number
  otherDeductions?: number
  leaveDays?: number
  seniorityYears?: number
  grossUpLabelFr?: string | null
  notes?: string | null
}

export type MgEntry = MgEntryInput & { id: string }

function rowToEntry(r: Record<string, unknown>): MgEntry {
  return {
    id: r.id as string,
    staffId: (r.staffId as string) ?? null,
    staffName: r.staffName as string,
    fonction: (r.fonction as string) ?? null,
    category: (r.category as string) ?? null,
    hireDate: (r.hireDate as string) ?? null,
    companyId: (r.companyId as string) ?? 'tourism',
    year: num(r.year),
    month: num(r.month),
    baseSalary: num(r.baseSalary),
    monthlyHours: num(r.monthlyHours),
    normalHours: num(r.normalHours),
    sundayHours: num(r.sundayHours),
    holidayHours: num(r.holidayHours),
    overtimeHours: num(r.overtimeHours),
    sundayRate: r.sundayRate == null ? null : num(r.sundayRate),
    holidayRate: r.holidayRate == null ? null : num(r.holidayRate),
    overtimeRate: r.overtimeRate == null ? null : num(r.overtimeRate),
    otherBonuses: num(r.otherBonuses),
    contributionBase: r.contributionBase == null ? null : num(r.contributionBase),
    irsa: num(r.irsa),
    advances: num(r.advances),
    otherDeductions: num(r.otherDeductions),
    leaveDays: num(r.leaveDays),
    seniorityYears: num(r.seniorityYears),
    grossUpLabelFr: (r.grossUpLabelFr as string) ?? null,
    notes: (r.notes as string) ?? null,
  }
}

export async function getMgPayrollEntries(year: number, month: number): Promise<MgEntry[]> {
  const result = await db.execute(
    sql`SELECT * FROM payroll_mg_entries WHERE year = ${year} AND month = ${month} ORDER BY "staffName"`,
  )
  return result.rows.map((r) => rowToEntry(r as Record<string, unknown>))
}

export async function upsertMgPayrollEntry(input: MgEntryInput): Promise<{ success: boolean; id: string }> {
  const id = input.id || `pmg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const now = new Date().toISOString()
  const cb = input.contributionBase == null ? null : Math.round(input.contributionBase)
  await db.execute(sql`
    INSERT INTO payroll_mg_entries (
      id, "staffId", "staffName", fonction, category, "hireDate", "companyId",
      year, month, "baseSalary", "monthlyHours", "normalHours", "sundayHours",
      "holidayHours", "overtimeHours", "sundayRate", "holidayRate", "overtimeRate",
      "otherBonuses", "contributionBase", irsa, advances, "otherDeductions",
      "leaveDays", "seniorityYears", "grossUpLabelFr", notes, "createdAt", "updatedAt"
    ) VALUES (
      ${id}, ${input.staffId}, ${input.staffName}, ${input.fonction ?? null}, ${input.category ?? null},
      ${input.hireDate ?? null}, ${input.companyId ?? 'tourism'},
      ${input.year}, ${input.month}, ${Math.round(input.baseSalary)}, ${input.monthlyHours ?? 173.33},
      ${input.normalHours ?? 0}, ${input.sundayHours ?? 0}, ${input.holidayHours ?? 0}, ${input.overtimeHours ?? 0},
      ${input.sundayRate ?? null}, ${input.holidayRate ?? null}, ${input.overtimeRate ?? null},
      ${Math.round(input.otherBonuses ?? 0)}, ${cb}, ${Math.round(input.irsa ?? 0)},
      ${Math.round(input.advances ?? 0)}, ${Math.round(input.otherDeductions ?? 0)},
      ${input.leaveDays ?? 0}, ${input.seniorityYears ?? 0}, ${input.grossUpLabelFr ?? null}, ${input.notes ?? null}, ${now}, ${now}
    )
    ON CONFLICT ("staffId", year, month) DO UPDATE SET
      "staffName" = EXCLUDED."staffName",
      fonction = EXCLUDED.fonction,
      category = EXCLUDED.category,
      "hireDate" = EXCLUDED."hireDate",
      "companyId" = EXCLUDED."companyId",
      "baseSalary" = EXCLUDED."baseSalary",
      "monthlyHours" = EXCLUDED."monthlyHours",
      "normalHours" = EXCLUDED."normalHours",
      "sundayHours" = EXCLUDED."sundayHours",
      "holidayHours" = EXCLUDED."holidayHours",
      "overtimeHours" = EXCLUDED."overtimeHours",
      "sundayRate" = EXCLUDED."sundayRate",
      "holidayRate" = EXCLUDED."holidayRate",
      "overtimeRate" = EXCLUDED."overtimeRate",
      "otherBonuses" = EXCLUDED."otherBonuses",
      "contributionBase" = EXCLUDED."contributionBase",
      irsa = EXCLUDED.irsa,
      advances = EXCLUDED.advances,
      "otherDeductions" = EXCLUDED."otherDeductions",
      "leaveDays" = EXCLUDED."leaveDays",
      "seniorityYears" = EXCLUDED."seniorityYears",
      "grossUpLabelFr" = EXCLUDED."grossUpLabelFr",
      notes = EXCLUDED.notes,
      "updatedAt" = ${now}
  `)
  revalidatePath('/statistika')
  return { success: true, id }
}

export async function deleteMgPayrollEntry(id: string): Promise<{ success: boolean }> {
  await db.execute(sql`DELETE FROM payroll_mg_entries WHERE id = ${id}`)
  revalidatePath('/statistika')
  return { success: true }
}
