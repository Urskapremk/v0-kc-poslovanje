"use client"

import { useState } from "react"
import { countryFlag } from "@/lib/country-flag"

/**
 * Country flag for a guest, shown next to their name.
 *
 * Renders nothing when the nationality is empty or unrecognised, so the name
 * never shifts around a placeholder.
 *
 * Drawn as a real image rather than an emoji: the flag emoji only renders on
 * platforms whose font ships flag glyphs, and on the rest (Windows, and any
 * browser without a colour emoji font) it silently degrades to a bare "DE" —
 * which is what happened here. If the image itself cannot load we fall back to
 * that two-letter code on purpose, so the marker never disappears entirely.
 */
function Flag({ code, name, className = "" }: { code: string; name: string; className?: string }) {
  const [failed, setFailed] = useState(false)
  const lower = code.toLowerCase()

  if (failed) {
    return (
      <span
        role="img"
        aria-label={`Državljanstvo: ${name}`}
        title={name}
        className={`inline-block flex-shrink-0 align-[-0.05em] text-[9px] font-medium uppercase tracking-[0.08em] text-[#2b2622]/55 ${className}`}
      >
        {code}
      </span>
    )
  }

  return (
    <img
      src={`https://flagcdn.com/w40/${lower}.png`}
      srcSet={`https://flagcdn.com/w80/${lower}.png 2x`}
      width={18}
      height={12}
      loading="lazy"
      decoding="async"
      alt={`Državljanstvo: ${name}`}
      title={name}
      onError={() => setFailed(true)}
      className={`inline-block h-3 w-[18px] flex-shrink-0 rounded-[2px] object-cover align-[-0.1em] ring-1 ring-[#0f2e3a]/15 ${className}`}
    />
  )
}

/**
 * Flags for everyone on the reservation.
 *
 * A booking often covers guests of different nationalities — the BEHIN family
 * is Madagascan on the main line and French on the second — and the police form
 * records each one separately. Pass every slot and we show one flag per distinct
 * country, so the card reflects the form rather than just the first guest.
 */
export function GuestFlag({
  nationality,
  nationalities,
  className = "",
}: {
  nationality?: string | null
  nationalities?: (string | null | undefined)[]
  className?: string
}) {
  const raw = nationalities?.length ? nationalities : [nationality]

  // Resolve each slot, then de-duplicate: a couple from the same country gets
  // one flag, a mixed-nationality booking gets one per country.
  const seen = new Set<string>()
  const countries = raw
    .map(v => countryFlag(v))
    .filter((c): c is NonNullable<ReturnType<typeof countryFlag>> => !!c)
    .filter(c => (seen.has(c.code) ? false : (seen.add(c.code), true)))

  if (!countries.length) return null

  return (
    <>
      {countries.map((c, i) => (
        <Flag
          key={c.code}
          code={c.code}
          name={c.name}
          className={i < countries.length - 1 ? `mr-0.5 ${className}` : className}
        />
      ))}
    </>
  )
}
