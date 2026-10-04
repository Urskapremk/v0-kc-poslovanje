// Start date for a reprinted schedule. Past days stay off the paper.

export function monthDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function monthLastDay(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

// Today, when that day is inside the month on screen. Otherwise the 1st.
export function defaultPrintFrom(year: number, month: number, today = new Date()): string {
  const y = today.getFullYear()
  const m = today.getMonth() + 1
  const d = today.getDate()
  if (y === year && m === month) return monthDate(year, month, d)
  return monthDate(year, month, 1)
}

// Keep the chosen day inside the month being printed.
export function clampPrintFrom(value: string, year: number, month: number): string {
  const first = monthDate(year, month, 1)
  const last = monthDate(year, month, monthLastDay(year, month))
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return first
  if (value < first) return first
  if (value > last) return last
  return value
}

// Day number when the print does not start on the 1st. Null means the whole month.
export function printStartDay(iso: string, year: number, month: number): number | null {
  const [y, m, d] = iso.split('-').map(Number)
  if (y !== year || m !== month || !d || d <= 1) return null
  return d
}

// The date question is a modal. Printing while it is still fading out pauses
// that animation, and the page is left with pointer-events: none — it looks
// frozen and nothing can be clicked. Wait until the dialog is gone.
export function printAfterDialog(run: () => void) {
  const started = Date.now()
  const tick = () => {
    const dialog = document.querySelector('[role="dialog"], [data-slot="dialog-content"]')
    if (dialog && Date.now() - started < 1200) {
      window.setTimeout(tick, 40)
      return
    }
    document.body.style.pointerEvents = ''
    window.requestAnimationFrame(() => run())
  }
  window.setTimeout(tick, 40)
}

// The on-screen page (shift menus, linen grid, the rest of Kadri) stays in the
// print layout even when it is invisible, and Chrome can freeze while paginating
// it. Hide every branch that is not the paper itself, and drop min-height so a
// blank second page is not added.
function hideOtherBranches(sheet: HTMLElement): () => void {
  const hidden: Array<[HTMLElement, string]> = []
  const mins: Array<[HTMLElement, string]> = []
  const prevPosition = sheet.style.position
  sheet.style.position = 'static'
  let node: HTMLElement | null = sheet
  while (node) {
    mins.push([node, node.style.minHeight])
    node.style.minHeight = '0'
    const parent = node.parentElement
    if (!parent) break
    for (const sib of Array.from(parent.children)) {
      if (sib === node) continue
      const tag = sib.tagName
      if (tag === 'SCRIPT' || tag === 'STYLE') continue
      const el = sib as HTMLElement
      hidden.push([el, el.style.display])
      el.style.display = 'none'
    }
    if (parent === document.body) break
    node = parent
  }
  return () => {
    sheet.style.position = prevPosition
    for (const [el, prev] of mins) el.style.minHeight = prev
    for (const [el, prev] of hidden) el.style.display = prev
  }
}

// Keep the print class until the paper dialog closes. A short timer strips it
// while Chrome is still building the preview, and the preview then restarts.
export function printWithClass(className: string, sheetSelector?: string) {
  const classes = Array.from(document.body.classList)
  for (const name of classes) {
    if (name.startsWith('printing-')) document.body.classList.remove(name)
  }
  const sheet = sheetSelector ? document.querySelector(sheetSelector) : null
  const restore = sheet instanceof HTMLElement ? hideOtherBranches(sheet) : () => {}
  document.body.classList.add(className)
  let done = false
  const media = window.matchMedia('print')
  const cleanup = () => {
    if (done) return
    done = true
    document.body.classList.remove(className)
    restore()
    window.removeEventListener('afterprint', cleanup)
    media.removeEventListener('change', onMedia)
  }
  const onMedia = () => {
    if (!media.matches) cleanup()
  }
  window.addEventListener('afterprint', cleanup)
  media.addEventListener('change', onMedia)
  window.print()
}
