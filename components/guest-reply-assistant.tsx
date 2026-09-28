'use client'

import { useState } from 'react'
import { Sparkles, Copy, Link2, Mail, Check, Calculator, Plus, Trash2, Ship, EyeOff } from 'lucide-react'
import {
  generateGuestReply,
  saveGuestReply,
  sendGuestReply,
  getGuestReply,
  getReplyExcursionImages,
  getExcursionCalcData,
  getTransferCalcData,
  type ExcursionCalcData,
  type TransferCalcData,
} from '@/app/actions/guest-reply'
import { buildReplyHtml, type ReplyExcursionImage } from '@/lib/guest-reply-html'

// AI pomočnik za odgovore gostu: recepcija prilepi gostovo sporočilo, program iz
// znanih podatkov (rezervacija, penzion, transfer, izleti) sestavi osnutek odgovora
// v angleščini, ki ga je mogoče urediti, kopirati, deliti kot povezavo ali poslati.
export function GuestReplyAssistant({
  reservationId,
  email,
}: {
  reservationId: string
  email: string
}) {
  const [open, setOpen] = useState(false)
  const [guestMessage, setGuestMessage] = useState('')
  const [reply, setReply] = useState('')
  const [generating, setGenerating] = useState(false)
  const [busy, setBusy] = useState<null | 'copy' | 'link' | 'mail'>(null)
  const [note, setNote] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)
  const [loaded, setLoaded] = useState(false)
  // Izleti, ki jih odgovor omenja (za seznam „katere cene je treba dodati").
  const [mentionedExc, setMentionedExc] = useState<string[]>([])
  // Interni zapis (SAMO za recepcijo): za vsak vstavljen izlet/transfer čoln + kje kosilo + skupna cena.
  // Gost tega NE vidi — shrani se ločeno v guest_replies.internalNotes.
  const [internalLines, setInternalLines] = useState<string[]>([])
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewImages, setPreviewImages] = useState<ReplyExcursionImage[]>([])

  // Mini izletni kalkulator (recepcija izbere izlet + čoln + kosilo → točna cena iz cenika).
  const [calcOpen, setCalcOpen] = useState(false)
  const [calc, setCalc] = useState<ExcursionCalcData | null>(null)
  const [cExc, setCExc] = useState('')
  const [cBoat, setCBoat] = useState('')
  const [cLunch, setCLunch] = useState('')
  const [cEntrance, setCEntrance] = useState(true)
  const [cPax, setCPax] = useState(2)

  // Mini transfer kalkulator (recepcija izbere relacijo + čoln + smer → cena iz cenika).
  const [tCalcOpen, setTCalcOpen] = useState(false)
  const [tCalc, setTCalc] = useState<TransferCalcData | null>(null)
  const [tRoute, setTRoute] = useState('')
  const [tBoat, setTBoat] = useState('')
  const [tPax, setTPax] = useState(2)
  const [tRound, setTRound] = useState(false)

  const flash = (kind: 'ok' | 'err', text: string) => {
    setNote({ kind, text })
    setTimeout(() => setNote(null), 4000)
  }

  // Zazna, o katerih izletih govori odgovor (za seznam cen, ki jih mora recepcija dodati).
  const refreshNeeds = async (text: string) => {
    try {
      const imgs = await getReplyExcursionImages(text)
      setMentionedExc(imgs.map(i => i.name))
    } catch {
      setMentionedExc([])
    }
  }

  // Ob prvem odprtju naloži morebitni že shranjeni odgovor (in prilepljeno sporočilo).
  const toggleOpen = async () => {
    const next = !open
    setOpen(next)
    if (next && !loaded) {
      setLoaded(true)
      try {
        const saved = await getGuestReply(reservationId)
        if (saved) {
          if (!reply) setReply(saved.replyText)
          if (!guestMessage) setGuestMessage(saved.guestMessage)
          if (saved.internalNotes) setInternalLines(saved.internalNotes.split('\n').filter(Boolean))
          if (saved.replyText) void refreshNeeds(saved.replyText)
        }
      } catch {
        /* tiho — pomočnik deluje tudi brez shranjenega odgovora */
      }
    }
  }

  const generate = async () => {
    setGenerating(true)
    setNote(null)
    try {
      const res = await generateGuestReply(reservationId, guestMessage)
      if (res.reply) {
        setReply(res.reply)
        void refreshNeeds(res.reply)
      } else {
        flash('err', res.error || 'Generiranje ni uspelo.')
      }
    } catch {
      flash('err', 'Napaka pri generiranju. Poskusite znova.')
    } finally {
      setGenerating(false)
    }
  }

  const copyText = async () => {
    setBusy('copy')
    try {
      await navigator.clipboard.writeText(reply)
      flash('ok', 'Besedilo odgovora je kopirano.')
    } catch {
      flash('err', 'Kopiranje ni uspelo.')
    } finally {
      setBusy(null)
    }
  }

  const makeLink = async () => {
    setBusy('link')
    try {
      const res = await saveGuestReply(reservationId, reply, guestMessage, internalLines.join('\n'))
      if (res.success) {
        // Link zgradimo iz trenutnega origin-a (kjer recepcija dela), da ga lahko takoj
        // odpre v istem okolju. V produkciji je origin že prava domena; res.url (produkcija)
        // uporabimo le kot rezervo, če origin ni na voljo.
        const origin = typeof window !== 'undefined' ? window.location.origin : ''
        const url = origin ? `${origin}/odgovor/${reservationId}` : res.url || ''
        try {
          await navigator.clipboard.writeText(url)
          setCopiedLink(true)
          setTimeout(() => setCopiedLink(false), 4000)
          flash('ok', 'Povezava je ustvarjena in kopirana.')
        } catch {
          flash('ok', `Povezava: ${url}`)
        }
      } else {
        flash('err', res.error || 'Povezave ni bilo mogoče ustvariti.')
      }
    } finally {
      setBusy(null)
    }
  }

  // Predogled HTML sporočila, kakršno bo prejel gost (guestName ni v telesu → prazen niz).
  const previewHtml = () => {
    const base = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '')
    return buildReplyHtml('', reply, base, previewImages)
  }

  // Odpri predogled in naloži slike izletov, ki jih odgovor omenja.
  const openPreview = async () => {
    setPreviewOpen(true)
    try {
      setPreviewImages(await getReplyExcursionImages(reply))
    } catch {
      setPreviewImages([])
    }
  }

  const confirmSend = async () => {
    setBusy('mail')
    try {
      const res = await sendGuestReply(reservationId, reply, email)
      if (res.success) {
        // Shrani tudi osnutek + interni zapis, da je v arhivu (send sam tega ne stori).
        void saveGuestReply(reservationId, reply, guestMessage, internalLines.join('\n'))
        setPreviewOpen(false)
        flash('ok', `Odgovor poslan${email ? ` na ${email}` : ''}.`)
      } else {
        flash('err', res.error || 'Pošiljanje ni uspelo.')
      }
    } finally {
      setBusy(null)
    }
  }

  // Odpri kalkulator in naloži cenike (izleti, čolni, kosila, kurz, effective pax).
  const openCalc = async () => {
    const next = !calcOpen
    setCalcOpen(next)
    if (next && !calc) {
      try {
        const data = await getExcursionCalcData(reservationId)
        setCalc(data)
        setCPax(data.pax)
      } catch {
        flash('err', 'Cenika ni bilo mogoče naložiti.')
      }
    }
  }

  // Čolni z veljavno ceno za izbrani izlet.
  const calcBoats = calc && cExc ? calc.pricing.filter(p => p.excursionId === cExc && p.pricePax.some(v => v > 0)) : []
  const selExc = calc?.excursions.find(e => e.id === cExc)
  const selBoat = calcBoats.find(b => b.boatId === cBoat)
  const selLunch = calc?.lunch.find(l => l.id === cLunch)
  const rate = calc?.rate || 4800
  const eur2 = (n: number) => n.toFixed(2)
  const paxIdx = Math.min(Math.max(cPax, 1), 6) - 1
  const transportPer = selBoat ? selBoat.pricePax[paxIdx] : 0
  const entrancePer = cEntrance && selExc?.entranceFeeAr ? selExc.entranceFeeAr / rate : 0
  const lunchPer = selLunch ? selLunch.pricePerPersonAr / rate : 0
  const calcTotal = (transportPer + entrancePer + lunchPer) * cPax
  const calcReady = !!selExc && !!selBoat && transportPer > 0

  const insertExcursionPrice = () => {
    if (!calcReady || !selExc || !selBoat) return
    // Samo skupna cena + št. oseb + kaj vsebuje (BREZ cen po postavkah). Izlet je VEDNO z vodičem.
    const includes = ['boat transport', 'a guide']
    if (entrancePer > 0) includes.push('park entrance')
    if (lunchPer > 0) includes.push('lunch')
    const last = includes.pop()!
    const incStr = includes.length ? `${includes.join(', ')} and ${last}` : last
    const line = `${selExc.name} excursion: ${eur2(calcTotal)} EUR total for ${cPax} ${cPax === 1 ? 'person' : 'people'} (includes ${incStr}).`
    setReply(prev => (prev.trim() ? `${prev.replace(/\s+$/, '')}\n\n${line}` : line))
    // Interni zapis: čoln + kje kosilo (+ vstopnina) za recepcijski arhiv — gost tega NE vidi.
    const intParts = [`boat: ${selBoat.boatName}`]
    intParts.push(selLunch ? `lunch: ${selLunch.name}${selLunch.location ? ` (${selLunch.location})` : ''}` : 'lunch: none')
    if (cEntrance && entrancePer > 0) intParts.push('entrance included')
    setInternalLines(prev => [...prev, `${selExc.name} — ${eur2(calcTotal)} EUR / ${cPax}p · ${intParts.join(' · ')}`])
    flash('ok', 'Cena izleta je vstavljena v odgovor.')
  }

  // Vstavljene izletne cene v odgovoru (za morebiten izbris podvojenega/napačnega izleta).
  const excLineRe = /excursion:\s*[\d.]+\s*EUR total for/i
  const insertedExcursionLines = reply
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(p => excLineRe.test(p))

  // Odstrani natanko ENO izletno vrstico (po zaporedni številki med izletnimi vrsticami),
  // da izbris podvojenega izleta ne odstrani obeh enakih vrstic.
  const removeExcursionLineAt = (occurrence: number) => {
    setReply(prev => {
      let seen = -1
      return prev
        .split(/\n{2,}/)
        .filter(p => {
          if (excLineRe.test(p.trim())) {
            seen += 1
            return seen !== occurrence
          }
          return true
        })
        .join('\n\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
    })
    flash('ok', 'Izlet je odstranjen iz odgovora.')
  }

  // Odpri transfer kalkulator in naloži relacije/cene.
  const openTCalc = async () => {
    const next = !tCalcOpen
    setTCalcOpen(next)
    if (next && !tCalc) {
      try {
        const data = await getTransferCalcData(reservationId)
        setTCalc(data)
        setTPax(data.pax)
      } catch {
        flash('err', 'Cenika transferjev ni bilo mogoče naložiti.')
      }
    }
  }

  // Čolni z veljavno ceno za izbrano relacijo.
  const tBoats = tCalc && tRoute ? tCalc.pricing.filter(p => p.routeId === tRoute && p.pricePax.some(v => v > 0)) : []
  const tSelRoute = tCalc?.routes.find(r => r.id === tRoute)
  const tSelBoat = tBoats.find(b => b.boatId === tBoat)
  const tPaxIdx = Math.min(Math.max(tPax, 1), 6) - 1
  const tPerPerson = tSelBoat ? tSelBoat.pricePax[tPaxIdx] : 0
  const tOneWay = tPerPerson * tPax
  const tTotal = tOneWay * (tRound ? 2 : 1)
  const tReady = !!tSelRoute && !!tSelBoat && tPerPerson > 0

  const insertTransferPrice = () => {
    if (!tReady || !tSelRoute || !tSelBoat) return
    // Samo skupna cena + št. oseb + smer (BREZ cene čolna).
    const dir = tRound ? 'round trip (arrival + departure)' : 'one-way'
    const line = `Transfer ${tSelRoute.name}: ${eur2(tTotal)} EUR total for ${tPax} ${tPax === 1 ? 'person' : 'people'} (${dir}, boat transfer included).`
    setReply(prev => (prev.trim() ? `${prev.replace(/\s+$/, '')}\n\n${line}` : line))
    // Interni zapis: čoln + smer za recepcijski arhiv — gost tega NE vidi.
    setInternalLines(prev => [...prev, `Transfer ${tSelRoute.name} — ${eur2(tTotal)} EUR / ${tPax}p · boat: ${tSelBoat.boatName} · ${dir}`])
    flash('ok', 'Cena transferja je vstavljena v odgovor.')
  }

  // Vstavljene transfer cene v odgovoru (za morebiten izbris podvojene/napačne).
  const transferLineRe = /^Transfer .+:\s*[\d.]+\s*EUR total for/i
  const insertedTransferLines = reply
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(p => transferLineRe.test(p))

  const removeTransferLineAt = (occurrence: number) => {
    setReply(prev => {
      let seen = -1
      return prev
        .split(/\n{2,}/)
        .filter(p => {
          if (transferLineRe.test(p.trim())) {
            seen += 1
            return seen !== occurrence
          }
          return true
        })
        .join('\n\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
    })
    flash('ok', 'Transfer je odstranjen iz odgovora.')
  }

  // Odstrani interni zapis po zaporedni številki (ločen od gostovega besedila).
  const removeInternalLineAt = (i: number) => {
    setInternalLines(prev => prev.filter((_, idx) => idx !== i))
  }

  // Seznam cen, ki jih mora recepcija ročno dodati v odgovor (glede na to, kaj gost sprašuje).
  // Izlet je „urejen", če že obstaja vstavljena vrstica z njegovim imenom; transfer, če obstaja
  // katera koli transfer vrstica.
  const transferDiscussed = /\b(transfer|transport|pick[- ]?up|airport|fascene|port|prevoz|letali|taxi)\b/i.test(
    `${reply}\n${guestMessage}`,
  )
  const priceNeeds: { label: string; done: boolean }[] = [
    ...mentionedExc.map(name => ({
      label: `Izlet: ${name}`,
      done: insertedExcursionLines.some(l => l.toLowerCase().startsWith(name.toLowerCase())),
    })),
    ...(transferDiscussed ? [{ label: 'Transfer (prevoz)', done: insertedTransferLines.length > 0 }] : []),
  ]
  const pendingNeeds = priceNeeds.filter(n => !n.done)

  if (!open) {
    return (
      <button
        onClick={toggleOpen}
        className="w-full flex items-center justify-center gap-1.5 sm:gap-2 rounded-xl bg-white/[0.03] border border-white/10 py-2.5 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm font-medium text-white/70 hover:bg-white/[0.06] hover:text-white transition-all"
      >
        <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        Sestavi odgovor na vprašanja gosta
      </button>
    )
  }

  return (
    <div className="rounded-xl border border-[#c59b5b]/25 bg-white/[0.02] p-3 sm:p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#c59b5b]">
          <Sparkles className="h-4 w-4" /> Odgovor na vprašanja gosta
        </p>
        <button onClick={() => setOpen(false)} className="text-[11px] text-white/40 hover:text-white/70">
          Zapri
        </button>
      </div>

      <label className="mb-1 block text-[11px] text-white/50">Prilepite gostovo sporočilo (v katerem koli jeziku):</label>
      <textarea
        value={guestMessage}
        onChange={e => setGuestMessage(e.target.value)}
        rows={5}
        placeholder="Dear Komba Cabana Team, I've booked a bungalow for..."
        className="w-full resize-y rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-white/30 focus:border-[#c59b5b]/40 focus:outline-none"
      />

      <button
        onClick={generate}
        disabled={generating || !guestMessage.trim()}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#c59b5b]/25 to-[#c59b5b]/20 border border-[#c59b5b]/35 py-2.5 text-xs sm:text-sm font-semibold text-[#c59b5b] transition-all hover:from-[#c59b5b]/35 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Sparkles className="h-4 w-4" />
        {generating ? 'Sestavljam odgovor…' : reply ? 'Ustvari znova' : 'Sestavi odgovor'}
      </button>

      {reply && (
        <>
          <label className="mb-1 mt-3 block text-[11px] text-white/50">Odgovor (uredite po želji):</label>
          <textarea
            value={reply}
            onChange={e => setReply(e.target.value)}
            rows={12}
            className="w-full resize-y rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs leading-relaxed text-white focus:border-[#c59b5b]/40 focus:outline-none"
          />

          {priceNeeds.length > 0 && (
            <div className="mt-3 rounded-lg border border-[#c59b5b]/30 bg-[#c59b5b]/[0.08] p-2.5">
              <p className="mb-1.5 text-[11px] font-semibold text-[#e6c98b]">
                {pendingNeeds.length > 0
                  ? `Cene za dodati (${pendingNeeds.length}):`
                  : 'Vse potrebne cene so dodane.'}
              </p>
              <ul className="space-y-1">
                {priceNeeds.map((n, i) => (
                  <li key={i} className="flex items-center gap-2 text-[11px]">
                    {n.done ? (
                      <>
                        <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                        <span className="text-white/50 line-through">{n.label}</span>
                      </>
                    ) : (
                      <>
                        <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#e6c98b]" />
                        <span className="text-white/80">{n.label}</span>
                      </>
                    )}
                  </li>
                ))}
              </ul>
              {pendingNeeds.length > 0 && (
                <p className="mt-1.5 text-[10px] leading-snug text-white/45">
                  Uporabite spodnja kalkulatorja (izlet / transfer) in kliknite „Vstavi ceno v odgovor“.
                </p>
              )}
            </div>
          )}

          {insertedExcursionLines.length > 0 && (
            <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] p-2.5">
              <p className="mb-1.5 text-[11px] font-medium text-white/50">
                Vstavljene cene izletov ({insertedExcursionLines.length}):
              </p>
              <ul className="space-y-1.5">
                {insertedExcursionLines.map((line, i) => (
                  <li key={i} className="flex items-start justify-between gap-2 rounded-md bg-white/[0.03] px-2 py-1.5">
                    <span className="text-[11px] leading-snug text-white/70">{line}</span>
                    <button
                      onClick={() => removeExcursionLineAt(i)}
                      title="Odstrani ta izlet iz odgovora"
                      aria-label="Odstrani ta izlet iz odgovora"
                      className="mt-0.5 flex shrink-0 items-center gap-1 rounded-md border border-red-400/30 bg-red-500/10 px-2 py-1 text-[10px] font-medium text-red-300 transition-colors hover:bg-red-500/20"
                    >
                      <Trash2 className="h-3 w-3" /> Izbriši
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            onClick={openCalc}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#4e8296]/30 bg-[#4e8296]/10 py-2.5 text-xs font-medium text-[#9cc4d4] transition-colors hover:bg-[#4e8296]/20"
          >
            <Calculator className="h-3.5 w-3.5" /> {calcOpen ? 'Skrij kalkulator izleta' : 'Dodaj ceno izleta (kalkulator)'}
          </button>

          {calcOpen && (
            <div className="mt-2 rounded-lg border border-[#4e8296]/25 bg-[#4e8296]/[0.06] p-3">
              {!calc ? (
                <p className="text-[11px] text-white/50">Nalagam cenik…</p>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-[11px] text-white/50">Izlet</label>
                      <select
                        value={cExc}
                        onChange={e => { setCExc(e.target.value); setCBoat(''); setCLunch('') }}
                        className="w-full rounded-lg border border-white/10 bg-[#0a2029] px-2 py-2 text-xs text-white focus:border-[#4e8296]/50 focus:outline-none"
                      >
                        <option value="">— izberi izlet —</option>
                        {calc.excursions.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] text-white/50">Čoln</label>
                      <select
                        value={cBoat}
                        onChange={e => setCBoat(e.target.value)}
                        disabled={!cExc}
                        className="w-full rounded-lg border border-white/10 bg-[#0a2029] px-2 py-2 text-xs text-white focus:border-[#4e8296]/50 focus:outline-none disabled:opacity-40"
                      >
                        <option value="">— izberi čoln —</option>
                        {calcBoats.map(b => <option key={b.boatId} value={b.boatId}>{b.boatName} ({eur2(b.pricePax[paxIdx])} EUR/os)</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] text-white/50">Ponudnik kosila</label>
                      <select
                        value={cLunch}
                        onChange={e => setCLunch(e.target.value)}
                        className="w-full rounded-lg border border-white/10 bg-[#0a2029] px-2 py-2 text-xs text-white focus:border-[#4e8296]/50 focus:outline-none"
                      >
                        <option value="">— brez kosila —</option>
                        {calc.lunch.map(l => <option key={l.id} value={l.id}>{l.name}{l.location ? ` (${l.location})` : ''} — {eur2(l.pricePerPersonAr / rate)} EUR/os</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] text-white/50">Število oseb</label>
                      <input
                        type="number"
                        min={1}
                        max={6}
                        value={cPax}
                        onChange={e => setCPax(Math.min(Math.max(Number(e.target.value) || 1, 1), 6))}
                        className="w-full rounded-lg border border-white/10 bg-[#0a2029] px-2 py-2 text-xs text-white focus:border-[#4e8296]/50 focus:outline-none"
                      />
                    </div>
                  </div>

                  <label className="mt-2 flex items-center gap-2 text-[11px] text-white/60">
                    <input type="checkbox" checked={cEntrance} onChange={e => setCEntrance(e.target.checked)} className="accent-[#4e8296]" />
                    Vključi vstopnino{selExc?.entranceFeeAr ? ` (${eur2(selExc.entranceFeeAr / rate)} EUR/os)` : ' (ta izlet je nima)'}
                  </label>

                  {calcReady && (
                    <div className="mt-2 rounded-lg border border-[#c59b5b]/20 bg-[#0a2029] px-3 py-2 text-xs text-white/70">
                      <div className="flex justify-between"><span>Transport ({cPax} × {eur2(transportPer)}):</span><span>{eur2(transportPer * cPax)} EUR</span></div>
                      {entrancePer > 0 && <div className="mt-1 flex justify-between"><span>Vstopnina ({cPax} × {eur2(entrancePer)}):</span><span>{eur2(entrancePer * cPax)} EUR</span></div>}
                      {lunchPer > 0 && <div className="mt-1 flex justify-between"><span>Kosilo ({cPax} × {eur2(lunchPer)}):</span><span>{eur2(lunchPer * cPax)} EUR</span></div>}
                      <div className="mt-2 flex justify-between border-t border-[#c59b5b]/20 pt-2 font-semibold text-[#c59b5b]"><span>SKUPAJ:</span><span>{eur2(calcTotal)} EUR</span></div>
                    </div>
                  )}

                  <button
                    onClick={insertExcursionPrice}
                    disabled={!calcReady}
                    className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#4e8296]/35 bg-[#4e8296]/20 py-2.5 text-xs font-semibold text-[#9cc4d4] transition-colors hover:bg-[#4e8296]/30 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Plus className="h-3.5 w-3.5" /> Vstavi ceno v odgovor
                  </button>
                </>
              )}
            </div>
          )}

          {internalLines.length > 0 && (
            <div className="mt-3 rounded-lg border border-[#8f6d3a]/30 bg-[#8f6d3a]/[0.08] p-2.5">
              <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-[#e6c98b]">
                <EyeOff className="h-3.5 w-3.5" /> Interni zapis — čoln in kosilo (gost tega NE vidi)
              </p>
              <ul className="space-y-1.5">
                {internalLines.map((line, i) => (
                  <li key={i} className="flex items-start justify-between gap-2 rounded-md bg-white/[0.03] px-2 py-1.5">
                    <span className="text-[11px] leading-snug text-white/75">{line}</span>
                    <button
                      onClick={() => removeInternalLineAt(i)}
                      title="Odstrani interni zapis"
                      aria-label="Odstrani interni zapis"
                      className="mt-0.5 flex shrink-0 items-center gap-1 rounded-md border border-red-400/30 bg-red-500/10 px-2 py-1 text-[10px] font-medium text-red-300 transition-colors hover:bg-red-500/20"
                    >
                      <Trash2 className="h-3 w-3" /> Izbriši
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {insertedTransferLines.length > 0 && (
            <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] p-2.5">
              <p className="mb-1.5 text-[11px] font-medium text-white/50">
                Vstavljene cene transferjev ({insertedTransferLines.length}):
              </p>
              <ul className="space-y-1.5">
                {insertedTransferLines.map((line, i) => (
                  <li key={i} className="flex items-start justify-between gap-2 rounded-md bg-white/[0.03] px-2 py-1.5">
                    <span className="text-[11px] leading-snug text-white/70">{line}</span>
                    <button
                      onClick={() => removeTransferLineAt(i)}
                      title="Odstrani ta transfer iz odgovora"
                      aria-label="Odstrani ta transfer iz odgovora"
                      className="mt-0.5 flex shrink-0 items-center gap-1 rounded-md border border-red-400/30 bg-red-500/10 px-2 py-1 text-[10px] font-medium text-red-300 transition-colors hover:bg-red-500/20"
                    >
                      <Trash2 className="h-3 w-3" /> Izbriši
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            onClick={openTCalc}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#4e8296]/30 bg-[#4e8296]/10 py-2.5 text-xs font-medium text-[#9cc4d4] transition-colors hover:bg-[#4e8296]/20"
          >
            <Ship className="h-3.5 w-3.5" /> {tCalcOpen ? 'Skrij kalkulator transferja' : 'Dodaj ceno transferja (kalkulator)'}
          </button>

          {tCalcOpen && (
            <div className="mt-2 rounded-lg border border-[#4e8296]/25 bg-[#4e8296]/[0.06] p-3">
              {!tCalc ? (
                <p className="text-[11px] text-white/50">Nalagam cenik…</p>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-[11px] text-white/50">Relacija</label>
                      <select
                        value={tRoute}
                        onChange={e => { setTRoute(e.target.value); setTBoat('') }}
                        className="w-full rounded-lg border border-white/10 bg-[#0a2029] px-2 py-2 text-xs text-white focus:border-[#4e8296]/50 focus:outline-none"
                      >
                        <option value="">— izberi relacijo —</option>
                        {tCalc.routes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] text-white/50">Čoln</label>
                      <select
                        value={tBoat}
                        onChange={e => setTBoat(e.target.value)}
                        disabled={!tRoute}
                        className="w-full rounded-lg border border-white/10 bg-[#0a2029] px-2 py-2 text-xs text-white focus:border-[#4e8296]/50 focus:outline-none disabled:opacity-40"
                      >
                        <option value="">— izberi čoln —</option>
                        {tBoats.map(b => <option key={b.boatId} value={b.boatId}>{b.boatName} ({eur2(b.pricePax[tPaxIdx])} EUR/os)</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] text-white/50">Število oseb</label>
                      <input
                        type="number"
                        min={1}
                        max={6}
                        value={tPax}
                        onChange={e => setTPax(Math.min(Math.max(Number(e.target.value) || 1, 1), 6))}
                        className="w-full rounded-lg border border-white/10 bg-[#0a2029] px-2 py-2 text-xs text-white focus:border-[#4e8296]/50 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] text-white/50">Smer</label>
                      <select
                        value={tRound ? 'round' : 'oneway'}
                        onChange={e => setTRound(e.target.value === 'round')}
                        className="w-full rounded-lg border border-white/10 bg-[#0a2029] px-2 py-2 text-xs text-white focus:border-[#4e8296]/50 focus:outline-none"
                      >
                        <option value="oneway">Ena smer (one-way)</option>
                        <option value="round">Povratni (prihod + odhod)</option>
                      </select>
                    </div>
                  </div>

                  {tReady && (
                    <div className="mt-2 rounded-lg border border-[#c59b5b]/20 bg-[#0a2029] px-3 py-2 text-xs text-white/70">
                      <div className="flex justify-between"><span>Ena smer ({tPax} × {eur2(tPerPerson)}):</span><span>{eur2(tOneWay)} EUR</span></div>
                      {tRound && <div className="mt-1 flex justify-between"><span>Povratni (×2):</span><span>{eur2(tOneWay * 2)} EUR</span></div>}
                      <div className="mt-2 flex justify-between border-t border-[#c59b5b]/20 pt-2 font-semibold text-[#c59b5b]"><span>SKUPAJ:</span><span>{eur2(tTotal)} EUR</span></div>
                    </div>
                  )}

                  <button
                    onClick={insertTransferPrice}
                    disabled={!tReady}
                    className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#4e8296]/35 bg-[#4e8296]/20 py-2.5 text-xs font-semibold text-[#9cc4d4] transition-colors hover:bg-[#4e8296]/30 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Plus className="h-3.5 w-3.5" /> Vstavi ceno v odgovor
                  </button>
                </>
              )}
            </div>
          )}

          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <button
              onClick={copyText}
              disabled={busy !== null}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] py-2.5 text-xs font-medium text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
            >
              <Copy className="h-3.5 w-3.5" /> Kopiraj besedilo
            </button>
            <button
              onClick={makeLink}
              disabled={busy !== null}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] py-2.5 text-xs font-medium text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
            >
              {copiedLink ? <Check className="h-3.5 w-3.5 text-[#8fae92]" /> : <Link2 className="h-3.5 w-3.5" />}
              {busy === 'link' ? 'Ustvarjam…' : copiedLink ? 'Kopirano' : 'Ustvari & kopiraj link'}
            </button>
            <button
              onClick={openPreview}
              disabled={busy !== null || !reply.trim()}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-[#c59b5b]/30 bg-[#c59b5b]/10 py-2.5 text-xs font-medium text-[#c59b5b] transition-colors hover:bg-[#c59b5b]/20 disabled:opacity-50"
            >
              <Mail className="h-3.5 w-3.5" /> Predogled in pošlji
            </button>
          </div>
        </>
      )}

      {previewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => busy === null && setPreviewOpen(false)}>
          <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#c59b5b]/25 bg-[#0a2029] shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-[#c59b5b]">
                <Mail className="h-4 w-4" /> Predogled e-pošte
              </p>
              <button onClick={() => setPreviewOpen(false)} disabled={busy !== null} className="text-xs text-white/40 hover:text-white/70 disabled:opacity-50">
                Zapri
              </button>
            </div>
            <p className="px-4 pt-3 text-[11px] text-white/50">
              {email ? <>Prejemnik: <span className="text-white/80">{email}</span></> : <span className="text-red-400">Gost nima vpisanega e-naslova — dodajte ga v podatkih gosta.</span>}
            </p>
            <div className="min-h-0 flex-1 overflow-hidden p-4">
              <iframe title="Predogled sporočila" srcDoc={previewHtml()} className="h-[52vh] w-full rounded-lg border border-white/10 bg-white" />
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-white/10 px-4 py-3">
              <button onClick={() => setPreviewOpen(false)} disabled={busy !== null} className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-medium text-white/70 transition-colors hover:bg-white/[0.06] disabled:opacity-50">
                Prekliči
              </button>
              <button onClick={confirmSend} disabled={busy !== null || !email} className="flex items-center gap-1.5 rounded-lg border border-[#c59b5b]/35 bg-[#c59b5b]/20 px-4 py-2 text-xs font-semibold text-[#c59b5b] transition-colors hover:bg-[#c59b5b]/30 disabled:cursor-not-allowed disabled:opacity-50">
                <Mail className="h-3.5 w-3.5" /> {busy === 'mail' ? 'Pošiljam…' : 'Pošlji zdaj'}
              </button>
            </div>
          </div>
        </div>
      )}

      {note && (
        <p className={`mt-2 text-[11px] ${note.kind === 'ok' ? 'text-[#8fae92]' : 'text-red-400'}`}>{note.text}</p>
      )}
    </div>
  )
}
