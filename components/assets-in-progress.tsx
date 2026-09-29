'use client'

import React, { useState } from 'react'
import useSWR, { useSWRConfig } from 'swr'
import { Hammer, Plus, Trash2, Pencil, Check, X, Printer, Power, FileText, Receipt } from 'lucide-react'
import {
  getAssetsInProgress,
  createAssetInProgress,
  updateAssetContract,
  addAssetCost,
  deleteAssetCost,
  activateAsset,
  deleteFixedAsset,
  type AssetInProgress,
} from '@/app/actions/statistics'

export const ASSETS_IN_PROGRESS_KEY = 'assets-in-progress'

const COST_PRESETS = ['Razžaganje lesa', 'Izdelava desk', 'Montaža']

function formatAr(n: number) {
  return `${new Intl.NumberFormat('sl-SI').format(Math.round(n || 0))} Ar`
}
function formatDate(d: string | null) {
  if (!d) return '-'
  return new Intl.DateTimeFormat('sl-SI', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(d))
}
function todayIso() {
  return new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10)
}

export type ContractDraft = {
  name: string
  contractor: string
  contractScope: string
  contractPrice: string
  contractDeadline: string
  contractDate: string
  annualRatePct: string
}

export function emptyContractDraft(): ContractDraft {
  return {
    name: '',
    contractor: '',
    contractScope: '',
    contractPrice: '',
    contractDeadline: '',
    contractDate: todayIso(),
    annualRatePct: '33.33',
  }
}

export function contractDraftToFields(d: ContractDraft) {
  return {
    name: d.name,
    contractor: d.contractor,
    contractScope: d.contractScope,
    contractPrice: Number(d.contractPrice.replace(/[^\d]/g, '')) || 0,
    contractDeadline: d.contractDeadline,
    contractDate: d.contractDate,
    annualRatePct: Number(d.annualRatePct.replace(',', '.')) || 33.33,
  }
}

const inputCls =
  'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#c59b5b]/40 focus:outline-none [color-scheme:dark]'
const labelCls = 'mb-1 block text-[10px] font-medium uppercase tracking-wider text-white/40'

export function ContractForm({ draft, onChange }: { draft: ContractDraft; onChange: (d: ContractDraft) => void }) {
  const set = (k: keyof ContractDraft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    onChange({ ...draft, [k]: e.target.value })
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className={labelCls}>Naziv sredstva</label>
        <input value={draft.name} onChange={set('name')} placeholder="npr. Lesena tla okoli bungalovov" className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Izvajalec (mizar)</label>
        <input value={draft.contractor} onChange={set('contractor')} placeholder="Ime in priimek / podjetje" className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Datum pogodbe</label>
        <input type="date" value={draft.contractDate} onChange={set('contractDate')} className={inputCls} />
      </div>
      <div className="sm:col-span-2">
        <label className={labelCls}>Predmet pogodbe — kaj bo izvajalec naredil</label>
        <textarea
          value={draft.contractScope}
          onChange={set('contractScope')}
          rows={3}
          placeholder="npr. Razžaganje kupljenih hlodov, izdelava desk in montaža lesenih tal okoli bungalovov."
          className={inputCls}
        />
      </div>
      <div>
        <label className={labelCls}>Dogovorjena cena dela (Ar)</label>
        <input inputMode="numeric" value={draft.contractPrice} onChange={set('contractPrice')} placeholder="npr. 2000000" className={`${inputCls} text-right`} />
      </div>
      <div>
        <label className={labelCls}>Rok izvedbe</label>
        <input type="date" value={draft.contractDeadline} onChange={set('contractDeadline')} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Amortizacija po aktivaciji (letno %)</label>
        <input inputMode="decimal" value={draft.annualRatePct} onChange={set('annualRatePct')} className={`${inputCls} text-right`} />
      </div>
    </div>
  )
}

