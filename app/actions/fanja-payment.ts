'use server'

import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { addCashExpense, deleteCashExpense } from './banka'
import { addOmTransaction, deleteOmTransaction } from './orange-money'

/* ── Plačilo Fanji (ponudniku izleta) ───────────────────────────────────
 * Ko plačamo Fanji za organiziran izlet, izberemo NAČIN in DATUM plačila.
 * - Gotovina  → odliv iz gotovinske blagajne izbranega podjetja (bank_cash_expenses)
 * - Orange Money → odliv iz OM denarnice (orange_money_transactions, direction 'out')
 * Vknjižba je ENA za celotno (skupinsko) naročilo; njen id shranimo na vse
 * pripadajoče izlete (fanjaLedgerId), da jo ob preklicu izbrišemo.
 * ---------------------------------------------------------------------- */

export type FanjaPayMethod = 'cash' | 'orange'
export type FanjaPayCompany = 'tourism' | 'sarl'

export async function payFanja(params: {
  bookingIds: string[]
  method: FanjaPayMethod
  company?: FanjaPayCompany // obvezno samo pri gotovini
  date: string // YYYY-MM-DD
  amountAr: number
  label: string // opis vknjižbe, npr. "Izlet Fanja Nosy Iranja — Ocean Bungalow II"
}) {
  const ids = (params.bookingIds || []).filter(Boolean)
  const amount = Math.round(params.amountAr || 0)
  if (ids.length === 0 || amount <= 0) return { ok: false as const, error: 'Ni postavk ali znesek je 0.' }

  const method: FanjaPayMethod = params.method === 'orange' ? 'orange' : 'cash'
  const company: FanjaPayCompany = params.company === 'sarl' ? 'sarl' : 'tourism'
  const date = params.date || new Date().toISOString().slice(0, 10)

  // 0) POPRAVEK: če je za te izlete že vknjižba (uporabnica ureja plačilo),
  //    jo najprej izbrišemo, da ne nastane dvojnik. Tako je payFanja idempotenten.
  const existing = await db.execute(
    sql`SELECT "fanjaLedgerId", "fanjaPaidMethod" FROM excursion_bookings
        WHERE id = ANY(${sql.raw(`ARRAY[${ids.map((i) => `'${i.replace(/'/g, "''")}'`).join(',')}]::text[]`)})
          AND "fanjaLedgerId" IS NOT NULL
        LIMIT 1`
  )
  const prev = (existing.rows as Record<string, unknown>[])[0]
  const prevLedgerId = prev?.fanjaLedgerId as string | undefined
  const prevMethod = prev?.fanjaPaidMethod as string | undefined
  if (prevLedgerId) {
    if (prevMethod === 'orange') await deleteOmTransaction(prevLedgerId)
    else await deleteCashExpense(prevLedgerId)
  }

  // 1) ena vknjižba za celoten znesek
  let ledgerId: string
  if (method === 'orange') {
    const res = await addOmTransaction({
      date,
      direction: 'out',
      category: 'dobavitelj',
      amount,
      description: params.label,
    })
    ledgerId = res.id
  } else {
    const res = await addCashExpense({ company, date, purpose: params.label, amount })
    ledgerId = res.id
  }

  // 2) označi vse pripadajoče izlete kot plačane Fanji
  await db.execute(
    sql`UPDATE excursion_bookings
        SET "fanjaPaidAt" = ${date},
            "fanjaPaidMethod" = ${method},
            "fanjaPaidCompany" = ${method === 'cash' ? company : null},
            "fanjaLedgerId" = ${ledgerId},
            "fanjaPaidAmountAr" = ${amount}
        WHERE id = ANY(${sql.raw(`ARRAY[${ids.map((i) => `'${i.replace(/'/g, "''")}'`).join(',')}]::text[]`)})`
  )

  revalidatePath('/')
  revalidatePath('/statistika')
  return { ok: true as const, ledgerId }
}

export async function unpayFanja(params: { bookingIds: string[] }) {
  const ids = (params.bookingIds || []).filter(Boolean)
  if (ids.length === 0) return { ok: false as const }

  // preberi vknjižbo iz prvega izleta (za vse je ista)
  const rows = await db.execute(
    sql`SELECT "fanjaLedgerId", "fanjaPaidMethod" FROM excursion_bookings
        WHERE id = ANY(${sql.raw(`ARRAY[${ids.map((i) => `'${i.replace(/'/g, "''")}'`).join(',')}]::text[]`)})
          AND "fanjaLedgerId" IS NOT NULL
        LIMIT 1`
  )
  const r = (rows.rows as Record<string, unknown>[])[0]
  const ledgerId = r?.fanjaLedgerId as string | undefined
  const method = r?.fanjaPaidMethod as string | undefined

  // izbriši vknjižbo
  if (ledgerId) {
    if (method === 'orange') await deleteOmTransaction(ledgerId)
    else await deleteCashExpense(ledgerId)
  }

  // počisti oznake plačila na vseh izletih
  await db.execute(
    sql`UPDATE excursion_bookings
        SET "fanjaPaidAt" = NULL, "fanjaPaidMethod" = NULL, "fanjaPaidCompany" = NULL,
            "fanjaLedgerId" = NULL, "fanjaPaidAmountAr" = NULL
        WHERE id = ANY(${sql.raw(`ARRAY[${ids.map((i) => `'${i.replace(/'/g, "''")}'`).join(',')}]::text[]`)})`
  )

  revalidatePath('/')
  revalidatePath('/statistika')
  return { ok: true as const }
}
