// Odstrani on "Postavke za placilo" deletes the button that currently has focus.
// Once that node is gone, the browser moves focus to the document and scrolls
// the page (and the list) to the top. These helpers park focus on a neighboring
// line and put the scroll position back after the row disappears.

export const PAYMENT_LINES_ATTR = "data-payment-lines"
export const PAYMENT_LINE_ATTR = "data-payment-line"

/** Next line in visual order, or the previous one when the removed line was last. */
export function neighborLineId(lineIds: readonly string[], removedId: string): string | null {
  const index = lineIds.indexOf(removedId)
  if (index < 0) return null
  return lineIds[index + 1] ?? lineIds[index - 1] ?? null
}

export type PaymentListPlace = {
  windowX: number
  windowY: number
  listTop: number
  listLeft: number
  ancestors: { el: HTMLElement; top: number; left: number }[]
  focusId: string | null
  removedId: string
}

function lineSelector(id: string): string {
  const escaped = typeof CSS !== "undefined" && typeof CSS.escape === "function"
    ? CSS.escape(id)
    : id.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
  return `[${PAYMENT_LINE_ATTR}="${escaped}"]`
}

export function capturePaymentListPlace(from: HTMLElement, removedId: string): PaymentListPlace {
  const list = from.closest<HTMLElement>(`[${PAYMENT_LINES_ATTR}]`)
  const lines = list ? Array.from(list.querySelectorAll<HTMLElement>(`[${PAYMENT_LINE_ATTR}]`)) : []
  const focusId = neighborLineId(
    lines.map((el) => el.getAttribute(PAYMENT_LINE_ATTR) || ""),
    removedId,
  )
  const ancestors: PaymentListPlace["ancestors"] = []
  let node = list?.parentElement ?? null
  while (node && node !== document.body && node !== document.documentElement) {
    const canScroll = node.scrollHeight > node.clientHeight + 1 || node.scrollWidth > node.clientWidth + 1
    if (canScroll) ancestors.push({ el: node, top: node.scrollTop, left: node.scrollLeft })
    node = node.parentElement
  }
  const place: PaymentListPlace = {
    windowX: window.scrollX,
    windowY: window.scrollY,
    listTop: list?.scrollTop ?? 0,
    listLeft: list?.scrollLeft ?? 0,
    ancestors,
    focusId,
    removedId,
  }
  const focusEl = (focusId ? list?.querySelector<HTMLElement>(lineSelector(focusId)) : null) || list
  focusEl?.focus({ preventScroll: true })
  return place
}

export function restorePaymentListPlace(place: PaymentListPlace) {
  window.scrollTo(place.windowX, place.windowY)
  const list = document.querySelector<HTMLElement>(`[${PAYMENT_LINES_ATTR}]`)
  if (list) {
    list.scrollTop = place.listTop
    list.scrollLeft = place.listLeft
  }
  for (const ancestor of place.ancestors) {
    if (!ancestor.el.isConnected) continue
    ancestor.el.scrollTop = ancestor.top
    ancestor.el.scrollLeft = ancestor.left
  }
  const focusEl = place.focusId
    ? document.querySelector<HTMLElement>(lineSelector(place.focusId))
    : list
  if (focusEl && document.activeElement !== focusEl && !focusEl.contains(document.activeElement)) {
    focusEl.focus({ preventScroll: true })
  }
}
