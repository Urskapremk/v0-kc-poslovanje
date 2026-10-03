'use server'

import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { parseCategories, type CategoryAllocation } from '@/lib/stroski-categories'

export type StroskiReceipt = {
  id: string
  year: number
  month: number
  date: string
  description: string
  amountEur: number
  categories: CategoryAllocation[]
  pathname: string
  fileName: string | null
  createdAt: string | null
}

// Vrne vse arhivirane račune (fotografije stroškov) za dano leto.
export async function getStroskiReceipts(year: number): Promise<StroskiReceipt[]> {
  const result = await db.execute(
    sql`SELECT * FROM stroski_receipts WHERE year = ${year} ORDER BY date DESC, "createdAt" DESC`
  )
  return result.rows.map((r) => ({
    id: r.id as string,
    year: r.year as number,
    month: r.month as number,
    date: r.date as string,
    description: (r.description as string) ?? '',
    amountEur: Number(r.amountEur ?? 0),
    categories: parseCategories(r.categories),
    pathname: r.pathname as string,
    fileName: (r.fileName as string | null) ?? null,
    createdAt: r.createdAt as string | null,
  }))
}

// Doda arhiviran račun. Mesec/leto se izpeljeta iz datuma računa.
export async function addStroskiReceipt(params: {
  date: string
  description: string
  amountEur: number
  categories?: CategoryAllocation[]
  pathname: string
  fileName?: string
}) {
  const { date, description, amountEur, pathname, fileName } = params
  const categories = parseCategories(params.categories)
  const d = new Date(date)
  const year = d.getFullYear()
  const month = d.getMonth() + 1
  const id = `receipt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  await db.execute(
    sql`INSERT INTO stroski_receipts (id, year, month, date, description, "amountEur", categories, "pathname", "fileName")
        VALUES (${id}, ${year}, ${month}, ${date}, ${description || ''}, ${amountEur || 0}, ${JSON.stringify(categories)}::jsonb, ${pathname}, ${fileName ?? null})`
  )
  revalidatePath('/statistika')
  revalidatePath('/')
  return { id }
}

// Posodobi podatke arhiviranega računa (datum, opis, znesek).
export async function updateStroskiReceipt(
  id: string,
  params: { date: string; description: string; amountEur: number; categories?: CategoryAllocation[] },
) {
  const { date, description, amountEur } = params
  const categories = parseCategories(params.categories)
  const d = new Date(date)
  const year = d.getFullYear()
  const month = d.getMonth() + 1
  await db.execute(
    sql`UPDATE stroski_receipts
        SET date = ${date}, year = ${year}, month = ${month}, description = ${description || ''}, "amountEur" = ${amountEur || 0}, categories = ${JSON.stringify(categories)}::jsonb
        WHERE id = ${id}`
  )
  revalidatePath('/statistika')
}

// Izbriše zapis računa (blob ostane v shrambi, a ni več prikazan).
export async function deleteStroskiReceipt(id: string) {
  await db.execute(sql`DELETE FROM stroski_receipts WHERE id = ${id}`)
  revalidatePath('/statistika')
}
