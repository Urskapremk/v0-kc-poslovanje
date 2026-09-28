"use client"

import { useState } from "react"
import useSWR from "swr"
import { ShoppingBasket, Pencil, Trash2, Check, X, Plus, HandCoins } from "lucide-react"
import {
  getNabavaPurchases,
  addNabavaPurchase,
  updateNabavaPurchase,
  deleteNabavaPurchase,
  getNabavaLoanGuests,
} from "@/app/actions/nabava"
import { STROSEK_CATEGORIES, CATEGORY_LABELS, type StrosekCategory } from "@/lib/stroski-categories"

const ACCENT = "#8f6d3a"
const ar = (v: number) => `${Math.round(v || 0).toLocaleString("de-DE")} Ar`

// Osnovno sredstvo NI navadna stroškovna kategorija (amortizira se), zato ima svoj ključ/barvo/oznako.
const ASSET_CAT = "osnovno_sredstvo"
const LOAN_CAT = "posojilo_gostu"
type NabavaCategory = StrosekCategory | typeof ASSET_CAT | typeof LOAN_CAT
const ASSET_COLOR = "#c9a86a"
const LOAN_COLOR = "#3f6b7d"

const CAT_COLORS: Record<StrosekCategory, string> = {
  bar: "#3f6b7d",
  nocitve: "#8f6d3a",
  kuhinja: "#4f7a54",
  wellness: "#a05a7a",
  reprezentanca: "#c8846b",
  ostalo: "#6b6b6b",
}
const catColor = (c: NabavaCategory) => (c === ASSET_CAT ? ASSET_COLOR : c === LOAN_CAT ? LOAN_COLOR : CAT_COLORS[c])
const catLabel = (c: NabavaCategory) =>
  c === ASSET_CAT ? "Osnovno sredstvo" : c === LOAN_CAT ? "Posojilo gostu" : CATEGORY_LABELS[c]

type LoanGuest = { id: string; guestName: string; bungalow: string }

