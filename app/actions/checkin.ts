'use server'

import { db } from '@/lib/db'
import { reservations } from '@/lib/db/schema'
import { eq, and, isNull, or } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { randomBytes } from 'crypto'
import { logSentEmail } from './sent-emails'

// ============ GUEST SELF CHECK-IN ============

type GuestSlot = 'first' | 'second' | 'third' | 'fourth'

// Guest fields shared by every slot. For 'first' the DB column is the base name
// (e.g. "guestName"); for 'second'/'third' it is prefixed (e.g. "secondGuestName",
// "thirdGuestName"). This keeps all three guests handled by the same logic.
const GUEST_FIELDS = [
  'guestName',
  'nationality',
  'passport',
  'dateOfBirth',
  'placeOfBirth',
  'fatherName',
  'motherName',
  'profession',
  'domicile',
  'passportDate',
  'passportLieu',
  'venantDe',
  'validiteVisa',
  'allantA',
] as const

// Build the actual DB column name for a base field + slot.
function col(slot: GuestSlot, base: string): string {
  if (slot === 'first') return base
  const prefix = slot === 'second' ? 'second' : slot === 'third' ? 'third' : 'fourth'
  return prefix + base.charAt(0).toUpperCase() + base.slice(1)
}

// The check-in token column for a given slot.
function tokenCol(slot: GuestSlot): 'checkinToken' | 'secondCheckinToken' | 'thirdCheckinToken' | 'fourthCheckinToken' {
  return slot === 'first'
    ? 'checkinToken'
    : slot === 'second'
      ? 'secondCheckinToken'
      : slot === 'third'
        ? 'thirdCheckinToken'
        : 'fourthCheckinToken'
}

// Detect which slot a token belongs to on a reservation row.
function slotForToken(res: Record<string, unknown>, token: string): GuestSlot | null {
  if (res.checkinToken === token) return 'first'
  if (res.secondCheckinToken === token) return 'second'
  if (res.thirdCheckinToken === token) return 'third'
  if (res.fourthCheckinToken === token) return 'fourth'
  return null
}

// Generate or fetch the check-in token for a reservation guest slot.
export async function getOrCreateCheckinToken(
  reservationId: string,
  slot: GuestSlot = 'first'
): Promise<string> {
  const rows = await db
    .select({
      first: reservations.checkinToken,
      second: reservations.secondCheckinToken,
      third: reservations.thirdCheckinToken,
      fourth: reservations.fourthCheckinToken,
    })
    .from(reservations)
    .where(eq(reservations.id, reservationId))
    .limit(1)

  const current =
    slot === 'first'
      ? rows[0]?.first
      : slot === 'second'
        ? rows[0]?.second
        : slot === 'third'
          ? rows[0]?.third
          : rows[0]?.fourth
  if (current) {
    return current
  }

  const token = randomBytes(24).toString('hex')
  await db
    .update(reservations)
    .set({ [tokenCol(slot)]: token })
    .where(eq(reservations.id, reservationId))

  revalidatePath('/')
  return token
}

// Build the stable, publicly reachable base URL for guest links.
// In the v0 preview, window.location.origin points to an ephemeral sandbox
// the guest cannot open — so we always prefer the deployed production domain.
function getPublicBaseUrl(): string | null {
  // Prefer an explicit override, otherwise always use the stable custom domain.
  // We intentionally avoid VERCEL_URL / .vercel.app (SSO-protected + ephemeral in
  // the v0 preview) so guest links always open without a Vercel login.
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
  return 'https://www.kombacabana.app'
}

// Return the full guest check-in link, built from the production domain so it
// works when sent to a guest (not the temporary preview origin).
export async function getCheckinLink(
  reservationId: string,
  slot: GuestSlot = 'first'
): Promise<{ token: string; url: string | null }> {
  const token = await getOrCreateCheckinToken(reservationId, slot)
  const base = getPublicBaseUrl()
  return { token, url: base ? `${base}/checkin/${token}` : null }
}

