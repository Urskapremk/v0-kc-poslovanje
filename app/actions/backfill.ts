'use server'

import { db } from '@/lib/db'
import { reservations, transfers, orderItems, excursions, routes, products } from '@/lib/db/schema'
import { eq, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { getExchangeRate, addPayment } from './komba'
import { addCashIncome } from './banka'

// Marker written into reservation.notes so historical backfill entries are recognisable
// (and can be found/removed later without touching real live reservations).
const BACKFILL_MARKER = '[Zgodovinski vnos]'

const BUNGALOWS = ['Ocean Bungalow I', 'Ocean Bungalow II', 'Garden Bungalow III', 'Ocean Bungalow IV', 'Jungle Glamp Village']

// Canonical products for extra services logged on past reservations.
// Massage → category 'Wellness' (wellness revenue, fixed cost per unit → one row per massage).
// Chocolate → shop item; its order_item name MUST equal the product name so statistics recognises
// it as an "ostalo" sale (category 'Trgovina') and applies the per-product cost ratio.
const MASSAGE_PRODUCT_ID = 'zuV9DjQNMn_sou4wISJvy'
const CHOCOLATE_PRODUCT_ID = 'ToRa-I5307rx_8_azWJDH'
const CHOCOLATE_NAME = 'Locally handcrafted chocolate from Nosy Komba Island'

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

// Lists for the backfill form's dropdowns: bungalows (fixed), excursions and transfer
// routes (from the DB, active only). Excursions/routes are chosen from these lists so the
// entered items carry the real names/ids the rest of the app expects.
export async function getBackfillOptions() {
  const [allExc, allRoutes, rate, mealProducts, extraProducts] = await Promise.all([
    db.select().from(excursions),
    db.select().from(routes),
    getExchangeRate(),
    db.select().from(products).where(inArray(products.id, ['meal-breakfast', 'meal-lunch', 'meal-dinner', 'meal-snack', 'meal-hb', 'meal-fb'])),
    // Massage (Wellness) + chocolate (ostalo shop item) — canonical products used for backfill.
    db.select().from(products).where(inArray(products.id, [MASSAGE_PRODUCT_ID, CHOCOLATE_PRODUCT_ID])),
  ])
  const massage = extraProducts.find(p => p.id === MASSAGE_PRODUCT_ID)
  const chocolate = extraProducts.find(p => p.id === CHOCOLATE_PRODUCT_ID)
  // Meal-plan price per person per night (Ar), by plan code. Same product IDs the live app and
  // statistics use; board value is later carved out of the accommodation total by statistics.
  const priceOf = (id: string) => Number(mealProducts.find(p => p.id === id)?.priceAr || 0)
  const mealPlanPricesAr: Record<string, number> = {
    B: priceOf('meal-breakfast'),
    HB: priceOf('meal-hb'),
    FB: priceOf('meal-fb'),
  }
  // Per-unit price (Ar) of individual à-la-carte meals, logged separately from the HB/FB board.
  const mealItemPricesAr = {
    breakfast: priceOf('meal-breakfast'),
    lunch: priceOf('meal-lunch'),
    dinner: priceOf('meal-dinner'),
    snack: priceOf('meal-snack'),
  }
  return {
    rate,
    mealPlanPricesAr,
    mealItemPricesAr,
    massagePriceAr: Number(massage?.priceAr || 0),
    chocolatePriceAr: Number(chocolate?.priceAr || 0),
    bungalows: BUNGALOWS,
    excursions: allExc
      .filter(e => e.active !== false)
      .map(e => ({ id: e.id, name: e.name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    routes: allRoutes
      .filter(r => r.active !== false && r.type === 'transfer')
      .map(r => ({ id: r.id, name: r.name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  }
}

export type BackfillInput = {
  guestName: string
  bungalow: string
  arrival: string // YYYY-MM-DD
  departure: string // YYYY-MM-DD
  pax: number
  nationality?: string
  email?: string
  bookingSource?: string
  agencyName?: string
  agencyCommission?: number // EUR
  mealPlan?: string // '', 'B', 'HB', 'FB'
  // Individual à-la-carte meals (counts), logged separately from the HB/FB board. Priced from
  // the product catalogue and booked as kitchen (Prehrana) revenue.
  meals?: { breakfast: number; lunch: number; dinner: number; snack: number }
  // Extra services (counts): massage → Wellness revenue; chocolate → shop (ostalo) revenue.
  massageCount?: number
  chocolateCount?: number
  // Revenue in EUR (guest-facing amounts only; supplier cost stays 0 for historical entries)
  accommodationEur: number
  drinksEur: number
  excursions: { excursionId: string; amountEur: number }[]
  transfers: { routeId: string; type: 'arrival' | 'departure'; pax: number; amountEur: number }[]
  // Payments — one or more, each with its own method/amount/date. Lets a historical stay be
  // split across methods (e.g. part cash, part card).
  payments: {
    method: 'cash' | 'card' | 'orange_money'
    amountEur: number
    date: string // YYYY-MM-DD
    cashCompany?: 'tourism' | 'sarl' // when method === 'cash'
    omAmountAr?: number // when method === 'orange_money' (Ar landed on OM)
    writeToRegister: boolean // cash → cash register, orange_money → OM wallet
  }[]
}

// Create a fully-formed past (already stayed and paid) reservation in one call.
// checkedInAt = arrival and checkedOutAt = departure so it lands straight in the archive
// and never shows on bungalow cards / current operations. Revenue rows are written into the
// same tables the monthly statistics read, so the past months' owner report stays complete.
export async function backfillPastReservation(input: BackfillInput) {
  try {
    if (!input.guestName?.trim()) return { error: 'Vnesite ime gosta.' }
    if (!input.bungalow) return { error: 'Izberite bungalov.' }
    if (!input.arrival || !input.departure) return { error: 'Vnesite datuma prihoda in odhoda.' }
    if (input.departure <= input.arrival) return { error: 'Odhod mora biti po prihodu.' }

    const rate = await getExchangeRate()
    const eurToAr = (eur: number) => Math.round((eur || 0) * rate)

    const resId = uid('res')
    const pax = Math.max(1, Number(input.pax) || 1)

    // Nominal method/date stamped on the individual items/transfers (they only need to read
    // as PAID; the real money split lives in the `payments` rows below).
    const nominalMethod = input.payments?.[0]?.method || 'cash'
    const nominalDate = input.payments?.[0]?.date || input.arrival

    // 1) Reservation — archived immediately (checkedIn/Out set).
    await db.insert(reservations).values({
      id: resId,
      guestName: input.guestName.trim(),
      bungalow: input.bungalow,
      pax,
      adults: pax,
      arrival: input.arrival,
      departure: input.departure,
      status: 'CHECKED_OUT',
      bookingSource: input.bookingSource || null,
      agencyName: input.agencyName || null,
      agencyCommission: input.agencyCommission ? String(input.agencyCommission) : '0',
      nationality: input.nationality || null,
      email: input.email || null,
      mealPlan: input.mealPlan || null,
      totalAmount: String(input.accommodationEur || 0),
      currency: 'EUR',
      notes: BACKFILL_MARKER,
      // checkedInAt/checkedOutAt are timestamps → pass Date objects. Setting checkedOutAt
      // moves the reservation into the archive; its month drives transfer attribution.
      checkedInAt: new Date(`${input.arrival}T12:00:00`),
      checkedOutAt: new Date(`${input.departure}T12:00:00`),
    })

    // 2) Excursions — one order_item per chosen excursion, priced in Ar, dated on arrival
    //    (eventDate drives the month the excursion revenue is attributed to).
    for (const ex of input.excursions || []) {
      if (!ex.excursionId || !ex.amountEur) continue
      const [exc] = await db.select().from(excursions).where(eq(excursions.id, ex.excursionId)).limit(1)
      await db.insert(orderItems).values({
        id: uid('oi'),
        reservationId: resId,
        name: `Izlet: ${exc?.name || 'Izlet'}`,
        category: 'Izlet',
        qty: 1,
        priceAr: eurToAr(ex.amountEur),
        paymentStatus: 'PAID',
        paidMethod: nominalMethod,
        paidDate: nominalDate,
        eventDate: input.arrival,
        addedBy: 'Urska',
      })
    }

    // 3) Drinks — single aggregate bar item, dated on arrival.
    if (input.drinksEur > 0) {
      await db.insert(orderItems).values({
        id: uid('oi'),
        reservationId: resId,
        name: 'Pijača (zbirno)',
        category: 'Pijaca',
        qty: 1,
        priceAr: eurToAr(input.drinksEur),
        paymentStatus: 'PAID',
        paidMethod: nominalMethod,
        paidDate: nominalDate,
        eventDate: input.arrival,
        addedBy: 'Urska',
      })
    }

    // 3b) Individual à-la-carte meals — one Prehrana order_item per meal type with a count > 0.
    //     Priced from the product catalogue (priceAr = unit × count). Category 'Prehrana' makes
    //     statistics book these as kitchen revenue (separate from the HB/FB board) with a derived
    //     food cost. eventDate = arrival drives the month.
    const meals = input.meals
    if (meals && (meals.breakfast || meals.lunch || meals.dinner || meals.snack)) {
      const mealProducts = await db.select().from(products)
        .where(inArray(products.id, ['meal-breakfast', 'meal-lunch', 'meal-dinner', 'meal-snack']))
      const unit = (id: string) => Number(mealProducts.find(p => p.id === id)?.priceAr || 0)
      const mealDefs: { id: string; label: string; count: number }[] = [
        { id: 'meal-breakfast', label: 'Zajtrk', count: Number(meals.breakfast) || 0 },
        { id: 'meal-lunch', label: 'Kosilo', count: Number(meals.lunch) || 0 },
        { id: 'meal-dinner', label: 'Večerja', count: Number(meals.dinner) || 0 },
        { id: 'meal-snack', label: 'Snack', count: Number(meals.snack) || 0 },
      ]
      for (const m of mealDefs) {
        if (m.count <= 0) continue
        await db.insert(orderItems).values({
          id: uid('oi'),
          reservationId: resId,
          name: `${m.label} × ${m.count}`,
          category: 'Prehrana',
          qty: m.count,
          priceAr: unit(m.id) * m.count,
          paymentStatus: 'PAID',
          paidMethod: nominalMethod,
          paidDate: nominalDate,
          eventDate: input.arrival,
          addedBy: 'Urska',
        })
      }
    }

    // 3c) Extra services — massage (Wellness) and chocolate (shop/ostalo).
    //     Prices come from the catalogue. Massage cost is fixed per unit, and statistics counts
    //     wellness by number of order_items, so we insert ONE row per massage. Chocolate is a
    //     single row (qty = count, priceAr = unit × count); its name MUST match the product so
    //     statistics recognises it as an "ostalo" sale and applies the per-product cost ratio.
    const [massageProd, chocolateProd] = await Promise.all([
      db.select().from(products).where(eq(products.id, MASSAGE_PRODUCT_ID)),
      db.select().from(products).where(eq(products.id, CHOCOLATE_PRODUCT_ID)),
    ])
    const massageUnit = Number(massageProd[0]?.priceAr || 0)
    const chocolateUnit = Number(chocolateProd[0]?.priceAr || 0)

    const massageCount = Number(input.massageCount) || 0
    for (let i = 0; i < massageCount; i++) {
      const massageId = uid('oi')
      await db.insert(orderItems).values({
        id: massageId,
        reservationId: resId,
        name: 'Malagasy Massage',
        category: 'Wellness',
        qty: 1,
        priceAr: massageUnit,
        paymentStatus: 'PAID',
        paidMethod: nominalMethod,
        paidDate: nominalDate,
        eventDate: input.arrival,
        addedBy: 'Urska',
      })
      try {
        const { syncMassageWorkerCash } = await import('./nabava')
        await syncMassageWorkerCash(massageId)
      } catch (e) {
        console.log('[v0] syncMassageWorkerCash (backfill) failed:', (e as Error).message)
      }
    }

    const chocolateCount = Number(input.chocolateCount) || 0
    if (chocolateCount > 0) {
      await db.insert(orderItems).values({
        id: uid('oi'),
        reservationId: resId,
        name: CHOCOLATE_NAME,
        category: 'Trgovina',
        qty: chocolateCount,
        priceAr: chocolateUnit * chocolateCount,
        paymentStatus: 'PAID',
        paidMethod: nominalMethod,
        paidDate: nominalDate,
        eventDate: input.arrival,
        addedBy: 'Urska',
      })
    }

    // 4) Transfers — one row per chosen route/direction. No boat/Herman route → supplier
    //    cost stays 0 (revenue only). Attributed to the checkout month via the reservation.
    for (const tr of input.transfers || []) {
      if (!tr.routeId || !tr.amountEur) continue
      await db.insert(transfers).values({
        id: uid('tr'),
        reservationId: resId,
        type: tr.type,
        route: tr.routeId,
        pax: Math.max(1, Number(tr.pax) || 1),
        guestPrice: String(tr.amountEur),
        paymentStatus: 'PAID',
        paidMethod: nominalMethod,
        paidDate: nominalDate,
        executed: true,
      })
    }

    // 5) Payments — one row per entered payment, on its historical date. Supports a stay
    //    split across methods (e.g. part cash, part card).
    for (const pay of input.payments || []) {
      const amt = Number(pay.amountEur) || 0
      if (amt <= 0) continue

      await addPayment({
        reservationId: resId,
        amount: String(amt),
        method: pay.method,
        paidAt: pay.date || nominalDate,
        notes: BACKFILL_MARKER,
        // Orange Money: pass the Ar amount so addPayment records the OM wallet inflow.
        omAmountAr:
          pay.method === 'orange_money' && pay.writeToRegister
            ? (pay.omAmountAr && pay.omAmountAr > 0 ? pay.omAmountAr : eurToAr(amt))
            : undefined,
      })

      // Cash goes into the cash register (Ar) for the chosen company. Card leaves both
      // ledgers untouched (it is neither cash nor Orange Money).
      if (pay.writeToRegister && pay.method === 'cash') {
        await addCashIncome({
          company: pay.cashCompany || 'tourism',
          date: pay.date || nominalDate,
          source: `Rezervacija — ${input.guestName.trim()}`,
          amount: eurToAr(amt),
        })
      }
    }

    revalidatePath('/')
    revalidatePath('/statistika')
    return { reservationId: resId }
  } catch (e) {
    console.log('[v0] backfillPastReservation error:', e instanceof Error ? e.message : String(e))
    return { error: 'Vnos ni uspel. Poskusite znova.' }
  }
}
