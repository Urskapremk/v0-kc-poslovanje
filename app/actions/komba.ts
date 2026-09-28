'use server'

import { db } from '@/lib/db'
import { reservations, transfers, orderItems, settings, boats, routes, supplements, routeSupplements, supplierPricing, sellingPricing, excursions, excursionPricing, excursionSellingPricing, excursionBookings, bentralReservations, guests, payments, agencies, products, lunchProviders, deliveryNotes, deliveryNoteItems, scheduledExcursions, staff, invoiceDiscounts, supplierPayments } from '@/lib/db/schema'
import { eq, and, or, lte, gte, desc, isNull, isNotNull, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { unpaySupplier } from './supplier-payment'
import { unpayFanja } from './fanja-payment'

// Generate unique ID
function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

// ============ SETTINGS ============

export async function getExchangeRate(): Promise<number> {
  const result = await db
    .select()
    .from(settings)
    .where(eq(settings.key, 'exchangeRate'))
    .limit(1)
  
  if (result.length > 0) {
    return Number(result[0].value) || 4800
  }
  return 4800
}

export async function updateExchangeRate(rate: number) {
  await db
    .insert(settings)
    .values({ key: 'exchangeRate', value: String(rate) })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: String(rate) }
    })
  revalidatePath('/')
}

// ============ INVOICE DISCOUNTS ============

export async function getInvoiceDiscounts(reservationId: string) {
  return db
    .select()
    .from(invoiceDiscounts)
    .where(eq(invoiceDiscounts.reservationId, reservationId))
    .orderBy(invoiceDiscounts.createdAt)
}

export async function addInvoiceDiscount(
  reservationId: string,
  kind: 'stay' | 'item' | 'credit',
  label: string,
  amountAr: number,
) {
  await db.insert(invoiceDiscounts).values({
    id: uid('disc'),
    reservationId,
    kind,
    label: label.trim() || (kind === 'stay' ? 'Discount on stay' : kind === 'credit' ? 'Credit' : 'Free item'),
    amountAr: Math.max(0, Math.round(amountAr || 0)),
  })
  revalidatePath(`/racun/${reservationId}`)
}

export async function deleteInvoiceDiscount(id: string, reservationId: string) {
  await db.delete(invoiceDiscounts).where(eq(invoiceDiscounts.id, id))
  revalidatePath(`/racun/${reservationId}`)
}

// ============ RESERVATIONS ============

// Get a single reservation by ID (including archived)
export async function getReservationById(reservationId: string) {
  const [res] = await db.select().from(reservations).where(eq(reservations.id, reservationId)).limit(1)
  if (!res) return null
  
  const resOrders = await db.select().from(orderItems).where(eq(orderItems.reservationId, reservationId))
  const resPayments = await db.select().from(payments).where(eq(payments.reservationId, reservationId))
  const resTransfers = await db.select().from(transfers).where(eq(transfers.reservationId, reservationId))
  const resDeliveryNotes = await db.select().from(deliveryNotes).where(eq(deliveryNotes.reservationId, reservationId))
  const rate = await getExchangeRate()
  
  return {
    ...res,
    arrival: res.arrival ? (typeof res.arrival === 'string' ? res.arrival : res.arrival.toISOString().split('T')[0]) : '',
    departure: res.departure ? (typeof res.departure === 'string' ? res.departure : res.departure.toISOString().split('T')[0]) : '',
    checkedInAt: res.checkedInAt ? (typeof res.checkedInAt === 'string' ? res.checkedInAt : res.checkedInAt.toISOString()) : null,
    checkedOutAt: res.checkedOutAt ? (typeof res.checkedOutAt === 'string' ? res.checkedOutAt : res.checkedOutAt.toISOString()) : null,
    totalAmount: Number(res.totalAmount) || 0,
    amountPaid: Number(res.amountPaid) || 0,
    agencyCommission: Number(res.agencyCommission) || 0,
    orderItems: resOrders.map(o => ({
      id: o.id,
      name: o.name,
      category: o.category,
      priceAr: o.priceAr || 0,
      refPriceAr: o.refPriceAr ?? null,
      paymentStatus: o.paymentStatus,
      isFree: o.isFree ?? false,
      eventDate: o.eventDate,
      paidMethod: o.paidMethod ?? null,
      paidDate: o.paidDate ?? null,
      dilipOrderedAt: o.dilipOrderedAt ? o.dilipOrderedAt.toISOString() : null,
      hermanOrderedAt: o.hermanOrderedAt ? o.hermanOrderedAt.toISOString() : null,
      addedBy: o.addedBy ?? 'Urska',
      // Hour the reception keyed it in, shown next to "Added by" on the delivery note.
      createdAt: o.createdAt ? o.createdAt.toISOString() : undefined
    })),
    payments: resPayments.map(p => ({
      id: p.id,
      amount: Number(p.amount),
      currency: p.currency,
      method: p.method,
      paidAt: p.paidAt ? (typeof p.paidAt === 'string' ? p.paidAt : p.paidAt.toISOString()) : '',
      notes: p.notes
    })),
    transfers: resTransfers.map(t => ({
      id: t.id,
      direction: t.direction,
      paymentStatus: t.paymentStatus
    })),
    deliveryNotesTotal: resDeliveryNotes.reduce((sum, dn) => sum + (dn.totalAr || 0), 0),
    exchangeRate: rate
  }
}

// ============ RESERVATIONS ============

export async function getReservations() {
  return db.select().from(reservations).orderBy(desc(reservations.arrival))
}

export async function getReservationWithDetails(id: string) {
  const [reservation] = await db.select().from(reservations).where(eq(reservations.id, id))
  if (!reservation) return null
  
  const reservationTransfers = await db.select().from(transfers).where(eq(transfers.reservationId, id))
  const reservationOrders = await db.select().from(orderItems).where(eq(orderItems.reservationId, id))
  
  const arrivalTransfer = reservationTransfers.find(t => t.type === 'arrival')
  const departureTransfer = reservationTransfers.find(t => t.type === 'departure')
  
  return {
    ...reservation,
    transfers: {
      arrival: arrivalTransfer ? {
        route: arrivalTransfer.route || '',
        time: arrivalTransfer.time || '',
        flightNumber: arrivalTransfer.flightNumber || '',
        flightTime: arrivalTransfer.flightTime || '',
        pickupDate: arrivalTransfer.pickupDate || '',
        pickupPoint: arrivalTransfer.pickupPoint || '',
        notes: arrivalTransfer.notes || '',
        boatId: arrivalTransfer.boatId || '',
        boatPortTime: arrivalTransfer.boatPortTime || '',
        hermanAirportTime: arrivalTransfer.hermanAirportTime || '',
  hermanRouteId: arrivalTransfer.hermanRouteId || '',
        taxiBoatId: arrivalTransfer.taxiBoatId || '',
        dilipOrderedAt: arrivalTransfer.dilipOrderedAt?.toISOString() || null,
        hermanOrderedAt: arrivalTransfer.hermanOrderedAt?.toISOString() || null,
        guestPrice: Number(arrivalTransfer.guestPrice) || 0,
        paymentStatus: arrivalTransfer.paymentStatus || 'UNPAID'
      } : { route: '', time: '', flightNumber: '', flightTime: '', pickupDate: '', pickupPoint: '', notes: '', boatId: '', boatPortTime: '', hermanAirportTime: '', hermanRouteId: '', taxiBoatId: '', dilipOrderedAt: null, hermanOrderedAt: null, guestPrice: 0, paymentStatus: 'UNPAID' },
      departure: departureTransfer ? {
        route: departureTransfer.route || '',
        time: departureTransfer.time || '',
        flightNumber: departureTransfer.flightNumber || '',
        flightTime: departureTransfer.flightTime || '',
        pickupDate: departureTransfer.pickupDate || '',
        pickupPoint: departureTransfer.pickupPoint || '',
        notes: departureTransfer.notes || '',
        boatId: departureTransfer.boatId || '',
        boatPortTime: departureTransfer.boatPortTime || '',
        hermanAirportTime: departureTransfer.hermanAirportTime || '',
  hermanRouteId: departureTransfer.hermanRouteId || '',
        taxiBoatId: departureTransfer.taxiBoatId || '',
        dilipOrderedAt: departureTransfer.dilipOrderedAt?.toISOString() || null,
        hermanOrderedAt: departureTransfer.hermanOrderedAt?.toISOString() || null,
        guestPrice: Number(departureTransfer.guestPrice) || 0,
        paymentStatus: departureTransfer.paymentStatus || 'UNPAID'
      } : { route: '', time: '', flightNumber: '', flightTime: '', pickupDate: '', pickupPoint: '', notes: '', boatId: '', boatPortTime: '', hermanAirportTime: '', hermanRouteId: '', taxiBoatId: '', dilipOrderedAt: null, hermanOrderedAt: null, guestPrice: 0, paymentStatus: 'UNPAID' }
    },
    orderItems: reservationOrders.map(o => ({
      id: o.id,
      name: o.name,
      category: o.category,
      qty: o.qty,
      priceAr: o.priceAr,
      refPriceAr: o.refPriceAr ?? null,
      paymentStatus: o.paymentStatus,
      isFree: o.isFree ?? false,
      eventDate: o.eventDate,
      paidMethod: o.paidMethod ?? null,
      paidDate: o.paidDate ?? null,
      addedBy: o.addedBy ?? 'Urska',
      // Hour the reception keyed it in, shown next to "Added by" on the delivery note.
      createdAt: o.createdAt ? o.createdAt.toISOString() : undefined
    }))
  }
}

export async function createReservation(data: {
  guestName: string
  bungalow: string
  pax: number
  arrival: string
  departure: string
  bookingSource?: string
  agencyName?: string
  agencyCommission?: number
  }) {
  const id = uid('res')
  await db.insert(reservations).values({
  id,
  guestName: data.guestName,
  bungalow: data.bungalow,
  pax: data.pax,
  arrival: data.arrival,
  departure: data.departure,
  status: 'RESERVED',
  bookingSource: data.bookingSource || null,
  agencyName: data.agencyName || null,
  agencyCommission: data.agencyCommission ? String(data.agencyCommission) : '0',
  })
  revalidatePath('/')
  return id
}

export async function updateReservation(id: string, data: Partial<{
  guestName: string
  secondGuestName: string
  bungalow: string
  pax: number
  arrival: string
  departure: string
  status: string
  bookingSource: string
  agencyName: string
  agencyCommission: number
  nationality: string
  passport: string
  dateOfBirth: string
  placeOfBirth: string
  fatherName: string
  motherName: string
  profession: string
  domicile: string
  passportDate: string
  passportLieu: string
  venantDe: string
  validiteVisa: string
  allantA: string
  secondNationality: string
  secondPassport: string
  secondDateOfBirth: string
  secondPlaceOfBirth: string
  secondFatherName: string
  secondMotherName: string
  secondProfession: string
  secondDomicile: string
  secondPassportDate: string
  secondPassportLieu: string
  secondVenantDe: string
  secondValiditeVisa: string
  secondAllantA: string
  thirdGuestName: string
  thirdNationality: string
  thirdPassport: string
  thirdDateOfBirth: string
  thirdPlaceOfBirth: string
  thirdFatherName: string
  thirdMotherName: string
  thirdProfession: string
  thirdDomicile: string
  thirdPassportDate: string
  thirdPassportLieu: string
  thirdVenantDe: string
  thirdValiditeVisa: string
  thirdAllantA: string
  fourthGuestName: string
  fourthNationality: string
  fourthPassport: string
  fourthDateOfBirth: string
  fourthPlaceOfBirth: string
  fourthFatherName: string
  fourthMotherName: string
  fourthProfession: string
  fourthDomicile: string
  fourthPassportDate: string
  fourthPassportLieu: string
  fourthVenantDe: string
  fourthValiditeVisa: string
  fourthAllantA: string
  guestBand: string
  secondGuestBand: string
  thirdGuestBand: string
  fourthGuestBand: string
  email: string
  phone: string
  allergies: string
  honeymoon: boolean
  noTransferNeeded: boolean
  ownArrivalTransfer: boolean
  ownDepartureTransfer: boolean
  ownArrivalTime: string | null
  guestTitle: string | null
  notes: string
  extensionNote: string
  showNoteOnCard: boolean
  checkedInAt: string | null
  checkedOutAt: string | null
  mealPlan: string
  mealPlanPax: number | null
  mealPlanPaymentStatus: string
  mealPlanSnack: boolean
  childrenAges: Record<string, number>
  totalAmount: number
  amountPaid: number
  groupId: string | null
  isMainReservation: boolean
  sharedInvoice: boolean
  excludeFromBar: boolean
}>) {
  // Convert checkedInAt/checkedOutAt string to Date if present, or null to clear
  const updateData: Record<string, unknown> = { ...data, updatedAt: new Date() }
  if (data.checkedInAt !== undefined) {
    updateData.checkedInAt = data.checkedInAt ? new Date(data.checkedInAt) : null
  }
  if (data.checkedOutAt !== undefined) {
    updateData.checkedOutAt = data.checkedOutAt ? new Date(data.checkedOutAt) : null
  }
  // Convert agencyCommission to string for decimal column
  if (data.agencyCommission !== undefined) {
    updateData.agencyCommission = String(data.agencyCommission)
  }
  await db.update(reservations)
    .set(updateData)
    .where(eq(reservations.id, id))

  // Keep the "Bivanje" (accommodation) order item in sync with the reservation.
  // It is created once at check-in, so extending the stay / changing the amount,
  // bungalow or pax would otherwise leave a stale line on the delivery note.
  const affectsAccommodation =
    data.totalAmount !== undefined ||
    data.amountPaid !== undefined ||
    data.arrival !== undefined ||
    data.departure !== undefined ||
    data.bungalow !== undefined ||
    data.pax !== undefined
  if (affectsAccommodation) {
    try {
      await syncAccommodationItem(id)
    } catch (e) {
      console.log('[v0] syncAccommodationItem failed:', (e as Error).message)
    }
  }
  // When arrival/departure change (e.g. extending the stay), re-date the transfer
  // order items so the departure/arrival transfer moves to the new date on the invoice.
  if (data.arrival !== undefined || data.departure !== undefined) {
    try {
      await syncTransferItem(id, 'arrival')
      await syncTransferItem(id, 'departure')
    } catch (e) {
      console.log('[v0] syncTransferItem (dates) failed:', (e as Error).message)
    }
  }
  // Note: revalidatePath removed to prevent input focus loss during typing
  // User can manually refresh to see changes
}

