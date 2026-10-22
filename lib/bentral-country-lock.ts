// Bentral CSV import overwrites `country` on every row it already knows.
// These six 2026 lines were corrected because the visitor-country chip
// (getVisitorNationalities + countryFlag) was counting them as Madagascar.
// A later import must not put Madagascar back.
//
// null means the line must not count at all: a police form already counts
// those guests under the right country, and the Bentral name does not match
// that form, so a filled country would count them a second time.
// A string is the country the chip should use. Clement has no separate
// police form. The Zurcher fragment is not Donald Jean Zurcher.

const BENTRAL_COUNTRY_LOCK: Record<string, string | null> = {
  "K-2025-142": null, // Ziegler — Germany is already on the police form
  "K-2026-16": null, // Alexandra Huyghe / Nathaniel Randolph Hollis — United States
  "K-2026-72": null, // same Allie stay, shorter line
  "K-2026-6": null, // Laurent Jaffre / Virginie Dezitter — France
  "K-2026-168": null, // Kevin Mail / Mrs Yvonne extra night — Germany is on K-2026-18
  "5680914490": "France", // Gael Tours Clement, 2 adults, no separate names
  "K-2026-169": "Switzerland", // Zurcher fragment, 2 adults, not Donald Jean Zurcher
}

/** Country to store for this Bentral id. Undefined means "use the CSV value". */
export function lockedBentralCountry(externalId: string): string | null | undefined {
  if (Object.prototype.hasOwnProperty.call(BENTRAL_COUNTRY_LOCK, externalId)) {
    return BENTRAL_COUNTRY_LOCK[externalId]
  }
  return undefined
}

export function bentralCountryForImport(externalId: string, csvCountry: string | undefined | null): string | null {
  const locked = lockedBentralCountry(externalId)
  if (locked !== undefined) return locked
  const trimmed = (csvCountry || "").trim()
  return trimmed || null
}
