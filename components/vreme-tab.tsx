"use client"

import * as React from "react"
import useSWR from "swr"
import {
  Wind,
  Waves,
  Umbrella,
  Thermometer,
  Navigation,
  RefreshCw,
  TriangleAlert,
  ExternalLink,
  Loader2,
  ArrowUp,
  ArrowDown,
  ChevronDown,
} from "lucide-react"
import { getVreme, type VremeUra, type Plima } from "@/app/actions/vreme"
import { LODGE, SEA_LIMITS } from "@/lib/lodge"

// Eight points is as fine as anyone reads off a card; sixteen would just be noise.
const COMPASS = ["S", "SV", "V", "JV", "J", "JZ", "Z", "SZ"] as const
const dirLabel = (deg: number | null) =>
  deg == null ? "—" : COMPASS[Math.round((deg % 360) / 45) % 8]

/** Wind units, mirroring what Windy itself offers. Values arrive from the API in
 *  km/h, so that is the canonical unit: `factor` converts for display and
 *  `windy` is the embed's own parameter, both verified against the live map. */
const UNITS = [
  { id: "km/h", factor: 1, windy: "km%2Fh", dec: 0 },
  { id: "m/s", factor: 1 / 3.6, windy: "m%2Fs", dec: 1 },
] as const
type Unit = (typeof UNITS)[number]
const UNIT_KEY = "komba-vreme-enota"

// WMO codes, trimmed to what actually turns up on this coast.
const SKY: Record<number, string> = {
  0: "Jasno",
  1: "Večinoma jasno",
  2: "Delno oblačno",
  3: "Oblačno",
  45: "Megla",
  48: "Megla z ivjem",
  51: "Rahlo pršenje",
  53: "Pršenje",
  55: "Močno pršenje",
  61: "Rahel dež",
  63: "Dež",
  65: "Močan dež",
  80: "Ploha",
  81: "Močna ploha",
  82: "Zelo močna ploha",
  95: "Nevihta",
  96: "Nevihta s točo",
  99: "Huda nevihta s točo",
}
const skyLabel = (code: number | null) => (code == null ? "—" : SKY[code] ?? "—")

/** A rough read on whether the crossing will be pleasant, not a safety ruling —
 *  the skipper still decides. Thresholds are in km/h, the canonical unit, so
 *  switching the display to m/s can never move the boundaries. */
/** `color` dresses the badge and its label, where a muted tone sits well next to
 *  body text. `vivid` is for the tiny marks — the 2 px hour ticks and the day
 *  dots — which lose their hue entirely at that size, the same lesson the
 *  calendar's bar icons and the tide arrows taught. */
/** Three readings of one state, because the same badge now has to work on two
 *  backgrounds: `color` on sand, `light` on the dark head of the Zdaj card, and
 *  `vivid` for the tiny marks (hour ticks, day dots) that lose their hue at 2–6 px. */
type Stanje = {
  key: "ugodno" | "previdno" | "neugodno"
  label: string
  color: string
  vivid: string
  light: string
}
const seaState = (gustsKmh: number | null, waves: number | null): Stanje => {
  const g = gustsKmh ?? 0
  const w = waves ?? 0
  // Sand-card variants of the project palette: the lighter sage and gold used on
  // navy wash out on #efe8da, so these are the dark siblings.
  // Limits come from lib/lodge so the ensemble's odds describe the same lines.
  if (g >= SEA_LIMITS.dangerGusts || w >= SEA_LIMITS.dangerWaves)
    return { key: "neugodno", label: "Neugodno za čoln", color: "#b0203a", vivid: "#b0203a", light: "#f0a8b4" }
  if (g >= SEA_LIMITS.cautionGusts || w >= SEA_LIMITS.cautionWaves)
    return { key: "previdno", label: "Previdno", color: "#8f6d3a", vivid: "#a8761a", light: "#c59b5b" }
  return { key: "ugodno", label: "Ugodno", color: "#4f7a54", vivid: "#2f7f45", light: "#8fae92" }
}

/** Colour for a probability figure on the sand rows: the dark siblings of the
 *  palette, matching what seaState puts on the same background. A real chance of
 *  crossing the danger line outranks a high chance of merely choppy, which is
 *  why pDanger is tested first and at a low bar — a one-in-twenty risk of that
 *  is already worth a second thought before loading guests. */
const riskTone = (pCaution: number, pDanger: number): string =>
  pDanger >= 5 ? "#b0203a" : pCaution >= 50 ? "#a8761a" : "#8f6d3a"

/** Tide arrows, in one place. These are the project's saturated variants, not the
 *  muted #3f6b7d / #8f6d3a used for the surrounding text: at 12 px a low-saturation
 *  mid-tone loses its hue and both arrows read as the same grey. Applied via style,
 *  because Tailwind cannot build an arbitrary colour class from a variable. */
const TIDE_RISING = "#1f6f96"
const TIDE_FALLING = "#a8761a"
/** Same two arrows on the dark card head, where the saturated pair goes dim.
 *  These are the project's established light-on-navy blue and gold. */
const TIDE_RISING_LIGHT = "#9ecbdd"
const TIDE_FALLING_LIGHT = "#c59b5b"

