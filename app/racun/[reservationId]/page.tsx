'use client'

import React, { useState, useRef } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import useSWR from 'swr'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, CreditCard, Banknote, Smartphone, HelpCircle, Plus, X, Check, Printer, Users, FileText, FileDown, Tag, Gift } from 'lucide-react'
import { getReservationById, getOrderItems, completeCheckout, getDashboardData, getInvoiceDiscounts, addInvoiceDiscount, deleteInvoiceDiscount } from '@/app/actions/komba'
import { getDeliveryNotesForReservation } from '@/app/actions/delivery'
import { bungalowDisplayName } from '@/lib/bungalow'

type PaymentMethod = 'CARD' | 'CASH' | 'ORANGE_MONEY' | 'OTHER'

interface PendingPayment {
  id: string
  amount: number
  method: PaymentMethod
  notes: string
}

interface InvoiceDiscount {
  id: string
  reservationId: string
  kind: string
  label: string
  amountAr: number
  createdAt: string | Date
}

interface OrderItem {
  id: string
  name: string
  category: string
  priceAr: number
  refPriceAr?: number | null
  paymentStatus: string
  paidMethod?: string | null
  paidDate?: string | null
  isFree?: boolean | null
  eventDate?: string
  createdAt?: string
}

interface DeliveryNote {
  id: string
  date: string
  status: string
  totalAr: number
  items: Array<{
    id: string
    productName: string
    category?: string | null
    quantity: number
    priceAr: number
    coveredByMealPlan?: boolean | null
    isFree?: boolean | null
  }>
}

const fetcher = async (reservationId: string) => {
  const [notes, reservation, orderItems, dashboard, discounts] = await Promise.all([
    getDeliveryNotesForReservation(reservationId),
    getReservationById(reservationId),
    getOrderItems(reservationId),
    getDashboardData(),
    getInvoiceDiscounts(reservationId),
  ])
  
  // Check if this reservation is part of a group with sharedInvoice enabled
  let allNotes = notes
  let allOrderItems = orderItems
  let groupReservations: typeof dashboard.reservations = []
  let isSharedInvoice = false
  
  if (reservation?.groupId) {
    // Find the main reservation in the group to check sharedInvoice
    const mainReservation = dashboard.reservations.find(r => r.groupId === reservation.groupId && r.isMainReservation)
    isSharedInvoice = mainReservation?.sharedInvoice || reservation?.sharedInvoice || false
    
    if (isSharedInvoice) {
      // Get all reservations in the group
      groupReservations = dashboard.reservations.filter(r => r.groupId === reservation.groupId && r.id !== reservationId)
      
      // Fetch notes and orderItems for all group reservations
      const groupData = await Promise.all(
        groupReservations.map(async (r) => {
          const [groupNotes, groupOrderItems] = await Promise.all([
            getDeliveryNotesForReservation(r.id),
            getOrderItems(r.id)
          ])
          return { 
            notes: groupNotes, 
            orderItems: groupOrderItems.map(item => ({ ...item, fromBungalow: r.bungalow?.split(';')[0]?.split('/')[0]?.trim() }))
          }
        })
      )
      
      // Combine all notes and orderItems
      allNotes = [...notes, ...groupData.flatMap(d => d.notes)]
      allOrderItems = [
        ...orderItems,
        ...groupData.flatMap(d => d.orderItems)
      ]
    }
  }
  
  return { 
    notes: allNotes, 
    reservation, 
    orderItems: allOrderItems, 
    exchangeRate: reservation?.exchangeRate || 4800,
    groupReservations,
    isSharedInvoice,
    discounts,
  }
}

const methodConfig: Record<PaymentMethod, { label: string; icon: typeof CreditCard; color: string }> = {
  CARD: { label: 'Kartica', icon: CreditCard, color: '#7fa8b8' },
  CASH: { label: 'Gotovina', icon: Banknote, color: '#8fae92' },
  ORANGE_MONEY: { label: 'Orange Money', icon: Smartphone, color: '#be6e51' },
  OTHER: { label: 'Ostalo', icon: HelpCircle, color: '#c59b5b' }
}

// Invoice language (only EN or FR - Slovenian stays in the app only)
type InvoiceLang = 'en' | 'fr'

const invoiceText: Record<InvoiceLang, Record<string, string>> = {
  en: {
    invoice: 'INVOICE',
    guest: 'Guest',
    accommodation: 'Accommodation',
    persons: 'persons',
    nights: 'nights',
    services: 'Services',
    description: 'Description',
    amount: 'Amount',
    servicesTotal: 'Services total',
    bar: 'Bar',
    date: 'Date',
    item: 'Item',
    qty: 'Qty',
    items: 'items',
    barTotal: 'Bar total',
    subtotal: 'Subtotal',
    total: 'TOTAL',
    exchangeRate: 'Exchange rate',
    payments: 'Payments',
    prepayment: 'Prepayment',
    totalPaid: 'Total paid',
    balanceDue: 'Balance due',
    paymentSpec: 'Payment details (when & how paid)',
    paidSeparatelyNote: 'Already paid separately (not included in the balance)',
    paidServices: 'Excursions / transfers (paid)',
    paid: 'Paid',
    remainingToPay: 'Remaining to pay',
    included: 'Included (half/full board)',
    complimentary: 'On House',
    onHouseTotal: 'On House total (complimentary)',
    creditRemaining: 'Credit remaining',
    thankYou: 'Thank you for your visit!',
    tagline: 'Komba Cabana — Pure nature.',
    includedBungalows: 'Included bungalows',
    sharedInvoice: 'Shared invoice',
  },
  fr: {
    invoice: 'FACTURE',
    guest: 'Client',
    accommodation: 'Hébergement',
    persons: 'personnes',
    nights: 'nuits',
    services: 'Services',
    description: 'Description',
    amount: 'Montant',
    servicesTotal: 'Total services',
    bar: 'Bar',
    date: 'Date',
    item: 'Article',
    qty: 'Qté',
    items: 'articles',
    barTotal: 'Total bar',
    subtotal: 'Sous-total',
    total: 'TOTAL',
    exchangeRate: 'Taux de change',
    payments: 'Paiements',
    prepayment: 'Acompte',
    totalPaid: 'Total payé',
    balanceDue: 'Solde dû',
    paymentSpec: 'Détail des paiements (quand et comment)',
    paidSeparatelyNote: 'Déjà payé séparément (non inclus dans le solde)',
    paidServices: 'Excursions / transferts (payés)',
    paid: 'Payé',
    remainingToPay: 'Reste à payer',
    included: 'Inclus (demi/pension complète)',
    complimentary: 'On House',
    onHouseTotal: 'Total On House (offert)',
    creditRemaining: 'Crédit restant',
    thankYou: 'Merci de votre visite !',
    tagline: 'Komba Cabana — Pure nature.',
    includedBungalows: 'Bungalows inclus',
    sharedInvoice: 'Facture commune',
  },
}

const methodLabelByLang: Record<InvoiceLang, Record<PaymentMethod, string>> = {
  en: { CARD: 'Card', CASH: 'Cash', ORANGE_MONEY: 'Orange Money', OTHER: 'Other' },
  fr: { CARD: 'Carte', CASH: 'Espèces', ORANGE_MONEY: 'Orange Money', OTHER: 'Autre' },
}

// Word-level translation for stored order item names (saved in Slovenian in the DB).
// We only translate at display time on the invoice; the stored name is never changed.
const itemWordMap: Record<InvoiceLang, Record<string, string>> = {
  en: {
    'Bivanje': 'Accommodation',
    'noci': 'nights',
    'noči': 'nights',
    'oseb': 'persons',
    'dni': 'days',
    'Skupaj': 'Total',
    'Placano': 'Paid',
    'Plačano': 'Paid',
    'kartica': 'card',
    'gotovina': 'cash',
    'nakazilo': 'transfer',
    'Zajtrk': 'Breakfast',
    'Polpenzion': 'Half Board',
    'Polni penzion': 'Full Board',
    'Kosilo': 'Lunch',
    'Vecerja': 'Dinner',
    'Večerja': 'Dinner',
    'Izlet': 'Excursion',
    'Vklj': 'Incl',
    'vstopnina': 'entrance fee',
    'kosilo': 'lunch',
  },
  fr: {
    'Bivanje': 'Hébergement',
    'noci': 'nuits',
    'noči': 'nuits',
    'oseb': 'personnes',
    'dni': 'jours',
    'Skupaj': 'Total',
    'Placano': 'Payé',
    'Plačano': 'Payé',
    'kartica': 'carte',
    'gotovina': 'espèces',
    'nakazilo': 'virement',
    'Zajtrk': 'Petit-déjeuner',
    'Polpenzion': 'Demi-pension',
    'Polni penzion': 'Pension complète',
    'Kosilo': 'Déjeuner',
    'Vecerja': 'Dîner',
    'Večerja': 'Dîner',
    'Izlet': 'Excursion',
    'Vklj': 'Incl',
    'vstopnina': "droit d'entrée",
    'kosilo': 'déjeuner',
  },
}

