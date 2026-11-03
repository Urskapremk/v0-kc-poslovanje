// Guest-facing path for a transfer that uses both a car and a boat.
// Each leg is stored as its own route ("Airport Fascene - Big Port Nosy Be",
// "Big port Nosy be - Komba Cabana"). On the notification, the guest invoice,
// and the voucher those two names must read as one path.

export type TransferDirection = 'arrival' | 'departure'

const LODGE = 'Komba Cabana'
const PORT = 'Big port Nosy Be'
const AIRPORT = 'Airport'

function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** One stop, written the same way on every combined transfer. */
export function displayStop(raw: string): string {
  const name = raw.replace(/\s+/g, ' ').trim()
  const n = fold(name)
  if (!n) return ''
  if (/\b(airport|fascene)\b/.test(n)) return AIRPORT
  if (/\bport\b/.test(n) && /\bnosy\b/.test(n)) return PORT
  if (n === 'komba' || n === 'komba cabana' || n.startsWith('komba cabana ')) return LODGE
  return name
}

export function routeStops(name: string): string[] {
  return name
    .split(/\s+(?:-|–|—|to)\s+/i)
    .map((stop) => displayStop(stop))
    .filter(Boolean)
}

function unique(stops: string[]): string[] {
  const out: string[] = []
  for (const stop of stops) {
    if (!out.includes(stop)) out.push(stop)
  }
  return out
}

/** Stops on the car leg, farthest from the port first. */
function farStops(carStops: string[], port: string): string[] {
  const idx = carStops.indexOf(port)
  if (idx === -1) return carStops.filter((stop) => stop !== port && stop !== LODGE)
  const before = carStops.slice(0, idx).filter((stop) => stop !== LODGE)
  const after = carStops.slice(idx + 1).filter((stop) => stop !== LODGE)
  if (before.length && !after.length) return before
  if (after.length && !before.length) return [...after].reverse()
  return [...before, ...[...after].reverse()]
}

/** Stops that sit between the port and the lodge, in the direction of the lodge. */
function betweenTowardLodge(boatStops: string[], port: string): string[] {
  const from = boatStops.indexOf(port)
  const to = boatStops.indexOf(LODGE)
  if (from === -1 || to === -1 || from === to) {
    return boatStops.filter((stop) => stop !== port && stop !== LODGE)
  }
  const middle = from < to ? boatStops.slice(from + 1, to) : boatStops.slice(to + 1, from).reverse()
  return middle.filter((stop) => stop !== port && stop !== LODGE)
}

function stitch(first: string[], second: string[]): string[] {
  const rest = [...second]
  if (first.length && rest.length && first[first.length - 1] === rest[0]) rest.shift()
  return [...first, ...rest]
}

function fallbackPath(boatStops: string[], carStops: string[], direction: TransferDirection): string[] {
  const carThenBoat = stitch(carStops, boatStops)
  const boatThenCar = stitch(boatStops, carStops)
  const endsAtLodge = (stops: string[]) => stops[stops.length - 1] === LODGE
  const startsAtLodge = (stops: string[]) => stops[0] === LODGE
  if (direction === 'arrival') {
    if (endsAtLodge(carThenBoat)) return carThenBoat
    if (endsAtLodge(boatThenCar)) return boatThenCar
    if (startsAtLodge(carThenBoat)) return [...carThenBoat].reverse()
    if (startsAtLodge(boatThenCar)) return [...boatThenCar].reverse()
    return carThenBoat
  }
  if (startsAtLodge(boatThenCar)) return boatThenCar
  if (startsAtLodge(carThenBoat)) return carThenBoat
  if (endsAtLodge(boatThenCar)) return [...boatThenCar].reverse()
  if (endsAtLodge(carThenBoat)) return [...carThenBoat].reverse()
  return boatThenCar
}

/**
 * Full path when both legs are set. Null when this is not a combined transfer
 * (a boat-only or car-only route keeps its own name).
 * Arrival runs toward the lodge. Departure runs away from it.
 * The shared port is written once.
 */
export function combinedRouteLabel(
  boatRoute: string | null | undefined,
  carRoute: string | null | undefined,
  direction: TransferDirection,
): string | null {
  const boatStops = routeStops(boatRoute || '')
  const carStops = routeStops(carRoute || '')
  if (boatStops.length === 0 || carStops.length === 0) return null
  if (!carStops.some((stop) => !boatStops.includes(stop))) return null

  const port = [...carStops, ...boatStops].find((stop) => stop === PORT)
  const lodge = [...boatStops, ...carStops].find((stop) => stop === LODGE)

  let path: string[]
  if (port && lodge) {
    const far = farStops(carStops, port)
    const middle = betweenTowardLodge(boatStops, port)
    path = direction === 'arrival'
      ? [...far, port, ...middle, lodge]
      : [lodge, ...[...middle].reverse(), port, ...[...far].reverse()]
  } else {
    path = fallbackPath(boatStops, carStops, direction)
  }

  const chain = unique(path)
  if (chain.length < 2) return null
  return chain.join(' - ')
}

/** Invoice / delivery-note line. The route slot is the full path when both legs exist. */
export function transferLineName(
  direction: TransferDirection,
  boatRoute: string,
  carRoute: string | null | undefined,
  boatName: string,
  pax: number,
): string {
  const label = combinedRouteLabel(boatRoute, carRoute, direction) || boatRoute
  const boat = boatName ? ` (${boatName})` : ''
  return `Transfer ${direction.toUpperCase()}: ${label}${boat} - ${pax} pax`
}

/**
 * Swap the route inside an already stored transfer line.
 * "Transfer ARRIVAL: Big port Nosy be - Komba Cabana (Citadel) - 2 pax"
 * keeps the boat and the guest count.
 */
export function withCombinedRouteInItemName(name: string, label: string | null | undefined): string {
  if (!label) return name
  const match = name.match(/^(Transfer (?:ARRIVAL|DEPARTURE): )(.*?)( - \d+ pax)\s*$/i)
  if (!match) return name
  const boat = match[2].match(/^(.*)( \([^)]*\))$/)
  const boatPart = boat ? boat[2] : ''
  return `${match[1]}${label}${boatPart}${match[3]}`
}

export function applyCombinedRouteLabels<T extends { name?: string | null; category?: string | null }>(
  items: T[],
  labels: { arrival: string | null; departure: string | null },
): T[] {
  return items.map((item) => {
    const name = item.name || ''
    if (item.category !== 'Transfer') return item
    const direction = /^Transfer ARRIVAL:/i.test(name)
      ? 'arrival'
      : /^Transfer DEPARTURE:/i.test(name)
        ? 'departure'
        : null
    if (!direction) return item
    const next = withCombinedRouteInItemName(name, labels[direction])
    if (next === name) return item
    return { ...item, name: next }
  })
}
