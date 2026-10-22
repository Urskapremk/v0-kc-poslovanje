'use server'

import { db } from '@/lib/db'
import { boardPax, isCheckInPensionLump, isMealPlanPaid, paidPensionCoversMeal } from '@/lib/meal-plan'
import { 
  reservations, 
  orderItems, 
  deliveryNotes, 
  deliveryNoteItems, 
  transfers,
  products,
  costSettings,
  staffSalaries,
  excursionBookings,
  excursionPricing,
  excursions,
  supplierPricing,
  sellingPricing,
  routes,
  boats,
  marketingExpenses,
  hnaturaRepayments
} from '@/lib/db/schema'
import { eq, and, gte, lte, isNotNull, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { parseCategories } from '@/lib/stroski-categories'
import { getNabavaPurchasesForMonth, getAutoMassageOrderItemIds } from './nabava'
import { ensureSupplierPaymentCostColumns } from './supplier-payment'
import { parseSalaryChanges, salaryForMonth } from '@/lib/employment'
import { normalizeAssetCost } from '@/lib/asset-cost'

type KuhinjaRacunLine = {
  id: string
  date: string
  name: string
  amountEur: number
  source: string
}

function isoDay(v: unknown): string {
  if (!v) return ''
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(v))
  return m ? m[1] : ''
}

// Posamezne postavke zaokroži na cent. Če se vsota centov razlikuje od zneska
// na vrstici, cent premaknemo na postavko, ki je zaokrožitvi najbližje
// (običajno gotovino iz ariaryjev), da arhivski račun ostane na svojem znesku.
function roundKuhinjaLines(raw: KuhinjaRacunLine[], totalEur: number): KuhinjaRacunLine[] {
  const sorted = [...raw].sort((a, b) =>
    a.date.localeCompare(b.date) || a.name.localeCompare(b.name, 'sl') || a.id.localeCompare(b.id)
  )
  const exact = sorted.map((l) => l.amountEur * 100)
  const cents = exact.map((c) => Math.round(c))
  let drift = Math.round(totalEur * 100) - cents.reduce((sum, c) => sum + c, 0)
  let steps = 0
  while (drift !== 0 && sorted.length > 0 && steps < Math.abs(drift) + sorted.length) {
    const step = drift > 0 ? 1 : -1
    let best = 0
    let bestScore = -Infinity
    for (let i = 0; i < cents.length; i++) {
      const improvement = Math.abs(cents[i] - exact[i]) - Math.abs(cents[i] + step - exact[i])
      const score = improvement + (sorted[i].source === 'gotovina' ? 0.001 : 0)
      if (score > bestScore) {
        bestScore = score
        best = i
      }
    }
    cents[best] += step
    drift -= step
    steps++
  }
  return sorted.map((l, i) => ({ ...l, amountEur: cents[i] / 100 }))
}

async function ensureKompenzacijaColumns() {
  await db.execute(sql`ALTER TABLE payments ADD COLUMN IF NOT EXISTS "contraExpenseId" text`)
  await db.execute(sql`ALTER TABLE marketing_expenses ADD COLUMN IF NOT EXISTS "compensationPaymentId" text`)
}

// Get exchange rate from settings
async function getExchangeRate(): Promise<number> {
  const result = await db.query.settings.findFirst({
    where: (settings, { eq }) => eq(settings.key, 'exchangeRate')
  })
  return result ? Number(result.value) : 4800
}

// Get cost settings
export async function getCostSettings() {
  return await db.select().from(costSettings)
}

// Update cost setting
export async function updateCostSetting(id: string, value: number) {
  await db.update(costSettings)
    .set({ value: String(value), updatedAt: new Date() })
    .where(eq(costSettings.id, id))
}

// --- Marketing expenses / Stroški marketinga ---
// Get marketing expenses for a month
export async function getMarketingExpenses(year: number, month: number, category: string = 'marketing') {
  await ensureKompenzacijaColumns()
  return await db.select().from(marketingExpenses)
    .where(and(
      eq(marketingExpenses.year, year),
      eq(marketingExpenses.month, month),
      eq(marketingExpenses.category, category)
    ))
    .orderBy(marketingExpenses.createdAt)
}

// Get all marketing expenses for a whole year (for listing, grouped by month)
export async function getMarketingExpensesYear(year: number, category: string = 'marketing') {
  await ensureKompenzacijaColumns()
  return await db.select().from(marketingExpenses)
    .where(and(
      eq(marketingExpenses.year, year),
      eq(marketingExpenses.category, category)
    ))
    .orderBy(marketingExpenses.date)
}

// Get all expenses (across all categories) paid via Hnatura d.o.o. (paymentMethod = 'in_kind')
// for a whole year — used for the "Vračilo Hnatura d.o.o." tab (amount to be repaid).
export async function getHnaturaExpensesYear(year: number) {
  await ensureKompenzacijaColumns()
  return await db.select().from(marketingExpenses)
    .where(and(
      eq(marketingExpenses.year, year),
      eq(marketingExpenses.paymentMethod, 'in_kind')
    ))
    .orderBy(marketingExpenses.date)
}

// --- Vračila Hnatura d.o.o. (opravljena nakazila, ki znižujejo dolg) --------

export async function getHnaturaRepaymentsYear(year: number) {
  return await db.select().from(hnaturaRepayments)
    .where(eq(hnaturaRepayments.year, year))
    .orderBy(hnaturaRepayments.date)
}

export async function addHnaturaRepayment(date: string, description: string, amount: number) {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = d.getMonth() + 1
  const id = `hnr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  await db.insert(hnaturaRepayments).values({
    id, year, month, date, description: description || null, amount: String(amount),
  })
  revalidatePath('/statistika')
}

// Tečaj za prikaz v vmesniku (Ar → EUR pri gotovinskih vračilih).
export async function getExchangeRateValue(): Promise<number> {
  return await getExchangeRate()
}

// Vračilo Hnaturi, plačano iz GOTOVINSKE blagajne (znesek vpisan v Ar):
// (1) ustvari odhodek blagajne (bank_cash_expenses, v Ar),
// (2) shrani vračilo v EUR (Ar / tečaj) s povezavo na ta odhodek za razveljavitev.
export async function addHnaturaRepaymentCash(params: {
  date: string
  description: string
  company: string // 'tourism' | 'sarl'
  amountAr: number
}) {
  const { date, description, company } = params
  const amountAr = Math.round(params.amountAr || 0)
  if (amountAr <= 0) return
  const rate = await getExchangeRate()
  const amountEur = Math.round((amountAr / rate) * 100) / 100
  const d = new Date(date)
  const year = d.getFullYear()
  const month = d.getMonth() + 1

  const { addCashExpense } = await import('./banka')
  const { id: cashExpenseId } = await addCashExpense({
    company,
    date,
    purpose: description || 'Vračilo Hnatura d.o.o. (gotovina)',
    amount: amountAr,
  })

  const id = `hnr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  await db.insert(hnaturaRepayments).values({
    id, year, month, date, description: description || null, amount: String(amountEur),
    cashExpenseId, cashCompany: company,
  })
  revalidatePath('/statistika')
  return { id, amountEur }
}

// Popravi obstoječe vračilo (datum/opis; znesek le pri NEgotovinskih vračilih).
// Pri gotovinskem vračilu posodobi tudi povezani odhodek blagajne (datum + opis).
export async function updateHnaturaRepayment(
  id: string,
  params: { date: string; description: string; amount?: number }
) {
  const existing = await db.select().from(hnaturaRepayments).where(eq(hnaturaRepayments.id, id))
  const row = existing[0]
  if (!row) return
  const d = new Date(params.date)
  const year = d.getFullYear()
  const month = d.getMonth() + 1
  const description = params.description.trim()

  if (row.cashExpenseId) {
    // Gotovinsko: znesek (EUR) izpeljan iz blagajne — ne spreminjamo ga tu, le datum/opis.
    const { updateCashExpense } = await import('./banka')
    const cashRows = await db.execute(
      sql`SELECT amount FROM bank_cash_expenses WHERE id = ${row.cashExpenseId} LIMIT 1`
    )
    const amountAr = Number(cashRows.rows[0]?.amount) || 0
    await updateCashExpense(row.cashExpenseId, {
      date: params.date,
      purpose: description || 'Vračilo Hnatura d.o.o. (gotovina)',
      amount: amountAr,
    })
    await db.execute(
      sql`UPDATE hnatura_repayments
          SET date = ${params.date}, description = ${description || null}, year = ${year}, month = ${month}
          WHERE id = ${id}`
    )
  } else {
    const amount = params.amount != null && params.amount > 0 ? params.amount : Number(row.amount)
    await db.execute(
      sql`UPDATE hnatura_repayments
          SET date = ${params.date}, description = ${description || null}, amount = ${String(amount)}, year = ${year}, month = ${month}
          WHERE id = ${id}`
    )
  }
  revalidatePath('/statistika')
}

export async function deleteHnaturaRepayment(id: string) {
  // Če je vračilo nastalo iz gotovinske blagajne, izbriši tudi odhodek blagajne.
  const existing = await db.select().from(hnaturaRepayments).where(eq(hnaturaRepayments.id, id))
  const cashExpenseId = existing[0]?.cashExpenseId
  if (cashExpenseId) {
    const { deleteCashExpense } = await import('./banka')
    await deleteCashExpense(cashExpenseId)
  }
  await db.delete(hnaturaRepayments).where(eq(hnaturaRepayments.id, id))
  revalidatePath('/statistika')
}

// ============ OSNOVNA SREDSTVA (fixed assets) — amortizacija ============
// Osnovna sredstva se knjižijo posebej; mesečni strošek je amortizacija.
// Osnova je nabavna vrednost v Ar (preračunana v EUR ob nabavi), amortizacijska
// stopnja je letni %. Amortizacija teče od meseca nabave do konca dobe.

// Doba trajanja v mesecih iz letne stopnje: 100/stopnja let → ×12 mesecev.
function assetLifeMonths(annualRatePct: number): number {
  if (!annualRatePct || annualRatePct <= 0) return 0
  return Math.max(1, Math.round(1200 / annualRatePct))
}