// Public: fetch the reservation data needed for the guest check-in form.
// Detects which guest slot the token belongs to and returns that guest's
// fields under unified keys, plus the guest's name.
// Only returns guest-relevant fields, never prices or internal data.
// Returns null if token invalid or guest already checked out.
export async function getReservationByToken(token: string) {
  if (!token) return null

  const rows = await db
    .select()
    .from(reservations)
    .where(
      and(
        or(
          eq(reservations.checkinToken, token),
          eq(reservations.secondCheckinToken, token),
          eq(reservations.thirdCheckinToken, token),
          eq(reservations.fourthCheckinToken, token)
        ),
        isNull(reservations.checkedOutAt)
      )
    )
    .limit(1)

  const res = rows[0] as Record<string, unknown> | undefined
  if (!res) return null

  const slot = slotForToken(res, token)
  if (!slot) return null

  // Map each unified key to the correct slot column value.
  const guest: Record<string, unknown> = {}
  for (const base of GUEST_FIELDS) {
    guest[base] = res[col(slot, base)] ?? null
  }

  return {
    id: res.id as string,
    slot,
    guestName: guest.guestName,
    arrival: res.arrival,
    departure: res.departure,
    bungalow: res.bungalow,
    nationality: guest.nationality,
    passport: guest.passport,
    dateOfBirth: guest.dateOfBirth,
    placeOfBirth: guest.placeOfBirth,
    fatherName: guest.fatherName,
    motherName: guest.motherName,
    profession: guest.profession,
    domicile: guest.domicile,
    passportDate: guest.passportDate,
    passportLieu: guest.passportLieu,
    venantDe: guest.venantDe,
    validiteVisa: guest.validiteVisa,
    allantA: guest.allantA,
  }
}

// Public: save the guest-provided check-in data.
// Scoped strictly to the reservation+slot matching the token.
export async function submitCheckinByToken(
  token: string,
  data: {
    guestName?: string
    nationality?: string
    passport?: string
    dateOfBirth?: string
    placeOfBirth?: string
    fatherName?: string
    motherName?: string
    profession?: string
    domicile?: string
    passportDate?: string
    passportLieu?: string
    venantDe?: string
    validiteVisa?: string
    allantA?: string
  }
) {
  if (!token) return { success: false, error: 'Invalid link' }

  // Verify the token maps to an active reservation and detect the slot
  const rows = await db
    .select({
      id: reservations.id,
      checkinToken: reservations.checkinToken,
      secondCheckinToken: reservations.secondCheckinToken,
      thirdCheckinToken: reservations.thirdCheckinToken,
      fourthCheckinToken: reservations.fourthCheckinToken,
    })
    .from(reservations)
    .where(
      and(
        or(
          eq(reservations.checkinToken, token),
          eq(reservations.secondCheckinToken, token),
          eq(reservations.thirdCheckinToken, token),
          eq(reservations.fourthCheckinToken, token)
        ),
        isNull(reservations.checkedOutAt)
      )
    )
    .limit(1)

  const row = rows[0]
  if (!row) {
    return { success: false, error: 'Link expired or invalid' }
  }

  const slot = slotForToken(row, token)
  if (!slot) return { success: false, error: 'Link expired or invalid' }

  // Only write the fields the guest actually provided (non-empty), mapped to
  // the right column for this slot.
  const updates: Record<string, string> = {}
  for (const [key, value] of Object.entries(data)) {
    if (value && (GUEST_FIELDS as readonly string[]).includes(key)) {
      updates[col(slot, key)] = value
    }
  }

  if (Object.keys(updates).length > 0) {
    await db.update(reservations).set(updates).where(eq(reservations.id, row.id))
  }

  revalidatePath('/')
  return { success: true }
}

// ============ SEND CHECK-IN EMAIL (Resend) ============