/** Metric icons on the sand body of the ZDAJ card, one hue per reading so the
 *  grid can be scanned without reading the labels. The sea is the darkest —
 *  the same navy as the card head — then warm for heat and two blues for rain
 *  and sky. The pale on-navy blues (#7fa8b8, #9ecbdd) are deliberately NOT used
 *  here: on sand they fall to roughly 2:1 and a 12 px icon disappears, so each
 *  takes its established sand-side sibling instead. */
const METRIC_ICONS = {
  waves: "#132a35",
  temp: "#c4744a",
  rain: "#1f6f96",
  sky: "#3f6b7d",
} as const

/** Slovene writes decimals with a comma; a full stop reads as a foreign number. */
const dec = (v: number, places: number) => v.toFixed(places).replace(".", ",")
const n1 = (v: number | null, unit = "") => (v == null ? "—" : `${dec(v, 1)}${unit}`)
const n0 = (v: number | null, unit = "") => (v == null ? "—" : `${Math.round(v)}${unit}`)

/** Tide heights carry their sign: without the plus, a rise reads like a depth. */
const tideText = (v: number) => `${v > 0 ? "+" : ""}${dec(v, 2)} m`

// Times arrive as bare local strings ("2026-08-26T13:00"); slicing keeps them in
// lodge time. Parsing them as Date would drag them into the viewer's timezone.
const hourOf = (t: string) => t.slice(11, 16)
const dayOf = (t: string) => t.slice(0, 10)
const dayLabel = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString("sl-SI", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  })
/** "26. avgust" — the date under the relative name, so nobody has to work out
 *  which calendar day "pojutrišnjem" actually is. */
const shortDate = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString("sl-SI", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  })

/** Add days to a bare date. UTC on both sides, so the day never slips. */
const addDays = (d: string, n: number) =>
  new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)

// Three days is as far ahead as a crossing gets planned here.
const DAY_NAMES = ["Danes", "Jutri", "Pojutrišnjem"] as const

/** Relative day name where one exists, weekday otherwise — "danes" beats a date
 *  when you are reading a list of tide turns. */
const relDay = (day: string, base: string) => {
  const i = [0, 1, 2].find(n => addDays(base, n) === day)
  if (i != null) return DAY_NAMES[i].toLowerCase()
  return dayLabel(day).split(",")[0]
}

/** Highest value of a field across a day, for the collapsed day summary. */
const maxOf = (hours: VremeUra[], pick: (h: VremeUra) => number | null) => {
  const vals = hours.map(pick).filter((v): v is number => v != null)
  return vals.length ? Math.max(...vals) : null
}

/** Minutes between two bare local timestamps. UTC on both sides, so the naive
 *  arithmetic stays in lodge time. */
const minsBetween = (from: string, to: string) => {
  const a = Date.parse(`${from}:00Z`)
  const b = Date.parse(`${to}:00Z`)
  return Number.isFinite(a) && Number.isFinite(b) ? Math.round((b - a) / 60_000) : null
}

/** "čez 1 h 40 min" — Slovene, and it must read naturally at a glance because
 *  this is the number someone acts on. */
const inLabel = (mins: number | null) => {
  if (mins == null) return ""
  if (mins <= 0) return "zdaj"
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `čez ${m} min`
  if (m === 0) return `čez ${h} h`
  return `čez ${h} h ${m} min`
}

const OVERLAYS = [
  { id: "wind", label: "Veter" },
  { id: "waves", label: "Valovi" },
  { id: "rain", label: "Dež" },
  { id: "clouds", label: "Oblaki" },
] as const

