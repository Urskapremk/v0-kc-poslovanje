'use server'

import { db } from '@/lib/db'
import { boats, routes, supplierPricing, excursions, excursionPricing, sellingPricing, excursionSellingPricing, lunchProviders } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { nanoid } from 'nanoid'

// ============ BOATS ============
export async function getBoats() {
  return await db.query.boats.findMany({
    where: eq(boats.active, true),
    orderBy: (boats, { asc }) => [asc(boats.name)]
  })
}

// ============ ROUTES ============
export async function getRoutes() {
  return await db.query.routes.findMany({
    where: eq(routes.active, true),
    orderBy: (routes, { asc }) => [asc(routes.name)]
  })
}

// Get only base routes for supplier pricing (no composite routes like Airport)
export async function getBaseRoutes() {
  const allRoutes = await db.query.routes.findMany({
    where: eq(routes.active, true),
    orderBy: (routes, { asc }) => [asc(routes.name)]
  })
  // Filter out routes that have baseRouteId (composite routes)
  return allRoutes.filter(r => !r.baseRouteId)
}

// ============ SUPPLIER PRICING (Transfers) ============
export async function getSupplierPricing() {
  return await db.query.supplierPricing.findMany({
    where: eq(supplierPricing.active, true)
  })
}

export async function updateSupplierPricing(boatId: string, routeId: string, priceAr: number) {
  const existing = await db.query.supplierPricing.findFirst({
    where: and(
      eq(supplierPricing.boatId, boatId),
      eq(supplierPricing.routeId, routeId)
    )
  })
  
  if (existing) {
    await db.update(supplierPricing)
      .set({ priceAr, active: true })
      .where(eq(supplierPricing.id, existing.id))
  } else {
    await db.insert(supplierPricing).values({
      id: `sp-${nanoid(8)}`,
      boatId,
      routeId,
      priceAr,
      active: true
    })
  }
  
  revalidatePath('/admin')
  return { success: true }
}

// ============ EXCURSIONS ============
export async function getExcursions() {
  return await db.query.excursions.findMany({
    where: eq(excursions.active, true),
    orderBy: (excursions, { asc }) => [asc(excursions.name)]
  })
}

export async function addExcursion(data: { name: string; description?: string; guidePriceAr?: number; entranceFeeAr?: number; lunchPriceAr?: number }) {
  await db.insert(excursions).values({
    id: `exc-${nanoid(8)}`,
    name: data.name,
    description: data.description || null,
    guidePriceAr: data.guidePriceAr || 0,
    entranceFeeAr: data.entranceFeeAr || 0,
    lunchPriceAr: data.lunchPriceAr || 0,
    active: true
  })
  revalidatePath('/admin')
  return { success: true }
}

export async function updateExcursion(id: string, data: { name?: string; description?: string; imageUrl?: string; guidePriceAr?: number; entranceFeeAr?: number; lunchPriceAr?: number }) {
  // Only update if there are values to set
  if (Object.keys(data).length === 0) {
    return { success: true }
  }
  await db.update(excursions)
    .set(data)
    .where(eq(excursions.id, id))
  
  revalidatePath('/admin')
  return { success: true }
}

export async function deleteExcursion(id: string) {
  await db.update(excursions).set({ active: false }).where(eq(excursions.id, id))
  revalidatePath('/admin')
  return { success: true }
}

// ============ EXCURSION PRICING ============
export async function getExcursionPricing() {
  return await db.query.excursionPricing.findMany({
    where: eq(excursionPricing.active, true)
  })
}

