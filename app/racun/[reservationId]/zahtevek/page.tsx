'use client'

import React, { useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import useSWR from 'swr'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, Plus, Printer, Trash2 } from 'lucide-react'
import { getReservationById, getOrderItems } from '@/app/actions/komba'
import { getDeliveryNotesForReservation } from '@/app/actions/delivery'
import { bungalowDisplayName } from '@/lib/bungalow'

type Lang = 'en' | 'fr'

interface Line {
  id: string
  date: string
  name: string
  qty: number
  eur: number
}

interface ManualLine {
  id: string
  date: string
  name: string
  eur: string
}

const text = {
  en: {
    title: 'Statement of expenses',
    defaultReason: 'Additional expenses caused by the rescheduling of the flight',
    guest: 'Guest',
    stay: 'Stay',
    date: 'Date',
    description: 'Description',
    qty: 'Qty',
    amount: 'Amount',
    total: 'Total',
    issued: 'Issued',
    note: 'Amounts in EUR. This statement covers only the expenses listed above.',
  },
  fr: {
    title: 'Relevé des frais',
    defaultReason: 'Frais supplémentaires occasionnés par le report du vol',
    guest: 'Client',
    stay: 'Séjour',
    date: 'Date',
    description: 'Description',
    qty: 'Qté',
    amount: 'Montant',
    total: 'Total',
    issued: 'Émis le',
    note: 'Montants en EUR. Ce relevé ne couvre que les frais indiqués ci-dessus.',
  },
} as const

