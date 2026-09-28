'use server'

import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import {
  buildContractNumber,
  type Contract,
  type ContractSnapshot,
  type CompanySettings,
} from '@/lib/contracts'

// ============ NASTAVITVE PODJETIJ ============

export async function getCompanySettings(): Promise<CompanySettings[]> {
  const result = await db.execute(sql`SELECT * FROM company_settings ORDER BY id`)
  return result.rows.map((r) => ({
    id: r.id as string,
    name: (r.name as string | null) ?? '',
    address: (r.address as string | null) ?? '',
    nifNumber: (r.nifNumber as string | null) ?? '',
    statNumber: (r.statNumber as string | null) ?? '',
    rcsNumber: (r.rcsNumber as string | null) ?? '',
    repName: (r.repName as string | null) ?? '',
    repTitle: (r.repTitle as string | null) ?? '',
  }))
}

export async function updateCompanySettings(
  id: string,
  data: Partial<Omit<CompanySettings, 'id'>>,
) {
  const fields: (keyof Omit<CompanySettings, 'id'>)[] = [
    'name', 'address', 'nifNumber', 'statNumber', 'rcsNumber', 'repName', 'repTitle',
  ]
  for (const field of fields) {
    const value = data[field]
    if (value === undefined) continue
    await db.execute(
      sql`UPDATE company_settings SET ${sql.identifier(field)} = ${value || null}, "updatedAt" = now() WHERE id = ${id}`,
    )
  }
  revalidatePath('/statistika')
}

// ============ POGODBE ============

function mapContract(r: Record<string, unknown>): Contract {
  return {
    id: r.id as string,
    contractNumber: r.contractNumber as string,
    staffId: r.staffId as string,
    staffName: r.staffName as string,
    company: (r.company as string | null) ?? 'tourism',
    contractType: (r.contractType as Contract['contractType']) ?? 'CDI',
    jobTitle: (r.jobTitle as string | null) ?? '',
    category: (r.category as string | null) ?? '',
    index: (r.index as string | null) ?? '',
    startDate: r.startDate as string | null,
    endDate: r.endDate as string | null,
    trialMonths: (r.trialMonths as number | null) ?? 0,
    salary: (r.salary as number | null) ?? 0,
    workLocation: (r.workLocation as string | null) ?? '',
    workHours: (r.workHours as string | null) ?? '',
    language: (r.language as Contract['language']) ?? 'fr',
    status: (r.status as Contract['status']) ?? 'draft',
    snapshot: (r.snapshot as ContractSnapshot | null) ?? null,
    notes: (r.notes as string | null) ?? '',
    signedAt: r.signedAt as string | null,
    createdAt: r.createdAt as string,
    updatedAt: r.updatedAt as string,
  }
}

export async function getContracts(): Promise<Contract[]> {
  const result = await db.execute(
    sql`SELECT * FROM contracts WHERE status != 'archived' ORDER BY "createdAt" DESC`,
  )
  return result.rows.map(mapContract)
}

export async function getArchivedContracts(): Promise<Contract[]> {
  const result = await db.execute(
    sql`SELECT * FROM contracts WHERE status = 'archived' ORDER BY "createdAt" DESC`,
  )
  return result.rows.map(mapContract)
}

export async function getContractsForStaff(staffId: string): Promise<Contract[]> {
  const result = await db.execute(
    sql`SELECT * FROM contracts WHERE "staffId" = ${staffId} ORDER BY "createdAt" DESC`,
  )
  return result.rows.map(mapContract)
}

// Naslednja zaporedna stevilka pogodbe za podjetje + leto
async function nextContractSeq(companyId: string, year: number): Promise<number> {
  const result = await db.execute(
    sql`SELECT COUNT(*)::int AS cnt FROM contracts WHERE company = ${companyId} AND EXTRACT(YEAR FROM "createdAt") = ${year}`,
  )
  const cnt = (result.rows[0]?.cnt as number | null) ?? 0
  return cnt + 1
}

