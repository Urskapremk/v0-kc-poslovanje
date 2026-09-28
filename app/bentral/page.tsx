"use client";

import React from "react";
import Link from "next/link";
import { RefreshCw, ArrowLeft, Database, Search, X, Check, ArrowUp, ArrowDown } from "lucide-react";
import { LuxuryButton, LuxuryBadge, LuxurySelect, GlassCard, SectionHeader } from "@/components/komba/ui/luxury-components";
import { getBentralReservations, importBentralCSV, transferBentralReservation } from "@/app/actions/komba";

export default function BentralPage() {
  const [bentralData, setBentralData] = React.useState<{
    id: string; externalId: string; status: string; source: string | null; guestName: string;
    country: string | null; checkIn: string; checkOut: string; nights: number; adults: number;
    children: number; childrenAges: string | null; units: string | null; currency: string | null;
    amount: string; guestNotes: string | null; ownNotes: string | null;
    transferred: boolean | null; reservationId: string | null;
  }[] | null>(null);
  const [importing, setImporting] = React.useState(false);
  const [transferring, setTransferring] = React.useState<string | null>(null);
  const [importResult, setImportResult] = React.useState<{ imported: number; updated: number; skipped: number } | null>(null);
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [search, setSearch] = React.useState("");
  const [showTransferred, setShowTransferred] = React.useState(false);
  // Privzeto skrijemo preklicane / brez odziva in pretekla bivanja — uporabnico motijo
  const [hideDeclined, setHideDeclined] = React.useState(true);
  const [fromToday, setFromToday] = React.useState(true);
  // Razvrstitev po datumu prihoda: true = najprej najblizji datum
  const [sortAsc, setSortAsc] = React.useState(true);
  const [message, setMessage] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  function showMsg(msg: string) {
    setMessage(msg);
    setTimeout(() => setMessage(null), 3000);
  }

  async function loadBentralData() {
    const data = await getBentralReservations({ status: statusFilter });
    setBentralData(data as typeof bentralData);
  }

  React.useEffect(() => { loadBentralData(); }, [statusFilter]);

  // Danes v obliki YYYY-MM-DD (checkIn/checkOut sta ISO niza, zato zadostuje primerjava nizov)
  const today = React.useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  // Statusi so v bazi mesano slovenski (uvoz) in angleski (Bentral izvoz), zato prepoznavamo oboje
  const isDeclined = (status: string) => /cancel|preklic|no response|ni odziva/i.test(String(status || ""));
  // "Od danes naprej" pusti tudi bivanja, ki so v teku (odhod še ni minil)
  const isPast = (r: { checkOut: string }) => String(r.checkOut).slice(0, 10) < today;

  // Visible reservations = status/transferred/date filters + free-text search (name,
  // booking id, country, bungalow units). Case-insensitive, matches any field.
  const q = search.trim().toLowerCase();
  const visibleReservations = bentralData
    ? bentralData.filter(r => {
        if (!showTransferred && r.transferred) return false;
        // Če v spustnem meniju izrecno izbere Preklicano / Ni odziva, preklop ne sme vsega poskriti
        if (hideDeclined && !isDeclined(statusFilter) && isDeclined(r.status)) return false;
        if (fromToday && isPast(r)) return false;
        if (!q) return true;
        return [r.guestName, r.externalId, r.country, r.units]
          .some(v => (v ? String(v).toLowerCase().includes(q) : false));
      })
      // Razvrstitev po datumu prihoda (filter vrne nov seznam, zato sort ne spremeni izvirnika)
      .sort((a, b) => {
        const av = String(a.checkIn).slice(0, 10);
        const bv = String(b.checkIn).slice(0, 10);
        return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      })
    : null;

  // Koliko zapisov skrijeta preklopa — da uporabnica ve, da niso izgubljeni
  const hiddenDeclined = bentralData && hideDeclined && !isDeclined(statusFilter)
    ? bentralData.filter(r => isDeclined(r.status)).length
    : 0;
  const hiddenPast = bentralData && fromToday ? bentralData.filter(r => isPast(r) && !(hideDeclined && isDeclined(r.status))).length : 0;

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setImporting(true);
    setImportResult(null);
    
    try {
      const text = await file.text();
      const result = await importBentralCSV(text);
      setImportResult(result);
      loadBentralData();
      showMsg(`Import uspesen: ${result.imported} novih, ${result.updated} posodobljenih`);
    } catch {
      showMsg("Napaka pri importu!");
    }
    
    setImporting(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleTransfer(id: string) {
    setTransferring(id);
    try {
      await transferBentralReservation(id);
      showMsg("Rezervacija prenesena v sistem!");
      loadBentralData();
    } catch {
      showMsg("Napaka pri prenosu!");
    }
    setTransferring(null);
  }

  const statusOptions = [
    { value: "all", label: "Vsi statusi" },
    { value: "Potrjeno", label: "Potrjeno" },
    { value: "Plačano (1. del)", label: "Placano (1. del)" },
    { value: "Ponudba", label: "Ponudba" },
    { value: "Preklicano", label: "Preklicano" },
    { value: "Ni odziva", label: "Ni odziva" },
  ];

  const getStatusVariant = (status: string): "petrol" | "gold" | "ocean" | "danger" | "default" => {
    if (status === "Potrjeno") return "petrol";
    if (status === "Plačano (1. del)") return "ocean";
    if (status === "Ponudba") return "gold";
    if (status === "Preklicano") return "danger";
    return "default";
  };

  const getSourceBadge = (source: string | null) => {
    if (!source) return <LuxuryBadge variant="gold">Direct</LuxuryBadge>;
    if (source === "Booking.com") return <LuxuryBadge variant="ocean">Booking</LuxuryBadge>;
    if (source === "Airbnb") return <LuxuryBadge variant="danger">Airbnb</LuxuryBadge>;
    return <LuxuryBadge>{source}</LuxuryBadge>;
  };

  return (
    <main className="min-h-screen bg-[#0b2731] px-4 py-8">
      {/* Toast */}
      {message && (
        <div className="fixed top-4 right-4 z-50 rounded-xl bg-[#8fae92] px-4 py-2 text-sm font-medium text-[#0b2731] shadow-lg">
          {message}
        </div>
      )}

      <div className="mx-auto max-w-6xl space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70 transition-all hover:bg-white/10 hover:text-white">
              <ArrowLeft className="h-4 w-4" />
              Nazaj
            </Link>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#7fa8b8]/20">
                <Database className="h-5 w-5 text-[#7fa8b8]" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Bentral</h1>
                <p className="text-xs text-white/50">Channel Manager</p>
              </div>
            </div>
          </div>
        </div>

        {/* Import Section */}
        <GlassCard>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <SectionHeader eyebrow="Channel Manager" title="Bentral Rezervacije" subtitle="Uvozi rezervacije iz Bentral sistema" />
            <div className="flex gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
              />
              <LuxuryButton variant="petrol" onClick={() => fileInputRef.current?.click()} disabled={importing}>
                {importing ? "Uvazam..." : "Uvozi CSV"}
              </LuxuryButton>
            </div>
          </div>

          {importResult && (
            <div className="mt-4 rounded-2xl border border-[#8fae92]/30 bg-[#8fae92]/10 p-4">
              <p className="text-sm text-[#8fae92]">
                Import zakljucen: <strong>{importResult.imported}</strong> novih rezervacij, <strong>{importResult.updated}</strong> posodobljenih, <strong>{importResult.skipped}</strong> preskocenih
              </p>
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-end gap-4">
            <div className="w-48">
              <LuxurySelect label="Filter po statusu" value={statusFilter} onChange={setStatusFilter} options={statusOptions} />
            </div>
            <div className="min-w-[220px] flex-1">
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">Isci</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Ime gosta, st. rezervacije, drzava, bungalov..."
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-2.5 pl-9 pr-9 text-sm text-white placeholder:text-white/30 focus:border-[#c59b5b]/40 focus:outline-none"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
                    aria-label="Pocisti iskanje"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Hitra preklopa — privzeto vklopljena, da je seznam kratek in pregleden */}
          <div className="mt-4 flex flex-wrap gap-2">
            {[
              {
                on: fromToday,
                toggle: () => setFromToday(!fromToday),
                label: "Od danes naprej",
                hidden: hiddenPast,
                title: "Skrije bivanja, ki so se ze koncala",
              },
              {
                on: hideDeclined,
                toggle: () => setHideDeclined(!hideDeclined),
                label: "Brez preklicanih",
                hidden: hiddenDeclined,
                title: "Skrije rezervacije s statusom Preklicano ali Ni odziva",
              },
            ].map(t => (
              <button
                key={t.label}
                type="button"
                onClick={t.toggle}
                aria-pressed={t.on}
                title={t.title}
                className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-xs transition-colors ${
                  t.on
                    ? "border-[#c59b5b]/45 bg-[#c59b5b]/15 text-[#e8c88a]"
                    : "border-white/10 bg-white/[0.03] text-white/50 hover:bg-white/[0.06]"
                }`}
              >
                {t.on ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                <span className="font-medium tracking-[0.04em]">{t.label}</span>
                {t.on && t.hidden > 0 && (
                  <span className="rounded bg-[#c59b5b]/20 px-1.5 py-0.5 text-[9px] tabular-nums">{t.hidden} skritih</span>
                )}
              </button>
            ))}

            {/* Razvrstitev po datumu prihoda — klik obrne smer */}
            <button
              type="button"
              onClick={() => setSortAsc(!sortAsc)}
              title={sortAsc ? "Razvrsceno po prihodu: najprej najblizji datum" : "Razvrsceno po prihodu: najprej najpoznejsi datum"}
              className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/60 transition-colors hover:bg-white/[0.06]"
            >
              {sortAsc ? <ArrowUp className="h-3.5 w-3.5 text-[#c59b5b]" /> : <ArrowDown className="h-3.5 w-3.5 text-[#c59b5b]" />}
              <span className="font-medium tracking-[0.04em]">Prihod</span>
              <span className="text-[9px] text-white/40">{sortAsc ? "najprej najblizji" : "najprej najpoznejsi"}</span>
            </button>
          </div>
        </GlassCard>

        {/* Reservations List */}
        <GlassCard>
          <div className="flex items-center justify-between">
            <SectionHeader eyebrow="Reservations" title="Seznam rezervacij" subtitle={visibleReservations ? `${visibleReservations.length} rezervacij${q ? ' (iskanje)' : ''}` : "Nalagam..."} />
            <label className="flex items-center gap-2 text-sm text-white/50">
              <input type="checkbox" checked={showTransferred} onChange={e => setShowTransferred(e.target.checked)} className="rounded" />
              Prikazi prenesene
            </label>
          </div>
          
          {!bentralData ? (
            <div className="mt-8 flex justify-center">
              <RefreshCw className="h-6 w-6 animate-spin text-[#c59b5b]" />
            </div>
          ) : !visibleReservations || visibleReservations.length === 0 ? (
            <p className="mt-8 text-center text-white/50">
              {q
                ? "Ni zadetkov za iskanje."
                : hiddenPast + hiddenDeclined > 0
                  ? "Ni rezervacij za prikaz — izklopi preklopa zgoraj za starejse in preklicane."
                  : "Ni rezervacij. Uvozi CSV iz Bentral."}
            </p>
          ) : (
            <div className="mt-6 space-y-4">
              {visibleReservations.map(res => (
                <div key={res.id} className={`rounded-2xl border p-5 ${res.transferred ? 'border-[#8fae92]/30 bg-[#8fae92]/5' : 'border-white/[0.08] bg-white/[0.02]'}`}>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-medium text-white">{res.guestName}</h4>
                        <LuxuryBadge variant={getStatusVariant(res.status)}>{res.status}</LuxuryBadge>
                        {getSourceBadge(res.source)}
                        {res.transferred && <LuxuryBadge variant="petrol">Preneseno</LuxuryBadge>}
                      </div>
                      <p className="mt-2 text-sm text-white/60">
                        <span className="text-[#7fa8b8]">{res.checkIn}</span> → <span className="text-[#7fa8b8]">{res.checkOut}</span>
                        <span className="ml-2 text-white/40">({res.nights} noci)</span>
                      </p>
                      <p className="mt-1 text-sm text-white/50">
                        {res.adults} odrasli{res.children > 0 && `, ${res.children} otroci`}
                        {res.country && <span className="ml-2">• {res.country}</span>}
                      </p>
                      {res.units && <p className="mt-1 text-xs text-white/40 line-clamp-1">{res.units}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <p className="text-lg font-light text-[#c59b5b]">{res.amount} {res.currency}</p>
                      <p className="text-xs text-white/40">#{res.externalId}</p>
                      {!res.transferred && res.status !== "Preklicano" ? (
                        <LuxuryButton 
                          variant="ocean" 
                          onClick={() => handleTransfer(res.id)}
                          disabled={transferring === res.id}
                        >
                          {transferring === res.id ? "Prenasam..." : "Prenesi v sistem"}
                        </LuxuryButton>
                      ) : res.transferred ? (
                        <Link href="/">
                          <LuxuryButton variant="ghost">
                            Odpri rezervacijo
                          </LuxuryButton>
                        </Link>
                      ) : (
                        <span className="text-xs text-white/30">Preklicano</span>
                      )}
                    </div>
                  </div>
                  {(res.guestNotes || res.ownNotes) && (
                    <div className="mt-4 border-t border-white/5 pt-4">
                      {res.guestNotes && <p className="text-xs text-white/50"><span className="text-white/30">Gost:</span> {res.guestNotes.slice(0, 200)}{res.guestNotes.length > 200 && "..."}</p>}
                      {res.ownNotes && <p className="mt-1 text-xs text-[#8fae92]/70"><span className="text-[#8fae92]/50">Opombe:</span> {res.ownNotes}</p>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </div>
    </main>
  );
}
