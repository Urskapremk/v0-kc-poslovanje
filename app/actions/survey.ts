'use server'

import { db } from '@/lib/db'
import { reservations } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'
import { findSurveySource } from '@/lib/survey-sources'

export interface SurveyResponseRecord {
  id: string
  reservationId: string | null
  guestName: string | null
  bungalow: string | null
  source: string
  sourceLabel: string | null
  comment: string | null
  createdAt: string
}

export interface SurveySummaryRow {
  source: string
  sourceLabel: string | null
  count: number
}

// Best-effort lookup of guest name + bungalow for a friendlier admin view.
async function guestInfo(reservationId: string): Promise<{ guestName: string; bungalow: string }> {
  try {
    const rows = await db
      .select({ guestName: reservations.guestName, bungalow: reservations.bungalow })
      .from(reservations)
      .where(eq(reservations.id, reservationId))
      .limit(1)
    if (rows[0]) {
      return {
        guestName: (rows[0].guestName as string) || '',
        bungalow: (rows[0].bungalow as string) || '',
      }
    }
  } catch {
    /* ignore */
  }
  return { guestName: '', bungalow: '' }
}

// Public: record a guest's answer when they tap a source button in the email.
// Idempotent — a reservation+source pair is stored at most once, so re-opening
// the link (or toggling it back on) never creates duplicates.
export async function recordSurveyResponse(
  reservationId: string,
  sourceKey: string
): Promise<{ id: string; guestName: string; sourceLabel: string; selected: string[] }> {
  const src = findSurveySource(sourceKey)
  const sourceLabel = src?.label || sourceKey
  const { guestName, bungalow } = await guestInfo(reservationId)

  // Only insert if this reservation+source is not already recorded.
  const existing = await db.execute(sql`
    SELECT id FROM guest_survey_responses
    WHERE "reservationId" = ${reservationId} AND source = ${sourceKey}
    LIMIT 1
  `)
  let id: string
  if ((existing.rows as unknown[]).length > 0) {
    id = (existing.rows[0] as Record<string, unknown>).id as string
  } else {
    id = `srv-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    await db.execute(sql`
      INSERT INTO guest_survey_responses (id, "reservationId", "guestName", bungalow, source, "sourceLabel")
      VALUES (${id}, ${reservationId || null}, ${guestName || null}, ${bungalow || null}, ${sourceKey}, ${sourceLabel})
    `)
  }

  const selected = await getSelectedSources(reservationId)
  return { id, guestName, sourceLabel, selected }
}

// Public: which sources this reservation has already chosen.
export async function getSelectedSources(reservationId: string): Promise<string[]> {
  try {
    const result = await db.execute(sql`
      SELECT source FROM guest_survey_responses WHERE "reservationId" = ${reservationId}
    `)
    return (result.rows as Record<string, unknown>[]).map((r) => r.source as string)
  } catch {
    return []
  }
}

// Public: add or remove a single source for a reservation (multi-select support).
export async function toggleSurveySource(
  reservationId: string,
  sourceKey: string,
  selected: boolean
): Promise<{ success: boolean; selected: string[] }> {
  const src = findSurveySource(sourceKey)
  if (!src) return { success: false, selected: await getSelectedSources(reservationId) }
  try {
    if (selected) {
      const existing = await db.execute(sql`
        SELECT id FROM guest_survey_responses
        WHERE "reservationId" = ${reservationId} AND source = ${sourceKey}
        LIMIT 1
      `)
      if ((existing.rows as unknown[]).length === 0) {
        const { guestName, bungalow } = await guestInfo(reservationId)
        const id = `srv-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
        await db.execute(sql`
          INSERT INTO guest_survey_responses (id, "reservationId", "guestName", bungalow, source, "sourceLabel")
          VALUES (${id}, ${reservationId || null}, ${guestName || null}, ${bungalow || null}, ${sourceKey}, ${src.label})
        `)
      }
    } else {
      await db.execute(sql`
        DELETE FROM guest_survey_responses
        WHERE "reservationId" = ${reservationId} AND source = ${sourceKey}
      `)
    }
    return { success: true, selected: await getSelectedSources(reservationId) }
  } catch {
    return { success: false, selected: await getSelectedSources(reservationId) }
  }
}

// Public: attach an optional free-text comment to all of a reservation's responses.
export async function addSurveyComment(
  reservationId: string,
  comment: string
): Promise<{ success: boolean }> {
  const trimmed = (comment || '').trim().slice(0, 1000)
  if (!trimmed) return { success: true }
  try {
    await db.execute(sql`
      UPDATE guest_survey_responses SET comment = ${trimmed} WHERE "reservationId" = ${reservationId}
    `)
    return { success: true }
  } catch {
    return { success: false }
  }
}

// Admin: all responses, newest first.
export async function getSurveyResponses(limit = 300): Promise<SurveyResponseRecord[]> {
  const result = await db.execute(sql`
    SELECT id, "reservationId", "guestName", bungalow, source, "sourceLabel", comment, "createdAt"
    FROM guest_survey_responses
    ORDER BY "createdAt" DESC
    LIMIT ${limit}
  `)
  return (result.rows as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    reservationId: (r.reservationId as string) ?? null,
    guestName: (r.guestName as string) ?? null,
    bungalow: (r.bungalow as string) ?? null,
    source: r.source as string,
    sourceLabel: (r.sourceLabel as string) ?? null,
    comment: (r.comment as string) ?? null,
    createdAt: new Date(r.createdAt as string).toISOString(),
  }))
}

// Admin: counts grouped by source (most common first).
export async function getSurveySummary(): Promise<SurveySummaryRow[]> {
  const result = await db.execute(sql`
    SELECT source, MAX("sourceLabel") AS "sourceLabel", COUNT(*)::int AS count
    FROM guest_survey_responses
    GROUP BY source
    ORDER BY count DESC
  `)
  return (result.rows as Record<string, unknown>[]).map((r) => ({
    source: r.source as string,
    sourceLabel: (r.sourceLabel as string) ?? null,
    count: Number(r.count),
  }))
}

// Admin: delete a response from the log.
export async function deleteSurveyResponse(id: string): Promise<{ success: boolean }> {
  try {
    await db.execute(sql`DELETE FROM guest_survey_responses WHERE id = ${id}`)
    return { success: true }
  } catch {
    return { success: false }
  }
}
