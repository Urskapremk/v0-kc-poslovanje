'use server'

import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

/** Raw nationality as typed into the police form, with the number of guests carrying it. */
export type VisitorNationality = { nationality: string; guests: number }

/** One season of visitors, newest year first. */
export type VisitorYear = { year: number; nationalities: VisitorNationality[] }

/**
 * Guests who have actually stayed with us, grouped by year and by the country on record.
 *
 * Two sources feed this, because the older seasons never made it into the system:
 *
 *   `entered`  — reservations with a police form. Counts every guest slot (the form
 *                records a nationality per person, up to four), so a Brazilian husband
 *                and a German wife count as one guest each rather than one booking.
 *                Only checked-in reservations count as a visit; future bookings have
 *                not been here yet.
 *
 *   `bentral`  — confirmed Bentral bookings that were never transferred. Those guests
 *                were here, they simply never got a police form, so the booking's own
 *                country and head count stand in. Cancelled, unanswered and merely
 *                offered bookings are left out, as are stays that have not ended yet.
 *
 * Bentral splits a stay into one row per price period (and sometimes exports the tail
 * of a stay twice over), so counting rows would inflate every season. Rows for the same
 * guest are therefore collapsed into a single visit, and only a gap of more than a week
 * starts a new one — that keeps a genuine second holiday separate. The head count of a
 * visit is the largest one seen across its rows.
 *
 * A Bentral booking is dropped when that guest already has a police form for the same
 * year; without one, Bentral fills the gap instead of the guest going uncounted.
 *
 * Countries come back exactly as they were recorded ("German", "Nemčija", "Getman"):
 * the folding of spellings onto one country lives in lib/country-flag.ts, so the same
 * rules apply here as next to the guest names.
 */
export async function getVisitorNationalities(): Promise<VisitorYear[]> {
  const result = await db.execute(sql`
    WITH slots AS (
      SELECT arrival,
             unnest(ARRAY[nationality, "secondNationality", "thirdNationality", "fourthNationality"]) AS nationality
      FROM reservations
      WHERE status <> 'CANCELLED' AND "checkedInAt" IS NOT NULL
    ),
    entered AS (
      SELECT EXTRACT(YEAR FROM arrival)::int AS year,
             btrim(nationality) AS nationality,
             COUNT(*)::int AS guests
      FROM slots
      WHERE nationality IS NOT NULL AND btrim(nationality) <> ''
      GROUP BY 1, 2
    ),
    bentral_rows AS (
      SELECT lower(btrim(b."guestName")) AS guest_key,
             btrim(b.country) AS nationality,
             b."checkIn"::date AS check_in,
             b."checkOut"::date AS check_out,
             COALESCE(b.adults, 0) + COALESCE(b.children, 0) AS heads,
             EXTRACT(YEAR FROM b."checkIn")::int AS year
      FROM bentral_reservations b
      WHERE b.active = true
        AND b.transferred = false
        AND b.status IN ('Potrjeno', 'Plačano (1. del)')
        AND b."checkOut" < CURRENT_DATE
        AND b.country IS NOT NULL AND btrim(b.country) <> ''
    ),
    -- More than a week between two rows means a separate holiday, not a price period.
    marked AS (
      SELECT *,
             CASE
               WHEN check_in - LAG(check_out) OVER (PARTITION BY guest_key, year ORDER BY check_in) > 7
               THEN 1 ELSE 0
             END AS starts_visit
      FROM bentral_rows
    ),
    visits AS (
      SELECT *,
             SUM(starts_visit) OVER (
               PARTITION BY guest_key, year ORDER BY check_in ROWS UNBOUNDED PRECEDING
             ) AS visit_no
      FROM marked
    ),
    bentral AS (
      SELECT v.year, MIN(v.nationality) AS nationality, MAX(v.heads)::int AS guests
      FROM visits v
      WHERE NOT EXISTS (
        SELECT 1 FROM reservations r
        WHERE lower(btrim(r."guestName")) = v.guest_key
          AND EXTRACT(YEAR FROM r.arrival)::int = v.year
          AND (COALESCE(btrim(r.nationality), '') <> ''
            OR COALESCE(btrim(r."secondNationality"), '') <> ''
            OR COALESCE(btrim(r."thirdNationality"), '') <> ''
            OR COALESCE(btrim(r."fourthNationality"), '') <> '')
      )
      GROUP BY v.year, v.guest_key, v.visit_no
    )
    SELECT year, nationality, SUM(guests)::int AS guests
    FROM (SELECT * FROM entered UNION ALL SELECT * FROM bentral) AS combined
    GROUP BY year, nationality
    ORDER BY year DESC, guests DESC
  `)

  const years = new Map<number, VisitorNationality[]>()
  for (const row of result.rows) {
    const year = Number(row.year ?? 0)
    if (!year) continue
    const list = years.get(year) ?? []
    list.push({
      nationality: String(row.nationality ?? ''),
      guests: Number(row.guests ?? 0),
    })
    years.set(year, list)
  }

  return [...years.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, nationalities]) => ({ year, nationalities }))
}

