import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { reservations } from "@/lib/db/schema"
import { bungalowDisplayName } from "@/lib/bungalow"
import { isNull } from "drizzle-orm"

export const dynamic = "force-dynamic"

const BUNGALOWS = [
  "Ocean Bungalow I",
  "Ocean Bungalow II",
  "Garden Bungalow III",
  "Ocean Bungalow IV",
  "Jungle Glamp Village",
]

function normalizeBungalowName(s: string): string {
  return s.toLowerCase().replace(/bungalov\b/g, "bungalow")
}

function bungalowMatchesCanonical(bungalowField: string, canonical: string): boolean {
  const regex = new RegExp(`\\b${normalizeBungalowName(canonical)}\\b`)
  return regex.test(normalizeBungalowName(bungalowField || ""))
}

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10)
}

function toYmd(value: unknown): string {
  if (!value) return ""
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value).split("T")[0]
}

/** Kitchen app server calls (header) or optional shared bearer secret. */
function authorize(request: Request): boolean {
  if (request.headers.get("x-kc-kitchen-client") === "v0-kc-kitchen") return true

  const auth = request.headers.get("authorization") || ""
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : ""
  if (!token) return false

  const kitchenSecret = process.env.KC_KITCHEN_GUEST_BOARD_SECRET
  if (kitchenSecret && token === kitchenSecret) return true

  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && token === cronSecret) return true

  return false
}

export async function GET(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const today = todayYmd()

  try {
    const rows = await db.select().from(reservations).where(isNull(reservations.checkedOutAt))

    const active = rows.filter((r) => {
      const status = String(r.status || "").toUpperCase()
      return status !== "CANCELLED" && status !== "CHECKED_OUT" && !r.checkedOutAt
    })

    const claimedNow = new Set<string>()
    const bungalows = BUNGALOWS.map((canonical) => {
      const bungalowActive = active.filter((r) => bungalowMatchesCanonical(r.bungalow, canonical))
      const covering = bungalowActive.filter((r) => {
        const a = toYmd(r.arrival)
        const d = toYmd(r.departure)
        return a <= today && d >= today
      })
      const inHouseRow = covering.find((r) => r.checkedInAt && !r.checkedOutAt)
      const notDeparted = covering.find((r) => !r.checkedOutAt)
      let now = inHouseRow || notDeparted || covering[0]
      if (now) {
        if (claimedNow.has(now.id)) now = undefined
        else claimedNow.add(now.id)
      }

      const arriving = bungalowActive
        .filter((r) => !r.checkedInAt && !r.checkedOutAt && toYmd(r.arrival) === today)
        .sort((a, b) => toYmd(a.arrival).localeCompare(toYmd(b.arrival)))
        .map((r) => ({
          guestName: r.guestName,
          secondGuestName: r.secondGuestName,
          pax: r.pax ?? 2,
          arrival: toYmd(r.arrival),
          departure: toYmd(r.departure),
        }))

      const inHouse =
        now && now.checkedInAt && !now.checkedOutAt
          ? {
              guestName: now.guestName,
              secondGuestName: now.secondGuestName,
              pax: now.pax ?? 2,
              arrival: toYmd(now.arrival),
              departure: toYmd(now.departure),
              mealPlan: now.mealPlan ?? null,
            }
          : null

      return {
        canonicalName: canonical,
        displayName: bungalowDisplayName(canonical),
        inHouse,
        arriving,
      }
    })

    const inHouseCount = bungalows.filter((b) => b.inHouse).length
    const arrivingCount = bungalows.reduce((n, b) => n + b.arriving.length, 0)

    return NextResponse.json({
      today,
      bungalows,
      inHouseCount,
      arrivingCount,
    })
  } catch (e) {
    console.error("[kc-pos] kitchen guest-board:", (e as Error).message)
    return NextResponse.json({ error: "query_failed" }, { status: 500 })
  }
}
