'use server'

import { db } from '@/lib/db'
import { deliveryNotes, deliveryNoteItems, products, reservations, staff, invoices, invoiceItems } from '@/lib/db/schema'
import { eq, and, desc, asc } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { revalidatePath } from 'next/cache'
import { mealPayFactor, childBand } from '@/lib/meal-plan'

// Get all products from database
export async function getProducts() {
  const allProducts = await db.query.products.findMany({
    where: eq(products.active, true),
    orderBy: [asc(products.category), asc(products.name)],
  })
  
  return allProducts.map(p => ({
    id: p.id,
    name: p.name,
    category: p.category,
    costCategory: p.costCategory ?? 'pijaca',
    priceAr: p.priceAr,
    priceEur: p.priceEur ? parseFloat(p.priceEur) : null,
    unit: p.unit,
    editablePrice: p.editablePrice ?? false,
  }))
}

// Get unique categories from products
export async function getCategories() {
  const allProducts = await db.query.products.findMany({
    where: eq(products.active, true),
  })
  
  const categories = [...new Set(allProducts.map(p => p.category))]
  return categories.sort()
}

// Get all active bungalows with current guests (checked in, NOT checked out)
export async function getActiveBungalows() {
  const today = new Date().toISOString().split('T')[0]
  
  const activeReservations = await db.query.reservations.findMany()
  
  // Normalize a date value (Date object or ISO timestamp string) to YYYY-MM-DD
  const toDateStr = (value: unknown): string => {
    if (!value) return ''
    if (value instanceof Date) return value.toISOString().split('T')[0]
    return String(value).split('T')[0]
  }

  // Filter for current guests (checked in, NOT checked out, within date range)
  const currentGuests = activeReservations.filter(r => {
    const arrival = toDateStr(r.arrival)
    const departure = toDateStr(r.departure)
    const isInDateRange = arrival <= today && departure >= today
    const isCheckedIn = r.checkedInAt !== null
    const isNotCheckedOut = r.checkedOutAt === null
    // Skrij iz bara, če se rezervacija fakturira na drug bungalov (excludeFromBar).
    const isHiddenFromBar = r.excludeFromBar === true
    return isInDateRange && isCheckedIn && isNotCheckedOut && !isHiddenFromBar
  })
  
  return currentGuests.map(r => ({
    reservationId: r.id,
    bungalow: r.bungalow,
    guestName: r.guestName,
    arrival: r.arrival,
    departure: r.departure,
    pax: r.pax,
    // Per-guest names + age bands (from the guest card) so the bar can pick a
    // person instead of guessing the discount. band null/empty = adult.
    guests: [
      { name: r.guestName, band: r.guestBand ?? null },
      { name: r.secondGuestName ?? null, band: r.secondGuestBand ?? null },
      { name: r.thirdGuestName ?? null, band: r.thirdGuestBand ?? null },
      { name: r.fourthGuestName ?? null, band: r.fourthGuestBand ?? null },
    ].slice(0, Math.max(1, r.pax || 1)),
  }))
}

// Get or create today's delivery note for a bungalow
export async function getOrCreateDeliveryNote(reservationId: string, bungalow: string, guestName: string) {
  const today = new Date().toISOString().split('T')[0]
  
  // Match open notes by reservationId (stable), NOT by the bungalow string.
  // If the bungalow gets renamed/corrected on the reservation, matching by the
  // old string would orphan the note and create a duplicate under the wrong
  // bungalow. First, close any open delivery notes from previous days.
  const openPastNotes = await db.query.deliveryNotes.findMany({
    where: and(
      eq(deliveryNotes.reservationId, reservationId),
      eq(deliveryNotes.status, 'open')
    ),
  })
  
  for (const pastNote of openPastNotes) {
    const noteDate = typeof pastNote.date === 'string'
      ? pastNote.date.split('T')[0]
      : new Date(pastNote.date).toISOString().split('T')[0]
    if (noteDate < today) {
      await db.update(deliveryNotes)
        .set({ status: 'closed' })
        .where(eq(deliveryNotes.id, pastNote.id))
    }
  }
  
  // Check if an open delivery note already exists for today for this reservation
  let note = await db.query.deliveryNotes.findFirst({
    where: and(
      eq(deliveryNotes.reservationId, reservationId),
      eq(deliveryNotes.date, today),
      eq(deliveryNotes.status, 'open')
    ),
  })
  
  // Keep the bungalow/guest name in sync with the current reservation.
  if (note && (note.bungalow !== bungalow || note.guestName !== guestName)) {
    await db.update(deliveryNotes)
      .set({ bungalow, guestName })
      .where(eq(deliveryNotes.id, note.id))
    note = { ...note, bungalow, guestName }
  }
  
  if (!note) {
    // Create new delivery note for today
    const newId = nanoid()
    await db.insert(deliveryNotes).values({
      id: newId,
      reservationId,
      bungalow,
      guestName,
      date: today,
      status: 'open',
      totalAr: 0,
    })
    
    note = await db.query.deliveryNotes.findFirst({
      where: eq(deliveryNotes.id, newId)
    })
  }
  
  return note
}

