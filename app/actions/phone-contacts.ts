'use server'

import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { normalizeMgNumber, type Contact } from '@/lib/phone-directory'

/* ── Telefonski imenik (urejljiv) ────────────────────────────────────────
 * Stiki, ki jih uporablja razčlenjevalnik Orange Money nakazil (odlivi in
 * prilivi) za razreševanje imen prejemnikov/pošiljateljev po telefonski
 * številki. Urška lahko dodaja/briše številke; nove se samodejno uporabijo
 * pri naslednji razčlembi in retroaktivno na obstoječih neznanih nakazilih.
 * ---------------------------------------------------------------------- */

export type PhoneContact = Contact & { id: string; createdAt: string | null }

export async function getPhoneContacts(): Promise<PhoneContact[]> {
  const rows = await db.execute(
    sql`SELECT id, name, number, "createdAt" FROM phone_contacts ORDER BY name ASC`
  )
  return (rows.rows as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    number: r.number as string,
    createdAt: r.createdAt ? String(r.createdAt) : null,
  }))
}

/** Posodobi ime prejemnika pri obstoječih nakazilih, ki se ujemajo s stiki. */
async function reresolveOmTransfers(contacts: Contact[]): Promise<number> {
  const rows = await db.execute(
    sql`SELECT id, "recipientNumber", "recipientName" FROM om_transfers`
  )
  let updated = 0
  for (const r of rows.rows as Record<string, unknown>[]) {
    const number = (r.recipientNumber as string) ?? ''
    if (!number) continue
    const key = normalizeMgNumber(number)
    const hit = contacts.find((c) => normalizeMgNumber(c.number) === key)
    const newName = hit ? hit.name : null
    const oldName = (r.recipientName as string) ?? null
    if (newName && newName !== oldName) {
      await db.execute(sql`UPDATE om_transfers SET "recipientName" = ${newName} WHERE id = ${r.id as string}`)
      updated++
    }
  }
  return updated
}

export async function addPhoneContact(
  name: string,
  number: string
): Promise<{ contact: PhoneContact; reresolved: number }> {
  const cleanName = name.trim()
  const cleanNumber = number.replace(/[^\d+]/g, '')
  const id = `pc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  await db.execute(
    sql`INSERT INTO phone_contacts (id, name, number, "createdAt")
        VALUES (${id}, ${cleanName}, ${cleanNumber}, now())`
  )
  const contacts = await getPhoneContacts()
  const reresolved = await reresolveOmTransfers(contacts)
  revalidatePath('/statistika')
  return {
    contact: { id, name: cleanName, number: cleanNumber, createdAt: new Date().toISOString() },
    reresolved,
  }
}

export async function deletePhoneContact(id: string): Promise<void> {
  await db.execute(sql`DELETE FROM phone_contacts WHERE id = ${id}`)
  revalidatePath('/statistika')
}
