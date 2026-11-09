/** Short staff note on one invoice line. Off the guest invoice until she says yes. */

export const LINE_NOTE_MAX = 280

export function prepareLineNote(
  raw: string,
  onInvoice: boolean,
): { note: string | null; onInvoice: boolean } {
  const note = raw.trim().slice(0, LINE_NOTE_MAX)
  if (!note) return { note: null, onInvoice: false }
  return { note, onInvoice: onInvoice === true }
}

/** Text that prints under the line. Empty, and anything not marked for the invoice, stays in the app. */
export function guestInvoiceLineNote(
  note: string | null | undefined,
  onInvoice: boolean | null | undefined,
): string | null {
  const text = (note ?? '').trim()
  if (!text || onInvoice !== true) return null
  return text
}

/** Arrival/departure mirrors are order lines named "Transfer ARRIVAL:" / "Transfer DEPARTURE:". */
export function transferMirrorDirection(name: string | null | undefined): 'arrival' | 'departure' | null {
  if (/^Transfer ARRIVAL:/i.test(name || '')) return 'arrival'
  if (/^Transfer DEPARTURE:/i.test(name || '')) return 'departure'
  return null
}
