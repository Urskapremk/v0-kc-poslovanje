"use server"

import { db } from "@/lib/db"
import { sql } from "drizzle-orm"
import { addCashExpense, deleteCashExpense, updateCashExpense } from "./banka"
import { addOmTransaction, deleteOmTransaction, updateOmTransaction } from "./orange-money"
import {
  isTransportCostPayRef,
  planBoatCostLink,
  transportCostDescription,
  resolveBoatCostMark,
  type BoatCostFields,
  type ResolvedBoatCost,
  type StoredBoatCost,
} from "@/lib/dilip-boat-cost"

export type SupplierPayMethod = "cash" | "orange"
export type SupplierPayCompany = "tourism" | "sarl"

// Oznaka stroška (ista kot pri nakupih) živi na plačilu Dilipu, vozniku čolna in nosačem.
// Stolpci so opcijski, da stara plačila ostanejo brez oznake.
let costColsReady: Promise<void> | null = null
export async function ensureSupplierPaymentCostColumns() {
  if (!costColsReady) {
    costColsReady = (async () => {
      await db.execute(sql`ALTER TABLE supplier_payments ADD COLUMN IF NOT EXISTS "costCategory" text`)
      await db.execute(sql`ALTER TABLE supplier_payments ADD COLUMN IF NOT EXISTS "assetId" text`)
      await db.execute(sql`ALTER TABLE supplier_payments ADD COLUMN IF NOT EXISTS "annualRatePct" numeric`)
      await db.execute(sql`ALTER TABLE supplier_payments ADD COLUMN IF NOT EXISTS "fixedAssetId" text`)
      await db.execute(sql`ALTER TABLE supplier_payments ADD COLUMN IF NOT EXISTS "reservationId" text`)
      await db.execute(sql`ALTER TABLE supplier_payments ADD COLUMN IF NOT EXISTS "orderItemId" text`)
      await db.execute(sql`ALTER TABLE supplier_payments ADD COLUMN IF NOT EXISTS "loanRate" numeric`)
    })().catch((e) => {
      costColsReady = null
      throw e
    })
  }
  return costColsReady
}

type PaymentCostRow = {
  id: string
  ledgerId: string
  method: string
  costCategory: string
  assetId: string
  annualRatePct: number
  fixedAssetId: string
  reservationId: string
  orderItemId: string
  loanRate: number
}

function readCostRow(row: Record<string, unknown> | undefined): PaymentCostRow | null {
  if (!row) return null
  return {
    id: String(row.id || ""),
    ledgerId: row.ledgerId ? String(row.ledgerId) : "",
    method: row.method ? String(row.method) : "",
    costCategory: row.costCategory ? String(row.costCategory) : "",
    assetId: row.assetId ? String(row.assetId) : "",
    annualRatePct: Number(row.annualRatePct) || 0,
    fixedAssetId: row.fixedAssetId ? String(row.fixedAssetId) : "",
    reservationId: row.reservationId ? String(row.reservationId) : "",
    orderItemId: row.orderItemId ? String(row.orderItemId) : "",
    loanRate: Number(row.loanRate) || 0,
  }
}

async function loadPayment(refKey: string): Promise<PaymentCostRow | null> {
  const existing = await db.execute(sql`
    SELECT id, "ledgerId", method, "costCategory", "assetId", "annualRatePct", "fixedAssetId",
           "reservationId", "orderItemId", "loanRate"
    FROM supplier_payments WHERE "refKey" = ${refKey} LIMIT 1
  `)
  return readCostRow((existing.rows as Record<string, unknown>[])[0])
}

function storedFrom(row: PaymentCostRow | null): StoredBoatCost {
  return {
    category: row?.costCategory || "",
    assetId: row?.assetId || "",
    fixedAssetId: row?.fixedAssetId || "",
    orderItemId: row?.orderItemId || "",
  }
}

function fieldsFromRow(row: PaymentCostRow | null): BoatCostFields {
  return {
    category: row?.costCategory || "",
    assetId: row?.assetId || "",
    annualRatePct: row?.annualRatePct || 0,
    reservationId: row?.reservationId || "",
    loanRate: row?.loanRate || 0,
  }
}

