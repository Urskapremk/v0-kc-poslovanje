// Oznaka stroška na plačilih nabave HV: Dilip (čoln Nero), voznik čolna in nosači.
// Ista taksonomija kot nakupi (nabava_purchases): vrsta stroška + povezava na pogodbo
// (sredstvo v izdelavi) ali osnovno sredstvo. Brez drugega seznama kategorij.
import { STROSEK_CATEGORIES, CATEGORY_LABELS, type StrosekCategory } from "./stroski-categories"

export const WIP_CAT = "sredstvo_v_izdelavi"
export const ASSET_CAT = "osnovno_sredstvo"
export const LOAN_CAT = "posojilo_gostu"
export const RENT_CAT = "najemnina"
export const IZLET_CAT = "izlet"
export const STIPEND_CAT = "stipendija"
export const STUDENT_FOOD_CAT = "hrana_studenti"
export const ACCOUNTING_CAT = "racunovodstvo"
export const PREVOZNIKI_CAT = "prevozniki"

const EXTRA_CATS = [
  WIP_CAT,
  ASSET_CAT,
  LOAN_CAT,
  RENT_CAT,
  IZLET_CAT,
  STIPEND_CAT,
  STUDENT_FOOD_CAT,
  ACCOUNTING_CAT,
  PREVOZNIKI_CAT,
] as const

export type BoatCostCategory = StrosekCategory | (typeof EXTRA_CATS)[number]

const EXTRA_LABELS: Record<(typeof EXTRA_CATS)[number], string> = {
  [WIP_CAT]: "Sredstvo v izdelavi",
  [ASSET_CAT]: "Osnovno sredstvo",
  [LOAN_CAT]: "Posojilo gostu",
  [RENT_CAT]: "Najemnina hiša",
  [IZLET_CAT]: "Izlet",
  [STIPEND_CAT]: "Štipendija",
  [STUDENT_FOOD_CAT]: "Hrana za študente",
  [ACCOUNTING_CAT]: "Računovodstvo",
  [PREVOZNIKI_CAT]: "Prevozniki",
}

/** Nabava HV: čoln Dilip, voznik čolna in nosači. Ne tuc tuc, ne transfer, ne nakup. */
const TRANSPORT_COST_REF = /^nabava:[^:]+:(boat|boatdriver|porters)$/

export function isTransportCostPayRef(refKey: string): boolean {
  return TRANSPORT_COST_REF.test(refKey)
}

export function transportCostTitle(refKey: string): string {
  if (/^nabava:[^:]+:boatdriver$/.test(refKey)) return "Voznik čolna"
  if (/^nabava:[^:]+:porters$/.test(refKey)) return "Nosači"
  return "Dilip (čoln Nero)"
}

export function parseCostRate(raw: string | number | null | undefined): number {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : 0
  const n = parseFloat(String(raw || "").replace(",", ".").replace(/[^\d.]/g, ""))
  return Number.isFinite(n) ? n : 0
}

export function boatCostKindLabel(category: string): string {
  if ((EXTRA_CATS as readonly string[]).includes(category)) {
    return EXTRA_LABELS[category as (typeof EXTRA_CATS)[number]]
  }
  if ((STROSEK_CATEGORIES as readonly string[]).includes(category)) {
    return CATEGORY_LABELS[category as StrosekCategory]
  }
  return category
}

export type BoatCostFields = {
  category?: string | null
  assetId?: string | null
  annualRatePct?: number | null
  reservationId?: string | null
  loanRate?: number | null
}

export type ResolvedBoatCost =
  | { kind: "none" }
  | { kind: "wip"; category: typeof WIP_CAT; assetId: string }
  | { kind: "asset"; category: typeof ASSET_CAT; annualRatePct: number }
  | { kind: "loan"; category: typeof LOAN_CAT; reservationId: string; loanRate: number }
  | { kind: "pnl"; category: BoatCostCategory }

function isKnownCategory(category: string): category is BoatCostCategory {
  return (
    (STROSEK_CATEGORIES as readonly string[]).includes(category) ||
    (EXTRA_CATS as readonly string[]).includes(category)
  )
}

export function resolveBoatCostMark(
  input: BoatCostFields | null | undefined,
): { ok: true; mark: ResolvedBoatCost } | { ok: false; error: string } {
  const raw = (input?.category || "").trim()
  if (!raw) return { ok: true, mark: { kind: "none" } }
  if (!isKnownCategory(raw)) return { ok: false, error: "Neznana vrsta stroška." }
  if (raw === WIP_CAT) {
    const assetId = (input?.assetId || "").trim()
    if (!assetId) return { ok: false, error: "Izberi pogodbo (sredstvo v izdelavi)." }
    return { ok: true, mark: { kind: "wip", category: WIP_CAT, assetId } }
  }
  if (raw === ASSET_CAT) {
    const annualRatePct = Number(input?.annualRatePct) || 0
    if (annualRatePct <= 0) return { ok: false, error: "Vpiši letno amortizacijsko stopnjo." }
    return { ok: true, mark: { kind: "asset", category: ASSET_CAT, annualRatePct } }
  }
  if (raw === LOAN_CAT) {
    const reservationId = (input?.reservationId || "").trim()
    const loanRate = Number(input?.loanRate) || 0
    if (!reservationId) return { ok: false, error: "Izberi gosta za posojilo." }
    if (loanRate <= 0) return { ok: false, error: "Vpiši menjalni tečaj za posojilo." }
    return { ok: true, mark: { kind: "loan", category: LOAN_CAT, reservationId, loanRate } }
  }
  return { ok: true, mark: { kind: "pnl", category: raw } }
}

