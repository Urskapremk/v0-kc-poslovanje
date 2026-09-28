'use server'

import { db } from '@/lib/db'
import { reservations, guestReplies, boats, routes, sellingPricing, products, excursions, excursionSellingPricing, lunchProviders } from '@/lib/db/schema'
import { eq, inArray } from 'drizzle-orm'
import { MEAL_PRODUCT_IDS } from '@/lib/meal-plan'
import { generateText } from 'ai'
import { getExchangeRate } from './komba'
import { OFFER_EXCURSIONS } from '@/lib/excursion-offer'
import { buildReplyHtml } from '@/lib/guest-reply-html'
import { logSentEmail } from './sent-emails'

function getPublicBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
  return 'https://www.kombacabana.app'
}

const MEAL_PLAN_LABEL: Record<string, string> = {
  B: 'Breakfast only',
  HB: 'Half board (breakfast + dinner)',
  FB: 'Full board (breakfast + lunch + dinner)',
}

// Real group size for pricing. reservation.pax can be under-filled (e.g. 1 while a
// second guest is named), so take the largest of pax / adults+children / named guests.
type PaxLike = {
  pax?: number | null
  adults?: number | null
  children?: number | null
  guestName?: string | null
  secondGuestName?: string | null
  thirdGuestName?: string | null
  fourthGuestName?: string | null
}
function computeEffectivePax(res: PaxLike): number {
  const named = [res.guestName, res.secondGuestName, res.thirdGuestName, res.fourthGuestName]
    .filter(n => typeof n === 'string' && n.trim().length > 0).length
  const adultsKids = (Number(res.adults) || 0) + (Number(res.children) || 0)
  return Math.min(Math.max(Number(res.pax) || 1, adultsKids, named, 1), 6)
}

function nightsBetween(arrival?: string | null, departure?: string | null): number {
  if (!arrival || !departure) return 0
  const a = new Date(arrival + 'T00:00:00Z').getTime()
  const d = new Date(departure + 'T00:00:00Z').getTime()
  if (isNaN(a) || isNaN(d) || d <= a) return 0
  return Math.round((d - a) / 86400000)
}

