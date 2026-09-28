'use server'

import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

// Posnetki zaslona korespondence (npr. sporočila iz Bentrala), pripeti na rezervacijo.
export type MessageShot = {
  id: string
  reservationId: string
  pathname: string
  fileName: string | null
  caption: string
  createdAt: string | null
}

export async function getMessageShots(reservationId: string): Promise<MessageShot[]> {
  if (!reservationId) return []
  const result = await db.execute(
    sql`SELECT * FROM reservation_message_shots
        WHERE "reservationId" = ${reservationId}
        ORDER BY "createdAt" ASC`
  )
  return result.rows.map((r) => ({
    id: r.id as string,
    reservationId: r.reservationId as string,
    pathname: r.pathname as string,
    fileName: (r.fileName as string | null) ?? null,
    caption: (r.caption as string) ?? '',
    createdAt: r.createdAt ? String(r.createdAt) : null,
  }))
}

export async function addMessageShot(params: {
  reservationId: string
  pathname: string
  fileName?: string
  caption?: string
}) {
  const { reservationId, pathname, fileName, caption } = params
  const id = `shot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  await db.execute(
    sql`INSERT INTO reservation_message_shots (id, "reservationId", pathname, "fileName", caption)
        VALUES (${id}, ${reservationId}, ${pathname}, ${fileName ?? null}, ${caption ?? ''})`
  )
  revalidatePath('/')
  return { id }
}

export async function updateMessageShotCaption(id: string, caption: string) {
  await db.execute(
    sql`UPDATE reservation_message_shots SET caption = ${caption ?? ''} WHERE id = ${id}`
  )
  revalidatePath('/')
}

// Izbriše zapis posnetka (datoteka ostane v shrambi, a ni več prikazana).
export async function deleteMessageShot(id: string) {
  await db.execute(sql`DELETE FROM reservation_message_shots WHERE id = ${id}`)
  revalidatePath('/')
}
