import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

// Taxi relations are their own routes (type = 'taxi', id prefix taxi-rel-).
// Prices stay in supplier_pricing / selling_pricing, keyed by the taxi driver
// (boats.id starting with taxi-) and that relation. Boat routes are not renamed.

export function isTaxiRelationId(id?: string | null): boolean {
  return !!id && id.startsWith('taxi-rel-')
}

let ready: Promise<void> | null = null

// Copies every relation already priced on a taxi supplier into the taxi list.
// Safe to run on every request: new rows are inserted once, edited names and
// prices are left alone, and existing transfer legs are repointed once.
export function ensureTaxiPriceList() {
  if (!ready) {
    ready = copyTaxiRelations().catch((err) => {
      ready = null
      throw err
    })
  }
  return ready
}

async function routesHavePriceEur(): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'routes'
      AND column_name = 'priceEur'
    LIMIT 1
  `)
  const rows = Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows
  return Array.isArray(rows) && rows.length > 0
}

async function copyTaxiRelations() {
  const withPrice = await routesHavePriceEur()
  await db.transaction(async (tx) => {
    if (withPrice) {
      await tx.execute(sql`
        INSERT INTO routes (id, name, type, active, "createdAt", "priceEur")
        SELECT 'taxi-rel-' || r.id, r.name, 'taxi', true, now(), 0
        FROM routes r
        WHERE r.id NOT LIKE 'taxi-rel-%'
          AND COALESCE(r.type, '') <> 'taxi'
          AND EXISTS (
            SELECT 1
            FROM supplier_pricing sp
            WHERE sp."routeId" = r.id
              AND sp.active = true
              AND sp."boatId" LIKE 'taxi-%'
          )
        ON CONFLICT (id) DO NOTHING
      `)
    } else {
      await tx.execute(sql`
        INSERT INTO routes (id, name, type, active, "createdAt")
        SELECT 'taxi-rel-' || r.id, r.name, 'taxi', true, now()
        FROM routes r
        WHERE r.id NOT LIKE 'taxi-rel-%'
          AND COALESCE(r.type, '') <> 'taxi'
          AND EXISTS (
            SELECT 1
            FROM supplier_pricing sp
            WHERE sp."routeId" = r.id
              AND sp.active = true
              AND sp."boatId" LIKE 'taxi-%'
          )
        ON CONFLICT (id) DO NOTHING
      `)
    }

    await tx.execute(sql`
      UPDATE routes
      SET type = 'taxi'
      WHERE id LIKE 'taxi-rel-%'
        AND COALESCE(type, '') <> 'taxi'
    `)

    await tx.execute(sql`
      INSERT INTO supplier_pricing (id, "boatId", "routeId", "priceAr", active, "createdAt")
      SELECT 'spcopy-' || sp.id, sp."boatId", 'taxi-rel-' || sp."routeId", sp."priceAr", true, now()
      FROM supplier_pricing sp
      WHERE sp.active = true
        AND sp."boatId" LIKE 'taxi-%'
        AND sp."routeId" NOT LIKE 'taxi-rel-%'
        AND EXISTS (SELECT 1 FROM routes r WHERE r.id = 'taxi-rel-' || sp."routeId")
        AND NOT EXISTS (
          SELECT 1 FROM supplier_pricing n
          WHERE n."boatId" = sp."boatId"
            AND n."routeId" = 'taxi-rel-' || sp."routeId"
        )
      ON CONFLICT (id) DO NOTHING
    `)

    await tx.execute(sql`
      INSERT INTO selling_pricing (
        id, "boatId", "routeId",
        "pricePax1", "pricePax2", "pricePax3", "pricePax4", "pricePax5", "pricePax6",
        active, "createdAt"
      )
      SELECT
        'sellcopy-' || s.id,
        s."boatId",
        'taxi-rel-' || s."routeId",
        s."pricePax1", s."pricePax2", s."pricePax3", s."pricePax4", s."pricePax5", s."pricePax6",
        true,
        now()
      FROM selling_pricing s
      WHERE s.active = true
        AND s."boatId" LIKE 'taxi-%'
        AND s."routeId" NOT LIKE 'taxi-rel-%'
        AND EXISTS (SELECT 1 FROM routes r WHERE r.id = 'taxi-rel-' || s."routeId")
        AND NOT EXISTS (
          SELECT 1 FROM selling_pricing n
          WHERE n."boatId" = s."boatId"
            AND n."routeId" = 'taxi-rel-' || s."routeId"
        )
      ON CONFLICT (id) DO NOTHING
    `)

    await tx.execute(sql`
      UPDATE supplier_pricing sp
      SET active = false
      WHERE sp.active = true
        AND sp."boatId" LIKE 'taxi-%'
        AND sp."routeId" NOT LIKE 'taxi-rel-%'
        AND EXISTS (SELECT 1 FROM routes r WHERE r.id = 'taxi-rel-' || sp."routeId")
    `)

    await tx.execute(sql`
      UPDATE selling_pricing s
      SET active = false
      WHERE s.active = true
        AND s."boatId" LIKE 'taxi-%'
        AND s."routeId" NOT LIKE 'taxi-rel-%'
        AND EXISTS (SELECT 1 FROM routes r WHERE r.id = 'taxi-rel-' || s."routeId")
    `)

    await tx.execute(sql`
      UPDATE transfers t
      SET "hermanRouteId" = 'taxi-rel-' || t."hermanRouteId"
      WHERE t."hermanRouteId" IS NOT NULL
        AND t."hermanRouteId" NOT LIKE 'taxi-rel-%'
        AND EXISTS (SELECT 1 FROM routes r WHERE r.id = 'taxi-rel-' || t."hermanRouteId")
    `)
  })
}
