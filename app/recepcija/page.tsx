"use client";

import React, { useState, useEffect } from "react";
import { Ship, Sparkles, Package, Users, Calendar, ArrowLeft, Check, Car, ShoppingBag, Utensils } from "lucide-react";
import Link from "next/link";
import { bungalowLabel, bungalowBadge } from "@/lib/bungalow";
import { childBand, CHILD_BANDS } from "@/lib/meal-plan";

// Types
type Guest = {
  id: string;
  guestName: string;
  bungalow: string;
  pax: number;
  arrival: string;
  departure: string;
};

type Excursion = {
  id: string;
  name: string;
  guidePriceAr?: number;
  entranceFeeAr?: number;
  lunchPriceAr?: number;
};

type Product = {
  id: string;
  name: string;
  category: string;
  priceAr: number;
  editablePrice?: boolean;
};

type Boat = {
  id: string;
  name: string;
};

  type LunchProvider = {
  id: string;
  name: string;
  location?: string | null;
  pricePerPersonAr?: number;
  };

type ExcursionPricing = {
  excursionId: string;
  boatId: string;
  pricePax1?: number;
  pricePax2?: number;
  pricePax3?: number;
  pricePax4?: number;
  pricePax5?: number;
  pricePax6?: number;
};

type Route = {
  id: string;
  name: string;
};

type TransferPricing = {
  routeId: string;
  boatId: string;
  pricePax1?: number;
  pricePax2?: number;
  pricePax3?: number;
  pricePax4?: number;
  pricePax5?: number;
  pricePax6?: number;
};

// One bungalow on a shared boat. Counts and the boat rate start from the
// headcount and the price list, then stay where she puts them.
// transportEur / entranceEur / lunchEur are the selling-price lines. Null
// means "still follow the count and the rate"; a number is her amount.
type GroupPart = {
  pax: number;
  lunchPax: number;
  entrancePax: number;
  boatEur: number;
  lunchTouched: boolean;
  entranceTouched: boolean;
  boatTouched: boolean;
  transportEur: number | null;
  entranceEur: number | null;
  lunchEur: number | null;
};

const emptyGroupPart = (): GroupPart => ({
  pax: 0,
  lunchPax: 0,
  entrancePax: 0,
  boatEur: 0,
  lunchTouched: false,
  entranceTouched: false,
  boatTouched: false,
  transportEur: null,
  entranceEur: null,
  lunchEur: null,
});

// Formatting helpers
const ar = (v: number) => `${Math.round(v).toLocaleString("fr-FR")} Ar`;
const today = () => new Date().toISOString().slice(0, 10);

