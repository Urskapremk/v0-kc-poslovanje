"use client";

import React, { useState } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Pencil, Trash2, Check, X, Ship, MapPin, Compass, Users, Printer, Copy, Sparkles } from "lucide-react";
import { getProducts, addProduct, updateProduct, deleteProduct, getStaff, addStaff, updateStaff, deleteStaff, addRoute } from "../actions/admin";
import { getDashboardData } from "../actions/komba";
import { 
  getBoats, getRoutes, getBaseRoutes, getSupplierPricing, updateSupplierPricing,
  getExcursions, getExcursionPricing, updateExcursionPricing, updateExcursion, addExcursion, deleteExcursion, duplicateExcursion, clearExcursionDuplicateFlag,
  getSellingPricing, updateSellingPricing, getGuestRoutes,
  getExcursionSellingPricing, updateExcursionSellingPricing,
  getLunchProviders, addLunchProvider, updateLunchProvider, deleteLunchProvider
} from "../actions/pricing";

type Product = {
  id: string;
  name: string;
  category: string;
  priceAr: number;
  unit: string;
  active: boolean;
  editablePrice?: boolean;
};

type Boat = { id: string; name: string; engine: string; maxPax: number };
type Route = { id: string; name: string; type: string; priceEur: string; baseRouteId?: string | null };
type SupplierPrice = { id: string; boatId: string; routeId: string; priceAr: number };
type SellingPrice = { id: string; boatId: string; routeId: string; pricePax1: number; pricePax2: number; pricePax3: number; pricePax4: number; pricePax5: number; pricePax6: number };
type Excursion = { id: string; name: string; description?: string | null; imageUrl?: string | null; guidePriceAr: number; entranceFeeAr: number; lunchPriceAr: number; duplicatedAt?: string | null };
type ExcursionPrice = { id: string; excursionId: string; boatId: string; priceAr: number; supplierPriceAr: number };
type ExcursionSellingPrice = { id: string; excursionId: string; boatId: string; pricePax1: number; pricePax2: number; pricePax3: number; pricePax4: number; pricePax5: number; pricePax6: number };

const DEFAULT_RATE = 4800;

const PRODUCT_CATEGORIES = [
  "Hot Beverages", "Cold Beverages", "Carbonated Drinks", "Beer", 
  "Spirits", "Rum", "Local Rum", "Cocktails", "Wine", "Ice cream and sorbets",
  "Wellness", "Trgovina", "Razno"
];

const ar = (v: number) => v.toLocaleString("fr-FR") + " Ar";
const eur = (v: number) => v.toFixed(2) + " €";
const arToEur = (arVal: number, rate: number) => arVal / rate;

export default function AdminPage() {
  const router = useRouter();
const { data, error, isLoading, mutate } = useSWR("admin-pricing-data", async () => {
    const [products, dashboardData, boats, baseRoutes, guestRoutes, supplierPricing, sellingPricing, excursions, excursionPricing, excursionSellingPricing, lunchProviders, staffMembers] = await Promise.all([
      getProducts(),
      getDashboardData(),
      getBoats(),
      getBaseRoutes(),
      getGuestRoutes(),
      getSupplierPricing(),
      getSellingPricing(),
      getExcursions(),
      getExcursionPricing(),
      getExcursionSellingPricing(),
      getLunchProviders(),
      getStaff()
    ]);
    return { 
      products, 
      exchangeRate: dashboardData.exchangeRate || DEFAULT_RATE, 
      boats, 
      routes: baseRoutes,
      guestRoutes,
      supplierPricing,
      sellingPricing,
      excursions, 
      excursionPricing,
      excursionSellingPricing,
      lunchProviders,
      staffMembers
    };
  });

  const [activeTab, setActiveTab] = useState<"products" | "transfers" | "guestPricing" | "excursions" | "excursionGuestPricing" | "lunchProviders" | "staff">("products");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Product>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: "", category: "Ice cream and sorbets", priceAr: 0, unit: "kos", editablePrice: false });
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [editingPrice, setEditingPrice] = useState<string | null>(null);
  const [editPriceValue, setEditPriceValue] = useState<number>(0);