// Get delivery note with items
export async function getDeliveryNoteWithItems(deliveryNoteId: string) {
  const note = await db.query.deliveryNotes.findFirst({
    where: eq(deliveryNotes.id, deliveryNoteId),
  })
  
  if (!note) return null
  
  const items = await db.query.deliveryNoteItems.findMany({
    where: eq(deliveryNoteItems.deliveryNoteId, deliveryNoteId),
    orderBy: [desc(deliveryNoteItems.createdAt)],
  })
  
  return { ...note, items }
}

// Add item to delivery note
export async function addItemToDeliveryNote(
  deliveryNoteId: string,
  productId: string,
  quantity: number,
  staffId: string,
  staffName: string,
  childBandId?: string | null
) {
  const product = await db.query.products.findFirst({
    where: eq(products.id, productId)
  })
  
  if (!product) {
    throw new Error('Product not found')
  }
  
  // Find the delivery note first so we can check the guest's meal plan.
  const note = await db.query.deliveryNotes.findFirst({
    where: eq(deliveryNotes.id, deliveryNoteId)
  })
  
  // Board (HB/FB/B) is billed PER DELIVERED MEAL on the delivery note — the user's
  // decision (29 Aug 2026): marking a guest as half/full board means each meal is
  // still charged and must be paid, so meals are NEVER zeroed out as "included".
  // The penzion price shown in the guest profile is informational only; it is not a
  // separate invoice line (generateMealPlanOrderItem is never added to a bill), so
  // billing meals here does not double-charge.
  const coveredByMealPlan = false
  const coveredQty = quantity

  // Otroski prehranski popust (0-5 brezplacno, 5-10 -50%, 10-15 -20%) velja SAMO
  // za HRANO (costCategory 'prehrana'), NE za pijaco. Pri pijaci se band ignorira.
  const isFood = (product as { costCategory?: string }).costCategory === 'prehrana'
  const band = isFood ? childBand(childBandId) : null
  const payFactor = band ? mealPayFactor(childBandId) : 1
  const unitPriceAr = band ? Math.round(product.priceAr * payFactor) : product.priceAr
  const displayName = band ? `${product.name} (child ${band.id} yrs, −${Math.round(band.discount * 100)}%)` : product.name

  // The covered servings never reach a bill. When the plan covers fewer guests than
  // were served, only the surplus is charged.
  const billableQty = coveredByMealPlan ? Math.max(0, quantity - coveredQty) : quantity
  const totalAr = unitPriceAr * billableQty
  
  // Determine costCategory from product
  const costCategory = (product as { costCategory?: string }).costCategory || 'pijaca'
  
  const baseRow = {
    deliveryNoteId,
    productId,
    productName: displayName,
    category: product.category,
    costCategory,
    priceAr: unitPriceAr,
    staffId,
    staffName,
  }

  // A partly covered order is written as TWO lines instead of one. Staff still enter
  // a single "dinner ×2" exactly as before — this only changes how it is recorded.
  // As one line it would read as an error on the note (×2 priced as one serving) and
  // nobody could tell which serving the board paid for. Splitting also keeps the
  // covered flag honest per line: flagging a partly covered line would hide the
  // charge and make toggleFreeItem refuse to touch it (it returns early on that).
  const isSplit = coveredByMealPlan && coveredQty > 0 && billableQty > 0
  const now = new Date()

  const rows = isSplit
    ? [
        { ...baseRow, id: nanoid(), quantity: coveredQty, totalAr: 0, coveredByMealPlan: true, createdAt: now },
        // One second later so the pair always stays adjacent in date order and reads
        // as twins on screen, rather than drifting apart among other drinks.
        {
          ...baseRow,
          id: nanoid(),
          quantity: billableQty,
          totalAr: unitPriceAr * billableQty,
          coveredByMealPlan: false,
          createdAt: new Date(now.getTime() + 1000),
        },
      ]
    : [
        {
          ...baseRow,
          id: nanoid(),
          quantity,
          totalAr,
          coveredByMealPlan: coveredByMealPlan && billableQty === 0,
          createdAt: now,
        },
      ]

  await db.insert(deliveryNoteItems).values(rows)
  
  // Update delivery note total
  if (note) {
    await db.update(deliveryNotes)
      .set({ totalAr: (note.totalAr || 0) + totalAr })
      .where(eq(deliveryNotes.id, deliveryNoteId))
    
    // Revalidate all relevant paths so admin sees updates immediately
    revalidatePath('/staff')
    revalidatePath('/')
    revalidatePath(`/dobavnice/${note.reservationId}`)
  }
  
  return { success: true }
}