// Sredstva v izdelavi (npr. lesena tla iz kupljenega lesa): pogodba z izvajalcem + zbiranje
// stroškov (računi, razžaganje, izdelava, montaža). Dokler je status 'in_progress', se NE
// amortizira; ob aktivaciji nabavna vrednost = vsota stroškov, amortizacija od datuma aktivacije.
let assetSchemaReady: Promise<void> | null = null
function ensureAssetSchema() {
  if (!assetSchemaReady) {
    assetSchemaReady = (async () => {
      await db.execute(sql`ALTER TABLE fixed_assets
        ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
        ADD COLUMN IF NOT EXISTS "contractor" text,
        ADD COLUMN IF NOT EXISTS "contractScope" text,
        ADD COLUMN IF NOT EXISTS "contractPrice" numeric,
        ADD COLUMN IF NOT EXISTS "contractDeadline" text,
        ADD COLUMN IF NOT EXISTS "contractDate" text,
        ADD COLUMN IF NOT EXISTS "activatedAt" text`)
      await db.execute(sql`CREATE TABLE IF NOT EXISTS fixed_asset_costs (
        id text PRIMARY KEY,
        "assetId" text NOT NULL,
        date text NOT NULL,
        description text NOT NULL,
        "amountAr" numeric NOT NULL,
        "receiptId" text,
        "cashExpenseId" text,
        "createdAt" timestamp NOT NULL DEFAULT now()
      )`)
      await db.execute(sql`ALTER TABLE fixed_asset_costs ADD COLUMN IF NOT EXISTS "nabavaPurchaseId" text`)
      await db.execute(sql`ALTER TABLE fixed_asset_costs ADD COLUMN IF NOT EXISTS "supplierPaymentId" text`)
      await db.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS fixed_asset_costs_supplier_payment_idx
        ON fixed_asset_costs ("supplierPaymentId")
        WHERE "supplierPaymentId" IS NOT NULL
      `)
    })().catch((e) => {
      assetSchemaReady = null
      throw e
    })
  }
  return assetSchemaReady
}

export async function getFixedAssets() {
  await ensureAssetSchema()
  const result = await db.execute(
    sql`SELECT * FROM fixed_assets ORDER BY "purchaseDate" DESC, "createdAt" DESC`
  )
  return result.rows.map((r) => ({
    id: r.id as string,
    name: r.name as string,
    purchaseDate: r.purchaseDate as string,
    amountAr: Number(r.amountAr) || 0,
    amountEur: Number(r.amountEur) || 0,
    annualRatePct: Number(r.annualRatePct) || 0,
    status: ((r.status as string) || 'active') as 'active' | 'in_progress',
    activatedAt: (r.activatedAt as string) || null,
  }))
}

export type AssetCost = {
  id: string
  assetId: string
  date: string
  description: string
  amountAr: number
  receiptId: string | null
  cashExpenseId: string | null
  supplierPaymentId: string | null
}

export type AssetInProgress = {
  id: string
  name: string
  startDate: string
  annualRatePct: number
  contractor: string
  contractScope: string
  contractPrice: number
  contractDeadline: string
  contractDate: string
  totalAr: number
  costs: AssetCost[]
}

export async function getAssetsInProgress(): Promise<AssetInProgress[]> {
  await ensureAssetSchema()
  const assets = await db.execute(
    sql`SELECT * FROM fixed_assets WHERE status = 'in_progress' ORDER BY "createdAt" DESC`
  )
  if (assets.rows.length === 0) return []
  const costs = await db.execute(
    sql`SELECT * FROM fixed_asset_costs ORDER BY date ASC, "createdAt" ASC`
  )
  const byAsset: Record<string, AssetCost[]> = {}
  for (const c of costs.rows) {
    const cost: AssetCost = {
      id: c.id as string,
      assetId: c.assetId as string,
      date: String(c.date).slice(0, 10),
      description: c.description as string,
      amountAr: Number(c.amountAr) || 0,
      receiptId: (c.receiptId as string) || null,
      cashExpenseId: (c.cashExpenseId as string) || null,
      supplierPaymentId: (c.supplierPaymentId as string) || null,
    }
    ;(byAsset[cost.assetId] ||= []).push(cost)
  }
  return assets.rows.map((r) => {
    const list = byAsset[r.id as string] || []
    return {
      id: r.id as string,
      name: r.name as string,
      startDate: String(r.purchaseDate).slice(0, 10),
      annualRatePct: Number(r.annualRatePct) || 0,
      contractor: (r.contractor as string) || '',
      contractScope: (r.contractScope as string) || '',
      contractPrice: Number(r.contractPrice) || 0,
      contractDeadline: (r.contractDeadline as string) || '',
      contractDate: (r.contractDate as string) || '',
      totalAr: list.reduce((s, c) => s + c.amountAr, 0),
      costs: list,
    }
  })
}

async function recomputeAssetValue(assetId: string) {
  const sum = await db.execute(
    sql`SELECT COALESCE(SUM("amountAr"), 0) AS total FROM fixed_asset_costs WHERE "assetId" = ${assetId}`
  )
  const totalAr = Math.round((Number(sum.rows[0]?.total) || 0) * 100) / 100
  const rate = await getExchangeRate()
  const totalEur = Math.round((totalAr / rate) * 100) / 100
  await db.execute(
    sql`UPDATE fixed_assets SET "amountAr" = ${String(totalAr)}, "amountEur" = ${String(totalEur)} WHERE id = ${assetId}`
  )
}

type ContractFields = {
  name: string
  annualRatePct: number
  contractor: string
  contractScope: string
  contractPrice: number
  contractDeadline: string
  contractDate: string
}

export async function createAssetInProgress(
  params: ContractFields & {
    startDate: string
    firstCost?: { date: string; description: string; amountAr: number; receiptId?: string | null }
  }
) {
  await ensureAssetSchema()
  if (!params.name.trim()) throw new Error('Naziv sredstva je obvezen.')
  const id = `fa-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const rate = Number(params.annualRatePct) || 33.33
  await db.execute(
    sql`INSERT INTO fixed_assets (id, name, "purchaseDate", "amountAr", "amountEur", "annualRatePct", status,
          "contractor", "contractScope", "contractPrice", "contractDeadline", "contractDate")
        VALUES (${id}, ${params.name.trim()}, ${params.startDate}, '0', '0', ${String(rate)}, 'in_progress',
          ${params.contractor.trim() || null}, ${params.contractScope.trim() || null},
          ${params.contractPrice > 0 ? String(params.contractPrice) : null},
          ${params.contractDeadline || null}, ${params.contractDate || null})`
  )
  if (params.firstCost && params.firstCost.amountAr > 0) {
    await addAssetCost({ assetId: id, ...params.firstCost })
  }
  revalidatePath('/statistika')
  return { id }
}

export async function updateAssetContract(id: string, params: ContractFields) {
  await ensureAssetSchema()
  if (!params.name.trim()) return
  await db.execute(
    sql`UPDATE fixed_assets SET name = ${params.name.trim()},
          "annualRatePct" = ${String(Number(params.annualRatePct) || 33.33)},
          "contractor" = ${params.contractor.trim() || null},
          "contractScope" = ${params.contractScope.trim() || null},
          "contractPrice" = ${params.contractPrice > 0 ? String(params.contractPrice) : null},
          "contractDeadline" = ${params.contractDeadline || null},
          "contractDate" = ${params.contractDate || null}
        WHERE id = ${id}`
  )
  revalidatePath('/statistika')
}

export async function addAssetCost(params: {
  assetId: string
  date: string
  description: string
  amountAr: number
  receiptId?: string | null
  payFromCash?: boolean
}) {
  await ensureAssetSchema()
  const parsed = normalizeAssetCost(params)
  if (!params.assetId || !parsed) {
    throw new Error('Opis, datum in znesek stroška so obvezni.')
  }
  const { date, description, amountAr } = parsed
  const receiptId = params.receiptId?.trim() || null
  if (receiptId) {
    const dup = await db.execute(
      sql`SELECT id FROM fixed_asset_costs WHERE "receiptId" = ${receiptId} LIMIT 1`
    )
    if (dup.rows.length > 0) throw new Error('Ta račun je že dodan k sredstvu v izdelavi.')
  }
  const asset = await db.execute(sql`SELECT name FROM fixed_assets WHERE id = ${params.assetId}`)
  const assetName = (asset.rows[0]?.name as string) || 'sredstvo v izdelavi'
  let cashExpenseId: string | null = null
  if (params.payFromCash && !receiptId) {
    const { addCashExpense } = await import('./banka')
    const res = await addCashExpense({
      company: 'tourism',
      date,
      purpose: `${assetName}: ${description}`,
      amount: amountAr,
    })
    cashExpenseId = (res as { id?: string } | undefined)?.id ?? null
  }
  const id = `fac-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  await db.execute(
    sql`INSERT INTO fixed_asset_costs (id, "assetId", date, description, "amountAr", "receiptId", "cashExpenseId")
        VALUES (${id}, ${params.assetId}, ${date}, ${description}, ${String(amountAr)}, ${receiptId}, ${cashExpenseId})`
  )
  await recomputeAssetValue(params.assetId)
  revalidatePath('/statistika')
  return { id }
}

// Popravi obstoječi strošek na sredstvu v izdelavi.
// Ista preverba kot pri dodajanju. Gotovina Tourism: ista vknjižba se posodobi
// (datum, besedilo, znesek). Nova se odpre samo, če je potrjena gotovina in
// povezane vknjižbe še ni. Izklop gotovine pobriše samo povezani odliv.
// Račun ostane račun — gotovine pri njem ne vklapljamo in je ne brišemo.
export async function updateAssetCost(params: {
  id: string
  date: string
  description: string
  amountAr: number
  payFromCash?: boolean
}) {
  await ensureAssetSchema()
  const parsed = normalizeAssetCost(params)
  if (!params.id || !parsed) {
    throw new Error('Opis, datum in znesek stroška so obvezni.')
  }
  const { date, description, amountAr } = parsed
  const row = await db.execute(
    sql`SELECT c."assetId", c."receiptId", c."cashExpenseId", c."nabavaPurchaseId", c."supplierPaymentId", a.name AS "assetName"
        FROM fixed_asset_costs c
        JOIN fixed_assets a ON a.id = c."assetId"
        WHERE c.id = ${params.id}`
  )
  const r = row.rows[0]
  if (!r) throw new Error('Strošek ne obstaja.')
  const assetId = r.assetId as string
  const receiptId = (r.receiptId as string) || null
  let cashExpenseId = (r.cashExpenseId as string) || null
  const nabavaPurchaseId = (r.nabavaPurchaseId as string) || null
  const supplierPaymentId = (r.supplierPaymentId as string) || null
  const assetName = (r.assetName as string) || 'sredstvo v izdelavi'
  if (supplierPaymentId) {
    if (params.payFromCash) {
      throw new Error('Plačilo Dilipu je že zabeleženo v blagajni ali Orange Money. Popravi ga pri čolnu — tukaj ne odštevaj še enkrat.')
    }
    const { syncDilipBoatPaymentFromContract } = await import('./supplier-payment')
    await syncDilipBoatPaymentFromContract({
      supplierPaymentId,
      date,
      description,
      amountAr,
    })
    await db.execute(
      sql`UPDATE fixed_asset_costs
          SET date = ${date}, description = ${description}, "amountAr" = ${String(amountAr)}
          WHERE id = ${params.id}`
    )
    await recomputeAssetValue(assetId)
    revalidatePath('/statistika')
    return { id: params.id }
  }
  if (params.payFromCash && receiptId) {
    throw new Error('Račun se ne odšteva iz blagajne. Gotovino vklopi samo pri ročnem strošku.')
  }
  const wantCash = Boolean(params.payFromCash) && !receiptId
  const purpose = `${assetName}: ${description}`
  const { addCashExpense, updateCashExpense, deleteCashExpense } = await import('./banka')

  async function syncLinkedCash(linkedId: string | null): Promise<string | null> {
    if (wantCash) {
      if (linkedId) {
        const exists = await db.execute(
          sql`SELECT id FROM bank_cash_expenses WHERE id = ${linkedId} LIMIT 1`
        )
        if (exists.rows.length > 0) {
          await updateCashExpense(linkedId, { date, purpose, amount: amountAr })
          return linkedId
        }
      }
      const created = await addCashExpense({
        company: 'tourism',
        date,
        purpose,
        amount: amountAr,
      })
      return (created as { id?: string } | undefined)?.id ?? null
    }
    if (linkedId) await deleteCashExpense(linkedId)
    return null
  }

  if (nabavaPurchaseId) {
    const purchase = await db.execute(
      sql`SELECT "cashExpenseId", "payMethod", company FROM nabava_purchases WHERE id = ${nabavaPurchaseId} LIMIT 1`
    )
    const p = purchase.rows[0]
    if (p?.payMethod === 'orange') {
      throw new Error('Ta strošek je knjižen prek nabave z Orange Money. Popravi ga v nabavi.')
    }
    const purchaseCashId = (p?.cashExpenseId as string) || null
    const costCashBefore = cashExpenseId
    const linked = purchaseCashId || costCashBefore
    cashExpenseId = await syncLinkedCash(linked)
    if (costCashBefore && costCashBefore !== cashExpenseId) {
      await deleteCashExpense(costCashBefore)
    }
    if (p) {
      const company = cashExpenseId ? 'tourism' : ((p.company as string) || 'tourism')
      const payMethod = cashExpenseId ? 'cash' : ((p.payMethod as string) || 'cash')
      await db.execute(
        sql`UPDATE nabava_purchases
            SET name = ${description}, date = ${date}, "amountAr" = ${amountAr},
                "cashExpenseId" = ${cashExpenseId}, "payMethod" = ${payMethod}, company = ${company}
            WHERE id = ${nabavaPurchaseId}`
      )
    }
  } else if (!receiptId) {
    cashExpenseId = await syncLinkedCash(cashExpenseId)
  }

  await db.execute(
    sql`UPDATE fixed_asset_costs
        SET date = ${date}, description = ${description}, "amountAr" = ${String(amountAr)},
            "cashExpenseId" = ${cashExpenseId}
        WHERE id = ${params.id}`
  )
  await recomputeAssetValue(assetId)
  revalidatePath('/statistika')
  return { id: params.id }
}

// Strošek, vnesen prek Borutove nabave (gotovina): odliv blagajne je v lasti nakupa (nabava_purchases),
// tukaj samo zabeležimo strošek na pogodbi sredstva v izdelavi.
export async function upsertNabavaAssetCost(params: {
  nabavaPurchaseId: string
  assetId: string
  date: string
  description: string
  amountAr: number
}) {
  await ensureAssetSchema()
  const amountAr = Math.round((params.amountAr || 0) * 100) / 100
  const existing = await db.execute(
    sql`SELECT id, "assetId" FROM fixed_asset_costs WHERE "nabavaPurchaseId" = ${params.nabavaPurchaseId} LIMIT 1`
  )
  const prev = existing.rows[0]
  let id: string
  if (prev) {
    id = prev.id as string
    await db.execute(
      sql`UPDATE fixed_asset_costs SET "assetId" = ${params.assetId}, date = ${params.date},
            description = ${params.description.trim() || 'nabava'}, "amountAr" = ${String(amountAr)}
          WHERE id = ${id}`
    )
    if ((prev.assetId as string) !== params.assetId) await recomputeAssetValue(prev.assetId as string)
  } else {
    id = `fac-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    await db.execute(
      sql`INSERT INTO fixed_asset_costs (id, "assetId", date, description, "amountAr", "nabavaPurchaseId")
          VALUES (${id}, ${params.assetId}, ${params.date}, ${params.description.trim() || 'nabava'}, ${String(amountAr)}, ${params.nabavaPurchaseId})`
    )
  }
  await recomputeAssetValue(params.assetId)
  revalidatePath('/statistika')
  return { id }
}

// Plačilo Dilipu za čoln, označeno kot strošek pogodbe. Odliv je v lasti supplier_payments
// (ena vknjižba). Tukaj je natanko ena vrstica na plačilo — popravek jo zamenja, ne podvoji.
export async function upsertSupplierAssetCost(params: {
  supplierPaymentId: string
  assetId: string
  date: string
  description: string
  amountAr: number
}) {
  await ensureAssetSchema()
  const amountAr = Math.round(params.amountAr || 0)
  if (!params.supplierPaymentId || !params.assetId) throw new Error('Izberi pogodbo (sredstvo v izdelavi).')
  const asset = await db.execute(sql`SELECT id, status FROM fixed_assets WHERE id = ${params.assetId} LIMIT 1`)
  const assetRow = asset.rows[0]
  if (!assetRow || ((assetRow.status as string) || 'active') !== 'in_progress') {
    throw new Error('Izberi pogodbo (sredstvo v izdelavi).')
  }
  const existing = await db.execute(
    sql`SELECT id, "assetId" FROM fixed_asset_costs WHERE "supplierPaymentId" = ${params.supplierPaymentId} LIMIT 1`
  )
  const prev = existing.rows[0]
  if (prev) {
    await db.execute(
      sql`UPDATE fixed_asset_costs SET "assetId" = ${params.assetId}, date = ${params.date},
            description = ${params.description.trim() || 'Dilip (čoln Nero)'}, "amountAr" = ${String(amountAr)}
          WHERE id = ${prev.id as string}`
    )
    if ((prev.assetId as string) !== params.assetId) await recomputeAssetValue(prev.assetId as string)
  } else {
    const id = `fac-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    await db.execute(
      sql`INSERT INTO fixed_asset_costs (id, "assetId", date, description, "amountAr", "supplierPaymentId")
          VALUES (${id}, ${params.assetId}, ${params.date}, ${params.description.trim() || 'Dilip (čoln Nero)'}, ${String(amountAr)}, ${params.supplierPaymentId})`
    )
  }
  await recomputeAssetValue(params.assetId)
  revalidatePath('/statistika')
}

export async function removeSupplierAssetCost(supplierPaymentId: string) {
  await ensureAssetSchema()
  if (!supplierPaymentId) return
  const row = await db.execute(
    sql`SELECT "assetId" FROM fixed_asset_costs WHERE "supplierPaymentId" = ${supplierPaymentId}`
  )
  await db.execute(sql`DELETE FROM fixed_asset_costs WHERE "supplierPaymentId" = ${supplierPaymentId}`)
  for (const r of row.rows) await recomputeAssetValue(r.assetId as string)
}

export async function removeNabavaAssetCost(nabavaPurchaseId: string) {
  await ensureAssetSchema()
  const row = await db.execute(
    sql`SELECT "assetId" FROM fixed_asset_costs WHERE "nabavaPurchaseId" = ${nabavaPurchaseId}`
  )
  await db.execute(sql`DELETE FROM fixed_asset_costs WHERE "nabavaPurchaseId" = ${nabavaPurchaseId}`)
  for (const r of row.rows) await recomputeAssetValue(r.assetId as string)
}

export async function deleteAssetCost(id: string) {
  await ensureAssetSchema()
  const row = await db.execute(sql`SELECT "assetId", "cashExpenseId", "nabavaPurchaseId", "supplierPaymentId" FROM fixed_asset_costs WHERE id = ${id}`)
  const r = row.rows[0]
  if (!r) return
  if (r.supplierPaymentId) {
    const { clearDilipBoatCostMark } = await import('./supplier-payment')
    await clearDilipBoatCostMark(r.supplierPaymentId as string)
    revalidatePath('/statistika')
    return
  }
  if (r.nabavaPurchaseId) {
    // Izbris na pogodbi izbriše tudi nakup v nabavi (in njegov odliv iz blagajne).
    const { deleteNabavaPurchase } = await import('./nabava')
    await deleteNabavaPurchase(r.nabavaPurchaseId as string)
    revalidatePath('/statistika')
    return
  }
  if (r.cashExpenseId) {
    const { deleteCashExpense } = await import('./banka')
    await deleteCashExpense(r.cashExpenseId as string)
  }
  await db.execute(sql`DELETE FROM fixed_asset_costs WHERE id = ${id}`)
  await recomputeAssetValue(r.assetId as string)
  revalidatePath('/statistika')
}

export async function activateAsset(id: string, activationDate: string, annualRatePct: number) {
  await ensureAssetSchema()
  const rate = Number(annualRatePct) || 0
  if (!activationDate || rate <= 0) throw new Error('Datum aktivacije in stopnja sta obvezna.')
  await recomputeAssetValue(id)
  await db.execute(
    sql`UPDATE fixed_assets SET status = 'active', "purchaseDate" = ${activationDate},
          "activatedAt" = ${activationDate}, "annualRatePct" = ${String(rate)}
        WHERE id = ${id}`
  )
  revalidatePath('/statistika')
}

// Računi (stroski arhiv), dodani k sredstvom v izdelavi — za značko na računu.
export async function getAssetCostReceiptLinks(): Promise<{ receiptId: string; assetName: string; status: string }[]> {
  await ensureAssetSchema()
  const result = await db.execute(
    sql`SELECT c."receiptId", a.name, a.status FROM fixed_asset_costs c
        JOIN fixed_assets a ON a.id = c."assetId" WHERE c."receiptId" IS NOT NULL`
  )
  return result.rows.map((r) => ({
    receiptId: r.receiptId as string,
    assetName: r.name as string,
    status: (r.status as string) || 'active',
  }))
}

export async function addFixedAsset(params: {
  name: string
  purchaseDate: string
  amountAr: number
  annualRatePct: number
  receiptId?: string | null
}) {
  const amountAr = Math.round((params.amountAr || 0) * 100) / 100
  const annualRatePct = Number(params.annualRatePct) || 0
  if (!params.name.trim() || !params.purchaseDate || amountAr <= 0 || annualRatePct <= 0) {
  throw new Error('Neveljavni podatki osnovnega sredstva (naziv, datum, znesek in stopnja so obvezni).')
  }
  const rate = await getExchangeRate()
  const amountEur = Math.round((amountAr / rate) * 100) / 100
  const id = `fa-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const receiptId = params.receiptId?.trim() || null
  await db.execute(
    sql`INSERT INTO fixed_assets (id, name, "purchaseDate", "amountAr", "amountEur", "annualRatePct", "receiptId")
        VALUES (${id}, ${params.name.trim()}, ${params.purchaseDate}, ${String(amountAr)}, ${String(amountEur)}, ${String(annualRatePct)}, ${receiptId})`
  )
  revalidatePath('/statistika')
  return { id, amountEur }
}

// ID-ji računov (stroski arhiv), ki so že knjiženi kot osnovno sredstvo — za značko v seznamu.
export async function getFixedAssetReceiptIds(): Promise<string[]> {
  const result = await db.execute(
    sql`SELECT DISTINCT "receiptId" FROM fixed_assets WHERE "receiptId" IS NOT NULL`
  )
  return result.rows.map((r) => r.receiptId as string).filter(Boolean)
}

export async function updateFixedAsset(
  id: string,
  params: { name: string; purchaseDate: string; amountAr: number; annualRatePct: number }
) {
  const amountAr = Math.round((params.amountAr || 0) * 100) / 100
  const annualRatePct = Number(params.annualRatePct) || 0
  if (!params.name.trim() || !params.purchaseDate || amountAr <= 0 || annualRatePct <= 0) return
  const rate = await getExchangeRate()
  const amountEur = Math.round((amountAr / rate) * 100) / 100
  await db.execute(
    sql`UPDATE fixed_assets
        SET name = ${params.name.trim()}, "purchaseDate" = ${params.purchaseDate},
            "amountAr" = ${String(amountAr)}, "amountEur" = ${String(amountEur)}, "annualRatePct" = ${String(annualRatePct)}
        WHERE id = ${id}`
  )
  revalidatePath('/statistika')
}

export async function deleteFixedAsset(id: string) {
  await ensureAssetSchema()
  const costs = await db.execute(
    sql`SELECT "cashExpenseId" FROM fixed_asset_costs WHERE "assetId" = ${id} AND "cashExpenseId" IS NOT NULL`
  )
  if (costs.rows.length > 0) {
    const { deleteCashExpense } = await import('./banka')
    for (const c of costs.rows) await deleteCashExpense(c.cashExpenseId as string)
  }
  await db.execute(sql`DELETE FROM fixed_asset_costs WHERE "assetId" = ${id}`)
  await db.execute(sql`DELETE FROM fixed_assets WHERE id = ${id}`)
  revalidatePath('/statistika')
}

// Mesečna amortizacija za dani mesec (v EUR), z razčlembo po sredstvih.
export async function getFixedAssetsDepreciation(year: number, month: number) {
  const assets = (await getFixedAssets()).filter((a) => a.status !== 'in_progress')
  const monthIndex = year * 12 + (month - 1)
  const items = assets.map((a) => {
    const life = assetLifeMonths(a.annualRatePct)
    const d = new Date(a.purchaseDate)
    const startIndex = d.getFullYear() * 12 + d.getMonth()
    const elapsed = monthIndex - startIndex // 0 = mesec nabave
    const active = life > 0 && elapsed >= 0 && elapsed < life
    let monthlyEur = 0
    if (active) {
      const base = Math.round((a.amountEur / life) * 100) / 100
      if (elapsed === life - 1) {
        // zadnji mesec: preostanek, da skupna amortizacija natanko ustreza nabavni vrednosti
        monthlyEur = Math.round((a.amountEur - base * (life - 1)) * 100) / 100
      } else {
        monthlyEur = base
      }
    }
    return {
      id: a.id,
      name: a.name,
      purchaseDate: a.purchaseDate,
      amountAr: a.amountAr,
      amountEur: a.amountEur,
      annualRatePct: a.annualRatePct,
      lifeMonths: life,
      elapsed,
      active,
      monthlyEur,
    }
  })
  const total = Math.round(items.reduce((s, i) => s + i.monthlyEur, 0) * 100) / 100
  return { total, items }
}

export type FixedAssetRegisterRow = {
  id: string
  inventoryNo: string
  name: string
  status: 'active' | 'in_progress'
  acquiredDate: string
  activatedAt: string | null
  contractor: string
  amountAr: number
  amountEur: number
  annualRatePct: number
  lifeMonths: number
  monthsDepreciated: number
  accumulatedEur: number
  netBookEur: number
  endDate: string | null
  costCount: number
  fullyDepreciated: boolean
}

// Register osnovnih sredstev: vsa sredstva (aktivna + v izdelavi) s stanjem na konec izbranega meseca.
export async function getFixedAssetRegister(year: number, month: number): Promise<FixedAssetRegisterRow[]> {
  await ensureAssetSchema()
  const assets = await db.execute(sql`SELECT * FROM fixed_assets ORDER BY "createdAt" ASC, "purchaseDate" ASC`)
  const costs = await db.execute(sql`SELECT "assetId", COUNT(*)::int AS n FROM fixed_asset_costs GROUP BY "assetId"`)
  const costCount: Record<string, number> = {}
  for (const c of costs.rows) costCount[c.assetId as string] = Number(c.n) || 0
  const asOfIndex = year * 12 + (month - 1)

  return assets.rows.map((r, idx) => {
    const status = ((r.status as string) || 'active') as 'active' | 'in_progress'
    const amountEur = Number(r.amountEur) || 0
    const annualRatePct = Number(r.annualRatePct) || 0
    const life = annualRatePct > 0 ? assetLifeMonths(annualRatePct) : 0
    const purchaseDate = String(r.purchaseDate || '').slice(0, 10)
    let monthsDepreciated = 0
    let accumulatedEur = 0
    let endDate: string | null = null
    if (status === 'active' && life > 0 && purchaseDate) {
      const d = new Date(purchaseDate)
      const startIndex = d.getFullYear() * 12 + d.getMonth()
      monthsDepreciated = Math.max(0, Math.min(life, asOfIndex - startIndex + 1))
      const base = Math.round((amountEur / life) * 100) / 100
      accumulatedEur = monthsDepreciated >= life ? amountEur : Math.round(base * monthsDepreciated * 100) / 100
      const end = new Date(d.getFullYear(), d.getMonth() + life - 1, 1)
      endDate = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}`
    }
    return {
      id: r.id as string,
      inventoryNo: `OS-${String(idx + 1).padStart(3, '0')}`,
      name: r.name as string,
      status,
      acquiredDate: purchaseDate,
      activatedAt: (r.activatedAt as string) || null,
      contractor: (r.contractor as string) || '',
      amountAr: Number(r.amountAr) || 0,
      amountEur,
      annualRatePct,
      lifeMonths: life,
      monthsDepreciated,
      accumulatedEur,
      netBookEur: Math.round((amountEur - accumulatedEur) * 100) / 100,
      endDate,
      costCount: costCount[r.id as string] || 0,
      fullyDepreciated: status === 'active' && life > 0 && monthsDepreciated >= life,
    }
  })
}

// Add a marketing expense (date determines the booking month)
export async function addMarketingExpense(date: string, description: string, amount: number, category: string = 'marketing', paymentMethod?: string) {
  await ensureKompenzacijaColumns()
  const d = new Date(date)
  const year = d.getFullYear()
  const month = d.getMonth() + 1
  const id = `mkt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  await db.insert(marketingExpenses).values({
    id, category, year, month, date, description, amount: String(amount), paymentMethod: paymentMethod || null,
  })
  revalidatePath('/statistika')
}

// Update a marketing expense (date determines the booking month)
export async function updateMarketingExpense(id: string, date: string, description: string, amount: number, paymentMethod?: string) {
  await ensureKompenzacijaColumns()
  const d = new Date(date)
  const year = d.getFullYear()
  const month = d.getMonth() + 1
  await db.update(marketingExpenses)
    .set({ year, month, date, description, amount: String(amount), paymentMethod: paymentMethod || null })
    .where(eq(marketingExpenses.id, id))
  revalidatePath('/statistika')
}

// Delete a marketing expense. A reklama contra line linked to a Kompenzacija
// payment removes that payment too. The pair never moves cash, the bank, or Orange Money.
export async function deleteMarketingExpense(id: string) {
  await ensureKompenzacijaColumns()
  const [row] = await db
    .select({ paymentId: marketingExpenses.compensationPaymentId })
    .from(marketingExpenses)
    .where(eq(marketingExpenses.id, id))
  const paymentId = row?.paymentId || null
  if (paymentId) {
    await db.execute(sql`UPDATE payments SET "contraExpenseId" = NULL WHERE id = ${paymentId}`)
  }
  await db.delete(marketingExpenses).where(eq(marketingExpenses.id, id))
  if (paymentId) {
    const { deletePayment } = await import('./komba')
    await deletePayment(paymentId)
  }
  revalidatePath('/statistika')
  revalidatePath('/')
}

// Get staff salaries for a month
export async function getStaffSalaries(year: number, month: number) {
  return await db.select().from(staffSalaries)
    .where(and(
      eq(staffSalaries.year, year),
      eq(staffSalaries.month, month)
    ))
}

// Add or update staff salary
export async function upsertStaffSalary(data: {
  id?: string
  staffType: string
  staffName: string
  year: number
  month: number
  salary: number
  allocateTo: string
}) {
  const id = data.id || `salary-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  
  if (data.id) {
    await db.update(staffSalaries)
      .set({
        staffType: data.staffType,
        staffName: data.staffName,
        salary: String(data.salary),
        allocateTo: data.allocateTo
      })
      .where(eq(staffSalaries.id, data.id))
  } else {
    await db.insert(staffSalaries).values({
      id,
      staffType: data.staffType,
      staffName: data.staffName,
      year: data.year,
      month: data.month,
      salary: String(data.salary),
      allocateTo: data.allocateTo
    })
  }
  return id
}

// Delete staff salary
export async function deleteStaffSalary(id: string) {
  await db.delete(staffSalaries).where(eq(staffSalaries.id, id))
}

// Get statistics for a month
export async function getMonthlyStatistics(year: number, month: number) {
  await db.execute(sql`ALTER TABLE transfers ADD COLUMN IF NOT EXISTS "skipBoatPay" boolean NOT NULL DEFAULT false`)
  await ensureKompenzacijaColumns()
  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 0) // Last day of month
  
  const startStr = startDate.toISOString().split('T')[0]
  const endStr = endDate.toISOString().split('T')[0]
  
  const rate = await getExchangeRate()
  const costs = await getCostSettings()
  
  // Get staff members active this month
  const allStaff = await getAllStaffMembers()
  const activeStaff = allStaff.filter(s => s.activeMonths?.includes(month))
  
  // Get archived reservations that checked out in this month
  const archivedReservations = await db.select().from(reservations)
    .where(and(
      isNotNull(reservations.checkedOutAt),
      sql`DATE(${reservations.checkedOutAt}) >= ${startStr}`,
      sql`DATE(${reservations.checkedOutAt}) <= ${endStr}`
    ))
  
  const reservationIds = archivedReservations.map(r => r.id)
  
  // Get ALL order items with eventDate in this month (regardless of checkout date)
  const monthOrderItems = await db.select().from(orderItems)
    .where(sql`${orderItems.eventDate} >= ${startDate.toISOString().split('T')[0]} AND ${orderItems.eventDate} <= ${endDate.toISOString().split('T')[0]}`)
  
  // Get ALL delivery notes with date in this month (regardless of checkout date)
  const monthDeliveryNotes = await db.select().from(deliveryNotes)
    .where(sql`${deliveryNotes.date} >= ${startDate.toISOString().split('T')[0]} AND ${deliveryNotes.date} <= ${endDate.toISOString().split('T')[0]}`)
  
  const deliveryNoteIds = monthDeliveryNotes.map(dn => dn.id)
  
  const allDeliveryItems = deliveryNoteIds.length > 0 
    ? await db.select().from(deliveryNoteItems)
        .where(sql`${deliveryNoteItems.deliveryNoteId} IN (${sql.join(deliveryNoteIds.map(id => sql`${id}`), sql`, `)})`)
    : []
  
  // Get all transfers for these reservations (guard against empty list -> invalid SQL `IN ()`)
  const allTransfers = reservationIds.length > 0
    ? await db.select().from(transfers)
        .where(sql`${transfers.reservationId} IN (${sql.join(reservationIds.map(id => sql`${id}`), sql`, `)})`)
    : []
  
  // Get all excursion bookings with a date in this month (consistent with revenue,
  // which counts order_items by eventDate regardless of guest checkout).
  // Fallback to reservation-based lookup for older bookings that have no date set.
  const dateBasedExcursionBookings = await db.select().from(excursionBookings)
    .where(sql`${excursionBookings.date} >= ${startStr} AND ${excursionBookings.date} <= ${endStr}`)

  const reservationBasedExcursionBookings = reservationIds.length > 0
    ? await db.select().from(excursionBookings)
        .where(sql`${excursionBookings.date} IS NULL AND ${excursionBookings.reservationId} IN (${sql.join(reservationIds.map(id => sql`${id}`), sql`, `)})`)
    : []

  const allExcursionBookings = [...dateBasedExcursionBookings, ...reservationBasedExcursionBookings]

  // Per-product purchase cost (Ar). Used for exact profit on items like chocolate (bought 15000, sold 25000).
  const allProducts = await db.select().from(products)
  const productCostArById = new Map<string, number>()
  allProducts.forEach(p => { if (p.costAr != null) productCostArById.set(p.id, Number(p.costAr)) })
  // Products in the "ostalo" cost category, keyed by name — used to recognise shop items sold via
  // reception (order_items category "Trgovina"/"Razno"), which store no productId but match by name.
  const ostaloProductByName = new Map<string, { costAr: number; priceAr: number }>()
  allProducts.forEach(p => { if (p.costCategory === 'ostalo') ostaloProductByName.set(p.name, { costAr: p.costAr != null ? Number(p.costAr) : 0, priceAr: Number(p.priceAr) || 0 }) })
  // Meal-plan price per person per night (Ar) by plan code — the board portion is prepaid inside
  // reservation.totalAmount, so we move it from accommodation to kitchen revenue.
  const mealPlanPriceArByPlan: Record<string, number> = {}
  allProducts.forEach(p => {
    if (p.id === 'meal-breakfast') mealPlanPriceArByPlan['B'] = Number(p.priceAr) || 0
    if (p.id === 'meal-hb') mealPlanPriceArByPlan['HB'] = Number(p.priceAr) || 0
    if (p.id === 'meal-fb') mealPlanPriceArByPlan['FB'] = Number(p.priceAr) || 0
  })
  const mealPlanValueEur = (
    mealPlan: string | null | undefined,
    // Only a prepaid pension ("Plačano") is food money already inside the stay rate.
    // "Za plačilo" is invoiced as the meals the bar types, so carving the same
    // 50/80 € out of the room would count that food twice against the invoice.
    paymentStatus: string | null | undefined,
    pax: number,
    nights: number,
    capEur: number,
    // How many of the party the board covers. NULL/undefined means everyone, which
    // is how every booking read before the field existed. Set it and only that many
    // are billed for board — the rest pay per meal through the bar, so counting the
    // whole party here would book the same food twice.
    mealPlanPax?: number | null,
  ) => {
    if (!isMealPlanPaid(paymentStatus)) return 0
    const perPaxNightAr = mealPlanPriceArByPlan[(mealPlan as string) || ''] || 0
    if (perPaxNightAr <= 0 || nights <= 0) return 0
    const covered = boardPax(pax > 0 ? pax : 1, mealPlanPax)
    if (covered <= 0) return 0
    const eur = (perPaxNightAr / rate) * covered * nights
    // Never exceed the accommodation amount so accommodation revenue cannot go negative.
    return Math.min(eur, capEur)
  }
  
  // Get all excursion pricing (supplier costs)
  const allExcursionPricing = await db.select().from(excursionPricing)
  
  // Get all excursions (for base costs - guide, entrance, lunch)
  const allExcursions = await db.select().from(excursions)
  
  // Get supplier pricing for transfers (boat costs per route)
  const allSupplierPricing = await db.select().from(supplierPricing)
  // Get selling pricing (guest prices per pax) ��� used to split transfer revenue between Dilip (boat) and Herman (car)
  const allSellingPricing = await db.select().from(sellingPricing)
  
  // Get routes for mapping route names to IDs
  const allRoutes = await db.select().from(routes)
  
  // Accommodation revenue - calculate based on nights actually spent in this month
  // A reservation counts if ANY of its nights fall within this month, REGARDLESS of
  // checkout status (consistent with excursions/bar: revenue counts by actual date,
  // not by guest checkout). Includes guests who are still staying.
  const allReservationsForNights = await db.select().from(reservations)
  const resById = new Map(allReservationsForNights.map(r => [r.id, r]))
  const dnReservationId = new Map(monthDeliveryNotes.map(dn => [dn.id, dn.reservationId]))

  // A bar meal the invoice does not charge, because a paid pension covers it,
  // adds nothing to kitchen revenue. The stored euro amount on the note stays
  // as the guest was charged (or not) — this is the kalkulacije view only.
  const pensionCoversDeliveryItem = (i: {
    deliveryNoteId: string
    productId?: string | null
    productName?: string | null
    coveredByMealPlan?: boolean | null
  }) => {
    if (i.coveredByMealPlan) return true
    const resId = dnReservationId.get(i.deliveryNoteId)
    const r = resId ? resById.get(resId) : undefined
    if (!r) return false
    return paidPensionCoversMeal({
      mealPlan: r.mealPlan,
      mealPlanPaymentStatus: r.mealPlanPaymentStatus,
      productId: i.productId,
      productName: i.productName,
    })
  }
  const deliveryFoodRevenueAr = (i: {
    deliveryNoteId: string
    totalAr?: number | null
    productId?: string | null
    productName?: string | null
    coveredByMealPlan?: boolean | null
    costCategory?: string | null
  }) => {
    if ((i.costCategory || '') !== 'prehrana') return Number(i.totalAr || 0)
    if (pensionCoversDeliveryItem(i)) return 0
    return Number(i.totalAr || 0)
  }
  // Check-in also writes one Prehrana lump for the whole prepaid stay, dated on
  // arrival. The nightly split above is the same money, placed in the month of
  // each night, so the lump must not be added again. A meal the invoice then
  // marks included is not extra food revenue either.
  const prehranaOrderRevenueAr = (o: {
    reservationId?: string | null
    name?: string | null
    priceAr?: number | null
  }) => {
    const price = Number(o.priceAr || 0)
    if (!price) return 0
    const r = o.reservationId ? resById.get(o.reservationId) : undefined
    if (!r) return price
    if (isMealPlanPaid(r.mealPlanPaymentStatus) && isCheckInPensionLump(o.name)) return 0
    if (paidPensionCoversMeal({
      mealPlan: r.mealPlan,
      mealPlanPaymentStatus: r.mealPlanPaymentStatus,
      productName: o.name,
    })) return 0
    return price
  }
  
  // Filter to reservations that have nights in this month
  const reservationsWithNightsInMonth = allReservationsForNights.filter(r => {
    if (!r.arrival || !r.departure) return false
    const arrival = new Date(r.arrival)
    const departure = new Date(r.departure)
    // Reservation overlaps with month if: arrival <= endDate AND departure > startDate
    return arrival <= endDate && departure > startDate
  })
  
  // Calculate accommodation revenue proportionally based on nights in this month.
  // A prepaid board is inside totalAmount, so that nightly amount moves to the kitchen
  // once. An unpaid board stays inside the room rate: the guest is invoiced for the
  // meals themselves, and those are the kitchen food.
  let accommodationRevenue = 0
  let totalNightsInMonth = 0
  let mealPlanPrepaidRevenue = 0
  
  for (const r of reservationsWithNightsInMonth) {
    const arrival = new Date(r.arrival!)
    const departure = new Date(r.departure!)
    const totalNights = Math.ceil((departure.getTime() - arrival.getTime()) / (1000 * 60 * 60 * 24))
    
    if (totalNights <= 0) continue
    
    // Calculate nights that fall within this month
    const effectiveStart = arrival < startDate ? startDate : arrival
    const effectiveEnd = departure > endDate ? new Date(endDate.getTime() + 24 * 60 * 60 * 1000) : departure
    const nightsInMonth = Math.ceil((effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24))
    
    if (nightsInMonth <= 0) continue
    
    // Proportional revenue for this month
    const pricePerNight = Number(r.totalAmount || 0) / totalNights
    const grossAccMonth = pricePerNight * nightsInMonth
    const mealMonth = mealPlanValueEur(r.mealPlan, r.mealPlanPaymentStatus, Number(r.pax || 1), nightsInMonth, grossAccMonth, r.mealPlanPax)
    accommodationRevenue += grossAccMonth - mealMonth
    mealPlanPrepaidRevenue += mealMonth
    totalNightsInMonth += nightsInMonth
  }
  
  // Agency/platform commissions - also proportional to nights in month
  let agencyCommissions = 0
  let optimaplusCommission = 0
  
  for (const r of reservationsWithNightsInMonth) {
    const arrival = new Date(r.arrival!)
    const departure = new Date(r.departure!)
    const totalNights = Math.ceil((departure.getTime() - arrival.getTime()) / (1000 * 60 * 60 * 24))
    
    if (totalNights <= 0) continue
    
    const effectiveStart = arrival < startDate ? startDate : arrival
    const effectiveEnd = departure > endDate ? new Date(endDate.getTime() + 24 * 60 * 60 * 1000) : departure
    const nightsInMonth = Math.ceil((effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24))
    
    if (nightsInMonth <= 0) continue
    
    const proportion = nightsInMonth / totalNights
    
    // Agency commission
    agencyCommissions += Number(r.agencyCommission || 0) * proportion
    
    // Optimaplus commission for Booking.com and Airbnb
    if (r.bookingSource === 'Booking.com' || r.bookingSource === 'Airbnb') {
      optimaplusCommission += (Number(r.totalAmount || 0) * 0.07) * proportion
    }
  }
  
  // Use reservationsWithNightsInMonth for commission grouping
  
  // Group commissions by source for reporting
  const commissionsBySource: Record<string, number> = {}
  archivedReservations.forEach(r => {
    const source = r.bookingSource || 'Other'
    const commission = Number(r.agencyCommission || 0)
    if (commission > 0) {
      commissionsBySource[source] = (commissionsBySource[source] || 0) + commission
    }
  })
  // Add Optimaplus to Booking.com and Airbnb
  const bookingOptima = archivedReservations
    .filter(r => r.bookingSource === 'Booking.com')
    .reduce((sum, r) => sum + (Number(r.totalAmount || 0) * 0.07), 0)
  const airbnbOptima = archivedReservations
    .filter(r => r.bookingSource === 'Airbnb')
    .reduce((sum, r) => sum + (Number(r.totalAmount || 0) * 0.07), 0)
  
  // Group agency commissions separately
  const commissionsByAgency: Record<string, number> = {}
  archivedReservations.forEach(r => {
    if (r.agencyName && Number(r.agencyCommission) > 0) {
      commissionsByAgency[r.agencyName] = (commissionsByAgency[r.agencyName] || 0) + Number(r.agencyCommission)
    }
  })
  
  // Total nights in this month (already calculated above)
  const totalNights = totalNightsInMonth
  
  // Transfers
  const transferRevenue = allTransfers.reduce((sum, t) => sum + Number(t.guestPrice || 0), 0)
  
  // Transfer costs - calculate from supplier_pricing based on boatId and route
  const transferCost = allTransfers.reduce((sum, t) => {
    if (!t.boatId || t.skipBoatPay) return sum
    
    // Find the route ID - route can be an ID or a name
    let routeId = t.route
    if (t.route && !t.route.startsWith('route-')) {
      // Try to find route by name
      const foundRoute = allRoutes.find(r => r.name === t.route)
      if (foundRoute) routeId = foundRoute.id
    }
    
    // For airport route, use the base route (nosy-be) for boat pricing
    const routeData = allRoutes.find(r => r.id === routeId)
    const pricingRouteId = routeData?.baseRouteId || routeId
    
    // Find supplier price for this boat + route combination
    const pricing = allSupplierPricing.find(sp => 
      sp.boatId === t.boatId && sp.routeId === pricingRouteId
    )
    
    return sum + (pricing?.priceAr || 0)
  }, 0) / rate

  // --- Split transfer profit by carrier: Dilip (boat) vs Herman (car to/from airport) ---
  // Herman revenue = his selling price from the price list (per person * pax). Dilip revenue = guestPrice - Herman.
  const hermanRevenue = allTransfers.reduce((sum, t) => {
    if (!t.hermanRouteId) return sum
    const sp = allSellingPricing.find(s => s.boatId === 'taxi-herman' && s.routeId === t.hermanRouteId)
    if (!sp) return sum
    const pax = Math.min(6, Math.max(1, Number(t.pax) || 1))
    const pricePerPerson = Number((sp as unknown as Record<string, string>)['pricePax' + pax] || 0)
    return sum + pricePerPerson * pax // total = price per person * number of guests
  }, 0)
  const dilipRevenue = transferRevenue - hermanRevenue
  // Herman cost = supplier price (taxi-herman) for the Herman route.
  const hermanCost = allTransfers.reduce((sum, t) => {
    if (!t.hermanRouteId) return sum
    const hp = allSupplierPricing.find(sp => sp.boatId === 'taxi-herman' && sp.routeId === t.hermanRouteId)
    return sum + (hp?.priceAr || 0)
  }, 0) / rate
  const dilipCost = transferCost // boat-only supplier cost (already computed above)
  const transferCostTotal = transferCost + hermanCost // total paid to both carriers
  
  // Excursions (Izlet)
  const excursionItems = monthOrderItems.filter(o => o.category === 'Izlet')
  // Fallback: some PAID excursions have priceAr=0 AND no refPriceAr (price was lost / never stored),
  // yet their cost is still counted from the linked excursion_booking → false negative profit.
  // Recover revenue from the matching booking (guestPrice + entrance + lunch), matched by reservation + excursion name.
  const bookingRevenueAr = (o: { reservationId?: string | null; name?: string | null }) => {
    if (!o.reservationId) return 0
    const b = allExcursionBookings.find(bk => {
      if (bk.reservationId !== o.reservationId) return false
      const exc = allExcursions.find(e => e.id === bk.excursionId)
      return !!exc?.name && (o.name || '').includes(exc.name)
    })
    if (!b) return 0
    const totalEur = Number(b.guestPrice || 0) + Number(b.entranceFee || 0) + Number(b.lunchPrice || 0)
    return Math.round(totalEur * rate)
  }
  // Revenue: paid-separately excursions store priceAr=0 with the real price in refPriceAr.
  // Use refPriceAr, then booking fallback, so prepaid excursion revenue is not lost. On House (isFree) = 0.
  const excItemRevenueAr = (o: { priceAr?: number | null; refPriceAr?: number | null; isFree?: boolean | null; reservationId?: string | null; name?: string | null }) =>
    o.isFree ? 0 : (o.priceAr && o.priceAr > 0 ? o.priceAr : (o.refPriceAr && o.refPriceAr > 0 ? o.refPriceAr : bookingRevenueAr(o)))
  const excursionRevenue = excursionItems.reduce((sum, o) => sum + excItemRevenueAr(o), 0) / rate
  
  // Excursion costs (boat rental + guide + entrance + lunch - supplier prices)
  // Calculate cost based on excursion_bookings + excursion_pricing + excursions base costs
  const excursionBoatCost = allExcursionBookings.reduce((sum, booking) => {
    if (!booking.boatId || !booking.excursionId) return sum
    const pricing = allExcursionPricing.find(p => 
      p.excursionId === booking.excursionId && p.boatId === booking.boatId
    )
    if (!pricing) return sum
    // priceAr is the supplier cost for the boat for this excursion
    return sum + (pricing.priceAr || 0)
  }, 0) / rate
  
  // Excursion base costs (guide, entrance, lunch) per pax
  const excursionBaseCost = allExcursionBookings.reduce((sum, booking) => {
    const exc = allExcursions.find(e => e.id === booking.excursionId)
    if (!exc) return sum
    const pax = booking.pax || 1
    const guideCost = exc.guidePriceAr || 0
    const entranceCost = (exc.entranceFeeAr || 0) * pax
    const lunchCost = booking.lunchProviderId ? (exc.lunchPriceAr || 0) * pax : 0
    return sum + guideCost + entranceCost + lunchCost
  }, 0) / rate
  
  // Manual supplier cost for external chartered excursions (e.g. Catameran) stored on the order_item (no excursion_booking)
  const excursionManualCost = excursionItems.reduce((sum, o) => sum + ((o as { costAr?: number | null }).costAr || 0), 0) / rate

  const excursionCost = excursionBoatCost + excursionBaseCost + excursionManualCost
  
  // Predplačilo: the prepaid pension once (nightly, in the month of each night),
  // plus Prehrana order items that are real invoiced meals. The check-in lump for
  // the same prepaid nights is left out.
  const mealPlanItems = monthOrderItems.filter(o => o.category === 'Prehrana')
  const mealPlanRevenue = mealPlanItems.reduce((sum, o) => sum + prehranaOrderRevenueAr(o), 0) / rate + mealPlanPrepaidRevenue
  
  // Meal plan cost (use same percentage as bar_prehrana for food cost)
  // Will be calculated after costMap is created
  
  // Bar items from delivery_note_items grouped by costCategory
  const pijacaDeliveryItems = allDeliveryItems.filter(i => (i as { costCategory?: string }).costCategory === 'pijaca')
  const pijacaDeliveryRevenue = pijacaDeliveryItems.reduce((sum, i) => sum + (i.totalAr || 0), 0) / rate
  
  // Pijača from order_items (added via recepcija or at check-in)
  const pijacaCategories = ['Carbonated Drinks', 'Cocktails', 'Cold Beverages', 'Hot Beverages', 'Spirits', 'Wine', 'Beer', 'Pijaca', 'Pijača']
  const pijacaOrderItems = monthOrderItems.filter(o => pijacaCategories.includes(o.category || ''))
  const pijacaOrderRevenue = pijacaOrderItems.reduce((sum, o) => sum + (o.priceAr || 0), 0) / rate
  
  const pijacaRevenue = pijacaDeliveryRevenue + pijacaOrderRevenue
  
  // Prehrana from delivery_note_items (bar daily orders).
  // Meals a paid pension already covers contribute quantity only — revenue 0 —
  // because the invoice does not charge them. Lunch on half board stays.
  const barPrehranaDeliveryItems = allDeliveryItems.filter(i => (i as { costCategory?: string }).costCategory === 'prehrana')
  const barPrehranaDeliveryRevenue = barPrehranaDeliveryItems.reduce((sum, i) => sum + deliveryFoodRevenueAr(i), 0) / rate
  
  // Note: Prehrana from order_items is counted separately as mealPlanRevenue (prepaid meal plans)
  const barPrehranaRevenue = barPrehranaDeliveryRevenue
  
  // Wellness from delivery_note_items
  const wellnessDeliveryItems = allDeliveryItems.filter(i => (i as { costCategory?: string }).costCategory === 'wellness')
  const wellnessDeliveryRevenue = wellnessDeliveryItems.reduce((sum, i) => sum + (i.totalAr || 0), 0) / rate
  const wellnessDeliveryCount = wellnessDeliveryItems.reduce((sum, i) => sum + (i.quantity || 0), 0)
  
  // Wellness/Masaza from order_items (added via recepcija)
  const wellnessOrderItems = monthOrderItems.filter(o => o.category === 'Masaza' || o.category === 'Masaža' || o.category === 'Wellness')
  const wellnessOrderRevenue = wellnessOrderItems.reduce((sum, o) => sum + (o.priceAr || 0), 0) / rate
  const wellnessOrderCount = wellnessOrderItems.length
  
  const wellnessRevenue = wellnessDeliveryRevenue + wellnessOrderRevenue
  const wellnessCount = wellnessDeliveryCount + wellnessOrderCount
  // Od 7. 10. 2026 je strošek maserke prava gotovina v nabavi. Teh masaž ne štej
  // še enkrat po oceni 13 € — ne na računu recepcije in ne na dobavnici bara.
  // Prihodek od gosta ostane cel.
  const autoMassageIds = new Set(await getAutoMassageOrderItemIds())
  const formulaWellnessOrders = wellnessOrderItems.filter(o => !autoMassageIds.has(o.id))
  const formulaWellnessDelivery = wellnessDeliveryItems.filter(i => !autoMassageIds.has(i.id))
  
  const ostaloItems = allDeliveryItems.filter(i => (i as { costCategory?: string }).costCategory === 'ostalo')
  const ostaloDeliveryRevenue = ostaloItems.reduce((sum, i) => sum + (i.totalAr || 0), 0) / rate
  // Shop items sold via reception (order_items) that match a known "ostalo" product by name (e.g. chocolate).
  // Non-product entries like "Staff gratuity" do not match and are intentionally excluded.
  const orderItemRevenueAr = (o: { priceAr?: number | null; refPriceAr?: number | null }) =>
    (o.priceAr && o.priceAr > 0) ? o.priceAr : (o.refPriceAr || 0)
  const ostaloOrderItems = monthOrderItems.filter(o => !!o.name && ostaloProductByName.has(o.name) && !o.isFree)
  const ostaloOrderRevenue = ostaloOrderItems.reduce((sum, o) => sum + orderItemRevenueAr(o), 0) / rate
  const ostaloRevenue = ostaloDeliveryRevenue + ostaloOrderRevenue
  
  const barTotal = pijacaRevenue + barPrehranaRevenue
  
  const totalRevenue = accommodationRevenue + transferRevenue + excursionRevenue + 
    mealPlanRevenue + wellnessRevenue + ostaloRevenue + barTotal
  
  // Calculate costs
  const costMap = costs.reduce((map, c) => {
    map[c.category] = { type: c.costType, value: Number(c.value) }
    return map
  }, {} as Record<string, { type: string, value: number }>)
  
  const barPijacaCost = costMap.bar_pijaca 
    ? (costMap.bar_pijaca.type === 'percentage' ? pijacaRevenue * costMap.bar_pijaca.value / 100 : costMap.bar_pijaca.value)
    : 0
  
  const barPrehranaCost = costMap.bar_prehrana
    ? (costMap.bar_prehrana.type === 'percentage' ? barPrehranaRevenue * costMap.bar_prehrana.value / 100 : costMap.bar_prehrana.value)
    : 0
  
  const wellnessCountForCost = formulaWellnessDelivery.reduce((sum, i) => sum + (i.quantity || 0), 0) + formulaWellnessOrders.length
  const wellnessRevenueForCost = formulaWellnessDelivery.reduce((sum, i) => sum + (i.totalAr || 0), 0) / rate + formulaWellnessOrders.reduce((sum, o) => sum + (o.priceAr || 0), 0) / rate
  const wellnessCost = costMap.wellness
    ? (costMap.wellness.type === 'fixed' ? wellnessCountForCost * costMap.wellness.value : wellnessRevenueForCost * costMap.wellness.value / 100)
    : 0
  
  // Ostalo cost: use exact per-product purchase cost (costAr) where the product defines one
  // (e.g. chocolate 15000/25000); items without a defined cost (e.g. laundry) fall back to the category %.
  let ostaloProductCostAr = 0
  let ostaloFallbackRevenueAr = 0
  ostaloItems.forEach(i => {
    const c = i.productId ? productCostArById.get(i.productId) : undefined
    if (c != null && !i.isFree && !(i as { coveredByMealPlan?: boolean }).coveredByMealPlan) {
      ostaloProductCostAr += c * (i.quantity || 0)
    } else {
      ostaloFallbackRevenueAr += (i.totalAr || 0)
    }
  })
  // Reception shop items (order_items): cost is proportional to revenue via the product's cost/price ratio
  // (works regardless of quantity), or the manual costAr on the item, else falls back to the category %.
  ostaloOrderItems.forEach(o => {
    const revAr = orderItemRevenueAr(o)
    const p = ostaloProductByName.get(o.name!)!
    if ((o as { costAr?: number | null }).costAr != null) {
      ostaloProductCostAr += Number((o as { costAr?: number | null }).costAr)
    } else if (p.priceAr > 0 && p.costAr > 0) {
      ostaloProductCostAr += revAr * p.costAr / p.priceAr
    } else {
      ostaloFallbackRevenueAr += revAr
    }
  })
  const ostaloFallbackRevenue = ostaloFallbackRevenueAr / rate
  const ostaloFallbackCost = costMap.ostalo
    ? (costMap.ostalo.type === 'percentage'
        ? ostaloFallbackRevenue * costMap.ostalo.value / 100
        : (ostaloFallbackRevenueAr > 0 ? costMap.ostalo.value : 0))
    : 0
  const ostaloCost = ostaloProductCostAr / rate + ostaloFallbackCost
  
  // Meal plan cost (use same percentage as bar_prehrana for food cost)
  const mealPlanCost = costMap.bar_prehrana
    ? (costMap.bar_prehrana.type === 'percentage' ? mealPlanRevenue * costMap.bar_prehrana.value / 100 : costMap.bar_prehrana.value)
    : 0
  
  // Calculate salary costs - all full monthly salaries (not prorated)
  // Salaries are stored in Ar, convert to EUR using exchange rate
  
  // Operativa salaries (vrtnar, sobarica, barman, kuhinja) - celotna mesečna plača
  // Accommodation salaries (vrtnar, sobarica) - celotna mesečna plača
  const monthSalary = (s: { monthlySalary: string; salaryChanges?: { from: string; amount: number }[]; endDate?: string | null }) =>
    salaryForMonth(Number(s.monthlySalary), s.salaryChanges, year, month, s.endDate)
  const accommodationStaff = activeStaff.filter(s => s.allocateTo === 'accommodation')
  const accommodationSalaryCost = accommodationStaff.reduce((sum, s) => sum + monthSalary(s), 0) / rate
  
  // Bar salaries - celotna mesečna plača, ki velja ta mesec
  const barStaff = activeStaff.filter(s => s.allocateTo === 'bar')
  const barSalaryCost = barStaff.reduce((sum, s) => sum + monthSalary(s), 0) / rate
  
  // Kuhinja salaries - celotna mesečna plača, ki velja ta mesec
  const kuhinjaStaff = activeStaff.filter(s => s.allocateTo === 'kuhinja')
  const kuhinjaSalaryCost = kuhinjaStaff.reduce((sum, s) => sum + monthSalary(s), 0) / rate
  
  // Management salaries - celotna mesečna plača, ki velja ta mesec
  const managementStaff = activeStaff.filter(s => s.allocateTo === 'management')
  const managementSalaryCost = managementStaff.reduce((sum, s) => sum + monthSalary(s), 0) / rate
  
  // Fixed monthly costs for accommodation
  // Marketing, Booking and Optima plus costs are the sum of individually entered
  // expenses for this month (entered in Kalkulacije > Stroški). No longer fixed/auto-calculated.
  const monthExpenses = await db.select().from(marketingExpenses)
    .where(and(eq(marketingExpenses.year, year), eq(marketingExpenses.month, month)))
  const marketingCost = monthExpenses.filter(e => (e.category || 'marketing') === 'marketing').reduce((sum, e) => sum + Number(e.amount), 0) // EUR
  // Reklama je lasten kontra strošek (kompenzacija), ne Ostalo in ne Marketing.
  const reklamaCost = monthExpenses.filter(e => e.category === 'reklama').reduce((sum, e) => sum + Number(e.amount), 0) // EUR
  const bookingCost = monthExpenses.filter(e => e.category === 'booking').reduce((sum, e) => sum + Number(e.amount), 0) // EUR
  const optimaplusCost = monthExpenses.filter(e => e.category === 'optimaplus').reduce((sum, e) => sum + Number(e.amount), 0) // EUR
  const platformCommissionCost = bookingCost + optimaplusCost
  const starlinkCost = 150 // EUR per month
  const fixedAccommodationCosts = marketingCost + starlinkCost

  // Nabavni računi (stroški arhiv), razporejeni na posamezno kategorijo za ta mesec.
  // Zneski alokacij so že v EUR (glej CategoryAllocation.amountEur).
  // Računi, dodani k sredstvu v izdelavi, niso tekoči strošek (gredo v nabavno vrednost sredstva).
  await ensureAssetSchema()
  const monthReceipts = await db.execute(
    sql`SELECT id, date, description, categories, "cashLedgerId", "omLedgerId"
        FROM stroski_receipts WHERE year = ${year} AND month = ${month}
        AND id NOT IN (SELECT "receiptId" FROM fixed_asset_costs WHERE "receiptId" IS NOT NULL)`
  )
  const receiptsByCategory: Record<string, number> = {}
  // Isti odliv (gotovina ali Orange Money), ki je že račun v arhivu, se ne šteje še enkrat.
  const archiveLedgerIds = new Set<string>()
  const deptLines: Record<string, KuhinjaRacunLine[]> = {
    kuhinja: [], bar: [], nocitve: [], wellness: [], ostalo: [], reprezentanca: [], vzdrzevanje: [],
  }
  const pushDeptLine = (category: string, line: KuhinjaRacunLine) => {
    deptLines[category]?.push(line)
  }
  for (const r of monthReceipts.rows) {
    const cashId = r.cashLedgerId ? String(r.cashLedgerId) : ''
    const omId = r.omLedgerId ? String(r.omLedgerId) : ''
    if (cashId) archiveLedgerIds.add(cashId)
    if (omId) archiveLedgerIds.add(omId)
    parseCategories(r.categories).forEach((c, idx) => {
      receiptsByCategory[c.category] = (receiptsByCategory[c.category] || 0) + c.amountEur
      if (c.amountEur !== 0) {
        pushDeptLine(c.category, {
          id: `arhiv-${String(r.id)}-${idx}`,
          date: r.date ? String(r.date) : '',
          name: (r.description ? String(r.description) : '').trim() || 'Brez imena',
          amountEur: c.amountEur,
          source: 'arhiv',
        })
      }
    })
  }
  // Gotovinski nakupi na Borutovih nabavnih poteh (kalamari, riba, pijača …): ista logika
  // razvrščanja kot arhiv računov — hrana bremeni kuhinjo, pijača bar itd. Zneski so v Ar → EUR.
  const nabavaPurchases = await getNabavaPurchasesForMonth(year, month)
  // Plačilo Dilipu za čoln Nero, označeno z vrsto stroška: ista razporeditev kot nakup.
  // Sredstvo v izdelavi / osnovno sredstvo / posojilo zanka spodaj preskoči (niso tekoči oddelek).
  const nabavaMonthPrefix = `${year}-${String(month).padStart(2, "0")}%`
  await ensureSupplierPaymentCostColumns()
  const boatCostRows = await db.execute(sql`
    SELECT id, "paidAt", "amountAr", "costCategory", method, "ledgerId"
    FROM supplier_payments
    WHERE "refKey" LIKE 'nabava:%:boat'
      AND COALESCE("costCategory", '') <> ''
      AND COALESCE("paidAt", '') LIKE ${nabavaMonthPrefix}
  `)
  const dilipBoatCosts = (boatCostRows.rows as Record<string, unknown>[]).map((r) => {
    const orange = r.method === "orange"
    const ledgerId = r.ledgerId ? String(r.ledgerId) : ""
    return {
      id: `dilip-boat-${String(r.id)}`,
      date: r.paidAt ? String(r.paidAt).slice(0, 10) : "",
      name: "Dilip (čoln Nero)",
      amountAr: Number(r.amountAr) || 0,
      payMethod: (orange ? "orange" : "cash") as "orange" | "cash",
      category: String(r.costCategory || ""),
      cashExpenseId: orange ? "" : ledgerId,
      omLedgerId: orange ? ledgerId : "",
    }
  })
  // Najemnina hiše (Borut plača gotovino v Nabavi Komba) = samostojen strošek, ločen od ostalih kategorij.
  let najemninaHisaAr = 0
  let stipendijaAr = 0
  let hranaStudentiAr = 0
  let izletNabavaAr = 0
  let racunovodstvoAr = 0
  let prevoznikiAr = 0
  const nabavaExtra: Record<string, KuhinjaRacunLine[]> = {
    najemnina: [], racunovodstvo: [], prevozniki: [], stipendija: [], hrana_studenti: [], izlet: [],
  }
  const nabavaLine = (p: { id: string; date: string; name: string; amountAr: number; payMethod: string }): KuhinjaRacunLine => ({
    id: `nabava-${p.id}`,
    date: p.date || '',
    name: (p.name || '').trim() || 'Brez imena',
    amountEur: p.amountAr / rate,
    source: p.payMethod === 'orange' ? 'Orange' : 'gotovina',
  })
  for (const p of [...nabavaPurchases, ...dilipBoatCosts]) {
  if (p.category === "najemnina") {
    najemninaHisaAr += p.amountAr
    if (p.amountAr) nabavaExtra.najemnina.push(nabavaLine(p))
    continue
  }
  // Računovodstvo (gotovina ali Orange Money z Nabave HV) je samostojen strošek.
  if (p.category === "racunovodstvo") {
    racunovodstvoAr += p.amountAr
    if (p.amountAr) nabavaExtra.racunovodstvo.push(nabavaLine(p))
    continue
  }
  // Prevozniki (gotovina ali Orange Money z nabave) so samostojen strošek, ne Ostalo.
  if (p.category === "prevozniki") {
    prevoznikiAr += p.amountAr
    if (p.amountAr) nabavaExtra.prevozniki.push(nabavaLine(p))
    continue
  }
  // Štipendija (šolnina) je samostojen strošek, ne bremeni oddelkov.
  if (p.category === "stipendija") {
    stipendijaAr += p.amountAr
    if (p.amountAr) nabavaExtra.stipendija.push(nabavaLine(p))
    continue
  }
  // Hrana za študente je samostojen strošek, ne bremeni kuhinje.
  if (p.category === "hrana_studenti") {
    hranaStudentiAr += p.amountAr
    if (p.amountAr) nabavaExtra.hrana_studenti.push(nabavaLine(p))
    continue
  }
  // Gotovinsko plačilo dobavitelju za izlet (npr. gosta na vrh Kombe) gre v strošek izletov.
  if (p.category === "izlet") {
    izletNabavaAr += p.amountAr
    if (p.amountAr) nabavaExtra.izlet.push(nabavaLine(p))
    continue
  }
  // Osnovno sredstvo se NE knjiži kot takojšen strošek oddelka — amortizira se prek fixed_assets.
  if (p.category === "osnovno_sredstvo") continue
  // Posojilo gostu ni strošek — gost ga vrne prek računa (postavka "Cash advance").
  if (p.category === "posojilo_gostu") continue
  if (p.category === "sredstvo_v_izdelavi") continue
  if ((p.cashExpenseId && archiveLedgerIds.has(p.cashExpenseId)) || (p.omLedgerId && archiveLedgerIds.has(p.omLedgerId))) continue
  const purchaseEur = p.amountAr / rate
  receiptsByCategory[p.category] = (receiptsByCategory[p.category] || 0) + purchaseEur
  if (purchaseEur !== 0) {
    pushDeptLine(p.category, {
      id: `gotovina-${p.id}`,
      date: p.date || '',
      name: (p.name || '').trim() || 'Brez imena',
      amountEur: purchaseEur,
      source: 'gotovina',
    })
  }
  }
  const receiptsKuhinjaCost = receiptsByCategory.kuhinja || 0
  const receiptsKuhinjaItems = roundKuhinjaLines(deptLines.kuhinja, receiptsKuhinjaCost)
  const receiptsBarCost = receiptsByCategory.bar || 0
  const receiptsBarItems = roundKuhinjaLines(deptLines.bar, receiptsBarCost)
  const receiptsNocitveCost = receiptsByCategory.nocitve || 0
  const receiptsWellnessCost = receiptsByCategory.wellness || 0
  const receiptsOstaloCost = receiptsByCategory.ostalo || 0
  // Reprezentanca (kava/pijača v lokalu) = samostojen strošek podjetja; NE bremeni oddelkov, znižuje skupni dobiček.
  const receiptsReprezentancaCost = receiptsByCategory.reprezentanca || 0
  // Tekoče vzdrževanje nepremičnin = samostojen strošek; NE bremeni oddelkov, znižuje skupni dobiček.
  const receiptsVzdrzevanjeCost = receiptsByCategory.vzdrzevanje || 0
  const najemninaHisaCost = najemninaHisaAr / rate
  const stipendijaCost = stipendijaAr / rate
  const hranaStudentiCost = hranaStudentiAr / rate
  const racunovodstvoCost = racunovodstvoAr / rate
  const prevoznikiCost = prevoznikiAr / rate
  const izletGotovinaCost = izletNabavaAr / rate

  // Nosači in Tuc tuc = vsak SVOJ samostojen strošek (npr. Borutove nabave HV/Komba). Vir so gotovinski odlivi
  // (bank_cash_expenses) IN Orange Money odlivi, prepoznani po besedilu opisa. NE bremenita nobenega oddelka —
  // znižujeta le SKUPNI dobiček (kot reprezentanca/amortizacija). Zneski so v Ar → EUR prek tečaja.
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`
  const nextMonthStart = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`
  const cashExtraRows = await db.execute(sql`
    SELECT
      COALESCE(SUM(amount) FILTER (WHERE purpose ILIKE '%nosač%' OR purpose ILIKE '%nosac%'), 0) AS porters,
      COALESCE(SUM(amount) FILTER (WHERE purpose ILIKE '%tuc tuc%' OR purpose ILIKE '%tuctuc%' OR purpose ILIKE '%tuk tuk%'), 0) AS tuctuc
    FROM bank_cash_expenses
    WHERE date >= ${monthStart} AND date < ${nextMonthStart}
      AND id NOT IN (
        SELECT "ledgerId" FROM supplier_payments
        WHERE "refKey" LIKE 'nabava:%:boat'
          AND COALESCE("costCategory", '') <> ''
          AND "ledgerId" IS NOT NULL
      )
  `)
  const omExtraRows = await db.execute(sql`
    SELECT
      COALESCE(SUM(amount) FILTER (WHERE description ILIKE '%nosač%' OR description ILIKE '%nosac%'), 0) AS porters,
      COALESCE(SUM(amount) FILTER (WHERE description ILIKE '%tuc tuc%' OR description ILIKE '%tuctuc%' OR description ILIKE '%tuk tuk%'), 0) AS tuctuc
    FROM orange_money_transactions
    WHERE direction = 'out' AND date >= ${monthStart} AND date < ${nextMonthStart}
      AND id NOT IN (
        SELECT "ledgerId" FROM supplier_payments
        WHERE "refKey" LIKE 'nabava:%:boat'
          AND COALESCE("costCategory", '') <> ''
          AND "ledgerId" IS NOT NULL
      )
  `)
  const cashExtra = (cashExtraRows.rows as Record<string, unknown>[])[0] || {}
  const omExtra = (omExtraRows.rows as Record<string, unknown>[])[0] || {}
  const portersAr = Number(cashExtra.porters || 0) + Number(omExtra.porters || 0)
  const tuctucAr = Number(cashExtra.tuctuc || 0) + Number(omExtra.tuctuc || 0)
  const portersCost = portersAr / rate
  const tuctucCost = tuctucAr / rate
  const cashDetailRows = await db.execute(sql`
    SELECT id, date, purpose AS name, amount
    FROM bank_cash_expenses
    WHERE date >= ${monthStart} AND date < ${nextMonthStart}
      AND id NOT IN (
        SELECT "ledgerId" FROM supplier_payments
        WHERE "refKey" LIKE 'nabava:%:boat'
          AND COALESCE("costCategory", '') <> ''
          AND "ledgerId" IS NOT NULL
      )
      AND (
        purpose ILIKE '%nosač%' OR purpose ILIKE '%nosac%'
        OR purpose ILIKE '%tuc tuc%' OR purpose ILIKE '%tuctuc%' OR purpose ILIKE '%tuk tuk%'
      )
  `)
  const omDetailRows = await db.execute(sql`
    SELECT id, date, description AS name, amount
    FROM orange_money_transactions
    WHERE direction = 'out' AND date >= ${monthStart} AND date < ${nextMonthStart}
      AND id NOT IN (
        SELECT "ledgerId" FROM supplier_payments
        WHERE "refKey" LIKE 'nabava:%:boat'
          AND COALESCE("costCategory", '') <> ''
          AND "ledgerId" IS NOT NULL
      )
      AND (
        description ILIKE '%nosač%' OR description ILIKE '%nosac%'
        OR description ILIKE '%tuc tuc%' OR description ILIKE '%tuctuc%' OR description ILIKE '%tuk tuk%'
      )
  `)
  const porterLinesRaw: KuhinjaRacunLine[] = []
  const tucLinesRaw: KuhinjaRacunLine[] = []
  const pushCarry = (row: Record<string, unknown>, source: string) => {
    const name = String(row.name || '')
    const amountEur = Number(row.amount || 0) / rate
    if (!amountEur) return
    const line: KuhinjaRacunLine = {
      id: `${source}-${String(row.id)}`,
      date: isoDay(row.date),
      name: name.trim() || 'Brez imena',
      amountEur,
      source,
    }
    if (/nosač|nosac/i.test(name)) porterLinesRaw.push({ ...line, id: `porter-${line.id}` })
    if (/tuc tuc|tuctuc|tuk tuk/i.test(name)) tucLinesRaw.push({ ...line, id: `tuc-${line.id}` })
  }
  for (const row of cashDetailRows.rows as Record<string, unknown>[]) pushCarry(row, 'gotovina')
  for (const row of omDetailRows.rows as Record<string, unknown>[]) pushCarry(row, 'Orange')

  // Osnovna sredstva: mesečna amortizacija (v EUR) — knjiži se kot ločen strošek.
  const depreciation = await getFixedAssetsDepreciation(year, month)
  const depreciationCost = depreciation.total

  const totalSalaryCost = accommodationSalaryCost + barSalaryCost + kuhinjaSalaryCost + managementSalaryCost
  const totalCosts = barPijacaCost + barPrehranaCost + wellnessCost + ostaloCost + excursionCost + izletGotovinaCost + transferCostTotal + mealPlanCost + totalSalaryCost + platformCommissionCost + fixedAccommodationCosts + receiptsKuhinjaCost + receiptsBarCost + receiptsNocitveCost + receiptsWellnessCost + receiptsOstaloCost + receiptsReprezentancaCost + receiptsVzdrzevanjeCost + najemninaHisaCost + stipendijaCost + hranaStudentiCost + racunovodstvoCost + prevoznikiCost + reklamaCost + portersCost + tuctucCost + depreciationCost

  // ===== PER-GUEST BREAKDOWN (analytics) =====
  // Attribute revenue and costs to each reservation/guest. Salaries are allocated
  // proportionally to each guest's total revenue; marketing + Starlink are allocated
  // proportionally to each guest's accommodation revenue (since they relate to lodging).
  type GuestAgg = {
    reservationId: string
    guestName: string
    bungalow: string
    arrival: string | null
    departure: string | null
    nightsInMonth: number
    accommodation: number
    pijaca: number
    prehrana: number
    mealPlan: number
    wellness: number
    wellnessCount: number
    wellnessFormulaCount: number
    wellnessFormulaRevenue: number
    ostalo: number
    excursions: number
    transfers: number
    agencyCommission: number
    optimaplusCommission: number
    excursionCost: number
    transferCost: number
    ostaloProductCost: number
    ostaloFallbackRevenue: number
  }
  const guestMap = new Map<string, GuestAgg>()

  const getGuest = (id: string, name?: string | null, bungalow?: string | null, arrival?: string | null, departure?: string | null): GuestAgg => {
    let g = guestMap.get(id)
    if (!g) {
      g = {
        reservationId: id, guestName: name || 'Neznano', bungalow: bungalow || '',
        arrival: arrival ?? null, departure: departure ?? null,
        nightsInMonth: 0, accommodation: 0, pijaca: 0, prehrana: 0, mealPlan: 0,
        wellness: 0, wellnessCount: 0, wellnessFormulaCount: 0, wellnessFormulaRevenue: 0, ostalo: 0, excursions: 0, transfers: 0,
        agencyCommission: 0, optimaplusCommission: 0, excursionCost: 0, transferCost: 0,
        ostaloProductCost: 0, ostaloFallbackRevenue: 0,
      }
      guestMap.set(id, g)
    } else if (name && g.guestName === 'Neznano') {
      g.guestName = name
    }
    return g
  }

  // Accommodation + commissions (proportional to nights in month)
  for (const r of reservationsWithNightsInMonth) {
    const arrival = new Date(r.arrival!)
    const departure = new Date(r.departure!)
    const totalN = Math.ceil((departure.getTime() - arrival.getTime()) / 86400000)
    if (totalN <= 0) continue
    const effStart = arrival < startDate ? startDate : arrival
    const effEnd = departure > endDate ? new Date(endDate.getTime() + 86400000) : departure
    const nIn = Math.ceil((effEnd.getTime() - effStart.getTime()) / 86400000)
    if (nIn <= 0) continue
    const prop = nIn / totalN
    const g = getGuest(r.id, r.guestName, r.bungalow, r.arrival, r.departure)
    g.nightsInMonth += nIn
    const grossAccMonthG = (Number(r.totalAmount || 0) / totalN) * nIn
    const mealMonthG = mealPlanValueEur(r.mealPlan, r.mealPlanPaymentStatus, Number(r.pax || 1), nIn, grossAccMonthG, r.mealPlanPax)
    g.accommodation += grossAccMonthG - mealMonthG
    g.mealPlan += mealMonthG
    g.agencyCommission += Number(r.agencyCommission || 0) * prop
    if (r.bookingSource === 'Booking.com' || r.bookingSource === 'Airbnb') {
      g.optimaplusCommission += (Number(r.totalAmount || 0) * 0.07) * prop
    }
  }

  // Helper: resolve guest from a delivery note
  const guestFromDeliveryItem = (deliveryNoteId: string): GuestAgg | null => {
    const resId = dnReservationId.get(deliveryNoteId)
    if (!resId) return null
    const dn = monthDeliveryNotes.find(d => d.id === deliveryNoteId)
    const r = resById.get(resId)
    return getGuest(resId, r?.guestName || dn?.guestName, r?.bungalow || dn?.bungalow, r?.arrival, r?.departure)
  }

  // Bar / wellness / ostalo from delivery note items
  pijacaDeliveryItems.forEach(i => { const g = guestFromDeliveryItem(i.deliveryNoteId); if (g) g.pijaca += (i.totalAr || 0) / rate })
  barPrehranaDeliveryItems.forEach(i => { const g = guestFromDeliveryItem(i.deliveryNoteId); if (g) g.prehrana += deliveryFoodRevenueAr(i) / rate })
  wellnessDeliveryItems.forEach(i => { const g = guestFromDeliveryItem(i.deliveryNoteId); if (g) { const eur = (i.totalAr || 0) / rate; g.wellness += eur; g.wellnessCount += (i.quantity || 0); if (!autoMassageIds.has(i.id)) { g.wellnessFormulaCount += (i.quantity || 0); g.wellnessFormulaRevenue += eur } } })
  ostaloItems.forEach(i => { const g = guestFromDeliveryItem(i.deliveryNoteId); if (g) { g.ostalo += (i.totalAr || 0) / rate; const c = i.productId ? productCostArById.get(i.productId) : undefined; if (c != null && !i.isFree && !(i as { coveredByMealPlan?: boolean }).coveredByMealPlan) { g.ostaloProductCost += (c * (i.quantity || 0)) / rate } else { g.ostaloFallbackRevenue += (i.totalAr || 0) / rate } } })

  // Bar / wellness / meal plan / excursions from order items (have reservationId directly)
  pijacaOrderItems.forEach(o => { if (!o.reservationId) return; const r = resById.get(o.reservationId); const g = getGuest(o.reservationId, r?.guestName, r?.bungalow, r?.arrival, r?.departure); g.pijaca += (o.priceAr || 0) / rate })
  wellnessOrderItems.forEach(o => { if (!o.reservationId) return; const r = resById.get(o.reservationId); const g = getGuest(o.reservationId, r?.guestName, r?.bungalow, r?.arrival, r?.departure); const eur = (o.priceAr || 0) / rate; g.wellness += eur; g.wellnessCount += 1; if (!autoMassageIds.has(o.id)) { g.wellnessFormulaCount += 1; g.wellnessFormulaRevenue += eur } })
  mealPlanItems.forEach(o => { if (!o.reservationId) return; const eur = prehranaOrderRevenueAr(o) / rate; if (!eur) return; const r = resById.get(o.reservationId); const g = getGuest(o.reservationId, r?.guestName, r?.bungalow, r?.arrival, r?.departure); g.mealPlan += eur })
  excursionItems.forEach(o => { if (!o.reservationId) return; const r = resById.get(o.reservationId); const g = getGuest(o.reservationId, r?.guestName, r?.bungalow, r?.arrival, r?.departure); g.excursions += excItemRevenueAr(o) / rate; g.excursionCost += ((o as { costAr?: number | null }).costAr || 0) / rate })
  ostaloOrderItems.forEach(o => { if (!o.reservationId) return; const r = resById.get(o.reservationId); const g = getGuest(o.reservationId, r?.guestName, r?.bungalow, r?.arrival, r?.departure); const revAr = orderItemRevenueAr(o); g.ostalo += revAr / rate; const p = ostaloProductByName.get(o.name!)!; const manual = (o as { costAr?: number | null }).costAr; if (manual != null) { g.ostaloProductCost += Number(manual) / rate } else if (p.priceAr > 0 && p.costAr > 0) { g.ostaloProductCost += (revAr * p.costAr / p.priceAr) / rate } else { g.ostaloFallbackRevenue += revAr / rate } })

  // Excursion supplier costs per booking
  allExcursionBookings.forEach(b => {
    if (!b.reservationId) return
    const r = resById.get(b.reservationId)
    const g = getGuest(b.reservationId, r?.guestName, r?.bungalow, r?.arrival, r?.departure)
    let c = 0
    if (b.boatId && b.excursionId) {
      const p = allExcursionPricing.find(p => p.excursionId === b.excursionId && p.boatId === b.boatId)
      if (p) c += p.priceAr || 0
    }
    const exc = allExcursions.find(e => e.id === b.excursionId)
    if (exc) {
      const pax = b.pax || 1
      c += (exc.guidePriceAr || 0) + (exc.entranceFeeAr || 0) * pax + (b.lunchProviderId ? (exc.lunchPriceAr || 0) * pax : 0)
    }
    g.excursionCost += c / rate
  })

  // Transfers revenue + supplier cost per booking
  allTransfers.forEach(t => {
    if (!t.reservationId) return
    const r = resById.get(t.reservationId)
    const g = getGuest(t.reservationId, r?.guestName, r?.bungalow, r?.arrival, r?.departure)
    g.transfers += Number(t.guestPrice || 0)
    if (t.boatId && !t.skipBoatPay) {
      let routeId = t.route
      if (t.route && !t.route.startsWith('route-')) {
        const fr = allRoutes.find(rr => rr.name === t.route)
        if (fr) routeId = fr.id
      }
      const rd = allRoutes.find(rr => rr.id === routeId)
      const prId = rd?.baseRouteId || routeId
      const pr = allSupplierPricing.find(sp => sp.boatId === t.boatId && sp.routeId === prId)
      if (pr) g.transferCost += (pr.priceAr || 0) / rate
    }
    // Herman (car) supplier cost, if this transfer uses Herman
    if (t.hermanRouteId) {
      const hp = allSupplierPricing.find(sp => sp.boatId === 'taxi-herman' && sp.routeId === t.hermanRouteId)
      if (hp) g.transferCost += (hp.priceAr || 0) / rate
    }
  })

  // Build final per-guest result with derived costs + allocated overhead
  const rawGuests = Array.from(guestMap.values())
  const sumGuestRevenue = rawGuests.reduce((s, g) => s + g.accommodation + g.pijaca + g.prehrana + g.mealPlan + g.wellness + g.ostalo + g.excursions + g.transfers, 0)
  const sumGuestAccommodation = rawGuests.reduce((s, g) => s + g.accommodation, 0)
  const wellnessUnitCost = costMap.wellness?.type === 'fixed' ? costMap.wellness.value : 0

  const guestBreakdown = rawGuests.map(g => {
    const revenue = g.accommodation + g.pijaca + g.prehrana + g.mealPlan + g.wellness + g.ostalo + g.excursions + g.transfers
    const barPijacaC = costMap.bar_pijaca?.type === 'percentage' ? g.pijaca * costMap.bar_pijaca.value / 100 : 0
    const barPrehranaC = costMap.bar_prehrana?.type === 'percentage' ? g.prehrana * costMap.bar_prehrana.value / 100 : 0
    const mealPlanC = costMap.bar_prehrana?.type === 'percentage' ? g.mealPlan * costMap.bar_prehrana.value / 100 : 0
    const wellnessC = costMap.wellness?.type === 'fixed' ? g.wellnessFormulaCount * wellnessUnitCost : (costMap.wellness ? g.wellnessFormulaRevenue * costMap.wellness.value / 100 : 0)
    const ostaloC = g.ostaloProductCost + (costMap.ostalo?.type === 'percentage' ? g.ostaloFallbackRevenue * costMap.ostalo.value / 100 : 0)
    const directCost = barPijacaC + barPrehranaC + mealPlanC + wellnessC + ostaloC + g.excursionCost + g.transferCost
    // Allocated overhead
    const salaryShare = sumGuestRevenue > 0 ? totalSalaryCost * (revenue / sumGuestRevenue) : 0
    const marketingShare = sumGuestAccommodation > 0 ? marketingCost * (g.accommodation / sumGuestAccommodation) : 0
    const starlinkShare = sumGuestAccommodation > 0 ? starlinkCost * (g.accommodation / sumGuestAccommodation) : 0
    const platformShare = sumGuestAccommodation > 0 ? platformCommissionCost * (g.accommodation / sumGuestAccommodation) : 0
    const totalCost = directCost + salaryShare + marketingShare + starlinkShare + platformShare
    return {
      reservationId: g.reservationId,
      guestName: g.guestName,
      bungalow: g.bungalow,
      arrival: g.arrival,
      departure: g.departure,
      nightsInMonth: g.nightsInMonth,
      revenue: {
        accommodation: Math.round(g.accommodation * 100) / 100,
        bar: Math.round((g.pijaca + g.prehrana) * 100) / 100,
        mealPlan: Math.round(g.mealPlan * 100) / 100,
        wellness: Math.round(g.wellness * 100) / 100,
        ostalo: Math.round(g.ostalo * 100) / 100,
        excursions: Math.round(g.excursions * 100) / 100,
        transfers: Math.round(g.transfers * 100) / 100,
        total: Math.round(revenue * 100) / 100,
      },
      costs: {
        direct: Math.round(directCost * 100) / 100,
        salaries: Math.round(salaryShare * 100) / 100,
        marketing: Math.round(marketingShare * 100) / 100,
        starlink: Math.round(starlinkShare * 100) / 100,
        commissions: Math.round(platformShare * 100) / 100,
        excursions: Math.round(g.excursionCost * 100) / 100,
        wellness: Math.round(wellnessC * 100) / 100,
        transfers: Math.round(g.transferCost * 100) / 100,
        total: Math.round(totalCost * 100) / 100,
      },
      wellnessCount: g.wellnessCount,
      profit: Math.round((revenue - totalCost) * 100) / 100,
    }
  }).sort((a, b) => b.profit - a.profit)

  // Bar product sales breakdown — how many of each article were sold in the bar
  // (from delivery_note_items). Chargeable revenue comes from totalAr; complimentary
  // "On House" items and meals a paid pension covers count toward quantity but add 0 revenue.
  const barSalesMap = new Map<string, {
    name: string
    category: string
    costCategory: string
    quantity: number
    revenueEur: number
    freeQuantity: number
    coveredQuantity: number
  }>()
  for (const i of allDeliveryItems as Array<Record<string, unknown>>) {
    const name = (i.productName as string) || 'Neznano'
    const category = (i.category as string) || ''
    const costCategory = (i.costCategory as string) || 'ostalo'
    const qty = Number(i.quantity || 0)
    const key = `${name}|||${category}`
    const e = barSalesMap.get(key) || { name, category, costCategory, quantity: 0, revenueEur: 0, freeQuantity: 0, coveredQuantity: 0 }
    const coveredFood = costCategory === 'prehrana' && pensionCoversDeliveryItem({
      deliveryNoteId: String(i.deliveryNoteId || ''),
      productId: (i.productId as string | null) ?? null,
      productName: (i.productName as string | null) ?? null,
      coveredByMealPlan: Boolean(i.coveredByMealPlan),
    })
    e.quantity += qty
    if (!coveredFood) e.revenueEur += Number(i.totalAr || 0) / rate
    if (i.isFree) e.freeQuantity += qty
    if (i.coveredByMealPlan || coveredFood) e.coveredQuantity += qty
    barSalesMap.set(key, e)
  }
  const barProductSales = [...barSalesMap.values()]
    .map(e => ({ ...e, revenueEur: Math.round(e.revenueEur * 100) / 100 }))
    .sort((a, b) => b.revenueEur - a.revenueEur || b.quantity - a.quantity)

  const salaryMonth = `${year}-${String(month).padStart(2, '0')}-01`
  const guestNameById = new Map(allReservationsForNights.map(r => [r.id, r.guestName || '']))
  const noteDate = new Map(monthDeliveryNotes.map(n => [n.id, isoDay(n.date)]))
  const salaryLines = (staff: typeof accommodationStaff): KuhinjaRacunLine[] =>
    staff
      .map(s => ({
        id: `placa-${s.id}`,
        date: salaryMonth,
        name: (s.staffName || '').trim() || 'Brez imena',
        amountEur: monthSalary(s) / rate,
        source: 'placa',
      }))
      .filter(l => l.amountEur !== 0)
  const expenseKind = (method: string | null | undefined) => {
    if (method === 'cash') return 'gotovina'
    if (method === 'orange_money') return 'Orange'
    if (method === 'transfer') return 'Nakazilo'
    if (method === 'in_kind') return 'V naravi'
    if (method === 'kompenzacija') return 'Kompenzacija'
    return 'Vnos'
  }
  const expenseLines = (category: string): KuhinjaRacunLine[] =>
    monthExpenses
      .filter(e => category === 'marketing' ? (e.category || 'marketing') === 'marketing' : e.category === category)
      .filter(e => Number(e.amount) !== 0)
      .map(e => ({
        id: String(e.id),
        date: isoDay(e.date) || salaryMonth,
        name: (e.description || '').trim() || 'Brez imena',
        amountEur: Number(e.amount),
        source: expenseKind(e.paymentMethod),
      }))

  const transferDilipRaw: KuhinjaRacunLine[] = []
  const transferHermanRaw: KuhinjaRacunLine[] = []
  for (const t of allTransfers) {
    const guest = guestNameById.get(t.reservationId) || 'Prevoz'
    const when = isoDay(t.pickupDate)
    if (t.boatId && !t.skipBoatPay) {
      let routeId = t.route
      if (t.route && !t.route.startsWith('route-')) {
        const foundRoute = allRoutes.find(r => r.name === t.route)
        if (foundRoute) routeId = foundRoute.id
      }
      const routeData = allRoutes.find(r => r.id === routeId)
      const pricingRouteId = routeData?.baseRouteId || routeId
      const pricing = allSupplierPricing.find(sp => sp.boatId === t.boatId && sp.routeId === pricingRouteId)
      const ar = pricing?.priceAr || 0
      if (ar) {
        transferDilipRaw.push({
          id: `dilip-${t.id}`,
          date: when,
          name: [guest, routeData?.name || t.route || ''].filter(Boolean).join(' · '),
          amountEur: ar / rate,
          source: 'Cenik',
        })
      }
    }
    if (t.hermanRouteId) {
      const hp = allSupplierPricing.find(sp => sp.boatId === 'taxi-herman' && sp.routeId === t.hermanRouteId)
      const ar = hp?.priceAr || 0
      if (ar) {
        const routeData = allRoutes.find(r => r.id === t.hermanRouteId)
        transferHermanRaw.push({
          id: `herman-${t.id}`,
          date: when,
          name: [guest, routeData?.name || 'Herman'].filter(Boolean).join(' · '),
          amountEur: ar / rate,
          source: 'Cenik',
        })
      }
    }
  }

  const excursionFormulaRaw: KuhinjaRacunLine[] = []
  for (const booking of allExcursionBookings) {
    let ar = 0
    if (booking.boatId && booking.excursionId) {
      const pricing = allExcursionPricing.find(p => p.excursionId === booking.excursionId && p.boatId === booking.boatId)
      if (pricing) ar += pricing.priceAr || 0
    }
    const exc = allExcursions.find(e => e.id === booking.excursionId)
    if (exc) {
      const pax = booking.pax || 1
      ar += (exc.guidePriceAr || 0) + (exc.entranceFeeAr || 0) * pax
      if (booking.lunchProviderId) ar += (exc.lunchPriceAr || 0) * pax
    }
    if (ar) {
      excursionFormulaRaw.push({
        id: `izlet-${booking.id}`,
        date: isoDay(booking.date),
        name: [guestNameById.get(booking.reservationId), exc?.name || 'Izlet'].filter(Boolean).join(' · ') || 'Izlet',
        amountEur: ar / rate,
        source: 'Cenik',
      })
    }
  }
  for (const o of excursionItems) {
    const costAr = Number((o as { costAr?: number | null }).costAr || 0)
    if (!costAr) continue
    excursionFormulaRaw.push({
      id: `izlet-rocno-${o.id}`,
      date: isoDay(o.eventDate),
      name: (o.name || '').trim() || 'Izlet',
      amountEur: costAr / rate,
      source: 'Ročno',
    })
  }

  const wellnessFormulaRaw: KuhinjaRacunLine[] = []
  if (costMap.wellness) {
    if (costMap.wellness.type === 'fixed') {
      const unit = costMap.wellness.value
      for (const i of formulaWellnessDelivery) {
        const qty = i.quantity || 0
        if (!qty) continue
        wellnessFormulaRaw.push({
          id: `well-${i.id}`,
          date: noteDate.get(i.deliveryNoteId) || '',
          name: `${i.productName || 'Masaža'}${qty > 1 ? ` × ${qty}` : ''}`,
          amountEur: qty * unit,
          source: 'Cenik',
        })
      }
      for (const o of formulaWellnessOrders) {
        wellnessFormulaRaw.push({
          id: `well-${o.id}`,
          date: isoDay(o.eventDate),
          name: [guestNameById.get(o.reservationId || ''), o.name || 'Masaža'].filter(Boolean).join(' · '),
          amountEur: unit,
          source: 'Cenik',
        })
      }
    } else {
      const pct = costMap.wellness.value / 100
      for (const i of formulaWellnessDelivery) {
        const rev = (i.totalAr || 0) / rate
        if (!rev) continue
        wellnessFormulaRaw.push({
          id: `well-${i.id}`,
          date: noteDate.get(i.deliveryNoteId) || '',
          name: i.productName || 'Masaža',
          amountEur: rev * pct,
          source: 'Odstotek',
        })
      }
      for (const o of formulaWellnessOrders) {
        const rev = (o.priceAr || 0) / rate
        if (!rev) continue
        wellnessFormulaRaw.push({
          id: `well-${o.id}`,
          date: isoDay(o.eventDate),
          name: o.name || 'Masaža',
          amountEur: rev * pct,
          source: 'Odstotek',
        })
      }
    }
  }

  const ostaloRaw: KuhinjaRacunLine[] = []
  for (const i of ostaloItems) {
    const c = i.productId ? productCostArById.get(i.productId) : undefined
    if (c != null && !i.isFree && !(i as { coveredByMealPlan?: boolean }).coveredByMealPlan && (i.quantity || 0) > 0) {
      ostaloRaw.push({
        id: `ostalo-${i.id}`,
        date: noteDate.get(i.deliveryNoteId) || '',
        name: i.productName || 'Izdelek',
        amountEur: c * (i.quantity || 0) / rate,
        source: 'Nabava',
      })
    }
  }
  for (const o of ostaloOrderItems) {
    const revAr = orderItemRevenueAr(o)
    const p = ostaloProductByName.get(o.name!)!
    let costAr = 0
    if ((o as { costAr?: number | null }).costAr != null) costAr = Number((o as { costAr?: number | null }).costAr)
    else if (p.priceAr > 0 && p.costAr > 0) costAr = revAr * p.costAr / p.priceAr
    if (!costAr) continue
    ostaloRaw.push({
      id: `ostalo-${o.id}`,
      date: isoDay(o.eventDate),
      name: o.name || 'Izdelek',
      amountEur: costAr / rate,
      source: 'Nabava',
    })
  }
  if (ostaloRaw.length > 0 && ostaloFallbackCost !== 0) {
    ostaloRaw.push({
      id: 'ostalo-odstotek',
      date: salaryMonth,
      name: `Odstotek (${costMap.ostalo?.value || 0}%)`,
      amountEur: ostaloFallbackCost,
      source: 'Odstotek',
    })
  }

  const salariesAccommodation = roundKuhinjaLines(salaryLines(accommodationStaff), accommodationSalaryCost)
  const salariesBar = roundKuhinjaLines(salaryLines(barStaff), barSalaryCost)
  const salariesKuhinja = roundKuhinjaLines(salaryLines(kuhinjaStaff), kuhinjaSalaryCost)
  const salariesManagement = roundKuhinjaLines(salaryLines(managementStaff), managementSalaryCost)
  const marketingItems = roundKuhinjaLines(expenseLines('marketing'), marketingCost)
  const bookingItems = roundKuhinjaLines(expenseLines('booking'), bookingCost)
  const optimaplusItems = roundKuhinjaLines(expenseLines('optimaplus'), optimaplusCost)
  const reklamaItems = roundKuhinjaLines(expenseLines('reklama'), reklamaCost)
  const starlinkItems: KuhinjaRacunLine[] = starlinkCost
    ? [{ id: 'starlink', date: salaryMonth, name: 'Starlink', amountEur: starlinkCost, source: 'Fiksno' }]
    : []
  const receiptsNocitveItems = roundKuhinjaLines(deptLines.nocitve, receiptsNocitveCost)
  const receiptsWellnessItems = roundKuhinjaLines(deptLines.wellness, receiptsWellnessCost)
  const receiptsOstaloItems = roundKuhinjaLines(deptLines.ostalo, receiptsOstaloCost)
  const receiptsReprezentancaItems = roundKuhinjaLines(deptLines.reprezentanca, receiptsReprezentancaCost)
  const receiptsVzdrzevanjeItems = roundKuhinjaLines(deptLines.vzdrzevanje, receiptsVzdrzevanjeCost)
  const najemninaItems = roundKuhinjaLines(nabavaExtra.najemnina, najemninaHisaCost)
  const stipendijaItems = roundKuhinjaLines(nabavaExtra.stipendija, stipendijaCost)
  const hranaStudentiItems = roundKuhinjaLines(nabavaExtra.hrana_studenti, hranaStudentiCost)
  const racunovodstvoItems = roundKuhinjaLines(nabavaExtra.racunovodstvo, racunovodstvoCost)
  const prevoznikiItems = roundKuhinjaLines(nabavaExtra.prevozniki, prevoznikiCost)
  const izletGotovinaItems = roundKuhinjaLines(nabavaExtra.izlet, izletGotovinaCost)
  const transfersDilip = roundKuhinjaLines(transferDilipRaw, dilipCost)
  const transfersHerman = roundKuhinjaLines(transferHermanRaw, hermanCost)
  const transfersItems = roundKuhinjaLines([...transferDilipRaw, ...transferHermanRaw], transferCostTotal)
  const excursionFormulaItems = roundKuhinjaLines(excursionFormulaRaw, excursionCost)
  const wellnessFormulaItems = roundKuhinjaLines(wellnessFormulaRaw, wellnessCost)
  const ostaloItemsLines = roundKuhinjaLines(ostaloRaw, ostaloCost)
  const depreciationItemsLines = roundKuhinjaLines(
    depreciation.items.filter(i => i.active && i.monthlyEur).map(i => ({
      id: `amort-${i.id}`,
      date: salaryMonth,
      name: i.name,
      amountEur: i.monthlyEur,
      source: 'Amortizacija',
    })),
    depreciationCost,
  )
  const portersItems = roundKuhinjaLines(porterLinesRaw, portersCost)
  const tuctucItems = roundKuhinjaLines(tucLinesRaw, tuctucCost)

  const skupajParts: { key: string; name: string; amount: number; items: KuhinjaRacunLine[] }[] = [
    { key: 'place-nocitve', name: 'Plače (vrtnar, sobarica)', amount: accommodationSalaryCost, items: salariesAccommodation },
    { key: 'place-bar', name: 'Plače (barman)', amount: barSalaryCost, items: salariesBar },
    { key: 'place-kuhinja', name: 'Plače (kuhinja)', amount: kuhinjaSalaryCost, items: salariesKuhinja },
    { key: 'place-management', name: 'Plače (management)', amount: managementSalaryCost, items: salariesManagement },
    { key: 'marketing', name: 'Marketing', amount: marketingCost, items: marketingItems },
    { key: 'booking', name: 'Booking', amount: bookingCost, items: bookingItems },
    { key: 'optimaplus', name: 'Optima plus', amount: optimaplusCost, items: optimaplusItems },
    { key: 'starlink', name: 'Starlink', amount: starlinkCost, items: starlinkItems },
    { key: 'nabava-pijaca', name: 'Nabava pijača', amount: barPijacaCost, items: [] },
    { key: 'nabava-hrana', name: 'Nabava hrana', amount: barPrehranaCost + mealPlanCost, items: [] },
    { key: 'racuni-kuhinja', name: 'Računi nabava Kuhinja', amount: receiptsKuhinjaCost, items: receiptsKuhinjaItems },
    { key: 'racuni-bar', name: 'Računi nabava Bar', amount: receiptsBarCost, items: receiptsBarItems },
    { key: 'racuni-nocitve', name: 'Računi nabava Nočitve', amount: receiptsNocitveCost, items: receiptsNocitveItems },
    { key: 'racuni-wellness', name: 'Plačilo maserki', amount: receiptsWellnessCost, items: receiptsWellnessItems },
    { key: 'racuni-ostalo', name: 'Računi ostalo', amount: receiptsOstaloCost, items: receiptsOstaloItems },
    { key: 'reprezentanca', name: 'Računi reprezentanca', amount: receiptsReprezentancaCost, items: receiptsReprezentancaItems },
    { key: 'vzdrzevanje', name: 'Računi vzdrževanje', amount: receiptsVzdrzevanjeCost, items: receiptsVzdrzevanjeItems },
    { key: 'prevozi', name: 'Dobavitelj prevozov', amount: transferCostTotal, items: transfersItems },
    { key: 'izleti', name: 'Najem čolnov + vodič + vstop + kosilo', amount: excursionCost, items: excursionFormulaItems },
    { key: 'izlet-gotovina', name: 'Plačilo dobavitelju (gotovina)', amount: izletGotovinaCost, items: izletGotovinaItems },
    { key: 'maserke', name: 'Maserke', amount: wellnessCost, items: wellnessFormulaItems },
    { key: 'ostalo', name: 'Nabavna cena + pranje', amount: ostaloCost, items: ostaloItemsLines },
    { key: 'amortizacija', name: 'Amortizacija', amount: depreciationCost, items: depreciationItemsLines },
    { key: 'najemnina', name: 'Najemnina hiša', amount: najemninaHisaCost, items: najemninaItems },
    { key: 'stipendija', name: 'Štipendija', amount: stipendijaCost, items: stipendijaItems },
    { key: 'hrana-studenti', name: 'Hrana za študente', amount: hranaStudentiCost, items: hranaStudentiItems },
    { key: 'racunovodstvo', name: 'Računovodstvo', amount: racunovodstvoCost, items: racunovodstvoItems },
    { key: 'prevozniki', name: 'Prevozniki', amount: prevoznikiCost, items: prevoznikiItems },
    { key: 'reklama', name: 'Reklama', amount: reklamaCost, items: reklamaItems },
    { key: 'nosaci', name: 'Nosači', amount: portersCost, items: portersItems },
    { key: 'tuctuc', name: 'Tuc tuc', amount: tuctucCost, items: tuctucItems },
  ]
  const skupajRaw: KuhinjaRacunLine[] = []
  for (const part of skupajParts) {
    if (part.items.length) skupajRaw.push(...part.items)
    else if (Math.round(part.amount * 100) !== 0) {
      skupajRaw.push({
        id: `skupaj-${part.key}`,
        date: salaryMonth,
        name: part.name,
        amountEur: part.amount,
        source: 'Odstotek',
      })
    }
  }

  const costLines = {
    salariesAccommodation,
    salariesBar,
    salariesKuhinja,
    salariesManagement,
    marketing: marketingItems,
    booking: bookingItems,
    optimaplus: optimaplusItems,
    reklama: reklamaItems,
    starlink: starlinkItems,
    receiptsNocitve: receiptsNocitveItems,
    receiptsWellness: receiptsWellnessItems,
    receiptsOstalo: receiptsOstaloItems,
    receiptsReprezentanca: receiptsReprezentancaItems,
    receiptsVzdrzevanje: receiptsVzdrzevanjeItems,
    najemnina: najemninaItems,
    stipendija: stipendijaItems,
    hranaStudenti: hranaStudentiItems,
    racunovodstvo: racunovodstvoItems,
    prevozniki: prevoznikiItems,
    izletGotovina: izletGotovinaItems,
    transfers: transfersItems,
    transfersDilip,
    transfersHerman,
    excursions: excursionFormulaItems,
    wellness: wellnessFormulaItems,
    ostalo: ostaloItemsLines,
    depreciation: depreciationItemsLines,
    porters: portersItems,
    tuctuc: tuctucItems,
    skupaj: roundKuhinjaLines(skupajRaw, totalCosts),
  }

  return {
    year,
    month,
    exchangeRate: rate,
    revenue: {
      accommodation: Math.round(accommodationRevenue * 100) / 100,
      bar: { 
        pijaca: Math.round(pijacaRevenue * 100) / 100, 
        prehrana: Math.round(barPrehranaRevenue * 100) / 100, 
        total: Math.round(barTotal * 100) / 100 
      },
      transfers: Math.round(transferRevenue * 100) / 100,
      excursions: Math.round(excursionRevenue * 100) / 100,
      mealPlan: Math.round(mealPlanRevenue * 100) / 100,
      wellness: Math.round(wellnessRevenue * 100) / 100,
      ostalo: Math.round(ostaloRevenue * 100) / 100,
      total: Math.round(totalRevenue * 100) / 100
    },
    costs: {
      barPijaca: Math.round(barPijacaCost * 100) / 100,
      barPrehrana: Math.round(barPrehranaCost * 100) / 100,
      wellness: Math.round(wellnessCost * 100) / 100,
      ostalo: Math.round(ostaloCost * 100) / 100,
      excursions: Math.round((excursionCost + izletGotovinaCost) * 100) / 100,
      izletGotovina: Math.round(izletGotovinaCost * 100) / 100,
      transfers: Math.round(transferCostTotal * 100) / 100,
      mealPlan: Math.round(mealPlanCost * 100) / 100,
      receiptsKuhinja: Math.round(receiptsKuhinjaCost * 100) / 100,
      receiptsKuhinjaItems,
      receiptsBar: Math.round(receiptsBarCost * 100) / 100,
      receiptsBarItems,
      receiptsNocitve: Math.round(receiptsNocitveCost * 100) / 100,
      receiptsWellness: Math.round(receiptsWellnessCost * 100) / 100,
      receiptsOstalo: Math.round(receiptsOstaloCost * 100) / 100,
      receiptsReprezentanca: Math.round(receiptsReprezentancaCost * 100) / 100,
      receiptsVzdrzevanje: Math.round(receiptsVzdrzevanjeCost * 100) / 100,
      najemninaHisa: Math.round(najemninaHisaCost * 100) / 100,
      stipendija: Math.round(stipendijaCost * 100) / 100,
      hranaStudenti: Math.round(hranaStudentiCost * 100) / 100,
      racunovodstvo: Math.round(racunovodstvoCost * 100) / 100,
      prevozniki: Math.round(prevoznikiCost * 100) / 100,
      reklama: Math.round(reklamaCost * 100) / 100,
      porters: Math.round(portersCost * 100) / 100,
      tuctuc: Math.round(tuctucCost * 100) / 100,
      depreciation: Math.round(depreciationCost * 100) / 100,
      depreciationItems: depreciation.items.filter((i) => i.active).map((i) => ({ id: i.id, name: i.name, monthlyEur: i.monthlyEur })),
      salaries: Math.round(totalSalaryCost * 100) / 100,
      marketing: marketingCost,
      booking: bookingCost,
      optimaplus: optimaplusCost,
      platformCommission: Math.round(platformCommissionCost * 100) / 100,
      starlink: starlinkCost,
      total: Math.round(totalCosts * 100) / 100
    },
    salaryBreakdown: {
      accommodation: Math.round(accommodationSalaryCost * 100) / 100,
      bar: Math.round(barSalaryCost * 100) / 100,
      kuhinja: Math.round(kuhinjaSalaryCost * 100) / 100,
      management: Math.round(managementSalaryCost * 100) / 100
    },
    transferCarriers: {
      dilip: {
        revenue: Math.round(dilipRevenue * 100) / 100,
        cost: Math.round(dilipCost * 100) / 100,
        profit: Math.round((dilipRevenue - dilipCost) * 100) / 100,
      },
      herman: {
        revenue: Math.round(hermanRevenue * 100) / 100,
        cost: Math.round(hermanCost * 100) / 100,
        profit: Math.round((hermanRevenue - hermanCost) * 100) / 100,
      },
    },
    commissionsByAgency,
    commissionsBySource,
    optimaplusBreakdown: {
      booking: Math.round(bookingOptima * 100) / 100,
      airbnb: Math.round(airbnbOptima * 100) / 100
    },
    profit: Math.round((totalRevenue - totalCosts) * 100) / 100,
    nights: totalNights,
    guests: reservationIds.length,
    guestBreakdown,
    barProductSales,
    costSettings: costs,
    staffMembers: activeStaff,
    costLines,
  }
}

// Get carrier (boat operator) statistics for a month - how much business we gave
// each transporter, number of trips, and how much we paid them.
export async function getCarrierStatistics(year: number, month: number) {
  await db.execute(sql`ALTER TABLE transfers ADD COLUMN IF NOT EXISTS "skipBoatPay" boolean NOT NULL DEFAULT false`)
  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 0)
  const startStr = startDate.toISOString().split('T')[0]
  const endStr = endDate.toISOString().split('T')[0]

  const rate = await getExchangeRate()

  // Reservations checked out this month (transfers are tied to reservations)
  const archivedReservations = await db.select().from(reservations)
    .where(and(
      isNotNull(reservations.checkedOutAt),
      sql`DATE(${reservations.checkedOutAt}) >= ${startStr}`,
      sql`DATE(${reservations.checkedOutAt}) <= ${endStr}`
    ))
  const reservationIds = archivedReservations.map(r => r.id)

  const allTransfers = reservationIds.length > 0
    ? await db.select().from(transfers)
        .where(sql`${transfers.reservationId} IN (${sql.join(reservationIds.map(id => sql`${id}`), sql`, `)})`)
    : []

  // Excursion bookings with a date this month (+ fallback by reservation for older rows)
  const dateBasedExcursionBookings = await db.select().from(excursionBookings)
    .where(sql`${excursionBookings.date} >= ${startStr} AND ${excursionBookings.date} <= ${endStr}`)
  const reservationBasedExcursionBookings = reservationIds.length > 0
    ? await db.select().from(excursionBookings)
        .where(sql`${excursionBookings.date} IS NULL AND ${excursionBookings.reservationId} IN (${sql.join(reservationIds.map(id => sql`${id}`), sql`, `)})`)
    : []
  const allExcursionBookings = [...dateBasedExcursionBookings, ...reservationBasedExcursionBookings]

  const allSupplierPricing = await db.select().from(supplierPricing)
  const allExcursionPricing = await db.select().from(excursionPricing)
  const allRoutes = await db.select().from(routes)
  const allBoats = await db.select().from(boats)

  type CarrierAgg = {
    boatId: string
    name: string
    transferTrips: number
    excursionTrips: number
    transferPaidAr: number
    excursionPaidAr: number
  }
  const map = new Map<string, CarrierAgg>()
  const getCarrier = (boatId: string): CarrierAgg => {
    let c = map.get(boatId)
    if (!c) {
      const boat = allBoats.find(b => b.id === boatId)
      c = {
        boatId,
        name: boat?.name || 'Neznan prevoznik',
        transferTrips: 0, excursionTrips: 0,
        transferPaidAr: 0, excursionPaidAr: 0,
      }
      map.set(boatId, c)
    }
    return c
  }

  // Transfers -> supplier_pricing
  for (const t of allTransfers) {
    // Boat leg (Dilip). A return on a boat already paid with the departing guests is not paid again.
    if (t.boatId && !t.skipBoatPay) {
      let routeId = t.route
      if (t.route && !t.route.startsWith('route-')) {
        const fr = allRoutes.find(r => r.name === t.route)
        if (fr) routeId = fr.id
      }
      const routeData = allRoutes.find(r => r.id === routeId)
      const pricingRouteId = routeData?.baseRouteId || routeId
      const pricing = allSupplierPricing.find(sp => sp.boatId === t.boatId && sp.routeId === pricingRouteId)
      const c = getCarrier(t.boatId)
      c.transferTrips += 1
      c.transferPaidAr += pricing?.priceAr || 0
    }
    // Herman leg (car to/from Port) — separate carrier, priced by hermanRouteId
    if (t.hermanRouteId) {
      const hp = allSupplierPricing.find(sp => sp.boatId === 'taxi-herman' && sp.routeId === t.hermanRouteId)
      const hc = getCarrier('taxi-herman')
      hc.transferTrips += 1
      hc.transferPaidAr += hp?.priceAr || 0
    }
  }

  // Excursions -> excursion_pricing (boat rental supplier cost)
  for (const b of allExcursionBookings) {
    if (!b.boatId || !b.excursionId) continue
    const pricing = allExcursionPricing.find(p => p.excursionId === b.excursionId && p.boatId === b.boatId)
    const c = getCarrier(b.boatId)
    c.excursionTrips += 1
    c.excursionPaidAr += pricing?.priceAr || 0
  }

  const carriers = Array.from(map.values()).map(c => {
    const totalTrips = c.transferTrips + c.excursionTrips
    const totalPaidAr = c.transferPaidAr + c.excursionPaidAr
    return {
      boatId: c.boatId,
      name: c.name,
      transferTrips: c.transferTrips,
      excursionTrips: c.excursionTrips,
      totalTrips,
      transferPaid: Math.round((c.transferPaidAr / rate) * 100) / 100,
      excursionPaid: Math.round((c.excursionPaidAr / rate) * 100) / 100,
      totalPaid: Math.round((totalPaidAr / rate) * 100) / 100,
      totalPaidAr,
    }
  }).sort((a, b) => b.totalPaidAr - a.totalPaidAr)

  const totals = {
    totalTrips: carriers.reduce((s, c) => s + c.totalTrips, 0),
    transferTrips: carriers.reduce((s, c) => s + c.transferTrips, 0),
    excursionTrips: carriers.reduce((s, c) => s + c.excursionTrips, 0),
    totalPaid: Math.round(carriers.reduce((s, c) => s + c.totalPaid, 0) * 100) / 100,
  }

  return { carriers, totals }
}

// Get carrier statistics aggregated across the whole year (all months combined)
export async function getCarrierStatisticsYearly(year: number) {
  const map = new Map<string, {
    boatId: string
    name: string
    transferTrips: number
    excursionTrips: number
    totalTrips: number
    transferPaid: number
    excursionPaid: number
    totalPaid: number
    totalPaidAr: number
  }>()

  for (let month = 1; month <= 12; month++) {
    const { carriers } = await getCarrierStatistics(year, month)
    for (const c of carriers) {
      let agg = map.get(c.boatId)
      if (!agg) {
        agg = {
          boatId: c.boatId, name: c.name,
          transferTrips: 0, excursionTrips: 0, totalTrips: 0,
          transferPaid: 0, excursionPaid: 0, totalPaid: 0, totalPaidAr: 0,
        }
        map.set(c.boatId, agg)
      }
      agg.transferTrips += c.transferTrips
      agg.excursionTrips += c.excursionTrips
      agg.totalTrips += c.totalTrips
      agg.transferPaid += c.transferPaid
      agg.excursionPaid += c.excursionPaid
      agg.totalPaid += c.totalPaid
      agg.totalPaidAr += c.totalPaidAr
    }
  }

  const carriers = Array.from(map.values())
    .map(c => ({
      ...c,
      transferPaid: Math.round(c.transferPaid * 100) / 100,
      excursionPaid: Math.round(c.excursionPaid * 100) / 100,
      totalPaid: Math.round(c.totalPaid * 100) / 100,
    }))
    .sort((a, b) => b.totalPaidAr - a.totalPaidAr)

  const totals = {
    totalTrips: carriers.reduce((s, c) => s + c.totalTrips, 0),
    transferTrips: carriers.reduce((s, c) => s + c.transferTrips, 0),
    excursionTrips: carriers.reduce((s, c) => s + c.excursionTrips, 0),
    totalPaid: Math.round(carriers.reduce((s, c) => s + c.totalPaid, 0) * 100) / 100,
  }

  return { carriers, totals }
}

// Get yearly statistics
export async function getYearlyStatistics(year: number) {
  const months = []
  for (let month = 1; month <= 12; month++) {
    const stats = await getMonthlyStatistics(year, month)
    months.push(stats)
  }
  
  // Aggregate yearly totals
  const yearly = {
    year,
    revenue: {
      accommodation: 0,
      bar: { pijaca: 0, prehrana: 0, total: 0 },
      transfers: 0,
      excursions: 0,
      mealPlan: 0,
      wellness: 0,
      ostalo: 0,
      total: 0
    },
    costs: {
      barPijaca: 0,
      barPrehrana: 0,
      wellness: 0,
      ostalo: 0,
      receiptsKuhinja: 0,
      receiptsBar: 0,
      receiptsNocitve: 0,
      receiptsWellness: 0,
      receiptsOstalo: 0,
      receiptsReprezentanca: 0,
      receiptsVzdrzevanje: 0,
      najemninaHisa: 0,
      stipendija: 0,
      hranaStudenti: 0,
      racunovodstvo: 0,
      prevozniki: 0,
      reklama: 0,
      porters: 0,
      tuctuc: 0,
      depreciation: 0,
      salaries: 0,
      total: 0
    },
    profit: 0,
    nights: 0,
    guests: 0
  }
  
  for (const m of months) {
    yearly.revenue.accommodation += m.revenue.accommodation
    yearly.revenue.bar.pijaca += m.revenue.bar.pijaca
    yearly.revenue.bar.prehrana += m.revenue.bar.prehrana
    yearly.revenue.bar.total += m.revenue.bar.total
    yearly.revenue.transfers += m.revenue.transfers
    yearly.revenue.excursions += m.revenue.excursions
    yearly.revenue.mealPlan += m.revenue.mealPlan
    yearly.revenue.wellness += m.revenue.wellness
    yearly.revenue.ostalo += m.revenue.ostalo
    yearly.revenue.total += m.revenue.total
    
    yearly.costs.barPijaca += m.costs.barPijaca
    yearly.costs.barPrehrana += m.costs.barPrehrana
    yearly.costs.wellness += m.costs.wellness
    yearly.costs.ostalo += m.costs.ostalo
    yearly.costs.receiptsKuhinja += (m.costs as { receiptsKuhinja?: number }).receiptsKuhinja || 0
    yearly.costs.receiptsBar += (m.costs as { receiptsBar?: number }).receiptsBar || 0
    yearly.costs.receiptsNocitve += (m.costs as { receiptsNocitve?: number }).receiptsNocitve || 0
    yearly.costs.receiptsWellness += (m.costs as { receiptsWellness?: number }).receiptsWellness || 0
    yearly.costs.receiptsOstalo += (m.costs as { receiptsOstalo?: number }).receiptsOstalo || 0
    yearly.costs.receiptsReprezentanca += (m.costs as { receiptsReprezentanca?: number }).receiptsReprezentanca || 0
    yearly.costs.receiptsVzdrzevanje += (m.costs as { receiptsVzdrzevanje?: number }).receiptsVzdrzevanje || 0
    yearly.costs.najemninaHisa += (m.costs as { najemninaHisa?: number }).najemninaHisa || 0
    yearly.costs.stipendija += (m.costs as { stipendija?: number }).stipendija || 0
    yearly.costs.hranaStudenti += (m.costs as { hranaStudenti?: number }).hranaStudenti || 0
    yearly.costs.racunovodstvo += (m.costs as { racunovodstvo?: number }).racunovodstvo || 0
    yearly.costs.prevozniki += (m.costs as { prevozniki?: number }).prevozniki || 0
    yearly.costs.reklama += (m.costs as { reklama?: number }).reklama || 0
    yearly.costs.porters += (m.costs as { porters?: number }).porters || 0
    yearly.costs.tuctuc += (m.costs as { tuctuc?: number }).tuctuc || 0
    yearly.costs.depreciation += (m.costs as { depreciation?: number }).depreciation || 0
    yearly.costs.salaries += m.costs.salaries
    yearly.costs.total += m.costs.total
    
    yearly.profit += m.profit
    yearly.nights += m.nights
    yearly.guests += m.guests
  }
  
  return { yearly, months }
}

// ============ STAFF MEMBERS MANAGEMENT ============

async function ensureStaffEmploymentColumns() {
  await db.execute(sql`ALTER TABLE staff_members ADD COLUMN IF NOT EXISTS "endDate" date`)
  await db.execute(sql`ALTER TABLE staff_members ADD COLUMN IF NOT EXISTS "salaryChanges" jsonb NOT NULL DEFAULT '[]'::jsonb`)
}

export async function getAllStaffMembers() {
  await ensureStaffEmploymentColumns()
  const result = await db.execute(
    sql`SELECT * FROM staff_members ORDER BY "staffName"`
  )
  return result.rows.map(r => ({
    id: r.id as string,
    staffType: r.staffType as string,
    staffName: r.staffName as string,
    monthlySalary: r.monthlySalary as string,
    officialSalary: (r.officialSalary as string | null) ?? '',
    wageCategory: (r.wageCategory as string | null) ?? '',
    allocateTo: r.allocateTo as string,
    activeMonths: r.activeMonths as number[],
    startDate: r.startDate as string | null,
    endDate: r.endDate as string | null,
    salaryChanges: parseSalaryChanges(r.salaryChanges),
    active: r.active !== false,
    isRegularEmployee: r.isRegularEmployee === true,
    employmentType: (r.employmentType as string | null) ?? '',
    nickname: (r.nickname as string | null) ?? '',
    firstName: (r.firstName as string | null) ?? '',
    lastName: (r.lastName as string | null) ?? '',
    dateOfBirth: r.dateOfBirth as string | null,
    placeOfBirth: (r.placeOfBirth as string | null) ?? '',
    documentNumber: (r.documentNumber as string | null) ?? '',
    documentImagePath: (r.documentImagePath as string | null) ?? '',
    company: (r.company as string | null) ?? 'tourism',
    gender: (r.gender as string | null) ?? '',
    fatherName: (r.fatherName as string | null) ?? '',
    motherName: (r.motherName as string | null) ?? '',
    nationality: (r.nationality as string | null) ?? 'Malgache',
    cnapsNumber: (r.cnapsNumber as string | null) ?? '',
    ominoNumber: (r.ominoNumber as string | null) ?? '',
    ostieNumber: (r.ostieNumber as string | null) ?? '',
    numberOfDependents: Number(r.numberOfDependents ?? 0),
    address: (r.address as string | null) ?? '',
    phone: (r.phone as string | null) ?? '',
    email: (r.email as string | null) ?? '',
    employeePhotoPath: (r.employeePhotoPath as string | null) ?? '',
    notes: (r.notes as string | null) ?? '',
    openingLeaveBalance: Number(r.openingLeaveBalance ?? 0),
    priorLeaveByYear: (r.priorLeaveByYear as Record<string, number> | null) ?? {},
  }))
}

export async function upsertStaffMember(data: {
  id?: string
  staffType: string
  staffName: string
  monthlySalary: number
  allocateTo: string
  activeMonths: number[]
  startDate?: string | null
}) {
  const id = data.id || `staff-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  
  // Convert array to PostgreSQL array literal format using sql.raw()
  const activeMonthsLiteral = sql.raw(`'{${data.activeMonths.join(',')}}'::integer[]`)
  
  await db.execute(
    sql`INSERT INTO staff_members (id, "staffType", "staffName", "monthlySalary", "allocateTo", "activeMonths", "startDate")
        VALUES (${id}, ${data.staffType}, ${data.staffName}, ${data.monthlySalary}, ${data.allocateTo}, ${activeMonthsLiteral}, ${data.startDate || null})
        ON CONFLICT (id) DO UPDATE SET
          "staffType" = ${data.staffType},
          "staffName" = ${data.staffName},
          "monthlySalary" = ${data.monthlySalary},
          "allocateTo" = ${data.allocateTo},
          "activeMonths" = ${activeMonthsLiteral},
          "startDate" = ${data.startDate || null}`
  )
  
  revalidatePath('/statistika')
  return id
}

export async function deleteStaffMember(id: string) {
  await db.execute(sql`DELETE FROM staff_members WHERE id = ${id}`)
  revalidatePath('/statistika')
}

export async function toggleStaffActive(id: string, active: boolean) {
  await db.execute(sql`UPDATE staff_members SET active = ${active} WHERE id = ${id}`)
  revalidatePath('/statistika')
}

export async function setStaffRegularEmployee(id: string, value: boolean) {
  await db.execute(sql`UPDATE staff_members SET "isRegularEmployee" = ${value} WHERE id = ${id}`)
  revalidatePath('/statistika')
}

// Cikel vrste zaposlitve: 'regular' (redno) -> 'contract' (pogodbeno) -> 'stagiaire' (študent na praksi) -> nazaj.
// KLJUČNO: 'stagiaire' se v obračunu obravnava kot "ostali" (bruto=neto), zato
// mu isRegularEmployee ostane false — enako kot pogodbeni. employmentType je le
// prikazna oznaka, ki loči študenta od navadnega pogodbenega.
export async function setStaffEmploymentType(id: string, type: 'regular' | 'contract' | 'stagiaire') {
  const isRegular = type === 'regular'
  // employmentType hranimo samo za 'stagiaire'; sicer null (regular/contract se
  // razlikujeta prek isRegularEmployee, kot doslej).
  const empType = type === 'stagiaire' ? 'stagiaire' : null
  await db.execute(
    sql`UPDATE staff_members SET "isRegularEmployee" = ${isRegular}, "employmentType" = ${empType} WHERE id = ${id}`
  )
  revalidatePath('/statistika')
}

export async function updateStaffStartDate(id: string, startDate: string | null) {
  await db.execute(sql`UPDATE staff_members SET "startDate" = ${startDate} WHERE id = ${id}`)
  revalidatePath('/statistika')
}

export async function updateStaffEndDate(id: string, endDate: string | null) {
  await ensureStaffEmploymentColumns()
  const day = endDate && /^\d{4}-\d{2}-\d{2}$/.test(endDate) ? endDate : null
  await db.execute(sql`UPDATE staff_members SET "endDate" = ${day} WHERE id = ${id}`)
  revalidatePath('/statistika')
}

export async function addStaffSalaryChange(id: string, from: string, amount: number) {
  await ensureStaffEmploymentColumns()
  const day = String(from || '').slice(0, 10)
  const nextAmount = Math.round(Number(amount))
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !(nextAmount > 0)) return
  const current = await db.execute(sql`SELECT "salaryChanges" FROM staff_members WHERE id = ${id}`)
  const changes = parseSalaryChanges(current.rows[0]?.salaryChanges).filter((row) => row.from !== day)
  changes.push({ from: day, amount: nextAmount })
  changes.sort((a, b) => a.from.localeCompare(b.from))
  await db.execute(
    sql`UPDATE staff_members SET "salaryChanges" = ${JSON.stringify(changes)}::jsonb WHERE id = ${id}`
  )
  revalidatePath('/statistika')
}

export async function removeStaffSalaryChange(id: string, from: string) {
  await ensureStaffEmploymentColumns()
  const day = String(from || '').slice(0, 10)
  const current = await db.execute(sql`SELECT "salaryChanges" FROM staff_members WHERE id = ${id}`)
  const changes = parseSalaryChanges(current.rows[0]?.salaryChanges).filter((row) => row.from !== day)
  await db.execute(
    sql`UPDATE staff_members SET "salaryChanges" = ${JSON.stringify(changes)}::jsonb WHERE id = ${id}`
  )
  revalidatePath('/statistika')
}

export async function updateStaffPersonalInfo(id: string, data: {
  nickname?: string | null
  firstName?: string | null
  lastName?: string | null
  dateOfBirth?: string | null
  placeOfBirth?: string | null
  documentNumber?: string | null
  documentImagePath?: string | null
  company?: string | null
  gender?: string | null
  fatherName?: string | null
  motherName?: string | null
  nationality?: string | null
  cnapsNumber?: string | null
  ominoNumber?: string | null
  address?: string | null
  phone?: string | null
  email?: string | null
  employeePhotoPath?: string | null
  notes?: string | null
  ostieNumber?: string | null
  numberOfDependents?: number | null
  openingLeaveBalance?: number | null
  officialSalary?: number | string | null
  wageCategory?: string | null
  }) {
  // Posodobi samo polja, ki so podana (undefined = pusti pri miru)
  const fields: (keyof typeof data)[] = [
    'nickname',
    'firstName', 'lastName', 'dateOfBirth', 'placeOfBirth', 'documentNumber',
    'documentImagePath', 'company', 'gender', 'fatherName', 'motherName',
    'nationality', 'cnapsNumber', 'ominoNumber', 'address', 'phone', 'email',
  'employeePhotoPath', 'notes', 'ostieNumber', 'numberOfDependents', 'openingLeaveBalance',
  'officialSalary', 'wageCategory',
  ]
  for (const field of fields) {
    const value = data[field]
    if (value === undefined) continue
    const safe = value || null
    // ime stolpca je iz fiksnega seznama (varno), vrednost je parametrizirana
    await db.execute(sql`UPDATE staff_members SET ${sql.identifier(field)} = ${safe} WHERE id = ${id}`)
  }
  revalidatePath('/statistika')
}

// Nastavi dopust preteklih let za DOLOCENO leto (npr. 2025). Vrednosti se hranijo v
// JSONB stolpcu priorLeaveByYear; openingLeaveBalance se sinhronizira na vsoto vseh let (zdruzljivost).
export async function setPriorLeaveYear(staffId: string, yearKey: number, days: number) {
  const safeDays = Math.max(0, Number.isFinite(days) ? days : 0)
  const res = await db.execute(
    sql`SELECT "priorLeaveByYear" FROM staff_members WHERE id = ${staffId}`
  )
  const cur = (res.rows[0]?.priorLeaveByYear as Record<string, unknown> | null) ?? {}
  const next: Record<string, number> = {}
  for (const [k, v] of Object.entries(cur)) {
    const n = Number(v)
    if (Number.isFinite(n)) next[k] = n
  }
  next[String(yearKey)] = safeDays
  const sum = Object.values(next).reduce((a, b) => a + (Number(b) || 0), 0)
  await db.execute(
    sql`UPDATE staff_members
        SET "priorLeaveByYear" = ${JSON.stringify(next)}::jsonb,
            "openingLeaveBalance" = ${sum}
        WHERE id = ${staffId}`
  )
  revalidatePath('/statistika')
  return { priorByYear: next, sum }
}
