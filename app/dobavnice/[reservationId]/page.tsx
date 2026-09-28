'use client'

import React, { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import useSWR from 'swr'
import Link from 'next/link'
import { ArrowLeft, Plus, ReceiptText, FileText, Utensils, Ship, Compass, Trash2, Home, ChevronDown, Users } from 'lucide-react'
import { getDeliveryNotesForReservation, getOrCreateDeliveryNote, closeDeliveryNote } from '@/app/actions/delivery'
import { getDashboardData, getOrderItems, deleteOrderItem } from '@/app/actions/komba'
import { toEnglishItemName } from '@/lib/item-name'

const fetcher = async (reservationId: string) => {
  const [notes, dashboard, orderItems] = await Promise.all([
    getDeliveryNotesForReservation(reservationId),
    getDashboardData(),
    getOrderItems(reservationId)
  ])
  const reservation = dashboard.reservations.find(r => r.id === reservationId)
  
  // Check if this reservation is part of a group with sharedInvoice enabled
  // We need to check the MAIN reservation's sharedInvoice setting
  let allNotes = notes
  let allOrderItems = orderItems
  let groupReservations: typeof dashboard.reservations = []
  let isSharedInvoice = false
  
  if (reservation?.groupId) {
    // Find the main reservation in the group to check sharedInvoice
    const mainReservation = dashboard.reservations.find(r => r.groupId === reservation.groupId && r.isMainReservation)
    isSharedInvoice = mainReservation?.sharedInvoice || reservation?.sharedInvoice || false
    
    if (isSharedInvoice) {
      // Get all OTHER reservations in the group
      groupReservations = dashboard.reservations.filter(r => r.groupId === reservation.groupId && r.id !== reservationId)
      
      // Fetch delivery notes and order items for all group members
      const groupData = await Promise.all(
        groupReservations.map(async r => {
          const [gNotes, gOrderItems] = await Promise.all([
            getDeliveryNotesForReservation(r.id),
            getOrderItems(r.id)
          ])
          return { reservationId: r.id, bungalow: r.bungalow, notes: gNotes, orderItems: gOrderItems }
        })
      )
      
      // Combine all notes and order items, marking which bungalow they're from
      for (const gd of groupData) {
        const shortBungalow = gd.bungalow?.split(';')[0]?.split('/')[0]?.trim() || gd.bungalow
        allNotes = [...allNotes, ...gd.notes.map(n => ({ ...n, fromBungalow: shortBungalow }))]
        allOrderItems = [...allOrderItems, ...gd.orderItems.map(i => ({ ...i, fromBungalow: shortBungalow }))]
      }
    }
  }
  
  return { 
    notes: allNotes, 
    reservation, 
    orderItems: allOrderItems, 
    exchangeRate: dashboard.exchangeRate || 4800,
    groupReservations,
    isSharedInvoice
  }
}

export default function DobavnicePage() {
  const params = useParams()
  const router = useRouter()
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({})
  const reservationId = params.reservationId as string
  
const { data, error, isLoading, mutate } = useSWR(
  reservationId ? `dobavnice-${reservationId}` : null,
  () => fetcher(reservationId),
  { revalidateOnFocus: true, revalidateOnMount: true, dedupingInterval: 0 }
  )
  
  const [creating, setCreating] = React.useState(false)
  
  async function handleCreateNew() {
    if (!data?.reservation) return
    setCreating(true)
    try {
      await getOrCreateDeliveryNote(
        reservationId,
        data.reservation.bungalow,
        data.reservation.guestName
      )
      mutate()
    } catch (err) {
      console.error('Error creating delivery note:', err)
    }
    setCreating(false)
  }

  async function handleDeleteOrderItem(id: string) {
    if (confirm('Res zelis odstraniti ta artikel?')) {
      await deleteOrderItem(id)
      mutate()
    }
  }
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a2029] flex items-center justify-center">
        <div className="text-white/50">Nalagam...</div>
      </div>
    )
  }
  
  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#0a2029] flex items-center justify-center">
        <div className="text-red-400">Napaka pri nalaganju</div>
      </div>
    )
  }
  
  const { notes, reservation, orderItems, exchangeRate, groupReservations, isSharedInvoice } = data
  
  // Get short bungalow name for current reservation
  const shortBungalow = reservation?.bungalow?.split(';')[0]?.split('/')[0]?.trim() || reservation?.bungalow
  
  // Accommodation stays in its own section (it spans the whole stay).
  const accommodationItems = orderItems.filter(i => i.category === 'Bivanje')
  // Everything else (meals, transfers, excursions, massages, products...) is shown
  // inside the guest's delivery note for the day it actually happened.
  const dayOrderItems = orderItems.filter(i => i.category !== 'Bivanje')
  const itemDay = (i: any) => i.eventDate || (i.createdAt ? new Date(i.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0])
  const noteByDate = new Map(notes.map(n => [n.date, n]))
  // Union of all days that have either a delivery note or a dated order item.
  const allDays = Array.from(new Set<string>([
    ...notes.map(n => n.date),
    ...dayOrderItems.map(itemDay),
  ])).sort()
  
  // Calculate totals
  const orderItemsTotal = orderItems.reduce((sum, i) => sum + Number(i.priceAr || 0), 0)
  const deliveryNotesTotal = notes.reduce((sum, n) => sum + (n.totalAr || 0), 0)
  const grandTotalAr = orderItemsTotal + deliveryNotesTotal
  const grandTotalEur = grandTotalAr / exchangeRate
  
  const formatAr = (ar: number) => ar.toLocaleString('sl-SI')
  const formatEur = (eur: number) => eur.toFixed(2)
  const arToEur = (ar: number) => ar / exchangeRate
  
  return (
    <div className="min-h-screen bg-[#0a2029]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0a2029]/95 backdrop-blur-lg border-b border-white/10 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <Link
            href="/"
            className="p-2 rounded-xl bg-white/5 text-white/70 hover:bg-white/10"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-white">{reservation?.guestName || 'Gost'}</h1>
              {isSharedInvoice && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-purple-500/20 border border-purple-500/30 text-purple-300 text-[10px]">
                  <Users className="h-3 w-3" />
                  Skupna
                </span>
              )}
            </div>
            <p className="text-sm text-white/50">
              {shortBungalow}
              {isSharedInvoice && groupReservations.length > 0 && (
                <span className="text-purple-300/70">
                  {' + '}{groupReservations.map(r => r.bungalow?.split(';')[0]?.split('/')[0]?.trim()).join(', ')}
                </span>
              )}
            </p>
          </div>
          <Link href={`/staff?bungalow=${encodeURIComponent(reservation?.bungalow || '')}`}>
            <button className="p-2 rounded-xl bg-[#8fae92]/20 text-[#8fae92] hover:bg-[#8fae92]/30">
              <Plus className="h-5 w-5" />
            </button>
          </Link>
        </div>
      </div>
      
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Summary Card - EUR as main, Ar below */}
        <div className="rounded-2xl border border-[#c59b5b]/20 bg-[#c59b5b]/5 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-white/40 uppercase tracking-wider">Skupaj za placilo</p>
              <p className="text-2xl font-bold text-[#c59b5b] mt-1">
                {formatEur(arToEur(grandTotalAr))} EUR
              </p>
              <p className="text-sm text-white/50">{formatAr(grandTotalAr)} Ar</p>
            </div>
            <div className="text-right text-xs text-white/40">
              <p>Storitve: {formatEur(arToEur(orderItemsTotal))} EUR</p>
              <p>Bar: {formatEur(arToEur(deliveryNotesTotal))} EUR</p>
            </div>
          </div>
        </div>

        {/* BAR SECTION - Today's items from delivery notes */}
        {(() => {
          const allBarItems = notes.flatMap(note => 
            (note.items || []).map(item => ({
              ...item,
              noteDate: note.date,
              noteStatus: note.status
            }))
          )
          if (allBarItems.length === 0) return null
          return (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
              <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2 bg-[#8fae92]/5">
                <FileText className="h-4 w-4 text-[#8fae92]" />
                <span className="text-sm font-medium text-[#8fae92]">Bar (danes)</span>
                <span className="text-xs text-white/40 ml-auto">{allBarItems.length} postavk</span>
              </div>
              <div className="divide-y divide-white/5">
                {allBarItems.map((item: any) => (
                  <div key={item.id} className="px-4 py-3 flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-sm text-white">{item.quantity}x {toEnglishItemName(item.productName)}</p>
                      <p className="text-[10px] text-white/40 mt-0.5">
                        {new Date(item.noteDate).toLocaleDateString('sl-SI', { day: 'numeric', month: 'short' })}
                        <span className="ml-2 text-white/30">Served by: {item.staffName || 'Bar'}</span>
                        {item.noteStatus === 'open' && <span className="ml-2 text-[#8fae92]">Odprta</span>}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-white">{formatEur(arToEur(item.priceAr * item.quantity))} EUR</p>
                      <p className="text-xs text-white/40">{formatAr(item.priceAr * item.quantity)} Ar</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })()}

        {/* Close Day Button - if there's any open delivery note */}
        {(() => {
          const openNote = notes.find(n => n.status === 'open');
          if (!openNote) return null;
          const noteDate = new Date(openNote.date);
          return (
            <button
              onClick={async () => {
                await closeDeliveryNote(openNote.id);
                mutate();
              }}
              className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-sm font-medium text-white/70 hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
            >
              <FileText className="h-4 w-4" />
              Zaključi dan ({noteDate.toLocaleDateString('sl-SI', { day: 'numeric', month: 'short' })})
            </button>
          );
        })()}

        {/* ACCOMMODATION SECTION */}
        {accommodationItems.length > 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2 bg-[#c59b5b]/5">
              <Home className="h-4 w-4 text-[#c59b5b]" />
              <span className="text-sm font-medium text-[#c59b5b]">Bivanje</span>
            </div>
            <div className="divide-y divide-white/5">
              {accommodationItems.map(item => (
                <div key={item.id} className="px-4 py-3 flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-white">{toEnglishItemName(item.name)}</p>
                      {isSharedInvoice && (item as any).fromBungalow && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300">{(item as any).fromBungalow}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-white/40">
                        {(item.eventDate || item.createdAt) ? new Date(item.eventDate || item.createdAt).toLocaleDateString('sl-SI', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                      </span>
                      <span className="text-[10px] text-white/30">Added by: {(item as any).addedBy || 'Urska'}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${item.paymentStatus === 'PAID' ? 'bg-[#8fae92]/20 text-[#8fae92]' : 'bg-red-500/20 text-red-400'}`}>
                        {item.paymentStatus === 'PAID' ? 'PLACANO' : 'ZA PLACILO'}
                      </span>
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-3">
                    <div>
                      <p className="text-sm font-medium text-white">{formatEur(arToEur(Number(item.priceAr)))} EUR</p>
                      <p className="text-xs text-white/40">{formatAr(Number(item.priceAr))} Ar</p>
                    </div>
                    <button onClick={() => handleDeleteOrderItem(item.id)} className="p-1.5 rounded-lg hover:bg-red-500/20 text-white/30 hover:text-red-400">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* DAILY DELIVERY NOTES (Bar) */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between bg-[#8fae92]/5">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-[#8fae92]" />
              <span className="text-sm font-medium text-[#8fae92]">Dnevne dobavnice (Bar)</span>
            </div>
            <button
              onClick={handleCreateNew}
              disabled={creating}
              className="text-xs px-3 py-1 rounded-lg bg-[#8fae92]/20 text-[#8fae92] hover:bg-[#8fae92]/30 disabled:opacity-50"
            >
              {creating ? '...' : '+ Nova'}
            </button>
          </div>
          
          {allDays.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-sm text-white/40">Ni dnevnih dobavnic</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {allDays.map((day) => {
                const note = noteByDate.get(day)
                const noteDate = new Date(day)
                const isToday = day === new Date().toISOString().split('T')[0]
                const isOpen = note?.status === 'open'
                const expandKey = note?.id || day

                // All order items (meals, transfers, excursions, massages, products...) for this day
                const dayItems = dayOrderItems.filter(i => itemDay(i) === day)
                const dayTransfers = dayItems.filter(i => i.category === 'Transfer')
                const dayExcursions = dayItems.filter(i => i.category === 'Izlet')
                const dayMeals = dayItems.filter(i => i.category === 'Prehrana')
                const dayOther = dayItems.filter(i => !['Transfer', 'Izlet', 'Prehrana'].includes(i.category || ''))
                const barItems = note?.items || []

                // Total for this day = bar (note total) + all order items for the day
                const barTotalAr = note?.totalAr || 0
                const orderTotalAr = dayItems.reduce((sum, i) => sum + Number(i.priceAr || 0), 0)
                const dayTotalAr = barTotalAr + orderTotalAr
                const dayTotalEur = arToEur(dayTotalAr)
                const itemCount = barItems.length + dayItems.length

                const OrderRow = ({ item, icon }: { item: any; icon: React.ReactNode }) => (
                  <div className="flex items-center justify-between py-1.5 text-xs border-t border-white/5 first:border-t-0">
                    <div className="flex items-center gap-2 min-w-0">
                      {icon}
                      <div className="min-w-0">
                        <span className="text-white/60 truncate">{toEnglishItemName(item.name)}</span>
                        <span className="block text-[9px] text-white/30">Added by: {item.addedBy || 'Urska'}</span>
                      </div>
                      {isSharedInvoice && item.fromBungalow && (
                        <span className="text-[9px] px-1 py-0.5 rounded bg-purple-500/20 text-purple-300">{item.fromBungalow}</span>
                      )}
                      <span className={`text-[9px] px-1 py-0.5 rounded ${item.paymentStatus === 'PAID' ? 'bg-[#8fae92]/20 text-[#8fae92]' : 'bg-red-500/20 text-red-400'}`}>
                        {item.paymentStatus === 'PAID' ? 'PLACANO' : 'ZA PLACILO'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-white/80">{formatEur(arToEur(Number(item.priceAr)))} EUR</span>
                      <button onClick={() => handleDeleteOrderItem(item.id)} className="p-1 rounded hover:bg-red-500/20 text-white/30 hover:text-red-400">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                )

                return (
                  <div key={expandKey} className="border-b border-white/5 last:border-b-0">
                    {/* Note header - clickable for closed notes */}
                    <div 
                      className={`px-4 py-3 flex items-center justify-between bg-white/[0.01] ${!isOpen ? 'cursor-pointer hover:bg-white/[0.03]' : ''}`}
                      onClick={() => {
                        if (!isOpen) {
                          setExpandedNotes(prev => ({ ...prev, [expandKey]: !prev[expandKey] }))
                        }
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          isOpen ? 'bg-[#8fae92]/20 text-[#8fae92]' : 'bg-white/10 text-white/50'
                        }`}>
                          <FileText className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm text-white">
                            {noteDate.toLocaleDateString('sl-SI', { weekday: 'short', day: 'numeric', month: 'short' })}
                            {isToday && <span className="ml-2 text-xs text-[#8fae92]">DANES</span>}
                          </p>
                          <p className="text-xs text-white/40">
                            {itemCount} postavk {note ? (isOpen ? '• Odprta' : '• Zaprta') : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <p className={`text-sm font-medium ${isOpen ? 'text-[#8fae92]' : 'text-white/70'}`}>
                            {formatEur(dayTotalEur)} EUR
                          </p>
                          <p className="text-xs text-white/40">{formatAr(dayTotalAr)} Ar</p>
                        </div>
                        {!isOpen && (
                          <ChevronDown className={`h-4 w-4 text-white/40 transition-transform ${expandedNotes[expandKey] ? 'rotate-180' : ''}`} />
                        )}
                      </div>
                    </div>
                    {/* Day items - meals, transfers, excursions, other, bar (visible if open OR expanded) */}
                    {(isOpen || expandedNotes[expandKey]) && (
                    <div className="px-4 pb-3">
                      {dayMeals.map((item) => (
                        <OrderRow key={item.id} item={item} icon={<Utensils className="h-3 w-3 text-[#c59b5b] shrink-0" />} />
                      ))}
                      {dayTransfers.map((item) => (
                        <OrderRow key={item.id} item={item} icon={<Ship className="h-3 w-3 text-[#7fa8b8] shrink-0" />} />
                      ))}
                      {dayExcursions.map((item) => (
                        <OrderRow key={item.id} item={item} icon={<Compass className="h-3 w-3 text-[#ddb2a3] shrink-0" />} />
                      ))}
                      {dayOther.map((item) => (
                        <OrderRow key={item.id} item={item} icon={<ReceiptText className="h-3 w-3 text-white/50 shrink-0" />} />
                      ))}
                      {/* Bar items */}
                      {barItems.map((item: { id: string; productName: string; quantity: number; priceAr: number; staffName?: string }) => (
                        <div key={item.id} className="flex items-center justify-between py-1.5 text-xs border-t border-white/5 first:border-t-0">
                          <div className="min-w-0">
                            <span className="text-white/60">{item.quantity}x {toEnglishItemName(item.productName)}</span>
                            <span className="block text-[9px] text-white/30">Served by: {item.staffName || 'Bar'}</span>
                          </div>
                          <span className="text-white/80">{formatEur(arToEur(item.priceAr * item.quantity))} EUR</span>
                        </div>
                      ))}
                    </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Empty state if nothing */}
        {orderItems.length === 0 && notes.length === 0 && (
          <div className="text-center py-12">
            <ReceiptText className="h-12 w-12 mx-auto text-white/20 mb-3" />
            <p className="text-white/40">Ni artiklov na dobavnici</p>
            <p className="text-xs text-white/30 mt-1">Artikli se dodajo ob Check-in</p>
          </div>
        )}
        
        {/* Create Invoice Button */}
        {(orderItems.length > 0 || notes.length > 0) && (
          <div className="pt-4 border-t border-white/10">
            <Link href={`/racun/${reservationId}`}>
              <button className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#c59b5b] to-[#8f6d3a] text-[#0a2029] font-semibold text-sm uppercase tracking-wider hover:opacity-90 transition-all">
                Ustvari racun
              </button>
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