export default function VremeTab() {
  const { data, error, isLoading, mutate, isValidating } = useSWR("vreme", getVreme, {
    // The models refresh on the hour at best; this keeps the panel current
    // without hammering the source.
    refreshInterval: 15 * 60 * 1000,
    revalidateOnFocus: true,
  })
  const [overlay, setOverlay] = React.useState<(typeof OVERLAYS)[number]["id"]>("wind")
  const [unit, setUnit] = React.useState<Unit>(UNITS[0])
  const [tideOpen, setTideOpen] = React.useState(false)
  // Collapsed by default: the summary line already carries the warning, and the
  // four figures are only needed when someone wants to see who says what.
  const [modelsOpen, setModelsOpen] = React.useState(false)
  // Keyed by date, so a choice survives the data refreshing underneath. Absent
  // means "not touched yet", which is how today stays open by default without an
  // effect that would fight the user's own click.
  const [openDays, setOpenDays] = React.useState<Record<string, boolean>>({})

  // Read the saved unit after mount: doing it in the initial state would make
  // the server and client render different text. This is a device preference,
  // not data, which is why localStorage is the right home for it.
  React.useEffect(() => {
    try {
      const saved = window.localStorage.getItem(UNIT_KEY)
      const found = UNITS.find(u => u.id === saved)
      if (found) setUnit(found)
    } catch {
      // Private mode or blocked storage: km/h is a fine default.
    }
  }, [])

  const pickUnit = (u: Unit) => {
    setUnit(u)
    try {
      window.localStorage.setItem(UNIT_KEY, u.id)
    } catch {
      // Not being able to remember the choice must not break the switch.
    }
  }

  /** Convert a canonical km/h value for display, keeping the decimals each unit
   *  deserves: 17 km/h reads fine as a whole number, 4.7 m/s does not. */
  const windText = (kmh: number | null) =>
    kmh == null ? "—" : dec(kmh * unit.factor, unit.dec)

  const res = data
  const w = res && res.ok ? res.data : null

  // Today, tomorrow and the day after. Today runs hour by hour — that is the day
  // a crossing actually gets decided on, and a three-hour gap can hide the squall
  // you were asking about. The next two days keep three-hour steps, anchored to
  // fixed marks (00, 03, 06 …) rather than counted from the current hour, so they
  // list the same times instead of drifting.
  const byDay = React.useMemo(() => {
    const nowLocal = w?.nowLocal
    if (!w || !nowLocal) return []
    const base = dayOf(nowLocal)
    return [0, 1, 2].map(i => {
      const day = addDays(base, i)
      const hours = w.hours.filter(h => {
        if (dayOf(h.time) !== day) return false
        if (i > 0 && Number(h.time.slice(11, 13)) % 3 !== 0) return false
        // Hours already gone are dead weight on today; future days show in full.
        return i > 0 || h.time >= nowLocal
      })
      return { day, label: DAY_NAMES[i], hours }
    })
  }, [w])

  // Tides still to come, plus the curve around "now" for the sparkline.
  const tide = React.useMemo(() => {
    if (!w || !w.nowLocal) return null
    const now = w.nowLocal
    const next = w.tides.filter(t => t.time >= now)
    if (!next.length) return null

    // Hours with a sea level, from three back to a day ahead: the recent past is
    // what tells you at a glance whether the water is coming or going.
    const curve = w.hours.filter(h => {
      if (h.tide == null) return false
      const d = minsBetween(now, h.time)
      return d != null && d >= -180 && d <= 24 * 60
    })

    const nowHour = w.hours.filter(h => h.tide != null && h.time <= now).pop() ?? null
    return { next: next.slice(0, 6), upcoming: next[0], curve, nowHour }
  }, [w])

  const now = w?.current
  const state = now ? seaState(now.gusts, now.waves) : null

  /** How far apart the models are on this hour's gusts, judged on the spread in
   *  km/h — the canonical unit — so switching the display to m/s cannot move the
   *  verdict. Thresholds are deliberately wide: models routinely differ by a few
   *  km/h and calling that "disagreement" would cry wolf. */
  const spread = React.useMemo(() => {
    const vals = (w?.models ?? []).map(m => m.gusts).filter((v): v is number => v != null)
    if (vals.length < 2) return null
    const lo = Math.min(...vals)
    const hi = Math.max(...vals)
    const gap = hi - lo
    // Colours follow the badge's own light triple, so a warning here reads in the
    // same language as a warning there.
    const verdict =
      gap < 8
        ? { text: "modeli soglašajo", color: "#8fae92" }
        : gap < 18
          ? { text: "manjše razlike", color: "#c59b5b" }
          : { text: "modeli se ne strinjajo", color: "#f0a8b4" }
    return { lo, hi, gap, ...verdict }
  }, [w?.models])

  const embedSrc =
    `https://embed.windy.com/embed.html?type=map&location=coordinates` +
    // metricTemp/metricWind/metricRain are honoured; there is no working unit
    // parameter for wave height, so Windy's own legend stays in feet. Verified
    // against the live embed — don't re-add `metricWaves`, it does nothing.
    `&metricRain=mm&metricTemp=%C2%B0C&metricWind=${unit.windy}&zoom=8&overlay=${overlay}` +
    `&product=ecmwf&level=surface&lat=${LODGE.lat}&lon=${LODGE.lon}` +
    `&detailLat=${LODGE.lat}&detailLon=${LODGE.lon}&marker=true`

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#9dafb5]">Vreme</p>
          <h2 className="font-[family-name:var(--font-manrope)] text-[1.4rem] font-light tracking-wide text-[#f8f5ef]">
            {LODGE.label}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {/* Unit switch, the same choice Windy offers. */}
          <div className="flex overflow-hidden rounded-full border border-white/10">
            {UNITS.map(u => (
              <button
                key={u.id}
                type="button"
                onClick={() => pickUnit(u)}
                aria-pressed={unit.id === u.id}
                title={`Hitrost vetra v ${u.id}`}
                className={`cursor-pointer px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors ${
                  unit.id === u.id
                    ? "bg-[#7fa8b8]/20 text-[#9ecbdd]"
                    : "bg-white/[0.03] text-white/40 hover:bg-white/[0.07]"
                }`}
              >
                {u.id}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => mutate()}
            title="Osveži podatke"
            aria-label="Osveži podatke"
            className="flex cursor-pointer items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55 transition-colors hover:bg-white/[0.08]"
          >
            {isValidating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {isLoading && !w && (
        <div className="rounded-2xl border border-[#0f2e3a]/12 bg-[#efe8da] p-8 text-center text-sm font-light text-[#2b2622]/55">
          Pridobivam vremenske podatke…
        </div>
      )}

      {(error || (res && !res.ok)) && (
        <div className="flex items-start gap-3 rounded-2xl border border-[#b0203a]/30 bg-[#efe8da] p-4">
          <TriangleAlert className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#b0203a]" />
          <p className="text-[13px] font-light leading-relaxed text-[#2b2622]/80">
            {res && !res.ok ? res.error : "Vremenskih podatkov ni bilo mogoče pridobiti."} Zemljevid spodaj deluje
            neodvisno.
          </p>
        </div>
      )}

      {/* Current conditions — wind is the hero number because it decides the boat. */}
      {now && state && (
        <div className="overflow-hidden rounded-2xl border border-[#0f2e3a]/12 bg-[#efe8da]">
          {/* Dark head, sand body: the wind number is the one figure read at a
              glance, so it gets its own field instead of sharing the card. */}
          <div className="flex flex-wrap items-start justify-between gap-4 bg-[#132a35] p-5">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">Zdaj</p>
              <div className="mt-2 flex items-end gap-2">
                <span className="font-[family-name:var(--font-manrope)] text-5xl font-light leading-none tabular-nums text-[#f8f5ef]">
                  {windText(now.wind)}
                </span>
                <span className="pb-1 text-sm font-light text-white/45">{unit.id}</span>
              </div>
              <p className="mt-2 flex items-center gap-1.5 text-[13px] font-light text-white/60">
                <Navigation
                  className="h-3.5 w-3.5 text-white/40"
                  style={{ transform: `rotate(${(now.dir ?? 0) + 180}deg)` }}
                  aria-hidden
                />
                {dirLabel(now.dir)}
                {/* Gold hairline: the same divider motif the bungalow card uses. */}
                <span className="mx-1 h-3 w-px bg-[#c59b5b]/50" aria-hidden />
                sunki{" "}
                <span className="font-medium tabular-nums text-white/85">
                  {windText(now.gusts)} {unit.id}
                </span>
              </p>
            </div>

            <div className="flex flex-shrink-0 flex-col items-center gap-2">
              <span
                className="whitespace-nowrap rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em]"
                style={{ borderColor: `${state.light}59`, backgroundColor: `${state.light}1a`, color: state.light }}
                title="Groba ocena po sunkih vetra in višini valov — presojo opravi kapitan."
              >
                {state.label}
              </span>
              <Windsock
                gusts={now.gusts}
                color={state.light}
                label={state.label}
                hint={`Vetrna vreča — barva pove stanje, hitrost nihanja pa sledi sunkom (${windText(now.gusts)} ${unit.id}).`}
              />
            </div>

            {/* Model agreement. This is the one thing a Windy Premium account is
                really opened for, and it costs nothing to show: when the four
                models spread from 8 to 28 km/h for the same hour, that spread
                decides the crossing more than any single figure does. Full width
                so it wraps onto its own line under both columns. */}
            {spread && (
              <div className="w-full">
                <button
                  type="button"
                  onClick={() => setModelsOpen(v => !v)}
                  aria-expanded={modelsOpen}
                  title="Primerjava napovedanih sunkov po štirih modelih za tekočo uro"
                  className="flex w-full cursor-pointer items-center gap-2 border-t border-white/[0.08] pt-3 text-left"
                >
                  <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
                    Modeli
                  </span>
                  {/* The unit stays on the range even on a phone: a bare "5,2–9,2"
                      would read as either unit, and the two are far apart. */}
                  <span className="whitespace-nowrap font-medium tabular-nums text-[13px]" style={{ color: spread.color }}>
                    {windText(spread.lo)}–{windText(spread.hi)} {unit.id}
                  </span>
                  <span className="text-[11px] font-light text-white/45">{spread.text}</span>
                  <ChevronDown
                    className={`ml-auto h-4 w-4 flex-shrink-0 text-white/40 ${modelsOpen ? "rotate-180" : ""}`}
                    aria-hidden
                  />
                </button>

                {/* Hidden by class, not unmounted, so the bars keep their measured
                    widths instead of animating in from nothing on every open. */}
                <div className={modelsOpen ? "mt-3 flex flex-col gap-2" : "hidden"}>
                  {(w?.models ?? []).map(m => (
                    <div key={m.id} className="flex items-center gap-2.5">
                      {/* Our own source is called out, because it is the figure the
                          big number above shows — and it is not always the middle
                          of the pack. */}
                      <span
                        className={`w-[86px] flex-shrink-0 text-[11px] ${
                          m.primary ? "font-medium text-white/85" : "font-light text-white/55"
                        }`}
                      >
                        {m.label}
                      </span>
                      {/* Bar length is relative to the strongest model, so the
                          disagreement is visible without reading the numbers. */}
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.08]" aria-hidden>
                        <span
                          className="block h-full rounded-full"
                          style={{
                            width: `${Math.max(4, ((m.gusts ?? 0) / spread.hi) * 100)}%`,
                            backgroundColor: spread.color,
                            opacity: 0.75,
                          }}
                        />
                      </span>
                      <span className="w-[62px] flex-shrink-0 text-right text-[12px] font-medium tabular-nums text-white/85">
                        {windText(m.gusts)}
                      </span>
                    </div>
                  ))}
                  <p className="text-[10px] font-light leading-relaxed text-white/30">
                    Sunki za tekočo uro. Široka razlika pomeni negotovo napoved — takrat velja računati na hujšo
                    številko. Velika številka zgoraj je „naš prikaz“.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="p-5">
            {/* Five metrics: three across at tablet width, all five in a row on a
                wide screen. Four columns would leave the fifth stranded alone. */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <Metric
                icon={Waves}
                iconColor={METRIC_ICONS.waves}
                label="Valovi"
                value={n1(now.waves, " m")}
                hint={now.wavePeriod ? `perioda ${n1(now.wavePeriod, " s")}` : undefined}
              />
              {tide?.nowHour?.tide != null &&
                (() => {
                  // Rising when the next turn is a high water. The arrow says which
                  // way the water is going; the hint says when it turns.
                  const rising = tide.upcoming.kind === "high"
                  return (
                    <Metric
                      icon={rising ? ArrowUp : ArrowDown}
                      iconColor={rising ? TIDE_RISING : TIDE_FALLING}
                      label="Plimovanje"
                      value={tideText(tide.nowHour.tide)}
                      hint={`${rising ? "visoka" : "nizka"} voda ${hourOf(tide.upcoming.time)}`}
                    />
                  )
                })()}
              <Metric
                icon={Thermometer}
                iconColor={METRIC_ICONS.temp}
                label="Temperatura"
                value={n0(now.temp, "°C")}
              />
              <Metric icon={Umbrella} iconColor={METRIC_ICONS.rain} label="Dež" value={n1(now.rain, " mm")} />
              <Metric icon={Wind} iconColor={METRIC_ICONS.sky} label="Nebo" value={skyLabel(now.code)} />
            </div>

            {w?.seaMissing && (
              <p className="mt-3 text-[11px] font-light italic text-[#2b2622]/45">
                Morski model trenutno ni dosegljiv — podatka o valovih ni.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Tides. Its own card, because the state of the water decides when a boat
          can reach the beach at all — regardless of how calm the sea is. */}
      {tide && w && (
        <div className="overflow-hidden rounded-2xl border border-[#0f2e3a]/12 bg-[#efe8da]">
          {/* Collapsed by default, but the header still carries the next turn:
              that one line is the whole reason to look, so hiding it behind a
              click would defeat the point of folding the card away. */}
          <button
            type="button"
            onClick={() => setTideOpen(v => !v)}
            aria-expanded={tideOpen}
            title={
              tideOpen
                ? "Skrij plimovanje"
                : `Prikaži plimovanje — ${
                    tide.upcoming.kind === "high" ? "visoka" : "nizka"
                  } voda ob ${hourOf(tide.upcoming.time)}`
            }
            className="flex w-full cursor-pointer items-center gap-3 bg-[#132a35] px-4 py-3 text-left transition-colors hover:bg-[#1b3a48]"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">Plimovanje</p>

            {tideOpen ? (
              tide.nowHour?.tide != null && (
                <p className="ml-auto text-[10px] uppercase tracking-[0.14em] text-white/35">
                  Zdaj <span className="normal-case tabular-nums text-[#f8f5ef]">{tideText(tide.nowHour.tide)}</span>
                </p>
              )
            ) : (
              <p className="ml-auto flex items-center gap-1.5 text-[11px] font-light text-white/60">
                {tide.upcoming.kind === "high" ? (
                  <ArrowUp
                    className="h-3.5 w-3.5 flex-shrink-0"
                    strokeWidth={2.5}
                    style={{ color: TIDE_RISING_LIGHT }}
                    aria-hidden
                  />
                ) : (
                  <ArrowDown
                    className="h-3.5 w-3.5 flex-shrink-0"
                    strokeWidth={2.5}
                    style={{ color: TIDE_FALLING_LIGHT }}
                    aria-hidden
                  />
                )}
                <span className="font-medium tabular-nums text-white/85">{hourOf(tide.upcoming.time)}</span>
                <span className="hidden sm:inline">
                  {tide.upcoming.kind === "high" ? "visoka voda" : "nizka voda"}
                </span>
                <span className="text-white/40">{inLabel(minsBetween(w.nowLocal ?? "", tide.upcoming.time))}</span>
              </p>
            )}

            <ChevronDown
              className={`h-4 w-4 flex-shrink-0 text-white/40 transition-transform ${tideOpen ? "rotate-180" : ""}`}
              aria-hidden
            />
          </button>

          <div className={tideOpen ? "p-4" : "hidden"}>
            {/* The next turn of the water, as the headline. */}
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p
                  className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em]"
                  style={{ color: tide.upcoming.kind === "high" ? TIDE_RISING : TIDE_FALLING }}
                >
                  {tide.upcoming.kind === "high" ? (
                    <ArrowUp className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
                  ) : (
                    <ArrowDown className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
                  )}
                  {tide.upcoming.kind === "high" ? "Visoka voda" : "Nizka voda"}
                </p>
                <div className="mt-1.5 flex items-end gap-2">
                  <span className="font-[family-name:var(--font-manrope)] text-3xl font-light leading-none tabular-nums text-[#0f2e3a]">
                    {hourOf(tide.upcoming.time)}
                  </span>
                  <span className="pb-0.5 text-[13px] font-light tabular-nums text-[#2b2622]/60">
                    {tideText(tide.upcoming.height)}
                  </span>
                </div>
              </div>
              <p className="text-[13px] font-light text-[#2b2622]/60">
                {inLabel(minsBetween(w.nowLocal ?? "", tide.upcoming.time))}
              </p>
            </div>

            <TideCurve hours={tide.curve} now={w.nowLocal ?? ""} turns={tide.next} />

            {/* Remaining turns. Two days is as far as anyone plans a crossing. */}
            <div className="mt-4 divide-y divide-[#0f2e3a]/[0.08] border-t border-[#0f2e3a]/[0.08]">
              {tide.next.map(t => (
                <div key={t.time} className="flex items-center gap-3 py-2.5">
                  {t.kind === "high" ? (
                    <ArrowUp
                      className="h-3.5 w-3.5 flex-shrink-0"
                      strokeWidth={2.5}
                      style={{ color: TIDE_RISING }}
                      aria-hidden
                    />
                  ) : (
                    <ArrowDown
                      className="h-3.5 w-3.5 flex-shrink-0"
                      strokeWidth={2.5}
                      style={{ color: TIDE_FALLING }}
                      aria-hidden
                    />
                  )}
                  <span className="w-[92px] flex-shrink-0 text-[12px] font-light text-[#2b2622]/60">
                    {t.kind === "high" ? "Visoka voda" : "Nizka voda"}
                  </span>
                  <span className="text-[13px] font-medium tabular-nums text-[#0f2e3a]">{hourOf(t.time)}</span>
                  <span className="text-[12px] tabular-nums text-[#2b2622]/55">{tideText(t.height)}</span>
                  <span className="ml-auto text-[11px] font-light text-[#2b2622]/45">
                    {relDay(dayOf(t.time), dayOf(w.nowLocal ?? ""))}
                  </span>
                </div>
              ))}
            </div>

            {/* Said plainly: these are heights against mean sea level, so a
                negative number is not a depth and not a chart sounding. */}
            <p className="mt-3 text-[10px] font-light leading-relaxed text-[#2b2622]/45">
              Višine so glede na srednjo gladino morja (ne globine). Za natančno gibanje ob pomolu velja lokalna
              izkušnja.
            </p>
          </div>
        </div>
      )}

      {/* Hourly outlook */}
      {byDay.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-[#0f2e3a]/12 bg-[#efe8da]">
          {/* Dark head, sand body — the same split as the Zdaj card. No border-b:
              the colour boundary is already the divider. */}
          <div className="flex items-center justify-between gap-3 bg-[#132a35] px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">Napoved po urah</p>
            <p className="text-[10px] uppercase tracking-[0.14em] text-white/35">
              Danes po urah<span className="hidden sm:inline">, nato 3-urni koraki</span>
            </p>
          </div>

          {byDay.map(({ day, label, hours }, i) => {
            // Today is what someone opened the page for; the next two days are a
            // click away so the card stays short on a phone.
            const open = openDays[day] ?? i === 0
            const gusts = maxOf(hours, h => h.gusts)
            const dayState = seaState(gusts, maxOf(hours, h => h.waves))
            // The odds column is given room only on days that have something to
            // say. Reserving it always would spend 40 px of a phone row on
            // blanks; adding it per row would leave the columns ragged.
            const dayShowRisk = hours.some(h => (h.pCaution ?? 0) >= 10)
            return (
              // White hairline, not navy: with every day collapsed the dark heads
              // stack, and a dark divider between them would vanish.
              <div key={day} className="border-b border-white/[0.08] last:border-b-0">
                <button
                  type="button"
                  onClick={() => setOpenDays(prev => ({ ...prev, [day]: !open }))}
                  aria-expanded={open}
                  title={`${open ? "Skrij" : "Prikaži"} napoved — ${label.toLowerCase()}, ${shortDate(day)}`}
                  // Dark head over sand rows, the same split the cards use. The
                  // hover is a solid lighter navy: a translucent wash would let
                  // the sand body show through.
                  className="flex w-full cursor-pointer items-center gap-2.5 bg-[#132a35] px-4 py-2.5 text-left transition-colors hover:bg-[#1b3a48]"
                >
                  <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#f8f5ef]">{label}</span>
                  <span className="text-[10px] font-light text-white/40">{shortDate(day)}</span>

                  {/* The day's strongest gust, so it is clear from the outside
                      whether the day is worth opening at all. */}
                  {gusts != null && (
                    <span className="ml-auto flex items-center gap-1.5 text-[11px] font-light text-white/60">
                      <span
                        aria-hidden
                        className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                        // The light sibling, not `vivid`: the saturated amber goes
                        // dim on this navy at 6 px.
                        style={{ backgroundColor: dayState.light }}
                        title={dayState.label}
                      />
                      {/* "do" survives on a phone: the bare number would read as
                          the current wind rather than the day's worst gust. */}
                      <span className="hidden sm:inline">sunki</span>
                      <span className="-ml-0.5">do</span>
                      <span className="font-medium tabular-nums text-white/85">
                        {windText(gusts)} {unit.id}
                      </span>
                    </span>
                  )}

                  <ChevronDown
                    className={`h-4 w-4 flex-shrink-0 text-white/40 transition-transform ${
                      open ? "rotate-180" : ""
                    } ${gusts == null ? "ml-auto" : ""}`}
                    aria-hidden
                  />
                </button>

                {open && hours.length === 0 && (
                  <p className="px-4 py-3 text-[12px] font-light italic text-[#2b2622]/45">
                    Za danes ni več ur — poglej jutri.
                  </p>
                )}

                <div className={open && hours.length > 0 ? "divide-y divide-[#0f2e3a]/[0.08]" : "hidden"}>
                {hours.map(h => {
                  const s = seaState(h.gusts, h.waves)
                  return (
                    <div key={h.time} className="flex items-center gap-2.5 px-4 py-2.5">
                      <span className="w-10 flex-shrink-0 text-[13px] font-medium tabular-nums text-[#0f2e3a]">
                        {hourOf(h.time)}
                      </span>
                      <span
                        aria-hidden
                        // Saturated and fully opaque: at 2 px wide there is nothing
                        // left to dim, and the sage needed no fading to sit calmly.
                        className="h-6 w-[3px] flex-shrink-0 rounded-full"
                        style={{ backgroundColor: s.vivid }}
                        title={s.label}
                      />
                      <span className="flex w-[74px] flex-shrink-0 items-baseline gap-1 text-[13px] tabular-nums text-[#0f2e3a]">
                        {windText(h.wind)}
                        <span className="text-[11px] text-[#2b2622]/55">/{windText(h.gusts)}</span>
                      </span>
                      <span className="w-[48px] flex-shrink-0 text-[13px] tabular-nums text-[#2b2622]/70">
                        {n1(h.waves, " m")}
                      </span>
                      <span className="w-[40px] flex-shrink-0 text-[13px] tabular-nums text-[#2b2622]/70">
                        {n0(h.rainChance, "%")}
                      </span>
                      {/* Odds this hour reaches the caution limit, out of 51 ECMWF
                          runs. Printed only from 10 % up: below that it is noise,
                          and a row of zeroes would bury the hours that matter. */}
                      {dayShowRisk && (
                        <span className="w-[38px] flex-shrink-0 text-right">
                          {(h.pCaution ?? 0) >= 10 && (
                            <span
                              className="text-[12px] font-medium tabular-nums"
                              style={{ color: riskTone(h.pCaution ?? 0, h.pDanger ?? 0) }}
                              title={
                                `${h.pCaution} % možnosti sunkov nad ${SEA_LIMITS.cautionGusts} km/h` +
                                ((h.pDanger ?? 0) > 0
                                  ? `, od tega ${h.pDanger} % nad ${SEA_LIMITS.dangerGusts} km/h`
                                  : "") +
                                ` — po 51 različicah ECMWF (${windText(h.enLo)}–${windText(h.enHi)} ${unit.id})`
                              }
                            >
                              {h.pCaution}%
                            </span>
                          )}
                        </span>
                      )}
                      <span className="ml-auto hidden truncate text-[12px] font-light text-[#2b2622]/55 sm:block">
                        {skyLabel(h.code)}
                      </span>
                    </div>
                  )
                })}
                </div>
              </div>
            )
          })}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[#0f2e3a]/[0.08] px-4 py-3 text-[10px] uppercase tracking-[0.14em] text-[#2b2622]/45">
            <span>Veter / sunki ({unit.id})</span>
            <span>Valovi (m)</span>
            <span>Možnost dežja</span>
            {/* Named so the last column is not mistaken for a second rain figure. */}
            <span>Tveganje nad {SEA_LIMITS.cautionGusts} km/h</span>
          </div>
        </div>
      )}

      {/* The real Windy map, for everything the numbers cannot show. */}
      {/* This one card stays navy on purpose: the Windy embed brings its own dark
          canvas, and a sand frame around it read as a mismatched border. */}
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">Zemljevid Windy</p>
          <div className="flex flex-wrap gap-1.5">
            {OVERLAYS.map(o => (
              <button
                key={o.id}
                type="button"
                onClick={() => setOverlay(o.id)}
                aria-pressed={overlay === o.id}
                className={`cursor-pointer rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] transition-colors ${
                  overlay === o.id
                    ? "border-[#7fa8b8]/50 bg-[#7fa8b8]/15 text-[#7fa8b8]"
                    : "border-white/10 bg-white/[0.03] text-white/45 hover:bg-white/[0.07]"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <iframe
          // Remounting on either switch is what makes the map actually reload.
          key={`${overlay}-${unit.id}`}
          src={embedSrc}
          title={`Windy zemljevid — ${OVERLAYS.find(o => o.id === overlay)?.label}`}
          loading="lazy"
          className="h-[420px] w-full border-0 sm:h-[520px]"
        />
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.08] px-4 py-3">
          {/* Windy has no unit switch for wave height in the embed, so the legend
              reads feet while our own numbers are in metres. Saying so is better
              than letting someone mistake 3 ft for 3 m. */}
          <p className="text-[10px] font-light text-white/30">
            Podatki: Open-Meteo (ECMWF) · Zemljevid: Windy.com
            {overlay === "waves" && " · legenda zemljevida je v čevljih (1 m ≈ 3,3 ft)"}
          </p>
          <a
            href={`https://www.windy.com/?${LODGE.lat},${LODGE.lon},9`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7fa8b8] hover:text-[#9ecbdd]"
          >
            Odpri na Windy
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
  )
}

/** The tide as a shape rather than a table: rising or falling is read in an
 *  instant, which a column of numbers cannot do. Drawn straight from the hourly
 *  values, with "now" marked. */
function TideCurve({ hours, now, turns }: { hours: VremeUra[]; now: string; turns: Plima[] }) {
  const pts = hours.filter(h => h.tide != null)
  if (pts.length < 3) return null

  const vals = pts.map(h => h.tide as number)
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const span = max - min || 1

  // viewBox space; preserveAspectRatio is off so it stretches to any width.
  const W = 100
  const H = 40
  const x = (i: number) => (i / (pts.length - 1)) * W
  const y = (v: number) => H - ((v - min) / span) * H

  const line = pts.map((h, i) => `${x(i).toFixed(2)},${y(h.tide as number).toFixed(2)}`).join(" ")
  const area = `0,${H} ${line} ${W},${H}`

  // Where "now" falls along the series, so the marker sits honestly between hours.
  const nowIdx = pts.findIndex(h => h.time > now)
  const nowX = nowIdx <= 0 ? 0 : x(nowIdx - 1 + 0.5)
  const last = pts[pts.length - 1]

  return (
    <div className="mt-4">
      {/* Taller on wide screens: stretched to 1200px the curve flattens out and
          stops reading as a rise and fall. */}
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-14 w-full sm:h-24" aria-hidden>
        <polygon points={area} fill="#3f6b7d" opacity={0.16} />
        <polyline points={line} fill="none" stroke="#3f6b7d" strokeWidth={0.9} vectorEffect="non-scaling-stroke" />
        {/* The "now" marker has to be darker than the card, not lighter. */}
        <line
          x1={nowX}
          y1={0}
          x2={nowX}
          y2={H}
          stroke="#0f2e3a"
          strokeWidth={0.6}
          opacity={0.4}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {/* The curve runs past midnight, so the closing hour has to say which day
          it belongs to — "13:00" alone reads as today and misleads. */}
      <div className="flex items-center justify-between text-[9px] uppercase tracking-[0.14em] text-[#2b2622]/45">
        <span>{hourOf(pts[0].time)}</span>
        <span>
          {hourOf(last.time)}
          {dayOf(last.time) !== dayOf(pts[0].time) && <span className="text-[#2b2622]/35"> jutri</span>}
        </span>
      </div>
      <p className="sr-only">
        Krivulja gladine morja za naslednji dan. Naslednji obrat:{" "}
        {turns[0] ? `${turns[0].kind === "high" ? "visoka voda" : "nizka voda"} ob ${hourOf(turns[0].time)}` : "ni podatka"}.
      </p>
    </div>
  )
}

/** A windsock under the sea-state badge: colour carries the state (sage / gold /
 *  rose) and the cycle speed carries the gust reading, so a glance gives both.
 *  Gusts are always in km/h here — that is the canonical unit, so switching the
 *  display to m/s cannot change how fast this moves. */
function Windsock({
  gusts,
  color,
  label,
  hint,
}: {
  gusts: number | null
  color: string
  label: string
  hint: string
}) {
  // Continuous, not banded: 3.6s adrift at a standstill down to a 1.2s snap in a
  // squall, so the sock quickens across the whole range and not only at the
  // thresholds the badge already marks.
  const seconds = Math.min(3.6, Math.max(1.2, 3.6 - (gusts ?? 0) / 18))

  return (
    <svg
      // Drawn on a 30x22 grid but rendered larger: at grid size the pale bands
      // close up and the sock reads as a smudge.
      width="48"
      height="35"
      viewBox="0 0 30 22"
      role="img"
      aria-label={`Jakost vetra — ${label.toLowerCase()}`}
    >
      {/* An SVG carries its tooltip as a <title> child, not a title attribute. */}
      <title>{hint}</title>
      {/* mast */}
      <line
        x1="3.5"
        y1="2"
        x2="3.5"
        y2="20"
        stroke={color}
        strokeOpacity="0.45"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <g className="animate-windsock" style={{ animationDuration: `${seconds}s` }}>
        {/* Tethers from the mast head to the mouth hoop, as on the real thing —
            they are what makes the sock hang off the mast rather than float. */}
        <line x1="3.7" y1="2.6" x2="7" y2="4.2" stroke={color} strokeOpacity="0.55" strokeWidth="0.7" />
        <line x1="3.7" y1="2.6" x2="7" y2="10.8" stroke={color} strokeOpacity="0.55" strokeWidth="0.7" />
        {/* Cone: a wide mouth drawing down to almost a point, which is the shape
            that reads as a windsock rather than a flag. */}
        <path d="M7 4.2 L26.8 8.4 L26.8 9.4 L7 10.8 Z" fill={color} fillOpacity="0.9" />
        {/* Three pale bands, following the taper so they narrow toward the tail. */}
        <path d="M11 5 L13.7 5.6 L13.7 10.3 L11 10.5 Z" fill="#efe8da" fillOpacity="0.85" />
        <path d="M16.9 6.3 L19.3 6.8 L19.3 9.9 L16.9 10.1 Z" fill="#efe8da" fillOpacity="0.85" />
        <path d="M22 7.4 L24.2 7.9 L24.2 9.6 L22 9.7 Z" fill="#efe8da" fillOpacity="0.85" />
        {/* Mouth hoop last, so its ring sits over the fabric — and the pivot. */}
        <ellipse cx="7" cy="7.5" rx="1.3" ry="3.3" fill="none" stroke={color} strokeWidth="1.2" />
      </g>
    </svg>
  )
}

function Metric({
  icon: Icon,
  label,
  value,
  hint,
  iconColor,
}: {
  icon: typeof Wind
  label: string
  value: string
  hint?: string
  /** Only for marks that carry meaning on their own, like the tide arrow. Left
   *  unset, the icon stays the muted tone of its label. */
  iconColor?: string
}) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#2b2622]/55">
        <Icon
          className="h-3 w-3 flex-shrink-0"
          strokeWidth={iconColor ? 2.5 : undefined}
          style={iconColor ? { color: iconColor } : undefined}
          aria-hidden
        />
        {label}
      </p>
      <p className="mt-1.5 text-[15px] font-light tabular-nums text-[#0f2e3a]">{value}</p>
      {hint && <p className="text-[10px] font-light text-[#2b2622]/45">{hint}</p>}
    </div>
  )
}