// Build a compact, factual context block for the model from data we actually hold.
// Everything the model is allowed to state must appear here; it must not invent prices.
async function buildContext(reservationId: string): Promise<{ context: string; guestName: string; email: string; bungalow: string } | { error: string }> {
  const rows = await db.select().from(reservations).where(eq(reservations.id, reservationId)).limit(1)
  const res = rows[0]
  if (!res) return { error: 'Rezervacija ni najdena.' }

  const nights = nightsBetween(res.arrival as string, res.departure as string)
  const mealPlan = (res.mealPlan as string) || ''
  const mealLabel = MEAL_PLAN_LABEL[mealPlan] || 'not selected yet'
  const totalAmount = res.totalAmount ? Number(res.totalAmount) : null
  const amountPaid = res.amountPaid ? Number(res.amountPaid) : 0
  const currency = (res.currency as string) || 'EUR'
  const remaining = totalAmount != null ? Math.max(0, totalAmount - amountPaid) : null

  const excList = OFFER_EXCURSIONS.map(e => `- ${e.title} (${e.duration})`).join('\n')

  // Transfer prices ALWAYS come from the Citadel boat price list (per person, from selling_pricing).
  // Total for this guest = pricePax{pax} × pax. This is the real system price, never invented.
  const pax = computeEffectivePax(res as PaxLike)
  // Meal prices ALWAYS come from the cenik (products table), never invented.
  let mealPriceLines: string[] = []
  try {
    const ids = [MEAL_PRODUCT_IDS.breakfast, MEAL_PRODUCT_IDS.lunch, MEAL_PRODUCT_IDS.dinner]
    const rows = await db
      .select({ id: products.id, name: products.name, eur: products.priceEur })
      .from(products)
      .where(inArray(products.id, ids))
    const eurOf = (id: string) => {
      const v = rows.find(r => r.id === id)?.eur
      return v != null ? Math.round(Number(v)) : null
    }
    const label = (id: string, en: string) => {
      const e = eurOf(id)
      return e != null ? `- ${en}: ${e} EUR` : ''
    }
    mealPriceLines = [
      label(MEAL_PRODUCT_IDS.breakfast, 'Breakfast'),
      label(MEAL_PRODUCT_IDS.lunch, 'Lunch'),
      label(MEAL_PRODUCT_IDS.dinner, 'Dinner'),
    ].filter(Boolean)
  } catch {
    /* če cenika ni, cene obrokov izpustimo */
  }

  const lines: string[] = [
    `GUEST: ${res.guestName}${res.guestTitle ? ` (${res.guestTitle})` : ''}`,
    res.nationality ? `NATIONALITY: ${res.nationality}` : '',
    `STAY: ${res.arrival} to ${res.departure} (${nights} night${nights === 1 ? '' : 's'})`,
    `GUESTS: ${pax} person(s)`,
    `BUNGALOW: ${res.bungalow}`,
    `MEAL PLAN: ${mealLabel}`,
    totalAmount != null ? `PRICE: total ${totalAmount} ${currency}, paid ${amountPaid} ${currency}, remaining ${remaining} ${currency}` : `PRICE: not set in system`,
    '',
    'PAYMENT OPTIONS (Komba Cabana) — these are the ONLY accepted methods, never mention bank transfer:',
    '1. Cash on arrival (EUR).',
    '2. By card via a secure payment link we send you (pay online with your credit/debit card).',
    '3. Via Revolut to our Orange Money account.',
    '- All three options are available; the guest may choose whichever suits them.',
    '',
    'AIRPORT / PORT TRANSFER:',
    '- We organize the transfer from Nosy Be (airport Fascene or the port) to the lodge.',
    '- Typical arrival: taxi from the airport to the port, then our boat across to Nosy Komba.',
    '- IMPORTANT: do NOT quote or invent any transfer price. Reception adds the exact price at the bottom of this reply using the price calculator. If the guest asks the cost, say you are happy to arrange it and that the exact price is shown below in this message. NEVER say the price will be "confirmed by reception" or confirmed later — the price is always included here.',
    '- Once the guest confirms the transfer, tell them they will receive a transfer voucher by email with all the details.',
    '',
    'MEALS / PENSION:',
    '- ALWAYS recommend HALF BOARD (breakfast + dinner) as the best option, because on excursion days lunch is usually taken elsewhere (at the excursion), so full board lunches would go to waste.',
    '- Emphasize that we are flexible with meals: the guest does NOT have to commit in advance and can decide day by day; meals are simply paid at check-out.',
    mealPriceLines.length ? 'MEAL PRICES (per person, from our price list — quote these):' : '',
    ...mealPriceLines,
    '',
    'EXCURSIONS WE CAN ORGANIZE (describe them and their highlights when asked):',
    excList,
    '- IMPORTANT: do NOT quote or invent any excursion price. Reception adds the exact price at the bottom of this reply using the price calculator. If the guest asks the cost, say you are happy to arrange it and that the exact price is shown below in this message. NEVER say the price will be "confirmed by reception" or confirmed later — the price is always included here.',
    '- WHENEVER the guest asks about tours/activities ON Nosy Komba (our own island), ALWAYS also recommend the "Ampangorina Maki Park" trip: a visit to the lemur (Maki) park in Ampangorina village, including lunch. It is a half-day trip right here on Nosy Komba.',
    '- WHALE SHARKS: if the guest asks about whale sharks (or swimming/snorkeling with them), ALWAYS recommend our "Nosy Iranja" full-day excursion. Whale sharks are most often seen on the way to and around Nosy Iranja (in season), so this is the best trip to combine a beautiful island day with the chance to see whale sharks. Do NOT recommend Nosy Sakatia/Nosy Tanikely for whale sharks. Sightings are seasonal and never guaranteed, so phrase it as a good chance, not a certainty.',
    '',
    'SCUBA DIVING:',
    '- We do NOT run scuba diving ourselves. ALWAYS tell the guest to contact the dive center directly at https://nosykombaplongee.com/english/index.html',
    '- They should arrange available dates and discuss their experience level directly with the dive center.',
  ].filter(Boolean)

  return {
    context: lines.join('\n'),
    guestName: (res.guestName as string) || 'Guest',
    email: (res.email as string) || '',
    bungalow: (res.bungalow as string) || '',
  }
}

// Generate an English draft reply that answers ONLY the questions the guest asked,
// grounded strictly in the context. Prices that are not in the context are deferred
// to reception rather than invented.
export async function generateGuestReply(
  reservationId: string,
  guestMessage: string,
): Promise<{ reply?: string; error?: string }> {
  const built = await buildContext(reservationId)
  if ('error' in built) return { error: built.error }
  if (!guestMessage.trim()) return { error: 'Prilepite gostovo sporočilo.' }

  const system = [
    'You are the reception team of Komba Cabana Lodge on Nosy Komba, Madagascar.',
    'Write a warm, professional email reply to the guest, in ENGLISH, regardless of the language of their message.',
    'Answer ONLY the questions the guest actually asked. Address each question clearly, in the order asked.',
    'Ground every factual statement in the CONTEXT below. Never invent prices, dates or figures.',
    'For transfer and excursion prices, do NOT guess: reception adds the exact price at the bottom of this reply. Tell the guest the exact price is shown below in this message, and NEVER write that a price will be "confirmed by reception" or confirmed later.',
    'Be concise and friendly. Open with "Dear <first name>," and close with a warm sign-off from "The Komba Cabana Team".',
    'Do not use markdown, headings or bullet symbols like *; a plain readable email with short paragraphs (a simple dash list is fine).',
  ].join('\n')

  const prompt = `CONTEXT (facts you may use):\n${built.context}\n\n---\nGUEST MESSAGE (reply to this):\n${guestMessage.trim()}`

  try {
    const { text } = await generateText({
      model: 'openai/gpt-4.1',
      system,
      prompt,
    })
    return { reply: text.trim() }
  } catch (e) {
    return { error: `Napaka pri generiranju: ${(e as Error).message}` }
  }
}

