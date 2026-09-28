'use client'

import React, { useState } from 'react'
import useSWR from 'swr'
import { Send, Trash2, Check, User, Phone, HelpCircle, Plus, BookUser, Wallet, Undo2 } from 'lucide-react'
import {
  getOmTransfers, parseAndSaveOmTransfers, deleteOmTransfer,
  transferOmToBlagajna, undoTransferOmToBlagajna,
} from '@/app/actions/om-transfers'
import {
  getPhoneContacts, addPhoneContact, deletePhoneContact,
} from '@/app/actions/phone-contacts'

const OM_ORANGE = '#ff7900'

function fmtAr(v: number) {
  return `${new Intl.NumberFormat('de-DE').format(v)} Ar`
}
function formatDate(d: string | null) {
  if (!d) return 'Brez datuma'
  const p = d.split('-')
  return p.length === 3 ? `${p[2]}. ${p[1]}. ${p[0]}` : d
}

export default function OmTransferList() {
  const { data: transfers, mutate } = useSWR(['om-transfers'], () => getOmTransfers())
  const { data: contacts, mutate: mutateContacts } = useSWR(['phone-contacts'], () => getPhoneContacts())
  const [raw, setRaw] = useState('')
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<{ saved: number; skipped: number } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  // Telefonski imenik
  const [newName, setNewName] = useState('')
  const [newNumber, setNewNumber] = useState('')
  const [addingContact, setAddingContact] = useState(false)
  const [contactMsg, setContactMsg] = useState<string | null>(null)
  const [confirmDeleteContact, setConfirmDeleteContact] = useState<string | null>(null)
  const contactList = contacts ?? []

  async function handleAddContact() {
    if (!newName.trim() || !newNumber.trim()) return
    setAddingContact(true)
    setContactMsg(null)
    try {
      const res = await addPhoneContact(newName, newNumber)
      setNewName('')
      setNewNumber('')
      setContactMsg(
        res.reresolved > 0
          ? `Dodano. Posodobljenih ${res.reresolved} obstoječih nakazil.`
          : 'Dodano.'
      )
      mutateContacts()
      if (res.reresolved > 0) mutate()
    } finally {
      setAddingContact(false)
    }
  }

  async function handleDeleteContact(id: string) {
    if (confirmDeleteContact !== id) {
      setConfirmDeleteContact(id)
      setTimeout(() => setConfirmDeleteContact((c) => (c === id ? null : c)), 4000)
      return
    }
    await deletePhoneContact(id)
    setConfirmDeleteContact(null)
    mutateContacts()
  }

  const list = transfers ?? []
  const total = list.reduce((s, t) => s + Number(t.amount), 0)

  async function handleParse() {
    if (!raw.trim()) return
    setSaving(true)
    setResult(null)
    try {
      const res = await parseAndSaveOmTransfers(raw)
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
    await deleteOmTransfer(id)
    setConfirmDelete(null)
    mutate()
  }

  // Prenos na blagajno (Indijec → gotovina)
  const [busyBlagajna, setBusyBlagajna] = useState<string | null>(null)
  const [confirmUndo, setConfirmUndo] = useState<string | null>(null)

  async function handleTransfer(id: string) {
    setBusyBlagajna(id)
    try {
      await transferOmToBlagajna(id)
      mutate()
    } finally {
      setBusyBlagajna(null)
    }
  }

  async function handleUndoTransfer(id: string) {
    if (confirmUndo !== id) {
      setConfirmUndo(id)
      setTimeout(() => setConfirmUndo((c) => (c === id ? null : c)), 4000)
      return
    }
    setBusyBlagajna(id)
    try {
      await undoTransferOmToBlagajna(id)
      setConfirmUndo(null)
      mutate()
    } finally {
      setBusyBlagajna(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Vnos surovih SMS obvestil */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ backgroundColor: `${OM_ORANGE}22`, color: OM_ORANGE }}>
            <Send className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-white/40">Orange Money</p>
            <h2 className="text-lg font-bold text-white">Seznam nakazil</h2>
          </div>
        </div>
        <p className="mb-3 text-xs text-white/50">
          Prilepi SMS obvestila Orange Money. Iz njih razčlenim izhodna nakazila
          (<span className="text-white/70">„Votre transfert de … vers le …"</span>) in prejemnika samodejno
          povežem z Borutovim telefonskim imenikom.
        </p>
        <textarea value={raw} onChange={(e) => setRaw(e.target.value)} rows={6}
          placeholder="Prilepi SMS obvestila tukaj…"
          className="w-full resize-y rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-[#ff7900]/40 focus:outline-none" />
        <div className="mt-3 flex items-center gap-3">
          <button onClick={handleParse} disabled={saving || !raw.trim()}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-40"
            style={{ backgroundColor: `${OM_ORANGE}26`, color: '#d09681' }}>
            <Check className="h-4 w-4" /> {saving ? 'Razčlenjujem…' : 'Razčleni in shrani'}
          </button>
          {result && (
            <span className="text-xs text-white/50">
              Dodanih <span className="font-medium text-[#8fae92]">{result.saved}</span>
              {result.skipped > 0 && <> · že obstoječih / brez nakazila <span className="font-medium text-white/70">{result.skipped}</span></>}
            </span>
          )}
        </div>
      </div>

      {/* Telefonski imenik */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="mb-1 flex items-center gap-2">
          <BookUser className="h-4 w-4 text-[#8fae92]" />
          <p className="text-sm font-semibold text-white">Telefonski imenik</p>
        </div>
        <p className="mb-3 text-xs text-white/50">
          Dodaj številke prejemnikov. Razčlemba nakazil samodejno poveže te
          številke z imeni — tudi retroaktivno pri že shranjenih nakazilih.
        </p>

        <div className="mb-4 flex flex-wrap items-end gap-2">
          <div className="min-w-[130px] flex-1">
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/40">Ime</label>
            <input value={newName} onChange={(e) => { setNewName(e.target.value); setContactMsg(null) }}
              placeholder="npr. Koko"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/25 focus:border-[#8fae92]/50 focus:outline-none" />
          </div>
          <div className="min-w-[150px] flex-1">
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/40">Telefonska številka</label>
            <input value={newNumber} onChange={(e) => { setNewNumber(e.target.value); setContactMsg(null) }}
              placeholder="npr. 0325662267"
              inputMode="tel"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/25 focus:border-[#8fae92]/50 focus:outline-none" />
          </div>
          <button onClick={handleAddContact} disabled={addingContact || !newName.trim() || !newNumber.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-[#8fae92]/20 px-4 py-2 text-sm font-medium text-[#8fae92] transition-colors hover:bg-[#8fae92]/30 disabled:opacity-40">
            <Plus className="h-4 w-4" /> Dodaj
          </button>
          {contactMsg && <span className="text-xs text-white/60">{contactMsg}</span>}
        </div>

        {contactList.length === 0 ? (
          <p className="py-4 text-center text-sm text-white/30">Imenik je prazen.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {contactList.map((c) => (
              <div key={c.id} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] py-1.5 pl-3 pr-1.5">
                <User className="h-3.5 w-3.5 text-[#8fae92]" />
                <span className="text-sm text-white/90">{c.name}</span>
                <span className="flex items-center gap-1 text-xs text-white/40"><Phone className="h-3 w-3" />{c.number}</span>
                <button onClick={() => handleDeleteContact(c.id)}
                  className={`rounded-md p-1 transition-colors ${confirmDeleteContact === c.id ? 'bg-[#c98f7d]/20 text-[#c98f7d]' : 'text-white/25 hover:bg-white/5 hover:text-[#c98f7d]'}`}
                  title={confirmDeleteContact === c.id ? 'Klikni še enkrat za izbris' : 'Izbriši'}>
                  {confirmDeleteContact === c.id ? <span className="px-1 text-[10px] font-medium">Izbriši?</span> : <Trash2 className="h-3.5 w-3.5" />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Povzetek */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-[#c98f7d]/20 bg-[#c98f7d]/[0.06] p-3">
          <p className="mb-1 text-[11px] uppercase tracking-wider text-[#c98f7d]">Skupaj nakazano</p>
          <p className="text-lg font-bold text-white tabular-nums">{fmtAr(total)}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <p className="mb-1 text-[11px] uppercase tracking-wider text-white/40">Število nakazil</p>
          <p className="text-lg font-bold text-white tabular-nums">{list.length}</p>
        </div>
      </div>

      {/* Seznam nakazil */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <p className="mb-3 text-sm font-semibold text-white">Nakazila</p>
        {list.length === 0 ? (
          <p className="py-10 text-center text-sm text-white/30">Ni razčlenjenih nakazil. Prilepi SMS obvestila zgoraj.</p>
        ) : (
          <div className="divide-y divide-white/[0.05]">
            {list.map((t) => {
              const known = !!t.recipientName
              return (
                <div key={t.id} className="flex items-center gap-3 py-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: known ? '#8fae9222' : '#b1c7cf1a', color: known ? '#8fae92' : '#b1c7cf' }}>
                    {known ? <User className="h-4 w-4" /> : <HelpCircle className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-medium text-white/90">
                        {t.recipientName ?? 'Neznan prejemnik'}
                      </span>
                      <span className="flex items-center gap-1 rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] text-white/50">
                        <Phone className="h-3 w-3" />{t.recipientNumber}
                      </span>
                    </div>
                    <p className="text-xs text-white/40">
                      {formatDate(t.transferDate)}
                      {t.fees ? <> · provizija {fmtAr(Number(t.fees))}</> : null}
                      {t.transId ? <> · {t.transId}</> : null}
                    </p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-[#c98f7d]">− {fmtAr(Number(t.amount))}</span>
                  {t.blagajnaCashId ? (
                    <button onClick={() => handleUndoTransfer(t.id)} disabled={busyBlagajna === t.id}
                      className={`flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-colors ${confirmUndo === t.id ? 'bg-[#c98f7d]/20 text-[#c98f7d]' : 'bg-[#8fae92]/15 text-[#8fae92] hover:bg-[#8fae92]/25'} disabled:opacity-40`}
                      title={confirmUndo === t.id ? 'Klikni še enkrat za razveljavitev' : 'V blagajni (Tourism) — klikni za razveljavitev'}>
                      {confirmUndo === t.id ? <><Undo2 className="h-3.5 w-3.5" /> Razveljavi?</> : <><Wallet className="h-3.5 w-3.5" /> V blagajni</>}
                    </button>
                  ) : (
                    <button onClick={() => handleTransfer(t.id)} disabled={busyBlagajna === t.id}
                      className="flex shrink-0 items-center gap-1 rounded-lg bg-[#c59b5b]/15 px-2 py-1.5 text-[11px] font-medium text-[#c59b5b] transition-colors hover:bg-[#c59b5b]/25 disabled:opacity-40"
                      title={`V blagajno Tourism: ${fmtAr(Number(t.amount) - Number(t.fees || 0))} (provizija ${fmtAr(Number(t.fees || 0))} → stroški)`}>
                      <Wallet className="h-3.5 w-3.5" /> {busyBlagajna === t.id ? '…' : '→ v blagajno'}
                    </button>
                  )}
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
