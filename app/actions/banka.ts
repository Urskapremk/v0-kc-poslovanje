'use server'

import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

export type BankCompany = 'tourism' | 'sarl'
export type TxDirection = 'in' | 'out'
// Prilivi: stranka (nakazilo stranke), ostalo_in.
// Odlivi: dvig (dvig gotovine), dobavitelj (dobavitelji/nakup), davki, vracilo (vračila strankam),
//         placilo (ostala nakazila), banka (bančni stroški), ostalo_out
export type TxCategory =
  | 'stranka' | 'ostalo_in'
  | 'dvig' | 'dobavitelj' | 'davki' | 'vracilo' | 'placilo' | 'banka' | 'ostalo_out'

export type BankAccount = {
  company: BankCompany
  currency: string
  openingBalance: number
  openingDate: string
}

export type BankTransaction = {
  id: string
  company: BankCompany
  date: string
  direction: TxDirection
  category: TxCategory
  amount: number
  description: string
  createdAt: string | null
}

function normCompany(c: string): BankCompany {
  return c === 'sarl' ? 'sarl' : 'tourism'
}

// Vrne bančni račun podjetja (če ne obstaja, vrne privzetega z 0 stanjem)
export async function getBankAccount(company: string): Promise<BankAccount> {
  const comp = normCompany(company)
  const res = await db.execute(
    sql`SELECT company, currency, "openingBalance", "openingDate" FROM bank_accounts WHERE company = ${comp} LIMIT 1`
  )
  const r = (res.rows as Record<string, unknown>[])[0]
  if (!r) {
    return { company: comp, currency: 'EUR', openingBalance: 0, openingDate: '2026-01-01' }
  }
  return {
    company: comp,
    currency: (r.currency as string) || 'EUR',
    openingBalance: Number(r.openingBalance ?? 0),
    openingDate: (r.openingDate as string) || '2026-01-01',
  }
}

// Nastavi/posodobi začetno stanje in valuto računa
export async function saveBankAccount(params: {
  company: string
  currency: string
  openingBalance: number
  openingDate: string
}) {
  const comp = normCompany(params.company)
  const currency = params.currency === 'Ar' ? 'Ar' : 'EUR'
  const bal = params.openingBalance || 0
  const date = params.openingDate || '2026-01-01'
  const id = `bank-${comp}`
  await db.execute(
    sql`INSERT INTO bank_accounts (id, company, currency, "openingBalance", "openingDate", "updatedAt")
        VALUES (${id}, ${comp}, ${currency}, ${bal}, ${date}, now())
        ON CONFLICT (company) DO UPDATE
        SET currency = ${currency}, "openingBalance" = ${bal}, "openingDate" = ${date}, "updatedAt" = now()`
  )
  revalidatePath('/statistika')
  return { ok: true }
}

// Vse transakcije podjetja (opcijsko filtrirano po letu), najnovejše najprej
export async function getBankTransactions(company: string, year?: number): Promise<BankTransaction[]> {
  const comp = normCompany(company)
  const rows = year
    ? await db.execute(
        sql`SELECT * FROM bank_transactions WHERE company = ${comp} AND date >= ${`${year}-01-01`} AND date <= ${`${year}-12-31`} ORDER BY date DESC, "createdAt" DESC`
      )
    : await db.execute(
        sql`SELECT * FROM bank_transactions WHERE company = ${comp} ORDER BY date DESC, "createdAt" DESC`
      )
  return (rows.rows as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    company: normCompany(r.company as string),
    date: r.date as string,
    direction: (r.direction as TxDirection) === 'out' ? 'out' : 'in',
    category: (r.category as TxCategory) || 'ostalo_in',
    amount: Number(r.amount ?? 0),
    description: (r.description as string) ?? '',
    createdAt: r.createdAt ? String(r.createdAt) : null,
  }))
}