// Re-computes the existing "Bivanje" order item from the current reservation state.
// Does nothing if the accommodation item does not exist yet (guest not checked in).
async function syncAccommodationItem(reservationId: string) {
  const existing = await db
    .select()
    .from(orderItems)
    .where(and(eq(orderItems.reservationId, reservationId), eq(orderItems.category, 'Bivanje')))
  if (existing.length === 0) return

  const resRows = await db.select().from(reservations).where(eq(reservations.id, reservationId)).limit(1)
  const res = resRows[0]
  if (!res) return

  const rate = await getExchangeRate()
  const totalAmount = res.totalAmount ? Number(res.totalAmount) : 0
  const amountPaid = res.amountPaid ? Number(res.amountPaid) : 0
  const remainingEur = totalAmount - amountPaid

  const arr = res.arrival ? new Date(res.arrival) : null
  const dep = res.departure ? new Date(res.departure) : null
  const nights = arr && dep ? Math.ceil((dep.getTime() - arr.getTime()) / (1000 * 60 * 60 * 24)) : 0

  const pays = await db.select().from(payments).where(eq(payments.reservationId, reservationId))
  const paymentInfoParts = pays.map((p) => {
    const amt = Number(p.amount)
    const method =
      p.method === 'card' ? 'kartica' : p.method === 'cash' ? 'gotovina' : p.method === 'transfer' ? 'nakazilo' : p.method
    const date = new Date(p.paidAt).toLocaleDateString('sl-SI')
    return `${amt.toFixed(2)} EUR (${method}, ${date})`
  })
  const paymentInfo = paymentInfoParts.length > 0 ? ` | Placano: ${paymentInfoParts.join(', ')}` : ''

  const name = `Bivanje ${res.bungalow} (${nights} noci, ${res.pax} oseb) | Skupaj: ${totalAmount.toFixed(2)} EUR${paymentInfo}`
  const priceAr = Math.max(0, Math.round(remainingEur * rate))
  const paymentStatus = remainingEur > 0.005 ? 'UNPAID' : 'PAID'

  await db
    .update(orderItems)
    .set({ name, priceAr, paymentStatus })
    .where(and(eq(orderItems.reservationId, reservationId), eq(orderItems.category, 'Bivanje')))
}

// Keep the transfer's order_item (shown on the delivery note / invoice) in sync
// when a transfer is added or edited AFTER check-in. At check-in generateOrderItems
// creates these items, but transfers added later never got one — so the delivery
// note for that day was missing the transfer. Runs only for checked-in guests to
// avoid creating a duplicate that check-in would then add again.
async function syncTransferItem(reservationId: string, type: 'arrival' | 'departure') {
  const resRows = await db.select().from(reservations).where(eq(reservations.id, reservationId)).limit(1)
  const res = resRows[0]
  if (!res || !res.checkedInAt) return // not checked in yet → check-in will generate it

  const namePrefix = `Transfer ${type.toUpperCase()}:`
  const existing = await db
    .select()
    .from(orderItems)
    .where(and(eq(orderItems.reservationId, reservationId), eq(orderItems.category, 'Transfer')))
  const match = existing.find((i) => (i.name || '').startsWith(namePrefix))

  const trRows = await db.select().from(transfers)
    .where(and(eq(transfers.reservationId, reservationId), eq(transfers.type, type)))
    .limit(1)
  const tr = trRows[0]

  // Transfer removed or has no route → remove the stale order item (if any) and stop.
  if (!tr || !tr.route) {
    if (match) await db.delete(orderItems).where(eq(orderItems.id, match.id))
    return
  }

  const rate = await getExchangeRate()
  const pax = res.pax || 1
  const isPaid = tr.paymentStatus === 'PAID'
  const guestPriceEur = tr.guestPrice ? Number(tr.guestPrice) : 0
  const fullPriceAr = Math.round(guestPriceEur * rate)
  const priceAr = isPaid ? 0 : fullPriceAr
  const refPriceAr = fullPriceAr // real price kept for display, even when paid
  const paidMethod = isPaid ? (tr.paidMethod ?? null) : null
  const paidDate = isPaid ? (tr.paidDate ?? null) : null

  const routeRow = tr.route ? (await db.select().from(routes).where(eq(routes.id, tr.route)).limit(1))[0] : null
  const boatRow = tr.boatId ? (await db.select().from(boats).where(eq(boats.id, tr.boatId)).limit(1))[0] : null
  const routeName = routeRow?.name || tr.route
  const boatName = boatRow?.name || ''

  const dateSrc = type === 'arrival' ? res.arrival : res.departure
  const eventDate = dateSrc ? new Date(dateSrc).toISOString().split('T')[0] : null
  const name = `Transfer ${type.toUpperCase()}: ${routeName}${boatName ? ` (${boatName})` : ''} - ${pax} pax`
  const paymentStatus = isPaid ? 'PAID' : 'UNPAID'

  if (match) {
    await db.update(orderItems)
      .set({ name, priceAr, refPriceAr, paymentStatus, paidMethod, paidDate, eventDate })
      .where(eq(orderItems.id, match.id))
  } else {
    await db.insert(orderItems).values({
      id: uid('ord'),
      reservationId,
      name,
      category: 'Transfer',
      qty: 1,
      priceAr,
      refPriceAr,
      paymentStatus,
      paidMethod,
      paidDate,
      eventDate,
      addedBy: 'Urska',
    })
  }
}

export async function deleteReservation(id: string) {
  await db.delete(reservations).where(eq(reservations.id, id))
  revalidatePath('/')
}

// ============ RESERVATION GROUPS ============

// Create a new group with the given reservation as main
export async function createReservationGroup(mainReservationId: string) {
  const groupId = uid('grp')
  await db.update(reservations)
    .set({ groupId, isMainReservation: true })
    .where(eq(reservations.id, mainReservationId))
  revalidatePath('/')
  return groupId
}

// Link a reservation to an existing group
export async function linkReservationToGroup(reservationId: string, groupId: string) {
  await db.update(reservations)
    .set({ groupId, isMainReservation: false })
    .where(eq(reservations.id, reservationId))
  revalidatePath('/')
}

// Unlink a reservation from its group
export async function unlinkReservationFromGroup(reservationId: string) {
  // First check if this is the main reservation
  const [res] = await db.select().from(reservations).where(eq(reservations.id, reservationId))
  if (!res) return
  
  if (res.isMainReservation && res.groupId) {
    // Find another reservation in the group to make main
    const [nextMain] = await db.select()
      .from(reservations)
      .where(and(
        eq(reservations.groupId, res.groupId),
        sql`${reservations.id} != ${reservationId}`
      ))
      .limit(1)
    
    if (nextMain) {
      // Make the next one main
      await db.update(reservations)
        .set({ isMainReservation: true })
        .where(eq(reservations.id, nextMain.id))
    }
  }
  
  // Unlink this reservation
  await db.update(reservations)
    .set({ groupId: null, isMainReservation: false })
    .where(eq(reservations.id, reservationId))
  
  revalidatePath('/')
}

// Get all reservations in a group
export async function getGroupReservations(groupId: string) {
  return db.select().from(reservations).where(eq(reservations.groupId, groupId))
}

// ============ TRANSFERS ============

export async function updateTransfer(reservationId: string, type: 'arrival' | 'departure', data: {
  route?: string
  time?: string
  flightNumber?: string
  flightTime?: string
  pickupDate?: string
  pickupPoint?: string
  notes?: string
  boatId?: string
  boatPortTime?: string
  hermanAirportTime?: string
  hermanRouteId?: string
  taxiBoatId?: string
  dilipOrderedAt?: Date | null
  hermanOrderedAt?: Date | null
  guestPrice?: number
  paymentStatus?: string
  paidMethod?: string | null
  paidDate?: string | null
  executed?: boolean
  executedAt?: string | null
}) {
  const existing = await db.select().from(transfers)
    .where(and(eq(transfers.reservationId, reservationId), eq(transfers.type, type)))
    .limit(1)
  
  if (existing.length > 0) {
    await db.update(transfers)
      .set({
        route: data.route ?? existing[0].route,
        time: data.time ?? existing[0].time,
        flightNumber: data.flightNumber ?? existing[0].flightNumber,
        flightTime: data.flightTime ?? existing[0].flightTime,
        pickupDate: data.pickupDate ?? existing[0].pickupDate,
        pickupPoint: data.pickupPoint ?? existing[0].pickupPoint,
        notes: data.notes ?? existing[0].notes,
        boatId: data.boatId ?? existing[0].boatId,
  boatPortTime: data.boatPortTime ?? existing[0].boatPortTime,
  hermanAirportTime: data.hermanAirportTime ?? existing[0].hermanAirportTime,
  hermanRouteId: data.hermanRouteId !== undefined ? (data.hermanRouteId || null) : existing[0].hermanRouteId,
  taxiBoatId: data.taxiBoatId !== undefined ? (data.taxiBoatId || null) : existing[0].taxiBoatId,
  dilipOrderedAt: data.dilipOrderedAt !== undefined ? data.dilipOrderedAt : existing[0].dilipOrderedAt,
        hermanOrderedAt: data.hermanOrderedAt !== undefined ? data.hermanOrderedAt : existing[0].hermanOrderedAt,
        guestPrice: data.guestPrice !== undefined ? String(data.guestPrice) : existing[0].guestPrice,
        paymentStatus: data.paymentStatus ?? existing[0].paymentStatus,
        paidMethod: data.paidMethod !== undefined ? data.paidMethod : existing[0].paidMethod,
        paidDate: data.paidDate !== undefined ? data.paidDate : existing[0].paidDate,
        executed: data.executed !== undefined ? data.executed : existing[0].executed,
        executedAt: data.executedAt !== undefined ? (data.executedAt ? new Date(data.executedAt) : null) : existing[0].executedAt
      })
      .where(eq(transfers.id, existing[0].id))
  } else {
    await db.insert(transfers).values({
      id: uid('tr'),
      reservationId,
      type,
      route: data.route || '',
      time: data.time || '',
      flightNumber: data.flightNumber,
      flightTime: data.flightTime,
      pickupDate: data.pickupDate,
      pickupPoint: data.pickupPoint,
      notes: data.notes,
      boatId: data.boatId,
      boatPortTime: data.boatPortTime,
      hermanAirportTime: data.hermanAirportTime,
      hermanRouteId: data.hermanRouteId || null,
      taxiBoatId: data.taxiBoatId || null,
      dilipOrderedAt: data.dilipOrderedAt,
      hermanOrderedAt: data.hermanOrderedAt,
      guestPrice: String(data.guestPrice || 0),
      paymentStatus: data.paymentStatus || 'UNPAID',
      paidMethod: data.paidMethod ?? null,
      paidDate: data.paidDate ?? null,
      executed: data.executed || false,
      executedAt: data.executedAt ? new Date(data.executedAt) : null
    })
  }
  // Keep the delivery-note / invoice order item in sync for checked-in guests.
  try {
    await syncTransferItem(reservationId, type)
  } catch (e) {
    console.log('[v0] syncTransferItem failed:', (e as Error).message)
  }
  revalidatePath('/')
}

export async function deleteTransfer(reservationId: string, type: 'arrival' | 'departure') {
  await db.delete(transfers)
    .where(and(eq(transfers.reservationId, reservationId), eq(transfers.type, type)))
  // Remove the matching order item so it disappears from the delivery note too.
  try {
    await syncTransferItem(reservationId, type)
  } catch (e) {
    console.log('[v0] syncTransferItem (delete) failed:', (e as Error).message)
  }
  revalidatePath('/')
}

// ============ ORDER ITEMS ============

export async function addOrderItem(reservationId: string, data: {
  name: string
  category: string
  qty: number
  priceAr: number
  refPriceAr?: number // real price for display even when paid (priceAr = 0); does not affect totals
  paymentStatus?: string
  paidMethod?: string // 'card' | 'cash' | 'transfer' ��� how the guest paid (for invoice)
  paidDate?: string // YYYY-MM-DD when the guest paid (for invoice)
  eventDate?: string // Date when the item/service occurs (for excursions, transfers)
  addedBy?: string // who added this item at reception (defaults to Urska)
}) {
  await db.insert(orderItems).values({
    id: uid('ord'),
    reservationId,
    name: data.name,
    category: data.category,
    qty: data.qty,
    priceAr: data.priceAr,
    refPriceAr: data.refPriceAr ?? null,
    paymentStatus: data.paymentStatus || 'UNPAID',
    paidMethod: data.paidMethod ?? null,
    paidDate: data.paidDate ?? null,
    eventDate: data.eventDate || null,
    addedBy: data.addedBy || 'Urska'
  })
  revalidatePath('/')
}

// Reverse every recorded payment tied to an excursion booking (supplier: Dilip/lunch/
// entrance, and Fanja) so the cash blagajna / Orange Money balances are corrected, then
// delete the booking itself. Idempotent — unpaySupplier/unpayFanja no-op when nothing was paid.
async function reverseAndDeleteExcursionBooking(booking: { id: string; groupId?: string | null }) {
  const groupKey = booking.groupId ? `g:${booking.groupId}` : `s:${booking.id}`
  await unpaySupplier({ refKey: `excursion:${groupKey}:dilip` })
  await unpaySupplier({ refKey: `excursion:${groupKey}:lunch` })
  await unpaySupplier({ refKey: `excursion:${groupKey}:entrance` })
  await unpayFanja({ bookingIds: [booking.id] })
  await db.delete(excursionBookings).where(eq(excursionBookings.id, booking.id))
}

export async function deleteOrderItem(id: string) {
  const [item] = await db.select().from(orderItems).where(eq(orderItems.id, id)).limit(1)

  // If the deleted line is an excursion, ALSO remove the linked booking from the archive
  // and reverse any clicked supplier/Fanja payments (money returns to blagajna / Orange Money).
  // There is no FK between order_items and excursion_bookings, so we match by reservation +
  // the excursion name appearing in the order item name + (when set) the same service date.
  const isExcursion = item && (item.category === 'Izlet' || /^(Izlet|Excursion):/i.test(item.name || ''))
  if (isExcursion && item?.reservationId) {
    const itemNameLc = (item.name || '').toLowerCase()
    const itemDate = item.eventDate ? String(item.eventDate).slice(0, 10) : null
    const bookings = await db.select().from(excursionBookings).where(eq(excursionBookings.reservationId, item.reservationId))
    const excNames = await db.select({ id: excursions.id, name: excursions.name }).from(excursions)
    const nameById = new Map(excNames.map((e) => [e.id, (e.name || '').trim()]))
    for (const b of bookings) {
      const excName = (nameById.get(b.excursionId) || '').toLowerCase().trim()
      const nameMatch = excName ? itemNameLc.includes(excName) : false
      const dateMatch = itemDate ? String(b.date).slice(0, 10) === itemDate : true
      if (nameMatch && dateMatch) {
        await reverseAndDeleteExcursionBooking(b)
      }
    }
  }

  await db.delete(orderItems).where(eq(orderItems.id, id))
  revalidatePath('/')
  revalidatePath('/statistika')
}

export async function getOrderItems(reservationId: string) {
  return await db.select().from(orderItems).where(eq(orderItems.reservationId, reservationId))
}

export async function updateOrderItemPaymentStatus(id: string, status: string) {
  await db.update(orderItems).set({ paymentStatus: status }).where(eq(orderItems.id, id))
  revalidatePath('/')
}

