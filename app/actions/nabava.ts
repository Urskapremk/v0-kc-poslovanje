"use server"

import { db } from "@/lib/db"
import { sql } from "drizzle-orm"
import { unpaySupplier } from "./supplier-payment"
import { addCashExpense, updateCashExpense, deleteCashExpense } from "./banka"
import { getExchangeRate } from "./komba"
import { STROSEK_CATEGORIES, type StrosekCategory } from "@/lib/stroski-categories"

// Nabava = ko gre Borut po nakupih BREZ gostov. Vsak vnos je "izlet v nabavo" z datumom
// in opisom; plačila (voznik čolna / nosači / tuc tuc) gredo skozi obstoječi mehanizem
// supplier_payments (paySupplier/unpaySupplier) z refKeyi `nabava:<id>:<supplierKey>`, kar
// omogoča gotovino (blagajna Tourism/SARL) ali Orange Money.
// Poleg tega ima lahko vsak vnos NAROČEN ČOLN (kot pri transferju gostov): Borut izbere
// čoln (npr. Dilip) + relacijo (npr. Port Nosy be - Komba Cabana); prikaže se le strošek
// dobavitelja, plačilo pa gre prek istega supplier_payments (refKey `nabava:<id>:boat`).
async function ensureTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS nabava_trips (
      id text PRIMARY KEY,
      date text,
      note text,
      "boatId" text,
      "routeId" text,
      "boatOrderedAt" timestamptz,
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )
  `)
  // Za obstoječe tabele: dodaj manjkajoče stolpce (naročilo čolna).
  await db.execute(sql`ALTER TABLE nabava_trips ADD COLUMN IF NOT EXISTS "boatId" text`)
  await db.execute(sql`ALTER TABLE nabava_trips ADD COLUMN IF NOT EXISTS "routeId" text`)
  await db.execute(sql`ALTER TABLE nabava_trips ADD COLUMN IF NOT EXISTS "boatOrderedAt" timestamptz`)
  // Nabava brez čolna: Borut gre po nakupih brez naročenega čolna (npr. se pelje z gosti) →
  // beležijo se le ostali stroški (voznik/nosači/tuc tuc) in nakupi, čoln (Dilip) se skrije.
  await db.execute(sql`ALTER TABLE nabava_trips ADD COLUMN IF NOT EXISTS "noBoat" boolean NOT NULL DEFAULT false`)
  // Vrsta nabave: 'hv' = Nabava HV (čoln/voznik/nosači/tuc tuc + nakupi), 'komba' = Nabava Komba
  // (samo nakupi robe — brez čolna, brez voznika).
  await db.execute(sql`ALTER TABLE nabava_trips ADD COLUMN IF NOT EXISTS site text NOT NULL DEFAULT 'hv'`)
  // Nakupi (kalamari, jastogi, riba …), ki jih Borut kupi na nabavni poti in plača z GOTOVINO.
  // Vsak nakup ima kategorijo (kuhinja/bar/… — ista logika kot arhiv računov), zato v kalkulacijah
  // hrana bremeni kuhinjo, pijača bar itd. Gotovina se odšteje iz blagajne (bank_cash_expenses).
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS nabava_purchases (
      id text PRIMARY KEY,
      "tripId" text NOT NULL,
      name text NOT NULL,
      category text NOT NULL,
      "amountAr" numeric NOT NULL DEFAULT 0,
      company text NOT NULL DEFAULT 'tourism',
      date text NOT NULL,
      "cashExpenseId" text,
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )
  `)
  // Nakup je lahko OSNOVNO SREDSTVO (amortizacija): shranimo letno stopnjo in povezavo na fixed_assets.
  await db.execute(sql`ALTER TABLE nabava_purchases ADD COLUMN IF NOT EXISTS "annualRatePct" numeric`)
  await db.execute(sql`ALTER TABLE nabava_purchases ADD COLUMN IF NOT EXISTS "fixedAssetId" text`)
  // Posojilo gostu: gotovina, ki jo založimo gostu → gre na njegov račun (order_items), plača s kartico.
  await db.execute(sql`ALTER TABLE nabava_purchases ADD COLUMN IF NOT EXISTS "reservationId" text`)
  await db.execute(sql`ALTER TABLE nabava_purchases ADD COLUMN IF NOT EXISTS "orderItemId" text`)
  await db.execute(sql`ALTER TABLE nabava_purchases ADD COLUMN IF NOT EXISTS "loanRate" numeric`)
  // Strošek sredstva v izdelavi (pogodba): povezava na fixed_assets (status in_progress).
  await db.execute(sql`ALTER TABLE nabava_purchases ADD COLUMN IF NOT EXISTS "assetId" text`)
}

