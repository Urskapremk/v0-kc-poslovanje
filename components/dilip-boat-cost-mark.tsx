"use client"

import useSWR from "swr"
import { HandCoins } from "lucide-react"
import { getNabavaLoanGuests } from "@/app/actions/nabava"
import { getAssetsInProgress, type AssetInProgress } from "@/app/actions/statistics"
import { STROSEK_CATEGORIES, CATEGORY_LABELS, type StrosekCategory } from "@/lib/stroski-categories"
import {
  ACCOUNTING_CAT,
  ASSET_CAT,
  LOAN_CAT,
  PREVOZNIKI_CAT,
  RENT_CAT,
  STIPEND_CAT,
  STUDENT_FOOD_CAT,
  WIP_CAT,
  boatCostKindLabel,
  boatCostMarkError,
  type BoatCostFields,
} from "@/lib/dilip-boat-cost"

const ASSET_COLOR = "#c9a86a"
const LOAN_COLOR = "#3f6b7d"
const WIP_COLOR = "#a0662f"
const RENT_COLOR = "#8a4f72"
const STIPEND_COLOR = "#6d5a8a"
const STUDENT_FOOD_COLOR = "#c46a3a"
const ACCOUNTING_COLOR = "#3d5c78"
const PREVOZNIKI_COLOR = "#1d6b63"
const CAT_COLORS: Record<StrosekCategory, string> = {
  bar: "#3f6b7d",
  nocitve: "#8f6d3a",
  kuhinja: "#4f7a54",
  wellness: "#a05a7a",
  reprezentanca: "#c8846b",
  vzdrzevanje: "#7d7d3f",
  ostalo: "#6b6b6b",
}

export type DilipBoatCostDraft = {
  category: string
  assetId: string
  annualRatePct: string
  reservationId: string
  loanRate: string
}

export const EMPTY_DILIP_BOAT_COST: DilipBoatCostDraft = {
  category: "",
  assetId: "",
  annualRatePct: "",
  reservationId: "",
  loanRate: "",
}

type PaidCost = {
  costCategory?: string | null
  assetId?: string | null
  annualRatePct?: number | null
  reservationId?: string | null
  loanRate?: number | null
}

export function dilipCostDraftFromPayment(paid?: PaidCost | null): DilipBoatCostDraft {
  if (!paid?.costCategory) return EMPTY_DILIP_BOAT_COST
  return {
    category: paid.costCategory,
    assetId: paid.assetId || "",
    annualRatePct: paid.annualRatePct ? String(paid.annualRatePct) : "",
    reservationId: paid.reservationId || "",
    loanRate: paid.loanRate ? String(paid.loanRate) : "",
  }
}

export function dilipCostFieldsFromDraft(draft: DilipBoatCostDraft): BoatCostFields {
  const rate = (raw: string) => {
    const n = parseFloat((raw || "").replace(",", ".").replace(/[^\d.]/g, ""))
    return Number.isFinite(n) ? n : 0
  }
  return {
    category: draft.category,
    assetId: draft.assetId,
    annualRatePct: rate(draft.annualRatePct),
    reservationId: draft.reservationId,
    loanRate: rate(draft.loanRate),
  }
}

function catBtnClass(active: boolean) {
  return `rounded-lg px-2 py-1 text-[10px] font-medium border transition-colors ${
    active ? "" : "bg-[#0f2e3a]/5 text-[#2b2622]/60 border-[#0f2e3a]/15 hover:bg-[#0f2e3a]/10"
  }`
}

function colorFor(category: string) {
  if (category === ASSET_CAT) return ASSET_COLOR
  if (category === LOAN_CAT) return LOAN_COLOR
  if (category === WIP_CAT) return WIP_COLOR
  if (category === RENT_CAT) return RENT_COLOR
  if (category === STIPEND_CAT) return STIPEND_COLOR
  if (category === STUDENT_FOOD_CAT) return STUDENT_FOOD_COLOR
  if (category === ACCOUNTING_CAT) return ACCOUNTING_COLOR
  if (category === PREVOZNIKI_CAT) return PREVOZNIKI_COLOR
  if ((STROSEK_CATEGORIES as readonly string[]).includes(category)) return CAT_COLORS[category as StrosekCategory]
  return "#6b6b6b"
}

