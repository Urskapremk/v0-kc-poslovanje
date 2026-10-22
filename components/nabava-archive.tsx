'use client'

import React, { useState, useMemo } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { ArrowLeft, Search, ShoppingCart } from 'lucide-react'
import { getArchivedNabavaTrips } from '@/app/actions/nabava'
import { NabavaPurchasesSection } from '@/components/nabava-purchases-section'
import { NabavaRacunovodstvo } from '@/components/nabava-racunovodstvo'

const PAY_LABELS: Record<string, string> = {
  boat: 'Dilip (čoln)',
  boatdriver: 'Voznik čolna',
  porters: 'Nosači',
  tuctuc: 'Tuc tuc',
}

export function NabavaArchive({ site, title }: { site: 'hv' | 'komba'; title: string }) {
  const [search, setSearch] = useState('')
  const { data, isLoading, error } = useSWR(['archived-nabava', site], () => getArchivedNabavaTrips(site), {
    revalidateOnFocus: false,
  })
  const trips = data?.trips || []

  const filtered = useMemo(() => {
    if (!search.trim()) return trips
    const q = search.toLowerCase()
    return trips.filter((t) => t.note.toLowerCase().includes(q) || t.date.includes(q))
  }, [trips, search])

  const groups = useMemo(() => {
    const map = new Map<string, typeof trips>()
    for (const t of filtered) {
      const arr = map.get(t.date) || []
      arr.push(t)
      map.set(t.date, arr)
    }
    return Array.from(map.entries())
  }, [filtered])

  const today = data?.today || ''
  const yesterday = today ? new Date(new Date(today).getTime() - 86400000).toISOString().split('T')[0] : ''
  const dayLabel = (d: string) => {
    if (d === today) return 'Danes'
    if (d === yesterday) return 'Včeraj'
    return new Date(d).toLocaleDateString('sl-SI', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }

  return (
    <div className="min-h-screen bg-[#0a2029] text-white">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0a2029]/95 backdrop-blur-sm">
        <div className="mx-auto max-w-3xl px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="rounded-lg bg-white/5 p-2 text-white/60 hover:bg-white/10 hover:text-white">
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div>
                <h1 className="text-xl font-bold text-[#c9a86a]">{title}</h1>
                <p className="text-sm text-white/40">Nakupi po dnevih · klikni za popravek</p>
              </div>
            </div>
            {data && <p className="text-sm text-white/40">{filtered.length} nabav</p>}
          </div>

          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              placeholder="Išči po opisu ali datumu..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-4 text-white placeholder:text-white/30 focus:border-[#c9a86a]/50 focus:outline-none"
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        {isLoading ? (
          <div className="py-12 text-center text-white/40">Nalagam...</div>
        ) : error ? (
          <div className="py-12 text-center text-red-400">Napaka pri nalaganju</div>
        ) : groups.length === 0 ? (
          <div className="py-12 text-center text-white/40">
            {search ? 'Ni rezultatov za iskanje' : 'Ni arhiviranih nakupov'}
          </div>
        ) : (
          <div className="space-y-6">
            {groups.map(([date, dayTrips]) => (
              <section key={date}>
                <div className="mb-2 flex items-center gap-2">
                  <h2 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#c9a86a]">{dayLabel(date)}</h2>
                  <span className="rounded-full bg-white/5 px-1.5 py-0.5 text-[10px] text-white/40">{dayTrips.length}</span>
                </div>
                <div className="space-y-3">
                  {dayTrips.map((trip) => (
                    <div key={trip.id} className={`rounded-xl border p-3 ${trip.note === "Masaže" ? "border-[#7a4ea3]/45 bg-[#f4eef8]" : "border-[#c9a86a]/15 bg-[#f7f2e7]"}`}>
                      <div className="mb-1 flex items-center gap-2">
                        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#c9a86a]/20 text-[#8f6d3a]">
                          <ShoppingCart className="h-3.5 w-3.5" />
                        </span>
                        <p className={`min-w-0 flex-1 truncate text-[12px] font-semibold ${trip.note === "Masaže" ? "text-[#7a4ea3]" : "text-[#0f2e3a]"}`}>
                          {trip.note || 'Nabava'}
                          {trip.note === "Masaže" && (
                            <span className="ml-1.5 rounded-full bg-[#7a4ea3]/15 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-[#7a4ea3]">Samodejno</span>
                          )}
                        </p>
                      </div>
                      {trip.payments.length > 0 && (
                        <div className="mb-2 space-y-1">
                          <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-[#8f6d3a]">Plačila (čoln, voznik, nosači)</p>
                          {trip.payments.map((p) => (
                            <div key={p.refKey} className="flex items-center justify-between gap-2 rounded-lg bg-[#4f7a54]/10 px-2.5 py-1.5 text-[11px] text-[#0f2e3a]">
                              <span className="min-w-0 truncate">
                                <span className="font-semibold">{PAY_LABELS[p.refKey.split(':')[2]] || p.supplier}</span>
                                <span className="text-[#0f2e3a]/60"> · {p.method === 'cash' ? `Gotovina (${p.company === 'sarl' ? 'SARL' : 'Tourism'})` : 'Orange Money'}{p.paidAt ? ` · ${new Date(p.paidAt).toLocaleDateString('sl-SI')}` : ''}</span>
                              </span>
                              <span className="flex-shrink-0 font-semibold text-[#4f7a54]">{p.amountAr.toLocaleString('de-DE')} Ar</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {trip.note === 'Računovodstvo' ? (
                        <NabavaRacunovodstvo tripId={trip.id} />
                      ) : (
                        <NabavaPurchasesSection tripId={trip.id} tripNote={trip.note} showRent={site === 'komba'} />
                      )}
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