// Fix the service date (eventDate) of an order item. Reception uses this to correct a
// mistyped excursion/service date so the item groups under the right day on the delivery
// note. Expects a plain YYYY-MM-DD string; empty clears it (falls back to createdAt).
// For excursion items we ALSO sync the matching excursion_booking date, so the Borut
// "IZLETI" card and the excursion archive (which read from excursion_bookings) stay
// consistent — otherwise the wrong date would linger there. There is no FK link between
// order_items and excursion_bookings, so we match by reservation + the SAME old date.
export async function updateOrderItemDate(id: string, eventDate: string) {
  const clean = eventDate && /^\d{4}-\d{2}-\d{2}$/.test(eventDate) ? eventDate : null

  const [item] = await db.select().from(orderItems).where(eq(orderItems.id, id)).limit(1)
  const oldDate = item?.eventDate ? String(item.eventDate).slice(0, 10) : null

  await db.update(orderItems).set({ eventDate: clean }).where(eq(orderItems.id, id))

  // Keep the linked excursion booking in sync (same reservation + same old date).
  const isExcursion = item && (item.category === 'Izlet' || /^(Izlet|Excursion):/i.test(item.name || ''))
  if (isExcursion && clean && item?.reservationId) {
    const bookings = await db.select().from(excursionBookings).where(eq(excursionBookings.reservationId, item.reservationId))
    for (const b of bookings) {
      if (oldDate && String(b.date).slice(0, 10) === oldDate) {
        await db.update(excursionBookings).set({ date: clean }).where(eq(excursionBookings.id, b.id))
      }
    }
  }

  revalidatePath('/')
}

// Mark an order item (e.g. massage, snack, excursion) as complimentary ("On House") or billable again.
// Free items are set to PAID so they leave the "to pay" list and are excluded from the invoice total.
export async function toggleOrderItemFree(id: string, free: boolean) {
  await db.update(orderItems).set({ isFree: free, paymentStatus: free ? 'PAID' : 'UNPAID' }).where(eq(orderItems.id, id))
  revalidatePath('/')
}

// Reception ad-hoc transfer (order_items): mark the boat (Dilip) or Herman taxi as ordered/unordered.
export async function setOrderItemTransferOrdered(id: string, which: 'dilip' | 'herman', ordered: boolean) {
  const value = ordered ? new Date() : null
  await db.update(orderItems)
    .set(which === 'dilip' ? { dilipOrderedAt: value } : { hermanOrderedAt: value })
    .where(eq(orderItems.id, id))
  revalidatePath('/')
}

// ============ DASHBOARD DATA ============

export async function getDashboardData(includeReservationId?: string) {
  // Only fetch ACTIVE reservations (not checked out) for dashboard performance.
  // `includeReservationId` additionally pulls in ONE already checked-out guest, so a
  // past guest opened from search gets a full card (emails, dobavnica, payments).
  const allReservations = await db.select().from(reservations)
    .where(
      includeReservationId
        ? or(isNull(reservations.checkedOutAt), eq(reservations.id, includeReservationId))
        : isNull(reservations.checkedOutAt)
    )
    .orderBy(desc(reservations.arrival))
  const allTransfers = await db.select().from(transfers)
  const allOrders = await db.select().from(orderItems)
  const allExcursionBookings = await db.select().from(excursionBookings)
  const allPayments = await db.select().from(payments)
  const allDeliveryNotes = await db.select().from(deliveryNotes)
  const allDeliveryNoteItems = await db.select().from(deliveryNoteItems)
  const rate = await getExchangeRate()
  
  // Fetch additional data needed by frontend
  const allBoats = await db.select().from(boats).where(eq(boats.active, true))
  const allRoutes = await db.select().from(routes).where(eq(routes.active, true))
  // All routes incl. inactive — used only to resolve supplier costs across
  // same-named duplicate routes (e.g. active "route-airport" for the guest price
  // and inactive "route-port" holding the boat's supplier cost).
  const allRoutesRaw = await db.select().from(routes)
  const allSellingPricing = await db.select().from(sellingPricing)
  const allSupplierPricing = await db.select().from(supplierPricing).where(eq(supplierPricing.active, true))
  const allExcursions = await db.select().from(excursions).where(eq(excursions.active, true))
  const allExcursionSellingPricing = await db.select().from(excursionSellingPricing)
  const allExcursionPricing = await db.select().from(excursionPricing).where(eq(excursionPricing.active, true))
const allLunchProviders = await db.select().from(lunchProviders).where(eq(lunchProviders.active, true))
const allScheduledExcursions = await db.select().from(scheduledExcursions).orderBy(scheduledExcursions.date)
const allStaff = await db.select().from(staff).where(eq(staff.active, true)).orderBy(staff.name)
const allSupplierPayments = await db.select().from(supplierPayments)
  
  // Meal plan pricing. Match by the actual board product IDs (they live in the
  // "Food" category, not "Prehrana"), so getMealPlanPrice finds the real cenik
  // price and board (HB/FB/B) is billed per person/day — the user's decision:
  // marking a guest as half board means it must be charged unless paid.
  const BOARD_PRODUCT_IDS = ['meal-breakfast', 'meal-hb', 'meal-fb', 'meal-lunch', 'meal-dinner']
  const allProducts = await db.select().from(products).where(eq(products.active, true))
  const mealProducts = allProducts.filter(p => BOARD_PRODUCT_IDS.includes(p.id) || p.category === 'Prehrana').map(p => ({
    id: p.id,
    name: p.name,
    priceAr: p.priceAr || 0
  }))
  
  // Build reservation data with transfers and orders
  const reservationsWithDetails = allReservations.map(res => {
    const resTransfers = allTransfers.filter(t => t.reservationId === res.id)
    const resOrders = allOrders.filter(o => o.reservationId === res.id)
    const resExcursions = allExcursionBookings.filter(e => e.reservationId === res.id)
    const resPayments = allPayments.filter(p => p.reservationId === res.id)
    const resDeliveryNotes = allDeliveryNotes.filter(dn => dn.reservationId === res.id)
    const resDeliveryNoteItems = allDeliveryNoteItems.filter(dni => 
      resDeliveryNotes.some(dn => dn.id === dni.deliveryNoteId)
    )
    
    const arrivalTransfer = resTransfers.find(t => t.type === 'arrival')
    const departureTransfer = resTransfers.find(t => t.type === 'departure')
    
    return {
      ...res,
      transfers: {
        arrival: arrivalTransfer ? {
          route: arrivalTransfer.route || '',
          time: arrivalTransfer.time || '',
          flightNumber: arrivalTransfer.flightNumber || '',
          flightTime: arrivalTransfer.flightTime || '',
          pickupDate: arrivalTransfer.pickupDate || '',
          pickupPoint: arrivalTransfer.pickupPoint || '',
          notes: arrivalTransfer.notes || '',
          boatId: arrivalTransfer.boatId || '',
          boatPortTime: arrivalTransfer.boatPortTime || '',
          hermanAirportTime: arrivalTransfer.hermanAirportTime || '',
  hermanRouteId: arrivalTransfer.hermanRouteId || '',
          taxiBoatId: arrivalTransfer.taxiBoatId || '',
          dilipOrderedAt: arrivalTransfer.dilipOrderedAt?.toISOString() || null,
          hermanOrderedAt: arrivalTransfer.hermanOrderedAt?.toISOString() || null,
          guestPrice: Number(arrivalTransfer.guestPrice) || 0,
          paymentStatus: arrivalTransfer.paymentStatus || 'UNPAID',
          paidMethod: arrivalTransfer.paidMethod || '',
          paidDate: arrivalTransfer.paidDate || '',
          executed: arrivalTransfer.executed || false,
          executedAt: arrivalTransfer.executedAt?.toISOString() || null
        } : { route: '', time: '', flightNumber: '', flightTime: '', pickupDate: '', pickupPoint: '', notes: '', boatId: '', boatPortTime: '', hermanAirportTime: '', hermanRouteId: '', taxiBoatId: '', dilipOrderedAt: null, hermanOrderedAt: null, guestPrice: 0, paymentStatus: 'UNPAID', paidMethod: '', paidDate: '', executed: false, executedAt: null },
        departure: departureTransfer ? {
          route: departureTransfer.route || '',
          time: departureTransfer.time || '',
          flightNumber: departureTransfer.flightNumber || '',
          flightTime: departureTransfer.flightTime || '',
          pickupDate: departureTransfer.pickupDate || '',
          pickupPoint: departureTransfer.pickupPoint || '',
          notes: departureTransfer.notes || '',
          boatId: departureTransfer.boatId || '',
          boatPortTime: departureTransfer.boatPortTime || '',
          hermanAirportTime: departureTransfer.hermanAirportTime || '',
  hermanRouteId: departureTransfer.hermanRouteId || '',
          taxiBoatId: departureTransfer.taxiBoatId || '',
          dilipOrderedAt: departureTransfer.dilipOrderedAt?.toISOString() || null,
          hermanOrderedAt: departureTransfer.hermanOrderedAt?.toISOString() || null,
          guestPrice: Number(departureTransfer.guestPrice) || 0,
          paymentStatus: departureTransfer.paymentStatus || 'UNPAID',
          paidMethod: departureTransfer.paidMethod || '',
          paidDate: departureTransfer.paidDate || '',
          executed: departureTransfer.executed || false,
          executedAt: departureTransfer.executedAt?.toISOString() || null
        } : { route: '', time: '', flightNumber: '', flightTime: '', pickupDate: '', pickupPoint: '', notes: '', boatId: '', boatPortTime: '', hermanAirportTime: '', hermanRouteId: '', taxiBoatId: '', dilipOrderedAt: null, hermanOrderedAt: null, guestPrice: 0, paymentStatus: 'UNPAID', paidMethod: '', paidDate: '' }
      },
      orderItems: resOrders.map(o => ({
        id: o.id,
        name: o.name,
        category: o.category,
        qty: o.qty,
        priceAr: o.priceAr,
        refPriceAr: o.refPriceAr ?? null,
        paymentStatus: o.paymentStatus,
        isFree: o.isFree ?? false,
        eventDate: o.eventDate,
        paidMethod: o.paidMethod ?? null,
        paidDate: o.paidDate ?? null,
        dilipOrderedAt: o.dilipOrderedAt ? o.dilipOrderedAt.toISOString() : null,
        hermanOrderedAt: o.hermanOrderedAt ? o.hermanOrderedAt.toISOString() : null,
        addedBy: o.addedBy ?? 'Urska',
        // Hour the reception keyed it in, shown next to "Added by" on the delivery note.
        createdAt: o.createdAt ? o.createdAt.toISOString() : undefined
      })),
      payments: resPayments.map(p => ({
        id: p.id,
        amount: Number(p.amount),
        currency: p.currency,
        method: p.method,
        paidAt: p.paidAt ? (typeof p.paidAt === 'string' ? p.paidAt : (p.paidAt instanceof Date ? p.paidAt.toISOString() : String(p.paidAt))) : '',
        notes: p.notes
      })),
      deliveryNotesTotal: resDeliveryNotes.reduce((sum, dn) => sum + (dn.totalAr || 0), 0),
      barItems: resDeliveryNoteItems.map(dni => {
        const note = resDeliveryNotes.find(dn => dn.id === dni.deliveryNoteId)
        return {
          id: dni.id,
          deliveryNoteId: dni.deliveryNoteId,
          productName: dni.productName,
          category: dni.category,
          quantity: dni.quantity,
          priceAr: dni.priceAr,
          totalAr: dni.totalAr,
          coveredByMealPlan: dni.coveredByMealPlan ?? false,
          isFree: dni.isFree ?? false,
          noteDate: note?.date ? (typeof note.date === 'string' ? note.date.split('T')[0] : note.date.toISOString().split('T')[0]) : new Date().toISOString().split('T')[0],
          noteStatus: note?.status || 'open',
          staffName: dni.staffName,
          // When the bar actually rang it up, so the delivery note can show the hour
          // next to who served it. Distinct from noteDate, which is only the day.
          createdAt: dni.createdAt
            ? (dni.createdAt instanceof Date ? dni.createdAt.toISOString() : String(dni.createdAt))
            : undefined
        }
      }),
excursions: resExcursions.map(e => ({
  id: e.id,
  excursionId: e.excursionId,
  boatId: e.boatId,
  date: e.date,
  pax: e.pax,
  guestPrice: e.guestPrice ? Number(e.guestPrice) : 0,
  entranceFee: e.entranceFee ? Number(e.entranceFee) : 0,
  extraEntranceAr: e.extraEntranceAr ? Number(e.extraEntranceAr) : 0,
  extraEntranceLabel: e.extraEntranceLabel || '',
  lunchPrice: e.lunchPrice ? Number(e.lunchPrice) : 0,
  lunchPax: e.lunchPax || 0,
  paymentStatus: e.paymentStatus,
  paidMethod: e.paidMethod || '',
  paidDate: e.paidDate || '',
  lunchProviderId: e.lunchProviderId,
  groupId: e.groupId || null,
  groupPax: e.groupPax || null,
  dilipOrderedAt: e.dilipOrderedAt?.toISOString() || null,
  fanjaPaidAt: e.fanjaPaidAt || null,
  fanjaPaidMethod: e.fanjaPaidMethod || null,
  fanjaPaidCompany: e.fanjaPaidCompany || null,
  fanjaPaidAmountAr: e.fanjaPaidAmountAr ? Number(e.fanjaPaidAmountAr) : 0,
  status: e.status || 'ACTIVE',
  cancelledAt: e.cancelledAt?.toISOString() || null,
  cancelReason: e.cancelReason || null
  }))
    }
  })
  
  return {
    reservations: reservationsWithDetails,
    exchangeRate: rate,
    mealProducts,
    allProducts: allProducts.map(p => ({
      id: p.id,
      name: p.name,
      category: p.category,
      costCategory: p.costCategory || 'pijaca',
      priceAr: p.priceAr || 0,
      editablePrice: p.editablePrice ?? false
    })),
    boats: allBoats,
    routes: allRoutes,
    routesAll: allRoutesRaw.map((r) => ({ id: r.id, name: r.name })),
    sellingPricing: allSellingPricing,
    supplierPricing: allSupplierPricing,
    excursions: allExcursions,
    excursionSellingPricing: allExcursionSellingPricing,
    excursionPricing: allExcursionPricing,
    lunchProviders: allLunchProviders,
    scheduledExcursions: allScheduledExcursions.map(s => {
      // Normalize date to YYYY-MM-DD format
      const schedDate = String(s.date).split('T')[0]
      
      const matchingBookings = allExcursionBookings.filter(b => {
        // Cancelled bookings (converted to credit) drop out of the schedule.
        if (b.status === 'CANCELLED') return false
        const bookDate = String(b.date).split('T')[0]
        if (schedDate !== bookDate) return false
        // Only show guests whose booked excursion matches this Fanja trip type
        // (e.g. Ampangorina is a private trip and must not appear under Fanja's).
        const excName = allExcursions.find(e => e.id === b.excursionId)?.name
        return excursionMatchesScheduleType(excName, s.excursionType)
      })
      
      return {
        id: s.id,
        date: s.date,
        excursionType: s.excursionType,
        isOption: s.isOption,
        notes: s.notes,
        guests: matchingBookings
          .map(b => {
            const res = allReservations.find(r => r.id === b.reservationId)
            return res ? { 
              reservationId: res.id, 
              guestName: res.guestName, 
              bungalow: res.bungalow,
              pax: b.pax 
            } : null
          })
          .filter(Boolean)
      }
    }),
    staff: allStaff.map(s => ({
      id: s.id,
      name: s.name,
      role: s.role,
      pin: s.pin
    })),
    supplierPayments: allSupplierPayments.map(sp => ({
      refKey: sp.refKey,
      supplier: sp.supplier,
      paidAt: sp.paidAt,
      method: sp.method,
      company: sp.company,
      amountAr: sp.amountAr ? Number(sp.amountAr) : 0,
    }))
  }
}

