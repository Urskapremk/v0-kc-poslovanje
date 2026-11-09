import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'

let ready: Promise<void> | null = null

/** Adds the line-note columns once. Existing rows stay empty and off the invoice. */
export function ensureLineNoteColumns(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      await db.execute(sql`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS "lineNote" text`)
      await db.execute(sql`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS "lineNoteOnInvoice" boolean NOT NULL DEFAULT false`)
      await db.execute(sql`ALTER TABLE delivery_note_items ADD COLUMN IF NOT EXISTS "lineNote" text`)
      await db.execute(sql`ALTER TABLE delivery_note_items ADD COLUMN IF NOT EXISTS "lineNoteOnInvoice" boolean NOT NULL DEFAULT false`)
      await db.execute(sql`ALTER TABLE transfers ADD COLUMN IF NOT EXISTS "lineNote" text`)
      await db.execute(sql`ALTER TABLE transfers ADD COLUMN IF NOT EXISTS "lineNoteOnInvoice" boolean NOT NULL DEFAULT false`)
    })().catch((err) => {
      ready = null
      throw err
    })
  }
  return ready
}
