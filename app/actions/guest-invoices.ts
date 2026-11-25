'use server'

import { db } from '@/lib/db'
import { deliveryNoteItems, deliveryNotes, invoiceDiscounts, orderItems, reservations } from '@/lib/db/schema'
import { and, eq, gte, inArray, isNotNull, lt } from 'drizzle-orm'
import { getExchangeRate } from '@/app/actions/komba'
import {
  guestInvoiceReference,
  issuedInvoiceAmountEur,
  issuedInvoiceRange,
  type IssuedInvoiceBarItem,
  type IssuedInvoiceOrder,
} from '@/lib/issued-invoices'
import { HANNAH_STAY_ID, hannahOnInvoiceList, hiddenCheckoutInvoice, lodgingShareLines } from '@/lib/named-stay-income'

export type IssuedGuestInvoice = {
  reservationId: string
  guestName: string
  reference: string
  issuedAt: string
  amountEur: number
  // A lodging share is the part of a stay that belongs to this month.
  // It is not a second issued invoice, so it has no guest-card link.
  lodgingShare?: boolean
  nights?: number
}

type Stay = {
  id: string
  guestName: string
  checkedOutAt: Date | null
  totalAmount: string | null
  currency: string | null
  bookingSource: string | null
  mealPlan: string | null
  mealPlanPaymentStatus: string | null
  groupId: string | null
  isMainReservation: boolean | null
  sharedInvoice: boolean | null
}

