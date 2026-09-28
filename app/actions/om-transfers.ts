'use server'

import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { parseOmTransfers, type ParsedTransfer } from '@/lib/om-parse'
import { getPhoneContacts } from '@/app/actions/phone-contacts'
import { addCashIncome, deleteCashIncome } from '@/app/actions/banka'
import { getExchangeRate } from '@/app/actions/komba'

/* ── Seznam nakazil iz Orange Money ──────────────────────────────────────
 * Urška prilepi surova SMS obvestila Orange Money; razčlenimo IZHODNA
 * nakazila ("Votre transfert de X Ar vers le NUMBER") in prejemnika
 * razrešimo iz Borutovega telefonskega imenika. Ločeno od denarnice
 * (orange_money_transactions) — to je referenčni seznam, ne vpliva na saldo.
 * Parser (sinhron) je v lib/om-parse.ts, ker 'use server' dovoli le async izvoze.
 * ---------------------------------------------------------------------- */

export type OmTransfer = {
  id: string
  transferDate: string | null
  amount: number
  fees: number | null
  recipientNumber: string | null
  recipientName: string | null
  transId: string | null
  rawText: string | null
  createdAt: string | null
  blagajnaCashId: string | null
  feeExpenseId: string | null
}

export async function getOmTransfers(): Promise<OmTransfer[]> {
  const rows = await db.execute(
    sql`SELECT * FROM om_transfers ORDER BY COALESCE("transferDate", '') DESC, "createdAt" DESC`
  )
  return (rows.rows as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    transferDate: (r.transferDate as string) ?? null,
    amount: Number(r.amount ?? 0),
    fees: r.fees != null ? Number(r.fees) : null,
    recipientNumber: (r.recipientNumber as string) ?? null,
    recipientName: (r.recipientName as string) ?? null,
    transId: (r.transId as string) ?? null,
    rawText: (r.rawText as string) ?? null,
    createdAt: r.createdAt ? String(r.createdAt) : null,
    blagajnaCashId: (r.blagajnaCashId as string) ?? null,
    feeExpenseId: (r.feeExpenseId as string) ?? null,
  }))
}

export async function parseAndSaveOmTransfers(
  rawText: string
): Promise<{ saved: number; skipped: number; parsed: ParsedTransfer[] }> {
  const contacts = await getPhoneContacts()
  const parsed = parseOmTransfers(rawText, contacts)
  let saved = 0
  for (const p of parsed) {
    const res = await db.execute(
      sql`INSERT INTO om_transfers (id, "transferDate", amount, fees, "recipientNumber", "recipientName", "transId", "rawText", "createdAt")
          VALUES (${p.id}, ${p.transferDate}, ${p.amount}, ${p.fees}, ${p.recipientNumber}, ${p.recipientName}, ${p.transId}, ${p.rawText}, now())
          ON CONFLICT (id) DO NOTHING
          RETURNING id`
    )
    if ((res.rows as unknown[]).length > 0) saved++
  }
  revalidatePath('/statistika')
  return { saved, skipped: parsed.length - saved, parsed }
}

export async function deleteOmTransfer(id: string): Promise<void> {
  await db.execute(sql`DELETE FROM om_transfers WHERE id = ${id}`)
  revalidatePath('/statistika')
}

/* ── Prenos nakazila na blagajno (Indijec → gotovina) ─────────────────────
 * Borut nakaže znesek Indijcu, ta zamenja v gotovino in jo da v blagajno.
 *  - (znesek − provizija) v Ar → priliv v blagajno Tourism (bank_cash_income)
 *  - provizija (Ar → EUR po tečaju) → strošek meseca v kategoriji 'provizija'
 * Idempotentno: če je nakazilo že preneseno (blagajnaCashId), ne naredi nič. */

export async function transferOmToBlagajna(id: string): Promise<{ ok: boolean; already?: boolean }> {
  const res = await db.execute(sql`SELECT * FROM om_transfers WHERE id = ${id} LIMIT 1`)
  const r = (res.rows as Record<string, unknown>[])[0]
  if (!r) return { ok: false }
  if (r.blagajnaCashId) return { ok: true, already: true }

  const amount = Number(r.amount ?? 0)
  const fees = r.fees != null ? Number(r.fees) : 0
  const date = (r.transferDate as string) || new Date().toISOString().slice(0, 10)
  const who = (r.recipientName as string) || (r.recipientNumber as string) || 'Orange Money'
  const transId = (r.transId as string) || ''
  const cashAmount = Math.max(0, amount - fees)

  // 1) Gotovina v blagajno Tourism (v Ar)
  const cash = await addCashIncome({
    company: 'tourism',
    date,
    source: `Orange Money → gotovina (Indijec) · ${who}${transId ? ` · ${transId}` : ''}`,
    amount: cashAmount,
  })

  // 2) Provizija kot strošek meseca (kategorija 'provizija'), pretvorjena Ar → EUR
  let feeExpenseId: string | null = null
  if (fees > 0) {
    const rate = await getExchangeRate()
    const feeEur = rate > 0 ? Math.round((fees / rate) * 100) / 100 : 0
    const d = new Date(date)
    const year = d.getFullYear()
    const month = d.getMonth() + 1
    feeExpenseId = `mkt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    await db.execute(
      sql`INSERT INTO marketing_expenses (id, category, year, month, date, description, amount, "paymentMethod")
          VALUES (${feeExpenseId}, 'provizija', ${year}, ${month}, ${date},
                  ${`Provizija OM · ${who}${transId ? ` · ${transId}` : ''}`}, ${String(feeEur)}, 'orange_money')`
    )
  }

  await db.execute(
    sql`UPDATE om_transfers SET "blagajnaCashId" = ${cash.id}, "feeExpenseId" = ${feeExpenseId} WHERE id = ${id}`
  )
  revalidatePath('/statistika')
  return { ok: true }
}

export async function undoTransferOmToBlagajna(id: string): Promise<void> {
  const res = await db.execute(sql`SELECT "blagajnaCashId", "feeExpenseId" FROM om_transfers WHERE id = ${id} LIMIT 1`)
  const r = (res.rows as Record<string, unknown>[])[0]
  if (!r) return
  if (r.blagajnaCashId) await deleteCashIncome(r.blagajnaCashId as string)
  if (r.feeExpenseId) await db.execute(sql`DELETE FROM marketing_expenses WHERE id = ${r.feeExpenseId as string}`)
  await db.execute(sql`UPDATE om_transfers SET "blagajnaCashId" = NULL, "feeExpenseId" = NULL WHERE id = ${id}`)
  revalidatePath('/statistika')
}
