"use server"

// Weather for the lodge, read off Open-Meteo (ECMWF/GFS).
//
// Why not Windy: a Windy Premium subscription covers windy.com itself, not data
// access. Their Point Forecast API is a separate 990 EUR/year product, and its
// free tier deliberately returns degraded values — useless for deciding whether
// a boat runs. Open-Meteo serves the same underlying models, needs no key, and
// is free for non-commercial use. The Windy map stays embedded alongside these
// numbers, so nothing Borut is used to reading is lost.

import { LODGE, SEA_LIMITS } from "@/lib/lodge"

export type VremeUra = {
  time: string
  temp: number | null
  wind: number | null
  gusts: number | null
  dir: number | null
  rainChance: number | null
  rain: number | null
  waves: number | null
  /** Sea level against mean sea level, in metres. Not a depth. */
  tide: number | null
  code: number | null
  /** Share of ensemble members whose gusts reach the caution limit, 0–100.
   *  Null when the ensemble call failed or this hour is beyond its range. */
  pCaution: number | null
  /** Same, for the danger limit. */
  pDanger: number | null
  /** Lowest and highest gust any member gives for this hour, in km/h. */
  enLo: number | null
  enHi: number | null
}

/** One forecast model's reading for the current hour.
 *
 *  This is the thing people actually open Windy Premium for: not a prettier
 *  number, but the ability to see whether the models agree. Measured on site,
 *  the four can sit anywhere from 8 to 28 km/h for the same hour — and when
 *  they disagree that widely, the disagreement matters more than any single
 *  figure, because it decides whether a boat runs. */
export type ModelGust = {
  id: string
  label: string
  wind: number | null
  gusts: number | null
  /** True for the automatic pick the rest of the card's figures come from. */
  primary: boolean
}

/** A turn of the tide: the moment the water stops rising or falling. */
export type Plima = {
  time: string
  kind: "high" | "low"
  height: number
}

export type VremeData = {
  fetchedAt: string
  /** Lodge-local "now" as the model reports it, e.g. "2026-08-26T13:15". Used to
   *  drop hours already gone by — never derived from the viewer's clock. */
  nowLocal: string | null
  current: {
    temp: number | null
    wind: number | null
    gusts: number | null
    dir: number | null
    rain: number | null
    code: number | null
    waves: number | null
    wavePeriod: number | null
    waveDir: number | null
  }
  hours: VremeUra[]
  /** Turns of the tide, chronological, spanning the whole forecast window. */
  tides: Plima[]
  /** Per-model readings for the current hour. Empty if that call failed — the
   *  comparison is a bonus and must never take the main forecast down. */
  models: ModelGust[]
  /** Set when the marine model had no data — wind still shown, waves blank. */
  seaMissing: boolean
}

/** Wind is stored and thresholded in km/h — the unit the API returns natively —
 *  and converted for display. Keeping one canonical unit means the sea-state
 *  thresholds can never silently disagree with what is on screen. */
const round2 = (v: number) => Math.round(v * 100) / 100

/** Shift a bare local timestamp ("2026-08-26T15:00") by a fractional number of
 *  hours. Parsed as UTC and printed back the same way, so the arithmetic never
 *  drags the value into another timezone. */
function shiftHours(t: string, hours: number): string {
  const ms = Date.parse(`${t}:00Z`)
  if (!Number.isFinite(ms)) return t
  return new Date(ms + hours * 3600_000).toISOString().slice(0, 16)
}

/** Find the turns of the tide in an hourly sea-level series.
 *
 *  Hourly samples alone would put every high and low water on the hour, up to
 *  30 minutes off. Fitting a parabola through the sample and its two neighbours
 *  puts the turn within a few minutes, which is the difference between catching
 *  the water and dragging the boat. */
function tideTurns(times: string[], vals: (number | null)[]): Plima[] {
  const out: Plima[] = []
  for (let i = 1; i < vals.length - 1; i++) {
    const a = vals[i - 1]
    const b = vals[i]
    const c = vals[i + 1]
    if (a == null || b == null || c == null) continue
    const isHigh = b > a && b >= c
    const isLow = b < a && b <= c
    if (!isHigh && !isLow) continue

    const denom = a - 2 * b + c
    // Vertex of the parabola, in hours either side of this sample.
    const shift = denom === 0 ? 0 : (0.5 * (a - c)) / denom
    const peak = b - 0.25 * (a - c) * shift
    out.push({
      time: shiftHours(times[i], Math.max(-0.5, Math.min(0.5, shift))),
      kind: isHigh ? "high" : "low",
      height: round2(peak),
    })
  }
  return out
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null)

