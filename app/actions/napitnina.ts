'use server'

import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

export type NapitninaDocument = {
  id: string
  year: number
  month: number
  fileName: string | null
  pathname: string
  uploadedAt: string | null
}

// Vrne naložene dokumente/fotografije za razdelitev napitnine v danem mesecu.
export async function getNapitninaDocuments(year: number, month: number): Promise<NapitninaDocument[]> {
  const result = await db.execute(
    sql`SELECT * FROM napitnina_documents WHERE year = ${year} AND month = ${month} ORDER BY "uploadedAt" DESC`
  )
  return result.rows.map((r) => ({
    id: r.id as string,
    year: r.year as number,
    month: r.month as number,
    fileName: (r.fileName as string | null) ?? null,
    pathname: r.pathname as string,
    uploadedAt: r.uploadedAt as string | null,
  }))
}

// Doda naložen dokument (pot iz blob shrambe) za dani mesec.
export async function addNapitninaDocument(
  year: number,
  month: number,
  pathname: string,
  fileName?: string,
) {
  const id = `naptdoc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  await db.execute(
    sql`INSERT INTO napitnina_documents (id, year, month, "fileName", pathname)
        VALUES (${id}, ${year}, ${month}, ${fileName ?? null}, ${pathname})`
  )
  revalidatePath('/statistika')
  return { id }
}

// Izbriše zapis dokumenta (blob ostane v shrambi, a ni več prikazan).
export async function deleteNapitninaDocument(id: string) {
  await db.execute(sql`DELETE FROM napitnina_documents WHERE id = ${id}`)
  revalidatePath('/statistika')
}
