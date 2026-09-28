'use server'

import { db } from '@/lib/db'
import { reservations } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { logSentEmail } from './sent-emails'
import { buildExcursionOfferHtml } from '@/lib/excursion-offer'

// Stable, publicly reachable base URL for images (same rule as feedback-email.ts).
function getPublicBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
  return 'https://www.kombacabana.app'
}

// Load reservation, build HTML + resolve recipient.
async function buildOfferEmail(
  reservationId: string,
  toEmail?: string
): Promise<{ html: string; to: string; guestName: string; bungalow: string } | { error: string }> {
  const rows = await db
    .select({
      id: reservations.id,
      email: reservations.email,
      bungalow: reservations.bungalow,
      guestName: reservations.guestName,
    })
    .from(reservations)
    .where(eq(reservations.id, reservationId))
    .limit(1)

  const res = rows[0]
  if (!res) return { error: 'Rezervacija ni najdena.' }

  const to = (toEmail || res.email || '').trim()
  const html = buildExcursionOfferHtml({
    guestName: (res.guestName as string) || 'Guest',
    baseUrl: getPublicBaseUrl(),
  })
  return { html, to, guestName: (res.guestName as string) || 'Guest', bungalow: (res.bungalow as string) || '' }
}

// Returns the rendered HTML + recipient so the UI can show a preview before sending.
export async function getExcursionOfferPreview(
  reservationId: string,
  toEmail?: string
): Promise<{ html?: string; to?: string; error?: string }> {
  const built = await buildOfferEmail(reservationId, toEmail)
  if ('error' in built) return { error: built.error }
  return { html: built.html, to: built.to }
}

export async function sendExcursionOffer(
  reservationId: string,
  toEmail?: string
): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return { success: false, error: 'E-pošta še ni nastavljena (manjka RESEND_API_KEY).' }
  }

  const built = await buildOfferEmail(reservationId, toEmail)
  if ('error' in built) return { success: false, error: built.error }
  const { html, to, guestName, bungalow } = built
  if (!to) return { success: false, error: 'Gost nima vpisanega email naslova.' }

  const from = process.env.EMAIL_FROM || 'Komba Cabana <info@kombacabana.com>'
  const subject = 'Excursions & day trips at Komba Cabana'

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to: [to], subject, html }),
    })

    if (!resp.ok) {
      const detail = await resp.text()
      return { success: false, error: `Pošiljanje ni uspelo: ${detail.slice(0, 200)}` }
    }
    await logSentEmail({ reservationId, type: 'excursion-offer', recipient: to, subject, guestName, bungalow })
    return { success: true }
  } catch (e) {
    return { success: false, error: `Napaka pri pošiljanju: ${(e as Error).message}` }
  }
}