const [editingExcursion, setEditingExcursion] = useState<string | null>(null);
const [excursionForm, setExcursionForm] = useState<Partial<Excursion>>({});
const [showAddExcursion, setShowAddExcursion] = useState(false);
const [newExcursion, setNewExcursion] = useState({ name: "", description: "", guidePriceAr: 0, entranceFeeAr: 0, lunchPriceAr: 0 });
  const [editingGuestPrice, setEditingGuestPrice] = useState<string | null>(null);
  const [guestPriceForm, setGuestPriceForm] = useState<{ pricePax1: number; pricePax2: number; pricePax3: number; pricePax4: number; pricePax5: number; pricePax6: number }>({ pricePax1: 0, pricePax2: 0, pricePax3: 0, pricePax4: 0, pricePax5: 0, pricePax6: 0 });
  const [editingExcGuestPrice, setEditingExcGuestPrice] = useState<string | null>(null);
  const [excGuestPriceForm, setExcGuestPriceForm] = useState<{ pricePax1: number; pricePax2: number; pricePax3: number; pricePax4: number; pricePax5: number; pricePax6: number }>({ pricePax1: 0, pricePax2: 0, pricePax3: 0, pricePax4: 0, pricePax5: 0, pricePax6: 0 });

  const refresh = () => mutate();

  if (isLoading) return (
    <div className="min-h-screen bg-[#0a2029] flex items-center justify-center font-[family-name:var(--font-manrope)]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-[#c59b5b]/30 border-t-[#c59b5b] rounded-full animate-spin" />
        <p className="text-white/40 text-sm tracking-wide">Nalagam cenike...</p>
      </div>
    </div>
  );
  
  if (error) return (
    <div className="min-h-screen bg-[#0a2029] flex items-center justify-center font-[family-name:var(--font-manrope)]">
      <div className="p-6 rounded-2xl bg-red-500/10 border border-red-500/20">
        <p className="text-red-400">Napaka: {error.message}</p>
      </div>
    </div>
  );

  const { 
    products = [], 
    exchangeRate = DEFAULT_RATE,
    boats = [],
    routes = [],
    guestRoutes = [],
    supplierPricing = [],
    sellingPricing = [],
    excursions = [],
    excursionPricing = [],
    excursionSellingPricing = []
  } = data || {};
  
  const filteredProducts = filterCategory === "all" 
    ? products 
    : products.filter((p: Product) => p.category === filterCategory);

  // Product handlers
  const handleEditProduct = async (id: string) => {
    if (editingId === id) {
      await updateProduct(id, editForm as Partial<Product>);
      setEditingId(null);
      setEditForm({});
      refresh();
    } else {
      const product = products.find((p: Product) => p.id === id);
      setEditingId(id);
      setEditForm(product || {});
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (confirm("Ali ste prepricani da zelite izbrisati ta artikel?")) {
      await deleteProduct(id);
      refresh();
    }
  };

  const handleAddProduct = async () => {
    await addProduct(newProduct);
    setNewProduct({ name: "", category: "Ice cream and sorbets", priceAr: 0, unit: "kos", editablePrice: false });
    setShowAddForm(false);
    refresh();
  };

  // Supplier pricing handlers
  const getSupplierPrice = (boatId: string, routeId: string): number => {
    const price = supplierPricing.find((sp: SupplierPrice) => sp.boatId === boatId && sp.routeId === routeId);
    return price?.priceAr || 0;
  };

  const handleSaveSupplierPrice = async (boatId: string, routeId: string) => {
    await updateSupplierPricing(boatId, routeId, editPriceValue);
    setEditingPrice(null);
    refresh();
  };
  
  // Excursion pricing handlers
  const getExcursionPrice = (excursionId: string, boatId: string): number => {
    const price = excursionPricing.find((ep: ExcursionPrice) => ep.excursionId === excursionId && ep.boatId === boatId);
    return price?.priceAr || 0;
  };

  const getExcursionSupplierPrice = (excursionId: string, boatId: string): number => {
    const price = excursionPricing.find((ep: ExcursionPrice) => ep.excursionId === excursionId && ep.boatId === boatId);
    return price?.supplierPriceAr || 0;
  };
  
  const handleSaveExcursionPrice = async (excursionId: string, boatId: string) => {
    await updateExcursionPricing(excursionId, boatId, editPriceValue);
    setEditingPrice(null);
    refresh();
  };

  const handleSaveExcursion = async (id: string) => {
    await updateExcursion(id, excursionForm);
    setEditingExcursion(null);
    setExcursionForm({});
    refresh();
  };

  // Guest pricing handlers
  const getGuestPrice = (boatId: string, routeId: string): SellingPrice | null => {
    return sellingPricing.find((sp: SellingPrice) => sp.boatId === boatId && sp.routeId === routeId) || null;
  };

  const handleSaveGuestPrice = async (boatId: string, routeId: string) => {
    await updateSellingPricing(boatId, routeId, guestPriceForm);
    setEditingGuestPrice(null);
    setGuestPriceForm({ pricePax1: 0, pricePax2: 0, pricePax3: 0, pricePax4: 0, pricePax5: 0, pricePax6: 0 });
    refresh();
  };

  // Taxi drivers (Herman, Amad, …) are car providers, not guest crossing boats — exclude all taxis from guest crossing-boat selling pricing.
  const guestBoats = boats.filter((b: Boat) => !b.id.startsWith('taxi-'));
  // Filter routes for guest pricing (exclude taxi route)
  const guestRoutesFiltered = guestRoutes.filter((r: Route) => r.id !== 'route-airport-port');
  // Herman (car to/from Port) routes = routes that have a Taxi Herman supplier price.
  const hermanRoutesForPricing = routes.filter((r: Route) =>
    supplierPricing.some((sp: SupplierPrice) => sp.boatId === 'taxi-herman' && sp.routeId === r.id)
  );

  // Excursion guest pricing handlers
  const getExcGuestPrice = (excursionId: string, boatId: string): ExcursionSellingPrice | null => {
    return excursionSellingPricing.find((esp: ExcursionSellingPrice) => esp.excursionId === excursionId && esp.boatId === boatId) || null;
  };

  const handleSaveExcGuestPrice = async (excursionId: string, boatId: string) => {
    await updateExcursionSellingPricing(excursionId, boatId, excGuestPriceForm);
    setEditingExcGuestPrice(null);
    setExcGuestPriceForm({ pricePax1: 0, pricePax2: 0, pricePax3: 0, pricePax4: 0, pricePax5: 0, pricePax6: 0 });
    refresh();
  };

  return (
    <div className="min-h-screen bg-[#0a2029] font-[family-name:var(--font-manrope)]">
      {/* Header */}
      <header className="border-b border-white/[0.06] bg-gradient-to-b from-[#0b2731] to-[#0a2029] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <button onClick={() => router.push("/")} className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-white/10 transition-all">
              <ArrowLeft className="h-5 w-5 text-white/70" />
            </button>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#c59b5b]/60 mb-1">Administracija</p>
              <h1 className="text-xl font-light text-white tracking-wide">Upravljanje cenikov</h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <a 
              href="/cenik-print" 
              target="_blank"
              className="px-4 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.1] hover:bg-white/[0.08] transition-colors flex items-center gap-2 text-white/70 hover:text-white"
            >
              <Printer className="h-4 w-4" />
              <span className="text-xs font-medium">Natisni cenik</span>
            </a>
            <div className="px-4 py-2.5 rounded-xl bg-[#c59b5b]/10 border border-[#c59b5b]/20">
              <p className="text-[10px] uppercase tracking-wider text-[#c59b5b]/60 mb-0.5">Trenutni tecaj</p>
              <p className="text-[#c59b5b] font-mono text-sm font-medium">1 EUR = {exchangeRate.toLocaleString("fr-FR")} Ar</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Tabs */}
        <div className="flex gap-3 mb-8">
          <button
            onClick={() => { setActiveTab("products"); setShowAddForm(false); setEditingId(null); }}
            className={`px-6 py-3 rounded-2xl text-sm font-medium transition-all ${
              activeTab === "products" 
                ? "bg-gradient-to-r from-[#c59b5b] to-[#c49863] text-[#0a2029] shadow-[0_4px_20px_rgba(197,155,91,0.25)]" 
                : "bg-white/[0.03] border border-white/[0.06] text-white/50 hover:bg-white/[0.06] hover:text-white/80"
            }`}
          >
            Produkti ({products.length})
          </button>
          <button
            onClick={() => { setActiveTab("transfers"); setShowAddForm(false); setEditingId(null); }}
            className={`px-6 py-3 rounded-2xl text-sm font-medium transition-all flex items-center gap-2 ${
              activeTab === "transfers" 
                ? "bg-gradient-to-r from-[#8fae92] to-[#526b55] text-[#0a2029] shadow-[0_4px_20px_rgba(143,174,146,0.25)]" 
                : "bg-white/[0.03] border border-white/[0.06] text-white/50 hover:bg-white/[0.06] hover:text-white/80"
            }`}
          >
            <Ship className="h-4 w-4" />
            Transferji - Dobavitelji
          </button>
          <button
            onClick={() => { setActiveTab("guestPricing"); setShowAddForm(false); setEditingId(null); }}
            className={`px-6 py-3 rounded-2xl text-sm font-medium transition-all flex items-center gap-2 ${
              activeTab === "guestPricing" 
                ? "bg-gradient-to-r from-[#c68d79] to-[#af7a67] text-[#0a2029] shadow-[0_4px_20px_rgba(196,116,74,0.25)]" 
                : "bg-white/[0.03] border border-white/[0.06] text-white/50 hover:bg-white/[0.06] hover:text-white/80"
            }`}
          >
            <MapPin className="h-4 w-4" />
            Transferji - Gosti
          </button>
          <button
            onClick={() => { setActiveTab("excursions"); setShowAddForm(false); setEditingId(null); }}
            className={`px-6 py-3 rounded-2xl text-sm font-medium transition-all flex items-center gap-2 ${
              activeTab === "excursions" 
                ? "bg-gradient-to-r from-[#7fa8b8] to-[#6cb8d6] text-[#0a2029] shadow-[0_4px_20px_rgba(127,168,184,0.25)]" 
                : "bg-white/[0.03] border border-white/[0.06] text-white/50 hover:bg-white/[0.06] hover:text-white/80"
            }`}
          >
            <Compass className="h-4 w-4" />
            Izleti - Dobavitelji
          </button>
          <button
            onClick={() => { setActiveTab("excursionGuestPricing"); setShowAddForm(false); setEditingId(null); }}
            className={`px-6 py-3 rounded-2xl text-sm font-medium transition-all flex items-center gap-2 ${
              activeTab === "excursionGuestPricing" 
                ? "bg-gradient-to-r from-[#ddb2a3] to-[#cf937d] text-[#0a2029] shadow-[0_4px_20px_rgba(197,155,91,0.25)]" 
                : "bg-white/[0.03] border border-white/[0.06] text-white/50 hover:bg-white/[0.06] hover:text-white/80"
            }`}
          >
            <Compass className="h-4 w-4" />
            Izleti - Gosti
          </button>
          <button
            onClick={() => { setActiveTab("lunchProviders"); setShowAddForm(false); setEditingId(null); }}
            className={`px-6 py-3 rounded-2xl text-sm font-medium transition-all flex items-center gap-2 ${
              activeTab === "lunchProviders" 
                ? "bg-gradient-to-r from-[#be6e51] to-[#b46142] text-[#0a2029] shadow-[0_4px_20px_rgba(196,116,74,0.25)]" 
                : "bg-white/[0.03] border border-white/[0.06] text-white/50 hover:bg-white/[0.06] hover:text-white/80"
            }`}
          >
            🍽️
            Ponudniki kosila
          </button>
          <button
            onClick={() => { setActiveTab("staff"); setShowAddForm(false); setEditingId(null); }}
            className={`px-6 py-3 rounded-2xl text-sm font-medium transition-all flex items-center gap-2 ${
              activeTab === "staff" 
                ? "bg-gradient-to-r from-[#8fae92] to-[#76b27c] text-[#0a2029] shadow-[0_4px_20px_rgba(143,174,146,0.25)]" 
                : "bg-white/[0.03] border border-white/[0.06] text-white/50 hover:bg-white/[0.06] hover:text-white/80"
            }`}
          >
            <Users className="h-4 w-4" />
            Delavci
          </button>
        </div>

        {/* PRODUCTS TAB */}
        {activeTab === "products" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <span className="text-white/30 text-xs uppercase tracking-wider">Kategorija:</span>
                <select
                  value={filterCategory}
                  onChange={e => setFilterCategory(e.target.value)}
                  className="px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white text-sm focus:border-[#c59b5b]/30 focus:outline-none"
                >
                  <option value="all" className="bg-[#0a2029]">Vse kategorije</option>
                  {PRODUCT_CATEGORIES.map(cat => (
                    <option key={cat} value={cat} className="bg-[#0a2029]">{cat}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#8fae92] to-[#526b55] text-[#0a2029] text-sm font-medium flex items-center gap-2 shadow-[0_4px_15px_rgba(143,174,146,0.2)] hover:shadow-[0_6px_20px_rgba(143,174,146,0.3)] transition-all"
              >
                <Plus className="h-4 w-4" />
                Dodaj artikel
              </button>
            </div>

            {showAddForm && (
              <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.08] flex flex-wrap items-end gap-4">
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.15em] text-white/30 mb-2">Ime artikla</label>
                  <input
                    type="text"
                    value={newProduct.name}
                    onChange={e => setNewProduct({ ...newProduct, name: e.target.value })}
                    className="px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white w-56 focus:border-[#c59b5b]/30 focus:outline-none"
                    placeholder="Vnesi ime..."
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.15em] text-white/30 mb-2">Kategorija</label>
                  <select
                    value={newProduct.category}
                    onChange={e => setNewProduct({ ...newProduct, category: e.target.value })}
                    className="px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white focus:border-[#c59b5b]/30 focus:outline-none"
                  >
                    {PRODUCT_CATEGORIES.map(cat => (
                      <option key={cat} value={cat} className="bg-[#0a2029]">{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.15em] text-white/30 mb-2">Cena (Ar)</label>
                  <input
                    type="number"
                    value={newProduct.priceAr || ""}
                    onChange={e => setNewProduct({ ...newProduct, priceAr: Number(e.target.value) })}
                    className="px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white w-32 font-mono focus:border-[#c59b5b]/30 focus:outline-none"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.15em] text-white/30 mb-2">Uredljiva cena</label>
                  <button
                    type="button"
                    onClick={() => setNewProduct({ ...newProduct, editablePrice: !newProduct.editablePrice })}
                    className={`px-4 py-2.5 rounded-xl border text-sm transition-colors ${
                      newProduct.editablePrice
                        ? "bg-[#c59b5b]/15 border-[#c59b5b]/40 text-[#c59b5b]"
                        : "bg-white/[0.03] border-white/[0.08] text-white/50 hover:text-white"
                    }`}
                    title="Ko je vklopljeno, lahko ceno spremenis vsakic ob izbiri artikla (npr. napitnina)"
                  >
                    {newProduct.editablePrice ? "Da - spremenljiva" : "Ne - fiksna"}
                  </button>
                </div>
                <button
                  onClick={handleAddProduct}
                  disabled={!newProduct.name || !newProduct.priceAr}
                  className="px-5 py-2.5 rounded-xl bg-[#8fae92] text-[#0a2029] text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Shrani
                </button>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="px-5 py-2.5 rounded-xl bg-white/[0.05] text-white/60 text-sm hover:bg-white/[0.08]"
                >
                  Preklici
                </button>
              </div>
            )}

            <div className="rounded-2xl border border-white/[0.06] overflow-hidden bg-white/[0.01]">
              <table className="w-full text-sm">
                <thead className="bg-white/[0.03] text-white/40">
                  <tr>
                    <th className="px-5 py-4 text-left text-[10px] uppercase tracking-[0.15em] font-medium">Artikel</th>
                    <th className="px-5 py-4 text-left text-[10px] uppercase tracking-[0.15em] font-medium">Kategorija</th>
                    <th className="px-5 py-4 text-right text-[10px] uppercase tracking-[0.15em] font-medium">Cena Ar (= EUR)</th>
                    <th className="px-5 py-4 text-right w-28 text-[10px] uppercase tracking-[0.15em] font-medium">Akcije</th>
                  </tr>
                </thead>
                <tbody className="text-white divide-y divide-white/10">
                  {filteredProducts.map((product: Product) => (
                    <tr key={product.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-4">
                        {editingId === product.id ? (
                          <input
                            type="text"
                            value={(editForm as Product).name || ""}
                            onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                            className="px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/10 text-white w-full focus:border-[#c59b5b]/30 focus:outline-none"
                          />
                        ) : (
                          <span className="font-medium">{product.name}</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-white/50">
                        {editingId === product.id ? (
                          <select
                            value={(editForm as Product).category || ""}
                            onChange={e => setEditForm({ ...editForm, category: e.target.value })}
                            className="px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/10 text-white"
                          >
                            {PRODUCT_CATEGORIES.map(cat => (
                              <option key={cat} value={cat} className="bg-[#0a2029]">{cat}</option>
                            ))}
                          </select>
                        ) : (
                          product.category
                        )}
                      </td>
                      <td className="px-5 py-4 text-right font-mono">
                        {editingId === product.id ? (
                          <div className="flex flex-col items-end gap-2">
                            <input
                              type="number"
                              value={(editForm as Product).priceAr || ""}
                              onChange={e => setEditForm({ ...editForm, priceAr: Number(e.target.value) })}
                              className="px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/10 text-white w-28 text-right focus:border-[#c59b5b]/30 focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => setEditForm({ ...editForm, editablePrice: !(editForm as Product).editablePrice })}
                              className={`px-2.5 py-1 rounded-lg border text-[10px] uppercase tracking-wider transition-colors ${
                                (editForm as Product).editablePrice
                                  ? "bg-[#c59b5b]/15 border-[#c59b5b]/40 text-[#c59b5b]"
                                  : "bg-white/[0.03] border-white/[0.08] text-white/40 hover:text-white"
                              }`}
                              title="Uredljiva cena ob izbiri (npr. napitnina)"
                            >
                              {(editForm as Product).editablePrice ? "Cena spremenljiva" : "Cena fiksna"}
                            </button>
                          </div>
                        ) : (
                          <div>
                            <span className="text-white">{ar(product.priceAr)}</span>
                            <p className="text-[11px] text-[#c59b5b]/60 mt-0.5">= {eur(arToEur(product.priceAr, exchangeRate))}</p>
                            {product.editablePrice && (
                              <p className="text-[10px] text-[#c59b5b]/80 mt-0.5 uppercase tracking-wider">spremenljiva</p>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => handleEditProduct(product.id)}
                            className="p-2 rounded-lg hover:bg-white/[0.06] text-white/40 hover:text-white transition-colors"
                          >
                            {editingId === product.id ? <Check className="h-4 w-4 text-[#8fae92]" /> : <Pencil className="h-4 w-4" />}
                          </button>
                          {editingId === product.id ? (
                            <button
                              onClick={() => { setEditingId(null); setEditForm({}); }}
                              className="p-2 rounded-lg hover:bg-white/[0.06] text-white/40"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleDeleteProduct(product.id)}
                              className="p-2 rounded-lg hover:bg-red-500/10 text-white/40 hover:text-red-400 transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-white/20 text-xs tracking-wide">Skupaj {filteredProducts.length} artiklov</p>
          </div>
        )}

        {/* TRANSFERS TAB */}
        {activeTab === "transfers" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-white/40">Dodaj novo ruto (relacijo), nato vpiši dobaviteljske cene po čolnih spodaj.</p>
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#8fae92] to-[#719d75] text-[#0a2029] text-sm font-semibold hover:shadow-[0_4px_20px_rgba(143,174,146,0.3)] transition-all whitespace-nowrap"
              >
                <Plus className="h-4 w-4" />
                Dodaj ruto
              </button>
            </div>

            {showAddForm && (
              <div className="rounded-2xl border border-[#8fae92]/20 bg-[#8fae92]/5 p-6">
                <h4 className="text-sm font-medium text-white mb-4">Nova ruta (transfer)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input
                    type="text"
                    placeholder="Ime rute (npr. Hell-Ville - Komba)"
                    className="px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white placeholder-white/30 focus:border-[#8fae92]/40 focus:outline-none"
                    id="newRouteName"
                  />
                  <input
                    type="number"
                    placeholder="Privzeta cena EUR (neobvezno)"
                    className="px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white placeholder-white/30 focus:border-[#8fae92]/40 focus:outline-none"
                    id="newRoutePrice"
                  />
                </div>
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={async () => {
                      const name = (document.getElementById("newRouteName") as HTMLInputElement).value.trim();
                      const priceEur = Number((document.getElementById("newRoutePrice") as HTMLInputElement).value) || 0;
                      if (name) {
                        await addRoute({ name, priceEur });
                        mutate();
                        setShowAddForm(false);
                      }
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#8fae92] text-[#0a2029] text-sm font-semibold hover:bg-[#719d75] transition-colors"
                  >
                    <Check className="h-4 w-4" />
                    Shrani
                  </button>
                  <button
                    onClick={() => setShowAddForm(false)}
                    className="px-5 py-2.5 rounded-xl bg-white/[0.05] text-white/60 text-sm font-medium hover:bg-white/[0.1] transition-colors"
                  >
                    Prekliči
                  </button>
                </div>
              </div>
            )}

            <div className="p-5 rounded-2xl bg-gradient-to-r from-[#8fae92]/10 to-[#8fae92]/5 border border-[#8fae92]/20">
              <p className="text-[#8fae92] text-sm leading-relaxed">
                Dobaviteljske cene transferjev po colnih in rutah. Klikni na ceno za urejanje. Vse cene so v Ariary (Ar), preracun v EUR se izracuna avtomatsko po trenutnem tecaju.
              </p>
            </div>

            <div className="rounded-2xl border border-white/[0.06] overflow-x-auto bg-white/[0.01]">
              <table className="w-full text-sm">
                <thead className="bg-white/[0.03] text-white/40">
                  <tr>
                    <th className="px-5 py-4 sticky left-0 bg-[#162227] border-r border-white/[0.06]">
                      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.15em] font-medium">
                        <Ship className="h-4 w-4 text-[#8fae92]" />
                        Coln / Ruta
                      </div>
                    </th>
                    {routes.map((route: Route) => (
                      <th key={route.id} className="px-5 py-4 text-center min-w-[160px]">
                        <div className="flex flex-col items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 text-[#8fae92]/60" />
                          <span className="text-[10px] uppercase tracking-[0.1em] font-medium leading-tight">{route.name}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="text-white divide-y divide-white/10">
                  {boats.map((boat: Boat) => (
                    <tr key={boat.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-4 sticky left-0 bg-[#162227] border-r border-white/[0.06]">
                        <div className="font-medium text-white">{boat.name}</div>
                        <div className="text-[11px] text-white/30 mt-0.5">{boat.engine} | max {boat.maxPax} pax</div>
                      </td>
                      {routes.map((route: Route) => {
                        const priceKey = `${boat.id}-${route.id}`;
                        const price = getSupplierPrice(boat.id, route.id);
                        const isEditing = editingPrice === priceKey;
                        
                        return (
                          <td key={route.id} className="px-5 py-4 text-center">
                            {isEditing ? (
                              <div className="flex items-center justify-center gap-1">
                                <input
                                  type="number"
                                  value={editPriceValue}
                                  onChange={e => setEditPriceValue(Number(e.target.value))}
                                  className="w-28 px-3 py-1.5 rounded-lg bg-white/[0.05] border border-[#8fae92]/30 text-white text-right text-sm font-mono focus:outline-none"
                                  autoFocus
                                />
                                <button
                                  onClick={() => handleSaveSupplierPrice(boat.id, route.id)}
                                  className="p-1.5 rounded-lg hover:bg-[#8fae92]/20 text-[#8fae92]"
                                >
                                  <Check className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => setEditingPrice(null)}
                                  className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/30"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  setEditingPrice(priceKey);
                                  setEditPriceValue(price);
                                }}
                                className="px-4 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-white/10 transition-all font-mono text-sm min-w-[100px]"
                              >
                                {price > 0 ? (
                                  <div>
                                    <span className="text-white">{ar(price)}</span>
                                    <p className="text-[10px] text-[#c59b5b]/60 mt-0.5">= {eur(arToEur(price, exchangeRate))}</p>
                                  </div>
                                ) : <span className="text-white/20">-</span>}
                              </button>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* GUEST PRICING TAB */}
        {activeTab === "guestPricing" && (
          <div className="space-y-6">
            <div className="p-5 rounded-2xl bg-gradient-to-r from-[#c68d79]/10 to-[#c68d79]/5 border border-[#c68d79]/20">
              <p className="text-[#c68d79] text-sm leading-relaxed">
                Prodajne cene transferjev za goste v EUR. Cene so po stevilu oseb (1-6 pax). Klikni na vrstico za urejanje vseh cen.
              </p>
            </div>

            {guestRoutesFiltered.map((route: Route) => (
              <div key={route.id} className="space-y-4">
                <h3 className="text-white/60 text-xs uppercase tracking-[0.15em] font-medium flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-[#c68d79]" />
                  {route.name}
                </h3>
                <div className="rounded-2xl border border-white/[0.06] overflow-hidden bg-white/[0.01]">
                  <table className="w-full text-sm">
                    <thead className="bg-white/[0.03] text-white/40">
                      <tr>
                        <th className="px-5 py-4 text-left text-[10px] uppercase tracking-[0.15em] font-medium">Coln</th>
                        <th className="px-4 py-4 text-center text-[10px] uppercase tracking-[0.15em] font-medium">1 pax</th>
                        <th className="px-4 py-4 text-center text-[10px] uppercase tracking-[0.15em] font-medium">2 pax</th>
                        <th className="px-4 py-4 text-center text-[10px] uppercase tracking-[0.15em] font-medium">3 pax</th>
                        <th className="px-4 py-4 text-center text-[10px] uppercase tracking-[0.15em] font-medium">4 pax</th>
                        <th className="px-4 py-4 text-center text-[10px] uppercase tracking-[0.15em] font-medium">5 pax</th>
                        <th className="px-4 py-4 text-center text-[10px] uppercase tracking-[0.15em] font-medium">6 pax</th>
                        <th className="px-4 py-4 w-20"></th>
                      </tr>
                    </thead>
                    <tbody className="text-white divide-y divide-white/10">
                      {guestBoats.map((boat: Boat) => {
                        const priceKey = `${boat.id}-${route.id}`;
                        const existingPrice = getGuestPrice(boat.id, route.id);
                        const isEditing = editingGuestPrice === priceKey;
                        
                        return (
                          <tr key={boat.id} className="hover:bg-white/[0.02] transition-colors">
                            <td className="px-5 py-4">
                              <div className="font-medium">{boat.name}</div>
                              <div className="text-[11px] text-white/30">{boat.engine} | max {boat.maxPax} pax</div>
                            </td>
                            {isEditing ? (
                              <>
                                {[1, 2, 3, 4, 5, 6].map(pax => (
                                  <td key={pax} className="px-2 py-4 text-center">
                                    <input
                                      type="number"
                                      value={guestPriceForm[`pricePax${pax}` as keyof typeof guestPriceForm] || ""}
                                      onChange={e => setGuestPriceForm({ ...guestPriceForm, [`pricePax${pax}`]: Number(e.target.value) })}
                                      className="w-16 px-2 py-1.5 rounded-lg bg-white/[0.05] border border-[#c68d79]/30 text-white text-center text-sm font-mono focus:outline-none"
                                    />
                                  </td>
                                ))}
                                <td className="px-2 py-4">
                                  <div className="flex justify-center gap-1">
                                    <button
                                      onClick={() => handleSaveGuestPrice(boat.id, route.id)}
                                      className="p-1.5 rounded-lg hover:bg-[#c68d79]/20 text-[#c68d79]"
                                    >
                                      <Check className="h-4 w-4" />
                                    </button>
                                    <button
                                      onClick={() => { setEditingGuestPrice(null); setGuestPriceForm({ pricePax1: 0, pricePax2: 0, pricePax3: 0, pricePax4: 0, pricePax5: 0, pricePax6: 0 }); }}
                                      className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/30"
                                    >
                                      <X className="h-4 w-4" />
                                    </button>
                                  </div>
                                </td>
                              </>
                            ) : (
                              <>
                                {[1, 2, 3, 4, 5, 6].map(pax => {
                                  const price = existingPrice ? Number(existingPrice[`pricePax${pax}` as keyof SellingPrice]) : 0;
                                  return (
                                    <td key={pax} className="px-4 py-4 text-center font-mono">
                                      {price > 0 ? (
                                        <span className="text-[#c68d79]">{price.toFixed(0)} €</span>
                                      ) : (
                                        <span className="text-white/20">-</span>
                                      )}
                                    </td>
                                  );
                                })}
                                <td className="px-2 py-4">
                                  <button
                                    onClick={() => {
                                      setEditingGuestPrice(priceKey);
                                      setGuestPriceForm({
                                        pricePax1: existingPrice ? Number(existingPrice.pricePax1) : 0,
                                        pricePax2: existingPrice ? Number(existingPrice.pricePax2) : 0,
                                        pricePax3: existingPrice ? Number(existingPrice.pricePax3) : 0,
                                        pricePax4: existingPrice ? Number(existingPrice.pricePax4) : 0,
                                        pricePax5: existingPrice ? Number(existingPrice.pricePax5) : 0,
                                        pricePax6: existingPrice ? Number(existingPrice.pricePax6) : 0,
                                      });
                                    }}
                                    className="p-2 rounded-lg hover:bg-white/[0.06] text-white/40 hover:text-white transition-colors"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </button>
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}

            {/* TAXI HERMAN – guest selling prices (car to/from Port) */}
            {hermanRoutesForPricing.length > 0 && (
              <div className="space-y-4 pt-2">
                <h3 className="text-white/60 text-xs uppercase tracking-[0.15em] font-medium flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-[#c68d79]" />
                  Taxi Herman – avto do/od Porta
                </h3>
                <div className="rounded-2xl border border-white/[0.06] overflow-hidden bg-white/[0.01]">
                  <table className="w-full text-sm">
                    <thead className="bg-white/[0.03] text-white/40">
                      <tr>
                        <th className="px-5 py-4 text-left text-[10px] uppercase tracking-[0.15em] font-medium">Relacija</th>
                        {[1, 2, 3, 4, 5, 6].map(pax => (
                          <th key={pax} className="px-4 py-4 text-center text-[10px] uppercase tracking-[0.15em] font-medium">{pax} pax</th>
                        ))}
                        <th className="px-4 py-4 w-20"></th>
                      </tr>
                    </thead>
                    <tbody className="text-white divide-y divide-white/10">
                      {hermanRoutesForPricing.map((route: Route) => {
                        const priceKey = `taxi-herman-${route.id}`;
                        const existingPrice = getGuestPrice('taxi-herman', route.id);
                        const isEditing = editingGuestPrice === priceKey;
                        return (
                          <tr key={route.id} className="hover:bg-white/[0.02] transition-colors">
                            <td className="px-5 py-4 font-medium">{route.name}</td>
                            {isEditing ? (
                              <>
                                {[1, 2, 3, 4, 5, 6].map(pax => (
                                  <td key={pax} className="px-2 py-4 text-center">
                                    <input
                                      type="number"
                                      value={guestPriceForm[`pricePax${pax}` as keyof typeof guestPriceForm] || ""}
                                      onChange={e => setGuestPriceForm({ ...guestPriceForm, [`pricePax${pax}`]: Number(e.target.value) })}
                                      className="w-16 px-2 py-1.5 rounded-lg bg-white/[0.05] border border-[#c68d79]/30 text-white text-center text-sm font-mono focus:outline-none"
                                    />
                                  </td>
                                ))}
                                <td className="px-2 py-4">
                                  <div className="flex justify-center gap-1">
                                    <button
                                      onClick={() => handleSaveGuestPrice('taxi-herman', route.id)}
                                      className="p-1.5 rounded-lg hover:bg-[#c68d79]/20 text-[#c68d79]"
                                    >
                                      <Check className="h-4 w-4" />
                                    </button>
                                    <button
                                      onClick={() => { setEditingGuestPrice(null); setGuestPriceForm({ pricePax1: 0, pricePax2: 0, pricePax3: 0, pricePax4: 0, pricePax5: 0, pricePax6: 0 }); }}
                                      className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/30"
                                    >
                                      <X className="h-4 w-4" />
                                    </button>
                                  </div>
                                </td>
                              </>
                            ) : (
                              <>
                                {[1, 2, 3, 4, 5, 6].map(pax => {
                                  const price = existingPrice ? Number(existingPrice[`pricePax${pax}` as keyof SellingPrice]) : 0;
                                  return (
                                    <td key={pax} className="px-4 py-4 text-center font-mono">
                                      {price > 0 ? (
                                        <span className="text-[#c68d79]">{price.toFixed(0)} €</span>
                                      ) : (
                                        <span className="text-white/20">-</span>
                                      )}
                                    </td>
                                  );
                                })}
                                <td className="px-2 py-4">
                                  <button
                                    onClick={() => {
                                      setEditingGuestPrice(priceKey);
                                      setGuestPriceForm({
                                        pricePax1: existingPrice ? Number(existingPrice.pricePax1) : 0,
                                        pricePax2: existingPrice ? Number(existingPrice.pricePax2) : 0,
                                        pricePax3: existingPrice ? Number(existingPrice.pricePax3) : 0,
                                        pricePax4: existingPrice ? Number(existingPrice.pricePax4) : 0,
                                        pricePax5: existingPrice ? Number(existingPrice.pricePax5) : 0,
                                        pricePax6: existingPrice ? Number(existingPrice.pricePax6) : 0,
                                      });
                                    }}
                                    className="p-2 rounded-lg hover:bg-white/[0.06] text-white/40 hover:text-white transition-colors"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </button>
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

{/* EXCURSIONS TAB */}
{activeTab === "excursions" && (
  <div className="space-y-8">
  <div className="p-5 rounded-2xl bg-gradient-to-r from-[#7fa8b8]/10 to-[#7fa8b8]/5 border border-[#7fa8b8]/20">
  <p className="text-[#7fa8b8] text-sm leading-relaxed">
  Dobaviteljske cene izletov. Zgoraj so fiksni stroski izleta (vodic, vstopnina, kosilo), spodaj pa cene prevoza po colnih. Klikni na ceno za urejanje.
  </p>
  </div>
  
  {/* Add New Excursion Button */}
  <div className="flex justify-end">
  <button
    onClick={() => setShowAddExcursion(!showAddExcursion)}
    className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#7fa8b8]/20 to-[#7fa8b8]/10 border border-[#7fa8b8]/30 text-[#7fa8b8] text-sm font-medium hover:bg-[#7fa8b8]/20 transition-colors"
  >
    {showAddExcursion ? "Preklici" : "+ Dodaj izlet"}
  </button>
  </div>
  
  {/* Add Excursion Form */}
  {showAddExcursion && (
  <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-4">
    <h3 className="text-white font-medium mb-4">Nov izlet</h3>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <label className="block text-white/40 text-[10px] uppercase tracking-wider mb-2">Ime izleta</label>
        <input
          type="text"
          value={newExcursion.name}
          onChange={e => setNewExcursion({ ...newExcursion, name: e.target.value })}
          className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-[#7fa8b8]/40"
          placeholder="Npr. Lokobe"
        />
      </div>
      <div>
        <label className="block text-white/40 text-[10px] uppercase tracking-wider mb-2">Vodic (Ar)</label>
        <input
          type="number"
          value={newExcursion.guidePriceAr}
          onChange={e => setNewExcursion({ ...newExcursion, guidePriceAr: Number(e.target.value) })}
          className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-[#7fa8b8]/40"
        />
      </div>
      <div>
        <label className="block text-white/40 text-[10px] uppercase tracking-wider mb-2">Vstopnina (Ar)</label>
        <input
          type="number"
          value={newExcursion.entranceFeeAr}
          onChange={e => setNewExcursion({ ...newExcursion, entranceFeeAr: Number(e.target.value) })}
          className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-[#7fa8b8]/40"
        />
      </div>
      <div>
        <label className="block text-white/40 text-[10px] uppercase tracking-wider mb-2">Kosilo (Ar)</label>
        <input
          type="number"
          value={newExcursion.lunchPriceAr}
          onChange={e => setNewExcursion({ ...newExcursion, lunchPriceAr: Number(e.target.value) })}
          className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-[#7fa8b8]/40"
        />
      </div>
    </div>
    <div>
      <label className="block text-white/40 text-[10px] uppercase tracking-wider mb-2">Opis izleta</label>
      <textarea
        value={newExcursion.description}
        onChange={e => setNewExcursion({ ...newExcursion, description: e.target.value })}
        className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-[#7fa8b8]/40 min-h-[80px]"
        placeholder="Opis izleta, kaj vkljucuje, koliko traja..."
      />
    </div>
    <div className="flex justify-end gap-3 pt-2">
      <button
        onClick={() => { setShowAddExcursion(false); setNewExcursion({ name: "", description: "", guidePriceAr: 0, entranceFeeAr: 0, lunchPriceAr: 0 }); }}
        className="px-4 py-2 rounded-xl text-white/50 text-sm hover:text-white transition-colors"
      >
        Preklici
      </button>
      <button
        onClick={async () => {
          if (!newExcursion.name.trim()) return;
          await addExcursion(newExcursion);
          setNewExcursion({ name: "", description: "", guidePriceAr: 0, entranceFeeAr: 0, lunchPriceAr: 0 });
          setShowAddExcursion(false);
          refresh();
        }}
        className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#7fa8b8] to-[#66b5d4] text-white text-sm font-medium"
      >
        Shrani
      </button>
    </div>
  </div>
  )}
  
  {/* Excursion base costs */}
  <div>
  <h3 className="text-white/40 text-[10px] uppercase tracking-[0.2em] font-medium mb-4">Stroski izletov</h3>
  <div className="rounded-2xl border border-white/[0.06] overflow-hidden bg-white/[0.01]">
  <table className="w-full text-sm">
  <thead className="bg-white/[0.03] text-white/40">
  <tr>
  <th className="px-5 py-4 text-left text-[10px] uppercase tracking-[0.15em] font-medium">Izlet</th>
  <th className="px-5 py-4 text-right text-[10px] uppercase tracking-[0.15em] font-medium">Vodic (Ar)</th>
  <th className="px-5 py-4 text-right text-[10px] uppercase tracking-[0.15em] font-medium">Vstopnina (Ar)</th>
  <th className="px-5 py-4 text-right text-[10px] uppercase tracking-[0.15em] font-medium">Kosilo (Ar)</th>
  <th className="px-5 py-4 w-32"></th>
  </tr>
  </thead>
  <tbody className="text-white divide-y divide-white/10">
  {excursions.map((exc: Excursion) => {
  const isEditing = editingExcursion === exc.id;
  return (
  <tr key={exc.id} className="hover:bg-white/[0.02] transition-colors">
  <td className="px-5 py-4">
    <div className="flex items-start gap-3">
      {/* Image thumbnail */}
      <div className="flex-shrink-0">
        {isEditing ? (
          <div className="space-y-2">
            {(excursionForm.imageUrl ?? exc.imageUrl) && (
              <img src={excursionForm.imageUrl ?? exc.imageUrl ?? ""} alt={exc.name} className="w-16 h-16 rounded-lg object-cover" />
            )}
            <label className="flex items-center justify-center w-16 h-8 rounded-lg bg-[#7fa8b8]/20 border border-[#7fa8b8]/30 text-[#7fa8b8] text-[10px] cursor-pointer hover:bg-[#7fa8b8]/30 transition-colors">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const formData = new FormData();
                  formData.append('file', file);
                  try {
                    const res = await fetch('/api/upload-excursion-image', { method: 'POST', body: formData });
                    const data = await res.json();
                    if (data.url) {
                      setExcursionForm({ ...excursionForm, imageUrl: data.url });
                    }
                  } catch (err) {
                    console.error('Upload failed:', err);
                  }
                }}
              />
              Nalozi
            </label>
          </div>
        ) : exc.imageUrl ? (
          <img src={exc.imageUrl} alt={exc.name} className="w-16 h-16 rounded-lg object-cover" />
        ) : (
          <div className="w-16 h-16 rounded-lg bg-white/[0.05] flex items-center justify-center">
            <Compass className="w-6 h-6 text-white/20" />
          </div>
        )}
      </div>
      {/* Name and description */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {isEditing ? (
            <input
              type="text"
              value={excursionForm.name ?? exc.name}
              onChange={e => setExcursionForm({ ...excursionForm, name: e.target.value })}
              className="w-full px-3 py-1.5 rounded-lg bg-white/[0.05] border border-[#7fa8b8]/30 text-white text-sm font-medium focus:outline-none"
              placeholder="Ime izleta..."
            />
          ) : (
            <span className="font-medium">{exc.name}</span>
          )}
          {exc.duplicatedAt && (
            <button
              type="button"
              onClick={async () => { await clearExcursionDuplicateFlag(exc.id); refresh(); }}
              title="Podvojen izlet - klikni da odstranis oznako NOVO"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#c59b5b]/20 border border-[#c59b5b]/40 text-[#e0c68a] text-[9px] font-semibold uppercase tracking-wider hover:bg-[#c59b5b]/30 transition-colors"
            >
              <Sparkles className="h-3 w-3" />
              Novo
            </button>
          )}
        </div>
        {isEditing ? (
          <textarea
            value={excursionForm.description ?? exc.description ?? ""}
            onChange={e => setExcursionForm({ ...excursionForm, description: e.target.value })}
            className="mt-2 w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-[#7fa8b8]/30 text-white text-sm focus:outline-none min-h-[60px]"
            placeholder="Opis izleta..."
          />
        ) : exc.description ? (
          <p className="text-xs text-white/40 mt-1 line-clamp-2">{exc.description}</p>
        ) : null}
      </div>
    </div>
  </td>
  <td className="px-5 py-4 text-right font-mono">
  {isEditing ? (
  <input
  type="number"
  value={excursionForm.guidePriceAr ?? exc.guidePriceAr}
  onChange={e => setExcursionForm({ ...excursionForm, guidePriceAr: Number(e.target.value) })}
  className="w-28 px-3 py-1.5 rounded-lg bg-white/[0.05] border border-[#7fa8b8]/30 text-white text-right focus:outline-none"
  />
  ) : (
  <div>
  <span className="text-white">{ar(exc.guidePriceAr)}</span>
  <p className="text-[10px] text-[#c59b5b]/60 mt-0.5">= {eur(arToEur(exc.guidePriceAr, exchangeRate))}</p>
  </div>
                            )}
                          </td>
                          <td className="px-5 py-4 text-right font-mono">
                            {isEditing ? (
                              <input
                                type="number"
                                value={excursionForm.entranceFeeAr ?? exc.entranceFeeAr}
                                onChange={e => setExcursionForm({ ...excursionForm, entranceFeeAr: Number(e.target.value) })}
                                className="w-28 px-3 py-1.5 rounded-lg bg-white/[0.05] border border-[#7fa8b8]/30 text-white text-right focus:outline-none"
                              />
                            ) : (
                              exc.entranceFeeAr > 0 ? (
                                <div>
                                  <span className="text-white">{ar(exc.entranceFeeAr)}</span>
                                  <p className="text-[10px] text-[#c59b5b]/60 mt-0.5">= {eur(arToEur(exc.entranceFeeAr, exchangeRate))}</p>
                                </div>
                              ) : <span className="text-white/20">-</span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-right font-mono">
                            {isEditing ? (
                              <input
                                type="number"
                                value={excursionForm.lunchPriceAr ?? exc.lunchPriceAr}
                                onChange={e => setExcursionForm({ ...excursionForm, lunchPriceAr: Number(e.target.value) })}
                                className="w-28 px-3 py-1.5 rounded-lg bg-white/[0.05] border border-[#7fa8b8]/30 text-white text-right focus:outline-none"
                              />
                            ) : (
                              exc.lunchPriceAr > 0 ? (
                                <div>
                                  <span className="text-white">{ar(exc.lunchPriceAr)}</span>
                                  <p className="text-[10px] text-[#c59b5b]/60 mt-0.5">= {eur(arToEur(exc.lunchPriceAr, exchangeRate))}</p>
                                </div>
                              ) : <span className="text-white/20">-</span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-right">
                            {isEditing ? (
                              <div className="flex justify-end gap-1">
                                <button onClick={() => handleSaveExcursion(exc.id)} className="p-2 rounded-lg hover:bg-[#7fa8b8]/20 text-[#7fa8b8]">
                                  <Check className="h-4 w-4" />
                                </button>
                                <button onClick={() => { setEditingExcursion(null); setExcursionForm({}); }} className="p-2 rounded-lg hover:bg-white/[0.06] text-white/30">
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
) : (
<div className="flex items-center gap-1">
<button onClick={() => { setEditingExcursion(exc.id); setExcursionForm({}); }} className="p-2 rounded-lg hover:bg-white/[0.06] text-white/40 hover:text-white transition-colors" title="Uredi">
  <Pencil className="h-4 w-4" />
</button>
<button
  onClick={async () => {
    if (confirm(`Podvoji izlet "${exc.name}"? Kopirajo se tudi nabavne cene in cene za goste.`)) {
      await duplicateExcursion(exc.id);
      refresh();
    }
  }}
  className="p-2 rounded-lg hover:bg-[#c59b5b]/15 text-white/40 hover:text-[#e0c68a] transition-colors"
  title="Podvoji izlet (skupaj s ceniki)"
>
  <Copy className="h-4 w-4" />
</button>
<button 
  onClick={async () => { 
    if (confirm(`Izbrisi izlet "${exc.name}"?`)) { 
      await deleteExcursion(exc.id); 
      refresh(); 
    } 
  }} 
  className="p-2 rounded-lg hover:bg-red-500/10 text-white/40 hover:text-red-400 transition-colors"
  title="Izbrisi"
>
  <Trash2 className="h-4 w-4" />
</button>
</div>
)}
</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Excursion boat pricing matrix */}
            <div>
              <h3 className="text-white/40 text-[10px] uppercase tracking-[0.2em] font-medium mb-4">Cene prevoza po colnih</h3>
              <div className="rounded-2xl border border-white/[0.06] overflow-x-auto bg-white/[0.01]">
                <table className="w-full text-sm">
                  <thead className="bg-white/[0.03] text-white/40">
                    <tr>
                      <th className="px-5 py-4 sticky left-0 bg-[#162227] border-r border-white/[0.06]">
                        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.15em] font-medium">
                          <Compass className="h-4 w-4 text-[#7fa8b8]" />
                          Izlet / Coln
                        </div>
                      </th>
                      {boats.map((boat: Boat) => (
                        <th key={boat.id} className="px-5 py-4 text-center min-w-[130px]">
                          <div className="flex flex-col items-center gap-1">
                            <Ship className="h-3.5 w-3.5 text-[#7fa8b8]/60" />
                            <span className="text-[10px] uppercase tracking-[0.1em] font-medium">{boat.name}</span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="text-white divide-y divide-white/10">
                    {excursions.map((excursion: Excursion) => (
                      <tr key={excursion.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-5 py-4 sticky left-0 bg-[#162227] border-r border-white/[0.06]">
                          <div className="font-medium text-white">{excursion.name}</div>
                        </td>
                        {boats.map((boat: Boat) => {
                          const priceKey = `${excursion.id}-${boat.id}`;
                          const price = getExcursionPrice(excursion.id, boat.id);
                          const supplierPrice = getExcursionSupplierPrice(excursion.id, boat.id);
                          const isEditing = editingPrice === priceKey;
                          
                          return (
                            <td key={boat.id} className="px-5 py-4 text-center">
                              {isEditing ? (
                                <div className="flex items-center justify-center gap-1">
                                  <input
                                    type="number"
                                    value={editPriceValue}
                                    onChange={e => setEditPriceValue(Number(e.target.value))}
                                    className="w-28 px-3 py-1.5 rounded-lg bg-white/[0.05] border border-[#7fa8b8]/30 text-white text-right text-sm font-mono focus:outline-none"
                                    autoFocus
                                  />
                                  <button
                                    onClick={() => handleSaveExcursionPrice(excursion.id, boat.id)}
                                    className="p-1.5 rounded-lg hover:bg-[#7fa8b8]/20 text-[#7fa8b8]"
                                  >
                                    <Check className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => setEditingPrice(null)}
                                    className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/30"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => {
                                    setEditingPrice(priceKey);
                                    setEditPriceValue(price);
                                  }}
                                  className="px-4 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-white/10 transition-all font-mono text-sm min-w-[120px]"
                                >
                                  {price > 0 ? (
                                    <div>
                                      <span className="text-white">{ar(price)}</span>
                                      <p className="text-[10px] text-[#c59b5b]/60 mt-0.5">= {eur(arToEur(price, exchangeRate))}</p>
                                      <p className="text-[10px] text-[#8fae92]/70 mt-1 border-t border-white/10 pt-1">Dilip: {ar(supplierPrice)}</p>
                                    </div>
                                  ) : <span className="text-white/20">-</span>}
                                </button>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* EXCURSION GUEST PRICING TAB */}
        {activeTab === "excursionGuestPricing" && (
          <div className="space-y-6">
            <div className="p-5 rounded-2xl bg-gradient-to-r from-[#ddb2a3]/10 to-[#ddb2a3]/5 border border-[#ddb2a3]/20">
              <p className="text-[#ddb2a3] text-sm leading-relaxed">
                Prodajne cene izletov za goste v EUR. Cene so po stevilu oseb (1-6 pax). Klikni na vrstico za urejanje vseh cen.
              </p>
            </div>

            {excursions.map((excursion: Excursion) => (
              <div key={excursion.id} className="space-y-4">
                <h3 className="text-white/60 text-xs uppercase tracking-[0.15em] font-medium flex items-center gap-2">
                  <Compass className="h-4 w-4 text-[#ddb2a3]" />
                  {excursion.name}
                </h3>
                <div className="rounded-2xl border border-white/[0.06] overflow-hidden bg-white/[0.01]">
                  <table className="w-full text-sm">
                    <thead className="bg-white/[0.03] text-white/40">
                      <tr>
                        <th className="px-5 py-4 text-left text-[10px] uppercase tracking-[0.15em] font-medium">Coln</th>
                        <th className="px-4 py-4 text-center text-[10px] uppercase tracking-[0.15em] font-medium">1 pax</th>
                        <th className="px-4 py-4 text-center text-[10px] uppercase tracking-[0.15em] font-medium">2 pax</th>
                        <th className="px-4 py-4 text-center text-[10px] uppercase tracking-[0.15em] font-medium">3 pax</th>
                        <th className="px-4 py-4 text-center text-[10px] uppercase tracking-[0.15em] font-medium">4 pax</th>
                        <th className="px-4 py-4 text-center text-[10px] uppercase tracking-[0.15em] font-medium">5 pax</th>
                        <th className="px-4 py-4 text-center text-[10px] uppercase tracking-[0.15em] font-medium">6 pax</th>
                        <th className="px-4 py-4 w-20"></th>
                      </tr>
                    </thead>
                    <tbody className="text-white divide-y divide-white/10">
                      {guestBoats.map((boat: Boat) => {
                        const priceKey = `${excursion.id}-${boat.id}`;
                        const existingPrice = getExcGuestPrice(excursion.id, boat.id);
                        const isEditing = editingExcGuestPrice === priceKey;
                        
                        return (
                          <tr key={boat.id} className="hover:bg-white/[0.02] transition-colors">
                            <td className="px-5 py-4">
                              <div className="font-medium">{boat.name}</div>
                              <div className="text-[11px] text-white/30">{boat.engine} | max {boat.maxPax} pax</div>
                            </td>
                            {isEditing ? (
                              <>
                                {[1, 2, 3, 4, 5, 6].map(pax => (
                                  <td key={pax} className="px-2 py-4 text-center">
                                    <input
                                      type="number"
                                      value={excGuestPriceForm[`pricePax${pax}` as keyof typeof excGuestPriceForm] || ""}
                                      onChange={e => setExcGuestPriceForm({ ...excGuestPriceForm, [`pricePax${pax}`]: Number(e.target.value) })}
                                      className="w-16 px-2 py-1.5 rounded-lg bg-white/[0.05] border border-[#ddb2a3]/30 text-white text-center text-sm font-mono focus:outline-none"
                                    />
                                  </td>
                                ))}
                                <td className="px-2 py-4">
                                  <div className="flex justify-center gap-1">
                                    <button
                                      onClick={() => handleSaveExcGuestPrice(excursion.id, boat.id)}
                                      className="p-1.5 rounded-lg hover:bg-[#ddb2a3]/20 text-[#ddb2a3]"
                                    >
                                      <Check className="h-4 w-4" />
                                    </button>
                                    <button
                                      onClick={() => { setEditingExcGuestPrice(null); setExcGuestPriceForm({ pricePax1: 0, pricePax2: 0, pricePax3: 0, pricePax4: 0, pricePax5: 0, pricePax6: 0 }); }}
                                      className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/30"
                                    >
                                      <X className="h-4 w-4" />
                                    </button>
                                  </div>
                                </td>
                              </>
                            ) : (
                              <>
                                {[1, 2, 3, 4, 5, 6].map(pax => {
                                  const price = existingPrice ? Number(existingPrice[`pricePax${pax}` as keyof ExcursionSellingPrice]) : 0;
                                  return (
                                    <td key={pax} className="px-4 py-4 text-center font-mono">
                                      {price > 0 ? (
                                        <span className="text-[#ddb2a3]">{price.toFixed(0)} €</span>
                                      ) : (
                                        <span className="text-white/20">-</span>
                                      )}
                                    </td>
                                  );
                                })}
                                <td className="px-2 py-4">
                                  <button
                                    onClick={() => {
                                      setEditingExcGuestPrice(priceKey);
                                      setExcGuestPriceForm({
                                        pricePax1: existingPrice ? Number(existingPrice.pricePax1) : 0,
                                        pricePax2: existingPrice ? Number(existingPrice.pricePax2) : 0,
                                        pricePax3: existingPrice ? Number(existingPrice.pricePax3) : 0,
                                        pricePax4: existingPrice ? Number(existingPrice.pricePax4) : 0,
                                        pricePax5: existingPrice ? Number(existingPrice.pricePax5) : 0,
                                        pricePax6: existingPrice ? Number(existingPrice.pricePax6) : 0,
                                      });
                                    }}
                                    className="p-2 rounded-lg hover:bg-white/[0.06] text-white/40 hover:text-white transition-colors"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </button>
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* LUNCH PROVIDERS TAB */}
        {activeTab === "lunchProviders" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-white/40">Ponudniki kosila za izlete. Tukaj dodajate in urejate ponudnike kosil z lokacijo in ceno na osebo.</p>
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#be6e51] to-[#b46142] text-[#0a2029] text-sm font-semibold hover:shadow-[0_4px_20px_rgba(196,116,74,0.3)] transition-all"
              >
                <Plus className="h-4 w-4" />
                Dodaj ponudnika
              </button>
            </div>
            
            {showAddForm && (
              <div className="rounded-2xl border border-[#be6e51]/20 bg-[#be6e51]/5 p-6">
                <h4 className="text-sm font-medium text-white mb-4">Nov ponudnik kosila</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <input
                    type="text"
                    placeholder="Ime ponudnika"
                    className="px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white placeholder-white/30 focus:border-[#be6e51]/40 focus:outline-none"
                    id="newLunchName"
                  />
                  <input
                    type="text"
                    placeholder="Lokacija (npr. Nosy Komba)"
                    className="px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white placeholder-white/30 focus:border-[#be6e51]/40 focus:outline-none"
                    id="newLunchLocation"
                  />
                  <input
                    type="number"
                    placeholder="Cena na osebo (Ar)"
                    className="px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white placeholder-white/30 focus:border-[#be6e51]/40 focus:outline-none"
                    id="newLunchPrice"
                  />
                </div>
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={async () => {
                      const name = (document.getElementById("newLunchName") as HTMLInputElement).value;
                      const location = (document.getElementById("newLunchLocation") as HTMLInputElement).value;
                      const pricePerPersonAr = Number((document.getElementById("newLunchPrice") as HTMLInputElement).value);
                      if (name && pricePerPersonAr > 0) {
                        await addLunchProvider({ name, location, pricePerPersonAr });
                        mutate();
                        setShowAddForm(false);
                      }
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#be6e51] text-[#0a2029] text-sm font-semibold hover:bg-[#b46142] transition-colors"
                  >
                    <Check className="h-4 w-4" />
                    Shrani
                  </button>
                  <button
                    onClick={() => setShowAddForm(false)}
                    className="px-5 py-2.5 rounded-xl bg-white/[0.05] text-white/60 text-sm font-medium hover:bg-white/[0.1] transition-colors"
                  >
                    Preklici
                  </button>
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-white/[0.06] bg-[rgba(15,46,58,0.4)] overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="px-5 py-4 text-left text-[10px] uppercase tracking-[0.15em] font-medium text-white/40">Ime ponudnika</th>
                    <th className="px-5 py-4 text-left text-[10px] uppercase tracking-[0.15em] font-medium text-white/40">Lokacija</th>
                    <th className="px-5 py-4 text-right text-[10px] uppercase tracking-[0.15em] font-medium text-white/40">Cena / osebo (Ar)</th>
                    <th className="px-5 py-4 text-right text-[10px] uppercase tracking-[0.15em] font-medium text-white/40">Cena (EUR)</th>
                    <th className="px-5 py-4 w-24"></th>
                  </tr>
                </thead>
                <tbody>
                  {data?.lunchProviders?.map((provider: { id: string; name: string; location: string | null; pricePerPersonAr: number }) => (
                    <tr key={provider.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                      {editingId === provider.id ? (
                        <>
                          <td className="px-5 py-4">
                            <input
                              type="text"
                              defaultValue={provider.name}
                              className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.1] text-white text-sm focus:border-[#be6e51]/40 focus:outline-none"
                              id={`edit-name-${provider.id}`}
                            />
                          </td>
                          <td className="px-5 py-4">
                            <input
                              type="text"
                              defaultValue={provider.location || ''}
                              className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.1] text-white text-sm focus:border-[#be6e51]/40 focus:outline-none"
                              id={`edit-location-${provider.id}`}
                            />
                          </td>
                          <td className="px-5 py-4">
                            <input
                              type="number"
                              defaultValue={provider.pricePerPersonAr}
                              className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.1] text-white text-sm text-right focus:border-[#be6e51]/40 focus:outline-none"
                              id={`edit-price-${provider.id}`}
                            />
                          </td>
                          <td className="px-5 py-4 text-right text-sm text-white/40">-</td>
                          <td className="px-5 py-4">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={async () => {
                                  const name = (document.getElementById(`edit-name-${provider.id}`) as HTMLInputElement).value;
                                  const location = (document.getElementById(`edit-location-${provider.id}`) as HTMLInputElement).value;
                                  const pricePerPersonAr = Number((document.getElementById(`edit-price-${provider.id}`) as HTMLInputElement).value);
                                  await updateLunchProvider(provider.id, { name, location, pricePerPersonAr });
                                  mutate();
                                  setEditingId(null);
                                }}
                                className="p-2 rounded-lg bg-[#be6e51]/20 text-[#be6e51] hover:bg-[#be6e51]/30 transition-colors"
                              >
                                <Check className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="p-2 rounded-lg bg-white/[0.05] text-white/40 hover:bg-white/[0.1] transition-colors"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-5 py-4 text-sm text-white font-medium">{provider.name}</td>
                          <td className="px-5 py-4 text-sm text-white/60">{provider.location || '-'}</td>
                          <td className="px-5 py-4 text-right">
                            <span className="text-white font-medium">{ar(provider.pricePerPersonAr)}</span>
                          </td>
                          <td className="px-5 py-4 text-right">
                            <span className="text-[#c59b5b]/60 text-sm">{eur(arToEur(provider.pricePerPersonAr, exchangeRate))}</span>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => setEditingId(provider.id)}
                                className="p-2 rounded-lg hover:bg-white/[0.06] text-white/40 hover:text-white transition-colors"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                onClick={async () => {
                                  if (confirm(`Res zelis izbrisati ponudnika "${provider.name}"?`)) {
                                    await deleteLunchProvider(provider.id);
                                    mutate();
                                  }
                                }}
                                className="p-2 rounded-lg hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-colors"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* STAFF TAB */}
        {activeTab === "staff" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-white/40">Delavci z dostopom do Staff aplikacije za dodajanje artiklov na dobavnico.</p>
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#8fae92] to-[#76b27c] text-[#0a2029] text-sm font-semibold hover:shadow-[0_4px_20px_rgba(143,174,146,0.3)] transition-all"
              >
                <Plus className="h-4 w-4" />
                Dodaj delavca
              </button>
            </div>
            
            {showAddForm && (
              <div className="rounded-2xl border border-[#8fae92]/20 bg-[#8fae92]/5 p-6">
                <h4 className="text-sm font-medium text-white mb-4">Nov delavec</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <input
                    type="text"
                    placeholder="Ime"
                    className="px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white placeholder-white/30 focus:border-[#8fae92]/40 focus:outline-none"
                    id="newStaffName"
                  />
                  <select
                    className="px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white focus:border-[#8fae92]/40 focus:outline-none"
                    id="newStaffRole"
                    defaultValue="barman"
                  >
                    <option value="barman" className="bg-[#0a2029]">Barman</option>
                    <option value="receptor" className="bg-[#0a2029]">Receptor</option>
                    <option value="admin" className="bg-[#0a2029]">Admin</option>
                  </select>
                  <input
                    type="text"
                    placeholder="PIN (4 stevke)"
                    maxLength={4}
                    className="px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white placeholder-white/30 focus:border-[#8fae92]/40 focus:outline-none"
                    id="newStaffPin"
                  />
                </div>
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={async () => {
                      const name = (document.getElementById("newStaffName") as HTMLInputElement).value;
                      const role = (document.getElementById("newStaffRole") as HTMLSelectElement).value;
                      const pin = (document.getElementById("newStaffPin") as HTMLInputElement).value;
                      if (name && pin.length === 4) {
                        await addStaff({ name, role, pin });
                        mutate();
                        setShowAddForm(false);
                      }
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#8fae92] text-[#0a2029] text-sm font-semibold hover:bg-[#76b27c] transition-colors"
                  >
                    <Check className="h-4 w-4" />
                    Shrani
                  </button>
                  <button
                    onClick={() => setShowAddForm(false)}
                    className="px-5 py-2.5 rounded-xl bg-white/[0.05] text-white/60 text-sm font-medium hover:bg-white/[0.1] transition-colors"
                  >
                    Preklici
                  </button>
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-white/[0.06] bg-[rgba(15,46,58,0.4)] overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="px-5 py-4 text-left text-[10px] uppercase tracking-[0.15em] font-medium text-white/40">Ime</th>
                    <th className="px-5 py-4 text-left text-[10px] uppercase tracking-[0.15em] font-medium text-white/40">Vloga</th>
                    <th className="px-5 py-4 text-left text-[10px] uppercase tracking-[0.15em] font-medium text-white/40">PIN</th>
                    <th className="px-5 py-4 w-24"></th>
                  </tr>
                </thead>
                <tbody>
                  {data?.staffMembers?.map((s: { id: string; name: string; role: string; pin: string }) => (
                    <tr key={s.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                      {editingId === s.id ? (
                        <>
                          <td className="px-5 py-4">
                            <input
                              type="text"
                              defaultValue={s.name}
                              className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.1] text-white text-sm focus:border-[#8fae92]/40 focus:outline-none"
                              id={`edit-name-${s.id}`}
                            />
                          </td>
                          <td className="px-5 py-4">
                            <select
                              defaultValue={s.role}
                              className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.1] text-white text-sm focus:border-[#8fae92]/40 focus:outline-none"
                              id={`edit-role-${s.id}`}
                            >
                              <option value="barman" className="bg-[#0a2029]">Barman</option>
                              <option value="receptor" className="bg-[#0a2029]">Receptor</option>
                              <option value="admin" className="bg-[#0a2029]">Admin</option>
                            </select>
                          </td>
                          <td className="px-5 py-4">
                            <input
                              type="text"
                              defaultValue={s.pin}
                              maxLength={4}
                              className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.1] text-white text-sm focus:border-[#8fae92]/40 focus:outline-none"
                              id={`edit-pin-${s.id}`}
                            />
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={async () => {
                                  const name = (document.getElementById(`edit-name-${s.id}`) as HTMLInputElement).value;
                                  const role = (document.getElementById(`edit-role-${s.id}`) as HTMLSelectElement).value;
                                  const pin = (document.getElementById(`edit-pin-${s.id}`) as HTMLInputElement).value;
                                  await updateStaff(s.id, { name, role, pin });
                                  mutate();
                                  setEditingId(null);
                                }}
                                className="p-2 rounded-lg bg-[#8fae92]/20 text-[#8fae92] hover:bg-[#8fae92]/30 transition-colors"
                              >
                                <Check className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="p-2 rounded-lg bg-white/[0.05] text-white/40 hover:bg-white/[0.1] transition-colors"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-5 py-4 text-sm text-white font-medium">{s.name}</td>
                          <td className="px-5 py-4">
                            <span className={`text-xs px-2 py-1 rounded-lg ${
                              s.role === 'admin' ? 'bg-[#c59b5b]/20 text-[#c59b5b]' : 
                              s.role === 'receptor' ? 'bg-[#7fa8b8]/20 text-[#7fa8b8]' : 
                              'bg-[#8fae92]/20 text-[#8fae92]'
                            }`}>
                              {s.role}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-sm text-white/60 font-mono">{s.pin}</td>
                          <td className="px-5 py-4">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => setEditingId(s.id)}
                                className="p-2 rounded-lg hover:bg-white/[0.06] text-white/40 hover:text-white transition-colors"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                onClick={async () => {
                                  if (confirm(`Res zelis odstraniti delavca "${s.name}"?`)) {
                                    await deleteStaff(s.id);
                                    mutate();
                                  }
                                }}
                                className="p-2 rounded-lg hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-colors"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