// Plačilo dobavitelju prevoza (Dilip čoln / Herman avto) iz pending transferja.
// ODLIV (mi plačamo prevozniku): OM direction 'out', kategorija 'dobavitelj';
// gotovina → strošek blagajne izbranega podjetja. Idempotentno: ob ponovnem klicu
// (urejanje) staro vknjižbo najprej izbriše, zato ne nastane dvojnik.
// Pri čolnu Dilip (nabava) lahko zraven pride oznaka vrste stroška. Denar ostane
// ta ena vknjižba; pogodba dobi eno vrstico stroška, ne drugega odliva.
export async function paySupplier(params: {
  refKey: string
  // 'dilip' | 'herman' za transferje; za izlete tudi 'lunch' | 'entrance' (prejemnik je le opisni stolpec)
  supplier: string
  method: SupplierPayMethod
  company?: SupplierPayCompany
  date: string
  amountAr: number
  label: string
  // undefined = obdrži obstoječo oznako (in uskladi znesek/datum). Objekt = nastavi ali počisti.
  cost?: BoatCostFields | null
}) {
  await ensureSupplierPaymentCostColumns()
  const refKey = params.refKey
  const supplier = params.supplier || "dilip"
  const method: SupplierPayMethod = params.method === "orange" ? "orange" : "cash"
  const company: SupplierPayCompany = params.company === "sarl" ? "sarl" : "tourism"
  const date = params.date || new Date().toISOString().slice(0, 10)
  const amount = Math.round(params.amountAr)
  const boat = isTransportCostPayRef(refKey)

  const prev = await loadPayment(refKey)
  const markInput: BoatCostFields | null = !boat
    ? null
    : params.cost === undefined
      ? fieldsFromRow(prev)
      : params.cost
  const resolved = boat ? resolveBoatCostMark(markInput) : { ok: true as const, mark: { kind: "none" as const } }
  if (!resolved.ok) throw new Error(resolved.error)

  // 0) POPRAVEK: če že obstaja vknjižba za ta refKey, jo izbrišemo (idempotentnost).
  if (prev?.ledgerId) {
    if (prev.method === "orange") await deleteOmTransaction(prev.ledgerId)
    else await deleteCashExpense(prev.ledgerId)
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
  const id = prev?.id || `sp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
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
  const saved = await loadPayment(refKey)
  const paymentId = saved?.id || id

  if (boat) {
    await applyBoatCostMark({
      paymentId,
      prev: storedFrom(prev),
      next: resolved.mark,
      date,
      amountAr: amount,
      description: transportCostDescription(refKey, params.label),
    })
  }

  return { ok: true, ledgerId }
}

async function applyBoatCostMark(args: {
  paymentId: string
  prev: StoredBoatCost
  next: ResolvedBoatCost
  date: string
  amountAr: number
  description: string
}) {
  const plan = planBoatCostLink(args.prev, args.next)
  const { upsertSupplierAssetCost, removeSupplierAssetCost, addFixedAsset, updateFixedAsset, deleteFixedAsset } =
    await import("./statistics")
  const { createLoanOrderItem, deleteLoanOrderItem } = await import("./nabava")

  if (plan.wip === "remove") await removeSupplierAssetCost(args.paymentId)
  if (plan.fixedAsset === "delete" && args.prev.fixedAssetId) await deleteFixedAsset(args.prev.fixedAssetId)
  if (plan.loan === "delete" && args.prev.orderItemId) await deleteLoanOrderItem(args.prev.orderItemId)

  let fixedAssetId = plan.fixedAsset === "update" ? args.prev.fixedAssetId : ""
  let orderItemId = ""
  let assetId = ""
  let annualRatePct: number | null = null
  let reservationId = ""
  let loanRate: number | null = null
  let category = ""

  if (args.next.kind === "wip") {
    category = args.next.category
    assetId = args.next.assetId
    if (plan.wip === "upsert") {
      await upsertSupplierAssetCost({
        supplierPaymentId: args.paymentId,
        assetId,
        date: args.date,
        description: args.description,
        amountAr: args.amountAr,
      })
    }
  } else if (args.next.kind === "asset") {
    category = args.next.category
    annualRatePct = args.next.annualRatePct
    if (plan.fixedAsset === "create") {
      const created = await addFixedAsset({
        name: args.description,
        purchaseDate: args.date,
        amountAr: args.amountAr,
        annualRatePct: args.next.annualRatePct,
      })
      fixedAssetId = created.id
    } else if (plan.fixedAsset === "update" && fixedAssetId) {
      await updateFixedAsset(fixedAssetId, {
        name: args.description,
        purchaseDate: args.date,
        amountAr: args.amountAr,
        annualRatePct: args.next.annualRatePct,
      })
    }
  } else if (args.next.kind === "loan") {
    category = args.next.category
    reservationId = args.next.reservationId
    loanRate = args.next.loanRate
    // Nova postavka, šele nato brišemo staro — na računu gosta ostane natanko ena.
    const created = await createLoanOrderItem(reservationId, args.amountAr, args.date, args.next.loanRate)
    if (args.prev.orderItemId && args.prev.orderItemId !== created) await deleteLoanOrderItem(args.prev.orderItemId)
    orderItemId = created
  } else if (args.next.kind === "pnl") {
    category = args.next.category
  }

  await db.execute(sql`
    UPDATE supplier_payments SET
      "costCategory" = ${category || null},
      "assetId" = ${assetId || null},
      "annualRatePct" = ${annualRatePct != null ? String(annualRatePct) : null},
      "fixedAssetId" = ${fixedAssetId || null},
      "reservationId" = ${reservationId || null},
      "orderItemId" = ${orderItemId || null},
      "loanRate" = ${loanRate != null ? String(loanRate) : null}
    WHERE id = ${args.paymentId}
  `)
}

async function releaseBoatCostLinks(row: PaymentCostRow) {
  if (!row.id) return
  const { removeSupplierAssetCost, deleteFixedAsset } = await import("./statistics")
  const { deleteLoanOrderItem } = await import("./nabava")
  await removeSupplierAssetCost(row.id)
  if (row.fixedAssetId) await deleteFixedAsset(row.fixedAssetId)
  if (row.orderItemId) await deleteLoanOrderItem(row.orderItemId)
}

export async function unpaySupplier(params: { refKey: string }) {
  await ensureSupplierPaymentCostColumns()
  const refKey = params.refKey
  const prev = await loadPayment(refKey)
  if (!prev) return { ok: true }
  if (prev.ledgerId) {
    if (prev.method === "orange") await deleteOmTransaction(prev.ledgerId)
    else await deleteCashExpense(prev.ledgerId)
  }
  if (isTransportCostPayRef(refKey)) await releaseBoatCostLinks(prev)
  await db.execute(sql`DELETE FROM supplier_payments WHERE "refKey" = ${refKey}`)
  return { ok: true }
}

// Popravek zneska na pogodbi: ista vknjižba plačila Dilipu, brez drugega odliva.
export async function syncDilipBoatPaymentFromContract(params: {
  supplierPaymentId: string
  date: string
  description: string
  amountAr: number
}) {
  await ensureSupplierPaymentCostColumns()
  const amount = Math.round(params.amountAr)
  const date = params.date
  const description = (params.description || "").trim()
  const found = await db.execute(sql`
    SELECT id, method, "ledgerId", "refKey" FROM supplier_payments WHERE id = ${params.supplierPaymentId} LIMIT 1
  `)
  const row = (found.rows as Record<string, unknown>[])[0]
  if (!row) throw new Error("Plačilo ne obstaja.")
  const ledgerId = row.ledgerId ? String(row.ledgerId) : ""
  const method = row.method === "orange" ? "orange" : "cash"
  if (!ledgerId) throw new Error("Plačilo nima vknjižbe. Popravi ga na dnevu.")
  if (method === "orange") {
    const exists = await db.execute(sql`SELECT id FROM orange_money_transactions WHERE id = ${ledgerId} LIMIT 1`)
    if (!exists.rows.length) throw new Error("Vknjižba Orange Money za to plačilo ne obstaja. Popravi jo na dnevu.")
    await updateOmTransaction(ledgerId, {
      date,
      direction: "out",
      category: "dobavitelj",
      amount,
      description,
    })
  } else {
    const exists = await db.execute(sql`SELECT id FROM bank_cash_expenses WHERE id = ${ledgerId} LIMIT 1`)
    if (!exists.rows.length) throw new Error("Vknjižba v blagajni za to plačilo ne obstaja. Popravi jo na dnevu.")
    await updateCashExpense(ledgerId, { date, purpose: description, amount })
  }
  await db.execute(sql`
    UPDATE supplier_payments SET "paidAt" = ${date}, "amountAr" = ${amount} WHERE id = ${params.supplierPaymentId}
  `)
}

// Odstrani samo oznako stroška. Plačilo Dilipu in njegova vknjižba ostaneta.
export async function clearDilipBoatCostMark(paymentId: string) {
  await ensureSupplierPaymentCostColumns()
  const found = await db.execute(sql`
    SELECT id, "fixedAssetId", "orderItemId" FROM supplier_payments WHERE id = ${paymentId} LIMIT 1
  `)
  const row = (found.rows as Record<string, unknown>[])[0]
  if (!row) return
  const { removeSupplierAssetCost, deleteFixedAsset } = await import("./statistics")
  const { deleteLoanOrderItem } = await import("./nabava")
  await removeSupplierAssetCost(paymentId)
  const fixedAssetId = row.fixedAssetId ? String(row.fixedAssetId) : ""
  const orderItemId = row.orderItemId ? String(row.orderItemId) : ""
  if (fixedAssetId) await deleteFixedAsset(fixedAssetId)
  if (orderItemId) await deleteLoanOrderItem(orderItemId)
  await db.execute(sql`
    UPDATE supplier_payments SET
      "costCategory" = NULL,
      "assetId" = NULL,
      "annualRatePct" = NULL,
      "fixedAssetId" = NULL,
      "reservationId" = NULL,
      "orderItemId" = NULL,
      "loanRate" = NULL
    WHERE id = ${paymentId}
  `)
}
