'use client'

import React, { useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { ArrowLeft, ChevronLeft, ChevronRight, Search, Calendar, Users, Home, FileText, Printer, Landmark, Mail, X, Wallet, User } from 'lucide-react'
import { getArchivedReservations } from '@/app/actions/komba'
import { getFeedbackEmailPreview, sendFeedbackEmail } from '@/app/actions/feedback-email'
import { PoliceFormModal, type PoliceFormReservation } from '@/components/police-form-modal'
import ArchivePaymentEditor from '@/components/archive-payment-editor'
import { bungalowDisplayName } from '@/lib/bungalow'
import { countryFlag } from '@/lib/country-flag'

const fetcher = async (page: number) => {
  return await getArchivedReservations(page, 20)
}

export default function ArhivPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [policeReservation, setPoliceReservation] = useState<PoliceFormReservation | null>(null)
  const [payReservation, setPayReservation] = useState<{ id: string; guestName: string; totalOwedEur: number } | null>(null)
  const [feedbackPreview, setFeedbackPreview] = useState<{ html: string; to: string; reservationId: string } | null>(null)
  const [loadingFeedbackFor, setLoadingFeedbackFor] = useState<string | null>(null)
  const [emailingFeedback, setEmailingFeedback] = useState(false)
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null)

  const openFeedbackPreview = async (reservationId: string, email: string) => {
    setLoadingFeedbackFor(reservationId)
    setFeedbackMsg(null)
    try {
      const result = await getFeedbackEmailPreview(reservationId, (email || '').trim())
      if (result.html) {
        setFeedbackPreview({ html: result.html, to: result.to || '', reservationId })
      } else {
        setFeedbackMsg(result.error || 'Predogleda ni bilo mogoce pripraviti.')
      }
    } catch {
      setFeedbackMsg('Napaka pri pripravi predogleda. Poskusite znova.')
    } finally {
      setLoadingFeedbackFor(null)
    }
  }
  
  const { data, isLoading, error, mutate } = useSWR(['archived', page], () => fetcher(page), {
    revalidateOnFocus: false
  })
  
  const formatDate = (dateStr: string) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    return d.toLocaleDateString('sl-SI', { day: 'numeric', month: 'short', year: 'numeric' })
  }
  
  const formatAr = (ar: number) => {
    return new Intl.NumberFormat('sl-SI').format(ar).replace(/,/g, '.') + ' Ar'
  }
  
  const formatEur = (ar: number, rate: number) => {
    const eur = ar / rate
    return eur.toFixed(2) + ' EUR'
  }
  
  // Filter reservations by search
  const filteredReservations = data?.reservations?.filter(res => {
    if (!search) return true
    const searchLower = search.toLowerCase()
    return (
      res.guestName?.toLowerCase().includes(searchLower) ||
      res.bungalow?.toLowerCase().includes(searchLower) ||
      res.email?.toLowerCase().includes(searchLower)
    )
  }) || []
  
  return (
    <div className="min-h-screen bg-[#0a2029] text-white">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#0a2029]/95 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="p-2 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 hover:text-white">
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div>
                <h1 className="text-xl font-bold text-[#c59b5b]">Arhiv</h1>
                <p className="text-white/40 text-sm">Pretekle rezervacije</p>
              </div>
            </div>
            {data?.pagination && (
              <p className="text-white/40 text-sm">
                {data.pagination.total} rezervacij
              </p>
            )}
          </div>
          
          {/* Search */}
          <div className="mt-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
            <input
              type="text"
              placeholder="Išči po imenu, bungalovu, emailu..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-[#7fa8b8]/50"
            />
          </div>
        </div>
      </header>
      
      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {isLoading ? (
          <div className="text-center py-12 text-white/40">Nalagam...</div>
        ) : error ? (
          <div className="text-center py-12 text-red-400">Napaka pri nalaganju</div>
        ) : filteredReservations.length === 0 ? (
          <div className="text-center py-12 text-white/40">
            {search ? 'Ni rezultatov za iskanje' : 'Ni arhiviranih rezervacij'}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredReservations.map((res) => (
              <div
                key={res.id}
                className="p-4 rounded-2xl bg-white/[0.03] border border-white/10"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Home className="h-4 w-4 text-[#c59b5b]" />
                      <span className="text-[#c59b5b] font-medium">{bungalowDisplayName(res.bungalow)}</span>
                    </div>
                    <h3 className="text-white text-lg font-medium mt-1 flex items-center gap-2">
                      {(() => {
                        const cf = countryFlag((res as { nationality?: string | null }).nationality)
                        return cf ? (
                          <span title={cf.name} aria-label={cf.name} className="text-xl leading-none">{cf.flag}</span>
                        ) : null
                      })()}
                      <span>{res.guestName}</span>
                    </h3>
                    <div className="flex items-center gap-4 mt-2 text-white/50 text-sm">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDate(res.arrival)} - {formatDate(res.departure)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {res.pax} oseb
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[#7fa8b8] font-bold">
                      {formatEur(res.grandTotal, data?.exchangeRate || 4800)}
                    </p>
                    <p className="text-white/40 text-xs mt-0.5">
                      {formatAr(res.grandTotal)}
                    </p>
                    <p className="text-white/30 text-xs mt-2">
                      Odjava: {formatDate(res.checkedOutAt || '')}
                    </p>
                  </div>
                </div>
                
                {/* Payment summary */}
                <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-sm">
                  <div className="text-white/50">
                    <span>Storitve: {formatEur(res.servicesTotal, data?.exchangeRate || 4800)}</span>
                    <span className="mx-2">•</span>
                    <span>Bar: {formatEur(res.barTotal, data?.exchangeRate || 4800)}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/?guest=${res.id}`}
                      className="flex items-center gap-1.5 text-[#e0c68a] hover:underline"
                    >
                      <User className="h-3.5 w-3.5" />
                      Kartica gosta
                    </Link>
                    <button
                      onClick={() => setPayReservation({
                        id: res.id,
                        guestName: res.guestName || '',
                        totalOwedEur: (Number(res.totalAmount) || 0) + (res.grandTotal || 0) / (data?.exchangeRate || 4800),
                      })}
                      className="flex items-center gap-1.5 text-[#d7a593] hover:underline"
                    >
                      <Wallet className="h-3.5 w-3.5" />
                      Placila
                    </button>
                    <button
                      onClick={() => setPoliceReservation(res as unknown as PoliceFormReservation)}
                      className="flex items-center gap-1.5 text-[#8fae92] hover:underline"
                    >
                      <Landmark className="h-3.5 w-3.5" />
                      Policija
                    </button>
                    <Link
                      href={`/racun/${res.id}?view=true`}
                      className="flex items-center gap-1.5 text-[#c59b5b] hover:underline"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      Racun
                    </Link>
                    <Link
                      href={`/dobavnice/${res.id}`}
                      className="flex items-center gap-1.5 text-[#7fa8b8] hover:underline"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      Dobavnica
                    </Link>
                    <button
                      onClick={() => openFeedbackPreview(res.id, res.email || '')}
                      disabled={loadingFeedbackFor === res.id}
                      className="flex items-center gap-1.5 text-[#c59b5b] hover:underline disabled:opacity-50"
                    >
                      <Mail className="h-3.5 w-3.5" />
                      {loadingFeedbackFor === res.id ? 'Pripravljam...' : 'Anketa'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Pagination */}
        {data?.pagination && data.pagination.totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 mt-8">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="text-white/60">
              {page} / {data.pagination.totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(data.pagination.totalPages, p + 1))}
              disabled={page === data.pagination.totalPages}
              className="p-2 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        )}
      </main>

      {/* Payment editor for archived reservations */}
      {payReservation && (
        <ArchivePaymentEditor
          reservationId={payReservation.id}
          guestName={payReservation.guestName}
          totalOwedEur={payReservation.totalOwedEur}
          rate={data?.exchangeRate || 4800}
          onClose={() => setPayReservation(null)}
          onSaved={() => mutate()}
        />
      )}

      {/* Police registration form for archived guests */}
      <PoliceFormModal
        reservation={policeReservation ?? ({ guestName: '', arrival: '', departure: '' } as PoliceFormReservation)}
        isOpen={policeReservation !== null}
        onClose={() => setPoliceReservation(null)}
        onSaved={() => mutate()}
      />

      {/* Toast message */}
      {feedbackMsg && (
        <div className="fixed bottom-4 left-1/2 z-[110] -translate-x-1/2 rounded-xl bg-[#143a49] border border-white/15 px-4 py-2.5 text-sm text-white shadow-2xl">
          {feedbackMsg}
        </div>
      )}

      {/* "How did you find us" survey email preview modal */}
      {feedbackPreview && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" onClick={() => setFeedbackPreview(null)}>
          <div
            className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0a2029] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-white">Predogled ankete (kje so nas našli)</h3>
                <label className="mt-2 block text-xs text-white/50">
                  Prejemnik (email):
                  <input
                    type="email"
                    value={feedbackPreview.to}
                    onChange={(e) => setFeedbackPreview((p) => (p ? { ...p, to: e.target.value } : p))}
                    disabled={emailingFeedback}
                    placeholder="vpišite email gosta"
                    className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#c59b5b]/50 focus:outline-none disabled:opacity-50"
                  />
                </label>
              </div>
              <button
                onClick={() => setFeedbackPreview(null)}
                className="shrink-0 rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white transition-colors"
                aria-label="Zapri predogled"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-white">
              <iframe
                title="Survey email preview"
                srcDoc={feedbackPreview.html}
                className="w-full border-0"
                style={{ height: '760px' }}
              />
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-white/10 px-5 py-4">
              <button
                onClick={() => setFeedbackPreview(null)}
                disabled={emailingFeedback}
                className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-white/70 hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                Prekliči
              </button>
              <button
                onClick={async () => {
                  const to = (feedbackPreview.to || '').trim()
                  if (!to || !to.includes('@')) {
                    setFeedbackMsg('Vpišite veljaven email naslov prejemnika.')
                    return
                  }
                  setEmailingFeedback(true)
                  try {
                    const result = await sendFeedbackEmail(feedbackPreview.reservationId, to)
                    if (result.success) {
                      setFeedbackMsg(`Anketa poslana gostu (${to}).`)
                      setFeedbackPreview(null)
                    } else {
                      setFeedbackMsg(result.error || 'Pošiljanje ni uspelo.')
                    }
                  } catch {
                    setFeedbackMsg('Napaka pri pošiljanju emaila. Poskusite znova.')
                  } finally {
                    setEmailingFeedback(false)
                  }
                }}
                disabled={emailingFeedback || !(feedbackPreview.to || '').includes('@')}
                className="flex items-center gap-2 rounded-xl bg-[#c59b5b] px-5 py-2.5 text-sm font-semibold text-[#0a2029] hover:bg-[#c59b5b]/90 transition-colors disabled:opacity-50"
              >
                <Mail className="h-4 w-4" />
                {emailingFeedback ? 'Pošiljam...' : 'Pošlji email'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
