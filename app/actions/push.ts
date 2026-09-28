'use server'

import webpush from 'web-push'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

// Raw SQL over push_subscriptions (created via MCP, not in the drizzle schema) —
// same pattern as daily_tasks and stroski_receipts.

export type PushTarget = 'Borut' | 'Urska'

type SubscriptionRow = {
  id: string
  endpoint: string
  p256dh: string
  auth: string
}

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY

function configureWebPush() {
  if (!PUBLIC_KEY || !PRIVATE_KEY) return false
  // mailto: is required by the spec; it identifies the sender to the push service.
  webpush.setVapidDetails('mailto:info@kombacabana.com', PUBLIC_KEY, PRIVATE_KEY)
  return true
}

/** Lets the UI explain what is missing instead of failing silently. */
export async function getPushConfig(): Promise<{ configured: boolean; publicKey: string | null }> {
  return { configured: !!(PUBLIC_KEY && PRIVATE_KEY), publicKey: PUBLIC_KEY ?? null }
}

export async function savePushSubscription(
  person: PushTarget,
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  userAgent?: string,
) {
  const { endpoint, keys } = subscription
  if (!endpoint || !keys?.p256dh || !keys?.auth) return { ok: false, error: 'Nepopolna naročnina.' }

  const id = `push-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`
  // The browser hands back the same endpoint for the same device, so upsert on it —
  // otherwise re-enabling notifications would pile up duplicate rows and ring twice.
  await db.execute(sql`
    INSERT INTO push_subscriptions (id, person, endpoint, p256dh, auth, "userAgent", "lastSeenAt")
    VALUES (${id}, ${person}, ${endpoint}, ${keys.p256dh}, ${keys.auth}, ${userAgent ?? null}, now())
    ON CONFLICT (endpoint) DO UPDATE
      SET person = ${person}, p256dh = ${keys.p256dh}, auth = ${keys.auth},
          "userAgent" = ${userAgent ?? null}, "lastSeenAt" = now()
  `)
  return { ok: true }
}

export async function removePushSubscription(endpoint: string) {
  if (!endpoint) return { ok: false }
  await db.execute(sql`DELETE FROM push_subscriptions WHERE endpoint = ${endpoint}`)
  return { ok: true }
}

/** How many devices will ring for this person — drives the UI status line. */
export async function countPushDevices(person: PushTarget): Promise<number> {
  const res = await db.execute(sql`SELECT count(*)::int AS n FROM push_subscriptions WHERE person = ${person}`)
  const rows = res.rows as { n: number }[]
  return rows[0]?.n ?? 0
}

export type PushMessage = {
  id: string
  person: string
  title: string
  body: string
  source: string
  sentCount: number
  failedCount: number
  createdAt: string
  /** When the recipient acknowledged it — null means not read yet. */
  readAt: string | null
  /** Set when the recipient cleared it from their own inbox. */
  deletedAt: string | null
  /**
   * Set when the sender cleared it from their own sent list. A separate flag from
   * deletedAt on purpose: both lists read the same row, so each side has to be
   * able to tidy its own view without touching the other's.
   */
  senderDeletedAt: string | null
}

/**
 * What was sent to whom — the sender needs to look this up later, including
 * whether it has been read.
 */
export async function getPushMessages(person: PushTarget, limit = 20): Promise<PushMessage[]> {
  // Filtered by "senderDeletedAt", never by "deletedAt": the recipient clearing
  // their inbox must not wipe the sender's own record of having sent it.
  const res = await db.execute(sql`
    SELECT id, person, title, body, source, "sentCount", "failedCount", "createdAt", "readAt", "deletedAt", "senderDeletedAt"
    FROM push_messages
    WHERE person = ${person}
      AND "senderDeletedAt" IS NULL
    ORDER BY "createdAt" DESC
    LIMIT ${limit}
  `)
  return res.rows as PushMessage[]
}

/** The sender's own trash, so a wrongly cleared sent reminder can come back. */
export async function getSenderTrashedPushMessages(person: PushTarget, limit = 20): Promise<PushMessage[]> {
  const res = await db.execute(sql`
    SELECT id, person, title, body, source, "sentCount", "failedCount", "createdAt", "readAt", "deletedAt", "senderDeletedAt"
    FROM push_messages
    WHERE person = ${person}
      AND "senderDeletedAt" IS NOT NULL
    ORDER BY "senderDeletedAt" DESC
    LIMIT ${limit}
  `)
  return res.rows as PushMessage[]
}

/**
 * The recipient's own inbox. Undelivered attempts are left out on purpose: they
 * never reached this phone, so listing them as "received" would be a lie — the
 * sender does see them in their sent list.
 */
export async function getReceivedPushMessages(person: PushTarget, limit = 20): Promise<PushMessage[]> {
  const res = await db.execute(sql`
    SELECT id, person, title, body, source, "sentCount", "failedCount", "createdAt", "readAt", "deletedAt", "senderDeletedAt"
    FROM push_messages
    WHERE person = ${person}
      AND "sentCount" > 0
      AND "deletedAt" IS NULL
    ORDER BY "createdAt" DESC
    LIMIT ${limit}
  `)
  return res.rows as PushMessage[]
}

