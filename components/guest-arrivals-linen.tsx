'use client'

import React, { useMemo, useState } from 'react'
import useSWR from 'swr'
import { BedDouble, LogIn, LogOut, Moon, Printer } from 'lucide-react'
import { getGuestStaysForMonth } from '@/app/actions/housekeeping'
import { linenChangeStayDays, linenOptionalStayDays } from '@/lib/housekeeping'

type Lang = 'sl' | 'fr'

const BUNGALOW_ROWS: { key: string; sl: string; fr: string }[] = [
  { key: 'ocean-i', sl: 'Ocean I', fr: 'Océan I' },
  { key: 'ocean-ii', sl: 'Ocean II', fr: 'Océan II' },
  { key: 'garden-iii', sl: 'Garden III', fr: 'Jardin III' },
  { key: 'ocean-iv', sl: 'Beach Villa IV', fr: 'Beach Villa IV' },
  { key: 'jungle', sl: 'Jungle Glamp', fr: 'Jungle Glamp' },
]

const T = {
  sl: {
    title: 'Prihodi gostov in menjava posteljnine',
    months: ['januar', 'februar', 'marec', 'april', 'maj', 'junij', 'julij', 'avgust', 'september', 'oktober', 'november', 'december'],
    days: ['ned', 'pon', 'tor', 'sre', 'čet', 'pet', 'sob'],
    bungalow: 'Bungalov',
    total: 'Menjav',
    change: 'Menjava posteljnine',
    optional: 'Menjava samo če je umazano',
    departure: 'Odhod – popolna menjava',
    arrival: 'Prihod gosta',
    nights: 'noči',
    rules: '≤3 noči brez menjave · 4 noči 3. dan le če umazano · 5–6 noči 3. dan · 7 noči 4. dan · več kot 7 vsak 4. dan · vedno ob odhodu',
    print: 'Natisni (SL)',
    loading: 'Nalagam bivanja...',
  },
  fr: {
    title: 'Arrivées des clients et changement des draps',
    months: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
    days: ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'],
    bungalow: 'Bungalow',
    total: 'Changes',
    change: 'Changement des draps',
    optional: 'Changement seulement si sale',
    departure: 'Départ – changement complet',
    arrival: 'Arrivée du client',
    nights: 'nuits',
    rules: '≤3 nuits pas de changement · 4 nuits 3e jour seulement si sale · 5–6 nuits 3e jour · 7 nuits 4e jour · plus de 7 tous les 4 jours · toujours au départ',
    print: 'Imprimer (FR)',
    loading: 'Chargement...',
  },
}

type MarkKind = 'change' | 'optional' | 'departure'

function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000)
}

function addDays(d: string, n: number): string {
  const t = new Date(Date.parse(`${d}T00:00:00Z`) + n * 86400000)
  return t.toISOString().slice(0, 10)
}

function Marker({ kind }: { kind: MarkKind }) {
  if (kind === 'departure') {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#3f7fa6] text-white print-exact">
        <LogOut className="h-3 w-3" aria-hidden="true" />
      </span>
    )
  }
  if (kind === 'optional') {
    return (
      <span className="relative flex h-6 w-6 items-center justify-center rounded-full border-2 border-dashed border-[#8b6bb8] bg-[#f1ebf8] text-[#8b6bb8] print-exact">
        <BedDouble className="h-3 w-3" aria-hidden="true" />
        <span className="absolute -right-1.5 -top-1.5 text-[10px] font-bold leading-none">?</span>
      </span>
    )
  }
  return (
    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#d9822b] text-white print-exact">
      <BedDouble className="h-3 w-3" aria-hidden="true" />
    </span>
  )
}

