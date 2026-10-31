import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

// Older databases predate the reserved-excursion editor. Add the columns before
// any select that asks Drizzle for them.
let ready: Promise<void> | null = null

export function ensureExcursionPriceColumns() {
  if (!ready) {
    ready = (async () => {
      await db.execute(sql`ALTER TABLE excursion_bookings ADD COLUMN IF NOT EXISTS "entrancePax" integer`)
      await db.execute(sql`ALTER TABLE excursion_bookings ADD COLUMN IF NOT EXISTS "boatPriceEur" numeric(10,2)`)
    })().catch((err) => {
      ready = null
      throw err
    })
  }
  return ready
}
