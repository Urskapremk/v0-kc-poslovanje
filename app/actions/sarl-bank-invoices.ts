'use server'

import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import {
  listSarlBankInvoices,
  lodgeDay,
  type SarlBankLine,
  type SarlInvoiceCandidate,
} from '@/lib/sarl-bank-invoices'

function invoiceNumber(reservationId: string) {
  const tail = reservationId.slice(-6).toUpperCase()
  const year = new Intl.DateTimeFormat('en-CA', { timeZone: 'Indian/Antananarivo', year: 'numeric' }).format(new Date())
  return tail ? `KC-${year}-${tail}` : ''
}

export async function getSarlBankInvoices(year: number) {
  return loadSarlBankInvoices(year)
}

async function loadSarlBankInvoices(year: number) {
  const [paymentRows, lineRows, emailRows] = await Promise.all([
    db.execute(sql`
      SELECT p.id, p."reservationId" AS "reservationId", p.amount, p.method, p."paidAt" AS "paidAt", p.notes,
             r."guestName" AS "guestName", r."checkedOutAt" AS "checkedOutAt"
      FROM payments p
      JOIN reservations r ON r.id = p."reservationId"
      WHERE lower(trim(p.method)) = 'transfer'
    `),
    db.execute(sql`
      SELECT id, date, amount, description
      FROM bank_transactions
      WHERE company = 'sarl' AND direction = 'in'
    `),
    db.execute(sql`
      SELECT "reservationId" AS "reservationId", min("sentAt") AS "sentAt"
      FROM sent_emails
      WHERE type = 'invoice' AND "reservationId" IS NOT NULL
      GROUP BY "reservationId"
    `),
  ])

  const emailed = new Map<string, string>()
  for (const row of emailRows.rows as Record<string, unknown>[]) {
    const id = String(row.reservationId || '')
    const day = lodgeDay(row.sentAt as string | Date | null)
    if (id && day) emailed.set(id, day)
  }

  const candidates: SarlInvoiceCandidate[] = (paymentRows.rows as Record<string, unknown>[]).map((row) => {
    const reservationId = String(row.reservationId || '')
    return {
      paymentId: String(row.id || ''),
      reservationId,
      guestName: String(row.guestName || ''),
      invoiceNumber: invoiceNumber(reservationId),
      method: String(row.method || ''),
      amountEur: Number(row.amount || 0),
      paidAt: lodgeDay(row.paidAt as string | Date | null),
      notes: row.notes == null ? null : String(row.notes),
      checkedOutAt: lodgeDay(row.checkedOutAt as string | Date | null),
      invoiceEmailedAt: emailed.get(reservationId) || '',
    }
  })

  const lines: SarlBankLine[] = (lineRows.rows as Record<string, unknown>[]).map((row) => ({
    id: String(row.id || ''),
    date: lodgeDay(row.date as string | Date | null),
    description: String(row.description || ''),
    amountAr: Number(row.amount || 0),
  }))

  return listSarlBankInvoices(candidates, lines, year)
}