export async function createContract(data: {
  staffId: string
  staffName: string
  company: string
  contractType: Contract['contractType']
  jobTitle: string
  category: string
  index: string
  startDate: string | null
  endDate: string | null
  trialMonths: number
  salary: number
  workLocation: string
  workHours: string
  language: Contract['language']
  snapshot: ContractSnapshot | null
  notes: string
}): Promise<Contract> {
  const id = `contract-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const year = new Date().getFullYear()
  const seq = await nextContractSeq(data.company, year)
  const contractNumber = buildContractNumber(data.company, year, seq)
  const snapshotJson = data.snapshot ? JSON.stringify(data.snapshot) : null

  await db.execute(sql`
    INSERT INTO contracts (
      id, "contractNumber", "staffId", "staffName", company, "contractType",
      "jobTitle", category, "index", "startDate", "endDate", "trialMonths", salary,
      "workLocation", "workHours", language, status, snapshot, notes
    ) VALUES (
      ${id}, ${contractNumber}, ${data.staffId}, ${data.staffName}, ${data.company}, ${data.contractType},
      ${data.jobTitle || null}, ${data.category || null}, ${data.index || null}, ${data.startDate || null}, ${data.endDate || null},
      ${data.trialMonths}, ${data.salary}, ${data.workLocation || null}, ${data.workHours || null},
      ${data.language}, 'draft', ${snapshotJson}::jsonb, ${data.notes || null}
    )
  `)
  revalidatePath('/statistika')
  const result = await db.execute(sql`SELECT * FROM contracts WHERE id = ${id}`)
  return mapContract(result.rows[0] as Record<string, unknown>)
}

export async function updateContract(id: string, data: Partial<{
  contractType: Contract['contractType']
  jobTitle: string
  category: string
  index: string
  startDate: string | null
  endDate: string | null
  trialMonths: number
  salary: number
  workLocation: string
  workHours: string
  language: Contract['language']
  status: Contract['status']
  notes: string
}>) {
  const fields: string[] = [
    'contractType', 'jobTitle', 'category', 'index', 'startDate', 'endDate',
    'trialMonths', 'salary', 'workLocation', 'workHours', 'language', 'status', 'notes',
  ]
  for (const field of fields) {
    const value = (data as Record<string, unknown>)[field]
    if (value === undefined) continue
    await db.execute(
      sql`UPDATE contracts SET ${sql.identifier(field)} = ${(value as string | number | null) ?? null}, "updatedAt" = now() WHERE id = ${id}`,
    )
  }
  revalidatePath('/statistika')
}

// Osvezi snapshot pogodbe z aktualnimi osebnimi podatki iz kadrovske evidence.
// Uporabno, ce so bili osebni podatki (npr. ime oceta/matere) dodani po sklenitvi pogodbe.
export async function refreshContractSnapshot(contractId: string): Promise<Contract | null> {
  const cRes = await db.execute(sql`SELECT "staffId" FROM contracts WHERE id = ${contractId}`)
  const staffId = cRes.rows[0]?.staffId as string | undefined
  if (!staffId) return null

  const sRes = await db.execute(sql`SELECT * FROM staff_members WHERE id = ${staffId}`)
  const s = sRes.rows[0] as Record<string, unknown> | undefined
  if (!s) return null

  const snapshot: ContractSnapshot = {
    firstName: (s.firstName as string | null) ?? '',
    lastName: (s.lastName as string | null) ?? '',
    staffName: (s.staffName as string | null) ?? '',
    gender: (s.gender as string | null) ?? undefined,
    dateOfBirth: (s.dateOfBirth as string | null) ?? null,
    placeOfBirth: (s.placeOfBirth as string | null) ?? '',
    nationality: (s.nationality as string | null) ?? '',
    fatherName: (s.fatherName as string | null) ?? '',
    motherName: (s.motherName as string | null) ?? '',
    documentNumber: (s.documentNumber as string | null) ?? '',
    cnapsNumber: (s.cnapsNumber as string | null) ?? '',
    ominoNumber: (s.ominoNumber as string | null) ?? '',
    address: (s.address as string | null) ?? '',
    phone: (s.phone as string | null) ?? '',
    email: (s.email as string | null) ?? '',
  }

  await db.execute(
    sql`UPDATE contracts SET snapshot = ${JSON.stringify(snapshot)}::jsonb, "updatedAt" = now() WHERE id = ${contractId}`,
  )
  revalidatePath('/statistika')
  const result = await db.execute(sql`SELECT * FROM contracts WHERE id = ${contractId}`)
  return mapContract(result.rows[0] as Record<string, unknown>)
}

export async function setContractStatus(id: string, status: Contract['status']) {
  if (status === 'active') {
    await db.execute(
      sql`UPDATE contracts SET status = 'active', "signedAt" = COALESCE("signedAt", now()), "updatedAt" = now() WHERE id = ${id}`,
    )
  } else {
    await db.execute(
      sql`UPDATE contracts SET status = ${status}, "updatedAt" = now() WHERE id = ${id}`,
    )
  }
  revalidatePath('/statistika')
}

export async function deleteContract(id: string) {
  await db.execute(sql`DELETE FROM contracts WHERE id = ${id}`)
  revalidatePath('/statistika')
}