// Persist the (edited) reply so it can be shared via a public link.
export async function saveGuestReply(
  reservationId: string,
  replyText: string,
  guestMessage: string,
  internalNotes?: string,
): Promise<{ success: boolean; url?: string; error?: string }> {
  if (!replyText.trim()) return { success: false, error: 'Odgovor je prazen.' }
  try {
    const notes = internalNotes ?? null
    await db
      .insert(guestReplies)
      .values({ id: reservationId, reservationId, replyText, guestMessage, internalNotes: notes })
      .onConflictDoUpdate({
        target: guestReplies.id,
        set: { replyText, guestMessage, internalNotes: notes, updatedAt: new Date() },
      })
    return { success: true, url: `${getPublicBaseUrl()}/odgovor/${reservationId}` }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// Read the stored reply for the public page. `internalNotes` is reception-only (never shown to guest).
export async function getGuestReply(reservationId: string): Promise<{ guestName: string; replyText: string; guestMessage: string; internalNotes: string; updatedAt: string } | null> {
  const rows = await db.select().from(guestReplies).where(eq(guestReplies.id, reservationId)).limit(1)
  const row = rows[0]
  if (!row) return null
  const resRows = await db.select({ guestName: reservations.guestName }).from(reservations).where(eq(reservations.id, reservationId)).limit(1)
  return {
    guestName: (resRows[0]?.guestName as string) || 'Guest',
    replyText: row.replyText,
    guestMessage: row.guestMessage || '',
    internalNotes: row.internalNotes || '',
    updatedAt: (row.updatedAt instanceof Date ? row.updatedAt : new Date(row.updatedAt as unknown as string)).toISOString(),
  }
}

// Which excursion photo(s) the reply talks about — matched by a distinctive word
// of the excursion name appearing in the reply text. Used to attach the image
// that belongs to the excursion (email + public page).
const EXC_NAME_STOPWORDS = new Set(['nosy', 'island', 'excursion', 'fanja', 'grande', 'terre', 'komba', 'park'])
export async function getReplyExcursionImages(replyText: string): Promise<{ name: string; url: string }[]> {
  const text = (replyText || '').toLowerCase()
  if (!text.trim()) return []
  try {
    const rows = await db.select({ name: excursions.name, url: excursions.imageUrl }).from(excursions)
    // For each excursion, the distinctive words of its name that appear in the reply.
    const cand = rows
      .map(r => {
        const url = (r.url as string) || ''
        const tokens = (r.name as string).toLowerCase().split(/[^a-zà-ÿ]+/i).filter(t => t.length >= 5 && !EXC_NAME_STOPWORDS.has(t))
        const matched = tokens.filter(t => text.includes(t))
        return { name: r.name as string, url, matched }
      })
      .filter(c => c.url && c.matched.length > 0)
      // Prefer the most specific match: fewest matched words, then shortest name.
      .sort((a, b) => a.matched.length - b.matched.length || a.name.length - b.name.length)

    const claimed = new Set<string>()
    const seenUrl = new Set<string>()
    const out: { name: string; url: string }[] = []
    for (const c of cand) {
      // Skip excursions whose matching words are all already represented by another image
      // (avoids showing three near-duplicate "Tanikely" photos for one mention).
      if (c.matched.every(t => claimed.has(t))) continue
      if (seenUrl.has(c.url)) continue
      seenUrl.add(c.url)
      c.matched.forEach(t => claimed.add(t))
      out.push({ name: c.name, url: c.url })
    }
    return out
  } catch {
    return []
  }
}

// Send the reply as a branded email to the guest.
export async function sendGuestReply(
  reservationId: string,
  replyText: string,
  toEmail?: string,
): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { success: false, error: 'E-pošta še ni nastavljena (manjka RESEND_API_KEY).' }
  if (!replyText.trim()) return { success: false, error: 'Odgovor je prazen.' }

  const built = await buildContext(reservationId)
  if ('error' in built) return { success: false, error: built.error }
  const to = (toEmail || built.email || '').trim()
  if (!to) return { success: false, error: 'Gost nima vpisanega email naslova.' }

  const images = await getReplyExcursionImages(replyText)
  const html = buildReplyHtml(built.guestName, replyText, getPublicBaseUrl(), images)
  const from = process.env.EMAIL_FROM || 'Komba Cabana <info@kombacabana.com>'
  const subject = 'Your questions — Komba Cabana'

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, html }),
    })
    if (!resp.ok) {
      const detail = await resp.text()
      return { success: false, error: `Pošiljanje ni uspelo: ${detail.slice(0, 200)}` }
    }
    await logSentEmail({ reservationId, type: 'guest-reply', recipient: to, subject, guestName: built.guestName, bungalow: built.bungalow })
    return { success: true }
  } catch (e) {
    return { success: false, error: `Napaka pri pošiljanju: ${(e as Error).message}` }
  }
}