// Format an ISO-ish date string to "30 Jun 2026" (falls back to the raw value).
function formatEmailDate(value?: string | null): string {
  if (!value) return ''
  const d = new Date(value)
  if (isNaN(d.getTime())) return String(value)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Build the branded HTML email in the Komba Cabana check-in style.
function buildCheckinEmailHtml(opts: {
  guestName: string
  bungalow: string
  arrival: string
  departure: string
  guests: { name: string; url: string }[]
}): string {
  const logo = `${getPublicBaseUrl()}/images/komba-logo-gold.png`
  const stay = [opts.arrival, opts.departure].filter(Boolean).join(' &rarr; ')

  const guestLinks = opts.guests
    .map(
      (g) => `
      <tr>
        <td style="padding:14px 0 0 0;">
          <div style="font-size:14px;color:#e9f0f2;font-weight:600;margin-bottom:8px;">${escapeHtml(g.name)}</div>
          <a href="${g.url}" style="display:inline-block;background:#c59b5b;color:#0a2029;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:10px;">Complete check-in</a>
        </td>
      </tr>`
    )
    .join('')

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
          <h1 style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:26px;font-weight:700;color:#ffffff;">Guest Check-in</h1>
        </td></tr>
        <tr><td bgcolor="#0a2029" style="background-color:#0a2029;padding:12px 16px 0 16px;">
          <p style="margin:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#b9c6ca;text-align:center;">We kindly ask you to complete the information below, which is required by Malagasy law for guest registration with the Police Department.</p>
          <p style="margin:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#b9c6ca;text-align:center;">Unfortunately, Madagascar is quite an administrative country, and a considerable amount of paperwork is required for every guest. We sincerely appreciate your understanding.</p>
          <p style="margin:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#b9c6ca;text-align:center;">All information provided will be treated confidentially and used solely for the mandatory registration process.</p>
          <p style="margin:0 0 20px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#b9c6ca;text-align:center;">Thank you for your kindness, and we wish you a wonderful stay with us.<br>The Komba Cabana Team</p>
        </td></tr>
        <tr><td bgcolor="#0a2029" style="background-color:#0a2029;padding:8px 16px 0 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#143a49" style="background-color:#143a49;border:1px solid #1d4a5c;border-radius:16px;">
            <tr><td bgcolor="#143a49" style="background-color:#143a49;padding:20px 22px;border-radius:16px;">
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:2px;color:#7f9095;text-transform:uppercase;">Welcome</div>
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:700;color:#ffffff;margin-top:6px;">Welcome to Komba Cabana Lodge</div>
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#c59b5b;margin-top:4px;">${escapeHtml(opts.bungalow)}</div>
              ${stay ? `<div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#b9c6ca;margin-top:6px;">Your stay: ${stay}</div>` : ''}
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#143a49" style="background-color:#143a49;">${guestLinks}</table>
            </td></tr>
          </table>
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

// Send the branded check-in email to the guest via Resend.
// Requires RESEND_API_KEY; sender can be set via EMAIL_FROM (defaults to the
// Komba Cabana address). Returns a friendly result the UI can show.
// Shared helper: load reservation, build guest links + HTML, resolve recipient.
// Optional per-guest name overrides. When the real partner/children names aren't
// known yet, the operator can set them here; they are persisted to the reservation
// (so the police form + links carry the name) and used to build the email.
// Backwards-compatible simple name overrides (kept for any older callers).
export type GuestNameOverrides = {
  first?: string
  second?: string
  third?: string
  fourth?: string
}

// Full editable police-form field set for a single guest slot. Every field is
// optional; only provided (non-undefined) fields are persisted, so the operator
// can correct any subset — including data the guest already entered.
export type GuestFieldValues = {
  guestName?: string
  nationality?: string
  passport?: string
  dateOfBirth?: string
  placeOfBirth?: string
  fatherName?: string
  motherName?: string
  profession?: string
  domicile?: string
  passportDate?: string
  passportLieu?: string
  venantDe?: string
  validiteVisa?: string
  allantA?: string
}

// Per-slot overrides. Operator edits in the check-in email preview modal.
export type GuestDataOverrides = Partial<Record<GuestSlot, GuestFieldValues>>

async function buildCheckinEmail(
  reservationId: string,
  toEmail?: string,
  guestData?: GuestDataOverrides
): Promise<{ html: string; to: string; guestName: string; bungalow: string } | { error: string }> {
  const rows = await db
    .select({
      id: reservations.id,
      email: reservations.email,
      bungalow: reservations.bungalow,
      arrival: reservations.arrival,
      departure: reservations.departure,
      guestName: reservations.guestName,
      secondGuestName: reservations.secondGuestName,
      thirdGuestName: reservations.thirdGuestName,
      fourthGuestName: reservations.fourthGuestName,
    })
    .from(reservations)
    .where(eq(reservations.id, reservationId))
    .limit(1)

  const res = rows[0]
  if (!res) return { error: 'Rezervacija ni najdena.' }

  // Persist any operator-provided police-form fields (all slots, all fields),
  // mapped to the correct column per slot. Only non-undefined values are written,
  // so unchanged fields keep their stored value.
  if (guestData) {
    const upd: Record<string, string> = {}
    for (const slot of ['first', 'second', 'third', 'fourth'] as GuestSlot[]) {
      const gd = guestData[slot]
      if (!gd) continue
      for (const base of GUEST_FIELDS) {
        const v = gd[base as keyof GuestFieldValues]
        if (v !== undefined) upd[col(slot, base)] = v.trim()
      }
    }
    if (Object.keys(upd).length > 0) {
      await db.update(reservations).set(upd).where(eq(reservations.id, reservationId))
    }
  }

  // Effective names = override (if provided) else the stored value.
  const effName = (slot: 'first' | 'second' | 'third' | 'fourth', stored?: string | null): string => {
    const o = guestData?.[slot]?.guestName
    return ((o !== undefined ? o : stored) || '').trim()
  }
  const names = {
    first: effName('first', res.guestName),
    second: effName('second', res.secondGuestName),
    third: effName('third', res.thirdGuestName),
    fourth: effName('fourth', res.fourthGuestName),
  }

  // Recipient is optional for building/previewing; it's only required when sending.
  const to = (toEmail || res.email || '').trim()

  // Build links for every guest present on this reservation (slot included when
  // it has a name — including names the operator just entered above).
  const slots: { slot: GuestSlot; name: string }[] = [{ slot: 'first', name: names.first }]
  if (names.second) slots.push({ slot: 'second', name: names.second })
  if (names.third) slots.push({ slot: 'third', name: names.third })
  if (names.fourth) slots.push({ slot: 'fourth', name: names.fourth })

  const guests: { name: string; url: string }[] = []
  for (const s of slots) {
    const link = await getCheckinLink(reservationId, s.slot)
    // Use the guest's full name (name + surname) so it reads more warmly.
    if (link.url) guests.push({ name: s.name || 'Guest', url: link.url })
  }

  const html = buildCheckinEmailHtml({
    guestName: names.first || 'Guest',
    bungalow: (res.bungalow as string) || '',
    arrival: formatEmailDate(res.arrival as string | null),
    departure: formatEmailDate(res.departure as string | null),
    guests,
  })

  return { html, to, guestName: names.first || 'Guest', bungalow: (res.bungalow as string) || '' }
}

// Returns the rendered HTML + recipient so the UI can show a preview before sending.
export async function getCheckinEmailPreview(
  reservationId: string,
  toEmail?: string,
  guestData?: GuestDataOverrides
): Promise<{ html?: string; to?: string; error?: string }> {
  const built = await buildCheckinEmail(reservationId, toEmail, guestData)
  if ('error' in built) return { error: built.error }
  return { html: built.html, to: built.to }
}

export async function sendCheckinEmail(
  reservationId: string,
  toEmail?: string,
  guestData?: GuestDataOverrides
): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return { success: false, error: 'E-pošta še ni nastavljena (manjka RESEND_API_KEY).' }
  }

  const built = await buildCheckinEmail(reservationId, toEmail, guestData)
  if ('error' in built) return { success: false, error: built.error }
  const { html, to, guestName, bungalow } = built
  if (!to) return { success: false, error: 'Gost nima vpisanega email naslova.' }

  const from = process.env.EMAIL_FROM || 'Komba Cabana <info@kombacabana.com>'
  const subject = "Just a little more paperwork, and we'll be all set."

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html,
      }),
    })

    if (!resp.ok) {
      const detail = await resp.text()
      return { success: false, error: `Pošiljanje ni uspelo: ${detail.slice(0, 200)}` }
    }
    await logSentEmail({ reservationId, type: 'checkin', recipient: to, subject, guestName, bungalow })
    return { success: true }
  } catch (e) {
    return { success: false, error: `Napaka pri pošiljanju: ${(e as Error).message}` }
  }
}
