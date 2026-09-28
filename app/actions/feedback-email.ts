'use server'

import { db } from '@/lib/db'
import { reservations } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { logSentEmail } from './sent-emails'
import { SURVEY_SOURCES } from '@/lib/survey-sources'

// Stable, publicly reachable base URL for images (same rule as checkin.ts).
function getPublicBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
  return 'https://www.kombacabana.app'
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function firstNameOf(fullName: string): string {
  return (fullName || '').trim().split(/\s+/)[0] || 'there'
}

// Build the branded HTML "where did you find us" email in the Komba Cabana style.
// Each source button links to the public survey page, which records the answer
// in our database and shows a thank-you page — no inbox required.
function buildFeedbackEmailHtml(opts: { reservationId: string; guestName: string; bungalow: string }): string {
  const base = getPublicBaseUrl()
  const logo = `${base}/images/komba-logo-gold.png`
  const hi = escapeHtml(firstNameOf(opts.guestName))

  const buttons = SURVEY_SOURCES.map(({ key, emoji, label }) => {
    const href = `${base}/survey/${encodeURIComponent(opts.reservationId)}/${encodeURIComponent(key)}`
    return `
      <tr>
        <td style="padding:6px 0;">
          <a href="${href}" style="display:block;background:#143a49;border:1px solid #1d4a5c;color:#e9f0f2;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-weight:600;font-size:14px;padding:12px 18px;border-radius:10px;text-align:left;"><span style="display:inline-block;width:24px;">${emoji}</span>${escapeHtml(label)}</a>
        </td>
      </tr>`
  }).join('')

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#0a2029;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#0a2029" style="background-color:#0a2029;">
    <tr><td align="center" bgcolor="#0a2029" style="background-color:#0a2029;padding:32px 16px;">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" bgcolor="#0a2029" style="width:560px;max-width:560px;background-color:#0a2029;">
        <tr><td align="center" bgcolor="#0a2029" style="background-color:#0a2029;padding:8px 0 24px 0;">
          <img src="${logo}" alt="Komba Cabana" width="140" style="display:block;border:0;outline:none;max-width:140px;height:auto;">
        </td></tr>
        <tr><td align="center" bgcolor="#0a2029" style="background-color:#0a2029;padding:0 8px 8px 8px;">
          <h1 style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:26px;font-weight:700;color:#ffffff;">A quick question 😊</h1>
        </td></tr>
        <tr><td bgcolor="#0a2029" style="background-color:#0a2029;padding:12px 16px 0 16px;">
          <p style="margin:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#b9c6ca;text-align:center;">Dear ${hi},</p>
          <p style="margin:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#b9c6ca;text-align:center;">We are always looking for ways to improve and to better understand how travelers discover Komba Cabana.</p>
          <p style="margin:0 0 20px 0;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#c59b5b;text-align:center;font-weight:600;">Would you mind taking a few seconds to tell us how you found our lodge?</p>
          <p style="margin:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:#7f9095;text-align:center;">Just tap the option that fits. Found us in more than one place? You can select all that apply on the next page &mdash; and add a few words if you like.</p>
        </td></tr>
        <tr><td bgcolor="#0a2029" style="background-color:#0a2029;padding:4px 24px 0 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#0a2029" style="background-color:#0a2029;">${buttons}</table>
        </td></tr>
        <tr><td bgcolor="#0a2029" style="background-color:#0a2029;padding:20px 16px 0 16px;">
          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#b9c6ca;text-align:center;">Your answer will help us understand where our guests come from and how we can continue improving our services.</p>
          <p style="margin:16px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#b9c6ca;text-align:center;">Thank you very much for your time, and for being our guest at Komba Cabana!</p>
          <p style="margin:16px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#b9c6ca;text-align:center;">Warm regards,<br>Komba Cabana Team</p>
        </td></tr>
        <tr><td align="center" bgcolor="#0a2029" style="background-color:#0a2029;padding:24px 16px 8px 16px;">
          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#7e786d;">Komba Cabana &middot; Nosy Komba, Madagascar</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// Load reservation, build HTML + resolve recipient.
async function buildFeedbackEmail(
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
  const html = buildFeedbackEmailHtml({
    reservationId: (res.id as string) || reservationId,
    guestName: (res.guestName as string) || 'Guest',
    bungalow: (res.bungalow as string) || '',
  })
  return { html, to, guestName: (res.guestName as string) || 'Guest', bungalow: (res.bungalow as string) || '' }
}

// Returns the rendered HTML + recipient so the UI can show a preview before sending.
export async function getFeedbackEmailPreview(
  reservationId: string,
  toEmail?: string
): Promise<{ html?: string; to?: string; error?: string }> {
  const built = await buildFeedbackEmail(reservationId, toEmail)
  if ('error' in built) return { error: built.error }
  return { html: built.html, to: built.to }
}

export async function sendFeedbackEmail(
  reservationId: string,
  toEmail?: string
): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return { success: false, error: 'E-pošta še ni nastavljena (manjka RESEND_API_KEY).' }
  }

  const built = await buildFeedbackEmail(reservationId, toEmail)
  if ('error' in built) return { success: false, error: built.error }
  const { html, to, guestName, bungalow } = built
  if (!to) return { success: false, error: 'Gost nima vpisanega email naslova.' }

  const from = process.env.EMAIL_FROM || 'Komba Cabana <info@kombacabana.com>'
  const subject = 'A quick question 😊'

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
    await logSentEmail({ reservationId, type: 'feedback', recipient: to, subject, guestName, bungalow })
    return { success: true }
  } catch (e) {
    return { success: false, error: `Napaka pri pošiljanju: ${(e as Error).message}` }
  }
}
