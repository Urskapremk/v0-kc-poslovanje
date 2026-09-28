'use client'

import React, { useState } from 'react'
import useSWR from 'swr'
import { ArrowDownLeft, Trash2, Check, User, Phone, HelpCircle } from 'lucide-react'
import {
  getOmIncoming, parseAndSaveOmIncoming, deleteOmIncoming,
} from '@/app/actions/om-incoming'

const OM_ORANGE = '#ff7900'
const OM_GREEN = '#8fae92'

function fmtAr(v: number) {
  return `${new Intl.NumberFormat('de-DE').format(v)} Ar`
}
function formatDate(d: string | null) {
  if (!d) return 'Brez datuma'
  const p = d.split('-')
  return p.length === 3 ? `${p[2]}. ${p[1]}. ${p[0]}` : d
}

export default function OmIncomingList() {
  const { data: incoming, mutate } = useSWR(['om-incoming'], () => getOmIncoming())
  const [raw, setRaw] = useState('')
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<{ saved: number; skipped: number } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const list = incoming ?? []
  const total = list.reduce((s, t) => s + Number(t.amount), 0)

  async function handleParse() {
    if (!raw.trim()) return
    setSaving(true)
    setResult(null)
    try {
      const res = await parseAndSaveOmIncoming(raw)
      setResult({ saved: res.saved, skipped: res.skipped })
      if (res.parsed.length > 0) setRaw('')
      mutate()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (confirmDelete !== id) {
      setConfirmDelete(id)
      setTimeout(() => setConfirmDelete((c) => (c === id ? null : c)), 4000)
      return
    }
    await deleteOmIncoming(id)
    setConfirmDelete(null)
    mutate()
  }

  return (
    <div className="space-y-6">
      {/* Vnos surovih SMS obvestil */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ backgroundColor: `${OM_GREEN}22`, color: OM_GREEN }}>
            <ArrowDownLeft className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-white/40">Orange Money</p>
            <h2 className="text-lg font-bold text-white">Seznam prilivov</h2>
          </div>
        </div>
        <p className="mb-3 text-xs text-white/50">
          Prilepi SMS obvestila Orange Money. Iz njih razčlenim prejeta nakazila
          (<span className="text-white/70">„Vous avez recu un transfert … de la part de …"</span> ali
          <span className="text-white/70"> „… venant du …"</span>) in pošiljatelja povežem s telefonskim imenikom.
          Ta seznam je pregled prejetih nakazil in ne vpliva na saldo denarnice.
        </p>
        <textarea value={raw} onChange={(e) => setRaw(e.target.value)} rows={6}
          placeholder="Prilepi SMS obvestila tukaj…"
          className="w-full resize-y rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-[#8fae92]/40 focus:outline-none" />
        <div className="mt-3 flex items-center gap-3">
          <button onClick={handleParse} disabled={saving || !raw.trim()}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-40"
            style={{ backgroundColor: `${OM_GREEN}26`, color: OM_GREEN }}>
            <Check className="h-4 w-4" /> {saving ? 'Razčlenjujem…' : 'Razčleni in shrani'}
          </button>
          {result && (
            <span className="text-xs text-white/50">
              Dodanih <span className="font-medium text-[#8fae92]">{result.saved}</span>
              {result.skipped > 0 && <> · že obstoječih / brez priliva <span className="font-medium text-white/70">{result.skipped}</span></>}
            </span>
          )}
        </div>
      </div>

      {/* Povzetek */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-[#8fae92]/20 bg-[#8fae92]/[0.06] p-3">
          <p className="mb-1 text-[11px] uppercase tracking-wider text-[#8fae92]">Skupaj prejeto</p>
          <p className="text-lg font-bold text-white tabular-nums">{fmtAr(total)}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <p className="mb-1 text-[11px] uppercase tracking-wider text-white/40">Število prilivov</p>
          <p className="text-lg font-bold text-white tabular-nums">{list.length}</p>
        </div>
      </div>

      {/* Seznam prilivov */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <p className="mb-3 text-sm font-semibold text-white">Prilivi</p>
        {list.length === 0 ? (
          <p className="py-10 text-center text-sm text-white/30">Ni razčlenjenih prilivov. Prilepi SMS obvestila zgoraj.</p>
        ) : (
          <div className="divide-y divide-white/[0.05]">
            {list.map((t) => {
              const known = !!t.senderName
              return (
                <div key={t.id} className="flex items-center gap-3 py-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: known ? '#8fae9222' : '#b1c7cf1a', color: known ? '#8fae92' : '#b1c7cf' }}>
                    {known ? <User className="h-4 w-4" /> : <HelpCircle className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-medium text-white/90">
                        {t.senderName ?? 'Neznan pošiljatelj'}
                      </span>
                      <span className="flex items-center gap-1 rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] text-white/50">
                        <Phone className="h-3 w-3" />{t.senderNumber}
                      </span>
                    </div>
                    <p className="text-xs text-white/40">
                      {formatDate(t.transferDate)}
                      {t.transId ? <> · {t.transId}</> : null}
                    </p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-[#8fae92]">+ {fmtAr(Number(t.amount))}</span>
                  <button onClick={() => handleDelete(t.id)}
                    className={`rounded-lg p-2 transition-colors ${confirmDelete === t.id ? 'bg-[#c98f7d]/20 text-[#c98f7d]' : 'text-white/30 hover:bg-white/5 hover:text-[#c98f7d]'}`}
                    title={confirmDelete === t.id ? 'Klikni še enkrat za izbris' : 'Izbriši'}>
                    {confirmDelete === t.id ? <span className="px-1 text-[11px] font-medium">Izbriši?</span> : <Trash2 className="h-4 w-4" />}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
