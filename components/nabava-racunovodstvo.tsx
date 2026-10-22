"use client"

import { useState } from "react"
import useSWR from "swr"
import { Calculator, Pencil, Trash2, Check, X } from "lucide-react"
import {
  getHvAccountingPayments,
  getNabavaPurchases,
  addAccountingPayment,
  updateAccountingPayment,
  deleteNabavaPurchase,
  type NabavaPurchase,
} from "@/app/actions/nabava"

const ACCENT = "#8f6d3a"
const BADGE = "#3d5c78"
const ar = (v: number) => `${Math.round(v || 0).toLocaleString("de-DE")} Ar`

function resortToday() {
  return new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

function createdDay(iso: string) {
  if (!iso) return ""
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return ""
  return new Date(t + 3 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

function methodLabel(p: NabavaPurchase) {
  if (p.payMethod === "orange") return "Orange Money"
  return `Gotovina (${p.company === "sarl" ? "SARL" : "Tourism"})`
}

export function NabavaRacunovodstvo({ tripId }: { tripId?: string }) {
  const tile = !tripId
  const { data, mutate } = useSWR(
    tile ? "hv-accounting" : ["hv-accounting-trip", tripId],
    () => (tile ? getHvAccountingPayments() : getNabavaPurchases(tripId!)),
    { refreshInterval: 0 },
  )
  const today = resortToday()
  const rows = (data || []).filter((p) => {
    if (p.category !== "racunovodstvo") return false
    if (!tile) return true
    return !p.date || p.date >= today || createdDay(p.createdAt) === today
  })

  const [adding, setAdding] = useState(false)
  const [note, setNote] = useState("")
  const [amount, setAmount] = useState("")
  const [method, setMethod] = useState<"cash" | "orange">("cash")
  const [company, setCompany] = useState<"tourism" | "sarl">("tourism")
  const [date, setDate] = useState(today)
  const [saving, setSaving] = useState(false)

  const [editId, setEditId] = useState<string | null>(null)
  const [eNote, setENote] = useState("")
  const [eAmount, setEAmount] = useState("")
  const [eMethod, setEMethod] = useState<"cash" | "orange">("cash")
  const [eCompany, setECompany] = useState<"tourism" | "sarl">("tourism")
  const [eDate, setEDate] = useState(today)

  const parseAmt = (s: string) => parseInt((s || "").replace(/[^\d]/g, ""), 10) || 0

  const resetAdd = () => {
    setNote("")
    setAmount("")
    setMethod("cash")
    setCompany("tourism")
    setDate(resortToday())
    setAdding(false)
  }

  const potLabel = (m: "cash" | "orange", c: "tourism" | "sarl") =>
    m === "orange" ? "Orange Money" : `blagajne ${c === "sarl" ? "SARL" : "Tourism"}`

  const handleAdd = async () => {
    const amt = parseAmt(amount)
    if (amt <= 0) return
    if (!confirm(`Odštejem ${ar(amt)} iz ${potLabel(method, company)}?`)) return
    setSaving(true)
    try {
      await addAccountingPayment({ amountAr: amt, date, note, method, company })
      resetAdd()
      await mutate()
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (p: NabavaPurchase) => {
    setEditId(p.id)
    setENote(p.name === "Računovodstvo" ? "" : p.name)
    setEAmount(String(p.amountAr || ""))
    setEMethod(p.payMethod === "orange" ? "orange" : "cash")
    setECompany(p.company === "sarl" ? "sarl" : "tourism")
    setEDate((p.date || today).slice(0, 10))
  }

  const handleSaveEdit = async () => {
    if (!editId) return
    const amt = parseAmt(eAmount)
    if (amt <= 0) return
    setSaving(true)
    try {
      await updateAccountingPayment({ id: editId, amountAr: amt, date: eDate, note: eNote, method: eMethod, company: eCompany })
      setEditId(null)
      await mutate()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (p: NabavaPurchase) => {
    const where = p.payMethod === "orange" ? "Orange Money" : "blagajne"
    if (!confirm(`Izbrišem računovodstvo? Odliv iz ${where} se bo razveljavil.`)) return
    await deleteNabavaPurchase(p.id)
    await mutate()
  }

  const methodButtons = (
    current: "cash" | "orange",
    set: (m: "cash" | "orange") => void,
  ) => (
    <div className="flex gap-2">
      {(["cash", "orange"] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => set(m)}
          className={`flex-1 rounded-lg px-3 py-2 text-[11px] font-medium border transition-colors ${current === m ? "" : "bg-[#0f2e3a]/5 text-[#2b2622]/60 border-[#0f2e3a]/15 hover:bg-[#0f2e3a]/10"}`}
          style={current === m ? { backgroundColor: `${ACCENT}22`, borderColor: `${ACCENT}66`, color: ACCENT } : undefined}
        >
          {m === "cash" ? "Gotovina" : "Orange Money"}
        </button>
      ))}
    </div>
  )

  const companyButtons = (current: "tourism" | "sarl", set: (c: "tourism" | "sarl") => void) => (
    <div className="flex gap-2">
      {(["tourism", "sarl"] as const).map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => set(c)}
          className={`flex-1 rounded-lg px-2 py-1.5 text-[10px] font-medium border transition-colors ${
            current === c ? "bg-[#4f7a54]/15 text-[#4f7a54] border-[#4f7a54]/40" : "bg-[#0f2e3a]/5 text-[#2b2622]/60 border-[#0f2e3a]/15"
          }`}
        >
          Blagajna {c === "tourism" ? "Tourism" : "SARL"}
        </button>
      ))}
    </div>
  )

  const body = (
    <div className="rounded-lg border border-dashed p-2.5" style={{ borderColor: `${ACCENT}55`, backgroundColor: `${ACCENT}08` }}>
      {rows.length > 0 && (
        <div className="mb-2 space-y-1.5">
          {rows.map((p) =>
            editId === p.id ? (
              <div key={p.id} className="rounded-lg border border-[#0f2e3a]/15 bg-white/60 p-2 space-y-2">
                <input
                  value={eNote}
                  onChange={(e) => setENote(e.target.value)}
                  placeholder="Opomba (neobvezno)"
                  className="w-full rounded-lg border border-[#0f2e3a]/15 bg-[#0f2e3a]/5 px-2 py-1.5 text-[11px] text-[#0f2e3a] focus:outline-none"
                />
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[#2b2622]/55">Znesek:</span>
                  <input
                    inputMode="numeric"
                    value={eAmount}
                    onChange={(e) => setEAmount(e.target.value)}
                    placeholder="0"
                    className="flex-1 rounded-lg border border-[#0f2e3a]/15 bg-[#0f2e3a]/5 px-2 py-1.5 text-[11px] text-[#0f2e3a] focus:outline-none"
                  />
                  <span className="text-[10px] text-[#2b2622]/55">Ar</span>
                </div>
                {methodButtons(eMethod, setEMethod)}
                {eMethod === "cash" && companyButtons(eCompany, setECompany)}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[#2b2622]/55">Datum:</span>
                  <input
                    type="date"
                    value={eDate}
                    onChange={(e) => setEDate(e.target.value)}
                    className="flex-1 rounded-lg border border-[#0f2e3a]/15 bg-[#0f2e3a]/5 px-2 py-1.5 text-[11px] text-[#0f2e3a] [color-scheme:light] focus:outline-none"
                  />
                </div>
                <div className="flex gap-1.5">
                  <button
                    disabled={saving || parseAmt(eAmount) <= 0}
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
                    <span className="truncate text-[11px] font-semibold text-[#0f2e3a]">{p.name || "Računovodstvo"}</span>
                    <span
                      className="shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide"
                      style={{ backgroundColor: `${BADGE}1a`, color: BADGE }}
                    >
                      računovodstvo
                    </span>
                  </div>
                  <p className="text-[10px] text-[#2b2622]/55">
                    {ar(p.amountAr)} · {p.payMethod === "orange" ? <span className="font-medium text-[#c4741f]">Orange Money</span> : methodLabel(p)}
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
                    aria-label="Uredi računovodstvo"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(p)}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-[#0f2e3a]/15 bg-[#0f2e3a]/5 text-[#2b2622]/60 transition-colors hover:bg-red-500/10 hover:text-red-600 hover:border-red-500/40"
                    aria-label="Izbriši računovodstvo"
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
          <p className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.15em]" style={{ color: ACCENT }}>
            <Calculator className="h-3.5 w-3.5" /> računovodstvo
          </p>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Opomba (neobvezno)"
            className="w-full rounded-lg border border-[#0f2e3a]/15 bg-[#0f2e3a]/5 px-2 py-1.5 text-[11px] text-[#0f2e3a] focus:outline-none"
          />
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
          {methodButtons(method, setMethod)}
          {method === "cash" && companyButtons(company, setCompany)}
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
              disabled={saving || parseAmt(amount) <= 0}
              onClick={handleAdd}
              className="flex-1 rounded-lg px-3 py-2 text-[11px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              style={{ backgroundColor: `${ACCENT}22`, border: `1px solid ${ACCENT}66`, color: ACCENT }}
            >
              {saving ? "Beležim…" : method === "orange" ? "Zabeleži (odštej iz Orange Money)" : "Zabeleži (odštej iz blagajne)"}
            </button>
            <button
              onClick={resetAdd}
              className="rounded-lg border border-[#0f2e3a]/15 bg-[#0f2e3a]/5 px-3 py-2 text-[11px] font-medium text-[#2b2622]/70"
              aria-label="Zapri"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => {
            setDate(resortToday())
            setAdding(true)
          }}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-dashed px-4 py-2 transition-colors"
          style={{ borderColor: `${ACCENT}55`, color: ACCENT }}
        >
          <Calculator className="h-3.5 w-3.5" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.15em]">računovodstvo</span>
        </button>
      )}
    </div>
  )

  if (tripId) return body
  return <div className="mb-4 rounded-xl border border-[#c9a86a]/15 bg-[#f7f2e7] p-3">{body}</div>
}
