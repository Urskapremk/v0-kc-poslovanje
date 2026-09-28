'use server'

import { get } from '@vercel/blob'
import { generateObject } from 'ai'
import { z } from 'zod'
import { getSignedLeaveDays, saveAttendanceDay } from './payroll'

// Model za razclembo rokopisa (mocan vision model prek AI Gateway).
const VISION_MODEL = 'google/gemini-2.5-flash'

export type ParsedAttendanceResult = {
  ok: boolean
  error?: string
  days: {
    day: number
    status: 'work' | 'leave' | 'off'
    from: string | null
    to: string | null
  }[]
  summary: {
    workDays: number
    leaveDays: number
    offDays: number
  }
}

const daySchema = z.object({
  day: z.number().int().describe('Dan v mesecu (1-31), iz stolpca Date'),
  arrival: z
    .string()
    .nullable()
    .describe('Ura prihoda (Arrivee) v 24-urni obliki HH:MM, ali null ce prazno'),
  departure: z
    .string()
    .nullable()
    .describe('Ura odhoda (Depart) v 24-urni obliki HH:MM, ali null ce prazno'),
})

const parseSchema = z.object({
  days: z.array(daySchema),
})

function toMinutes(t: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

// Delavci NE delajo nocnih izmen. Ce je ura odhoda "manjsa ali enaka" uri prihoda,
// je delavec zapisal popoldanski cas v 12-urni obliki (npr. odhod "04:00" pomeni 16:00,
// "05:00" pomeni 17:00). V tem primeru odhodu pristejemo 12 ur.
function normalizeShift(
  arrival: string | null,
  departure: string | null,
): { from: string | null; to: string | null } {
  if (!arrival || !departure) return { from: arrival, to: departure }
  const fromM = toMinutes(arrival)
  let toM = toMinutes(departure)
  if (fromM == null || toM == null) return { from: arrival, to: departure }
  let to = departure
  if (toM <= fromM) {
    const [h, m] = departure.split(':').map(Number)
    const nh = h + 12
    if (nh < 24) {
      to = `${pad(nh)}:${pad(m)}`
      toM = nh * 60 + m
    }
  }
  return { from: arrival, to }
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

async function blobToBase64(pathname: string): Promise<{ data: string; mediaType: string }> {
  const result = await get(pathname, { access: 'private' })
  if (!result || !result.stream) throw new Error('Slike ni mogoce prenesti')
  const chunks: Uint8Array[] = []
  const reader = result.stream.getReader()
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) chunks.push(value)
  }
  const buffer = Buffer.concat(chunks)
  return {
    data: buffer.toString('base64'),
    mediaType: result.blob.contentType || 'image/jpeg',
  }
}

/**
 * Razcleni naloženo sliko liste prisotnosti in samodejno vpise obračun ur
 * (attendance_days) za izbranega delavca in mesec.
 *
 * Pravila:
 *  - prazna vrstica (brez prihoda in odhoda) -> dopust (ce je dan v podpisanem dopustu), sicer prosto
 *  - delavci NE delajo nocnih izmen: ce je odhod <= prihod, gre za 12-urni zapis (odhod +12h)
 *  - nedelje in prazniki se dolocijo samodejno v obračunu (tu vpisemo le work/leave/off)
 */
export async function parseAttendanceFromImage(
  staffId: string,
  year: number,
  month: number,
  pathname: string,
): Promise<ParsedAttendanceResult> {
  return runParse(staffId, year, month, pathname, true)
}

/**
 * Enako kot parseAttendanceFromImage, a NE zapise v bazo (samo vrne razclenjene dneve).
 * Za testiranje/predogled natancnosti.
 */
export async function parseAttendancePreview(
  staffId: string,
  year: number,
  month: number,
  pathname: string,
): Promise<ParsedAttendanceResult> {
  return runParse(staffId, year, month, pathname, false)
}

async function runParse(
  staffId: string,
  year: number,
  month: number,
  pathname: string,
  write: boolean,
): Promise<ParsedAttendanceResult> {
  const empty: ParsedAttendanceResult = {
    ok: false,
    days: [],
    summary: { workDays: 0, leaveDays: 0, offDays: 0 },
  }

  let image: { data: string; mediaType: string }
  try {
    image = await blobToBase64(pathname)
  } catch (e) {
    return { ...empty, error: 'Slike ni mogoce prenesti iz shrambe.' }
  }

  const dim = daysInMonth(year, month)

  // Podpisani dopust za tega delavca (za prazne vrstice = dopust).
  let signedLeaveSet = new Set<number>()
  try {
    const signed = await getSignedLeaveDays(year, month)
    signedLeaveSet = new Set(signed[staffId] ?? [])
  } catch {
    // brez podpisanega dopusta -> prazne vrstice postanejo "prosto"
  }

  let parsed: z.infer<typeof parseSchema>
  try {
    const result = await generateObject({
      model: VISION_MODEL,
      schema: parseSchema,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text:
                `To je rocno izpolnjena mesecna lista prisotnosti (francoska glava: Jour, Date, Arrivee, Depart, Signature) za mesec ${month}/${year}.\n` +
                `Za VSAK dan od 1 do ${dim} preberi uro prihoda (Arrivee) in uro odhoda (Depart).\n` +
                `Pravila branja:\n` +
                `- Vrni ure v 24-urni obliki HH:MM (npr. "06:00", "12:30", "16:00").\n` +
                `- Ce je vrstica prazna (brez prihoda in odhoda), vrni null za oba (arrival in departure).\n` +
                `- Beri natancno rocno pisavo; dvopicja so lahko slabo vidna.\n` +
                `- Ne izpuscaj nobenega dne; vrni tocno ${dim} vnosov (dan 1 do ${dim}).`,
            },
            {
              type: 'file',
              mediaType: image.mediaType,
              data: image.data,
            },
          ],
        },
      ],
    })
    parsed = result.object
  } catch (e) {
    return { ...empty, error: 'AI razclemba slike ni uspela. Poskusite znova.' }
  }

  // Zberi po dnevu.
  const byDay = new Map<number, { arrival: string | null; departure: string | null }>()
  for (const row of parsed.days) {
    if (!row || typeof row.day !== 'number') continue
    if (row.day < 1 || row.day > dim) continue
    byDay.set(row.day, { arrival: row.arrival ?? null, departure: row.departure ?? null })
  }

  const outDays: ParsedAttendanceResult['days'] = []
  let workDays = 0
  let leaveDays = 0
  let offDays = 0

  for (let day = 1; day <= dim; day++) {
    const row = byDay.get(day)
    const hasTimes = !!row && (row.arrival || row.departure)
    if (hasTimes) {
      const { from, to } = normalizeShift(row!.arrival, row!.departure)
      outDays.push({ day, status: 'work', from, to })
      workDays++
    } else if (signedLeaveSet.has(day)) {
      outDays.push({ day, status: 'leave', from: null, to: null })
      leaveDays++
    } else {
      outDays.push({ day, status: 'off', from: null, to: null })
      offDays++
    }
  }

  // Zapisi v bazo (upsert po dnevu) — samo ce write.
  if (write) {
    try {
      await Promise.all(
        outDays.map((d) => saveAttendanceDay(staffId, year, month, d.day, d.status, d.from, d.to, 0)),
      )
    } catch (e) {
      return { ...empty, days: outDays, error: 'Vpis v bazo ni uspel.' }
    }
  }

  return {
    ok: true,
    days: outDays,
    summary: { workDays, leaveDays, offDays },
  }
}