export function boatCostMarkError(input: BoatCostFields | null | undefined): string | null {
  const resolved = resolveBoatCostMark(input)
  return resolved.ok ? null : resolved.error
}

export type StoredBoatCost = {
  category: string
  assetId: string
  fixedAssetId: string
  orderItemId: string
}

export type BoatCostLinkPlan = {
  // Ena vrstica stroška na pogodbi. upsert jo posodobi na mestu (ne doda druge).
  wip: "upsert" | "remove" | "none"
  fixedAsset: "create" | "update" | "delete" | "none"
  loan: "replace" | "delete" | "none"
}

export function planBoatCostLink(prev: StoredBoatCost, next: ResolvedBoatCost): BoatCostLinkPlan {
  const wip: BoatCostLinkPlan["wip"] =
    next.kind === "wip" ? "upsert" : prev.category === WIP_CAT ? "remove" : "none"
  const fixedAsset: BoatCostLinkPlan["fixedAsset"] =
    next.kind === "asset" ? (prev.fixedAssetId ? "update" : "create") : prev.fixedAssetId ? "delete" : "none"
  const loan: BoatCostLinkPlan["loan"] =
    next.kind === "loan" ? "replace" : prev.orderItemId ? "delete" : "none"
  return { wip, fixedAsset, loan }
}

export function dilipBoatCostDescription(label: string): string {
  const note = (label || "").trim()
  if (!note || note === "nabava") return "Dilip (čoln Nero)"
  if (/dilip/i.test(note)) return note.slice(0, 200)
  return `Dilip (čoln Nero) — ${note}`.slice(0, 200)
}

function namedTransportCost(base: string, label: string): string {
  const note = (label || "").trim()
  if (!note || note === "nabava" || note.toLowerCase() === base.toLowerCase()) return base
  const prefix = new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*[—:-]\\s*`, "i")
  if (prefix.test(note)) {
    const rest = note.replace(prefix, "").trim()
    if (!rest || rest === "nabava") return base
    return `${base} — ${rest}`.slice(0, 200)
  }
  return `${base} — ${note}`.slice(0, 200)
}

export function transportCostDescription(refKey: string, label: string): string {
  if (/^nabava:[^:]+:boatdriver$/.test(refKey)) return namedTransportCost("Voznik čolna", label)
  if (/^nabava:[^:]+:porters$/.test(refKey)) return namedTransportCost("Nosači", label)
  return dilipBoatCostDescription(label)
}

export function boatCostDraftDiffers(
  next: BoatCostFields | null | undefined,
  prev: BoatCostFields | null | undefined,
): boolean {
  const category = (next?.category || "").trim()
  const prevCategory = (prev?.category || "").trim()
  if (category !== prevCategory) return true
  if (category === WIP_CAT && (next?.assetId || "").trim() !== (prev?.assetId || "").trim()) return true
  if (category === ASSET_CAT && (Number(next?.annualRatePct) || 0) !== (Number(prev?.annualRatePct) || 0)) return true
  if (category === LOAN_CAT) {
    if ((next?.reservationId || "").trim() !== (prev?.reservationId || "").trim()) return true
    if ((Number(next?.loanRate) || 0) !== (Number(prev?.loanRate) || 0)) return true
  }
  return false
}

/** Besedilo potrditve, ko se oznaka stroška spremeni. null = Shrani brez dodatnega vprašanja. */
export function transportPayConfirm(opts: {
  editing: boolean
  changed: boolean
  category: string
  hadCategory: boolean
  amountLabel: string
  dilip: boolean
}): string | null {
  if (!opts.changed) return null
  if (opts.category === WIP_CAT) {
    const verb = opts.editing ? "Shranim" : "Zabeležim plačilo"
    return `${verb} in dodam ${opts.amountLabel} k stroškom izbrane pogodbe?`
  }
  if (opts.category) {
    return opts.editing
      ? "Shranim in označim znesek kot strošek?"
      : "Zabeležim plačilo in označim znesek kot strošek?"
  }
  if (opts.hadCategory) {
    return opts.dilip
      ? "Odstranim oznako stroška? Plačilo Dilipu ostane zabeleženo."
      : "Odstranim oznako stroška? Plačilo ostane zabeleženo."
  }
  return null
}

export function transportPaySaveLabel(editing: boolean, saving: boolean): string {
  if (saving) return editing ? "Shranjujem…" : "Beležim…"
  return editing ? "Shrani" : "Zabeleži plačilo"
}

export function transportPayCancelConfirm(opts: { wip: boolean; dilip: boolean }): string {
  if (opts.wip && opts.dilip) return "Prekličem plačilo Dilipu? Vknjižba se izbriše in strošek se umakne s pogodbe."
  if (opts.wip) return "Prekličem plačilo? Vknjižba se izbriše in strošek se umakne s pogodbe."
  if (opts.dilip) return "Prekličem plačilo dobavitelju? Vknjižba v blagajni/Orange Money se bo izbrisala."
  return "Prekličem plačilo? Vknjižba v blagajni/Orange Money se bo izbrisala."
}
