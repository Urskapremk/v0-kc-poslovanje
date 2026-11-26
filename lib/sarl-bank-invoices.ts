// Issued guest invoices whose payment is a bank transfer onto KOMBA CABANA SARL
// (account 00026 03074120101 87, BMOI). A row exists only when that payment
// matches one stored SARL credit. Tourism, Orange Money, cash and card payments
// never reach this list. The amount is the EUR that hit SARL, not the invoice total.

const LODGE_TIME_ZONE = 'Indian/Antananarivo'
const MIN_BANK_RATE = 4500
const MAX_BANK_RATE = 5300
const NAME_MATCH_DAYS = 21

const NAME_STOP = new Set([
  'RPT', 'ORDRE', 'VIREMENT', 'NAKAZILO', 'STRANKE', 'PAYMENTS', 'PAYMENT',
  'AIRBNB', 'MONSIEUR', 'MADAME', 'VALUTA', 'EURO', 'BANK', 'TRANSFER',
  'BANCNI', 'COMPTE', 'SOLDE', 'FROM', 'POUR', 'TRAVEL', 'LTD', 'SARL',
  'KOMBA', 'CABANA', 'DORDRE',
])

export type SarlBankLine = {
  id: string
  date: string
  description: string
  amountAr: number
}

export type SarlInvoiceCandidate = {
  paymentId: string
  reservationId: string
  guestName: string
  invoiceNumber: string
  method: string
  amountEur: number
  paidAt: string
  notes: string | null
  // Lodge calendar days (YYYY-MM-DD). Empty when that event did not happen.
  checkedOutAt: string
  invoiceEmailedAt: string
}

export type SarlBankInvoiceRow = {
  paymentId: string
  reservationId: string
  invoiceNumber: string
  invoiceDate: string
  guestName: string
  amountEur: number
  paymentDate: string
  bankReference: string | null
}

export function isBankTransferMethod(method: string) {
  return method.trim().toLowerCase() === 'transfer'
}

export function bankReference(text: string): string | null {
  const found = text.toUpperCase().match(/RPT\d{5,}/)
  return found ? found[0] : null
}

export function listSarlBankInvoices(
  candidates: SarlInvoiceCandidate[],
  lines: SarlBankLine[],
  year: number,
): SarlBankInvoiceRow[] {
  const usable = lines
    .map(prepareLine)
    .filter((line): line is PreparedLine => line != null && !line.foreign)

  const issued = candidates
    .filter((row) => isBankTransferMethod(row.method))
    .map((row) => {
      const invoiceDate = row.checkedOutAt || row.invoiceEmailedAt
      return invoiceDate ? { ...row, invoiceDate, amountEur: roundEur(row.amountEur) } : null
    })
    .filter((row): row is IssuedPayment => row != null && row.amountEur > 0)

  const usedPayments = new Set<string>()
  const usedLines = new Set<string>()
  const matched: { payment: IssuedPayment; line: PreparedLine }[] = []

  for (const payment of issued) {
    const codes = rptCodes(payment.notes || '')
    if (codes.length === 0) continue
    const line = usable.find((item) => item.reference != null && !usedLines.has(item.id) && codes.includes(item.reference) && amountAgrees(payment, item))
    // A reference that is not on an unused SARL credit stays off this list.
    // It is not paired with a different SARL line by name.
    usedPayments.add(payment.paymentId)
    if (!line) continue
    usedLines.add(line.id)
    matched.push({ payment, line })
  }

  const pairs: { payment: IssuedPayment; line: PreparedLine; days: number }[] = []
  for (const payment of issued) {
    if (usedPayments.has(payment.paymentId)) continue
    for (const line of usable) {
      if (usedLines.has(line.id)) continue
      if (!namesMatch(payment.guestName, line.description)) continue
      if (!amountAgrees(payment, line)) continue
      const days = daysApart(payment.paidAt, line.date)
      if (days > NAME_MATCH_DAYS) continue
      pairs.push({ payment, line, days })
    }
  }
  pairs.sort((a, b) => a.days - b.days || a.payment.paymentId.localeCompare(b.payment.paymentId) || a.line.id.localeCompare(b.line.id))
  for (const pair of pairs) {
    if (usedPayments.has(pair.payment.paymentId) || usedLines.has(pair.line.id)) continue
    usedPayments.add(pair.payment.paymentId)
    usedLines.add(pair.line.id)
    matched.push(pair)
  }

  return matched
    .filter((item) => item.payment.invoiceDate.startsWith(`${year}-`))
    .map((item) => ({
      paymentId: item.payment.paymentId,
      reservationId: item.payment.reservationId,
      invoiceNumber: item.payment.invoiceNumber,
      invoiceDate: item.payment.invoiceDate,
      guestName: item.payment.guestName,
      amountEur: item.line.eur ?? item.payment.amountEur,
      paymentDate: item.payment.paidAt || item.line.date,
      bankReference: item.line.reference,
    }))
    .sort((a, b) => (
      a.invoiceDate.localeCompare(b.invoiceDate)
      || a.guestName.localeCompare(b.guestName, 'sl')
      || a.paymentDate.localeCompare(b.paymentDate)
      || a.invoiceNumber.localeCompare(b.invoiceNumber)
    ))
}

