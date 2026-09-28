"use client"

import useSWR from "swr"
import { ChevronDown } from "lucide-react"
import { getVisitorNationalities, getOvernightStaysByYear, type VisitorNationality, type VisitorYear } from "@/app/actions/visitor-countries"
import { countryFlag } from "@/lib/country-flag"
import { GuestFlag } from "@/components/guest-flag"

/** Slovenian counting: 1 gost, 2 gosta, 3 gostje, 5 gostov. */
function sklon(n: number, one: string, two: string, few: string, many: string) {
  const m = n % 100
  if (m === 1) return one
  if (m === 2) return two
  if (m === 3 || m === 4) return few
  return many
}

/**
 * The same country arrives spelled many ways, so fold every variant onto one flag
 * before counting: "German", "Nemčija" and "Getman" are all Germany. Anything we
 * cannot place is kept aside rather than dropped, so the numbers always add up.
 */
function fold(rows: VisitorNationality[]) {
  const byCode = new Map<string, { name: string; guests: number; raw: string }>()
  let unknown = 0
  const unknownLabels: string[] = []

  for (const row of rows) {
    const hit = countryFlag(row.nationality)
    if (!hit) {
      unknown += row.guests
      unknownLabels.push(`${row.nationality} (${row.guests})`)
      continue
    }
    const current = byCode.get(hit.code)
    if (current) current.guests += row.guests
    else byCode.set(hit.code, { name: hit.name, guests: row.guests, raw: row.nationality })
  }

  return {
    list: [...byCode.values()].sort((a, b) => b.guests - a.guests || a.name.localeCompare(b.name, "sl")),
    unknown,
    unknownLabels,
  }
}

/**
 * Overnight stays (nočitve) per year — guest-nights, always visible under the
 * headline so the seasons read at a glance without opening the countries.
 */
function OvernightStrip() {
  const { data } = useSWR("overnight-stays", getOvernightStaysByYear, {
    refreshInterval: 0,
    revalidateOnFocus: false,
  })

  if (!data?.length) return null

  const total = data.reduce((sum, y) => sum + y.nights, 0)

  return (
    <div className="mt-1 flex w-full flex-wrap items-center gap-x-4 gap-y-2 border-t border-[#8f6d3a]/15 pt-3">
      <p className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.28em] text-[#8f6d3a]">
        <span aria-hidden className="h-px w-4 bg-[#8f6d3a]/50" />
        Nočitve po letih
      </p>
      <div className="flex flex-wrap gap-2">
        {data.map(y => (
          <span
            key={y.year}
            title={`${y.year} — ${y.nights.toLocaleString("sl-SI")} ${sklon(y.nights, "nočitev", "nočitvi", "nočitve", "nočitev")}`}
            className="flex items-baseline gap-1.5 rounded-lg border border-[#0f2e3a]/[0.08] bg-white px-2.5 py-1.5"
          >
            <span className="text-[10px] tabular-nums tracking-[0.14em] text-[#2b2622]/55">{y.year}</span>
            <span className="text-[12px] font-medium tabular-nums leading-none text-[#0f2e3a]">
              {y.nights.toLocaleString("sl-SI")}
            </span>
          </span>
        ))}
      </div>
      <span className="ml-auto text-[11px] tracking-[0.06em] text-[#2b2622]/55">
        skupaj{" "}
        <span className="font-medium tabular-nums text-[#0f2e3a]">{total.toLocaleString("sl-SI")}</span>{" "}
        {sklon(total, "nočitev", "nočitvi", "nočitve", "nočitev")}
      </span>
    </div>
  )
}

/**
 * The headline figure across every season, and the handle that opens the years.
 * Years cannot simply be added up: most countries come back year after year, so
 * each one is counted once here.
 */
