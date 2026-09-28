'use client'

import React, { useState, useMemo } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2, Save, Check, Palmtree, Ship, Utensils, Sparkles } from 'lucide-react'
import { getBackfillOptions, backfillPastReservation, type BackfillInput } from '@/app/actions/backfill'

const fetcher = async () => await getBackfillOptions()
const ar = (v: number) => `${Math.round(v || 0).toLocaleString('de-DE')} Ar`

const BOOKING_SOURCES = ['', 'Direct Website', 'Booking.com', 'Airbnb', 'Agency', 'Other']
const MEAL_PLANS = [
  { v: '', label: 'Brez penziona' },
  { v: 'B', label: 'Zajtrk (B)' },
  { v: 'HB', label: 'Polpenzion (HB)' },
  { v: 'FB', label: 'Polni penzion (FB)' },
]

type ExcRow = { excursionId: string; amountEur: string }
type TrfRow = { routeId: string; type: 'arrival' | 'departure'; pax: string; amountEur: string }
type PayRow = {
  method: 'cash' | 'card' | 'orange_money'
  amountEur: string
  date: string
  cashCompany: 'tourism' | 'sarl'
  omAmountAr: string
  writeToRegister: boolean
}

export default function PretekleRezervacijePage() {
  const { data: opts } = useSWR('backfill-options', fetcher)
  const rate = opts?.rate || 4800

  // Reservation
  const [guestName, setGuestName] = useState('')
  const [bungalow, setBungalow] = useState('')
  const [arrival, setArrival] = useState('')
  const [departure, setDeparture] = useState('')
  const [pax, setPax] = useState('2')
  const [nationality, setNationality] = useState('')
  const [bookingSource, setBookingSource] = useState('')
  const [agencyName, setAgencyName] = useState('')
  const [agencyCommission, setAgencyCommission] = useState('')
  const [mealPlan, setMealPlan] = useState('')

  // Revenue (EUR)
  const [accommodationEur, setAccommodationEur] = useState('')
  const [drinksEur, setDrinksEur] = useState('')
  const [excRows, setExcRows] = useState<ExcRow[]>([])
  const [trfRows, setTrfRows] = useState<TrfRow[]>([])

  // Individual à-la-carte meals — counts, priced from the catalogue, logged separately from HB.
  const [mealBreakfast, setMealBreakfast] = useState('')
  const [mealLunch, setMealLunch] = useState('')
  const [mealDinner, setMealDinner] = useState('')
  const [mealSnack, setMealSnack] = useState('')

  // Extra services — massage (Wellness) and chocolate (shop), counts × catalogue price.
  const [massageCount, setMassageCount] = useState('')
  const [chocolateCount, setChocolateCount] = useState('')

  // Payments — one or more lines (a stay may be split across methods).
  const [payRows, setPayRows] = useState<PayRow[]>([
    { method: 'cash', amountEur: '', date: '', cashCompany: 'tourism', omAmountAr: '', writeToRegister: true },
  ])

  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const num = (s: string) => Number(s.replace(',', '.')) || 0

  // À-la-carte meals total (EUR) from counts × per-unit catalogue price.
  const mealPricesEur = useMemo(() => {
    const p: { breakfast?: number; lunch?: number; dinner?: number; snack?: number } = opts?.mealItemPricesAr || {}
    const r = opts?.rate || 0
    const eur = (ar: number) => (ar > 0 && r > 0 ? ar / r : 0)
    return {
      breakfast: eur(p.breakfast || 0),
      lunch: eur(p.lunch || 0),
      dinner: eur(p.dinner || 0),
      snack: eur(p.snack || 0),
    }
  }, [opts])
  const mealsEur = useMemo(() =>
    num(mealBreakfast) * mealPricesEur.breakfast +
    num(mealLunch) * mealPricesEur.lunch +
    num(mealDinner) * mealPricesEur.dinner +
    num(mealSnack) * mealPricesEur.snack,
    [mealBreakfast, mealLunch, mealDinner, mealSnack, mealPricesEur])

  // Extra services (massage + chocolate) EUR from counts × per-unit catalogue price.
  const massagePriceEur = useMemo(() => {
    const r = opts?.rate || 0
    return opts?.massagePriceAr && r ? opts.massagePriceAr / r : 0
  }, [opts])
  const chocolatePriceEur = useMemo(() => {
    const r = opts?.rate || 0
    return opts?.chocolatePriceAr && r ? opts.chocolatePriceAr / r : 0
  }, [opts])
  const extrasEur = useMemo(() =>
    num(massageCount) * massagePriceEur + num(chocolateCount) * chocolatePriceEur,
    [massageCount, chocolateCount, massagePriceEur, chocolatePriceEur])

  const totalEur = useMemo(() => {
    return (
      num(accommodationEur) +
      num(drinksEur) +
      mealsEur +
      extrasEur +
      excRows.reduce((s, e) => s + num(e.amountEur), 0) +
      trfRows.reduce((s, t) => s + num(t.amountEur), 0)
    )
  }, [accommodationEur, drinksEur, mealsEur, extrasEur, excRows, trfRows])

  const paidEur = useMemo(() => payRows.reduce((s, p) => s + num(p.amountEur), 0), [payRows])

  // Nights between arrival and departure.
  const nights = useMemo(() => {
    if (!arrival || !departure) return 0
    const a = new Date(arrival), d = new Date(departure)
    const n = Math.ceil((d.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
    return n > 0 ? n : 0
  }, [arrival, departure])

  // Board (meal plan) value in EUR = per-person-per-night price × pax × nights.
  // This mirrors how the owner report carves board out of the accommodation total and books
  // it as kitchen revenue (with a derived food cost). It is included in "Bivanje", not added on top.
  const boardPerDayEur = useMemo(() => {
    const ar = opts?.mealPlanPricesAr?.[mealPlan] || 0
    const rate = opts?.rate || 0
    return ar > 0 && rate > 0 ? ar / rate : 0
  }, [opts, mealPlan])
  const boardTotalEur = useMemo(() => boardPerDayEur * (Number(pax) || 0) * nights, [boardPerDayEur, pax, nights])

  const inputCls =
    'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#c59b5b]/50 focus:outline-none [color-scheme:dark]'
  const labelCls = 'mb-1 block text-[11px] font-medium uppercase tracking-[0.08em] text-white/50'

  async function handleSave() {
    setMsg(null)
    if (!guestName.trim()) return setMsg({ ok: false, text: 'Vnesite ime gosta.' })
    if (!bungalow) return setMsg({ ok: false, text: 'Izberite bungalov.' })
    if (!arrival || !departure) return setMsg({ ok: false, text: 'Vnesite datuma prihoda in odhoda.' })
    if (departure <= arrival) return setMsg({ ok: false, text: 'Odhod mora biti po prihodu.' })

    const validPays = payRows.filter(p => num(p.amountEur) > 0)
    if (validPays.length === 0) return setMsg({ ok: false, text: 'Dodajte vsaj eno plačilo z zneskom.' })
    if (validPays.some(p => !p.date)) return setMsg({ ok: false, text: 'Vnesite datum pri vsakem plačilu.' })

    const input: BackfillInput = {
      guestName: guestName.trim(),
      bungalow,
      arrival,
      departure,
      pax: num(pax),
      nationality: nationality.trim() || undefined,
      bookingSource: bookingSource || undefined,
      agencyName: agencyName.trim() || undefined,
      agencyCommission: num(agencyCommission) || undefined,
      mealPlan: mealPlan || undefined,
      meals: {
        breakfast: num(mealBreakfast),
        lunch: num(mealLunch),
        dinner: num(mealDinner),
        snack: num(mealSnack),
      },
      massageCount: num(massageCount),
      chocolateCount: num(chocolateCount),
      accommodationEur: num(accommodationEur),
      drinksEur: num(drinksEur),
      excursions: excRows
        .filter(e => e.excursionId && num(e.amountEur) > 0)
        .map(e => ({ excursionId: e.excursionId, amountEur: num(e.amountEur) })),
      transfers: trfRows
        .filter(t => t.routeId && num(t.amountEur) > 0)
        .map(t => ({ routeId: t.routeId, type: t.type, pax: num(t.pax), amountEur: num(t.amountEur) })),
      payments: validPays.map(p => ({
        method: p.method,
        amountEur: num(p.amountEur),
        date: p.date,
        cashCompany: p.method === 'cash' ? p.cashCompany : undefined,
        omAmountAr: p.method === 'orange_money' ? num(p.omAmountAr) : undefined,
        writeToRegister: p.writeToRegister,
      })),
    }

    setSaving(true)
    const res = await backfillPastReservation(input)
    setSaving(false)

    if (res.error) return setMsg({ ok: false, text: res.error })
    setMsg({ ok: true, text: `Pretekla rezervacija za ${input.guestName} je shranjena.` })
    // Reset for quick sequential entry (keep payment method + company as they often repeat).
    setGuestName(''); setBungalow(''); setArrival(''); setDeparture(''); setPax('2')
    setNationality(''); setBookingSource(''); setAgencyName(''); setAgencyCommission(''); setMealPlan('')
    setAccommodationEur(''); setDrinksEur(''); setExcRows([]); setTrfRows([])
    setMealBreakfast(''); setMealLunch(''); setMealDinner(''); setMealSnack('')
    setMassageCount(''); setChocolateCount('')
    setPayRows([{ method: 'cash', amountEur: '', date: '', cashCompany: 'tourism', omAmountAr: '', writeToRegister: true }])
  }

  return (
    <div className="min-h-screen bg-[#0a2029] text-white">
      <div className="mx-auto max-w-3xl px-4 py-6">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <Link href="/" className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 transition-colors hover:bg-white/10" aria-label="Nazaj">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="font-serif text-2xl text-[#c59b5b]">Vnos pretekle rezervacije</h1>
            <p className="text-sm text-white/50">Za že opravljene in plačane rezervacije — gredo naravnost v arhiv.</p>
          </div>
        </div>

        <div className="space-y-5">
          {/* Guest & stay */}
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.1em] text-white/70">Gost in bivanje</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={labelCls}>Ime gosta</label>
                <input className={inputCls} value={guestName} onChange={e => setGuestName(e.target.value)} placeholder="Ime in priimek" />
              </div>
              <div>
                <label className={labelCls}>Bungalov</label>
                <select className={inputCls} value={bungalow} onChange={e => setBungalow(e.target.value)}>
                  <option value="">— izberi —</option>
                  {opts?.bungalows.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Št. oseb</label>
                <input type="number" min={1} className={inputCls} value={pax} onChange={e => setPax(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Prihod</label>
                <input type="date" className={inputCls} value={arrival} onChange={e => setArrival(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Odhod</label>
                <input type="date" className={inputCls} value={departure} onChange={e => setDeparture(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Narodnost (neobvezno)</label>
                <input className={inputCls} value={nationality} onChange={e => setNationality(e.target.value)} placeholder="npr. German" />
              </div>
              <div>
                <label className={labelCls}>Penzion</label>
                <select className={inputCls} value={mealPlan} onChange={e => setMealPlan(e.target.value)}>
                  {MEAL_PLANS.map(m => <option key={m.v} value={m.v}>{m.label}</option>)}
                </select>
              </div>
              {mealPlan && boardPerDayEur > 0 && (
                <div className="sm:col-span-2 rounded-xl border border-[#8fae92]/25 bg-[#8fae92]/[0.06] p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] uppercase tracking-[0.08em] text-white/50">Vrednost penziona</span>
                    <span className="font-serif text-lg text-[#8fae92]">{boardTotalEur.toFixed(2)} EUR</span>
                  </div>
                  <p className="mt-1 text-[12px] text-white/60">
                    {boardPerDayEur.toFixed(2)} EUR / osebo / dan × {pax || 0} os. × {nights} {nights === 1 ? 'noč' : 'noči'}
                  </p>
                  <p className="mt-2 text-[11px] leading-relaxed text-white/40">
                    Ta znesek je že vključen v ceni bivanja (ne prišteva se posebej). V poročilu za lastnika
                    se izloči iz nočitev in prikaže kot prihodek kuhinje; strošek hrane se izračuna samodejno
                    po odstotku iz cenika.
                  </p>
                </div>
              )}
              <div>
                <label className={labelCls}>Vir rezervacije</label>
                <select className={inputCls} value={bookingSource} onChange={e => setBookingSource(e.target.value)}>
                  {BOOKING_SOURCES.map(s => <option key={s} value={s}>{s || '— brez —'}</option>)}
                </select>
              </div>
              {bookingSource === 'Agency' && (
                <>
                  <div>
                    <label className={labelCls}>Ime agencije</label>
                    <input className={inputCls} value={agencyName} onChange={e => setAgencyName(e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>Provizija (EUR)</label>
                    <input type="number" className={inputCls} value={agencyCommission} onChange={e => setAgencyCommission(e.target.value)} />
                  </div>
                </>
              )}
            </div>
          </section>

          {/* Revenue */}
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.1em] text-white/70">Prihodek (v EUR)</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Bivanje</label>
                <input type="number" className={inputCls} value={accommodationEur} onChange={e => setAccommodationEur(e.target.value)} placeholder="0" />
                {num(accommodationEur) > 0 && <p className="mt-1 text-[11px] text-white/40">{ar(num(accommodationEur) * rate)}</p>}
              </div>
              <div>
                <label className={labelCls}>Pijača skupaj</label>
                <input type="number" className={inputCls} value={drinksEur} onChange={e => setDrinksEur(e.target.value)} placeholder="0" />
                {num(drinksEur) > 0 && <p className="mt-1 text-[11px] text-white/40">{ar(num(drinksEur) * rate)}</p>}
              </div>
            </div>

            {/* À-la-carte meals — counts, logged separately from the HB/FB board */}
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[12px] font-medium text-[#c59b5b]"><Utensils className="h-3.5 w-3.5" />Obroki (ločeno od penziona)</span>
                {mealsEur > 0 && <span className="text-[12px] text-[#c59b5b]">{mealsEur.toFixed(2)} EUR</span>}
              </div>
              <p className="mb-2 text-[11px] text-white/40">Vpiši število obrokov, plačanih posebej (ne v HB/FB). Cena iz cenika.</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {([
                  ['Zajtrki', mealBreakfast, setMealBreakfast, mealPricesEur.breakfast],
                  ['Kosila', mealLunch, setMealLunch, mealPricesEur.lunch],
                  ['Večerje', mealDinner, setMealDinner, mealPricesEur.dinner],
                  ['Snacki', mealSnack, setMealSnack, mealPricesEur.snack],
                ] as const).map(([label, val, setter, price]) => (
                  <div key={label}>
                    <label className={labelCls}>{label}</label>
                    <input type="number" min="0" className={inputCls} value={val} placeholder="0"
                      onChange={e => (setter as (v: string) => void)(e.target.value)} />
                    <p className="mt-1 text-[10px] text-white/40">
                      {price.toFixed(2)} €/kos{num(val) > 0 ? ` · ${(num(val) * price).toFixed(2)} €` : ''}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Extra services — massage (Wellness) + chocolate (shop) */}
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[12px] font-medium text-[#c59b5b]"><Sparkles className="h-3.5 w-3.5" />Dodatno (masaža, čokolada)</span>
                {extrasEur > 0 && <span className="text-[12px] text-[#c59b5b]">{extrasEur.toFixed(2)} EUR</span>}
              </div>
              <p className="mb-2 text-[11px] text-white/40">Vpiši število. Cena iz cenika.</p>
              <div className="grid grid-cols-2 gap-3">
                {([
                  ['Masaže', massageCount, setMassageCount, massagePriceEur],
                  ['Čokolade', chocolateCount, setChocolateCount, chocolatePriceEur],
                ] as const).map(([label, val, setter, price]) => (
                  <div key={label}>
                    <label className={labelCls}>{label}</label>
                    <input type="number" min="0" className={inputCls} value={val} placeholder="0"
                      onChange={e => (setter as (v: string) => void)(e.target.value)} />
                    <p className="mt-1 text-[10px] text-white/40">
                      {price.toFixed(2)} €/kos{num(val) > 0 ? ` · ${(num(val) * price).toFixed(2)} €` : ''}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Excursions */}
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[12px] font-medium text-[#8fae92]"><Palmtree className="h-3.5 w-3.5" />Izleti</span>
                <button onClick={() => setExcRows(r => [...r, { excursionId: '', amountEur: '' }])}
                  className="flex items-center gap-1 rounded-lg border border-[#8fae92]/30 bg-[#8fae92]/10 px-2.5 py-1 text-[11px] font-medium text-[#8fae92] transition-colors hover:bg-[#8fae92]/20">
                  <Plus className="h-3 w-3" />Dodaj izlet
                </button>
              </div>
              {excRows.length === 0 && <p className="text-[11px] italic text-white/30">Ni dodanih izletov.</p>}
              <div className="space-y-2">
                {excRows.map((row, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <select className={inputCls + ' flex-1'} value={row.excursionId}
                      onChange={e => setExcRows(r => r.map((x, j) => j === i ? { ...x, excursionId: e.target.value } : x))}>
                      <option value="">— izberi izlet —</option>
                      {opts?.excursions.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
                    </select>
                    <input type="number" placeholder="EUR" className={inputCls + ' w-24'} value={row.amountEur}
                      onChange={e => setExcRows(r => r.map((x, j) => j === i ? { ...x, amountEur: e.target.value } : x))} />
                    <button onClick={() => setExcRows(r => r.filter((_, j) => j !== i))}
                      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-[#b0203a]/30 text-[#e0687c] transition-colors hover:bg-[#b0203a]/20" aria-label="Odstrani izlet">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Transfers */}
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[12px] font-medium text-[#7fa8b8]"><Ship className="h-3.5 w-3.5" />Prevozi</span>
                <button onClick={() => setTrfRows(r => [...r, { routeId: '', type: 'arrival', pax: pax || '2', amountEur: '' }])}
                  className="flex items-center gap-1 rounded-lg border border-[#7fa8b8]/30 bg-[#7fa8b8]/10 px-2.5 py-1 text-[11px] font-medium text-[#7fa8b8] transition-colors hover:bg-[#7fa8b8]/20">
                  <Plus className="h-3 w-3" />Dodaj prevoz
                </button>
              </div>
              {trfRows.length === 0 && <p className="text-[11px] italic text-white/30">Ni dodanih prevozov.</p>}
              <div className="space-y-2">
                {trfRows.map((row, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2">
                    <select className={inputCls + ' min-w-[140px] flex-1'} value={row.routeId}
                      onChange={e => setTrfRows(r => r.map((x, j) => j === i ? { ...x, routeId: e.target.value } : x))}>
                      <option value="">— izberi relacijo —</option>
                      {opts?.routes.map(rt => <option key={rt.id} value={rt.id}>{rt.name}</option>)}
                    </select>
                    <select className={inputCls + ' w-28'} value={row.type}
                      onChange={e => setTrfRows(r => r.map((x, j) => j === i ? { ...x, type: e.target.value as 'arrival' | 'departure' } : x))}>
                      <option value="arrival">Prihod</option>
                      <option value="departure">Odhod</option>
                    </select>
                    <input type="number" placeholder="Oseb" className={inputCls + ' w-16'} value={row.pax}
                      onChange={e => setTrfRows(r => r.map((x, j) => j === i ? { ...x, pax: e.target.value } : x))} />
                    <input type="number" placeholder="EUR" className={inputCls + ' w-24'} value={row.amountEur}
                      onChange={e => setTrfRows(r => r.map((x, j) => j === i ? { ...x, amountEur: e.target.value } : x))} />
                    <button onClick={() => setTrfRows(r => r.filter((_, j) => j !== i))}
                      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-[#b0203a]/30 text-[#e0687c] transition-colors hover:bg-[#b0203a]/20" aria-label="Odstrani prevoz">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Payments — one or more lines */}
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[13px] font-semibold uppercase tracking-[0.1em] text-white/70">Plačila</h2>
              <button onClick={() => setPayRows(r => [...r, { method: 'card', amountEur: '', date: r[r.length - 1]?.date || '', cashCompany: 'tourism', omAmountAr: '', writeToRegister: true }])}
                className="flex items-center gap-1 rounded-lg border border-[#c59b5b]/30 bg-[#c59b5b]/10 px-2.5 py-1 text-[11px] font-medium text-[#c59b5b] transition-colors hover:bg-[#c59b5b]/20">
                <Plus className="h-3 w-3" />Dodaj plačilo
              </button>
            </div>
            <p className="mb-3 text-[11px] text-white/40">Eno plačilo ali več (npr. del gotovina, del kartica).</p>

            <div className="space-y-3">
              {payRows.map((row, i) => (
                <div key={i} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-white/40">Plačilo {i + 1}</span>
                    {payRows.length > 1 && (
                      <button onClick={() => setPayRows(r => r.filter((_, j) => j !== i))}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#b0203a]/30 text-[#e0687c] transition-colors hover:bg-[#b0203a]/20" aria-label="Odstrani plačilo">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className={labelCls}>Način</label>
                      <div className="flex gap-2">
                        {([['cash', 'Gotovina'], ['card', 'Kartica'], ['orange_money', 'OM']] as const).map(([v, l]) => (
                          <button key={v} onClick={() => setPayRows(r => r.map((x, j) => j === i ? { ...x, method: v } : x))}
                            className={`flex-1 rounded-lg border px-2 py-2 text-[11px] font-medium transition-colors ${row.method === v ? 'border-[#c59b5b]/50 bg-[#c59b5b]/15 text-[#c59b5b]' : 'border-white/10 bg-white/5 text-white/50 hover:bg-white/10'}`}>
                            {l}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className={labelCls}>Znesek (EUR)</label>
                        <input type="number" className={inputCls} value={row.amountEur} placeholder="0"
                          onChange={e => setPayRows(r => r.map((x, j) => j === i ? { ...x, amountEur: e.target.value } : x))} />
                      </div>
                      <div>
                        <label className={labelCls}>Datum</label>
                        <input type="date" className={inputCls} value={row.date}
                          onChange={e => setPayRows(r => r.map((x, j) => j === i ? { ...x, date: e.target.value } : x))} />
                      </div>
                    </div>
                    {row.method === 'cash' && (
                      <div className="sm:col-span-2">
                        <label className={labelCls}>Podjetje (gotovinska blagajna)</label>
                        <div className="flex gap-2">
                          {([['tourism', 'KOMBA CABANA TOURISM SARL'], ['sarl', 'KOMBA CABANA SARL']] as const).map(([v, l]) => (
                            <button key={v} onClick={() => setPayRows(r => r.map((x, j) => j === i ? { ...x, cashCompany: v } : x))}
                              className={`flex-1 rounded-lg border px-2 py-2 text-[10px] font-medium transition-colors ${row.cashCompany === v ? 'border-[#4f7a54]/50 bg-[#4f7a54]/15 text-[#8fae92]' : 'border-white/10 bg-white/5 text-white/50 hover:bg-white/10'}`}>
                              {l}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {row.method === 'orange_money' && (
                      <div className="sm:col-span-2">
                        <label className={labelCls}>Znesek na Orange Money (Ar)</label>
                        <input type="number" className={inputCls} value={row.omAmountAr} placeholder={ar(num(row.amountEur) * rate)}
                          onChange={e => setPayRows(r => r.map((x, j) => j === i ? { ...x, omAmountAr: e.target.value } : x))} />
                        <p className="mt-1 text-[11px] text-white/40">Prazno = samodejno {ar(num(row.amountEur) * rate)}.</p>
                      </div>
                    )}
                    {row.method !== 'card' && (
                      <label className="sm:col-span-2 flex cursor-pointer items-center gap-2 text-[12px] text-white/70">
                        <input type="checkbox" checked={row.writeToRegister} className="h-4 w-4 accent-[#c59b5b]"
                          onChange={e => setPayRows(r => r.map((x, j) => j === i ? { ...x, writeToRegister: e.target.checked } : x))} />
                        {row.method === 'cash' ? 'Vpiši v blagajno (gotovina).' : 'Vpiši v denarnico Orange Money.'}
                      </label>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Total + save */}
          <div className="rounded-2xl border border-[#c59b5b]/25 bg-[#c59b5b]/[0.06] px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/70">Skupaj postavke</span>
              <span className="font-serif text-xl text-[#c59b5b]">{totalEur.toFixed(2)} EUR</span>
            </div>
            <div className="mt-1.5 flex items-center justify-between border-t border-white/10 pt-1.5 text-[12px]">
              <span className="text-white/50">Vneseno plačil</span>
              <span className={paidEur.toFixed(2) === totalEur.toFixed(2) ? 'text-[#8fae92]' : 'text-[#e0a561]'}>
                {paidEur.toFixed(2)} EUR
                {paidEur.toFixed(2) !== totalEur.toFixed(2) && ` (razlika ${(totalEur - paidEur).toFixed(2)})`}
              </span>
            </div>
          </div>

          {msg && (
            <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${msg.ok ? 'border-[#4f7a54]/40 bg-[#4f7a54]/10 text-[#8fae92]' : 'border-[#b0203a]/40 bg-[#b0203a]/10 text-[#e0687c]'}`}>
              {msg.ok && <Check className="h-4 w-4" />}{msg.text}
            </div>
          )}

          <button onClick={handleSave} disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#c59b5b] px-4 py-3 text-sm font-semibold text-[#0a2029] transition-opacity hover:opacity-90 disabled:opacity-50">
            <Save className="h-4 w-4" />{saving ? 'Shranjujem…' : 'Shrani pretekli vnos'}
          </button>
        </div>
      </div>
    </div>
  )
}