// ============ CHECK OVERLAP ============

export async function checkOverlap(bungalow: string, arrival: string, departure: string, excludeId?: string) {
  // Get all reservations for this bungalow
  const existingReservations = await db.select().from(reservations).where(
    eq(reservations.bungalow, bungalow)
  )
  
  // Filter to find actual overlaps
  // Key rule: departure day of one guest = arrival day of another guest is OK (same day turnover)
  // So we check: new arrival < existing departure AND new departure > existing arrival
  // This means arrival ON departure day is allowed
  const overlapping = existingReservations.filter(r => {
    // Skip the reservation being edited
    if (excludeId && r.id === excludeId) return false
    
    // Check for real overlap (excluding same-day turnover)
    // Overlap exists if: new guest arrives BEFORE existing guest leaves AND new guest leaves AFTER existing guest arrives
    // arrival < r.departure (not <=) means arriving on departure day is OK
    // departure > r.arrival (not >=) means leaving on arrival day is OK
    return arrival < r.departure && departure > r.arrival
  })
  
  return overlapping.length > 0
}

// ============ TRANSFER PRICING ============

// --- BOATS ---
export async function getBoats() {
  return db.select().from(boats).where(eq(boats.active, true)).orderBy(boats.name)
}

export async function createBoat(data: { name: string; engine: string; maxPax: number }) {
  const id = uid('boat')
  await db.insert(boats).values({ id, ...data })
  revalidatePath('/')
  return id
}

export async function updateBoat(id: string, data: { name?: string; engine?: string; maxPax?: number }) {
  await db.update(boats).set(data).where(eq(boats.id, id))
  revalidatePath('/')
}

export async function deleteBoat(id: string) {
  await db.update(boats).set({ active: false }).where(eq(boats.id, id))
  revalidatePath('/')
}

// --- ROUTES ---
export async function getRoutes() {
  return db.select().from(routes).where(eq(routes.active, true)).orderBy(routes.name)
}

export async function createRoute(data: { name: string; type: string; baseRouteId?: string }) {
  const id = uid('route')
  await db.insert(routes).values({ id, ...data })
  revalidatePath('/')
  return id
}

export async function updateRoute(id: string, data: { name?: string; type?: string; baseRouteId?: string | null }) {
  await db.update(routes).set(data).where(eq(routes.id, id))
  revalidatePath('/')
}

export async function deleteRoute(id: string) {
  await db.update(routes).set({ active: false }).where(eq(routes.id, id))
  revalidatePath('/')
}

// --- SUPPLEMENTS ---
export async function getSupplements() {
  return db.select().from(supplements).where(eq(supplements.active, true)).orderBy(supplements.name)
}

export async function createSupplement(data: { name: string; priceAr: number }) {
  const id = uid('supp')
  await db.insert(supplements).values({ id, ...data })
  revalidatePath('/')
  return id
}

export async function updateSupplement(id: string, data: { name?: string; priceAr?: number }) {
  await db.update(supplements).set(data).where(eq(supplements.id, id))
  revalidatePath('/')
}

export async function deleteSupplement(id: string) {
  await db.update(supplements).set({ active: false }).where(eq(supplements.id, id))
  revalidatePath('/')
}

// --- ROUTE SUPPLEMENTS ---
export async function getRouteSupplements() {
  return db.select().from(routeSupplements)
}

export async function addRouteSupplement(routeId: string, supplementId: string) {
  const id = uid('rs')
  await db.insert(routeSupplements).values({ id, routeId, supplementId })
  revalidatePath('/')
}

export async function removeRouteSupplement(id: string) {
  await db.delete(routeSupplements).where(eq(routeSupplements.id, id))
  revalidatePath('/')
}

// --- SUPPLIER PRICING ---
export async function getSupplierPricing() {
  return db.select().from(supplierPricing).where(eq(supplierPricing.active, true))
}

export async function upsertSupplierPrice(boatId: string, routeId: string, priceAr: number) {
  const existing = await db.select().from(supplierPricing)
    .where(and(eq(supplierPricing.boatId, boatId), eq(supplierPricing.routeId, routeId)))
    .limit(1)
  
  if (existing.length > 0) {
    await db.update(supplierPricing).set({ priceAr, active: true }).where(eq(supplierPricing.id, existing[0].id))
  } else {
    await db.insert(supplierPricing).values({ id: uid('sp'), boatId, routeId, priceAr })
  }
  revalidatePath('/')
}

export async function deleteSupplierPrice(id: string) {
  await db.update(supplierPricing).set({ active: false }).where(eq(supplierPricing.id, id))
  revalidatePath('/')
}

// --- SELLING PRICING ---
export async function getSellingPricing() {
  return db.select().from(sellingPricing).where(eq(sellingPricing.active, true))
}

export async function upsertSellingPrice(boatId: string, routeId: string, prices: {
  pricePax1: number; pricePax2: number; pricePax3: number;
  pricePax4: number; pricePax5: number; pricePax6: number;
}) {
  const existing = await db.select().from(sellingPricing)
    .where(and(eq(sellingPricing.boatId, boatId), eq(sellingPricing.routeId, routeId)))
    .limit(1)
  
  const data = {
    pricePax1: String(prices.pricePax1),
    pricePax2: String(prices.pricePax2),
    pricePax3: String(prices.pricePax3),
    pricePax4: String(prices.pricePax4),
    pricePax5: String(prices.pricePax5),
    pricePax6: String(prices.pricePax6),
  }
  
  if (existing.length > 0) {
    await db.update(sellingPricing).set({ ...data, active: true }).where(eq(sellingPricing.id, existing[0].id))
  } else {
    await db.insert(sellingPricing).values({ id: uid('sell'), boatId, routeId, ...data })
  }
  revalidatePath('/')
}

export async function deleteSellingPrice(id: string) {
  await db.update(sellingPricing).set({ active: false }).where(eq(sellingPricing.id, id))
  revalidatePath('/')
}

// --- GET ALL PRICING DATA ---
export async function getTransferPricingData() {
  const [boatsData, routesData, supplementsData, routeSupplementsData, supplierData, sellingData] = await Promise.all([
    getBoats(),
    getRoutes(),
    getSupplements(),
    getRouteSupplements(),
    getSupplierPricing(),
    getSellingPricing()
  ])
  
  return {
    boats: boatsData,
    routes: routesData,
    supplements: supplementsData,
    routeSupplements: routeSupplementsData,
    supplierPricing: supplierData,
    sellingPricing: sellingData
  }
}

// ============ EXCURSION PRICING ============

// --- EXCURSIONS ---
export async function getExcursions() {
  return db.select().from(excursions).where(eq(excursions.active, true)).orderBy(excursions.name)
}

export async function createExcursion(data: { name: string; guidePriceAr: number; entranceFeeAr?: number; lunchPriceAr?: number }) {
  const id = uid('exc')
  await db.insert(excursions).values({ id, ...data })
  revalidatePath('/')
  return id
}

export async function updateExcursion(id: string, data: { name?: string; guidePriceAr?: number; entranceFeeAr?: number; lunchPriceAr?: number }) {
  await db.update(excursions).set(data).where(eq(excursions.id, id))
  revalidatePath('/')
}

export async function deleteExcursion(id: string) {
  await db.update(excursions).set({ active: false }).where(eq(excursions.id, id))
  revalidatePath('/')
}

// --- EXCURSION PRICING ---
export async function getExcursionPricing() {
  return db.select().from(excursionPricing).where(eq(excursionPricing.active, true))
}

export async function upsertExcursionPrice(excursionId: string, boatId: string, priceAr: number) {
  const existing = await db.select().from(excursionPricing)
    .where(and(eq(excursionPricing.excursionId, excursionId), eq(excursionPricing.boatId, boatId)))
    .limit(1)
  
  if (existing.length > 0) {
    await db.update(excursionPricing).set({ priceAr, active: true }).where(eq(excursionPricing.id, existing[0].id))
  } else {
    await db.insert(excursionPricing).values({ id: uid('ep'), excursionId, boatId, priceAr })
  }
  revalidatePath('/')
}

export async function deleteExcursionPrice(id: string) {
  await db.update(excursionPricing).set({ active: false }).where(eq(excursionPricing.id, id))
  revalidatePath('/')
}

// --- EXCURSION SELLING PRICING ---
export async function getExcursionSellingPricing() {
  return db.select().from(excursionSellingPricing).where(eq(excursionSellingPricing.active, true))
}

export async function upsertExcursionSellingPrice(excursionId: string, boatId: string, prices: {
  pricePax1: number; pricePax2: number; pricePax3: number;
  pricePax4: number; pricePax5: number; pricePax6: number;
}) {
  const existing = await db.select().from(excursionSellingPricing)
    .where(and(eq(excursionSellingPricing.excursionId, excursionId), eq(excursionSellingPricing.boatId, boatId)))
    .limit(1)
  
  const data = {
    pricePax1: String(prices.pricePax1),
    pricePax2: String(prices.pricePax2),
    pricePax3: String(prices.pricePax3),
    pricePax4: String(prices.pricePax4),
    pricePax5: String(prices.pricePax5),
    pricePax6: String(prices.pricePax6),
  }
  
  if (existing.length > 0) {
    await db.update(excursionSellingPricing).set({ ...data, active: true }).where(eq(excursionSellingPricing.id, existing[0].id))
  } else {
    await db.insert(excursionSellingPricing).values({ id: uid('esp'), excursionId, boatId, ...data })
  }
  revalidatePath('/')
}

// --- GET ALL EXCURSION DATA ---
export async function getExcursionPricingData() {
  const [boatsData, excursionsData, pricingData, sellingData] = await Promise.all([
    getBoats(),
    getExcursions(),
    getExcursionPricing(),
    getExcursionSellingPricing()
  ])
  
  return {
    boats: boatsData,
    excursions: excursionsData,
    pricing: pricingData,
    sellingPricing: sellingData
  }
}

// ============ AGENCIES ============

export async function getAgencies() {
  return db.select().from(agencies).where(eq(agencies.active, true)).orderBy(agencies.name)
}

export async function createAgency(data: { name: string; contactPerson?: string; email?: string; phone?: string; notes?: string }) {
  const id = uid('agency')
  await db.insert(agencies).values({
    id,
    name: data.name,
    contactPerson: data.contactPerson || null,
    email: data.email || null,
    phone: data.phone || null,
    notes: data.notes || null,
  })
  revalidatePath('/')
  return id
}

export async function updateAgency(id: string, data: Partial<{ name: string; contactPerson: string; email: string; phone: string; notes: string; active: boolean }>) {
  await db.update(agencies).set(data).where(eq(agencies.id, id))
  revalidatePath('/')
}

export async function deleteAgency(id: string) {
  await db.update(agencies).set({ active: false }).where(eq(agencies.id, id))
  revalidatePath('/')
}

// ============ BENTRAL RESERVATIONS ============

// Parse date from Bentral format (DD.MM.YYYY) to ISO format (YYYY-MM-DD)
function parseBentralDate(dateStr: string): string {
  // Handles both Slovenian export (15.08.2026, dot separator) and
  // English export (22/08/2026, slash separator). Both are DD/MM/YYYY order.
  const parts = dateStr.trim().split(/[.\/-]/).map(p => p.trim()).filter(Boolean)
  if (parts.length !== 3) return dateStr
  // If the first part is a 4-digit year it is already ISO (YYYY-MM-DD).
  if (parts[0].length === 4) {
    const [year, month, day] = parts
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }
  const [day, month, year] = parts
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }

  // Normalize Bentral status to the canonical Slovenian labels used across the app
  // (filter dropdown, status badges, and the "Preklicano" -> CANCELLED transfer rule).
  // Handles both the Slovenian and the English Bentral export.
  function normalizeBentralStatus(raw: string): string {
  const s = (raw || '').trim().toLowerCase()
  if (s.includes('preklic') || s.includes('cancel')) return 'Preklicano'
  if (s.includes('plačano') || s.includes('placano') || s.includes('paid')) return 'Plačano (1. del)'
  if (s.includes('potrj') || s.includes('confirm')) return 'Potrjeno'
  if (s.includes('ponudb') || s.includes('offer')) return 'Ponudba'
  if (s.includes('ni odziv') || s.includes('no response')) return 'Ni odziva'
  if (s.includes('na voljo') || s.includes('available')) return 'Ponudba'
  return raw ? raw.trim() : raw
  }

  // Parse Bentral CSV line (semicolon separated, handles quoted fields with newlines)
  function parseBentralCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ';' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  result.push(current.trim())
  return result
}