function TotalSummary({ seasons }: { seasons: VisitorYear[] }) {
  const all = fold(seasons.flatMap(s => s.nationalities))
  const guests = all.list.reduce((sum, c) => sum + c.guests, 0) + all.unknown

  return (
    <summary className="flex cursor-pointer list-none flex-wrap items-baseline gap-x-3 gap-y-1 [&::-webkit-details-marker]:hidden">
      <p className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.28em] text-[#8f6d3a]">
        <span aria-hidden className="h-px w-4 bg-[#8f6d3a]/50" />
        Doslej nas je obiskalo
      </p>
      <p className="flex items-baseline gap-1.5">
        <span className="text-[22px] font-light leading-none tabular-nums text-[#0f2e3a]">{all.list.length}</span>
        <span className="text-[11px] tracking-[0.06em] text-[#2b2622]/55">
          {sklon(all.list.length, "različna država", "različni državi", "različne države", "različnih držav")}
        </span>
      </p>
      <span className="ml-auto flex items-baseline gap-3">
        <span className="text-[11px] tracking-[0.06em] text-[#2b2622]/55">
          <span className="font-medium tabular-nums text-[#0f2e3a]">{guests}</span>{" "}
          {sklon(guests, "gost", "gosta", "gostje", "gostov")} v{" "}
          <span className="font-medium tabular-nums text-[#0f2e3a]">{seasons.length}</span>{" "}
          {sklon(seasons.length, "sezoni", "sezonah", "sezonah", "sezonah")}
        </span>
        <ChevronDown
          aria-hidden
          className="h-4 w-4 flex-shrink-0 self-center text-[#8f6d3a]/60 transition-transform duration-300 group-open:rotate-180"
        />
      </span>
      <OvernightStrip />
    </summary>
  )
}

/** One season: a row of flags, each with the number of guests behind it. */
function SeasonRow({ year, rows }: { year: number; rows: VisitorNationality[] }) {
  const countries = fold(rows)
  const totalGuests = countries.list.reduce((sum, c) => sum + c.guests, 0) + countries.unknown

  if (!countries.list.length && !countries.unknown) return null

  return (
    <section
      aria-label={`Države, ki so nas obiskale v letu ${year}`}
      className="py-4 first:pt-0 last:pb-0"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <p className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.28em] text-[#8f6d3a]">
          <span aria-hidden className="h-px w-4 bg-[#8f6d3a]/50" />
          Obiskali so nas
          <span className="tabular-nums tracking-[0.16em] text-[#0f2e3a]">{year}</span>
        </p>
        <p className="text-[11px] tracking-[0.06em] text-[#2b2622]/55">
          <span className="font-medium tabular-nums text-[#0f2e3a]">{totalGuests}</span>{" "}
          {sklon(totalGuests, "gost", "gosta", "gostje", "gostov")} iz{" "}
          <span className="font-medium tabular-nums text-[#0f2e3a]">{countries.list.length}</span>{" "}
          {sklon(countries.list.length, "države", "držav", "držav", "držav")}
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {countries.list.map(c => (
          <span
            key={c.name}
            title={`${c.name} — ${c.guests} ${sklon(c.guests, "gost", "gosta", "gostje", "gostov")}`}
            className="flex items-center gap-1.5 rounded-lg border border-[#0f2e3a]/[0.08] bg-white px-2.5 py-1.5"
          >
            <GuestFlag nationalities={[c.raw]} />
            <span className="text-[12px] font-medium tabular-nums leading-none text-[#0f2e3a]">{c.guests}</span>
          </span>
        ))}

        {countries.unknown > 0 && (
          <span
            title={`Državljanstvo, ki ga še ne prepoznamo: ${countries.unknownLabels.join(", ")}`}
            className="flex items-center gap-1.5 rounded-lg border border-dashed border-[#0f2e3a]/15 bg-white/60 px-2.5 py-1.5"
          >
            <span className="text-[9px] uppercase tracking-[0.12em] text-[#2b2622]/50">Neznano</span>
            <span className="text-[12px] font-medium tabular-nums leading-none text-[#2b2622]/70">
              {countries.unknown}
            </span>
          </span>
        )}
      </div>
    </section>
  )
}

/**
 * Every country that has stayed with us, one row per season, newest year first.
 *
 * Sits under the bungalow cards and shares their language — sand panel, gold
 * hairline overline, white chips for depth, tabular figures — so it reads as the
 * closing lines of that list rather than a separate widget.
 */
export function VisitorCountries() {
  const { data, isLoading } = useSWR("visitor-countries", getVisitorNationalities, {
    refreshInterval: 0,
    revalidateOnFocus: false,
  })

  if (isLoading || !data?.length) return null

  return (
    <details
      aria-label="Skupno število držav, ki so nas obiskale"
      className="group mt-4 rounded-xl border border-[#8f6d3a]/25 bg-[#efe8da] px-5 py-4"
    >
      <TotalSummary seasons={data} />
      <div className="mt-4 flex flex-col divide-y divide-[#0f2e3a]/10 border-t border-[#8f6d3a]/20 pt-4">
        {data.map(season => (
          <SeasonRow key={season.year} year={season.year} rows={season.nationalities} />
        ))}
      </div>
    </details>
  )
}
