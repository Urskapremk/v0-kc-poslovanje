'use server'

import { db } from '@/lib/db'
import { sentEmails } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getCheckinEmailPreview } from './checkin'
import { getInvoiceEmailPreview } from './invoice-email'
import { getTransferVoucherEmailPreview } from './transfer-voucher-email'
import { getFeedbackEmailPreview } from './feedback-email'
import { getExcursionOfferPreview } from './excursion-offer-email'

// Reconstruct the HTML preview of a previously sent email from its stored record.
// The email body is not stored, so we rebuild it from the reservation + type.
export async function getSentEmailPreview(
  id: string
): Promise<{ html?: string; error?: string }> {
  const rows = await db.select().from(sentEmails).where(eq(sentEmails.id, id)).limit(1)
  const rec = rows[0]
  if (!rec) return { error: 'Zapisa emaila ni bilo mogoce najti.' }
  if (!rec.reservationId) {
    return { error: 'Ta email ni povezan z rezervacijo, zato predogleda ni mogoce obnoviti.' }
  }

  try {
    if (rec.type === 'checkin') {
      const r = await getCheckinEmailPreview(rec.reservationId, rec.recipientEmail)
      return r.html ? { html: r.html } : { error: r.error || 'Predogleda ni bilo mogoce obnoviti.' }
    }
    if (rec.type === 'invoice') {
      // Rebuild the exact variant that was sent: language + "brez bivanja" (-S) flag, stored in metadata.
      let excludeAccommodation = false
      let lang: 'en' | 'fr' = 'en'
      if (rec.metadata) {
        try {
          const meta = JSON.parse(rec.metadata) as { excludeAccommodation?: boolean; lang?: string }
          excludeAccommodation = meta.excludeAccommodation === true
          if (meta.lang === 'fr') lang = 'fr'
        } catch {
          /* ignore malformed metadata */
        }
      }
      const r = await getInvoiceEmailPreview(rec.reservationId, lang, excludeAccommodation)
      return r.html ? { html: r.html } : { error: r.error || 'Predogleda ni bilo mogoce obnoviti.' }
    }
    if (rec.type === 'voucher') {
      // Direction (arrival/departure) is not stored; infer it from the subject.
      const subj = (rec.subject || '').toLowerCase()
      const type = subj.includes('departure') || subj.includes('odhod') ? 'departure' : 'arrival'
      const r = await getTransferVoucherEmailPreview(rec.reservationId, type)
      return r.html ? { html: r.html } : { error: r.error || 'Predogleda ni bilo mogoce obnoviti.' }
    }
    if (rec.type === 'feedback') {
      const r = await getFeedbackEmailPreview(rec.reservationId, rec.recipientEmail)
      return r.html ? { html: r.html } : { error: r.error || 'Predogleda ni bilo mogoce obnoviti.' }
    }
    if (rec.type === 'excursion-offer') {
      const r = await getExcursionOfferPreview(rec.reservationId, rec.recipientEmail)
      return r.html ? { html: r.html } : { error: r.error || 'Predogleda ni bilo mogoce obnoviti.' }
    }
    return { error: 'Neznana vrsta emaila.' }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