export function lodgeDay(value: Date | string | null | undefined): string {
  if (value == null || value === '') return ''
  if (typeof value === 'string') {
    const day = value.match(/^(\d{4}-\d{2}-\d{2})/)
    if (day && !value.includes('T')) return day[1]
  }
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: LODGE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

type IssuedPayment = SarlInvoiceCandidate & { invoiceDate: string }

type PreparedLine = {
  id: string
  date: string
  description: string
  amountAr: number
  eur: number | null
  reference: string | null
  foreign: boolean
}

function prepareLine(line: SarlBankLine): PreparedLine | null {
  const date = lodgeDay(line.date)
  if (!date || !(line.amountAr > 0)) return null
  const stated = statedMoney(line.description)
  return {
    id: line.id,
    date,
    description: line.description,
    amountAr: line.amountAr,
    eur: stated?.currency === 'EUR' ? stated.amount : null,
    reference: bankReference(line.description),
    foreign: stated != null && stated.currency !== 'EUR',
  }
}

function statedMoney(description: string): { amount: number; currency: string } | null {
  const match = description.match(/\(\s*(\d{1,3}(?:[ .]\d{3})*|\d+)(?:,(\d{1,2}))?\s*([A-Z]{3})\s*\)/i)
  if (!match) return null
  const whole = match[1].replace(/[ .]/g, '')
  const fraction = (match[2] || '0').padEnd(2, '0').slice(0, 2)
  const amount = Number(`${whole}.${fraction}`)
  if (!Number.isFinite(amount)) return null
  return { amount, currency: match[3].toUpperCase() }
}

function rptCodes(text: string): string[] {
  return [...text.toUpperCase().matchAll(/RPT\d{5,}/g)].map((match) => match[0])
}

function amountAgrees(payment: IssuedPayment, line: PreparedLine) {
  if (!(payment.amountEur > 0)) return false
  if (line.eur != null) return Math.abs(line.eur - payment.amountEur) < 0.02
  const rate = line.amountAr / payment.amountEur
  return rate >= MIN_BANK_RATE && rate <= MAX_BANK_RATE
}

function roundEur(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100
}

function daysApart(a: string, b: string) {
  const left = Date.parse(`${a}T00:00:00Z`)
  const right = Date.parse(`${b}T00:00:00Z`)
  if (Number.isNaN(left) || Number.isNaN(right)) return 999
  return Math.abs(left - right) / 86400000
}

function namesMatch(guestName: string, description: string) {
  const guest = nameTokens(guestName)
  const line = nameTokens(description)
  if (guest.length === 0 || line.length === 0) return false
  const long = guest.filter((token) => token.length >= 6)
  const required = long.length > 0 ? long : guest.filter((token) => token.length >= 5)
  const pool = required.length > 0 ? required : guest
  return pool.some((token) => line.some((other) => tokenClose(token, other)))
}

function nameTokens(value: string) {
  const normalized = value.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase()
  return normalized.split(/[^A-Z]+/).filter((token) => token.length >= 4 && !NAME_STOP.has(token))
}

function tokenClose(a: string, b: string) {
  if (a === b) return true
  if (a.length < 6 || b.length < 6) return false
  return editDistance(a, b) <= 1
}

function editDistance(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, index) => index)
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const current = row[j]
      row[j] = a[i - 1] === b[j - 1] ? previous : Math.min(previous, row[j], row[j - 1]) + 1
      previous = current
    }
  }
  return row[b.length]
}
