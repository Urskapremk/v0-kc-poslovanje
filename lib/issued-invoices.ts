// A guest invoice is issued at check-out. The printed amount follows the invoice
// page: stay in EUR, unpaid extras, separately paid excursions, charged bar
// items, then discounts. The month list uses the full charge instead, so a paid
// meal, transfer, drink, trip, massage, or guest loan is still on the row.
import { isCheckInPensionLump } from '@/lib/meal-plan'

const LODGE_OFFSET_MS = 3 * 60 * 60 * 1000

export type IssuedInvoiceOrder = {
  name?: string | null
  category?: string | null
  priceAr?: number | null
  refPriceAr?: number | null
  paymentStatus?: string | null
  isFree?: boolean | null
}

export type IssuedInvoiceBarItem = {
  productName?: string | null
  priceAr?: number | null
  quantity?: number | null
  coveredByMealPlan?: boolean | null
  isFree?: boolean | null
}

export type IssuedInvoiceAmountInput = {
  totalAmount: number
  currency?: string | null
  bookingSource?: string | null
  mealPlan?: string | null
  mealPlanPaymentStatus?: string | null
  exchangeRate: number
  orders: IssuedInvoiceOrder[]
  barItems: IssuedInvoiceBarItem[]
  discountsAr: number
  // Arrival and departure charges already stored on the transfer records.
  // EUR, not ariary. Extra transfer lines that exist only as order items stay there.
  transferEur?: number
}

export function issuedInvoiceRange(year: number, month: number) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error('Neveljavno leto ali mesec')
  }
  return {
    start: new Date(Date.UTC(year, month - 1, 1) - LODGE_OFFSET_MS),
    end: new Date(Date.UTC(year, month, 1) - LODGE_OFFSET_MS),
  }
}

export function guestInvoiceReference(reservationId: string) {
  const tail = reservationId.slice(-6).toUpperCase()
  return tail ? `KC-${new Date().getFullYear()}-${tail}` : ''
}

function paidPlan(mealPlan?: string | null, status?: string | null) {
  return String(status || '').toUpperCase() === 'PAID' ? String(mealPlan || '').toUpperCase() : ''
}

function isPaidPlanMeal(plan: string, name?: string | null) {
  if (!plan) return false
  const label = String(name || '').toLowerCase()
  const breakfast = /breakfast|zajtrk|petit[- ]d[eé]jeuner/.test(label)
  const lunch = /lunch|kosilo|d[eé]jeuner/.test(label) && !breakfast
  const dinner = /dinner|ve[cč]erj|d[iî]ner/.test(label)
  if (plan === 'FB') return breakfast || lunch || dinner
  if (plan === 'HB') return breakfast || dinner
  if (plan === 'B' || plan === 'BB') return breakfast
  return false
}

export function issuedInvoiceAmountEur(input: IssuedInvoiceAmountInput) {
  const rate = input.exchangeRate || 4800
  const plan = paidPlan(input.mealPlan, input.mealPlanPaymentStatus)
  const agency = input.bookingSource === 'Agency'
  const foreignStay = (input.currency || 'EUR').trim().toUpperCase()
  const accommodationEur = foreignStay && foreignStay !== 'EUR' ? 0 : Number(input.totalAmount || 0)
  let servicesAr = 0
  for (const item of input.orders) {
    if (item.category === 'Bivanje') continue
    const covered = (item.category === 'Prehrana' || item.category === 'Food')
      && item.paymentStatus === 'UNPAID'
      && !item.isFree
      && isPaidPlanMeal(plan, item.name)
    const status = covered ? 'PAID' : item.paymentStatus
    if (status === 'UNPAID') servicesAr += Number(item.priceAr || 0)
    else if (
      status === 'PAID'
      && !item.isFree
      && item.category === 'Izlet'
      && Number(item.refPriceAr || 0) > 0
      && !agency
    ) {
      servicesAr += Number(item.refPriceAr || 0)
    }
  }
  let barAr = 0
  for (const item of input.barItems) {
    const covered = Boolean(item.coveredByMealPlan) || (!item.isFree && isPaidPlanMeal(plan, item.productName))
    if (covered || item.isFree) continue
    barAr += Number(item.priceAr || 0) * Number(item.quantity || 0)
  }
  const grandAr = Math.max(0, Math.round(accommodationEur * rate) + servicesAr + barAr - Number(input.discountsAr || 0))
  return Math.round((grandAr / rate) * 100) / 100
}

function isStayTransferCopy(name?: string | null) {
  const label = String(name || '')
  return label.startsWith('Transfer ARRIVAL:') || label.startsWith('Transfer DEPARTURE:')
}

function chargedOrderAr(item: IssuedInvoiceOrder, plan: string, agency: boolean, transfersAlreadyCounted: boolean) {
  if (item.isFree || item.category === 'Bivanje') return 0
  // The prepaid board is already inside the stay price. The check-in lump is that same money.
  if (plan && isCheckInPensionLump(item.name)) return 0
  if (transfersAlreadyCounted && isStayTransferCopy(item.name)) return 0
  const price = Number(item.priceAr || 0)
  if (price > 0) return price
  if (item.paymentStatus !== 'PAID') return 0
  if (agency && item.category === 'Izlet') return 0
  return Number(item.refPriceAr || 0)
}

// Everything charged on the invoice, including lines the printed total shows as
// already paid, and including a guest loan. Income columns do not use this.
export function chargedInvoiceAmountEur(input: IssuedInvoiceAmountInput) {
  const rate = input.exchangeRate || 4800
  const plan = paidPlan(input.mealPlan, input.mealPlanPaymentStatus)
  const agency = input.bookingSource === 'Agency'
  const foreignStay = (input.currency || 'EUR').trim().toUpperCase()
  const accommodationEur = foreignStay && foreignStay !== 'EUR' ? 0 : Number(input.totalAmount || 0)
  const transferEur = Number(input.transferEur || 0)
  let servicesAr = 0
  for (const item of input.orders) {
    servicesAr += chargedOrderAr(item, plan, agency, transferEur > 0)
  }
  let barAr = 0
  for (const item of input.barItems) {
    const covered = Boolean(item.coveredByMealPlan) || (!item.isFree && isPaidPlanMeal(plan, item.productName))
    if (covered || item.isFree) continue
    barAr += Number(item.priceAr || 0) * Number(item.quantity || 0)
  }
  const grandAr = Math.max(0, Math.round(accommodationEur * rate) + servicesAr + barAr - Number(input.discountsAr || 0))
  return Math.round((grandAr / rate + transferEur) * 100) / 100
}