// Remove item from delivery note
export async function removeItemFromDeliveryNote(itemId: string, deliveryNoteId: string) {
  const item = await db.query.deliveryNoteItems.findFirst({
    where: eq(deliveryNoteItems.id, itemId)
  })
  
  if (!item) throw new Error('Item not found')
  
  await db.delete(deliveryNoteItems).where(eq(deliveryNoteItems.id, itemId))
  
  // Update delivery note total
  const note = await db.query.deliveryNotes.findFirst({
    where: eq(deliveryNotes.id, deliveryNoteId)
  })
  
  if (note) {
    await db.update(deliveryNotes)
      .set({ totalAr: Math.max(0, (note.totalAr || 0) - item.totalAr) })
      .where(eq(deliveryNotes.id, deliveryNoteId))
    
    // Revalidate all relevant paths
    revalidatePath('/staff')
    revalidatePath('/')
    revalidatePath(`/dobavnice/${note.reservationId}`)
  }
  
  return { success: true }
}

// Correct the quantity a bar worker entered by mistake. The line total follows the
// new quantity (covered/free lines stay at 0) and the note total is adjusted by the diff.
export async function updateDeliveryNoteItemQuantity(itemId: string, quantity: number) {
  const qty = Math.floor(Number(quantity))
  if (!Number.isFinite(qty) || qty < 1 || qty > 999) {
    throw new Error('Invalid quantity')
  }

  const item = await db.query.deliveryNoteItems.findFirst({
    where: eq(deliveryNoteItems.id, itemId)
  })
  if (!item) throw new Error('Item not found')

  const oldTotalAr = item.totalAr || 0
  const newTotalAr = item.coveredByMealPlan || item.isFree ? 0 : (item.priceAr || 0) * qty

  await db.update(deliveryNoteItems)
    .set({ quantity: qty, totalAr: newTotalAr })
    .where(eq(deliveryNoteItems.id, itemId))

  const note = await db.query.deliveryNotes.findFirst({
    where: eq(deliveryNotes.id, item.deliveryNoteId)
  })

  if (note) {
    await db.update(deliveryNotes)
      .set({ totalAr: Math.max(0, (note.totalAr || 0) - oldTotalAr + newTotalAr) })
      .where(eq(deliveryNotes.id, note.id))

    revalidatePath('/staff')
    revalidatePath('/')
    revalidatePath(`/dobavnice/${note.reservationId}`)
  }

  return { success: true }
}

// Toggle "on the house" (free) flag on a delivery note item.
// Free items keep their priceAr for reference but totalAr becomes 0 so they never reach the bill.
export async function toggleItemFree(itemId: string, deliveryNoteId: string, free: boolean) {
  const item = await db.query.deliveryNoteItems.findFirst({
    where: eq(deliveryNoteItems.id, itemId)
  })
  
  if (!item) throw new Error('Item not found')
  
  // Meals covered by the meal plan are already free — don't touch them.
  if (item.coveredByMealPlan) return { success: true }
  
  const lineTotalAr = (item.priceAr || 0) * (item.quantity || 0)
  const newTotalAr = free ? 0 : lineTotalAr
  const oldTotalAr = item.totalAr || 0
  
  await db.update(deliveryNoteItems)
    .set({ isFree: free, totalAr: newTotalAr })
    .where(eq(deliveryNoteItems.id, itemId))
  
  // Adjust delivery note total by the difference
  const note = await db.query.deliveryNotes.findFirst({
    where: eq(deliveryNotes.id, deliveryNoteId)
  })
  
  if (note) {
    await db.update(deliveryNotes)
      .set({ totalAr: Math.max(0, (note.totalAr || 0) - oldTotalAr + newTotalAr) })
      .where(eq(deliveryNotes.id, deliveryNoteId))
    
    revalidatePath('/staff')
    revalidatePath('/')
    revalidatePath(`/dobavnice/${note.reservationId}`)
  }
  
  return { success: true }
}

