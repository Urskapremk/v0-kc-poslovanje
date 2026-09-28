"use server"

import { db } from "@/lib/db"
import { sql } from "drizzle-orm"
import { addCashExpense, deleteCashExpense } from "./banka"
import { addOmTransaction, deleteOmTransaction } from "./orange-money"

export type SupplierPayMethod = "cash" | "orange"
export type SupplierPayCompany = "tourism" | "sarl"

// Plačilo dobavitelju prevoza (Dilip čoln / Herman avto) iz pending transferja.
// ODLIV (mi plačamo prevozniku): OM direction 'out', kategorija 'dobavitelj';
// gotovina → strošek blagajne izbranega podjetja. Idempotentno: ob ponovnem klicu
// (urejanje) staro vknjižbo najprej izbriše, zato ne nastane dvojnik.
export async function paySupplier(params: {
  refKey: string
  // 'dilip' | 'herman' za transferje; za izlete tudi 'lunch' | 'entrance' (prejemnik je le opisni stolpec)
  supplier: string
  method: SupplierPayMethod
  company?: SupplierPayCompany
  date: string
  amountAr: number
  label: string
}) {
  const refKey = params.refKey
  const supplier = params.supplier || "dilip"
  const method: SupplierPayMethod = params.method === "orange" ? "orange" : "cash"
  const company: SupplierPayCompany = params.company === "sarl" ? "sarl" : "tourism"
  const date = params.date || new Date().toISOString().slice(0, 10)
  const amount = Math.round(params.amountAr)

  // 0) POPRAVEK: če že obstaja vknjižba za ta refKey, jo izbrišemo (idempotentnost).
  const existing = await db.execute(
    sql`SELECT "ledgerId", method FROM supplier_payments WHERE "refKey" = ${refKey} LIMIT 1`
  )
  const prev = (existing.rows as Record<string, unknown>[])[0]
  const prevLedgerId = prev?.ledgerId as string | undefined
  const prevMethod = prev?.method as string | undefined
  if (prevLedgerId) {
    if (prevMethod === "orange") await deleteOmTransaction(prevLedgerId)
    else await deleteCashExpense(prevLedgerId)
  }

  // 1) ena vknjižba za znesek dobavitelja
  let ledgerId: string
  if (method === "orange") {
    const res = await addOmTransaction({
      date,
      direction: "out",
      category: "dobavitelj",
      amount,
      description: params.label,
    })
    ledgerId = res.id
  } else {
    const res = await addCashExpense({
      company,
      date,
      purpose: params.label,
      amount,
    })
    ledgerId = res.id
  }

  // 2) shranimo stanje plačila (upsert po refKey)
  const id = `sp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  await db.execute(sql`
    INSERT INTO supplier_payments (id, "refKey", supplier, "paidAt", method, company, "ledgerId", "amountAr")
    VALUES (${id}, ${refKey}, ${supplier}, ${date}, ${method}, ${method === "cash" ? company : null}, ${ledgerId}, ${amount})
    ON CONFLICT ("refKey") DO UPDATE SET
      supplier = EXCLUDED.supplier,
      "paidAt" = EXCLUDED."paidAt",
      method = EXCLUDED.method,
      company = EXCLUDED.company,
      "ledgerId" = EXCLUDED."ledgerId",
      "amountAr" = EXCLUDED."amountAr"
  `)

  return { ok: true, ledgerId }
}

export async function unpaySupplier(params: { refKey: string }) {
  const refKey = params.refKey
  const existing = await db.execute(
    sql`SELECT "ledgerId", method FROM supplier_payments WHERE "refKey" = ${refKey} LIMIT 1`
  )
  const prev = (existing.rows as Record<string, unknown>[])[0]
  if (!prev) return { ok: true }
  const ledgerId = prev.ledgerId as string | undefined
  const method = prev.method as string | undefined
  if (ledgerId) {
    if (method === "orange") await deleteOmTransaction(ledgerId)
    else await deleteCashExpense(ledgerId)
  }
  await db.execute(sql`DELETE FROM supplier_payments WHERE "refKey" = ${refKey}`)
  return { ok: true }
}