export async function getIssuedGuestInvoices(year: number, month: number): Promise<IssuedGuestInvoice[]> {
  const { start, end } = issuedInvoiceRange(year, month)
  const issued = await db.select({
    id: reservations.id,
    guestName: reservations.guestName,
    checkedOutAt: reservations.checkedOutAt,
    totalAmount: reservations.totalAmount,
    currency: reservations.currency,
    bookingSource: reservations.bookingSource,
    mealPlan: reservations.mealPlan,
    mealPlanPaymentStatus: reservations.mealPlanPaymentStatus,
    groupId: reservations.groupId,
    isMainReservation: reservations.isMainReservation,
    sharedInvoice: reservations.sharedInvoice,
  }).from(reservations).where(and(
    isNotNull(reservations.checkedOutAt),
    gte(reservations.checkedOutAt, start),
    lt(reservations.checkedOutAt, end),
  ))

  const hannah = hannahOnInvoiceList(month)
  const listed = issued.filter((row) => !hiddenCheckoutInvoice(row.id, month))
  if (hannah && !listed.some((row) => row.id === HANNAH_STAY_ID)) {
    const [card] = await db.select({
      id: reservations.id,
      guestName: reservations.guestName,
      checkedOutAt: reservations.checkedOutAt,
      totalAmount: reservations.totalAmount,
      currency: reservations.currency,
      bookingSource: reservations.bookingSource,
      mealPlan: reservations.mealPlan,
      mealPlanPaymentStatus: reservations.mealPlanPaymentStatus,
      groupId: reservations.groupId,
      isMainReservation: reservations.isMainReservation,
      sharedInvoice: reservations.sharedInvoice,
    }).from(reservations).where(eq(reservations.id, HANNAH_STAY_ID))
    if (card) listed.push(card)
  }

  const shares: IssuedGuestInvoice[] = lodgingShareLines(month).map((line) => ({
    reservationId: line.id,
    guestName: line.guestName,
    reference: line.reference,
    issuedAt: `${line.night}T12:00:00.000Z`,
    amountEur: line.amountEur,
    lodgingShare: true,
  }))

  if (listed.length === 0) return shares

  const groupIds = [...new Set(listed.map((row) => row.groupId).filter((id): id is string => Boolean(id)))]
  const grouped = groupIds.length
    ? await db.select({
      id: reservations.id,
      guestName: reservations.guestName,
      checkedOutAt: reservations.checkedOutAt,
      totalAmount: reservations.totalAmount,
      currency: reservations.currency,
      bookingSource: reservations.bookingSource,
      mealPlan: reservations.mealPlan,
      mealPlanPaymentStatus: reservations.mealPlanPaymentStatus,
      groupId: reservations.groupId,
      isMainReservation: reservations.isMainReservation,
      sharedInvoice: reservations.sharedInvoice,
    }).from(reservations).where(inArray(reservations.groupId, groupIds))
    : []

  const byGroup = new Map<string, Stay[]>()
  for (const row of grouped) {
    if (!row.groupId) continue
    const list = byGroup.get(row.groupId) || []
    list.push(row)
    byGroup.set(row.groupId, list)
  }

  const sourceIds = new Set<string>()
  const sourcesFor = new Map<string, string[]>()
  for (const row of listed) {
    const group = row.groupId ? (byGroup.get(row.groupId) || []) : []
    const main = group.find((member) => member.isMainReservation)
    const shared = Boolean(row.sharedInvoice || main?.sharedInvoice)
    const ids = shared && group.length ? group.map((member) => member.id) : [row.id]
    sourcesFor.set(row.id, ids)
    for (const id of ids) sourceIds.add(id)
  }

  const ids = [...sourceIds]
  const [orders, notes, discounts, rate] = await Promise.all([
    db.select({
      reservationId: orderItems.reservationId,
      name: orderItems.name,
      category: orderItems.category,
      priceAr: orderItems.priceAr,
      refPriceAr: orderItems.refPriceAr,
      paymentStatus: orderItems.paymentStatus,
      isFree: orderItems.isFree,
    }).from(orderItems).where(inArray(orderItems.reservationId, ids)),
    db.select({
      id: deliveryNotes.id,
      reservationId: deliveryNotes.reservationId,
    }).from(deliveryNotes).where(inArray(deliveryNotes.reservationId, ids)),
    db.select({
      reservationId: invoiceDiscounts.reservationId,
      amountAr: invoiceDiscounts.amountAr,
    }).from(invoiceDiscounts).where(inArray(invoiceDiscounts.reservationId, listed.map((row) => row.id))),
    getExchangeRate(),
  ])

  const noteIds = notes.map((note) => note.id)
  const barLines = noteIds.length
    ? await db.select({
      deliveryNoteId: deliveryNoteItems.deliveryNoteId,
      productName: deliveryNoteItems.productName,
      priceAr: deliveryNoteItems.priceAr,
      quantity: deliveryNoteItems.quantity,
      coveredByMealPlan: deliveryNoteItems.coveredByMealPlan,
      isFree: deliveryNoteItems.isFree,
    }).from(deliveryNoteItems).where(inArray(deliveryNoteItems.deliveryNoteId, noteIds))
    : []

  const noteReservation = new Map(notes.map((note) => [note.id, note.reservationId]))
  const ordersByStay = new Map<string, IssuedInvoiceOrder[]>()
  for (const order of orders) {
    if (!order.reservationId) continue
    const list = ordersByStay.get(order.reservationId) || []
    list.push(order)
    ordersByStay.set(order.reservationId, list)
  }
  const barByStay = new Map<string, IssuedInvoiceBarItem[]>()
  for (const line of barLines) {
    const reservationId = noteReservation.get(line.deliveryNoteId)
    if (!reservationId) continue
    const list = barByStay.get(reservationId) || []
    list.push(line)
    barByStay.set(reservationId, list)
  }
  const discountByStay = new Map<string, number>()
  for (const discount of discounts) {
    discountByStay.set(discount.reservationId, (discountByStay.get(discount.reservationId) || 0) + Number(discount.amountAr || 0))
  }

  const invoices = listed
    .map((row) => {
      const idsForInvoice = sourcesFor.get(row.id) || [row.id]
      const onAprilList = row.id === HANNAH_STAY_ID ? hannahOnInvoiceList(month) : null
      const issuedAt = onAprilList
        ? `${onAprilList.night}T12:00:00.000Z`
        : row.checkedOutAt instanceof Date ? row.checkedOutAt.toISOString() : String(row.checkedOutAt)
      return {
        reservationId: row.id,
        guestName: row.guestName,
        reference: guestInvoiceReference(row.id),
        issuedAt,
        nights: onAprilList?.nights,
        amountEur: issuedInvoiceAmountEur({
          totalAmount: Number(row.totalAmount) || 0,
          currency: row.currency,
          bookingSource: row.bookingSource,
          mealPlan: row.mealPlan,
          mealPlanPaymentStatus: row.mealPlanPaymentStatus,
          exchangeRate: rate,
          orders: idsForInvoice.flatMap((id) => ordersByStay.get(id) || []),
          barItems: idsForInvoice.flatMap((id) => barByStay.get(id) || []),
          discountsAr: discountByStay.get(row.id) || 0,
        }),
      }
    })
    .sort((a, b) => a.issuedAt.localeCompare(b.issuedAt) || a.guestName.localeCompare(b.guestName, 'sl'))
  return [...invoices, ...shares].sort((a, b) => a.issuedAt.localeCompare(b.issuedAt) || a.guestName.localeCompare(b.guestName, 'sl'))
}
