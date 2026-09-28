'use server'

import { getReservationWithDetails, getDashboardData } from '@/app/actions/komba'
import { logSentEmail } from './sent-emails'
import { bungalowDisplayName } from '@/lib/bungalow'

// ============ TRANSFER VOUCHER EMAIL (Resend) ============
// Sends a branded HTML transfer voucher email (Komba Cabana dark style) to the guest.
// Shows the split route (car / boat legs), a single total price and the payment status.

type TransferType = 'arrival' | 'departure'

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

function formatEmailDate(value?: string | null): string {
  if (!value) return ''
  const d = new Date(value)
  if (isNaN(d.getTime())) return String(value)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ---- Guest nationality flag -------------------------------------------------------------
// Flags are IMAGES, never emoji: Windows and Outlook do not render the flag emoji at all, they
// print the two underlying letters ("GB"). flagcdn is used instead of local files on purpose —
// it covers every country, so a nationality we have never seen still gets a flag on the boat mast.

// Width at 14px tall, because flag ratios genuinely differ (Switzerland is square, the UK 2:1),
// plus the English name for alt text. Email needs BOTH dimensions stated or Outlook stretches it.
const FLAGS: Record<string, { w: number; name: string }> = {
  ae: { w: 28, name: 'United Arab Emirates' },
  at: { w: 21, name: 'Austria' },
  au: { w: 28, name: 'Australia' },
  br: { w: 19, name: 'Brazil' },
  ch: { w: 14, name: 'Switzerland' },
  de: { w: 23, name: 'Germany' },
  es: { w: 21, name: 'Spain' },
  fr: { w: 21, name: 'France' },
  gb: { w: 28, name: 'United Kingdom' },
  ie: { w: 28, name: 'Ireland' },
  it: { w: 21, name: 'Italy' },
  lt: { w: 23, name: 'Lithuania' },
  mg: { w: 21, name: 'Madagascar' },
  nl: { w: 21, name: 'Netherlands' },
  pl: { w: 22, name: 'Poland' },
  pt: { w: 21, name: 'Portugal' },
  se: { w: 22, name: 'Sweden' },
  si: { w: 28, name: 'Slovenia' },
  us: { w: 26, name: 'United States' },
  za: { w: 21, name: 'South Africa' },
}

// `reservations.nationality` is free text, and the live data shows just how uneven: 33 different
// spellings for 20 countries — English and Slovenian names, adjectives ("British", "Spanish")
// and typos ("Switcerland"). So this cannot be a simple country list; every observed spelling is
// mapped, with the common alternatives added so future entries still resolve.
//
// CAREFUL: "Avstrija" is AUSTRIA (at) while "Australian" is AUSTRALIA (au). Never collapse those.
const NATIONALITY_CODES: Record<string, string> = {
  // United Arab Emirates
  'zdruzeni arabski emirati': 'ae', uae: 'ae', 'united arab emirates': 'ae',
  // Austria
  avstrija: 'at', austria: 'at', austrian: 'at', osterreich: 'at',
  // Australia
  australian: 'au', australia: 'au', avstralija: 'au',
  // Brazil
  brazil: 'br', brasil: 'br', brazilian: 'br', brazilija: 'br',
  // Switzerland
  switzerland: 'ch', switcerland: 'ch', swiss: 'ch', svica: 'ch', schweiz: 'ch', suisse: 'ch',
  // Germany
  germany: 'de', german: 'de', nemcija: 'de', deutschland: 'de',
  // Spain
  spanish: 'es', spanija: 'es', spain: 'es', espana: 'es',
  // France
  france: 'fr', francija: 'fr', french: 'fr',
  // United Kingdom
  'united kingdom': 'gb', british: 'gb', 'great britain': 'gb', 'velika britanija': 'gb',
  uk: 'gb', england: 'gb', anglija: 'gb', britain: 'gb',
  // Ireland
  ireland: 'ie', irish: 'ie', irska: 'ie',
  // Italy
  italy: 'it', italija: 'it', italian: 'it', italia: 'it',
  // Lithuania
  litva: 'lt', lithuania: 'lt', lithuanian: 'lt',
  // Madagascar
  madagascar: 'mg', madagaskar: 'mg', malagasy: 'mg',
  // Netherlands
  netherlands: 'nl', nizozemska: 'nl', holland: 'nl', nederland: 'nl', dutch: 'nl',
  // Poland
  poland: 'pl', poljska: 'pl', polish: 'pl', polska: 'pl',
  // Portugal
  portugal: 'pt', portugalska: 'pt', portuguese: 'pt',
  // Sweden
  sweden: 'se', svedska: 'se', swedish: 'se', sverige: 'se',
  // Slovenia
  slovenia: 'si', slovenija: 'si', slovenian: 'si', slovene: 'si',
  // United States
  'united states': 'us', usa: 'us', 'united states of america': 'us', american: 'us',
  zda: 'us', amerika: 'us',
  // South Africa
  'south africa': 'za', 'juznoafriska republika': 'za', 'south african': 'za',
  'juzna afrika': 'za',
}

// Strips accents so "Švica" and "Nemčija" match plain-ASCII keys, then flattens punctuation.
function normalizeNationality(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// ---- "Welcome aboard" in the guest's own language -----------------------------------------
// ARRIVAL ONLY. The sentence says we are taking them TO the lodge, so on a departure voucher it
// would be plainly wrong — the departure branch deliberately gets no greeting.
//
// The language is derived from the same free-text nationality the flag uses. Two spellings carry
// a hint the country code cannot: a Swiss guest who writes "suisse" is French-speaking and one
// who writes "svizzera" Italian, so the spelling is checked before the country (Switzerland
// otherwise defaults to German, its majority language). South Africa and the anglophone
// countries fall back to English, as does every nationality we cannot place at all.
const NATIONALITY_LANGS: Record<string, string> = {
  ae: 'ar', at: 'de', au: 'en', br: 'pt', ch: 'de', de: 'de', es: 'es', fr: 'fr',
  gb: 'en', ie: 'en', it: 'it', lt: 'lt', mg: 'mg', nl: 'nl', pl: 'pl', pt: 'pt',
  se: 'sv', si: 'sl', us: 'en', za: 'en',
}
const SPELLING_LANGS: Record<string, string> = { suisse: 'fr', svizzera: 'it' }

// Phrased for two or more guests wherever the language distinguishes, because a transfer
// usually carries a couple and the plural form is the polite one for a single guest too.
const WELCOME_ABOARD: Record<string, string> = {
  en: 'Welcome aboard! We are taking you to Komba Cabana Lodge.',
  de: 'Willkommen an Bord! Wir bringen Sie zur Komba Cabana Lodge.',
  fr: 'Bienvenue à bord ! Nous vous emmenons au Komba Cabana Lodge.',
  it: 'Benvenuti a bordo! Vi portiamo al Komba Cabana Lodge.',
  es: '¡Bienvenidos a bordo! Les llevamos al Komba Cabana Lodge.',
  pt: 'Bem-vindos a bordo! Vamos levá-los ao Komba Cabana Lodge.',
  nl: 'Welkom aan boord! Wij brengen u naar Komba Cabana Lodge.',
  pl: 'Witamy na pokładzie! Zabieramy Państwa do Komba Cabana Lodge.',
  sv: 'Välkommen ombord! Vi tar er till Komba Cabana Lodge.',
  sl: 'Dobrodošli na krovu! Peljemo vas v Komba Cabana Lodge.',
  lt: 'Sveiki atvykę į laivą! Vežame jus į Komba Cabana Lodge.',
  mg: "Tonga soa an-tsambo! Entinay ianareo any amin'ny Komba Cabana Lodge.",
  ar: 'مرحبًا بكم على متن القارب! سنأخذكم إلى كومبا كابانا لودج.',
}

// Arabic is the only right-to-left line here; without dir="rtl" the punctuation lands wrongly
// around the Latin lodge name.
const RTL_LANGS = new Set(['ar'])

function welcomeAboard(nationality: string): { text: string; rtl: boolean } {
  const key = normalizeNationality(nationality)
  const lang = SPELLING_LANGS[key] || NATIONALITY_LANGS[NATIONALITY_CODES[key]] || 'en'
  return { text: WELCOME_ABOARD[lang] || WELCOME_ABOARD.en, rtl: RTL_LANGS.has(lang) }
}

// ---- Typography, lifted from the bungalow cards ------------------------------------------
// Measured on a live card rather than guessed: title Manrope 22px/600 with 0.01em tracking,
// overlines Inter 10px with 0.16em tracking at weight 400, emphasised labels (the HB chip) at
// weight 600, meta 11px. The elegance of that card is mostly the LIGHT weight on the tiny caps
// — this voucher previously set every overline to 700 with four different tracking values,
// which is what made it read as heavy next to the app.
//
// Webfonts in email are best-effort by nature: Apple Mail, iOS Mail and the public voucher page
// load them, Gmail and Outlook do not. Segoe UI comes next in the stack because it ships on
// Windows and is the closest humanist match, so Outlook degrades to that instead of to Times.
const FONT_DISPLAY = "'Manrope','Segoe UI',Tahoma,Arial,Helvetica,sans-serif"
const FONT_BODY = "'Inter','Segoe UI',Tahoma,Arial,Helvetica,sans-serif"

type VoucherData = {
  guestName: string
  guestTitle: string
  nationality: string
  bungalow: string
  type: TransferType
  routeName: string
  hermanRouteName: string
  legs: { tag: string; val: string }[]
  date: string
  time: string
  pickupPoint: string
  carPickupTime: string
  boatPortTime: string
  pax: number
  flightNumber: string
  guestPrice: number
  isPaid: boolean
}

async function buildVoucherData(
  reservationId: string,
  type: TransferType
): Promise<{ data: VoucherData; email: string } | { error: string }> {
  const reservation = await getReservationWithDetails(reservationId)
  if (!reservation) return { error: 'Rezervacija ni najdena.' }

  const transfer = type === 'arrival' ? reservation.transfers?.arrival : reservation.transfers?.departure
  if (!transfer) return { error: 'Za ta transfer ni podatkov.' }

  // Route names from the price list
  const dash = await getDashboardData()
  const routes: { id: string; name: string }[] = dash?.routes || []
  const routeName = routes.find(r => r.id === transfer.route)?.name || ''
  const hermanRouteName = transfer.hermanRouteId
    ? routes.find(r => r.id === transfer.hermanRouteId)?.name || ''
    : ''

  const legs = hermanRouteName
    ? (type === 'arrival'
        ? [{ tag: 'By car', val: hermanRouteName }, { tag: 'By boat', val: routeName }]
        : [{ tag: 'By boat', val: routeName }, { tag: 'By car', val: hermanRouteName }])
    : []

  const paymentStatus = transfer.paymentStatus || 'UNPAID'
  const data: VoucherData = {
    guestName: reservation.guestName || '',
    guestTitle: (reservation as { guestTitle?: string | null }).guestTitle || '',
    nationality: (reservation as { nationality?: string | null }).nationality || '',
    bungalow: reservation.bungalow ? bungalowDisplayName(reservation.bungalow) : '',
    type,
    routeName,
    hermanRouteName,
    legs,
    date: formatEmailDate(
      type === 'arrival'
        ? (transfer.pickupDate || reservation.arrival)
        : (transfer.pickupDate || reservation.departure)
    ),
    time: (type === 'arrival' ? transfer.flightTime : transfer.time) || transfer.time || '',
    pickupPoint: transfer.pickupPoint || '',
    carPickupTime: transfer.hermanAirportTime || '',
    boatPortTime: transfer.boatPortTime || '',
    pax: reservation.pax || 1,
    flightNumber: transfer.flightNumber || '',
    guestPrice: Number(transfer.guestPrice) || 0,
    isPaid: paymentStatus === 'PAID' || paymentStatus === 'PREPAID',
  }
  return { data, email: (reservation.email || '').trim() }
}

function buildVoucherEmailHtml(data: VoucherData): string {
  const logo = `${getPublicBaseUrl()}/images/komba-logo-gold.png`
  const title = data.type === 'arrival' ? 'Arrival Transfer' : 'Departure Transfer'
  // The arrival green is the measured pair of the departure terracotta: matched on SATURATION and
  // on PERCEPTUAL lightness (Lab L*), differing only in hue. Terracotta is 46% / L* 61.5; this
  // green is 47% / L* 63.4.
  //
  // Both earlier attempts failed on saturation, which is what "alive" actually comes from here:
  // sage #8fae92 was only 16% (dusty), and #53945a only 28% and darker than its pair (muddy).
  // Do NOT match HSL lightness instead — an HSL-exact mirror (#6bc882) measures 8.16:1 against
  // the badge's #0a2029 text versus terracotta's 5.57:1, so it would read far lighter than its pair.
  const badgeColor = data.type === 'arrival' ? '#3fae5a' : '#c8846b'

  // Boat-only transfers get the ship mark on the Route card. `legs` is only populated when a
  // Herman car leg exists, so an empty herman route means the whole trip is by boat.
  const boatOnly = !!data.routeName && !data.hermanRouteName
  // The boat flies the guest's flag: one animated GIF per country (icon-boat-<code>.gif), each a
  // ship with a mast and a flag that waves as the hull rocks. Unknown nationality falls back to
  // the plain ship. Same nationality mapping the flag row uses.
  const boatFlagCode = NATIONALITY_CODES[normalizeNationality(data.nationality)]
  const boatIcon = `${getPublicBaseUrl()}/images/icon-boat-${boatFlagCode && FLAGS[boatFlagCode] ? boatFlagCode : 'gold'}.gif`

  // Sand card palette — the same one the app uses for bungalow cards. Email clients handle
  // rgba() badly, so these are the FLATTENED solid equivalents of the app's alpha tokens
  // (#0f2e3a / #2b2622 laid over the #efe8da card). Do not swap them back for rgba().
  const SAND = '#efe8da' // card background
  const SAND_PANEL = '#f8f5ef' // raised panel on sand (notices)
  const SAND_BORDER = '#dcd5c6' // card border   — #0f2e3a @ 12%
  const INK = '#0f2e3a' // headings and values          — 11.7:1
  // The app's on-sand tones are tuned for 12–14px UI text. These overlines and labels are
  // 10–11px with wide letter-spacing, so the app's #8f6d3a gold (3.9:1) and 55% label
  // (3.3:1) turned mushy in print. Measured and darkened until every value clears 4.5:1.
  // Measured off a live bungalow card and matched to it, because that side-by-side is exactly
  // what the guest compares. The card sets its muted tones as #2b2622 at 50/55/65% alpha over
  // the sand; these are the flat equivalents (rgba is unreliable in mail). This deliberately
  // REPLACES the earlier darkened set — the extra contrast made the voucher read heavier and
  // colder than the app, which is what prompted the change.
  const INK_SOFT = '#837d75' // labels        = card #2b2622 @ 55% — 3.3:1
  const INK_BODY = '#706a62' // body copy     = card #2b2622 @ 65% — 4.4:1
  const GOLD_SAND = '#8f6d3a' // overlines    = the app's own gold  — 3.9:1
  const SAGE_SAND = '#4f7a54' // paid state   = the app's own sage  — 4.9:1
  // The leg tag is the one place gold is a BACKGROUND rather than text: it carries near-white
  // type, so it keeps the darker tone (5.4:1 against the panel; #8f6d3a would drop it to 4.4).
  const GOLD_TAG = '#7d5f31'

  // Bungalow-card architecture, carried over to the voucher: a 3px vertical rail down the left
  // edge and a gold hairline under the card title. These are GRAPHIC elements, not small text,
  // so they keep the app's own #8f6d3a gold rather than the darkened GOLD_SAND used for 10px
  // overlines. The hairline is the flattened equivalent of the app's #8f6d3a @ 35% over sand.
  const GOLD_RAIL = '#8f6d3a' // 3px left rail
  const GOLD_HAIRLINE = '#cdbda2' // rule under the card title

  // Guests are stored without a salutation because the name is printed all over the app;
  // the voucher is the one place that addresses them formally.
  const guestFull = [data.guestTitle, data.guestName].filter(Boolean).join(' ')
  // The guest's flag no longer sits before the name — it now flies on the boat's mast (see
  // boatFlagCode above), so the Guest row shows just the enlarged name.

  // Arrival only — see WELCOME_ABOARD. Set upright rather than italic: the bungalow cards use no
  // italics anywhere, and mail clients without the italic cut synthesise a sheared face that
  // looks like a rendering fault. No trailing icon — the greeting stands on its own.
  const welcome = data.type === 'arrival' ? welcomeAboard(data.nationality) : null
  const welcomeHtml = welcome
    ? `<div${welcome.rtl ? ' dir="rtl"' : ''} style="font-family:${FONT_BODY};font-size:13px;font-weight:400;line-height:19px;color:${INK};text-align:${welcome.rtl ? 'right' : 'left'};">${escapeHtml(welcome.text)}</div>`
    : ''

  // The same `time` field holds a flight landing for airport arrivals and a plain meeting time
  // for guests we collect at a port, so the label has to be derived, not fixed.
  //
  // Read it off the ROUTE NAMES, never off flightNumber: measured in the live data, 14 of 22
  // airport transfers have no flight number, while every port arrival has a time in this field
  // and no number at all. Both legs are checked because on a car+boat arrival the airport leg
  // sits in Herman's route while the main route reads "Big port Nosy be - Komba Cabana".
  const isFlightArrival =
    !!data.flightNumber.trim() ||
    /airport|fascene/i.test(`${data.routeName} ${data.hermanRouteName}`)
  const timeLabel = data.type === 'arrival' ? (isFlightArrival ? 'Flight arrival' : 'Pick-up time') : 'Departure time'

  const legsHtml = data.legs.length
    ? // No divider of its own: the gold hairline under the route name already separates the legs.
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:4px;">
        ${data.legs
          .map(
            (l) => `<tr><td style="padding:10px 0 0 0;">
              <span style="display:inline-block;font-family:${FONT_BODY};font-size:10px;font-weight:600;letter-spacing:1.6px;text-transform:uppercase;color:${SAND_PANEL};background:${GOLD_TAG};padding:3px 9px;border-radius:5px;">${escapeHtml(l.tag)}</span>
              <span style="font-family:${FONT_BODY};font-size:14px;color:${INK};padding-left:10px;">${escapeHtml(l.val)}</span>
            </td></tr>`
          )
          .join('')}
      </table>`
    : ''

  // `prefixHtml` is inserted raw (it is our own markup, e.g. the flag image); `value` stays escaped.
  const infoRow = (label: string, value: string, prefixHtml = '', valueColor: string = INK, valueSize = 13) =>
    value
      ? `<tr>
          <td style="padding:6px 0;font-family:${FONT_BODY};font-size:13px;color:${INK_SOFT};">${escapeHtml(label)}</td>
          <td align="right" style="padding:6px 0;font-family:${FONT_BODY};font-size:${valueSize}px;color:${valueColor};font-weight:400;">${prefixHtml}${escapeHtml(value)}</td>
        </tr>`
      : ''

  // Aerial photo of the walk along the pier at Port de Nosy Be. It is a photo of THAT
  // pier, so it only makes sense when the guest is actually collected there — showing it
  // for a hotel pick-up would send them to the wrong place. Hence the 'port' test rather
  // than "print it whenever a pick-up point exists".
  const showPickupMap = data.type === 'arrival' && /port/i.test(data.pickupPoint)
  const pickupMapHtml = showPickupMap
    ? `<tr><td bgcolor="#0a2029" style="background-color:#0a2029;padding:8px 16px 0 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${SAND}" style="background-color:${SAND};border:1px solid ${SAND_BORDER};border-left:3px solid ${GOLD_RAIL};border-radius:16px;">
          <tr><td style="padding:14px 14px 12px 14px;">
            <p style="margin:0 0 10px 2px;font-family:${FONT_BODY};font-size:10px;font-weight:400;letter-spacing:1.6px;text-transform:uppercase;color:${GOLD_SAND};">Where we meet you</p>
            <!-- Kratek alt je NAMEREN: oba odstavka pod sliko povesta celo pot in taksi, zato
                 alt ni edini vir. Dolg alt je ob blokirani/nenaloženi sliki izpadel kot packa. -->
            <img src="${getPublicBaseUrl()}/images/pickup-point-nosy-be.jpg" width="500" alt="Map: our meeting point at Port de Nosy Be" style="display:block;border:0;outline:none;text-decoration:none;width:100%;max-width:500px;height:auto;border-radius:10px;">
            <p style="margin:10px 2px 0 2px;font-family:${FONT_BODY};font-size:12px;line-height:17px;color:${INK_BODY};">Follow the red arrow &mdash; walk along the pier towards the water. Our boat waits at the far end, near <span style="color:${INK};font-weight:600;">Port de Nosy Be</span>.</p>
            <p style="margin:8px 2px 0 2px;font-family:${FONT_BODY};font-size:12px;line-height:17px;color:${INK_BODY};"><span style="color:${INK};font-weight:600;">Coming by taxi?</span> Taxis are allowed inside the port, so you do not need to walk. Ask your driver to take you all the way to the boats at Port de Nosy Be &mdash; that is our meeting point.</p>
          </td></tr>
        </table>
      </td></tr>`
    : ''

  // Payment notice. Both states are a raised sand panel whose LEFT RAIL carries the semantic
  // colour, so the reassuring case and the "still to pay" case read as the same family — an
  // outlined dark box read as a warning even when paid. The rail sits on the left rather than
  // the top so it matches the other cards; on bungalow cards the rail is what carries status.
  const statusNote = (accent: string, overline: string, body: string) =>
    `<tr><td bgcolor="#0a2029" style="background-color:#0a2029;padding:12px 16px 0 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${SAND_PANEL}" style="background-color:${SAND_PANEL};border:1px solid ${SAND_BORDER};border-left:3px solid ${accent};border-radius:16px;">
          <tr><td align="center" style="padding:14px 18px;">
            <p style="margin:0 0 5px 0;font-family:${FONT_BODY};font-size:10px;font-weight:400;letter-spacing:1.6px;text-transform:uppercase;color:${accent};">${escapeHtml(overline)}</p>
            <p style="margin:0;font-family:${FONT_BODY};font-size:11px;line-height:16px;color:${INK_BODY};">${body}</p>
          </td></tr>
        </table>
      </td></tr>`

  const statusHtml = data.isPaid
    ? statusNote(SAGE_SAND, 'Paid', 'This transfer has been paid in full &mdash; nothing further to settle.')
    : statusNote(
        GOLD_SAND,
        'Payable at checkout',
        'This transfer is not paid yet. It will be added to your final bill and settled when you check out.'
      )

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<!-- Guarded from Outlook, whose Word engine chokes on <link> and cannot use webfonts anyway; it
     falls back to Segoe UI from the font stacks. Apple Mail, iOS Mail and the public voucher
     page do load these, which is where the card's typography actually comes through. -->
<!--[if !mso]><!-->
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@500;600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<!--<![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#0a2029;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#0a2029" style="background-color:#0a2029;">
    <tr><td align="center" bgcolor="#0a2029" style="background-color:#0a2029;padding:32px 16px;">
      <!--[if mso]><table role="presentation" width="560" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
      <!-- Fluid shell: full width on phones (no horizontal scroll), capped at 560px on desktop.
           MSO ghost table above pins 560px for Outlook, which ignores max-width. -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#0a2029" style="width:100%;max-width:560px;background-color:#0a2029;">
        <tr><td align="center" bgcolor="#0a2029" style="background-color:#0a2029;padding:8px 0 20px 0;">
          <img src="${logo}" alt="Komba Cabana" width="140" style="display:block;border:0;outline:none;max-width:140px;height:auto;">
        </td></tr>
        <tr><td align="center" bgcolor="#0a2029" style="background-color:#0a2029;padding:0 8px 6px 8px;">
          <span style="display:inline-block;font-family:${FONT_BODY};font-size:10px;font-weight:600;letter-spacing:1.6px;text-transform:uppercase;color:#0a2029;background:${badgeColor};padding:4px 12px;border-radius:6px;">${escapeHtml(title)}</span>
        </td></tr>
        <tr><td align="center" bgcolor="#0a2029" style="background-color:#0a2029;padding:8px 8px 4px 8px;">
          <h1 style="margin:0;font-family:${FONT_DISPLAY};font-size:24px;font-weight:600;letter-spacing:0.24px;color:#c59b5b;">Transfer Voucher</h1>
        </td></tr>
        <tr><td align="center" bgcolor="#0a2029" style="background-color:#0a2029;padding:0 16px 8px 16px;">
          <p style="margin:0;font-family:${FONT_BODY};font-size:14px;line-height:1.6;color:#b9c6ca;text-align:center;">Dear ${escapeHtml(guestFull || 'guest')}, here are the details of your transfer with us.</p>
        </td></tr>

        ${(data.routeName || data.legs.length)
          ? `<tr><td bgcolor="#0a2029" style="background-color:#0a2029;padding:8px 16px 0 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${SAND}" style="background-color:${SAND};border:1px solid ${SAND_BORDER};border-left:3px solid ${GOLD_RAIL};border-radius:16px;">
            <tr><td style="padding:20px 22px ${welcomeHtml ? '14px' : '20px'} 22px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
                <td valign="middle" style="vertical-align:middle;">
                  <div style="font-family:${FONT_BODY};font-size:10px;font-weight:400;letter-spacing:1.6px;color:${GOLD_SAND};text-transform:uppercase;">Route</div>
                  ${data.routeName ? `<div style="font-family:${FONT_DISPLAY};font-size:16px;font-weight:600;letter-spacing:0.16px;color:${INK};margin-top:6px;">${escapeHtml(data.routeName)}</div>` : ''}
                  <div style="height:1px;line-height:1px;font-size:0;margin-top:10px;background-color:${GOLD_HAIRLINE};">&nbsp;</div>
                  ${legsHtml}
                </td>
                ${boatOnly
                  ? `<td width="100" align="right" valign="middle" style="width:100px;vertical-align:middle;padding-left:16px;">
                  <!-- PNG, not inline SVG: Gmail strips inline SVG from email bodies. The shape is
                       lucide Ship — the very icon the app uses for transfers — rasterised onto a
                       flat sand background so no client has to handle alpha. Displayed at 100px
                       from a 120px source (downscale keeps it crisp) per the user's request to
                       enlarge it. -->
                  <img src="${boatIcon}" alt="By boat" width="100" height="100" style="display:block;border:0;outline:none;text-decoration:none;width:100px;height:100px;">
                </td>`
                  : ''}
              </tr></table>
            </td></tr>
            ${welcomeHtml ? `<tr><td style="padding:0 22px 18px 22px;">${welcomeHtml}</td></tr>` : ''}
          </table>
        </td></tr>`
          : ''}

        <tr><td bgcolor="#0a2029" style="background-color:#0a2029;padding:8px 16px 0 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${SAND}" style="background-color:${SAND};border:1px solid ${SAND_BORDER};border-left:3px solid ${GOLD_RAIL};border-radius:16px;">
            <tr><td style="padding:12px 22px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${infoRow('Guest', guestFull, '', INK, 17)}
                ${infoRow('Date', data.date, '', '#4f7a54')}
                ${infoRow(timeLabel, data.time, '', '#b0203a')}
                ${infoRow('Pick-up point', data.pickupPoint, '', '#1f6f96')}
                ${infoRow('Car pick-up (Herman)', data.carPickupTime)}
                ${infoRow('Boat at port', data.boatPortTime)}
                ${infoRow('Passengers', `${data.pax} ${data.pax === 1 ? 'person' : 'persons'}`)}
                ${infoRow('Flight', data.flightNumber)}
              </table>
            </td></tr>
          </table>
        </td></tr>

        ${pickupMapHtml}

        ${statusHtml}

        <tr><td align="center" bgcolor="#0a2029" style="background-color:#0a2029;padding:24px 16px 8px 16px;">
          <p style="margin:0 0 6px 0;font-family:${FONT_BODY};font-size:13px;color:#cdd3d1;">For all information, please contact us at <a href="mailto:info@kombacabana.com" style="color:#c59b5b;text-decoration:none;font-weight:bold;">info@kombacabana.com</a></p>
          <p style="margin:0;font-family:${FONT_BODY};font-size:12px;color:#7e786d;">Komba Cabana &middot; Nosy Komba, Madagascar</p>
        </td></tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td></tr>
  </table>
</body>
</html>`
}

// Returns the rendered voucher email HTML for an in-app preview (no sending).
export async function getTransferVoucherEmailPreview(
  reservationId: string,
  type: TransferType
): Promise<{ html?: string; to?: string; error?: string }> {
  const built = await buildVoucherData(reservationId, type)
  if ('error' in built) return { error: built.error }
  return { html: buildVoucherEmailHtml(built.data), to: built.email }
}

export async function sendTransferVoucherEmail(
  reservationId: string,
  type: TransferType,
  toEmail?: string
): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { success: false, error: 'E-pošta še ni nastavljena (manjka RESEND_API_KEY).' }

  const built = await buildVoucherData(reservationId, type)
  if ('error' in built) return { success: false, error: built.error }
  const { data, email } = built

  const to = (toEmail || email || '').trim()
  if (!to) return { success: false, error: 'Gost nima vpisanega email naslova.' }

  const html = buildVoucherEmailHtml(data)
  const from = process.env.EMAIL_FROM || 'Komba Cabana <info@kombacabana.app>'
  const subject =
    data.type === 'arrival'
      ? 'Your arrival transfer — Komba Cabana'
      : 'Your departure transfer — Komba Cabana'

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
      type: 'voucher',
      recipient: to,
      subject,
      guestName: data.guestName || null,
      bungalow: data.bungalow || null,
    })
    return { success: true }
  } catch (e) {
    return { success: false, error: `Napaka pri pošiljanju: ${(e as Error).message}` }
  }
}
