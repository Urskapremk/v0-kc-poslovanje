'use server'

import { db } from '@/lib/db'
import { bentralReservations, reservations } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getExchangeRate, getPayments } from '@/app/actions/komba'
import { bungalowDistinctDisplayNames } from '@/lib/bungalow'
import {
  buildCashReceiptHtml,
  cashReceiptFigures,
  cashReceiptSubject,
  isCashReceiptLang,
  receiptCompanions,
  type CashReceiptLang,
} from '@/lib/cash-receipt'
import { logSentEmail } from './sent-emails'

function getPublicBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
  return 'https://www.kombacabana.app'
}

async function buildForPayment(reservationId: string, paymentId: string, lang: CashReceiptLang) {
  const [reservation] = await db.select().from(reservations).where(eq(reservations.id, reservationId)).limit(1)
  if (!reservation) return { error: 'Rezervacija ni najdena.' as const }

  const rows = await getPayments(reservationId)
  const payment = rows.find((row) => row.id === paymentId)
  if (!payment) return { error: 'Plačilo ni najdeno.' as const }
  if (payment.method !== 'cash') return { error: 'Potrdilo je samo za gotovinsko plačilo.' as const }

  const exchangeRate = await getExchangeRate()
  const figures = cashReceiptFigures({
    cashAmountAr: payment.cashAmountAr,
    amountEur: Number(payment.amount),
    exchangeRate,
  })
  if (figures.amountAr <= 0) return { error: 'Znesek gotovine ni znan.' as const }

  let bookingNumber = ''
  if (reservation.bentralReservationId) {
    const [bentral] = await db
      .select({ externalId: bentralReservations.externalId })
      .from(bentralReservations)
      .where(eq(bentralReservations.id, reservation.bentralReservationId))
      .limit(1)
    bookingNumber = (bentral?.externalId || '').trim()
  }

  const guestName = (reservation.guestName || '').trim()
  const html = buildCashReceiptHtml({
    lang,
    guestName,
    companions: receiptCompanions(guestName, [
      reservation.secondGuestName,
      reservation.thirdGuestName,
      reservation.fourthGuestName,
    ]),
    amountAr: figures.amountAr,
    eur: figures.eur,
    exchangeRate: figures.rate,
    paidAt: payment.paidAt,
    bungalow: bungalowDistinctDisplayNames(reservation.bungalow),
    arrival: reservation.arrival,
    departure: reservation.departure,
    bookingNumber,
    logoUrl: `${getPublicBaseUrl()}/images/komba-logo-gold.png`,
  })

  return {
    html,
    to: (reservation.email || '').trim(),
    guestName,
    bungalow: bungalowDistinctDisplayNames(reservation.bungalow),
    subject: cashReceiptSubject(lang),
  }
}

/** Receipt HTML for the in-app preview. Does not send email. */
export async function getCashReceiptEmailPreview(
  reservationId: string,
  paymentId: string,
  lang: CashReceiptLang = 'sl',
): Promise<{ html?: string; to?: string; error?: string }> {
  if (!isCashReceiptLang(lang)) return { error: 'Izberi slovenščino, angleščino ali francoščino.' }
  const built = await buildForPayment(reservationId, paymentId, lang)
  if ('error' in built) return { error: built.error }
  return { html: built.html, to: built.to }
}

/** Sends the cash receipt to the guest's address on the booking, using Resend like the other guest emails. */
export async function sendCashReceiptEmail(
  reservationId: string,
  paymentId: string,
  lang: CashReceiptLang = 'sl',
): Promise<{ success: boolean; error?: string }> {
  if (!isCashReceiptLang(lang)) return { success: false, error: 'Izberi slovenščino, angleščino ali francoščino.' }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { success: false, error: 'E-pošta še ni nastavljena (manjka RESEND_API_KEY).' }

  const built = await buildForPayment(reservationId, paymentId, lang)
  if ('error' in built) return { success: false, error: built.error }
  if (!built.to) return { success: false, error: 'Gost nima vpisanega email naslova.' }

  const from = process.env.EMAIL_FROM || 'Komba Cabana <info@kombacabana.app>'
  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [built.to], subject: built.subject, html: built.html }),
    })
    if (!resp.ok) {
      const detail = await resp.text()
      return { success: false, error: `Pošiljanje ni uspelo: ${detail.slice(0, 200)}` }
    }
    await logSentEmail({
      reservationId,
      type: 'cash-receipt',
      recipient: built.to,
      subject: built.subject,
      guestName: built.guestName,
      bungalow: built.bungalow,
      lang,
      paymentId,
    })
    return { success: true }
  } catch (e) {
    return { success: false, error: `Napaka pri pošiljanju: ${(e as Error).message}` }
  }
}