export async function importBentralCSV(csvContent: string) {
  const lines = csvContent.split('\n')
  const dataLines: string[] = []
  
  // Find data lines (skip header rows, join multiline entries)
  let currentLine = ''
  let inMultiline = false
  
  for (const line of lines) {
    // Skip empty lines and header rows (both Slovenian and English exports)
    if (!line.trim()) continue
    if (line.startsWith('Rezervacije') || line.startsWith('Objekt:') || line.startsWith('Datum prihoda:') || line.startsWith('Št. rezervacije;')) continue
    if (line.startsWith('Reservations') || line.startsWith('Facility:') || line.startsWith('Date of arrival:') || line.startsWith('Reservation no.;')) continue
    if (line.startsWith(';;;;')) continue
    
    // Handle multiline fields (quoted text with newlines)
    const quoteCount = (line.match(/"/g) || []).length
    
    if (inMultiline) {
      currentLine += '\n' + line
      if (quoteCount % 2 === 1) {
        inMultiline = false
        dataLines.push(currentLine)
        currentLine = ''
      }
    } else if (quoteCount % 2 === 1) {
      // Start of multiline
      currentLine = line
      inMultiline = true
    } else {
      // Normal line
      if (line.includes(';')) {
        dataLines.push(line)
      }
    }
  }
  
  let imported = 0
  let updated = 0
  let skipped = 0
  
  for (const line of dataLines) {
    try {
      const fields = parseBentralCSVLine(line)
      if (fields.length < 15) continue
      
      const [externalId, statusRaw, , source, guestName, country, checkInRaw, checkOutRaw, nightsStr, adultsStr, childrenStr, childrenAges, units, currency, amountStr, guestNotes, ownNotes] = fields
      const status = normalizeBentralStatus(statusRaw)
      
      if (!externalId || !guestName || !checkInRaw || !checkOutRaw) continue
      
      const checkIn = parseBentralDate(checkInRaw)
      const checkOut = parseBentralDate(checkOutRaw)
      const nights = parseInt(nightsStr) || 0
      const adults = parseInt(adultsStr) || 1
      const children = parseInt(childrenStr) || 0
      const amount = amountStr ? amountStr.replace(',', '.') : '0'
      
      // Check if reservation exists
      const existing = await db.select().from(bentralReservations).where(eq(bentralReservations.externalId, externalId)).limit(1)
      
      if (existing.length > 0) {
        // Update existing
        await db.update(bentralReservations).set({
          status,
          source: source || null,
          guestName,
          country: country || null,
          checkIn,
          checkOut,
          nights,
          adults,
          children,
          childrenAges: childrenAges || null,
          units: units || null,
          currency: currency || 'EUR',
          amount,
          guestNotes: guestNotes || null,
          ownNotes: ownNotes || null,
          updatedAt: new Date(),
        }).where(eq(bentralReservations.id, existing[0].id))
        updated++
      } else {
        // Insert new
        await db.insert(bentralReservations).values({
          id: uid('br'),
          externalId,
          status,
          source: source || null,
          guestName,
          country: country || null,
          checkIn,
          checkOut,
          nights,
          adults,
          children,
          childrenAges: childrenAges || null,
          units: units || null,
          currency: currency || 'EUR',
          amount,
          guestNotes: guestNotes || null,
          ownNotes: ownNotes || null,
        })
        imported++
      }
    } catch (e) {
      skipped++
    }
  }
  
  revalidatePath('/')
  return { imported, updated, skipped }
}

export async function getBentralReservations(filters?: { status?: string; fromDate?: string; toDate?: string }) {
  let query = db.select().from(bentralReservations).where(eq(bentralReservations.active, true))
  
  // Apply filters if provided
  const conditions = [eq(bentralReservations.active, true)]
  
  if (filters?.status && filters.status !== 'all') {
    conditions.push(eq(bentralReservations.status, filters.status))
  }
  
  if (filters?.fromDate) {
    conditions.push(gte(bentralReservations.checkIn, filters.fromDate))
  }
  
  if (filters?.toDate) {
    conditions.push(lte(bentralReservations.checkIn, filters.toDate))
  }
  
  return db.select().from(bentralReservations)
    .where(and(...conditions))
    .orderBy(bentralReservations.checkIn)
}

export async function deleteBentralReservation(id: string) {
  await db.update(bentralReservations).set({ active: false }).where(eq(bentralReservations.id, id))
  revalidatePath('/')
}

// ============ GUESTS ============

export async function getGuests() {
  return db.select().from(guests).where(eq(guests.active, true)).orderBy(guests.name)
}

export async function findOrCreateGuest(data: { name: string; email?: string; phone?: string; country?: string }) {
  // Try to find existing guest by name (could also match by email if provided)
  const existing = await db.select().from(guests)
    .where(and(eq(guests.name, data.name), eq(guests.active, true)))
    .limit(1)
  
  if (existing.length > 0) {
    // Update with any new info
    if (data.email || data.phone || data.country) {
      await db.update(guests).set({
        email: data.email || existing[0].email,
        phone: data.phone || existing[0].phone,
        country: data.country || existing[0].country,
        updatedAt: new Date(),
      }).where(eq(guests.id, existing[0].id))
    }
    return existing[0]
  }
  
  // Create new guest
  const id = uid('guest')
  await db.insert(guests).values({ id, ...data })
  const [newGuest] = await db.select().from(guests).where(eq(guests.id, id))
  return newGuest
}

// ============ TRANSFER BENTRAL TO MAIN SYSTEM ============

export async function transferBentralReservation(bentralId: string) {
  // Get Bentral reservation
  const [bentral] = await db.select().from(bentralReservations).where(eq(bentralReservations.id, bentralId))
  if (!bentral) throw new Error('Bentral rezervacija ne obstaja')
  if (bentral.transferred) throw new Error('Rezervacija je ze prenesena')
  
  // Find or create guest
  const guest = await findOrCreateGuest({
    name: bentral.guestName,
    country: bentral.country || undefined,
  })
  
  // Create main reservation
  const reservationId = uid('res')
  // Determine amount paid based on Bentral status
  const isPaid = bentral.status.toLowerCase().includes('placano') || bentral.status.toLowerCase().includes('plačano')
  const amountPaid = isPaid ? bentral.amount : '0'
  
  await db.insert(reservations).values({
    id: reservationId,
    guestId: guest.id,
    bentralReservationId: bentral.id,
    guestName: bentral.guestName,
    bungalow: bentral.units || 'TBD',
    pax: bentral.adults + bentral.children,
    arrival: bentral.checkIn,
    departure: bentral.checkOut,
    checkIn: bentral.checkIn,
    checkOut: bentral.checkOut,
    adults: bentral.adults,
    children: bentral.children,
    status: bentral.status === 'Preklicano' ? 'CANCELLED' : 'RESERVED',
    bookingSource: bentral.source || 'Direct',
    nationality: bentral.country,
    notes: [bentral.guestNotes, bentral.ownNotes].filter(Boolean).join('\n---\n') || undefined,
    totalAmount: bentral.amount,
    amountPaid: amountPaid,
    currency: bentral.currency || 'EUR',
  })
  
  // Mark Bentral reservation as transferred
  await db.update(bentralReservations).set({
    transferred: true,
    reservationId: reservationId,
    updatedAt: new Date(),
  }).where(eq(bentralReservations.id, bentralId))
  
  revalidatePath('/')
  return { reservationId, guestId: guest.id }
}

// Delete reservation and optionally the guest card
export async function deleteReservationAndGuest(reservationId: string, deleteGuest: boolean = false) {
  // Get reservation to find guest and bentral link
  const [res] = await db.select().from(reservations).where(eq(reservations.id, reservationId))
  if (!res) throw new Error('Rezervacija ne obstaja')
  
  // Reset bentral reservation if linked
  if (res.bentralReservationId) {
    await db.update(bentralReservations).set({
      transferred: false,
      reservationId: null,
      updatedAt: new Date(),
    }).where(eq(bentralReservations.id, res.bentralReservationId))
  }
  
  // Delete reservation
  await db.delete(reservations).where(eq(reservations.id, reservationId))
  
  // Delete guest if requested and no other reservations exist for this guest
  if (deleteGuest && res.guestId) {
    const otherReservations = await db.select().from(reservations)
      .where(eq(reservations.guestId, res.guestId))
      .limit(1)
    
    if (otherReservations.length === 0) {
      await db.update(guests).set({ active: false }).where(eq(guests.id, res.guestId))
    }
  }
  
  revalidatePath('/')
}

// ============ PAYMENTS ============

const PAYMENT_METHODS = ['card', 'transfer', 'orange_money', 'cash'] as const

export async function getPayments(reservationId: string) {
  return db.select().from(payments)
    .where(eq(payments.reservationId, reservationId))
    .orderBy(desc(payments.paidAt))
}

export async function addPayment(data: {
  reservationId: string
  amount: string
  method: string
  paidAt: string
  notes?: string
  omAmountAr?: number // Pri Orange Money: znesek v Ar, ki je prišel na OM denarnico
  cashCompany?: string // Pri gotovini: podjetje (tourism/sarl) → vpiše priliv v blagajno
}) {
  const id = uid('pay')

  // Če je plačilo prek Orange Money in je vpisan Ar znesek → priliv v OM denarnico (kategorija stranka)
  let omLedgerId: string | null = null
  const omAmountAr = data.method === 'orange_money' && data.omAmountAr && data.omAmountAr > 0 ? Math.round(data.omAmountAr) : null
  if (omAmountAr) {
    const [res] = await db.select().from(reservations).where(eq(reservations.id, data.reservationId))
    const guestName = res?.guestName || 'stranka'
    const { addOmTransaction } = await import('./orange-money')
    const om = await addOmTransaction({
      date: data.paidAt,
      direction: 'in',
      category: 'stranka',
      amount: omAmountAr,
      description: `Priliv stranke — ${guestName}`,
    })
    omLedgerId = om.id
  }

  // Če je plačilo z gotovino in je izbrano podjetje → priliv v blagajno (bank_cash_income).
  // Znesek plačila je v EUR, blagajna hrani Ar → pretvorba prek tečaja.
  let cashLedgerId: string | null = null
  const cashCompany = data.method === 'cash' && data.cashCompany ? data.cashCompany : null
  if (cashCompany) {
    const [res] = await db.select().from(reservations).where(eq(reservations.id, data.reservationId))
    const guestName = res?.guestName || 'stranka'
    const rate = await getExchangeRate()
    const amountAr = Math.round((Number(data.amount) || 0) * rate)
    const { addCashIncome } = await import('./banka')
    const ci = await addCashIncome({
      company: cashCompany,
      date: data.paidAt,
      source: `Rezervacija — ${guestName}`,
      amount: amountAr,
    })
    cashLedgerId = ci.id
  }

  await db.insert(payments).values({
    id,
    reservationId: data.reservationId,
    amount: data.amount,
    method: data.method,
    paidAt: data.paidAt,
    notes: data.notes,
    omAmountAr,
    omLedgerId,
    cashCompany,
    cashLedgerId,
  })
  
  // Update reservation amountPaid
  const allPayments = await db.select().from(payments).where(eq(payments.reservationId, data.reservationId))
  const totalPaid = allPayments.reduce((sum, p) => sum + Number(p.amount), 0)
  await db.update(reservations).set({ amountPaid: totalPaid.toString() }).where(eq(reservations.id, data.reservationId))
  
  revalidatePath('/')
  return id
}

export async function deletePayment(id: string) {
  const [payment] = await db.select().from(payments).where(eq(payments.id, id))
  if (!payment) return

  // Če je bil ustvarjen priliv v OM denarnico, ga izbriši skupaj s plačilom
  if (payment.omLedgerId) {
    const { deleteOmTransaction } = await import('./orange-money')
    await deleteOmTransaction(payment.omLedgerId)
  }

  // Če je bil ustvarjen priliv v blagajno (gotovina), ga izbriši skupaj s plačilom
  if (payment.cashLedgerId) {
    const { deleteCashIncome } = await import('./banka')
    await deleteCashIncome(payment.cashLedgerId)
  }
  
  await db.delete(payments).where(eq(payments.id, id))
  
  // Recalculate reservation amountPaid
  const allPayments = await db.select().from(payments).where(eq(payments.reservationId, payment.reservationId))
  const totalPaid = allPayments.reduce((sum, p) => sum + Number(p.amount), 0)
  await db.update(reservations).set({ amountPaid: totalPaid.toString() }).where(eq(reservations.id, payment.reservationId))
  
  revalidatePath('/')
}

// ============ EXCURSION BOOKINGS ============

export async function getExcursionBookings(reservationId: string) {
  return await db.select().from(excursionBookings).where(eq(excursionBookings.reservationId, reservationId))
}

export async function addExcursionBooking(reservationId: string, data: {
  excursionId: string
  boatId?: string
  date?: string
  pax?: number
  guestPrice?: number
  entranceFee?: number
  lunchPrice?: number
  lunchPax?: number
  lunchProviderId?: string
  paymentStatus?: string
  paidMethod?: string // 'card' | 'cash' | 'transfer' — how the guest paid (for invoice)
  paidDate?: string // YYYY-MM-DD when the guest paid (for invoice)
  notes?: string
  groupId?: string
  groupPax?: number
}) {
  const id = uid('excbk')
  await db.insert(excursionBookings).values({
    id,
    reservationId,
    excursionId: data.excursionId,
    boatId: data.boatId || null,
    date: data.date || null,
    pax: data.pax || 1,
    guestPrice: String(data.guestPrice || 0),
    entranceFee: String(data.entranceFee || 0),
    lunchPrice: String(data.lunchPrice || 0),
    lunchPax: data.lunchPax || 0,
    lunchProviderId: data.lunchProviderId || null,
    paymentStatus: data.paymentStatus || 'UNPAID',
    paidMethod: data.paidMethod ?? null,
    paidDate: data.paidDate ?? null,
    notes: data.notes || null,
    groupId: data.groupId || null,
    groupPax: data.groupPax || null,
  })

  // If the guest is ALREADY checked in, the check-in flow has already run and
  // won't add this excursion automatically. So we add it to the order now,
  // dated to the excursion day — exactly like the check-in logic does.
  const [res] = await db
    .select({ checkedInAt: reservations.checkedInAt })
    .from(reservations)
    .where(eq(reservations.id, reservationId))
    .limit(1)

  if (res?.checkedInAt) {
    const [excursion] = await db
      .select({ name: excursions.name })
      .from(excursions)
      .where(eq(excursions.id, data.excursionId))
      .limit(1)
    const excursionName = excursion?.name || 'Izlet'
    const pax = data.pax || 1
    const isPaid = (data.paymentStatus || 'UNPAID') === 'PAID'

    // Build included items list (boat, entrance fee, lunch) — same as check-in
    const included: string[] = []
    if (data.boatId) {
      const [boat] = await db.select({ name: boats.name }).from(boats).where(eq(boats.id, data.boatId)).limit(1)
      if (boat?.name) included.push(boat.name)
    }
    if (data.entranceFee && data.entranceFee > 0) included.push('vstopnina')
    const includedText = included.length > 0 ? ` | Vklj: ${included.join(', ')}` : ''

    // Total price = guest price + entrance fee + lunch price (EUR), converted to Ariary
    const exchangeRate = await getExchangeRate()
    const totalPriceEur = (data.guestPrice || 0) + (data.entranceFee || 0) + (data.lunchPrice || 0)
    const totalPriceAr = Math.round(totalPriceEur * exchangeRate)

    await db.insert(orderItems).values({
      id: uid('ord'),
      reservationId,
      name: `Izlet: ${excursionName} - ${pax} pax${includedText}`,
      category: 'Izlet',
      qty: 1,
      priceAr: isPaid ? 0 : totalPriceAr, // If paid, evidence only (0 Ar)
      refPriceAr: totalPriceAr, // real price kept for display, even when paid
      paymentStatus: isPaid ? 'PAID' : 'UNPAID',
      paidMethod: isPaid ? (data.paidMethod ?? null) : null,
      paidDate: isPaid ? (data.paidDate ?? null) : null,
      eventDate: data.date || null, // Excursion happens on its specific date
    })
  }

  revalidatePath('/')
  return id
}

// Skupinski izlet: cena čolna se izračuna po SKUPNEM številu oseb (groupPax),
// nato se razdeli po dejanskih osebah vsake rezervacije (čoln cena/os × osebe).
// Vstopnina in kosilo sta vedno fiksna na osebo (× osebe rezervacije).
export async function addGroupExcursionBooking(data: {
  excursionId: string
  boatId?: string
  date?: string
  entranceFee?: number       // EUR na osebo
  lunchPrice?: number        // EUR na osebo
  lunchProviderId?: string
  boatPricePerPax?: number    // EUR/os pri SKUPINSKI ceni (skupna cena čolna / groupPax)
  notes?: string
  parts: { reservationId: string; pax: number; lunchPax?: number }[]
}) {
  const groupId = uid('excgrp')
  const groupPax = data.parts.reduce((sum, p) => sum + (p.pax || 0), 0)

  for (const part of data.parts) {
    if (!part.pax || part.pax <= 0) continue
    const guestPrice = Math.round((data.boatPricePerPax || 0) * part.pax * 100) / 100
    await addExcursionBooking(part.reservationId, {
      excursionId: data.excursionId,
      boatId: data.boatId,
      date: data.date,
      pax: part.pax,
      guestPrice,
      entranceFee: Math.round((data.entranceFee || 0) * part.pax * 100) / 100,
      lunchPrice: Math.round((data.lunchPrice || 0) * (part.lunchPax ?? 0) * 100) / 100,
      lunchPax: part.lunchPax ?? 0,
      lunchProviderId: data.lunchProviderId,
      notes: data.notes,
      groupId,
      groupPax,
    })
  }

  revalidatePath('/')
  return groupId
}

export async function updateExcursionBooking(id: string, data: Partial<{
  excursionId: string
  boatId: string
  date: string
  pax: number
  guestPrice: number
  entranceFee: number
  lunchPrice: number
  lunchPax: number
  lunchProviderId: string
  paymentStatus: string
  notes: string
  dilipOrderedAt: string
}>) {
  const updateData: Record<string, unknown> = {}
  if (data.excursionId !== undefined) updateData.excursionId = data.excursionId
  if (data.boatId !== undefined) updateData.boatId = data.boatId || null
  if (data.date !== undefined) updateData.date = data.date || null
  if (data.pax !== undefined) updateData.pax = data.pax
  if (data.guestPrice !== undefined) updateData.guestPrice = String(data.guestPrice)
  if (data.entranceFee !== undefined) updateData.entranceFee = String(data.entranceFee)
  if (data.lunchPrice !== undefined) updateData.lunchPrice = String(data.lunchPrice)
  if (data.lunchPax !== undefined) updateData.lunchPax = data.lunchPax
  if (data.lunchProviderId !== undefined) updateData.lunchProviderId = data.lunchProviderId || null
  if (data.paymentStatus !== undefined) updateData.paymentStatus = data.paymentStatus
  if (data.notes !== undefined) updateData.notes = data.notes || null
  if (data.dilipOrderedAt !== undefined) updateData.dilipOrderedAt = new Date(data.dilipOrderedAt)
  
  await db.update(excursionBookings).set(updateData).where(eq(excursionBookings.id, id))
  revalidatePath('/')
}

export async function deleteExcursionBooking(id: string) {
  await db.delete(excursionBookings).where(eq(excursionBookings.id, id))
  revalidatePath('/')
}

// Cancel a PAID excursion (e.g. guest illness) and convert the amount already
// paid into a general credit the guest can spend on food/drinks/other services.
// - Marks the booking CANCELLED (drops out of operational lists, stays in history).
// - Removes the excursion line from the invoice/order (best-effort, by name).
// - Adds an invoice discount of kind 'credit' that reduces the bill; if the guest
//   spends less than the credit, the remaining credit is shown on the invoice.
// creditEur defaults to the full amount the guest paid, but is editable in the UI.
export async function cancelExcursionToCredit(
  bookingId: string,
  creditEur: number,
  reason?: string,
) {
  const [booking] = await db
    .select()
    .from(excursionBookings)
    .where(eq(excursionBookings.id, bookingId))
    .limit(1)
  if (!booking) return { error: 'Rezervacija izleta ni najdena.' }

  const reservationId = booking.reservationId

  // 1) Mark the booking cancelled.
  await db
    .update(excursionBookings)
    .set({ status: 'CANCELLED', cancelledAt: new Date(), cancelReason: reason || null })
    .where(eq(excursionBookings.id, bookingId))

  // 2) Best-effort removal of the excursion line from the order/invoice.
  const [excursion] = await db
    .select({ name: excursions.name })
    .from(excursions)
    .where(eq(excursions.id, booking.excursionId))
    .limit(1)
  const excName = (excursion?.name || '').trim()
  if (excName) {
    await db
      .delete(orderItems)
      .where(
        and(
          eq(orderItems.reservationId, reservationId),
          eq(orderItems.category, 'Izlet'),
          sql`${orderItems.name} LIKE ${'%' + excName + '%'}`,
        ),
      )
  }

  // 3) Add the credit as an invoice discount (stored in Ar).
  const exchangeRate = await getExchangeRate()
  const creditAr = Math.max(0, Math.round((creditEur || 0) * exchangeRate))
  const label = `Credit — cancelled ${excName || 'excursion'}${reason ? ` (${reason})` : ''}`
  await db.insert(invoiceDiscounts).values({
    id: uid('disc'),
    reservationId,
    kind: 'credit',
    label,
    amountAr: creditAr,
  })

  revalidatePath('/')
  revalidatePath(`/racun/${reservationId}`)
  return { success: true, creditAr, label }
}

// Reverse of cancelExcursionToCredit: the guest will go on the excursion after all
// (e.g. recovered from illness). Reactivates the booking, removes the credit that
// was created on cancel, and rebuilds the excursion line on the invoice/order.
export async function reactivateExcursion(bookingId: string) {
  const [booking] = await db
    .select()
    .from(excursionBookings)
    .where(eq(excursionBookings.id, bookingId))
    .limit(1)
  if (!booking) return { error: 'Rezervacija izleta ni najdena.' }

  const reservationId = booking.reservationId

  // 1) Reactivate the booking (back into operational lists).
  await db
    .update(excursionBookings)
    .set({ status: 'ACTIVE', cancelledAt: null, cancelReason: null })
    .where(eq(excursionBookings.id, bookingId))

  // Resolve excursion / boat / lunch provider names for the order line + credit match.
  const [excursion] = await db
    .select({ name: excursions.name })
    .from(excursions)
    .where(eq(excursions.id, booking.excursionId))
    .limit(1)
  const excName = (excursion?.name || '').trim()

  // 2) Remove the credit(s) created for this excursion on cancel.
  if (excName) {
    await db
      .delete(invoiceDiscounts)
      .where(
        and(
          eq(invoiceDiscounts.reservationId, reservationId),
          eq(invoiceDiscounts.kind, 'credit'),
          sql`${invoiceDiscounts.label} LIKE ${'%' + excName + '%'}`,
        ),
      )
  }

  // 3) Rebuild the excursion order line (same format as check-in generation).
  //    Remove any stale line first to avoid duplicates.
  if (excName) {
    await db
      .delete(orderItems)
      .where(
        and(
          eq(orderItems.reservationId, reservationId),
          eq(orderItems.category, 'Izlet'),
          sql`${orderItems.name} LIKE ${'%' + excName + '%'}`,
        ),
      )

    const boatName = booking.boatId
      ? ((await db.select({ name: boats.name }).from(boats).where(eq(boats.id, booking.boatId)).limit(1))[0]?.name || '')
      : ''
    const lunchProvider = booking.lunchProviderId
      ? (await db.select({ name: lunchProviders.name }).from(lunchProviders).where(eq(lunchProviders.id, booking.lunchProviderId)).limit(1))[0]
      : null

    const included: string[] = []
    if (boatName) included.push(boatName)
    if (Number(booking.entranceFee) > 0) included.push('entrance fee')
    if (lunchProvider) included.push(`lunch: ${lunchProvider.name}`)
    const includedText = included.length > 0 ? ` | Incl: ${included.join(', ')}` : ''

    const isPaid = booking.paymentStatus === 'PAID'
    const exchangeRate = await getExchangeRate()
    const totalEur = Number(booking.guestPrice || 0) + Number(booking.entranceFee || 0) + Number(booking.lunchPrice || 0)
    const totalAr = Math.round(totalEur * exchangeRate)
    const eventDate = booking.date
      ? (typeof booking.date === 'string' ? String(booking.date).split('T')[0] : booking.date.toISOString().split('T')[0])
      : null

    await db.insert(orderItems).values({
      id: uid('ord'),
      reservationId,
      name: `Excursion: ${excName || 'Izlet'} - ${booking.pax} pax${includedText}`,
      category: 'Izlet',
      qty: 1,
      priceAr: isPaid ? 0 : totalAr,
      paymentStatus: isPaid ? 'PAID' : 'UNPAID',
      eventDate,
      addedBy: 'Urska',
    })
  }

  revalidatePath('/')
  revalidatePath(`/racun/${reservationId}`)
  return { success: true }
}

// ============ CHECK-OUT & ARCHIVE ============

// Complete checkout with payments
export async function completeCheckout(reservationId: string, checkoutPayments: Array<{
  amount: number
  currency: string
  method: string
  notes?: string
}>) {
  // Add all checkout payments
  for (const payment of checkoutPayments) {
    const id = `pay-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    await db.insert(payments).values({
      id,
      reservationId,
      amount: String(payment.amount),
      currency: payment.currency,
      method: payment.method,
      paidAt: new Date(),
      notes: payment.notes || null
    })
  }
  
  // Close any open delivery notes
  await db.update(deliveryNotes)
    .set({ status: 'closed' })
    .where(and(
      eq(deliveryNotes.reservationId, reservationId),
      eq(deliveryNotes.status, 'open')
    ))
  
  // Update reservation with total paid amount
  const allPayments = await db.select().from(payments).where(eq(payments.reservationId, reservationId))
  const totalPaid = allPayments.reduce((sum, p) => sum + Number(p.amount), 0)
  
  await db.update(reservations)
    .set({ 
      checkedOutAt: new Date(),
      amountPaid: String(totalPaid)
    })
    .where(eq(reservations.id, reservationId))
  
  revalidatePath('/')
}

export async function checkOutReservation(reservationId: string) {
  // Close any open delivery notes
  await db.update(deliveryNotes)
    .set({ status: 'closed' })
    .where(and(
      eq(deliveryNotes.reservationId, reservationId),
      eq(deliveryNotes.status, 'open')
    ))
  
  // Set checkout timestamp
  await db.update(reservations)
    .set({ checkedOutAt: new Date() })
    .where(eq(reservations.id, reservationId))
  
  revalidatePath('/')
}

export async function getArchivedReservations(page: number = 1, limit: number = 20) {
  const offset = (page - 1) * limit
  
  // Get archived reservations (with checkedOutAt)
  const archived = await db.select().from(reservations)
    .where(isNotNull(reservations.checkedOutAt))
    .orderBy(desc(reservations.checkedOutAt))
    .limit(limit)
    .offset(offset)
  
  // Get total count for pagination
  const countResult = await db.select().from(reservations)
    .where(isNotNull(reservations.checkedOutAt))
  const total = countResult.length
  
  // Fetch related data for these reservations
  const reservationIds = archived.map(r => r.id)
  
  const archivedOrders = reservationIds.length > 0 
    ? await db.select().from(orderItems).where(
        or(...reservationIds.map(id => eq(orderItems.reservationId, id)))
      )
    : []
  
  const archivedDeliveryNotes = reservationIds.length > 0
    ? await db.select().from(deliveryNotes).where(
        or(...reservationIds.map(id => eq(deliveryNotes.reservationId, id)))
      )
    : []
  
  const archivedPayments = reservationIds.length > 0
    ? await db.select().from(payments).where(
        or(...reservationIds.map(id => eq(payments.reservationId, id)))
      )
    : []
  
  const rate = await getExchangeRate()
  
  return {
    reservations: archived.map(res => {
      const resOrders = archivedOrders.filter(o => o.reservationId === res.id)
      const resDeliveryNotes = archivedDeliveryNotes.filter(dn => dn.reservationId === res.id)
      const resPayments = archivedPayments.filter(p => p.reservationId === res.id)
      
      const servicesTotal = resOrders.reduce((sum, o) => sum + (o.priceAr || 0), 0)
      const barTotal = resDeliveryNotes.reduce((sum, dn) => sum + (dn.totalAr || 0), 0)
      
      return {
        ...res,
        arrival: res.arrival ? (typeof res.arrival === 'string' ? res.arrival : res.arrival.toISOString().split('T')[0]) : '',
        departure: res.departure ? (typeof res.departure === 'string' ? res.departure : res.departure.toISOString().split('T')[0]) : '',
        checkedInAt: res.checkedInAt ? (typeof res.checkedInAt === 'string' ? res.checkedInAt : res.checkedInAt.toISOString()) : null,
        checkedOutAt: res.checkedOutAt ? (typeof res.checkedOutAt === 'string' ? res.checkedOutAt : res.checkedOutAt.toISOString()) : null,
        totalAmount: Number(res.totalAmount) || 0,
        amountPaid: Number(res.amountPaid) || 0,
        servicesTotal,
        barTotal,
        grandTotal: servicesTotal + barTotal,
        payments: resPayments.map(p => ({
          amount: Number(p.amount),
          method: p.method,
          paidAt: p.paidAt ? (typeof p.paidAt === 'string' ? p.paidAt : p.paidAt.toISOString()) : ''
        }))
      }
    }),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    },
    exchangeRate: rate
  }
}

// Archive of all arrival/departure transfer alerts that WERE shown on the dashboard.
// A transfer becomes an alert only when it has a route, so we mirror that filter here.
// Effective date = pickupDate || (arrival ? reservation.arrival : reservation.departure),
// exactly like the pending list. We keep everything with an effective date up to today
// (lodge-local, UTC+3), newest first.
export async function getArchivedTransfers() {
  const [allTransfers, allRoutes, allBoats, allSupplierPricing, allSupplierPayments, allOrderTransfers] = await Promise.all([
    db.select().from(transfers).where(isNotNull(transfers.route)),
    db.select().from(routes),
    db.select().from(boats),
    db.select().from(supplierPricing).where(eq(supplierPricing.active, true)),
    db.select().from(supplierPayments),
    db.select().from(orderItems).where(eq(orderItems.category, 'Transfer')),
  ])

  const HERMAN_BOAT_ID = 'taxi-herman'

  // Supplier cost helper — mirrors getSupplierCostAr on the dashboard:
  // exact match on route id, else match a same-named sibling route id.
  const supplierCostAr = (boatId?: string | null, routeId?: string | null): number => {
    if (!boatId || !routeId) return 0
    const exact = allSupplierPricing.find(sp => sp.boatId === boatId && sp.routeId === routeId)
    if (exact) return Number(exact.priceAr) || 0
    const routeName = allRoutes.find(r => r.id === routeId)?.name
    if (routeName) {
      const siblingIds = allRoutes.filter(r => r.name === routeName).map(r => r.id)
      const sibling = allSupplierPricing.find(sp => sp.boatId === boatId && siblingIds.includes(sp.routeId))
      if (sibling) return Number(sibling.priceAr) || 0
    }
    return 0
  }

  const payByKey = new Map(allSupplierPayments.map(sp => [sp.refKey, sp]))
  const paidFor = (refKey: string) => {
    const p = payByKey.get(refKey)
    return p ? { paidAt: p.paidAt, method: p.method, company: p.company, amountAr: p.amountAr ? Number(p.amountAr) : 0 } : null
  }

  const withRoute = allTransfers.filter(t => (t.route || '').trim() !== '')
  // Reception ad-hoc transfers: order_items named "Transfer: {route} - {N} pax | Coln: {boat}".
  const recTransfers = allOrderTransfers.filter(o => /^transfer:\s/i.test(o.name || ''))
  const resIds = Array.from(new Set([...withRoute.map(t => t.reservationId), ...recTransfers.map(o => o.reservationId)]))
  const resRows = resIds.length > 0
    ? await db.select().from(reservations).where(or(...resIds.map(id => eq(reservations.id, id))))
    : []

  const resMap = new Map(resRows.map(r => [r.id, r]))
  const routeMap = new Map(allRoutes.map(r => [r.id, r.name]))
  const boatMap = new Map(allBoats.map(b => [b.id, b.name]))

  const toDateStr = (v: unknown) => !v ? '' : (typeof v === 'string' ? v.split('T')[0] : (v as Date).toISOString().split('T')[0])
  // Today in lodge-local time (UTC+3)
  const todayStr = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().split('T')[0]

  const items = withRoute.flatMap(t => {
    const res = resMap.get(t.reservationId)
    if (!res) return []
    const isArrival = t.type === 'arrival'
    const baseDate = isArrival ? toDateStr(res.arrival) : toDateStr(res.departure)
    const date = toDateStr(t.pickupDate) || baseDate
    if (!date || date > todayStr) return []

    const routeName = routeMap.get(t.route || '') || t.route || ''
    const taxiId = t.taxiBoatId && t.taxiBoatId.length > 0 ? t.taxiBoatId : HERMAN_BOAT_ID
    const taxiName = boatMap.get(taxiId) || 'Taksi'
    const taxiSupplier = taxiId.replace(/^taxi-/, '') || 'herman'
    const dilipCostAr = supplierCostAr(t.boatId, t.route)
    const hermanCostAr = supplierCostAr(taxiId, t.hermanRouteId)
    const dilipRefKey = `transfer:${t.reservationId}:${t.type}:dilip`
    const hermanRefKey = `transfer:${t.reservationId}:${t.type}:${taxiSupplier}`

    return [{
      id: t.id,
      reservationId: t.reservationId,
      type: t.type as 'arrival' | 'departure',
      date,
      time: t.time || t.flightTime || '',
      guestName: res.guestName,
      bungalow: res.bungalow,
      pax: res.pax || t.pax || 1,
      routeName,
      boatName: t.boatId ? (boatMap.get(t.boatId) || '') : '',
      flightNumber: t.flightNumber || '',
      executed: !!t.executed,
      guestPaid: t.paymentStatus === 'PAID',
      dilipCostAr,
      hermanCostAr,
      taxiName,
      taxiSupplier,
      hermanRouteName: hermanCostAr > 0 ? (routeMap.get(t.hermanRouteId || '') || 'avto') : '',
      dilipRefKey,
      hermanRefKey,
      dilipPaid: dilipCostAr > 0 ? paidFor(dilipRefKey) : null,
      hermanPaid: hermanCostAr > 0 ? paidFor(hermanRefKey) : null,
      // Ročna gotovinska doplačila (voznik čolna / nosači / tuc tuc) — isti refKey kot v pending kartici (page.tsx)
      boatdriverRefKey: `transfer:${t.reservationId}:${t.type}:boatdriver`,
      portersRefKey: `transfer:${t.reservationId}:${t.type}:porters`,
      tuctucRefKey: `transfer:${t.reservationId}:${t.type}:tuctuc`,
      boatdriverPaid: paidFor(`transfer:${t.reservationId}:${t.type}:boatdriver`),
      portersPaid: paidFor(`transfer:${t.reservationId}:${t.type}:porters`),
      tuctucPaid: paidFor(`transfer:${t.reservationId}:${t.type}:tuctuc`),
    }]
  })

  // Reception ad-hoc transfers (order_items) — mirror the dashboard reception card so Borut
  // can mark cash payment from the archive too, even for back-dated entries. Route + boat are
  // parsed back from the item name, and refKeys use the SAME `reception:<orderId>:*` scheme as
  // the pending card, so payments made here and on the dashboard stay in sync.
  const routeByName = new Map(allRoutes.map(r => [r.name.toLowerCase(), r]))
  const boatByName = new Map(allBoats.map(b => [b.name.toLowerCase(), b]))
  const recItems = recTransfers.flatMap(o => {
    const res = resMap.get(o.reservationId)
    if (!res) return []
    const rawName = (o.name || '').replace(/^transfer:\s*/i, '')
    const boatMatch = rawName.match(/\|\s*coln:\s*(.+)$/i)
    const boatNameFromName = boatMatch ? boatMatch[1].trim() : ''
    const routeName = rawName.replace(/\s*\|\s*coln:.*$/i, '').replace(/\s*-\s*\d+\s*pax.*$/i, '').trim()
    const matchedBoat = boatByName.get(boatNameFromName.toLowerCase())
    const matchedRoute = routeByName.get(routeName.toLowerCase())
    const dilipCostAr = supplierCostAr(matchedBoat?.id, matchedRoute?.id)
    const hermanCostAr = supplierCostAr(HERMAN_BOAT_ID, matchedRoute?.id)
    const arrDate = toDateStr(res.arrival)
    const depDate = toDateStr(res.departure)
    const evDate = o.eventDate ? String(o.eventDate).slice(0, 10) : ''
    const routeLc = routeName.toLowerCase()
    let recDir: 'arrival' | 'departure' = 'arrival'
    if (evDate && evDate === depDate) recDir = 'departure'
    else if (evDate && evDate === arrDate) recDir = 'arrival'
    else if (/^\s*komba cabana/.test(routeLc)) recDir = 'departure'
    else if (/komba cabana\s*$/.test(routeLc)) recDir = 'arrival'
    const date = evDate || (recDir === 'departure' ? depDate : arrDate)
    if (!date || date > todayStr) return []
    const dilipRefKey = `reception:${o.id}:dilip`
    const hermanRefKey = `reception:${o.id}:herman`
    return [{
      id: `rec-${o.id}`,
      reservationId: o.reservationId,
      type: recDir as 'arrival' | 'departure',
      date,
      time: '',
      guestName: res.guestName,
      bungalow: res.bungalow,
      pax: res.pax || o.qty || 1,
      routeName,
      boatName: boatNameFromName,
      flightNumber: '',
      executed: !!o.dilipOrderedAt,
      guestPaid: o.paymentStatus === 'PAID',
      dilipCostAr,
      hermanCostAr,
      taxiName: 'Herman',
      taxiSupplier: 'herman',
      hermanRouteName: hermanCostAr > 0 ? routeName : '',
      dilipRefKey,
      hermanRefKey,
      dilipPaid: dilipCostAr > 0 ? paidFor(dilipRefKey) : null,
      hermanPaid: hermanCostAr > 0 ? paidFor(hermanRefKey) : null,
      boatdriverRefKey: `reception:${o.id}:boatdriver`,
      portersRefKey: `reception:${o.id}:porters`,
      tuctucRefKey: `reception:${o.id}:tuctuc`,
      boatdriverPaid: paidFor(`reception:${o.id}:boatdriver`),
      portersPaid: paidFor(`reception:${o.id}:porters`),
      tuctucPaid: paidFor(`reception:${o.id}:tuctuc`),
    }]
  })
  items.push(...recItems)

  items.sort((a, b) => b.date.localeCompare(a.date) || a.type.localeCompare(b.type))
  return { items, today: todayStr }
}

// Archive of all excursion bookings (IZLETI alerts) up to today (lodge-local, UTC+3),
// grouped exactly like the pending IZLETI list (by groupId, else standalone), with all
// payment amounts computed SERVER-SIDE to mirror the dashboard card:
//  - Fanja excursions: fanjaPayment = round(sum guestPrice * 0.9 * rate)
//  - other: dilipPayment = fixed / direct / (boatNet*0.9 + guide); lunch; entrance.
// Fanja payment status is read from the first member (one ledger per group).
export async function getArchivedExcursions() {
  const [allBookings, allExc, allExcPricing, allBoats, allSupplierPayments, allLunch, rate] = await Promise.all([
    db.select().from(excursionBookings),
    db.select().from(excursions),
    db.select().from(excursionPricing).where(eq(excursionPricing.active, true)),
    db.select().from(boats),
    db.select().from(supplierPayments),
    db.select().from(lunchProviders),
    getExchangeRate(),
  ])

  const lunchMap = new Map(allLunch.map(lp => [lp.id, lp]))
  const payByKey = new Map(allSupplierPayments.map(sp => [sp.refKey, sp]))
  const paidFor = (refKey: string) => {
    const p = payByKey.get(refKey)
    return p ? { paidAt: p.paidAt, method: p.method, company: p.company, amountAr: p.amountAr ? Number(p.amountAr) : 0 } : null
  }

  const active = allBookings.filter(b => (b.status || 'ACTIVE') === 'ACTIVE')
  const resIds = Array.from(new Set(active.map(b => b.reservationId)))
  const resRows = resIds.length > 0
    ? await db.select().from(reservations).where(or(...resIds.map(id => eq(reservations.id, id))))
    : []
  const resMap = new Map(resRows.map(r => [r.id, r]))
  const excMap = new Map(allExc.map(e => [e.id, e]))
  const boatMap = new Map(allBoats.map(b => [b.id, b.name]))

  const toDateStr = (v: unknown) => !v ? '' : (typeof v === 'string' ? v.split('T')[0] : (v as Date).toISOString().split('T')[0])
  const todayStr = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().split('T')[0]

  // Group bookings: by groupId when present (and group has >1), else each booking standalone.
  const groups = new Map<string, typeof active>()
  for (const b of active) {
    const key = b.groupId ? `g:${b.groupId}` : `s:${b.id}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(b)
  }

  const items = Array.from(groups.values()).flatMap(members => {
    const first = members[0]
    const date = toDateStr(first.date)
    if (!date || date > todayStr) return []
    const excType = excMap.get(first.excursionId)
    const excursionName = excType?.name || ''
    const totalPax = members.reduce((s, m) => s + (m.pax || 0), 0)

    // Boat purchase price (excursion_pricing) for the group's boat.
    const boatPriceRow = allExcPricing.find(ep => ep.excursionId === first.excursionId && ep.boatId === first.boatId)
    const boatCompletePrice = boatPriceRow?.priceAr || 0
    const guidePrice = excType?.guidePriceAr || 0
    const nameLc = excursionName.toLowerCase()
    const isFixedDilip = nameLc.includes('top of') && nameLc.includes('nosy komba')
    const isDirectBoat = nameLc.includes('ampangorina') || nameLc.includes('maki')
    const boatNet = Math.max(0, boatCompletePrice - guidePrice)
    const dilipPayment = isFixedDilip
      ? 80000 + guidePrice
      : isDirectBoat
        ? boatCompletePrice + guidePrice
        : (boatNet > 0 ? Math.round(boatNet * 0.9) + guidePrice : 0)
    const entranceTotalAr = Math.round((excType?.entranceFeeAr || 0) * totalPax)
    // Kosilo NEPOSREDNO v Ar iz cenika ponudnika (pricePerPersonAr × pax), da se izognemo
    // round-trip zaokroževanju Ar→EUR→Ar (70.000 → 69.984). Rezerva: stara EUR cena × tečaj.
    const lunchTotal = members.reduce((s, m) => {
      const lp = m.lunchProviderId ? lunchMap.get(m.lunchProviderId) : undefined
      if (lp) return s + (lp.pricePerPersonAr || 0) * (m.pax || 0)
      return s + Math.round((m.lunchPrice ? Number(m.lunchPrice) : 0) * rate)
    }, 0)

    const isFanja = excursionName.trim().toLowerCase().startsWith('fanja')
    const fanjaGuestTotalEur = members.reduce((s, m) => s + (m.guestPrice ? Number(m.guestPrice) : 0), 0)
    const fanjaPayment = Math.round(fanjaGuestTotalEur * 0.9 * rate)

    const isGroup = !!first.groupId && members.length > 1
    const isOrdered = members.every(m => !!m.dilipOrderedAt)

    const groupKey = first.groupId ? `g:${first.groupId}` : `s:${first.id}`
    // Supplier payment refKeys for NON-Fanja excursions — one ledger per recipient.
    // Must match the pending IZLETI card so payments sync both ways.
    const dilipRefKey = `excursion:${groupKey}:dilip`
    const lunchRefKey = `excursion:${groupKey}:lunch`
    const entranceRefKey = `excursion:${groupKey}:entrance`

    return [{
      key: groupKey,
      bookingIds: members.map(m => m.id),
      date,
      excursionName,
      isGroup,
      isOrdered,
      totalPax,
      members: members.map(m => {
        const res = resMap.get(m.reservationId)
        return { bungalow: res?.bungalow || '', guestName: res?.guestName || '', pax: m.pax || 0 }
      }),
      isFanja,
      fanjaPayment,
      dilipPayment,
      lunchTotal,
      entranceTotalAr,
      boatName: first.boatId ? (boatMap.get(first.boatId) || '') : '',
      // Fanja payment status (from first member — one ledger per group)
      fanjaPaidAt: first.fanjaPaidAt || null,
      fanjaPaidMethod: first.fanjaPaidMethod || null,
      fanjaPaidCompany: first.fanjaPaidCompany || null,
      fanjaPaidAmountAr: first.fanjaPaidAmountAr ? Number(first.fanjaPaidAmountAr) : 0,
      // Non-Fanja supplier payments (Dilip / lunch / entrance)
      dilipRefKey,
      lunchRefKey,
      entranceRefKey,
      dilipPaid: (!isFanja && dilipPayment > 0) ? paidFor(dilipRefKey) : null,
      lunchPaid: (!isFanja && lunchTotal > 0) ? paidFor(lunchRefKey) : null,
      entrancePaid: (!isFanja && entranceTotalAr > 0) ? paidFor(entranceRefKey) : null,
    }]
  })

  items.sort((a, b) => b.date.localeCompare(a.date) || a.excursionName.localeCompare(b.excursionName))
  return { items, today: todayStr, rate }
}

// Search across ALL reservations (including checked-out / past guests), by guest name,
// bungalow or booking source. Used by the search box in the Reservations tab, since the
// dashboard only loads active (not checked-out) reservations.
export async function searchReservations(query: string) {
  const q = query.trim()
  if (!q) return []
  const like = `%${q}%`
  const rows = await db.select().from(reservations)
    .where(or(
      sql`${reservations.guestName} ILIKE ${like}`,
      sql`${reservations.bungalow} ILIKE ${like}`,
      sql`${reservations.bookingSource} ILIKE ${like}`,
    ))
    .orderBy(desc(reservations.arrival))
    .limit(50)

  const toDateStr = (v: unknown) => !v ? '' : (typeof v === 'string' ? v.split('T')[0] : (v as Date).toISOString().split('T')[0])
  const toIso = (v: unknown) => !v ? null : (typeof v === 'string' ? v : (v as Date).toISOString())
  return rows.map(res => ({
    id: res.id,
    guestName: res.guestName,
    bungalow: res.bungalow,
    bookingSource: res.bookingSource,
    honeymoon: res.honeymoon,
    allergies: res.allergies,
    arrival: toDateStr(res.arrival),
    departure: toDateStr(res.departure),
    checkedInAt: toIso(res.checkedInAt),
    checkedOutAt: toIso(res.checkedOutAt),
  }))
}

// ============ VOUCHER DATA ============

export async function getExcursionVoucherData(bookingId: string) {
  // Get the excursion booking
  const [booking] = await db.select().from(excursionBookings).where(eq(excursionBookings.id, bookingId)).limit(1)
  if (!booking) return null

  // Get the excursion details
  const [excursion] = await db.select().from(excursions).where(eq(excursions.id, booking.excursionId)).limit(1)
  if (!excursion) return null

  // Get the reservation details
  const [reservation] = await db.select().from(reservations).where(eq(reservations.id, booking.reservationId)).limit(1)
  if (!reservation) return null

  return {
    booking: {
      id: booking.id,
      date: booking.date ? (typeof booking.date === 'string' ? booking.date : booking.date.toISOString().split('T')[0]) : null,
      pax: booking.pax,
      notes: booking.notes,
    },
    excursion: {
      name: excursion.name,
      description: excursion.description,
      imageUrl: excursion.imageUrl,
    },
    reservation: {
      guestName: reservation.guestName,
      secondGuestName: reservation.secondGuestName,
      honeymoon: reservation.honeymoon,
      pax: reservation.pax,
    }
  }
}

// ============ TRANSFER VOUCHER DATA ============

export async function getTransferVoucherData(reservationId: string, type: 'arrival' | 'departure') {
  // Get the reservation
  const [reservation] = await db.select().from(reservations).where(eq(reservations.id, reservationId)).limit(1)
  if (!reservation) return null

  // Get the transfer
  const [transfer] = await db.select().from(transfers).where(
    and(
      eq(transfers.reservationId, reservationId),
      eq(transfers.type, type)
    )
  ).limit(1)
  if (!transfer) return null

  // Get the route name (main transfer route) + Herman route (car to/from Port)
  const [route] = await db.select().from(routes).where(eq(routes.id, transfer.route || '')).limit(1)
  let hermanRouteName = ''
  if (transfer.hermanRouteId) {
    const [hermanRoute] = await db.select().from(routes).where(eq(routes.id, transfer.hermanRouteId)).limit(1)
    hermanRouteName = hermanRoute?.name || ''
  }

  return {
    guestName: reservation.guestName,
    secondGuestName: reservation.secondGuestName,
    bungalowName: reservation.bungalow || '',
    routeName: route?.name || '',
    hermanRouteName,
    guestPrice: Number(transfer.guestPrice) || 0,
    date: type === 'arrival' 
      ? (transfer.pickupDate || reservation.arrival)
      : (transfer.pickupDate || reservation.departure),
    time: type === 'arrival' ? transfer.flightTime : transfer.pickupTime,
    pax: reservation.pax || 1,
    flightNumber: transfer.flightNumber,
    paymentStatus: transfer.paymentStatus,
  }
}

// ============ SCHEDULED EXCURSIONS (Fanja's planned trips) ============

export async function getScheduledExcursions() {
  return await db.select().from(scheduledExcursions).orderBy(scheduledExcursions.date)
}

export async function addScheduledExcursion(data: { 
  date: string; 
  excursionType: string; 
  isOption?: boolean; 
  notes?: string 
}) {
  const id = uid('sched')
  await db.insert(scheduledExcursions).values({
    id,
    date: data.date,
    excursionType: data.excursionType,
    isOption: data.isOption || false,
    notes: data.notes || null,
  })
  revalidatePath('/')
  return id
}

export async function updateScheduledExcursion(id: string, data: Partial<{
  date: string;
  excursionType: string;
  isOption: boolean;
  notes: string;
}>) {
  await db.update(scheduledExcursions).set(data).where(eq(scheduledExcursions.id, id))
  revalidatePath('/')
}

export async function deleteScheduledExcursion(id: string) {
  await db.delete(scheduledExcursions).where(eq(scheduledExcursions.id, id))
  revalidatePath('/')
}

// Match a booked excursion (by its name) to a Fanja scheduled excursion type.
// Only guests whose booked excursion matches the scheduled type should appear
// under that Fanja trip — e.g. Ampangorina is a private trip and must not show.
function excursionMatchesScheduleType(excursionName: string | null | undefined, type: string): boolean {
  if (!excursionName) return false
  const n = excursionName.toLowerCase()
  switch (type) {
    case 'tanikely-sakatia': return n.includes('tanikely')
    case 'sakatia': return n.includes('sakatia')
    case 'safari-iranja':
    case 'iranja': return n.includes('iranja')
    case 'mitsio': return n.includes('mitsio')
    case 'megafauna': return n.includes('megafauna') || n.includes('mégafauna') || n.includes('mega')
    case 'bivouac': return n.includes('bivouac') || n.includes('bivouak')
    case 'day-off': return false
    default: return false
  }
}

// Get scheduled excursions with guest bookings for each date
export async function getScheduledExcursionsWithGuests() {
  const scheduled = await db.select().from(scheduledExcursions).orderBy(scheduledExcursions.date)
  const bookings = await db.select().from(excursionBookings)
  const allReservations = await db.select().from(reservations).where(isNull(reservations.checkedOutAt))
  const allExcursions = await db.select().from(excursions)
  
  return scheduled.map(s => {
    // Find all bookings on this date whose excursion matches this Fanja trip type
    const guestsOnDate = bookings
      .filter(b => b.status !== 'CANCELLED' && b.date === s.date && excursionMatchesScheduleType(allExcursions.find(e => e.id === b.excursionId)?.name, s.excursionType))
      .map(b => {
        const res = allReservations.find(r => r.id === b.reservationId)
        return res ? { 
          reservationId: res.id, 
          guestName: res.guestName, 
          bungalow: res.bungalow,
          pax: b.pax 
        } : null
      })
      .filter(Boolean)
    
    return {
      ...s,
      guests: guestsOnDate,
    }
  })
}

// ============ DNEVNA OPRAVILA (DAILY TASKS) ============
// Shared daily reminder tasks (both Slovenia + Madagascar see the same list).
// Raw SQL over the daily_tasks table (created via MCP, not in drizzle schema).
export type DailyTask = { id: string; date: string; text: string; done: boolean; recurring: boolean; assignee: string | null; createdBy: string | null; createdAt: string }

export async function getDailyTasks(date: string): Promise<DailyTask[]> {
  // Show: non-recurring tasks on their exact date; recurring tasks on every day from their
  // start date onward UNTIL marked done (a done recurring task still shows on its own start date).
  const result = await db.execute(sql`
    SELECT id, date, text, done, recurring, assignee, "createdBy", "createdAt"
    FROM daily_tasks
    WHERE (recurring = false AND date = ${date})
       OR (recurring = true AND done = false AND date <= ${date})
       OR (recurring = true AND done = true AND date = ${date})
    ORDER BY "createdAt" ASC`)
  return result.rows.map((r) => ({
    id: r.id as string,
    date: r.date as string,
    text: r.text as string,
    done: r.done === true,
    recurring: r.recurring === true,
    assignee: (r.assignee as string) ?? null,
    createdBy: (r.createdBy as string) ?? null,
    createdAt: String(r.createdAt),
  }))
}

// Future-dated one-off tasks that are still open — shown as "prihajajoča opravila" so a task
// created for a later day never seems to vanish from today's reminder.
export async function getUpcomingDailyTasks(afterDate: string): Promise<DailyTask[]> {
  const result = await db.execute(sql`
    SELECT id, date, text, done, recurring, assignee, "createdBy", "createdAt"
    FROM daily_tasks
    WHERE recurring = false AND done = false AND date > ${afterDate}
    ORDER BY date ASC, "createdAt" ASC`)
  return result.rows.map((r) => ({
    id: r.id as string,
    date: r.date as string,
    text: r.text as string,
    done: r.done === true,
    recurring: r.recurring === true,
    assignee: (r.assignee as string) ?? null,
    createdBy: (r.createdBy as string) ?? null,
    createdAt: String(r.createdAt),
  }))
}

export async function addDailyTask(date: string, text: string, assignee?: string | null, recurring?: boolean, createdBy?: string) {
  const trimmed = text.trim()
  if (!trimmed) return
  const id = uid('task')
  await db.execute(sql`INSERT INTO daily_tasks (id, date, text, done, recurring, assignee, "createdBy") VALUES (${id}, ${date}, ${trimmed}, false, ${recurring ?? false}, ${assignee ?? null}, ${createdBy ?? null})`)

  // Ring the assignee's phone. Deliberately non-blocking: a push failure (no device
  // enrolled, keys missing) must never lose the task that was just saved.
  // The UI stores 'Urška' with its diacritic; push targets are ASCII.
  const target: 'Borut' | 'Urska' | null =
    assignee === 'Borut' ? 'Borut' : assignee === 'Urška' ? 'Urska' : null
  if (target) {
    try {
      const { sendPushToPerson } = await import('./push')
      // ISO dates read like machine output on a phone. timeZone UTC is required here:
      // the value is a bare YYYY-MM-DD, so a local zone would shift the day.
      const dan = /^\d{4}-\d{2}-\d{2}$/.test(date)
        ? new Date(`${date}T00:00:00Z`).toLocaleDateString('sl-SI', { day: 'numeric', month: 'long', timeZone: 'UTC' })
        : date
      await sendPushToPerson(target, { title: `Novo opravilo — ${dan}`, body: trimmed, url: '/' }, 'task')
    } catch (err) {
      console.log('[v0] task push failed:', (err as Error)?.message)
    }
  }

  revalidatePath('/')
  return id
}

export async function toggleDailyTask(id: string, done: boolean) {
  await db.execute(sql`UPDATE daily_tasks SET done = ${done} WHERE id = ${id}`)
  revalidatePath('/')
}

// Edit an existing manual task: text, assignee and/or recurring flag.
export async function updateDailyTask(id: string, data: { text?: string; assignee?: string | null; recurring?: boolean }) {
  if (data.text !== undefined) {
    const trimmed = data.text.trim()
    if (!trimmed) return
    await db.execute(sql`UPDATE daily_tasks SET text = ${trimmed} WHERE id = ${id}`)
  }
  if (data.assignee !== undefined) {
    await db.execute(sql`UPDATE daily_tasks SET assignee = ${data.assignee ?? null} WHERE id = ${id}`)
  }
  if (data.recurring !== undefined) {
    await db.execute(sql`UPDATE daily_tasks SET recurring = ${data.recurring} WHERE id = ${id}`)
  }
  revalidatePath('/')
}

export async function deleteDailyTask(id: string) {
  await db.execute(sql`DELETE FROM daily_tasks WHERE id = ${id}`)
  revalidatePath('/')
}

// Check state for AUTO reminder items (transports, invoices, police, excursions, arrivals, departures).
// Keyed by (date, checkKey) where checkKey is a stable string built in the UI (e.g. "orderAhead::<resId>::departure").
export async function getReminderChecks(date: string): Promise<Record<string, boolean>> {
  const result = await db.execute(sql`SELECT "checkKey", done FROM daily_reminder_checks WHERE date = ${date}`)
  const map: Record<string, boolean> = {}
  for (const r of result.rows) map[r.checkKey as string] = r.done === true
  return map
}

export async function setReminderCheck(date: string, checkKey: string, done: boolean) {
  if (done) {
    await db.execute(sql`INSERT INTO daily_reminder_checks (date, "checkKey", done, "updatedAt") VALUES (${date}, ${checkKey}, true, now()) ON CONFLICT (date, "checkKey") DO UPDATE SET done = true, "updatedAt" = now()`)
  } else {
    await db.execute(sql`DELETE FROM daily_reminder_checks WHERE date = ${date} AND "checkKey" = ${checkKey}`)
  }
  revalidatePath('/')
}

// Persistent dismissals: once an auto reminder (e.g. the police-email reminder) is checked off,
// it should NOT come back on following days. Keyed by checkKey only; `date` records the day it
// was dismissed so it can still be shown (and undone) on that same day.
export async function getReminderDismissals(): Promise<Record<string, string>> {
  const result = await db.execute(sql`SELECT "checkKey", date FROM reminder_dismissals`)
  const map: Record<string, string> = {}
  for (const r of result.rows) map[r.checkKey as string] = (r.date as string) ?? ''
  return map
}

export async function setReminderDismissed(checkKey: string, date: string, dismissed: boolean) {
  if (dismissed) {
    await db.execute(sql`INSERT INTO reminder_dismissals ("checkKey", date, "dismissedAt") VALUES (${checkKey}, ${date}, now()) ON CONFLICT ("checkKey") DO UPDATE SET date = ${date}, "dismissedAt" = now()`)
  } else {
    await db.execute(sql`DELETE FROM reminder_dismissals WHERE "checkKey" = ${checkKey}`)
  }
  revalidatePath('/')
}

// ============ TAKSE (TAXES) ============

const COMMUNAL_TAX_PER_PERSON_NIGHT = 2000 // Ar - občinska taksa na osebo na noč
const TOURIST_TAX_PER_ROOM_NIGHT = 1000 // Ar - turistična taksa na sobo (bungalov) na noč

// Helper: parse a YYYY-MM-DD date string into a UTC date (midnight)
function parseDateOnly(value: string | Date | null | undefined): Date | null {
  if (!value) return null
  const s = typeof value === 'string' ? value : value.toISOString().slice(0, 10)
  const m = s.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
}

export type TaxLineItem = {
  reservationId: string
  guestName: string
  bungalow: string
  pax: number
  nights: number
  arrival: string
  departure: string
  communalTax: number
  touristTax: number
  total: number
  excluded: boolean // ali je ročno izključena iz obračuna taks (ne šteje v vsote)
}

export type MonthlyTaxes = {
  year: number
  month: number // 1-12
  lineItems: TaxLineItem[]
  totalPax: number
  totalNights: number
  totalRoomNights: number
  communalTotal: number
  touristTotal: number
  grandTotal: number
}

export async function getTaxesForMonth(year: number, month: number): Promise<MonthlyTaxes> {
  // month is 1-12
  const monthStart = new Date(Date.UTC(year, month - 1, 1))
  const monthEnd = new Date(Date.UTC(year, month, 1)) // first day of next month

  // Fetch ALL reservations (active + archived) - taxes apply regardless of checkout state
  const allReservations = await db.select().from(reservations)

  const lineItems: TaxLineItem[] = []

  for (const r of allReservations) {
  // Prefer actual check-in/check-out dates, fall back to arrival/departure
  const startStr = r.checkIn || r.arrival
  const endStr = r.checkOut || r.departure
  const start = parseDateOnly(startStr)
  const end = parseDateOnly(endStr)
  if (!start || !end) continue
  
  // Taxes are charged in the ARRIVAL month for the WHOLE stay. A guest who
  // arrives in June and stays into July is fully counted in June (not split).
  if (start < monthStart || start >= monthEnd) continue
  const nights = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  if (nights <= 0) continue

    const pax = r.pax || 0
    const communalTax = COMMUNAL_TAX_PER_PERSON_NIGHT * pax * nights
    const touristTax = TOURIST_TAX_PER_ROOM_NIGHT * nights // 1 bungalow = 1 room

    lineItems.push({
      reservationId: r.id,
      guestName: r.guestName,
      bungalow: r.bungalow,
      pax,
      nights,
      arrival: (startStr || '').slice(0, 10),
      departure: (endStr || '').slice(0, 10),
      communalTax,
      touristTax,
      total: communalTax + touristTax,
      excluded: r.excludeFromTaxes === true,
    })
  }

  // Sort by bungalow then arrival
  lineItems.sort((a, b) => a.bungalow.localeCompare(b.bungalow) || a.arrival.localeCompare(b.arrival))

  // Vsote štejejo SAMO neizključene postavke
  const counted = lineItems.filter((i) => !i.excluded)
  const communalTotal = counted.reduce((s, i) => s + i.communalTax, 0)
  const touristTotal = counted.reduce((s, i) => s + i.touristTax, 0)
  const totalNights = counted.reduce((s, i) => s + i.nights, 0)
  const totalRoomNights = counted.reduce((s, i) => s + i.nights, 0)
  const totalPax = counted.reduce((s, i) => s + i.pax * i.nights, 0)

  return {
    year,
    month,
    lineItems,
    totalPax,
    totalNights,
    totalRoomNights,
    communalTotal,
    touristTotal,
    grandTotal: communalTotal + touristTotal,
  }
}

// Izključi / vključi rezervacijo v obračun taks
export async function setReservationTaxExclusion(reservationId: string, excluded: boolean) {
  await db.update(reservations).set({ excludeFromTaxes: excluded }).where(eq(reservations.id, reservationId))
  revalidatePath('/')
}