const LOAN_CAT = "posojilo_gostu"
const WIP_CAT = "sredstvo_v_izdelavi"
const RENT_CAT = "najemnina"
const IZLET_CAT = "izlet"
const STIPEND_CAT = "stipendija"
const STUDENT_FOOD_CAT = "hrana_studenti"
type NabavaCat = StrosekCategory | "osnovno_sredstvo" | "posojilo_gostu" | "sredstvo_v_izdelavi" | "najemnina" | "izlet" | "stipendija" | "hrana_studenti"

async function syncWipCost(purchaseId: string, category: NabavaCat, assetId: string, date: string, name: string, amountAr: number) {
  const { upsertNabavaAssetCost, removeNabavaAssetCost } = await import("./statistics")
  if (category === WIP_CAT && assetId) {
    await upsertNabavaAssetCost({ nabavaPurchaseId: purchaseId, assetId, date, description: name || "nabava", amountAr })
  } else {
    await removeNabavaAssetCost(purchaseId)
  }
}
const LOAN_ORDER_CATEGORY = "Posojilo"
const LOAN_ORDER_NAME = "Cash advance"

// "osnovno_sredstvo" in "posojilo_gostu" nista navadni stroškovni kategoriji, zato ju ohranimo
// ločeno; ostale normaliziramo na veljavno StrosekCategory.
function normCategory(c: string): NabavaCat {
  if (c === "osnovno_sredstvo") return "osnovno_sredstvo"
  if (c === WIP_CAT) return WIP_CAT
  if (c === LOAN_CAT) return LOAN_CAT
  if (c === RENT_CAT) return RENT_CAT
  if (c === IZLET_CAT) return IZLET_CAT
  if (c === STIPEND_CAT) return STIPEND_CAT
  if (c === STUDENT_FOOD_CAT) return STUDENT_FOOD_CAT
  return STROSEK_CATEGORIES.includes(c as StrosekCategory) ? (c as StrosekCategory) : "kuhinja"
}

// Gostje, ki so trenutno v bungalovih (prijavljeni, še ne odjavljeni) — za izbiro pri posojilu.
export async function getNabavaLoanGuests(): Promise<{ id: string; guestName: string; bungalow: string }[]> {
  const res = await db.execute(sql`
    SELECT id, "guestName", bungalow FROM reservations
    WHERE "checkedInAt" IS NOT NULL AND "checkedOutAt" IS NULL AND COALESCE(status, '') <> 'CANCELLED'
    ORDER BY bungalow ASC
  `)
  return (res.rows as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    guestName: r.guestName ? String(r.guestName) : "",
    bungalow: r.bungalow ? String(r.bungalow) : "",
  }))
}

async function getInvoiceExchangeRate() {
  const res = await db.execute(sql`SELECT value FROM settings WHERE key = 'exchangeRate' LIMIT 1`)
  const v = Number((res.rows[0] as Record<string, unknown> | undefined)?.value)
  return v > 0 ? v : 4800
}

