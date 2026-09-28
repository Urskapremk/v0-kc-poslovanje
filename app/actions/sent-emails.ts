'use server'

import { db } from '@/lib/db'
import { sentEmails } from '@/lib/db/schema'
import { desc, eq } from 'drizzle-orm'

export type SentEmailType = 'checkin' | 'invoice' | 'voucher' | 'feedback' | 'excursion-offer' | 'port-time-request' | 'guest-reply'

export interface SentEmailRecord {
  id: string
  reservationId: string | null
  type: string
  recipient: string
  subject: string | null
  guestName: string | null
  bungalow: string | null
  // For invoice emails: which variant was actually sent, so the preview matches.
  excludeAccommodation?: boolean
  lang?: string | null
  sentAt: string
}

// Record a successfully sent email. Never throws (logging must not break sending).
export async function logSentEmail(entry: {
  reservationId?: string | null
  type: SentEmailType
  recipient: string
  subject?: string | null
  guestName?: string | null
  bungalow?: string | null
  excludeAccommodation?: boolean
  lang?: string | null
}): Promise<void> {
  try {
    const meta: Record<string, unknown> = {}
    if (entry.bungalow) meta.bungalow = entry.bungalow
    if (entry.excludeAccommodation) meta.excludeAccommodation = true
    if (entry.lang) meta.lang = entry.lang
    await db.insert(sentEmails).values({
      id: `mail-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      reservationId: entry.reservationId ?? null,
      type: entry.type,
      recipientEmail: entry.recipient,
      recipientName: entry.guestName ?? null,
      subject: entry.subject ?? '',
      status: 'sent',
      metadata: Object.keys(meta).length ? JSON.stringify(meta) : null,
    })
  } catch (e) {
    console.log('[v0] logSentEmail failed:', (e as Error).message)
  }
}

function toRecord(r: typeof sentEmails.$inferSelect): SentEmailRecord {
  let bungalow: string | null = null
  let excludeAccommodation = false
  let lang: string | null = null
  if (r.metadata) {
    try {
      const meta = JSON.parse(r.metadata) as { bungalow?: string; excludeAccommodation?: boolean; lang?: string }
      bungalow = meta.bungalow ?? null
      excludeAccommodation = meta.excludeAccommodation === true
      lang = meta.lang ?? null
    } catch {
      bungalow = null
    }
  }
  return {
    id: r.id,
    reservationId: r.reservationId,
    type: r.type,
    recipient: r.recipientEmail,
    subject: r.subject,
    guestName: r.recipientName,
    bungalow,
    excludeAccommodation,
    lang,
    sentAt: (r.sentAt instanceof Date ? r.sentAt : new Date(r.sentAt as unknown as string)).toISOString(),
  }
}

// All sent emails for one reservation (newest first).
export async function getSentEmailsForReservation(reservationId: string): Promise<SentEmailRecord[]> {
  const rows = await db
    .select()
    .from(sentEmails)
    .where(eq(sentEmails.reservationId, reservationId))
    .orderBy(desc(sentEmails.sentAt))
  return rows.map(toRecord)
}

// Global overview of every sent email (newest first, capped).
export async function getAllSentEmails(limit = 200): Promise<SentEmailRecord[]> {
  const rows = await db.select().from(sentEmails).orderBy(desc(sentEmails.sentAt)).limit(limit)
  return rows.map(toRecord)
}

// Remove a single sent-email record from the log.
export async function deleteSentEmail(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    await db.delete(sentEmails).where(eq(sentEmails.id, id))
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
