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

export type PendingLineNote = { note: string; onInvoice: boolean }

/**
 * Text on the payment line. A note she just saved wins over a stale reload
 * that has not caught up yet. No pending value means "use what is stored".
 */
export function shownLineNote(
  storedNote: string | null | undefined,
  storedOnInvoice: boolean | null | undefined,
  pending?: PendingLineNote | null,
): { note: string; onInvoice: boolean } {
  if (pending) {
    const note = pending.note.trim()
    return { note, onInvoice: note.length > 0 && pending.onInvoice === true }
  }
  const note = (storedNote ?? '').trim()
  return { note, onInvoice: note.length > 0 && storedOnInvoice === true }
}

/** Opomba opens an empty note. Popravi opens one that is already stored. */
export function lineNoteButtonLabel(note: string | null | undefined): 'Opomba' | 'Popravi' {
  return (note ?? '').trim() ? 'Popravi' : 'Opomba'
}
