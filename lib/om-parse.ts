import { resolveContactName, type Contact } from '@/lib/phone-directory'

/* Razčlemba surovih SMS obvestil Orange Money v IZHODNA nakazila.
 * Sinhrona logika (zato v lib/, ne v 'use server' akciji). */

export type ParsedTransfer = {
  id: string
  transferDate: string | null
  amount: number
  fees: number | null
  recipientNumber: string
  recipientName: string | null
  transId: string | null
  rawText: string
}

function toInt(s: string): number {
  return parseInt(s.replace(/\D/g, ''), 10) || 0
}

/** Datum iz TransId (npr. PP260129.0909.A… → 2026-01-29) ali null. */
function dateFromTransId(transId: string | null): string | null {
  if (!transId) return null
  const m = transId.match(/^[A-Za-z]{2}(\d{2})(\d{2})(\d{2})\./)
  if (!m) return null
  const [, yy, mm, dd] = m
  const mi = parseInt(mm, 10)
  const di = parseInt(dd, 10)
  if (mi < 1 || mi > 12 || di < 1 || di > 31) return null
  return `20${yy}-${mm}-${dd}`
}

/**
 * Razčleni surova SMS obvestila v izhodna nakazila. Deljeno po
 * "Orange Money vous remercie"; v vsakem kosu iščemo "transfert … vers le …".
 */
export function parseOmTransfers(rawText: string, contacts?: Contact[]): ParsedTransfer[] {
  const chunks = rawText
    .split(/orange money vous remercie/i)
    .map((c) => c.trim())
    .filter(Boolean)

  const out: ParsedTransfer[] = []
  for (const chunk of chunks) {
    // Samo IZHODNA nakazila: "Votre transfert de … vers le NUMBER"
    const t = chunk.match(/transfert de\s*([\d\s.,]+?)\s*ar\s*vers\s*le\s*(\d{7,15})/i)
    if (!t) continue
    const amount = toInt(t[1])
    const recipientNumber = t[2]
    if (amount <= 0 || !recipientNumber) continue

    const feeM = chunk.match(/frais\s*:?\s*([\d\s.,]+?)\s*ar/i)
    const fees = feeM ? toInt(feeM[1]) : null

    const idM = chunk.match(/trans\s*id\s*:?\s*([A-Za-z0-9.]+)/i)
    const transId = idM ? idM[1].replace(/\.$/, '') : null

    const explicitDate = chunk.match(/date\s*:?\s*(\d{4}-\d{2}-\d{2})/i)
    const transferDate = explicitDate ? explicitDate[1] : dateFromTransId(transId)

    // Deterministični id → ponovno lepljenje istega SMS ne ustvari dvojnika.
    const id = transId
      ? `omt-${transId}`
      : `omt-${transferDate ?? 'x'}-${amount}-${recipientNumber.slice(-4)}`

    out.push({
      id,
      transferDate,
      amount,
      fees,
      recipientNumber,
      recipientName: resolveContactName(recipientNumber, contacts),
      transId,
      rawText: chunk.replace(/\s+/g, ' ').trim(),
    })
  }
  return out
}

/* ── Seznam prejetih nakazil (prilivi) — referenčni seznam ────────────────
 * Zajame VSA prejeta nakazila (transfert reçu):
 *  - mednarodna: "recu un transfert international de X AR de la part de +NUMBER"
 *  - domača:     "reçu un transfert de X AR venant du NUMBER [: IME]"
 * Ne vpliva na saldo (kot Seznam nakazil za odlive). */

export type ParsedIncomingList = {
  id: string
  transferDate: string | null
  amount: number
  senderNumber: string
  senderName: string | null
  transId: string | null
  rawText: string
}