function translateItemName(name: string, lang: InvoiceLang): string {
  let out = name
  // Strip "Slovensko / English" dual-language meal names down to a single translated word
  // (handled below by word replacement). Replace whole words only.
  for (const [sl, tr] of Object.entries(itemWordMap[lang])) {
    out = out.replace(new RegExp(`\\b${sl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'), tr)
  }
  // Collapse "Breakfast / Breakfast" style duplicates that can appear after translating
  // dual-language meal names like "Zajtrk / Breakfast"
  out = out.replace(/\b([A-Za-zÀ-ÿ-]+)\s*\/\s*\1\b/g, '$1')
  return out
}

export default function RacunPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const reservationId = params.reservationId as string
  const viewOnly = searchParams.get('view') === 'true'
  const printRef = useRef<HTMLDivElement>(null)
  
  const { data, error, isLoading, mutate } = useSWR(
    reservationId ? `racun-${reservationId}` : null,
    () => fetcher(reservationId)
  )
  
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([])
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('CARD')
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showPrintPreview, setShowPrintPreview] = useState(viewOnly)
  const [invoiceLang, setInvoiceLang] = useState<InvoiceLang>('en')
  const [generatingPdf, setGeneratingPdf] = useState(false)
  // Print mode for the invoice:
  //  - 'full'      → complete invoice (accommodation + all services/bar)
  //  - 'noStay'    → WITHOUT accommodation (only services / bar / extras)
  //  - 'stayMeals' → accommodation + food + transfers (no bar drinks, excursions, wellness…)
  const [printMode, setPrintMode] = useState<'full' | 'noStay' | 'stayMeals'>('full')
  const [showPayments, setShowPayments] = useState(true)
  const excludeAccommodation = printMode === 'noStay'
  const onlyStayMeals = printMode === 'stayMeals'
  // Discount form state
  const [discountKind, setDiscountKind] = useState<'stay' | 'item'>('stay')
  const [discountLabel, setDiscountLabel] = useState('')
  const [discountAmount, setDiscountAmount] = useState('')
  const [addingDiscount, setAddingDiscount] = useState(false)
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a2029] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#c59b5b]"></div>
      </div>
    )
  }
  
  if (error || !data?.reservation) {
    return (
      <div className="min-h-screen bg-[#0a2029] flex items-center justify-center">
        <p className="text-white/50">Rezervacija ni najdena</p>
      </div>
    )
  }
  
  const { reservation, orderItems: loadedOrderItems, notes: loadedDeliveryNotes, exchangeRate, groupReservations, isSharedInvoice, discounts } = data

  // When the meal plan (B / HB / FB) is already paid (e.g. through the agency), the meals
  // it covers must not be charged again. Bar staff enter meals as ordinary bar lines, so
  // they are matched to the plan by name.
  const paidMealPlan = String((reservation as { mealPlanPaymentStatus?: string | null }).mealPlanPaymentStatus || '').toUpperCase() === 'PAID'
    ? String(reservation.mealPlan || '').toUpperCase()
    : ''
  const isPaidPlanMeal = (name: string | null | undefined) => {
    if (!paidMealPlan) return false
    const n = String(name || '').toLowerCase()
    const breakfast = /breakfast|zajtrk|petit[- ]d[ée]jeuner/.test(n)
    const lunch = /lunch|kosilo|d[ée]jeuner/.test(n) && !breakfast
    const dinner = /dinner|ve[cč]erj|d[iî]ner/.test(n)
    if (paidMealPlan === 'FB') return breakfast || lunch || dinner
    if (paidMealPlan === 'HB') return breakfast || dinner
    if (paidMealPlan === 'B' || paidMealPlan === 'BB') return breakfast
    return false
  }
  const orderItems = (loadedOrderItems as OrderItem[]).map((item) =>
    (item.category === 'Prehrana' || item.category === 'Food') && item.paymentStatus === 'UNPAID' && !item.isFree && isPaidPlanMeal(item.name)
      ? { ...item, paymentStatus: 'PAID' }
      : item,
  )
  const rawDeliveryNotes = (loadedDeliveryNotes as DeliveryNote[]).map((note) => ({
    ...note,
    items: note.items.map((it) =>
      !it.coveredByMealPlan && !it.isFree && isPaidPlanMeal(it.productName) ? { ...it, coveredByMealPlan: true } : it,
    ),
  }))
  const invoiceDiscounts = (discounts || []) as InvoiceDiscount[]
  
  // The invoice shows ALL services, including those scheduled for a future date
  // (e.g. tomorrow's excursion or departure transfer), so the guest sees their full bill.
  // Accommodation is shown in its own dedicated section (from reservation.totalAmount),
  // so exclude any "Bivanje" order items here to avoid double counting.
  const isAccommodation = (item: OrderItem) => item.category === 'Bivanje'
  // Food/meal categories (à la carte meals + penzion). Used by the "accommodation +
  // meals" printout, which keeps food and transfers but drops bar drinks, excursions,
  // wellness, shop, etc.
  const FOOD_CATEGORIES = new Set(['Prehrana', 'Food'])
  const isFoodOrderItem = (item: OrderItem) => FOOD_CATEGORIES.has(item.category)
  const isFoodBarItem = (it: DeliveryNote['items'][number]) => (it.category || '') === 'Food'
  // In "accommodation + meals" mode keep food AND transfers on the invoice.
  const isStayMealsItem = (item: OrderItem) => isFoodOrderItem(item) || item.category === 'Transfer'
  const isOnInvoice = (item: OrderItem) =>
    !isAccommodation(item) && (!onlyStayMeals || isStayMealsItem(item))
  const invoiceOrderItems = (orderItems as OrderItem[]).filter(isOnInvoice)
  // In "only accommodation + food" mode, keep only food lines on each delivery note so
  // bar drinks are not billed; otherwise use the notes unchanged.
  const deliveryNotes = onlyStayMeals
    ? (rawDeliveryNotes as DeliveryNote[]).map((n) => ({ ...n, items: n.items.filter(isFoodBarItem) }))
    : (rawDeliveryNotes as DeliveryNote[])

  // Excursions/transfers the guest paid separately (e.g. in advance, before arrival).
  // The user wants these to count toward the invoice TOTAL and toward Total paid, so the
  // guest sees the full picture and the Balance due stays correct. We use refPriceAr (the
  // real price kept even when the line's priceAr was zeroed on payment). Agency bookings
  // never reveal prices, so they are excluded here (kept at 0.00, off the totals).
  const isAgencyBooking = reservation.bookingSource === 'Agency'
  const isSeparatelyPaidService = (item: OrderItem) =>
    item.paymentStatus === 'PAID' &&
    !item.isFree &&
    (item.category === 'Izlet' || item.category === 'Transfer') &&
    Number(item.refPriceAr || 0) > 0 &&
    !isAgencyBooking
  const separatePaidAr = invoiceOrderItems
    .filter(isSeparatelyPaidService)
    .reduce((sum, item) => sum + Number(item.refPriceAr || 0), 0)
  const separatePaidEur = separatePaidAr / exchangeRate

  // Calculate totals. Services = unpaid items (their priceAr) + separately-paid
  // excursions/transfers (their real refPriceAr), so both flow into the TOTAL.
  const servicesTotal =
    invoiceOrderItems
      .filter((item) => item.paymentStatus === 'UNPAID')
      .reduce((sum, item) => sum + Number(item.priceAr || 0), 0) + separatePaidAr
  
  // Bar/food total. In "only accommodation + food" mode the note.totalAr still reflects
  // the whole (unfiltered) note, so recompute from the kept food items instead.
  const barTotal = (deliveryNotes as DeliveryNote[]).reduce(
    (sum, note) =>
      sum +
      note.items.reduce((s, it) => s + ((it.coveredByMealPlan || it.isFree) ? 0 : it.priceAr * it.quantity), 0),
    0,
  )

  // Total of complimentary "On House" items (not charged, shown for reference).
  // Order items: isFree line amount. Bar items: isFree and NOT meal-plan covered (priceAr × qty).
  const onHouseOrderAr = invoiceOrderItems
    .filter((item) => item.isFree)
    .reduce((sum, item) => sum + Number(item.priceAr || 0), 0)
  const onHouseBarAr = (deliveryNotes as DeliveryNote[]).reduce(
    (sum, note) =>
      sum +
      note.items
        .filter((it) => it.isFree && !it.coveredByMealPlan)
        .reduce((s, it) => s + it.priceAr * it.quantity, 0),
    0,
  )
  const onHouseTotalAr = onHouseOrderAr + onHouseBarAr

  // Group services (order items) together with the bar delivery note of the day they
  // happened, so massages, excursions, meals etc. appear inside the daily delivery note
  // instead of a separate section at the top.
  const invoiceItemDay = (i: OrderItem) => i.eventDate || (i.createdAt ? new Date(i.createdAt).toISOString().split('T')[0] : '')
  // Paid items are normally hidden, EXCEPT transfers, meals and excursions: those are
  // always shown for the record — transfers/excursions marked as paid, meals as included
  // (half/full board) — so the guest sees the full stay. Their price stays 0 (not re-charged).
  const isTransferItem = (i: OrderItem) => i.category === 'Transfer'
  const isMealItem = (i: OrderItem) => i.category === 'Prehrana'
  const isExcursionItem = (i: OrderItem) => i.category === 'Izlet'
  const shownOnInvoiceDay = (i: OrderItem) =>
    i.paymentStatus !== 'PAID' || i.isFree || isTransferItem(i) || isMealItem(i) || isExcursionItem(i)
  // A day can have MORE THAN ONE delivery note (e.g. an extra empty note). Merge all notes'
  // items per day so a later/empty note never clobbers a note that actually has items.
  const noteDay = (d: string) => (d && d.includes('T') ? d.split('T')[0] : d)
  const invoiceNoteByDate = new Map<string, DeliveryNote>()
  for (const n of deliveryNotes as DeliveryNote[]) {
    const key = noteDay(n.date)
    const existing = invoiceNoteByDate.get(key)
    if (existing) {
      invoiceNoteByDate.set(key, { ...existing, items: [...existing.items, ...n.items] })
    } else {
      invoiceNoteByDate.set(key, { ...n, date: key, items: [...n.items] })
    }
  }
  const invoiceDays = Array.from(new Set<string>([
    ...(deliveryNotes as DeliveryNote[]).map((n) => noteDay(n.date)),
    ...invoiceOrderItems.map(invoiceItemDay).filter(Boolean),
  ])).sort()
  // Accommodation (price of stay) — stored in EUR on the reservation.
  // In "brez bivanja" (without-accommodation) mode we drop the stay entirely
  // so the guest gets a separate bill for only their services / bar / extras.
  const accommodationEurFull = Number(reservation.totalAmount || 0)
  const accommodationEur = excludeAccommodation ? 0 : accommodationEurFull
  const accommodationAr = Math.round(accommodationEur * exchangeRate)
  const subtotalAr = accommodationAr + servicesTotal + barTotal
  // Stay discounts only apply when accommodation is on the invoice.
  const applicableDiscounts = excludeAccommodation
    ? invoiceDiscounts.filter((d) => d.kind !== 'stay')
    : invoiceDiscounts
  const discountTotalAr = applicableDiscounts.reduce((sum, d) => sum + (d.amountAr || 0), 0)
  const grandTotalAr = Math.max(0, subtotalAr - discountTotalAr)
  const grandTotalEur = grandTotalAr / exchangeRate
  // Credit (e.g. from a cancelled excursion) works like a discount but, unlike a
  // normal discount, any unused portion is shown to the guest as remaining credit.
  const creditAr = applicableDiscounts.filter((d) => d.kind === 'credit').reduce((sum, d) => sum + (d.amountAr || 0), 0)
  
  // Already paid (from previous payments).
  // When excluding accommodation, any prepayment that covered the stay is not part of
  // this invoice — only the surplus beyond the accommodation price applies to the extras.
  const alreadyPaidRaw = Number(reservation.amountPaid) || 0
  const alreadyPaidEur = excludeAccommodation
    ? Math.max(0, alreadyPaidRaw - accommodationEurFull)
    : alreadyPaidRaw
  // Accommodation counts as paid when the prepayment covers at least the stay price
  // (e.g. fully paid at reservation time).
  const accommodationPaid = accommodationEur > 0 && alreadyPaidEur >= accommodationEur - 0.01
  // Split of the prepayment applied to accommodation vs. what remains on the stay
  // (e.g. after extending by an extra night that is not yet paid).
  // NOTE: For agency bookings we NEVER show what the guest has paid, because we don't
  // know what the agency actually charges them — so this breakdown is hidden.
  // (isAgencyBooking is defined earlier, near the services totals.)
  const accPaidEur = excludeAccommodation ? 0 : Math.min(alreadyPaidEur, accommodationEur)
  const accRemainingEur = Math.max(0, accommodationEur - accPaidEur)
  const accommodationPartiallyPaid = !isAgencyBooking && accPaidEur > 0.01 && accRemainingEur > 0.01

  // Total the guest has paid = accommodation prepayment + separately-paid excursions/transfers.
  // Both the excursions (now in subtotal) and this paid amount rise together, so the Balance
  // due is unchanged — but TOTAL and Total paid now reflect the full picture.
  const totalPaidEur = alreadyPaidEur + separatePaidEur

  // Remaining credit = the part of the credit not needed to settle the bill.
  // "Money in" toward the bill = prepayment + separately-paid services + all discounts
  // (incl. credit). Whatever exceeds the subtotal is overpayment; up to the credit amount
  // of it is shown as remaining credit for the guest (e.g. cancelled excursion covered less).
  const prepaymentAr = Math.round(alreadyPaidEur * exchangeRate)
  const creditRemainingAr = Math.min(creditAr, Math.max(0, prepaymentAr + separatePaidAr + discountTotalAr - subtotalAr))
  
  // Pending payments total
  const pendingTotalEur = pendingPayments.reduce((sum, p) => sum + p.amount, 0)
  
  // Remaining to pay
  const remainingEur = Math.max(0, grandTotalEur - totalPaidEur - pendingTotalEur)
  
  const formatEur = (val: number) => val.toLocaleString('sl-SI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const formatAr = (val: number) => val.toLocaleString('sl-SI', { maximumFractionDigits: 0 })
  
  const handleAddPayment = () => {
    const numAmount = parseFloat(amount)
    if (isNaN(numAmount) || numAmount <= 0) return
    
    const newPayment: PendingPayment = {
      id: `pending-${Date.now()}`,
      amount: numAmount,
      method: selectedMethod,
      notes: notes
    }
    
    setPendingPayments([...pendingPayments, newPayment])
    setAmount('')
    setNotes('')
  }
  
  const handleRemovePayment = (id: string) => {
    setPendingPayments(pendingPayments.filter(p => p.id !== id))
  }
  
  const handleFillRemaining = () => {
    setAmount(remainingEur.toFixed(2))
  }
  
  const handleAddDiscount = async () => {
    const eur = parseFloat(discountAmount)
    if (isNaN(eur) || eur <= 0) return
    const amountAr = Math.round(eur * exchangeRate)
    setAddingDiscount(true)
    try {
      await addInvoiceDiscount(reservationId, discountKind, discountLabel, amountAr)
      setDiscountLabel('')
      setDiscountAmount('')
      await mutate()
    } catch (err) {
      console.error('Add discount error:', err)
      alert('Napaka pri dodajanju popusta')
    } finally {
      setAddingDiscount(false)
    }
  }
  
  const handleDeleteDiscount = async (id: string) => {
    try {
      await deleteInvoiceDiscount(id, reservationId)
      await mutate()
    } catch (err) {
      console.error('Delete discount error:', err)
    }
  }
  
  const handlePrint = () => {
    setShowPrintPreview(true)
    setTimeout(() => {
      window.print()
    }, 100)
  }
  
  const handleCompleteCheckout = async () => {
    if (pendingPayments.length === 0 && remainingEur > 0) {
      alert('Dodajte vsaj eno placilo')
      return
    }
    
    setSubmitting(true)
    try {
      await completeCheckout(reservationId, pendingPayments.map(p => ({
        amount: p.amount,
        currency: 'EUR',
        method: p.method,
        notes: p.notes || undefined
      })))
      // Show print preview - user will manually print and close
      setShowPrintPreview(true)
      setSubmitting(false)
    } catch (err) {
      console.error('Checkout error:', err)
      alert('Napaka pri zakljucevanju')
      setSubmitting(false)
    }
  }
  
  const t = invoiceText[invoiceLang]
  // Label for meals included in the guest's meal plan — reflects the ACTUAL plan
  // (breakfast / half board / full board) so guests aren't confused by "half/full board".
  const mealIncludedLabel = (() => {
    const plan = reservation.mealPlan
    if (invoiceLang === 'fr') {
      if (plan === 'B') return 'Inclus (petit-déjeuner)'
      if (plan === 'HB') return 'Inclus (demi-pension)'
      if (plan === 'FB') return 'Inclus (pension complète)'
      return 'Inclus'
    }
    if (plan === 'B') return 'Included (breakfast)'
    if (plan === 'HB') return 'Included (half board)'
    if (plan === 'FB') return 'Included (full board)'
    return 'Included'
  })()
  const dateLocale = invoiceLang === 'fr' ? 'fr-FR' : 'en-GB'
  const fmtDate = (d: string | Date) => new Date(d).toLocaleDateString(dateLocale, { day: '2-digit', month: 'short', year: 'numeric' })
  const today = new Date().toLocaleDateString(dateLocale, { day: 'numeric', month: 'long', year: 'numeric' })
  // Localize a stored (lowercase) payment method from the payments table for display.
  const paymentMethodLabel = (m?: string | null): string => {
    if (!m) return ''
    const map: Record<string, { en: string; fr: string }> = {
      card: { en: 'card', fr: 'carte' },
      cash: { en: 'cash', fr: 'espèces' },
      transfer: { en: 'bank transfer', fr: 'virement' },
      orange_money: { en: 'Orange Money', fr: 'Orange Money' },
    }
    const e = map[m.toLowerCase()]
    return e ? (invoiceLang === 'fr' ? e.fr : e.en) : m
  }
  // Note describing how/when the accommodation prepayment was made (method · date),
  // built from the recorded payments so it mirrors the excursion/transfer display.
  const accPaymentNote = ((reservation.payments || []) as { method?: string; paidAt?: string }[])
    .filter((p) => p.paidAt)
    .map((p) => [paymentMethodLabel(p.method), p.paidAt ? fmtDate(p.paidAt) : ''].filter(Boolean).join(' · '))
    .join(' · ')

  // Full payment specification: every recorded payment (accommodation prepayments) plus
  // each separately-paid service (excursions/transfers), each with date, method and amount.
  // `separate: true` marks payments made outside the running balance (excursions/transfers)
  // so they can be grouped under an explanatory note and not confused with the balance.
  type PaymentSpecRow = { label: string; methodDate: string; eur: number; separate: boolean }
  const paymentSpec: PaymentSpecRow[] = []
  // Agency bookings must NOT reveal payment details (the guest must not see how much
  // the agency paid us), so we skip the whole payment-details spec for them.
  if (!isAgencyBooking) {
    for (const p of (reservation.payments || []) as { amount: number; method?: string; paidAt?: string }[]) {
      paymentSpec.push({
        label: t.prepayment,
        methodDate: [paymentMethodLabel(p.method), p.paidAt ? fmtDate(p.paidAt) : ''].filter(Boolean).join(' · '),
        eur: Number(p.amount) || 0,
        separate: false,
      })
    }
  }
  if (!isAgencyBooking) {
    for (const i of invoiceOrderItems) {
      if (i.paymentStatus === 'PAID' && !i.isFree && Number(i.refPriceAr || 0) > 0 && (i.paidMethod || i.paidDate)) {
        paymentSpec.push({
          label: translateItemName(i.name, invoiceLang),
          methodDate: [paymentMethodLabel(i.paidMethod), i.paidDate ? fmtDate(i.paidDate) : ''].filter(Boolean).join(' · '),
          eur: Number(i.refPriceAr) / exchangeRate,
          separate: true,
        })
      }
    }
  }

  const invoiceNumber = `KC-${new Date().getFullYear()}-${reservation.id.slice(-6).toUpperCase()}`
  const nightsCount = Math.max(1, Math.round((new Date(reservation.departure).getTime() - new Date(reservation.arrival).getTime()) / (1000 * 60 * 60 * 24)))

  const handleDownloadPdf = async () => {
    if (!printRef.current) return
    setGeneratingPdf(true)
    // Track logo swap so we can always restore it (declared outside try)
    let logoEls: HTMLImageElement[] = []
    let originalLogoSrcs: string[] = []
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas-pro'),
        import('jspdf'),
      ])
      // Capture the elegant DARK invoice exactly as shown on screen (gold logo).
      // We intentionally do NOT add the light 'pdf-export' class here.
      const DARK = { r: 10, g: 15, b: 26 } // #0a2029
      const darkHex = '#0a2029'

      // The on-screen logo is the dark-brown version which is nearly invisible
      // on the dark background, so swap in the gold logo just for the capture.
      logoEls = Array.from(
        printRef.current.querySelectorAll<HTMLImageElement>('img.inv-logo'),
      )
      originalLogoSrcs = logoEls.map((el) => el.src)
      await Promise.all(
        logoEls.map(
          (el) =>
            new Promise<void>((resolve) => {
              el.src = '/images/komba-logo-gold.png'
              if (el.complete) {
                resolve()
              } else {
                el.onload = () => resolve()
                el.onerror = () => resolve()
              }
            }),
        ),
      )

      const canvas = await html2canvas(printRef.current, {
        scale: 2,
        backgroundColor: darkHex,
        useCORS: true,
      })

      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
      const pageW = pdf.internal.pageSize.getWidth()
      const pageH = pdf.internal.pageSize.getHeight()
      const imgW = pageW
      const usableH = pageH

      const cw = canvas.width
      // Max canvas pixels that fit on one printed page (keeps aspect ratio)
      const pagePxH = Math.floor((usableH * cw) / imgW)

      // Detect which canvas rows are "empty" (pure dark background) so we can
      // break there instead of slicing through a card. Sample columns densely
      // so thin card borders / rounded corners are not mistaken for background.
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!
      const sampleStep = Math.max(1, Math.floor(cw / 600))
      const tol = 8
      const isRowEmpty = (y: number): boolean => {
        const data = ctx.getImageData(0, y, cw, 1).data
        for (let x = 0; x < cw; x += sampleStep) {
          const i = x * 4
          // Any pixel not matching the dark background means content on this row
          if (
            Math.abs(data[i] - DARK.r) > tol ||
            Math.abs(data[i + 1] - DARK.g) > tol ||
            Math.abs(data[i + 2] - DARK.b) > tol
          )
            return false
        }
        return true
      }

      // A real gap between cards must be a band of consecutive blank rows.
      const minGap = Math.max(6, Math.round(8 * 2)) // ~8px at scale 2

      const positions: { start: number; height: number }[] = []
      let start = 0
      while (start < canvas.height) {
        let end = Math.min(start + pagePxH, canvas.height)
        if (end < canvas.height) {
          // Search upward from the ideal cut (max 35% back) for a whitespace
          // band, then cut in the MIDDLE of that band.
          const minEnd = start + Math.floor(pagePxH * 0.65)
          let y = end
          let cut = -1
          while (y > minEnd) {
            if (isRowEmpty(y)) {
              // Found the bottom of a blank band; find its top
              let top = y
              while (top > minEnd && isRowEmpty(top - 1)) top--
              if (y - top >= minGap) {
                cut = Math.floor((top + y) / 2)
                break
              }
              y = top - 1 // skip past this too-thin band and keep looking
            } else {
              y--
            }
          }
          if (cut > minEnd) end = cut
        }
        positions.push({ start, height: end - start })
        start = end
      }

      positions.forEach((seg, idx) => {
        const pageCanvas = document.createElement('canvas')
        pageCanvas.width = cw
        pageCanvas.height = pagePxH
        const pctx = pageCanvas.getContext('2d')!
        // Fill the whole A4 page with the dark background so trailing space
        // on the last page stays on-theme (no white gap).
        pctx.fillStyle = darkHex
        pctx.fillRect(0, 0, cw, pagePxH)
        pctx.drawImage(canvas, 0, seg.start, cw, seg.height, 0, 0, cw, seg.height)
        if (idx > 0) pdf.addPage()
        pdf.addImage(pageCanvas.toDataURL('image/jpeg', 0.98), 'JPEG', 0, 0, imgW, usableH)
      })

      pdf.save(`${invoiceNumber}-${reservation.guestName?.replace(/[^\w-]+/g, '_') || 'racun'}.pdf`)
    } catch (err) {
      console.error('[v0] PDF generation error:', err)
      alert('Napaka pri ustvarjanju PDF')
    } finally {
      // Restore the original (on-screen) logo source
      logoEls.forEach((el, i) => {
        el.onload = null
        el.onerror = null
        if (originalLogoSrcs[i]) el.src = originalLogoSrcs[i]
      })
      setGeneratingPdf(false)
    }
  }
  
  // Print Preview / Invoice
  if (showPrintPreview) {
    return (
      <>
        <style jsx global>{`
          @media screen {
            .invoice-doc {
              background: #0a2029;
              color: #fff;
            }
            .inv-card { background: rgba(255,255,255,0.02); border-color: rgba(255,255,255,0.08); }
            .inv-head { border-color: rgba(255,255,255,0.1); }
            .inv-muted { color: rgba(255,255,255,0.45); }
            .inv-sub { color: rgba(255,255,255,0.6); }
            .inv-gold { color: #c59b5b; }
            .inv-green { color: #8fae92; }
            .inv-rowline { border-color: rgba(255,255,255,0.06); }
            .inv-section-title { color: #8fae92; }
            .inv-total-bar { border-color: rgba(255,255,255,0.2); }
            .inv-pay-box { background: rgba(143,174,146,0.06); border-color: rgba(143,174,146,0.2); }
            .inv-note-icon { background: rgba(143,174,146,0.1); }
          }
          @media print {
            @page { margin: 12mm; }
            html, body { background: #fff !important; }
            .no-print { display: none !important; }
            .invoice-doc {
              background: #fff !important;
              color: #111 !important;
              min-height: 0 !important;
              padding: 0 !important;
            }
            .inv-card { background: #f8f8f8 !important; border-color: #e7e6e3 !important; }
            .inv-head { border-color: #ddd !important; }
            .inv-muted { color: #777 !important; }
            .inv-sub { color: #444 !important; }
            .inv-gold { color: #111 !important; }
            .inv-green { color: #111 !important; }
            .inv-rowline { border-color: #eee !important; }
            .inv-section-title { color: #111 !important; border-color: #ddd !important; }
            .inv-total-bar { border-color: #111 !important; }
            .inv-pay-box { background: #f4f7f5 !important; border-color: #d4dfd5 !important; }
            .inv-note-icon { background: #f1f0ef !important; }
            .inv-logo { filter: none !important; opacity: 1 !important; }
            /* Keep blocks from being split across pages */
            .inv-card,
            .inv-pay-box,
            .inv-total-bar,
            .inv-no-break { break-inside: avoid; page-break-inside: avoid; }
            table { break-inside: auto; }
            tr, td, th { break-inside: avoid; page-break-inside: avoid; }
            h2, h3 { break-after: avoid; page-break-after: avoid; }
            /* Trim large screen-only spacing so it stays compact on paper */
            .inv-footer { margin-top: 1.5rem !important; }
            /* COMPACT print mode: fit more on each page */
            .invoice-doc { font-size: 12px !important; }
            .inv-bar-list { gap: 0.4rem !important; }
            .inv-card { border-radius: 8px !important; }
            .inv-card .inv-note-icon { height: 1.5rem !important; width: 1.5rem !important; }
            .inv-card > div:first-child { padding: 0.4rem 0.75rem !important; }
            .inv-card > div:last-child { padding-top: 0.1rem !important; padding-bottom: 0.1rem !important; }
            .inv-card > div:last-child > div { padding-top: 0.2rem !important; padding-bottom: 0.2rem !important; }
            /* Smaller, more elegant item text on bar delivery notes */
            .inv-bar-item { font-size: 10px !important; line-height: 1.25 !important; }
            /* Match the smaller, elegant text in the Services table rows */
            .inv-services-table tbody td { font-size: 10px !important; line-height: 1.25 !important; }
            .inv-services-table tbody .inv-green { font-size: 9px !important; }
            /* Smaller TOTAL and PAYMENTS blocks so they don't look oversized */
            .inv-total-bar { padding-top: 0.6rem !important; margin-bottom: 1rem !important; }
            .inv-total-bar > div:first-child { font-size: 14px !important; margin-bottom: 0.1rem !important; }
            .inv-total-bar > div:last-child { font-size: 10px !important; }
            .inv-pay-box { font-size: 10px !important; }
            .inv-pay-box h3 { font-size: 10px !important; margin-bottom: 0.4rem !important; }
            .inv-pay-box > div { font-size: 10px !important; margin-bottom: 0.25rem !important; }
            /* Tighten the guest / accommodation card */
            .inv-doc-header { margin-bottom: 0.75rem !important; padding-bottom: 0.75rem !important; }
            .inv-guest-card { padding: 0.6rem 0.9rem !important; margin-bottom: 0.75rem !important; }
            .inv-guest-card .grid { gap: 0.75rem !important; }
            .inv-guest-card p { font-size: 11px !important; line-height: 1.3 !important; }
            .inv-guest-card p.text-lg { font-size: 17px !important; }
            /* Thinner divider above the Bar total so it doesn't stand out */
            .inv-bar-list + .inv-rowline { border-top-width: 0.5px !important; border-color: #ddd !important; }
            /* Tighten section spacing */
            .inv-doc-section { margin-bottom: 1rem !important; }
            h2.inv-section-title { margin-bottom: 0.5rem !important; padding-bottom: 0.3rem !important; }
            table td, table th { padding-top: 0.2rem !important; padding-bottom: 0.2rem !important; }
            .inv-pay-box { padding: 0.75rem 1rem !important; }
          }
          /* Same light styling applied when exporting to PDF (html2pdf) */
          .pdf-export, .pdf-export.invoice-doc {
            background: #fff !important;
            color: #111 !important;
          }
          .pdf-export .inv-card { background: #f8f8f8 !important; border-color: #e7e6e3 !important; }
          .pdf-export .inv-head { border-color: #ddd !important; }
          .pdf-export .inv-muted { color: #777 !important; }
          .pdf-export .inv-sub { color: #444 !important; }
          .pdf-export .inv-gold { color: #111 !important; }
          .pdf-export .inv-green { color: #111 !important; }
          .pdf-export .inv-rowline { border-color: #eee !important; }
          .pdf-export .inv-section-title { color: #111 !important; border-color: #ddd !important; }
          .pdf-export .inv-total-bar { border-color: #111 !important; }
          .pdf-export .inv-pay-box { background: #f4f7f5 !important; border-color: #d4dfd5 !important; }
          .pdf-export .inv-note-icon { background: #f1f0ef !important; }
          .pdf-export .inv-logo { filter: none !important; opacity: 1 !important; }
          .pdf-export .no-print { display: none !important; }
        `}</style>

        <div ref={printRef} className="invoice-doc min-h-screen p-5 sm:p-10 print:p-0">
          <div className="max-w-3xl mx-auto">
            {/* Header with Logo */}
            <div className="inv-doc-header inv-head flex items-start justify-between mb-8 border-b pb-6">
              <div>
                <Image
                  src="/images/komba-logo.png"
                  alt="Komba Cabana"
                  width={190}
                  height={76}
                  className="inv-logo mb-2"
                />
                <p className="inv-muted text-sm">Nosy Komba, Madagascar</p>
                <p className="inv-muted text-sm">info@kombacabana.com</p>
              </div>
              <div className="text-right">
                <h1 className="text-2xl font-bold tracking-wide">{t.invoice}</h1>
                <p className="inv-sub">#{invoiceNumber}{excludeAccommodation ? '-S' : onlyStayMeals ? '-BP' : ''}</p>
                {excludeAccommodation && (
                  <p className="inv-muted text-xs mt-1">{invoiceLang === 'fr' ? 'Extras (hors hébergement)' : 'Extras (excl. accommodation)'}</p>
                )}
                {onlyStayMeals && (
                  <p className="inv-muted text-xs mt-1">{invoiceLang === 'fr' ? 'Hébergement et repas uniquement' : 'Accommodation & meals only'}</p>
                )}
                <p className="inv-muted text-sm mt-2">{today}</p>
              </div>
            </div>

            {/* Guest Info */}
            <div className="inv-guest-card inv-card mb-8 p-5 rounded-2xl border">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="inv-muted text-[11px] uppercase tracking-wider mb-1">{t.guest}</p>
                  <p className="font-semibold text-lg">{reservation.guestName}</p>
                  {reservation.email && <p className="inv-sub text-sm">{reservation.email}</p>}
                </div>
                <div>
                  <p className="inv-muted text-[11px] uppercase tracking-wider mb-1">{t.accommodation}</p>
                  <p className="inv-gold font-semibold">{bungalowDisplayName(reservation.bungalow)}</p>
                  <p className="inv-sub text-sm">
                    {fmtDate(reservation.arrival)} — {fmtDate(reservation.departure)}
                  </p>
                  <p className="inv-sub text-sm">{nightsCount} {t.nights} · {reservation.pax} {t.persons}</p>
                </div>
              </div>
              {isSharedInvoice && groupReservations.length > 0 && (
                <div className="inv-head mt-4 pt-4 border-t">
                  <p className="inv-muted text-[11px] uppercase tracking-wider mb-1">{t.includedBungalows}</p>
                  <p className="inv-sub text-sm">
                    {reservation.bungalow?.split(';')[0]?.split('/')[0]?.trim()} + {groupReservations.map(r => r.bungalow?.split(';')[0]?.split('/')[0]?.trim()).join(' + ')}
                  </p>
                </div>
              )}
            </div>

            {/* Accommodation */}
            {accommodationEur > 0 && (
              <div className="inv-doc-section mb-7">
                <h2 className="inv-section-title inv-head font-semibold mb-3 pb-2 border-b text-sm uppercase tracking-wider">{t.accommodation}</h2>
                <table className="inv-services-table w-full text-sm">
                  <tbody>
                    <tr className={accommodationPartiallyPaid || reservation.extensionNote ? 'inv-rowline' : 'inv-rowline border-b'}>
                      <td className="py-2">
                        <span>{bungalowDisplayName(reservation.bungalow)}</span>
                        <span className="inv-muted ml-2 text-xs">{nightsCount} {t.nights}</span>
                        {accommodationPaid && <span className="inv-green ml-2 text-xs">({t.paid})</span>}
                      </td>
                      <td className="text-right py-2 tabular-nums">{formatEur(accommodationEur)} EUR</td>
                    </tr>
                    {accommodationPartiallyPaid && (
                      <tr className="inv-rowline border-b">
                        <td className="pb-2" colSpan={2}>
                          <span className="inv-green text-xs">{t.paid}: {formatEur(accPaidEur)} EUR{accPaymentNote ? ` · ${accPaymentNote}` : ''}</span>
                          <span className="inv-gold ml-3 text-xs">{t.remainingToPay}: {formatEur(accRemainingEur)} EUR</span>
                        </td>
                      </tr>
                    )}
                    {accommodationPaid && accPaymentNote && (
                      <tr className="inv-rowline border-b">
                        <td className="pb-2" colSpan={2}>
                          <span className="inv-green text-xs">{t.paid}: {formatEur(accPaidEur)} EUR · {accPaymentNote}</span>
                        </td>
                      </tr>
                    )}
                    {reservation.extensionNote && (
                      <tr className="inv-rowline border-b">
                        <td className="pb-2" colSpan={2}>
                          <span className="inv-muted text-xs italic">{reservation.extensionNote}</span>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Services & bar grouped per daily delivery note */}
            {invoiceDays.some((day) => {
              const note = invoiceNoteByDate.get(day)
              return invoiceOrderItems.some((i) => invoiceItemDay(i) === day && shownOnInvoiceDay(i)) || (note?.items.length || 0) > 0
            }) && (
              <div className="inv-doc-section mb-7">
                <h2 className="inv-section-title inv-head font-semibold mb-3 pb-2 border-b text-sm uppercase tracking-wider">{t.services}</h2>
                <div className="inv-bar-list flex flex-col gap-4">
                  {invoiceDays.map((day) => {
                    const note = invoiceNoteByDate.get(day)
                    // Že plačane postavke (npr. plačan izlet) se NE prikažejo na računu; "On House" (isFree) ostane kot info.
                    const dayItems = invoiceOrderItems.filter((i) => invoiceItemDay(i) === day && shownOnInvoiceDay(i))
                    const barItems = note?.items || []
                    if (dayItems.length === 0 && barItems.length === 0) return null
                    const servicesAr =
                      dayItems
                        .filter((i) => i.paymentStatus === 'UNPAID')
                        .reduce((s, i) => s + Number(i.priceAr || 0), 0) +
                      dayItems
                        .filter(isSeparatelyPaidService)
                        .reduce((s, i) => s + Number(i.refPriceAr || 0), 0)
                    // Exclude meal-plan-covered and complimentary items from the day total (not charged).
                    const barAr = barItems.reduce((s, it) => s + ((it.coveredByMealPlan || it.isFree) ? 0 : it.priceAr * it.quantity), 0)
                    const dayTotalAr = servicesAr + barAr
                    return (
                      <div key={note?.id || day} className="inv-card rounded-2xl border overflow-hidden">
                        {/* Day header */}
                        <div className="inv-rowline flex items-center justify-between border-b px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="inv-note-icon flex h-9 w-9 items-center justify-center rounded-lg">
                              <FileText className="inv-green h-4 w-4" />
                            </div>
                            <div>
                              <p className="font-semibold capitalize">{fmtDate(day)}</p>
                              <p className="inv-muted text-xs">{dayItems.length + barItems.length} {t.items}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="inv-green font-semibold tabular-nums">{formatEur(dayTotalAr / exchangeRate)} EUR</p>
                            <p className="inv-muted text-xs tabular-nums">{formatAr(dayTotalAr)} Ar</p>
                          </div>
                        </div>
                        {/* Day items: services (order items) + bar */}
                        <div className="px-4 py-1">
                          {dayItems.map((item) => {
                            const notCharged = item.paymentStatus === 'PAID'
                            // Separately-paid excursions/transfers are charged at their real price
                            // (refPriceAr) and counted in the total; they carry a green "Paid · method ·
                            // date" note. Other paid items (meals, On House, prepaid) stay at 0.00.
                            const separatelyPaid = isSeparatelyPaidService(item)
                            // Meals are labelled as included (half/full board); other paid items as paid.
                            const notChargedLabel = item.isFree ? t.complimentary : (isMealItem(item) ? mealIncludedLabel : t.paid)
                            const paidNote = [
                              item.paidMethod ? (methodLabelByLang[invoiceLang][item.paidMethod as PaymentMethod] || item.paidMethod) : '',
                              item.paidDate ? fmtDate(item.paidDate) : '',
                            ].filter(Boolean).join(' · ')
                            return (
                              <div key={item.id} className="inv-bar-item inv-rowline border-b py-2 last:border-b-0 text-sm">
                                <div className="flex items-center justify-between">
                                  <span className={notCharged && !separatelyPaid ? 'inv-muted' : ''}>
                                    {translateItemName(item.name, invoiceLang)}
                                    {notCharged && !separatelyPaid && (
                                      <span className="inv-green ml-2 text-xs">({notChargedLabel})</span>
                                    )}
                                  </span>
                                  <span className="tabular-nums">
                                    {separatelyPaid
                                      ? `${formatEur(Number(item.refPriceAr) / exchangeRate)} EUR`
                                      : notCharged
                                        ? '0.00 EUR'
                                        : `${formatEur(item.priceAr / exchangeRate)} EUR`}
                                  </span>
                                </div>
                                {separatelyPaid && (
                                  <div className="mt-1">
                                    <span className="inv-green text-xs">
                                      {t.paid}{paidNote ? ` · ${paidNote}` : ''}
                                    </span>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                          {barItems.map((item) => {
                            const covered = !!item.coveredByMealPlan
                            const free = !item.coveredByMealPlan && !!item.isFree
                            const notCharged = covered || free
                            return (
                              <div key={item.id} className="inv-bar-item inv-rowline flex items-center justify-between border-b py-2 last:border-b-0 text-sm">
                                <span className={notCharged ? 'inv-muted' : ''}>
                                  <span className="inv-muted">{item.quantity}x</span> {translateItemName(item.productName, invoiceLang)}
                                  {covered && <span className="inv-green ml-2 text-xs">({mealIncludedLabel})</span>}
                                  {free && <span className="inv-green ml-2 text-xs">({t.complimentary})</span>}
                                </span>
                                <span className="tabular-nums">
                                  {notCharged
                                    ? '0.00 EUR'
                                    : `${formatEur((item.priceAr * item.quantity) / exchangeRate)} EUR`}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
                {/* Services total */}
                <div className="inv-rowline flex justify-between border-t mt-3 pt-3 font-semibold text-sm">
                  <span>{t.servicesTotal}</span>
                  <span className="tabular-nums">{formatEur((servicesTotal + barTotal) / exchangeRate)} EUR</span>
                </div>
              </div>
            )}

            {/* Totals */}
            <div className="inv-total-bar border-t-2 pt-4 mb-6">
              {applicableDiscounts.length > 0 && (
                <div className="mb-2">
                  <div className="inv-muted flex justify-between text-sm mb-1">
                    <span>{t.subtotal}</span>
                    <span className="tabular-nums">{formatEur(subtotalAr / exchangeRate)} EUR</span>
                  </div>
                  {applicableDiscounts.map((d) => (
                    <div key={d.id} className="inv-discount-row flex justify-between text-sm mb-1">
                      <span>{d.label}</span>
                      <span className="tabular-nums">-{formatEur(d.amountAr / exchangeRate)} EUR</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-between text-xl font-bold mb-1">
                <span>{t.total}</span>
                <span className="tabular-nums">{formatEur(grandTotalEur)} EUR</span>
              </div>
              <div className="inv-muted flex justify-between text-sm">
                <span className="tabular-nums">{formatAr(grandTotalAr)} Ar</span>
                <span>{t.exchangeRate}: 1 EUR = {formatAr(exchangeRate)} Ar</span>
              </div>
              {onHouseTotalAr > 0 && (
                <div className="inv-green flex justify-between text-sm mt-2 pt-2 border-t">
                  <span>{t.onHouseTotal}</span>
                  <span className="tabular-nums">{formatEur(onHouseTotalAr / exchangeRate)} EUR · {formatAr(onHouseTotalAr)} Ar</span>
                </div>
              )}
              {creditRemainingAr > 0 && (
                <div className="inv-green flex justify-between text-sm mt-2 pt-2 border-t">
                  <span>{t.creditRemaining}</span>
                  <span className="tabular-nums">{formatEur(creditRemainingAr / exchangeRate)} EUR · {formatAr(creditRemainingAr)} Ar</span>
                </div>
              )}
            </div>

            {/* Payments */}
            {showPayments && (
            <div className="inv-pay-box mb-8 p-5 rounded-2xl border">
              <h3 className="inv-green font-semibold mb-3 text-sm uppercase tracking-wider">{t.payments}</h3>
              {/* Only the combined total paid is shown here (prepayment + separately-paid
                  excursions/transfers + pending). The per-payment breakdown with method and
                  date lives in the payment specification box below. */}
              <div className="inv-pay-box flex justify-between font-bold" style={{ background: 'transparent' }}>
                <span>{t.totalPaid}</span>
                <span className="tabular-nums">{formatEur(totalPaidEur + pendingTotalEur)} EUR</span>
              </div>
              {remainingEur > 0 && (
                <div className="flex justify-between font-bold mt-2 text-base">
                  <span>{t.balanceDue}</span>
                  <span className="tabular-nums">{formatEur(remainingEur)} EUR</span>
                </div>
              )}
            </div>
            )}

            {/* Payment specification: when & how each amount was paid.
                Every row here is part of Total paid (prepayment + separately-paid services). */}
            {showPayments && paymentSpec.length > 0 && (
              <div className="inv-pay-box mb-8 p-5 rounded-2xl border">
                <h3 className="inv-green font-semibold mb-3 text-sm uppercase tracking-wider">{t.paymentSpec}</h3>
                {paymentSpec.map((r, idx) => (
                  <div key={`pay-${idx}`} className="flex justify-between text-sm mb-2 gap-4">
                    <span className="inv-sub">{r.label}{r.methodDate ? ` · ${r.methodDate}` : ''}</span>
                    <span className="tabular-nums whitespace-nowrap">{formatEur(r.eur)} EUR</span>
                  </div>
                ))}
              </div>
            )}

            {/* Footer */}
            <div className="inv-footer inv-head inv-muted text-center text-sm mt-12 pt-6 border-t">
              <p>{t.thankYou} {t.tagline}</p>
            </div>
          </div>

          {/* Action buttons - no print */}
          <div className="no-print fixed top-4 right-4 flex items-center gap-2">
            {/* Language toggle EN / FR */}
            <div className="flex items-center rounded-lg overflow-hidden border border-white/15 bg-white/5">
              <button
                onClick={() => setInvoiceLang('en')}
                className={`px-3 py-2 text-sm font-medium transition-colors ${invoiceLang === 'en' ? 'bg-[#c59b5b] text-gray-900' : 'text-white/60 hover:text-white'}`}
              >
                EN
              </button>
              <button
                onClick={() => setInvoiceLang('fr')}
                className={`px-3 py-2 text-sm font-medium transition-colors ${invoiceLang === 'fr' ? 'bg-[#c59b5b] text-gray-900' : 'text-white/60 hover:text-white'}`}
              >
                FR
              </button>
            </div>
            {/* Print mode: full invoice / without accommodation / accommodation + meals only */}
            <div className="flex items-center rounded-lg overflow-hidden border border-white/15 bg-white/5">
              <button
                onClick={() => setPrintMode('full')}
                className={`px-3 py-2 text-sm font-medium transition-colors ${printMode === 'full' ? 'bg-[#c59b5b] text-gray-900' : 'text-white/70 hover:text-white'}`}
                title="Poln račun (bivanje in vse storitve)"
              >
                Poln račun
              </button>
              <button
                onClick={() => setPrintMode('noStay')}
                className={`px-3 py-2 text-sm font-medium transition-colors border-l border-white/15 ${printMode === 'noStay' ? 'bg-[#c59b5b] text-gray-900' : 'text-white/70 hover:text-white'}`}
                title="Samo dodatne storitve (brez cene bivanja)"
              >
                Brez bivanja
              </button>
              <button
                onClick={() => setPrintMode('stayMeals')}
                className={`px-3 py-2 text-sm font-medium transition-colors border-l border-white/15 ${printMode === 'stayMeals' ? 'bg-[#c59b5b] text-gray-900' : 'text-white/70 hover:text-white'}`}
                title="Bivanje, prehrana in prevozi (brez bara in izletov)"
              >
                Bivanje + prehrana + transport
              </button>
            </div>
            <button
              onClick={() => setShowPayments(v => !v)}
              aria-pressed={showPayments}
              className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${showPayments ? 'border-[#8fae92]/50 bg-[#8fae92]/15 text-[#8fae92]' : 'border-white/15 bg-white/5 text-white/50 hover:text-white'}`}
              title="Prikaži ali skrij plačila in specifikacijo plačil na računu"
            >
              {showPayments ? 'Plačila: vklop' : 'Plačila: izklop'}
            </button>
            <button
              onClick={handleDownloadPdf}
              disabled={generatingPdf}
              className="px-4 py-2 bg-[#7fa8b8] text-gray-900 rounded-lg hover:bg-[#7fc1db] font-medium flex items-center gap-2 disabled:opacity-60"
            >
              {generatingPdf ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
              ) : (
                <FileDown className="h-4 w-4" />
              )}
              PDF
            </button>
            <button
              onClick={() => window.print()}
              className="px-4 py-2 bg-[#c59b5b] text-gray-900 rounded-lg hover:bg-[#d6ae7d] font-medium flex items-center gap-2"
            >
              <Printer className="h-4 w-4" />
              Natisni
            </button>
            {!viewOnly && (
              <button
                onClick={() => router.push('/arhiv')}
                className="px-4 py-2 bg-[#8fae92] text-gray-900 rounded-lg hover:bg-[#769f7a] font-medium"
              >
                Končano
              </button>
            )}
            {viewOnly && (
              <button
                onClick={() => {
                  // Opened in a new tab via window.open() (e.g. "Predogled računa") -> close the tab.
                  if (typeof window !== 'undefined' && window.opener && !window.opener.closed) {
                    window.close()
                    return
                  }
                  // Opened in the same tab (e.g. from the archive) -> go back to the archive.
                  router.push('/arhiv')
                }}
                className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 font-medium"
              >
                Zapri
              </button>
            )}
          </div>
        </div>
      </>
    )
  }
  
  return (
    <div className="min-h-screen bg-[#0a2029] text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0a2029]/95 backdrop-blur-sm border-b border-white/10">
        <div className="px-4 py-4 flex items-center justify-between">
          <Link href={`/dobavnice/${reservationId}`} className="flex items-center gap-2 text-white/60 hover:text-white">
            <ArrowLeft className="h-5 w-5" />
            <span>Nazaj</span>
          </Link>
          <h1 className="text-lg font-semibold">Zaključi račun</h1>
          <button onClick={handlePrint} className="p-2 rounded-lg hover:bg-white/10">
            <Printer className="h-5 w-5 text-white/60" />
          </button>
        </div>
      </div>
      
      <div className="p-4 max-w-2xl mx-auto space-y-6">
        {/* Logo */}
        <div className="flex justify-center py-4">
          <Image 
            src="/images/komba-logo.png" 
            alt="Komba Cabana" 
            width={180} 
            height={72}
            className="opacity-80"
          />
        </div>
        
        {/* Guest Info */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[#c59b5b] font-bold text-lg">{bungalowDisplayName(reservation.bungalow)}</p>
              <p className="text-white/60 text-sm">{reservation.guestName}</p>
              <p className="text-white/40 text-xs mt-1">
                {new Date(reservation.arrival).toLocaleDateString('sl-SI')} - {new Date(reservation.departure).toLocaleDateString('sl-SI')} | {reservation.pax} oseb
              </p>
            </div>
            {isSharedInvoice && groupReservations.length > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/20 border border-purple-500/30">
                <Users className="h-3.5 w-3.5 text-purple-300" />
                <span className="text-xs font-medium text-purple-300">Skupna</span>
              </div>
            )}
          </div>
          {isSharedInvoice && groupReservations.length > 0 && (
            <div className="mt-3 pt-3 border-t border-white/10">
              <p className="text-[10px] text-white/40 mb-1">Vključeni bungalovi:</p>
              <p className="text-xs text-purple-300">
                {reservation.bungalow?.split(';')[0]?.split('/')[0]?.trim()} + {groupReservations.map(r => r.bungalow?.split(';')[0]?.split('/')[0]?.trim()).join(' + ')}
              </p>
            </div>
          )}
        </div>
        
        {/* Invoice Summary */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 bg-white/[0.02]">
            <p className="text-sm font-medium text-white/70 uppercase tracking-wider">Povzetek računa</p>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-white/60">Storitve (za plačilo)</span>
              <span className="text-white">{formatEur(servicesTotal / exchangeRate)} EUR</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/60">Bar</span>
              <span className="text-white">{formatEur(barTotal / exchangeRate)} EUR</span>
            </div>
            {invoiceDiscounts.map((d) => (
              <div key={d.id} className="flex justify-between text-sm text-[#8fae92]">
                <span className="flex items-center gap-1.5">
                  {d.kind === 'item' ? <Gift className="h-3.5 w-3.5" /> : <Tag className="h-3.5 w-3.5" />}
                  {d.label}
                </span>
                <span>-{formatEur(d.amountAr / exchangeRate)} EUR</span>
              </div>
            ))}
            <div className="border-t border-white/10 pt-3 flex justify-between">
              <span className="text-white font-medium">Skupaj</span>
              <div className="text-right">
                <p className="text-[#7fa8b8] font-bold text-lg">{formatEur(grandTotalEur)} EUR</p>
                <p className="text-white/40 text-xs">{formatAr(grandTotalAr)} Ar</p>
              </div>
            </div>
            {alreadyPaidEur > 0 && (
              <div className="flex justify-between text-sm text-[#8fae92]">
                <span>Že plačano</span>
                <span>-{formatEur(alreadyPaidEur)} EUR</span>
              </div>
            )}
            {separatePaidEur > 0 && (
              <div className="flex justify-between text-sm text-[#8fae92]">
                <span>Plačani izleti / transferji</span>
                <span>-{formatEur(separatePaidEur)} EUR</span>
              </div>
            )}
            {pendingTotalEur > 0 && (
              <div className="flex justify-between text-sm text-[#c59b5b]">
                <span>Dodano plačilo</span>
                <span>-{formatEur(pendingTotalEur)} EUR</span>
              </div>
            )}
            <div className="border-t border-white/10 pt-3 flex justify-between">
              <span className="text-white font-semibold">Za plačilo</span>
              <span className={`font-bold text-xl ${remainingEur <= 0 ? 'text-[#8fae92]' : 'text-red-400'}`}>
                {formatEur(remainingEur)} EUR
              </span>
            </div>
          </div>
        </div>
        
        {/* Discounts (editable, not in view-only) */}
        {!viewOnly && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10 bg-white/[0.02]">
              <p className="text-sm font-medium text-white/70 uppercase tracking-wider">Popusti</p>
            </div>
            <div className="p-4 space-y-4">
              {/* Existing discounts */}
              {invoiceDiscounts.length > 0 && (
                <div className="space-y-2">
                  {invoiceDiscounts.map((d) => (
                    <div key={d.id} className="flex items-center justify-between rounded-xl bg-white/[0.03] border border-white/10 px-3 py-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#8fae92]/15">
                          {d.kind === 'item' ? <Gift className="h-4 w-4 text-[#8fae92]" /> : <Tag className="h-4 w-4 text-[#8fae92]" />}
                        </div>
                        <div>
                          <p className="text-white text-sm font-medium">{d.label}</p>
                          <p className="text-white/40 text-xs">{d.kind === 'item' ? 'Brezplačna postavka' : 'Popust na bivanje'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[#8fae92] text-sm font-medium">-{formatEur(d.amountAr / exchangeRate)} EUR</span>
                        <button onClick={() => handleDeleteDiscount(d.id)} className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-red-400">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Kind toggle */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setDiscountKind('stay')}
                  className={`p-3 rounded-xl border text-center transition-all flex items-center justify-center gap-2 ${discountKind === 'stay' ? 'border-white/30 bg-white/10 text-white' : 'border-white/10 bg-white/[0.02] text-white/50 hover:bg-white/[0.05]'}`}
                >
                  <Tag className="h-4 w-4" />
                  <span className="text-sm">Popust na bivanje</span>
                </button>
                <button
                  onClick={() => setDiscountKind('item')}
                  className={`p-3 rounded-xl border text-center transition-all flex items-center justify-center gap-2 ${discountKind === 'item' ? 'border-white/30 bg-white/10 text-white' : 'border-white/10 bg-white/[0.02] text-white/50 hover:bg-white/[0.05]'}`}
                >
                  <Gift className="h-4 w-4" />
                  <span className="text-sm">Brezplačna postavka</span>
                </button>
              </div>

              {/* Label */}
              <input
                type="text"
                value={discountLabel}
                onChange={(e) => setDiscountLabel(e.target.value)}
                placeholder={discountKind === 'item' ? 'Npr. Brezplačna večerja' : 'Npr. Popust na bivanje'}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-white/30"
              />

              {/* Amount */}
              <div className="relative">
                <input
                  type="number"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(e.target.value)}
                  placeholder="Znesek popusta"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-white/30"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40">EUR</span>
              </div>

              <button
                onClick={handleAddDiscount}
                disabled={addingDiscount || !discountAmount || parseFloat(discountAmount) <= 0}
                className="w-full py-3 rounded-xl bg-[#8fae92]/20 text-[#8fae92] font-medium flex items-center justify-center gap-2 hover:bg-[#8fae92]/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="h-5 w-5" />
                Dodaj popust
              </button>
            </div>
          </div>
        )}
        
        {/* Payment Method Selection */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 bg-white/[0.02]">
            <p className="text-sm font-medium text-white/70 uppercase tracking-wider">Dodaj plačilo</p>
          </div>
          <div className="p-4 space-y-4">
            {/* Method buttons */}
            <div className="grid grid-cols-4 gap-2">
              {(Object.entries(methodConfig) as [PaymentMethod, typeof methodConfig[PaymentMethod]][]).map(([method, config]) => {
                const Icon = config.icon
                const isSelected = selectedMethod === method
                return (
                  <button
                    key={method}
                    onClick={() => setSelectedMethod(method)}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      isSelected 
                        ? 'border-white/30 bg-white/10' 
                        : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05]'
                    }`}
                  >
                    <Icon 
                      className="h-6 w-6 mx-auto mb-1" 
                      style={{ color: isSelected ? config.color : 'rgba(255,255,255,0.4)' }}
                    />
                    <p className={`text-xs ${isSelected ? 'text-white' : 'text-white/50'}`}>{config.label}</p>
                  </button>
                )
              })}
            </div>
            
            {/* Amount input */}
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Znesek"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-white/30"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40">EUR</span>
              </div>
              <button
                onClick={handleFillRemaining}
                className="px-4 py-3 rounded-xl bg-[#7fa8b8]/20 text-[#7fa8b8] text-sm font-medium hover:bg-[#7fa8b8]/30"
              >
                Preostanek
              </button>
            </div>
            
            {/* Notes (optional) */}
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Opomba (opcijsko)"
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-white/30"
            />
            
            {/* Add button */}
            <button
              onClick={handleAddPayment}
              disabled={!amount || parseFloat(amount) <= 0}
              className="w-full py-3 rounded-xl bg-[#8fae92]/20 text-[#8fae92] font-medium flex items-center justify-center gap-2 hover:bg-[#8fae92]/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="h-5 w-5" />
              Dodaj plačilo
            </button>
          </div>
        </div>
        
        {/* Pending Payments List */}
        {pendingPayments.length > 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10 bg-white/[0.02]">
              <p className="text-sm font-medium text-white/70 uppercase tracking-wider">Dodana pla��ila</p>
            </div>
            <div className="divide-y divide-white/5">
              {pendingPayments.map((payment) => {
                const config = methodConfig[payment.method]
                const Icon = config.icon
                return (
                  <div key={payment.id} className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: config.color + '20' }}
                      >
                        <Icon className="h-5 w-5" style={{ color: config.color }} />
                      </div>
                      <div>
                        <p className="text-white font-medium">{formatEur(payment.amount)} EUR</p>
                        <p className="text-white/40 text-sm">{config.label}{payment.notes ? ` • ${payment.notes}` : ''}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemovePayment(payment.id)}
                      className="p-2 rounded-lg hover:bg-red-500/20 text-white/30 hover:text-red-400"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}
        
        {/* Complete Button */}
        <button
          onClick={handleCompleteCheckout}
          disabled={submitting || (pendingPayments.length === 0 && remainingEur > 0)}
          className={`w-full py-4 rounded-2xl font-semibold text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
            remainingEur <= 0 || pendingPayments.length > 0
              ? 'bg-gradient-to-r from-[#8fae92] to-[#608464] text-white hover:opacity-90'
              : 'bg-white/10 text-white/30 cursor-not-allowed'
          }`}
        >
          {submitting ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
          ) : (
            <>
              <Check className="h-5 w-5" />
              Zaključi račun
            </>
          )}
        </button>
        
        {remainingEur > 0 && pendingPayments.length === 0 && (
          <p className="text-center text-white/40 text-sm">Dodajte plačilo za nadaljevanje</p>
        )}
      </div>
    </div>
  )
}
