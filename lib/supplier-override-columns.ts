import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

// The columns are per booking. Add them before a select that asks Drizzle for them.
let ready: Promise<void> | null = null

export function ensureSupplierOverrideColumns() {
  if (!ready) {
    ready = (async () => {
      await db.execute(sql`ALTER TABLE excursion_bookings ADD COLUMN IF NOT EXISTS "dilipOverrideAr" integer`)
      await db.execute(sql`ALTER TABLE excursion_bookings ADD COLUMN IF NOT EXISTS "taxiOverrideAr" integer`)
      await db.execute(sql`ALTER TABLE excursion_bookings ADD COLUMN IF NOT EXISTS "lunchOverrideAr" integer`)
      await db.execute(sql`ALTER TABLE transfers ADD COLUMN IF NOT EXISTS "dilipOverrideAr" integer`)
      await db.execute(sql`ALTER TABLE transfers ADD COLUMN IF NOT EXISTS "taxiOverrideAr" integer`)
      await db.execute(sql`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS "dilipOverrideAr" integer`)
      await db.execute(sql`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS "taxiOverrideAr" integer`)
    })().catch((err) => {
      ready = null
      throw err
    })
  }
  return ready
}