export function parseOmIncomingList(rawText: string, contacts?: Contact[]): ParsedIncomingList[] {
  const chunks = rawText
    .split(/orange money vous remercie/i)
    .map((c) => c.trim())
    .filter(Boolean)

  const out: ParsedIncomingList[] = []
  for (const chunk of chunks) {
    let amount = 0
    let senderNumber = ''
    let labelName: string | null = null

    // Mednarodno prejeto nakazilo
    const intl = chunk.match(/re[cç]u un transfert(?:\s+international)?\s+de\s*([\d\s.,]+?)\s*ar\s+de la part de\s*(\+?[\d\s]{7,20})/i)
    // Domače prejeto nakazilo: "... venant du NUMBER [ : IME]"
    const dom = chunk.match(/re[cç]u un transfert\s+de\s*([\d\s.,]+?)\s*ar\s+venant du\s*(\d{7,15})\s*(?::\s*([^.\n]+?)\s*\.)?/i)

    if (intl) {
      amount = toInt(intl[1])
      senderNumber = intl[2].replace(/\s/g, '')
    } else if (dom) {
      amount = toInt(dom[1])
      senderNumber = dom[2]
      labelName = dom[3] ? dom[3].trim() : null
    } else {
      continue
    }
    if (amount <= 0 || !senderNumber) continue

    const idM = chunk.match(/trans\s*id\s*:?\s*([A-Za-z0-9.]+)/i)
    const transId = idM ? idM[1].replace(/\.$/, '') : null

    const explicitDate = chunk.match(/date\s*:?\s*(\d{4}-\d{2}-\d{2})/i)
    const transferDate = explicitDate ? explicitDate[1] : dateFromTransId(transId)

    const id = transId
      ? `omin-${transId}`
      : `omin-${transferDate ?? 'x'}-${amount}-${senderNumber.slice(-4)}`

    // Ime: najprej iz imenika (po številki), sicer oznaka iz SMS (npr. "Boss", "Tips")
    const resolved = resolveContactName(senderNumber, contacts)
    out.push({
      id,
      transferDate,
      amount,
      senderNumber,
      senderName: resolved ?? labelName,
      transId,
      rawText: chunk.replace(/\s+/g, ' ').trim(),
    })
  }
  return out
}

/* ── Prejeta nakazila (prilivi v denarnico) ──────────────────────────────
 * SMS: "Vous avez recu un transfert international de 2144583 AR de la part de
 * +262692282610. Votre nouveau solde est : 3601270 AR. Trans Id : f9afd2e7.
 * Orange Money vous remercie." → priliv v denarnico (direction in). */

export type ParsedIncoming = {
  id: string
  amount: number
  senderNumber: string | null
  senderName: string | null
  transId: string | null
  newBalance: number | null
  rawText: string
}

export function parseOmIncoming(rawText: string, contacts?: Contact[]): ParsedIncoming[] {
  const chunks = rawText
    .split(/orange money vous remercie/i)
    .map((c) => c.trim())
    .filter(Boolean)

  const out: ParsedIncoming[] = []
  for (const chunk of chunks) {
    // Prejeto nakazilo: "recu un transfert [international] de X AR de la part de NUMBER"
    const m = chunk.match(/re[cç]u un transfert(?:\s+international)?\s+de\s*([\d\s.,]+?)\s*ar\s+de la part de\s*(\+?[\d\s]{7,20})/i)
    if (!m) continue
    const amount = toInt(m[1])
    if (amount <= 0) continue
    const senderNumber = m[2].replace(/\s/g, '')

    const idM = chunk.match(/trans\s*id\s*:?\s*([A-Za-z0-9]+)/i)
    const transId = idM ? idM[1] : null

    const balM = chunk.match(/nouveau solde\s*(?:est)?\s*:?\s*([\d\s.,]+?)\s*ar/i)
    const newBalance = balM ? toInt(balM[1]) : null

    const id = transId
      ? `omi-${transId}`
      : `omi-${amount}-${senderNumber.slice(-4)}`

    out.push({
      id,
      amount,
      senderNumber,
      senderName: resolveContactName(senderNumber, contacts),
      transId,
      newBalance,
      rawText: chunk.replace(/\s+/g, ' ').trim(),
    })
  }
  return out
}
