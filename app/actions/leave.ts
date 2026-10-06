'use server'

import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { daysBetween } from '@/lib/leave'

async function ensureLeaveColumns() {
  await db.execute(sql`ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS "advancePayAr" integer`)
  await db.execute(sql`ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS "doctorCertificatePath" text`)
}

export async function getLeaveRequests(department: string) {
  await ensureLeaveColumns()
  const result = await db.execute(
    sql`SELECT * FROM leave_requests WHERE department = ${department} ORDER BY "startDate" DESC`
  )
  return result.rows.map(r => ({
    id: r.id as string,
    staffId: r.staffId as string,
    staffName: r.staffName as string,
    department: r.department as string,
    company: r.company as string,
    leaveType: r.leaveType as string,
    startDate: r.startDate as string,
    endDate: r.endDate as string,
    days: r.days as number,
    reason: (r.reason as string | null) ?? '',
    status: r.status as string,
    signedAt: r.signedAt as string | null,
    signedDocumentPath: (r.signedDocumentPath as string | null) ?? null,
    doctorCertificatePath: (r.doctorCertificatePath as string | null) ?? null,
    advancePayAr: r.advancePayAr == null ? null : Number(r.advancePayAr),
    createdAt: r.createdAt as string,
  }))
}

export async function setLeaveAdvancePay(id: string, amountAr: number) {
  await ensureLeaveColumns()
  const amount = Math.max(0, Math.round(amountAr || 0))
  await db.execute(
    sql`UPDATE leave_requests SET "advancePayAr" = ${amount > 0 ? amount : null} WHERE id = ${id}`
  )
  revalidatePath('/statistika')
}

export async function createLeaveRequest(data: {
  staffId: string
  staffName: string
  department: string
  company: string
  leaveType: string
  startDate: string
  endDate: string
  days?: number
  reason?: string
}) {
  const id = `leave-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const counted = daysBetween(data.startDate, data.endDate)
  const days = data.days && data.days > 0 ? Math.round(data.days * 2) / 2 : counted
  await db.execute(
    sql`INSERT INTO leave_requests (id, "staffId", "staffName", department, company, "leaveType", "startDate", "endDate", days, reason)
        VALUES (${id}, ${data.staffId}, ${data.staffName}, ${data.department}, ${data.company}, ${data.leaveType}, ${data.startDate}, ${data.endDate}, ${days}, ${data.reason ?? ''})`
  )
  revalidatePath('/statistika')
  return { id }
}

export async function updateLeaveRequest(id: string, data: {
  staffId: string
  staffName: string
  department: string
  company: string
  leaveType: string
  startDate: string
  endDate: string
  days: number
  reason?: string
}) {
  const counted = daysBetween(data.startDate, data.endDate)
  const days = data.days > 0 ? Math.round(data.days * 2) / 2 : counted
  await db.execute(
    sql`UPDATE leave_requests SET
      "staffId" = ${data.staffId},
      "staffName" = ${data.staffName},
      department = ${data.department},
      company = ${data.company},
      "leaveType" = ${data.leaveType},
      "startDate" = ${data.startDate},
      "endDate" = ${data.endDate},
      days = ${days},
      reason = ${data.reason ?? ''}
    WHERE id = ${id}`
  )
  revalidatePath('/statistika')
}

export async function setLeaveSigned(id: string) {
  await db.execute(
    sql`UPDATE leave_requests SET "signedAt" = now() WHERE id = ${id} AND "signedAt" IS NULL`
  )
  revalidatePath('/statistika')
}

export async function setLeaveSignedDocument(id: string, pathname: string) {
  await db.execute(
    sql`UPDATE leave_requests SET "signedDocumentPath" = ${pathname}, "signedAt" = COALESCE("signedAt", now()) WHERE id = ${id}`
  )
  revalidatePath('/statistika')
}

// Potrdilo zdravnika. Ne nastavi podpisa in ne šteje kot redni dopust.
export async function setLeaveDoctorCertificate(id: string, pathname: string) {
  await ensureLeaveColumns()
  await db.execute(
    sql`UPDATE leave_requests SET "doctorCertificatePath" = ${pathname} WHERE id = ${id}`
  )
  revalidatePath('/statistika')
}

export async function deleteLeaveRequest(id: string) {
  await db.execute(sql`DELETE FROM leave_requests WHERE id = ${id}`)
  revalidatePath('/statistika')
}
