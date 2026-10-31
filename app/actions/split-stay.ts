'use server'

import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { stayUnits } from '@/lib/bungalow'

export type SplitUnitInput = {
  unitKey: string
  guestName: string
  adults: number
  children: number
  totalAmount: number
}

/**
 * Splits one booking over several units into separate reservations, one per unit,
 * so each unit gets its own delivery note, invoice and payments. The first unit
 * stays on the original reservation; the rest are copied from it and linked
 * through groupId.
 */
export async function splitStayByUnit(reservationId: string, parts: SplitUnitInput[]) {
  const rows = (await db.execute(sql`SELECT * FROM reservations WHERE id = ${reservationId}`)).rows as Record<string, unknown>[]
  const base = rows[0]
  if (!base) return { ok: false as const, error: 'Rezervacija ne obstaja.' }

  const segments = String(base.bungalow || '').split(';').map(s => s.trim()).filter(Boolean)
  const segmentByKey = new Map<string, string>()
  for (const seg of segments) {
    const key = stayUnits(seg)[0]?.key
    if (key && !segmentByKey.has(key)) segmentByKey.set(key, seg)
  }
  if (segmentByKey.size < 2) return { ok: false as const, error: 'Rezervacija je samo v enem bungalovu.' }

  const mainKey = Array.from(segmentByKey.keys())[0]
  const extra = parts.filter(p => p.unitKey !== mainKey && segmentByKey.has(p.unitKey))
  if (extra.length === 0) return { ok: false as const, error: 'Ni bungalovov za ločitev.' }

  for (const p of extra) {
    if (!p.guestName.trim()) return { ok: false as const, error: 'Vpiši nosilca za vsak bungalov.' }
    if (p.adults < 1 || p.children < 0) return { ok: false as const, error: 'Vsak bungalov potrebuje vsaj 1 odraslo osebo.' }
  }

  const extraAdults = extra.reduce((s, p) => s + p.adults, 0)
  const extraChildren = extra.reduce((s, p) => s + p.children, 0)
  const extraTotal = extra.reduce((s, p) => s + (p.totalAmount || 0), 0)
  const baseAdults = Number(base.adults || 0) - extraAdults
  const baseChildren = Math.max(0, Number(base.children || 0) - extraChildren)
  if (baseAdults < 1) return { ok: false as const, error: 'V glavnem bungalovu mora ostati vsaj 1 odrasla oseba.' }

  const groupId = (base.groupId as string) || `grp-${Date.now()}`
  const baseTotal = Math.max(0, Number(base.totalAmount || 0) - extraTotal)

  for (const p of extra) {
    const id = `res-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    const patch = {
      id,
      bungalow: segmentByKey.get(p.unitKey),
      guestName: p.guestName.trim(),
      pax: p.adults + p.children,
      adults: p.adults,
      children: p.children,
      childrenAges: null,
      totalAmount: String(p.totalAmount || 0),
      amountPaid: '0',
      bentralReservationId: null,
      groupId,
      secondGuestName: null,
      thirdGuestName: null,
      fourthGuestName: null,
    }
    await db.execute(sql`
      INSERT INTO reservations
      SELECT (jsonb_populate_record(NULL::reservations, to_jsonb(r) || ${JSON.stringify(patch)}::jsonb)).*
      FROM reservations r WHERE r.id = ${reservationId}
    `)
  }

  await db.execute(sql`
    UPDATE reservations SET
      bungalow = ${segmentByKey.get(mainKey)!},
      adults = ${baseAdults},
      children = ${baseChildren},
      pax = ${baseAdults + baseChildren},
      "totalAmount" = ${String(baseTotal)},
      "groupId" = ${groupId},
      "updatedAt" = now()
    WHERE id = ${reservationId}
  `)

  return { ok: true as const, created: extra.length }
}