const assetLifeMonths = (rate: number) => (!rate || rate <= 0 ? 0 : Math.max(1, Math.round(1200 / rate)))
const ar = (v: number) => `${Math.round(v || 0).toLocaleString("de-DE")} Ar`

export function DilipBoatCostSummary({ category, assetId }: { category?: string | null; assetId?: string | null }) {
  const { data } = useSWR(category === WIP_CAT ? "assets-in-progress" : null, getAssetsInProgress)
  if (!category) return null
  const name = (data || []).find((a) => a.id === assetId)?.name
  const color = colorFor(category)
  return (
    <p className="text-[10px] font-medium" style={{ color }}>
      {boatCostKindLabel(category)}
      {category === WIP_CAT ? ` · Pogodba: ${name || "sredstvo v izdelavi"}` : ""}
    </p>
  )
}

export function DilipBoatCostMark({
  value,
  onChange,
  amountAr,
}: {
  value: DilipBoatCostDraft
  onChange: (next: DilipBoatCostDraft) => void
  amountAr: number
}) {
  const { data: wipAssetsData } = useSWR("assets-in-progress", getAssetsInProgress)
  const wipAssets = wipAssetsData || []
  const { data: loanGuestsData } = useSWR(value.category === LOAN_CAT ? "nabava-loan-guests" : null, getNabavaLoanGuests)
  const loanGuests = loanGuestsData || []
  const err = boatCostMarkError(dilipCostFieldsFromDraft(value))
  const rate = parseFloat((value.annualRatePct || "").replace(",", ".").replace(/[^\d.]/g, "")) || 0
  const loanRate = parseFloat((value.loanRate || "").replace(",", ".").replace(/[^\d.]/g, "")) || 0
  const loanEur = loanRate > 0 && amountAr > 0 ? amountAr / loanRate : 0

  const pick = (category: string) => onChange({ ...value, category })

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-medium text-[#2b2622]/70">Vrsta stroška</p>
      <div className="flex flex-wrap gap-1">
        <button type="button" onClick={() => onChange(EMPTY_DILIP_BOAT_COST)} className={catBtnClass(!value.category)}
          style={!value.category ? { backgroundColor: "#0f2e3a14", borderColor: "#0f2e3a40", color: "#0f2e3a" } : undefined}>
          Brez oznake
        </button>
        {STROSEK_CATEGORIES.map((c) => (
          <button key={c} type="button" onClick={() => pick(c)} className={catBtnClass(value.category === c)}
            style={value.category === c ? { backgroundColor: `${CAT_COLORS[c]}22`, borderColor: `${CAT_COLORS[c]}66`, color: CAT_COLORS[c] } : undefined}>
            {CATEGORY_LABELS[c]}
          </button>
        ))}
        <button type="button" onClick={() => pick(ASSET_CAT)} className={catBtnClass(value.category === ASSET_CAT)}
          style={value.category === ASSET_CAT ? { backgroundColor: `${ASSET_COLOR}22`, borderColor: `${ASSET_COLOR}66`, color: ASSET_COLOR } : undefined}>
          Osnovno sredstvo
        </button>
        <button type="button" onClick={() => pick(LOAN_CAT)} className={catBtnClass(value.category === LOAN_CAT)}
          style={value.category === LOAN_CAT ? { backgroundColor: `${LOAN_COLOR}22`, borderColor: `${LOAN_COLOR}66`, color: LOAN_COLOR } : undefined}>
          Posojilo gostu
        </button>
        <button type="button" onClick={() => pick(WIP_CAT)} className={catBtnClass(value.category === WIP_CAT)}
          style={value.category === WIP_CAT ? { backgroundColor: `${WIP_COLOR}22`, borderColor: `${WIP_COLOR}66`, color: WIP_COLOR } : undefined}>
          Sredstvo v izdelavi (pogodba)
        </button>
        <button type="button" onClick={() => pick(STIPEND_CAT)} className={catBtnClass(value.category === STIPEND_CAT)}
          style={value.category === STIPEND_CAT ? { backgroundColor: `${STIPEND_COLOR}22`, borderColor: `${STIPEND_COLOR}66`, color: STIPEND_COLOR } : undefined}>
          Štipendija
        </button>
        <button type="button" onClick={() => pick(STUDENT_FOOD_CAT)} className={catBtnClass(value.category === STUDENT_FOOD_CAT)}
          style={value.category === STUDENT_FOOD_CAT ? { backgroundColor: `${STUDENT_FOOD_COLOR}22`, borderColor: `${STUDENT_FOOD_COLOR}66`, color: STUDENT_FOOD_COLOR } : undefined}>
          Hrana za študente
        </button>
        <button type="button" onClick={() => pick(ACCOUNTING_CAT)} className={catBtnClass(value.category === ACCOUNTING_CAT)}
          style={value.category === ACCOUNTING_CAT ? { backgroundColor: `${ACCOUNTING_COLOR}22`, borderColor: `${ACCOUNTING_COLOR}66`, color: ACCOUNTING_COLOR } : undefined}>
          Računovodstvo
        </button>
        <button type="button" onClick={() => pick(PREVOZNIKI_CAT)} className={catBtnClass(value.category === PREVOZNIKI_CAT)}
          style={value.category === PREVOZNIKI_CAT ? { backgroundColor: `${PREVOZNIKI_COLOR}22`, borderColor: `${PREVOZNIKI_COLOR}66`, color: PREVOZNIKI_COLOR } : undefined}>
          Prevozniki
        </button>
      </div>
      {value.category === ACCOUNTING_CAT && (
        <p className="rounded-lg border px-2 py-1.5 text-[9px]" style={{ borderColor: `${ACCOUNTING_COLOR}55`, backgroundColor: `${ACCOUNTING_COLOR}10`, color: ACCOUNTING_COLOR }}>
          Knjiži se na strošek „Računovodstvo“ — ločeno od oddelkov. Denar gre iz izbrane blagajne ali iz Orange Money.
        </p>
      )}
      {value.category === PREVOZNIKI_CAT && (
        <p className="rounded-lg border px-2 py-1.5 text-[9px]" style={{ borderColor: `${PREVOZNIKI_COLOR}55`, backgroundColor: `${PREVOZNIKI_COLOR}10`, color: PREVOZNIKI_COLOR }}>
          Knjiži se na strošek „Prevozniki“ — ločeno od oddelkov. Denar gre iz izbrane blagajne ali iz Orange Money.
        </p>
      )}
      {value.category === STIPEND_CAT && (
        <p className="rounded-lg border px-2 py-1.5 text-[9px]" style={{ borderColor: `${STIPEND_COLOR}55`, backgroundColor: `${STIPEND_COLOR}10`, color: STIPEND_COLOR }}>
          Knjiži se na strošek „Štipendija“ — ločeno od oddelkov, znižuje skupni dobiček.
        </p>
      )}
      {value.category === STUDENT_FOOD_CAT && (
        <p className="rounded-lg border px-2 py-1.5 text-[9px]" style={{ borderColor: `${STUDENT_FOOD_COLOR}55`, backgroundColor: `${STUDENT_FOOD_COLOR}10`, color: STUDENT_FOOD_COLOR }}>
          Knjiži se na strošek „Hrana za študente“ — ločeno od kuhinje in ostalih oddelkov.
        </p>
      )}
      {value.category === WIP_CAT && (
        <WipPicker assets={wipAssets} value={value.assetId} onChange={(assetId) => onChange({ ...value, assetId })} />
      )}
      {value.category === LOAN_CAT && (
        <div className="space-y-1.5">
          <div className="rounded-lg border p-2 space-y-1.5" style={{ borderColor: `${LOAN_COLOR}55`, backgroundColor: `${LOAN_COLOR}10` }}>
            <label className="flex items-center gap-1.5 text-[10px] font-medium" style={{ color: LOAN_COLOR }}>
              <HandCoins className="h-3.5 w-3.5" /> Gost, ki mu založimo gotovino
            </label>
            <select value={value.reservationId} onChange={(e) => onChange({ ...value, reservationId: e.target.value })}
              className="w-full rounded-lg border border-[#0f2e3a]/15 bg-white px-2 py-1.5 text-[11px] text-[#0f2e3a] [color-scheme:light] focus:outline-none">
              <option value="">— izberi gosta v bungalovu —</option>
              {value.reservationId && !loanGuests.some((g) => g.id === value.reservationId) && (
                <option value={value.reservationId}>Izbrani gost</option>
              )}
              {loanGuests.map((g) => (
                <option key={g.id} value={g.id}>{g.bungalow} · {g.guestName}</option>
              ))}
            </select>
            {loanGuests.length === 0 && <p className="text-[9px] text-[#2b2622]/55">Trenutno ni prijavljenih gostov.</p>}
            <p className="text-[9px] text-[#2b2622]/45">
              Znesek gre iz blagajne in se doda na račun gosta kot „Cash advance“ — ni strošek v kalkulaciji.
            </p>
          </div>
          <div className="rounded-lg border p-2 space-y-1.5" style={{ borderColor: `${LOAN_COLOR}55`, backgroundColor: `${LOAN_COLOR}10` }}>
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-medium" style={{ color: LOAN_COLOR }}>Menjalni tečaj posojila:</label>
              <span className="text-[10px] text-[#2b2622]/55">1 € =</span>
              <input inputMode="decimal" value={value.loanRate} onChange={(e) => onChange({ ...value, loanRate: e.target.value })} placeholder="npr. 4800"
                className="w-24 rounded-lg border border-[#0f2e3a]/15 bg-white px-2 py-1 text-[11px] text-[#0f2e3a] focus:outline-none" />
              <span className="text-[10px] text-[#2b2622]/55">Ar</span>
            </div>
            {loanEur > 0 ? (
              <p className="text-[10px] font-semibold" style={{ color: LOAN_COLOR }}>
                Na račun gosta: {loanEur.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
              </p>
            ) : (
              <p className="text-[9px] text-[#2b2622]/45">Vpiši tečaj, po katerem je gost dobil gotovino — velja samo za to posojilo.</p>
            )}
          </div>
        </div>
      )}
      {value.category === ASSET_CAT && (
        <div className="rounded-lg border p-2 space-y-1.5" style={{ borderColor: `${ASSET_COLOR}55`, backgroundColor: `${ASSET_COLOR}10` }}>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium" style={{ color: ASSET_COLOR }}>Letna amortizacija:</span>
            <input inputMode="decimal" value={value.annualRatePct} onChange={(e) => onChange({ ...value, annualRatePct: e.target.value })} placeholder="npr. 20"
              className="w-16 rounded-lg border border-[#0f2e3a]/15 bg-[#0f2e3a]/5 px-2 py-1 text-[11px] text-[#0f2e3a] focus:outline-none" />
            <span className="text-[10px] text-[#2b2622]/55">% / leto</span>
          </div>
          {rate > 0 && amountAr > 0 && (
            <p className="text-[9px] text-[#2b2622]/55">
              Doba ~{assetLifeMonths(rate)} mes · {ar(amountAr / assetLifeMonths(rate))}/mes amortizacije
            </p>
          )}
          <p className="text-[9px] text-[#2b2622]/45">Ne bremeni oddelka takoj — knjiži se kot amortizacija čez dobo.</p>
        </div>
      )}
      {err && value.category && <p className="text-[10px] text-[#b0203a]">{err}</p>}
    </div>
  )
}

function WipPicker({
  assets,
  value,
  onChange,
}: {
  assets: AssetInProgress[]
  value: string
  onChange: (id: string) => void
}) {
  return (
    <div className="rounded-lg border p-2 space-y-1.5" style={{ borderColor: `${WIP_COLOR}55`, backgroundColor: `${WIP_COLOR}10` }}>
      <label className="text-[10px] font-medium" style={{ color: WIP_COLOR }}>Pogodba (sredstvo v izdelavi)</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-[#0f2e3a]/15 bg-white px-2 py-1.5 text-[11px] text-[#0f2e3a] [color-scheme:light] focus:outline-none">
        <option value="">— izberi pogodbo —</option>
        {value && !assets.some((a) => a.id === value) && <option value={value}>Izbrana pogodba</option>}
        {assets.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}{a.contractor ? ` · ${a.contractor}` : ""}
          </option>
        ))}
      </select>
      {assets.length === 0 && (
        <p className="text-[9px] text-[#2b2622]/55">Ni odprtih pogodb — odpri jo v Kalkulacije → Stroški → Osnovna sredstva.</p>
      )}
      <p className="text-[9px] text-[#2b2622]/45">
        Znesek se prišteje k stroškom pogodbe in k vrednosti sredstva — ne bremeni oddelka.
      </p>
    </div>
  )
}