// Račun gosta preračunava Ar → EUR po splošnem tečaju. Posojilo pa ima SVOJ tečaj (menjava ob založitvi),
// zato priceAr nastavimo tako, da je EUR na računu točno amountAr / loanRate.
async function createLoanOrderItem(reservationId: string, amountAr: number, date: string, loanRate: number) {
  const id = `ord-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const invoiceRate = await getInvoiceExchangeRate()
  const eur = Math.round((amountAr / loanRate) * 100) / 100
  const priceAr = Math.round(eur * invoiceRate)
  const name = `${LOAN_ORDER_NAME} (${amountAr.toLocaleString("de-DE")} Ar @ ${loanRate.toLocaleString("de-DE")} Ar/€ = ${eur.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €)`
  await db.execute(sql`
    INSERT INTO order_items (id, "reservationId", name, category, qty, "priceAr", "paymentStatus", "eventDate", "addedBy")
    VALUES (${id}, ${reservationId}, ${name}, ${LOAN_ORDER_CATEGORY}, 1, ${priceAr}, 'UNPAID', ${date}, 'Borut')
  `)
  return id
}

async function deleteLoanOrderItem(orderItemId: string) {
  if (orderItemId) await db.execute(sql`DELETE FROM order_items WHERE id = ${orderItemId}`)
}

async function loanPurpose(reservationId: string, name: string) {
  const res = await db.execute(sql`SELECT "guestName", bungalow FROM reservations WHERE id = ${reservationId}`)
  const r = res.rows[0] as Record<string, unknown> | undefined
  const who = r ? `${String(r.guestName || "")} (${String(r.bungalow || "")})` : "gost"
  return `Posojilo gostu — ${who}${name ? ` · ${name}` : ""}`
}

export type NabavaTrip = {
  id: string
  date: string
  note: string
  boatId: string
  routeId: string
  boatOrderedAt: string
  noBoat: boolean
  site: string
  createdAt: string
}

export async function getNabavaTrips(): Promise<NabavaTrip[]> {
  await ensureTable()
  const res = await db.execute(
    sql`SELECT id, date, note, "boatId", "routeId", "boatOrderedAt", "noBoat", site, "createdAt" FROM nabava_trips ORDER BY date DESC, "createdAt" DESC`
  )
  return (res.rows as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    date: r.date ? String(r.date) : "",
    note: r.note ? String(r.note) : "",
    boatId: r.boatId ? String(r.boatId) : "",
    routeId: r.routeId ? String(r.routeId) : "",
    boatOrderedAt: r.boatOrderedAt ? String(r.boatOrderedAt) : "",
    noBoat: r.noBoat === true || r.noBoat === "true",
    site: r.site ? String(r.site) : "hv",
    createdAt: r.createdAt ? String(r.createdAt) : "",
  }))
}

export async function addNabavaTrip(params: { date: string; note: string; site?: string }) {
  await ensureTable()
  const id = `nab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const date = params.date || new Date().toISOString().slice(0, 10)
  const site = params.site === "komba" ? "komba" : "hv"
  await db.execute(
    sql`INSERT INTO nabava_trips (id, date, note, site) VALUES (${id}, ${date}, ${params.note || ""}, ${site})`
  )
  return { ok: true, id }
}

export async function updateNabavaTrip(params: { id: string; date: string; note: string }) {
  await ensureTable()
  await db.execute(
    sql`UPDATE nabava_trips SET date = ${params.date}, note = ${params.note || ""} WHERE id = ${params.id}`
  )
  return { ok: true }
}

// Borut izbere / zamenja čoln in relacijo za nabavni izlet. Menjava relacije razveljavi
// morebitno "naročeno" stanje (druga cena/dobavitelj), plačilo pa ostane ročno.
export async function setNabavaBoat(params: { id: string; boatId: string; routeId: string }) {
  await ensureTable()
  await db.execute(
    sql`UPDATE nabava_trips SET "boatId" = ${params.boatId || null}, "routeId" = ${params.routeId || null} WHERE id = ${params.id}`
  )
  return { ok: true }
}

// Preklop "brez čolna". Ko Borut označi brez čolna, počistimo izbrani čoln/relacijo in
// razveljavimo morebitno plačilo Dilipu za čoln (nabava:<id>:boat).
export async function setNabavaNoBoat(params: { id: string; noBoat: boolean }) {
  await ensureTable()
  if (params.noBoat) {
    await unpaySupplier({ refKey: `nabava:${params.id}:boat` })
    await db.execute(
      sql`UPDATE nabava_trips SET "noBoat" = true, "boatId" = null, "routeId" = null, "boatOrderedAt" = null WHERE id = ${params.id}`
    )
  } else {
    await db.execute(sql`UPDATE nabava_trips SET "noBoat" = false WHERE id = ${params.id}`)
  }
  return { ok: true }
}

export async function setNabavaBoatOrdered(params: { id: string; ordered: boolean }) {
  await ensureTable()
  await db.execute(
    sql`UPDATE nabava_trips SET "boatOrderedAt" = ${params.ordered ? new Date().toISOString() : null} WHERE id = ${params.id}`
  )
  return { ok: true }
}

export async function deleteNabavaTrip(id: string) {
  await ensureTable()
  // Počisti povezana plačila (odlivi blagajne / Orange Money) preden izbrišemo vnos.
  const pays = await db.execute(
    sql`SELECT "refKey" FROM supplier_payments WHERE "refKey" LIKE ${`nabava:${id}:%`}`
  )
  for (const row of pays.rows as Record<string, unknown>[]) {
    await unpaySupplier({ refKey: String(row.refKey) })
  }
  // Počisti tudi gotovinske nakupe (in njihove odlive iz blagajne).
  const purchases = await db.execute(
    sql`SELECT id, "cashExpenseId", "orderItemId" FROM nabava_purchases WHERE "tripId" = ${id}`
  )
  const { removeNabavaAssetCost } = await import("./statistics")
  for (const row of purchases.rows as Record<string, unknown>[]) {
    if (row.cashExpenseId) await deleteCashExpense(String(row.cashExpenseId))
    if (row.orderItemId) await deleteLoanOrderItem(String(row.orderItemId))
    await removeNabavaAssetCost(String(row.id))
  }
  await db.execute(sql`DELETE FROM nabava_purchases WHERE "tripId" = ${id}`)
  await db.execute(sql`DELETE FROM nabava_trips WHERE id = ${id}`)
  return { ok: true }
}

/* ── Gotovinski nakupi na nabavni poti (hrana → kuhinja, pijača → bar …) ── */

export type NabavaPurchase = {
  id: string
  tripId: string
  name: string
  category: NabavaCat
  assetId: string
  amountAr: number
  company: string
  date: string
  cashExpenseId: string
  annualRatePct: number
  fixedAssetId: string
  reservationId: string
  orderItemId: string
  loanRate: number
  guestName: string
  bungalow: string
  createdAt: string
}

function mapPurchase(r: Record<string, unknown>): NabavaPurchase {
  return {
    id: String(r.id),
    tripId: String(r.tripId),
    name: r.name ? String(r.name) : "",
    category: normCategory(String(r.category || "")),
    assetId: r.assetId ? String(r.assetId) : "",
    amountAr: Number(r.amountAr || 0),
    company: r.company ? String(r.company) : "tourism",
    date: r.date ? String(r.date) : "",
    cashExpenseId: r.cashExpenseId ? String(r.cashExpenseId) : "",
    annualRatePct: Number(r.annualRatePct || 0),
    fixedAssetId: r.fixedAssetId ? String(r.fixedAssetId) : "",
    reservationId: r.reservationId ? String(r.reservationId) : "",
    orderItemId: r.orderItemId ? String(r.orderItemId) : "",
    loanRate: Number(r.loanRate || 0),
    guestName: r.guestName ? String(r.guestName) : "",
    bungalow: r.bungalow ? String(r.bungalow) : "",
    createdAt: r.createdAt ? String(r.createdAt) : "",
  }
}

export async function getNabavaPurchases(tripId: string): Promise<NabavaPurchase[]> {
  await ensureTable()
  const res = await db.execute(
    sql`SELECT p.*, r."guestName", r.bungalow FROM nabava_purchases p
        LEFT JOIN reservations r ON r.id = p."reservationId"
        WHERE p."tripId" = ${tripId} ORDER BY p."createdAt" ASC`
  )
  return (res.rows as Record<string, unknown>[]).map(mapPurchase)
}

// Za statistiko: vsi nakupi danega meseca (po datumu nakupa), da se razporedijo po kategorijah.
export async function getNabavaPurchasesForMonth(year: number, month: number): Promise<NabavaPurchase[]> {
  await ensureTable()
  const prefix = `${year}-${String(month).padStart(2, "0")}%`
  const res = await db.execute(
    sql`SELECT * FROM nabava_purchases WHERE date LIKE ${prefix}`
  )
  return (res.rows as Record<string, unknown>[]).map(mapPurchase)
}

export async function addNabavaPurchase(params: {
  tripId: string
  name: string
  category: string
  amountAr: number
  company: string
  date: string
  annualRatePct?: number
  reservationId?: string
  loanRate?: number
  assetId?: string
}) {
  await ensureTable()
  const id = `nabp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const category = normCategory(params.category)
  const assetId = category === WIP_CAT ? params.assetId || "" : ""
  if (category === WIP_CAT && !assetId) throw new Error("Izberi pogodbo (sredstvo v izdelavi).")
  const company = params.company === "sarl" ? "sarl" : "tourism"
  const date = params.date || new Date().toISOString().slice(0, 10)
  const amountAr = Math.max(0, Math.round(params.amountAr || 0))
  const annualRatePct = category === "osnovno_sredstvo" ? Number(params.annualRatePct) || 0 : 0
  const reservationId = category === LOAN_CAT ? params.reservationId || "" : ""
  if (category === LOAN_CAT && !reservationId) throw new Error("Izberi gosta za posojilo.")
  const loanRate = category === LOAN_CAT ? Number(params.loanRate) || 0 : 0
  if (category === LOAN_CAT && loanRate <= 0) throw new Error("Vpiši menjalni tečaj za posojilo.")
  const purpose = category === LOAN_CAT ? await loanPurpose(reservationId, params.name) : `Nabava — ${params.name || "nakup"}`
  // Odliv iz blagajne (gotovina) — nakup/posojilo je vedno plačano z gotovino.
  const { id: cashExpenseId } = await addCashExpense({ company, date, purpose, amount: amountAr })
  // Posojilo gostu → postavka na računu gosta (plača jo s kartico ob odhodu).
  const orderItemId = category === LOAN_CAT ? await createLoanOrderItem(reservationId, amountAr, date, loanRate) : null
  // Osnovno sredstvo → ustvari zapis v fixed_assets (amortizacija čez čas; nakup NE bremeni oddelka takoj).
  let fixedAssetId: string | null = null
  if (category === "osnovno_sredstvo") {
    const { addFixedAsset } = await import("./statistics")
    const fa = await addFixedAsset({
      name: params.name || "Nabava — osnovno sredstvo",
      purchaseDate: date,
      amountAr,
      annualRatePct,
    })
    fixedAssetId = fa.id
  }
  await db.execute(
    sql`INSERT INTO nabava_purchases (id, "tripId", name, category, "amountAr", company, date, "cashExpenseId", "annualRatePct", "fixedAssetId", "reservationId", "orderItemId", "loanRate", "assetId")
        VALUES (${id}, ${params.tripId}, ${params.name || ""}, ${category}, ${amountAr}, ${company}, ${date}, ${cashExpenseId}, ${annualRatePct}, ${fixedAssetId}, ${reservationId || null}, ${orderItemId}, ${loanRate || null}, ${assetId || null})`
  )
  if (category === WIP_CAT) await syncWipCost(id, category, assetId, date, params.name, amountAr)
  return { ok: true, id }
}

export async function updateNabavaPurchase(params: {
  id: string
  name: string
  category: string
  amountAr: number
  company: string
  date: string
  annualRatePct?: number
  reservationId?: string
  loanRate?: number
  assetId?: string
}) {
  await ensureTable()
  const category = normCategory(params.category)
  const assetId = category === WIP_CAT ? params.assetId || "" : ""
  if (category === WIP_CAT && !assetId) throw new Error("Izberi pogodbo (sredstvo v izdelavi).")
  const company = params.company === "sarl" ? "sarl" : "tourism"
  const date = params.date || new Date().toISOString().slice(0, 10)
  const amountAr = Math.max(0, Math.round(params.amountAr || 0))
  const annualRatePct = category === "osnovno_sredstvo" ? Number(params.annualRatePct) || 0 : 0
  const reservationId = category === LOAN_CAT ? params.reservationId || "" : ""
  if (category === LOAN_CAT && !reservationId) throw new Error("Izberi gosta za posojilo.")
  const loanRate = category === LOAN_CAT ? Number(params.loanRate) || 0 : 0
  if (category === LOAN_CAT && loanRate <= 0) throw new Error("Vpiši menjalni tečaj za posojilo.")
  const existing = await db.execute(
    sql`SELECT "cashExpenseId", company, "fixedAssetId", "orderItemId" FROM nabava_purchases WHERE id = ${params.id}`
  )
  const row = existing.rows[0] as Record<string, unknown> | undefined
  const oldCashId = row?.cashExpenseId ? String(row.cashExpenseId) : ""
  const oldCompany = row?.company ? String(row.company) : "tourism"
  const oldFixedAssetId = row?.fixedAssetId ? String(row.fixedAssetId) : ""
  const oldOrderItemId = row?.orderItemId ? String(row.orderItemId) : ""
  const purpose = category === LOAN_CAT ? await loanPurpose(reservationId, params.name) : `Nabava — ${params.name || "nakup"}`
  let cashExpenseId = oldCashId
  if (oldCashId && oldCompany === company) {
    // Isto podjetje → posodobi obstoječi odliv.
    await updateCashExpense(oldCashId, { date, purpose, amount: amountAr })
  } else {
    // Podjetje se je spremenilo (ali odliva še ni) → izbriši starega in ustvari novega.
    if (oldCashId) await deleteCashExpense(oldCashId)
    const created = await addCashExpense({ company, date, purpose, amount: amountAr })
    cashExpenseId = created.id
  }
  // Uskladi postavko na računu gosta (posojilo): vedno na novo, da sledi gostu/znesku/datumu.
  await deleteLoanOrderItem(oldOrderItemId)
  const orderItemId = category === LOAN_CAT ? await createLoanOrderItem(reservationId, amountAr, date, loanRate) : null
  // Uskladi osnovno sredstvo (fixed_assets) glede na (spremenjeno) kategorijo.
  let fixedAssetId: string | null = oldFixedAssetId || null
  const { addFixedAsset, updateFixedAsset, deleteFixedAsset } = await import("./statistics")
  if (category === "osnovno_sredstvo") {
    if (oldFixedAssetId) {
      await updateFixedAsset(oldFixedAssetId, {
        name: params.name || "Nabava — osnovno sredstvo",
        purchaseDate: date,
        amountAr,
        annualRatePct,
      })
    } else {
      const fa = await addFixedAsset({
        name: params.name || "Nabava — osnovno sredstvo",
        purchaseDate: date,
        amountAr,
        annualRatePct,
      })
      fixedAssetId = fa.id
    }
  } else if (oldFixedAssetId) {
    // Kategorija ni več osnovno sredstvo → odstrani zapis amortizacije.
    await deleteFixedAsset(oldFixedAssetId)
    fixedAssetId = null
  }
  await db.execute(
    sql`UPDATE nabava_purchases
        SET name = ${params.name || ""}, category = ${category}, "amountAr" = ${amountAr}, company = ${company}, date = ${date}, "cashExpenseId" = ${cashExpenseId}, "annualRatePct" = ${annualRatePct}, "fixedAssetId" = ${fixedAssetId}, "reservationId" = ${reservationId || null}, "orderItemId" = ${orderItemId}, "loanRate" = ${loanRate || null}, "assetId" = ${assetId || null}
        WHERE id = ${params.id}`
  )
  await syncWipCost(params.id, category, assetId, date, params.name, amountAr)
  return { ok: true }
}

// Arhiv nakupov (HV / Komba): vsi nabavni vnosi danega tipa, ki imajo vsaj en nakup, do danes.
// Grupira se po dnevu (kot arhiv transferjev), znotraj vsakega dneva se prikažejo nakupi z možnostjo
// popravljanja (NabavaPurchasesSection).
export async function getArchivedNabavaTrips(
  site: "hv" | "komba",
  ): Promise<{
  trips: {
  id: string
  date: string
  note: string
  count: number
  payments: { refKey: string; supplier: string; amountAr: number; method: string; company: string; paidAt: string }[]
  }[]
  today: string
  }> {
  await ensureTable()
  const siteVal = site === "komba" ? "komba" : "hv"
  const today = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().split("T")[0]
  const res = await db.execute(sql`
  SELECT t.id, t.date, t.note,
  (SELECT COUNT(*) FROM nabava_purchases p WHERE p."tripId" = t.id) AS cnt
  FROM nabava_trips t
  WHERE t.site = ${siteVal} AND t.date < ${today}
  AND (
  EXISTS (SELECT 1 FROM nabava_purchases p WHERE p."tripId" = t.id)
  OR EXISTS (SELECT 1 FROM supplier_payments sp WHERE sp."refKey" LIKE 'nabava:' || t.id || ':%')
  )
  ORDER BY t.date DESC, t."createdAt" DESC
  `)
  const payRes = await db.execute(sql`
  SELECT "refKey", supplier, "amountAr", method, company, "paidAt"
  FROM supplier_payments WHERE "refKey" LIKE 'nabava:%'
  `)
  const paysByTrip = new Map<string, { refKey: string; supplier: string; amountAr: number; method: string; company: string; paidAt: string }[]>()
  for (const p of payRes.rows as Record<string, unknown>[]) {
  const refKey = String(p.refKey)
  const tripId = refKey.split(":")[1]
  const arr = paysByTrip.get(tripId) || []
  arr.push({
  refKey,
  supplier: String(p.supplier || ""),
  amountAr: Number(p.amountAr || 0),
  method: String(p.method || ""),
  company: String(p.company || ""),
  paidAt: p.paidAt ? String(p.paidAt) : "",
  })
  paysByTrip.set(tripId, arr)
  }
  const trips = (res.rows as Record<string, unknown>[]).map((r) => ({
  id: String(r.id),
  date: r.date ? String(r.date) : "",
  note: r.note ? String(r.note) : "",
  count: Number(r.cnt || 0),
  payments: paysByTrip.get(String(r.id)) || [],
  }))
  return { trips, today }
}

export async function deleteNabavaPurchase(id: string) {
  await ensureTable()
  const existing = await db.execute(sql`SELECT "cashExpenseId", "fixedAssetId", "orderItemId" FROM nabava_purchases WHERE id = ${id}`)
  const row = existing.rows[0] as Record<string, unknown> | undefined
  if (row?.cashExpenseId) await deleteCashExpense(String(row.cashExpenseId))
  if (row?.orderItemId) await deleteLoanOrderItem(String(row.orderItemId))
  if (row?.fixedAssetId) {
    const { deleteFixedAsset } = await import("./statistics")
    await deleteFixedAsset(String(row.fixedAssetId))
  }
  const { removeNabavaAssetCost } = await import("./statistics")
  await removeNabavaAssetCost(id)
  await db.execute(sql`DELETE FROM nabava_purchases WHERE id = ${id}`)
  return { ok: true }
}
