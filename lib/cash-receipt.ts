// Cash payment receipt shown in the email body. The lodge wordmark is the
// real file public/images/komba-logo-gold.png, used at the top and the bottom
// so the lettering matches. It is not redrawn with a script font.
// EUR comes from the same Ariary-per-EUR rate as the payment panel.

import { cashAriaryToEurAmount } from './cash-payment'

export type CashReceiptLang = 'sl' | 'en' | 'fr'

export function isCashReceiptLang(value: string): value is CashReceiptLang {
  return value === 'sl' || value === 'en' || value === 'fr'
}

const MONTHS: Record<CashReceiptLang, string[]> = {
  sl: ['januar', 'februar', 'marec', 'april', 'maj', 'junij', 'julij', 'avgust', 'september', 'oktober', 'november', 'december'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  fr: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
}

export const CASH_RECEIPT_COPY: Record<CashReceiptLang, {
  title: string
  guest: string
  received: string
  inEuros: string
  rate: (rate: string) => string
  bungalow: string
  stay: string
  booking: string
  method: string
  with: string
  confirm: string
  subject: string
}> = {
  sl: {
    title: 'Potrdilo o plačilu z gotovino',
    guest: 'Gost',
    received: 'Prejeto v gotovini',
    inEuros: 'V evrih',
    rate: (rate) => `Tečaj 1 EUR = ${rate} Ar`,
    bungalow: 'Bungalov',
    stay: 'Bivanje',
    booking: 'Rezervacija',
    method: 'Način plačila · Gotovina',
    with: 'V družbi',
    confirm: 'To potrdilo potrjuje, da je Komba Cabana prejela navedeno gotovino.',
    subject: 'Potrdilo o plačilu z gotovino — Komba Cabana',
  },
  en: {
    title: 'Cash payment receipt',
    guest: 'Guest',
    received: 'Received in cash',
    inEuros: 'In euros',
    rate: (rate) => `Exchange rate 1 EUR = ${rate} Ar`,
    bungalow: 'Bungalow',
    stay: 'Stay',
    booking: 'Booking',
    method: 'Payment method · Cash',
    with: 'With',
    confirm: 'This confirms that Komba Cabana has received the cash above.',
    subject: 'Cash payment receipt — Komba Cabana',
  },
  fr: {
    title: 'Reçu de paiement en espèces',
    guest: 'Client',
    received: 'Reçu en espèces',
    inEuros: 'En euros',
    rate: (rate) => `Taux de change 1 EUR = ${rate} Ar`,
    bungalow: 'Bungalow',
    stay: 'Séjour',
    booking: 'Réservation',
    method: 'Mode de paiement · Espèces',
    with: 'Avec',
    confirm: 'Ceci confirme que Komba Cabana a reçu le montant en espèces indiqué.',
    subject: 'Reçu de paiement en espèces — Komba Cabana',
  },
}

export function cashReceiptSubject(lang: CashReceiptLang): string {
  return CASH_RECEIPT_COPY[lang].subject
}

/** Figures printed on the receipt. Ariary entered as cash stays exact; euros follow the app rate. */
export function cashReceiptFigures(opts: {
  cashAmountAr?: number | null
  amountEur?: number | null
  exchangeRate: number
}): { amountAr: number; eur: number; rate: number } {
  const rate = Number(opts.exchangeRate)
  const cashAr = Math.round(Number(opts.cashAmountAr))
  if (Number.isFinite(cashAr) && cashAr > 0 && Number.isFinite(rate) && rate > 0) {
    return { amountAr: cashAr, eur: Number(cashAriaryToEurAmount(cashAr, rate)), rate }
  }
  const eur = Number(opts.amountEur)
  if (Number.isFinite(eur) && eur > 0 && Number.isFinite(rate) && rate > 0) {
    return { amountAr: Math.round(eur * rate), eur: Math.round(eur * 100) / 100, rate }
  }
  return { amountAr: 0, eur: 0, rate: Number.isFinite(rate) && rate > 0 ? rate : 0 }
}

/** Named guests on the booking, other than the person the receipt is addressed to. */
export function receiptCompanions(guestName: string, names: (string | null | undefined)[]): string[] {
  const guest = guestName.trim().toLocaleLowerCase('sl')
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of names) {
    const name = (raw || '').replace(/\s+/g, ' ').trim()
    if (!name) continue
    const key = name.toLocaleLowerCase('sl')
    if (key === guest || seen.has(key)) continue
    seen.add(key)
    out.push(name)
  }
  return out
}

export function formatReceiptAr(amount: number): string {
  return new Intl.NumberFormat('sl-SI', { useGrouping: true, maximumFractionDigits: 0 }).format(Math.round(amount))
}