// Toggle the "covered by meal plan" flag on a delivery note item. When a meal is
// released from the plan (covered=false) it becomes billable: totalAr = priceAr*qty,
// so it moves to "Za placilo" and counts toward the remaining balance. Setting it
// back to covered zeroes the line again. The note total is adjusted by the diff.
export async function toggleItemMealPlanCovered(itemId: string, deliveryNoteId: string, covered: boolean) {
  const item = await db.query.deliveryNoteItems.findFirst({
    where: eq(deliveryNoteItems.id, itemId)
  })

  if (!item) throw new Error('Item not found')

  const lineTotalAr = (item.priceAr || 0) * (item.quantity || 0)
  // Covered meals bill nothing; released meals bill their full line total
  // (unless the item is separately marked free/on-the-house).
  const newTotalAr = covered || item.isFree ? 0 : lineTotalAr
  const oldTotalAr = item.totalAr || 0

  await db.update(deliveryNoteItems)
    .set({ coveredByMealPlan: covered, totalAr: newTotalAr })
    .where(eq(deliveryNoteItems.id, itemId))

  // Adjust delivery note total by the difference
  const note = await db.query.deliveryNotes.findFirst({
    where: eq(deliveryNotes.id, deliveryNoteId)
  })

  if (note) {
    await db.update(deliveryNotes)
      .set({ totalAr: Math.max(0, (note.totalAr || 0) - oldTotalAr + newTotalAr) })
      .where(eq(deliveryNotes.id, deliveryNoteId))

    revalidatePath('/staff')
    revalidatePath('/')
    revalidatePath(`/dobavnice/${note.reservationId}`)
  }

  return { success: true }
}

// Close delivery note (end of day) and create new one for next day
export async function closeDeliveryNote(deliveryNoteId: string, staffId?: string) {
  // Get the note to close
  const noteToClose = await db.query.deliveryNotes.findFirst({
    where: eq(deliveryNotes.id, deliveryNoteId)
  })
  
  if (!noteToClose) return { success: false }
  
  // Close the current note
  await db.update(deliveryNotes)
    .set({ 
      status: 'closed',
      closedAt: new Date(),
      closedBy: staffId || null,
    })
    .where(eq(deliveryNotes.id, deliveryNoteId))
  
  // Calculate next day - handle both string and Date formats
  const dateStr = typeof noteToClose.date === 'string' 
    ? noteToClose.date.split('T')[0] 
    : new Date(noteToClose.date).toISOString().split('T')[0]
  const currentDate = new Date(dateStr + 'T12:00:00Z') // Use noon to avoid timezone issues
  currentDate.setDate(currentDate.getDate() + 1)
  const nextDay = currentDate.toISOString().split('T')[0]
  
  // Check if next day note already exists
  const existingNextNote = await db.query.deliveryNotes.findFirst({
    where: and(
      eq(deliveryNotes.reservationId, noteToClose.reservationId),
      eq(deliveryNotes.date, nextDay)
    )
  })
  
  // Create new delivery note for next day if it doesn't exist
  if (!existingNextNote) {
    await db.insert(deliveryNotes).values({
      id: nanoid(),
      reservationId: noteToClose.reservationId,
      bungalow: noteToClose.bungalow,
      guestName: noteToClose.guestName,
      date: nextDay,
      status: 'open',
      totalAr: 0,
    })
  }
  
  revalidatePath('/staff')
  revalidatePath('/')
  revalidatePath(`/dobavnice/${noteToClose.reservationId}`)
  return { success: true }
}