export function GuestArrivalsLinen({ year, month }: { year: number; month: number }) {
  const [lang, setLang] = useState<Lang>('sl')
  const t = T[lang]
  const { data: stays, isLoading } = useSWR(['guest-stays', year, month], () => getGuestStaysForMonth(year, month))

  const mm = String(month).padStart(2, '0')
  const daysInMonth = new Date(year, month, 0).getDate()
  const monthStart = `${year}-${mm}-01`
  const dates = useMemo(
    () => Array.from({ length: daysInMonth }, (_, i) => `${year}-${mm}-${String(i + 1).padStart(2, '0')}`),
    [year, mm, daysInMonth],
  )
  const today = new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10)
  const colW = 100 / daysInMonth

  const rows = useMemo(() => {
    const perDayTotals = new Array(daysInMonth).fill(0) as number[]
    const result = BUNGALOW_ROWS.map((b) => {
      const marks = new Map<number, MarkKind>()
      const bars: { left: number; width: number; nights: number; showArrival: boolean }[] = []
      for (const s of (stays || []).filter((x) => x.bungalowKey === b.key)) {
        const nights = dayDiff(s.arrival, s.departure)
        const add = (date: string, kind: MarkKind) => {
          const idx = dayDiff(monthStart, date)
          if (idx < 0 || idx >= daysInMonth) return
          const prev = marks.get(idx)
          if (prev === 'departure' || (prev === 'change' && kind === 'optional')) return
          marks.set(idx, kind)
        }
        for (const d of linenChangeStayDays(nights)) add(addDays(s.arrival, d - 1), 'change')
        for (const d of linenOptionalStayDays(nights)) add(addDays(s.arrival, d - 1), 'optional')
        add(s.departure, 'departure')

        const startIdx = dayDiff(monthStart, s.arrival)
        const endIdx = dayDiff(monthStart, s.departure)
        const from = Math.max(startIdx + 0.5, 0)
        const to = Math.min(endIdx + 0.5, daysInMonth)
        if (to > from) bars.push({ left: from * colW, width: (to - from) * colW, nights, showArrival: startIdx >= 0 })
      }
      marks.forEach((kind, idx) => {
        if (kind !== 'optional') perDayTotals[idx] += 1
      })
      return { ...b, marks, bars }
    })
    return { result, perDayTotals }
  }, [stays, monthStart, daysInMonth, colW])

  const handlePrint = (printLang: Lang) => {
    setLang(printLang)
    const style = document.createElement('style')
    style.textContent = '@page { size: A4 landscape; margin: 8mm; }'
    document.head.appendChild(style)
    document.body.classList.add('printing-linen')
    setTimeout(() => {
      window.print()
      document.body.classList.remove('printing-linen')
      style.remove()
    }, 150)
  }

  return (
    <section className="linen-print-root rounded-2xl border border-white/10 bg-[#f7f2e8] p-4 text-[#2a2a2a]">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-[#8f6d3a]">{t.title}</h3>
          <p className="text-sm text-[#6b6b6b]">
            {t.months[month - 1]} {year}
          </p>
        </div>
        <div className="no-print flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-lg border border-[#c59b5b]/50">
            {(['sl', 'fr'] as Lang[]).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLang(l)}
                aria-pressed={lang === l}
                className={`px-3 py-1.5 text-xs font-semibold uppercase ${lang === l ? 'bg-[#c59b5b] text-white' : 'text-[#8f6d3a] hover:bg-[#c59b5b]/10'}`}
              >
                {l}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => handlePrint('sl')} className="flex items-center gap-1.5 rounded-lg bg-[#2a2a2a] px-3 py-1.5 text-xs font-semibold text-white hover:bg-black">
            <Printer className="h-3.5 w-3.5" aria-hidden="true" /> {T.sl.print}
          </button>
          <button type="button" onClick={() => handlePrint('fr')} className="flex items-center gap-1.5 rounded-lg bg-[#2a2a2a] px-3 py-1.5 text-xs font-semibold text-white hover:bg-black">
            <Printer className="h-3.5 w-3.5" aria-hidden="true" /> {T.fr.print}
          </button>
        </div>
      </div>

      {isLoading ? (
        <p className="py-6 text-center text-sm text-[#6b6b6b]">{t.loading}</p>
      ) : (
        <div className="flex">
          <div className="w-24 flex-shrink-0">
            <div className="flex h-10 items-end pb-1 text-[10px] font-semibold uppercase tracking-wide text-[#6b6b6b]">{t.bungalow}</div>
            {rows.result.map((r) => (
              <div key={r.key} className="flex h-16 items-center border-t border-[#d9ceb8] pr-2 text-xs font-semibold">
                {lang === 'fr' ? r.fr : r.sl}
              </div>
            ))}
            <div className="flex h-8 items-center border-t-2 border-[#8f6d3a] text-[10px] font-semibold uppercase tracking-wide text-[#6b6b6b]">{t.total}</div>
          </div>

          <div className="relative min-w-0 flex-1">
            <div className="flex h-10">
              {dates.map((d) => {
                const dow = new Date(`${d}T00:00:00`).getDay()
                const isToday = d === today
                return (
                  <div
                    key={d}
                    style={{ width: `${colW}%` }}
                    className={`flex flex-col items-center justify-end pb-1 text-center leading-tight ${dow === 0 ? 'text-[#b0203a]' : 'text-[#6b6b6b]'} ${isToday ? 'rounded-t bg-[#c59b5b]/25' : ''}`}
                  >
                    <span className="text-[9px]">{t.days[dow]}</span>
                    <span className="text-[11px] font-semibold text-[#2a2a2a]">{Number(d.slice(8))}</span>
                  </div>
                )
              })}
            </div>

            {rows.result.map((r) => (
              <div key={r.key} className="relative h-16 border-t border-[#d9ceb8] bg-white print-exact">
                <div className="pointer-events-none absolute inset-0 flex">
                  {dates.map((d, i) => (
                    <div key={d} style={{ width: `${colW}%` }} className={`h-full ${i > 0 ? 'border-l border-[#efe8da]' : ''} ${d === today ? 'bg-[#c59b5b]/10' : ''}`} />
                  ))}
                </div>
                <div className="absolute inset-x-0 top-1 h-7">
                  {Array.from(r.marks.entries()).map(([idx, kind]) => (
                    <div key={idx} className="absolute flex justify-center" style={{ left: `${idx * colW}%`, width: `${colW}%` }}>
                      <Marker kind={kind} />
                    </div>
                  ))}
                </div>
                {r.bars.map((b, i) => (
                  <div
                    key={i}
                    className="absolute bottom-2 flex h-5 items-center gap-1 overflow-hidden rounded-full border border-[#c59b5b] bg-[#e8dcc4] px-1.5 text-[10px] font-semibold text-[#6b4f22] print-exact"
                    style={{ left: `${b.left}%`, width: `${b.width}%` }}
                    title={`${b.nights} ${t.nights}`}
                  >
                    {b.showArrival && <LogIn className="h-3 w-3 flex-shrink-0" aria-label={t.arrival} />}
                    <Moon className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
                    <span>{b.nights}</span>
                  </div>
                ))}
              </div>
            ))}

            <div className="flex h-8 border-t-2 border-[#8f6d3a]">
              {rows.perDayTotals.map((n, i) => (
                <div key={i} style={{ width: `${colW}%` }} className="flex items-center justify-center text-xs font-bold text-[#2a2a2a]">
                  {n > 0 ? n : ''}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[#4a4a4a]">
        <span className="flex items-center gap-1.5"><Marker kind="change" /> {t.change}</span>
        <span className="flex items-center gap-1.5"><Marker kind="optional" /> {t.optional}</span>
        <span className="flex items-center gap-1.5"><Marker kind="departure" /> {t.departure}</span>
        <span className="flex items-center gap-1.5">
          <span className="flex h-5 items-center gap-1 rounded-full border border-[#c59b5b] bg-[#e8dcc4] px-1.5 text-[10px] font-semibold text-[#6b4f22] print-exact">
            <LogIn className="h-3 w-3" aria-hidden="true" /> <Moon className="h-3 w-3" aria-hidden="true" /> 5
          </span>
          {t.arrival} · {t.nights}
        </span>
      </div>
      <p className="mt-2 text-[11px] text-[#6b6b6b]">{t.rules}</p>

      <style jsx global>{`
        .print-exact { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        @media print {
          body.printing-linen * { visibility: hidden; }
          body.printing-linen .linen-print-root,
          body.printing-linen .linen-print-root * { visibility: visible; }
          body.printing-linen .linen-print-root {
            position: absolute; left: 0; top: 0; width: 100%;
            border: none; border-radius: 0; background: #fff !important;
            -webkit-print-color-adjust: exact; print-color-adjust: exact;
          }
          body.printing-linen .linen-print-root .no-print { display: none !important; }
        }
      `}</style>
    </section>
  )
}
