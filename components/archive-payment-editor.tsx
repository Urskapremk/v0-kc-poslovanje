'use client'

import React, { useEffect, useState } from 'react'
import { X, Trash2, Plus } from 'lucide-react'
import { getPayments, addPayment, deletePayment } from '@/app/actions/komba'

const PAYMENT_METHODS = [
  { value: 'card', label: 'Kreditna kartica' },
  { value: 'transfer', label: 'Bancni transfer' },
  { value: 'orange_money', label: 'Orange Money' },
  { value: 'cash', label: 'Gotovina' },
]

type PaymentRow = {
  id: string
  amount: string
  method: string
  paidAt: string
  notes: string | null
  omAmountAr?: number | null
  cashCompany?: string | null
}

const fmtEur = (n: number) => n.toFixed(2) + ' EUR'
const fmtAr = (n: number) => new Intl.NumberFormat('de-DE').format(Math.round(n)) + ' Ar'
const methodLabel = (m: string) => PAYMENT_METHODS.find(x => x.value === m)?.label || m

export default function ArchivePaymentEditor({
  reservationId,
  guestName,
  totalOwedEur,
  rate,
  onClose,
  onSaved,
}: {
  reservationId: string
  guestName: string
  totalOwedEur: number
  rate: number
  onClose: () => void
  onSaved: () => void
}) {
  const [rows, setRows] = useState<PaymentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({
    amount: '',
    method: 'cash',
    paidAt: today,
    notes: '',
    omAmountAr: '',
    cashCompany: 'tourism',
    writeToRegister: true,
  })

  async function load() {
    setLoading(true)
    const data = await getPayments(reservationId)
    setRows(data as PaymentRow[])
    setLoading(false)
  }
  useEffect(() => { load() }, [reservationId])

  const paid = rows.reduce((s, p) => s + Number(p.amount), 0)
  const remaining = totalOwedEur - paid

  async function handleAdd() {
    if (!form.amount || Number(form.amount) <= 0) return
    setSaving(true)
    await addPayment({
      reservationId,
      amount: form.amount,
      method: form.method,
      paidAt: form.paidAt,
      notes: form.notes || undefined,
      omAmountAr: form.method === 'orange_money' && form.omAmountAr ? Number(form.omAmountAr) : undefined,
      cashCompany: form.method === 'cash' && form.writeToRegister ? form.cashCompany : undefined,
    })
    setForm({ amount: '', method: 'cash', paidAt: today, notes: '', omAmountAr: '', cashCompany: 'tourism', writeToRegister: true })
    setShowAdd(false)
    await load()
    setSaving(false)
    onSaved()
  }

  async function handleDelete(id: string) {
    if (!confirm('Izbrisati to placilo? Ce je bilo vpisano v blagajno / Orange Money, se odstrani tudi tam.')) return
    await deletePayment(id)
    await load()
    onSaved()
  }

  const inputCls = 'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#c59b5b]/50 focus:outline-none'
  const labelCls = 'block text-xs text-white/40 mb-1'

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0a2029] shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold text-[#c59b5b]">Uredi placila</h3>
            <p className="mt-0.5 text-xs text-white/50">{guestName}</p>
          </div>
          <button onClick={onClose} className="shrink-0 rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white" aria-label="Zapri">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-2 rounded-xl border border-white/5 bg-white/[0.02] p-4">
            <div className="min-w-0">
              <p className="text-xs text-white/40">Skupaj</p>
              <p className="text-sm font-light tabular-nums text-[#c59b5b]">{fmtEur(totalOwedEur)}</p>
            </div>
            <div className="min-w-0">
              <p className="text-xs text-white/40">Placano</p>
              <p className="text-sm font-light tabular-nums text-[#8fae92]">{fmtEur(paid)}</p>
            </div>
            <div className="min-w-0">
              <p className="text-xs text-white/40">Preostanek</p>
              <p className={`text-sm font-light tabular-nums ${remaining <= 0.005 ? 'text-[#8fae92]' : 'text-[#d7a593]'}`}>{fmtEur(remaining)}</p>
            </div>
          </div>

          {/* Existing payments */}
          {loading ? (
            <p className="py-4 text-center text-sm text-white/40">Nalagam placila...</p>
          ) : rows.length === 0 ? (
            <p className="py-4 text-center text-sm text-white/40">Se ni zabelezenih placil.</p>
          ) : (
            <div className="space-y-2">
              {rows.map(p => (
                <div key={p.id} className="group flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <div>
                      <p className="text-sm font-medium text-[#8fae92]">{Number(p.amount).toFixed(2)} EUR</p>
                      <p className="text-xs text-white/40">{p.paidAt}</p>
                    </div>
                    <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-white/70">{methodLabel(p.method)}</span>
                    {p.omAmountAr ? <span className="text-xs text-[#c59b5b]">{fmtAr(p.omAmountAr)} na OM</span> : null}
                    {p.cashCompany ? <span className="text-xs text-[#c59b5b]">v blagajno ({p.cashCompany === 'sarl' ? 'SARL' : 'Tourism'})</span> : null}
                    {p.notes ? <span className="text-xs text-white/50">{p.notes}</span> : null}
                  </div>
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="shrink-0 rounded-lg p-1.5 text-white/30 hover:bg-[#b0203a]/20 hover:text-[#e0687c] transition-colors"
                    aria-label="Izbrisi placilo"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add form */}
          {showAdd ? (
            <div className="space-y-3 rounded-xl border border-[#c59b5b]/30 bg-[#c59b5b]/5 p-4">
              <p className="text-xs font-medium text-[#c59b5b]">Novo placilo</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Znesek (EUR)</label>
                  <input type="number" step="0.01" autoFocus className={inputCls} value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Nacin placila</label>
                  <select className={inputCls} value={form.method} onChange={e => setForm(f => ({ ...f, method: e.target.value }))}>
                    {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Datum placila</label>
                  <input type="date" className={`${inputCls} [color-scheme:dark]`} value={form.paidAt} onChange={e => setForm(f => ({ ...f, paidAt: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Opomba</label>
                  <input type="text" className={inputCls} placeholder="npr. depozit..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
                {form.method === 'orange_money' && (
                  <div className="col-span-2">
                    <label className="mb-1 block text-xs text-[#c59b5b]">Znesek na Orange Money (Ar)</label>
                    <input type="number" step="1" min="0" className={`${inputCls} border-[#c59b5b]/30 bg-[#c59b5b]/5`} placeholder="npr. 824640" value={form.omAmountAr} onChange={e => setForm(f => ({ ...f, omAmountAr: e.target.value }))} />
                    <p className="mt-1 text-[10px] text-white/40">Pristeje se v denarnico Orange Money (priliv).</p>
                  </div>
                )}
                {form.method === 'cash' && (
                  <div className="col-span-2 space-y-2 rounded-lg border border-[#c59b5b]/20 bg-[#c59b5b]/[0.04] p-3">
                    <label className="flex items-center gap-2 text-xs text-white/70">
                      <input type="checkbox" checked={form.writeToRegister} className="h-4 w-4 accent-[#c59b5b]" onChange={e => setForm(f => ({ ...f, writeToRegister: e.target.checked }))} />
                      Vpisi v blagajno (gotovina).
                    </label>
                    {form.writeToRegister && (
                      <div>
                        <label className={labelCls}>Podjetje</label>
                        <select className={inputCls} value={form.cashCompany} onChange={e => setForm(f => ({ ...f, cashCompany: e.target.value }))}>
                          <option value="tourism">KOMBA CABANA TOURISM</option>
                          <option value="sarl">KOMBA CABANA SARL</option>
                        </select>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAdd}
                  disabled={saving || !form.amount}
                  className="rounded-xl bg-[#c59b5b] px-4 py-2 text-sm font-semibold text-[#0a2029] hover:bg-[#c59b5b]/90 disabled:opacity-50"
                >
                  {saving ? 'Shranjujem...' : 'Shrani placilo'}
                </button>
                <button onClick={() => setShowAdd(false)} className="rounded-xl border border-white/15 px-4 py-2 text-sm text-white/70 hover:bg-white/5">
                  Preklici
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAdd(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-medium text-white/70 hover:bg-white/10"
            >
              <Plus className="h-4 w-4" />
              Dodaj placilo
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-white/10 px-5 py-4">
          <button onClick={onClose} className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-white/70 hover:bg-white/5">
            Zapri
          </button>
        </div>
      </div>
    </div>
  )
}
