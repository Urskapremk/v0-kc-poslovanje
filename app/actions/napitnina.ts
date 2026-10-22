'use server'

import { db } from '@/lib/db'
import { settings } from '@/lib/db/schema'
import { sql, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

export type NapitninaDraft = {
  amounts: Record<string, string>
  removed: string[]
  present: string[]
  upToDate: string
}

function draftKey(year: number, month: number) {
  return `napitnina-list-${year}-${month}`
}

// Shranjena razdelitev za mesec: zneski, kdo je odstranjen, kdo je bil pri štetju.
export async function getNapitninaDraft(year: number, month: number): Promise<NapitninaDraft | null> {
  const rows = await db.select().from(settings).where(eq(settings.key, draftKey(year, month))).limit(1)
  if (!rows[0]?.value) return null
  try {
    const parsed = JSON.parse(rows[0].value) as Partial<NapitninaDraft>
    return {
      amounts: parsed.amounts && typeof parsed.amounts === 'object' ? parsed.amounts : {},
      removed: Array.isArray(parsed.removed) ? parsed.removed.filter((id) => typeof id === 'string') : [],
      present: Array.isArray(parsed.present) ? parsed.present.filter((id) => typeof id === 'string') : [],
      upToDate: typeof parsed.upToDate === 'string' ? parsed.upToDate : '',
    }
  } catch {
    return null
  }
}

export async function saveNapitninaDraft(year: number, month: number, draft: NapitninaDraft) {
  const key = draftKey(year, month)
  const value = JSON.stringify({
    amounts: draft.amounts || {},
    removed: draft.removed || [],
    present: draft.present || [],
    upToDate: draft.upToDate || '',
  })
  await db
    .insert(settings)
    .values({ id: `set-${key}`, key, value })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value, updatedAt: new Date() },
    })
  revalidatePath('/statistika')
  return { ok: true }
}

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