function printContract(a: AssetInProgress) {
  const w = window.open('', '_blank')
  if (!w) return
  const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] as string)
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Pogodba — ${esc(a.name)}</title>
  <style>body{font-family:Georgia,serif;max-width:720px;margin:40px auto;color:#111;line-height:1.5}
  h1{font-size:20px;text-align:center;margin-bottom:4px}p.sub{text-align:center;color:#555;margin-top:0}
  h2{font-size:14px;text-transform:uppercase;letter-spacing:.05em;margin-top:24px}
  table{width:100%;border-collapse:collapse;font-size:13px}td,th{border-bottom:1px solid #ddd;padding:6px 4px;text-align:left}
  .r{text-align:right}.sig{display:flex;justify-content:space-between;margin-top:64px}.sig div{width:40%;border-top:1px solid #111;padding-top:6px;font-size:13px}</style>
  </head><body>
  <h1>POGODBA O IZDELAVI</h1><p class="sub">${esc(a.name)}</p>
  <h2>Pogodbeni stranki</h2>
  <p><strong>Naročnik:</strong> Komba Cabana Tourism Sarl, Nosy Be<br/><strong>Izvajalec:</strong> ${esc(a.contractor || '________________')}</p>
  <h2>Predmet pogodbe</h2><p>${esc(a.contractScope || '________________').replace(/\n/g, '<br/>')}</p>
  <h2>Cena in rok</h2>
  <p>Dogovorjena cena dela: <strong>${a.contractPrice > 0 ? formatAr(a.contractPrice) : '________________'}</strong><br/>
  Rok izvedbe: <strong>${a.contractDeadline ? formatDate(a.contractDeadline) : '________________'}</strong></p>
  ${a.costs.length ? `<h2>Material in dosedanji stroški</h2><table><tr><th>Datum</th><th>Opis</th><th class="r">Znesek</th></tr>
  ${a.costs.map((c) => `<tr><td>${formatDate(c.date)}</td><td>${esc(c.description)}</td><td class="r">${formatAr(c.amountAr)}</td></tr>`).join('')}
  <tr><th colspan="2">Skupaj</th><th class="r">${formatAr(a.totalAr)}</th></tr></table>` : ''}
  <p style="margin-top:24px">Kraj in datum: Nosy Be, ${formatDate(a.contractDate || todayIso())}</p>
  <div class="sig"><div>Naročnik<br/>Borut Retelj</div><div>Izvajalec<br/>${esc(a.contractor || '')}</div></div>
  <script>window.onload=()=>window.print()</script></body></html>`)
  w.document.close()
}

function AssetCard({ a, onChanged }: { a: AssetInProgress; onChanged: () => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<ContractDraft>(emptyContractDraft())
  const [costDesc, setCostDesc] = useState('')
  const [costDate, setCostDate] = useState(todayIso())
  const [costAr, setCostAr] = useState('')
  const [costCash, setCostCash] = useState(false)
  const [activating, setActivating] = useState(false)
  const [actDate, setActDate] = useState(todayIso())
  const [actRate, setActRate] = useState(String(a.annualRatePct || 33.33))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const costArNum = Number(costAr.replace(/[^\d]/g, '')) || 0

  function startEdit() {
    setDraft({
      name: a.name,
      contractor: a.contractor,
      contractScope: a.contractScope,
      contractPrice: a.contractPrice ? String(Math.round(a.contractPrice)) : '',
      contractDeadline: a.contractDeadline,
      contractDate: a.contractDate,
      annualRatePct: String(a.annualRatePct || 33.33),
    })
    setEditing(true)
  }

  async function run(fn: () => Promise<unknown>) {
    setBusy(true)
    setErr(null)
    try {
      await fn()
      onChanged()
      return true
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Shranjevanje ni uspelo.')
      return false
    } finally {
      setBusy(false)
    }
  }

  async function handleAddCost() {
    if (!costDesc.trim() || costArNum <= 0) return
    if (costCash && !confirm(`Odštejem ${formatAr(costArNum)} iz gotovinske blagajne Tourism?`)) return
    const ok = await run(() =>
      addAssetCost({ assetId: a.id, date: costDate, description: costDesc, amountAr: costArNum, payFromCash: costCash })
    )
    if (ok) {
      setCostDesc('')
      setCostAr('')
      setCostCash(false)
    }
  }

  const rateNum = Number(actRate.replace(',', '.')) || 0
  const lifeMonths = rateNum > 0 ? Math.round(1200 / rateNum) : 0

  return (
    <div className="rounded-2xl border border-[#c59b5b]/30 bg-[#c59b5b]/[0.04] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[#c59b5b]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#d8b877]">V izdelavi</span>
            <h4 className="text-base font-semibold text-white/90">{a.name}</h4>
          </div>
          <p className="mt-1 text-xs text-white/45">
            Začeto {formatDate(a.startDate)} · se še ne amortizira · po aktivaciji {new Intl.NumberFormat('sl-SI').format(a.annualRatePct)} % letno
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => printContract(a)} className="flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1.5 text-xs text-white/60 hover:bg-white/10" aria-label="Natisni pogodbo">
            <Printer className="h-3.5 w-3.5" /> Pogodba
          </button>
          <button onClick={startEdit} className="rounded-lg bg-white/5 p-2 text-white/50 hover:bg-[#c59b5b]/20 hover:text-[#c59b5b]" aria-label="Uredi pogodbo">
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              if (confirm('Izbrisati sredstvo v izdelavi s pogodbo in vsemi stroški? Gotovinski odlivi se razveljavijo, računi ostanejo v arhivu.'))
                run(() => deleteFixedAsset(a.id))
            }}
            className="rounded-lg bg-white/5 p-2 text-white/50 hover:bg-red-500/20 hover:text-red-400"
            aria-label="Izbriši"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Pogodba */}
      <div className="mt-4 rounded-xl border border-white/10 bg-black/10 p-4">
        <div className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-white/40">
          <FileText className="h-3.5 w-3.5" /> Pogodba z izvajalcem
        </div>
        {editing ? (
          <div className="space-y-3">
            <ContractForm draft={draft} onChange={setDraft} />
            <div className="flex gap-2">
              <button
                disabled={busy || !draft.name.trim()}
                onClick={async () => {
                  if (await run(() => updateAssetContract(a.id, contractDraftToFields(draft)))) setEditing(false)
                }}
                className="flex items-center gap-1.5 rounded-lg bg-[#c59b5b] px-3 py-1.5 text-sm font-medium text-[#1a1410] hover:bg-[#d4aa6a] disabled:opacity-50"
              >
                <Check className="h-4 w-4" /> Shrani
              </button>
              <button onClick={() => setEditing(false)} className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-white/50 hover:bg-white/10">
                Prekliči
              </button>
            </div>
          </div>
        ) : (
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-[10px] uppercase tracking-wider text-white/35">Izvajalec</dt>
              <dd className="text-white/80">{a.contractor || '—'}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wider text-white/35">Dogovorjena cena dela</dt>
              <dd className="text-white/80">{a.contractPrice > 0 ? formatAr(a.contractPrice) : '—'}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wider text-white/35">Rok izvedbe</dt>
              <dd className="text-white/80">{a.contractDeadline ? formatDate(a.contractDeadline) : '—'}</dd>
            </div>
            <div className="sm:col-span-3">
              <dt className="text-[10px] uppercase tracking-wider text-white/35">Predmet</dt>
              <dd className="whitespace-pre-line text-white/70">{a.contractScope || '—'}</dd>
            </div>
          </dl>
        )}
      </div>

      {/* Stroški */}
      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between text-[11px] font-medium uppercase tracking-wider text-white/40">
          <span>Stroški izdelave</span>
          <span className="text-sm normal-case tracking-normal text-white/80">
            Skupaj <strong className="text-[#c59b5b]">{formatAr(a.totalAr)}</strong>
          </span>
        </div>
        {a.costs.length === 0 ? (
          <p className="text-xs text-white/40">Še ni stroškov. Dodaj račun iz Stroški arhiva ali vpiši strošek spodaj.</p>
        ) : (
          <ul className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.06]">
            {a.costs.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="w-24 shrink-0 text-white/50">{formatDate(c.date)}</span>
                <span className="min-w-0 flex-1 truncate text-white/80">{c.description}</span>
                {c.receiptId ? (
                  <span className="flex items-center gap-1 text-[10px] text-[#7fa8b8]"><Receipt className="h-3 w-3" /> račun</span>
                ) : c.cashExpenseId ? (
                  <span className="text-[10px] text-[#8fae92]">gotovina Tourism</span>
                ) : null}
                <span className="w-32 text-right tabular-nums text-white/80">{formatAr(c.amountAr)}</span>
                <button
                  onClick={() => {
                    if (confirm(c.cashExpenseId ? 'Odstraniti strošek? Gotovinski odliv se razveljavi.' : 'Odstraniti strošek iz sredstva?'))
                      run(() => deleteAssetCost(c.id))
                  }}
                  className="rounded p-1 text-white/30 hover:text-red-400"
                  aria-label="Odstrani strošek"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3 rounded-xl border border-dashed border-white/10 p-3">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {COST_PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => setCostDesc(p)}
                className={`rounded-full px-2.5 py-1 text-xs transition-colors ${costDesc === p ? 'bg-[#c59b5b] text-[#1a1410]' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}
              >
                {p}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[180px] flex-1">
              <label className={labelCls}>Opis stroška</label>
              <input value={costDesc} onChange={(e) => setCostDesc(e.target.value)} placeholder="npr. Razžaganje lesa" className={inputCls} />
            </div>
            <div className="w-36">
              <label className={labelCls}>Datum</label>
              <input type="date" value={costDate} onChange={(e) => setCostDate(e.target.value)} className={inputCls} />
            </div>
            <div className="w-36">
              <label className={labelCls}>Znesek (Ar)</label>
              <input inputMode="numeric" value={costAr} onChange={(e) => setCostAr(e.target.value)} className={`${inputCls} text-right`} />
            </div>
            <button
              onClick={handleAddCost}
              disabled={busy || !costDesc.trim() || costArNum <= 0}
              className="flex items-center gap-1.5 rounded-lg bg-[#c59b5b] px-3 py-2 text-sm font-medium text-[#1a1410] hover:bg-[#d4aa6a] disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> Dodaj strošek
            </button>
          </div>
          <label className="mt-2 flex items-center gap-2 text-xs text-white/55">
            <input type="checkbox" checked={costCash} onChange={(e) => setCostCash(e.target.checked)} className="accent-[#8fae92]" />
            Plačano z gotovino — odštej iz blagajne Tourism
          </label>
        </div>
      </div>

      {/* Aktivacija */}
      <div className="mt-4 border-t border-white/10 pt-4">
        {activating ? (
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-40">
              <label className={labelCls}>Datum aktivacije (zmontirano)</label>
              <input type="date" value={actDate} onChange={(e) => setActDate(e.target.value)} className={inputCls} />
            </div>
            <div className="w-32">
              <label className={labelCls}>Stopnja (letno %)</label>
              <input inputMode="decimal" value={actRate} onChange={(e) => setActRate(e.target.value)} className={`${inputCls} text-right`} />
            </div>
            <p className="pb-2 text-xs text-white/50">
              Nabavna vrednost {formatAr(a.totalAr)}{lifeMonths > 0 ? ` · doba ${lifeMonths} mes.` : ''}
            </p>
            <button
              disabled={busy || a.totalAr <= 0 || rateNum <= 0}
              onClick={() => {
                if (confirm(`Aktiviram "${a.name}" z nabavno vrednostjo ${formatAr(a.totalAr)}? Amortizacija začne teči od ${formatDate(actDate)}.`))
                  run(() => activateAsset(a.id, actDate, rateNum))
              }}
              className="flex items-center gap-1.5 rounded-lg bg-[#8fae92] px-3 py-2 text-sm font-medium text-[#10201a] hover:bg-[#a0bea3] disabled:opacity-50"
            >
              <Check className="h-4 w-4" /> Potrdi aktivacijo
            </button>
            <button onClick={() => setActivating(false)} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-white/50 hover:bg-white/10">
              Prekliči
            </button>
          </div>
        ) : (
          <button
            onClick={() => setActivating(true)}
            disabled={a.totalAr <= 0}
            className="flex items-center gap-2 rounded-lg border border-[#8fae92]/40 bg-[#8fae92]/10 px-3 py-2 text-sm font-medium text-[#8fae92] hover:bg-[#8fae92]/20 disabled:opacity-40"
          >
            <Power className="h-4 w-4" /> Aktiviraj (zmontirano) — začni amortizacijo
          </button>
        )}
      </div>

      {err && <p className="mt-3 text-xs text-red-400">{err}</p>}
    </div>
  )
}

// Pri računu (Stroški arhiv): dodaj račun k obstoječemu sredstvu v izdelavi ali odpri novo pogodbo.
export function ReceiptToAssetPanel({
  receipt,
  onDone,
  onCancel,
}: {
  receipt: { id: string; date: string; description: string; amountAr: number }
  onDone: (assetName: string) => void
  onCancel: () => void
}) {
  const { mutate } = useSWRConfig()
  const { data: list = [] } = useSWR(ASSETS_IN_PROGRESS_KEY, getAssetsInProgress)
  const [target, setTarget] = useState<string>('')
  const [draft, setDraft] = useState<ContractDraft>(() => ({ ...emptyContractDraft(), contractDate: receipt.date || todayIso() }))
  const [costDesc, setCostDesc] = useState(receipt.description || 'Material')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const mode = target || (list.length > 0 ? list[0].id : 'new')

  async function handleSave() {
    if (!(receipt.amountAr > 0)) {
      setErr('Račun nima zneska — najprej prepoznaj ali vpiši znesek.')
      return
    }
    setSaving(true)
    setErr(null)
    try {
      const cost = { date: receipt.date, description: costDesc.trim() || 'Material', amountAr: receipt.amountAr, receiptId: receipt.id }
      let name: string
      if (mode === 'new') {
        if (!draft.name.trim()) {
          setErr('Vpiši naziv sredstva.')
          setSaving(false)
          return
        }
        await createAssetInProgress({ ...contractDraftToFields(draft), startDate: receipt.date || todayIso(), firstCost: cost })
        name = draft.name.trim()
      } else {
        await addAssetCost({ assetId: mode, ...cost })
        name = list.find((a) => a.id === mode)?.name || 'sredstvo v izdelavi'
      }
      mutate(ASSETS_IN_PROGRESS_KEY)
      onDone(name)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Shranjevanje ni uspelo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-[#c59b5b]/30 bg-[#c59b5b]/[0.06] p-3">
      <p className="text-[12px] text-white/50">
        Račun gre v nabavno vrednost sredstva, ki se še izdeluje (npr. les za tla). Ni tekoči strošek in se ne amortizira, dokler sredstva ne aktiviraš.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1">
          <label className={labelCls}>Sredstvo / pogodba</label>
          <select value={mode} onChange={(e) => setTarget(e.target.value)} className={inputCls}>
            {list.map((a) => (
              <option key={a.id} value={a.id} className="bg-[#1a1410]">
                {a.name}{a.contractor ? ` — ${a.contractor}` : ''} ({formatAr(a.totalAr)})
              </option>
            ))}
            <option value="new" className="bg-[#1a1410]">+ Odpri novo pogodbo</option>
          </select>
        </div>
        <div className="min-w-[180px] flex-1">
          <label className={labelCls}>Opis stroška</label>
          <input value={costDesc} onChange={(e) => setCostDesc(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Znesek</label>
          <span className="block py-2 text-sm font-semibold tabular-nums text-white/80">{formatAr(receipt.amountAr)}</span>
        </div>
      </div>
      {mode === 'new' && <ContractForm draft={draft} onChange={setDraft} />}
      {err && <p className="text-xs text-red-400">{err}</p>}
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-lg bg-[#c59b5b] px-3 py-1.5 text-sm font-medium text-black hover:bg-[#d3ad6f] disabled:opacity-60"
        >
          <Check className="h-4 w-4" /> {mode === 'new' ? 'Odpri pogodbo in dodaj račun' : 'Dodaj račun k sredstvu'}
        </button>
        <button onClick={onCancel} className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-white/50 hover:bg-white/10">
          Prekliči
        </button>
      </div>
    </div>
  )
}

export default function AssetsInProgress({ onActivated }: { onActivated?: () => void }) {
  const { mutate } = useSWRConfig()
  const { data: list = [] } = useSWR(ASSETS_IN_PROGRESS_KEY, getAssetsInProgress)
  const [showNew, setShowNew] = useState(false)
  const [draft, setDraft] = useState<ContractDraft>(emptyContractDraft())
  const [saving, setSaving] = useState(false)

  const refresh = () => {
    mutate(ASSETS_IN_PROGRESS_KEY)
    onActivated?.()
  }

  async function handleCreate() {
    if (!draft.name.trim()) return
    setSaving(true)
    try {
      await createAssetInProgress({ ...contractDraftToFields(draft), startDate: draft.contractDate || todayIso() })
      setDraft(emptyContractDraft())
      setShowNew(false)
      refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-white/50">
            <Hammer className="h-3.5 w-3.5 text-[#c59b5b]" /> Sredstva v izdelavi
          </h4>
          <p className="mt-0.5 text-xs text-white/40">
            Pogodba z izvajalcem + vsi stroški (material, razžaganje, izdelava, montaža). Amortizacija začne teči šele ob aktivaciji.
          </p>
        </div>
        <button
          onClick={() => setShowNew((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg border border-[#c59b5b]/40 px-3 py-1.5 text-sm text-[#c59b5b] hover:bg-[#c59b5b]/10"
        >
          <Plus className="h-4 w-4" /> Nova pogodba
        </button>
      </div>

      {showNew && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <ContractForm draft={draft} onChange={setDraft} />
          <div className="mt-3 flex gap-2">
            <button
              onClick={handleCreate}
              disabled={saving || !draft.name.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-[#c59b5b] px-3 py-1.5 text-sm font-medium text-[#1a1410] hover:bg-[#d4aa6a] disabled:opacity-50"
            >
              <Check className="h-4 w-4" /> Odpri pogodbo
            </button>
            <button onClick={() => setShowNew(false)} className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-white/50 hover:bg-white/10">
              Prekliči
            </button>
          </div>
        </div>
      )}

      {list.length === 0 && !showNew ? (
        <p className="rounded-xl border border-dashed border-white/10 px-4 py-4 text-center text-xs text-white/40">
          Ni sredstev v izdelavi. Pogodbo lahko odpreš tukaj ali neposredno pri računu v Stroški arhivu.
        </p>
      ) : (
        list.map((a) => <AssetCard key={a.id} a={a} onChanged={refresh} />)
      )}
    </div>
  )
}