// Data for the in-reply excursion price calculator (same source as the app's
// "Izlet – kalkulator"): excursions, per-excursion boat prices, lunch providers,
// exchange rate, and the reservation's effective pax (prefilled in the UI).
export type ExcursionCalcData = {
  rate: number
  pax: number
  excursions: { id: string; name: string; entranceFeeAr: number }[]
  pricing: { excursionId: string; boatId: string; boatName: string; pricePax: number[] }[]
  lunch: { id: string; name: string; location: string; pricePerPersonAr: number }[]
}

export async function getExcursionCalcData(reservationId: string): Promise<ExcursionCalcData> {
  const [rate, excRows, boatRows, espRows, lunchRows, resRows] = await Promise.all([
    getExchangeRate(),
    db.select().from(excursions),
    db.select().from(boats),
    db.select().from(excursionSellingPricing).where(eq(excursionSellingPricing.active, true)),
    db.select().from(lunchProviders).where(eq(lunchProviders.active, true)),
    db.select().from(reservations).where(eq(reservations.id, reservationId)).limit(1),
  ])
  const boatName = (id: string) => boatRows.find(b => b.id === id)?.name || 'Boat'
  const res = resRows[0]
  const pax = res ? computeEffectivePax(res as PaxLike) : 2
  return {
    rate,
    pax,
    excursions: excRows.map(e => ({ id: e.id, name: e.name as string, entranceFeeAr: Number(e.entranceFeeAr) || 0 })),
    pricing: espRows.map(p => ({
      excursionId: p.excursionId as string,
      boatId: p.boatId as string,
      boatName: boatName(p.boatId as string),
      pricePax: [p.pricePax1, p.pricePax2, p.pricePax3, p.pricePax4, p.pricePax5, p.pricePax6].map(v => Number(v) || 0),
    })),
    lunch: lunchRows.map(l => ({ id: l.id, name: l.name as string, location: (l.location as string) || '', pricePerPersonAr: Number(l.pricePerPersonAr) || 0 })),
  }
}

// Data for the in-reply transfer price calculator (same source as the app's transfer
// price list): transfer routes, per-route boat prices (per person, EUR), and effective pax.
// Transfer price = pricePax{pax} × pax, ONE-WAY; a round trip is charged twice.
export type TransferCalcData = {
  pax: number
  routes: { id: string; name: string }[]
  pricing: { routeId: string; boatId: string; boatName: string; pricePax: number[] }[]
}

export async function getTransferCalcData(reservationId: string): Promise<TransferCalcData> {
  const [routeRows, boatRows, spRows, resRows] = await Promise.all([
    db.select().from(routes).where(eq(routes.type, 'transfer')),
    db.select().from(boats),
    db.select().from(sellingPricing).where(eq(sellingPricing.active, true)),
    db.select().from(reservations).where(eq(reservations.id, reservationId)).limit(1),
  ])
  const activeRouteIds = new Set(routeRows.filter(r => r.active !== false).map(r => r.id))
  const boatName = (id: string) => boatRows.find(b => b.id === id)?.name || 'Boat'
  const res = resRows[0]
  const pax = res ? computeEffectivePax(res as PaxLike) : 2
  return {
    pax,
    routes: routeRows.filter(r => r.active !== false).map(r => ({ id: r.id, name: r.name as string })),
    pricing: spRows
      .filter(p => activeRouteIds.has(p.routeId as string))
      .map(p => ({
        routeId: p.routeId as string,
        boatId: p.boatId as string,
        boatName: boatName(p.boatId as string),
        pricePax: [p.pricePax1, p.pricePax2, p.pricePax3, p.pricePax4, p.pricePax5, p.pricePax6].map(v => Number(v) || 0),
      })),
  }
}