export function formatReceiptEur(amount: number): string {
  return new Intl.NumberFormat('sl-SI', {
    useGrouping: true,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatReceiptRate(rate: number): string {
  const rounded = Math.round(rate * 100) / 100
  const digits = Number.isInteger(rounded) ? 0 : 2
  return new Intl.NumberFormat('sl-SI', {
    useGrouping: true,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(rounded)
}

export function formatReceiptDate(iso: string, lang: CashReceiptLang): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '').trim())
  if (!match) return String(iso || '')
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return String(iso || '')
  const name = MONTHS[lang][month - 1]
  if (lang === 'sl') return `${day}. ${name} ${year}`
  return `${day} ${name} ${year}`
}

export type CashReceiptInput = {
  lang: CashReceiptLang
  guestName: string
  companions: string[]
  amountAr: number
  eur: number
  exchangeRate: number
  paidAt: string
  bungalow: string
  arrival: string
  departure: string
  bookingNumber: string
  logoUrl: string
}

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// public/images/komba-logo-gold.png is 1536×1024. Ink sits in y 162–655;
// the circle ends at y 524 and the script tagline starts at y 544.
const LOGO_WIDTH = 320
const LOGO_HEIGHT = Math.round(LOGO_WIDTH * (1024 / 1536))

function logoWindow(fromY: number, toY: number): { marginTop: number; height: number } {
  const scale = LOGO_HEIGHT / 1024
  const top = Math.round(fromY * scale)
  const bottom = Math.round(toY * scale)
  return { marginTop: -top, height: bottom - top }
}

function logoImg(url: string, fromY: number, toY: number): string {
  const frame = logoWindow(fromY, toY)
  const safe = escapeHtml(url)
  return `<div style="width:${LOGO_WIDTH}px;height:${frame.height}px;overflow:hidden;margin:0 auto;">
    <img src="${safe}" alt="Komba Cabana" width="${LOGO_WIDTH}" style="display:block;width:${LOGO_WIDTH}px;height:${LOGO_HEIGHT}px;margin-top:${frame.marginTop}px;border:0;outline:none;text-decoration:none;">
  </div>`
}

// Same stacks as the transfer voucher, which copies the app: Manrope for titles,
// Inter for labels and body. Weights already loaded by that email.
const FONT_DISPLAY = "'Manrope','Segoe UI',Tahoma,Arial,Helvetica,sans-serif"
const FONT_BODY = "'Inter','Segoe UI',Tahoma,Arial,Helvetica,sans-serif"

function overline(text: string): string {
  return `<div style="margin:0;font-family:${FONT_BODY};font-size:11px;font-weight:600;letter-spacing:3px;text-transform:uppercase;color:#c4a15a;">${escapeHtml(text)}</div>`
}

function detail(label: string, value: string): string {
  if (!value.trim()) return ''
  return `<div style="margin:16px 0 0 0;">
    ${overline(label)}
    <div style="margin:4px 0 0 0;font-family:${FONT_DISPLAY};font-size:22px;font-weight:600;line-height:1.25;color:#f4efe6;">${escapeHtml(value)}</div>
  </div>`
}

export function buildCashReceiptHtml(input: CashReceiptInput): string {
  const t = CASH_RECEIPT_COPY[input.lang]
  const rateLabel = formatReceiptRate(input.exchangeRate)
  const arLabel = formatReceiptAr(input.amountAr)
  const eurLabel = formatReceiptEur(input.eur)
  const paid = formatReceiptDate(input.paidAt, input.lang)
  const stay = input.arrival && input.departure
    ? `${formatReceiptDate(input.arrival, input.lang)} – ${formatReceiptDate(input.departure, input.lang)}`
    : ''
  const companions = input.companions.map((name) =>
    `<div style="margin:2px 0 0 0;font-family:${FONT_DISPLAY};font-size:20px;font-weight:500;line-height:1.35;color:#f4efe6;">${escapeHtml(name)}</div>`
  ).join('')
  const withBlock = companions
    ? `<div style="margin:22px 0 0 0;">${overline(t.with)}${companions}</div>`
    : ''
  const langAttr = input.lang === 'sl' ? 'sl' : input.lang

  return `<!DOCTYPE html>
<html lang="${langAttr}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(t.title)}</title>
<!--[if !mso]><!-->
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@500;600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<!--<![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#071c24;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#071c24" style="background-color:#071c24;">
    <tr><td align="center" bgcolor="#071c24" style="background-color:#071c24;padding:28px 12px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#071c24" style="width:100%;max-width:640px;background-color:#071c24;border:1px solid #c4a15a;">
        <tr><td bgcolor="#071c24" style="background-color:#071c24;padding:8px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#071c24" style="background-color:#071c24;border:1px solid #c4a15a;">
            <tr><td align="center" bgcolor="#071c24" style="background-color:#071c24;padding:18px 16px 22px 16px;">
              <div style="position:relative;padding:22px 18px 26px 18px;">
              <div style="position:absolute;top:4px;left:4px;width:22px;height:22px;border-top:1px solid #c4a15a;border-left:1px solid #c4a15a;"></div>
              <div style="position:absolute;top:4px;right:4px;width:22px;height:22px;border-top:1px solid #c4a15a;border-right:1px solid #c4a15a;"></div>
              <div style="position:absolute;bottom:4px;left:4px;width:22px;height:22px;border-bottom:1px solid #c4a15a;border-left:1px solid #c4a15a;"></div>
              <div style="position:absolute;bottom:4px;right:4px;width:22px;height:22px;border-bottom:1px solid #c4a15a;border-right:1px solid #c4a15a;"></div>
              ${logoImg(input.logoUrl, 150, 660)}
              <div style="margin:8px 0 0 0;font-family:${FONT_BODY};font-size:11px;font-weight:600;letter-spacing:3px;text-transform:uppercase;color:#d9c7a2;">Nosy Komba · Madagascar</div>
              <div style="margin:22px 0 0 0;font-family:${FONT_DISPLAY};font-size:32px;font-weight:500;line-height:1.2;color:#f3eadc;">${escapeHtml(t.title)}</div>
              <div style="margin:14px auto 0 auto;width:180px;">
                <table role="presentation" width="180" cellpadding="0" cellspacing="0" align="center">
                  <tr>
                    <td width="78" style="border-bottom:1px solid #c4a15a;font-size:0;line-height:0;">&nbsp;</td>
                    <td width="24" align="center" style="font-family:${FONT_BODY};font-size:11px;line-height:11px;color:#c4a15a;">&#9670;</td>
                    <td width="78" style="border-bottom:1px solid #c4a15a;font-size:0;line-height:0;">&nbsp;</td>
                  </tr>
                </table>
              </div>
              <div style="margin:16px 0 0 0;font-family:${FONT_BODY};font-size:18px;font-weight:500;color:#e7eef0;">${escapeHtml(paid)}</div>
              <div style="margin:8px 0 0 0;">${overline(t.guest)}</div>
              <div style="margin:4px 0 0 0;font-family:${FONT_DISPLAY};font-size:36px;font-weight:600;line-height:1.15;color:#f7f4ee;">${escapeHtml(input.guestName)}</div>
              <div style="margin:22px 8px 0 8px;border:1px solid #c4a15a;border-radius:18px;background-color:#10262e;padding:22px 16px 20px 16px;">
                ${overline(t.received)}
                <div style="margin:8px 0 0 0;font-family:${FONT_DISPLAY};font-size:40px;font-weight:600;line-height:1.1;color:#e6c97a;">${escapeHtml(arLabel)} Ar</div>
                <div style="margin:10px 0 0 0;font-family:${FONT_BODY};font-size:16px;font-weight:500;color:#d5e2e6;">
                  <span style="letter-spacing:2px;text-transform:uppercase;font-size:12px;color:#c4a15a;">${escapeHtml(t.inEuros)}</span>
                  <span style="font-family:${FONT_DISPLAY};font-size:22px;font-weight:500;color:#f4efe6;"> ${escapeHtml(eurLabel)} EUR</span>
                </div>
                <div style="margin:6px 0 0 0;font-family:${FONT_BODY};font-size:13px;font-weight:500;color:#8fa3a8;">${escapeHtml(t.rate(rateLabel))}</div>
              </div>
              ${detail(t.bungalow, input.bungalow)}
              ${detail(t.stay, stay)}
              ${detail(t.booking, input.bookingNumber)}
              <div style="margin:20px 0 0 0;">
                <span style="display:inline-block;border:1px solid #c4a15a;border-radius:999px;padding:7px 16px;font-family:${FONT_BODY};font-size:12px;font-weight:600;letter-spacing:1.6px;text-transform:uppercase;color:#e6c97a;">${escapeHtml(t.method)}</span>
              </div>
              ${withBlock}
              <div style="margin:26px 12px 0 12px;font-family:${FONT_BODY};font-size:16px;font-weight:500;line-height:1.45;color:#e7eef0;">${escapeHtml(t.confirm)}</div>
              <div style="margin:26px 0 0 0;">
                ${logoImg(input.logoUrl, 150, 532)}
                <div style="margin:6px 0 0 0;font-family:${FONT_BODY};font-size:11px;font-weight:600;letter-spacing:4px;text-transform:uppercase;color:#8fa3a8;">Pure nature.</div>
              </div>
              </div>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