/** Guest-nights (osebe × noči) for one season, newest year first. */
export type OvernightYear = { year: number; nights: number }

/**
 * Overnight stays per year — the tourism "nočitve" figure, i.e. guest-nights
 * (each guest counted once per night stayed), not bookings or room-nights.
 *
 * Mirrors getVisitorNationalities so the two panels always agree on who counts as
 * a real visit: checked-in reservations plus confirmed, untransferred Bentral stays
 * that have already ended. A stay contributes (nights × heads); Bentral price-period
 * rows for the same guest are collapsed into one visit (a gap over a week starts a
 * new one), and a Bentral stay is dropped when that guest already has a checked-in
 * reservation the same year, so nobody is counted twice.
 */
export async function getOvernightStaysByYear(): Promise<OvernightYear[]> {
  const result = await db.execute(sql`
    WITH entered AS (
      SELECT EXTRACT(YEAR FROM arrival)::int AS year,
             (departure - arrival) * GREATEST(COALESCE(pax, 0), COALESCE(adults, 0) + COALESCE(children, 0), 1) AS nights
      FROM reservations
      WHERE status <> 'CANCELLED' AND "checkedInAt" IS NOT NULL AND departure > arrival
    ),
    bentral_rows AS (
      SELECT lower(btrim(b."guestName")) AS guest_key,
             b."checkIn"::date AS check_in,
             b."checkOut"::date AS check_out,
             COALESCE(b.adults, 0) + COALESCE(b.children, 0) AS heads,
             EXTRACT(YEAR FROM b."checkIn")::int AS year
      FROM bentral_reservations b
      WHERE b.active = true
        AND b.transferred = false
        AND b.status IN ('Potrjeno', 'Plačano (1. del)')
        AND b."checkOut" < CURRENT_DATE
    ),
    marked AS (
      SELECT *,
             CASE
               WHEN check_in - LAG(check_out) OVER (PARTITION BY guest_key, year ORDER BY check_in) > 7
               THEN 1 ELSE 0
             END AS starts_visit
      FROM bentral_rows
    ),
    visits AS (
      SELECT *,
             SUM(starts_visit) OVER (
               PARTITION BY guest_key, year ORDER BY check_in ROWS UNBOUNDED PRECEDING
             ) AS visit_no
      FROM marked
    ),
    bentral AS (
      SELECT v.year, (MAX(v.check_out) - MIN(v.check_in)) * GREATEST(MAX(v.heads), 1) AS nights
      FROM visits v
      WHERE NOT EXISTS (
        SELECT 1 FROM reservations r
        WHERE lower(btrim(r."guestName")) = v.guest_key
          AND EXTRACT(YEAR FROM r.arrival)::int = v.year
          AND r.status <> 'CANCELLED' AND r."checkedInAt" IS NOT NULL
      )
      GROUP BY v.year, v.guest_key, v.visit_no
    )
    SELECT year, SUM(nights)::int AS nights
    FROM (SELECT year, nights FROM entered UNION ALL SELECT year, nights FROM bentral) AS combined
    GROUP BY year
    ORDER BY year DESC
  `)

  return result.rows
    .map(row => ({ year: Number(row.year ?? 0), nights: Number(row.nights ?? 0) }))
    .filter(r => r.year > 0)
}
