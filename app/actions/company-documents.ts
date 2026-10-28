'use server'

import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

// Posnetki dokumentov obeh podjetij (KOMBA CABANA TOURISM SARL in KOMBA CABANA SARL).
// Slike živijo v zasebnem Vercel Blobu; tu je le kazalec, da ostanejo po osvežitvi.

export type CompanyId = 'tourism' | 'sarl'

export type CompanyDocument = {
  id: string
  company: CompanyId
  pathname: string
  fileName: string | null
  createdAt: string | null
}

function isCompanyId(value: string): value is CompanyId {
  return value === 'tourism' || value === 'sarl'
}

async function ensureTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS company_documents (
      id text PRIMARY KEY,
      company text NOT NULL,
      pathname text NOT NULL,
      "fileName" text,
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )
  `)
}

export async function getCompanyDocuments(): Promise<CompanyDocument[]> {
  await ensureTable()
  const result = await db.execute(sql`
    SELECT id, company, pathname, "fileName", "createdAt"
    FROM company_documents
    ORDER BY "createdAt" ASC
  `)
  return result.rows.flatMap((r) => {
    const company = String(r.company ?? '')
    if (!isCompanyId(company)) return []
    return [{
      id: String(r.id),
      company,
      pathname: String(r.pathname ?? ''),
      fileName: r.fileName ? String(r.fileName) : null,
      createdAt: r.createdAt ? String(r.createdAt) : null,
    }]
  })
}

export async function addCompanyDocument(params: {
  company: CompanyId
  pathname: string
  fileName?: string
}) {
  const { company, pathname, fileName } = params
  if (!isCompanyId(company)) throw new Error('Neznano podjetje')
  if (!pathname.includes('company-documents/') || pathname.includes('..')) {
    throw new Error('Neveljavna pot slike')
  }
  await ensureTable()
  const id = `cdoc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  await db.execute(sql`
    INSERT INTO company_documents (id, company, pathname, "fileName")
    VALUES (${id}, ${company}, ${pathname}, ${fileName ?? null})
  `)
  revalidatePath('/')
  return { id }
}

export async function deleteCompanyDocument(id: string) {
  if (!id) return
  await ensureTable()
  await db.execute(sql`DELETE FROM company_documents WHERE id = ${id}`)
  revalidatePath('/')
}