function LoanGuestPicker({
  guests,
  value,
  onChange,
}: {
  guests: LoanGuest[]
  value: string
  onChange: (id: string) => void
}) {
  return (
    <div className="rounded-lg border p-2 space-y-1.5" style={{ borderColor: `${LOAN_COLOR}55`, backgroundColor: `${LOAN_COLOR}10` }}>
      <label className="flex items-center gap-1.5 text-[10px] font-medium" style={{ color: LOAN_COLOR }}>
        <HandCoins className="h-3.5 w-3.5" /> Gost, ki mu založimo gotovino
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-[#0f2e3a]/15 bg-white px-2 py-1.5 text-[11px] text-[#0f2e3a] [color-scheme:light] focus:outline-none"
      >
        <option value="">— izberi gosta v bungalovu —</option>
        {guests.map((g) => (
          <option key={g.id} value={g.id}>
            {g.bungalow} · {g.guestName}
          </option>
        ))}
      </select>
      {guests.length === 0 && <p className="text-[9px] text-[#2b2622]/55">Trenutno ni prijavljenih gostov.</p>}
      <p className="text-[9px] text-[#2b2622]/45">
        Znesek gre iz blagajne in se doda na račun gosta kot „Cash advance“ — ni strošek v kalkulaciji.
      </p>
    </div>
  )
}
function LoanRateInput({ amountAr, value, onChange }: { amountAr: number; value: string; onChange: (v: string) => void }) {
  const rate = parseFloat((value || "").replace(",", ".").replace(/[^\d.]/g, "")) || 0
  const eur = rate > 0 && amountAr > 0 ? amountAr / rate : 0
  return (
    <div className="rounded-lg border p-2 space-y-1.5" style={{ borderColor: `${LOAN_COLOR}55`, backgroundColor: `${LOAN_COLOR}10` }}>
      <div className="flex items-center gap-2">
        <label htmlFor="loan-rate" className="text-[10px] font-medium" style={{ color: LOAN_COLOR }}>
          Menjalni tečaj posojila:
        </label>
        <span className="text-[10px] text-[#2b2622]/55">1 € =</span>
        <input
          id="loan-rate"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="npr. 4800"
          className="w-24 rounded-lg border border-[#0f2e3a]/15 bg-white px-2 py-1 text-[11px] text-[#0f2e3a] focus:outline-none"
        />
        <span className="text-[10px] text-[#2b2622]/55">Ar</span>
      </div>
      {eur > 0 ? (
        <p className="text-[10px] font-semibold" style={{ color: LOAN_COLOR }}>
          Na račun gosta: {eur.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
        </p>
      ) : (
        <p className="text-[9px] text-[#2b2622]/45">Vpiši tečaj, po katerem je gost dobil gotovino — velja samo za to posojilo.</p>
      )}
    </div>
  )
}
const assetLifeMonths = (rate: number) => (!rate || rate <= 0 ? 0 : Math.max(1, Math.round(1200 / rate)))

export function NabavaPurchasesSection({ tripId, tripNote }: { tripId: string; tripNote?: string }) {
  const { data, mutate } = useSWR(["nabava-purchases", tripId], () => getNabavaPurchases(tripId), {
    refreshInterval: 0,
  })
  const purchases = data || []
  const { data: loanGuestsData } = useSWR("nabava-loan-guests", getNabavaLoanGuests)
  const loanGuests = loanGuestsData || []
  const [guestId, setGuestId] = useState("")
  const [eGuestId, setEGuestId] = useState("")
  const [loanRate, setLoanRate] = useState("")
  const [eLoanRate, setELoanRate] = useState("")

  const today = new Date().toISOString().slice(0, 10)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState("")
  const [amount, setAmount] = useState("")
  const [category, setCategory] = useState<NabavaCategory>("kuhinja")
  const [company, setCompany] = useState<"tourism" | "sarl">("tourism")
  const [date, setDate] = useState(today)
  const [rate, setRate] = useState("")
  const [saving, setSaving] = useState(false)

  const [editId, setEditId] = useState<string | null>(null)
  const [eName, setEName] = useState("")
  const [eAmount, setEAmount] = useState("")
  const [eCategory, setECategory] = useState<NabavaCategory>("kuhinja")
  const [eCompany, setECompany] = useState<"tourism" | "sarl">("tourism")
  const [eDate, setEDate] = useState(today)
  const [eRate, setERate] = useState("")

  const parseAmt = (s: string) => parseInt((s || "").replace(/[^\d]/g, ""), 10) || 0
  const parseRate = (s: string) => parseFloat((s || "").replace(",", ".").replace(/[^\d.]/g, "")) || 0

  const resetAdd = () => {
    setName("")
    setAmount("")
    setCategory("kuhinja")
    setCompany("tourism")
    setDate(today)
    setRate("")
    setGuestId("")
    setLoanRate("")
    setAdding(false)
  }

  const loanGuestLabel = (id: string) => {
    const g = loanGuests.find((x) => x.id === id)
    return g ? `${g.guestName} (${g.bungalow})` : "gostu"
  }

  const handleAdd = async () => {
    const amt = parseAmt(amount)
    const isLoan = category === LOAN_CAT
    if ((!isLoan && !name.trim()) || amt <= 0) return
    const rt = parseRate(rate)
    if (category === ASSET_CAT && rt <= 0) return
    if (isLoan && !guestId) return
    const lr = parseRate(loanRate)
    if (isLoan && lr <= 0) return
    const msg = isLoan
      ? `Odštejem ${ar(amt)} iz blagajne ${company === "sarl" ? "SARL" : "Tourism"} kot posojilo ${loanGuestLabel(guestId)} in dodam na njegov račun ${(amt / (lr || 1)).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € (tečaj ${lr})?`
      : `Odštejem ${ar(amt)} iz blagajne ${company === "sarl" ? "SARL" : "Tourism"}?`
    if (!confirm(msg)) return
    setSaving(true)
    try {
      await addNabavaPurchase({
        tripId,
        name: name.trim() || (isLoan ? "Posojilo gotovine" : ""),
        category,
        amountAr: amt,
        company,
        date,
        annualRatePct: rt,
        reservationId: isLoan ? guestId : undefined,
        loanRate: isLoan ? lr : undefined,
      })
      resetAdd()
      await mutate()
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (p: (typeof purchases)[number]) => {
    setEditId(p.id)
    setEName(p.name)
    setEAmount(String(p.amountAr || ""))
    setECategory(p.category)
    setECompany(p.company === "sarl" ? "sarl" : "tourism")
    setEDate((p.date || today).slice(0, 10))
    setERate(p.annualRatePct ? String(p.annualRatePct) : "")
    setEGuestId(p.reservationId || "")
    setELoanRate(p.loanRate ? String(p.loanRate) : "")
  }

  const handleSaveEdit = async () => {
    if (!editId) return
    const amt = parseAmt(eAmount)
    const isLoan = eCategory === LOAN_CAT
    if ((!isLoan && !eName.trim()) || amt <= 0) return
    const rt = parseRate(eRate)
    if (eCategory === ASSET_CAT && rt <= 0) return
    if (isLoan && !eGuestId) return
    const lr = parseRate(eLoanRate)
    if (isLoan && lr <= 0) return
    setSaving(true)
    try {
      await updateNabavaPurchase({
        id: editId,
        name: eName.trim() || (isLoan ? "Posojilo gotovine" : ""),
        category: eCategory,
        amountAr: amt,
        company: eCompany,
        date: eDate,
        annualRatePct: rt,
        reservationId: isLoan ? eGuestId : undefined,
        loanRate: isLoan ? lr : undefined,
      })
      setEditId(null)
      await mutate()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Izbrišem nakup? Odliv iz blagajne se bo razveljavil.")) return
    await deleteNabavaPurchase(id)
    await mutate()
  }

  const catBtnClass = (active: boolean) =>
    `rounded-lg px-2 py-1 text-[10px] font-medium border transition-colors ${
      active ? "" : "bg-[#0f2e3a]/5 text-[#2b2622]/60 border-[#0f2e3a]/15 hover:bg-[#0f2e3a]/10"
    }`

  return (
    <div className="mt-2 rounded-lg border border-dashed p-2.5" style={{ borderColor: `${ACCENT}55`, backgroundColor: `${ACCENT}08` }}>
      <p className="mb-2 flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.15em]" style={{ color: ACCENT }}>
        <ShoppingBasket className="h-3.5 w-3.5" /> Nakupi (gotovina) — hrana → kuhinja, pijača → bar
      </p>

      {purchases.length > 0 && (
        <div className="mb-2 space-y-1.5">
          {purchases.map((p) =>
            editId === p.id ? (
              <div key={p.id} className="rounded-lg border border-[#0f2e3a]/15 bg-white/60 p-2 space-y-2">
                <input
                  value={eName}
                  onChange={(e) => setEName(e.target.value)}
                  placeholder="Naziv (npr. kalamari)"
                  className="w-full rounded-lg border border-[#0f2e3a]/15 bg-[#0f2e3a]/5 px-2 py-1.5 text-[11px] text-[#0f2e3a] focus:outline-none"
                />
                <div className="flex flex-wrap gap-1">
                  {STROSEK_CATEGORIES.map((c) => (
                    <button
                      key={c}
                      onClick={() => setECategory(c)}
                      className={catBtnClass(eCategory === c)}
                      style={eCategory === c ? { backgroundColor: `${CAT_COLORS[c]}22`, borderColor: `${CAT_COLORS[c]}66`, color: CAT_COLORS[c] } : undefined}
                    >
                      {CATEGORY_LABELS[c]}
                    </button>
                  ))}
                  <button
                    onClick={() => setECategory(ASSET_CAT)}
                    className={catBtnClass(eCategory === ASSET_CAT)}
                    style={eCategory === ASSET_CAT ? { backgroundColor: `${ASSET_COLOR}22`, borderColor: `${ASSET_COLOR}66`, color: ASSET_COLOR } : undefined}
                  >
                    Osnovno sredstvo
                  </button>
                  <button
                    onClick={() => setECategory(LOAN_CAT)}
                    className={catBtnClass(eCategory === LOAN_CAT)}
                    style={eCategory === LOAN_CAT ? { backgroundColor: `${LOAN_COLOR}22`, borderColor: `${LOAN_COLOR}66`, color: LOAN_COLOR } : undefined}
                  >
                    Posojilo gostu
                  </button>
                </div>
                {eCategory === LOAN_CAT && (
                  <LoanGuestPicker
                    guests={
                      eGuestId && !loanGuests.some((g) => g.id === eGuestId)
                        ? [...loanGuests, { id: eGuestId, guestName: p.guestName || "gost", bungalow: p.bungalow || "odjavljen" }]
                        : loanGuests
                    }
                    value={eGuestId}
                    onChange={setEGuestId}
                  />
                )}
                <div className="flex items-center gap-2">
                  <input
                    inputMode="numeric"
                    value={eAmount}
                    onChange={(e) => setEAmount(e.target.value)}
                    placeholder="0"
                    className="flex-1 rounded-lg border border-[#0f2e3a]/15 bg-[#0f2e3a]/5 px-2 py-1.5 text-[11px] text-[#0f2e3a] focus:outline-none"
                  />
                  <span className="text-[10px] text-[#2b2622]/55">Ar</span>
                </div>
                {eCategory === LOAN_CAT && <LoanRateInput amountAr={parseAmt(eAmount)} value={eLoanRate} onChange={setELoanRate} />}
                {eCategory === ASSET_CAT && (
                  <div className="rounded-lg border p-2 space-y-1.5" style={{ borderColor: `${ASSET_COLOR}55`, backgroundColor: `${ASSET_COLOR}10` }}>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-medium" style={{ color: ASSET_COLOR }}>Letna amortizacija:</span>
                      <input
                        inputMode="decimal"
                        value={eRate}
                        onChange={(e) => setERate(e.target.value)}
                        placeholder="npr. 20"
                        className="w-16 rounded-lg border border-[#0f2e3a]/15 bg-[#0f2e3a]/5 px-2 py-1 text-[11px] text-[#0f2e3a] focus:outline-none"
                      />
                      <span className="text-[10px] text-[#2b2622]/55">% / leto</span>
                    </div>
                    {parseRate(eRate) > 0 && parseAmt(eAmount) > 0 && (
                      <p className="text-[9px] text-[#2b2622]/55">
                        Doba ~{assetLifeMonths(parseRate(eRate))} mes · {ar(parseAmt(eAmount) / assetLifeMonths(parseRate(eRate)))}/mes amortizacije
                      </p>
                    )}
                  </div>
                )}
                <div className="flex gap-2">
                  {(["tourism", "sarl"] as const).map((c) => (
                    <button
                      key={c}
                      onClick={() => setECompany(c)}
                      className={`flex-1 rounded-lg px-2 py-1.5 text-[10px] font-medium border transition-colors ${
                        eCompany === c ? "bg-[#4f7a54]/15 text-[#4f7a54] border-[#4f7a54]/40" : "bg-[#0f2e3a]/5 text-[#2b2622]/60 border-[#0f2e3a]/15"
                      }`}
                    >
                      {c === "tourism" ? "Tourism" : "SARL"}
                    </button>
                  ))}
                </div>
                <input
                  type="date"
                  value={eDate}
                  onChange={(e) => setEDate(e.target.value)}
                  className="w-full rounded-lg border border-[#0f2e3a]/15 bg-[#0f2e3a]/5 px-2 py-1.5 text-[11px] text-[#0f2e3a] [color-scheme:light] focus:outline-none"
                />
                <div className="flex gap-1.5">
                  <button
                    disabled={saving}
                    onClick={handleSaveEdit}
                    className="flex items-center gap-1 rounded-full border border-[#4f7a54]/40 bg-[#4f7a54]/15 px-3 py-1.5 text-[10px] font-semibold text-[#4f7a54] disabled:opacity-50"
                  >
                    <Check className="h-3 w-3" /> Shrani
                  </button>
                  <button
                    onClick={() => setEditId(null)}
                    className="rounded-full border border-[#0f2e3a]/15 bg-[#0f2e3a]/5 px-3 py-1.5 text-[10px] font-medium text-[#2b2622]/70"
                  >
                    Prekliči
                  </button>
                </div>
              </div>
            ) : (
              <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg border border-[#0f2e3a]/10 bg-white/50 px-2.5 py-1.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[11px] font-semibold text-[#0f2e3a]">{p.name}</span>
                    <span
                      className="shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide"
                      style={{ backgroundColor: `${catColor(p.category)}1a`, color: catColor(p.category) }}
                    >
                      {catLabel(p.category)}
                    </span>
                  </div>
                  {p.category === LOAN_CAT && (
                    <p className="flex items-center gap-1 text-[10px] font-medium" style={{ color: LOAN_COLOR }}>
                      <HandCoins className="h-3 w-3" />
                      {p.guestName || "Gost"}
                      {p.bungalow ? ` · ${p.bungalow}` : ""} — na računu gosta
                      {p.loanRate > 0 &&
                        ` ${(p.amountAr / p.loanRate).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € (tečaj ${p.loanRate.toLocaleString("de-DE")})`}
                    </p>
                  )}
                  <p className="text-[10px] text-[#2b2622]/55">
                    {ar(p.amountAr)} · Gotovina ({p.company === "sarl" ? "SARL" : "Tourism"})
                    {p.date ? ` · ${new Date(p.date + "T00:00:00").toLocaleDateString("sl-SI", { day: "numeric", month: "short" })}` : ""}
                  </p>
                </div>
                <span className="-rotate-12 shrink-0 rounded-md border-2 border-[#4f7a54]/60 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.15em] text-[#4f7a54]/80">
                  Plačano
                </span>
                <div className="flex shrink-0 gap-1.5">
                  <button
                    onClick={() => startEdit(p)}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-[#0f2e3a]/15 bg-[#0f2e3a]/5 text-[#2b2622]/60 transition-colors hover:bg-[#0f2e3a]/10"
                    aria-label="Uredi nakup"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-[#0f2e3a]/15 bg-[#0f2e3a]/5 text-[#2b2622]/60 transition-colors hover:bg-red-500/10 hover:text-red-600 hover:border-red-500/40"
                    aria-label="Izbriši nakup"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ),
          )}
        </div>
      )}

      {adding ? (
        <div className="rounded-lg border border-[#0f2e3a]/15 bg-white/60 p-2 space-y-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Naziv (npr. kalamari, jastogi, riba)"
            className="w-full rounded-lg border border-[#0f2e3a]/15 bg-[#0f2e3a]/5 px-2 py-1.5 text-[11px] text-[#0f2e3a] focus:outline-none"
          />
          <div className="flex flex-wrap gap-1">
            {STROSEK_CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={catBtnClass(category === c)}
                style={category === c ? { backgroundColor: `${CAT_COLORS[c]}22`, borderColor: `${CAT_COLORS[c]}66`, color: CAT_COLORS[c] } : undefined}
              >
                {CATEGORY_LABELS[c]}
              </button>
            ))}
            <button
              onClick={() => setCategory(ASSET_CAT)}
              className={catBtnClass(category === ASSET_CAT)}
              style={category === ASSET_CAT ? { backgroundColor: `${ASSET_COLOR}22`, borderColor: `${ASSET_COLOR}66`, color: ASSET_COLOR } : undefined}
            >
              Osnovno sredstvo
            </button>
            <button
              onClick={() => setCategory(LOAN_CAT)}
              className={catBtnClass(category === LOAN_CAT)}
              style={category === LOAN_CAT ? { backgroundColor: `${LOAN_COLOR}22`, borderColor: `${LOAN_COLOR}66`, color: LOAN_COLOR } : undefined}
            >
              Posojilo gostu
            </button>
          </div>
          {category === LOAN_CAT && <LoanGuestPicker guests={loanGuests} value={guestId} onChange={setGuestId} />}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[#2b2622]/55">Znesek:</span>
            <input
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="flex-1 rounded-lg border border-[#0f2e3a]/15 bg-[#0f2e3a]/5 px-2 py-1.5 text-[11px] text-[#0f2e3a] focus:outline-none"
            />
            <span className="text-[10px] text-[#2b2622]/55">Ar</span>
          </div>
          {category === LOAN_CAT && <LoanRateInput amountAr={parseAmt(amount)} value={loanRate} onChange={setLoanRate} />}
          {category === ASSET_CAT && (
            <div className="rounded-lg border p-2 space-y-1.5" style={{ borderColor: `${ASSET_COLOR}55`, backgroundColor: `${ASSET_COLOR}10` }}>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium" style={{ color: ASSET_COLOR }}>Letna amortizacija:</span>
                <input
                  inputMode="decimal"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  placeholder="npr. 20"
                  className="w-16 rounded-lg border border-[#0f2e3a]/15 bg-[#0f2e3a]/5 px-2 py-1 text-[11px] text-[#0f2e3a] focus:outline-none"
                />
                <span className="text-[10px] text-[#2b2622]/55">% / leto</span>
              </div>
              {parseRate(rate) > 0 && parseAmt(amount) > 0 && (
                <p className="text-[9px] text-[#2b2622]/55">
                  Doba ~{assetLifeMonths(parseRate(rate))} mes · {ar(parseAmt(amount) / assetLifeMonths(parseRate(rate)))}/mes amortizacije
                </p>
              )}
              <p className="text-[9px] text-[#2b2622]/45">Ne bremeni oddelka takoj — knjiži se kot amortizacija čez dobo.</p>
            </div>
          )}
          <div className="flex gap-2">
            {(["tourism", "sarl"] as const).map((c) => (
              <button
                key={c}
                onClick={() => setCompany(c)}
                className={`flex-1 rounded-lg px-2 py-1.5 text-[10px] font-medium border transition-colors ${
                  company === c ? "bg-[#4f7a54]/15 text-[#4f7a54] border-[#4f7a54]/40" : "bg-[#0f2e3a]/5 text-[#2b2622]/60 border-[#0f2e3a]/15"
                }`}
              >
                Blagajna {c === "tourism" ? "Tourism" : "SARL"}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[#2b2622]/55">Datum:</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="flex-1 rounded-lg border border-[#0f2e3a]/15 bg-[#0f2e3a]/5 px-2 py-1.5 text-[11px] text-[#0f2e3a] [color-scheme:light] focus:outline-none"
            />
          </div>
          <div className="flex gap-1.5">
            <button
              disabled={
                saving ||
                parseAmt(amount) <= 0 ||
                (category === LOAN_CAT ? !guestId || parseRate(loanRate) <= 0 : !name.trim())
              }
              onClick={handleAdd}
              className="flex-1 rounded-lg px-3 py-2 text-[11px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              style={{ backgroundColor: `${ACCENT}22`, border: `1px solid ${ACCENT}66`, color: ACCENT }}
            >
              {saving ? "Beležim…" : "Dodaj nakup (odštej iz blagajne)"}
            </button>
            <button
              onClick={resetAdd}
              className="rounded-lg border border-[#0f2e3a]/15 bg-[#0f2e3a]/5 px-3 py-2 text-[11px] font-medium text-[#2b2622]/70"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-dashed px-4 py-2 transition-colors"
          style={{ borderColor: `${ACCENT}55`, color: ACCENT }}
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.15em]">Dodaj nakup</span>
        </button>
      )}
    </div>
  )
}