// Get all delivery notes for a reservation (for invoice)
export async function getDeliveryNotesForReservation(reservationId: string) {
  const notes = await db.query.deliveryNotes.findMany({
    where: eq(deliveryNotes.reservationId, reservationId),
    orderBy: [desc(deliveryNotes.date)],
  })
  
  const notesWithItems = await Promise.all(
    notes.map(async (note) => {
      const items = await db.query.deliveryNoteItems.findMany({
        where: eq(deliveryNoteItems.deliveryNoteId, note.id),
        orderBy: [asc(deliveryNoteItems.createdAt)],
      })
      return { ...note, items }
    })
  )
  
  return notesWithItems
}

// Generate invoice number
async function generateInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const existing = await db.query.invoices.findMany({
    orderBy: [desc(invoices.createdAt)],
  })
  const count = existing.length + 1
  return `INV-${year}-${String(count).padStart(4, '0')}`
}

// Create invoice from delivery notes
export async function createInvoiceForReservation(
  reservationId: string,
  staffId: string,
  exchangeRate?: number
) {
  // Get reservation details
  const reservation = await db.query.reservations.findFirst({
    where: eq(reservations.id, reservationId)
  })
  
  if (!reservation) throw new Error('Reservation not found')
  
  // Get all delivery notes for this reservation
  const notes = await getDeliveryNotesForReservation(reservationId)
  
  if (notes.length === 0) throw new Error('No delivery notes found')
  
  // Close any open delivery notes
  for (const note of notes) {
    if (note.status === 'open') {
      await closeDeliveryNote(note.id, staffId)
    }
  }
  
  // Calculate total
  const totalAr = notes.reduce((sum, n) => sum + (n.totalAr || 0), 0)
  const totalEur = exchangeRate ? totalAr / exchangeRate : null
  
  // Generate invoice number
  const invoiceNumber = await generateInvoiceNumber()
  
  // Create invoice
  const invoiceId = nanoid()
  await db.insert(invoices).values({
    id: invoiceId,
    invoiceNumber,
    reservationId,
    guestName: reservation.guestName,
    bungalow: reservation.bungalow,
    arrivalDate: reservation.arrival,
    departureDate: reservation.departure,
    totalAr,
    totalEur: totalEur?.toFixed(2),
    exchangeRate: exchangeRate?.toFixed(2),
    status: 'draft',
    createdBy: staffId,
  })
  
  // Create invoice items from delivery note items
  for (const note of notes) {
    for (const item of note.items) {
      await db.insert(invoiceItems).values({
        id: nanoid(),
        invoiceId,
        deliveryNoteId: note.id,
        deliveryNoteDate: note.date,
        productName: item.productName,
        category: item.category,
        quantity: item.quantity,
        priceAr: item.priceAr,
        totalAr: item.totalAr,
      })
    }
  }
  
  revalidatePath('/staff')
  revalidatePath('/')
  
  return { invoiceId, invoiceNumber, totalAr, totalEur }
}

// Get invoice by ID
export async function getInvoice(invoiceId: string) {
  const invoice = await db.query.invoices.findFirst({
    where: eq(invoices.id, invoiceId)
  })
  
  if (!invoice) return null
  
  const items = await db.query.invoiceItems.findMany({
    where: eq(invoiceItems.invoiceId, invoiceId),
    orderBy: [desc(invoiceItems.deliveryNoteDate)],
  })
  
  return { ...invoice, items }
}

// Get invoices for reservation
export async function getInvoicesForReservation(reservationId: string) {
  return db.query.invoices.findMany({
    where: eq(invoices.reservationId, reservationId),
    orderBy: [desc(invoices.createdAt)],
  })
}

// Mark invoice as paid
export async function markInvoiceAsPaid(invoiceId: string, paymentMethod: string) {
  await db.update(invoices)
    .set({
      status: 'paid',
      paidAt: new Date(),
      paymentMethod,
    })
    .where(eq(invoices.id, invoiceId))
  
  revalidatePath('/')
  return { success: true }
}

// Close all open delivery notes for a reservation (called on check-out)
export async function closeAllDeliveryNotesForReservation(reservationId: string) {
  const openNotes = await db.query.deliveryNotes.findMany({
    where: and(
      eq(deliveryNotes.reservationId, reservationId),
      eq(deliveryNotes.status, 'open')
    )
  })
  
  for (const note of openNotes) {
    await db.update(deliveryNotes)
      .set({ 
        status: 'closed',
        closedAt: new Date(),
      })
      .where(eq(deliveryNotes.id, note.id))
  }
  
  revalidatePath('/staff')
  revalidatePath('/dobavnice')
  return { closed: openNotes.length }
}
