// Parts of one excursion invoice line. The guest total is the same three
// amounts the booking already stores: transport (the boat selling price),
// entrance, and lunch. Guide, taxi, and extra entrance are supplier costs
// and are not part of this price.

export type ExcursionLinePartKey = "transport" | "entrance" | "lunch"

export type ExcursionLinePart = {
  key: ExcursionLinePartKey
  label: string
  eur: number
}

export type ExcursionLineBooking = {
  excursionId: string
  date?: unknown
  pax?: number | null
  status?: string | null
  guestPrice?: number | null
  entranceFee?: number | null
  lunchPrice?: number | null
  boatId?: string | null
  lunchProviderId?: string | null
  entrancePax?: number | null
  boatPriceEur?: number | null
}

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100

export function excursionLineDay(value: unknown): string | null {
  if (value == null || value === "") return null
  if (typeof value === "string") {
    const match = value.match(/\d{4}-\d{2}-\d{2}/)
    return match ? match[0] : null
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getUTCFullYear()
    const m = String(value.getUTCMonth() + 1).padStart(2, "0")
    const d = String(value.getUTCDate()).padStart(2, "0")
    return `${y}-${m}-${d}`
  }
  return null
}

/** Parts that already make this booking's guest price. A zero slot with no boat, tickets, or lunch is left out. */
export function excursionLineParts(booking: ExcursionLineBooking): ExcursionLinePart[] {
  const transport = round2(Number(booking.guestPrice) || 0)
  const entrance = round2(Number(booking.entranceFee) || 0)
  const lunch = round2(Number(booking.lunchPrice) || 0)
  const parts: ExcursionLinePart[] = []
  const boatChosen = Boolean(String(booking.boatId || "").trim())
  const boatRate = booking.boatPriceEur != null && Number(booking.boatPriceEur) > 0
  if (transport > 0 || boatChosen || boatRate) {
    parts.push({ key: "transport", label: "Prevoz", eur: transport })
  }
  const entranceCount = booking.entrancePax == null ? 0 : Number(booking.entrancePax)
  if (entrance > 0 || entranceCount > 0) {
    parts.push({ key: "entrance", label: "Vstopnina", eur: entrance })
  }
  if (lunch > 0 || Boolean(String(booking.lunchProviderId || "").trim())) {
    parts.push({ key: "lunch", label: "Kosilo", eur: lunch })
  }
  return parts
}

export function excursionLineTotalAr(euros: number[], rate: number): number {
  const totalEur = euros.reduce((sum, value) => sum + (Number(value) || 0), 0)
  const safeRate = Number.isFinite(rate) && rate > 0 ? rate : 4800
  return Math.round(totalEur * safeRate)
}

export function parseExcursionEur(raw: string): number | null {
  const text = String(raw ?? "").trim().replace(/\s/g, "").replace(",", ".")
  if (text === "") return 0
  const n = Number(text)
  if (!Number.isFinite(n) || n < 0) return null
  return round2(n)
}

export function matchExcursionLineBooking<T extends ExcursionLineBooking>(
  item: { name?: string | null; eventDate?: unknown; priceAr?: number | null },
  bookings: T[],
  excursionName: (excursionId: string) => string,
  rate = 4800,
): T | null {
  const itemName = (item.name || "").toLowerCase()
  const itemDay = excursionLineDay(item.eventDate)
  let candidates = bookings.filter((booking) => (booking.status || "ACTIVE") !== "CANCELLED").filter((booking) => {
    const name = excursionName(booking.excursionId).trim().toLowerCase()
    if (!name || !itemName.includes(name)) return false
    const bookingDay = excursionLineDay(booking.date)
    if (itemDay && bookingDay && itemDay !== bookingDay) return false
    return true
  })
  if (candidates.length > 1) {
    const withPax = candidates.filter((booking) => {
      const pax = Number(booking.pax) || 0
      if (pax < 1) return false
      return new RegExp(`-\\s*${pax}\\s*pax\\b`, "i").test(item.name || "")
    })
    if (withPax.length >= 1) candidates = withPax
  }
  if (candidates.length > 1 && item.priceAr != null) {
    const priced = candidates.filter((booking) => {
      const total = excursionLineTotalAr([
        Number(booking.guestPrice) || 0,
        Number(booking.entranceFee) || 0,
        Number(booking.lunchPrice) || 0,
      ], rate)
      return Math.abs(total - Number(item.priceAr)) <= 1
    })
    if (priced.length === 1) candidates = priced
  }
  return candidates.length === 1 ? candidates[0] : null
}