export async function addBankTransaction(params: {
  company: string
  date: string
  direction: TxDirection
  category: TxCategory
  amount: number
  description?: string
}) {
  const comp = normCompany(params.company)
  const dir: TxDirection = params.direction === 'out' ? 'out' : 'in'
  const id = `tx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  await db.execute(
    sql`INSERT INTO bank_transactions (id, company, date, direction, category, amount, description)
        VALUES (${id}, ${comp}, ${params.date}, ${dir}, ${params.category}, ${params.amount || 0}, ${params.description ?? ''})`
  )
  revalidatePath('/statistika')
  return { id }
}

// Uvozi transakcije iz slike izpiska; PRESKOČI podvojene (isti datum + znesek + smer).
// Odlivi (AUTORISATION TPE = plačila s kartico) → kategorija 'dobavitelj'; prilivi → 'ostalo_in'.
export async function importBankStatementTransactions(params: {
  company: string
  transactions: { date: string; direction: TxDirection; amount: number; description?: string }[]
}): Promise<{ added: number; skipped: number }> {
  const comp = normCompany(params.company)
  const existing = await db.execute(
  sql`SELECT date, direction, amount FROM bank_transactions WHERE company = ${comp}`
  )
  const dayMs = 86400000
  // Že vnesene: znesek + smer, datum pa v oknu ±14 dni (banka isto transakcijo pogosto zapiše z
  // dnem operacije ali dnem valute, zato točen datum ni zanesljiv za primerjavo).
  // POMEMBNO: ujemanje je ENA-NA-ENA — vsaka obstoječa vrstica lahko "pokrije" največ eno uvoženo
  // vrstico. Tako se trije enaki odlivi (npr. 3× 800.000 isti dan) ne zložijo v enega: če je v bazi
  // le en tak znesek, se preskoči le eden, ostala dva se dodata.
  const existingRows = (existing.rows as Record<string, unknown>[]).map((r) => ({
  dir: String(r.direction) as TxDirection,
  amount: Math.round(Number(r.amount ?? 0)),
  time: Date.parse(`${String(r.date).slice(0, 10)}T00:00:00Z`),
  consumed: false,
  }))
  const consumeMatch = (dir: TxDirection, amt: number, time: number) => {
  const hit = existingRows.find(
  (e) =>
  !e.consumed &&
  e.dir === dir &&
  e.amount === amt &&
  (isNaN(time) || isNaN(e.time) || Math.abs(e.time - time) <= 14 * dayMs)
  )
  if (hit) {
  hit.consumed = true
  return true
  }
  return false
  }
  let added = 0
  let skipped = 0
  for (const t of params.transactions) {
  const dir: TxDirection = t.direction === 'out' ? 'out' : 'in'
  const amt = Math.abs(Number(t.amount) || 0)
  const date = (t.date || '').slice(0, 10)
  if (!date || amt <= 0) {
  skipped++
  continue
  }
  const time = Date.parse(`${date}T00:00:00Z`)
  if (consumeMatch(dir, Math.round(amt), time)) {
  skipped++
  continue
  }
    const cat: TxCategory = dir === 'out' ? 'dobavitelj' : 'ostalo_in'
    const id = `tx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    await db.execute(
      sql`INSERT INTO bank_transactions (id, company, date, direction, category, amount, description)
      VALUES (${id}, ${comp}, ${date}, ${dir}, ${cat}, ${amt}, ${t.description ?? ''})`
    )
    added++
  }
  revalidatePath('/statistika')
  return { added, skipped }
}

export async function updateBankTransaction(
  id: string,
  params: { date: string; direction: TxDirection; category: TxCategory; amount: number; description?: string }
) {
  const dir: TxDirection = params.direction === 'out' ? 'out' : 'in'
  await db.execute(
    sql`UPDATE bank_transactions
        SET date = ${params.date}, direction = ${dir}, category = ${params.category}, amount = ${params.amount || 0}, description = ${params.description ?? ''}
        WHERE id = ${id}`
  )
  revalidatePath('/statistika')
}

export async function deleteBankTransaction(id: string) {
  await db.execute(sql`DELETE FROM bank_transactions WHERE id = ${id}`)
  revalidatePath('/statistika')
}

/* ── Poraba dvignjene gotovine (gotovinski stroški) ────────────────────── */

export type CashExpense = {
  id: string
  company: BankCompany
  date: string
  purpose: string
  amount: number
  createdAt: string | null
}

