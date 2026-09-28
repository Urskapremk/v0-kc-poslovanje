'use server'

import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { parseOmIncomingList, type ParsedIncomingList } from '@/lib/om-parse'
import { getPhoneContacts } from '@/app/actions/phone-contacts'

/* ── Seznam prejetih nakazil (prilivi) ────────────────────────────────────
 * Zrcalno k Seznamu nakazil (odlivi). Referenčni pregled prejetih nakazil
 * iz prilepljenih SMS obvestil; NE vpliva na saldo denarnice. */

export type OmIncoming = {
  id: string
  transferDate: string | null
  amount: number
  senderNumber: string | null
  senderName: string | null
  transId: string | null
  rawText: string | null
  createdAt: string | null
}

export async function getOmIncoming(): Promise<OmIncoming[]> {
  const rows = await db.execute(
    sql`SELECT * FROM om_incoming ORDER BY COALESCE("transferDate", '') DESC, "createdAt" DESC`
  )
  return (rows.rows as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    transferDate: (r.transferDate as string) ?? null,
    amount: Number(r.amount ?? 0),
    senderNumber: (r.senderNumber as string) ?? null,
    senderName: (r.senderName as string) ?? null,
    transId: (r.transId as string) ?? null,
    rawText: (r.rawText as string) ?? null,
    createdAt: r.createdAt ? String(r.createdAt) : null,
  }))
}

export async function parseAndSaveOmIncoming(
  rawText: string
): Promise<{ saved: number; skipped: number; parsed: ParsedIncomingList[] }> {
  const contacts = await getPhoneContacts()
  const parsed = parseOmIncomingList(rawText, contacts)
  let saved = 0
  for (const p of parsed) {
    const res = await db.execute(
      sql`INSERT INTO om_incoming (id, "transferDate", amount, "senderNumber", "senderName", "transId", "rawText", "createdAt")
          VALUES (${p.id}, ${p.transferDate}, ${p.amount}, ${p.senderNumber}, ${p.senderName}, ${p.transId}, ${p.rawText}, now())
          ON CONFLICT (id) DO NOTHING
          RETURNING id`
    )
    if ((res.rows as unknown[]).length > 0) saved++
  }
  revalidatePath('/statistika')
  return { saved, skipped: parsed.length - saved, parsed }
}

export async function deleteOmIncoming(id: string): Promise<void> {
  await db.execute(sql`DELETE FROM om_incoming WHERE id = ${id}`)
  revalidatePath('/statistika')
}
