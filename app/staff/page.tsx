'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { 
  getActiveBungalows, 
  getOrCreateDeliveryNote, 
  getDeliveryNoteWithItems,
  getProducts,
  addItemToDeliveryNote,
  removeItemFromDeliveryNote,
  toggleItemFree
  } from '@/app/actions/delivery'
import { CHILD_BANDS, childBand } from '@/lib/meal-plan'
import { toEnglishItemName } from '@/lib/item-name'
import { bungalowDisplayName } from '@/lib/bungalow'

// Types
interface StaffUser {
  id: string
  name: string
  role: string
}

interface BungalowGuest {
  name: string | null
  band: string | null
}

interface Bungalow {
  reservationId: string
  bungalow: string
  guestName: string
  arrival: string
  departure: string
  pax: number
  guests?: BungalowGuest[]
}

interface DeliveryNoteItem {
  id: string
  productName: string
  category: string
  quantity: number
  priceAr: number
  totalAr: number
  coveredByMealPlan?: boolean | null
  isFree?: boolean | null
  staffName: string | null
  createdAt: Date
}

interface DeliveryNote {
  id: string
  bungalow: string
  guestName: string | null
  date: string
  status: string
  totalAr: number | null
  items: DeliveryNoteItem[]
}

// Bungalow short codes and colors for staff recognition
const BUNGALOWS = ["Ocean Bungalov I", "Ocean Bungalow II", "Garden Bungalov III", "Ocean Bungalow IV", "Jungle Glamp Village"]

const BUNGALOW_CONFIG: Record<string, { code: string; color: string; bgColor: string }> = {
  "Ocean Bungalov I": { code: "I", color: "#7fa8b8", bgColor: "rgba(127,168,184, 0.15)" },
  "Ocean Bungalow II": { code: "II", color: "#2a7897", bgColor: "rgba(143,174,146, 0.15)" },
  "Garden Bungalov III": { code: "III", color: "#c59b5b", bgColor: "rgba(197,155,91, 0.15)" },
  "Ocean Bungalow IV": { code: "IV", color: "#cf937d", bgColor: "rgba(197,155,91, 0.15)" },
  "Jungle Glamp Village": { code: "JGV", color: "#8fae92", bgColor: "rgba(143,174,146, 0.15)" },
}

const getBungalowConfig = (name: string) => {
  return BUNGALOW_CONFIG[name] || { code: "?", color: "#9dafb5", bgColor: "rgba(157,175,181, 0.15)" }
}

interface Product {
  id: string
  name: string
  category: string
  costCategory?: string
  priceAr: number
  unit: string | null
}

// Format price in Ariary
function formatAr(amount: number) {
  return new Intl.NumberFormat('mg-MG').format(amount) + ' Ar'
}

