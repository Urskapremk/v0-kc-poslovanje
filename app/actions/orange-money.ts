'use server'

import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

/* ── Orange Money denarnica ─────────────────────────────────────────────
 * Povsem ločena mobilna denarnica (Ariary). Prilivi: Revolut, direktna
 * nakazila, plačila strank. Odlivi: plačila prek Orange Money. Saldo =
 * začetno stanje + prilivi − odlivi.
 * ---------------------------------------------------------------------- */

export type OmDirection = 'in' | 'out'
export type OmCategory =
  | 'revolut'
  | 'nakazilo'
  | 'stranka'
  | 'ostalo_in'
  | 'placilo'
  | 'dobavitelj'
  | 'ostalo_out'

export type OmTransaction = {
  id: string
  date: string
  direction: OmDirection
  category: OmCategory
  amount: number
  description: string
  createdAt: string | null
}

export type OmAccount = {
  currency: 'EUR' | 'Ar'
  openingBalance: number
  openingDate: string
}

const ACCOUNT_ID = 'orange'

export async function getOmAccount(): Promise<OmAccount> {
  const rows = await db.execute(sql`SELECT * FROM orange_money_account WHERE id = ${ACCOUNT_ID} LIMIT 1`)
  const r = (rows.rows as Record<string, unknown>[])[0]
  if (!r) return { currency: 'Ar', openingBalance: 0, openingDate: '2026-01-01' }
  return {
    currency: (r.currency as string) === 'EUR' ? 'EUR' : 'Ar',
    openingBalance: Number(r.openingBalance ?? 0),
    openingDate: (r.openingDate as string) ?? '2026-01-01',
  }
}

export async function saveOmAccount(params: { currency: 'EUR' | 'Ar'; openingBalance: number; openingDate: string }) {
  await db.execute(
    sql`INSERT INTO orange_money_account (id, currency, "openingBalance", "openingDate", "updatedAt")
        VALUES (${ACCOUNT_ID}, ${params.currency}, ${params.openingBalance || 0}, ${params.openingDate || '2026-01-01'}, now())
        ON CONFLICT (id) DO UPDATE SET
          currency = EXCLUDED.currency,
          "openingBalance" = EXCLUDED."openingBalance",
          "openingDate" = EXCLUDED."openingDate",
          "updatedAt" = now()`
  )
  revalidatePath('/statistika')
}

export async function getOmTransactions(year?: number): Promise<OmTransaction[]> {
  const rows = year
    ? await db.execute(
        sql`SELECT * FROM orange_money_transactions WHERE date >= ${`${year}-01-01`} AND date <= ${`${year}-12-31`} ORDER BY date DESC, "createdAt" DESC`
      )
    : await db.execute(sql`SELECT * FROM orange_money_transactions ORDER BY date DESC, "createdAt" DESC`)
  return (rows.rows as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    date: r.date as string,
    direction: (r.direction as string) === 'out' ? 'out' : 'in',
    category: (r.category as OmCategory) ?? 'ostalo_in',
    amount: Number(r.amount ?? 0),
    description: (r.description as string) ?? '',
    createdAt: r.createdAt ? String(r.createdAt) : null,
  }))
}

// Neto prenos (carry-in) vsega prometa PRED izbranim letom (prilivi − odlivi).
// Tako se saldo prenaša iz leta v leto (npr. promet iz dec 2025 → 2026).
export async function getOmCarryIn(year: number): Promise<number> {
  const rows = await db.execute(
    sql`SELECT
          COALESCE(SUM(CASE WHEN direction = 'in' THEN amount ELSE 0 END), 0) AS ins,
          COALESCE(SUM(CASE WHEN direction = 'out' THEN amount ELSE 0 END), 0) AS outs
        FROM orange_money_transactions
        WHERE date < ${`${year}-01-01`}`
  )
  const r = (rows.rows as Record<string, unknown>[])[0]
  return Number(r?.ins ?? 0) - Number(r?.outs ?? 0)
}

export async function addOmTransaction(params: {
  date: string
  direction: OmDirection
  category: OmCategory
  amount: number
  description: string
}) {
  const id = `om-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  await db.execute(
    sql`INSERT INTO orange_money_transactions (id, date, direction, category, amount, description)
        VALUES (${id}, ${params.date}, ${params.direction}, ${params.category}, ${params.amount || 0}, ${params.description ?? ''})`
  )
  revalidatePath('/statistika')
  return { id }
}

export async function updateOmTransaction(
  id: string,
  params: { date: string; direction: OmDirection; category: OmCategory; amount: number; description: string }
) {
  await db.execute(
    sql`UPDATE orange_money_transactions
        SET date = ${params.date}, direction = ${params.direction}, category = ${params.category},
            amount = ${params.amount || 0}, description = ${params.description ?? ''}
        WHERE id = ${id}`
  )
  revalidatePath('/statistika')
}

export async function deleteOmTransaction(id: string) {
  await db.execute(sql`DELETE FROM orange_money_transactions WHERE id = ${id}`)
  revalidatePath('/statistika')
}