export default function ReceptionPage() {
  const [activeGuests, setActiveGuests] = useState<Guest[]>([]);
  const [excursions, setExcursions] = useState<Excursion[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [boats, setBoats] = useState<Boat[]>([]);
  const [lunchProviders, setLunchProviders] = useState<LunchProvider[]>([]);
  const [excursionPricing, setExcursionPricing] = useState<ExcursionPricing[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [transferPricing, setTransferPricing] = useState<TransferPricing[]>([]);
  const [exchangeRate, setExchangeRate] = useState(4800);
  const [loading, setLoading] = useState(true);
  
  // Selected guest
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  
  // Active tab: excursions, transfer, massage, other
  const [activeTab, setActiveTab] = useState<"excursions" | "transfer" | "massage" | "meals" | "products" | "other">("excursions");
  
  // Form states
  const [excursionForm, setExcursionForm] = useState({
    excursionId: "",
    date: today(),
    pax: 2,
    boatId: "",
    lunchProviderId: "",
    includeEntrance: true,
    paymentStatus: "UNPAID"
  });

  // Group excursion (več bungalovov na istem čolnu). Vsak bungalov ima svoje
  // kosilo, vstopnine in ceno čolna na osebo.
  const [groupMode, setGroupMode] = useState(false);
  const [groupParts, setGroupParts] = useState<Record<string, GroupPart>>({});
  // Naroči izlet uses the same counts, boat rate, and editable price lines as one bungalow.
  const [solo, setSolo] = useState<GroupPart>(() => ({ ...emptyGroupPart(), pax: 2, lunchPax: 2, entrancePax: 2 }));
  
  const [serviceForm, setServiceForm] = useState({
    productId: "",
    name: "",
    category: "Masaza",
    qty: 1,
    priceAr: 0,
    date: today(),
    paymentStatus: "UNPAID"
  });

  // Child meal discount for the meal tab ('' = full price / adult, else CHILD_BANDS id).
  // The whole "Prehrana" tab is food, so the selector is always available there.
  const [mealBand, setMealBand] = useState("");
  
  const [transferForm, setTransferForm] = useState({
    routeId: "",
    boatId: "",
    pax: 2,
    date: today(),
    paymentStatus: "UNPAID"
  });
  
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  // Load data
  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
  setLoading(true);
  try {
  const { getDashboardData } = await import("@/app/actions/komba");
  const { getExcursionSellingPricing, getSellingPricing, getRoutes } = await import("@/app/actions/pricing");
  const data = await getDashboardData();
  const sellingPricing = await getExcursionSellingPricing();
  const transferSelling = await getSellingPricing();
  const routesData = await getRoutes();
  
  // Filter active guests (checked in, not checked out)
  const active = data.reservations.filter((r: { checkedInAt?: string | null; checkedOutAt?: string | null }) =>
  r.checkedInAt && !r.checkedOutAt
  );
  setActiveGuests(active);
  setExcursions(data.excursions || []);
  setProducts(data.allProducts || []);
  setBoats(data.boats || []);
  setLunchProviders(data.lunchProviders || []);
  setExcursionPricing(sellingPricing || []);
  setTransferPricing((transferSelling as TransferPricing[]) || []);
  setRoutes((routesData as Route[]) || []);
  setExchangeRate(data.exchangeRate || 4800);
  } catch (e) {
  console.error("Error loading data:", e);
  }
  setLoading(false);
  }

  function showSuccess(msg: string) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 3000);
  }

  // Add excursion to guest's delivery note
  async function handleAddExcursion() {
    if (!selectedGuest || !excursionForm.excursionId) return;
    
    setSaving(true);
    try {
      const { addExcursionBooking } = await import("@/app/actions/komba");
      
      // Find excursion details
      const exc = excursions.find(e => e.id === excursionForm.excursionId);
      if (!exc) return;
      
      const lunchProvider = lunchProviders.find(l => l.id === excursionForm.lunchProviderId);
      const lines = partLines(solo);

      // Add to excursion_bookings. Because the guest is already checked in, this call
      // ALSO inserts the matching order_item on the delivery note (priced + dated),
      // so we must NOT call addOrderItem separately (that caused a duplicate line).
      // The three EUR amounts are the selling-price lines she sees.
      await addExcursionBooking(selectedGuest.id, {
        excursionId: excursionForm.excursionId,
        date: excursionForm.date,
        pax: solo.pax,
        boatId: excursionForm.boatId || undefined,
        guestPrice: lines.transport,
        entranceFee: lines.entrance,
        lunchPrice: lines.lunch,
        lunchPax: lunchProvider ? solo.lunchPax : 0,
        lunchProviderId: excursionForm.lunchProviderId || undefined,
        paymentStatus: excursionForm.paymentStatus
      });
      
      // Reset form
      const pax = selectedGuest.pax;
      setSolo(freshSolo(pax, "", ""));
      setExcursionForm({
        excursionId: "",
        date: today(),
        pax,
        boatId: "",
        lunchProviderId: "",
        includeEntrance: true,
        paymentStatus: "UNPAID"
      });
      
      showSuccess(`Izlet ${exc.name} dodan za ${selectedGuest.guestName}`);
    } catch (e) {
      console.error("Error adding excursion:", e);
    }
    setSaving(false);
  }

  // Skupni pax vseh udeležencev skupinskega izleta
  const groupTotalPax = Object.values(groupParts).reduce((sum, part) => sum + (part.pax || 0), 0);
  // Pax, ki določa cenovno stopnjo cenika (skupinski: skupni pax, sicer pax obrazca)
  const effectivePax = groupMode ? Math.max(groupTotalPax, 1) : excursionForm.pax;

  function applySoloBoat(part: GroupPart, excursionId: string, boatId: string): GroupPart {
    if (part.boatTouched || part.pax <= 0) return part;
    return { ...part, boatEur: catalogBoatEur(excursionId, boatId, part.pax) };
  }

  function freshSolo(pax: number, excursionId: string, boatId: string): GroupPart {
    return applySoloBoat({
      ...emptyGroupPart(),
      pax,
      lunchPax: pax,
      entrancePax: pax,
    }, excursionId, boatId);
  }

  function patchSolo(patch: (part: GroupPart) => GroupPart) {
    setSolo(prev => applySoloBoat(patch(prev), excursionForm.excursionId, excursionForm.boatId));
  }

  function catalogBoatEur(excursionId: string, boatId: string, pax: number): number {
    const pricing = excursionPricing.find(ep => ep.excursionId === excursionId && ep.boatId === boatId);
    if (!pricing || pax < 1) return 0;
    const safePax = Math.min(pax, 6);
    const key = `pricePax${safePax}` as keyof ExcursionPricing;
    return Number(pricing[key]) || 0;
  }

  // Cenik velja samo za bungalove, kjer cene čolna še ni ročno spremenila.
  function withCatalogBoat(parts: Record<string, GroupPart>, excursionId: string, boatId: string): Record<string, GroupPart> {
    const total = Object.values(parts).reduce((sum, part) => sum + (part.pax || 0), 0);
    const rate = catalogBoatEur(excursionId, boatId, total);
    const next: Record<string, GroupPart> = {};
    for (const [id, part] of Object.entries(parts)) {
      next[id] = part.boatTouched || part.pax <= 0 ? part : { ...part, boatEur: rate };
    }
    return next;
  }

  function patchGroupPart(id: string, patch: (part: GroupPart) => GroupPart) {
    setGroupParts(prev => {
      const updated = patch(prev[id] ?? emptyGroupPart());
      return withCatalogBoat(
        { ...prev, [id]: updated },
        excursionForm.excursionId,
        excursionForm.boatId,
      );
    });
  }

  function mapGroupParts(parts: Record<string, GroupPart>, patch: Partial<GroupPart>): Record<string, GroupPart> {
    const next: Record<string, GroupPart> = {};
    for (const [id, part] of Object.entries(parts)) next[id] = { ...part, ...patch };
    return next;
  }

  // Selling-price lines for one bungalow. A stored amount wins; otherwise the
  // line still follows the count and the rate.
  function partLines(part: GroupPart) {
    const exc = excursions.find(e => e.id === excursionForm.excursionId);
    const lunchProvider = lunchProviders.find(l => l.id === excursionForm.lunchProviderId);
    const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
    const entrancePer = excursionForm.includeEntrance && exchangeRate > 0 ? (Number(exc?.entranceFeeAr) || 0) / exchangeRate : 0;
    const lunchPer = lunchProvider && exchangeRate > 0 ? (Number(lunchProvider.pricePerPersonAr) || 0) / exchangeRate : 0;
    const entranceCount = excursionForm.includeEntrance ? (part.entrancePax || 0) : 0;
    const lunchCount = lunchProvider ? (part.lunchPax || 0) : 0;
    const transport = part.transportEur != null ? round2(part.transportEur) : round2((Number(part.boatEur) || 0) * (part.pax || 0));
    const entrance = part.entranceEur != null ? round2(part.entranceEur) : round2(entrancePer * entranceCount);
    const lunch = part.lunchEur != null ? round2(part.lunchEur) : round2(lunchPer * lunchCount);
    return { transport, entrance, lunch, entranceCount, lunchCount, sum: round2(transport + entrance + lunch) };
  }

  // Dodaj SKUPINSKI izlet. Čoln, vstopnine in kosila so po bungalovu.
  async function handleAddGroupExcursion() {
    if (!excursionForm.excursionId || !excursionForm.boatId) return;
    const parts = Object.entries(groupParts)
      .map(([reservationId, part]) => ({ reservationId, ...part }))
      .filter(p => p.pax > 0);
    if (parts.length < 2) return;

    setSaving(true);
    try {
      const { addGroupExcursionBooking } = await import("@/app/actions/komba");
      const exc = excursions.find(e => e.id === excursionForm.excursionId);
      if (!exc) { setSaving(false); return; }

      const entranceFeeEur = excursionForm.includeEntrance && exchangeRate > 0 ? (exc.entranceFeeAr || 0) / exchangeRate : 0;
      const lunchProvider = lunchProviders.find(l => l.id === excursionForm.lunchProviderId);
      const hasLunch = !!lunchProvider;
      const lunchPriceEur = hasLunch && exchangeRate > 0 ? (lunchProvider.pricePerPersonAr || 0) / exchangeRate : 0;

      await addGroupExcursionBooking({
        excursionId: excursionForm.excursionId,
        boatId: excursionForm.boatId,
        date: excursionForm.date,
        entranceFee: entranceFeeEur,
        lunchPrice: hasLunch ? lunchPriceEur : 0,
        lunchProviderId: excursionForm.lunchProviderId || undefined,
        parts: parts.map(p => {
          const lines = partLines(p);
          return {
            reservationId: p.reservationId,
            pax: p.pax,
            lunchPax: hasLunch ? p.lunchPax : 0,
            entrancePax: excursionForm.includeEntrance ? p.entrancePax : 0,
            boatPricePerPax: p.boatEur,
            transportEur: lines.transport,
            entranceEur: lines.entrance,
            lunchEur: lines.lunch,
          };
        }),
      });

      setGroupParts({});
      setExcursionForm({ excursionId: "", date: today(), pax: 2, boatId: "", lunchProviderId: "", includeEntrance: true, paymentStatus: "UNPAID" });
      showSuccess(`Skupinski izlet ${exc.name} dodan (${groupTotalPax} oseb, ${parts.length} bungalovov)`);
    } catch (e) {
      console.error("Error adding group excursion:", e);
    }
    setSaving(false);
  }

  // Get TOTAL selling price for transfer based on route, boat and pax.
  // pricePaxN je cena NA OSEBO za skupino N oseb -> skupna cena = cena na osebo * pax
  // (enako kot v baru, app/page.tsx getTransferGuestPrice).
  function getTransferSellingPrice(routeId: string, boatId: string, pax: number): number {
    const pricing = transferPricing.find(tp => tp.routeId === routeId && tp.boatId === boatId);
    if (!pricing) return 0;
    const safePax = Math.min(Math.max(pax, 1), 6);
    const paxKey = `pricePax${safePax}` as keyof TransferPricing;
    const pricePerPersonEur = Number(pricing[paxKey]) || 0;
    const totalEur = pricePerPersonEur * safePax;
    return Math.round(totalEur * exchangeRate);
  }

  // Add an extra transfer to guest's delivery note (does NOT touch the transfers table,
  // which is reserved for the arrival/departure transfers).
  async function handleAddTransfer() {
    if (!selectedGuest || !transferForm.routeId || !transferForm.boatId) return;

    setSaving(true);
    try {
      const { addOrderItem } = await import("@/app/actions/komba");

      const route = routes.find(r => r.id === transferForm.routeId);
      const boat = boats.find(b => b.id === transferForm.boatId);
      if (!route) return;

      const totalPriceAr = getTransferSellingPrice(transferForm.routeId, transferForm.boatId, transferForm.pax);
      const boatName = boat ? ` | Coln: ${boat.name}` : "";

      await addOrderItem(selectedGuest.id, {
        name: `Transfer: ${route.name} - ${transferForm.pax} pax${boatName}`,
        category: "Transfer",
        qty: 1,
        priceAr: transferForm.paymentStatus === "PAID" ? 0 : totalPriceAr,
        paymentStatus: transferForm.paymentStatus,
        eventDate: transferForm.date
      });

      // Reset form but keep date
      setTransferForm(prev => ({
        routeId: "",
        boatId: "",
        pax: selectedGuest.pax,
        date: prev.date,
        paymentStatus: "UNPAID"
      }));

      showSuccess(`Transfer ${route.name} dodan za ${selectedGuest.guestName}`);
    } catch (e) {
      console.error("Error adding transfer:", e);
    }
    setSaving(false);
  }

  // Add service (massage, other) to guest's delivery note
  async function handleAddService() {
    if (!selectedGuest || !serviceForm.name) return;
    
    setSaving(true);
    try {
      const { addOrderItem } = await import("@/app/actions/komba");

      // Annotate the name with the child band (only in the meals tab) so the
      // discount is visible on the delivery note / invoice — same format as the bar.
      const band = (activeTab === "meals" && mealBand) ? childBand(mealBand) : null;
      const itemName = band
        ? `${serviceForm.name} (child ${band.id} yrs, −${Math.round(band.discount * 100)}%)`
        : serviceForm.name;

      await addOrderItem(selectedGuest.id, {
        name: itemName,
        category: serviceForm.category,
        qty: serviceForm.qty,
        priceAr: serviceForm.paymentStatus === "PAID" ? 0 : serviceForm.priceAr * serviceForm.qty,
        paymentStatus: serviceForm.paymentStatus,
        eventDate: serviceForm.date
      });
      
      const serviceName = serviceForm.name;
      
      // Reset form but keep date and category
      setServiceForm(prev => ({
        productId: "",
        name: "",
        category: prev.category,
        qty: 1,
        priceAr: 0,
        date: prev.date,
        paymentStatus: "UNPAID"
      }));
      setMealBand("");
      
      showSuccess(`${serviceName} dodan/a za ${selectedGuest.guestName}`);
    } catch (e) {
      console.error("Error adding service:", e);
    }
    setSaving(false);
  }

  // Filter products by category
  const massageProducts = products.filter(p => p.category === "Masaza" || p.category === "Masaža" || p.category === "Wellness");
  // Meal products (zajtrk, polpenzion, polni penzion)
  const MEAL_CATEGORIES = ["Food", "Ice cream and sorbets"];
  const mealProducts = products.filter(p => MEAL_CATEGORIES.includes(p.category));
  // Shop products (izdelki) sold over the counter
  const SHOP_CATEGORIES = ["Trgovina", "Izdelek", "Izdelki", "Spominki", "Spominek", "Shop"];
  const shopProducts = products.filter(p => SHOP_CATEGORIES.includes(p.category));
  const otherProducts = products.filter(p => 
    p.category !== "Masaza" && 
    p.category !== "Masaža" && 
    p.category !== "Wellness" &&
    !MEAL_CATEGORIES.includes(p.category) &&
    p.category !== "Pijaca" &&
    p.category !== "Pijača" &&
    !SHOP_CATEGORIES.includes(p.category)
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a2029] flex items-center justify-center">
        <div className="text-white/50">Nalagam...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a2029]">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#0a2029]/95 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="p-2 rounded-xl hover:bg-white/[0.05] text-white/50 hover:text-white transition-colors">
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div>
                <h1 className="text-xl font-light text-white">Recepcija</h1>
                <p className="text-xs text-white/40">Narocanje storitev med bivanjem</p>
              </div>
            </div>
            
            {selectedGuest && (
              <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-[#c59b5b]/10 border border-[#c59b5b]/30">
                <div className="w-10 h-10 rounded-full bg-[#c59b5b]/20 flex items-center justify-center">
                  <span className="text-[#c59b5b] font-bold text-sm">{bungalowBadge(selectedGuest.bungalow)}</span>
                </div>
                <div>
                  <p className="text-[#c59b5b] font-medium text-sm">{bungalowLabel(selectedGuest.bungalow)}</p>
                  <p className="text-white/50 text-xs">{selectedGuest.guestName}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Success message */}
      {successMsg && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl bg-[#8fae92] text-white font-medium shadow-lg flex items-center gap-2">
          <Check className="h-5 w-5" />
          {successMsg}
        </div>
      )}

      <main className="mx-auto max-w-7xl px-4 py-8">
        {/* Guest Selection */}
        {!selectedGuest ? (
          <div>
            <h2 className="text-white/40 text-[10px] uppercase tracking-[0.2em] font-medium mb-4">Izberi gosta</h2>
            
            {activeGuests.length === 0 ? (
              <div className="p-8 rounded-2xl border border-white/[0.06] bg-white/[0.02] text-center">
                <Users className="h-12 w-12 mx-auto text-white/20 mb-4" />
                <p className="text-white/50">Ni aktivnih gostov.</p>
                <p className="text-white/30 text-sm mt-1">Gostje se prikazejo po check-in.</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {activeGuests.map(guest => (
                  <button
                    key={guest.id}
                    onClick={() => {
                      setSelectedGuest(guest);
                      setExcursionForm(prev => ({ ...prev, pax: guest.pax }));
                      setSolo(freshSolo(guest.pax, excursionForm.excursionId, excursionForm.boatId));
                    }}
                    className="p-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-[#c59b5b]/30 transition-all text-left group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-xl bg-[#c59b5b]/10 border border-[#c59b5b]/30 flex items-center justify-center group-hover:bg-[#c59b5b]/20 transition-colors">
                        <span className="text-[#c59b5b] font-bold text-lg">{bungalowBadge(guest.bungalow)}</span>
                      </div>
                      <div>
                        <p className="text-[#c59b5b] font-medium">{bungalowLabel(guest.bungalow)}</p>
                        <p className="text-white text-sm mt-0.5">{guest.guestName}</p>
                        <p className="text-white/40 text-xs mt-1">{guest.pax} oseb</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div>
            {/* Back button */}
            <button
              onClick={() => setSelectedGuest(null)}
              className="mb-6 flex items-center gap-2 text-white/50 hover:text-white text-sm transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Nazaj na izbiro gosta
            </button>

            {/* Service Tabs */}
            <div className="flex gap-2 mb-8">
              {[
                { id: "excursions", label: "Izleti", icon: Ship },
                { id: "transfer", label: "Transferji", icon: Car },
                { id: "massage", label: "Masaze", icon: Sparkles },
                { id: "meals", label: "Prehrana", icon: Utensils },
                { id: "products", label: "Izdelki", icon: ShoppingBag },
                { id: "other", label: "Ostale storitve", icon: Package },
              ].map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as typeof activeTab)}
                    className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? "bg-[#7fa8b8]/20 border border-[#7fa8b8]/40 text-[#7fa8b8]"
                        : "bg-white/[0.02] border border-white/[0.06] text-white/50 hover:text-white hover:bg-white/[0.05]"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Excursions Tab */}
            {activeTab === "excursions" && (
              <div className="p-6 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
                <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
                  <h3 className="text-white font-medium">{groupMode ? "Skupinski izlet (več bungalovov)" : "Naroči izlet"}</h3>
                  <button
                    onClick={() => {
                      const next = !groupMode;
                      setGroupMode(next);
                      if (next && selectedGuest) {
                        const pax = selectedGuest.pax;
                        const seeded: GroupPart = {
                          pax,
                          lunchPax: pax,
                          entrancePax: pax,
                          boatEur: 0,
                          lunchTouched: false,
                          entranceTouched: false,
                          boatTouched: false,
                          transportEur: null,
                          entranceEur: null,
                          lunchEur: null,
                        };
                        setGroupParts(withCatalogBoat(
                          { [selectedGuest.id]: seeded },
                          excursionForm.excursionId,
                          excursionForm.boatId,
                        ));
                      } else {
                        setGroupParts({});
                      }
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-medium transition-colors ${
                      groupMode
                        ? "bg-[#7fa8b8] text-white"
                        : "bg-white/[0.05] text-white/60 hover:bg-white/[0.1]"
                    }`}
                  >
                    {groupMode ? "Skupinski način: VKLOPLJEN" : "Skupinski izlet"}
                  </button>
                </div>
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <label className="block text-white/40 text-[10px] uppercase tracking-wider mb-2">Izlet</label>
                    <select
                      value={excursionForm.excursionId}
                      onChange={e => {
                        const excursionId = e.target.value;
                        setExcursionForm(prev => ({ ...prev, excursionId }));
                        setGroupParts(prev => mapGroupParts(
                          withCatalogBoat(prev, excursionId, excursionForm.boatId),
                          { transportEur: null, entranceEur: null },
                        ));
                        setSolo(prev => applySoloBoat(
                          { ...prev, transportEur: null, entranceEur: null },
                          excursionId,
                          excursionForm.boatId,
                        ));
                      }}
                      className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-[#7fa8b8]/40"
                    >
                      <option value="">Izberi izlet</option>
                      {excursions.filter(exc => exc.name && exc.name.trim() !== "").map(exc => (
                        <option key={exc.id} value={exc.id}>{exc.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-white/40 text-[10px] uppercase tracking-wider mb-2">Datum</label>
                    <input
                      type="date"
                      value={excursionForm.date}
                      onChange={e => setExcursionForm(prev => ({ ...prev, date: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-[#7fa8b8]/40"
                    />
                  </div>
                  
                  {!groupMode && (
                  <div>
                    <label className="block text-white/40 text-[10px] uppercase tracking-wider mb-2">Stevilo oseb</label>
                    <input
                      type="number"
                      min="1"
                      inputMode="numeric"
                      value={excursionForm.pax === 0 ? "" : excursionForm.pax}
                      onChange={e => {
                        const n = e.target.value === "" ? 0 : Math.max(0, Number(e.target.value) || 0);
                        setExcursionForm(prev => ({ ...prev, pax: n }));
                        patchSolo(cur => ({
                          ...cur,
                          pax: n,
                          lunchPax: cur.lunchTouched ? cur.lunchPax : n,
                          entrancePax: cur.entranceTouched ? cur.entrancePax : n,
                        }));
                      }}
                      onBlur={e => {
                        if (e.target.value === "" || Number(e.target.value) < 1) {
                          setExcursionForm(prev => ({ ...prev, pax: 1 }));
                          patchSolo(cur => ({
                            ...cur,
                            pax: 1,
                            lunchPax: cur.lunchTouched ? cur.lunchPax : 1,
                            entrancePax: cur.entranceTouched ? cur.entrancePax : 1,
                          }));
                        }
                      }}
                      className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-[#7fa8b8]/40"
                    />
                    <div className="grid grid-cols-3 gap-1.5 mt-2">
                      <label className="min-w-0">
                        <span className="block text-[9px] uppercase tracking-wider text-white/40 mb-1">Kosila</span>
                        <input
                          type="number"
                          min="0"
                          inputMode="numeric"
                          aria-label="Kosila"
                          value={solo.lunchPax === 0 ? "" : solo.lunchPax}
                          placeholder="0"
                          onChange={e => {
                            const n = e.target.value === "" ? 0 : Math.max(0, Number(e.target.value) || 0);
                            patchSolo(cur => ({ ...cur, lunchPax: n, lunchTouched: true, lunchEur: null }));
                          }}
                          className="w-full px-2 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm text-center focus:outline-none focus:border-[#7fa8b8]/40"
                        />
                      </label>
                      <label className="min-w-0">
                        <span className="block text-[9px] uppercase tracking-wider text-white/40 mb-1">Vstopnine</span>
                        <input
                          type="number"
                          min="0"
                          inputMode="numeric"
                          aria-label="Vstopnine"
                          value={solo.entrancePax === 0 ? "" : solo.entrancePax}
                          placeholder="0"
                          onChange={e => {
                            const n = e.target.value === "" ? 0 : Math.max(0, Number(e.target.value) || 0);
                            patchSolo(cur => ({ ...cur, entrancePax: n, entranceTouched: true, entranceEur: null }));
                          }}
                          className="w-full px-2 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm text-center focus:outline-none focus:border-[#7fa8b8]/40"
                        />
                      </label>
                      <label className="min-w-0">
                        <span className="block text-[9px] uppercase tracking-wider text-white/40 mb-1">Coln EUR/os</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          inputMode="decimal"
                          aria-label="Coln EUR/os"
                          value={solo.boatEur === 0 ? "" : solo.boatEur}
                          placeholder="0"
                          onChange={e => {
                            const n = e.target.value === "" ? 0 : Math.max(0, Number(e.target.value) || 0);
                            patchSolo(cur => ({ ...cur, boatEur: n, boatTouched: true, transportEur: null }));
                          }}
                          className="w-full px-2 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm text-center focus:outline-none focus:border-[#7fa8b8]/40"
                        />
                      </label>
                    </div>
                  </div>
                  )}
                  {groupMode && (
                  <div className="sm:col-span-2 lg:col-span-3">
                    <label className="block text-white/40 text-[10px] uppercase tracking-wider mb-2">
                      Udeleženci (vpiši št. oseb iz vsakega bungalova) — skupaj: {groupTotalPax} oseb
                    </label>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 items-start">
                      {activeGuests.map(g => {
                        const part = groupParts[g.id] ?? emptyGroupPart();
                        const selected = part.pax > 0;
                        const countInput = "w-full px-2 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm text-center focus:outline-none focus:border-[#7fa8b8]/40";
                        return (
                          <div
                            key={g.id}
                            className={`flex flex-col gap-2 px-3 py-2 rounded-xl border ${
                              selected ? "border-[#7fa8b8]/40 bg-[#7fa8b8]/10" : "border-white/[0.08] bg-white/[0.02]"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-white text-xs truncate">{g.guestName}</p>
                                <p className="text-white/40 text-[10px] truncate">{bungalowLabel(g.bungalow)} · {g.pax} os</p>
                              </div>
                              <input
                                type="number"
                                min="0"
                                max={g.pax}
                                inputMode="numeric"
                                aria-label={`Osebe, ${g.guestName}`}
                                value={part.pax === 0 ? "" : part.pax}
                                placeholder="0"
                                onChange={e => {
                                  const n = e.target.value === "" ? 0 : Math.max(0, Number(e.target.value) || 0);
                                  patchGroupPart(g.id, cur => ({
                                    ...cur,
                                    pax: n,
                                    lunchPax: cur.lunchTouched ? cur.lunchPax : n,
                                    entrancePax: cur.entranceTouched ? cur.entrancePax : n,
                                  }));
                                }}
                                className="w-16 shrink-0 px-2 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm text-center focus:outline-none focus:border-[#7fa8b8]/40"
                              />
                            </div>
                            {selected && (
                              <div className="grid grid-cols-3 gap-1.5">
                                <label className="min-w-0">
                                  <span className="block text-[9px] uppercase tracking-wider text-white/40 mb-1">Kosila</span>
                                  <input
                                    type="number"
                                    min="0"
                                    inputMode="numeric"
                                    value={part.lunchPax === 0 ? "" : part.lunchPax}
                                    placeholder="0"
                                    onChange={e => {
                                      const n = e.target.value === "" ? 0 : Math.max(0, Number(e.target.value) || 0);
                                      patchGroupPart(g.id, cur => ({ ...cur, lunchPax: n, lunchTouched: true, lunchEur: null }));
                                    }}
                                    className={countInput}
                                  />
                                </label>
                                <label className="min-w-0">
                                  <span className="block text-[9px] uppercase tracking-wider text-white/40 mb-1">Vstopnine</span>
                                  <input
                                    type="number"
                                    min="0"
                                    inputMode="numeric"
                                    value={part.entrancePax === 0 ? "" : part.entrancePax}
                                    placeholder="0"
                                    onChange={e => {
                                      const n = e.target.value === "" ? 0 : Math.max(0, Number(e.target.value) || 0);
                                      patchGroupPart(g.id, cur => ({ ...cur, entrancePax: n, entranceTouched: true, entranceEur: null }));
                                    }}
                                    className={countInput}
                                  />
                                </label>
                                <label className="min-w-0">
                                  <span className="block text-[9px] uppercase tracking-wider text-white/40 mb-1">Coln EUR/os</span>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    inputMode="decimal"
                                    value={part.boatEur === 0 ? "" : part.boatEur}
                                    placeholder="0"
                                    onChange={e => {
                                      const n = e.target.value === "" ? 0 : Math.max(0, Number(e.target.value) || 0);
                                      patchGroupPart(g.id, cur => ({ ...cur, boatEur: n, boatTouched: true, transportEur: null }));
                                    }}
                                    className={countInput}
                                  />
                                </label>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  )}
                  
  <div>
  <label className="block text-white/40 text-[10px] uppercase tracking-wider mb-2">Coln</label>
  <select
  value={excursionForm.boatId}
  onChange={e => {
    const boatId = e.target.value;
    setExcursionForm(prev => ({ ...prev, boatId }));
    setGroupParts(prev => mapGroupParts(
      withCatalogBoat(prev, excursionForm.excursionId, boatId),
      { transportEur: null },
    ));
    setSolo(prev => applySoloBoat(
      { ...prev, transportEur: null },
      excursionForm.excursionId,
      boatId,
    ));
  }}
  className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-[#7fa8b8]/40"
  >
  <option value="">Izberi coln</option>
  {boats
    .filter(b => excursionPricing.some(ep => 
      ep.excursionId === excursionForm.excursionId && 
      ep.boatId === b.id && 
      (ep.pricePax1 || ep.pricePax2 || ep.pricePax3 || ep.pricePax4 || ep.pricePax5 || ep.pricePax6)
    ))
    .map(b => {
      const pricing = excursionPricing.find(ep => ep.excursionId === excursionForm.excursionId && ep.boatId === b.id);
      const paxKey = `pricePax${Math.min(Math.max(effectivePax, 1), 6)}` as keyof ExcursionPricing;
      const pricePerPersonEur = pricing ? (pricing[paxKey] as number || 0) : 0;
      const totalEur = pricePerPersonEur * effectivePax;
      return (
  <option key={b.id} value={b.id}>{b.name} - {totalEur} EUR ({pricePerPersonEur} EUR/os × {effectivePax})</option>
      );
    })}
  </select>
  </div>
  
  {/* Price display */}
  {excursionForm.excursionId && excursionForm.boatId && (() => {
    const toAr = (eurAmount: number) => Math.round(eurAmount * exchangeRate);
    let transportEur = 0;
    let entranceEur = 0;
    let lunchEur = 0;
    let entranceCount = 0;
    let lunchCount = 0;
    let transportPax = effectivePax;
    if (groupMode) {
      transportPax = 0;
      for (const part of Object.values(groupParts)) {
        if (part.pax <= 0) continue;
        const lines = partLines(part);
        transportPax += part.pax;
        transportEur += lines.transport;
        entranceCount += lines.entranceCount;
        lunchCount += lines.lunchCount;
        entranceEur += lines.entrance;
        lunchEur += lines.lunch;
      }
    } else {
      const lines = partLines(solo);
      transportPax = solo.pax || 0;
      transportEur = lines.transport;
      entranceEur = lines.entrance;
      lunchEur = lines.lunch;
      entranceCount = lines.entranceCount;
      lunchCount = lines.lunchCount;
    }
    const transportAr = toAr(transportEur);
    const entranceAr = toAr(entranceEur);
    const lunchAr = toAr(lunchEur);
    const totalAr = transportAr + entranceAr + lunchAr;
    const totalEur = exchangeRate > 0 ? totalAr / exchangeRate : 0;
    const toEur = (v: number) => exchangeRate > 0 ? (v / exchangeRate).toFixed(2) : "0";
    return (
  <div className="p-4 rounded-xl bg-gradient-to-r from-[#c59b5b]/10 to-[#8f6d3a]/10 border border-[#c59b5b]/20">
    <p className="text-white/50 text-xs uppercase tracking-wider mb-1">Prodajna cena {groupMode ? `(skupaj ${transportPax} oseb)` : ""}</p>
    <p className="text-2xl font-light text-[#c59b5b]">{totalEur.toFixed(2)} EUR</p>
    <p className="text-white/40 text-xs">{ar(totalAr)}</p>
    <div className="mt-2 space-y-1 text-white/40 text-xs">
      {groupMode ? (
        <>
          <div className="flex justify-between gap-2"><span>Prevoz ({transportPax} os)</span><span>{toEur(transportAr)} EUR · {ar(transportAr)}</span></div>
          {entranceAr > 0 && <div className="flex justify-between gap-2"><span>Vstopnina ({entranceCount})</span><span>{toEur(entranceAr)} EUR · {ar(entranceAr)}</span></div>}
          {lunchAr > 0 && <div className="flex justify-between gap-2"><span>Kosilo ({lunchCount})</span><span>{toEur(lunchAr)} EUR · {ar(lunchAr)}</span></div>}
        </>
      ) : (
        <>
          {([
            ["Prevoz", `Prevoz (${transportPax} os)`, transportEur, "transportEur"],
            ["Vstopnina", `Vstopnina (${entranceCount})`, entranceEur, "entranceEur"],
            ["Kosilo", `Kosilo (${lunchCount})`, lunchEur, "lunchEur"],
          ] as const).map(([key, label, amount, field]) => (
            <div key={key} className="flex items-center justify-between gap-2 flex-wrap">
              <span className="min-w-0">{label}</span>
              <span className="flex items-center gap-1.5 shrink-0">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  aria-label={label}
                  value={amount}
                  onChange={e => {
                    const n = e.target.value === "" ? 0 : Math.max(0, Number(e.target.value) || 0);
                    patchSolo(cur => ({ ...cur, [field]: Math.round(n * 100) / 100 }));
                  }}
                  className="w-[4.75rem] px-1.5 py-0.5 rounded-md bg-black/20 border border-white/10 text-white text-xs text-right tabular-nums focus:outline-none focus:border-[#c59b5b]/50"
                />
                <span className="whitespace-nowrap">EUR · {ar(Math.round(amount * exchangeRate))}</span>
              </span>
            </div>
          ))}
        </>
      )}
    </div>
  </div>
    );
  })()}
                  
                  <div>
                    <label className="block text-white/40 text-[10px] uppercase tracking-wider mb-2">Kosilo</label>
                    <select
                      value={excursionForm.lunchProviderId}
                      onChange={e => {
                        setExcursionForm(prev => ({ ...prev, lunchProviderId: e.target.value }));
                        setGroupParts(prev => mapGroupParts(prev, { lunchEur: null }));
                        setSolo(prev => ({ ...prev, lunchEur: null }));
                      }}
                      className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-[#7fa8b8]/40"
                    >
                      <option value="">Ni izbrano</option>
                      {lunchProviders.map(l => (
                        <option key={l.id} value={l.id}>{l.name}{l.pricePerPersonAr ? ` - ${ar(l.pricePerPersonAr)}/os` : ''}</option>
                      ))}
                    </select>
                  </div>

                  {/* Vstopnina checkbox */}
                  {(() => {
                    const exc = excursions.find(e => e.id === excursionForm.excursionId);
                    if (!exc || !exc.entranceFeeAr) return null;
                    return (
                      <div>
                        <label className="block text-white/40 text-[10px] uppercase tracking-wider mb-2">Vstopnina</label>
                        <button
                          type="button"
                          onClick={() => {
                            setExcursionForm(prev => ({ ...prev, includeEntrance: !prev.includeEntrance }));
                            setGroupParts(prev => mapGroupParts(prev, { entranceEur: null }));
                            setSolo(prev => ({ ...prev, entranceEur: null }));
                          }}
                          className={`w-full px-4 py-3 rounded-xl border text-sm flex items-center justify-between gap-2 transition-colors ${
                            excursionForm.includeEntrance
                              ? "bg-[#c59b5b]/10 border-[#c59b5b]/30 text-[#c59b5b]"
                              : "bg-white/[0.03] border-white/[0.08] text-white/50"
                          }`}
                        >
                          <span>{excursionForm.includeEntrance ? "Vključena" : "Ni vključena"}</span>
                          <span className="text-xs opacity-70">{ar(exc.entranceFeeAr)}/os</span>
                        </button>
                      </div>
                    );
                  })()}
                  
                  {!groupMode && (
                  <div>
                    <label className="block text-white/40 text-[10px] uppercase tracking-wider mb-2">Status placila</label>
                    <select
                      value={excursionForm.paymentStatus}
                      onChange={e => setExcursionForm(prev => ({ ...prev, paymentStatus: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-[#7fa8b8]/40"
                    >
                      <option value="UNPAID">Za placilo</option>
                      <option value="PAID">Placano</option>
                    </select>
                  </div>
                  )}
                </div>
                
                {/* Description preview */}
                {excursionForm.excursionId && (
                  <div className="mt-6 p-4 rounded-xl bg-[#7fa8b8]/10 border border-[#7fa8b8]/20">
                    {(() => {
                      const exc = excursions.find(e => e.id === excursionForm.excursionId);
                      if (!exc) return null;
                      const boat = boats.find(b => b.id === excursionForm.boatId);
                      const lunch = lunchProviders.find(l => l.id === excursionForm.lunchProviderId);
                      return (
                        <div>
                          <p className="text-white font-medium">{exc.name}</p>
                          <p className="text-white/50 text-xs mt-1">
                            Vklj: {boat ? boat.name : 'Coln ni izbran'}{exc.entranceFeeAr && excursionForm.includeEntrance ? ', vstopnina' : ''}{lunch ? `, kosilo: ${lunch.name}` : ''}
                          </p>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Per-bungalow selling price. Same gold card, with an editable EUR amount on each line. */}
                {groupMode && excursionForm.excursionId && excursionForm.boatId && groupTotalPax > 0 && (
                  <div className="mt-4">
                    <p className="text-white/50 text-[10px] uppercase tracking-wider mb-3">Prodajna cena po bungalovih</p>
                    {(() => {
                      const parts = activeGuests.filter(g => (groupParts[g.id]?.pax ?? 0) > 0);
                      const moneyInput = "w-[4.75rem] px-1.5 py-0.5 rounded-md bg-black/20 border border-white/10 text-white text-xs text-right tabular-nums focus:outline-none focus:border-[#c59b5b]/50";
                      const setLine = (id: string, key: "transportEur" | "entranceEur" | "lunchEur", raw: string) => {
                        const n = raw === "" ? 0 : Math.max(0, Number(raw) || 0);
                        patchGroupPart(id, cur => ({ ...cur, [key]: Math.round(n * 100) / 100 }));
                      };
                      return (
                        <div className="grid gap-3 sm:grid-cols-2">
                          {parts.map(g => {
                            const part = groupParts[g.id];
                            if (!part) return null;
                            const lines = partLines(part);
                            const sumAr = Math.round(lines.sum * exchangeRate);
                            const row = (label: string, amount: number, key: "transportEur" | "entranceEur" | "lunchEur") => (
                              <div className="flex items-center justify-between gap-2">
                                <span className="min-w-0">{label}</span>
                                <span className="flex items-center gap-1.5 shrink-0">
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    inputMode="decimal"
                                    aria-label={`${label}, ${g.guestName}`}
                                    value={amount}
                                    onChange={e => setLine(g.id, key, e.target.value)}
                                    className={moneyInput}
                                  />
                                  <span className="whitespace-nowrap">EUR · {ar(Math.round(amount * exchangeRate))}</span>
                                </span>
                              </div>
                            );
                            return (
                              <div key={g.id} className="p-4 rounded-xl bg-gradient-to-r from-[#c59b5b]/10 to-[#8f6d3a]/10 border border-[#c59b5b]/20">
                                <p className="text-white/50 text-xs uppercase tracking-wider mb-1">Prodajna cena · {g.guestName} ({part.pax} os)</p>
                                <p className="text-2xl font-light text-[#c59b5b]">{lines.sum.toFixed(2)} EUR</p>
                                <p className="text-white/40 text-xs">{ar(sumAr)}</p>
                                <div className="mt-2 space-y-1 text-white/40 text-xs">
                                  {row(`Prevoz (${part.pax} os)`, lines.transport, "transportEur")}
                                  {row(`Vstopnina (${lines.entranceCount})`, lines.entrance, "entranceEur")}
                                  {row(`Kosilo (${lines.lunchCount})`, lines.lunch, "lunchEur")}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                    <p className="text-white/30 text-[10px] pt-2">
                      Znesek prevoza, vstopnine in kosila lahko popraviš posebej za vsak bungalov.
                    </p>
                  </div>
                )}
                
                {groupMode ? (
                  <button
                    onClick={handleAddGroupExcursion}
                    disabled={saving || !excursionForm.excursionId || !excursionForm.boatId || Object.values(groupParts).filter(p => p.pax > 0).length < 2}
                    className="mt-6 w-full py-4 rounded-xl bg-gradient-to-r from-[#7fa8b8] to-[#66b5d4] text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-[#7fa8b8]/20 transition-all"
                  >
                    {saving ? "Dodajam..." : "Dodaj skupinski izlet (vsem bungalovom)"}
                  </button>
                ) : (
                  <button
                    onClick={handleAddExcursion}
                    disabled={saving || !excursionForm.excursionId}
                    className="mt-6 w-full py-4 rounded-xl bg-gradient-to-r from-[#7fa8b8] to-[#66b5d4] text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-[#7fa8b8]/20 transition-all"
                  >
                    {saving ? "Dodajam..." : "Dodaj izlet na dobavnico"}
                  </button>
                )}
              </div>
            )}

            {/* Transfer Tab */}
            {activeTab === "transfer" && (
              <div className="p-6 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
                <h3 className="text-white font-medium mb-6">Naroči transfer</h3>

                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <label className="block text-white/40 text-[10px] uppercase tracking-wider mb-2">Pot</label>
                    <select
                      value={transferForm.routeId}
                      onChange={e => setTransferForm(prev => ({ ...prev, routeId: e.target.value, boatId: "" }))}
                      className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-[#7fa8b8]/40"
                    >
                      <option value="">Izberi pot</option>
                      {routes.map(r => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-white/40 text-[10px] uppercase tracking-wider mb-2">Datum</label>
                    <input
                      type="date"
                      value={transferForm.date}
                      onChange={e => setTransferForm(prev => ({ ...prev, date: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-[#7fa8b8]/40"
                    />
                  </div>

                  <div>
                    <label className="block text-white/40 text-[10px] uppercase tracking-wider mb-2">Stevilo oseb</label>
                    <input
                      type="number"
                      min="1"
                      value={transferForm.pax}
                      onChange={e => setTransferForm(prev => ({ ...prev, pax: Number(e.target.value) }))}
                      className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-[#7fa8b8]/40"
                    />
                  </div>

                  <div>
                    <label className="block text-white/40 text-[10px] uppercase tracking-wider mb-2">Coln</label>
                    <select
                      value={transferForm.boatId}
                      onChange={e => setTransferForm(prev => ({ ...prev, boatId: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-[#7fa8b8]/40"
                    >
                      <option value="">Izberi coln</option>
                      {boats
                        .filter(b => transferPricing.some(tp =>
                          tp.routeId === transferForm.routeId &&
                          tp.boatId === b.id &&
                          (tp.pricePax1 || tp.pricePax2 || tp.pricePax3 || tp.pricePax4 || tp.pricePax5 || tp.pricePax6)
                        ))
                        .map(b => {
                          const pricing = transferPricing.find(tp => tp.routeId === transferForm.routeId && tp.boatId === b.id);
                          const paxKey = `pricePax${Math.min(Math.max(transferForm.pax, 1), 6)}` as keyof TransferPricing;
                          const priceEur = pricing ? (pricing[paxKey] as number || 0) : 0;
                          return (
                            <option key={b.id} value={b.id}>{b.name} - {priceEur} EUR</option>
                          );
                        })}
                    </select>
                  </div>

                  {/* Price display */}
                  {transferForm.routeId && transferForm.boatId && (
                    <div className="p-4 rounded-xl bg-gradient-to-r from-[#c59b5b]/10 to-[#8f6d3a]/10 border border-[#c59b5b]/20">
                      <p className="text-white/50 text-xs uppercase tracking-wider mb-1">Prodajna cena</p>
                      <p className="text-2xl font-light text-[#c59b5b]">
                        {(() => {
                          const pricing = transferPricing.find(tp => tp.routeId === transferForm.routeId && tp.boatId === transferForm.boatId);
                          const paxKey = `pricePax${Math.min(Math.max(transferForm.pax, 1), 6)}` as keyof TransferPricing;
                          const priceEur = pricing ? (pricing[paxKey] as number || 0) : 0;
                          return `${priceEur} EUR`;
                        })()}
                      </p>
                      <p className="text-white/40 text-xs mt-1">
                        {`= ${ar(getTransferSellingPrice(transferForm.routeId, transferForm.boatId, transferForm.pax))}`}
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="block text-white/40 text-[10px] uppercase tracking-wider mb-2">Status placila</label>
                    <select
                      value={transferForm.paymentStatus}
                      onChange={e => setTransferForm(prev => ({ ...prev, paymentStatus: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-[#7fa8b8]/40"
                    >
                      <option value="UNPAID">Za placilo</option>
                      <option value="PAID">Placano</option>
                    </select>
                  </div>
                </div>

                <button
                  onClick={handleAddTransfer}
                  disabled={saving || !transferForm.routeId || !transferForm.boatId}
                  className="mt-6 w-full py-4 rounded-xl bg-gradient-to-r from-[#7fa8b8] to-[#66b5d4] text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-[#7fa8b8]/20 transition-all"
                >
                  {saving ? "Dodajam..." : "Dodaj transfer na dobavnico"}
                </button>
              </div>
            )}

            {/* Massage Tab */}
            {activeTab === "massage" && (
              <div className="p-6 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
                <h3 className="text-white font-medium mb-6">Naroči masažo</h3>
                
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <label className="block text-white/40 text-[10px] uppercase tracking-wider mb-2">Masaza</label>
                    <select
                      value={serviceForm.productId}
                      onChange={e => {
                        const product = massageProducts.find(p => p.id === e.target.value);
                        if (product) {
                          setServiceForm(prev => ({ 
                            ...prev, 
                            productId: product.id,
                            name: product.name, 
                            category: "Masaza",
                            priceAr: product.priceAr 
                          }));
                        }
                      }}
                      className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-[#7fa8b8]/40"
                    >
                      <option value="">Izberi masazo</option>
                      {massageProducts.map(p => (
                        <option key={p.id} value={p.id}>{p.name} - {ar(p.priceAr)}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-white/40 text-[10px] uppercase tracking-wider mb-2">Datum</label>
                    <input
                      type="date"
                      value={serviceForm.date}
                      onChange={e => setServiceForm(prev => ({ ...prev, date: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-[#7fa8b8]/40"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-white/40 text-[10px] uppercase tracking-wider mb-2">Kolicina</label>
                    <input
                      type="number"
                      min="1"
                      value={serviceForm.qty}
                      onChange={e => setServiceForm(prev => ({ ...prev, qty: Number(e.target.value) }))}
                      className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-[#7fa8b8]/40"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-white/40 text-[10px] uppercase tracking-wider mb-2">Status placila</label>
                    <select
                      value={serviceForm.paymentStatus}
                      onChange={e => setServiceForm(prev => ({ ...prev, paymentStatus: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-[#7fa8b8]/40"
                    >
                      <option value="UNPAID">Za placilo</option>
                      <option value="PAID">Placano</option>
                    </select>
                  </div>
                </div>
                
                {/* Price preview */}
                {serviceForm.name && (
                  <div className="mt-6 p-4 rounded-xl bg-[#7fa8b8]/10 border border-[#7fa8b8]/20">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white font-medium">{serviceForm.name}</p>
                        <p className="text-white/50 text-xs mt-1">{serviceForm.qty}× {ar(serviceForm.priceAr)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[#7fa8b8] font-medium">{ar(serviceForm.priceAr * serviceForm.qty)}</p>
                        <p className="text-white/40 text-xs">{((serviceForm.priceAr * serviceForm.qty) / exchangeRate).toFixed(2)} EUR</p>
                      </div>
                    </div>
                  </div>
                )}
                
                <button
                  onClick={handleAddService}
                  disabled={saving || !serviceForm.name}
                  className="mt-6 w-full py-4 rounded-xl bg-gradient-to-r from-[#7fa8b8] to-[#66b5d4] text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-[#7fa8b8]/20 transition-all"
                >
                  {saving ? "Dodajam..." : "Dodaj masazo na dobavnico"}
                </button>
              </div>
            )}

            {/* Other Services Tab */}
            {/* Meals Tab */}
            {activeTab === "meals" && (
              <div className="p-6 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
                <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
                  <h3 className="text-white font-medium">Dodaj prehrano</h3>
                  <Link href="/admin" className="text-xs text-[#7fa8b8] hover:underline">Uredi cenik prehrane</Link>
                </div>

                {mealProducts.length === 0 ? (
                  <div className="py-12 text-center">
                    <Utensils className="h-10 w-10 text-white/20 mx-auto mb-3" />
                    <p className="text-white/50 text-sm">Ni vnesenih obrokov.</p>
                  </div>
                ) : (
                  <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <label className="block text-white/40 text-[10px] uppercase tracking-wider mb-2">Obrok</label>
                      <select
                        value={serviceForm.productId}
                        onChange={e => {
                          const product = mealProducts.find(p => p.id === e.target.value);
                          if (product) {
                            setMealBand("");
                            setServiceForm(prev => ({
                              ...prev,
                              productId: product.id,
                              name: product.name,
                              category: "Prehrana",
                              priceAr: product.priceAr,
                            }));
                          }
                        }}
                        className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-[#7fa8b8]/40"
                      >
                        <option value="">Izberi obrok</option>
                        {mealProducts.map(p => (
                          <option key={p.id} value={p.id}>{p.name} - {ar(p.priceAr)}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-white/40 text-[10px] uppercase tracking-wider mb-2">Datum</label>
                      <input
                        type="date"
                        value={serviceForm.date}
                        onChange={e => setServiceForm(prev => ({ ...prev, date: e.target.value }))}
                        className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-[#7fa8b8]/40"
                      />
                    </div>

                    <div>
                      <label className="block text-white/40 text-[10px] uppercase tracking-wider mb-2">Kolicina</label>
                      <input
                        type="number"
                        min="1"
                        value={serviceForm.qty}
                        onChange={e => setServiceForm(prev => ({ ...prev, qty: Number(e.target.value) }))}
                        className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-[#7fa8b8]/40"
                      />
                    </div>

                    <div>
                      <label className="block text-white/40 text-[10px] uppercase tracking-wider mb-2">Status placila</label>
                      <select
                        value={serviceForm.paymentStatus}
                        onChange={e => setServiceForm(prev => ({ ...prev, paymentStatus: e.target.value }))}
                        className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-[#7fa8b8]/40"
                      >
                        <option value="UNPAID">Za placilo</option>
                        <option value="PAID">Placano</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* Child meal discount — mirrors the bar's "Who is this meal for?" */}
                {serviceForm.name && mealProducts.length > 0 && (
                  <div className="mt-6">
                    <label className="block text-white/40 text-[10px] uppercase tracking-wider mb-2">Otroški popust (za koga je obrok)</label>
                    <select
                      value={mealBand}
                      onChange={e => {
                        const v = e.target.value;
                        setMealBand(v);
                        const product = mealProducts.find(p => p.id === serviceForm.productId);
                        const base = product ? product.priceAr : serviceForm.priceAr;
                        const factor = v ? (childBand(v)?.payFactor ?? 1) : 1;
                        setServiceForm(prev => ({ ...prev, priceAr: Math.round(base * factor) }));
                      }}
                      className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-[#7fa8b8]/40"
                    >
                      <option value="">Polna cena (odrasel)</option>
                      {CHILD_BANDS.map(b => (
                        <option key={b.id} value={b.id}>{b.label}</option>
                      ))}
                    </select>
                    {mealBand && (
                      <p className="mt-2 text-xs text-[#8fae92]">Otroški popust: {childBand(mealBand)?.labelEn}</p>
                    )}
                  </div>
                )}

                {/* Price preview */}
                {serviceForm.name && mealProducts.length > 0 && (
                  <div className="mt-6 p-4 rounded-xl bg-[#7fa8b8]/10 border border-[#7fa8b8]/20">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white font-medium">{serviceForm.name}</p>
                        <p className="text-white/50 text-xs mt-1">{serviceForm.qty}× {ar(serviceForm.priceAr)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[#7fa8b8] font-medium">{ar(serviceForm.priceAr * serviceForm.qty)}</p>
                        <p className="text-white/40 text-xs">{((serviceForm.priceAr * serviceForm.qty) / exchangeRate).toFixed(2)} EUR</p>
                      </div>
                    </div>
                  </div>
                )}

                {mealProducts.length > 0 && (
                  <button
                    onClick={handleAddService}
                    disabled={saving || !serviceForm.name}
                    className="mt-6 w-full py-4 rounded-xl bg-gradient-to-r from-[#7fa8b8] to-[#66b5d4] text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-[#7fa8b8]/20 transition-all"
                  >
                    {saving ? "Dodajam..." : "Dodaj prehrano na dobavnico"}
                  </button>
                )}
              </div>
            )}

            {activeTab === "products" && (
              <div className="p-6 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
                <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
                  <h3 className="text-white font-medium">Prodaja izdelkov</h3>
                  <Link href="/admin" className="text-xs text-[#7fa8b8] hover:underline">Uredi cenik izdelkov</Link>
                </div>

                {shopProducts.length === 0 ? (
                  <div className="py-12 text-center">
                    <ShoppingBag className="h-10 w-10 text-white/20 mx-auto mb-3" />
                    <p className="text-white/50 text-sm">Ni vnesenih izdelkov.</p>
                    <p className="text-white/30 text-xs mt-1">
                      Dodaj jih v <Link href="/admin" className="text-[#7fa8b8] hover:underline">Admin {">"} Produkti</Link> s kategorijo &quot;Trgovina&quot;.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Product grid */}
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {shopProducts.map(p => {
                        const isSelected = serviceForm.productId === p.id;
                        return (
                          <button
                            key={p.id}
                            onClick={() => setServiceForm(prev => ({
                              ...prev,
                              productId: p.id,
                              name: p.name,
                              category: p.category,
                              priceAr: p.priceAr,
                              qty: 1,
                            }))}
                            className={`text-left p-4 rounded-xl border transition-all ${
                              isSelected
                                ? "bg-[#7fa8b8]/20 border-[#7fa8b8]/50"
                                : "bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.06]"
                            }`}
                          >
                            <p className="text-white text-sm font-medium">{p.name}</p>
                            <p className="text-[#7fa8b8] text-sm mt-1">{ar(p.priceAr)}</p>
                            <p className="text-white/40 text-xs">{(p.priceAr / exchangeRate).toFixed(2)} EUR</p>
                          </button>
                        );
                      })}
                    </div>

                    {/* Selected product controls */}
                    {serviceForm.productId && (
                      <div className="mt-6 p-5 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                          <div>
                            <label className="block text-white/40 text-[10px] uppercase tracking-wider mb-2">Izdelek</label>
                            <p className="text-white text-sm py-2.5">{serviceForm.name}</p>
                          </div>
                          {shopProducts.find(p => p.id === serviceForm.productId)?.editablePrice && (
                            <div>
                              <label className="block text-[#c59b5b]/70 text-[10px] uppercase tracking-wider mb-2">Cena (Ar) - spremenljiva</label>
                              <input
                                type="number"
                                min="0"
                                value={serviceForm.priceAr || ""}
                                onChange={e => setServiceForm(prev => ({ ...prev, priceAr: Number(e.target.value) }))}
                                placeholder="Vnesi znesek"
                                className="w-full px-4 py-3 rounded-xl bg-[#c59b5b]/[0.06] border border-[#c59b5b]/30 text-white text-sm font-mono focus:outline-none focus:border-[#c59b5b]/60 placeholder:text-white/30"
                              />
                            </div>
                          )}
                          <div>
                            <label className="block text-white/40 text-[10px] uppercase tracking-wider mb-2">Datum</label>
                            <input
                              type="date"
                              value={serviceForm.date}
                              onChange={e => setServiceForm(prev => ({ ...prev, date: e.target.value }))}
                              className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-[#7fa8b8]/40"
                            />
                          </div>
                          <div>
                            <label className="block text-white/40 text-[10px] uppercase tracking-wider mb-2">Kolicina</label>
                            <input
                              type="number"
                              min="1"
                              value={serviceForm.qty}
                              onChange={e => setServiceForm(prev => ({ ...prev, qty: Number(e.target.value) }))}
                              className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-[#7fa8b8]/40"
                            />
                          </div>
                          <div>
                            <label className="block text-white/40 text-[10px] uppercase tracking-wider mb-2">Status placila</label>
                            <select
                              value={serviceForm.paymentStatus}
                              onChange={e => setServiceForm(prev => ({ ...prev, paymentStatus: e.target.value }))}
                              className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-[#7fa8b8]/40"
                            >
                              <option value="UNPAID">Za placilo</option>
                              <option value="PAID">Placano</option>
                            </select>
                          </div>
                        </div>

                        {/* Total preview */}
                        <div className="mt-5 flex items-center justify-between p-4 rounded-xl bg-[#7fa8b8]/10 border border-[#7fa8b8]/20">
                          <p className="text-white/60 text-sm">{serviceForm.qty}× {ar(serviceForm.priceAr)}</p>
                          <div className="text-right">
                            <p className="text-[#7fa8b8] font-medium">{ar(serviceForm.priceAr * serviceForm.qty)}</p>
                            <p className="text-white/40 text-xs">{((serviceForm.priceAr * serviceForm.qty) / exchangeRate).toFixed(2)} EUR</p>
                          </div>
                        </div>

                        <button
                          onClick={handleAddService}
                          disabled={saving || !serviceForm.name}
                          className="mt-5 w-full py-4 rounded-xl bg-gradient-to-r from-[#7fa8b8] to-[#66b5d4] text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-[#7fa8b8]/20 transition-all"
                        >
                          {saving ? "Dodajam..." : "Dodaj izdelek na dobavnico"}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {activeTab === "other" && (
              <div className="p-6 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
                <h3 className="text-white font-medium mb-6">Ostale storitve</h3>
                
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <label className="block text-white/40 text-[10px] uppercase tracking-wider mb-2">Storitev</label>
                    <select
                      value={serviceForm.productId}
                      onChange={e => {
                        const product = otherProducts.find(p => p.id === e.target.value);
                        if (product) {
                          setServiceForm(prev => ({ 
                            ...prev, 
                            productId: product.id,
                            name: product.name, 
                            category: product.category,
                            priceAr: product.priceAr 
                          }));
                        }
                      }}
                      className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-[#7fa8b8]/40"
                    >
                      <option value="">Izberi storitev</option>
                      {otherProducts.map(p => (
                        <option key={p.id} value={p.id}>{p.name} - {ar(p.priceAr)}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-white/40 text-[10px] uppercase tracking-wider mb-2">Ali vnesi rocno</label>
                    <input
                      type="text"
                      value={serviceForm.name}
                      onChange={e => setServiceForm(prev => ({ ...prev, name: e.target.value, productId: "" }))}
                      placeholder="Ime storitve"
                      className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-[#7fa8b8]/40 placeholder:text-white/30"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-white/40 text-[10px] uppercase tracking-wider mb-2">Datum</label>
                    <input
                      type="date"
                      value={serviceForm.date}
                      onChange={e => setServiceForm(prev => ({ ...prev, date: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-[#7fa8b8]/40"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-white/40 text-[10px] uppercase tracking-wider mb-2">Kolicina</label>
                    <input
                      type="number"
                      min="1"
                      value={serviceForm.qty}
                      onChange={e => setServiceForm(prev => ({ ...prev, qty: Number(e.target.value) }))}
                      className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-[#7fa8b8]/40"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-white/40 text-[10px] uppercase tracking-wider mb-2">Cena (Ar)</label>
                    <input
                      type="number"
                      min="0"
                      value={serviceForm.priceAr}
                      onChange={e => setServiceForm(prev => ({ ...prev, priceAr: Number(e.target.value) }))}
                      className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-[#7fa8b8]/40"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-white/40 text-[10px] uppercase tracking-wider mb-2">Status placila</label>
                    <select
                      value={serviceForm.paymentStatus}
                      onChange={e => setServiceForm(prev => ({ ...prev, paymentStatus: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-[#7fa8b8]/40"
                    >
                      <option value="UNPAID">Za placilo</option>
                      <option value="PAID">Placano</option>
                    </select>
                  </div>
                </div>
                
                {/* Price preview */}
                {serviceForm.name && (
                  <div className="mt-6 p-4 rounded-xl bg-[#7fa8b8]/10 border border-[#7fa8b8]/20">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white font-medium">{serviceForm.name}</p>
                        <p className="text-white/50 text-xs mt-1">{serviceForm.qty}× {ar(serviceForm.priceAr)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[#7fa8b8] font-medium">{ar(serviceForm.priceAr * serviceForm.qty)}</p>
                        <p className="text-white/40 text-xs">{((serviceForm.priceAr * serviceForm.qty) / exchangeRate).toFixed(2)} EUR</p>
                      </div>
                    </div>
                  </div>
                )}
                
                <button
                  onClick={handleAddService}
                  disabled={saving || !serviceForm.name}
                  className="mt-6 w-full py-4 rounded-xl bg-gradient-to-r from-[#7fa8b8] to-[#66b5d4] text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-[#7fa8b8]/20 transition-all"
                >
                  {saving ? "Dodajam..." : "Dodaj storitev na dobavnico"}
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