// Vsi gotovinski stroški podjetja (opcijsko po letu), najstarejši najprej znotraj dneva
export async function getCashExpenses(company: string, year?: number): Promise<CashExpense[]> {
  const comp = normCompany(company)
  const rows = year
    ? await db.execute(
        sql`SELECT * FROM bank_cash_expenses WHERE company = ${comp} AND date >= ${`${year}-01-01`} AND date <= ${`${year}-12-31`} ORDER BY date ASC, "createdAt" ASC`
      )
    : await db.execute(
        sql`SELECT * FROM bank_cash_expenses WHERE company = ${comp} ORDER BY date ASC, "createdAt" ASC`
      )
  return (rows.rows as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    company: normCompany(r.company as string),
    date: r.date as string,
    purpose: (r.purpose as string) ?? '',
    amount: Number(r.amount ?? 0),
    createdAt: r.createdAt ? String(r.createdAt) : null,
  }))
}

export async function addCashExpense(params: {
  company: string
  date: string
  purpose: string
  amount: number
}) {
  const comp = normCompany(params.company)
  const id = `ce-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  await db.execute(
    sql`INSERT INTO bank_cash_expenses (id, company, date, purpose, amount)
        VALUES (${id}, ${comp}, ${params.date}, ${params.purpose ?? ''}, ${params.amount || 0})`
  )
  revalidatePath('/statistika')
  return { id }
}

export async function updateCashExpense(
  id: string,
  params: { date: string; purpose: string; amount: number }
) {
  await db.execute(
    sql`UPDATE bank_cash_expenses
        SET date = ${params.date}, purpose = ${params.purpose ?? ''}, amount = ${params.amount || 0}
        WHERE id = ${id}`
  )
  revalidatePath('/statistika')
}

export async function deleteCashExpense(id: string) {
  await db.execute(sql`DELETE FROM bank_cash_expenses WHERE id = ${id}`)
  revalidatePath('/statistika')
}

/* ── Prilivi gotovine v blagajno (npr. gotovina strank) ────────────────── */
// To je gotovina, ki fizično pride v blagajno (npr. gost plača v gotovini) in
// NI bančni dvig. Šteje kot priliv v blagajniškem dnevniku, a NE vpliva na
// stanje bančnega računa (bank_transactions). Shranjeno v valuti blagajne (Ar).

export type CashIncome = {
  id: string
  company: BankCompany
  date: string
  source: string
  amount: number
  createdAt: string | null
}

export async function getCashIncome(company: string, year?: number): Promise<CashIncome[]> {
  const comp = normCompany(company)
  const rows = year
    ? await db.execute(
        sql`SELECT * FROM bank_cash_income WHERE company = ${comp} AND date >= ${`${year}-01-01`} AND date <= ${`${year}-12-31`} ORDER BY date ASC, "createdAt" ASC`
      )
    : await db.execute(
        sql`SELECT * FROM bank_cash_income WHERE company = ${comp} ORDER BY date ASC, "createdAt" ASC`
      )
  return (rows.rows as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    company: normCompany(r.company as string),
    date: r.date as string,
    source: (r.source as string) ?? '',
    amount: Number(r.amount ?? 0),
    createdAt: r.createdAt ? String(r.createdAt) : null,
  }))
}

export async function addCashIncome(params: {
  company: string
  date: string
  source: string
  amount: number
}) {
  const comp = normCompany(params.company)
  const id = `ci-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  await db.execute(
    sql`INSERT INTO bank_cash_income (id, company, date, source, amount)
        VALUES (${id}, ${comp}, ${params.date}, ${params.source ?? ''}, ${params.amount || 0})`
  )
  revalidatePath('/statistika')
  return { id }
}

export async function updateCashIncome(
  id: string,
  params: { date: string; source: string; amount: number }
) {
  await db.execute(
    sql`UPDATE bank_cash_income
        SET date = ${params.date}, source = ${params.source ?? ''}, amount = ${params.amount || 0}
        WHERE id = ${id}`
  )
  revalidatePath('/statistika')
}

export async function deleteCashIncome(id: string) {
  await db.execute(sql`DELETE FROM bank_cash_income WHERE id = ${id}`)
  revalidatePath('/statistika')
}