// PIN Login Screen - Mobile optimized
function PinLogin({ onLogin }: { onLogin: (user: StaffUser) => void }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handlePinInput = (digit: string) => {
    if (pin.length < 4) {
      setPin(prev => prev + digit)
      setError('')
    }
  }

  const handleClear = () => {
    setPin('')
    setError('')
  }

  const handleSubmit = async () => {
    if (pin.length !== 4) return
    
    setLoading(true)
    try {
      const res = await fetch('/api/staff/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      })
      
      if (!res.ok) {
        setError('Wrong PIN')
        setPin('')
        return
      }
      
      const user = await res.json()
      localStorage.setItem('staffUser', JSON.stringify(user))
      onLogin(user)
    } catch {
      setError('Login error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (pin.length === 4) {
      handleSubmit()
    }
  }, [pin])

  return (
    <div className="min-h-[100dvh] bg-[#0a2029] flex flex-col items-center justify-center p-6 safe-area-inset">
      <div className="w-full max-w-xs">
        <div className="text-center mb-10">
          <h1 className="text-2xl font-light tracking-wider text-white mb-2">KOMBA CABANA</h1>
          <p className="text-white/50">Staff Portal</p>
        </div>
        
        <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
          {/* PIN display */}
          <div className="flex justify-center gap-4 mb-8">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`w-14 h-14 rounded-2xl border-2 flex items-center justify-center text-3xl transition-all ${
                  pin.length > i 
                    ? 'border-[#2a7897] bg-[#2a7897]/10 text-[#2a7897]' 
                    : 'border-white/20 text-white/20'
                }`}
              >
                {pin.length > i ? '•' : ''}
              </div>
            ))}
          </div>
          
          {error && (
            <p className="text-red-400 text-center mb-6">{error}</p>
          )}
          
          {/* Keypad - Large touch targets */}
          <div className="grid grid-cols-3 gap-3">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '←'].map((key) => (
              <button
                key={key}
                onClick={() => {
                  if (key === 'C') handleClear()
                  else if (key === '←') setPin(prev => prev.slice(0, -1))
                  else handlePinInput(key)
                }}
                disabled={loading}
                className={`h-16 rounded-2xl text-2xl font-medium transition-all active:scale-95 ${
                  key === 'C' 
                    ? 'bg-red-500/20 text-red-400 active:bg-red-500/40' 
                    : key === '←'
                    ? 'bg-white/5 text-white/50 active:bg-white/20'
                    : 'bg-white/10 text-white active:bg-white/30'
                } disabled:opacity-50`}
              >
                {key}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// Bungalow Selection - Mobile optimized
function BungalowSelect({ 
  bungalows, 
  onSelect,
  onRefresh,
  onLogout,
  userName
}: { 
  bungalows: Bungalow[]
  onSelect: (b: Bungalow) => void
  onRefresh: () => void
  onLogout: () => void
  userName: string
}) {
  const [showAdminPin, setShowAdminPin] = useState(false)
  const [adminPin, setAdminPin] = useState('')
  const [adminError, setAdminError] = useState('')
  
  const ADMIN_PIN = '9999' // Admin PIN koda
  
  const handleAdminPinSubmit = () => {
    if (adminPin === ADMIN_PIN) {
      window.location.href = '/'
    } else {
      setAdminError('Wrong code')
      setAdminPin('')
    }
  }
  
  const handleAdminPinKey = (key: string) => {
    if (key === 'C') {
      setAdminPin('')
      setAdminError('')
    } else if (key === '←') {
      setAdminPin(p => p.slice(0, -1))
      setAdminError('')
    } else if (adminPin.length < 4) {
      const newPin = adminPin + key
      setAdminPin(newPin)
      setAdminError('')
      if (newPin.length === 4) {
        if (newPin === ADMIN_PIN) {
          window.location.href = '/'
        } else {
        setAdminError('Wrong code')
        setTimeout(() => setAdminPin(''), 500)
        }
      }
    }
  }
  
  return (
    <div className="min-h-[100dvh] bg-[#0a2029] flex flex-col safe-area-inset">
      {/* Admin PIN Modal */}
      {showAdminPin && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#0b2731] rounded-3xl p-6 w-full max-w-xs border border-white/10">
              <h2 className="text-white text-lg font-medium text-center mb-4">Admin code</h2>
            
            {/* PIN Display */}
            <div className="flex justify-center gap-3 mb-6">
              {[0, 1, 2, 3].map(i => (
                <div
                  key={i}
                  className={`w-12 h-12 rounded-xl border-2 flex items-center justify-center text-xl font-bold ${
                    adminPin.length > i 
                      ? 'border-[#2a7897] bg-[#2a7897]/20 text-[#2a7897]' 
                      : 'border-white/20 bg-white/5'
                  }`}
                >
                  {adminPin.length > i ? '•' : ''}
                </div>
              ))}
            </div>
            
            {adminError && (
              <p className="text-red-400 text-sm text-center mb-4">{adminError}</p>
            )}
            
            {/* Keypad */}
            <div className="grid grid-cols-3 gap-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '←'].map(key => (
                <button
                  key={key}
                  onClick={() => handleAdminPinKey(key)}
                  className={`h-14 rounded-xl text-xl font-medium transition-colors ${
                    key === 'C' 
                      ? 'bg-red-500/20 text-red-400 active:bg-red-500/40' 
                      : 'bg-white/10 text-white active:bg-white/20'
                  }`}
                >
                  {key}
                </button>
              ))}
            </div>
            
            <button
              onClick={() => { setShowAdminPin(false); setAdminPin(''); setAdminError(''); }}
              className="w-full mt-4 py-3 rounded-xl bg-white/5 text-white/60 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0a2029]/95 backdrop-blur-sm border-b border-white/10 px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-medium text-white">Delivery notes</h1>
            <p className="text-white/40 text-sm">{format(new Date(), 'd. MMMM yyyy')}</p>
          </div>
          <button
            onClick={() => setShowAdminPin(true)}
            className="px-4 py-2 rounded-xl bg-[#2a7897]/20 text-[#2a7897] text-sm font-medium active:bg-[#2a7897]/40"
          >
            Admin
          </button>
        </div>

        {/* Currently logged in person — always visible (also on phone) */}
        <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-[#c59b5b]/10 border border-[#c59b5b]/30 px-3 py-2">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.15em] text-[#c59b5b]/70">Logged in</p>
            <p className="text-lg font-bold text-[#c59b5b] truncate">{userName}</p>
          </div>
          <button
            onClick={onLogout}
            className="shrink-0 px-4 py-2.5 rounded-xl bg-red-500/20 text-red-300 text-sm font-semibold active:bg-red-500/40"
          >
            Switch user
          </button>
        </div>
      </div>
      
      {/* Content */}
      <div className="flex-1 p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white/60 text-sm font-medium uppercase tracking-wider">Active guests</h2>
          <button
            onClick={onRefresh}
            className="px-4 py-2 rounded-xl bg-white/5 text-white/60 text-sm active:bg-white/15"
          >
            Refresh
          </button>
        </div>
        
{/* Bungalow List - Show all bungalows */}
          <div className="space-y-3">
            {(() => {
            // Vsaka rezervacija se dodeli SAMO prvi ujemajoči se reži (po vrstnem redu BUNGALOWS).
            // Tako dvo-bungalovska rezervacija (npr. Butelli "Ocean Bungalov I ... ; Ocean Bungalow IV ...")
            // dobi eno samo dobavnico — pod prvim bungalovom (I) — in se NE podvoji pod IV.
            const claimed = new Set<Bungalow>()
            // Lodge-local "today" (UTC+3) as YYYY-MM-DD, so the bar can flag guests
            // who leave today and staff don't mix them up with the arriving guest.
            const todayStr = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10)
            return BUNGALOWS.flatMap((bungalowName) => {
              const config = getBungalowConfig(bungalowName)
              // Flexible match: reservation bungalow may contain extra text like
              // "Ocean Bungalow IV  / Ocean Bungalow IV", so normalize whitespace.
              // Also unify the "Bungalov"/"Bungalow" spelling difference used in stored data.
              const normalize = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase().replace(/bungalov\b/g, 'bungalow')
              const canonical = normalize(bungalowName)
              // Match the name as a whole token so "Ocean Bungalow I" does NOT match
              // "Ocean Bungalow IV" (negative lookahead prevents the trailing "i" of "iv" match).
              const matchRe = new RegExp(canonical.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![a-z0-9])')
              // ALL guests currently in this bungalow, not just the first. On a
              // changeover day one guest checks out while the next has already
              // checked in (e.g. Stefan + Lukas in Ocean Bungalow II) — each needs
              // their own card + delivery note. claimed still prevents a two-room
              // reservation from showing twice across different bungalow slots.
              const slotGuests = bungalows.filter(b => !claimed.has(b) && matchRe.test(normalize(b.bungalow)))
              slotGuests.forEach(g => claimed.add(g))

              // Vacant slot — keep the disabled placeholder card.
              if (slotGuests.length === 0) {
                return [(
                  <button
                    key={bungalowName}
                    disabled
                    className="w-full p-4 rounded-2xl border text-left transition-all border-white/5 opacity-50"
                    style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold shrink-0 bg-white/5 text-white/30">
                        {config.code}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[#c59b5b] text-lg font-bold">{bungalowDisplayName(bungalowName)}</p>
                        <p className="text-white/30 text-sm mt-1">Vacant</p>
                      </div>
                    </div>
                  </button>
                )]
              }

              const multiple = slotGuests.length > 1
              return slotGuests.map((guest) => {
              const leavingToday = String(guest.departure).slice(0, 10) === todayStr
              return (
                <button
                  key={`${bungalowName}-${guest.reservationId}`}
                  onClick={() => onSelect(guest)}
                  className="w-full p-4 rounded-2xl border text-left transition-all border-white/10 active:scale-[0.98]"
                  style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
                >
                  <div className="flex items-center gap-4">
                    {/* Large Bungalow Code Badge */}
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold shrink-0 bg-[#7fa8b8]/20 border-2 border-[#c59b5b]/50 text-[#c59b5b]">
                      {config.code}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[#c59b5b] text-lg font-bold">{bungalowDisplayName(bungalowName)}</p>
                        {/* On a changeover day flag that this bungalow has more than one guest. */}
                        {multiple && (
                          <span className="rounded-full bg-[#c59b5b]/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#c59b5b]">
                            2 gosta
                          </span>
                        )}
                        {/* Red flag: guest leaves TODAY, so the bar knows this note closes at check-out. */}
                        {leavingToday && (
                          <span className="rounded-full bg-[#b0203a]/25 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#e0687c]">
                            Departure today
                          </span>
                        )}
                      </div>
                      <p className="text-white/50 text-xs mt-1 truncate">{guest.guestName}</p>
                      <p className="text-white/40 text-sm">{guest.pax} guests  •  until {format(new Date(guest.departure), 'd.M.')}</p>
                    </div>

                    {/* Arrow */}
                    <div className="text-white/30 text-2xl">→</div>
                  </div>
                </button>
              )
              })
            })
            })()}
          </div>
        </div>
      </div>
    )
  }

// Delivery Note View - Mobile optimized
function DeliveryNoteView({
  user,
  bungalow,
  deliveryNote,
  products,
  onBack,
  onRefresh,
}: {
  user: StaffUser
  bungalow: Bungalow
  deliveryNote: DeliveryNote
  products: Record<string, Product[]>
  onBack: () => void
  onRefresh: () => void
}) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [quantity, setQuantity] = useState(1)
  // Pot A: the bar picks the PERSON (not a discount %). The age band comes
  // straight from the guest card, so staff never has to guess the discount.
  const [selectedGuestIdx, setSelectedGuestIdx] = useState<number | null>(null)

  const guestList = bungalow.guests && bungalow.guests.length > 0
    ? bungalow.guests
    : Array.from({ length: Math.max(1, bungalow.pax || 1) }, () => ({ name: null, band: null }))
  const selectedGuest = selectedGuestIdx !== null ? guestList[selectedGuestIdx] : null
  // Child discount only applies to FOOD (costCategory 'prehrana'), never drinks/other.
  const isFoodCategory = !!selectedCategory &&
    (products[selectedCategory] || []).some(p => p.costCategory === 'prehrana')
  // Only a real child band produces a discount; adult/empty = full price.
  const effectiveBandId = isFoodCategory && selectedGuest?.band && CHILD_BANDS.some(b => b.id === selectedGuest.band)
    ? selectedGuest.band
    : null

  const config = getBungalowConfig(bungalow.bungalow)
  const categories = Object.keys(products)
  
  // Set first category as default
  useEffect(() => {
    if (categories.length > 0 && !selectedCategory) {
      setSelectedCategory(categories[0])
    }
  }, [categories, selectedCategory])

  const handleAddItem = async (product: Product) => {
    setAdding(true)
    try {
      await addItemToDeliveryNote(
        deliveryNote.id,
        product.id,
        quantity,
        user.id,
        user.name,
        effectiveBandId
      )
      setQuantity(1)
      setSelectedGuestIdx(null)
      onRefresh()
    } catch (err) {
      console.error('Failed to add item:', err)
    } finally {
      setAdding(false)
    }
  }

  const handleRemoveItem = async (itemId: string) => {
    try {
      await removeItemFromDeliveryNote(itemId, deliveryNote.id)
      onRefresh()
    } catch (err) {
      console.error('Failed to remove item:', err)
    }
  }

  const handleToggleFree = async (itemId: string, free: boolean) => {
    try {
      await toggleItemFree(itemId, deliveryNote.id, free)
      onRefresh()
    } catch (err) {
      console.error('Failed to toggle free:', err)
    }
  }

  return (
    <div className="min-h-[100dvh] bg-[#0a2029] flex flex-col safe-area-inset">
      {/* Header - Compact */}
      <div className="sticky top-0 z-20 bg-[#0a2029]/95 backdrop-blur-sm border-b border-white/10">
        <div className="px-3 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <button 
                onClick={onBack} 
                className="w-10 h-10 shrink-0 rounded-xl bg-white/10 flex items-center justify-center text-white/60 active:bg-white/20"
              >
                <span className="text-xl">←</span>
              </button>
              <div className="rounded-lg bg-[#c59b5b]/10 border border-[#c59b5b]/30 px-2.5 py-1 min-w-0">
                <p className="text-[9px] uppercase tracking-wider text-[#c59b5b]/70 leading-none">Logged in</p>
                <p className="text-sm font-bold text-[#c59b5b] truncate leading-tight">{user.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <div className="text-right min-w-0">
                <p className="text-[#c59b5b] font-bold text-sm sm:text-base truncate leading-tight">{bungalowDisplayName(bungalow.bungalow)}</p>
                <p className="text-white/50 text-xs truncate">{bungalow.guestName}</p>
              </div>
              <div 
                className="w-11 h-11 shrink-0 rounded-xl flex items-center justify-center text-lg font-bold"
                style={{ backgroundColor: config.color + '33', color: config.color }}
              >
                {config.code}
              </div>
            </div>
          </div>
        </div>

        {/* Category Dropdown */}
        <div className="px-3 py-2">
          <select
            value={selectedCategory || ''}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-medium appearance-none cursor-pointer focus:outline-none focus:border-[#2a7897]/50"
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23ffffff60'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '20px' }}
          >
            {categories.map((cat) => (
              <option key={cat} value={cat} className="bg-[#0b2731] text-white">
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Products Grid - Main area */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="grid grid-cols-3 gap-2">
          {selectedCategory && products[selectedCategory]?.map((product) => {
            const existingItem = deliveryNote.items.find(item => item.productId === product.id);
            const isOnNote = !!existingItem;
            
            return (
              <button
                key={product.id}
                onClick={() => handleAddItem(product)}
                disabled={adding}
                className={`p-3 rounded-xl border text-center active:scale-[0.97] transition-all disabled:opacity-50 ${
                  isOnNote 
                    ? 'bg-[#8fae92]/[0.08] border-[#8fae92]/30 hover:bg-[#8fae92]/20 hover:border-[#8fae92]/50' 
                    : 'bg-white/[0.03] border-white/10 hover:bg-[#8fae92]/20 hover:border-[#8fae92]/40'
                }`}
              >
                <p className="text-white text-xs font-medium leading-tight line-clamp-2 min-h-[32px]">{toEnglishItemName(product.name)}</p>
                <p className="text-[#c59b5b] text-sm font-bold mt-1">{formatAr(product.priceAr)}</p>
                {isOnNote && (
                  <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-[#8fae92]/20 text-[#8fae92] text-[10px] font-bold">
                    {existingItem.quantity}x
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Panel - Items + Quantity + Total */}
      <div className="sticky bottom-0 bg-[#0b2731] border-t border-white/10">
        {/* Items List - dobavnica style */}
        {deliveryNote.items.length > 0 && (
          <div className="px-3 py-2 border-b border-white/5 max-h-[30vh] overflow-y-auto">
            <div className="space-y-0">
              {deliveryNote.items.map((item) => (
                <div 
                  key={item.id}
                  className="flex items-center justify-between py-2 border-b border-white/5 last:border-b-0"
                >
                  <span className="text-white/70 text-sm">{item.quantity}x {toEnglishItemName(item.productName)}</span>
                  <div className="flex items-center gap-2">
                    {item.coveredByMealPlan ? (
                      <span className="text-[#8fae92] text-xs font-medium">Included (board)</span>
                    ) : item.isFree ? (
                      <span className="text-[#8fae92] text-xs font-medium">On House</span>
                    ) : (
                      <span className="text-white/90 text-sm font-medium">{formatAr(item.totalAr)}</span>
                    )}
                    {!item.coveredByMealPlan && (
                      <button
                        onClick={() => handleToggleFree(item.id, !item.isFree)}
                        className={`px-2 h-6 rounded-md text-xs font-medium flex items-center justify-center ${
                          item.isFree
                            ? 'bg-[#8fae92]/20 text-[#8fae92] active:bg-[#8fae92]/30'
                            : 'bg-white/5 text-white/50 active:bg-white/15'
                        }`}
                      >
                        {item.isFree ? 'Chargeable' : 'On House'}
                      </button>
                    )}
                    <button
                      onClick={() => handleRemoveItem(item.id)}
                      className="w-6 h-6 rounded-md bg-[#c59b5b]/10 text-[#c59b5b] text-sm font-bold active:bg-[#c59b5b]/30 flex items-center justify-center"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Pot A: pick the guest the meal is FOR. The child discount is read
            straight from the guest card, so the bar never guesses a % . */}
        <div className="px-3 pt-2">
          <p className="text-white/40 text-[10px] uppercase tracking-wider mb-1">Who is this meal for?</p>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setSelectedGuestIdx(null)}
              className={`px-2.5 h-9 rounded-lg text-xs font-medium ${selectedGuestIdx === null ? 'bg-[#8fae92]/25 text-[#8fae92] border border-[#8fae92]/50' : 'bg-white/5 text-white/50 border border-white/10 active:bg-white/15'}`}
            >
              Full price
            </button>
            {guestList.map((g, idx) => {
              const band = g.band ? childBand(g.band) : null
              const active = selectedGuestIdx === idx
              const rawName = g.name?.trim() || `Guest ${idx + 1}`
              const label = rawName.replace(/\bOtroci\b/gi, 'Children').replace(/\bOtrok\b/gi, 'Child')
              return (
                <button
                  key={idx}
                  onClick={() => setSelectedGuestIdx(active ? null : idx)}
                  className={`flex flex-col items-start px-2.5 h-9 justify-center rounded-lg text-xs font-medium ${active ? 'bg-[#8fae92]/25 text-[#8fae92] border border-[#8fae92]/50' : 'bg-white/5 text-white/60 border border-white/10 active:bg-white/15'}`}
                >
                  <span className="leading-none truncate max-w-[120px]">{label}</span>
                  <span className={`text-[9px] leading-none mt-0.5 ${band ? 'text-[#c59b5b]' : 'text-white/30'}`}>
                    {band ? band.labelEn : 'Adult'}
                  </span>
                </button>
              )
            })}
          </div>
          {effectiveBandId && (
            <p className="text-[#c59b5b] text-[10px] mt-1.5">
              Child discount applied automatically: {childBand(effectiveBandId)?.labelEn}
            </p>
          )}
          {!isFoodCategory && selectedGuest?.band && CHILD_BANDS.some(b => b.id === selectedGuest.band) && (
            <p className="text-white/40 text-[10px] mt-1.5">
              Child discount applies to meals only — drinks are full price.
            </p>
          )}
        </div>

        {/* Quantity + Total Row */}
        <div className="px-3 py-3 flex items-center justify-between gap-3">
          {/* Quantity Selector */}
          <div className="flex items-center gap-1">
            <button 
              onClick={() => setQuantity(q => Math.max(1, q - 1))}
              className="w-12 h-12 rounded-xl bg-white/10 text-white text-xl font-bold active:bg-white/25"
            >
              −
            </button>
            <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center">
              <span className="text-white text-xl font-bold">{quantity}</span>
            </div>
            <button 
              onClick={() => setQuantity(q => q + 1)}
              className="w-12 h-12 rounded-xl bg-white/10 text-white text-xl font-bold active:bg-white/25"
            >
              +
            </button>
          </div>
          
          {/* Total */}
          <div className="flex-1 text-right">
            <p className="text-white/40 text-[10px] uppercase tracking-wider">Total</p>
            <p className="text-[#8fae92] text-xl font-bold">{formatAr(deliveryNote.totalAr || 0)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// Main Staff App
export default function StaffPage() {
  const [user, setUser] = useState<StaffUser | null>(null)
  const [bungalows, setBungalows] = useState<Bungalow[]>([])
  const [selectedBungalow, setSelectedBungalow] = useState<Bungalow | null>(null)
  const [deliveryNote, setDeliveryNote] = useState<DeliveryNote | null>(null)
  const [products, setProducts] = useState<Record<string, Product[]>>({})
  const [loading, setLoading] = useState(true)

  // Check for existing session
  useEffect(() => {
    const stored = localStorage.getItem('staffUser')
    if (stored) {
      setUser(JSON.parse(stored))
    }
    setLoading(false)
  }, [])

  // Load bungalows when logged in
  useEffect(() => {
    if (user) {
      loadBungalows()
      loadProducts()
    }
  }, [user])

  const loadBungalows = async () => {
    const data = await getActiveBungalows()
    setBungalows(data)
  }

  const loadProducts = async () => {
    const data = await getProducts()
    // Group by category
    const grouped: Record<string, Product[]> = {}
    for (const p of data) {
      if (!grouped[p.category]) grouped[p.category] = []
      grouped[p.category].push(p as Product)
    }
    setProducts(grouped)
  }

  const handleSelectBungalow = async (bungalow: Bungalow) => {
    setSelectedBungalow(bungalow)
    const note = await getOrCreateDeliveryNote(
      bungalow.reservationId,
      bungalow.bungalow,
      bungalow.guestName
    )
    if (note) {
      const noteWithItems = await getDeliveryNoteWithItems(note.id)
      setDeliveryNote(noteWithItems as DeliveryNote)
    }
  }

  const handleRefreshNote = async () => {
    if (deliveryNote) {
      const noteWithItems = await getDeliveryNoteWithItems(deliveryNote.id)
      setDeliveryNote(noteWithItems as DeliveryNote)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('staffUser')
    setUser(null)
    setSelectedBungalow(null)
    setDeliveryNote(null)
  }

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-[#0a2029] flex items-center justify-center">
        <div className="text-white/50 text-lg">Nalagam...</div>
      </div>
    )
  }

  if (!user) {
    return <PinLogin onLogin={setUser} />
  }

  if (selectedBungalow && deliveryNote) {
    return (
      <DeliveryNoteView
        user={user}
        bungalow={selectedBungalow}
        deliveryNote={deliveryNote}
        products={products}
        onBack={() => {
          setSelectedBungalow(null)
          setDeliveryNote(null)
        }}
        onRefresh={handleRefreshNote}
      />
    )
  }

  return (
    <BungalowSelect 
      bungalows={bungalows} 
      onSelect={handleSelectBungalow}
      onRefresh={loadBungalows}
      onLogout={handleLogout}
      userName={user.name}
    />
  )
}
