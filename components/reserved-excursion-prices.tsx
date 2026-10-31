"use client"

import React from "react"
import { updateExcursionBooking } from "@/app/actions/komba"
import {
  reservedExcursionTotal,
  seedReservedExcursionDraft,
  withBoatChoice,
  withBoatPer,
  withEntrance,
  withEntranceCount,
  withLunch,
  withLunchCount,
  withLunchProvider,
  withPax,
  withTransport,
  type ReservedExcursionDraft,
} from "@/lib/reserved-excursion-price"

type Booking = {
  id: string
  excursionId: string
  boatId?: string | null
  pax?: number
  guestPrice?: number
  entranceFee?: number
  lunchPrice?: number
  lunchPax?: number
  entrancePax?: number | null
  boatPriceEur?: number | null
  lunchProviderId?: string | null
  paymentStatus?: string | null
}

type Boat = { id: string; name: string; engine?: string }
type LunchProvider = { id: string; name: string; location: string | null; pricePerPersonAr: number }

const eur = (value: number) => `${(Number.isFinite(value) ? value : 0).toFixed(2)} EUR`
const fieldClass = "w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white focus:border-[#7fa8b8]/50 focus:outline-none"
const moneyClass = "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-[#7fa8b8]/50 focus:outline-none"

function readAmount(raw: string) {
  if (raw.trim() === "") return 0
  const n = Number(raw)
  return Number.isFinite(n) ? Math.max(0, n) : 0
}

