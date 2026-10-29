'use client'

import React from 'react'
import { createPortal } from 'react-dom'
import { Mail, X } from 'lucide-react'
import type { CashReceiptLang } from '@/lib/cash-receipt'

const LANGS: { id: CashReceiptLang; short: string; label: string }[] = [
  { id: 'sl', short: 'SL', label: 'Slovenščina' },
  { id: 'en', short: 'EN', label: 'English' },
  { id: 'fr', short: 'FR', label: 'Français' },
]

export function CashReceiptSend({
  reservationId,
  paymentId,
}: {
  reservationId: string
  paymentId: string
}) {
  const [lang, setLang] = React.useState<CashReceiptLang>('sl')
  const [open, setOpen] = React.useState(false)
  const [html, setHtml] = React.useState('')
  const [to, setTo] = React.useState('')
  const [error, setError] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [sending, setSending] = React.useState(false)
  const [sentTo, setSentTo] = React.useState('')

  async function loadPreview(next: CashReceiptLang) {
    setLoading(true)
    setError('')
    setOpen(true)
    try {
      const { getCashReceiptEmailPreview } = await import('@/app/actions/cash-receipt-email')
      const result = await getCashReceiptEmailPreview(reservationId, paymentId, next)
      if (!result.html) {
        setHtml('')
        setTo('')
        setError(result.error || 'Predogled ni na voljo.')
        return
      }
      setHtml(result.html)
      setTo(result.to || '')
      if (!result.to) setError('Gost nima vpisanega email naslova.')
    } catch {
      setHtml('')
      setError('Predogled ni na voljo.')
    } finally {
      setLoading(false)
    }
  }

  function choose(next: CashReceiptLang) {
    setLang(next)
    if (open) void loadPreview(next)
  }

  async function send() {
    if (!to || sending) return
    setSending(true)
    setError('')
    try {
      const { sendCashReceiptEmail } = await import('@/app/actions/cash-receipt-email')
      const result = await sendCashReceiptEmail(reservationId, paymentId, lang)
      if (result.success) {
        setSentTo(to)
        setOpen(false)
      } else {
        setError(result.error || 'Pošiljanje ni uspelo.')
      }
    } catch {
      setError('Napaka pri pošiljanju. Poskusite znova.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap items-center justify-end gap-1">
        <div className="flex gap-0.5 rounded-lg bg-white/5 p-0.5" role="group" aria-label="Jezik potrdila">
          {LANGS.map((item) => (
            <button
              key={item.id}
              type="button"
              title={item.label}
              aria-label={item.label}
              aria-pressed={lang === item.id}
              onClick={() => choose(item.id)}
              className={`rounded-md px-2 py-0.5 text-[10px] font-medium ${lang === item.id ? 'bg-[#c59b5b]/20 text-[#c59b5b]' : 'text-white/40 hover:text-white/70'}`}
            >
              {item.short}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void loadPreview(lang)}
          className="rounded-lg border border-[#c59b5b]/40 px-2.5 py-1 text-[11px] font-medium text-[#c59b5b] hover:bg-[#c59b5b]/10"
        >
          Potrdilo
        </button>
      </div>
      {sentTo ? <p className="text-[10px] text-[#8fae92]">Poslano na {sentTo}</p> : null}

      {open && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4"
          onClick={() => { if (!sending) setOpen(false) }}
        >
          <div
            className="flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#101d22] shadow-2xl"
            style={{ maxHeight: '90vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
              <div>
                <h3 className="text-sm font-semibold text-white">Potrdilo o plačilu z gotovino</h3>
                <p className="mt-0.5 text-xs text-white/50">
                  Prejemnik: <span className="text-white/80">{to || 'ni emaila'}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => { if (!sending) setOpen(false) }}
                disabled={sending}
                className="rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white disabled:opacity-50"
                aria-label="Zapri predogled"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex items-center gap-1 border-b border-white/10 px-5 py-3">
              {LANGS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={lang === item.id}
                  disabled={loading || sending}
                  onClick={() => choose(item.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium ${lang === item.id ? 'bg-[#c59b5b]/20 text-[#c59b5b]' : 'text-white/50 hover:text-white/80'}`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-hidden bg-[#071c24]">
              {loading ? (
                <p className="px-5 py-8 text-sm text-white/50">Pripravljam predogled…</p>
              ) : html ? (
                <iframe
                  title="Predogled potrdila"
                  srcDoc={html}
                  className="h-full w-full border-0"
                  style={{ minHeight: '50vh', backgroundColor: '#071c24' }}
                />
              ) : (
                <p className="px-5 py-8 text-sm text-[#d7a593]">{error}</p>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-white/10 px-5 py-4">
              {error && html ? <p className="mr-auto text-xs text-[#d7a593]">{error}</p> : null}
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={sending}
                className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-white/70 hover:bg-white/5 disabled:opacity-50"
              >
                Prekliči
              </button>
              <button
                type="button"
                onClick={() => void send()}
                disabled={sending || loading || !html || !to}
                className="flex items-center gap-2 rounded-xl bg-[#c59b5b] px-5 py-2.5 text-sm font-semibold text-[#0a2029] hover:bg-[#c59b5b]/90 disabled:opacity-50"
              >
                <Mail className="h-4 w-4" />
                {sending ? 'Pošiljam...' : 'Pošlji gostu'}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