export async function updateExcursionPricing(excursionId: string, boatId: string, priceAr: number) {
  // Get excursion guide price to calculate supplier price
  const excursion = await db.query.excursions.findFirst({
    where: eq(excursions.id, excursionId)
  })
  const guidePriceAr = excursion?.guidePriceAr || 0
  // Supplier price = (boat price - guide fee) * 0.9 + guide fee
  const supplierPriceAr = Math.round((priceAr - guidePriceAr) * 0.9) + guidePriceAr

  const existing = await db.query.excursionPricing.findFirst({
    where: and(
      eq(excursionPricing.excursionId, excursionId),
      eq(excursionPricing.boatId, boatId)
    )
  })
  
  if (existing) {
    await db.update(excursionPricing)
      .set({ priceAr, supplierPriceAr, active: true })
      .where(eq(excursionPricing.id, existing.id))
  } else {
    await db.insert(excursionPricing).values({
      id: `ep-${nanoid(8)}`,
      excursionId,
      boatId,
      priceAr,
      supplierPriceAr,
      active: true
    })
  }
  
  revalidatePath('/admin')
  return { success: true }
}

// ============ SELLING PRICING (Guest prices for transfers) ============
export async function getSellingPricing() {
  return await db.query.sellingPricing.findMany({
    where: eq(sellingPricing.active, true)
  })
}

export async function updateSellingPricing(
  boatId: string, 
  routeId: string, 
  prices: { pricePax1: number; pricePax2: number; pricePax3: number; pricePax4: number; pricePax5: number; pricePax6: number }
) {
  const existing = await db.query.sellingPricing.findFirst({
    where: and(
      eq(sellingPricing.boatId, boatId),
      eq(sellingPricing.routeId, routeId)
    )
  })
  
  if (existing) {
    await db.update(sellingPricing)
      .set({ ...prices, active: true })
      .where(eq(sellingPricing.id, existing.id))
  } else {
    await db.insert(sellingPricing).values({
      id: `sell-${nanoid(8)}`,
      boatId,
      routeId,
      ...prices,
      active: true
    })
  }
  
  revalidatePath('/admin')
  return { success: true }
}

// Get routes that have guest pricing (includes composite routes like Airport)
export async function getGuestRoutes() {
  return await db.query.routes.findMany({
    where: eq(routes.active, true),
    orderBy: (routes, { asc }) => [asc(routes.name)]
  })
}

// ============ EXCURSION SELLING PRICING (Guest prices for excursions) ============
export async function getExcursionSellingPricing() {
  return await db.query.excursionSellingPricing.findMany({
    where: eq(excursionSellingPricing.active, true)
  })
}

export async function updateExcursionSellingPricing(
  excursionId: string, 
  boatId: string, 
  prices: { pricePax1: number; pricePax2: number; pricePax3: number; pricePax4: number; pricePax5: number; pricePax6: number }
) {
  const existing = await db.query.excursionSellingPricing.findFirst({
    where: and(
      eq(excursionSellingPricing.excursionId, excursionId),
      eq(excursionSellingPricing.boatId, boatId)
    )
  })
  
  if (existing) {
    await db.update(excursionSellingPricing)
      .set({ ...prices, active: true })
      .where(eq(excursionSellingPricing.id, existing.id))
  } else {
    await db.insert(excursionSellingPricing).values({
      id: `esp-${nanoid(8)}`,
      excursionId,
      boatId,
      ...prices,
      active: true
    })
  }
  
  revalidatePath('/admin')
  return { success: true }
}

// ============ LUNCH PROVIDERS (Ponudniki kosila za izlete) ============
export async function getLunchProviders() {
  return await db.query.lunchProviders.findMany({
    where: eq(lunchProviders.active, true),
    orderBy: (lunchProviders, { asc }) => [asc(lunchProviders.name)]
  })
}

export async function addLunchProvider(data: { name: string; location: string; pricePerPersonAr: number }) {
  await db.insert(lunchProviders).values({
    id: `lunch-${nanoid(8)}`,
    name: data.name,
    location: data.location,
    pricePerPersonAr: data.pricePerPersonAr,
    active: true
  })
  revalidatePath('/admin')
  return { success: true }
}

export async function updateLunchProvider(id: string, data: { name?: string; location?: string; pricePerPersonAr?: number }) {
  await db.update(lunchProviders).set(data).where(eq(lunchProviders.id, id))
  revalidatePath('/admin')
  return { success: true }
}

export async function deleteLunchProvider(id: string) {
  await db.update(lunchProviders).set({ active: false }).where(eq(lunchProviders.id, id))
  revalidatePath('/admin')
  return { success: true }
}