const formatEur = (n: number) =>
  n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const formatDate = (iso: string, lang: Lang) => {
  if (!iso) return ''
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`)
  return d.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

const fetcher = async (reservationId: string) => {
  const [reservation, orderItems, notes] = await Promise.all([
    getReservationById(reservationId),
    getOrderItems(reservationId),
    getDeliveryNotesForReservation(reservationId),
  ])
  return { reservation, orderItems, notes }
}

export default function ClaimInvoicePage() {
  const { reservationId } = useParams<{ reservationId: string }>()
  const { data, isLoading } = useSWR(reservationId ? ['claim-invoice', reservationId] : null, () => fetcher(reservationId))

  const [lang, setLang] = useState<Lang>('en')
  const [reason, setReason] = useState('')
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [manual, setManual] = useState<ManualLine[]>([])

  const rate = Number(data?.reservation?.exchangeRate) || 4800

  const lines: Line[] = useMemo(() => {
    if (!data) return []
    const fromOrders: Line[] = (data.orderItems || []).map((i) => ({
      id: `o-${i.id}`,
      date: i.eventDate || (i.createdAt ? new Date(i.createdAt).toISOString().slice(0, 10) : ''),
      name: i.name,
      qty: Number((i as { qty?: number | null }).qty) || 1,
      eur: Number(i.priceAr) / rate,
    }))
    const fromBar: Line[] = (data.notes || []).flatMap((n) =>
      (n.items || [])
        .filter((it) => !it.isFree)
        .map((it) => ({
          id: `b-${it.id}`,
          date: String(n.date).slice(0, 10),
          name: it.productName,
          qty: Number(it.quantity) || 1,
          eur: (Number(it.priceAr) * (Number(it.quantity) || 1)) / rate,
        })),
    )
    return [...fromOrders, ...fromBar].sort((a, b) => a.date.localeCompare(b.date))
  }, [data, rate])

  const chosen: Line[] = [
    ...lines.filter((l) => selected[l.id]),
    ...manual
      .filter((m) => m.name.trim() && Number(m.eur.replace(',', '.')) > 0)
      .map((m) => ({ id: m.id, date: m.date, name: m.name.trim(), qty: 1, eur: Number(m.eur.replace(',', '.')) })),
  ].sort((a, b) => a.date.localeCompare(b.date))

  const total = chosen.reduce((s, l) => s + l.eur, 0)
  const t = text[lang]
  const today = new Date().toISOString().slice(0, 10)

  if (isLoading || !data) {
    return <main className="min-h-screen bg-[#0f1f26] p-8 text-white/60">Nalagam…</main>
  }

  const r = data.reservation
  if (!r) {
    return <main className="min-h-screen bg-[#0f1f26] p-8 text-white/60">Rezervacija ni najdena.</main>
  }

  const guestNames = [r.guestName, r.secondGuestName].filter(Boolean).join(' & ')

  return (
    <main className="min-h-screen bg-[#0f1f26] text-white print:bg-white">
      <style>{`@media print { .no-print { display: none !important; } @page { size: A4; margin: 14mm; } }`}</style>

      <div className="no-print mx-auto max-w-4xl px-4 py-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <Link
            href={`/racun/${reservationId}?view=true`}
            className="flex items-center gap-2 text-sm text-white/60 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Nazaj na glavni račun
          </Link>
          <div className="flex items-center gap-2">
            {(['en', 'fr'] as Lang[]).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                aria-pressed={lang === l}
                className={`rounded-lg border px-3 py-2 text-sm font-medium uppercase ${lang === l ? 'border-[#c59b5b]/60 bg-[#c59b5b]/15 text-[#e0c68a]' : 'border-white/15 text-white/50 hover:text-white'}`}
              >
                {l}
              </button>
            ))}
            <button
              onClick={() => window.print()}
              disabled={chosen.length === 0}
              className="flex items-center gap-2 rounded-lg bg-[#c59b5b] px-4 py-2 font-medium text-gray-900 hover:bg-[#d6ae7d] disabled:opacity-40"
            >
              <Printer className="h-4 w-4" />
              Natisni
            </button>
          </div>
        </div>

        <h1 className="text-xl font-semibold">Ločen račun za izbrane postavke</h1>
        <p className="mt-1 text-sm text-white/50">
          Glavni račun ostane nespremenjen. Označi postavke, ki jih gost uveljavlja pri letalski družbi; postavke, ki še niso vnesene (npr. jutrišnji zajtrk), lahko dodaš ročno.
        </p>

        <label className="mt-5 block text-xs uppercase tracking-wide text-white/40" htmlFor="claim-reason">
          Razlog na računu
        </label>
        <input
          id="claim-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t.defaultReason}
          className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#c59b5b]/60 focus:outline-none"
        />

        <section className="mt-6 rounded-xl border border-white/10 bg-white/[0.03]">
          <h2 className="border-b border-white/10 px-4 py-3 text-sm font-semibold text-white/80">Postavke gosta</h2>
          {lines.length === 0 ? (
            <p className="px-4 py-4 text-sm text-white/40">Ni vnesenih postavk.</p>
          ) : (
            <ul className="divide-y divide-white/5">
              {lines.map((l) => (
                <li key={l.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-white/[0.03]">
                    <input
                      type="checkbox"
                      checked={!!selected[l.id]}
                      onChange={(e) => setSelected((s) => ({ ...s, [l.id]: e.target.checked }))}
                      className="h-4 w-4 accent-[#c59b5b]"
                    />
                    <span className="w-24 flex-shrink-0 text-xs text-white/40">{formatDate(l.date, 'en')}</span>
                    <span className="flex-1 text-sm text-white/85">
                      {l.qty > 1 ? `${l.qty}x ` : ''}
                      {l.name}
                    </span>
                    <span className="text-sm tabular-nums text-white/70">{formatEur(l.eur)} EUR</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white/80">Ročno dodane postavke</h2>
            <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() =>
                setManual((m) => [
                  ...m,
                  {
                    id: `m-${Date.now()}`,
                    date: today,
                    name: lang === 'fr'
                      ? `Hébergement – 1 nuit (${bungalowDisplayName(r.bungalow)})`
                      : `Accommodation – 1 night (${bungalowDisplayName(r.bungalow)})`,
                    eur: '',
                  },
                ])
              }
              className="flex items-center gap-1.5 rounded-lg border border-[#c59b5b]/40 px-3 py-1.5 text-xs font-medium text-[#e0c68a] hover:bg-[#c59b5b]/10"
            >
              <Plus className="h-3.5 w-3.5" />
              Dodaj nočitev
            </button>
            <button
              onClick={() =>
                setManual((m) => [...m, { id: `m-${Date.now()}`, date: today, name: '', eur: '' }])
              }
              className="flex items-center gap-1.5 rounded-lg border border-[#8fae92]/40 px-3 py-1.5 text-xs font-medium text-[#8fae92] hover:bg-[#8fae92]/10"
            >
              <Plus className="h-3.5 w-3.5" />
              Dodaj postavko
            </button>
            </div>
          </div>
          {manual.map((m) => (
            <div key={m.id} className="mt-3 flex flex-wrap items-center gap-2">
              <input
                type="date"
                aria-label="Datum"
                value={m.date}
                onChange={(e) => setManual((all) => all.map((x) => (x.id === m.id ? { ...x, date: e.target.value } : x)))}
                className="rounded-lg border border-white/15 bg-white/5 px-2 py-1.5 text-sm text-white [color-scheme:dark]"
              />
              <input
                aria-label="Opis"
                placeholder="npr. Breakfast for 2"
                value={m.name}
                onChange={(e) => setManual((all) => all.map((x) => (x.id === m.id ? { ...x, name: e.target.value } : x)))}
                className="min-w-0 flex-1 rounded-lg border border-white/15 bg-white/5 px-2 py-1.5 text-sm text-white placeholder:text-white/30"
              />
              <input
                aria-label="Znesek v EUR"
                inputMode="decimal"
                placeholder="EUR"
                value={m.eur}
                onChange={(e) => setManual((all) => all.map((x) => (x.id === m.id ? { ...x, eur: e.target.value } : x)))}
                className="w-24 rounded-lg border border-white/15 bg-white/5 px-2 py-1.5 text-right text-sm text-white placeholder:text-white/30"
              />
              <button
                onClick={() => setManual((all) => all.filter((x) => x.id !== m.id))}
                aria-label="Odstrani postavko"
                className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </section>

        <p className="mt-6 text-xs uppercase tracking-wide text-white/40">Predogled</p>
      </div>

      <article className="mx-auto mb-10 max-w-4xl bg-white px-10 py-10 text-gray-900 shadow-xl print:mb-0 print:max-w-none print:p-0 print:shadow-none">
        <header className="flex items-start justify-between gap-6 border-b border-gray-200 pb-6">
          <Image src="/images/komba-logo.png" alt="Komba Cabana" width={140} height={60} className="h-14 w-auto object-contain" />
          <div className="text-right">
            <h1 className="text-2xl font-semibold">{t.title}</h1>
            <p className="mt-1 text-sm text-gray-500">
              {t.issued}: {formatDate(today, lang)}
            </p>
          </div>
        </header>

        <div className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-400">{t.guest}</p>
            <p className="mt-1 font-medium">{guestNames}</p>
          </div>
          <div className="sm:text-right">
            <p className="text-xs uppercase tracking-wide text-gray-400">{t.stay}</p>
            <p className="mt-1 font-medium">
              {bungalowDisplayName(r.bungalow)} · {formatDate(String(r.arrival), lang)} – {formatDate(String(r.departure), lang)}
            </p>
          </div>
        </div>

        <p className="mt-6 rounded-lg bg-[#f6f1e7] px-4 py-3 text-sm text-gray-700">{reason.trim() || t.defaultReason}</p>

        <table className="mt-6 w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-400">
              <th className="py-2 pr-4 font-medium">{t.date}</th>
              <th className="py-2 pr-4 font-medium">{t.description}</th>
              <th className="py-2 pr-4 text-right font-medium">{t.qty}</th>
              <th className="py-2 text-right font-medium">{t.amount}</th>
            </tr>
          </thead>
          <tbody>
            {chosen.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-6 text-center text-gray-400">
                  —
                </td>
              </tr>
            ) : (
              chosen.map((l) => (
                <tr key={l.id} className="border-b border-gray-100">
                  <td className="whitespace-nowrap py-2.5 pr-4 text-gray-500">{formatDate(l.date, lang)}</td>
                  <td className="py-2.5 pr-4">{l.name}</td>
                  <td className="py-2.5 pr-4 text-right tabular-nums">{l.qty}</td>
                  <td className="py-2.5 text-right tabular-nums">{formatEur(l.eur)} EUR</td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} className="pt-4 text-right font-semibold">
                {t.total}
              </td>
              <td className="pt-4 text-right text-base font-semibold tabular-nums">{formatEur(total)} EUR</td>
            </tr>
          </tfoot>
        </table>

        <p className="mt-10 text-xs text-gray-400">{t.note}</p>
        <p className="mt-1 text-xs text-gray-400">Komba Cabana · Nosy Be, Madagascar</p>
      </article>
    </main>
  )
}