/** What this person cleared away, so a mistake can be undone. */
export async function getTrashedPushMessages(person: PushTarget, limit = 20): Promise<PushMessage[]> {
  const res = await db.execute(sql`
    SELECT id, person, title, body, source, "sentCount", "failedCount", "createdAt", "readAt", "deletedAt", "senderDeletedAt"
    FROM push_messages
    WHERE person = ${person}
      AND "deletedAt" IS NOT NULL
    ORDER BY "deletedAt" DESC
    LIMIT ${limit}
  `)
  return res.rows as PushMessage[]
}

/**
 * Reminders this person has not acknowledged yet. The app reads them on open, so
 * the card no longer depends on the notification tap carrying the text — a phone
 * running an older service worker, or a notification swiped away before it was
 * read, still ends up showing the reminder.
 *
 * Older than a day is history, not something to pop up: it would be stale by the
 * time it is seen.
 */
export async function getUnreadPushMessages(person: PushTarget): Promise<PushMessage[]> {
  const res = await db.execute(sql`
    SELECT id, person, title, body, source, "sentCount", "failedCount", "createdAt", "readAt", "deletedAt", "senderDeletedAt"
    FROM push_messages
    WHERE person = ${person}
      AND "readAt" IS NULL
      AND "sentCount" > 0
      AND "deletedAt" IS NULL
      AND "createdAt" > now() - interval '24 hours'
    ORDER BY "createdAt" ASC
    LIMIT 5
  `)
  return res.rows as PushMessage[]
}

/** Called when the recipient closes the card by hand. */
export async function markPushMessageRead(id: string) {
  if (!id) return { ok: false }
  await db.execute(sql`UPDATE push_messages SET "readAt" = now() WHERE id = ${id}`)
  return { ok: true }
}

/**
 * The recipient clears a reminder out of their own inbox. Deliberately a flag and
 * not a DELETE: the same row is the sender's record of what they sent and whether
 * it was read, so removing it would erase their history too. It disappears here
 * only — and it can be put back.
 */
export async function trashPushMessage(id: string) {
  if (!id) return { ok: false }
  await db.execute(sql`UPDATE push_messages SET "deletedAt" = now() WHERE id = ${id}`)
  return { ok: true }
}

/** Undo for the above, in case the wrong one was cleared. */
export async function restorePushMessage(id: string) {
  if (!id) return { ok: false }
  await db.execute(sql`UPDATE push_messages SET "deletedAt" = NULL WHERE id = ${id}`)
  return { ok: true }
}

/** The sender tidies their own sent list. The recipient's copy is untouched. */
export async function trashSentPushMessage(id: string) {
  if (!id) return { ok: false }
  await db.execute(sql`UPDATE push_messages SET "senderDeletedAt" = now() WHERE id = ${id}`)
  return { ok: true }
}

export async function restoreSentPushMessage(id: string) {
  if (!id) return { ok: false }
  await db.execute(sql`UPDATE push_messages SET "senderDeletedAt" = NULL WHERE id = ${id}`)
  return { ok: true }
}

/**
 * Records the attempt, including failed ones — a reminder that never arrived is
 * exactly what the sender needs to see. Never throws: losing the log must not
 * turn a delivered notification into an error.
 */
async function logPushMessage(
  person: PushTarget,
  message: { title: string; body: string },
  source: string,
  sent: number,
  failed: number,
) {
  try {
    const id = `pmsg-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`
    await db.execute(sql`
      INSERT INTO push_messages (id, person, title, body, source, "sentCount", "failedCount")
      VALUES (${id}, ${person}, ${message.title}, ${message.body}, ${source}, ${sent}, ${failed})
    `)
  } catch (err) {
    console.log('[v0] push log failed:', (err as Error)?.message)
  }
}

export async function sendPushToPerson(
  person: PushTarget,
  message: { title: string; body: string; url?: string },
  /** 'manual' from the reminder box, 'task' from a newly assigned daily task. */
  source: 'manual' | 'task' = 'manual',
): Promise<{ sent: number; failed: number; error?: string }> {
  if (!configureWebPush()) {
    return { sent: 0, failed: 0, error: 'Potisna obvestila niso nastavljena (manjkata ključa VAPID).' }
  }

  const res = await db.execute(
    sql`SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE person = ${person}`,
  )
  const subs = res.rows as SubscriptionRow[]
  if (!subs.length) {
    await logPushMessage(person, message, source, 0, 0)
    return { sent: 0, failed: 0, error: `${person} še ni vklopil obvestil na svojem telefonu.` }
  }

  const payload = JSON.stringify({
    title: message.title,
    body: message.body,
    url: message.url ?? '/',
  })

  let sent = 0
  let failed = 0
  const stale: string[] = []

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
          { urgency: 'high', TTL: 24 * 60 * 60 },
        )
        sent++
      } catch (err: unknown) {
        failed++
        const status = (err as { statusCode?: number })?.statusCode
        // 404/410 mean the browser threw the subscription away (app uninstalled,
        // notifications revoked). Collect and prune so we stop retrying forever.
        if (status === 404 || status === 410) stale.push(s.endpoint)
        else console.log('[v0] push failed:', status, (err as Error)?.message)
      }
    }),
  )

  for (const endpoint of stale) {
    await db.execute(sql`DELETE FROM push_subscriptions WHERE endpoint = ${endpoint}`)
  }

  await logPushMessage(person, message, source, sent, failed)

  return { sent, failed }
}