export function ReservedExcursionPrices({
  exc,
  reservationPax,
  boats,
  lunchProviders,
  entranceFeeAr,
  exchangeRate,
  boatPerFromCatalog,
  onRefresh,
}: {
  exc: Booking
  reservationPax: number
  boats: Boat[]
  lunchProviders: LunchProvider[]
  entranceFeeAr: number
  exchangeRate: number
  boatPerFromCatalog: (boatId: string, pax: number) => number
  onRefresh: () => void
}) {
  const entrancePer = exchangeRate > 0 ? (Number(entranceFeeAr) || 0) / exchangeRate : 0
  const providerFor = (id: string) => lunchProviders.find(lp => lp.id === id)
  const lunchPerOf = (id: string) => {
    const provider = providerFor(id)
    return provider && exchangeRate > 0 ? (Number(provider.pricePerPersonAr) || 0) / exchangeRate : 0
  }

  const seed = React.useCallback(() => seedReservedExcursionDraft({
    pax: Number(exc.pax) || 0,
    fallbackPax: reservationPax,
    boatId: exc.boatId || "",
    guestPrice: Number(exc.guestPrice) || 0,
    entranceFee: Number(exc.entranceFee) || 0,
    lunchPrice: Number(exc.lunchPrice) || 0,
    lunchPax: Number(exc.lunchPax) || 0,
    entrancePax: exc.entrancePax == null ? null : Number(exc.entrancePax),
    boatPriceEur: exc.boatPriceEur == null ? null : Number(exc.boatPriceEur),
    lunchProviderId: exc.lunchProviderId || "",
    entrancePer,
    lunchPer: lunchPerOf(exc.lunchProviderId || ""),
  }), [
    exc.pax, exc.boatId, exc.guestPrice, exc.entranceFee, exc.lunchPrice, exc.lunchPax,
    exc.entrancePax, exc.boatPriceEur, exc.lunchProviderId, reservationPax, entrancePer, lunchProviders, exchangeRate,
  ])

  const [draft, setDraft] = React.useState<ReservedExcursionDraft>(seed)
  const dirty = React.useRef(false)
  const version = React.useRef(0)
  const draftRef = React.useRef(draft)
  draftRef.current = draft

  const serverKey = [
    exc.pax, exc.boatId, exc.guestPrice, exc.entranceFee, exc.lunchPrice, exc.lunchPax,
    exc.entrancePax, exc.boatPriceEur, exc.lunchProviderId, reservationPax, entranceFeeAr, exchangeRate,
  ].join("|")

  React.useEffect(() => {
    if (dirty.current) return
    setDraft(seed())
  }, [serverKey, seed])

  const lunchPer = lunchPerOf(draft.lunchProviderId)
  const total = reservedExcursionTotal(draft)

  function edit(update: (d: ReservedExcursionDraft) => ReservedExcursionDraft) {
    version.current += 1
    dirty.current = true
    setDraft(prev => {
      const next = update(prev)
      draftRef.current = next
      return next
    })
  }

  async function persist(next: ReservedExcursionDraft, gen: number) {
    const ready = next.pax < 1 ? withPax(next, 1, entrancePer, lunchPerOf(next.lunchProviderId)) : next
    if (ready !== next) {
      draftRef.current = ready
      setDraft(ready)
    }
    try {
      await updateExcursionBooking(exc.id, {
        pax: ready.pax,
        boatId: ready.boatId,
        guestPrice: ready.transport,
        entranceFee: ready.entrance,
        lunchPrice: ready.lunch,
        lunchPax: ready.lunchCount,
        entrancePax: ready.entranceCount,
        boatPriceEur: ready.boatPer,
        lunchProviderId: ready.lunchProviderId,
      })
      if (version.current !== gen) return
      dirty.current = false
      onRefresh()
    } catch (err) {
      console.error(err)
    }
  }

  function commit(update?: (d: ReservedExcursionDraft) => ReservedExcursionDraft) {
    let next = draftRef.current
    if (update) {
      version.current += 1
      next = update(next)
      draftRef.current = next
      setDraft(next)
    }
    dirty.current = true
    void persist(next, version.current)
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] text-white/40 mb-1">Coln</label>
          <select
            className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white focus:border-[#c59b5b]/50 focus:outline-none [&>option]:bg-[#0f2e3a] [&>option]:text-white"
            value={draft.boatId}
            onChange={e => {
              const boatId = e.target.value
              const per = boatId ? boatPerFromCatalog(boatId, Math.max(draft.pax, 1)) : draft.boatPer
              commit(d => boatId ? withBoatChoice(d, boatId, per) : { ...d, boatId: "" })
            }}
          >
            <option value="">-- Izberi --</option>
            {boats.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] text-white/40 mb-1">Oseb</label>
          <input
            type="number"
            min="1"
            inputMode="numeric"
            aria-label="Oseb"
            className={fieldClass}
            value={draft.pax === 0 ? "" : draft.pax}
            onChange={e => edit(d => withPax(d, readAmount(e.target.value), entrancePer, lunchPer))}
            onBlur={() => commit()}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="block text-[10px] text-white/40 mb-1">Kosila</label>
          <input
            type="number"
            min="0"
            inputMode="numeric"
            aria-label="Kosila"
            className={fieldClass + " text-center"}
            value={draft.lunchCount === 0 ? "" : draft.lunchCount}
            placeholder="0"
            onChange={e => edit(d => withLunchCount(d, readAmount(e.target.value), lunchPer))}
            onBlur={() => commit()}
          />
        </div>
        <div>
          <label className="block text-[10px] text-white/40 mb-1">Vstopnine</label>
          <input
            type="number"
            min="0"
            inputMode="numeric"
            aria-label="Vstopnine"
            className={fieldClass + " text-center"}
            value={draft.entranceCount === 0 ? "" : draft.entranceCount}
            placeholder="0"
            onChange={e => edit(d => withEntranceCount(d, readAmount(e.target.value), entrancePer))}
            onBlur={() => commit()}
          />
        </div>
        <div>
          <label className="block text-[10px] text-white/40 mb-1">Coln EUR/os</label>
          <input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            aria-label="Coln EUR/os"
            className={fieldClass + " text-center"}
            value={draft.boatPer === 0 ? "" : draft.boatPer}
            placeholder="0"
            onChange={e => edit(d => withBoatPer(d, readAmount(e.target.value)))}
            onBlur={() => commit()}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-white/40 mb-1">Vstopnina (EUR)</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              aria-label="Vstopnina (EUR)"
              className={moneyClass}
              value={draft.entrance}
              onChange={e => edit(d => withEntrance(d, readAmount(e.target.value)))}
              onBlur={() => commit()}
            />
            <button
              type="button"
              onClick={() => commit(d => withEntranceCount(d, d.entranceCount > 0 ? d.entranceCount : d.pax, entrancePer))}
              className="px-2 py-2 rounded-lg bg-white/5 text-xs text-white/60 hover:bg-white/10 whitespace-nowrap"
              title="Izracunaj iz cenika"
            >
              Auto
            </button>
          </div>
        </div>
        <div>
          <label className="block text-xs text-white/40 mb-1">Ponudnik kosila</label>
          <select
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-[#c4744a]/50 focus:outline-none [&>option]:bg-[#0f2e3a] [&>option]:text-white"
            value={draft.lunchProviderId}
            onChange={e => {
              const providerId = e.target.value
              commit(d => withLunchProvider(d, providerId, lunchPerOf(providerId)))
            }}
          >
            <option value="">-- Brez kosila --</option>
            {lunchProviders.map(lp => (
              <option key={lp.id} value={lp.id}>
                {lp.name} {lp.location ? `(${lp.location})` : ""} - {eur(lunchPerOf(lp.id))}/os
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-white/40 mb-1">Cena kosila (EUR)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            aria-label="Cena kosila (EUR)"
            className={moneyClass + " focus:border-[#c4744a]/50"}
            value={draft.lunch}
            onChange={e => edit(d => withLunch(d, readAmount(e.target.value)))}
            onBlur={() => commit()}
          />
        </div>
        <div className="flex items-end pb-2">
          <p className="text-xs text-white/40">Skupaj kosilo: {eur(draft.lunch)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.2em] text-[#9dafb5]">Cena transporta (EUR)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            aria-label="Cena transporta (EUR)"
            className="w-full rounded-[1.1rem] border border-white/10 bg-white/[0.03] px-5 py-3.5 text-[#f8f5ef] placeholder:text-[#43616d] transition-all duration-300 focus:border-[#c59b5b]/40 focus:outline-none focus:ring-2 focus:ring-[#c59b5b]/10"
            value={draft.transport}
            onChange={e => edit(d => withTransport(d, readAmount(e.target.value)))}
            onBlur={() => commit()}
          />
        </div>
        <div>
          <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">Status placila</label>
          <select
            className="w-full rounded-[1.1rem] border border-white/10 bg-white/5 px-5 py-3 text-white transition-all duration-300 focus:border-[#c59b5b]/50 focus:outline-none focus:ring-2 focus:ring-[#c59b5b]/20 cursor-pointer"
            value={exc.paymentStatus || "UNPAID"}
            onChange={async e => {
              await updateExcursionBooking(exc.id, { paymentStatus: e.target.value })
              onRefresh()
            }}
          >
            <option value="PREPAID" className="bg-[#0a2029] text-white">Vkljuceno v rezervacijo</option>
            <option value="PAID" className="bg-[#0a2029] text-white">Placano</option>
            <option value="UNPAID" className="bg-[#0a2029] text-white">Se ni placano</option>
          </select>
        </div>
      </div>

      <div className="p-3 rounded-lg bg-[#7fa8b8]/10 border border-[#7fa8b8]/20">
        <div className="flex justify-between text-xs text-white/60">
          <span>Transport:</span>
          <span>{eur(draft.transport)}</span>
        </div>
        <div className="flex justify-between text-xs text-white/60">
          <span>Vstopnina:</span>
          <span>{eur(draft.entrance)}</span>
        </div>
        {(draft.lunchProviderId || draft.lunch > 0) && (
          <div className="flex justify-between text-xs text-white/60">
            <span>Kosilo:</span>
            <span>{eur(draft.lunch)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm font-medium text-[#7fa8b8] pt-2 mt-2 border-t border-[#7fa8b8]/20">
          <span>SKUPAJ:</span>
          <span>{eur(total)}</span>
        </div>
      </div>
    </>
  )
}
