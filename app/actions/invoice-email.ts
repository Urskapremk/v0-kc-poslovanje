'use server'

import { getReservationById, getOrderItems, getInvoiceDiscounts, getDashboardData } from '@/app/actions/komba'
import { getDeliveryNotesForReservation } from '@/app/actions/delivery'
import { readFile } from 'fs/promises'
import path from 'path'
import { logSentEmail } from './sent-emails'
import { bungalowDisplayName } from '@/lib/bungalow'

// ============ INVOICE EMAIL (Resend) ============
// Sends a branded HTML invoice email (Komba Cabana check-in style) to the guest.
// The totals mirror the /racun invoice page exactly.

type InvoiceLang = 'en' | 'fr'

function getPublicBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
  return 'https://www.kombacabana.app'
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const formatEur = (val: number) =>
  val.toLocaleString('sl-SI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const formatAr = (val: number) => val.toLocaleString('sl-SI', { maximumFractionDigits: 0 })

const T: Record<InvoiceLang, Record<string, string>> = {
  en: {
    invoice: 'INVOICE',
    guest: 'Guest',
    accommodation: 'Accommodation',
    persons: 'persons',
    nights: 'nights',
    services: 'Services',
    servicesTotal: 'Services total',
    bar: 'Bar',
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
    creditRemaining: 'Credit remaining',
    paid: 'Paid',
    remainingToPay: 'Remaining to pay',
    included: 'Included (half/full board)',
    complimentary: 'On House',
    onHouseTotal: 'On House total (complimentary)',
    thankYou: 'Thank you for your visit!',
    tagline: 'Komba Cabana — Pure nature.',
    intro: 'Please find below the summary of your stay with us. If you have any questions about your invoice, feel free to reply to this email.',
  },
  fr: {
    invoice: 'FACTURE',
    guest: 'Client',
    accommodation: 'Hébergement',
    persons: 'personnes',
    nights: 'nuits',
    services: 'Services',
    servicesTotal: 'Total services',
    bar: 'Bar',
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
    creditRemaining: 'Crédit restant',
    paid: 'Payé',
    remainingToPay: 'Reste à payer',
    included: 'Inclus (demi/pension complète)',
    complimentary: 'On House',
    onHouseTotal: 'Total On House (offert)',
    thankYou: 'Merci de votre visite !',
    tagline: 'Komba Cabana — Pure nature.',
    intro: "Vous trouverez ci-dessous le récapitulatif de votre séjour. Pour toute question concernant votre facture, n'hésitez pas à répondre à cet email.",
  },
}

const itemWordMap: Record<InvoiceLang, Record<string, string>> = {
  en: {
    Bivanje: 'Accommodation', noci: 'nights', 'noči': 'nights', oseb: 'persons', dni: 'days',
    Skupaj: 'Total', Placano: 'Paid', 'Plačano': 'Paid', kartica: 'card', gotovina: 'cash', nakazilo: 'transfer',
    Zajtrk: 'Breakfast', Polpenzion: 'Half Board', 'Polni penzion': 'Full Board', Kosilo: 'Lunch',
    Vecerja: 'Dinner', 'Večerja': 'Dinner',
    Izlet: 'Excursion', Vklj: 'Incl', vstopnina: 'entrance fee', kosilo: 'lunch',
  },
  fr: {
    Bivanje: 'Hébergement', noci: 'nuits', 'noči': 'nuits', oseb: 'personnes', dni: 'jours',
    Skupaj: 'Total', Placano: 'Payé', 'Plačano': 'Payé', kartica: 'carte', gotovina: 'espèces', nakazilo: 'virement',
    Zajtrk: 'Petit-déjeuner', Polpenzion: 'Demi-pension', 'Polni penzion': 'Pension complète', Kosilo: 'Déjeuner',
    Vecerja: 'Dîner', 'Večerja': 'Dîner',
    Izlet: 'Excursion', Vklj: 'Incl', vstopnina: "droit d'entrée", kosilo: 'déjeuner',
  },
}

function translateItemName(name: string, lang: InvoiceLang): string {
  let out = String(name || '')
  for (const [sl, tr] of Object.entries(itemWordMap[lang])) {
    out = out.replace(new RegExp(`\\b${sl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'), tr)
  }
  out = out.replace(/\b([A-Za-zÀ-ÿ-]+)\s*\/\s*\1\b/g, '$1')
  return out
}

// Guest-facing bungalow name (single clean name, plus special display names like
// "Bungalow IV - Beach Villa"). Shared with the whole app via lib/bungalow.
const bungalowLabel = (raw?: string | null) => bungalowDisplayName(raw)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRec = Record<string, any>

type InvoiceData = {
  lang: InvoiceLang
  invoiceNumber: string
  today: string
  guestName: string
  guestEmail?: string | null
  bungalow: string
  arrival: string
  departure: string
  nights: number
  pax: number
  mealPlan?: string | null
  accommodationEur: number
  accommodationPaid: boolean
  accPaidEur: number
  accRemainingEur: number
  accommodationPartiallyPaid: boolean
  accPaymentNote?: string
  paymentSpec?: { label: string; methodDate: string; eur: number; separate: boolean }[]
  extensionNote?: string | null
  services: { name: string; eur: number; paid: boolean; free?: boolean; included?: boolean }[]
  servicesTotalEur: number
  notes: { date: string; count: number; totalEur: number; totalAr: number; items: { qty: number; name: string; eur: number; covered?: boolean; free?: boolean }[] }[]
  // Services (order items) + bar grouped per day — mirrors the /racun preview page.
  days: {
    dateLabel: string
    count: number
    totalEur: number
    totalAr: number
    services: { name: string; eur: number; paid: boolean; free?: boolean; included?: boolean; showPaidEur?: number; showPaidNote?: string }[]
    bar: { qty: number; name: string; eur: number; covered?: boolean; free?: boolean }[]
  }[]
  barTotalEur: number
  onHouseTotalEur: number
  discounts: { label: string; eur: number }[]
  subtotalEur: number
  grandTotalEur: number
  grandTotalAr: number
  creditRemainingEur: number
  exchangeRate: number
  prepaymentEur: number
  separatePaidEur: number
  totalPaidEur: number
  balanceDueEur: number
}

// Label for meals included in the guest's meal plan — reflects the ACTUAL plan
// (breakfast / half board / full board) so guests aren't confused by "half/full board".
function mealBoardLabel(mealPlan: string | null | undefined, lang: InvoiceLang): string {
  if (lang === 'fr') {
    if (mealPlan === 'B') return 'Inclus (petit-déjeuner)'
    if (mealPlan === 'HB') return 'Inclus (demi-pension)'
    if (mealPlan === 'FB') return 'Inclus (pension complète)'
    return 'Inclus'
  }
  if (mealPlan === 'B') return 'Included (breakfast)'
  if (mealPlan === 'HB') return 'Included (half board)'
  if (mealPlan === 'FB') return 'Included (full board)'
  return 'Included'
}

// Builds the branded invoice email HTML (mirrors the /racun invoice page).
function buildInvoiceEmailHtml(opts: InvoiceData): string {
  const t = T[opts.lang]
  const mealIncludedLabel = mealBoardLabel(opts.mealPlan, opts.lang)
  const logo = `${getPublicBaseUrl()}/images/komba-logo-gold.png`

  const sectionTitle = (label: string) =>
    `<tr><td style="padding:22px 20px 8px 20px;"><div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:2px;color:#7f9095;text-transform:uppercase;border-bottom:1px solid #1d4a5c;padding-bottom:8px;">${escapeHtml(label)}</div></td></tr>`

  const row = (left: string, right: string, opt: { muted?: boolean; bold?: boolean; sub?: string } = {}) => {
    const color = opt.muted ? '#7f9095' : '#e9f0f2'
    const weight = opt.bold ? '700' : '400'
    return `<tr>
      <td style="padding:7px 20px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${color};font-weight:${weight};">${left}${opt.sub ? `<span style="color:#7f9095;font-size:11px;"> ${escapeHtml(opt.sub)}</span>` : ''}</td>
      <td align="right" style="padding:7px 20px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${color};font-weight:${weight};white-space:nowrap;">${right}</td>
    </tr>`
  }

  const accommodationSection =
    opts.accommodationEur > 0
      ? sectionTitle(t.accommodation) +
        row(
          `${escapeHtml(opts.bungalow)}${opts.accommodationPaid ? ` <span style="color:#8fae92;font-size:11px;">(${t.paid})</span>` : ''}`,
          `${formatEur(opts.accommodationEur)} EUR`,
          { sub: `${opts.nights} ${t.nights}` },
        ) +
        (opts.accommodationPartiallyPaid
          ? `<tr><td colspan="2" style="padding:0 20px 8px 20px;font-family:Arial,Helvetica,sans-serif;font-size:11px;">
              <span style="color:#8fae92;">${t.paid}: ${formatEur(opts.accPaidEur)} EUR${opts.accPaymentNote ? ` · ${escapeHtml(opts.accPaymentNote)}` : ''}</span>
              <span style="color:#c59b5b;margin-left:14px;">${t.remainingToPay}: ${formatEur(opts.accRemainingEur)} EUR</span>
            </td></tr>`
          : '') +
        (opts.accommodationPaid && opts.accPaymentNote
          ? `<tr><td colspan="2" style="padding:0 20px 8px 20px;font-family:Arial,Helvetica,sans-serif;font-size:11px;">
              <span style="color:#8fae92;">${t.paid}: ${formatEur(opts.accPaidEur)} EUR · ${escapeHtml(opts.accPaymentNote)}</span>
            </td></tr>`
          : '') +
        (opts.extensionNote
          ? `<tr><td colspan="2" style="padding:0 20px 8px 20px;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#7f9095;font-style:italic;">${escapeHtml(opts.extensionNote)}</td></tr>`
          : '')
      : ''

  // Services (order items) + bar grouped into daily cards — mirrors the /racun preview.
  const servicesSection =
    opts.days.length > 0
      ? sectionTitle(t.services) +
        opts.days
          .map((d) => {
            const serviceRows = d.services
              .map((s) => {
                // Separately-paid excursions/transfers (showPaidEur set) are charged at their
                // real price and carry a green "Paid · method · date" note (they are part of the
                // total and Total paid). Other paid items (meals/On House/prepaid) stay at 0.00
                // with an inline (Included)/(On House) badge.
                const separatelyPaid = s.showPaidEur !== undefined
                const badge = s.paid && !separatelyPaid ? ` <span style="color:#8fae92;font-size:11px;">(${s.free ? t.complimentary : s.included ? mealIncludedLabel : t.paid})</span>` : ''
                const paidSubRow = separatelyPaid
                  ? `<tr><td colspan="2" style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#8fae92;padding-top:2px;">${t.paid}${s.showPaidNote ? ` · ${escapeHtml(s.showPaidNote)}` : ''}</td></tr>`
                  : ''
                const rightAmount = separatelyPaid ? `${formatEur(s.showPaidEur as number)} EUR` : (s.paid ? '0.00 EUR' : `${formatEur(s.eur)} EUR`)
                return `<tr><td style="padding:6px 14px;border-bottom:1px solid #1f2f36;">
                  <table role="presentation" width="100%"><tr>
                    <td style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#c2d3da;">${escapeHtml(translateItemName(s.name, opts.lang))}${badge}</td>
                    <td align="right" style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#c2d3da;white-space:nowrap;">${rightAmount}</td>
                  </tr>${paidSubRow}</table>
                </td></tr>`
              })
              .join('')
            const barRows = d.bar
              .map((it) => {
                const notCharged = !!it.covered || !!it.free
                const badge = it.covered
                  ? ` <span style="color:#8fae92;font-size:11px;">(${mealIncludedLabel})</span>`
                  : it.free
                    ? ` <span style="color:#8fae92;font-size:11px;">(${t.complimentary})</span>`
                    : ''
                return `<tr><td style="padding:6px 14px;border-bottom:1px solid #1f2f36;">
                  <table role="presentation" width="100%"><tr>
                    <td style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#c2d3da;"><span style="color:#7f9095;">${it.qty}x</span> ${escapeHtml(translateItemName(it.name, opts.lang))}${badge}</td>
                    <td align="right" style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#c2d3da;white-space:nowrap;">${notCharged ? '0.00 EUR' : `${formatEur(it.eur)} EUR`}</td>
                  </tr></table>
                </td></tr>`
              })
              .join('')
            return `<tr><td colspan="2" style="padding:6px 20px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#143a49" style="background-color:#143a49;border:1px solid #1d4a5c;border-radius:12px;">
              <tr><td style="padding:10px 14px;border-bottom:1px solid #1d4a5c;">
                <table role="presentation" width="100%"><tr>
                  <td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#e9f0f2;font-weight:700;text-transform:capitalize;">${escapeHtml(d.dateLabel)}<span style="color:#7f9095;font-weight:400;font-size:11px;"> · ${d.count} ${t.items}</span></td>
                  <td align="right" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#8fae92;font-weight:700;white-space:nowrap;">${formatEur(d.totalEur)} EUR</td>
                </tr></table>
              </td></tr>
              ${serviceRows}${barRows}
            </table>
          </td></tr>`
          })
          .join('') +
        row(t.servicesTotal, `${formatEur(opts.servicesTotalEur + opts.barTotalEur)} EUR`, { bold: true }) +
        ((opts.onHouseTotalEur || 0) > 0
          ? `<tr>
              <td style="padding:7px 20px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#8fae92;">${t.onHouseTotal}</td>
              <td align="right" style="padding:7px 20px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#8fae92;white-space:nowrap;">${formatEur(opts.onHouseTotalEur as number)} EUR</td>
            </tr>`
          : '')
      : ''

  const barSection = ''

  const discountSection =
    opts.discounts.length > 0
      ? row(t.subtotal, `${formatEur(opts.subtotalEur)} EUR`, { muted: true }) +
        opts.discounts.map((d) => row(escapeHtml(d.label), `-${formatEur(d.eur)} EUR`, { muted: true })).join('')
      : ''

  const paymentsSection = `
    <tr><td colspan="2" style="padding:16px 20px 4px 20px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#161c16" style="background-color:#161c16;border:1px solid #2c3b2e;border-radius:12px;">
        <tr><td style="padding:14px 16px;">
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:2px;color:#8fae92;text-transform:uppercase;margin-bottom:8px;">${t.payments}</div>
                <table role="presentation" width="100%"><tr><td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#ffffff;font-weight:700;">${t.totalPaid}</td><td align="right" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#ffffff;font-weight:700;">${formatEur(opts.totalPaidEur)} EUR</td></tr></table>
  ${opts.balanceDueEur > 0 ? `<table role="presentation" width="100%"><tr><td style="padding-top:8px;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#c59b5b;font-weight:700;">${t.balanceDue}</td><td align="right" style="padding-top:8px;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#c59b5b;font-weight:700;">${formatEur(opts.balanceDueEur)} EUR</td></tr></table>` : ''}
  ${opts.creditRemainingEur > 0 ? `<table role="presentation" width="100%" style="border-top:1px solid #2c3b2e;margin-top:6px;"><tr><td style="padding-top:8px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#8fae92;font-weight:700;">${t.creditRemaining}</td><td align="right" style="padding-top:8px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#8fae92;font-weight:700;">${formatEur(opts.creditRemainingEur)} EUR</td></tr></table>` : ''}
  </td></tr>
  </table>
  </td></tr>`

  // Payment specification (when & how each amount was paid). Every row is part of Total paid.
  const spec = opts.paymentSpec || []
  const specRow = (r: { label: string; methodDate: string; eur: number }) =>
    `<table role="presentation" width="100%"><tr>
      <td style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#c2d3da;padding:2px 0;">${escapeHtml(r.label)}${r.methodDate ? ` · ${escapeHtml(r.methodDate)}` : ''}</td>
      <td align="right" style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#c2d3da;white-space:nowrap;padding:2px 0;">${formatEur(r.eur)} EUR</td>
    </tr></table>`
  const paymentSpecSection = spec.length > 0 ? `
    <tr><td colspan="2" style="padding:8px 20px 4px 20px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#161c16" style="background-color:#161c16;border:1px solid #2c3b2e;border-radius:12px;">
        <tr><td style="padding:14px 16px;">
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:2px;color:#8fae92;text-transform:uppercase;margin-bottom:8px;">${t.paymentSpec}</div>
          ${spec.map((r) => specRow(r)).join('')}
        </td></tr>
      </table>
    </td></tr>` : ''

  return `<!DOCTYPE html>
<html lang="${opts.lang}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#0a2029;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#0a2029" style="background-color:#0a2029;">
    <tr><td align="center" bgcolor="#0a2029" style="background-color:#0a2029;padding:32px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" bgcolor="#0a2029" style="width:600px;max-width:600px;background-color:#0a2029;">
        <tr><td align="center" bgcolor="#0a2029" style="background-color:#0a2029;padding:8px 0 20px 0;">
          <img src="${logo}" alt="Komba Cabana" width="150" style="display:block;border:0;outline:none;max-width:150px;height:auto;">
        </td></tr>
        <tr><td bgcolor="#0a2029" style="background-color:#0a2029;padding:0 20px 4px 20px;">
          <table role="presentation" width="100%"><tr>
            <td style="font-family:Arial,Helvetica,sans-serif;font-size:24px;font-weight:700;color:#ffffff;">${t.invoice}</td>
            <td align="right" style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#7f9095;">#${escapeHtml(opts.invoiceNumber)}<br>${escapeHtml(opts.today)}</td>
          </tr></table>
        </td></tr>
        <tr><td bgcolor="#0a2029" style="background-color:#0a2029;padding:8px 20px 0 20px;">
          <p style="margin:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:#b9c6ca;">${t.intro}</p>
        </td></tr>
        <tr><td bgcolor="#0a2029" style="background-color:#0a2029;padding:4px 20px 0 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#143a49" style="background-color:#143a49;border:1px solid #1d4a5c;border-radius:12px;">
            <tr><td style="padding:16px 18px;">
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:2px;color:#7f9095;text-transform:uppercase;">${t.guest}</div>
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:17px;font-weight:700;color:#ffffff;margin-top:4px;">${escapeHtml(opts.guestName)}</div>
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#c59b5b;margin-top:8px;">${escapeHtml(opts.bungalow)}</div>
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#b9c6ca;margin-top:4px;">${escapeHtml(opts.arrival)} — ${escapeHtml(opts.departure)} · ${opts.nights} ${t.nights} · ${opts.pax} ${t.persons}</div>
            </td></tr>
          </table>
        </td></tr>
        <tr><td bgcolor="#0a2029" style="background-color:#0a2029;padding:4px 0 0 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#0a2029" style="background-color:#0a2029;">
            ${accommodationSection}
            ${servicesSection}
            ${barSection}
          </table>
        </td></tr>
        <tr><td bgcolor="#0a2029" style="background-color:#0a2029;padding:16px 20px 0 20px;">
          <table role="presentation" width="100%" style="border-top:2px solid #1d4a5c;">
            ${discountSection}
            <tr>
              <td style="padding-top:12px;font-family:Arial,Helvetica,sans-serif;font-size:19px;font-weight:700;color:#ffffff;">${t.total}</td>
              <td align="right" style="padding-top:12px;font-family:Arial,Helvetica,sans-serif;font-size:19px;font-weight:700;color:#ffffff;white-space:nowrap;">${formatEur(opts.grandTotalEur)} EUR</td>
            </tr>
            <tr>
              <td style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#7f9095;">${formatAr(opts.grandTotalAr)} Ar</td>
              <td align="right" style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#7f9095;">${t.exchangeRate}: 1 EUR = ${formatAr(opts.exchangeRate)} Ar</td>
            </tr>
          </table>
        </td></tr>
          ${paymentsSection}
          ${paymentSpecSection}
        <tr><td align="center" bgcolor="#0a2029" style="background-color:#0a2029;padding:24px 20px 8px 20px;border-top:1px solid #1f2f36;">
          <p style="margin:16px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#b9c6ca;">${t.thankYou}</p>
          <p style="margin:4px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#7e786d;">${t.tagline} &middot; Nosy Komba, Madagascar</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// Strip diacritics so the built-in PDF font (Helvetica) renders cleanly.
function ascii(s: string): string {
  return String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
}

// Builds a clean, professional A4 PDF invoice (vector text via jsPDF) and
// returns it as a base64 string, ready to attach to the Resend email.
async function buildInvoicePdfBase64(d: InvoiceData): Promise<string | null> {
  try {
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
    const t = T[d.lang]
    const mealIncludedLabel = mealBoardLabel(d.mealPlan, d.lang)
    const pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()
    const marginX = 18
    const contentW = pageW - marginX * 2
    let y = 16

    const ensure = (h: number) => {
      if (y + h > pageH - 16) {
        doc.addPage()
        y = 16
      }
    }

    // Logo (centered)
    try {
      // Use the small, downscaled logo so the PDF stays lightweight (~20 KB).
      const logoPath = path.join(process.cwd(), 'public', 'images', 'komba-logo-gold-pdf.png')
      const buf = await readFile(logoPath)
      const dataUrl = `data:image/png;base64,${buf.toString('base64')}`
      const logoW = 42
      const logoH = 24
      doc.addImage(dataUrl, 'PNG', (pageW - logoW) / 2, y, logoW, logoH, undefined, 'SLOW')
      y += logoH + 6
    } catch {
      y += 4
    }

    // Title + number/date
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(20, 20, 20)
    doc.setFontSize(20)
    doc.text(t.invoice, marginX, y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(120, 120, 120)
    doc.text(`#${d.invoiceNumber}`, pageW - marginX, y - 4, { align: 'right' })
    doc.text(d.today, pageW - marginX, y, { align: 'right' })
    y += 6
    doc.setDrawColor(210, 210, 210)
    doc.line(marginX, y, pageW - marginX, y)
    y += 8

    // Guest box
    doc.setFillColor(245, 245, 245)
    const boxH = 22
    doc.roundedRect(marginX, y, contentW, boxH, 2, 2, 'F')
    doc.setFontSize(8)
    doc.setTextColor(140, 140, 140)
    doc.text(t.guest.toUpperCase(), marginX + 5, y + 6)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(20, 20, 20)
    doc.text(ascii(d.guestName), marginX + 5, y + 12)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(90, 90, 90)
    doc.text(ascii(d.bungalow), marginX + 5, y + 17)
    doc.text(`${d.arrival} - ${d.departure} · ${d.nights} ${t.nights} · ${d.pax} ${t.persons}`, pageW - marginX - 5, y + 17, { align: 'right' })
    y += boxH + 8

    const line = (left: string, right: string, opt: { bold?: boolean; muted?: boolean; size?: number } = {}) => {
      ensure(8)
      doc.setFont('helvetica', opt.bold ? 'bold' : 'normal')
      doc.setFontSize(opt.size || 10)
      doc.setTextColor(opt.muted ? 130 : 40, opt.muted ? 130 : 40, opt.muted ? 130 : 40)
      const rightW = doc.getTextWidth(right)
      const leftMax = contentW - rightW - 4
      const leftLines = doc.splitTextToSize(left, leftMax)
      doc.text(leftLines, marginX, y)
      doc.text(right, pageW - marginX, y, { align: 'right' })
      y += 5 + (leftLines.length - 1) * 4.5
    }

    const sectionTitle = (label: string) => {
      ensure(12)
      y += 3
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(140, 140, 140)
      doc.text(label.toUpperCase(), marginX, y)
      y += 2
      doc.setDrawColor(220, 220, 220)
      doc.line(marginX, y, pageW - marginX, y)
      y += 5
    }

    // Accommodation
    if (d.accommodationEur > 0) {
      sectionTitle(t.accommodation)
      line(`${ascii(d.bungalow)}  (${d.nights} ${t.nights})${d.accommodationPaid ? ` (${ascii(t.paid)})` : ''}`, `${formatEur(d.accommodationEur)} EUR`)
      if (d.accommodationPartiallyPaid) {
        line(`  ${ascii(t.paid)}: ${formatEur(d.accPaidEur)} EUR${d.accPaymentNote ? ` · ${ascii(d.accPaymentNote)}` : ''}   ${ascii(t.remainingToPay)}: ${formatEur(d.accRemainingEur)} EUR`, '', { muted: true })
      } else if (d.accommodationPaid && d.accPaymentNote) {
        line(`  ${ascii(t.paid)}: ${formatEur(d.accPaidEur)} EUR · ${ascii(d.accPaymentNote)}`, '', { muted: true })
      }
      if (d.extensionNote) {
        line(`  ${ascii(d.extensionNote)}`, '', { muted: true })
      }
    }

    // Services
    if (d.services.length > 0) {
      sectionTitle(t.services)
      for (const s of d.services) {
        line(
          ascii(translateItemName(s.name, d.lang)) + (s.paid && s.showPaidEur === undefined ? `  (${s.free ? t.complimentary : s.included ? mealIncludedLabel : t.paid})` : ''),
          s.paid ? '0.00 EUR' : `${formatEur(s.eur)} EUR`,
          { muted: s.paid }
        )
        if (s.showPaidEur !== undefined) {
          line(`  ${ascii(t.paid)}: ${formatEur(s.showPaidEur)} EUR${s.showPaidNote ? ` · ${ascii(s.showPaidNote)}` : ''}`, '', { muted: true })
        }
      }
      line(t.servicesTotal, `${formatEur(d.servicesTotalEur)} EUR`, { bold: true })
    }

    // Bar (per delivery note)
    if (d.notes.length > 0) {
      sectionTitle(t.bar)
      for (const n of d.notes) {
        line(`${n.date}  ·  ${n.count} ${t.items}`, `${formatEur(n.totalEur)} EUR`, { bold: true })
        for (const it of n.items) {
          const notCharged = !!it.covered || !!it.free
          const label = it.covered ? ` (${ascii(mealIncludedLabel)})` : it.free ? ` (${ascii(t.complimentary)})` : ''
          line(`   ${it.qty}x ${ascii(translateItemName(it.name, d.lang))}${label}`, notCharged ? '0.00 EUR' : `${formatEur(it.eur)} EUR`, { muted: true })
        }
      }
      line(t.barTotal, `${formatEur(d.barTotalEur)} EUR`, { bold: true })
    }

    if ((d.onHouseTotalEur || 0) > 0) {
      line(t.onHouseTotal, `${formatEur(d.onHouseTotalEur as number)} EUR`, { muted: true })
    }

    // Totals
    ensure(20)
    y += 4
    doc.setDrawColor(40, 40, 40)
    doc.setLineWidth(0.5)
    doc.line(marginX, y, pageW - marginX, y)
    doc.setLineWidth(0.2)
    y += 6
    if (d.discounts.length > 0) {
      line(t.subtotal, `${formatEur(d.subtotalEur)} EUR`, { muted: true })
      for (const dis of d.discounts) line(ascii(dis.label), `-${formatEur(dis.eur)} EUR`, { muted: true })
    }
    line(t.total, `${formatEur(d.grandTotalEur)} EUR`, { bold: true, size: 14 })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(130, 130, 130)
    doc.text(`${formatAr(d.grandTotalAr)} Ar`, marginX, y)
    doc.text(`${t.exchangeRate}: 1 EUR = ${formatAr(d.exchangeRate)} Ar`, pageW - marginX, y, { align: 'right' })
    y += 8

    // Payments
    ensure(24)
    doc.setFillColor(240, 248, 245)
    const payH = d.balanceDueEur > 0 ? 24 : 16
    doc.roundedRect(marginX, y, contentW, payH, 2, 2, 'F')
    let py = y + 6
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(60, 140, 100)
    doc.text(t.payments.toUpperCase(), marginX + 5, py)
    py += 6
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(40, 40, 40)
    doc.text(t.totalPaid, marginX + 5, py)
    doc.text(`${formatEur(d.totalPaidEur)} EUR`, pageW - marginX - 5, py, { align: 'right' })
    if (d.balanceDueEur > 0) {
      py += 7
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.setTextColor(150, 120, 30)
      doc.text(t.balanceDue, marginX + 5, py)
      doc.text(`${formatEur(d.balanceDueEur)} EUR`, pageW - marginX - 5, py, { align: 'right' })
    }
    y += payH + 10

    // Payment specification (when & how each amount was paid)
    const spec = d.paymentSpec || []
    if (spec.length > 0) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(60, 140, 100)
      doc.text(ascii(t.paymentSpec).toUpperCase(), marginX, y)
      y += 5
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(40, 40, 40)
      for (const r of spec) {
        const left = `${ascii(r.label)}${r.methodDate ? ` · ${ascii(r.methodDate)}` : ''}`
        doc.text(left.length > 70 ? left.slice(0, 69) + '…' : left, marginX, y)
        doc.text(`${formatEur(r.eur)} EUR`, pageW - marginX, y, { align: 'right' })
        y += 5
      }
      y += 5
    }

    // Footer
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(90, 90, 90)
    doc.text(t.thankYou, pageW / 2, y, { align: 'center' })
    y += 5
    doc.setFontSize(8)
    doc.setTextColor(150, 150, 150)
    doc.text('Komba Cabana · Nosy Komba, Madagascar', pageW / 2, y, { align: 'center' })

    const arrayBuffer = doc.output('arraybuffer')
    return Buffer.from(arrayBuffer).toString('base64')
  } catch {
    return null
  }
}

// Gathers all reservation data and builds the invoice model used by both the
// email HTML and the PDF. Shared by the preview and the send actions.
async function buildInvoiceData(
  reservationId: string,
  lang: InvoiceLang,
  excludeAccommodation = false,
  onlyStayMeals = false
): Promise<{ data: InvoiceData; reservation: AnyRec } | { error: string }> {
  const [reservation, orderItems0, notes0, discounts0] = await Promise.all([
    getReservationById(reservationId) as Promise<AnyRec | null>,
    getOrderItems(reservationId) as Promise<AnyRec[]>,
    getDeliveryNotesForReservation(reservationId) as Promise<AnyRec[]>,
    getInvoiceDiscounts(reservationId) as Promise<AnyRec[]>,
  ])

  if (!reservation) return { error: 'Rezervacija ni najdena.' }

  const exchangeRate = Number(reservation.exchangeRate) || 4800

  // Combine group data when the reservation uses a shared invoice (mirror /racun).
  // A paid meal plan (B / HB / FB) covers its meals, even when bar staff entered them as
  // ordinary bar lines, so those are matched to the plan by name and not charged again.
  const paidMealPlan = String(reservation.mealPlanPaymentStatus || '').toUpperCase() === 'PAID'
    ? String(reservation.mealPlan || '').toUpperCase()
    : ''
  const isPaidPlanMeal = (name: unknown) => {
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
  let orderItems = orderItems0.map((item) =>
    (item.category === 'Prehrana' || item.category === 'Food') && item.paymentStatus === 'UNPAID' && !item.isFree && isPaidPlanMeal(item.name)
      ? { ...item, paymentStatus: 'PAID' }
      : item,
  )
  let notes: AnyRec[] = notes0.map((note): AnyRec => {
    const items = ((note.items || []) as AnyRec[]).map((it) =>
      !it.coveredByMealPlan && !it.isFree && isPaidPlanMeal(it.productName) ? { ...it, coveredByMealPlan: true } : it,
    )
    const totalAr = items.reduce(
      (s, it) => s + ((it.coveredByMealPlan || it.isFree) ? 0 : Number(it.priceAr || 0) * Number(it.quantity || 0)),
      0,
    )
    return { ...note, items, totalAr }
  })
  if (reservation.groupId) {
    try {
      const dashboard = (await getDashboardData()) as AnyRec
      const all = (dashboard?.reservations || []) as AnyRec[]
      const main = all.find((r) => r.groupId === reservation.groupId && r.isMainReservation)
      const shared = main?.sharedInvoice || reservation.sharedInvoice || false
      if (shared) {
        const group = all.filter((r) => r.groupId === reservation.groupId && r.id !== reservationId)
        const groupData = await Promise.all(
          group.map(async (r) => {
            const [gn, go] = await Promise.all([
              getDeliveryNotesForReservation(r.id) as Promise<AnyRec[]>,
              getOrderItems(r.id) as Promise<AnyRec[]>,
            ])
            return { notes: gn, orderItems: go }
          })
        )
        notes = [...notes0, ...groupData.flatMap((d) => d.notes)]
        orderItems = [...orderItems0, ...groupData.flatMap((d) => d.orderItems)]
      }
    } catch {
      // If group lookup fails, fall back to the single reservation invoice.
    }
  }

  // "Bivanje + prehrana + transport" izpis: obdržimo samo hrano (Prehrana/Food) in
  // prevoze (Transfer) med postavkami ter samo hrano na dobavnicah (bar pijače izpustimo).
  // Ostane pa cena bivanja (excludeAccommodation=false). Mirror /racun stayMeals.
  if (onlyStayMeals) {
    const FOOD_CATS = new Set(['Prehrana', 'Food'])
    orderItems = orderItems.filter(
      (i) => i.category === 'Bivanje' || FOOD_CATS.has(i.category) || i.category === 'Transfer'
    )
    notes = notes.map((n) => {
      const items = ((n.items as AnyRec[]) || []).filter((it) => (it.category || '') === 'Food')
      const totalAr = items.reduce(
        (s, it) => s + ((it.coveredByMealPlan || it.isFree) ? 0 : Number(it.priceAr || 0) * Number(it.quantity || 0)),
        0,
      )
      return { ...n, items, totalAr }
    })
  }

  // ---- Totals (identical logic to the /racun page) ----
  const invoiceOrderItems = orderItems.filter((i) => i.category !== 'Bivanje')
  // Excursions/transfers the guest paid separately (e.g. in advance) are counted toward the
  // invoice TOTAL and Total paid, at their real refPriceAr. Agency bookings never reveal prices.
  const isAgencyBookingE = reservation.bookingSource === 'Agency'
  const isSeparatelyPaidService = (i: AnyRec) =>
    i.paymentStatus === 'PAID' &&
    !i.isFree &&
    (i.category === 'Izlet' || i.category === 'Transfer') &&
    Number(i.refPriceAr || 0) > 0 &&
    !isAgencyBookingE
  const separatePaidAr = (invoiceOrderItems as AnyRec[])
    .filter(isSeparatelyPaidService)
    .reduce((s, i) => s + Number(i.refPriceAr || 0), 0)
  const separatePaidEur = separatePaidAr / exchangeRate
  const servicesTotalAr =
    invoiceOrderItems
      .filter((i) => i.paymentStatus === 'UNPAID')
      .reduce((s, i) => s + Number(i.priceAr || 0), 0) + separatePaidAr
  const barTotalAr = notes.reduce((s, n) => s + Number(n.totalAr || 0), 0)
  // "Brez bivanja" izpis: nočitev izpustimo, popuste na bivanje (kind 'stay') izločimo,
  // predplačilo pa upoštevamo le v presežku nad ceno bivanja (mirror /racun excludeAccommodation).
  const accommodationEurFull = Number(reservation.totalAmount || 0)
  const accommodationEur = excludeAccommodation ? 0 : accommodationEurFull
  const accommodationAr = Math.round(accommodationEur * exchangeRate)
  const applicableDiscounts = excludeAccommodation ? discounts0.filter((d) => d.kind !== 'stay') : discounts0
  const subtotalAr = accommodationAr + servicesTotalAr + barTotalAr
  const discountTotalAr = applicableDiscounts.reduce((s, d) => s + Number(d.amountAr || 0), 0)
  const grandTotalAr = Math.max(0, subtotalAr - discountTotalAr)
  const grandTotalEur = grandTotalAr / exchangeRate
  const creditAr = applicableDiscounts.filter((d) => d.kind === 'credit').reduce((s, d) => s + Number(d.amountAr || 0), 0)
  const amountPaidEur = Number(reservation.amountPaid) || 0
  const prepaymentEur = excludeAccommodation ? Math.max(0, amountPaidEur - accommodationEurFull) : amountPaidEur
  // Total paid = accommodation prepayment + separately-paid excursions/transfers. Both the
  // excursions (now in subtotal) and this paid amount rise together, so Balance due is unchanged.
  const totalPaidEur = prepaymentEur + separatePaidEur
  const balanceDueEur = Math.max(0, grandTotalEur - totalPaidEur)
  // Unused credit (e.g. from a cancelled excursion) shown to the guest: the part of the credit
  // not needed to settle the bill (prepayment + separately-paid services + discounts beyond subtotal).
  const prepaymentAr = Math.round(prepaymentEur * exchangeRate)
  const creditRemainingEur = Math.min(creditAr, Math.max(0, prepaymentAr + separatePaidAr + discountTotalAr - subtotalAr)) / exchangeRate
  // Split of the prepayment applied to accommodation vs. what remains on the stay.
  // For agency bookings we NEVER show what the guest paid (we don't know what the
  // agency charges them), so the breakdown is hidden.
  const isAgencyBooking = isAgencyBookingE
  const accPaidEur = excludeAccommodation ? 0 : Math.min(prepaymentEur, accommodationEur)
  const accRemainingEur = Math.max(0, accommodationEur - accPaidEur)
  const accommodationPartiallyPaid = !isAgencyBooking && accPaidEur > 0.01 && accRemainingEur > 0.01

  const dateLocale = lang === 'fr' ? 'fr-FR' : 'en-GB'
  const fmtDate = (d: string | Date) =>
    new Date(d).toLocaleDateString(dateLocale, { day: '2-digit', month: 'short', year: 'numeric' })
  const methodLabel = (m?: string | null): string => {
    if (!m) return ''
    const map: Record<string, { en: string; fr: string }> = {
      card: { en: 'card', fr: 'carte' },
      cash: { en: 'cash', fr: 'espèces' },
      transfer: { en: 'bank transfer', fr: 'virement' },
      orange_money: { en: 'Orange Money', fr: 'Orange Money' },
    }
    const e = map[m.toLowerCase()]
    return e ? (lang === 'fr' ? e.fr : e.en) : m
  }
  // How/when the accommodation prepayment was made (method · date), from recorded payments.
  const accPaymentNote = ((reservation as { payments?: { method?: string; paidAt?: string }[] }).payments || [])
    .filter((p) => p.paidAt)
    .map((p) => [methodLabel(p.method), p.paidAt ? fmtDate(p.paidAt) : ''].filter(Boolean).join(' · '))
    .join(' · ')

  // Full payment specification (when & how each amount was paid): reservation prepayments
  // plus separately-paid services (excursions/transfers). `separate` marks payments outside
  // the running balance so they can be grouped under an explanatory note.
  const paymentSpec: { label: string; methodDate: string; eur: number; separate: boolean }[] = []
  // Agency bookings must NOT reveal payment details (the guest must not see how much
  // the agency paid us), so we skip the whole payment-details spec for them.
  if (!isAgencyBooking) {
    for (const p of ((reservation as { payments?: { amount?: number; method?: string; paidAt?: string }[] }).payments || [])) {
      paymentSpec.push({
        label: T[lang].prepayment,
        methodDate: [methodLabel(p.method), p.paidAt ? fmtDate(p.paidAt) : ''].filter(Boolean).join(' · '),
        eur: Number(p.amount) || 0,
        separate: false,
      })
    }
  }
  if (!isAgencyBooking) {
    for (const i of invoiceOrderItems as AnyRec[]) {
      if (i.paymentStatus === 'PAID' && !i.isFree && Number(i.refPriceAr || 0) > 0 && (i.paidMethod || i.paidDate)) {
        paymentSpec.push({
          label: translateItemName(i.name as string, lang),
          methodDate: [methodLabel(i.paidMethod), i.paidDate ? fmtDate(i.paidDate) : ''].filter(Boolean).join(' · '),
          eur: Number(i.refPriceAr) / exchangeRate,
          separate: true,
        })
      }
    }
  }
  const nights = Math.max(
    1,
    Math.round(
      (new Date(reservation.departure).getTime() - new Date(reservation.arrival).getTime()) /
        (1000 * 60 * 60 * 24)
    )
  )

  // Group services (order items) + bar per day, identical to the /racun preview page,
  // so reception entries (meals, excursions, transfers) appear on their own day.
  const invoiceItemDay = (i: AnyRec) =>
    (i.eventDate as string) || (i.createdAt ? new Date(i.createdAt).toISOString().split('T')[0] : '')
  // A day can have MORE THAN ONE delivery note (e.g. an extra empty note). Merge all notes'
  // items per day so a later/empty note never clobbers a note that actually has items.
  const noteDay = (d: string) => (d && d.includes('T') ? d.split('T')[0] : d)
  const noteByDateRaw = new Map<string, AnyRec>()
  for (const n of notes as AnyRec[]) {
    const key = noteDay(n.date as string)
    const existing = noteByDateRaw.get(key)
    if (existing) {
      existing.items = [...((existing.items || []) as AnyRec[]), ...((n.items || []) as AnyRec[])]
    } else {
      noteByDateRaw.set(key, { ...n, date: key, items: [...((n.items || []) as AnyRec[])] })
    }
  }
  const dayKeys = Array.from(
    new Set<string>([
      ...(notes as AnyRec[]).map((n) => noteDay(n.date as string)),
      ...(invoiceOrderItems as AnyRec[]).map(invoiceItemDay).filter(Boolean),
    ])
  ).sort()
  // Že plačane postavke (npr. plačan izlet) se NE prikažejo na računu; "On House" (isFree) ostane kot info.
  // IZJEMA: transferji ('Transfer'), obroki ('Prehrana') in izleti ('Izlet') se VEDNO prikažejo,
  // tudi če plačani — transfer/izlet z oznako (Paid), obrok kot Included (half/full board). Enako kot /racun.
  const isTransferItem = (i: AnyRec) => i.category === 'Transfer'
  const isMealItem = (i: AnyRec) => i.category === 'Prehrana'
  const isExcursionItem = (i: AnyRec) => i.category === 'Izlet'
  const isChargeableOrShown = (i: AnyRec) => i.paymentStatus !== 'PAID' || !!i.isFree || isTransferItem(i) || isMealItem(i) || isExcursionItem(i)
  const days = dayKeys
    .map((day) => {
      const note = noteByDateRaw.get(day)
      const dayItems = (invoiceOrderItems as AnyRec[]).filter((i) => invoiceItemDay(i) === day && isChargeableOrShown(i))
      const barItems = (note?.items || []) as AnyRec[]
      const servicesAr =
        dayItems
          .filter((i) => i.paymentStatus === 'UNPAID')
          .reduce((s, i) => s + Number(i.priceAr || 0), 0) +
        dayItems
          .filter(isSeparatelyPaidService)
          .reduce((s, i) => s + Number(i.refPriceAr || 0), 0)
      const barAr = barItems.reduce(
        (s, it) => s + ((it.coveredByMealPlan || it.isFree) ? 0 : Number(it.priceAr || 0) * Number(it.quantity || 0)),
        0
      )
      const dayTotalAr = servicesAr + barAr
      return {
        dateLabel: fmtDate(day),
        count: dayItems.length + barItems.length,
        totalEur: dayTotalAr / exchangeRate,
        totalAr: dayTotalAr,
        services: dayItems.map((i) => {
          const paid = i.paymentStatus === 'PAID'
          // For paid excursions/transfers show the real price (refPriceAr) with a "Paid"
          // label; NOT added to the total. For agency bookings never reveal prices.
          const showPaidEur =
            paid && !i.isFree && !isMealItem(i) && !isAgencyBooking && Number(i.refPriceAr || 0) > 0
              ? Number(i.refPriceAr) / exchangeRate
              : undefined
          const showPaidNote =
            showPaidEur !== undefined
              ? [methodLabel(i.paidMethod), i.paidDate ? fmtDate(i.paidDate) : '']
                  .filter(Boolean)
                  .join(' · ')
              : ''
          return {
            name: i.name as string,
            eur: Number(i.priceAr || 0) / exchangeRate,
            paid,
            free: !!i.isFree,
            included: isMealItem(i),
            showPaidEur,
            showPaidNote,
          }
        }),
        bar: barItems.map((it) => ({
          qty: Number(it.quantity || 0),
          name: it.productName as string,
          eur: (Number(it.priceAr || 0) * Number(it.quantity || 0)) / exchangeRate,
          covered: !!it.coveredByMealPlan,
          free: !it.coveredByMealPlan && !!it.isFree,
        })),
      }
    })
    .filter((d) => d.services.length > 0 || d.bar.length > 0)

  // Total of complimentary "On House" items (not charged, shown for reference) — mirrors /racun.
  // Order items: isFree line amount (priceAr). Bar items: isFree and NOT meal-plan covered (priceAr × qty).
  const onHouseOrderAr = (invoiceOrderItems as AnyRec[])
    .filter((i) => i.isFree)
    .reduce((s, i) => s + Number(i.priceAr || 0), 0)
  const onHouseBarAr = (notes as AnyRec[]).reduce(
    (s, n) =>
      s +
      ((n.items || []) as AnyRec[])
        .filter((it) => it.isFree && !it.coveredByMealPlan)
        .reduce((ss, it) => ss + Number(it.priceAr || 0) * Number(it.quantity || 0), 0),
    0
  )
  const onHouseTotalEur = (onHouseOrderAr + onHouseBarAr) / exchangeRate

  const invoiceNumber = `KC-${new Date().getFullYear()}-${String(reservation.id).slice(-6).toUpperCase()}${excludeAccommodation ? '-S' : onlyStayMeals ? '-BP' : ''}`
  const data: InvoiceData = {
    lang,
    invoiceNumber,
    today: new Date().toLocaleDateString(dateLocale, { day: 'numeric', month: 'long', year: 'numeric' }),
    guestName: reservation.guestName || 'Guest',
    guestEmail: reservation.email,
    bungalow: bungalowLabel(reservation.bungalow) || reservation.bungalow || '',
    arrival: fmtDate(reservation.arrival),
    departure: fmtDate(reservation.departure),
  nights,
  pax: Number(reservation.pax) || 1,
  mealPlan: reservation.mealPlan,
  accommodationEur,
    accommodationPaid: accommodationEur > 0 && prepaymentEur >= accommodationEur - 0.01,
    accPaidEur,
    accRemainingEur,
    accommodationPartiallyPaid,
    accPaymentNote,
    paymentSpec,
    extensionNote: reservation.extensionNote,
    services: invoiceOrderItems.filter(isChargeableOrShown).map((i) => ({
      name: i.name,
      eur: Number(i.priceAr || 0) / exchangeRate,
      paid: i.paymentStatus === 'PAID',
      free: !!(i as AnyRec).isFree,
      included: isMealItem(i),
    })),
    servicesTotalEur: servicesTotalAr / exchangeRate,
    days,
    notes: notes
      .filter((n) => (n.items || []).length > 0)
      .map((n) => {
        // Exclude meal-plan-covered and complimentary items from the day total (not charged).
        const totalAr = (n.items || []).reduce((s: number, it: AnyRec) => s + ((it.coveredByMealPlan || it.isFree) ? 0 : Number(it.priceAr || 0) * Number(it.quantity || 0)), 0)
        return {
          date: fmtDate(n.date),
          count: (n.items || []).length,
          totalEur: totalAr / exchangeRate,
          totalAr,
          items: (n.items || []).map((it: AnyRec) => ({
            qty: Number(it.quantity || 0),
            name: it.productName,
            eur: (Number(it.priceAr || 0) * Number(it.quantity || 0)) / exchangeRate,
            covered: !!it.coveredByMealPlan,
            free: !it.coveredByMealPlan && !!it.isFree,
          })),
        }
      }),
    barTotalEur: barTotalAr / exchangeRate,
    onHouseTotalEur,
    discounts: applicableDiscounts.map((d) => ({ label: d.label, eur: Number(d.amountAr || 0) / exchangeRate })),
    subtotalEur: subtotalAr / exchangeRate,
    grandTotalEur,
    grandTotalAr,
    creditRemainingEur,
    exchangeRate,
    prepaymentEur,
    separatePaidEur,
    totalPaidEur,
    balanceDueEur,
  }

  return { data, reservation }
}

// Returns the rendered invoice email HTML for an in-app preview (no sending).
export async function getInvoiceEmailPreview(
  reservationId: string,
  lang: InvoiceLang = 'en',
  excludeAccommodation = false,
  onlyStayMeals = false
): Promise<{ html?: string; to?: string; error?: string }> {
  const built = await buildInvoiceData(reservationId, lang, excludeAccommodation, onlyStayMeals)
  if ('error' in built) return { error: built.error }
  return {
    html: buildInvoiceEmailHtml(built.data),
    to: (built.reservation.email || '').trim(),
  }
}

export async function sendInvoiceEmail(
  reservationId: string,
  toEmail?: string,
  lang: InvoiceLang = 'en',
  excludeAccommodation = false,
  onlyStayMeals = false
): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { success: false, error: 'E-pošta še ni nastavljena (manjka RESEND_API_KEY).' }

  const built = await buildInvoiceData(reservationId, lang, excludeAccommodation, onlyStayMeals)
  if ('error' in built) return { success: false, error: built.error }
  const { data, reservation } = built

  const to = (toEmail || reservation.email || '').trim()
  if (!to) return { success: false, error: 'Gost nima vpisanega email naslova.' }

  const html = buildInvoiceEmailHtml(data)

  const from = process.env.EMAIL_FROM || 'Komba Cabana <info@kombacabana.app>'
  const subject = lang === 'fr' ? 'Votre facture — Komba Cabana' : 'Your invoice — Komba Cabana'

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
    await logSentEmail({
      reservationId,
      type: 'invoice',
      recipient: to,
      subject,
      guestName: (reservation as { guestName?: string | null }).guestName ?? null,
      bungalow: (reservation as { bungalow?: string | null }).bungalow ?? null,
      excludeAccommodation,
      lang,
    })
    return { success: true }
  } catch (e) {
    return { success: false, error: `Napaka pri pošiljanju: ${(e as Error).message}` }
  }
}
