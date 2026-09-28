'use server'

import { db } from '@/lib/db'
import { products, routes, staff } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { nanoid } from 'nanoid'

// ============ PRODUCTS ============

export async function getProducts() {
  const result = await db.select().from(products).orderBy(products.category, products.name)
  return result.map(p => ({
    ...p,
    priceAr: p.priceAr || 0,
    priceEur: p.priceEur ? Number(p.priceEur) : null,
  }))
}

export async function addProduct(data: {
  name: string
  category: string
  priceAr: number
  priceEur?: number
  unit?: string
  editablePrice?: boolean
  costCategory?: string
  costAr?: number | null
}) {
  await db.insert(products).values({
    id: nanoid(),
    name: data.name,
    category: data.category,
    priceAr: data.priceAr,
    priceEur: data.priceEur ? String(data.priceEur) : null,
    unit: data.unit || 'kos',
    editablePrice: data.editablePrice ?? false,
    costCategory: data.costCategory ?? 'pijaca',
    costAr: data.costAr ?? null,
    active: true,
  })
  revalidatePath('/admin')
  revalidatePath('/staff')
}

export async function updateProduct(id: string, data: Partial<{
  name: string
  category: string
  priceAr: number
  priceEur: number
  unit: string
  active: boolean
  editablePrice: boolean
  costCategory: string
  costAr: number | null
}>) {
  const updateData: Record<string, unknown> = {}
  if (data.name !== undefined) updateData.name = data.name
  if (data.category !== undefined) updateData.category = data.category
  if (data.priceAr !== undefined) updateData.priceAr = data.priceAr
  if (data.priceEur !== undefined) updateData.priceEur = data.priceEur != null ? String(data.priceEur) : null
  if (data.unit !== undefined) updateData.unit = data.unit
  if (data.active !== undefined) updateData.active = data.active
  if (data.editablePrice !== undefined) updateData.editablePrice = data.editablePrice
  if (data.costCategory !== undefined) updateData.costCategory = data.costCategory
  if (data.costAr !== undefined) updateData.costAr = data.costAr
  
  await db.update(products).set(updateData).where(eq(products.id, id))
  revalidatePath('/admin')
  revalidatePath('/staff')
}

export async function deleteProduct(id: string) {
  await db.delete(products).where(eq(products.id, id))
  revalidatePath('/admin')
  revalidatePath('/staff')
}

// ============ ROUTES (Transfers) ============

export async function getRoutes() {
  const result = await db.select().from(routes).orderBy(routes.name)
  return result.map(r => ({
    ...r,
    priceEur: r.priceEur ? Number(r.priceEur) : 0,
  }))
}

export async function addRoute(data: {
  name: string
  priceEur: number
}) {
  await db.insert(routes).values({
    id: nanoid(),
    name: data.name,
    type: 'transfer',
    priceEur: String(data.priceEur),
    active: true,
  })
  revalidatePath('/admin')
  revalidatePath('/')
}

export async function updateRoute(id: string, data: Partial<{
  name: string
  priceEur: number
  active: boolean
}>) {
  const updateData: Record<string, unknown> = {}
  if (data.name !== undefined) updateData.name = data.name
  if (data.priceEur !== undefined) updateData.priceEur = String(data.priceEur)
  if (data.active !== undefined) updateData.active = data.active
  
  await db.update(routes).set(updateData).where(eq(routes.id, id))
  revalidatePath('/admin')
  revalidatePath('/')
}

export async function deleteRoute(id: string) {
  await db.update(routes).set({ active: false }).where(eq(routes.id, id))
  revalidatePath('/admin')
  revalidatePath('/')
}

// ============ STAFF (Delavci) ============

export async function getStaff() {
  const result = await db.select().from(staff).where(eq(staff.active, true)).orderBy(staff.name)
  return result
}

export async function addStaff(data: {
  name: string
  role: string
  pin: string
}) {
  await db.insert(staff).values({
    id: `staff-${nanoid(8)}`,
    name: data.name,
    role: data.role,
    pin: data.pin,
    active: true,
  })
  revalidatePath('/admin')
  revalidatePath('/staff')
}

export async function updateStaff(id: string, data: Partial<{
  name: string
  role: string
  pin: string
  active: boolean
}>) {
  const updateData: Record<string, unknown> = {}
  if (data.name !== undefined) updateData.name = data.name
  if (data.role !== undefined) updateData.role = data.role
  if (data.pin !== undefined) updateData.pin = data.pin
  if (data.active !== undefined) updateData.active = data.active
  
  await db.update(staff).set(updateData).where(eq(staff.id, id))
  revalidatePath('/admin')
  revalidatePath('/staff')
}

export async function deleteStaff(id: string) {
  await db.update(staff).set({ active: false }).where(eq(staff.id, id))
  revalidatePath('/admin')
  revalidatePath('/staff')
}
