// Price lines on a reserved excursion. Same rules as reception Naroči izlet:
// boat rate, lunch count, and entrance count fill their line until that line
// is typed by hand. The total is transport + entrance + lunch.

export type ReservedExcursionDraft = {
  pax: number
  boatId: string
  boatPer: number
  lunchCount: number
  entranceCount: number
  transport: number
  entrance: number
  lunch: number
  lunchProviderId: string
  transportTouched: boolean
  entranceTouched: boolean
  lunchTouched: boolean
  lunchCountTouched: boolean
  entranceCountTouched: boolean
}

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100
const close = (a: number, b: number) => Math.abs(a - b) < 0.02

export function reservedExcursionTotal(d: Pick<ReservedExcursionDraft, "transport" | "entrance" | "lunch">) {
  return round2((Number(d.transport) || 0) + (Number(d.entrance) || 0) + (Number(d.lunch) || 0))
}

function inferCount(amount: number, per: number, fallback: number) {
  if (per > 0 && amount > 0) {
    const n = Math.round(amount / per)
    if (n >= 0 && close(n * per, amount)) return n
  }
  return amount > 0 ? fallback : 0
}

export function seedReservedExcursionDraft(input: {
  pax: number
  fallbackPax: number
  boatId: string
  guestPrice: number
  entranceFee: number
  lunchPrice: number
  lunchPax: number
  entrancePax: number | null
  boatPriceEur: number | null
  lunchProviderId: string
  entrancePer: number
  lunchPer: number
}): ReservedExcursionDraft {
  const pax = input.pax > 0 ? input.pax : (input.fallbackPax > 0 ? input.fallbackPax : 1)
  const boatPer = input.boatPriceEur != null
    ? round2(input.boatPriceEur)
    : (pax > 0 ? round2(input.guestPrice / pax) : 0)
  const entranceCount = input.entrancePax != null
    ? input.entrancePax
    : inferCount(input.entranceFee, input.entrancePer, pax)
  const lunchCount = input.lunchPax > 0
    ? input.lunchPax
    : inferCount(input.lunchPrice, input.lunchPer, input.lunchPrice > 0 ? pax : 0)

  return {
    pax,
    boatId: input.boatId || "",
    boatPer,
    lunchCount,
    entranceCount,
    transport: round2(input.guestPrice),
    entrance: round2(input.entranceFee),
    lunch: round2(input.lunchPrice),
    lunchProviderId: input.lunchProviderId || "",
    transportTouched: input.boatPriceEur != null && !close(boatPer * pax, input.guestPrice),
    entranceTouched: input.entrancePax != null && input.entrancePer > 0 && !close(input.entrancePer * input.entrancePax, input.entranceFee),
    lunchTouched: input.lunchPax > 0 && input.lunchPer > 0 && !close(input.lunchPer * input.lunchPax, input.lunchPrice),
    lunchCountTouched: input.lunchPax > 0 && input.lunchPax !== pax,
    entranceCountTouched: input.entrancePax != null && input.entrancePax !== pax,
  }
}

export function withBoatPer(d: ReservedExcursionDraft, boatPer: number): ReservedExcursionDraft {
  const per = round2(Math.max(0, boatPer))
  return { ...d, boatPer: per, transport: round2(per * d.pax), transportTouched: false }
}

export function withTransport(d: ReservedExcursionDraft, transport: number): ReservedExcursionDraft {
  return { ...d, transport: round2(Math.max(0, transport)), transportTouched: true }
}

export function withEntrance(d: ReservedExcursionDraft, entrance: number): ReservedExcursionDraft {
  return { ...d, entrance: round2(Math.max(0, entrance)), entranceTouched: true }
}

export function withLunch(d: ReservedExcursionDraft, lunch: number): ReservedExcursionDraft {
  return { ...d, lunch: round2(Math.max(0, lunch)), lunchTouched: true }
}

export function withLunchCount(d: ReservedExcursionDraft, count: number, lunchPer: number): ReservedExcursionDraft {
  const lunchCount = Math.max(0, Math.round(count))
  return {
    ...d,
    lunchCount,
    lunchCountTouched: true,
    lunch: lunchPer > 0 ? round2(lunchPer * lunchCount) : d.lunch,
    lunchTouched: lunchPer > 0 ? false : d.lunchTouched,
  }
}

export function withEntranceCount(d: ReservedExcursionDraft, count: number, entrancePer: number): ReservedExcursionDraft {
  const entranceCount = Math.max(0, Math.round(count))
  return {
    ...d,
    entranceCount,
    entranceCountTouched: true,
    entrance: entrancePer > 0 ? round2(entrancePer * entranceCount) : d.entrance,
    entranceTouched: entrancePer > 0 ? false : d.entranceTouched,
  }
}

export function withPax(d: ReservedExcursionDraft, pax: number, entrancePer: number, lunchPer: number): ReservedExcursionDraft {
  const nextPax = Math.max(0, Math.round(pax))
  const lunchCount = d.lunchCountTouched ? d.lunchCount : nextPax
  const entranceCount = d.entranceCountTouched ? d.entranceCount : nextPax
  return {
    ...d,
    pax: nextPax,
    lunchCount,
    entranceCount,
    transport: d.transportTouched ? d.transport : round2(d.boatPer * nextPax),
    entrance: d.entranceTouched ? d.entrance : round2(entrancePer * entranceCount),
    lunch: d.lunchTouched ? d.lunch : (lunchPer > 0 ? round2(lunchPer * lunchCount) : d.lunch),
  }
}

export function withBoatChoice(d: ReservedExcursionDraft, boatId: string, boatPer: number): ReservedExcursionDraft {
  return withBoatPer({ ...d, boatId }, boatPer)
}

export function withLunchProvider(d: ReservedExcursionDraft, providerId: string, lunchPer: number): ReservedExcursionDraft {
  if (!providerId) {
    return { ...d, lunchProviderId: "", lunchCount: 0, lunch: 0, lunchTouched: false, lunchCountTouched: false }
  }
  const lunchCount = d.lunchCount > 0 ? d.lunchCount : d.pax
  return {
    ...d,
    lunchProviderId: providerId,
    lunchCount,
    lunchCountTouched: d.lunchCount > 0 && d.lunchCount !== d.pax,
    lunch: round2(lunchPer * lunchCount),
    lunchTouched: false,
  }
}