/** The models Windy itself draws on, plus best_match — the automatic pick that
 *  every other figure on this card comes from.
 *
 *  best_match has to be in here. Measured live for this location it read 44.3
 *  km/h while the four named models sat between 18.7 and 33.1: leaving it out
 *  put the card's own headline number outside the range printed beneath it,
 *  which reads as a contradiction. Listing it makes the gap the point.
 *
 *  Keys come back suffixed per model, e.g. wind_gusts_10m_ecmwf_ifs025.
 *  ecmwf_ifs04 is deliberately absent: it returned nulls here. */
const MODELS = [
  { id: "best_match", label: "Naš prikaz", primary: true },
  { id: "ecmwf_ifs025", label: "ECMWF", primary: false },
  { id: "gfs_seamless", label: "GFS", primary: false },
  { id: "icon_seamless", label: "ICON", primary: false },
  { id: "meteofrance_seamless", label: "Météo-France", primary: false },
] as const

export async function getVreme(): Promise<{ ok: true; data: VremeData } | { ok: false; error: string }> {
  const { lat, lon } = LODGE
  const tz = "Indian%2FAntananarivo"

  // No wind_speed_unit: km/h is the API default and our canonical unit. The
  // client converts to m/s on request.
  const airUrl =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,wind_speed_10m,wind_gusts_10m,wind_direction_10m,precipitation,weather_code` +
    `&hourly=temperature_2m,wind_speed_10m,wind_gusts_10m,wind_direction_10m,precipitation,precipitation_probability,weather_code` +
    `&timezone=${tz}&forecast_days=4`

  // sea_level_height_msl is the tide: height against mean sea level, so it goes
  // negative at low water. It is not a depth and not chart datum.
  const seaUrl =
    `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}` +
    `&current=wave_height,wave_direction,wave_period&hourly=wave_height,sea_level_height_msl` +
    `&timezone=${tz}&forecast_days=4`

  // Same endpoint, but asking each model separately so they can be compared.
  // Two days is plenty: only the current hour is shown.
  const modelUrl =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&hourly=wind_speed_10m,wind_gusts_10m&models=${MODELS.map((m) => m.id).join(",")}` +
    `&timezone=${tz}&forecast_days=2`

  // The ensemble: ECMWF run 51 times over from slightly different starting
  // states. One run says what will happen; 51 runs say how likely it is, which
  // is the only honest basis for calling a transfer off. Separate host.
  const ensembleUrl =
    `https://ensemble-api.open-meteo.com/v1/ensemble?latitude=${lat}&longitude=${lon}` +
    `&hourly=wind_gusts_10m&models=ecmwf_ifs025&timezone=${tz}&forecast_days=4`

  try {
    // Revalidate every 15 min: the models do not update faster than that, and it
    // keeps repeated visits off the network.
    const opts = { next: { revalidate: 900 } } as const
    const [airRes, seaRes, modelRes, ensRes] = await Promise.all([
      fetch(airUrl, opts),
      // The sea is optional: a marine outage must not blank out the wind.
      fetch(seaUrl, opts).catch(() => null),
      // So is the comparison.
      fetch(modelUrl, opts).catch(() => null),
      // And so are the odds.
      fetch(ensembleUrl, opts).catch(() => null),
    ])

    if (!airRes.ok) return { ok: false, error: `Vremenski vir ni odgovoril (${airRes.status})` }

    const air = await airRes.json()
    const sea = seaRes && seaRes.ok ? await seaRes.json().catch(() => null) : null
    const mdl = modelRes && modelRes.ok ? await modelRes.json().catch(() => null) : null

    // Pick the hour the lodge is actually in. nowLocal looks like
    // "2026-08-26T13:15", so the matching hourly key is "2026-08-26T13:00" —
    // sliced, never recomputed from a Date, which would shift the hour.
    const nowLocal: string | null = typeof air?.current?.time === "string" ? air.current.time : null
    const hourKey = nowLocal ? `${nowLocal.slice(0, 13)}:00` : null
    const mdlTimes: string[] = mdl?.hourly?.time ?? []
    const mdlIdx = hourKey ? mdlTimes.indexOf(hourKey) : -1
    const models: ModelGust[] =
      mdlIdx >= 0
        ? MODELS.map((m) => ({
            id: m.id,
            label: m.label,
            primary: m.primary,
            wind: num(mdl.hourly[`wind_speed_10m_${m.id}`]?.[mdlIdx]),
            gusts: num(mdl.hourly[`wind_gusts_10m_${m.id}`]?.[mdlIdx]),
          })).filter((m) => m.gusts != null)
        : []

    const ens = ensRes && ensRes.ok ? await ensRes.json().catch(() => null) : null

    // Ensemble members come back as sibling keys: wind_gusts_10m (the control
    // run) plus wind_gusts_10m_member01…member50. All 51 count as one opinion
    // each. Keyed by timestamp, never by index, since this is a separate host
    // with its own time array.
    const riskAt = new Map<string, { pCaution: number; pDanger: number; lo: number; hi: number }>()
    const ensHourly = ens?.hourly
    if (ensHourly?.time) {
      const memberKeys = Object.keys(ensHourly).filter((k) => k.startsWith("wind_gusts_10m"))
      ;(ensHourly.time as string[]).forEach((t: string, i: number) => {
        const vals = memberKeys.map((k) => num(ensHourly[k]?.[i])).filter((v): v is number => v != null)
        if (vals.length < 10) return // too thin a sample to quote a percentage
        const over = (limit: number) => Math.round((vals.filter((v) => v >= limit).length / vals.length) * 100)
        riskAt.set(t, {
          pCaution: over(SEA_LIMITS.cautionGusts),
          pDanger: over(SEA_LIMITS.dangerGusts),
          lo: round2(Math.min(...vals)),
          hi: round2(Math.max(...vals)),
        })
      })
    }

    // Wave times are their own array; match by timestamp rather than by index so a
    // shifted series can never label waves with the wrong hour.
    const waveAt = new Map<string, number | null>()
    const tideAt = new Map<string, number | null>()
    const seaTimes: string[] = sea?.hourly?.time ?? []
    seaTimes.forEach((t: string, i: number) => {
      waveAt.set(t, num(sea?.hourly?.wave_height?.[i]))
      tideAt.set(t, num(sea?.hourly?.sea_level_height_msl?.[i]))
    })

    const tides = tideTurns(
      seaTimes,
      seaTimes.map((t: string) => tideAt.get(t) ?? null)
    )

    const times: string[] = air?.hourly?.time ?? []
    const hours: VremeUra[] = times.map((t: string, i: number) => ({
      time: t,
      temp: num(air.hourly.temperature_2m?.[i]),
      wind: num(air.hourly.wind_speed_10m?.[i]),
      gusts: num(air.hourly.wind_gusts_10m?.[i]),
      dir: num(air.hourly.wind_direction_10m?.[i]),
      rain: num(air.hourly.precipitation?.[i]),
      rainChance: num(air.hourly.precipitation_probability?.[i]),
      waves: waveAt.get(t) ?? null,
      tide: tideAt.get(t) ?? null,
      code: num(air.hourly.weather_code?.[i]),
      pCaution: riskAt.get(t)?.pCaution ?? null,
      pDanger: riskAt.get(t)?.pDanger ?? null,
      enLo: riskAt.get(t)?.lo ?? null,
      enHi: riskAt.get(t)?.hi ?? null,
    }))

    return {
      ok: true,
      data: {
        fetchedAt: new Date().toISOString(),
        nowLocal,
        current: {
          temp: num(air.current?.temperature_2m),
          wind: num(air.current?.wind_speed_10m),
          gusts: num(air.current?.wind_gusts_10m),
          dir: num(air.current?.wind_direction_10m),
          rain: num(air.current?.precipitation),
          code: num(air.current?.weather_code),
          waves: num(sea?.current?.wave_height),
          wavePeriod: num(sea?.current?.wave_period),
          waveDir: num(sea?.current?.wave_direction),
        },
        hours,
        tides,
        models,
        seaMissing: !sea,
      },
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Vremenskih podatkov ni bilo mogoče pridobiti" }
  }
}
