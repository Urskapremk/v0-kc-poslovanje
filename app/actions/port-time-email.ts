'use server'

import { db } from '@/lib/db'
import { reservations, agencies } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'
import { logSentEmail } from './sent-emails'
import { buildPortTimeRequestHtml } from '@/lib/port-time-request'
import { bungalowDisplayName } from '@/lib/bungalow'

// Stable, publicly reachable base URL for images (same rule as the other email builders).
function getPublicBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
  return 'https://www.kombacabana.app'
}

type Built = {
  html: string
  to: string
  isAgency: boolean
  guestName: string
  bungalow: string
}

async function buildPortTimeEmail(
  reservationId: string,
  toEmail?: string,
): Promise<Built | { error: string }> {
  const rows = await db
    .select({
      id: reservations.id,
      email: reservations.email,
      bungalow: reservations.bungalow,
      guestName: reservations.guestName,
      arrival: reservations.arrival,
      pax: reservations.pax,
      bookingSource: reservations.bookingSource,
      agencyName: reservations.agencyName,
    })
    .from(reservations)
    .where(eq(reservations.id, reservationId))
    .limit(1)

  const res = rows[0]
  if (!res) return { error: 'Rezervacija ni najdena.' }

  const isAgency = res.bookingSource === 'Agency'
  const guestName = (res.guestName as string) || 'Guest'
  const bungalow = (res.bungalow as string) || ''
  const arrival = res.arrival ? (typeof res.arrival === 'string' ? res.arrival : (res.arrival as Date).toISOString().split('T')[0]) : ''

  // Resolve default recipient. For agency bookings try to find the agency email
  // (name match is loose, so this may miss -> fall back to the reservation email).
  let defaultTo = (res.email || '').trim()
  if (isAgency && res.agencyName) {
    const ag = await db
      .select({ email: agencies.email })
      .from(agencies)
      .where(sql`lower(${agencies.name}) = lower(${res.agencyName})`)
      .limit(1)
    if (ag[0]?.email) defaultTo = (ag[0].email as string).trim()
  }

  const to = (toEmail || defaultTo || '').trim()

  const html = buildPortTimeRequestHtml({
    guestName,
    bungalow: bungalow ? bungalowDisplayName(bungalow) : '',
    arrival,
    pax: (res.pax as number) || undefined,
    isAgency,
    agencyName: (res.agencyName as string) || undefined,
    baseUrl: getPublicBaseUrl(),
  })

  return { html, to, isAgency, guestName, bungalow }
}

// Returns rendered HTML + resolved recipient so the UI can preview before sending.
export async function getPortTimeEmailPreview(
  reservationId: string,
  toEmail?: string,
): Promise<{ html?: string; to?: string; isAgency?: boolean; error?: string }> {
  const built = await buildPortTimeEmail(reservationId, toEmail)
  if ('error' in built) return { error: built.error }
  return { html: built.html, to: built.to, isAgency: built.isAgency }
}

export async function sendPortTimeEmail(
  reservationId: string,
  toEmail?: string,
): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return { success: false, error: 'E-pošta še ni nastavljena (manjka RESEND_API_KEY).' }
  }

  const built = await buildPortTimeEmail(reservationId, toEmail)
  if ('error' in built) return { success: false, error: built.error }
  const { html, to, isAgency, guestName, bungalow } = built
  if (!to) return { success: false, error: 'Ni email naslova prejemnika. Vnesite naslov v polje "Prejemnik".' }

  const from = process.env.EMAIL_FROM || 'Komba Cabana <info@kombacabana.com>'
  const subject = isAgency
    ? `Boat departure time at the port — ${guestName}`
    : 'Your boat transfer to Komba Cabana — departure time from the port'

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
    await logSentEmail({ reservationId, type: 'port-time-request', recipient: to, subject, guestName, bungalow })
    return { success: true }
  } catch (e) {
    return { success: false, error: `Napaka pri pošiljanju: ${(e as Error).message}` }
  }
}
