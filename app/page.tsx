"use client";

import React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import useSWR, { mutate } from "swr";
  import { Home, LogIn, LogOut, UserRound, ReceiptText, Truck, Settings, RefreshCw, Leaf, Heart, Ship, Plus, Database, Car, Mail, ExternalLink, Calendar, ChevronDown, FileText, Printer, X, Wine, Archive, BarChart3, Sparkles, CreditCard, Sofa, Users, Link2, Unlink, HelpCircle, Palmtree, Check, Landmark, Save, StickyNote, Pencil, Trash2, Pin, PinOff, MessageSquare, Compass, UserCog, Search, Utensils, Cookie, Receipt, User, ArrowRight, BellRing, Baby, Wind, Phone, ShoppingCart } from "lucide-react";
  import { bungalowDisplayName } from "@/lib/bungalow";
  import StroskiReceiptCaptureModal, { STROSKI_CAPTURE_OPEN_KEY } from "@/components/stroski-receipt-capture-modal";
import { toEnglishItemName } from "@/lib/item-name";
  import { CHILD_BANDS, childBand, normalizeChildrenAges, totalChildren, mealPayUnits, mealPayUnitsFromBands, countByBand, boardPax, paxLabel, type ChildrenAges } from "@/lib/meal-plan";
  import { TimelineCalendar } from "@/components/timeline-calendar";
  import { DailyReminder, type ReminderSection } from "@/components/daily-reminder";
  import BankBalanceCard from "@/components/bank-balance-card";
  import PhoneDirectoryCard from "@/components/phone-directory-card";
import {
  getDashboardData,
  createReservation,
  updateReservation,
  deleteReservation,
  updateTransfer,
  deleteTransfer,
  addOrderItem,
  deleteOrderItem,
  updateOrderItemDate,
  updateExchangeRate,
  checkOverlap,
  addExcursionBooking,
  updateExcursionBooking,
  deleteExcursionBooking,
  cancelExcursionToCredit,
  reactivateExcursion,
  createReservationGroup,
  linkReservationToGroup,
  unlinkReservationFromGroup,
  toggleOrderItemFree,
  setOrderItemTransferOrdered,
  addScheduledExcursion,
  deleteScheduledExcursion,
  searchReservations,
  getReminderChecks,
} from "./actions/komba";
import { closeAllDeliveryNotesForReservation, removeItemFromDeliveryNote, toggleItemFree, toggleItemMealPlanCovered, updateDeliveryNoteItemQuantity } from "./actions/delivery";
import { addExcursion, deleteExcursion } from "./actions/pricing";
import { payFanja, unpayFanja } from "./actions/fanja-payment";
import { paySupplier, unpaySupplier } from "./actions/supplier-payment";
import { getNabavaTrips, addNabavaTrip, updateNabavaTrip, deleteNabavaTrip, setNabavaBoat, setNabavaBoatOrdered, setNabavaNoBoat } from "./actions/nabava";
import { NabavaPurchasesSection } from "@/components/nabava-purchases-section";
import { TaxesPanel } from "@/components/taxes-panel";
import { GuestReplyAssistant } from "@/components/guest-reply-assistant";
  import { SentEmailsBox } from "@/components/sent-emails-box";
  import { SurveyResponsesBox } from "@/components/survey-responses-box";
  import MessageShotsBox from "@/components/message-shots-box";
  import { PushNotificationsBox } from "@/components/push-notifications-box";
import { StaffLoginsTab } from "@/components/staff-logins-tab";
import RazporedTab from "@/components/razpored-tab";
import VrtnarjiTab from "@/components/vrtnarji-tab";
import KuhinjaTab from "@/components/kuhinja-tab";
import BarTab from "@/components/bar-tab";
import VremeTab from "@/components/vreme-tab";
  import { GuestFlag } from "@/components/guest-flag";
  import { VisitorCountries } from "@/components/visitor-countries";

const DEFAULT_RATE = 4800;
const BUNGALOWS = ["Ocean Bungalow I", "Ocean Bungalow II", "Garden Bungalow III", "Ocean Bungalow IV", "Jungle Glamp Village"];
const STATUSES = ["ARRIVING_TODAY", "RESERVED", "IN_HOUSE", "DEPARTING_TODAY", "CHECKED_OUT", "CANCELLED"];
const BOOKING_SOURCES = ["Booking.com", "Airbnb", "Direct Website", "Agency", "Other"];
const CATEGORIES = ["Pijaca", "Hrana", "Transfer", "Izlet", "Razno"];

// Driver WhatsApp buttons (Dilip / Herman) plus their "Potrdi …" links in the transfer sections.
// Hidden on request — not needed for now, but wanted again later, so the code stays put:
// flip this to true and both the arrival and the departure section get them back.
// The "Izveden" toggle above them is deliberately NOT covered by this: it decides whether the
// transfer reaches the delivery note and the amount due, so hiding it would silently drop money.
const SHOW_DRIVER_WHATSAPP = false;

// The amber "Za placilo prevoznikoma (strosek)" panel inside the transfer sections of a guest
// profile. Hidden on request because the very same figures already appear on the Pending
// transferji cards, right next to the "Poklici Dilipa" / "Poklici Hermana" buttons where the
// ordering actually happens. Flip to true to show it in both the arrival and departure section.
// The guest selling price line below it is NOT covered by this: that number appears nowhere else.
const SHOW_SUPPLIER_COST_IN_TRANSFER = false;

// Tipi objavljenih izletov (Fanjin urnik) — vrednost, oznaka, barva.
const SCHEDULE_EXCURSION_TYPES: { value: string; label: string; color: string }[] = [
  { value: "tanikely-sakatia", label: "Tanikely & Sakatia", color: "border-cyan-500/30 bg-cyan-500/10" },
  { value: "safari-iranja", label: "Safari Iranja", color: "border-sky-400/30 bg-sky-400/10" },
  { value: "iranja", label: "Iranja", color: "border-sky-400/30 bg-sky-400/10" },
  { value: "sakatia", label: "Sakatia", color: "border-teal-500/30 bg-teal-500/10" },
  { value: "mitsio", label: "Mitsio", color: "border-[#c59b5b]/30 bg-[#c59b5b]/10" },
  { value: "bivouac", label: "Bivouac", color: "border-emerald-500/30 bg-emerald-500/10" },
  { value: "megafauna", label: "Mégafauna", color: "border-indigo-400/30 bg-indigo-400/10" },
  { value: "day-off", label: "Day-off (Makirun)", color: "border-white/20 bg-white/5" },
];
const scheduleTypeLabel = (v: string) => SCHEDULE_EXCURSION_TYPES.find(t => t.value === v)?.label || v;
const scheduleTypeColor = (v: string) => SCHEDULE_EXCURSION_TYPES.find(t => t.value === v)?.color || "border-white/10 bg-white/5";

// Editable police-form fields per guest (check-in email modal). Keys match the
// GuestFieldValues shape in app/actions/checkin.ts so overrides map 1:1 to columns.
type CheckinGuestField =
  | "guestName" | "nationality" | "passport" | "dateOfBirth" | "placeOfBirth"
  | "fatherName" | "motherName" | "profession" | "domicile" | "passportDate"
  | "passportLieu" | "venantDe" | "validiteVisa" | "allantA";

// Field definitions: key, label, input type. name + dob stay outside this list
// (always visible); the rest appear under the per-guest "more details" toggle.
const CHECKIN_EXTRA_FIELDS: { key: CheckinGuestField; label: string; type: "text" | "date" }[] = [
  { key: "nationality", label: "Nationality", type: "text" },
  { key: "passport", label: "Passport no.", type: "text" },
  { key: "placeOfBirth", label: "Place of birth", type: "text" },
  { key: "fatherName", label: "Father's name", type: "text" },
  { key: "motherName", label: "Mother's name", type: "text" },
  { key: "profession", label: "Profession", type: "text" },
  { key: "domicile", label: "Domicile (address)", type: "text" },
  { key: "passportDate", label: "Passport issue date", type: "date" },
  { key: "passportLieu", label: "Passport place of issue", type: "text" },
  { key: "venantDe", label: "Coming from", type: "text" },
  { key: "validiteVisa", label: "Visa validity", type: "text" },
  { key: "allantA", label: "Going to", type: "text" },
];

const today = () => new Date().toISOString().slice(0, 10);
const num = (value: unknown) => (Number.isFinite(Number(value)) ? Number(value) : 0);
const eur = (value: unknown) => `${num(value).toFixed(2)} EUR`;
const ar = (value: unknown) => `${Math.round(num(value)).toLocaleString("de-DE")} Ar`;
const arToEur = (arValue: unknown, rate: number) => num(arValue) / rate;
const eurToAr = (eurValue: unknown, rate: number) => Math.round(num(eurValue) * rate);

interface OrderItem {
  id: string;
  name: string;
  category: string;
  qty: number;
  priceAr: number;
  paymentStatus?: string | null;
  isFree?: boolean;
  eventDate?: string | null;
  dilipOrderedAt?: string | null;
  hermanOrderedAt?: string | null;
  }

interface TransferData {
  route: string;
  time: string;
  flightNumber?: string;
  flightTime?: string;
  pickupDate?: string;
  pickupPoint?: string;
  pax?: number;
  notes?: string;
  boatId?: string;
  boatPortTime?: string;
  hermanAirportTime?: string;
  hermanRouteId?: string;
  taxiBoatId?: string | null; // kateri taksist vozi avto krak (taxi-herman | taxi-amad); prazno = Herman
  dilipOrderedAt?: string | null;
  hermanOrderedAt?: string | null;
  guestPrice: number;
  paymentStatus: string; // 'PREPAID', 'UNPAID', 'PAID'
  executed?: boolean; // Whether the transfer was actually executed
  executedAt?: string | null; // When it was marked as executed
}

interface ExcursionBooking {
  id: string;
  excursionId: string;
  boatId: string;
  date: string;
  pax: number;
  notes: string;
  showNoteOnCard?: boolean | null;
  guestPrice: number;
  lunchProviderId: string;
  lunchPrice: number;
  entranceFee: number;
  extraEntranceAr?: number;
  extraEntranceLabel?: string;
  paymentStatus: string;
  dilipOrderedAt: string | null;
  executed: boolean;
  status?: string; // 'ACTIVE' | 'CANCELLED' (cancelled → converted to credit)
  cancelledAt?: string | null;
  cancelReason?: string | null;
}

interface Reservation {
  id: string;
  guestName: string;
  guestTitle?: string | null; // Mr. / Mrs. / Ms. — izpiše se na vaučerju za transport
  secondGuestName?: string | null; // Ime drugega gosta
  bungalow: string;
  pax: number;
  arrival: string;
  departure: string;
  status: string;
  bookingSource?: string | null;
  agencyName?: string | null;
  nationality?: string | null;
  passport?: string | null;
  dateOfBirth?: string | null;
  placeOfBirth?: string | null;
  fatherName?: string | null;
  motherName?: string | null;
  profession?: string | null;
  domicile?: string | null;
  passportDate?: string | null;
  passportLieu?: string | null;
  venantDe?: string | null;
  validiteVisa?: string | null;
  allantA?: string | null;
  secondNationality?: string | null;
  secondPassport?: string | null;
  secondDateOfBirth?: string | null;
  secondPlaceOfBirth?: string | null;
  secondFatherName?: string | null;
  secondMotherName?: string | null;
  secondProfession?: string | null;
  secondDomicile?: string | null;
  secondPassportDate?: string | null;
  secondPassportLieu?: string | null;
  secondVenantDe?: string | null;
  secondValiditeVisa?: string | null;
  secondAllantA?: string | null;
  thirdGuestName?: string | null; // Ime tretjega gosta
  thirdNationality?: string | null;
  thirdPassport?: string | null;
  thirdDateOfBirth?: string | null;
  thirdPlaceOfBirth?: string | null;
  thirdFatherName?: string | null;
  thirdMotherName?: string | null;
  thirdProfession?: string | null;
  thirdDomicile?: string | null;
  thirdPassportDate?: string | null;
  thirdPassportLieu?: string | null;
  thirdVenantDe?: string | null;
  thirdValiditeVisa?: string | null;
  thirdAllantA?: string | null;
  fourthGuestName?: string | null; // Ime cetrtega gosta
  fourthNationality?: string | null;
  fourthPassport?: string | null;
  fourthDateOfBirth?: string | null;
  fourthPlaceOfBirth?: string | null;
  fourthFatherName?: string | null;
  fourthMotherName?: string | null;
  fourthProfession?: string | null;
  fourthDomicile?: string | null;
  fourthPassportDate?: string | null;
  fourthPassportLieu?: string | null;
  fourthVenantDe?: string | null;
  fourthValiditeVisa?: string | null;
  fourthAllantA?: string | null;
  guestBand?: string | null; // Starostni razred 1. gosta (adult|0-5|5-10|10-15)
  secondGuestBand?: string | null;
  thirdGuestBand?: string | null;
  fourthGuestBand?: string | null;
  email?: string | null;
  phone?: string | null;
  allergies?: string | null;
  honeymoon?: boolean | null;
  notes?: string | null;
  showNoteOnCard?: boolean | null; // Ali se opomba prikaže na kartici bungalova (privzeto da)
  extensionNote?: string | null; // Opomba o podaljšanju bivanja (prikazana na računu)
  mealPlan?: string | null; // B = Breakfast, HB = Half Board, FB = Full Board
  mealPlanPax?: number | null; // Za koliko oseb velja penzion (prazno = za vse)
  mealPlanPaymentStatus?: string | null; // PAID, UNPAID
  mealPlanSnack?: boolean | null; // Gost ima poleg penziona naročen tudi snack (kuhinja)
  childrenAges?: Record<string, number> | null; // (opuščeno) nadomeščeno z guestBand/secondGuestBand/...
  checkedInAt?: string | null; // When guest checked in
  checkedOutAt?: string | null; // When guest checked out
  excludeFromBar?: boolean | null; // Skrij iz bar dobavnic (fakturira se na drug bungalov)
  totalAmount?: number | null; // Cena nocitev (EUR) - iz Bentrala ali rocno
  amountPaid?: number | null; // Placano (EUR)
  agencyCommission?: number | null; // Provizija agenciji (EUR)
  currency?: string | null; // Valuta (EUR)
  transfers: {
    arrival: TransferData;
    departure: TransferData;
  };
  excursions: ExcursionBooking[];
  orderItems: OrderItem[];
}

// ============ LUXURY UI COMPONENTS ============

// Glassmorphism card with luxury styling
// Robust clipboard copy: tries the modern API, falls back to a hidden textarea
// (works in iframes / non-secure contexts where navigator.clipboard throws).
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to legacy method
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.left = "0";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

function GlassCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-[2rem] border border-white/[0.08] bg-[rgba(15,46,58,0.82)] p-8 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-xl ${className}`}>
      {children}
    </div>
  );
}

function SectionHeader({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  return (
    <div>
      {eyebrow && <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#9dafb5]">{eyebrow}</p>}
      <h2 className="font-[family-name:var(--font-manrope)] text-[1.4rem] font-light tracking-wide text-[#f8f5ef]">{title}</h2>
      {subtitle && <p className="mt-2 text-sm font-light text-[#9dafb5]">{subtitle}</p>}
    </div>
  );
}

function LuxuryBadge({ children, variant = "default", light = false }: { children: React.ReactNode; variant?: "default" | "petrol" | "ocean" | "danger" | "gold"; light?: boolean }) {
  const styles = {
    default: "bg-white/5 border-white/10 text-[#c9d1cf]",
    petrol: "bg-[#8fae92]/15 border-[#8fae92]/25 text-[#8fae92]",
    ocean: "bg-[#7fa8b8]/15 border-[#7fa8b8]/25 text-[#7fa8b8]",
    danger: "bg-[#bc7d67]/15 border-[#bc7d67]/25 text-[#bc7d67]",
    gold: "bg-[#c59b5b]/15 border-[#c59b5b]/25 text-[#c59b5b]",
  };
  // Darker variants for use on the light sand card background
  const lightStyles = {
    default: "bg-[#0f2e3a]/[0.06] border-[#0f2e3a]/15 text-[#2b2622]",
    petrol: "bg-[#4f7a54]/10 border-[#4f7a54]/30 text-[#3f6444]",
    ocean: "bg-[#3f6b7d]/10 border-[#3f6b7d]/30 text-[#33596a]",
    danger: "bg-[#a15a3f]/10 border-[#a15a3f]/30 text-[#8c4a31]",
    gold: "bg-[#8f6d3a]/10 border-[#8f6d3a]/30 text-[#7a5c2f]",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${(light ? lightStyles : styles)[variant]}`}>
      {children}
    </span>
  );
}

function LuxuryButton({ children, variant = "gold", className = "", ...props }: { children: React.ReactNode; variant?: "gold" | "petrol" | "ocean" | "ghost" | "danger"; className?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const styles = {
    gold: "bg-gradient-to-r from-[#e8c88a] via-[#c59b5b] to-[#8f6d3a] text-[#0a2029] shadow-[0_4px_20px_rgba(197,155,91,0.25)] hover:shadow-[0_6px_28px_rgba(197,155,91,0.35)]",
    petrol: "bg-gradient-to-r from-[#8fae92] to-[#526b55] text-[#0a2029] shadow-[0_4px_20px_rgba(143,174,146,0.25)] hover:shadow-[0_6px_28px_rgba(143,174,146,0.35)]",
    ocean: "bg-gradient-to-r from-[#7fa8b8] to-[#4e8296] text-[#0a2029] shadow-[0_4px_20px_rgba(127,168,184,0.25)] hover:shadow-[0_6px_28px_rgba(127,168,184,0.35)]",
    ghost: "bg-white/[0.03] border border-white/10 text-[#c9d1cf] hover:bg-white/[0.06] hover:border-white/15",
    danger: "bg-gradient-to-r from-[#bc7d67] to-[#905c4a] text-white shadow-[0_4px_20px_rgba(188,125,103,0.25)] hover:shadow-[0_6px_28px_rgba(188,125,103,0.35)]",
  };
  return (
    <button className={`rounded-[1.2rem] px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] transition-all duration-300 ${styles[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

function LuxuryInput({ label, value, onChange, type = "text", placeholder }: { label: string; value: string | number; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div>
      <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.2em] text-[#9dafb5]">{label}</label>
      <input
        type={type}
        className="w-full rounded-[1.1rem] border border-white/10 bg-white/[0.03] px-5 py-3.5 text-[#f8f5ef] placeholder:text-[#43616d] transition-all duration-300 focus:border-[#c59b5b]/40 focus:outline-none focus:ring-2 focus:ring-[#c59b5b]/10"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function LuxurySelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: (string | { value: string; label: string })[] }) {
  return (
    <div>
      <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">{label}</label>
      <select
        className="w-full rounded-[1.1rem] border border-white/10 bg-white/5 px-5 py-3 text-white transition-all duration-300 focus:border-[#c59b5b]/50 focus:outline-none focus:ring-2 focus:ring-[#c59b5b]/20 cursor-pointer"
        value={value}
        onChange={e => onChange(e.target.value)}
      >
        {options.map(opt => typeof opt === "string" ? <option key={opt} value={opt} className="bg-[#0a2029] text-white">{opt || "—"}</option> : <option key={opt.value} value={opt.value} className="bg-[#0a2029] text-white">{opt.label}</option>)}
      </select>
    </div>
  );
}

function LuxuryCheckbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 text-sm text-white/70 transition-colors hover:text-white">
      <div className={`flex h-5 w-5 items-center justify-center rounded-lg border transition-all ${checked ? "border-[#c59b5b] bg-[#c59b5b]" : "border-white/20 bg-white/5"}`}>
        {checked && <span className="text-[#0a2029] text-xs">✓</span>}
      </div>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="sr-only" />
      {label}
    </label>
  );
}

// Reliable controlled text field for transfer fields (notes, times, etc.)
// Syncs with the saved value and shows a brief "Shranjeno" confirmation.
// Fixes the issue where notes added after a re-render (e.g. after marking
// departure executed) appeared to not be accepted with defaultValue inputs.
function TransferTextField({
  label,
  value,
  placeholder,
  onSave,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onSave: (v: string) => Promise<void> | void;
}) {
  const [local, setLocal] = React.useState(value || "");
  const [saved, setSaved] = React.useState(false);
  const lastSavedRef = React.useRef(value || "");

  // Keep local input in sync when the saved value changes from outside (e.g. refresh)
  React.useEffect(() => {
    if ((value || "") !== lastSavedRef.current) {
      setLocal(value || "");
      lastSavedRef.current = value || "";
    }
  }, [value]);

  const commit = async () => {
    if (local === lastSavedRef.current) return;
    lastSavedRef.current = local;
    await onSave(local);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div>
      <label className="block text-xs text-white/40 mb-1">
        {label}
        {saved && <span className="ml-2 text-emerald-400">Shranjeno ✓</span>}
      </label>
      <input
        type="text"
        placeholder={placeholder}
        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-[#7fa8b8]/50 focus:outline-none"
        value={local}
        onChange={e => setLocal(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); } }}
      />
    </div>
  );
}

// Marker prefixes controlling whether a note appears on the bungalow overview card.
// @card  = pinned (shown first on the bungalow card)
// @nocard = hidden from the bungalow card, but still kept on the guest card
const CARD_NOTE_MARKER = '@card ';
const NOCARD_NOTE_MARKER = '@nocard ';

// Parse a raw note string into { pinned, hidden, timestamp, body }
function parseNote(raw: string) {
  const pinned = raw.startsWith(CARD_NOTE_MARKER);
  const hidden = raw.startsWith(NOCARD_NOTE_MARKER);
  const rest = pinned ? raw.slice(CARD_NOTE_MARKER.length) : hidden ? raw.slice(NOCARD_NOTE_MARKER.length) : raw;
  const m = rest.match(/^\[([^\]]*)\]\s*([\s\S]*)$/);
  return { pinned, hidden, timestamp: m ? m[1] : '', body: m ? m[2] : rest };
}

// Rebuild a raw note string from its parts
function buildNote(n: { pinned: boolean; hidden: boolean; timestamp: string; body: string }) {
  const marker = n.hidden ? NOCARD_NOTE_MARKER : n.pinned ? CARD_NOTE_MARKER : '';
  return `${marker}${n.timestamp ? `[${n.timestamp}] ` : ''}${n.body}`;
}

// Notes section with add / edit / delete and per-note card selection
function NotesSection({ notes, showNoteOnCard = true, onAddNote, onUpdateNotes, onToggleShowOnCard }: { notes: string; showNoteOnCard?: boolean; onAddNote: (note: string) => void; onUpdateNotes?: (notes: string) => void; onToggleShowOnCard?: (show: boolean) => void }) {
  const [newNote, setNewNote] = React.useState("");
  const [editingIndex, setEditingIndex] = React.useState<number | null>(null);
  const [editText, setEditText] = React.useState("");
  
  const handleAdd = () => {
    if (!newNote.trim()) return;
    onAddNote(newNote.trim());
    setNewNote("");
  };
  
  // Parse notes into array (split by ---)
  const notesList = notes ? notes.split('\n---\n').filter(Boolean) : [];
  const parsedNotes = notesList.map(parseNote);

  // Which notes actually appear on the bungalow card: non-hidden notes, pinned first, then the
  // rest in order, capped at 3 — mirrors the bungalow overview card logic.
  const shownOnCardIdx = new Set<number>();
  const ordered = parsedNotes
    .map((n, idx) => ({ n, idx }))
    .filter(x => !x.n.hidden)
    .sort((a, b) => (a.n.pinned === b.n.pinned ? 0 : a.n.pinned ? -1 : 1));
  ordered.slice(0, 3).forEach(x => shownOnCardIdx.add(x.idx));

  // Persist a rebuilt array of parsed notes back to the parent
  const commit = (arr: { pinned: boolean; hidden: boolean; timestamp: string; body: string }[]) => {
    onUpdateNotes?.(arr.map(buildNote).join('\n---\n'));
  };

  const handleSaveEdit = (i: number) => {
    if (!onUpdateNotes) return;
    const arr = parsedNotes.map((n, idx) => idx === i ? { ...n, body: editText } : n);
    commit(arr);
    setEditingIndex(null);
    setEditText("");
  };

  const handleDelete = (i: number) => {
    if (!onUpdateNotes) return;
    commit(parsedNotes.filter((_, idx) => idx !== i));
  };

  // Toggle whether this note appears on the bungalow card. Hiding keeps the note on the guest
  // card (it stays in the list) and only removes it from the bungalow overview cards.
  const handleToggleCard = (i: number) => {
    if (!onUpdateNotes) return;
    const arr = parsedNotes.map((n, idx) => idx === i ? { ...n, hidden: !n.hidden, pinned: false } : n);
    commit(arr);
  };
  
  return (
    <div className="space-y-4">
      <label className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-[#9dafb5]">Opombe / Korespondenca</label>

      {/* Master toggle: show a note on the bungalow overview card */}
      {onToggleShowOnCard ? (
        <button
          type="button"
          onClick={() => onToggleShowOnCard(!showNoteOnCard)}
          className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-left transition-colors hover:bg-white/[0.04]"
        >
          <span className="flex items-center gap-2 text-sm text-white/70">
            <StickyNote className="h-4 w-4 text-[#c59b5b]" />
            Prikaži opombo na kartici bungalova
          </span>
          <span
            className={`relative h-5 w-9 flex-shrink-0 rounded-full transition-colors ${showNoteOnCard ? 'bg-[#c59b5b]' : 'bg-white/15'}`}
            aria-hidden="true"
          >
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${showNoteOnCard ? 'left-[18px]' : 'left-0.5'}`} />
          </span>
        </button>
      ) : null}
      {onToggleShowOnCard && showNoteOnCard ? (
        <p className="-mt-2 px-1 text-[11px] text-white/40">
          Na kartici se prikaže označena opomba (pripni jo spodaj), sicer najnovejša.
        </p>
      ) : null}
      
      {/* Add new note */}
      <div className="flex gap-3">
        <textarea 
          className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-[#c59b5b]/50 focus:outline-none focus:ring-1 focus:ring-[#c59b5b]/50 min-h-[80px] resize-y"
          placeholder="Dodaj novo opombo..."
          value={newNote}
          onChange={e => setNewNote(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) handleAdd(); }}
        />
      </div>
      <LuxuryButton variant="ghost" onClick={handleAdd} disabled={!newNote.trim()}>
        Dodaj opombo
      </LuxuryButton>
      
      {/* Existing notes */}
      {parsedNotes.length > 0 && (
        <div className="mt-4 space-y-3 max-h-[360px] overflow-y-auto">
          {parsedNotes.map((note, i) => {
            // A note shows on the bungalow card when it is not hidden and among the first 3 shown
            const isCardNote = shownOnCardIdx.has(i);
            const isEditing = editingIndex === i;
            return (
              <div key={i} className={`rounded-xl border p-4 transition-colors ${note.hidden ? 'border-white/5 bg-white/[0.02] opacity-70' : isCardNote ? 'border-[#c59b5b]/40 bg-[#c59b5b]/[0.06]' : 'border-white/5 bg-white/[0.02]'}`}>
                {note.timestamp ? (
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wider text-white/30">{note.timestamp}</span>
                    {isCardNote && showNoteOnCard ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-[#c59b5b]/15 px-1.5 py-0.5 text-[10px] font-medium text-[#c59b5b]">
                        <Pin className="h-2.5 w-2.5" /> na kartici
                      </span>
                    ) : null}
                  </div>
                ) : null}

                {isEditing ? (
                  <div className="space-y-2">
                    <textarea
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-[#c59b5b]/50 focus:outline-none min-h-[70px] resize-y"
                      value={editText}
                      onChange={e => setEditText(e.target.value)}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(i)}
                        className="inline-flex items-center gap-1 rounded-lg bg-[#c59b5b]/20 px-3 py-1.5 text-xs font-medium text-[#c59b5b] hover:bg-[#c59b5b]/30 transition-colors"
                      >
                        <Save className="h-3.5 w-3.5" /> Shrani
                      </button>
                      <button
                        type="button"
                        onClick={() => { setEditingIndex(null); setEditText(""); }}
                        className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/50 hover:text-white/80 transition-colors"
                      >
                        Prekliči
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-white/70 whitespace-pre-wrap">{note.body}</p>
                    {onUpdateNotes ? (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleCard(i)}
                          className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${!note.hidden ? 'bg-[#c59b5b]/20 text-[#c59b5b] hover:bg-[#c59b5b]/30' : 'border border-white/10 text-white/50 hover:text-white/80'}`}
                        >
                          {note.hidden ? <><Pin className="h-3.5 w-3.5" /> Pripni na kartico</> : <><PinOff className="h-3.5 w-3.5" /> Odpni s kartice</>}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setEditingIndex(i); setEditText(note.body); }}
                          className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1 text-xs text-white/50 hover:text-white/80 transition-colors"
                        >
                          <Pencil className="h-3.5 w-3.5" /> Uredi
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(i)}
                          className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1 text-xs text-[#bc7d67] hover:bg-[#bc7d67]/10 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Izbriši
                        </button>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Gmail email search section
interface GmailEmail {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
}

function GmailSection({ guestName, guestEmail }: { guestName: string; guestEmail?: string }) {
  const [emails, setEmails] = React.useState<GmailEmail[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [connected, setConnected] = React.useState<boolean | null>(null);
  const [expanded, setExpanded] = React.useState(false);
  // Full email opened inside the app (modal) instead of jumping to Gmail.
  const [openEmail, setOpenEmail] = React.useState<{ subject: string; from: string; to?: string; date: string; html: string; text: string; threadId: string } | null>(null);
  const [loadingEmailId, setLoadingEmailId] = React.useState<string | null>(null);

  const openEmailInApp = async (email: GmailEmail) => {
    setLoadingEmailId(email.id);
    setError(null);
    try {
      const res = await fetch(`/api/gmail/message/${email.id}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.needsAuth) { window.location.href = '/api/auth/google'; return; }
        throw new Error(data.error || 'Napaka pri odpiranju emaila');
      }
      const data = await res.json();
      setOpenEmail({
        subject: data.subject || email.subject,
        from: data.from || email.from,
        to: data.to,
        date: data.date || email.date,
        html: data.html || '',
        text: data.text || data.snippet || '',
        threadId: data.threadId || email.threadId,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Napaka pri odpiranju emaila');
    } finally {
      setLoadingEmailId(null);
    }
  };

  // Check Gmail connection status
  React.useEffect(() => {
    fetch('/api/gmail/status')
      .then(res => res.json())
      .then(data => setConnected(data.connected))
      .catch(() => setConnected(false));
  }, []);

  const searchEmails = async () => {
    setLoading(true);
    setError(null);
    try {
      // Build a STRICT search query so we only get emails actually related to this guest.
      // Splitting the name into single words joined by OR (old behaviour) matched any
      // email containing one common word (e.g. lab results, job applications). Instead we
      // search by the guest's email address (from/to) and by the FULL name as an exact
      // phrase — both are strong signals of real correspondence with this guest.
      const name = guestName.trim();
      const terms: string[] = [];
      if (guestEmail) {
        terms.push(`from:${guestEmail}`, `to:${guestEmail}`);
      }
      if (name) {
        terms.push(`"${name}"`);
      }
      const query = terms.join(' OR ');

      if (!query) {
        setError('Ni imena ali emaila za iskanje.');
        setLoading(false);
        return;
      }

      const res = await fetch('/api/gmail/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });
      
      if (!res.ok) {
        const data = await res.json();
        if (data.needsAuth) {
          window.location.href = '/api/auth/google';
          return;
        }
        throw new Error(data.error || 'Napaka pri iskanju');
      }
      
      const data = await res.json();
      setEmails(data.emails || []);
      setExpanded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Napaka pri iskanju');
    } finally {
      setLoading(false);
    }
  };

  const connectGmail = () => {
    window.location.href = '/api/auth/google';
  };

  return (
    <div className="space-y-4 pt-4 border-t border-white/10">
      <div className="flex items-center justify-between">
        <label className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-[#9dafb5]">
          <Mail className="inline h-3 w-3 mr-1" />
          Email korespondenca
        </label>
        {connected === false ? (
          <button
            onClick={connectGmail}
            className="text-xs text-[#7fa8b8] hover:underline"
          >
            Povezi Gmail
          </button>
        ) : (
          <button
            onClick={searchEmails}
            disabled={loading}
            className="text-xs text-[#7fa8b8] hover:underline disabled:opacity-50"
          >
            {loading ? 'Iscem...' : 'Poisci emails'}
          </button>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}

      {expanded && emails.length === 0 && !loading && (
        <p className="text-xs text-white/40">Ni najdenih emailov za tega gosta.</p>
      )}

      {emails.length > 0 && (
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {emails.map((email) => (
            <button
              key={email.id}
              type="button"
              onClick={() => openEmailInApp(email)}
              className="block w-full text-left rounded-xl border border-white/5 bg-white/[0.02] p-3 hover:bg-white/[0.05] transition-colors disabled:opacity-50"
              disabled={loadingEmailId === email.id}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium truncate">{email.subject || '(brez zadeve)'}</p>
                  <p className="text-xs text-white/50 truncate">{email.from}</p>
                  <p className="text-xs text-white/30 mt-1 line-clamp-2">{email.snippet}</p>
                </div>
                <div className="flex-shrink-0 flex items-center gap-2">
                  <span className="text-[10px] text-white/30">{email.date}</span>
                  {loadingEmailId === email.id
                    ? <RefreshCw className="h-3 w-3 text-white/30 animate-spin" />
                    : <ExternalLink className="h-3 w-3 text-white/30" />}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* In-app email viewer (modal) — portaled to body so it isn't clipped by transformed parents */}
      {openEmail && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
          onClick={() => setOpenEmail(null)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#10181b] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-white/10 p-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white text-pretty">{openEmail.subject || '(brez zadeve)'}</p>
                <p className="mt-1 truncate text-xs text-white/50">Od: {openEmail.from}</p>
                {openEmail.to && <p className="truncate text-xs text-white/40">Za: {openEmail.to}</p>}
                <p className="text-[10px] text-white/30">{openEmail.date}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <a
                  href={`https://mail.google.com/mail/u/0/#inbox/${openEmail.threadId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-white/10 p-1.5 text-white/50 hover:text-white/80"
                  title="Odpri v Gmailu"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
                <button
                  type="button"
                  onClick={() => setOpenEmail(null)}
                  className="rounded-lg border border-white/10 p-1.5 text-white/50 hover:text-white/80"
                  aria-label="Zapri"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto bg-white">
              {openEmail.html ? (
                <iframe
                  title="Email"
                  srcDoc={openEmail.html}
                  className="h-[70vh] w-full border-0 bg-white"
                  sandbox=""
                />
              ) : (
                <pre className="whitespace-pre-wrap p-4 text-sm text-[#1d1b17]">{openEmail.text || '(prazno sporocilo)'}</pre>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// Payment methods
const PAYMENT_METHODS = [
  { value: 'card', label: 'Kreditna kartica' },
  { value: 'transfer', label: 'Bancni transfer' },
  { value: 'orange_money', label: 'Orange Money' },
  { value: 'cash', label: 'Gotovina' },
  ];
  
  // Police Registration Form Modal
  function PoliceFormModal({ reservation, isOpen, onClose }: { 
    reservation: { 
      guestName: string;
      secondGuestName?: string | null;
      nationality?: string | null; 
      passport?: string | null; 
      dateOfBirth?: string | null;
      placeOfBirth?: string | null;
      fatherName?: string | null;
      motherName?: string | null;
      profession?: string | null;
      domicile?: string | null;
      passportDate?: string | null;
      passportLieu?: string | null;
      venantDe?: string | null;
      validiteVisa?: string | null;
      allantA?: string | null;
      secondNationality?: string | null;
      secondPassport?: string | null;
      secondDateOfBirth?: string | null;
      secondPlaceOfBirth?: string | null;
      secondFatherName?: string | null;
      secondMotherName?: string | null;
      secondProfession?: string | null;
      secondDomicile?: string | null;
      secondPassportDate?: string | null;
      secondPassportLieu?: string | null;
      secondVenantDe?: string | null;
      secondValiditeVisa?: string | null;
      secondAllantA?: string | null;
      thirdGuestName?: string | null;
      thirdNationality?: string | null;
      thirdPassport?: string | null;
      thirdDateOfBirth?: string | null;
      thirdPlaceOfBirth?: string | null;
      thirdFatherName?: string | null;
      thirdMotherName?: string | null;
      thirdProfession?: string | null;
      thirdDomicile?: string | null;
      thirdPassportDate?: string | null;
      thirdPassportLieu?: string | null;
      thirdVenantDe?: string | null;
      thirdValiditeVisa?: string | null;
      thirdAllantA?: string | null;
      fourthGuestName?: string | null;
      fourthNationality?: string | null;
      fourthPassport?: string | null;
      fourthDateOfBirth?: string | null;
      fourthPlaceOfBirth?: string | null;
      fourthFatherName?: string | null;
      fourthMotherName?: string | null;
      fourthProfession?: string | null;
      fourthDomicile?: string | null;
      fourthPassportDate?: string | null;
      fourthPassportLieu?: string | null;
      fourthVenantDe?: string | null;
      fourthValiditeVisa?: string | null;
      fourthAllantA?: string | null;
      pax?: number | null;
      arrival: string; 
      departure: string;
    }; 
    isOpen: boolean; 
    onClose: () => void; 
  }) {
    const [slot, setSlot] = React.useState<'first' | 'second' | 'third' | 'fourth'>('first');
    const [formData, setFormData] = React.useState({
      nom: '',
      prenom: '',
      dateNaissance: '',
      lieuNaissance: '',
      pere: '',
      mere: '',
      profession: '',
      domicile: '',
      nationalite: '',
      pieceIdentite: 'Passport',
      passportNo: '',
      passportDate: '',
      passportLieu: '',
      dateArrivee: '',
      venantDe: '',
      validiteVisa: '',
      dateDepart: '',
      aliantA: '',
      modeTransport: 'Avion'
    });
    
    React.useEffect(() => {
      if (isOpen) {
        // Pick the correct guest's data based on the selected slot (1st/2nd/3rd)
        const pick = (first?: string | null, second?: string | null, third?: string | null, fourth?: string | null) =>
          (slot === 'fourth' ? fourth : slot === 'third' ? third : slot === 'second' ? second : first) || '';
        const guestName = pick(reservation.guestName, reservation.secondGuestName, reservation.thirdGuestName, reservation.fourthGuestName);
        const nameParts = guestName.trim().split(' ');
        setFormData(prev => ({
          ...prev,
          nom: nameParts.slice(1).join(' ') || '',
          prenom: nameParts[0] || '',
          nationalite: pick(reservation.nationality, reservation.secondNationality, reservation.thirdNationality, reservation.fourthNationality),
          passportNo: pick(reservation.passport, reservation.secondPassport, reservation.thirdPassport, reservation.fourthPassport),
          dateNaissance: pick(reservation.dateOfBirth, reservation.secondDateOfBirth, reservation.thirdDateOfBirth, reservation.fourthDateOfBirth),
          lieuNaissance: pick(reservation.placeOfBirth, reservation.secondPlaceOfBirth, reservation.thirdPlaceOfBirth, reservation.fourthPlaceOfBirth),
          pere: pick(reservation.fatherName, reservation.secondFatherName, reservation.thirdFatherName, reservation.fourthFatherName),
          mere: pick(reservation.motherName, reservation.secondMotherName, reservation.thirdMotherName, reservation.fourthMotherName),
          profession: pick(reservation.profession, reservation.secondProfession, reservation.thirdProfession, reservation.fourthProfession),
          domicile: pick(reservation.domicile, reservation.secondDomicile, reservation.thirdDomicile, reservation.fourthDomicile),
          passportDate: pick(reservation.passportDate, reservation.secondPassportDate, reservation.thirdPassportDate, reservation.fourthPassportDate),
          passportLieu: pick(reservation.passportLieu, reservation.secondPassportLieu, reservation.thirdPassportLieu, reservation.fourthPassportLieu),
          venantDe: pick(reservation.venantDe, reservation.secondVenantDe, reservation.thirdVenantDe, reservation.fourthVenantDe),
          validiteVisa: pick(reservation.validiteVisa, reservation.secondValiditeVisa, reservation.thirdValiditeVisa, reservation.fourthValiditeVisa),
          aliantA: pick(reservation.allantA, reservation.secondAllantA, reservation.thirdAllantA, reservation.fourthAllantA),
          dateArrivee: reservation.arrival,
          dateDepart: reservation.departure,
        }));
      }
    }, [isOpen, reservation, slot]);

    // Reset to first guest whenever the modal is opened
    React.useEffect(() => {
      if (isOpen) setSlot('first');
    }, [isOpen]);
    
    const printForm = (d: typeof formData) => {
      const printWindow = window.open('', '_blank');
      if (!printWindow) return;
      
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Fiche de Police - ${d.nom} ${d.prenom}</title>
          <style>
            @page { size: A4; margin: 15mm; }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: 'Times New Roman', Times, serif; font-size: 10pt; line-height: 1.3; }
            .form-container { max-width: 180mm; margin: 0 auto; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #000; padding-bottom: 3mm; margin-bottom: 4mm; }
            .header-left h1 { font-size: 14pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5mm; }
            .header-left p { font-size: 8pt; color: #555; margin-top: 1mm; }
            .header-right { text-align: right; }
            .header-right img { height: 8mm; }
            .form-row { display: flex; gap: 4mm; margin-bottom: 3mm; }
            .form-field { flex: 1; }
            .form-field.col-3 { flex: 0.33; }
            .form-label { font-size: 8pt; color: #333; text-transform: uppercase; letter-spacing: 0.3mm; margin-bottom: 1mm; display: block; }
            .form-value { border-bottom: 1px solid #000; min-height: 6mm; padding: 1mm 0; font-size: 10pt; font-weight: bold; text-transform: uppercase; }
            .transport-options { display: flex; gap: 3mm; margin-top: 1mm; }
            .transport-option { padding: 1.5mm 3mm; border: 1px solid #999; font-size: 9pt; }
            .transport-option.selected { background: #ddd; border-color: #000; font-weight: bold; }
            .signature-section { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 8mm; padding-top: 5mm; border-top: 1px solid #ccc; }
            .signature-line { width: 50mm; border-bottom: 1px solid #000; }
            .signature-label { font-size: 8pt; margin-bottom: 2mm; }
          </style>
        </head>
        <body>
          <div class="form-container">
            <div class="header">
              <div class="header-left">
                <h1>Fiche de Police</h1>
                <p>PRIERE D'ECRIRE TRES LISIBLEMENT / PLEASE WRITE PLAINLY</p>
              </div>
              <div class="header-right">
                <img src="/images/komba-logo.png" alt="Komba Cabana" />
              </div>
            </div>
            
            <div class="form-row">
              <div class="form-field"><span class="form-label">Nom / Name</span><div class="form-value">${d.nom}</div></div>
              <div class="form-field"><span class="form-label">Prenom / First name</span><div class="form-value">${d.prenom}</div></div>
            </div>
            
            <div class="form-row">
              <div class="form-field"><span class="form-label">Date de naissance</span><div class="form-value">${d.dateNaissance}</div></div>
              <div class="form-field"><span class="form-label">Lieu de naissance</span><div class="form-value">${d.lieuNaissance}</div></div>
            </div>
            
            <div class="form-row">
              <div class="form-field"><span class="form-label">Pere / Father</span><div class="form-value">${d.pere}</div></div>
              <div class="form-field"><span class="form-label">Mere / Mother</span><div class="form-value">${d.mere}</div></div>
            </div>
            
            <div class="form-row">
              <div class="form-field"><span class="form-label">Profession</span><div class="form-value">${d.profession}</div></div>
              <div class="form-field"><span class="form-label">Domicile habituel</span><div class="form-value">${d.domicile}</div></div>
            </div>
            
            <div class="form-row">
              <div class="form-field"><span class="form-label">Nationalite</span><div class="form-value">${d.nationalite}</div></div>
              <div class="form-field"><span class="form-label">Piece d'identite</span><div class="form-value">${d.pieceIdentite}</div></div>
            </div>
            
            <div class="form-row">
              <div class="form-field col-3"><span class="form-label">N° document</span><div class="form-value">${d.passportNo}</div></div>
              <div class="form-field col-3"><span class="form-label">Date delivrance</span><div class="form-value">${d.passportDate}</div></div>
              <div class="form-field col-3"><span class="form-label">Lieu delivrance</span><div class="form-value">${d.passportLieu}</div></div>
            </div>
            
            <div class="form-row">
              <div class="form-field"><span class="form-label">Date d'arrivee</span><div class="form-value">${d.dateArrivee}</div></div>
              <div class="form-field"><span class="form-label">Venant de / Coming from</span><div class="form-value">${d.venantDe}</div></div>
            </div>
            
            <div class="form-row">
              <div class="form-field"><span class="form-label">Validite du Visa</span><div class="form-value">${d.validiteVisa || '30 dni / 90 dni'}</div></div>
            </div>
            
            <div class="form-row">
              <div class="form-field"><span class="form-label">Date de depart</span><div class="form-value">${d.dateDepart}</div></div>
              <div class="form-field"><span class="form-label">Aliant a / Going to</span><div class="form-value">${d.aliantA}</div></div>
            </div>
            
            <div class="form-row">
              <div class="form-field">
                <span class="form-label">Mode de transport</span>
                <div class="transport-options">
                  ${['Avion', 'Voiture', 'Moto', 'Bateau'].map(t => `<span class="transport-option ${d.modeTransport === t ? 'selected' : ''}">${t}</span>`).join('')}
                </div>
              </div>
            </div>
            
            <div class="signature-section">
              <div>Le _______________</div>
              <div style="text-align: right;">
                <div class="signature-label">Signature du responsable</div>
                <div class="signature-line"></div>
              </div>
            </div>
          </div>
        </body>
        </html>
      `);
      
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => { printWindow.print(); }, 250);
    };

    const handlePrint = () => printForm(formData);
    const handlePrintBlank = () => printForm({
      nom: '', prenom: '', dateNaissance: '', lieuNaissance: '', pere: '', mere: '',
      profession: '', domicile: '', nationalite: '', pieceIdentite: '', passportNo: '',
      passportDate: '', passportLieu: '', dateArrivee: '', venantDe: '', validiteVisa: '',
      dateDepart: '', aliantA: '', modeTransport: '',
    } as typeof formData);
    
    if (!isOpen) return null;
    
    const inputClass = "w-full border-b border-white/20 bg-transparent px-1 py-2 text-sm text-white focus:border-[#7fa8b8] focus:outline-none";
    const labelClass = "block text-[10px] font-medium uppercase tracking-wider text-white/50 mb-0.5";
    
    return (
      <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 backdrop-blur-sm p-4 pt-8">
        <div className="relative w-full max-w-lg bg-[#0e1416] rounded-xl border border-white/10 shadow-2xl my-4">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
            <div>
              <h2 className="text-base font-semibold text-white">Fiche de Police</h2>
              <p className="text-[10px] text-white/40 uppercase tracking-wider">Obrazec za policijo</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handlePrintBlank}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-all text-xs font-medium"
                title="Natisni prazen obrazec za ročno izpolnjevanje"
              >
                <Printer className="w-3.5 h-3.5" />
                Prazen obrazec
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#7fa8b8]/10 text-[#7fa8b8] hover:bg-[#7fa8b8]/20 transition-all text-xs font-medium"
              >
                <Printer className="w-3.5 h-3.5" />
                Natisni
              </button>
              <button onClick={onClose} className="p-1.5 rounded-lg bg-white/5 text-white/40 hover:bg-white/10 hover:text-white transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          {/* Tabs — one per guest (up to four) */}
          {reservation.secondGuestName || reservation.thirdGuestName || reservation.fourthGuestName ? (
            <div className="flex gap-2 px-5 pt-4">
              <button
                type="button"
                onClick={() => setSlot('first')}
                className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                  slot === 'first'
                    ? 'border-[#7fa8b8] bg-[#7fa8b8]/10 text-[#7fa8b8]'
                    : 'border-white/10 text-white/40 hover:border-white/20 hover:text-white/60'
                }`}
              >
                {reservation.guestName || 'Oseba 1'}
              </button>
              {reservation.secondGuestName ? (
                <button
                  type="button"
                  onClick={() => setSlot('second')}
                  className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                    slot === 'second'
                      ? 'border-[#d9a68f] bg-[#d9a68f]/10 text-[#d9a68f]'
                      : 'border-white/10 text-white/40 hover:border-white/20 hover:text-white/60'
                  }`}
                >
                  {reservation.secondGuestName}
                </button>
              ) : null}
              {reservation.thirdGuestName ? (
                <button
                  type="button"
                  onClick={() => setSlot('third')}
                  className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                    slot === 'third'
                      ? 'border-[#c4e2ee] bg-[#c4e2ee]/10 text-[#c4e2ee]'
                      : 'border-white/10 text-white/40 hover:border-white/20 hover:text-white/60'
                  }`}
                >
                  {reservation.thirdGuestName}
                </button>
              ) : null}
              {reservation.fourthGuestName ? (
                <button
                  type="button"
                  onClick={() => setSlot('fourth')}
                  className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                    slot === 'fourth'
                      ? 'border-[#8fae92] bg-[#8fae92]/10 text-[#8fae92]'
                      : 'border-white/10 text-white/40 hover:border-white/20 hover:text-white/60'
                  }`}
                >
                  {reservation.fourthGuestName}
                </button>
              ) : null}
            </div>
          ) : null}

          {/* Form Content */}
          <div className="p-5 space-y-4" id="police-form-content">
            {/* Row 1: Name */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Nom / Name</label>
                <input type="text" value={formData.nom} onChange={e => setFormData(p => ({...p, nom: e.target.value}))} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Prenom / First name</label>
                <input type="text" value={formData.prenom} onChange={e => setFormData(p => ({...p, prenom: e.target.value}))} className={inputClass} />
              </div>
            </div>
            
            {/* Row 2: Birth */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Date de naissance</label>
                <input type="date" value={formData.dateNaissance} onChange={e => setFormData(p => ({...p, dateNaissance: e.target.value}))} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Lieu de naissance</label>
                <input type="text" value={formData.lieuNaissance} onChange={e => setFormData(p => ({...p, lieuNaissance: e.target.value}))} className={inputClass} />
              </div>
            </div>
            
            {/* Row 3: Parents */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Pere / Father</label>
                <input type="text" value={formData.pere} onChange={e => setFormData(p => ({...p, pere: e.target.value}))} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Mere / Mother</label>
                <input type="text" value={formData.mere} onChange={e => setFormData(p => ({...p, mere: e.target.value}))} className={inputClass} />
              </div>
            </div>
            
            {/* Row 4: Profession & Address */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Profession</label>
                <input type="text" value={formData.profession} onChange={e => setFormData(p => ({...p, profession: e.target.value}))} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Domicile habituel</label>
                <input type="text" value={formData.domicile} onChange={e => setFormData(p => ({...p, domicile: e.target.value}))} className={inputClass} />
              </div>
            </div>
            
            {/* Row 5: Nationality & ID type */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Nationalite</label>
                <input type="text" value={formData.nationalite} onChange={e => setFormData(p => ({...p, nationalite: e.target.value}))} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Piece d&apos;identite</label>
                <input type="text" value={formData.pieceIdentite} onChange={e => setFormData(p => ({...p, pieceIdentite: e.target.value}))} className={inputClass} />
              </div>
            </div>
            
            {/* Row 6: Passport details */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>N° document</label>
                <input type="text" value={formData.passportNo} onChange={e => setFormData(p => ({...p, passportNo: e.target.value}))} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Date delivrance</label>
                <input type="date" value={formData.passportDate} onChange={e => setFormData(p => ({...p, passportDate: e.target.value}))} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Lieu delivrance</label>
                <input type="text" value={formData.passportLieu} onChange={e => setFormData(p => ({...p, passportLieu: e.target.value}))} className={inputClass} />
              </div>
            </div>
            
            {/* Row 7: Arrival */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Date d&apos;arrivee</label>
                <input type="date" value={formData.dateArrivee} onChange={e => setFormData(p => ({...p, dateArrivee: e.target.value}))} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Venant de / Coming from</label>
                <input type="text" value={formData.venantDe} onChange={e => setFormData(p => ({...p, venantDe: e.target.value}))} className={inputClass} />
              </div>
            </div>
            
            {/* Row 8: Visa */}
            <div>
              <label className={labelClass}>Validite du Visa</label>
              <input type="text" value={formData.validiteVisa} onChange={e => setFormData(p => ({...p, validiteVisa: e.target.value}))} placeholder="30 dni / 90 dni" className={`${inputClass} placeholder:text-white/20`} />
            </div>
            
            {/* Row 9: Departure */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Date de depart</label>
                <input type="date" value={formData.dateDepart} onChange={e => setFormData(p => ({...p, dateDepart: e.target.value}))} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Aliant a / Going to</label>
                <input type="text" value={formData.aliantA} onChange={e => setFormData(p => ({...p, aliantA: e.target.value}))} className={inputClass} />
              </div>
            </div>
            
            {/* Row 10: Transport */}
            <div>
              <label className={labelClass}>Mode de transport</label>
              <div className="flex gap-2 mt-2">
                {['Avion', 'Voiture', 'Moto', 'Bateau'].map(t => (
                  <button key={t} type="button" onClick={() => setFormData(p => ({...p, modeTransport: t}))}
                    className={`px-3 py-1.5 rounded border text-xs transition-all ${formData.modeTransport === t ? 'border-[#7fa8b8] bg-[#7fa8b8]/10 text-[#7fa8b8]' : 'border-white/10 text-white/40 hover:border-white/20 hover:text-white/60'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // Payment section with multiple payments tracking
// A paid meal plan (B / HB / FB) covers its meals. Bar staff enter meals as ordinary
// bar lines, so they are matched to the plan by name.
function isPaidPlanMeal(
  res: { mealPlan?: string | null; mealPlanPaymentStatus?: string | null } | null | undefined,
  name: string | null | undefined,
): boolean {
  if (!res || String(res.mealPlanPaymentStatus || '').toUpperCase() !== 'PAID') return false;
  const plan = String(res.mealPlan || '').toUpperCase();
  const n = String(name || '').toLowerCase();
  const breakfast = /breakfast|zajtrk|petit[- ]d[ée]jeuner/.test(n);
  const lunch = /lunch|kosilo|d[ée]jeuner/.test(n) && !breakfast;
  const dinner = /dinner|ve[cč]erj|d[iî]ner/.test(n);
  if (plan === 'FB') return breakfast || lunch || dinner;
  if (plan === 'HB') return breakfast || dinner;
  if (plan === 'B' || plan === 'BB') return breakfast;
  return false;
}

function PaymentSection({ reservationId, totalAmount, currency, onPaymentChange, separatePaidItems = [], onRemainingChange }: { 
  reservationId: string; totalAmount: string; currency: string; onPaymentChange?: () => void;
  // Reports the real remaining (TOTAL − everything paid) back to the parent so the
  // "Za placilo" summary box can show the same number.
  onRemainingChange?: (remaining: number) => void;
  // Excursions/transfers the guest paid separately (in advance). Each carries its own amount,
  // payment method and date, and is shown as a real payment row (like the payment history) —
  // it is a card/cash/transfer payment just like the others. They count toward the total
  // (passed in via totalAmount) AND toward the amount paid, so the remaining matches the
  // /racun invoice and the reservation-row balance.
  separatePaidItems?: { label: string; eur: number; method: string; date: string }[];
}) {
  const [paymentsData, setPaymentsData] = React.useState<{
    id: string; amount: string; method: string; paidAt: string; notes: string | null; omAmountAr?: number | null;
  }[]>([]);
  const [showAddForm, setShowAddForm] = React.useState(false);
  const [newPayment, setNewPayment] = React.useState({ amount: '', method: 'card', paidAt: new Date().toISOString().split('T')[0], notes: '', omAmountAr: '' });
  const [saving, setSaving] = React.useState(false);
  
  async function loadPayments() {
    const { getPayments } = await import("@/app/actions/komba");
    const data = await getPayments(reservationId);
    setPaymentsData(data as typeof paymentsData);
  }
  
  React.useEffect(() => { loadPayments(); }, [reservationId]);
  
  const recordedPaid = paymentsData.reduce((sum, p) => sum + Number(p.amount), 0);
  const separatePaidEur = separatePaidItems.reduce((sum, s) => sum + (s.eur || 0), 0);
  const totalPaid = recordedPaid + separatePaidEur;
  const remaining = Number(totalAmount) - totalPaid;

  // Report the real remaining up so the parent's "Za placilo" box matches this section.
  React.useEffect(() => {
    onRemainingChange?.(remaining);
  }, [remaining, onRemainingChange]);
  
  async function handleAddPayment() {
    if (!newPayment.amount || Number(newPayment.amount) <= 0) return;
    setSaving(true);
    const { addPayment } = await import("@/app/actions/komba");
  await addPayment({
    reservationId,
    amount: newPayment.amount,
    method: newPayment.method,
    paidAt: newPayment.paidAt,
    notes: newPayment.notes,
    omAmountAr: newPayment.method === 'orange_money' && newPayment.omAmountAr ? Number(newPayment.omAmountAr) : undefined,
  });
  setNewPayment({ amount: '', method: 'card', paidAt: new Date().toISOString().split('T')[0], notes: '', omAmountAr: '' });
  setShowAddForm(false);
  loadPayments();
  onPaymentChange?.();
  setSaving(false);
  }
  
  async function handleDeletePayment(id: string) {
  if (!confirm("Izbrisi to placilo?")) return;
  const { deletePayment } = await import("@/app/actions/komba");
  await deletePayment(id);
  loadPayments();
  onPaymentChange?.();
  }
  
  const getMethodLabel = (method: string) => PAYMENT_METHODS.find(m => m.value === method)?.label || method;
  
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#9dafb5]">Placila</p>
        <LuxuryButton variant="ghost" onClick={() => setShowAddForm(!showAddForm)}>
          {showAddForm ? 'Preklici' : '+ Dodaj placilo'}
        </LuxuryButton>
      </div>
      
      {/* Summary */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/5">
        <div className="min-w-0">
          <p className="text-xs text-white/40">Skupaj</p>
          <p className="text-sm sm:text-lg font-light leading-tight tabular-nums text-[#c59b5b]">{totalAmount}<span className="text-white/40"> {currency}</span></p>
        </div>
        <div className="min-w-0">
          <p className="text-xs text-white/40">Placano</p>
          <p className="text-sm sm:text-lg font-light leading-tight tabular-nums text-[#8fae92]">{totalPaid.toFixed(2)}<span className="text-white/40"> {currency}</span></p>
        </div>
        <div className="min-w-0">
          <p className="text-xs text-white/40">Preostanek</p>
          <p className={`text-sm sm:text-lg font-light leading-tight tabular-nums ${remaining <= 0 ? 'text-[#8fae92]' : 'text-[#d7a593]'}`}>
            {remaining.toFixed(2)}<span className="opacity-60"> {currency}</span>
          </p>
        </div>
      </div>
      
      {/* Add Payment Form */}
      {showAddForm && (
        <div className="p-4 rounded-xl border border-[#c59b5b]/30 bg-[#c59b5b]/5 space-y-3">
          <p className="text-xs font-medium text-[#c59b5b]">Novo placilo</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-white/40 mb-1">Znesek</label>
              <input 
                type="number" step="0.01" autoFocus
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-[#c59b5b]/50 focus:outline-none"
                value={newPayment.amount}
                onChange={e => setNewPayment(p => ({ ...p, amount: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1">Nacin placila</label>
              <select 
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-[#c59b5b]/50 focus:outline-none"
                value={newPayment.method}
                onChange={e => setNewPayment(p => ({ ...p, method: e.target.value }))}
              >
                {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1">Datum placila</label>
              <input 
                type="date"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-[#c59b5b]/50 focus:outline-none"
                value={newPayment.paidAt}
                onChange={e => setNewPayment(p => ({ ...p, paidAt: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1">Opomba</label>
              <input 
                type="text"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-[#c59b5b]/50 focus:outline-none"
                placeholder="npr. depozit, koncno placilo..."
                value={newPayment.notes}
                onChange={e => setNewPayment(p => ({ ...p, notes: e.target.value }))}
              />
            </div>
            {/* Samo pri Orange Money: koliko Ar je dejansko prišlo na OM denarnico → priliv v kalkulacije */}
            {newPayment.method === 'orange_money' && (
              <div className="col-span-2">
                <label className="block text-xs text-[#c59b5b] mb-1">Znesek na Orange Money (Ar)</label>
                <input
                  type="number" step="1" min="0"
                  className="w-full rounded-lg border border-[#c59b5b]/30 bg-[#c59b5b]/5 px-3 py-2 text-sm text-white focus:border-[#c59b5b]/50 focus:outline-none"
                  placeholder="npr. 1350000"
                  value={newPayment.omAmountAr}
                  onChange={e => setNewPayment(p => ({ ...p, omAmountAr: e.target.value }))}
                />
                <p className="mt-1 text-[10px] text-white/40">Prišteje se v denarnico Orange Money v kalkulacijah (priliv).</p>
              </div>
            )}
          </div>
          <LuxuryButton variant="gold" onClick={handleAddPayment} disabled={saving || !newPayment.amount}>
            {saving ? 'Shranjujem...' : 'Shrani placilo'}
          </LuxuryButton>
        </div>
      )}
      
      {/* Payments List — recorded payments + separately-paid excursions/transfers.
          Separately-paid items are real card/cash/transfer payments, so they render as
          payment rows (amount, date, method badge) just like the payment history. */}
      {(paymentsData.length > 0 || separatePaidItems.length > 0) && (
        <div className="space-y-2">
          <p className="text-xs text-white/40">Zgodovino placil</p>
          {separatePaidItems.map((s, idx) => (
            <div key={`sep-${idx}`} className="flex items-center justify-between p-3 rounded-xl bg-[#8fae92]/[0.04] border border-[#8fae92]/15">
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-sm font-medium text-[#8fae92]">{s.eur.toFixed(2)} {currency}</p>
                  <p className="text-xs text-white/40">{s.date || '—'}</p>
                </div>
                <LuxuryBadge variant={s.method === 'card' ? 'ocean' : s.method === 'transfer' ? 'petrol' : s.method === 'orange_money' ? 'gold' : 'default'}>
                  {getMethodLabel(s.method)}
                </LuxuryBadge>
                <span className="text-xs text-white/50">{s.label}</span>
              </div>
            </div>
          ))}
          {paymentsData.map(p => (
            <div key={p.id} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5 group">
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-sm font-medium text-[#8fae92]">{p.amount} {currency}</p>
                  <p className="text-xs text-white/40">{p.paidAt}</p>
                </div>
                <LuxuryBadge variant={p.method === 'card' ? 'ocean' : p.method === 'transfer' ? 'petrol' : p.method === 'orange_money' ? 'gold' : 'default'}>
                  {getMethodLabel(p.method)}
                </LuxuryBadge>
                {p.omAmountAr ? <span className="text-xs text-[#c59b5b]">{ar(p.omAmountAr)} na OM</span> : null}
                {p.notes && <span className="text-xs text-white/50">{p.notes}</span>}
              </div>
              <button 
                onClick={() => handleDeletePayment(p.id)}
                className="opacity-0 group-hover:opacity-100 text-xs text-[#d7a593] hover:text-[#e0b9aa] transition-all"
              >
                Izbrisi
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ MAIN APP ============
export default function KombaCabanaApp() {
  // ALL HOOKS MUST BE AT THE TOP - before any conditional returns
  const [tab, setTab] = React.useState("bungalows");
  // Plačilo Fanji: kateri izlet (skupinski id) ima odprt panel + izbrani način/podjetje/datum.
  const [fanjaPayOpen, setFanjaPayOpen] = React.useState<string | null>(null);
  const [fanjaPayMethod, setFanjaPayMethod] = React.useState<'cash' | 'orange'>('cash');
  const [fanjaPayCompany, setFanjaPayCompany] = React.useState<'tourism' | 'sarl'>('tourism');
  const [fanjaPayDate, setFanjaPayDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [fanjaPaySaving, setFanjaPaySaving] = React.useState(false);
  // Plačilo dobavitelju prevoza (Dilip/Herman) v pending transferjih — panel keyiran po refKey.
  const [supPayOpen, setSupPayOpen] = React.useState<string | null>(null);
  const [supPayMethod, setSupPayMethod] = React.useState<'cash' | 'orange'>('cash');
  const [supPayCompany, setSupPayCompany] = React.useState<'tourism' | 'sarl'>('tourism');
  const [supPayDate, setSupPayDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [supPaySaving, setSupPaySaving] = React.useState(false);
  // Ročni zneski za dodatna gotovinska doplačila (voznik čolna / nosači / tuc tuc), keyirano po refKey.
  const [extraAmt, setExtraAmt] = React.useState<Record<string, string>>({});
  // Schedules are always shown for the current month (view-only, no month picker).
  const scheduleNow = new Date();
  const scheduleYear = scheduleNow.getFullYear();
  const scheduleMonth = scheduleNow.getMonth() + 1;
  // Which grouped tiles on the personal landing page are expanded. Declared here
  // (not inside the render IIFE) so the choice survives an SWR refresh.
  const [openEntryGroups, setOpenEntryGroups] = React.useState<Record<string, boolean>>({});
  const [selectedReservationId, setSelectedReservationId] = React.useState("");
  // Guest opened from search may already be checked out; the dashboard loads only
  // active reservations, so we ask for that one extra guest to be included.
  const [extraReservationId, setExtraReservationId] = React.useState("");

  const { data, error, isLoading } = useSWR(
    ["dashboard", extraReservationId],
    () => getDashboardData(extraReservationId || undefined),
    {
      refreshInterval: 0,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      keepPreviousData: true,
    },
  );
  const [showNewBookingForm, setShowNewBookingForm] = React.useState(false);
  const [reservationSearch, setReservationSearch] = React.useState("");
  // Debounced full search across ALL reservations (incl. checked-out / past guests),
  // since the dashboard only loads active ones.
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(reservationSearch.trim()), 250);
    return () => clearTimeout(t);
  }, [reservationSearch]);
  const { data: searchResults, isLoading: searchLoading } = useSWR(
    debouncedSearch.length >= 2 ? ["reservation-search", debouncedSearch] : null,
    () => searchReservations(debouncedSearch),
    { revalidateOnFocus: false }
  );
  const [showPricingModal, setShowPricingModal] = React.useState(false);
  const [showPendingTransfers, setShowPendingTransfers] = React.useState(false);
  const [showPendingExcursions, setShowPendingExcursions] = React.useState(false);
  const [showNabava, setShowNabava] = React.useState(false);
  const [showNabavaKomba, setShowNabavaKomba] = React.useState(false);
  const [nabavaKombaDate, setNabavaKombaDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [nabavaKombaNote, setNabavaKombaNote] = React.useState("");
  const [nabavaKombaSaving, setNabavaKombaSaving] = React.useState(false);
  const [nabavaDate, setNabavaDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [nabavaNote, setNabavaNote] = React.useState("");
  const [nabavaSaving, setNabavaSaving] = React.useState(false);
  const [nabavaEditId, setNabavaEditId] = React.useState<string | null>(null);
  const [nabavaEditDate, setNabavaEditDate] = React.useState("");
  const [nabavaEditNote, setNabavaEditNote] = React.useState("");
  const [showTaxes, setShowTaxes] = React.useState(false);
  // Header shortcut to the ring-a-phone panel, which otherwise sits at the very
  // bottom of the entry page.
  const [showPushBox, setShowPushBox] = React.useState(false);
  const [pricingCalc, setPricingCalc] = React.useState({
    excursionId: "",
    boatId: "",
    pax: 2,
    includeEntrance: true,
    lunchProviderId: "",
    routeId: "",
    transferBoatId: "",
    transferPax: 2,
  });
  const [pricingTab, setPricingTab] = React.useState<'calculator' | 'group' | 'schedule'>('calculator');
  // Group excursion calculator (preview only): how much a shared boat would cost if several bungalows go together.
  const [groupCalc, setGroupCalc] = React.useState<{ excursionId: string; boatId: string; includeEntrance: boolean; lunchProviderId: string; parts: number[] }>({
    excursionId: "",
    boatId: "",
    includeEntrance: true,
    lunchProviderId: "",
    parts: [2, 2],
  });
  const [newSchedule, setNewSchedule] = React.useState({ date: today(), excursionType: SCHEDULE_EXCURSION_TYPES[0].value, isOption: false, notes: "" });
  const [savingSchedule, setSavingSchedule] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const [reservationDraft, setReservationDraft] = React.useState({ guestName: "", bungalow: "Bungalow I", pax: 2, arrival: today(), departure: "", bookingSource: "Booking.com", agencyName: "" });
  const [orderDraft, setOrderDraft] = React.useState({ name: "", category: "Razno", qty: 1, priceAr: 0, eventDate: today() });
  const [transferDraft, setTransferDraft] = React.useState({ type: "arrival" as "arrival" | "departure", date: today(), routeId: "", boatId: "", paymentStatus: "UNPAID" as "PAID" | "UNPAID" });
  const [excursionDraft, setExcursionDraft] = React.useState({ excursionId: "", date: today(), boatId: "", paymentStatus: "UNPAID" as "PAID" | "UNPAID" });
  
  // Collapsible states for GuestCard (outside to prevent reset on refresh)
  const [showDates, setShowDates] = React.useState(false);
  // Collapsed by default, like every other section — opening a guest card should show
  // the overview, not an expanded form.
  const [showGuestData, setShowGuestData] = React.useState(false);
  const [showPolice, setShowPolice] = React.useState(false);
  const [showMealPlan, setShowMealPlan] = React.useState(false);
  const [showPayment, setShowPayment] = React.useState(false);
  const [showGroup, setShowGroup] = React.useState(false);
  const [showPoliceMenu, setShowPoliceMenu] = React.useState(false);
  const [showBorutMenu, setShowBorutMenu] = React.useState(false);
  const [showUrskaMenu, setShowUrskaMenu] = React.useState(false);
  const [showReceiptCapture, setShowReceiptCapture] = React.useState(false);
  // Če je mobilni brskalnik osvežil stran med fotografiranjem računa, znova odpri modal (osnutek se obnovi).
  React.useEffect(() => {
    try {
      if (sessionStorage.getItem(STROSKI_CAPTURE_OPEN_KEY) === "1") setShowReceiptCapture(true);
    } catch {
      // ignoriraj
    }
  }, []);
  const [showGuestEmailsMenu, setShowGuestEmailsMenu] = React.useState(false);
  const [showNotesMenu, setShowNotesMenu] = React.useState(false);
  // "Extend stay" panel toggle (inputs uncontrolled ����� read on confirm, no focus loss).
  const [showExtendStay, setShowExtendStay] = React.useState(false);
  const [extendingStay, setExtendingStay] = React.useState(false);
  const [showTransfers, setShowTransfers] = React.useState(false);
  const [showExcursions, setShowExcursions] = React.useState(false);
  const [expandedExcursionId, setExpandedExcursionId] = React.useState<string | null>(null);
  // Which excursion's "cancel → credit" panel is open (toggled by click; inputs are
  // uncontrolled to avoid remounting the nested GuestCard and losing focus).
  const [cancelCreditFor, setCancelCreditFor] = React.useState<string | null>(null);
  const [cancellingCredit, setCancellingCredit] = React.useState(false);
  const [reactivatingExc, setReactivatingExc] = React.useState(false);
  const [showPoliceForm, setShowPoliceForm] = React.useState(false);
  const [showFirstGuestData, setShowFirstGuestData] = React.useState(false);
  const [showSecondGuestData, setShowSecondGuestData] = React.useState(false);
  const [showThirdGuestData, setShowThirdGuestData] = React.useState(false);
  const [showFourthGuestData, setShowFourthGuestData] = React.useState(false);
  const [copiedLink, setCopiedLink] = React.useState<null | 'first' | 'second' | 'third' | 'fourth'>(null);
  const [generatingLink, setGeneratingLink] = React.useState<null | 'first' | 'second' | 'third' | 'fourth'>(null);
  const [emailingGuest, setEmailingGuest] = React.useState(false);
  const [emailingInvoice, setEmailingInvoice] = React.useState(false);
  const [loadingInvoicePreview, setLoadingInvoicePreview] = React.useState(false);
  const [invoicePreview, setInvoicePreview] = React.useState<{ html: string; to: string; excludeAccommodation: boolean; onlyStayMeals: boolean } | null>(null);
  const [loadingCheckinPreview, setLoadingCheckinPreview] = React.useState(false);
  const [checkinPreview, setCheckinPreview] = React.useState<{ html: string; to: string; guests: { slot: 'first' | 'second' | 'third' | 'fourth'; label: string; expanded: boolean; data: Record<CheckinGuestField, string> }[] } | null>(null);
  const [savingCheckinNames, setSavingCheckinNames] = React.useState(false);
  const [loadingFeedbackPreview, setLoadingFeedbackPreview] = React.useState(false);
  const [emailingFeedback, setEmailingFeedback] = React.useState(false);
  const [feedbackPreview, setFeedbackPreview] = React.useState<{ html: string; to: string } | null>(null);
  const [loadingOfferPreview, setLoadingOfferPreview] = React.useState(false);
  const [emailingOffer, setEmailingOffer] = React.useState(false);
  const [offerPreview, setOfferPreview] = React.useState<{ html: string; to: string } | null>(null);
  const [emailingVoucher, setEmailingVoucher] = React.useState(false);
  const [loadingVoucherPreview, setLoadingVoucherPreview] = React.useState<null | 'arrival' | 'departure'>(null);
  const [voucherPreview, setVoucherPreview] = React.useState<{ html: string; to: string; type: 'arrival' | 'departure' } | null>(null);
  // "Ask for port departure time" email (transfers often arrive without the boat/port time).
  const [loadingPortTime, setLoadingPortTime] = React.useState(false);
  const [sendingPortTime, setSendingPortTime] = React.useState(false);
  const [portTimePreview, setPortTimePreview] = React.useState<{ html: string; to: string; isAgency: boolean } | null>(null);
  const [sentEmailsRefresh, setSentEmailsRefresh] = React.useState(0);
  // Collapsible: the sent-emails box for this reservation is hidden behind a toggle.
  const [showSentEmails, setShowSentEmails] = React.useState(false);
  const [profileSaved, setProfileSaved] = React.useState<'idle' | 'saving' | 'saved'>('idle');
  const [newRate, setNewRate] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  // Which delivery-note item's service date is being corrected, and the picked value.
  const [dateEditItem, setDateEditItem] = React.useState<string | null>(null);
  const [dateEditVal, setDateEditVal] = React.useState("");
  // Which bar (delivery-note) item's quantity is being corrected, and the typed value.
  const [qtyEditItem, setQtyEditItem] = React.useState<string | null>(null);
  const [qtyEditVal, setQtyEditVal] = React.useState("");
  
  // PIN Protection State
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  const [pin, setPin] = React.useState('');
  const [pinError, setPinError] = React.useState('');
  
  const ADMIN_PIN = '2580';
  
  // Check localStorage on mount for auth
  React.useEffect(() => {
    const saved = localStorage.getItem('kc_admin_auth');
    if (saved === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  // Deep link into a guest card: /?guest=<reservationId> opens that guest's full
  // card (used from the archive). The guest may already be checked out — the
  // extraReservationId effect then loads that one guest into the dashboard set.
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const guestId = new URLSearchParams(window.location.search).get('guest');
    if (guestId) {
      setSelectedReservationId(guestId);
      setTab('guest');
    }
  }, []);
  
  const handlePinKey = (key: string) => {
    if (key === 'C') {
      setPin('');
      setPinError('');
    } else if (key === '←') {
      setPin(p => p.slice(0, -1));
      setPinError('');
    } else if (pin.length < 4) {
      const newPin = pin + key;
      setPin(newPin);
      setPinError('');
      if (newPin.length === 4) {
        if (newPin === ADMIN_PIN) {
          setIsAuthenticated(true);
          localStorage.setItem('kc_admin_auth', 'true');
        } else {
          setPinError('Napačna koda');
          setTimeout(() => setPin(''), 500);
        }
      }
    }
  };
  
  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('kc_admin_auth');
    setPin('');
  };

  const reservations: Reservation[] = data?.reservations || [];
  const exchangeRate = data?.exchangeRate || DEFAULT_RATE;
  const dbRoutes = data?.routes || [];
  // All routes incl. inactive — only for resolving supplier costs across
  // same-named duplicate routes. Dropdowns keep using dbRoutes (active only).
  const dbRoutesAll = data?.routesAll || dbRoutes;
  const dbSellingPricing = data?.sellingPricing || [];
  const dbSupplierPricing = data?.supplierPricing || [];
  const dbBoats = data?.boats || [];
  const dbExcursions = data?.excursions || [];
  const dbExcursionSellingPricing = data?.excursionSellingPricing || [];
  const dbLunchProviders = data?.lunchProviders || [];
  const dbMealProducts = data?.mealProducts || [];
  const dbAllProducts = data?.allProducts || [] as { id: string; name: string; category: string; costCategory?: string; priceAr: number }[];
  const dbScheduledExcursions = data?.scheduledExcursions || [] as { id: string; date: string; excursionType: string; isOption: boolean; notes: string | null; guests: { reservationId: string; guestName: string; bungalow: string; pax: number }[] }[];
  // Plačila dobaviteljem prevoza — hitro iskanje po refKey
  const dbSupplierPayments = (data?.supplierPayments || []) as { refKey: string; supplier: string; paidAt: string | null; method: string | null; company: string | null; amountAr: number }[];
  const supplierPayByKey = React.useMemo(() => {
    const m: Record<string, (typeof dbSupplierPayments)[number]> = {};
    for (const p of dbSupplierPayments) m[p.refKey] = p;
    return m;
  }, [dbSupplierPayments]);
  
  // Helper to get meal plan price per day from products (isce po ID iz Admin cenika - kategorija "Prehrana")
  const getMealPlanPrice = (mealPlan: string): number => {
    const productId = mealPlan === 'B' ? 'meal-breakfast' : mealPlan === 'HB' ? 'meal-hb' : mealPlan === 'FB' ? 'meal-fb' : '';
    const product = dbMealProducts.find((p: { id: string; priceAr: number }) => p.id === productId);
    return product ? product.priceAr / exchangeRate : 0;
  };
  
  // Helper to get meal plan price in Ariary (for order items)
  const getMealPlanPriceAr = (mealPlan: string): number => {
    const productId = mealPlan === 'B' ? 'meal-breakfast' : mealPlan === 'HB' ? 'meal-hb' : mealPlan === 'FB' ? 'meal-fb' : '';
    const product = dbMealProducts.find((p: { id: string; priceAr: number }) => p.id === productId);
    return product ? product.priceAr : 0;
  };
  
  // Helper to get meal plan name for order items
  const getMealPlanName = (mealPlan: string): string => {
    const productId = mealPlan === 'B' ? 'meal-breakfast' : mealPlan === 'HB' ? 'meal-hb' : mealPlan === 'FB' ? 'meal-fb' : '';
    const product = dbMealProducts.find((p: { id: string; name: string }) => p.id === productId);
    return product ? product.name : mealPlan;
  };
  
  // Handle check-in with meal plan and transfer logic
  const handleCheckIn = async (res: Reservation) => {
    // Helper to format date string (YYYY-MM-DD)
    const formatDateStr = (dateVal: string | Date | null | undefined): string => {
      if (!dateVal) return '';
      const d = typeof dateVal === 'string' ? dateVal : new Date(dateVal).toISOString();
      return d.split('T')[0];
    };
    
    // 0. Add ACCOMMODATION (remaining balance for stay) to order
    // Include payment history info
    const totalAmount = res.totalAmount ? Number(res.totalAmount) : 0;
    const amountPaid = res.amountPaid ? Number(res.amountPaid) : 0;
    const remainingEur = totalAmount - amountPaid;
    
    // Build payment info text from payments array
    const payments = res.payments || [];
    const paymentInfoParts = payments.map((p: { amount: number | string; method: string; paidAt: string }) => {
      const amt = Number(p.amount);
      const method = p.method === 'card' ? 'kartica' : p.method === 'cash' ? 'gotovina' : p.method === 'transfer' ? 'nakazilo' : p.method;
      const date = new Date(p.paidAt).toLocaleDateString('sl-SI');
      return `${amt.toFixed(2)} EUR (${method}, ${date})`;
    });
    const paymentInfo = paymentInfoParts.length > 0 ? ` | Placano: ${paymentInfoParts.join(', ')}` : '';
    
    const arr = res.arrival ? new Date(res.arrival) : null;
    const dep = res.departure ? new Date(res.departure) : null;
    const nights = arr && dep ? Math.ceil((dep.getTime() - arr.getTime()) / (1000 * 60 * 60 * 24)) : 0;
    const remainingAr = Math.round(remainingEur * exchangeRate);
    
    // Always add accommodation info (even if fully paid, for record)
    // Use arrival date for eventDate so statistics count it in correct month
    const arrivalDateStr = formatDateStr(res.arrival);
    await addOrderItem(res.id, {
      name: `Bivanje ${res.bungalow} (${nights} noci, ${res.pax} oseb) | Skupaj: ${totalAmount.toFixed(2)} EUR${paymentInfo}`,
      category: 'Bivanje',
      qty: 1,
      priceAr: remainingAr,
      paymentStatus: remainingEur > 0 ? 'UNPAID' : 'PAID',
      eventDate: arrivalDateStr
    });
    
    // 1. Add MEAL PLAN to order ONLY if PAID (prepaid)
    // If UNPAID - staff will add meals daily via Bar app
    if (res.mealPlan && res.mealPlanPaymentStatus === 'PAID') {
      const arr = res.arrival ? new Date(res.arrival) : null;
      const dep = res.departure ? new Date(res.departure) : null;
      const days = arr && dep ? Math.ceil((dep.getTime() - arr.getTime()) / (1000 * 60 * 60 * 24)) : 0;
      // Board may cover only part of the party — the others pay per meal at the bar.
      const covered = boardPax(res.pax, res.mealPlanPax);
      const totalQty = covered * days;
      const pricePerUnitAr = getMealPlanPriceAr(res.mealPlan);
      const mealName = getMealPlanName(res.mealPlan);
      
      if (totalQty > 0 && pricePerUnitAr > 0) {
        await addOrderItem(res.id, {
          name: `${mealName} (${paxLabel(covered)} × ${days} dni)`,
          category: 'Prehrana',
          qty: 1,
          priceAr: pricePerUnitAr * totalQty,
          paymentStatus: 'PAID',
          eventDate: arrivalDateStr
        });
      }
    }
    
    // 2. Add ARRIVAL transfer to order (if exists)
    // Note: Transfer data is in res.transfers.arrival (mapped from transfers table)
    const arrivalTransfer = res.transfers?.arrival;
    if (arrivalTransfer && arrivalTransfer.route && arrivalTransfer.route !== '') {
      const routeId = arrivalTransfer.route;
      const boatId = arrivalTransfer.boatId || '';
      const pax = res.pax || 1;
      const isPaid = arrivalTransfer.paymentStatus === 'PAID';
      const totalPriceEur = arrivalTransfer.guestPrice || getTransferGuestPrice(routeId, boatId, pax);
      const totalPriceAr = Math.round(totalPriceEur * exchangeRate); // Convert EUR to Ariary
      const routeName = dbRoutes.find((r: { id: string; name: string }) => r.id === routeId)?.name || routeId;
      const boatName = dbBoats.find((b: { id: string; name: string }) => b.id === boatId)?.name || '';
      // Get arrival date as string for eventDate (YYYY-MM-DD format)
      const arrivalDateStr = formatDateStr(res.arrival);
      
      await addOrderItem(res.id, {
        name: `Transfer ARRIVAL: ${routeName}${boatName ? ` (${boatName})` : ''} - ${pax} pax`,
        category: 'Transfer',
        qty: 1,
        priceAr: isPaid ? 0 : totalPriceAr, // If paid, add with 0 price (evidence only)
        refPriceAr: totalPriceAr, // real price kept for display, even when paid
        paymentStatus: isPaid ? 'PAID' : 'UNPAID',
        paidMethod: isPaid ? (arrivalTransfer.paidMethod || undefined) : undefined,
        paidDate: isPaid ? (arrivalTransfer.paidDate || undefined) : undefined,
        eventDate: arrivalDateStr // Transfer happens on arrival date
      });
    }
    
    // 3. Add DEPARTURE transfer to order (if exists)
    const departureTransfer = res.transfers?.departure;
    if (departureTransfer && departureTransfer.route && departureTransfer.route !== '') {
      const routeId = departureTransfer.route;
      const boatId = departureTransfer.boatId || '';
      const pax = res.pax || 1;
      const isPaid = departureTransfer.paymentStatus === 'PAID';
      const totalPriceEur = departureTransfer.guestPrice || getTransferGuestPrice(routeId, boatId, pax);
      const totalPriceAr = Math.round(totalPriceEur * exchangeRate); // Convert EUR to Ariary
      const routeName = dbRoutes.find((r: { id: string; name: string }) => r.id === routeId)?.name || routeId;
      const boatName = dbBoats.find((b: { id: string; name: string }) => b.id === boatId)?.name || '';
      // Get departure date as string for eventDate (YYYY-MM-DD format)
      const departureDateStr = formatDateStr(res.departure);
      
      await addOrderItem(res.id, {
        name: `Transfer DEPARTURE: ${routeName}${boatName ? ` (${boatName})` : ''} - ${pax} pax`,
        category: 'Transfer',
        qty: 1,
        priceAr: isPaid ? 0 : totalPriceAr, // If paid, add with 0 price (evidence only)
        refPriceAr: totalPriceAr, // real price kept for display, even when paid
        paymentStatus: isPaid ? 'PAID' : 'UNPAID',
        paidMethod: isPaid ? (departureTransfer.paidMethod || undefined) : undefined,
        paidDate: isPaid ? (departureTransfer.paidDate || undefined) : undefined,
        eventDate: departureDateStr // Transfer happens on departure date
      });
    }
    
    // 4. Add EXCURSIONS to order
    // UNPAID excursions ���� add with price now (needs to be paid)
    // PAID excursions ����������� add as evidence only (0 Ar) - will be noted for the excursion date
    if (res.excursions && res.excursions.length > 0) {
      for (const exc of res.excursions) {
        if (exc.status === 'CANCELLED') continue; // cancelled → credited, no order line
        const excursion = dbExcursions.find((e: { id: string; name: string }) => e.id === exc.excursionId);
        const excursionName = excursion?.name || 'Izlet';
        const excDate = formatDateStr(exc.date);
        const isPaid = exc.paymentStatus === 'PAID';
        const boatName = dbBoats.find((b: { id: string; name: string }) => b.id === exc.boatId)?.name || '';
        const lunchProvider = dbLunchProviders.find((lp: { id: string; name: string }) => lp.id === exc.lunchProviderId);
        
        // Build included items list (guest-facing item name is in English �� appears on
        // the delivery note and invoice)
        const included: string[] = [];
        if (boatName) included.push(boatName);
        if (exc.entranceFee && exc.entranceFee > 0) included.push('entrance fee');
        if (lunchProvider) included.push(`lunch: ${lunchProvider.name}`);
        const includedText = included.length > 0 ? ` | Incl: ${included.join(', ')}` : '';
        
        // Total price = guest price + entrance fee + lunch price (all in EUR, convert to Ariary)
        const totalPriceEur = (exc.guestPrice || 0) + (exc.entranceFee || 0) + (exc.lunchPrice || 0);
        const totalPriceAr = Math.round(totalPriceEur * exchangeRate); // Convert EUR to Ariary
        
        await addOrderItem(res.id, {
          name: `Excursion: ${excursionName} - ${exc.pax} pax${includedText}`,
          category: 'Izlet',
          qty: 1,
          priceAr: isPaid ? 0 : totalPriceAr, // If paid, add with 0 price (evidence only)
          refPriceAr: totalPriceAr, // real price kept for display, even when paid
          paymentStatus: isPaid ? 'PAID' : 'UNPAID',
          paidMethod: isPaid ? (exc.paidMethod || undefined) : undefined,
          paidDate: isPaid ? (exc.paidDate || undefined) : undefined,
          eventDate: excDate // Excursion happens on specific date
        });
      }
    }
    
    // 5. Create first delivery note for today (so transfers/excursions show under the day)
    const { getOrCreateDeliveryNote } = await import('@/app/actions/delivery');
    await getOrCreateDeliveryNote(res.id, res.bungalow, res.guestName);
    
    // Update check-in timestamp
    await handleUpdateReservation(res.id, { checkedInAt: new Date().toISOString() });
    showMsg("Check-in uspesen!");
  };
  
  // Objavljeni izleti (Fanjin urnik) — dodajanje / brisanje
  async function handleAddSchedule() {
    if (!newSchedule.date || !newSchedule.excursionType) {
      showMsg("Izberi datum in tip izleta!");
      return;
    }
    setSavingSchedule(true);
    await addScheduledExcursion({
      date: newSchedule.date,
      excursionType: newSchedule.excursionType,
      isOption: newSchedule.isOption,
      notes: newSchedule.notes.trim() || undefined,
    });
    setNewSchedule({ date: newSchedule.date, excursionType: SCHEDULE_EXCURSION_TYPES[0].value, isOption: false, notes: "" });
    refresh();
    setSavingSchedule(false);
    showMsg("Izlet dodan v urnik!");
  }

  async function handleDeleteSchedule(id: string) {
    if (!confirm("Izbrisi ta izlet iz urnika?")) return;
    await deleteScheduledExcursion(id);
    refresh();
    showMsg("Izlet izbrisan iz urnika.");
  }

  // Build TRANSFER_ROUTES from database
  const TRANSFER_ROUTES = ["", ...dbRoutes.filter((r: { id: string }) => r.id !== 'route-airport-port').map((r: { name: string }) => r.name)];
  
  // Build EXCURSION options from database
  const EXCURSION_OPTIONS = ["", ...dbExcursions.map((e: { name: string }) => e.name)];
  
  // Helper to get TOTAL guest price for transfer (price per person * pax)
  // routeId is the route ID (e.g. "route-nosy-be"), not the route name
  const getTransferGuestPrice = (routeId: string, boatId: string, pax: number): number => {
    if (!routeId || !boatId) return 0;
    const pricing = dbSellingPricing.find((sp: { routeId: string; boatId: string }) => 
      sp.routeId === routeId && sp.boatId === boatId
    );
    if (!pricing) return 0;
    const paxKey = `pricePax${Math.min(Math.max(pax, 1), 6)}` as keyof typeof pricing;
    const pricePerPerson = Number(pricing[paxKey]) || 0;
    return pricePerPerson * pax; // Total price = price per person * number of guests
  };
  
  // Herman (taxi) is priced from the supplier price list, per pickup route/location.
  const HERMAN_BOAT_ID = 'taxi-herman';
  // All taxi drivers (Herman, Amad, …) — car providers, chosen per transfer. Herman is the default.
  const taxiBoats = dbBoats.filter((b: { id: string }) => b.id.startsWith('taxi-'));
  // Which taxi drives this leg (falls back to Herman for legacy transfers with no taxi set).
  const taxiIdOf = (t?: { taxiBoatId?: string | null }): string => (t?.taxiBoatId && t.taxiBoatId.length > 0 ? t.taxiBoatId : HERMAN_BOAT_ID);
  const taxiNameOf = (taxiId: string): string => dbBoats.find((b: { id: string; name: string }) => b.id === taxiId)?.name || 'Taksi';
  // Supplier-payment key suffix per taxi (herman | amad) so payments to each are tracked separately.
  const taxiKey = (taxiId: string): string => taxiId.replace(/^taxi-/, '') || 'herman';
  // Supplier cost (what we PAY the carrier: boat owner / Herman) in Ariary.
  const getSupplierCostAr = (boatId?: string, routeId?: string): number => {
    if (!boatId || !routeId) return 0;
    // 1) Exact match on route id.
    const exact = dbSupplierPricing.find((sp: { boatId: string; routeId: string; priceAr: number }) =>
      sp.boatId === boatId && sp.routeId === routeId
    );
    if (exact) return Number(exact.priceAr) || 0;
    // 2) Fallback: some routes are duplicated under different ids but the SAME
    //    name (e.g. "Airport Fascene - Komba Cabana" exists as both route-airport
    //    and route-port). The selling price may live on one id and the supplier
    //    cost on its same-named sibling. Match by route name so the cost still
    //    resolves from the existing price list.
    const routeName = dbRoutesAll.find((r: { id: string; name?: string }) => r.id === routeId)?.name;
    if (routeName) {
      const siblingIds = dbRoutesAll
        .filter((r: { id: string; name?: string }) => r.name === routeName)
        .map((r: { id: string }) => r.id);
      const sibling = dbSupplierPricing.find((sp: { boatId: string; routeId: string; priceAr: number }) =>
        sp.boatId === boatId && siblingIds.includes(sp.routeId)
      );
      if (sibling) return Number(sibling.priceAr) || 0;
    }
    return 0;
  };
  // Taxi routes for a given driver = routes that have a supplier price for that taxi.
  // The "Relacija avta (taksi)" dropdown must follow the SELECTED taxi, otherwise
  // Amad-only routes (e.g. "Exora Beach to Big Port Nosy Be") never show up.
  const taxiRoutesFor = (taxiId: string) => dbRoutes.filter((r: { id: string }) =>
    dbSupplierPricing.some((sp: { boatId: string; routeId: string }) => sp.boatId === taxiId && sp.routeId === r.id)
  );
  // Taxi SELLING price (for the guest) in EUR, from the selling price list, for the
  // selected driver (defaults to Herman for legacy legs with no taxi set).
  const getHermanGuestPrice = (hermanRouteId?: string, pax = 1, taxiId: string = HERMAN_BOAT_ID): number => {
    if (!hermanRouteId) return 0;
    return getTransferGuestPrice(hermanRouteId, taxiId, pax);
  };

  // Helper to get TOTAL guest price for excursion (price per person * pax)
  const getExcursionGuestPrice = (excursionId: string, boatId: string, pax: number): number => {
    if (!excursionId || !boatId) return 0;
    const pricing = dbExcursionSellingPricing.find((esp: { excursionId: string; boatId: string }) => 
      esp.excursionId === excursionId && esp.boatId === boatId
    );
    if (!pricing) return 0;
    const paxKey = `pricePax${Math.min(Math.max(pax, 1), 6)}` as keyof typeof pricing;
    const pricePerPerson = Number(pricing[paxKey]) || 0;
    return pricePerPerson * pax; // Total price = price per person * number of guests
  };
  
  const activeReservation = () => reservations.find(r => r.id === selectedReservationId);

  // Ce izbrani gost ni v naloženem naboru (odjavljen gost, odprt iz iskanja),
  // ga posebej zahtevamo, da dobi polno kartico (emaili, dobavnica, placila).
  React.useEffect(() => {
    if (isLoading) return;
    if (!selectedReservationId) return;
    if (reservations.some(r => r.id === selectedReservationId)) return;
    if (extraReservationId === selectedReservationId) return;
    setExtraReservationId(selectedReservationId);
  }, [selectedReservationId, reservations, extraReservationId, isLoading]);

  const showMsg = (text: string) => {
    setMessage(text);
    setTimeout(() => setMessage(""), 3000);
  };

  // Key is now ["dashboard", extraReservationId] — revalidate every dashboard key
  // so a refresh works no matter which guest is currently loaded.
  const refresh = () => mutate(key => Array.isArray(key) && key[0] === "dashboard");

  // ============ ACTIONS ============
async function handleCreateReservation() {
  const guestName = guestNameRef.current?.value || '';
  const agencyName = agencyNameRef.current?.value || '';
  const agencyCommission = agencyCommissionRef.current?.value ? Number(agencyCommissionRef.current.value) : 0;
  if (!guestName.trim() || !reservationDraft.departure) {
  showMsg("Izpolni vsa polja!");
  return;
  }
  setSaving(true);
  const hasOverlap = await checkOverlap(reservationDraft.bungalow, reservationDraft.arrival, reservationDraft.departure);
  if (hasOverlap) {
  showMsg("Prekrivanje z obstojecim gostom!");
  setSaving(false);
  return;
  }
  const id = await createReservation({ ...reservationDraft, guestName, agencyName, agencyCommission });
  setReservationDraft({ guestName: "", bungalow: "Bungalow I", pax: 2, arrival: today(), departure: "", bookingSource: "Booking.com", agencyName: "" });
  if (guestNameRef.current) guestNameRef.current.value = '';
  if (agencyNameRef.current) agencyNameRef.current.value = '';
  if (agencyCommissionRef.current) agencyCommissionRef.current.value = '';
  setSelectedReservationId(id);
  refresh();
  showMsg("Rezervacija ustvarjena!");
  setSaving(false);
  }

  async function handleUpdateReservation(id: string, updates: Parameters<typeof updateReservation>[1]) {
    setSaving(true);
    await updateReservation(id, updates);
    refresh();
    setSaving(false);
  }

  async function handleUpdateTransfer(reservationId: string, type: 'arrival' | 'departure', data: Parameters<typeof updateTransfer>[2]) {
    setSaving(true);
    await updateTransfer(reservationId, type, data);
    refresh();
    setSaving(false);
  }

  async function handleDeleteReservation(id: string) {
    if (!confirm("Ali res zelis izbrisati to rezervacijo in kartico gosta?")) return;
    setSaving(true);
    try {
      const { deleteReservationAndGuest } = await import("@/app/actions/komba");
      await deleteReservationAndGuest(id, true);
      setSelectedReservationId("");
      refresh();
      showMsg("Rezervacija in kartica gosta izbrisana!");
      setTab("reservations");
    } catch (err) {
      console.error("[v0] Error deleting reservation:", err);
      showMsg("Napaka pri brisanju rezervacije: " + (err instanceof Error ? err.message : "Neznana napaka"));
    } finally {
      setSaving(false);
    }
  }

  async function handleAddOrder() {
    const reservation = activeReservation();
    if (!reservation || !orderDraft.name.trim()) return;
    setSaving(true);
  await addOrderItem(reservation.id, orderDraft);
  setOrderDraft(prev => ({ name: "", category: prev.category, qty: 1, priceAr: 0, eventDate: prev.eventDate }));
    refresh();
    setSaving(false);
  }

  async function handleDeleteOrder(item: { id: string; isBarItem?: boolean; deliveryNoteId?: string }) {
    setSaving(true);
    try {
      if (item.isBarItem) {
        // Bar items live in delivery_note_items, not order_items — delete from the delivery note.
        if (item.deliveryNoteId) {
          await removeItemFromDeliveryNote(item.id, item.deliveryNoteId);
        } else {
          showMsg("Napaka: postavke dobavnice ni mogoce izbrisati (manjka dobavnica).");
        }
      } else {
        await deleteOrderItem(item.id);
      }
      refresh();
    } catch {
      showMsg("Brisanje postavke ni uspelo. Poskusite znova.");
    }
    setSaving(false);
  }

  async function handleToggleFree(item: { id: string; deliveryNoteId?: string; isBarItem?: boolean }, free: boolean) {
    setSaving(true);
    try {
      if (item.isBarItem) {
        if (!item.deliveryNoteId) {
          showMsg("Napaka: postavke ni mogoce spremeniti (manjka dobavnica).");
          setSaving(false);
          return;
        }
        await toggleItemFree(item.id, item.deliveryNoteId, free);
      } else {
        // Order item (massage, snack, excursion, ...) -> mark complimentary via order_items.isFree
        await toggleOrderItemFree(item.id, free);
      }
      refresh();
      showMsg(free ? "Postavka oznacena kot brezplacna (On House)." : "Postavka spet placljiva.");
    } catch {
      showMsg("Sprememba ni uspela. Poskusite znova.");
    }
    setSaving(false);
  }

  // Release a meal from the meal plan (or put it back). Released meals become billable
  // and move to "Za placilo"; only applies to delivery-note (bar) items.
  async function handleToggleMealCovered(item: { id: string; deliveryNoteId?: string }, covered: boolean) {
    if (!item.deliveryNoteId) {
      showMsg("Napaka: postavke ni mogoce spremeniti (manjka dobavnica).");
      return;
    }
    setSaving(true);
    try {
      await toggleItemMealPlanCovered(item.id, item.deliveryNoteId, covered);
      refresh();
      showMsg(covered ? "Obrok spet vkljucen v penzion." : "Obrok dodan na racun kot za placilo.");
    } catch {
      showMsg("Sprememba ni uspela. Poskusite znova.");
    }
    setSaving(false);
  }

  // Correct a wrong quantity entered by bar staff on a delivery-note item.
  async function handleSaveItemQty(itemId: string) {
  const qty = Math.floor(Number(qtyEditVal));
  if (!Number.isFinite(qty) || qty < 1) {
  showMsg("Vnesite kolicino 1 ali vec (za 0 uporabite Odstrani).");
  return;
  }
  setSaving(true);
  try {
  await updateDeliveryNoteItemQuantity(itemId, qty);
  setQtyEditItem(null);
  setQtyEditVal("");
  refresh();
  showMsg("Kolicina popravljena.");
  } catch {
  showMsg("Popravek kolicine ni uspel. Poskusite znova.");
  }
  setSaving(false);
  }

  // Correct a mistyped service date on a delivery-note order item.
  async function handleSaveItemDate(itemId: string) {
    if (!dateEditVal) {
      showMsg("Izberite datum.");
      return;
    }
    setSaving(true);
    try {
      await updateOrderItemDate(itemId, dateEditVal);
      setDateEditItem(null);
      setDateEditVal("");
      refresh();
      showMsg("Datum postavke popravljen.");
    } catch {
      showMsg("Popravek datuma ni uspel. Poskusite znova.");
    }
    setSaving(false);
  }

  async function handleSaveExchangeRate() {
    const rate = Number(newRate);
    if (rate > 0) {
      setSaving(true);
      await updateExchangeRate(rate);
      setNewRate("");
      refresh();
      showMsg("Tecaj shranjen!");
      setSaving(false);
    }
  }

  // ============ STATUS HELPERS ============
  function getStatusBadge(status: string) {
    const variants: Record<string, "petrol" | "gold" | "danger" | "ocean" | "default"> = {
      ARRIVING_TODAY: "ocean",
      RESERVED: "gold",
      IN_HOUSE: "petrol",
      DEPARTING_TODAY: "danger",
      CHECKED_OUT: "default",
      CANCELLED: "danger",
    };
    return <LuxuryBadge variant={variants[status] || "default"}>{status.replace(/_/g, " ")}</LuxuryBadge>;
  }

  function getBungalowGuest(bungalow: string, when: "now" | "next" | "next2" | "next3" | "next4"): Reservation | undefined {
    const todayStr = today();
    // Normalize so the "Bungalov"/"Bungalow" spelling difference (and casing) in stored
    // reservations doesn't break matching. Match as a word boundary to avoid
    // "Ocean Bungalow I" matching "Ocean Bungalow II".
    const normalize = (s: string) => s.toLowerCase().replace(/bungalov\b/g, "bungalow");
    const bungalowRegex = new RegExp(`\\b${normalize(bungalow)}\\b`);
    const active = reservations.filter(r => 
      bungalowRegex.test(normalize(r.bungalow || "")) && 
      r.status !== "CANCELLED" && 
      r.status !== "CHECKED_OUT"
    );
    // Reservations whose date range covers today. On a turnover day the same
    // bungalow can be covered by TWO guests (one departing today, one arriving
    // today). Prefer the guest physically present: checked in and not yet
    // checked out; then any not-yet-departed guest; finally the first match.
    const covering = active.filter(r => r.arrival <= todayStr && r.departure >= todayStr);
    const inHouse = covering.find(r => r.checkedInAt && !r.checkedOutAt);
    const notDeparted = covering.find(r => !r.checkedOutAt);
    const nowGuest = inHouse || notDeparted || covering[0];
    if (when === "now") return nowGuest;
    // Next occupant: earliest upcoming reservation that isn't the current guest.
    // Include guests arriving today (arrival >= today) so an arriving guest waiting
    // behind a departing guest still surfaces as "next".
    const upcoming = active
      .filter(r => r !== nowGuest && r.arrival >= todayStr)
      .sort((a, b) => a.arrival.localeCompare(b.arrival));
    return when === "next4" ? upcoming[3] : when === "next3" ? upcoming[2] : when === "next2" ? upcoming[1] : upcoming[0];
  }

  // ============ SECTIONS ============
  function Bungalows() {
    const [expandedBungalow, setExpandedBungalow] = React.useState<string | null>(null);
    
    // Vsaka rezervacija se pripiše SAMO prvemu ujemajočemu se bungalovu (po vrstnem redu
    // BUNGALOWS). Tako dvo-bungalovska rezervacija (npr. Butelli "Ocean Bungalow I ... ;
    // Ocean Bungalow IV ...") prikaže gosta + saldo SAMO pod prvim bungalovom (I),
    // drugi (IV) pa ostane razpoložljiv — enako kot v baru (ena dobavnica).
  const claimedNow = new Set<Reservation>();

  // "26. avg. – 29. avg." — arrival to departure. Month is dropped from the first date
  // when both fall in the same month, so the range stays short on a phone.
  const stayRange = (arrival?: string | null, departure?: string | null) => {
    const a = arrival ? String(arrival).slice(0, 10) : "";
    const d = departure ? String(departure).slice(0, 10) : "";
    if (!a) return null;
    const fmt = (iso: string, withMonth: boolean) =>
      new Date(`${iso}T00:00:00Z`).toLocaleDateString("sl-SI", {
        day: "numeric",
        ...(withMonth ? { month: "short" as const } : {}),
        timeZone: "UTC",
      });
    if (!d) return fmt(a, true);
    const sameMonth = a.slice(0, 7) === d.slice(0, 7);
    return `${fmt(a, !sameMonth)} – ${fmt(d, true)}`;
  };

  // Our own site is by far the longest source label and it pushed the badge row onto a
  // second line on a phone, so it shows as "WEB". Slovenian and English spellings both occur.
  const shortSource = (source?: string | null) => {
    const s = String(source || '');
    if (/lastna spletna|direct website|spletna stran|^web/i.test(s)) return 'WEB';
    if (s === 'Booking.com') return 'Booking';
    return s;
  };

  return (
  <section className="space-y-3">
        {BUNGALOWS.map(bungalow => {
          let now = getBungalowGuest(bungalow, "now");
          if (now) {
            if (claimedNow.has(now)) now = undefined;
            else claimedNow.add(now);
          }
          const next = getBungalowGuest(bungalow, "next");
          // Second upcoming guest — the user wants to see two guests ahead per bungalow.
          const next2 = getBungalowGuest(bungalow, "next2");
          // Third upcoming guest — the user wants three upcoming reservations ahead.
          const next3 = getBungalowGuest(bungalow, "next3");
          // Fourth upcoming guest — needed when the header already shows `next`
          // (available bungalow) so the expanded list can skip it and still show three.
          const next4 = getBungalowGuest(bungalow, "next4");
          const isExpanded = expandedBungalow === bungalow;
          const status = now ? now.status.replace(/_/g, " ") : "AVAILABLE";
          
          // One accent colour per status — drives the vertical rail and the status label,
          // so the card needs no tinted background or coloured dot.
          const statusAccent: Record<string, string> = {
            "ARRIVING TODAY": "#3f6b7d",
            "RESERVED": "#8f6d3a",
            "IN HOUSE": "#4f7a54",
            "DEPARTING TODAY": "#a15a3f",
            "AVAILABLE": "#b4a795",
          };
          const accent = statusAccent[status] || statusAccent["AVAILABLE"];
          
          // Check if guest is checked in (In house)
          const isInHouse = now?.checkedInAt && !now?.checkedOutAt;
          // The glamp village is only a fallback unit, so its name stays quiet
          // instead of competing with the four real bungalows.
          const isReserve = bungalow === "Jungle Glamp Village";

          // Countdown to arrival, shown next to the pax marker. Only for guests who are
          // still coming — once they arrive (or leave today) the status label says it.
          const paxSrc = now || next;
          const buildArrivalCountdown = (arrival?: string | null) => {
            const raw = arrival ? String(arrival).slice(0, 10) : "";
            if (!raw) return null;
            const t = today();
            if (raw <= t) return null;
            const days = Math.round((Date.parse(`${raw}T00:00:00Z`) - Date.parse(`${t}T00:00:00Z`)) / 86400000);
            if (days <= 0) return null;
            if (days === 1) return "jutri";
            // Slovenian accusative after "čez": 2 dneva, 3+ dni.
            return `čez ${days} ${days === 2 ? "dneva" : "dni"}`;
          };
          const arrivalCountdown = buildArrivalCountdown(paxSrc?.arrival);

          // Estimated arrival at the lodge for a guest who is still on the way. Derived
          // from the most downstream time we actually know: the boat leaving the port
          // (+ the crossing), or failing that the flight landing (+ the drive to the port
          // + the crossing). Shown under the countdown so the beach knows when to expect
          // them — a 20:05 flight means roughly 21:35 on the sand.
          const arrivalEta = (() => {
            if (!paxSrc) return null;
            // Already checked in? Then the status label speaks for itself.
            if (paxSrc.checkedInAt && !paxSrc.checkedOutAt) return null;
            const day = paxSrc.arrival ? String(paxSrc.arrival).slice(0, 10) : "";
            if (!day || day < today()) return null;
            const t = paxSrc.transfers?.arrival;
            // Guest coming under their own steam: the hour is stated, not derived, so it is
            // shown as given — no "~" and no crossing time added on top.
            const stated = (paxSrc as { ownArrivalTime?: string | null }).ownArrivalTime;
            if (!t?.route) {
              if (!stated || !/^\d{1,2}:\d{2}$/.test(String(stated).trim())) return null;
              return {
                label: String(stated).trim(),
                why: "Gost prevoz organizira sam — javljena ura prihoda",
                exact: true,
                // Today's arrival is the one reception has to act on, so only that one is
                // allowed to shout. Future arrivals stay quiet reference information.
                today: day === today(),
              };
            }
            const toMinutes = (v?: string) => {
              const m = /^(\d{1,2}):(\d{2})$/.exec(String(v || "").trim());
              if (!m) return null;
              const h = Number(m[1]);
              const min = Number(m[2]);
              return h < 24 && min < 60 ? h * 60 + min : null;
            };
            const CROSSING = 30; // port → Komba Cabana; at least this, slower after dark
            const TO_PORT = 60; // landing, baggage and the drive to the port
            const port = toMinutes(t.boatPortTime);
            const flight = toMinutes(t.flightTime);
            const total =
              port !== null ? port + CROSSING : flight !== null ? flight + TO_PORT + CROSSING : null;
            if (total === null) return null;
            const mins = total % 1440; // wrap around midnight
            return {
              label: `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`,
              why:
                port !== null
                  ? `Čoln iz porta ${t.boatPortTime} + ~30 min plovbe`
                  : `Let ob ${t.flightTime} + ~1 h do porta + ~30 min plovbe`,
              today: day === today(),
            };
          })();

          // Children's ages, derived from the police-form birth dates so nothing is typed
          // twice. Measured at ARRIVAL, not today: that is the age that matters for the
          // stay and it does not tick over while the card is on screen. Date parts are
          // compared numerically �� parsing to Date would shift the day in our timezone.
          const childAgeInfo = (() => {
            if (!paxSrc) return null;
            const isDay = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
            const ref = paxSrc.arrival ? String(paxSrc.arrival).slice(0, 10) : "";
            if (!isDay(ref)) return null;
            const [ry, rm, rd] = ref.split("-").map(Number);
            const people = [
              { dob: paxSrc.dateOfBirth, name: paxSrc.guestName },
              { dob: paxSrc.secondDateOfBirth, name: paxSrc.secondGuestName },
              { dob: paxSrc.thirdDateOfBirth, name: paxSrc.thirdGuestName },
              { dob: paxSrc.fourthDateOfBirth, name: paxSrc.fourthGuestName },
            ];
            const kids: { age: number; name: string }[] = [];
            for (const p of people) {
              const dob = p.dob ? String(p.dob).slice(0, 10) : "";
              if (!isDay(dob)) continue;
              const [by, bm, bd] = dob.split("-").map(Number);
              let age = ry - by;
              if (rm < bm || (rm === bm && rd < bd)) age -= 1;
              if (age < 0 || age >= 18) continue;
              kids.push({ age, name: (p.name || "").trim() });
            }
            if (!kids.length) return null;
            kids.sort((a, b) => a.age - b.age);
            const label = kids.length === 1 ? "Otrok" : kids.length === 2 ? "Otroka" : "Otroci";
            // The unit agrees with the last number listed: 1 leto, 2 leti, 3 leta, 5 let.
            const last = kids[kids.length - 1].age;
            const m10 = last % 10;
            const m100 = last % 100;
            const unit =
              m100 !== 11 && m10 === 1
                ? "leto"
                : m100 !== 12 && m10 === 2
                  ? "leti"
                  : m100 !== 13 && m100 !== 14 && (m10 === 3 || m10 === 4)
                    ? "leta"
                    : "let";
            return {
              ages: kids.map(k => k.age).join(" · "),
              label,
              unit,
              why: `${kids.map(k => `${k.name || "Otrok"} — ${k.age}`).join(" · ")} (starost ob prihodu, iz rojstnih datumov)`,
            };
          })();

          // Transport / excursion markers (boat, Herman's car, excursion palm) for the
          // current or next guest. Built once: they sit in the header row while the card
          // is collapsed, and move to the bottom-right corner once it is expanded.
          const buildTransportIndicators = (src: typeof next) => {
            if (!src) return null;
            const hasArrivalTransfer = src.transfers?.arrival?.route;
            const hasDepartureTransfer = src.transfers?.departure?.route;
            const noTransferNeeded = (src as { noTransferNeeded?: boolean }).noTransferNeeded;
            const arrivalHasCar = !!src.transfers?.arrival?.hermanRouteId;
            const hasHerman = src.transfers?.departure?.hermanRouteId || (arrivalHasCar && !src.transfers?.arrival?.route);
            const hasExcursion = (src.excursions?.length || 0) > 0;
            // Same rule as the boat and the arrival hour: a booked excursion is quiet
            // reference, today's excursion is the job in front of reception. The column
            // is a plain `date`, so the day is compared as text — never via new Date(),
            // which would shift the day in our timezone.
            const excursionToday = (src.excursions || []).some(
              e => String(e.date || "").slice(0, 10) === today()
            );
            // Nothing left to collect for the transfer? Say so in words before the boat,
            // so it reads at a glance without opening the card.
            const bookedTransfers = [src.transfers?.arrival, src.transfers?.departure].filter(
              (t): t is TransferData => !!t?.route
            );
            const statuses = bookedTransfers.map(t => t.paymentStatus);
            const settledLabel =
              statuses.length > 0 && statuses.every(s => s === "PAID" || s === "PREPAID")
                ? statuses.every(s => s === "PREPAID")
                  ? "Vključeno"
                  : "Plačano"
                : null;

            // The boat follows the stay, exactly like the calendar bar: before check-in
            // the arrival is the open task and sits on the left, after check-in it is
            // done and the departure takes over on the right. Never both at once.
            const inHouse = !!src.checkedInAt && !src.checkedOutAt;
            const beforeArrival = !src.checkedInAt && !src.checkedOutAt;
            const showArrival = beforeArrival && !noTransferNeeded;
            const showDeparture = inHouse && !noTransferNeeded;
            // The boat only rides the swell on the day the crossing actually happens —
            // same rule as the blinking arrival hour. A boat bobbing for a guest due in
            // four days is decoration; today it is the job in front of reception.
            const arrivingToday = beforeArrival && String(src.arrival || "").slice(0, 10) === today();
            const departingToday = inHouse && String(src.departure || "").slice(0, 10) === today();
            const sail = (moving: boolean) => (moving ? " animate-sail" : "");
            const legClass = "flex items-center gap-1.5 whitespace-nowrap text-[9px] font-medium uppercase tracking-[0.16em]";

            // Marked as arranged by the guest. Only shown when that leg has no booked
            // route, so the flag can never hide a boat we actually owe.
            const ownArrival = !!(src as { ownArrivalTransfer?: boolean }).ownArrivalTransfer && !hasArrivalTransfer;
            const ownDeparture =
              !!(src as { ownDepartureTransfer?: boolean }).ownDepartureTransfer && !hasDepartureTransfer;

            // Arrival on the left: boat first, then the word. No entry and no flag means
            // the guest arranges it themselves anyway, so it is not an open task — show
            // nothing rather than a warning.
            const left =
              showArrival && hasArrivalTransfer ? (
                <span className={`${legClass} text-[#4f7a54]`} title="Prevoz ob prihodu je urejen">
                  {arrivalHasCar && (
                    <>
                      <span className="flex items-center gap-1 rounded-full bg-[#2b2622]/[0.06] px-1.5 py-0.5 text-[#2b2622]/70" title="Avto (taksi) do porta">
                        <Car className="h-4 w-4" />
                        Avto
                      </span>
                      <span aria-hidden className="text-[#2b2622]/35">→</span>
                    </>
                  )}
                  <span className="flex items-center gap-1 rounded-full bg-[#4f7a54]/10 px-1.5 py-0.5" title="Čoln">
                    <Ship className={`h-4 w-4${sail(arrivingToday)}`} />
                    Čoln
                  </span>
                  Prihod
                </span>
              ) : showArrival && ownArrival ? (
                <span className={`${legClass} text-[#2b2622]/55`} title="Gost prihod organizira sam">
                  {/* No colour of its own: the hull inherits currentColor, so boat and
                      wording stay one muted unit — nothing is owed to us here. */}
                  <Ship className={`h-3.5 w-3.5${sail(arrivingToday)}`} />
                  Lasten prihod
                </span>
              ) : null;

            // Departure on the right: the word before the boat, so the icon keeps the edge.
            const departure = showDeparture ? (
              hasDepartureTransfer ? (
                <span className={`${legClass} text-[#4f7a54]`} title="Prevoz ob odhodu je urejen">
                  Odhod
                  <Ship className={`h-3.5 w-3.5${sail(departingToday)}`} />
                </span>
              ) : ownDeparture ? (
                <span className={`${legClass} text-[#2b2622]/55`} title="Gost odhod organizira sam">
                  Lasten odhod
                  <UserRound className="h-3.5 w-3.5" />
                </span>
              ) : (
                <span className={`${legClass} text-[#a15a3f]`} title="Prevoz ob odhodu še ni urejen">
                  Odhod
                  <span className="relative flex-shrink-0">
                    <Ship className="h-4 w-4" />
                    <HelpCircle className="absolute -top-1 -right-1 h-2.5 w-2.5" />
                  </span>
                </span>
              )
            ) : null;

            const right =
              settledLabel || noTransferNeeded || departure || hasHerman || hasExcursion ? (
                <>
                  {settledLabel && (
                    <span
                      className="whitespace-nowrap text-[9px] font-medium uppercase tracking-[0.16em] text-[#4f7a54]"
                      title="Prevoz je poravnan"
                    >
                      {settledLabel}
                    </span>
                  )}
                  {noTransferNeeded && (
                    <div className="relative" title="Ne potrebuje prevoza">
                      <Ship className="h-4 w-4 text-[#2b2622]/55" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-5 h-0.5 bg-[#2b2622]/70 rotate-[-45deg]" />
                      </div>
                    </div>
                  )}
                  {departure}
                  {hasHerman && <Car className="h-3.5 w-3.5 text-[#2b2622]/40" title="Prevoz s Hermanom (avto do Porta)" />}
                  {/* Darker blue on request. Deepened but kept saturated: the muted
                      navy tint reads grey-teal next to the sage ship at this size. */}
                  {hasExcursion && (
                    <Palmtree
                      className={`h-3.5 w-3.5 text-[#14567a]${excursionToday ? " animate-palm-sway" : ""}`}
                      title={excursionToday ? "Izlet je danes" : "Naročen izlet"}
                    />
                  )}
                </>
              ) : null;

            // Pickup location for the arrival leg — origin of the route name (before " - "),
            // same rule as the pending-transfer card. Only while the arrival is still the
            // open task (before check-in), so it reads at a glance without opening the card.
            const arrivalRouteName =
              showArrival && hasArrivalTransfer
                ? (dbRoutes.find((r: { id: string; name: string }) => r.id === src.transfers?.arrival?.route)?.name || '')
                : '';
            // Prefer the explicit "Pick up point (na vaucerju)" field when the receptionist
            // filled it in; otherwise fall back to the route-name origin (before " - ").
            const pickupPointField =
              showArrival && hasArrivalTransfer ? (src.transfers?.arrival?.pickupPoint || '').trim() : '';
            const pickup = pickupPointField || arrivalRouteName.split(' - ')[0]?.trim() || '';
            // Arrival time ("Ura prihoda" = flightTime), shown next to the pickup place.
            const pickupTime = showArrival && hasArrivalTransfer ? (src.transfers?.arrival?.flightTime || '') : '';

            if (!left && !right) return null;
            return { left, right, pickup, pickupTime };
          };
          // Indicators for the collapsed card follow the bungalow's active guest,
          // and a separate set for the NEXT card so the upcoming guest's transport
          // (boat, pickup, excursions) is visible at a glance in the expanded view.
          const transportIndicators = buildTransportIndicators(now || next);
          // Three upcoming guests for the expanded view. When the collapsed header
          // already shows `next` (available bungalow, no in-house guest), skip it and
          // show the following three so `next` is not duplicated; otherwise show
          // next / next2 / next3 (header shows the in-house `now` guest).
          const upcomingSource = now ? [next, next2, next3] : [next2, next3, next4];
          const upcomingCards = upcomingSource
            .filter((g): g is Reservation => !!g)
            .map((g) => ({
              guest: g,
              indicators: buildTransportIndicators(g),
              countdown: buildArrivalCountdown(g.arrival),
            }));

          // One upcoming-guest card — reused for both the first (NEXT) and the second
          // (ZATEM) upcoming guest, so the receptionist sees two guests ahead per bungalow.
          const renderUpcomingCard = (
            label: string,
            guest: typeof next,
            indicators: ReturnType<typeof buildTransportIndicators>,
            countdown: string | null,
          ) => (
            <div className="rounded-lg border border-[#0f2e3a]/[0.08] bg-white p-4">
              <p className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.28em] text-[#2b2622]/45">
                <span aria-hidden className="h-px w-4 bg-[#0f2e3a]/25" />
                {label}
              </p>
              {guest ? (
                <>
                  <button
                    type="button"
                    className="group/next mt-2.5 w-full cursor-pointer text-left transition-colors"
                    aria-label={`Odpri rezervacijo in podatke gosta ${guest.guestName}`}
                    onClick={() => { setSelectedReservationId(guest.id); setTab("guest"); }}
                  >
                    <span className="flex items-center gap-1.5 text-[15px] font-light tracking-[0.01em] text-[#0f2e3a] group-hover/next:text-[#8f6d3a]">
                      <GuestFlag nationalities={[guest.nationality, guest.secondNationality, guest.thirdNationality, guest.fourthNationality]} />
                      {guest.guestName}
                      <ArrowRight aria-hidden className="h-3.5 w-3.5 flex-shrink-0 text-[#8f6d3a]/50 transition-transform duration-300 group-hover/next:translate-x-1" />
                    </span>
                    <span className="mt-1 flex items-center gap-2 text-[11px] tabular-nums tracking-[0.06em] text-[#2b2622]/50">
                      {guest.arrival}
                      {guest.pax > 0 && (
                        <>
                          <span aria-hidden className="h-2.5 w-px bg-[#0f2e3a]/15" />
                          <span className="flex items-center gap-1" title="Število oseb">
                            <Users className="h-3 w-3" />
                            {guest.pax}
                          </span>
                        </>
                      )}
                      {countdown && (
                        <>
                          <span aria-hidden className="h-2.5 w-px bg-[#0f2e3a]/15" />
                          <span className="whitespace-nowrap font-medium text-[#b0203a]" title="Do prihoda">{countdown}</span>
                        </>
                      )}
                    </span>
                  </button>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {guest.mealPlan && <LuxuryBadge light variant="gold">{guest.mealPlan}</LuxuryBadge>}
                    {guest.mealPlanSnack && <LuxuryBadge light variant="gold">Snack</LuxuryBadge>}
                    {guest.bookingSource && (
                      <LuxuryBadge light variant={guest.bookingSource === 'Booking.com' ? 'ocean' : guest.bookingSource === 'Airbnb' ? 'danger' : 'gold'}>
                        {shortSource(guest.bookingSource)}
                      </LuxuryBadge>
                    )}
                    {guest.honeymoon && <LuxuryBadge light variant="gold"><Heart className="h-3 w-3" /></LuxuryBadge>}
                    {guest.allergies && <LuxuryBadge light variant="danger"><Leaf className="h-3 w-3" /></LuxuryBadge>}
                  </div>
                  {indicators && (
                    <>
                      <div className="mt-2 flex items-center gap-2.5" aria-label="Oznake prevozov in izletov naslednjega gosta">
                        {indicators.left}
                        {indicators.right && (
                          <div className="ml-auto flex items-center gap-2.5">{indicators.right}</div>
                        )}
                      </div>
                      {indicators.pickup && (
                        <p className="mt-1 pl-[1.25rem] text-[10px] tracking-[0.06em] text-[#2b2622]/60">
                          <span className="text-[#2b2622]/45">Pick up:</span> {indicators.pickup}
                          {indicators.pickupTime && <span className="ml-1.5 font-medium text-[#0f2e3a]/70">{indicators.pickupTime}</span>}
                        </p>
                      )}
                    </>
                  )}
                  {/* Reservation notes — same rules as the collapsed NOW row, so notes typed on
                      the guest's reservation are visible in advance on the NEXT/ZATEM cards too. */}
                  {(() => {
                    if (!guest.notes || guest.showNoteOnCard === false) return null;
                    const list = guest.notes.split('\n---\n').filter(Boolean);
                    const visible = list.filter(n => !n.startsWith('@nocard '));
                    const pinned = visible.filter(n => n.startsWith('@card '));
                    const rest = visible.filter(n => !n.startsWith('@card '));
                    const cardNotes = [...pinned, ...rest]
                      .slice(0, 3)
                      .map(n => n.replace(/^@card\s*/, '').replace(/^\[[^\]]*\]\s*/, '').trim())
                      .filter(Boolean);
                    return cardNotes.length > 0 ? (
                      <div className="mt-2.5 border-l border-[#8f6d3a]/40 pl-2.5">
                        {cardNotes.map((n, i) => (
                          <p key={i} className="text-left text-[11px] font-light leading-relaxed text-[#2b2622]/65 whitespace-pre-wrap break-words">
                            {n}
                          </p>
                        ))}
                      </div>
                    ) : null;
                  })()}
                </>
              ) : <p className="mt-2.5 text-[13px] font-light italic text-[#2b2622]/45">Ni naslednje rezervacije.</p>}
            </div>
          );
          
          return (
            <div
              key={bungalow}
              className={`group relative overflow-hidden rounded-xl border transition-all duration-300 ${
                now ? "bg-[#efe8da]" : "bg-[#e4dac2]"
              } ${
                isInHouse
                  ? "border-[#8f6d3a]/55 shadow-[0_12px_32px_-20px_rgba(15,46,58,0.6)]"
                  : "border-[#0f2e3a]/10 hover:border-[#8f6d3a]/35"
              }`}
            >
              {/* Vertical status rail — a quiet architectural accent in place of a status dot */}
              <span aria-hidden className="absolute left-0 top-0 h-full w-[3px]" style={{ backgroundColor: accent }} />
              <button
                onClick={() => setExpandedBungalow(isExpanded ? null : bungalow)}
                className="w-full py-4 pl-5 pr-4 text-left transition-colors hover:bg-[#0f2e3a]/[0.02]"
              >
                {/* Top row: name/guest on the left, amount + status + chevron on the right.
                    Transport markers sit on their own row below, in the bottom-right corner. */}
                <div className="flex items-start gap-4">
                <div className="min-w-0 flex-1">
                    <h3
                      className={`font-[family-name:var(--font-manrope)] leading-tight text-balance ${
                        isReserve
                          ? "text-[13px] font-normal tracking-[0.06em] text-[#2b2622]/60 sm:text-[15px]"
                          : "text-[17px] font-semibold tracking-[0.01em] text-[#0f2e3a] sm:text-[22px]"
                      }`}
                    >
                      {bungalow}
                    </h3>
                    {/* Gold hairline under the name — same signature motif as the NOW/NEXT
                        overlines; quieter for the reserve unit. */}
                    <span
                      aria-hidden
                      className={`mt-2 block h-px w-full ${isReserve ? "bg-[#8f6d3a]/20" : "bg-[#8f6d3a]/35"}`}
                    />
                    {now ? (
                      <p className="mt-1 truncate text-[13px] text-[#2b2622]/80">
                        <GuestFlag nationalities={[now.nationality, now.secondNationality, now.thirdNationality, now.fourthNationality]} className="mr-1.5" />
                        {/* Guest name opens the reservation/profile directly. It lives inside the
                            card-toggle <button>, so it's a role="link" span with stopPropagation
                            (a nested <button> would be invalid HTML) — click name = open profile,
                            click anywhere else on the header = expand/collapse. */}
                        <span
                          role="link"
                          tabIndex={0}
                          className="cursor-pointer rounded-sm underline decoration-[#8f6d3a]/30 decoration-1 underline-offset-2 transition-colors hover:text-[#8f6d3a] hover:decoration-[#8f6d3a] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#8f6d3a]/50"
                          aria-label={`Odpri rezervacijo in podatke gosta ${now.guestName}`}
                          onClick={(e) => { e.stopPropagation(); setSelectedReservationId(now.id); setTab("guest"); }}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); setSelectedReservationId(now.id); setTab("guest"); } }}
                        >
                          {now.guestName}
                        </span>
                        {now.checkedInAt ? (
                          <span className="ml-2 text-[10px] uppercase tracking-[0.16em] text-[#4f7a54]">In house</span>
                        ) : now.arrival === today() ? (
                          // A guest landing today is worth catching the eye, so this label
                          // pulses. Stays still when the system asks for reduced motion.
                          <span className="animate-arriving ml-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#b0203a]">Arriving</span>
                        ) : null}
                      </p>
                    ) : next ? (
                      <>
                        <p className="mt-1 truncate text-[13px] text-[#2b2622]/75">
                          <span className="text-[10px] uppercase tracking-[0.16em] text-[#8f6d3a]">Naslednji</span>{" "}
                          <GuestFlag nationalities={[next.nationality, next.secondNationality, next.thirdNationality, next.fourthNationality]} className="mr-1.5" />
                          {/* Clickable like the in-house name ��� opens the reservation directly.
                              role="link" span (not a nested <button>) with stopPropagation so it
                              doesn't also toggle the card's expand/collapse. */}
                          <span
                            role="link"
                            tabIndex={0}
                            className="cursor-pointer rounded-sm text-[#2b2622]/85 underline decoration-[#8f6d3a]/30 decoration-1 underline-offset-2 transition-colors hover:text-[#8f6d3a] hover:decoration-[#8f6d3a] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#8f6d3a]/50"
                            aria-label={`Odpri rezervacijo in podatke gosta ${next.guestName}`}
                            onClick={(e) => { e.stopPropagation(); setSelectedReservationId(next.id); setTab("guest"); }}
                            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); setSelectedReservationId(next.id); setTab("guest"); } }}
                          >
                            {next.guestName}
                          </span>
                        </p>
                        {/* Stay range on its own line under "Naslednji" — no longer truncated
                            by the guest name on narrow screens. */}
                        <p className="mt-0.5 text-[11px] tabular-nums tracking-[0.06em] text-[#2b2622]/50">
                          {stayRange(next.arrival, next.departure)}
                        </p>
                      </>
                    ) : (
                      <p className="mt-1 text-[13px] font-light italic text-[#2b2622]/45">Prosto</p>
                    )}
                    {/* Booking source + meal plan (B / HB / FB) so staff see both at a glance */}
                    {(() => {
                      const src = now || next;
                      if (!src) return null;
                      const source = src.bookingSource;
                      // Normalize meal plan to a short badge: B (breakfast), HB (half board), FB (full board)
                      const mp = String(src.mealPlan || '').toUpperCase();
                      const mealBadge = mp === 'FB' || mp === 'HB' || mp === 'B' ? mp : null;
                      const mealColor = mealBadge === 'FB' ? '#4f7a54' : mealBadge === 'HB' ? '#3f6b7d' : '#8f6d3a';
                      // Settled meal plan reads in words, same as the transport marker
                      const mealPaid = mealBadge && String(src.mealPlanPaymentStatus || '').toUpperCase() === 'PAID';
                      // Snack is ordered on top of the board, so it gets its own badge
                      const snack = !!src.mealPlanSnack;
                      if (!source && !mealBadge && !snack) return null;
                      return (
                        <span className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                          {source && (
                            <span className="text-[10px] uppercase tracking-[0.16em] text-[#2b2622]/50">
                              {source === 'Agency' && src.agencyName ? src.agencyName : shortSource(source)}
                            </span>
                          )}
                          {source && mealBadge && <span aria-hidden className="h-2.5 w-px bg-[#0f2e3a]/15" />}
                          {mealBadge && (
                            <span
                              className="text-[10px] font-semibold uppercase tracking-[0.16em]"
                              style={{ color: mealColor }}
                              title={mealBadge === 'FB' ? 'Polni penzion' : mealBadge === 'HB' ? 'Polpenzion' : 'Zajtrk'}
                            >
                              {mealBadge}
                            </span>
                          )}
                          {snack && (
                            <span className="flex items-center gap-2.5">
                              {(source || mealBadge) && <span aria-hidden className="h-2.5 w-px bg-[#0f2e3a]/15" />}
                              <span
                                className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8f6d3a]"
                                title="Gost ima naročen snack"
                              >
                                Snack
                              </span>
                            </span>
                          )}
                          {mealPaid && (
                            // Hairline travels with the label so it never dangles at a line end
                            <span className="flex items-center gap-2.5">
                              <span aria-hidden className="h-2.5 w-px bg-[#0f2e3a]/15" />
                              <span
                                className="whitespace-nowrap text-[9px] font-medium uppercase tracking-[0.16em] text-[#4f7a54]"
                                title="Penzion je poravnan"
                              >
                                Plačano
                              </span>
                            </span>
                          )}
                        </span>
                      );
                    })()}
                    {/* Last 3 reservation notes, shown so staff see them at a glance on the overview */}
                    {(() => {
                      const noteSource = now || next;
                      // Respect the per-reservation toggle (default shown unless explicitly disabled)
                      if (!noteSource?.notes || noteSource.showNoteOnCard === false) return null;
                      const list = noteSource.notes.split('\n---\n').filter(Boolean);
                      // Skip notes explicitly hidden from the card (@nocard); they stay on the guest card only.
                      const visible = list.filter(n => !n.startsWith('@nocard '));
                      // Pinned note first (if any), then the most recent ones, up to 3 total
                      const pinned = visible.filter(n => n.startsWith('@card '));
                      const rest = visible.filter(n => !n.startsWith('@card '));
                      const cardNotes = [...pinned, ...rest]
                        .slice(0, 3)
                        .map(n => n.replace(/^@card\s*/, '').replace(/^\[[^\]]*\]\s*/, '').trim())
                        .filter(Boolean);
                      return cardNotes.length > 0 ? (
                        <div className="mt-2.5 border-l border-[#8f6d3a]/40 pl-2.5">
                          {cardNotes.map((n, i) => (
                            <p key={i} className="text-left text-[11px] font-light leading-relaxed text-[#2b2622]/65 whitespace-pre-wrap break-words">
                              {n}
                            </p>
                          ))}
                        </div>
                      ) : null;
                    })()}
                </div>
                <div className="flex flex-shrink-0 items-center gap-4">
                  {/* Show unpaid balance on collapsed row — matches the invoice (services + bar).
                      Excursions are already included in orderItems, so we must NOT add them again
                      from the excursions list, otherwise the total would be double-counted.
                      Hidden while expanded, where the NOW panel already states the balance. */}
                  {now && !isExpanded && (() => {
                    // Bivanje (accommodation) is settled via totalAmount/amountPaid, not via the order item's
                    // paymentStatus — otherwise a prepaid/agency guest (Garcia) would wrongly show as owing.
                    const unpaidServicesAr = (now.orderItems || [])
  .filter((item: { paymentStatus: string; category?: string; name?: string; isFree?: boolean }) =>
    item.paymentStatus === 'UNPAID' && item.category !== 'Bivanje' &&
    !((item.category === 'Prehrana' || item.category === 'Food') && !item.isFree && isPaidPlanMeal(now, item.name)))
  .reduce((sum: number, item: { priceAr: number }) => sum + Number(item.priceAr || 0), 0);
  const nowBarItems = (now as { barItems?: { productName?: string; priceAr?: number; quantity?: number; coveredByMealPlan?: boolean; isFree?: boolean }[] }).barItems;
  const barAr = Array.isArray(nowBarItems)
    ? nowBarItems.reduce((s, it) => s + ((it.coveredByMealPlan || it.isFree || isPaidPlanMeal(now, it.productName)) ? 0 : Number(it.priceAr || 0) * Number(it.quantity || 1)), 0)
    : (now.deliveryNotesTotal || 0);
                    const accommodationEur = Number(now.totalAmount || 0);
                    const amountPaidEur = Number(now.amountPaid || 0);
                    const extrasEur = (unpaidServicesAr + barAr) / exchangeRate;
                    const accommodationOwedEur = Math.max(0, accommodationEur - amountPaidEur);
                    // Any payment beyond the accommodation price credits the extras (services + bar),
                    // so a guest who paid the full bill upfront shows 0 to pay.
                    const surplusCreditEur = Math.max(0, amountPaidEur - accommodationEur);
                    const extrasOwedEur = Math.max(0, extrasEur - surplusCreditEur);
                    const totalUnpaidEur = accommodationOwedEur + extrasOwedEur;
                    return totalUnpaidEur > 0 ? (
                      <span className="block text-right">
                        <span className="block text-[9px] uppercase tracking-[0.2em] text-[#8f6d3a]">Za placilo</span>
                        <span className="block whitespace-nowrap text-[13px] font-medium tabular-nums text-[#0f2e3a] sm:text-[15px]">
                          {totalUnpaidEur.toLocaleString('sl-SI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          <span className="ml-1 text-[10px] font-normal text-[#2b2622]/45">EUR</span>
                        </span>
                      </span>
                    ) : null;
                  })()}
                        <div className="flex flex-col items-end gap-1.5">
                          <span className="text-[9px] font-semibold uppercase tracking-[0.22em]" style={{ color: accent }}>
                            {status}
                          </span>
                    {paxSrc && (paxSrc.pax > 0 || arrivalCountdown) && (
                      <span className="flex items-center gap-2 text-[11px] tabular-nums text-[#2b2622]/50">
                        {paxSrc.pax > 0 && (
                          <span className="flex items-center gap-1" title="Število oseb v bungalovu">
                            <Users className="h-3 w-3" />
                            {paxSrc.pax}
                          </span>
                        )}
                        {arrivalCountdown && (
                          <>
                            {paxSrc.pax > 0 && <span aria-hidden className="h-2.5 w-px bg-[#0f2e3a]/15" />}
                            <span
                              className="whitespace-nowrap font-medium text-[#b0203a]"
                              title={`Prihod ${String(paxSrc.arrival).slice(0, 10)}`}
                            >
                              {arrivalCountdown}
                            </span>
                          </>
                        )}
                      </span>
                    )}
                    {childAgeInfo && (
                      <span
                        className="flex items-center gap-1.5 whitespace-nowrap text-[10px] tracking-[0.06em] text-[#2b2622]/55"
                        title={childAgeInfo.why}
                      >
                        <span aria-hidden className="h-px w-3 bg-[#8f6d3a]/50" />
                        {/* 16px, not 14: the face dots blur into a plain circle any smaller. */}
                        <Baby aria-hidden className="h-4 w-4 flex-shrink-0" />
                        {/* The word stays for screen readers; sighted users get the figure. */}
                        <span className="sr-only">{childAgeInfo.label}</span>
                        <span className="font-medium tabular-nums text-[#0f2e3a]">{childAgeInfo.ages}</span>
                        {childAgeInfo.unit}
                      </span>
                    )}
                    {arrivalEta && (
                      <span
                        className={`flex items-center gap-1.5 whitespace-nowrap text-[10px] tracking-[0.06em] text-[#2b2622]/55 ${
                          arrivalEta.today ? "animate-arriving" : ""
                        }`}
                        title={arrivalEta.why}
                      >
                        <span aria-hidden className="h-px w-3 bg-[#8f6d3a]/50" />
                        v Lodge
                        <span
                          className={`font-medium tabular-nums ${
                            arrivalEta.today ? "text-[#b0203a]" : "text-[#0f2e3a]"
                          }`}
                        >
                          {("exact" in arrivalEta && arrivalEta.exact ? "" : "~") + arrivalEta.label}
                        </span>
                      </span>
                    )}
                  </div>
                </div>
                </div>
                {/* Transport markers in the bottom-right corner of the collapsed card.
                    When expanded they move down to the action row instead. */}
                {!isExpanded && transportIndicators && (
                  <>
                    <div className="mt-2 flex items-center gap-2.5" aria-label="Oznake prevozov in izletov">
                      {transportIndicators.left}
                      {transportIndicators.right && (
                        <div className="ml-auto flex items-center gap-2.5">{transportIndicators.right}</div>
                      )}
                    </div>
                    {transportIndicators.pickup && (
                      <p className="mt-1 pl-[1.25rem] text-[10px] tracking-[0.06em] text-[#2b2622]/60">
                        <span className="text-[#2b2622]/45">Pick up:</span> {transportIndicators.pickup}
                        {transportIndicators.pickupTime && <span className="ml-1.5 font-medium text-[#0f2e3a]/70">{transportIndicators.pickupTime}</span>}
                      </p>
                    )}
                  </>
                )}
              </button>
              
              {/* Expanded Content */}
              {isExpanded && (
                <div className="space-y-3 border-t border-[#0f2e3a]/[0.08] px-5 pb-5 pt-4">
          {/* NEXT + ZATEM + NATO — three upcoming guests ahead per bungalow.
              Header already shows the first upcoming guest when the bungalow is free,
              so the list skips it to avoid duplicating that guest. */}
          {upcomingCards.map((c, i) => (
            <React.Fragment key={c.guest.id}>
              {renderUpcomingCard(["NEXT", "ZATEM", "NATO"][i], c.guest, c.indicators, c.countdown)}
            </React.Fragment>
          ))}
                  
                  {/* Action buttons — transport markers ride along in the bottom-right corner */}
                  <div className="flex items-center gap-3">
                    {now && now.status === "ARRIVING_TODAY" && <LuxuryButton variant="petrol" onClick={() => handleUpdateReservation(now.id, { status: "IN_HOUSE" })}>Check In</LuxuryButton>}
                    {now && now.status === "IN_HOUSE" && <LuxuryButton variant="danger" onClick={() => handleUpdateReservation(now.id, { status: "CHECKED_OUT" })}>Check Out</LuxuryButton>}
                    {transportIndicators && (
                      <>
                        {transportIndicators.left}
                        {transportIndicators.right && (
                          <div className="ml-auto flex items-center gap-2.5" aria-label="Oznake prevozov in izletov">
                            {transportIndicators.right}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        <VisitorCountries />
      </section>
    );
  }

  const guestNameRef = React.useRef<HTMLInputElement>(null);
  const agencyNameRef = React.useRef<HTMLInputElement>(null);
  const agencyCommissionRef = React.useRef<HTMLInputElement>(null);

  // Memoized text inputs - NEVER re-render these
  const GuestNameInput = React.useMemo(() => (
    <div>
      <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">Ime gosta</label>
      <input
        ref={guestNameRef}
        type="text"
        className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-[#7fa8b8]/40 focus:outline-none"
        placeholder="John Doe"
      />
    </div>
  ), []);

  const AgencyNameInput = React.useMemo(() => (
    <div>
      <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">Ime agencije</label>
      <input
        ref={agencyNameRef}
        type="text"
        className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-[#7fa8b8]/40 focus:outline-none"
      />
    </div>
  ), []);

const AgencyCommissionInput = React.useMemo(() => (
  <div>
  <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">Provizija (EUR)</label>
  <input
        ref={agencyCommissionRef}
        type="number"
        step="0.01"
        min="0"
        className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-[#7fa8b8]/40 focus:outline-none"
        placeholder="0.00"
      />
    </div>
  ), []);

function GuestCard() {
  const reservation = activeReservation();

  // Izbrani gost ni med naloženimi (npr. že odjavljen, odprt iz iskanja) →
  // useEffect zgoraj naroči ponovno nalaganje, ki ga vključi.
  if (!reservation && selectedReservationId) {
    return (
      <GlassCard className="p-4">
        <p className="py-8 text-center text-white/40">Nalagam gosta...</p>
      </GlassCard>
    );
  }

  if (!reservation) return <GlassCard className="p-4"><p className="text-white/40 text-center py-8">Izberi gosta iz seznama rezervacij.</p></GlassCard>;

    return (
      <section className="space-y-4">
        <GlassCard className="p-4 sm:p-6">
<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
  <div>
    <p className="text-[10px] uppercase tracking-wider text-[#c59b5b]">Guest Profile</p>
    <h2 className="text-lg font-semibold text-white">{reservation.guestName}</h2>
  </div>
  <div className="flex items-center gap-2 flex-wrap">
  {reservation.honeymoon && (
  <LuxuryBadge variant="gold"><Heart className="h-3 w-3" /> Honeymoon</LuxuryBadge>
  )}
  {reservation.mealPlan && (
  <LuxuryBadge variant="gold">{reservation.mealPlan}</LuxuryBadge>
  )}
  {reservation.mealPlanSnack && (
  <LuxuryBadge variant="gold"><Cookie className="h-3 w-3" /> Snack</LuxuryBadge>
  )}
  {reservation.bookingSource && (
  <LuxuryBadge variant={reservation.bookingSource === 'Booking.com' ? 'ocean' : reservation.bookingSource === 'Airbnb' ? 'danger' : 'gold'}>
  {reservation.bookingSource === 'Booking.com' ? 'Booking' : reservation.bookingSource}
  </LuxuryBadge>
  )}
  {/* Group indicator */}
  {reservation.groupId && (
    <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs">
      <Users className="h-3 w-3" />
      Skupina
    </span>
  )}
  </div>
  </div>

          {/* Check-in / Check-out Section */}
  <div className="mt-4 flex flex-col sm:flex-row gap-2 sm:gap-3">
  {!reservation.checkedInAt ? (
  <button
  onClick={() => handleCheckIn(reservation)}
  className="col-span-1 sm:flex-1 rounded-xl bg-gradient-to-r from-[#7fa8b8]/20 to-[#4e8296]/20 border border-[#7fa8b8]/30 py-2.5 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm font-medium text-[#7fa8b8] hover:from-[#7fa8b8]/30 hover:to-[#4e8296]/30 transition-all"
  >
  Check-in
  </button>
  ) : (
  <div className="col-span-1 sm:flex-1 rounded-xl bg-[#7fa8b8]/10 border border-[#7fa8b8]/20 py-2.5 sm:py-3 px-3 sm:px-4 text-center">
  <p className="text-[10px] sm:text-xs text-[#7fa8b8]/70">Checked in</p>
  <p className="text-xs sm:text-sm text-[#7fa8b8]">{new Date(reservation.checkedInAt).toLocaleDateString('sl-SI')}</p>
  </div>
  )}

            
            {reservation.checkedInAt && !reservation.checkedOutAt ? (
              <button
                onClick={async () => {
                  await closeAllDeliveryNotesForReservation(reservation.id);
                  await handleUpdateReservation(reservation.id, { checkedOutAt: new Date().toISOString() });
                  showMsg("Check-out opravljen, dobavnice zaprte.");
                }}
                className="col-span-2 sm:col-span-1 sm:flex-1 rounded-xl bg-gradient-to-r from-[#c59b5b]/20 to-[#8f6d3a]/20 border border-[#c59b5b]/30 py-2.5 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm font-medium text-[#c59b5b] hover:from-[#c59b5b]/30 hover:to-[#8f6d3a]/30 transition-all"
              >
                Check-out
              </button>
            ) : reservation.checkedOutAt ? (
              <div className="col-span-2 sm:col-span-1 sm:flex-1 rounded-xl bg-[#c59b5b]/10 border border-[#c59b5b]/20 py-2.5 sm:py-3 px-3 sm:px-4 text-center">
                <p className="text-[10px] sm:text-xs text-[#c59b5b]/70">Checked out</p>
                <p className="text-xs sm:text-sm text-[#c59b5b]">{new Date(reservation.checkedOutAt).toLocaleDateString('sl-SI')}</p>
              </div>
            ) : null}
          </div>
          
          {/* Undo check-in + Skrij iz bara — kompaktna gumba */}
          {reservation.checkedInAt && !reservation.checkedOutAt && (
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                onClick={async () => {
                  await handleUpdateReservation(reservation.id, { checkedInAt: null });
                  showMsg("Check-in razveljavljen.");
                }}
                className="flex items-center gap-1.5 rounded-lg bg-white/5 border border-white/10 py-1.5 px-3 text-xs font-medium text-white/40 hover:bg-white/10 hover:text-white/60 transition-all"
              >
                Razveljavi check-in
              </button>
              <button
                onClick={async () => {
                  const next = !reservation.excludeFromBar;
                  await handleUpdateReservation(reservation.id, { excludeFromBar: next });
                  showMsg(next ? "Gost skrit iz bara (fakturira se na drug bungalov)." : "Gost spet viden v baru.");
                }}
                className={`flex items-center gap-1.5 rounded-lg border py-1.5 px-3 text-xs font-medium transition-all ${
                  reservation.excludeFromBar
                    ? "bg-[#d9a68f]/10 border-[#d9a68f]/30 text-[#d9a68f] hover:bg-[#d9a68f]/20"
                    : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:text-white/60"
                }`}
              >
                <Wine className="h-3.5 w-3.5" />
                {reservation.excludeFromBar ? "Skrit iz bara — klikni za prikaz" : "Skrij iz bara (fakturira se drugam)"}
              </button>
            </div>
          )}

          {/* Shrani + Dobavnica + Policija + Emaili gostom — pod check-in.
              Na telefonu zloženi eden pod drugim in enako dolgi, od sm: naprej v vrsto. */}
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <button
              onClick={async () => {
                setProfileSaved('saving');
                const el = document.activeElement as HTMLElement | null;
                if (el && typeof el.blur === 'function') el.blur();
                await new Promise(res => setTimeout(res, 400));
                await refresh();
                setProfileSaved('saved');
                setTimeout(() => setProfileSaved('idle'), 2500);
              }}
              disabled={profileSaved === 'saving'}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-[#8fae92]/30 bg-[#8fae92]/10 px-3 py-1.5 text-xs font-medium text-[#8fae92] hover:bg-[#8fae92]/20 transition-all disabled:opacity-50"
            >
              {profileSaved === 'saved' ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
              {profileSaved === 'saving' ? 'Shranjujem...' : profileSaved === 'saved' ? 'Shranjeno' : 'Shrani'}
            </button>
            <button
              onClick={() => setTab("orders")}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-[#c59b5b]/30 bg-[#c59b5b]/10 px-3 py-1.5 text-xs font-medium text-[#c59b5b] hover:bg-[#c59b5b]/20 transition-all"
            >
              <ReceiptText className="h-3.5 w-3.5" />
              Dobavnica
            </button>
  <div className="relative w-full sm:w-auto sm:flex-none">
  <button
    onClick={() => setShowPoliceMenu(v => !v)}
    className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-[#d9a68f]/20 to-[#d6a390]/20 border border-[#d9a68f]/30 py-1.5 px-3 text-xs font-medium text-[#d9a68f] hover:from-[#d9a68f]/30 hover:to-[#d6a390]/30 transition-all"
  >
    <FileText className="h-3.5 w-3.5" />
    Policija
    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showPoliceMenu ? 'rotate-180' : ''}`} />
  </button>
  {showPoliceMenu && (
  <div className="absolute left-0 top-full z-30 mt-2 flex w-64 flex-col gap-2 rounded-xl border border-[#d9a68f]/25 bg-[#152329] p-2 shadow-2xl">
  <button
    onClick={() => { setShowPoliceForm(true); setShowPoliceMenu(false); }}
    className="w-full flex items-center justify-center gap-1.5 sm:gap-2 rounded-xl bg-gradient-to-r from-[#d9a68f]/20 to-[#d6a390]/20 border border-[#d9a68f]/30 py-2.5 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm font-medium text-[#d9a68f] hover:from-[#d9a68f]/30 hover:to-[#d6a390]/30 transition-all"
  >
    <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
    Obrazec za policijo
  </button>
  <button
    onClick={async () => {
      setGeneratingLink('first');
      let url = "";
      try {
        const { getCheckinLink } = await import("@/app/actions/checkin");
        const link = await getCheckinLink(reservation.id, 'first');
        // Prefer the stable public (production) URL so the link works for the guest.
        url = link.url ?? `${window.location.origin}/checkin/${link.token}`;
      } catch {
        setGeneratingLink(null);
        showMsg("Napaka pri pripravi linka. Poskusite znova.");
        return;
      }
      const copied = await copyToClipboard(url);
      setGeneratingLink(null);
      if (copied) {
        setCopiedLink('first');
        setTimeout(() => setCopiedLink(null), 2500);
      } else {
        showMsg(`Samodejno kopiranje ni uspelo. Povezava: ${url}`);
      }
    }}
    disabled={generatingLink !== null}
    className="col-span-1 sm:flex-none flex items-center justify-center gap-1.5 sm:gap-2 rounded-xl bg-gradient-to-r from-[#8fae92]/20 to-[#55825a]/20 border border-[#8fae92]/30 py-2.5 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm font-medium text-[#8fae92] hover:from-[#8fae92]/30 hover:to-[#55825a]/30 transition-all disabled:opacity-50"
  >
    {copiedLink === 'first' ? <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Link2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
    {copiedLink === 'first' ? "Kopirano!" : ((reservation.secondGuestName || reservation.thirdGuestName) ? "Link gost 1" : "Link za gosta")}
  </button>
  {reservation.secondGuestName ? (
    <button
      onClick={async () => {
        setGeneratingLink('second');
        let url = "";
        try {
          const { getCheckinLink } = await import("@/app/actions/checkin");
          const link = await getCheckinLink(reservation.id, 'second');
          // Prefer the stable public (production) URL so the link works for the guest.
          url = link.url ?? `${window.location.origin}/checkin/${link.token}`;
        } catch {
          setGeneratingLink(null);
          showMsg("Napaka pri pripravi linka. Poskusite znova.");
          return;
        }
        const copied = await copyToClipboard(url);
        setGeneratingLink(null);
        if (copied) {
          setCopiedLink('second');
          setTimeout(() => setCopiedLink(null), 2500);
        } else {
          showMsg(`Samodejno kopiranje ni uspelo. Povezava: ${url}`);
        }
      }}
      disabled={generatingLink !== null}
      className="w-full flex items-center justify-center gap-1.5 sm:gap-2 rounded-xl bg-gradient-to-r from-[#8fae92]/20 to-[#55825a]/20 border border-[#8fae92]/30 py-2.5 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm font-medium text-[#8fae92] hover:from-[#8fae92]/30 hover:to-[#55825a]/30 transition-all disabled:opacity-50"
    >
      {copiedLink === 'second' ? <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Link2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
      {copiedLink === 'second' ? "Kopirano!" : "Link gost 2"}
    </button>
  ) : null}
  {reservation.thirdGuestName ? (
    <button
      onClick={async () => {
        setGeneratingLink('third');
        let url = "";
        try {
          const { getCheckinLink } = await import("@/app/actions/checkin");
          const link = await getCheckinLink(reservation.id, 'third');
          // Prefer the stable public (production) URL so the link works for the guest.
          url = link.url ?? `${window.location.origin}/checkin/${link.token}`;
        } catch {
          setGeneratingLink(null);
          showMsg("Napaka pri pripravi linka. Poskusite znova.");
          return;
        }
        const copied = await copyToClipboard(url);
        setGeneratingLink(null);
        if (copied) {
          setCopiedLink('third');
          setTimeout(() => setCopiedLink(null), 2500);
        } else {
          showMsg(`Samodejno kopiranje ni uspelo. Povezava: ${url}`);
        }
      }}
      disabled={generatingLink !== null}
      className="w-full flex items-center justify-center gap-1.5 sm:gap-2 rounded-xl bg-gradient-to-r from-[#8fae92]/20 to-[#55825a]/20 border border-[#8fae92]/30 py-2.5 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm font-medium text-[#8fae92] hover:from-[#8fae92]/30 hover:to-[#55825a]/30 transition-all disabled:opacity-50"
    >
      {copiedLink === 'third' ? <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Link2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
      {copiedLink === 'third' ? "Kopirano!" : "Link gost 3"}
    </button>
  ) : null}
  {reservation.fourthGuestName ? (
    <button
      onClick={async () => {
        setGeneratingLink('fourth');
        let url = "";
        try {
          const { getCheckinLink } = await import("@/app/actions/checkin");
          const link = await getCheckinLink(reservation.id, 'fourth');
          url = link.url ?? `${window.location.origin}/checkin/${link.token}`;
        } catch {
          setGeneratingLink(null);
          showMsg("Napaka pri pripravi linka. Poskusite znova.");
          return;
        }
        const copied = await copyToClipboard(url);
        setGeneratingLink(null);
        if (copied) {
          setCopiedLink('fourth');
          setTimeout(() => setCopiedLink(null), 2500);
        } else {
          showMsg(`Samodejno kopiranje ni uspelo. Povezava: ${url}`);
        }
      }}
      disabled={generatingLink !== null}
      className="w-full flex items-center justify-center gap-1.5 sm:gap-2 rounded-xl bg-gradient-to-r from-[#8fae92]/20 to-[#55825a]/20 border border-[#8fae92]/30 py-2.5 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm font-medium text-[#8fae92] hover:from-[#8fae92]/30 hover:to-[#55825a]/30 transition-all disabled:opacity-50"
    >
      {copiedLink === 'fourth' ? <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Link2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
      {copiedLink === 'fourth' ? "Kopirano!" : "Link gost 4"}
    </button>
  ) : null}
  {/* Preview the branded HTML check-in email (all guests + links) before sending */}
  <button
    onClick={async () => {
      setLoadingCheckinPreview(true);
      try {
        const to = (reservation.email || "").trim();
        const { getCheckinEmailPreview } = await import("@/app/actions/checkin");
        const result = await getCheckinEmailPreview(reservation.id, to);
        if (result.html) {
          // Editable per-guest police form: pre-fill every field with the stored
          // value so the operator can review AND change anything (even data the
          // guest already entered) before sending. Show a row per guest up to
          // the party size.
          const namedCount = [reservation.secondGuestName, reservation.thirdGuestName, reservation.fourthGuestName].filter((n) => (n || "").trim()).length + 1;
          const slotsToShow = Math.min(4, Math.max(reservation.pax || 1, namedCount));
          const r = reservation as unknown as Record<string, unknown>;
          // Column name for a slot + base field ("first" = raw column, others prefixed).
          const colOf = (slot: 'first' | 'second' | 'third' | 'fourth', base: CheckinGuestField) =>
            slot === 'first' ? base : `${slot}${base.charAt(0).toUpperCase()}${base.slice(1)}`;
          const fieldKeys: CheckinGuestField[] = ['guestName', 'dateOfBirth', ...CHECKIN_EXTRA_FIELDS.map((f) => f.key)];
          const buildData = (slot: 'first' | 'second' | 'third' | 'fourth') => {
            const d = {} as Record<CheckinGuestField, string>;
            fieldKeys.forEach((k) => { d[k] = ((r[colOf(slot, k)] as string) || "").toString().trim(); });
            return d;
          };
          const allSlots = ([
            { slot: 'first', label: 'Guest 1' },
            { slot: 'second', label: 'Guest 2' },
            { slot: 'third', label: 'Guest 3' },
            { slot: 'fourth', label: 'Guest 4' },
          ] as const).map((s) => ({ slot: s.slot, label: s.label, expanded: false, data: buildData(s.slot) }));
          setCheckinPreview({ html: result.html, to: result.to || "", guests: allSlots.slice(0, slotsToShow) });
        } else {
          showMsg(result.error || "Predogleda ni bilo mogoce pripraviti.");
        }
      } catch {
        showMsg("Napaka pri pripravi predogleda. Poskusite znova.");
      } finally {
        setLoadingCheckinPreview(false);
      }
    }}
    disabled={emailingGuest || loadingCheckinPreview || generatingLink !== null}
    className="w-full flex items-center justify-center gap-1.5 sm:gap-2 rounded-xl bg-gradient-to-r from-[#c59b5b]/20 to-[#c59b5b]/20 border border-[#c59b5b]/30 py-2.5 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm font-medium text-[#c59b5b] hover:from-[#c59b5b]/30 hover:to-[#c59b5b]/30 transition-all disabled:opacity-50"
  >
    <Mail className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
    {loadingCheckinPreview ? "Pripravljam predogled..." : "Pošlji email gostu"}
  </button>
  </div>
  )}
  </div>
  {/* Emaili gostom — skupni spustni meni (anketa + ponudba izletov) */}
  <div className="relative w-full sm:w-auto sm:flex-none">
  <button
    onClick={() => setShowGuestEmailsMenu(v => !v)}
    className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-white/[0.03] border border-white/10 py-1.5 px-3 text-xs font-medium text-white/70 hover:bg-white/[0.06] hover:text-white transition-all"
  >
    <Mail className="h-3.5 w-3.5" />
    Emaili gostom
    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showGuestEmailsMenu ? 'rotate-180' : ''}`} />
  </button>
  {showGuestEmailsMenu && (
  <div className="absolute left-0 top-full z-30 mt-2 flex w-72 flex-col gap-2 rounded-xl border border-white/10 bg-[#152329] p-2 shadow-2xl">
  {/* Preview the branded "how did you find us" survey email before sending */}
  <button
    onClick={async () => {
      setLoadingFeedbackPreview(true);
      try {
        const to = (reservation.email || "").trim();
        const { getFeedbackEmailPreview } = await import("@/app/actions/feedback-email");
        const result = await getFeedbackEmailPreview(reservation.id, to);
        if (result.html) {
          setFeedbackPreview({ html: result.html, to: result.to || "" });
        } else {
          showMsg(result.error || "Predogleda ni bilo mogoce pripraviti.");
        }
      } catch {
        showMsg("Napaka pri pripravi predogleda. Poskusite znova.");
      } finally {
        setLoadingFeedbackPreview(false);
      }
    }}
    disabled={emailingFeedback || loadingFeedbackPreview}
    className="w-full flex items-center justify-center gap-1.5 sm:gap-2 rounded-xl bg-white/[0.03] border border-white/10 py-2.5 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm font-medium text-white/70 hover:bg-white/[0.06] hover:text-white transition-all disabled:opacity-50"
  >
    <Mail className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
    {loadingFeedbackPreview ? "Pripravljam predogled..." : "Pošlji anketo (kje so nas našli)"}
  </button>
  {/* Preview the branded excursion offer email before sending */}
  <button
    onClick={async () => {
      setLoadingOfferPreview(true);
      try {
        const to = (reservation.email || "").trim();
        const { getExcursionOfferPreview } = await import("@/app/actions/excursion-offer-email");
        const result = await getExcursionOfferPreview(reservation.id, to);
        if (result.html) {
          setOfferPreview({ html: result.html, to: result.to || "" });
        } else {
          showMsg(result.error || "Predogleda ni bilo mogoce pripraviti.");
        }
      } catch {
        showMsg("Napaka pri pripravi predogleda. Poskusite znova.");
      } finally {
        setLoadingOfferPreview(false);
      }
    }}
    disabled={emailingOffer || loadingOfferPreview}
    className="w-full flex items-center justify-center gap-1.5 sm:gap-2 rounded-xl bg-white/[0.03] border border-white/10 py-2.5 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm font-medium text-white/70 hover:bg-white/[0.06] hover:text-white transition-all disabled:opacity-50"
  >
    <Compass className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
    {loadingOfferPreview ? "Pripravljam predogled..." : "Pošlji ponudbo izletov"}
  </button>
  </div>
  )}
  </div>
          </div>

          {/* Poslani emaili za to rezervacijo (spustni meni) */}
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setShowSentEmails(v => !v)}
              className="flex w-full items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-left transition-colors hover:border-white/15"
            >
              <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-white/60">
                <Mail className="h-4 w-4" /> Poslani emaili
              </span>
              <ChevronDown className={`h-4 w-4 text-white/40 transition-transform ${showSentEmails ? 'rotate-180' : ''}`} />
            </button>
            {showSentEmails && (
              <div className="mt-2">
                <SentEmailsBox reservationId={reservation.id} refreshKey={sentEmailsRefresh} compact />
              </div>
            )}
          </div>

          {/* AI pomočnik: sestavi odgovor na gostova vprašanja iz znanih podatkov */}
          <div className="mt-2">
            <GuestReplyAssistant reservationId={reservation.id} email={(reservation.email || "").trim()} />
          </div>

          {/* Zložljivi razdelki kartice gosta — Povezane rezervacije, Podatki gosta, Bivanje ... */}
          <div className="mt-6 space-y-3">
            {/* Skupina / Povezane rezervacije */}
            <div>
              <button
                onClick={() => setShowGroup(!showGroup)}
                className="w-full cursor-pointer flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-sm text-white hover:bg-white/[0.04] transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Users className="h-4 w-4 flex-shrink-0 text-[#c59b5b]" />
                  <span className="text-xs font-medium uppercase tracking-wider text-white/60">Povezane rezervacije</span>
                  {/* Ko je rezervacija v skupini, naj zaprta vrstica pove koliko bungalovov je povezanih */}
                  {reservation.groupId && (() => {
                    const inGroup = reservations.filter(r => r.groupId === reservation.groupId).length;
                    return (
                      <span
                        title={`${inGroup} rezervacij v skupini`}
                        className="rounded bg-[#c59b5b]/15 px-1.5 py-0.5 text-[9px] font-medium tracking-[0.08em] text-[#e8c88a]"
                      >
                        {inGroup}
                      </span>
                    );
                  })()}
                </span>
                <ChevronDown className={`h-4 w-4 flex-shrink-0 text-white/40 transition-transform ${showGroup ? 'rotate-180' : ''}`} />
              </button>
              {showGroup && (
              <div className="mt-3 p-3 rounded-xl border border-[#8f6d3a]/25 bg-[#c59b5b]/[0.05]">
            <div className={`flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3 ${reservation.groupId ? 'mb-2' : ''}`}>
              {/* Brez skupine je pojasnilo v isti vrstici kot gumb, da panel ne zeva prazen */}
              {!reservation.groupId && (
                <p className="text-[10px] leading-relaxed text-white/40 sm:mr-auto">
                  Ta rezervacija ni del skupine — poveži več bungalovov v eno skupino.
                </p>
              )}
              {!reservation.groupId ? (
                <button
                  onClick={async () => {
                    await createReservationGroup(reservation.id);
                    refresh();
                    showMsg("Skupina ustvarjena - ta rezervacija je glavna.");
                  }}
                  className="flex flex-shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-[#c59b5b]/30 bg-[#c59b5b]/15 px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-[#c59b5b] hover:bg-[#c59b5b]/25 transition-colors sm:py-1"
                >
                  <Plus className="h-3 w-3" />
                  Ustvari skupino
                </button>
              ) : (
                <button
                  onClick={async () => {
                    await unlinkReservationFromGroup(reservation.id);
                    refresh();
                    showMsg("Rezervacija odstranjena iz skupine.");
                  }}
                  className="flex flex-shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-[#c4744a]/30 bg-[#c4744a]/15 px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-[#c4744a] hover:bg-[#c4744a]/25 transition-colors sm:py-1"
                >
                  <Unlink className="h-3 w-3" />
                  Odstrani iz skupine
                </button>
              )}
            </div>
            
            {reservation.groupId ? (
              <>
                {/* Show other reservations in this group */}
                {(() => {
                  const groupReservations = reservations.filter(r => r.groupId === reservation.groupId && r.id !== reservation.id);
                  if (groupReservations.length === 0) {
                    return <p className="text-[10px] text-white/40">Ni drugih rezervacij v skupini. Povezi drugo rezervacijo spodaj.</p>;
                  }
                  return (
                    <div className="space-y-1.5">
                      {groupReservations.map(gr => {
                        const shortBungalow = bungalowDisplayName(gr.bungalow);
                        return (
                          <div 
                            key={gr.id} 
                            className="flex items-center justify-between p-2 rounded-lg bg-white/5 cursor-pointer hover:bg-white/10 transition-colors"
                            onClick={() => setSelectedReservationId(gr.id)}
                          >
                            <div className="flex items-center gap-2">
                              {gr.isMainReservation && <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#c59b5b]/20 text-[#e8c88a]">GLAVNA</span>}
                              <span className="text-xs text-white">{shortBungalow}</span>
                              <span className="text-xs text-white/60">- {gr.guestName}</span>
                              <span className="text-[10px] text-white/40">({gr.pax} os)</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
                
                {/* Link another reservation */}
                <div className="mt-3 pt-3 border-t border-[#8f6d3a]/20">
                  <label className="block text-[10px] text-white/40 mb-1.5">Povezi drugo rezervacijo</label>
                  <select
                    className="w-full rounded-lg border border-white/10 bg-[#143a49] px-3 py-2 text-xs text-white focus:border-[#c59b5b]/50 focus:outline-none [&>option]:bg-[#143a49] [&>option]:text-white"
                    value=""
                    onChange={async e => {
                      if (e.target.value) {
                        await linkReservationToGroup(e.target.value, reservation.groupId!);
                        refresh();
                        showMsg("Rezervacija povezana v skupino.");
                      }
                    }}
                  >
                    <option value="" className="bg-[#143a49] text-white/60">Izberi rezervacijo...</option>
                    {reservations
                      .filter(r => !r.groupId && r.id !== reservation.id && r.status !== 'CHECKED_OUT' && r.status !== 'CANCELLED')
                      .map(r => {
                        const shortBungalow = bungalowDisplayName(r.bungalow);
                        return (
                          <option key={r.id} value={r.id} className="bg-[#143a49] text-white">{shortBungalow} - {r.guestName} ({r.pax} os)</option>
                        );
                      })}
                  </select>
                </div>
                
                {/* Shared invoice checkbox */}
                <div className="mt-3 pt-3 border-t border-[#8f6d3a]/20">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(() => {
                        // Check main reservation's sharedInvoice setting
                        const mainRes = reservations.find(r => r.groupId === reservation.groupId && r.isMainReservation);
                        return mainRes?.sharedInvoice || reservation.sharedInvoice || false;
                      })()}
                      onChange={async e => {
                        // Update the MAIN reservation's sharedInvoice setting
                        const mainRes = reservations.find(r => r.groupId === reservation.groupId && r.isMainReservation);
                        const targetId = mainRes?.id || reservation.id;
                        const newValue = e.target.checked;
                        showMsg(newValue ? "Dobavnica bo skupna za vse bungalove." : "Dobavnice bodo ločene po bungalovih.");
                        await updateReservation(targetId, { sharedInvoice: newValue });
                        refresh();
                      }}
                      className="h-4 w-4 rounded border-[#c59b5b]/50 bg-white/5 accent-[#c59b5b] focus:ring-[#c59b5b]/50"
                    />
                    <div>
                      <span className="text-xs text-white">Skupna dobavnica</span>
                      <p className="text-[10px] text-white/40">Vsi artikli iz vseh bungalovov skupine gredo na eno dobavnico</p>
                    </div>
                  </label>
                </div>
              </>
            ) : null}
              </div>
              )}
            </div>

              <button
                onClick={() => setShowGuestData(!showGuestData)}
                className="w-full flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-sm text-white hover:bg-white/[0.04] transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Users className="h-4 w-4 flex-shrink-0 text-[#7fa8b8]" />
                  <span className="text-xs font-medium uppercase tracking-wider text-white/60">Podatki gosta</span>
                </span>
                <ChevronDown className={`h-4 w-4 flex-shrink-0 text-white/40 transition-transform ${showGuestData ? 'rotate-180' : ''}`} />
              </button>
              {showGuestData && (
                <div className="space-y-4">
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-[10px] sm:text-[11px] font-medium uppercase tracking-wider text-white/40"><Users className="h-3.5 w-3.5" />Naziv in ime</label>
              {/* Naziv je LOCEN od imena: ime se izpisuje na karticah, v koledarju in na racunih,
                  kjer bi "Mrs." samo delal gnec; vaucer pa gosta nagovori vljudno. */}
              <div className="flex gap-2">
                <select
                  key={`title-${reservation.id}-${reservation.guestTitle || 'none'}`}
                  className="w-24 flex-shrink-0 cursor-pointer rounded-xl border border-white/[0.06] bg-white/[0.02] px-2 sm:px-3 py-2.5 sm:py-3 text-sm text-white focus:border-[#7fa8b8]/40 focus:outline-none"
                  defaultValue={reservation.guestTitle || ''}
                  title="Naziv se izpiše pred imenom na vaučerju za transport"
                  onChange={async e => { await updateReservation(reservation.id, { guestTitle: e.target.value || null }); refresh(); }}
                >
                  <option value="">—</option>
                  <option value="Mr.">Mr.</option>
                  <option value="Mrs.">Mrs.</option>
                  <option value="Ms.">Ms.</option>
                </select>
                <input
                  type="text"
                  className="min-w-0 flex-1 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 sm:px-4 py-2.5 sm:py-3 text-sm text-white focus:border-[#7fa8b8]/40 focus:outline-none"
                  defaultValue={reservation.guestName}
                  onBlur={async e => { await updateReservation(reservation.id, { guestName: e.target.value }); refresh(); }}
                />
              </div>
              <select
                key={`band-first-${reservation.id}-${reservation.guestBand || 'adult'}`}
                className="mt-1.5 w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-2 py-1.5 text-xs text-white/80 focus:border-[#8fae92]/40 focus:outline-none"
                defaultValue={reservation.guestBand || 'adult'}
                onChange={async e => { await updateReservation(reservation.id, { guestBand: e.target.value }); refresh(); }}
              >
                <option value="adult">Odrasel</option>
                {CHILD_BANDS.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">Email</label>
              <input
                type="email"
                className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white focus:border-[#7fa8b8]/40 focus:outline-none"
                defaultValue={reservation.email || ""}
                onBlur={async e => { await updateReservation(reservation.id, { email: e.target.value }); }}
              />
            </div>
            <div>
              <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">Alergije</label>
              <input
                type="text"
                className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white focus:border-[#7fa8b8]/40 focus:outline-none"
                defaultValue={reservation.allergies || ""}
                onBlur={async e => { await updateReservation(reservation.id, { allergies: e.target.value }); refresh(); }}
              />
            </div>
            <LuxuryCheckbox label="Honeymoon" checked={reservation.honeymoon || false} onChange={v => handleUpdateReservation(reservation.id, { honeymoon: v })} />
            <LuxuryCheckbox label="Ne potrebuje prevoza" checked={(reservation as { noTransferNeeded?: boolean }).noTransferNeeded || false} onChange={v => handleUpdateReservation(reservation.id, { noTransferNeeded: v })} />
            <LuxurySelect label="Bungalow" value={reservation.bungalow} onChange={v => handleUpdateReservation(reservation.id, { bungalow: v })} options={BUNGALOWS} />
            <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-[10px] sm:text-[11px] font-medium uppercase tracking-wider text-white/40">Pax</label>
              <input
                type="number"
                className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 sm:px-4 py-2.5 sm:py-3 text-sm text-white focus:border-[#7fa8b8]/40 focus:outline-none"
  defaultValue={reservation.pax}
  onBlur={async e => { await updateReservation(reservation.id, { pax: Number(e.target.value) }); refresh(); }}
  />
  </div>
  
  {/* Ime drugega gosta */}
  <div>
  <label className="mb-1.5 block text-[10px] sm:text-[11px] font-medium uppercase tracking-wider text-white/40">Drugi gost</label>
  <input
  key={`second-guest-${reservation.id}`}
  type="text"
  className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 sm:px-4 py-2.5 sm:py-3 text-sm text-white placeholder:text-white/30 focus:border-[#7fa8b8]/40 focus:outline-none"
  defaultValue={reservation.secondGuestName || ""}
  placeholder="Ime"
  onBlur={async e => { await updateReservation(reservation.id, { secondGuestName: e.target.value }); refresh(); }}
  />
  <select
    key={`band-second-${reservation.id}-${reservation.secondGuestBand || 'adult'}`}
    className="mt-1.5 w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-2 py-1.5 text-xs text-white/80 focus:border-[#8fae92]/40 focus:outline-none"
    defaultValue={reservation.secondGuestBand || 'adult'}
    onChange={async e => { await updateReservation(reservation.id, { secondGuestBand: e.target.value }); refresh(); }}
  >
    <option value="adult">Odrasel</option>
    {CHILD_BANDS.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
  </select>
  </div>
  </div>

  {/* Ime tretjega gosta ��������� prikazano pri rezervacijah za 3+ oseb */}
  {(reservation.pax >= 3 || reservation.thirdGuestName) ? (
    <div>
      <label className="mb-1.5 block text-[10px] sm:text-[11px] font-medium uppercase tracking-wider text-white/40">Tretji gost</label>
      <input
        key={`third-guest-${reservation.id}`}
        type="text"
        className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 sm:px-4 py-2.5 sm:py-3 text-sm text-white placeholder:text-white/30 focus:border-[#7fa8b8]/40 focus:outline-none"
        defaultValue={reservation.thirdGuestName || ""}
        placeholder="Ime"
        onBlur={async e => { await updateReservation(reservation.id, { thirdGuestName: e.target.value }); refresh(); }}
      />
      <select
        key={`band-third-${reservation.id}-${reservation.thirdGuestBand || 'adult'}`}
        className="mt-1.5 w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-2 py-1.5 text-xs text-white/80 focus:border-[#8fae92]/40 focus:outline-none"
        defaultValue={reservation.thirdGuestBand || 'adult'}
        onChange={async e => { await updateReservation(reservation.id, { thirdGuestBand: e.target.value }); refresh(); }}
      >
        <option value="adult">Odrasel</option>
        {CHILD_BANDS.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
      </select>
    </div>
  ) : null}

  {/* Ime cetrtega gosta — prikazano pri rezervacijah za 4 osebe */}
  {(reservation.pax >= 4 || reservation.fourthGuestName) ? (
    <div>
      <label className="mb-1.5 block text-[10px] sm:text-[11px] font-medium uppercase tracking-wider text-white/40">Cetrti gost</label>
      <input
        key={`fourth-guest-${reservation.id}`}
        type="text"
        className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 sm:px-4 py-2.5 sm:py-3 text-sm text-white placeholder:text-white/30 focus:border-[#7fa8b8]/40 focus:outline-none"
        defaultValue={reservation.fourthGuestName || ""}
        placeholder="Ime"
        onBlur={async e => { await updateReservation(reservation.id, { fourthGuestName: e.target.value }); refresh(); }}
      />
      <select
        key={`band-fourth-${reservation.id}-${reservation.fourthGuestBand || 'adult'}`}
        className="mt-1.5 w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-2 py-1.5 text-xs text-white/80 focus:border-[#8fae92]/40 focus:outline-none"
        defaultValue={reservation.fourthGuestBand || 'adult'}
        onChange={async e => { await updateReservation(reservation.id, { fourthGuestBand: e.target.value }); refresh(); }}
      >
        <option value="adult">Odrasel</option>
        {CHILD_BANDS.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
      </select>
    </div>
  ) : null}

  {/* Sestava gostov / prehrana — izpeljano iz starostnih razredov gostov */}
  {(() => {
    const bands = [reservation.guestBand, reservation.secondGuestBand, reservation.thirdGuestBand, reservation.fourthGuestBand];
    const { adults, children } = countByBand(reservation.pax || 0, bands);
    const kidsTotal = totalChildren(children);
    return (
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
        <div className="mb-1 flex items-center justify-between">
          <span className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-white/40">
            <Users className="h-3.5 w-3.5 text-[#8fae92]" /> Sestava gostov (prehrana)
          </span>
          <span className="text-[11px] text-white/50">
            Odrasli: <span className="font-semibold text-white/80">{adults}</span> · Otroci: {kidsTotal} / Pax {reservation.pax || 0}
          </span>
        </div>
        {kidsTotal > 0 && (
          <p className="text-[11px] text-white/50">
            {CHILD_BANDS.filter(b => (children[b.id] || 0) > 0).map(b => `${children[b.id]}× ${b.label}`).join(' · ')}
          </p>
        )}
        <p className="mt-1.5 text-[10px] text-white/30">Starostni razred nastavite pri vsakem gostu zgoraj. 0–5 let brezplačno · 5–10 let ���50 % · 10–15 let −20 % (velja za penzion in obroke à la carte). Otroci se prijavijo policiji z lastnim obrazcem.</p>
      </div>
    );
  })()}
                </div>
              )}

            {/* Podatki za policijo — vsi gostje (zložljivo) */}
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.01]">
              <button
                type="button"
                onClick={() => setShowPolice(!showPolice)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm text-white hover:bg-white/[0.02] transition-colors"
              >
                <span className="flex items-center gap-2">
                  <FileText className="h-4 w-4 flex-shrink-0 text-[#7fa8b8]" />
                  <span className="text-xs font-medium uppercase tracking-wider text-white/60">Podatki za policijo</span>
                </span>
                <ChevronDown className={`h-4 w-4 flex-shrink-0 text-white/40 transition-transform ${showPolice ? "rotate-180" : ""}`} />
              </button>
              {showPolice && (
                <div className="space-y-4 px-3 pb-3">
            {/* Osebni podatki prvega gosta (za policijski zapisnik) — zložljivo */}
            <div className="rounded-xl border border-[#7fa8b8]/20 bg-[#7fa8b8]/[0.04]">
              <button
                type="button"
                onClick={() => setShowFirstGuestData(!showFirstGuestData)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm text-white hover:bg-white/[0.02] transition-colors"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <FileText className="h-4 w-4 flex-shrink-0 text-[#7fa8b8]" />
                  <span className="truncate">
                    <span className="text-white/60">Osebni podatki gosta: </span>
                    <span className="font-medium text-[#7fa8b8]">{reservation.guestName}</span>
                  </span>
                </span>
                <ChevronDown className={`h-4 w-4 flex-shrink-0 text-white/40 transition-transform ${showFirstGuestData ? 'rotate-180' : ''}`} />
              </button>
              {showFirstGuestData ? (
                <div className="px-4 pb-4 pt-1 space-y-3 border-t border-[#7fa8b8]/10">
            <div>
              <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">Nacionalnost</label>
              <input
                type="text"
                className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white focus:border-[#7fa8b8]/40 focus:outline-none"
                defaultValue={reservation.nationality || ""}
                onBlur={async e => { await updateReservation(reservation.id, { nationality: e.target.value }); refresh(); }}
              />
            </div>
            <div>
              <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">Potni list</label>
              <input
                type="text"
                className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white focus:border-[#7fa8b8]/40 focus:outline-none"
                defaultValue={reservation.passport || ""}
                onBlur={async e => { await updateReservation(reservation.id, { passport: e.target.value }); }}
              />
            </div>
            <div>
              <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">Datum rojstva</label>
              <input
                type="date"
                className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white focus:border-[#7fa8b8]/40 focus:outline-none [color-scheme:dark]"
                defaultValue={reservation.dateOfBirth || ""}
                onChange={async e => { await updateReservation(reservation.id, { dateOfBirth: e.target.value }); }}
              />
            </div>
            <div>
              <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">Kraj rojstva</label>
              <input
                type="text"
                className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white focus:border-[#7fa8b8]/40 focus:outline-none"
                defaultValue={reservation.placeOfBirth || ""}
                onBlur={async e => { await updateReservation(reservation.id, { placeOfBirth: e.target.value }); }}
              />
            </div>
            <div>
              <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">Ime očeta</label>
              <input
                type="text"
                className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white focus:border-[#7fa8b8]/40 focus:outline-none"
                defaultValue={reservation.fatherName || ""}
                onBlur={async e => { await updateReservation(reservation.id, { fatherName: e.target.value }); }}
              />
            </div>
            <div>
              <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">Ime matere</label>
              <input
                type="text"
                className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white focus:border-[#7fa8b8]/40 focus:outline-none"
                defaultValue={reservation.motherName || ""}
                onBlur={async e => { await updateReservation(reservation.id, { motherName: e.target.value }); }}
              />
            </div>
            <div>
              <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">Poklic</label>
              <input
                type="text"
                className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white focus:border-[#7fa8b8]/40 focus:outline-none"
                defaultValue={reservation.profession || ""}
                onBlur={async e => { await updateReservation(reservation.id, { profession: e.target.value }); }}
              />
            </div>
            <div>
              <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">Stalno prebivališče</label>
              <input
                type="text"
                className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white focus:border-[#7fa8b8]/40 focus:outline-none"
                defaultValue={reservation.domicile || ""}
                onBlur={async e => { await updateReservation(reservation.id, { domicile: e.target.value }); }}
              />
            </div>
            <div>
              <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">Datum izdaje potnega lista</label>
              <input
                type="date"
                className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white focus:border-[#7fa8b8]/40 focus:outline-none [color-scheme:dark]"
                defaultValue={reservation.passportDate || ""}
                onChange={async e => { await updateReservation(reservation.id, { passportDate: e.target.value }); }}
              />
            </div>
            <div>
              <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">Kraj izdaje potnega lista</label>
              <input
                type="text"
                className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white focus:border-[#7fa8b8]/40 focus:outline-none"
                defaultValue={reservation.passportLieu || ""}
                onBlur={async e => { await updateReservation(reservation.id, { passportLieu: e.target.value }); }}
              />
            </div>
            <div>
              <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">Prihaja iz</label>
              <input
                type="text"
                className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white focus:border-[#7fa8b8]/40 focus:outline-none"
                defaultValue={reservation.venantDe || ""}
                onBlur={async e => { await updateReservation(reservation.id, { venantDe: e.target.value }); }}
              />
            </div>
            <div>
              <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">Veljavnost vize</label>
              <input
                type="date"
                className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white focus:border-[#7fa8b8]/40 focus:outline-none [color-scheme:dark]"
                defaultValue={reservation.validiteVisa || ""}
                onChange={async e => { await updateReservation(reservation.id, { validiteVisa: e.target.value }); }}
              />
            </div>
            <div>
              <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">Potuje v</label>
              <input
                type="text"
                className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white focus:border-[#7fa8b8]/40 focus:outline-none"
                defaultValue={reservation.allantA || ""}
                onBlur={async e => { await updateReservation(reservation.id, { allantA: e.target.value }); }}
              />
            </div>
                </div>
              ) : null}
            </div>

            {/* Osebni podatki drugega gosta (za policijski zapisnik) */}
            {reservation.secondGuestName ? (
              <div className="rounded-xl border border-[#d9a68f]/20 bg-[#d9a68f]/[0.04]">
                <button
                  type="button"
                  onClick={() => setShowSecondGuestData(!showSecondGuestData)}
                  className="w-full flex items-center justify-between px-4 py-3 text-sm text-white hover:bg-white/[0.02] transition-colors"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 flex-shrink-0 text-[#d9a68f]" />
                    <span className="truncate">
                      <span className="text-white/60">Podatki 2. gosta: </span>
                      <span className="font-medium text-[#d9a68f]">{reservation.secondGuestName}</span>
                    </span>
                  </span>
                  <ChevronDown className={`h-4 w-4 flex-shrink-0 text-white/40 transition-transform ${showSecondGuestData ? 'rotate-180' : ''}`} />
                </button>
                {showSecondGuestData ? (
                  <div className="px-4 pb-4 pt-1 space-y-3 border-t border-[#d9a68f]/10">
                    <div>
                      <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">Ime in priimek</label>
                      <input
                        type="text"
                        className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white focus:border-[#d9a68f]/40 focus:outline-none"
                        defaultValue={reservation.secondGuestName || ""}
                        onBlur={async e => { await updateReservation(reservation.id, { secondGuestName: e.target.value }); refresh(); }}
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">Nacionalnost</label>
                      <input
                        type="text"
                        className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white focus:border-[#d9a68f]/40 focus:outline-none"
                        defaultValue={reservation.secondNationality || ""}
                        onBlur={async e => { await updateReservation(reservation.id, { secondNationality: e.target.value }); refresh(); }}
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">Potni list</label>
                      <input
                        type="text"
                        className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white focus:border-[#d9a68f]/40 focus:outline-none"
                        defaultValue={reservation.secondPassport || ""}
                        onBlur={async e => { await updateReservation(reservation.id, { secondPassport: e.target.value }); }}
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">Datum rojstva</label>
                      <input
                        type="date"
                        className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white focus:border-[#d9a68f]/40 focus:outline-none [color-scheme:dark]"
                        defaultValue={reservation.secondDateOfBirth || ""}
                        onChange={async e => { await updateReservation(reservation.id, { secondDateOfBirth: e.target.value }); }}
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">Kraj rojstva</label>
                      <input
                        type="text"
                        className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white focus:border-[#d9a68f]/40 focus:outline-none"
                        defaultValue={reservation.secondPlaceOfBirth || ""}
                        onBlur={async e => { await updateReservation(reservation.id, { secondPlaceOfBirth: e.target.value }); }}
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">Ime očeta</label>
                      <input
                        type="text"
                        className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white focus:border-[#d9a68f]/40 focus:outline-none"
                        defaultValue={reservation.secondFatherName || ""}
                        onBlur={async e => { await updateReservation(reservation.id, { secondFatherName: e.target.value }); }}
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">Ime matere</label>
                      <input
                        type="text"
                        className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white focus:border-[#d9a68f]/40 focus:outline-none"
                        defaultValue={reservation.secondMotherName || ""}
                        onBlur={async e => { await updateReservation(reservation.id, { secondMotherName: e.target.value }); }}
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">Poklic</label>
                      <input
                        type="text"
                        className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white focus:border-[#d9a68f]/40 focus:outline-none"
                        defaultValue={reservation.secondProfession || ""}
                        onBlur={async e => { await updateReservation(reservation.id, { secondProfession: e.target.value }); }}
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">Stalno prebivališče</label>
                      <input
                        type="text"
                        className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white focus:border-[#d9a68f]/40 focus:outline-none"
                        defaultValue={reservation.secondDomicile || ""}
                        onBlur={async e => { await updateReservation(reservation.id, { secondDomicile: e.target.value }); }}
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">Datum izdaje potnega lista</label>
                      <input
                        type="date"
                        className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white focus:border-[#d9a68f]/40 focus:outline-none [color-scheme:dark]"
                        defaultValue={reservation.secondPassportDate || ""}
                        onChange={async e => { await updateReservation(reservation.id, { secondPassportDate: e.target.value }); }}
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">Kraj izdaje potnega lista</label>
                      <input
                        type="text"
                        className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white focus:border-[#d9a68f]/40 focus:outline-none"
                        defaultValue={reservation.secondPassportLieu || ""}
                        onBlur={async e => { await updateReservation(reservation.id, { secondPassportLieu: e.target.value }); }}
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">Prihaja iz</label>
                      <input
                        type="text"
                        className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white focus:border-[#d9a68f]/40 focus:outline-none"
                        defaultValue={reservation.secondVenantDe || ""}
                        onBlur={async e => { await updateReservation(reservation.id, { secondVenantDe: e.target.value }); }}
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">Veljavnost vize</label>
                      <input
                        type="date"
                        className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white focus:border-[#d9a68f]/40 focus:outline-none [color-scheme:dark]"
                        defaultValue={reservation.secondValiditeVisa || ""}
                        onChange={async e => { await updateReservation(reservation.id, { secondValiditeVisa: e.target.value }); }}
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">Potuje v</label>
                      <input
                        type="text"
                        className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white focus:border-[#d9a68f]/40 focus:outline-none"
                        defaultValue={reservation.secondAllantA || ""}
                        onBlur={async e => { await updateReservation(reservation.id, { secondAllantA: e.target.value }); }}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* Osebni podatki tretjega gosta (za policijski zapisnik) */}
            {reservation.thirdGuestName ? (
              <div className="rounded-xl border border-[#c4e2ee]/20 bg-[#c4e2ee]/[0.04]">
                <button
                  type="button"
                  onClick={() => setShowThirdGuestData(!showThirdGuestData)}
                  className="w-full flex items-center justify-between px-4 py-3 text-sm text-white hover:bg-white/[0.02] transition-colors"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 flex-shrink-0 text-[#c4e2ee]" />
                    <span className="truncate">
                      <span className="text-white/60">Podatki 3. gosta: </span>
                      <span className="font-medium text-[#c4e2ee]">{reservation.thirdGuestName}</span>
                    </span>
                  </span>
                  <ChevronDown className={`h-4 w-4 flex-shrink-0 text-white/40 transition-transform ${showThirdGuestData ? 'rotate-180' : ''}`} />
                </button>
                {showThirdGuestData ? (
                  <div className="px-4 pb-4 pt-1 space-y-3 border-t border-[#c4e2ee]/10">
                    <div>
                      <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">Ime in priimek</label>
                      <input
                        type="text"
                        className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white focus:border-[#c4e2ee]/40 focus:outline-none"
                        defaultValue={reservation.thirdGuestName || ""}
                        onBlur={async e => { await updateReservation(reservation.id, { thirdGuestName: e.target.value }); refresh(); }}
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">Nacionalnost</label>
                      <input
                        type="text"
                        className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white focus:border-[#c4e2ee]/40 focus:outline-none"
                        defaultValue={reservation.thirdNationality || ""}
                        onBlur={async e => { await updateReservation(reservation.id, { thirdNationality: e.target.value }); refresh(); }}
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">Potni list</label>
                      <input
                        type="text"
                        className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white focus:border-[#c4e2ee]/40 focus:outline-none"
                        defaultValue={reservation.thirdPassport || ""}
                        onBlur={async e => { await updateReservation(reservation.id, { thirdPassport: e.target.value }); }}
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">Datum rojstva</label>
                      <input
                        type="date"
                        className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white focus:border-[#c4e2ee]/40 focus:outline-none [color-scheme:dark]"
                        defaultValue={reservation.thirdDateOfBirth || ""}
                        onChange={async e => { await updateReservation(reservation.id, { thirdDateOfBirth: e.target.value }); }}
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">Kraj rojstva</label>
                      <input
                        type="text"
                        className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white focus:border-[#c4e2ee]/40 focus:outline-none"
                        defaultValue={reservation.thirdPlaceOfBirth || ""}
                        onBlur={async e => { await updateReservation(reservation.id, { thirdPlaceOfBirth: e.target.value }); }}
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">Ime očeta</label>
                      <input
                        type="text"
                        className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white focus:border-[#c4e2ee]/40 focus:outline-none"
                        defaultValue={reservation.thirdFatherName || ""}
                        onBlur={async e => { await updateReservation(reservation.id, { thirdFatherName: e.target.value }); }}
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">Ime matere</label>
                      <input
                        type="text"
                        className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white focus:border-[#c4e2ee]/40 focus:outline-none"
                        defaultValue={reservation.thirdMotherName || ""}
                        onBlur={async e => { await updateReservation(reservation.id, { thirdMotherName: e.target.value }); }}
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">Poklic</label>
                      <input
                        type="text"
                        className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white focus:border-[#c4e2ee]/40 focus:outline-none"
                        defaultValue={reservation.thirdProfession || ""}
                        onBlur={async e => { await updateReservation(reservation.id, { thirdProfession: e.target.value }); }}
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">Stalno prebivališče</label>
                      <input
                        type="text"
                        className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white focus:border-[#c4e2ee]/40 focus:outline-none"
                        defaultValue={reservation.thirdDomicile || ""}
                        onBlur={async e => { await updateReservation(reservation.id, { thirdDomicile: e.target.value }); }}
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">Datum izdaje potnega lista</label>
                      <input
                        type="date"
                        className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white focus:border-[#c4e2ee]/40 focus:outline-none [color-scheme:dark]"
                        defaultValue={reservation.thirdPassportDate || ""}
                        onChange={async e => { await updateReservation(reservation.id, { thirdPassportDate: e.target.value }); }}
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">Kraj izdaje potnega lista</label>
                      <input
                        type="text"
                        className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white focus:border-[#c4e2ee]/40 focus:outline-none"
                        defaultValue={reservation.thirdPassportLieu || ""}
                        onBlur={async e => { await updateReservation(reservation.id, { thirdPassportLieu: e.target.value }); }}
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">Prihaja iz</label>
                      <input
                        type="text"
                        className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white focus:border-[#c4e2ee]/40 focus:outline-none"
                        defaultValue={reservation.thirdVenantDe || ""}
                        onBlur={async e => { await updateReservation(reservation.id, { thirdVenantDe: e.target.value }); }}
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">Veljavnost vize</label>
                      <input
                        type="date"
                        className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white focus:border-[#c4e2ee]/40 focus:outline-none [color-scheme:dark]"
                        defaultValue={reservation.thirdValiditeVisa || ""}
                        onChange={async e => { await updateReservation(reservation.id, { thirdValiditeVisa: e.target.value }); }}
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">Potuje v</label>
                      <input
                        type="text"
                        className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white focus:border-[#c4e2ee]/40 focus:outline-none"
                        defaultValue={reservation.thirdAllantA || ""}
                        onBlur={async e => { await updateReservation(reservation.id, { thirdAllantA: e.target.value }); }}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* Osebni podatki cetrtega gosta (za policijski zapisnik) */}
            {reservation.fourthGuestName ? (
              <div className="rounded-xl border border-[#8fae92]/20 bg-[#8fae92]/[0.04]">
                <button
                  type="button"
                  onClick={() => setShowFourthGuestData(!showFourthGuestData)}
                  className="w-full flex items-center justify-between px-4 py-3 text-sm text-white hover:bg-white/[0.02] transition-colors"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 flex-shrink-0 text-[#8fae92]" />
                    <span className="truncate">
                      <span className="text-white/60">Podatki 4. gosta: </span>
                      <span className="font-medium text-[#8fae92]">{reservation.fourthGuestName}</span>
                    </span>
                  </span>
                  <ChevronDown className={`h-4 w-4 flex-shrink-0 text-white/40 transition-transform ${showFourthGuestData ? 'rotate-180' : ''}`} />
                </button>
                {showFourthGuestData ? (
                  <div className="px-4 pb-4 pt-1 space-y-3 border-t border-[#8fae92]/10">
                    <div>
                      <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">Ime in priimek</label>
                      <input type="text" className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white focus:border-[#8fae92]/40 focus:outline-none" defaultValue={reservation.fourthGuestName || ""} onBlur={async e => { await updateReservation(reservation.id, { fourthGuestName: e.target.value }); refresh(); }} />
                    </div>
                    <div>
                      <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">Nacionalnost</label>
                      <input type="text" className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white focus:border-[#8fae92]/40 focus:outline-none" defaultValue={reservation.fourthNationality || ""} onBlur={async e => { await updateReservation(reservation.id, { fourthNationality: e.target.value }); refresh(); }} />
                    </div>
                    <div>
                      <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">Potni list</label>
                      <input type="text" className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white focus:border-[#8fae92]/40 focus:outline-none" defaultValue={reservation.fourthPassport || ""} onBlur={async e => { await updateReservation(reservation.id, { fourthPassport: e.target.value }); }} />
                    </div>
                    <div>
                      <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">Datum rojstva</label>
                      <input type="date" className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white focus:border-[#8fae92]/40 focus:outline-none [color-scheme:dark]" defaultValue={reservation.fourthDateOfBirth || ""} onChange={async e => { await updateReservation(reservation.id, { fourthDateOfBirth: e.target.value }); }} />
                    </div>
                    <div>
                      <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">Kraj rojstva</label>
                      <input type="text" className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white focus:border-[#8fae92]/40 focus:outline-none" defaultValue={reservation.fourthPlaceOfBirth || ""} onBlur={async e => { await updateReservation(reservation.id, { fourthPlaceOfBirth: e.target.value }); }} />
                    </div>
                    <div>
                      <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">Ime očeta</label>
                      <input type="text" className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white focus:border-[#8fae92]/40 focus:outline-none" defaultValue={reservation.fourthFatherName || ""} onBlur={async e => { await updateReservation(reservation.id, { fourthFatherName: e.target.value }); }} />
                    </div>
                    <div>
                      <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">Ime matere</label>
                      <input type="text" className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white focus:border-[#8fae92]/40 focus:outline-none" defaultValue={reservation.fourthMotherName || ""} onBlur={async e => { await updateReservation(reservation.id, { fourthMotherName: e.target.value }); }} />
                    </div>
                    <div>
                      <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">Poklic</label>
                      <input type="text" className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white focus:border-[#8fae92]/40 focus:outline-none" defaultValue={reservation.fourthProfession || ""} onBlur={async e => { await updateReservation(reservation.id, { fourthProfession: e.target.value }); }} />
                    </div>
                    <div>
                      <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">Stalno prebivališče</label>
                      <input type="text" className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white focus:border-[#8fae92]/40 focus:outline-none" defaultValue={reservation.fourthDomicile || ""} onBlur={async e => { await updateReservation(reservation.id, { fourthDomicile: e.target.value }); }} />
                    </div>
                    <div>
                      <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">Datum izdaje potnega lista</label>
                      <input type="date" className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white focus:border-[#8fae92]/40 focus:outline-none [color-scheme:dark]" defaultValue={reservation.fourthPassportDate || ""} onChange={async e => { await updateReservation(reservation.id, { fourthPassportDate: e.target.value }); }} />
                    </div>
                    <div>
                      <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">Kraj izdaje potnega lista</label>
                      <input type="text" className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white focus:border-[#8fae92]/40 focus:outline-none" defaultValue={reservation.fourthPassportLieu || ""} onBlur={async e => { await updateReservation(reservation.id, { fourthPassportLieu: e.target.value }); }} />
                    </div>
                    <div>
                      <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">Prihaja iz</label>
                      <input type="text" className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white focus:border-[#8fae92]/40 focus:outline-none" defaultValue={reservation.fourthVenantDe || ""} onBlur={async e => { await updateReservation(reservation.id, { fourthVenantDe: e.target.value }); }} />
                    </div>
                    <div>
                      <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">Veljavnost vize</label>
                      <input type="date" className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white focus:border-[#8fae92]/40 focus:outline-none [color-scheme:dark]" defaultValue={reservation.fourthValiditeVisa || ""} onChange={async e => { await updateReservation(reservation.id, { fourthValiditeVisa: e.target.value }); }} />
                    </div>
                    <div>
                      <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">Potuje v</label>
                      <input type="text" className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white focus:border-[#8fae92]/40 focus:outline-none" defaultValue={reservation.fourthAllantA || ""} onBlur={async e => { await updateReservation(reservation.id, { fourthAllantA: e.target.value }); }} />
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
                </div>
              )}
            </div>

  {/* Collapsible Dates Section */}
            <div>
              <button
                onClick={() => setShowDates(!showDates)}
                className="w-full flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-sm text-white hover:bg-white/[0.04] transition-colors"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <Calendar className="h-4 w-4 flex-shrink-0 text-[#7fa8b8]" />
                  <span className="truncate text-xs sm:text-sm">
                    <span className="text-white/60">Bivanje: </span>
                    <span className="font-medium">{reservation.arrival || '?'} �� {reservation.departure || '?'}</span>
                  </span>
                </span>
                <ChevronDown className={`h-4 w-4 flex-shrink-0 text-white/40 transition-transform ${showDates ? 'rotate-180' : ''}`} />
              </button>
              {showDates && (
                <div className="mt-2 space-y-2">
                  <div className="grid grid-cols-2 gap-2 p-3 rounded-xl border border-white/[0.06] bg-white/[0.02]">
                    <div>
                      <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-white/40">Prihod</label>
                      <input
                        type="date"
                        className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-2 sm:px-3 py-2 text-sm text-white focus:border-[#7fa8b8]/40 focus:outline-none"
                        defaultValue={reservation.arrival || ''}
                        onBlur={e => {
                          if (e.target.value !== reservation.arrival) {
                            handleUpdateReservation(reservation.id, { arrival: e.target.value });
                          }
                        }}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-white/40">Odhod</label>
                      <input
                        type="date"
                        className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-2 sm:px-3 py-2 text-sm text-white focus:border-[#7fa8b8]/40 focus:outline-none"
                        defaultValue={reservation.departure || ''}
                        onBlur={e => {
                          if (e.target.value !== reservation.departure) {
                            handleUpdateReservation(reservation.id, { departure: e.target.value });
                          }
                        }}
                      />
                    </div>
                  </div>

                  {/* Extend stay (extra nights with a manually entered price) */}
                  <div className="p-3 rounded-xl border border-[#c59b5b]/25 bg-[#c59b5b]/[0.05]">
                    <button
                      onClick={() => setShowExtendStay(v => !v)}
                      className="flex w-full items-center justify-between text-left"
                    >
                      <span className="flex items-center gap-2 text-sm font-medium text-[#c59b5b]">
                        <Plus className="h-4 w-4" /> Podaljšaj bivanje (dodatna nočitev)
                      </span>
                      <ChevronDown className={`h-4 w-4 text-[#c59b5b]/60 transition-transform ${showExtendStay ? 'rotate-180' : ''}`} />
                    </button>

                    {showExtendStay && (
                      <div className="mt-3 space-y-2">
                        <p className="text-[11px] leading-relaxed text-white/50">
                          Vpiši nov datum odhoda in ceno dodatnih nočitev. Znesek se prišteje k ceni bivanja, postavka na dobavnici in računu se posodobi samodejno.
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-white/40">Nov datum odhoda</label>
                            <input
                              id={`extend-date-${reservation.id}`}
                              type="date"
                              defaultValue={reservation.departure ? new Date(new Date(reservation.departure).getTime() + 86400000).toISOString().slice(0, 10) : ''}
                              className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-2 py-2 text-sm text-white focus:border-[#c59b5b]/40 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-white/40">Cena dodatnih nočitev (EUR)</label>
                            <input
                              id={`extend-price-${reservation.id}`}
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="npr. 360"
                              className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-2 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#c59b5b]/40 focus:outline-none"
                            />
                          </div>
                        </div>
                        <p className="text-[11px] text-white/50">
                          Trenutna cena bivanja: <span className="text-white/80">{Number(reservation.totalAmount || 0).toFixed(2)} EUR</span>
                        </p>
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setShowExtendStay(false)}
                            disabled={extendingStay}
                            className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/70 hover:bg-white/5 disabled:opacity-50"
                          >
                            Prekliči
                          </button>
                          <button
                            onClick={async () => {
                              const dateEl = document.getElementById(`extend-date-${reservation.id}`) as HTMLInputElement | null;
                              const priceEl = document.getElementById(`extend-price-${reservation.id}`) as HTMLInputElement | null;
                              const newDeparture = dateEl?.value || '';
                              const extraEur = Number(priceEl?.value || 0);
                              if (!newDeparture) { showMsg('Vpiši nov datum odhoda.'); return; }
                              if (newDeparture <= (reservation.arrival || '')) { showMsg('Datum odhoda mora biti po datumu prihoda.'); return; }
                              if (!(extraEur > 0)) { showMsg('Vpiši ceno dodatnih nočitev.'); return; }
                              const newTotal = Number(reservation.totalAmount || 0) + extraEur;
                              // Compose a guest-facing extension note shown on the invoice.
                              const oldDep = reservation.departure || '';
                              const extraNights = oldDep ? Math.max(1, Math.round((new Date(newDeparture).getTime() - new Date(oldDep).getTime()) / 86400000)) : 1;
                              const depLabel = new Date(newDeparture).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
                              const noteLine = `Stay extended: +${extraNights} night${extraNights > 1 ? 's' : ''} to ${depLabel} (+${extraEur.toFixed(2)} EUR)`;
                              const prevNote = (reservation.extensionNote || '').trim();
                              const extensionNote = prevNote ? `${prevNote}; ${noteLine}` : noteLine;
                              setExtendingStay(true);
                              await updateReservation(reservation.id, { departure: newDeparture, totalAmount: newTotal, extensionNote });
                              setExtendingStay(false);
                              setShowExtendStay(false);
                              showMsg('Bivanje podaljšano, cena posodobljena.');
                              refresh();
                            }}
                            disabled={extendingStay}
                            className="rounded-lg bg-[#c59b5b] px-3 py-1.5 text-xs font-medium text-[#0a2029] hover:bg-[#e3c5a0] disabled:opacity-50"
                          >
                            {extendingStay ? 'Shranjujem…' : 'Podaljšaj bivanje'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            {/* Collapsible Transfers Section */}
            <div>
              <button
                onClick={() => setShowTransfers(!showTransfers)}
                className="w-full flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-sm text-white hover:bg-white/[0.04] transition-colors"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <Car className="h-4 w-4 flex-shrink-0 text-[#4e8296]" />
                  <span className="truncate text-xs sm:text-sm">
                    <span className="text-white/60">Transferji: </span>
                    <span className="font-medium">
                      {reservation.transfers?.arrival?.route ? 'Prihod' : ''} 
                      {reservation.transfers?.arrival?.route && reservation.transfers?.departure?.route ? ' + ' : ''}
                      {reservation.transfers?.departure?.route ? 'Odhod' : ''}
                      {!reservation.transfers?.arrival?.route && !reservation.transfers?.departure?.route ? 'Ni' : ''}
                    </span>
                  </span>
                </span>
                <ChevronDown className={`h-4 w-4 flex-shrink-0 text-white/40 transition-transform ${showTransfers ? 'rotate-180' : ''}`} />
              </button>
              
              {showTransfers && (
                <div className="mt-3 space-y-3 p-3 rounded-xl border border-white/[0.06] bg-white/[0.02]">
                  {/* Arrival Transfer */}
                  <div className="p-3 rounded-xl border border-[#53945a]/20 bg-[#53945a]/5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <LogIn className="h-4 w-4 text-[#53945a]" />
                        <span className="text-sm font-medium text-[#53945a]">Prihod</span>
                        <span className="text-xs text-white/40">({reservation.arrival})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {reservation.transfers?.arrival?.route && (
                          <>
                            <button
                              onClick={async () => {
                                if (confirm('Ali res želiš izbrisati ta transfer?')) {
                                  await deleteTransfer(reservation.id, 'arrival');
                                  refresh();
                                }
                              }}
                              className="text-xs text-red-400 hover:text-red-300"
                            >
                              Izbriši
                            </button>
                            <LuxuryBadge variant={reservation.transfers.arrival.paymentStatus === 'PREPAID' ? 'petrol' : reservation.transfers.arrival.paymentStatus === 'PAID' ? 'ocean' : 'danger'}>
                              {reservation.transfers.arrival.paymentStatus === 'PREPAID' ? 'Vkljuceno' : reservation.transfers.arrival.paymentStatus === 'PAID' ? 'Placano' : 'Za placilo'}
                            </LuxuryBadge>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="space-y-3">
                      {/* Guest arranges this leg — no boat owed, and nothing pending. */}
                      {(() => {
                        const own = (reservation as { ownArrivalTransfer?: boolean }).ownArrivalTransfer || false;
                        const ownTime = (reservation as { ownArrivalTime?: string | null }).ownArrivalTime || "";
                        return (
                          <>
                          <button
                            type="button"
                            aria-pressed={own}
                            onClick={() => handleUpdateReservation(reservation.id, { ownArrivalTransfer: !own })}
                            title="Gost prihod organizira sam — na kartici bungalova se izpiše namesto ladjice"
                            className={`flex w-full cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-xs transition-colors ${
                              own
                                ? "border-[#53945a]/45 bg-[#53945a]/15 text-[#8fae92]"
                                : "border-white/10 bg-white/5 text-white/50 hover:bg-white/[0.08]"
                            }`}
                          >
                            <span
                              className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${
                                own ? "border-[#53945a] bg-[#53945a]" : "border-white/25"
                              }`}
                            >
                              {own && <Check className="h-3 w-3 text-[#0a2029]" />}
                            </span>
                            Gost prevoz organizira sam
                          </button>
                          {own && (
                            // Only meaningful once the guest handles the leg: with no transfer
                            // there is no boat or flight time to derive an arrival hour from,
                            // so reception enters what the guest told them.
                            <div>
                              <label className="mb-1 block text-xs text-white/40" htmlFor={`own-arrival-time-${reservation.id}`}>
                                Ura prihoda v Lodge
                              </label>
                              <input
                                id={`own-arrival-time-${reservation.id}`}
                                type="time"
                                value={ownTime}
                                title="Ura, ob kateri gost pride v Lodge — izpiše se na kartici bungalova"
                                onChange={e => handleUpdateReservation(reservation.id, { ownArrivalTime: e.target.value || null })}
                                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm tabular-nums text-white focus:border-[#53945a]/50 focus:outline-none"
                              />
                            </div>
                          )}
                          </>
                        );
                      })()}
                      <div>
                        <label className="block text-xs text-white/40 mb-1">Relacija</label>
                        <select
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-[#53945a]/50 focus:outline-none [&>option]:bg-[#0f2e3a] [&>option]:text-white"
                          value={reservation.transfers?.arrival?.route || ''}
                          onChange={async e => {
                            const route = e.target.value;
                            // Price will be calculated when boat is selected
                            await updateTransfer(reservation.id, 'arrival', { route, guestPrice: 0, date: reservation.arrival });
                            refresh();
                          }}
                        >
                          <option value="">-- Ni transferja --</option>
                          {dbRoutes.map((r: { id: string; name: string }) => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                          ))}
                        </select>
                      </div>
                      {reservation.transfers?.arrival?.route && (
                        <>
                          {/* Flight Info */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <TransferTextField
                              label="St. leta"
                              placeholder="ET837"
                              value={reservation.transfers?.arrival?.flightNumber || ''}
                              onSave={async v => { await updateTransfer(reservation.id, 'arrival', { flightNumber: v }); refresh(); }}
                            />
                            <TransferTextField
                              label="Ura prihoda"
                              placeholder="14:45"
                              value={reservation.transfers?.arrival?.flightTime || ''}
                              onSave={async v => { await updateTransfer(reservation.id, 'arrival', { flightTime: v }); refresh(); }}
                            />
                            <div>
                              <label className="block text-xs text-white/40 mb-1">Datum</label>
                              <input
                                type="date"
                                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-[#53945a]/50 focus:outline-none"
                                defaultValue={reservation.transfers?.arrival?.pickupDate || reservation.arrival}
                                onBlur={async e => {
                                  await updateTransfer(reservation.id, 'arrival', { pickupDate: e.target.value });
                                }}
                              />
                            </div>
                          </div>

                          {/* Price and Payment */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs text-white/40 mb-1">Cena (EUR)</label>
                              <input
                                key={`arr-price-${reservation.transfers.arrival.guestPrice}`}
                                type="number"
                                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-[#53945a]/50 focus:outline-none"
                                defaultValue={reservation.transfers.arrival.guestPrice || 0}
                                onBlur={async e => { await updateTransfer(reservation.id, "arrival", { guestPrice: Number(e.target.value) }); }}
                              />
                            </div>
                            <LuxurySelect 
                              label="Status placila" 
                              value={reservation.transfers.arrival.paymentStatus || 'UNPAID'} 
                              onChange={async v => { await updateTransfer(reservation.id, "arrival", { paymentStatus: v }); refresh(); }} 
                              options={[
                                { value: 'PREPAID', label: 'Vkljuceno' },
                                { value: 'PAID', label: 'Placano' },
                                { value: 'UNPAID', label: 'Za placilo' },
                              ]} 
                            />
                          </div>
                          {reservation.transfers.arrival.paymentStatus === 'PAID' && (
                            <div className="grid grid-cols-2 gap-3 rounded-xl border border-[#8fae92]/20 bg-[#8fae92]/[0.04] p-3">
                              <LuxurySelect
                                label="Nacin placila"
                                value={reservation.transfers.arrival.paidMethod || 'cash'}
                                onChange={async v => { await updateTransfer(reservation.id, "arrival", { paidMethod: v }); refresh(); }}
                                options={[
                                  { value: 'cash', label: 'Gotovina' },
                                  { value: 'card', label: 'Kartica' },
                                  { value: 'transfer', label: 'Bancno nakazilo' },
                                ]}
                              />
                              <div>
                                <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">Datum placila</label>
                                <input
                                  type="date"
                                  className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white focus:border-[#7fa8b8]/40 focus:outline-none"
                                  defaultValue={reservation.transfers.arrival.paidDate || today()}
                                  onBlur={async e => { await updateTransfer(reservation.id, "arrival", { paidDate: e.target.value }); refresh(); }}
                                />
                              </div>
                            </div>
                          )}

                          {/* Boat Selection */}
                          <div>
                            <label className="block text-xs text-white/40 mb-1">Coln</label>
                            <select 
                              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-[#53945a]/50 focus:outline-none [&>option]:bg-[#0f2e3a] [&>option]:text-white"
                              value={reservation.transfers.arrival.boatId || ''}
                              onChange={async e => { 
                                const boatId = e.target.value; 
                                const price = getTransferGuestPrice(reservation.transfers.arrival.route, boatId, reservation.pax) + getHermanGuestPrice(reservation.transfers.arrival.hermanRouteId, reservation.pax); 
                                await updateTransfer(reservation.id, "arrival", { boatId, guestPrice: price }); 
                                refresh();
                              }}
                            >
                              <option value="">-- Izberi coln --</option>
                              {dbBoats.map((b: { id: string; name: string; engine: string; maxPax: number }) => <option key={b.id} value={b.id}>{b.name} ({b.engine})</option>)}
                            </select>
                          </div>

                          {/* Pick up point — kraj prevzema gosta; izpise se na vaucerju */}
                          <TransferTextField
                            label="Pick up point (na vaucerju)"
                            placeholder="Airport Nosy Be / Hotel Vanila, Hell-Ville"
                            value={reservation.transfers?.arrival?.pickupPoint || ''}
                            onSave={async v => { await updateTransfer(reservation.id, "arrival", { pickupPoint: v }); refresh(); }}
                          />

                          {/* Port & Herman Times */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <TransferTextField
                              label="Coln v Portu"
                              placeholder="15:30"
                              value={reservation.transfers?.arrival?.boatPortTime || ''}
                              onSave={async v => { await updateTransfer(reservation.id, "arrival", { boatPortTime: v }); refresh(); }}
                            />
                            <TransferTextField
                              label="Herman na destinaciji"
                              placeholder="14:30"
                              value={reservation.transfers?.arrival?.hermanAirportTime || ''}
                              onSave={async v => { await updateTransfer(reservation.id, "arrival", { hermanAirportTime: v }); refresh(); }}
                            />
                          </div>

                          {/* Taxi route (avto do Porta) + carrier costs */}
                          <div>
                            {taxiBoats.length > 1 && (
                              <div className="mb-2">
                                <label className="block text-xs text-white/40 mb-1">Taksist (avto)</label>
                                <select
                                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-[#53945a]/50 focus:outline-none [&>option]:bg-[#0f2e3a] [&>option]:text-white"
                                  value={taxiIdOf(reservation.transfers?.arrival)}
                                  onChange={async e => {
                                    await updateTransfer(reservation.id, "arrival", { taxiBoatId: e.target.value });
                                    refresh();
                                  }}
                                >
                                  {taxiBoats.map((b: { id: string; name: string }) => {
                                    const rid = reservation.transfers?.arrival?.hermanRouteId;
                                    const costAr = rid ? getSupplierCostAr(b.id, rid) : 0;
                                    return <option key={b.id} value={b.id}>{b.name}{rid ? ` (${ar(costAr)})` : ''}</option>;
                                  })}
                                </select>
                              </div>
                            )}
                            <label className="block text-xs text-white/40 mb-1">Relacija avta (taksi)</label>
                            <select
                              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-[#53945a]/50 focus:outline-none [&>option]:bg-[#0f2e3a] [&>option]:text-white"
                              value={reservation.transfers?.arrival?.hermanRouteId || ''}
                              onChange={async e => {
                                const hermanRouteId = e.target.value;
                                const price = getTransferGuestPrice(reservation.transfers.arrival.route, reservation.transfers?.arrival?.boatId || '', reservation.pax) + getHermanGuestPrice(hermanRouteId, reservation.pax, taxiIdOf(reservation.transfers?.arrival));
                                await updateTransfer(reservation.id, "arrival", { hermanRouteId, guestPrice: price });
                                refresh();
                              }}
                            >
                              <option value="">-- Brez avta (taksi) --</option>
                              {taxiRoutesFor(taxiIdOf(reservation.transfers?.arrival)).map((r: { id: string; name: string }) => (
                                <option key={r.id} value={r.id}>{r.name} ({ar(getSupplierCostAr(taxiIdOf(reservation.transfers?.arrival), r.id))})</option>
                              ))}
                            </select>
                            {(() => {
                              const taxiId = taxiIdOf(reservation.transfers?.arrival);
                              const taxiName = taxiNameOf(taxiId);
                              const dilipCostAr = getSupplierCostAr(reservation.transfers?.arrival?.boatId, reservation.transfers?.arrival?.route);
                              const hermanCostAr = getSupplierCostAr(taxiId, reservation.transfers?.arrival?.hermanRouteId);
                              const hermanGuestEur = getHermanGuestPrice(reservation.transfers?.arrival?.hermanRouteId, reservation.pax);
                              const hermanRouteName = dbRoutes.find((rt: { id: string; name: string }) => rt.id === reservation.transfers?.arrival?.hermanRouteId)?.name || 'avto';
                              if (dilipCostAr <= 0 && hermanCostAr <= 0) return null;
                              // With the cost panel hidden there is nothing left in this block
                              // unless the guest price applies — bail out so no empty gap remains.
                              if (!SHOW_SUPPLIER_COST_IN_TRANSFER && hermanGuestEur <= 0) return null;
                              return (
                                <div className="mt-2 space-y-1.5">
                                  {/* Supplier cost — see SHOW_SUPPLIER_COST_IN_TRANSFER */}
                                  {SHOW_SUPPLIER_COST_IN_TRANSFER && (
                                  <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2">
                                    <p className="text-[11px] font-semibold text-amber-300">Za plačilo prevoznikoma (strošek):</p>
                                    <div className="flex flex-wrap gap-x-4 text-xs text-amber-200/90">
                                      {dilipCostAr > 0 && <span>Dilip (čoln): {ar(dilipCostAr)}</span>}
                                      {hermanCostAr > 0 && <span>{taxiName}: {ar(hermanCostAr)}</span>}
                                    </div>
                                    {hermanCostAr > 0 && (
                                      <p className="mt-1 text-[11px] font-semibold text-[#8fae92]">Pokliči tudi {taxiName} ({hermanRouteName})</p>
                                    )}
                                  </div>
                                  )}
                                  {hermanGuestEur > 0 && (
                                    <p className="text-[11px] text-[#53945a]/90">Prodajna cena gostu (Herman): {eur(hermanGuestEur)} — vključena v skupno Ceno (EUR)</p>
                                  )}
                                </div>
                              );
                            })()}
                          </div>

                          {/* Notes */}
                          <TransferTextField
                            label="Opombe"
                            placeholder="npr. otroški sedež..."
                            value={reservation.transfers?.arrival?.notes || ''}
                            onSave={async v => { await updateTransfer(reservation.id, "arrival", { notes: v }); refresh(); }}
                          />

                          {/* Executed */}
                          <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-2">
                            <span className="text-xs text-white">Izveden</span>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={reservation.transfers.arrival.executed || false}
                                onChange={async e => { 
                                  await updateTransfer(reservation.id, "arrival", { 
                                    executed: e.target.checked,
                                    executedAt: e.target.checked ? new Date().toISOString() : null
                                  }); 
                                  refresh();
                                }}
                                className="sr-only peer"
                              />
                              <div className="w-9 h-5 bg-white/10 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#53945a]"></div>
                            </label>
                          </div>

                          {/* Driver WhatsApp buttons + confirm links — see SHOW_DRIVER_WHATSAPP */}
                          {SHOW_DRIVER_WHATSAPP && (<>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <a
                                href={`https://wa.me/261326801412?text=${encodeURIComponent(
                                  `PRIHOD:\n` +
                                  `Datum: ${reservation.transfers.arrival.pickupDate || reservation.arrival}\n` +
                                  `Let: ${reservation.transfers.arrival.flightNumber || '?'} ob ${reservation.transfers.arrival.flightTime || '?'}\n` +
                                  `Coln v Portu: ${reservation.transfers.arrival.boatPortTime || '?'}\n` +
                                  `Coln: ${dbBoats.find((b: {id: string}) => b.id === reservation.transfers.arrival.boatId)?.name || '?'}\n` +
                                  `Pax: ${reservation.pax}\n` +
                                  `Gost: ${reservation.guestName}`
                                )}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center gap-1 w-full rounded-lg bg-[#25D366]/20 border border-[#25D366]/30 px-2 py-2 text-xs text-[#25D366] hover:bg-[#25D366]/30"
                              >
                                <Ship className="h-3 w-3" />
                                Dilip
                              </a>
                              {reservation.transfers.arrival.dilipOrderedAt && (
                                <p className="text-[9px] text-green-400 text-center mt-1">
                                  {new Date(reservation.transfers.arrival.dilipOrderedAt).toLocaleDateString('sl-SI')}
                                </p>
                              )}
                            </div>
                            <div>
                              <a
                                href={`https://wa.me/261326801412?text=${encodeURIComponent(
                                  `TAXI PRIHOD:\n` +
                                  `Datum: ${reservation.transfers.arrival.pickupDate || reservation.arrival}\n` +
                                  `Let: ${reservation.transfers.arrival.flightNumber || '?'} ob ${reservation.transfers.arrival.flightTime || '?'}\n` +
                                  `Taxi ob: ${reservation.transfers.arrival.hermanAirportTime || '?'}\n` +
                                  `Pax: ${reservation.pax}\n` +
                                  `Gost: ${reservation.guestName}`
                                )}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center gap-1 w-full rounded-lg bg-[#25D366]/20 border border-[#25D366]/30 px-2 py-2 text-xs text-[#25D366] hover:bg-[#25D366]/30"
                              >
                                <Car className="h-3 w-3" />
                                Herman
                              </a>
                              {reservation.transfers.arrival.hermanOrderedAt && (
                                <p className="text-[9px] text-green-400 text-center mt-1">
                                  {new Date(reservation.transfers.arrival.hermanOrderedAt).toLocaleDateString('sl-SI')}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={async () => { await updateTransfer(reservation.id, "arrival", { dilipOrderedAt: new Date().toISOString() }); refresh(); }}
                              className="text-[9px] text-white/40 hover:text-white/60 underline"
                            >
                              Potrdi Dilipa
                            </button>
                            <button
                              onClick={async () => { await updateTransfer(reservation.id, "arrival", { hermanOrderedAt: new Date().toISOString() }); refresh(); }}
                              className="text-[9px] text-white/40 hover:text-white/60 underline"
                            >
                              Potrdi Hermana
                            </button>
                          </div>
                          </>)}
                          
                          {/* Voucher Buttons */}
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={async () => {
                                const vw = window.open('', '_blank', 'width=550,height=850,scrollbars=yes');
                                if (!vw) return;
                                vw.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Transfer Voucher</title></head><body style="margin:0;background:#0a2029;color:#c59b5b;font-family:Arial;display:flex;align-items:center;justify-content:center;height:100vh;">Pripravljam vaucer...</body></html>');
                                vw.document.close();
                                try {
                                  const { getTransferVoucherEmailPreview } = await import("@/app/actions/transfer-voucher-email");
                                  const res = await getTransferVoucherEmailPreview(reservation.id, "arrival");
                                  if (res.html) {
                                    vw.document.open();
                                    vw.document.write(res.html);
                                    vw.document.close();
                                    vw.focus();
                                    setTimeout(() => { vw.print(); }, 600);
                                  } else {
                                    vw.close();
                                    showMsg(res.error || "Vaucerja ni bilo mogoce pripraviti.");
                                  }
                                } catch {
                                  vw.close();
                                  showMsg("Napaka pri pripravi vaucerja.");
                                }
                              }}
                              className="flex items-center justify-center gap-1 flex-1 rounded-lg bg-[#c59b5b]/20 border border-[#c59b5b]/30 px-2 py-1.5 text-xs text-[#c59b5b] hover:bg-[#c59b5b]/30"
                            >
                              <Printer className="h-3 w-3" />
                              Natisni
                            </button>
                            <button
                              onClick={() => {
                                const url = `${window.location.origin}/voucher/transfer/${reservation.id}/arrival`;
                                const textarea = document.createElement('textarea');
                                textarea.value = url;
                                textarea.style.position = 'fixed';
                                textarea.style.opacity = '0';
                                document.body.appendChild(textarea);
                                textarea.select();
                                document.execCommand('copy');
                                document.body.removeChild(textarea);
                                alert('Komba Cabana transfer voucher link kopiran!');
                              }}
                              className="flex items-center justify-center gap-1 flex-1 rounded-lg bg-[#7fa8b8]/20 border border-[#7fa8b8]/30 px-2 py-1.5 text-xs text-[#7fa8b8] hover:bg-[#7fa8b8]/30"
                            >
                              <ExternalLink className="h-3 w-3" />
                              Kopiraj Link
                            </button>
                          </div>
                          <button
                            onClick={async () => {
                              const to = (reservation.email || "").trim();
                              if (!to) { showMsg("Gost nima vpisanega email naslova. Najprej ga vnesite."); return; }
                              setLoadingVoucherPreview("arrival");
                              try {
                                const { getTransferVoucherEmailPreview } = await import("@/app/actions/transfer-voucher-email");
                                const result = await getTransferVoucherEmailPreview(reservation.id, "arrival");
                                if (result.html) setVoucherPreview({ html: result.html, to: result.to || to, type: "arrival" });
                                else showMsg(result.error || "Predogleda ni bilo mogoče pripraviti.");
                              } catch { showMsg("Napaka pri pripravi predogleda. Poskusite znova."); }
                              finally { setLoadingVoucherPreview(null); }
                            }}
                            disabled={loadingVoucherPreview !== null || emailingVoucher}
                            className="mt-2 w-full flex items-center justify-center gap-1.5 rounded-lg bg-[#53945a]/15 border border-[#53945a]/30 px-2 py-2 text-xs font-medium text-[#53945a] hover:bg-[#53945a]/25 transition-all disabled:opacity-50"
                          >
                            <Mail className="h-3.5 w-3.5" />
                            {loadingVoucherPreview === "arrival" ? "Pripravljam predogled..." : "Pošlji vaučer gostu"}
                          </button>
                          {!reservation.transfers?.arrival?.boatPortTime && (
                            <button
                              onClick={async () => {
                                setLoadingPortTime(true);
                                try {
                                  const { getPortTimeEmailPreview } = await import("@/app/actions/port-time-email");
                                  const result = await getPortTimeEmailPreview(reservation.id);
                                  if (result.html) setPortTimePreview({ html: result.html, to: result.to || "", isAgency: !!result.isAgency });
                                  else showMsg(result.error || "Predogleda ni bilo mogoče pripraviti.");
                                } catch { showMsg("Napaka pri pripravi predogleda. Poskusite znova."); }
                                finally { setLoadingPortTime(false); }
                              }}
                              disabled={loadingPortTime || sendingPortTime}
                              className="mt-2 w-full flex items-center justify-center gap-1.5 rounded-lg bg-[#c5873b]/15 border border-[#c5873b]/30 px-2 py-2 text-xs font-medium text-[#c5873b] hover:bg-[#c5873b]/25 transition-all disabled:opacity-50"
                            >
                              <Mail className="h-3.5 w-3.5" />
                              {loadingPortTime ? "Pripravljam predogled..." : "Vprašaj za uro v portu"}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  
                  {/* Departure Transfer */}
                  <div className="p-3 rounded-xl border border-[#c8846b]/20 bg-[#c8846b]/5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <LogIn className="h-4 w-4 text-[#c8846b] rotate-180" />
                        <span className="text-sm font-medium text-[#c8846b]">Odhod</span>
                        <span className="text-xs text-white/40">({reservation.departure})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {reservation.transfers?.departure?.route && (
                          <>
                            <button
                              onClick={async () => {
                                if (confirm('Ali res želiš izbrisati ta transfer?')) {
                                  await deleteTransfer(reservation.id, 'departure');
                                  refresh();
                                }
                              }}
                              className="text-xs text-red-400 hover:text-red-300"
                            >
                              Izbriši
                            </button>
                            <LuxuryBadge variant={reservation.transfers.departure.paymentStatus === 'PREPAID' ? 'petrol' : reservation.transfers.departure.paymentStatus === 'PAID' ? 'ocean' : 'danger'}>
                              {reservation.transfers.departure.paymentStatus === 'PREPAID' ? 'Vkljuceno' : reservation.transfers.departure.paymentStatus === 'PAID' ? 'Placano' : 'Za placilo'}
                            </LuxuryBadge>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="space-y-3">
                      {/* Guest arranges this leg — no boat owed, and nothing pending. */}
                      {(() => {
                        const own = (reservation as { ownDepartureTransfer?: boolean }).ownDepartureTransfer || false;
                        return (
                          <button
                            type="button"
                            aria-pressed={own}
                            onClick={() => handleUpdateReservation(reservation.id, { ownDepartureTransfer: !own })}
                            title="Gost odhod organizira sam — na kartici bungalova se izpiše namesto ladjice"
                            className={`flex w-full cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-xs transition-colors ${
                              own
                                ? "border-[#c8846b]/45 bg-[#c8846b]/15 text-[#dda58c]"
                                : "border-white/10 bg-white/5 text-white/50 hover:bg-white/[0.08]"
                            }`}
                          >
                            <span
                              className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${
                                own ? "border-[#c8846b] bg-[#c8846b]" : "border-white/25"
                              }`}
                            >
                              {own && <Check className="h-3 w-3 text-[#0a2029]" />}
                            </span>
                            Gost prevoz organizira sam
                          </button>
                        );
                      })()}
                      <div>
                        <label className="block text-xs text-white/40 mb-1">Relacija</label>
                        <select
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-[#c8846b]/50 focus:outline-none [&>option]:bg-[#0f2e3a] [&>option]:text-white"
                          value={reservation.transfers?.departure?.route || ''}
                          onChange={async e => {
                            const route = e.target.value;
                            // Price will be calculated when boat is selected
                            await updateTransfer(reservation.id, 'departure', { route, guestPrice: 0, date: reservation.departure });
                            refresh();
                          }}
                        >
                          <option value="">-- Ni transferja --</option>
                          {dbRoutes.map((r: { id: string; name: string }) => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                          ))}
                        </select>
                      </div>
                      {reservation.transfers?.departure?.route && (
                        <>
                          {/* Departure Time */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <TransferTextField
                              label="Odhod iz Kombe"
                              placeholder="08:00"
                              value={reservation.transfers?.departure?.time || ''}
                              onSave={async v => { await updateTransfer(reservation.id, "departure", { time: v }); refresh(); }}
                            />
                            <div>
                              <label className="block text-xs text-white/40 mb-1">Datum</label>
                              <input 
                                type="date"
                                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-[#c8846b]/50 focus:outline-none"
                                defaultValue={reservation.transfers?.departure?.pickupDate || reservation.departure}
                                onBlur={async e => { await updateTransfer(reservation.id, "departure", { pickupDate: e.target.value }); }}
                              />
                            </div>
                          </div>

                          {/* Price and Payment */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs text-white/40 mb-1">Cena (EUR)</label>
                              <input
                                key={`dep-price-${reservation.transfers.departure.guestPrice}`}
                                type="number"
                                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-[#c8846b]/50 focus:outline-none"
                                defaultValue={reservation.transfers.departure.guestPrice || 0}
                                onBlur={async e => { await updateTransfer(reservation.id, "departure", { guestPrice: Number(e.target.value) }); }}
                              />
                            </div>
                            <LuxurySelect 
                              label="Status placila" 
                              value={reservation.transfers.departure.paymentStatus || 'UNPAID'} 
                              onChange={async v => { await updateTransfer(reservation.id, "departure", { paymentStatus: v }); refresh(); }} 
                              options={[
                                { value: 'PREPAID', label: 'Vkljuceno' },
                                { value: 'PAID', label: 'Placano' },
                                { value: 'UNPAID', label: 'Za placilo' },
                              ]} 
                            />
                          </div>
                          {reservation.transfers.departure.paymentStatus === 'PAID' && (
                            <div className="grid grid-cols-2 gap-3 rounded-xl border border-[#8fae92]/20 bg-[#8fae92]/[0.04] p-3">
                              <LuxurySelect
                                label="Nacin placila"
                                value={reservation.transfers.departure.paidMethod || 'cash'}
                                onChange={async v => { await updateTransfer(reservation.id, "departure", { paidMethod: v }); refresh(); }}
                                options={[
                                  { value: 'cash', label: 'Gotovina' },
                                  { value: 'card', label: 'Kartica' },
                                  { value: 'transfer', label: 'Bancno nakazilo' },
                                ]}
                              />
                              <div>
                                <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">Datum placila</label>
                                <input
                                  type="date"
                                  className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white focus:border-[#7fa8b8]/40 focus:outline-none"
                                  defaultValue={reservation.transfers.departure.paidDate || today()}
                                  onBlur={async e => { await updateTransfer(reservation.id, "departure", { paidDate: e.target.value }); refresh(); }}
                                />
                              </div>
                            </div>
                          )}

                          {/* Boat Selection */}
                          <div>
                            <label className="block text-xs text-white/40 mb-1">Coln</label>
                            <select 
                              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-[#c8846b]/50 focus:outline-none [&>option]:bg-[#0f2e3a] [&>option]:text-white"
                              value={reservation.transfers.departure.boatId || ''}
                              onChange={async e => { 
                                const boatId = e.target.value; 
                                const price = getTransferGuestPrice(reservation.transfers.departure.route, boatId, reservation.pax) + getHermanGuestPrice(reservation.transfers.departure.hermanRouteId, reservation.pax); 
                                await updateTransfer(reservation.id, "departure", { boatId, guestPrice: price }); 
                                refresh();
                              }}
                            >
                              <option value="">-- Izberi coln --</option>
                              {dbBoats.map((b: { id: string; name: string; engine: string; maxPax: number }) => <option key={b.id} value={b.id}>{b.name} ({b.engine})</option>)}
                            </select>
                          </div>

                          {/* Port & Herman Times */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <TransferTextField
                              label="Coln v Portu"
                              placeholder="09:00"
                              value={reservation.transfers?.departure?.boatPortTime || ''}
                              onSave={async v => { await updateTransfer(reservation.id, "departure", { boatPortTime: v }); refresh(); }}
                            />
                            <TransferTextField
                              label="Herman na destinaciji"
                              placeholder="14:30"
                              value={reservation.transfers?.departure?.hermanAirportTime || ''}
                              onSave={async v => { await updateTransfer(reservation.id, "departure", { hermanAirportTime: v }); refresh(); }}
                            />
                          </div>

                          {/* Taxi route (avto do Porta) + carrier costs */}
                          <div>
                            {taxiBoats.length > 1 && (
                              <div className="mb-2">
                                <label className="block text-xs text-white/40 mb-1">Taksist (avto)</label>
                                <select
                                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-[#53945a]/50 focus:outline-none [&>option]:bg-[#0f2e3a] [&>option]:text-white"
                                  value={taxiIdOf(reservation.transfers?.departure)}
                                  onChange={async e => {
                                    await updateTransfer(reservation.id, "departure", { taxiBoatId: e.target.value });
                                    refresh();
                                  }}
                                >
                                  {taxiBoats.map((b: { id: string; name: string }) => {
                                    const rid = reservation.transfers?.departure?.hermanRouteId;
                                    const costAr = rid ? getSupplierCostAr(b.id, rid) : 0;
                                    return <option key={b.id} value={b.id}>{b.name}{rid ? ` (${ar(costAr)})` : ''}</option>;
                                  })}
                                </select>
                              </div>
                            )}
                            <label className="block text-xs text-white/40 mb-1">Relacija avta (taksi)</label>
                            <select
                              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-[#53945a]/50 focus:outline-none [&>option]:bg-[#0f2e3a] [&>option]:text-white"
                              value={reservation.transfers?.departure?.hermanRouteId || ''}
                              onChange={async e => {
                                const hermanRouteId = e.target.value;
                                const price = getTransferGuestPrice(reservation.transfers.departure.route, reservation.transfers?.departure?.boatId || '', reservation.pax) + getHermanGuestPrice(hermanRouteId, reservation.pax, taxiIdOf(reservation.transfers?.departure));
                                await updateTransfer(reservation.id, "departure", { hermanRouteId, guestPrice: price });
                                refresh();
                              }}
                            >
                              <option value="">-- Brez avta (taksi) --</option>
                              {taxiRoutesFor(taxiIdOf(reservation.transfers?.departure)).map((r: { id: string; name: string }) => (
                                <option key={r.id} value={r.id}>{r.name} ({ar(getSupplierCostAr(taxiIdOf(reservation.transfers?.departure), r.id))})</option>
                              ))}
                            </select>
                            {(() => {
                              const taxiId = taxiIdOf(reservation.transfers?.departure);
                              const taxiName = taxiNameOf(taxiId);
                              const dilipCostAr = getSupplierCostAr(reservation.transfers?.departure?.boatId, reservation.transfers?.departure?.route);
                              const hermanCostAr = getSupplierCostAr(taxiId, reservation.transfers?.departure?.hermanRouteId);
                              const hermanGuestEur = getHermanGuestPrice(reservation.transfers?.departure?.hermanRouteId, reservation.pax);
                              const hermanRouteName = dbRoutes.find((rt: { id: string; name: string }) => rt.id === reservation.transfers?.departure?.hermanRouteId)?.name || 'avto';
                              if (dilipCostAr <= 0 && hermanCostAr <= 0) return null;
                              // With the cost panel hidden there is nothing left in this block
                              // unless the guest price applies — bail out so no empty gap remains.
                              if (!SHOW_SUPPLIER_COST_IN_TRANSFER && hermanGuestEur <= 0) return null;
                              return (
                                <div className="mt-2 space-y-1.5">
                                  {/* Supplier cost — see SHOW_SUPPLIER_COST_IN_TRANSFER */}
                                  {SHOW_SUPPLIER_COST_IN_TRANSFER && (
                                  <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2">
                                    <p className="text-[11px] font-semibold text-amber-300">Za plačilo prevoznikoma (strošek):</p>
                                    <div className="flex flex-wrap gap-x-4 text-xs text-amber-200/90">
                                      {dilipCostAr > 0 && <span>Dilip (čoln): {ar(dilipCostAr)}</span>}
                                      {hermanCostAr > 0 && <span>{taxiName}: {ar(hermanCostAr)}</span>}
                                    </div>
                                    {hermanCostAr > 0 && (
                                      <p className="mt-1 text-[11px] font-semibold text-[#8fae92]">Pokliči tudi {taxiName} ({hermanRouteName})</p>
                                    )}
                                  </div>
                                  )}
                                  {hermanGuestEur > 0 && (
                                    <p className="text-[11px] text-[#53945a]/90">Prodajna cena gostu (Herman): {eur(hermanGuestEur)} — vključena v skupno Ceno (EUR)</p>
                                  )}
                                </div>
                              );
                            })()}
                          </div>

                          {/* Notes */}
                          <TransferTextField
                            label="Opombe"
                            placeholder="npr. let ob 15:30..."
                            value={reservation.transfers?.departure?.notes || ''}
                            onSave={async v => { await updateTransfer(reservation.id, "departure", { notes: v }); refresh(); }}
                          />

                          {/* Executed */}
                          <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-2">
                            <span className="text-xs text-white">Izveden</span>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={reservation.transfers.departure.executed || false}
                                onChange={async e => { 
                                  await updateTransfer(reservation.id, "departure", { 
                                    executed: e.target.checked,
                                    executedAt: e.target.checked ? new Date().toISOString() : null
                                  }); 
                                  refresh();
                                }}
                                className="sr-only peer"
                              />
                              <div className="w-9 h-5 bg-white/10 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#c8846b]"></div>
                            </label>
                          </div>

                          {/* Driver WhatsApp buttons + confirm links — see SHOW_DRIVER_WHATSAPP */}
                          {SHOW_DRIVER_WHATSAPP && (<>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <a
                                href={`https://wa.me/261326801412?text=${encodeURIComponent(
                                  `ODHOD:\n` +
                                  `Datum: ${reservation.transfers.departure.pickupDate || reservation.departure}\n` +
                                  `Iz Kombe: ${reservation.transfers.departure.time || '?'}\n` +
                                  `Coln v Portu: ${reservation.transfers.departure.boatPortTime || '?'}\n` +
                                  `Coln: ${dbBoats.find((b: {id: string}) => b.id === reservation.transfers.departure.boatId)?.name || '?'}\n` +
                                  `Pax: ${reservation.pax}\n` +
                                  `Gost: ${reservation.guestName}`
                                )}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center gap-1 w-full rounded-lg bg-[#25D366]/20 border border-[#25D366]/30 px-2 py-2 text-xs text-[#25D366] hover:bg-[#25D366]/30"
                              >
                                <Ship className="h-3 w-3" />
                                Dilip
                              </a>
                              {reservation.transfers.departure.dilipOrderedAt && (
                                <p className="text-[9px] text-green-400 text-center mt-1">
                                  {new Date(reservation.transfers.departure.dilipOrderedAt).toLocaleDateString('sl-SI')}
                                </p>
                              )}
                            </div>
                            <div>
                              <a
                                href={`https://wa.me/261326801412?text=${encodeURIComponent(
                                  `TAXI ODHOD:\n` +
                                  `Datum: ${reservation.transfers.departure.pickupDate || reservation.departure}\n` +
                                  `Coln v Portu: ${reservation.transfers.departure.boatPortTime || '?'}\n` +
                                  `Taxi ob: ${reservation.transfers.departure.hermanAirportTime || '?'}\n` +
                                  `Pax: ${reservation.pax}\n` +
                                  `Gost: ${reservation.guestName}`
                                )}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center gap-1 w-full rounded-lg bg-[#25D366]/20 border border-[#25D366]/30 px-2 py-2 text-xs text-[#25D366] hover:bg-[#25D366]/30"
                              >
                                <Car className="h-3 w-3" />
                                Herman
                              </a>
                              {reservation.transfers.departure.hermanOrderedAt && (
                                <p className="text-[9px] text-green-400 text-center mt-1">
                                  {new Date(reservation.transfers.departure.hermanOrderedAt).toLocaleDateString('sl-SI')}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={async () => { await updateTransfer(reservation.id, "departure", { dilipOrderedAt: new Date().toISOString() }); refresh(); }}
                              className="text-[9px] text-white/40 hover:text-white/60 underline"
                            >
                              Potrdi Dilipa
                            </button>
                            <button
                              onClick={async () => { await updateTransfer(reservation.id, "departure", { hermanOrderedAt: new Date().toISOString() }); refresh(); }}
                              className="text-[9px] text-white/40 hover:text-white/60 underline"
                            >
                              Potrdi Hermana
                            </button>
                          </div>
                          </>)}
                          
                          {/* Voucher Buttons */}
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={async () => {
                                const vw = window.open('', '_blank', 'width=550,height=850,scrollbars=yes');
                                if (!vw) return;
                                vw.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Transfer Voucher</title></head><body style="margin:0;background:#0a2029;color:#c59b5b;font-family:Arial;display:flex;align-items:center;justify-content:center;height:100vh;">Pripravljam vaucer...</body></html>');
                                vw.document.close();
                                try {
                                  const { getTransferVoucherEmailPreview } = await import("@/app/actions/transfer-voucher-email");
                                  const res = await getTransferVoucherEmailPreview(reservation.id, "departure");
                                  if (res.html) {
                                    vw.document.open();
                                    vw.document.write(res.html);
                                    vw.document.close();
                                    vw.focus();
                                    setTimeout(() => { vw.print(); }, 600);
                                  } else {
                                    vw.close();
                                    showMsg(res.error || "Vaucerja ni bilo mogoce pripraviti.");
                                  }
                                } catch {
                                  vw.close();
                                  showMsg("Napaka pri pripravi vaucerja.");
                                }
                              }}
                              className="flex items-center justify-center gap-1 flex-1 rounded-lg bg-[#c59b5b]/20 border border-[#c59b5b]/30 px-2 py-1.5 text-xs text-[#c59b5b] hover:bg-[#c59b5b]/30"
                            >
                              <Printer className="h-3 w-3" />
                              Natisni
                            </button>
                            <button
                              onClick={() => {
                                const url = `${window.location.origin}/voucher/transfer/${reservation.id}/departure`;
                                const textarea = document.createElement('textarea');
                                textarea.value = url;
                                textarea.style.position = 'fixed';
                                textarea.style.opacity = '0';
                                document.body.appendChild(textarea);
                                textarea.select();
                                document.execCommand('copy');
                                document.body.removeChild(textarea);
                                alert('Komba Cabana transfer voucher link kopiran!');
                              }}
                              className="flex items-center justify-center gap-1 flex-1 rounded-lg bg-[#7fa8b8]/20 border border-[#7fa8b8]/30 px-2 py-1.5 text-xs text-[#7fa8b8] hover:bg-[#7fa8b8]/30"
                            >
                              <ExternalLink className="h-3 w-3" />
                              Kopiraj Link
                            </button>
                          </div>
                          <button
                            onClick={async () => {
                              const to = (reservation.email || "").trim();
                              if (!to) { showMsg("Gost nima vpisanega email naslova. Najprej ga vnesite."); return; }
                              setLoadingVoucherPreview("departure");
                              try {
                                const { getTransferVoucherEmailPreview } = await import("@/app/actions/transfer-voucher-email");
                                const result = await getTransferVoucherEmailPreview(reservation.id, "departure");
                                if (result.html) setVoucherPreview({ html: result.html, to: result.to || to, type: "departure" });
                                else showMsg(result.error || "Predogleda ni bilo mogoče pripraviti.");
                              } catch { showMsg("Napaka pri pripravi predogleda. Poskusite znova."); }
                              finally { setLoadingVoucherPreview(null); }
                            }}
                            disabled={loadingVoucherPreview !== null || emailingVoucher}
                            className="mt-2 w-full flex items-center justify-center gap-1.5 rounded-lg bg-[#53945a]/15 border border-[#53945a]/30 px-2 py-2 text-xs font-medium text-[#53945a] hover:bg-[#53945a]/25 transition-all disabled:opacity-50"
                          >
                            <Mail className="h-3.5 w-3.5" />
                            {loadingVoucherPreview === "departure" ? "Pripravljam predogled..." : "Pošlji vaučer gostu"}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Status izbirnik SKRIT na željo uporabnice — preklic naredi z brisanjem rezervacije spodaj. Za vrnitev odkomentiraj naslednjo vrstico. */}
            {/* <LuxurySelect label="Status" value={reservation.status} onChange={v => handleUpdateReservation(reservation.id, { status: v })} options={STATUSES} /> */}

            {/* Penzion / prehrana — zložljivo */}
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.01]">
              <button
                type="button"
                onClick={() => setShowMealPlan(!showMealPlan)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm text-white hover:bg-white/[0.02] transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Utensils className="h-4 w-4 flex-shrink-0 text-[#7fa8b8]" />
                  <span className="text-xs font-medium uppercase tracking-wider text-white/60">Penzion</span>
                  {reservation.mealPlan && (
                    <span className="rounded-md bg-[#8fae92]/20 px-1.5 py-0.5 text-[10px] font-semibold text-[#8fae92]">{reservation.mealPlan}</span>
                  )}
                  {reservation.mealPlanSnack && (
                    <span className="rounded-md bg-[#c59b5b]/20 px-1.5 py-0.5 text-[10px] font-semibold text-[#c59b5b]">Snack</span>
                  )}
                </span>
                <ChevronDown className={`h-4 w-4 flex-shrink-0 text-white/40 transition-transform ${showMealPlan ? "rotate-180" : ""}`} />
              </button>
              {showMealPlan && (
                <div className="px-3 pb-3">
              <div className="flex gap-2">
                {[
                  { value: "B", label: "B" },
                  { value: "HB", label: "HB" },
                  { value: "FB", label: "FB" }
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleUpdateReservation(reservation.id, { mealPlan: reservation.mealPlan === opt.value ? "" : opt.value })}
                    className={`flex-1 rounded-xl border py-3 px-4 text-sm font-medium transition-all ${
                      reservation.mealPlan === opt.value
                        ? "border-[#8fae92] bg-[#8fae92]/20 text-[#8fae92]"
                        : "border-white/10 bg-white/5 text-white/60 hover:border-white/20 hover:bg-white/10"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Snack — naročen poleg penziona, da kuhinja ve (npr. pol penzion + snack) */}
              <button
                type="button"
                onClick={() => handleUpdateReservation(reservation.id, { mealPlanSnack: !reservation.mealPlanSnack })}
                aria-pressed={!!reservation.mealPlanSnack}
                className={`mt-2 flex w-full cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
                  reservation.mealPlanSnack
                    ? "border-[#c59b5b] bg-[#c59b5b]/15 text-[#e8c88a]"
                    : "border-white/10 bg-white/5 text-white/60 hover:border-white/20 hover:bg-white/10"
                }`}
              >
                <Cookie className="h-4 w-4 flex-shrink-0" />
                <span className="flex-1 text-sm font-medium">Snack</span>
                <span className="text-[10px] uppercase tracking-[0.16em]">
                  {reservation.mealPlanSnack ? "Naročen" : "Ni naročen"}
                </span>
              </button>

              {/* Meal Plan Price and Payment Status */}
              {reservation.mealPlan && (
                <div className="mt-3 p-3 rounded-xl border border-[#8fae92]/20 bg-[#8fae92]/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-white/40">Cena na dan / osebo</p>
                      <p className="text-sm font-medium text-[#8fae92]">{eur(getMealPlanPrice(reservation.mealPlan))}</p>
                    </div>
                    <div className="text-right">
                      {(() => {
                        const bands = [reservation.guestBand, reservation.secondGuestBand, reservation.thirdGuestBand, reservation.fourthGuestBand];
                        // Board may cover only part of the party; empty means everyone.
                        const covered = boardPax(reservation.pax || 0, reservation.mealPlanPax);
                        const units = mealPayUnitsFromBands(covered, bands);
                        const { children } = countByBand(covered, bands);
                        const hasKids = totalChildren(children) > 0;
                        const nights = (() => {
                          const arr = reservation.arrival ? new Date(reservation.arrival) : null;
                          const dep = reservation.departure ? new Date(reservation.departure) : null;
                          return arr && dep ? Math.ceil((dep.getTime() - arr.getTime()) / (1000 * 60 * 60 * 24)) : 0;
                        })();
                        const unitsLabel = Number.isInteger(units) ? String(units) : units.toFixed(2).replace('.', ',');
                        return (
                          <>
                            <p className="text-xs text-white/40">{hasKids ? `${unitsLabel} enot (otr. popust)` : paxLabel(covered)} × {nights} dni</p>
                            <p className="text-lg font-bold text-[#8fae92]">{eur(getMealPlanPrice(reservation.mealPlan) * units * nights)}</p>
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Za koliko oseb velja penzion. Shown only when there is more than one
                      guest, since with a single guest the question cannot arise. */}
                  {(reservation.pax || 0) > 1 && (
                    <div>
                      <p className="mb-2 text-xs text-white/40">Penzion velja za</p>
                      <div className="flex gap-2">
                        {Array.from({ length: reservation.pax || 0 }, (_, i) => i + 1).map(n => {
                          const active = (reservation.mealPlanPax ?? (reservation.pax || 0)) === n;
                          return (
                            <button
                              key={n}
                              type="button"
                              onClick={() => handleUpdateReservation(reservation.id, {
                                // Storing "all of them" as null keeps the meaning of an
                                // untouched booking identical to a deliberate "everyone".
                                mealPlanPax: n === (reservation.pax || 0) ? null : n,
                              })}
                              aria-pressed={active}
                              className={`min-h-11 flex-1 cursor-pointer rounded-lg border px-2 text-xs font-medium transition-all ${
                                active
                                  ? "border-[#8fae92] bg-[#8fae92]/20 text-[#8fae92]"
                                  : "border-white/10 bg-white/5 text-white/40 hover:border-white/20"
                              }`}
                            >
                              {n === (reservation.pax || 0) ? `vse (${n})` : `${n} os.`}
                            </button>
                          );
                        })}
                      </div>
                      {reservation.mealPlanPax != null && reservation.mealPlanPax < (reservation.pax || 0) && (
                        <p className="mt-2 text-[11px] leading-relaxed text-white/35">
                          Ostali gostje plačajo obroke posamično — dodaj jih med postavke ali prek bara.
                        </p>
                      )}
                    </div>
                  )}
                  <div className="flex gap-2">
                    {[
                      { value: 'PAID', label: 'Placano', color: 'ocean' },
                      { value: 'UNPAID', label: 'Za placilo', color: 'danger' }
                    ].map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => handleUpdateReservation(reservation.id, { mealPlanPaymentStatus: opt.value })}
                        className={`flex-1 rounded-lg border py-2 px-2 text-xs font-medium transition-all ${
                          (reservation.mealPlanPaymentStatus || 'UNPAID') === opt.value
                            ? opt.value === 'PAID' ? "border-[#7fa8b8] bg-[#7fa8b8]/20 text-[#7fa8b8]"
                              : "border-[#c8846b] bg-[#c8846b]/20 text-[#c8846b]"
                            : "border-white/10 bg-white/5 text-white/40 hover:border-white/20"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
                </div>
              )}
            </div>
            
            {/* Cena nočitev in plačila — zložljivo */}
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.01]">
              <button
                type="button"
                onClick={() => setShowPayment(!showPayment)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm text-white hover:bg-white/[0.02] transition-colors"
              >
                <span className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 flex-shrink-0 text-[#7fa8b8]" />
                  <span className="text-xs font-medium uppercase tracking-wider text-white/60">Cena nočitev in plačila</span>
                </span>
                <ChevronDown className={`h-4 w-4 flex-shrink-0 text-white/40 transition-transform ${showPayment ? "rotate-180" : ""}`} />
              </button>
              {showPayment && (
                <div className="space-y-4 px-3 pb-3">
            {/* Cena nocitev - nad placili */}
            <div className="p-4 rounded-xl border border-[#7fa8b8]/20 bg-[#7fa8b8]/5">
              <label className="mb-3 block text-[11px] font-medium uppercase tracking-wider text-white/40">Cena nocitev (EUR)</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-white/40 mb-1">Skupaj</label>
                  <input
                    key={`total-${reservation.id}`}
                    type="text"
                    inputMode="decimal"
                    className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white focus:border-[#7fa8b8]/40 focus:outline-none"
                    defaultValue={reservation.totalAmount || ""}
                    placeholder="0.00"
                    onBlur={async e => { 
                      const val = e.target.value.replace(',', '.');
                      await handleUpdateReservation(reservation.id, { totalAmount: val ? Number(val) : null }); 
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/40 mb-1">Placano</label>
                  <input
                    key={`paid-${reservation.id}`}
                    type="text"
                    inputMode="decimal"
                    className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white focus:border-[#7fa8b8]/40 focus:outline-none"
                    defaultValue={reservation.amountPaid || ""}
                    placeholder="0.00"
                    onBlur={async e => { 
                      const val = e.target.value.replace(',', '.');
                      await handleUpdateReservation(reservation.id, { amountPaid: val ? Number(val) : null }); 
                    }}
                  />
                </div>
              </div>
              {reservation.totalAmount && reservation.totalAmount > 0 && (
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-white/40">Ostalo za placilo:</span>
                  <span className={`font-bold ${(reservation.totalAmount - (reservation.amountPaid || 0)) > 0 ? 'text-[#c8846b]' : 'text-[#53945a]'}`}>
                    {eur((reservation.totalAmount || 0) - (reservation.amountPaid || 0))}
                  </span>
                </div>
              )}
              {/* Booking source / agency — editable for existing reservations */}
              <div className="mt-3 pt-3 border-t border-white/10 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-xs text-white/40">Vir rezervacije</label>
                  <select
                    key={`source-${reservation.id}`}
                    className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-sm text-white focus:border-[#c59b5b]/40 focus:outline-none cursor-pointer"
                    value={reservation.bookingSource || "Direct"}
                    onChange={async e => { await handleUpdateReservation(reservation.id, { bookingSource: e.target.value }); }}
                  >
                    {BOOKING_SOURCES.map(src => (
                      <option key={src} value={src} className="bg-[#0a2029] text-white">{src}</option>
                    ))}
                  </select>
                </div>

                {/* Agency name — shown when the source is an agency */}
                {reservation.bookingSource === 'Agency' && (
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-xs text-white/40">Ime agencije</label>
                    <input
                      key={`agency-name-${reservation.id}`}
                      type="text"
                      className="w-40 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-sm text-right text-white focus:border-[#c59b5b]/40 focus:outline-none"
                      defaultValue={reservation.agencyName || ""}
                      placeholder="Ime agencije"
                      onBlur={async e => { await handleUpdateReservation(reservation.id, { agencyName: e.target.value }); }}
                    />
                  </div>
                )}

                {/* Commission - show for Agency, Booking.com, Airbnb */}
                {(reservation.bookingSource === 'Agency' || reservation.bookingSource === 'Booking.com' || reservation.bookingSource === 'Airbnb') && (
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-xs text-white/40">Provizija (EUR)</label>
                    <input
                      key={`commission-${reservation.id}`}
                      type="text"
                      inputMode="decimal"
                      className="w-24 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-sm text-right text-[#c59b5b] focus:border-[#c59b5b]/40 focus:outline-none"
                      defaultValue={reservation.agencyCommission || ""}
                      placeholder="0.00"
                      onBlur={async e => { 
                        const val = e.target.value.replace(',', '.');
                        await handleUpdateReservation(reservation.id, { agencyCommission: val ? Number(val) : 0 }); 
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          
  {/* Payment Section */}
  <PaymentSection
    reservationId={reservation.id}
    totalAmount={reservation.totalAmount || '0'}
    currency={reservation.currency || 'EUR'}
    onPaymentChange={refresh}
  />
                </div>
              )}
            </div>

            {/* Opombe in korespondenca — zložljivo */}
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.01]">
              <button
                type="button"
                onClick={() => setShowNotesMenu(!showNotesMenu)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm text-white hover:bg-white/[0.02] transition-colors"
              >
                <span className="flex items-center gap-2">
                  <StickyNote className="h-4 w-4 flex-shrink-0 text-[#7fa8b8]" />
                  <span className="text-xs font-medium uppercase tracking-wider text-white/60">Opombe in korespondenca</span>
                </span>
                <ChevronDown className={`h-4 w-4 flex-shrink-0 text-white/40 transition-transform ${showNotesMenu ? "rotate-180" : ""}`} />
              </button>
              {showNotesMenu && (
                <div className="space-y-4 px-3 pb-3">
            <NotesSection 
              notes={reservation.notes || ""} 
              showNoteOnCard={reservation.showNoteOnCard !== false}
              onAddNote={(note) => {
                const timestamp = new Date().toLocaleDateString('sl-SI') + ' ' + new Date().toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' });
                const newNote = `[${timestamp}] ${note}`;
                const updatedNotes = reservation.notes ? `${newNote}\n---\n${reservation.notes}` : newNote;
                handleUpdateReservation(reservation.id, { notes: updatedNotes });
              }} 
              onUpdateNotes={(updatedNotes) => {
                handleUpdateReservation(reservation.id, { notes: updatedNotes });
              }}
              onToggleShowOnCard={(show) => {
                handleUpdateReservation(reservation.id, { showNoteOnCard: show });
              }}
            />

            {/* Posnetki zaslona sporočil (npr. korespondenca iz Bentrala) */}
            <div className="border-t border-white/[0.06] pt-4">
              <MessageShotsBox reservationId={reservation.id} />
            </div>

            {/* Gmail Section */}
            <GmailSection 
              guestName={reservation.guestName}
              guestEmail={reservation.email}
            />
                </div>
              )}
            </div>
          </div>
          
          {/* Collapsible Excursions Section */}
          <div className="mt-4 pt-4 border-t border-white/10">
            <button
              onClick={() => setShowExcursions(!showExcursions)}
              className="w-full flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-sm text-white hover:bg-white/[0.04] transition-colors"
            >
              <span className="flex items-center gap-2 min-w-0">
                <Truck className="h-4 w-4 flex-shrink-0 text-[#7fa8b8]" />
                <span className="truncate text-xs sm:text-sm">
                  <span className="text-white/60">Izleti: </span>
                  <span className="font-medium">{reservation.excursions?.length || 0} rezerviranih</span>
                </span>
              </span>
              <ChevronDown className={`h-4 w-4 flex-shrink-0 text-white/40 transition-transform ${showExcursions ? 'rotate-180' : ''}`} />
            </button>
            
            {showExcursions && (
              <div className="mt-2 space-y-2">
                <div className="flex justify-end">
                  <button
                    onClick={async () => {
                      if (dbExcursions.length > 0) {
                        await addExcursionBooking(reservation.id, { 
                          excursionId: dbExcursions[0].id, 
                          pax: reservation.pax 
                        });
                        refresh();
                      }
                    }}
                    className="flex items-center gap-2 rounded-lg bg-[#7fa8b8]/20 border border-[#7fa8b8]/30 px-3 py-1.5 text-xs text-[#7fa8b8] hover:bg-[#7fa8b8]/30 transition-colors"
                  >
                    <Plus className="h-3 w-3" />
                    Dodaj izlet
                  </button>
                </div>
                
                {(!reservation.excursions || reservation.excursions.length === 0) ? (
                  <p className="text-white/40 text-sm">Ni rezerviranih izletov.</p>
                ) : (
                  <div className="space-y-2">
                    {reservation.excursions.map((exc, idx) => {
                      const excursionData = dbExcursions.find((e: { id: string; name: string; description?: string | null; imageUrl?: string | null }) => e.id === exc.excursionId);
                      const boatData = dbBoats.find((b: { id: string }) => b.id === exc.boatId);
                      const isExpanded = expandedExcursionId === exc.id;
                      return (
                        <div key={exc.id} className="rounded-xl border border-[#7fa8b8]/20 bg-[#7fa8b8]/5 overflow-hidden">
                          {/* Collapsed header - always visible */}
                          <button
                            onClick={() => setExpandedExcursionId(isExpanded ? null : exc.id)}
                            className="w-full flex items-center justify-between p-3 text-left hover:bg-white/[0.02] transition-colors"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-xs font-medium text-[#7fa8b8]">#{idx + 1}</span>
                              <span className={`text-sm truncate ${exc.status === 'CANCELLED' ? 'text-white/40 line-through' : 'text-white'}`}>{excursionData?.name || 'Izlet'}</span>
                              {exc.date && <span className="text-xs text-white/40">{exc.date}</span>}
                              {exc.status === 'CANCELLED' && (
                                <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">Cancelled · credit</span>
                              )}
                            </div>
                            <ChevronDown className={`h-4 w-4 flex-shrink-0 text-white/40 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          </button>
                          
                          {/* Expanded content */}
                          {isExpanded && (
                            <div className="px-3 pb-3 space-y-3 border-t border-white/10">
                              {/* Actions: cancel �� credit (for paid excursions) + delete */}
                              <div className="flex items-center justify-between gap-2 pt-2">
                                {exc.status === 'CANCELLED' ? (
                                  <div className="flex flex-col gap-1">
                                    <span className="text-[11px] text-amber-300">
                                      Cancelled{exc.cancelReason ? ` — ${exc.cancelReason}` : ''} · amount kept as credit (see invoice)
                                    </span>
                                    <button
                                      onClick={async () => {
                                        setReactivatingExc(true);
                                        const res = await reactivateExcursion(exc.id);
                                        setReactivatingExc(false);
                                        if (res && 'success' in res) {
                                          showMsg('Izlet obnovljen, dobroimetje odstranjeno.');
                                        }
                                        refresh();
                                      }}
                                      disabled={reactivatingExc}
                                      className="self-start text-[11px] font-medium text-[#8fae92] hover:text-[#a3c4a6] disabled:opacity-50"
                                    >
                                      {reactivatingExc ? 'Obnavljam…' : 'Obnovi izlet (gost gre vendarle)'}
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setCancelCreditFor(cancelCreditFor === exc.id ? null : exc.id)}
                                    className="text-[11px] font-medium text-amber-300 hover:text-amber-200"
                                  >
                                    Prekliči izlet → dobroimetje
                                  </button>
                                )}
                                <button
                                  onClick={async () => {
                                    // Brisanje je bilo prej "tiho" — ob napaki (npr. mrežna težava, zastarel
                                    // exc.id) se ni nič videlo in izlet je ostal v bazi ter v pending seznamu
                                    // pri Borutu. Zdaj try/catch + jasno sporočilo o uspehu/napaki.
                                    try {
                                      await deleteExcursionBooking(exc.id);
                                      showMsg("Izlet izbrisan.");
                                      refresh();
                                    } catch (err) {
                                      showMsg("Napaka pri brisanju izleta: " + (err instanceof Error ? err.message : "Neznana napaka"));
                                    }
                                  }}
                                  className="text-red-400 hover:text-red-300 text-xs"
                                >
                                  Odstrani
                                </button>
                              </div>

                              {/* Cancel → credit panel (uncontrolled inputs; values read on confirm) */}
                              {cancelCreditFor === exc.id && exc.status !== 'CANCELLED' && (
                                <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-3 space-y-2">
                                  <p className="text-[11px] text-amber-200/90 leading-relaxed">
                                    The excursion will be cancelled and removed from the ordering lists. The amount already paid becomes a credit for food, drinks and other services. Any unused credit is shown on the invoice.
                                  </p>
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <label className="block text-[10px] text-white/50 mb-1">Credit amount (EUR)</label>
                                      <input
                                        id={`credit-amt-${exc.id}`}
                                        type="number"
                                        step="0.01"
                                        defaultValue={(Number(exc.guestPrice || 0) + Number(exc.entranceFee || 0) + Number(exc.lunchPrice || 0)).toFixed(2)}
                                        className="w-full rounded-lg border border-white/15 bg-white/5 px-2 py-1.5 text-xs text-white focus:border-amber-400/50 focus:outline-none"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[10px] text-white/50 mb-1">Reason</label>
                                      <input
                                        id={`credit-reason-${exc.id}`}
                                        type="text"
                                        defaultValue="illness"
                                        placeholder="e.g. illness"
                                        className="w-full rounded-lg border border-white/15 bg-white/5 px-2 py-1.5 text-xs text-white placeholder:text-white/30 focus:border-amber-400/50 focus:outline-none"
                                      />
                                    </div>
                                  </div>
                                  <div className="flex justify-end gap-2">
                                    <button
                                      onClick={() => setCancelCreditFor(null)}
                                      disabled={cancellingCredit}
                                      className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/70 hover:bg-white/5 disabled:opacity-50"
                                    >
                                      Prekliči
                                    </button>
                                    <button
                                      onClick={async () => {
                                        const amtEl = document.getElementById(`credit-amt-${exc.id}`) as HTMLInputElement | null;
                                        const reasonEl = document.getElementById(`credit-reason-${exc.id}`) as HTMLInputElement | null;
                                        const creditEur = Number(amtEl?.value || 0);
                                        const reason = (reasonEl?.value || '').trim();
                                        setCancellingCredit(true);
                                        const res = await cancelExcursionToCredit(exc.id, creditEur, reason);
                                        setCancellingCredit(false);
                                        setCancelCreditFor(null);
                                        if (res && 'success' in res) {
                                          showMsg('Izlet preklican, znesek pretvorjen v dobroimetje.');
                                        }
                                        refresh();
                                      }}
                                      disabled={cancellingCredit}
                                      className="rounded-lg bg-amber-500/90 px-3 py-1.5 text-xs font-medium text-[#0a2029] hover:bg-amber-400 disabled:opacity-50"
                                    >
                                      {cancellingCredit ? 'Preklicujem���' : 'Potrdi dobroimetje'}
                                    </button>
                                  </div>
                                </div>
                              )}
                              
                              {/* Excursion image and description */}
                              {excursionData && (excursionData.imageUrl || excursionData.description) && (
                                <div className="flex gap-3 p-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                                  {excursionData.imageUrl && (
                                    <img 
                                      src={excursionData.imageUrl} 
                                      alt={excursionData.name} 
                                      className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                                    />
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <h4 className="text-sm font-medium text-[#c59b5b]">{excursionData.name}</h4>
                                    {excursionData.description && (
                                      <p className="text-xs text-white/60 mt-1 line-clamp-3">{excursionData.description}</p>
                                    )}
                                  </div>
                                </div>
                              )}
                              
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-[10px] text-white/40 mb-1">Izlet</label>
                                  <select
                                    className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white focus:border-[#7fa8b8]/50 focus:outline-none [&>option]:bg-[#0f2e3a] [&>option]:text-white"
                                    value={exc.excursionId}
                                    onChange={async e => {
                                      await updateExcursionBooking(exc.id, { excursionId: e.target.value });
                                      refresh();
                                    }}
                                  >
                                    {dbExcursions.map((e: { id: string; name: string }) => (
                                      <option key={e.id} value={e.id}>{e.name}</option>
                                    ))}
                                  </select>
                                </div>
                                
                                <div>
                                  <label className="block text-[10px] text-white/40 mb-1">Datum</label>
                                  <input
                                    type="date"
                                    className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white focus:border-[#7fa8b8]/50 focus:outline-none"
                                    defaultValue={exc.date || ''}
                                    onBlur={async e => {
                                      if (e.target.value !== exc.date) {
                                        await updateExcursionBooking(exc.id, { date: e.target.value });
                                        refresh();
                                      }
                                    }}
                                  />
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-[10px] text-white/40 mb-1">Coln</label>
                                  <select
                                    className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white focus:border-[#c59b5b]/50 focus:outline-none [&>option]:bg-[#0f2e3a] [&>option]:text-white"
                                    value={exc.boatId || ''}
                                    onChange={async e => {
                                      const boatId = e.target.value;
                                      const price = getExcursionGuestPrice(exc.excursionId, boatId, reservation.pax);
                                      await updateExcursionBooking(exc.id, { boatId, guestPrice: price });
                                      refresh();
                                    }}
                                  >
                                    <option value="">-- Izberi --</option>
                                    {dbBoats.map((b: { id: string; name: string; engine: string }) => (
                                      <option key={b.id} value={b.id}>{b.name}</option>
                                    ))}
                                  </select>
                                </div>
                                
                                <div>
                                  <label className="block text-[10px] text-white/40 mb-1">Oseb</label>
                                  <input
                                    type="number"
                                    className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white focus:border-[#7fa8b8]/50 focus:outline-none"
                                    value={exc.pax || reservation.pax}
                                    onChange={async e => {
                                      const pax = Number(e.target.value);
                                      const price = getExcursionGuestPrice(exc.excursionId, exc.boatId, pax);
                                      await updateExcursionBooking(exc.id, { pax, guestPrice: price });
                                      refresh();
                                    }}
                                  />
                                </div>
                              </div>
                          
                          {/* Entrance Fee */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs text-white/40 mb-1">Vstopnina (EUR)</label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-[#7fa8b8]/50 focus:outline-none"
                                  value={exc.entranceFee || 0}
                                  onChange={async e => {
                                    await updateExcursionBooking(exc.id, { entranceFee: Number(e.target.value) });
                                    refresh();
                                  }}
                                />
                                <button
                                  onClick={async () => {
                                    const entrancePerPerson = excursionData?.entranceFeeAr ? arToEur(excursionData.entranceFeeAr, exchangeRate) : 0;
                                    const totalEntrance = entrancePerPerson * (exc.pax || reservation.pax);
                                    await updateExcursionBooking(exc.id, { entranceFee: Math.round(totalEntrance * 100) / 100 });
                                    refresh();
                                  }}
                                  className="px-2 py-2 rounded-lg bg-white/5 text-xs text-white/60 hover:bg-white/10 whitespace-nowrap"
                                  title="Izracunaj iz cenika"
                                >
                                  Auto
                                </button>
                              </div>
                            </div>
                            
                            {/* Lunch Provider */}
                            <div>
                              <label className="block text-xs text-white/40 mb-1">Ponudnik kosila</label>
                              <select
                                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-[#c4744a]/50 focus:outline-none [&>option]:bg-[#0f2e3a] [&>option]:text-white"
                                value={exc.lunchProviderId || ''}
                                onChange={async e => {
                                  const providerId = e.target.value;
                                  const provider = dbLunchProviders.find((lp: { id: string }) => lp.id === providerId);
                                  const lunchPricePerPerson = provider ? arToEur(provider.pricePerPersonAr, exchangeRate) : 0;
                                  const totalLunch = lunchPricePerPerson * (exc.pax || reservation.pax);
                                  await updateExcursionBooking(exc.id, { 
                                    lunchProviderId: providerId, 
                                    lunchPrice: Math.round(totalLunch * 100) / 100 
                                  });
                                  refresh();
                                }}
                              >
                                <option value="">-- Brez kosila --</option>
                                {dbLunchProviders.map((lp: { id: string; name: string; location: string | null; pricePerPersonAr: number }) => (
                                  <option key={lp.id} value={lp.id}>
                                    {lp.name} {lp.location ? `(${lp.location})` : ''} - {eur(arToEur(lp.pricePerPersonAr, exchangeRate))}/os
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                          
                          {/* Lunch Price - only if provider selected */}
                          {exc.lunchProviderId && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs text-white/40 mb-1">Cena kosila (EUR)</label>
                                <input
                                  type="number"
                                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-[#c4744a]/50 focus:outline-none"
                                  value={exc.lunchPrice || 0}
                                  onChange={async e => {
                                    await updateExcursionBooking(exc.id, { lunchPrice: Number(e.target.value) });
                                    refresh();
                                  }}
                                />
                              </div>
                              <div className="flex items-end pb-2">
                                <p className="text-xs text-white/40">Skupaj kosilo: {eur(exc.lunchPrice || 0)}</p>
                              </div>
                            </div>
                          )}
                          
                          {/* Transport Price and Payment */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <LuxuryInput 
                              label="Cena transporta (EUR)" 
                              type="number" 
                              value={exc.guestPrice} 
                              onChange={async v => {
                                await updateExcursionBooking(exc.id, { guestPrice: Number(v) });
                                refresh();
                              }} 
                            />
                            <LuxurySelect
                              label="Status placila"
                              value={exc.paymentStatus || 'UNPAID'}
                              onChange={async v => {
                                await updateExcursionBooking(exc.id, { paymentStatus: v });
                                refresh();
                              }}
                              options={[
                                { value: 'PREPAID', label: 'Vkljuceno v rezervacijo' },
                                { value: 'PAID', label: 'Placano' },
                                { value: 'UNPAID', label: 'Se ni placano' },
                              ]}
                            />
                          </div>
                          
                          {/* Total Summary */}
                          <div className="p-3 rounded-lg bg-[#7fa8b8]/10 border border-[#7fa8b8]/20">
                            <div className="flex justify-between text-xs text-white/60">
                              <span>Transport:</span>
                              <span>{eur(exc.guestPrice || 0)}</span>
                            </div>
                            <div className="flex justify-between text-xs text-white/60">
                              <span>Vstopnina:</span>
                              <span>{eur(exc.entranceFee || 0)}</span>
                            </div>
                            {exc.lunchProviderId && (
                              <div className="flex justify-between text-xs text-white/60">
                                <span>Kosilo:</span>
                                <span>{eur(exc.lunchPrice || 0)}</span>
                              </div>
                            )}
                            <div className="flex justify-between text-sm font-medium text-[#7fa8b8] pt-2 mt-2 border-t border-[#7fa8b8]/20">
                              <span>SKUPAJ:</span>
                              <span>{eur((exc.guestPrice || 0) + (exc.entranceFee || 0) + (exc.lunchPrice || 0))}</span>
                            </div>
                          </div>
                          
                          {/* Notes */}
                          <div>
                            <label className="block text-xs text-white/40 mb-1">Opombe</label>
                            <input
                              type="text"
                              placeholder="npr. potrebuje vegetarijansko kosilo..."
                              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-[#7fa8b8]/50 focus:outline-none"
                              defaultValue={exc.notes || ''}
                              onBlur={async e => {
                                await updateExcursionBooking(exc.id, { notes: e.target.value });
                                refresh();
                              }}
                            />
                          </div>
                          
                          {/* Order Dilip */}
                          <div className="pt-2 border-t border-white/10">
                            <a
                              href={`https://wa.me/261326801412?text=${encodeURIComponent(
                                `Pozdravljeni, narocam izlet:\n` +
                                `- Izlet: ${excursionData?.name || 'ni izbran'}\n` +
                                `- Datum: ${exc.date || 'ni izbran'}\n` +
                                `- Coln: ${boatData?.name || 'ni izbran'}\n` +
                                `- Stevilo oseb: ${exc.pax || reservation.pax}\n` +
                                `- Gost: ${reservation.guestName}\n` +
                                `${exc.notes ? `- Opombe: ${exc.notes}\n` : ''}` +
                                `Hvala!`
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-center gap-2 w-full rounded-lg bg-[#25D366]/20 border border-[#25D366]/30 px-3 py-2 text-sm text-[#25D366] hover:bg-[#25D366]/30 transition-colors"
                            >
                              <Ship className="h-4 w-4" />
                              Naroci Dilipa
                            </a>
                            {exc.dilipOrderedAt ? (
                              <div className="text-[10px] text-green-400 text-center mt-1">
                                Naroceno: {new Date(exc.dilipOrderedAt).toLocaleString('sl-SI')}
                              </div>
                            ) : (
                              <button
                                onClick={async () => {
                                  await updateExcursionBooking(exc.id, { dilipOrderedAt: new Date().toISOString() });
                                  refresh();
                                }}
                                className="w-full text-[10px] text-white/40 hover:text-white/60 underline mt-1"
                              >
                                Potrdi narocilo
                              </button>
                            )}
                          </div>
                          
                          {/* Voucher Buttons */}
                          <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => {
                              const lunchProvider = dbLunchProviders.find((lp: { id: string; name: string; location: string | null }) => lp.id === exc.lunchProviderId);
                              const voucherWindow = window.open('', '_blank', 'width=550,height=850,scrollbars=yes');
                              if (!voucherWindow) return;
                              
                              voucherWindow.document.write(`
<!DOCTYPE html>
<html>
<head>
  <title>Voucher - ${excursionData?.name || 'Izlet'}</title>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { size: A4; margin: 0; }
    body { 
      font-family: 'Segoe UI', system-ui, sans-serif; 
      background: #0f2e3a;
      min-height: 100vh;
      display: flex;
      justify-content: center;
      padding: 16px;
    }
    .voucher {
      width: 100%;
      max-width: 500px;
      background: white;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
    }
    .header {
      background: linear-gradient(to right, #0f2e3a, #1c3742);
      padding: 16px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .logo-img {
      height: 50px;
      width: auto;
    }
    .subtitle {
      font-size: 10px;
      letter-spacing: 3px;
      color: rgba(255,255,255,0.6);
      text-transform: uppercase;
    }
    .image-section {
      width: 100%;
      height: 160px;
    }
    .image-section img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .content {
      padding: 20px;
    }
    .excursion-name {
      font-size: 20px;
      font-weight: 700;
      color: #0f2e3a;
      margin-bottom: 8px;
    }
    .description {
      font-size: 12px;
      color: #5b8494;
      line-height: 1.6;
      margin-bottom: 16px;
      padding-bottom: 16px;
      border-bottom: 1px solid #e8e3d9;
    }
    .guest-section {
      background: linear-gradient(135deg, rgba(127,168,184,0.1), rgba(127,168,184,0.05));
      border: 1px solid rgba(127,168,184,0.3);
      border-radius: 12px;
      padding: 12px;
      margin-bottom: 12px;
    }
    .guest-label {
      font-size: 9px;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: #7fa8b8;
      margin-bottom: 4px;
    }
    .guest-name {
      font-size: 16px;
      font-weight: 700;
      color: #0f2e3a;
      line-height: 1.4;
    }
    .honeymoon-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: linear-gradient(135deg, #f2e4d3, #e4c7a3);
      border: 1px solid #c5873b;
      border-radius: 12px;
      padding: 4px 10px;
      margin-top: 8px;
      color: #753f2b;
      font-size: 10px;
      font-weight: 600;
    }
    .honeymoon-badge svg {
      width: 12px;
      height: 12px;
      fill: #b8684a;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 12px;
    }
    .info-item {
      padding: 10px;
      background: #f8f5ef;
      border-radius: 8px;
    }
    .info-label {
      font-size: 8px;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: #9dafb5;
      margin-bottom: 2px;
    }
    .info-value {
      font-size: 13px;
      font-weight: 600;
      color: #0f2e3a;
    }
    .footer {
      background: #f8f5ef;
      padding: 12px 20px;
      text-align: center;
      border-top: 1px solid #e8e3d9;
    }
    .footer-text {
      font-size: 10px;
      color: #9dafb5;
    }
    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    @media print {
      body { background: white; padding: 0; }
      .voucher { box-shadow: none; }
      .header {
        background: linear-gradient(to right, #0f2e3a, #1c3742) !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
    }
  </style>
</head>
<body>
  <div class="voucher">
    <div class="header">
      <img src="${window.location.origin}/images/komba-logo-gold.png" alt="Komba Cabana" class="logo-img" />
      <div class="subtitle">Excursion Voucher</div>
    </div>
    
    ${excursionData?.imageUrl ? `<div class="image-section"><img src="${excursionData.imageUrl}" alt="${excursionData?.name || ''}" /></div>` : ''}
    
    <div class="content">
      <h1 class="excursion-name">${excursionData?.name || 'Izlet'}</h1>
      ${excursionData?.description ? `<p class="description">${excursionData.description.replace(/\n/g, '<br>')}</p>` : ''}
      
      <div class="guest-section">
        <div class="guest-label">${reservation.secondGuestName ? 'Guests' : 'Guest'}</div>
        <div class="guest-name">${reservation.guestName}${reservation.secondGuestName ? '<br>' + reservation.secondGuestName : ''}</div>
        ${reservation.honeymoon ? '<div class="honeymoon-badge"><svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg> Honeymoon</div>' : ''}
      </div>
      
      <div class="info-grid">
        <div class="info-item">
          <div class="info-label">Date</div>
          <div class="info-value">${exc.date ? new Date(exc.date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'TBC'}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Number of Guests</div>
          <div class="info-value">${exc.pax || reservation.pax} ${(exc.pax || reservation.pax) === 1 ? 'person' : 'people'}</div>
        </div>
      </div>
    </div>
    
    <div class="footer">
      <div class="footer-text">Thank you for choosing Komba Cabana. Enjoy your adventure!</div>
    </div>
  </div>
</body>
</html>
                              `);
                              
                              voucherWindow.document.close();
                              voucherWindow.focus();
                              setTimeout(() => { voucherWindow.print(); }, 800);
                            }}
                            className="flex items-center justify-center gap-2 flex-1 rounded-lg bg-[#c59b5b]/20 border border-[#c59b5b]/30 px-3 py-2 text-sm text-[#c59b5b] hover:bg-[#c59b5b]/30 transition-colors"
                          >
                            <Printer className="h-4 w-4" />
                            Natisni
                          </button>
                          <button
                            onClick={() => {
                              const url = `${window.location.origin}/voucher/${exc.id}`;
                              const textarea = document.createElement('textarea');
                              textarea.value = url;
                              textarea.style.position = 'fixed';
                              textarea.style.opacity = '0';
                              document.body.appendChild(textarea);
                              textarea.select();
                              document.execCommand('copy');
                              document.body.removeChild(textarea);
                              alert('Komba Cabana voucher link kopiran!');
                            }}
                            className="flex items-center justify-center gap-2 flex-1 rounded-lg bg-[#7fa8b8]/20 border border-[#7fa8b8]/30 px-3 py-2 text-sm text-[#7fa8b8] hover:bg-[#7fa8b8]/30 transition-colors"
                          >
                            <ExternalLink className="h-4 w-4" />
                            Kopiraj Link
                          </button>
                          </div>
                          </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
          
          <div className="mt-6 pt-4 border-t border-white/10">
            <LuxuryButton variant="danger" className="w-full sm:w-auto" onClick={() => handleDeleteReservation(reservation.id)}>
              Izbrisi rezervacijo
            </LuxuryButton>
          </div>
          
          {/* Police Form Modal */}
          <PoliceFormModal 
            reservation={reservation} 
            isOpen={showPoliceForm} 
            onClose={() => setShowPoliceForm(false)} 
          />

          {/* Predogled emaila za prijavo (check-in) */}
          {checkinPreview && typeof document !== "undefined" && createPortal(
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
              onClick={() => { if (!emailingGuest) setCheckinPreview(null); }}
            >
              <div
                className="flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#101d22] shadow-2xl"
                style={{ maxHeight: "90vh" }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-white">Check-in email preview (police)</h3>
                    <label className="mt-2 block text-xs text-white/50">
                      Recipient (email):
                      <input
                        type="email"
                        value={checkinPreview.to}
                        onChange={(e) => setCheckinPreview((p) => (p ? { ...p, to: e.target.value } : p))}
                        disabled={emailingGuest}
                        placeholder="enter guest email"
                        className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#c59b5b]/50 focus:outline-none disabled:opacity-50"
                      />
                    </label>
                  </div>
                  <button
                    onClick={() => { if (!emailingGuest) setCheckinPreview(null); }}
                    disabled={emailingGuest}
                    className="mt-1 rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-50"
                    aria-label="Close preview"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto">
                <div className="border-b border-white/10 px-5 py-4">
                  <p className="text-xs font-medium text-white/70">Guest details (police form)</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-white/40">
                    You can review and change every field here &mdash; including data a guest has already entered. Unknown partner/child names can be filled with a temporary name; the guest can still correct it via their link. Leave &quot;More details&quot; collapsed to just set names &amp; dates of birth.
                  </p>
                  <div className="mt-3 flex flex-col gap-3">
                    {checkinPreview.guests.map((g, idx) => {
                      const setField = (key: CheckinGuestField, value: string) =>
                        setCheckinPreview((p) =>
                          p ? { ...p, guests: p.guests.map((x, i) => (i === idx ? { ...x, data: { ...x.data, [key]: value } } : x)) } : p
                        );
                      const disabled = emailingGuest || savingCheckinNames;
                      const inputCls = "mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#c59b5b]/50 focus:outline-none disabled:opacity-50";
                      return (
                        <div key={g.slot} className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                          <div className="flex items-center justify-between">
                            <p className="text-[11px] font-medium text-white/60">{g.label}</p>
                            <button
                              type="button"
                              onClick={() =>
                                setCheckinPreview((p) =>
                                  p ? { ...p, guests: p.guests.map((x, i) => (i === idx ? { ...x, expanded: !x.expanded } : x)) } : p
                                )
                              }
                              className="text-[11px] font-medium text-[#c59b5b] hover:underline"
                            >
                              {g.expanded ? "Fewer details" : "More details"}
                            </button>
                          </div>
                          <div className="mt-1 grid gap-2 sm:grid-cols-2">
                            <div>
                              <p className="text-[11px] text-white/50">First and last name</p>
                              <input type="text" value={g.data.guestName} onChange={(e) => setField("guestName", e.target.value)} disabled={disabled} placeholder="First and last name" className={inputCls} />
                            </div>
                            <div>
                              <p className="text-[11px] text-white/50">Date of birth</p>
                              <input type="date" value={g.data.dateOfBirth} onChange={(e) => setField("dateOfBirth", e.target.value)} disabled={disabled} className={inputCls} />
                            </div>
                          </div>
                          {g.expanded && (
                            <div className="mt-2 grid gap-2 sm:grid-cols-2">
                              {CHECKIN_EXTRA_FIELDS.map((f) => (
                                <div key={f.key}>
                                  <p className="text-[11px] text-white/50">{f.label}</p>
                                  <input type={f.type} value={g.data[f.key]} onChange={(e) => setField(f.key, e.target.value)} disabled={disabled} className={inputCls} />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <button
                    onClick={async () => {
                      setSavingCheckinNames(true);
                      try {
                        const guestData: Record<string, Record<string, string>> = {};
                        checkinPreview.guests.forEach((g) => { guestData[g.slot] = { ...g.data }; });
                        const { getCheckinEmailPreview } = await import("@/app/actions/checkin");
                        const result = await getCheckinEmailPreview(reservation.id, checkinPreview.to, guestData);
                        if (result.html) {
                          setCheckinPreview((p) => (p ? { ...p, html: result.html! } : p));
                          refresh();
                          showMsg("Predogled posodobljen.");
                        } else {
                          showMsg(result.error || "Predogleda ni bilo mogoce posodobiti.");
                        }
                      } catch {
                        showMsg("Napaka pri posodabljanju predogleda.");
                      } finally {
                        setSavingCheckinNames(false);
                      }
                    }}
                    disabled={emailingGuest || savingCheckinNames}
                    className="mt-3 rounded-xl border border-[#c59b5b]/30 bg-[#c59b5b]/10 px-4 py-2 text-xs font-medium text-[#c59b5b] hover:bg-[#c59b5b]/20 transition-colors disabled:opacity-50"
                  >
                    {savingCheckinNames ? "Updating..." : "Update preview"}
                  </button>
                </div>

                <div className="bg-white">
                  <iframe
                    title="Check-in email preview"
                    srcDoc={checkinPreview.html}
                    className="w-full border-0"
                    style={{ height: "760px" }}
                  />
                </div>
                </div>

                <div className="flex items-center justify-end gap-3 border-t border-white/10 px-5 py-4">
                  <button
                    onClick={() => setCheckinPreview(null)}
                    disabled={emailingGuest}
                    className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-white/70 hover:bg-white/5 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      const to = (checkinPreview.to || "").trim();
                      if (!to || !to.includes("@")) {
                        showMsg("Enter a valid recipient email address.");
                        return;
                      }
                      setEmailingGuest(true);
                      try {
                        const guestData: Record<string, Record<string, string>> = {};
                        checkinPreview.guests.forEach((g) => { guestData[g.slot] = { ...g.data }; });
                        const { sendCheckinEmail } = await import("@/app/actions/checkin");
                        const result = await sendCheckinEmail(reservation.id, to, guestData);
                        if (result.success) {
                          showMsg(`Email sent to guest (${to}).`);
                          setSentEmailsRefresh((n) => n + 1);
                          refresh();
                          setCheckinPreview(null);
                        } else {
                          showMsg(result.error || "Sending failed.");
                        }
                      } catch {
                        showMsg("Error sending email. Please try again.");
                      } finally {
                        setEmailingGuest(false);
                      }
                    }}
                    disabled={emailingGuest || !(checkinPreview.to || "").includes("@")}
                    className="flex items-center gap-2 rounded-xl bg-[#c59b5b] px-5 py-2.5 text-sm font-semibold text-[#0a2029] hover:bg-[#c59b5b]/90 transition-colors disabled:opacity-50"
                  >
                    <Mail className="h-4 w-4" />
                    {emailingGuest ? "Sending..." : "Send email"}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}

          {/* "How did you find us" survey email preview modal (portaled to body) */}
          {feedbackPreview && typeof document !== "undefined" &&
            createPortal(
              <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" onClick={() => setFeedbackPreview(null)}>
                <div
                  className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0a2029] shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-white">Survey email preview (how did you find us)</h3>
                      <label className="mt-2 block text-xs text-white/50">
                        Recipient (email):
                        <input
                          type="email"
                          value={feedbackPreview.to}
                          onChange={(e) => setFeedbackPreview((p) => (p ? { ...p, to: e.target.value } : p))}
                          disabled={emailingFeedback}
                          placeholder="enter guest email"
                          className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#c59b5b]/50 focus:outline-none disabled:opacity-50"
                        />
                      </label>
                    </div>
                    <button
                      onClick={() => setFeedbackPreview(null)}
                      className="shrink-0 rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white transition-colors"
                      aria-label="Close preview"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto bg-white">
                    <iframe
                      title="Survey email preview"
                      srcDoc={feedbackPreview.html}
                      className="w-full border-0"
                      style={{ height: "760px" }}
                    />
                  </div>

                  <div className="flex items-center justify-end gap-3 border-t border-white/10 px-5 py-4">
                    <button
                      onClick={() => setFeedbackPreview(null)}
                      disabled={emailingFeedback}
                      className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-white/70 hover:bg-white/5 transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        const to = (feedbackPreview.to || "").trim();
                        if (!to || !to.includes("@")) {
                          showMsg("Enter a valid recipient email address.");
                          return;
                        }
                        setEmailingFeedback(true);
                        try {
                          const { sendFeedbackEmail } = await import("@/app/actions/feedback-email");
                          const result = await sendFeedbackEmail(reservation.id, to);
                          if (result.success) {
                            showMsg(`Email sent to guest (${to}).`);
                            setSentEmailsRefresh((n) => n + 1);
                            setFeedbackPreview(null);
                          } else {
                            showMsg(result.error || "Sending failed.");
                          }
                        } catch {
                          showMsg("Error sending email. Please try again.");
                        } finally {
                          setEmailingFeedback(false);
                        }
                      }}
                      disabled={emailingFeedback || !(feedbackPreview.to || "").includes("@")}
                      className="flex items-center gap-2 rounded-xl bg-[#c59b5b] px-5 py-2.5 text-sm font-semibold text-[#0a2029] hover:bg-[#c59b5b]/90 transition-colors disabled:opacity-50"
                    >
                      <Mail className="h-4 w-4" />
                      {emailingFeedback ? "Sending..." : "Send email"}
                    </button>
                  </div>
                </div>
              </div>,
              document.body
            )}

          {/* Excursion offer email preview */}
          {offerPreview && typeof document !== "undefined" &&
            createPortal(
              <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" onClick={() => setOfferPreview(null)}>
                <div
                  className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0a2029] shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-white">Predogled emaila — ponudba izletov</h3>
                      <label className="mt-2 block text-xs text-white/50">
                        Prejemnik (email):
                        <input
                          type="email"
                          value={offerPreview.to}
                          onChange={(e) => setOfferPreview((p) => (p ? { ...p, to: e.target.value } : p))}
                          disabled={emailingOffer}
                          placeholder="vpišite email gosta"
                          className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#c59b5b]/50 focus:outline-none disabled:opacity-50"
                        />
                      </label>
                    </div>
                    <button
                      onClick={() => setOfferPreview(null)}
                      className="shrink-0 rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white transition-colors"
                      aria-label="Zapri predogled"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto bg-white">
                    <iframe
                      title="Excursion offer email preview"
                      srcDoc={offerPreview.html}
                      className="w-full border-0"
                      style={{ height: "760px" }}
                    />
                  </div>

                  <div className="flex items-center justify-end gap-3 border-t border-white/10 px-5 py-4">
                    <button
                      onClick={() => setOfferPreview(null)}
                      disabled={emailingOffer}
                      className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-white/70 hover:bg-white/5 transition-colors disabled:opacity-50"
                    >
                      Prekliči
                    </button>
                    <button
                      onClick={async () => {
                        const to = (offerPreview.to || "").trim();
                        if (!to || !to.includes("@")) {
                          showMsg("Vpišite veljaven email naslov prejemnika.");
                          return;
                        }
                        setEmailingOffer(true);
                        try {
                          const { sendExcursionOffer } = await import("@/app/actions/excursion-offer-email");
                          const result = await sendExcursionOffer(reservation.id, to);
                          if (result.success) {
                            showMsg(`Ponudba izletov poslana gostu (${to}).`);
                            setSentEmailsRefresh((n) => n + 1);
                            setOfferPreview(null);
                          } else {
                            showMsg(result.error || "Pošiljanje ni uspelo.");
                          }
                        } catch {
                          showMsg("Napaka pri pošiljanju. Poskusite znova.");
                        } finally {
                          setEmailingOffer(false);
                        }
                      }}
                      disabled={emailingOffer || !(offerPreview.to || "").includes("@")}
                      className="flex items-center gap-2 rounded-xl bg-[#c59b5b] px-5 py-2.5 text-sm font-semibold text-[#0a2029] hover:bg-[#c59b5b]/90 transition-colors disabled:opacity-50"
                    >
                      <Mail className="h-4 w-4" />
                      {emailingOffer ? "Pošiljam..." : "Pošlji email"}
                    </button>
                  </div>
                </div>
              </div>,
              document.body
            )}
        </GlassCard>
      </section>
    );
  }

  // Hour an item was rung up, pinned to the lodge's own clock. Timestamps are stored
  // in UTC, so without the fixed zone the hour would drift with wherever the delivery
  // note is being read from — a drink served at 22:18 in the bar would read 19:18 in
  // Europe. Returns null for rows that carry no timestamp (e.g. synthesized transfers).
  function entryTime(iso?: string): string | null {
    if (!iso) return null;
    const d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleTimeString("sl-SI", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Indian/Antananarivo",
    });
  }

  function Orders() {
    const reservation = activeReservation();

    // ===== Invoice discounts (popusti) — hooks must run unconditionally =====
    const reservationId = reservation?.id || '';
    const [discounts, setDiscounts] = React.useState<{ id: string; kind: string; label: string; amountAr: number }[]>([]);
    // Real remaining the guest still has to pay, reported up from PaymentSection
    // (invoice TOTAL minus everything already paid). null until payments load.
    const [balanceDueEur, setBalanceDueEur] = React.useState<number | null>(null);
    // Collapsible: the discounts form is hidden behind a toggle.
    const [showDiscounts, setShowDiscounts] = React.useState(false);
    const [discountKind, setDiscountKind] = React.useState<'stay' | 'item'>('stay');
    const [discountLabel, setDiscountLabel] = React.useState('');
    const [discountAmount, setDiscountAmount] = React.useState('');
    const [addingDiscount, setAddingDiscount] = React.useState(false);
    const [customExcursionDraft, setCustomExcursionDraft] = React.useState({ name: "", priceEur: 0, date: today(), paymentStatus: "UNPAID" as "PAID" | "UNPAID", paidMethod: "cash" as "card" | "cash" | "transfer", paidDate: today() });
    // Collapsible: the custom-excursion form is hidden behind a toggle at the bottom of the manual delivery note.
    const [showCustomExcursion, setShowCustomExcursion] = React.useState(false);
    // Child meal discount for the manual "Dodaj postavko" form (mirrors the bar app).
    // mealBand '' = full price (adult); otherwise a CHILD_BANDS id. selProductIsFood
    // is true only when the chosen product is food (costCategory 'prehrana').
    const [mealBand, setMealBand] = React.useState<string>('');
    const [selProductIsFood, setSelProductIsFood] = React.useState(false);
    const [selProductBaseAr, setSelProductBaseAr] = React.useState(0);

    async function loadDiscounts() {
      if (!reservationId) { setDiscounts([]); return; }
      const { getInvoiceDiscounts } = await import("@/app/actions/komba");
      const data = await getInvoiceDiscounts(reservationId);
      setDiscounts(data as typeof discounts);
    }
    React.useEffect(() => { loadDiscounts(); }, [reservationId]);

    async function handleAddDiscount() {
      const eur = parseFloat(discountAmount);
      if (isNaN(eur) || eur <= 0 || !reservationId) return;
      setAddingDiscount(true);
      const { addInvoiceDiscount } = await import("@/app/actions/komba");
      await addInvoiceDiscount(reservationId, discountKind, discountLabel, Math.round(eur * exchangeRate));
      setDiscountLabel('');
      setDiscountAmount('');
      await loadDiscounts();
      setAddingDiscount(false);
    }

    async function handleDeleteDiscount(id: string) {
      const { deleteInvoiceDiscount } = await import("@/app/actions/komba");
      await deleteInvoiceDiscount(id, reservationId);
      await loadDiscounts();
    }

    if (!reservation) return <GlassCard><p className="text-white/40">Ni izbranega gosta.</p></GlassCard>;

    const orderItems = (reservation.orderItems || []).map((item: any) =>
      (item.category === 'Prehrana' || item.category === 'Food') && item.paymentStatus === 'UNPAID' && !item.isFree && isPaidPlanMeal(reservation, item.name)
        ? { ...item, paymentStatus: 'PAID' }
        : item
    );
    const barItems = (reservation.barItems || []).map((item: any) =>
      !item.coveredByMealPlan && !item.isFree && isPaidPlanMeal(reservation, item.productName)
        ? { ...item, coveredByMealPlan: true }
        : item
    );
    
    // Create items with service dates and executed status
    interface OrderItemWithDate extends OrderItem {
      serviceDate: string;
      executed?: boolean;
      isTransfer?: boolean;
      isBarItem?: boolean;
      deliveryNoteId?: string;
      coveredByMealPlan?: boolean;
      isFree?: boolean;
      addedBy?: string;
      staffName?: string;
      /** When the entry was made (bar or reception). Absent on synthesized transfers. */
      createdAt?: string;
    }
    
    const itemsWithDates: OrderItemWithDate[] = [];
    
    // Arrival transfer - only include if executed (or always show but mark differently)
    if (reservation.transfers.arrival.route) {
      itemsWithDates.push({ 
        id: "arrival-transfer", 
        name: "Arrival Transfer", 
        category: "Transfer", 
        qty: 1, 
        priceAr: eurToAr(reservation.transfers.arrival.guestPrice, exchangeRate), 
        paymentStatus: reservation.transfers.arrival.paymentStatus,
        serviceDate: reservation.arrival,
        executed: reservation.transfers.arrival.executed,
        isTransfer: true
      });
    }
    
    // Departure transfer - only include if executed (or always show but mark differently)
    if (reservation.transfers.departure.route) {
      itemsWithDates.push({ 
        id: "departure-transfer", 
        name: "Departure Transfer", 
        category: "Transfer", 
        qty: 1, 
        priceAr: eurToAr(reservation.transfers.departure.guestPrice, exchangeRate), 
        paymentStatus: reservation.transfers.departure.paymentStatus,
        serviceDate: reservation.departure,
        executed: reservation.transfers.departure.executed,
        isTransfer: true
      });
    }
    
  // Other order items - use eventDate (user-specified) or createdAt as fallback.
  // Skip "Bivanje" (accommodation) items: accommodation is accounted for separately
  // via reservation.totalAmount in the PaymentSection, so including it here would double count.
  // Skip arrival/departure "Transfer" mirrors: PaymentSection already synthesizes those from
  // reservation.transfers above. BUT keep reception ad-hoc transfers (name "Transfer: ...")
  // which exist only as order_items and have no transfers-table entry, so they must be listed
  // here (under their eventDate) to appear on the delivery note.
  orderItems.forEach(item => {
    if ((item as any).category === 'Bivanje') return;
    if ((item as any).category === 'Transfer' && !/^transfer:\s/i.test(((item as any).name || ''))) return;
    const itemWithMeta = item as OrderItemWithDate & { eventDate?: string; createdAt?: string };
    itemsWithDates.push({
      ...item,
      serviceDate: itemWithMeta.eventDate || itemWithMeta.createdAt?.split('T')[0] || new Date().toISOString().split('T')[0],
      executed: true // Bar items are always "executed"
    });
  });
  
  // Bar items from delivery notes
  barItems.forEach((item: any) => {
    itemsWithDates.push({
      id: item.id,
      deliveryNoteId: item.deliveryNoteId,
      name: item.productName,
      category: item.category || 'Bar',
      qty: item.quantity,
      priceAr: item.priceAr,
      // Meals included in the meal plan OR items marked complimentary are already paid -> show as paid.
      paymentStatus: (item.coveredByMealPlan || item.isFree) ? 'PAID' : 'UNPAID',
      coveredByMealPlan: item.coveredByMealPlan,
      isFree: item.isFree,
      serviceDate: item.noteDate || new Date().toISOString().split('T')[0],
      executed: true,
      isBarItem: true,
      staffName: item.staffName,
      createdAt: item.createdAt
    });
  });
    
    // Separate items for display
    const executedUnpaid = itemsWithDates.filter(item => (item.executed || !item.isTransfer) && item.paymentStatus !== "PAID" && item.paymentStatus !== "PREPAID");
    const paidItems = itemsWithDates.filter(item => item.paymentStatus === "PAID" || item.paymentStatus === "PREPAID");
    const notExecutedTransfers = itemsWithDates.filter(item => item.isTransfer && !item.executed);
    
    // Group executed unpaid items by service date
    const groupedByDate = executedUnpaid.reduce((groups, item) => {
      const date = item.serviceDate;
      if (!groups[date]) groups[date] = [];
      groups[date].push(item);
      return groups;
    }, {} as Record<string, OrderItemWithDate[]>);
    
    // Sort dates chronologically
    const sortedDates = Object.keys(groupedByDate).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    
    // Group paid items (evidence) by service date too, for a per-delivery-note-per-day layout
    const groupedPaidByDate = paidItems.reduce((groups, item) => {
      const date = item.serviceDate;
      if (!groups[date]) groups[date] = [];
      groups[date].push(item);
      return groups;
    }, {} as Record<string, OrderItemWithDate[]>);
    const sortedPaidDates = Object.keys(groupedPaidByDate).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    
    // Total only from executed unpaid items.
    // Bar items (from delivery notes) store priceAr PER UNIT, so multiply by qty.
    // Order items / transfers store priceAr as the TOTAL line price already, so do NOT multiply.

    const formatDateSlo = (dateStr: string) => {
      const date = new Date(dateStr);
      return date.toLocaleDateString('sl-SI', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    };

    // ===== Invoice TOTAL (matches /racun and the reservation-row balance) =====
    // TOTAL = accommodation + unpaid services/bar (minus discounts) + separately-paid
    // excursions/transfers. Those separately-paid items also count toward "Placano",
    // so the remaining stays correct. Uses raw order_items (incl. the Transfer mirror).
    const isAgency = reservation.bookingSource === 'Agency';
    const unpaidServicesInvAr = (orderItems as any[])
      .filter(i => i.paymentStatus === 'UNPAID' && i.category !== 'Bivanje')
      .reduce((s, i) => s + Number(i.priceAr || 0), 0);
    const barChargeInvAr = (barItems as any[])
      .reduce((s, i) => s + ((i.coveredByMealPlan || i.isFree) ? 0 : Number(i.priceAr || 0) * Number(i.quantity || 1)), 0);
    const invDiscountAr = discounts.reduce((s, d) => s + (d.amountAr || 0), 0);
    const sepPaidRaw = (orderItems as any[])
      .filter(i => !isAgency && i.paymentStatus === 'PAID' && !i.isFree && (i.category === 'Izlet' || i.category === 'Transfer') && Number(i.refPriceAr || 0) > 0);
    const sepPaidItems = isAgency ? [] : sepPaidRaw.map(i => ({
      label: toEnglishItemName(i.name),
      eur: arToEur(Number(i.refPriceAr || 0), exchangeRate),
      method: i.paidMethod || 'card',
      date: i.paidDate ? formatDateSlo(i.paidDate) : '',
    }));
    const sepPaidInvEur = arToEur(sepPaidRaw.reduce((s, i) => s + Number(i.refPriceAr || 0), 0), exchangeRate);
    const invoiceTotalEur =
      Number(reservation.totalAmount || 0) +
      arToEur(unpaidServicesInvAr + barChargeInvAr - invDiscountAr, exchangeRate) +
      sepPaidInvEur;
    // Show the guest's real remaining once payments have loaded; before that fall back to
    // the full invoice total so the box is never blank.
    const balanceEur = Math.max(0, balanceDueEur ?? invoiceTotalEur);
    const balanceAr = eurToAr(balanceEur, exchangeRate);

    return (
      <section className="grid gap-8 xl:grid-cols-[440px_1fr]">
        <GlassCard>
          <SectionHeader eyebrow="Delivery Note" title="Rocni vnos dobavnice" />
          
          {/* Check-out reminder */}
          {!reservation.checkedOutAt && (
            <div className="mt-4 rounded-xl border border-[#c59b5b]/30 bg-[#c59b5b]/10 p-3">
              <p className="text-xs text-[#c59b5b]">Dobavnica se zakljuci ob Check-out gosta</p>
            </div>
          )}
          
          {/* Shared Invoice Link */}
          {reservation.groupId && (() => {
            const mainRes = reservations.find(r => r.groupId === reservation.groupId && r.isMainReservation);
            if (mainRes?.sharedInvoice) {
              return (
                <Link
                  href={`/dobavnice/${mainRes.id}`}
                  className="mt-4 flex items-center justify-center gap-2 w-full rounded-xl border border-purple-500/30 bg-purple-500/10 py-3 px-4 text-sm font-medium text-purple-300 hover:bg-purple-500/20 transition-all"
                >
                  <Users className="h-4 w-4" />
                  Odpri skupno dobavnico
                </Link>
              );
            }
            return null;
          })()}
          
  <div className="mt-4 rounded-2xl bg-gradient-to-r from-[#c59b5b]/10 to-[#8f6d3a]/10 p-4">
  <p className="text-sm text-white/50">Za placilo (preostanek):</p>
  <p className="mt-1 bg-gradient-to-r from-[#e8c88a] to-[#c59b5b] bg-clip-text text-2xl font-light text-transparent">{ar(balanceAr)}</p>
  <p className="text-lg text-white font-medium">{eur(balanceEur)}</p>
  <p className="mt-1 text-xs text-white/40">Skupni znesek računa: {eur(invoiceTotalEur)}</p>
  </div>

  {/* Popusti (discounts) - only before checkout */}
  {reservation.checkedInAt && !reservation.checkedOutAt && (
  <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-4">
    <button
      type="button"
      onClick={() => setShowDiscounts(v => !v)}
      className="flex w-full items-center justify-between text-left"
    >
      <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#9dafb5]">
        Popusti{discounts.length > 0 ? ` · ${discounts.length}` : ''}
      </span>
      <ChevronDown className={`h-4 w-4 text-white/40 transition-transform ${showDiscounts ? 'rotate-180' : ''}`} />
    </button>

    {/* Existing discounts */}
    {discounts.length > 0 && (
      <div className="space-y-2">
        {discounts.map(d => (
          <div key={d.id} className="flex items-center justify-between rounded-xl bg-white/[0.03] border border-white/10 px-3 py-2">
            <div>
              <p className="text-sm font-medium text-white">{d.label}</p>
              <p className="text-xs text-white/40">{d.kind === 'item' ? 'Brezplacna postavka' : 'Popust na bivanje'}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-[#8fae92]">-{eur(arToEur(d.amountAr, exchangeRate))}</span>
              <button onClick={() => handleDeleteDiscount(d.id)} className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-[#d7a593] transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    )}

    {showDiscounts && (<>
    {/* Kind toggle */}
    <div className="grid grid-cols-2 gap-2">
      <button
        onClick={() => setDiscountKind('stay')}
        className={`rounded-xl border px-3 py-2.5 text-center text-sm transition-all ${discountKind === 'stay' ? 'border-white/30 bg-white/10 text-white' : 'border-white/10 bg-white/[0.02] text-white/50 hover:bg-white/[0.05]'}`}
      >
        Popust na bivanje
      </button>
      <button
        onClick={() => setDiscountKind('item')}
        className={`rounded-xl border px-3 py-2.5 text-center text-sm transition-all ${discountKind === 'item' ? 'border-white/30 bg-white/10 text-white' : 'border-white/10 bg-white/[0.02] text-white/50 hover:bg-white/[0.05]'}`}
      >
        Brezplacna postavka
      </button>
    </div>

    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <input
        type="text"
        value={discountLabel}
        onChange={e => setDiscountLabel(e.target.value)}
        placeholder={discountKind === 'item' ? 'Npr. Brezplacna vecerja' : 'Npr. Popust na bivanje'}
        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/30 focus:border-[#8fae92]/50 focus:outline-none"
      />
      <div className="relative">
        <input
          type="number" step="0.01"
          value={discountAmount}
          onChange={e => setDiscountAmount(e.target.value)}
          placeholder="Znesek"
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/30 focus:border-[#8fae92]/50 focus:outline-none"
        />
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-white/40">EUR</span>
      </div>
    </div>

    <button
      onClick={handleAddDiscount}
      disabled={addingDiscount || !discountAmount || parseFloat(discountAmount) <= 0}
      className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#8fae92]/30 bg-[#8fae92]/15 py-3 text-sm font-medium text-[#8fae92] transition-all hover:bg-[#8fae92]/25 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {addingDiscount ? 'Dodajam...' : '+ Dodaj popust'}
    </button>
    </>)}
  </div>
  )}
  
  {/* Payments Section for manual entry.
      Totals (invoiceTotalEur / sepPaidItems) are computed in the component body above and
      match the /racun invoice and the reservation-row balance. PaymentSection reports the
      real remaining back up via onRemainingChange so the "Za placilo" box shows it too. */}
  <div className="mt-6">
    <PaymentSection 
      reservationId={reservation.id} 
      totalAmount={invoiceTotalEur.toFixed(2)} 
      separatePaidItems={sepPaidItems}
      currency="EUR" 
      onPaymentChange={refresh} 
      onRemainingChange={setBalanceDueEur}
    />
  </div>
  
  {/* Predogled računa (odpre stran računa v novem zavihku - NE zaključi ničesar) */}
  {reservation.checkedInAt && !reservation.checkedOutAt && (
  <div className="mt-6">
  <button
    onClick={() => window.open(`/racun/${reservation.id}?view=true`, "_blank")}
    className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#7fa8b8]/10 border border-[#7fa8b8]/30 py-4 px-4 text-sm font-medium text-[#7fa8b8] hover:bg-[#7fa8b8]/20 transition-all"
  >
    <FileText className="h-4 w-4" />
    Predogled računa
  </button>
  <div className="mt-3 grid grid-cols-3 gap-2">
    {([
      { key: "full", label: "Pošlji račun gostu", exc: false, stay: false },
      { key: "noStay", label: "Brez bivanja", exc: true, stay: false },
      { key: "stayMeals", label: "Bivanje + prehrana + transport", exc: false, stay: true },
    ] as const).map((mode) => (
      <button
        key={mode.key}
        onClick={async () => {
          const to = (reservation.email || "").trim();
          if (!to) {
            showMsg("Gost nima vpisanega email naslova. Najprej ga vnesite.");
            return;
          }
          setLoadingInvoicePreview(true);
          try {
            const { getInvoiceEmailPreview } = await import("@/app/actions/invoice-email");
            const result = await getInvoiceEmailPreview(reservation.id, "en", mode.exc, mode.stay);
            if (result.html) {
              setInvoicePreview({ html: result.html, to: result.to || to, excludeAccommodation: mode.exc, onlyStayMeals: mode.stay });
            } else {
              showMsg(result.error || "Predogleda ni bilo mogoče pripraviti.");
            }
          } catch {
            showMsg("Napaka pri pripravi predogleda. Poskusite znova.");
          } finally {
            setLoadingInvoicePreview(false);
          }
        }}
        disabled={loadingInvoicePreview || emailingInvoice}
        className="flex items-center justify-center gap-2 rounded-xl bg-[#c59b5b]/10 border border-[#c59b5b]/30 py-4 px-3 text-sm font-medium text-[#c59b5b] hover:bg-[#c59b5b]/20 transition-all disabled:opacity-50"
      >
        <Mail className="h-4 w-4 flex-shrink-0" />
        <span className="text-center leading-tight">{mode.label}</span>
      </button>
    ))}
  </div>
  {loadingInvoicePreview && <p className="mt-2 text-center text-xs text-white/50">Pripravljam predogled...</p>}
  </div>
  )}

  {/* Issue Invoice & Checkout Button */}
  {reservation.checkedInAt && !reservation.checkedOutAt && (
  <div className="mt-6">
  <button
    onClick={async () => {
      if (!confirm("Izdaj racun in opravi check-out?")) return;
      setSaving(true);
      // Close all open delivery notes
      await closeAllDeliveryNotesForReservation(reservation.id);
      // Set check-out timestamp
      await handleUpdateReservation(reservation.id, { checkedOutAt: new Date().toISOString() });
      showMsg("Racun izdan, check-out opravljen!");
      setSaving(false);
    }}
    disabled={saving}
    className="w-full rounded-xl bg-gradient-to-r from-[#8fae92]/20 to-[#618865]/20 border border-[#8fae92]/30 py-4 px-4 text-sm font-medium text-[#8fae92] hover:from-[#8fae92]/30 hover:to-[#618865]/30 transition-all"
  >
    {saving ? "Izdajam..." : "Izdaj racun in Check-out"}
  </button>
  </div>
  )}
          
          <div className="mt-6 space-y-4">
            {/* Custom Excursion Entry - free-text name, price and date (collapsible dropdown) */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setShowCustomExcursion(v => !v)}
                className="flex w-full items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-left transition-colors hover:border-white/15"
              >
                <span className="text-[11px] font-medium uppercase tracking-wider text-white/40">Izlet po meri (lasten naziv in cena)</span>
                <ChevronDown className={`h-4 w-4 text-white/40 transition-transform ${showCustomExcursion ? 'rotate-180' : ''}`} />
              </button>
              {showCustomExcursion && (
              <div className="space-y-3">
              <LuxuryInput label="Naziv izleta" value={customExcursionDraft.name} onChange={v => setCustomExcursionDraft(p => ({ ...p, name: v }))} />
              <LuxuryInput label="Cena EUR" type="number" value={customExcursionDraft.priceEur} onChange={v => setCustomExcursionDraft(p => ({ ...p, priceEur: Number(v) }))} />
              <p className="text-xs text-white/40">= {ar(Math.round(customExcursionDraft.priceEur * exchangeRate))}</p>
              <div>
                <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">Datum</label>
                <input
                  type="date"
                  className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white focus:border-[#7fa8b8]/40 focus:outline-none"
                  defaultValue={customExcursionDraft.date}
                  onBlur={e => setCustomExcursionDraft(p => ({ ...p, date: e.target.value }))}
                />
              </div>
              <LuxurySelect
                label="Status placila"
                value={customExcursionDraft.paymentStatus}
                onChange={v => setCustomExcursionDraft(p => ({ ...p, paymentStatus: v as "PAID" | "UNPAID" }))}
                options={[
                  { value: "UNPAID", label: "Za placilo" },
                  { value: "PAID", label: "Placano" }
                ]}
              />
              {customExcursionDraft.paymentStatus === 'PAID' && (
                <div className="space-y-3 rounded-xl border border-[#8fae92]/20 bg-[#8fae92]/[0.04] p-3">
                  <LuxurySelect
                    label="Nacin placila"
                    value={customExcursionDraft.paidMethod}
                    onChange={v => setCustomExcursionDraft(p => ({ ...p, paidMethod: v as "card" | "cash" | "transfer" }))}
                    options={[
                      { value: "cash", label: "Gotovina" },
                      { value: "card", label: "Kartica" },
                      { value: "transfer", label: "Bancno nakazilo" }
                    ]}
                  />
                  <div>
                    <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">Datum placila</label>
                    <input
                      type="date"
                      className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white focus:border-[#7fa8b8]/40 focus:outline-none"
                      defaultValue={customExcursionDraft.paidDate}
                      onBlur={e => setCustomExcursionDraft(p => ({ ...p, paidDate: e.target.value }))}
                    />
                  </div>
                </div>
              )}
              <LuxuryButton variant="gold" className="w-full" onClick={async () => {
                if (!customExcursionDraft.name.trim()) { showMsg("Vnesi naziv izleta"); return; }
                const isPaid = customExcursionDraft.paymentStatus === 'PAID';
                if (isPaid && !customExcursionDraft.paidDate) { showMsg("Vnesi datum placila"); return; }
                setSaving(true);
                const priceAr = Math.round(customExcursionDraft.priceEur * exchangeRate);
                await addOrderItem(reservation.id, {
                  name: customExcursionDraft.name.trim(),
                  category: "Izlet",
                  qty: 1,
                  priceAr: isPaid ? 0 : priceAr,
                  refPriceAr: priceAr, // real price kept for display, even when paid
                  paymentStatus: customExcursionDraft.paymentStatus,
                  paidMethod: isPaid ? customExcursionDraft.paidMethod : undefined,
                  paidDate: isPaid ? customExcursionDraft.paidDate : undefined,
                  eventDate: customExcursionDraft.date
                });
                setCustomExcursionDraft({ name: "", priceEur: 0, date: today(), paymentStatus: "UNPAID", paidMethod: "cash", paidDate: today() });
                refresh();
                setSaving(false);
              }} disabled={saving || !customExcursionDraft.name.trim()}>{saving ? "Dodajam..." : "Dodaj izlet po meri"}</LuxuryButton>
              </div>
              )}
            </div>
          </div>
        </GlassCard>
        <GlassCard>
          <SectionHeader eyebrow={reservation.guestName} title="Postavke za placilo" />
          <div className="mt-6 space-y-6 max-h-[500px] overflow-y-auto pr-2">
            {sortedDates.length === 0 && paidItems.length === 0 && notExecutedTransfers.length === 0 ? <p className="text-white/40">Ni postavk.</p> : null}
            
            {/* Executed Unpaid Items - grouped by date */}
            {sortedDates.map(date => (
              <div key={date} className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-gradient-to-r from-[#c59b5b]/30 to-transparent" />
                  <span className="text-sm font-medium text-[#c59b5b]">{formatDateSlo(date)}</span>
                  <div className="h-px flex-1 bg-gradient-to-l from-[#c59b5b]/30 to-transparent" />
                </div>
                {groupedByDate[date].map(item => (
                  <div key={item.id} className="rounded-2xl border border-[#0f2e3a]/12 bg-[#efe8da] p-4">
                   <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[#0f2e3a]">{toEnglishItemName(item.name)}</p>
                      <p className="mt-1 text-xs text-[#2b2622]/60">{item.category} | Qty {item.qty} | {ar(item.priceAr)}</p>
                      {!item.isTransfer && (
                        <p className="mt-0.5 text-[10px] text-[#2b2622]/45">
                          {item.isBarItem ? `Served by: ${item.staffName || 'Bar'}` : `Added by: ${item.addedBy || 'Urska'}`}
                          {entryTime(item.createdAt) && (
                            <span className="tabular-nums">{` · ${entryTime(item.createdAt)}`}</span>
                          )}
                        </p>
                      )}
                    </div>
                    {/* Stacked right-hand column: the pills share one 9px scale and a common
                        min-width so their left edges line up instead of reading ragged. The badge is
                        inlined rather than <LuxuryBadge> because that component is shared app-wide
                        and must keep its own 10px size — only the light-gold colors are borrowed. */}
                    <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
                      <span className="inline-flex min-w-[96px] items-center justify-center gap-1 whitespace-nowrap rounded-full border border-[#8f6d3a]/30 bg-[#8f6d3a]/10 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#7a5c2f]">Za placilo</span>
                      {!item.isTransfer && !item.isBarItem && (
                        <button
                          className="inline-flex min-w-[96px] cursor-pointer items-center justify-center gap-1 whitespace-nowrap rounded-full border border-[#3f6b7d]/30 bg-[#3f6b7d]/10 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#3f6b7d] transition-colors hover:bg-[#3f6b7d]/20"
                          onClick={() => {
                            setDateEditItem(item.id);
                            setDateEditVal(/^\d{4}-\d{2}-\d{2}$/.test(item.serviceDate || '') ? item.serviceDate! : '');
                          }}
                        ><Calendar className="h-2.5 w-2.5" />Popravi datum</button>
                      )}
                      {item.isBarItem && (
                        <button
                          className="inline-flex min-w-[96px] cursor-pointer items-center justify-center gap-1 whitespace-nowrap rounded-full border border-[#3f6b7d]/30 bg-[#3f6b7d]/10 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#3f6b7d] transition-colors hover:bg-[#3f6b7d]/20"
                          onClick={() => {
                            setQtyEditItem(item.id);
                            setQtyEditVal(String(item.qty ?? 1));
                          }}
                        ><Pencil className="h-2.5 w-2.5" />Popravi kolicino</button>
                      )}
                      {!item.isTransfer && (
                        <button className="inline-flex min-w-[96px] cursor-pointer items-center justify-center gap-1 whitespace-nowrap rounded-full border border-[#4f7a54]/30 bg-[#4f7a54]/10 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#4f7a54] transition-colors hover:bg-[#4f7a54]/20" onClick={() => handleToggleFree(item, true)}><Home className="h-2.5 w-2.5" />On House</button>
                      )}
                      <button className="inline-flex min-w-[96px] cursor-pointer items-center justify-center gap-1 whitespace-nowrap rounded-full border border-[#b0203a]/30 bg-[#b0203a]/10 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#b0203a] transition-colors hover:bg-[#b0203a]/20" onClick={() => handleDeleteOrder(item)}><Trash2 className="h-2.5 w-2.5" />Odstrani</button>
                    </div>
                   </div>
                   {dateEditItem === item.id && (
                     <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#0f2e3a]/10 pt-3">
                       <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-[#2b2622]/55">Nov datum:</span>
                       <input
                         type="date"
                         value={dateEditVal}
                         onChange={(e) => setDateEditVal(e.target.value)}
                         className="rounded-lg border border-[#0f2e3a]/20 bg-white/60 px-2.5 py-1 text-[13px] text-[#0f2e3a] [color-scheme:light]"
                       />
                       <button
                         disabled={saving}
                         onClick={() => handleSaveItemDate(item.id)}
                         className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[#4f7a54]/40 bg-[#4f7a54]/15 px-3 py-1 text-[11px] font-semibold text-[#4f7a54] transition-colors hover:bg-[#4f7a54]/25 disabled:opacity-50"
                       >Shrani</button>
                       <button
                         onClick={() => { setDateEditItem(null); setDateEditVal(""); }}
                         className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[#0f2e3a]/20 px-3 py-1 text-[11px] font-medium text-[#2b2622]/70 transition-colors hover:bg-[#0f2e3a]/5"
                       >Preklici</button>
                     </div>
                   )}
                   {qtyEditItem === item.id && (
                     <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#0f2e3a]/10 pt-3">
                       <label htmlFor={`qty-edit-${item.id}`} className="text-[11px] font-medium uppercase tracking-[0.1em] text-[#2b2622]/55">Pravilna kolicina:</label>
                       <input
                         id={`qty-edit-${item.id}`}
                         type="number"
                         min={1}
                         step={1}
                         inputMode="numeric"
                         value={qtyEditVal}
                         onChange={(e) => setQtyEditVal(e.target.value)}
                         onKeyDown={(e) => {
                           if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) handleSaveItemQty(item.id);
                         }}
                         className="w-20 rounded-lg border border-[#0f2e3a]/20 bg-white/60 px-2.5 py-1 text-[13px] tabular-nums text-[#0f2e3a] [color-scheme:light]"
                       />
                       <span className="text-[11px] tabular-nums text-[#2b2622]/55">
                         {'× '}{ar(item.priceAr)}{' = '}{ar((Number(qtyEditVal) > 0 ? Math.floor(Number(qtyEditVal)) : 0) * Number(item.priceAr || 0))}
                       </span>
                       <button
                         disabled={saving}
                         onClick={() => handleSaveItemQty(item.id)}
                         className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[#4f7a54]/40 bg-[#4f7a54]/15 px-3 py-1 text-[11px] font-semibold text-[#4f7a54] transition-colors hover:bg-[#4f7a54]/25 disabled:opacity-50"
                       >Shrani</button>
                       <button
                         onClick={() => { setQtyEditItem(null); setQtyEditVal(""); }}
                         className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[#0f2e3a]/20 px-3 py-1 text-[11px] font-medium text-[#2b2622]/70 transition-colors hover:bg-[#0f2e3a]/5"
                       >Preklici</button>
                     </div>
                   )}
                  </div>
                ))}
              </div>
            ))}
            
            {/* Not Executed Transfers - shown but not on invoice */}
            {notExecutedTransfers.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
                  <span className="text-sm font-medium text-white/40">Neizveden transfer (ni na dobavnici)</span>
                  <div className="h-px flex-1 bg-gradient-to-l from-white/10 to-transparent" />
                </div>
                {notExecutedTransfers.map(item => (
                  <div key={item.id} className="flex items-center justify-between rounded-2xl border border-white/[0.05] bg-white/[0.01] p-4 opacity-50">
                    <div>
                      <p className="text-white/60 line-through">{toEnglishItemName(item.name)}</p>
                      <p className="mt-1 text-xs text-white/30">{item.category} | Qty {item.qty} | {ar(item.priceAr)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <LuxuryBadge variant="default">Ni izveden</LuxuryBadge>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {/* Paid Items - shown as evidence, grouped by day (delivery note per day) */}
            {paidItems.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-gradient-to-r from-[#2a7897]/30 to-transparent" />
                  <span className="text-sm font-medium text-[#2a7897]">Ze placano (evidenca)</span>
                  <div className="h-px flex-1 bg-gradient-to-l from-[#2a7897]/30 to-transparent" />
                </div>
                {sortedPaidDates.map(date => (
                  <div key={date} className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="h-px flex-1 bg-gradient-to-r from-[#2a7897]/20 to-transparent" />
                      <span className="text-xs font-medium text-[#2a7897]/80">{formatDateSlo(date)}</span>
                      <div className="h-px flex-1 bg-gradient-to-l from-[#2a7897]/20 to-transparent" />
                    </div>
                    {groupedPaidByDate[date].map(item => (
                      <div key={item.id} className="flex items-center justify-between rounded-2xl border border-[#2a7897]/10 bg-[#2a7897]/5 p-4">
                        <div>
                          <p className="text-white/60">{toEnglishItemName(item.name)}</p>
                          <p className="mt-1 text-xs text-white/30">{item.category} | Qty {item.qty} | {ar(item.priceAr)}</p>
                          {!item.isTransfer && (
                            <p className="mt-0.5 text-[10px] text-white/30">
                              {item.isBarItem ? `Served by: ${item.staffName || 'Bar'}` : `Added by: ${item.addedBy || 'Urska'}`}
                              {entryTime(item.createdAt) && (
                                <span className="tabular-nums">{` · ${entryTime(item.createdAt)}`}</span>
                              )}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          {item.coveredByMealPlan ? (
                            <button
                              type="button"
                              disabled={saving}
                              title="Klikni, da obrok ni vec vkljucen v penzion in se doda racunu kot za placilo"
                              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[#4f7a54]/40 bg-[#4f7a54]/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7fae86] transition-colors hover:border-[#b0203a]/50 hover:bg-[#b0203a]/15 hover:text-[#e0687c] disabled:opacity-50"
                              onClick={() => handleToggleMealCovered(item, false)}
                            >
                              Vkljuceno (penzion)
                              <span className="text-[9px] font-normal normal-case tracking-normal opacity-70">— dodaj na racun</span>
                            </button>
                          ) : (
                            <LuxuryBadge variant="petrol">{item.isFree ? "Brezplacno (hisa)" : item.paymentStatus === "PREPAID" ? "Predplacano" : "Placano"}</LuxuryBadge>
                          )}
                          {item.isFree && (
                            <button className="cursor-pointer text-white/50 transition-colors hover:text-white/80" onClick={() => handleToggleFree(item, false)}>Placljivo</button>
                          )}
                          <button className="inline-flex cursor-pointer items-center gap-1 text-[#bc7d67] transition-colors hover:text-[#bc7d67]/70" onClick={() => handleDeleteOrder(item)}><Trash2 className="h-4 w-4" />Odstrani</button>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </GlassCard>
      </section>
    );
  }

  
  // ============ EXCURSIONS MANAGER ============
  function ExcursionsManager() {
    const [selectedReservationId, setSelectedReservationId] = React.useState<string>("");
    const [newBooking, setNewBooking] = React.useState({ excursionId: "", date: today(), pax: 2, boatId: "", lunchProviderId: "", paymentStatus: "UNPAID", paidMethod: "cash", paidDate: today() });
    const [saving, setSaving] = React.useState(false);
    const [showAddExcursionType, setShowAddExcursionType] = React.useState(false);
    const [newExcursionType, setNewExcursionType] = React.useState({ name: "", guidePriceAr: 0, entranceFeeAr: 0, lunchPriceAr: 0 });
    
    // Get all excursions from all reservations (cancelled/credited ones excluded).
    const allExcursions = reservations.flatMap(r => 
      (r.excursions || []).filter(exc => exc.status !== 'CANCELLED').map(exc => ({
        ...exc,
        guestName: r.guestName,
        bungalow: r.bungalow,
        reservationId: r.id,
        arrival: r.arrival,
        departure: r.departure
      }))
    ).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    
    // Active guests (checked in, not checked out)
    const activeGuests = reservations.filter(r => r.checkedInAt && !r.checkedOutAt);
    
    async function handleAddBooking() {
      if (!selectedReservationId || !newBooking.excursionId) {
        showMsg("Izberi gosta in izlet!");
        return;
      }
      const isPaid = newBooking.paymentStatus === 'PAID';
      if (isPaid && !newBooking.paidDate) { showMsg("Vnesi datum placila"); return; }
      setSaving(true);
      await addExcursionBooking(selectedReservationId, {
        excursionId: newBooking.excursionId,
        date: newBooking.date,
        pax: newBooking.pax,
        boatId: newBooking.boatId || undefined,
        lunchProviderId: newBooking.lunchProviderId || undefined,
        paymentStatus: newBooking.paymentStatus,
        paidMethod: isPaid ? newBooking.paidMethod : undefined,
        paidDate: isPaid ? newBooking.paidDate : undefined
      });
      setNewBooking({ excursionId: "", date: today(), pax: 2, boatId: "", lunchProviderId: "", paymentStatus: "UNPAID", paidMethod: "cash", paidDate: today() });
      refresh();
      setSaving(false);
      showMsg("Izlet dodan!");
    }
    
    async function handleAddExcursionType() {
      if (!newExcursionType.name.trim()) {
        showMsg("Vnesi ime izleta!");
        return;
      }
      setSaving(true);
      await addExcursion(newExcursionType);
      setNewExcursionType({ name: "", guidePriceAr: 0, entranceFeeAr: 0, lunchPriceAr: 0 });
      setShowAddExcursionType(false);
      refresh();
      setSaving(false);
      showMsg("Izlet dodan v cenik!");
    }
    
    async function handleDeleteExcursionType(id: string, name: string) {
      if (!confirm(`Izbrisi izlet "${name}" iz cenika?`)) return;
      await deleteExcursion(id);
      refresh();
      showMsg("Izlet izbrisan iz cenika.");
    }
    
    return (
      <div className="grid gap-8 lg:grid-cols-[400px_1fr]">
        {/* Left Column - Forms */}
        <div className="space-y-6">
          {/* Add Excursion Booking Form */}
          <GlassCard className="h-fit">
            <SectionHeader eyebrow="Nova rezervacija" title="Dodaj izlet gostu" />
            
            <div className="mt-6 space-y-4">
              <LuxurySelect 
                label="Gost" 
                value={selectedReservationId} 
                onChange={v => {
                  setSelectedReservationId(v);
                  const guest = reservations.find(r => r.id === v);
                  if (guest) setNewBooking(p => ({ ...p, pax: guest.pax }));
                }} 
                options={[
                  { value: "", label: "Izberi gosta" },
                  ...activeGuests.map(r => ({ value: r.id, label: `${r.guestName} (${bungalowDisplayName(r.bungalow)})` }))
                ]} 
              />
              
              <LuxurySelect 
                label="Izlet" 
                value={newBooking.excursionId} 
                onChange={v => setNewBooking(p => ({ ...p, excursionId: v }))} 
                options={[
                  { value: "", label: "Izberi izlet" },
                  ...dbExcursions.map((e: { id: string; name: string }) => ({ value: e.id, label: e.name }))
                ]} 
              />
              
              <LuxuryInput 
                label="Datum" 
                type="date" 
                value={newBooking.date} 
                onChange={v => setNewBooking(p => ({ ...p, date: v }))} 
              />
              
              <LuxuryInput 
                label="Stevilo oseb" 
                type="number" 
                value={newBooking.pax} 
                onChange={v => setNewBooking(p => ({ ...p, pax: Number(v) }))} 
              />
              
              <LuxurySelect 
                label="Coln" 
                value={newBooking.boatId} 
                onChange={v => setNewBooking(p => ({ ...p, boatId: v }))} 
                options={[
                  { value: "", label: "Ni izbrano" },
                  ...dbBoats.map((b: { id: string; name: string }) => ({ value: b.id, label: b.name }))
                ]} 
              />
              
              <LuxurySelect 
                label="Kosilo" 
                value={newBooking.lunchProviderId} 
                onChange={v => setNewBooking(p => ({ ...p, lunchProviderId: v }))} 
                options={[
                  { value: "", label: "Ni izbrano" },
                  ...dbLunchProviders.map((l: { id: string; name: string }) => ({ value: l.id, label: l.name }))
                ]} 
              />
              
              <LuxurySelect 
                label="Status placila" 
                value={newBooking.paymentStatus} 
                onChange={v => setNewBooking(p => ({ ...p, paymentStatus: v }))} 
                options={[
                  { value: "UNPAID", label: "Za placilo" },
                  { value: "PAID", label: "Placano" }
                ]} 
              />
              {newBooking.paymentStatus === 'PAID' && (
                <div className="space-y-3 rounded-xl border border-[#8fae92]/20 bg-[#8fae92]/[0.04] p-3">
                  <LuxurySelect
                    label="Nacin placila"
                    value={newBooking.paidMethod}
                    onChange={v => setNewBooking(p => ({ ...p, paidMethod: v }))}
                    options={[
                      { value: "cash", label: "Gotovina" },
                      { value: "card", label: "Kartica" },
                      { value: "transfer", label: "Bancno nakazilo" }
                    ]}
                  />
                  <div>
                    <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">Datum placila</label>
                    <input
                      type="date"
                      className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white focus:border-[#7fa8b8]/40 focus:outline-none"
                      defaultValue={newBooking.paidDate}
                      onBlur={e => setNewBooking(p => ({ ...p, paidDate: e.target.value }))}
                    />
                  </div>
                </div>
              )}
              
              <LuxuryButton variant="gold" className="w-full" onClick={handleAddBooking} disabled={saving}>
                {saving ? "Dodajam..." : "Dodaj izlet gostu"}
              </LuxuryButton>
            </div>
          </GlassCard>
          
          {/* Manage Excursion Types */}
          <GlassCard className="h-fit">
            <SectionHeader eyebrow="Cenik" title="Vrste izletov" />
            
            <div className="mt-4">
              <button
                onClick={() => setShowAddExcursionType(!showAddExcursionType)}
                className="w-full px-4 py-2 rounded-xl bg-gradient-to-r from-[#7fa8b8]/20 to-[#7fa8b8]/10 border border-[#7fa8b8]/30 text-[#7fa8b8] text-sm font-medium hover:bg-[#7fa8b8]/20 transition-colors"
              >
                {showAddExcursionType ? "Preklici" : "+ Dodaj nov izlet"}
              </button>
            </div>
            
            {showAddExcursionType && (
              <div className="mt-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-3">
                <LuxuryInput label="Ime izleta" value={newExcursionType.name} onChange={v => setNewExcursionType(p => ({ ...p, name: v }))} placeholder="Npr. Lokobe" />
                <LuxuryInput label="Vodic (Ar)" type="number" value={newExcursionType.guidePriceAr} onChange={v => setNewExcursionType(p => ({ ...p, guidePriceAr: Number(v) }))} />
                <LuxuryInput label="Vstopnina (Ar)" type="number" value={newExcursionType.entranceFeeAr} onChange={v => setNewExcursionType(p => ({ ...p, entranceFeeAr: Number(v) }))} />
                <LuxuryInput label="Kosilo (Ar)" type="number" value={newExcursionType.lunchPriceAr} onChange={v => setNewExcursionType(p => ({ ...p, lunchPriceAr: Number(v) }))} />
                <LuxuryButton variant="ocean" className="w-full" onClick={handleAddExcursionType} disabled={saving}>
                  {saving ? "Shranjujem..." : "Shrani izlet"}
                </LuxuryButton>
              </div>
            )}
            
            {/* List of excursion types */}
            <div className="mt-4 space-y-2">
              {dbExcursions.map((exc: { id: string; name: string; guidePriceAr?: number; entranceFeeAr?: number; lunchPriceAr?: number }) => (
                <div key={exc.id} className="flex items-center justify-between p-3 rounded-xl border border-white/[0.06] bg-white/[0.02]">
                  <div>
                    <p className="text-sm text-white font-medium">{exc.name}</p>
                    <p className="text-xs text-white/40 mt-0.5">
                      Vodic: {ar(exc.guidePriceAr || 0)} | Vstop: {ar(exc.entranceFeeAr || 0)} | Kosilo: {ar(exc.lunchPriceAr || 0)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteExcursionType(exc.id, exc.name)}
                    className="p-2 rounded-lg hover:bg-red-500/10 text-white/40 hover:text-red-400 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
        
        {/* Right Column - Excursions List */}
        <GlassCard>
          <SectionHeader eyebrow="Pregled" title="Vsi izleti gostov" subtitle={`${allExcursions.length} rezerviranih izletov`} />
          
          {allExcursions.length === 0 ? (
            <p className="mt-8 text-center text-white/50">Ni rezerviranih izletov.</p>
          ) : (
            <div className="mt-6 space-y-4">
              {allExcursions.map(exc => {
                const excursionData = dbExcursions.find((e: { id: string }) => e.id === exc.excursionId);
                const boatData = dbBoats.find((b: { id: string }) => b.id === exc.boatId);
                const lunchData = dbLunchProviders.find((l: { id: string }) => l.id === exc.lunchProviderId);
                return (
                  <div key={exc.id} className="p-4 rounded-xl border border-[#7fa8b8]/20 bg-[#7fa8b8]/5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-white">{excursionData?.name || "Neznani izlet"}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${exc.paymentStatus === 'PAID' ? 'bg-[#8fae92]/20 text-[#8fae92]' : 'bg-red-500/20 text-red-400'}`}>
                            {exc.paymentStatus === 'PAID' ? 'PLACANO' : 'ZA PLACILO'}
                          </span>
                        </div>
                        <p className="text-sm text-white/60 mt-1">{exc.guestName} ({bungalowDisplayName(exc.bungalow)})</p>
                        <div className="flex flex-wrap gap-3 mt-2 text-xs text-white/40">
                          <span>Datum: {exc.date || 'Ni nastavljen'}</span>
                          <span>Oseb: {exc.pax}</span>
                          {boatData && <span>Coln: {boatData.name}</span>}
                          {lunchData && <span>Kosilo: {lunchData.name}</span>}
                        </div>
                      </div>
                      <button
                        onClick={async () => {
                          try {
                            await deleteExcursionBooking(exc.id);
                            showMsg("Izlet izbrisan.");
                            refresh();
                          } catch (err) {
                            showMsg("Napaka pri brisanju izleta: " + (err instanceof Error ? err.message : "Neznana napaka"));
                          }
                        }}
                        className="text-red-400/60 hover:text-red-400 text-xs"
                      >
                        Odstrani
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </GlassCard>
      </div>
    );
  }

  // ============ BENTRAL MANAGER ============
  function BentralManager() {
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
    const [showTransferred, setShowTransferred] = React.useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    async function loadBentralData() {
      const { getBentralReservations } = await import("@/app/actions/komba");
      const data = await getBentralReservations({ status: statusFilter });
      setBentralData(data as typeof bentralData);
    }

    React.useEffect(() => { loadBentralData(); }, [statusFilter]);

    async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
      const file = e.target.files?.[0];
      if (!file) return;
      
      setImporting(true);
      setImportResult(null);
      
      try {
        const text = await file.text();
        const { importBentralCSV } = await import("@/app/actions/komba");
        const result = await importBentralCSV(text);
        setImportResult(result);
        loadBentralData();
        showMsg(`Import uspesen: ${result.imported} novih, ${result.updated} posodobljenih`);
      } catch (err) {
        showMsg("Napaka pri importu!");
      }
      
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }

    async function handleTransfer(id: string) {
      setTransferring(id);
      try {
        const { transferBentralReservation } = await import("@/app/actions/komba");
        await transferBentralReservation(id);
        showMsg("Rezervacija prenesena v sistem!");
        loadBentralData();
      } catch (err) {
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
      <section className="space-y-8">
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

          <div className="mt-6 flex gap-4">
            <div className="w-48">
              <LuxurySelect label="Filter po statusu" value={statusFilter} onChange={setStatusFilter} options={statusOptions} />
            </div>
          </div>
        </GlassCard>

        {/* Reservations List */}
        <GlassCard>
          <div className="flex items-center justify-between">
            <SectionHeader eyebrow="Reservations" title="Seznam rezervacij" subtitle={bentralData ? `${bentralData.filter(r => showTransferred || !r.transferred).length} rezervacij` : "Nalagam..."} />
            <label className="flex items-center gap-2 text-sm text-white/50">
              <input type="checkbox" checked={showTransferred} onChange={e => setShowTransferred(e.target.checked)} className="rounded" />
              Prikazi prenesene
            </label>
          </div>
          
          {!bentralData ? (
            <div className="mt-8 flex justify-center">
              <RefreshCw className="h-6 w-6 animate-spin text-[#c59b5b]" />
            </div>
          ) : bentralData.filter(r => showTransferred || !r.transferred).length === 0 ? (
            <p className="mt-8 text-center text-white/50">Ni rezervacij. Uvozi CSV iz Bentral.</p>
          ) : (
            <div className="mt-6 space-y-4">
              {bentralData.filter(r => showTransferred || !r.transferred).map(res => (
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
                        <LuxuryButton variant="ghost" onClick={() => setTab("reservations")}>
                          Odpri rezervacijo
                        </LuxuryButton>
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
      </section>
    );
  }

  // Navigation config with module-specific colors
  const nav: [string, string, typeof Home, "gold" | "petrol" | "ocean"][] = [
    ["borut", "Borut", User, "petrol"],
    ["urska", "Urška", UserRound, "gold"],
  ];
  // Bungalovi + Rezervacije belong to both people, so they head each landing page.
  const stayEntries = (): PersonEntry[] => [
    { id: "bungalows", label: "Bungalovi", icon: Home, tab: "bungalows" },
    { id: "reservations", label: "Rezervacije", icon: LogIn, tab: "reservations" },
  ];
  // Per-person landing pages. An entry either switches a tab, follows a route,
  // or runs an action (modal) — so all former header menus fit here unchanged.
  type PersonEntry = {
    id: string;
    label: string;
    icon: typeof Home;
    tab?: string;
    href?: string;
    action?: () => void;
    // A group: the tile becomes a toggle and these open underneath it.
    children?: PersonEntry[];
  };
  type PersonSection = { label?: string; items: PersonEntry[] };
  const personPages: Record<string, {
    label: string;
    icon: typeof Home;
    accent: string;
    // Borut works from a phone and wants one big press target per module.
    tiles?: boolean;
    sections: PersonSection[];
  }> = {
    borut: {
      label: "Borut",
      icon: User,
      accent: "#8fae92",
      tiles: true,
      sections: [
        {
          items: [
            // Vreme first: wind, sea and tide decide whether the boat runs at
            // all, so it is read before anything that assumes it does.
            { id: "vreme", label: "Vreme", icon: Wind, tab: "vreme" },
            { id: "koledar", label: "Koledar", icon: Calendar, tab: "koledar" },
            ...stayEntries(),
            { id: "opomnik", label: "Opomnik", icon: StickyNote, tab: "opomnik" },
            { id: "bankstanje", label: "Stanje na računu", icon: Landmark, tab: "bankstanje" },
            // Phone directory: opens a tab with call buttons. Numbers come from
            // the Orange Money phone directory (phone_contacts table).
            { id: "imenik", label: "Telefonski imenik", icon: Phone, tab: "imenik" },
            // View-only schedules. Creating them and all payroll figures stay in
            // Urška's Kadrovski oddelek.
            { id: "razporedi", label: "Razporedi", icon: Users, children: [
              { id: "razpored-sobarice", label: "Sobarice", icon: Sparkles, tab: "razpored-sobarice" },
              { id: "razpored-vrtnarji", label: "Vrtnarji", icon: Leaf, tab: "razpored-vrtnarji" },
              { id: "razpored-kuhinja", label: "Kuhinja", icon: Utensils, tab: "razpored-kuhinja" },
              { id: "razpored-bar", label: "Bar", icon: Wine, tab: "razpored-bar" },
            ] },
            { id: "novracun", label: "Nov račun", icon: Receipt, action: () => setShowReceiptCapture(true) },
          ],
        },
      ],
    },
    urska: {
      label: "Urška",
      icon: UserRound,
      accent: "#c59b5b",
      tiles: true,
      sections: [
        {
          items: [
            ...stayEntries(),
          ],
        },
        {
          label: "Blagajna",
          items: [
            { id: "bar", label: "Bar", icon: Wine, children: [
          { id: "barblagajna", label: "Bar blagajna", icon: Wine, href: "/staff" },
          { id: "prijave", label: "Prijave v blagajno", icon: LogIn, tab: "prijave" },
        ] },
            { id: "recepcija", label: "Recepcija", icon: Sofa, href: "/recepcija" },
          ],
        },
        {
          label: "Statistika",
          items: [
            { id: "kalkulacije", label: "Kalkulacije", icon: BarChart3, children: [
              { id: "kalkulacije-finance", label: "Finance", icon: Landmark, href: "/statistika?tab=kalkulacije&view=finance" },
            ] },
            { id: "kadrovske", label: "Kadrovske", icon: UserCog, href: "/statistika?tab=kadri" },
            { id: "emaili", label: "Emaili", icon: Mail, tab: "emaili" },
            { id: "anketa", label: "Anketa", icon: MessageSquare, tab: "anketa" },
          ],
        },
        {
          label: "Baza",
          items: [
            { id: "bentral", label: "Bentral", icon: Database, href: "/bentral" },
            { id: "arhiv", label: "Arhiv", icon: Archive, href: "/arhiv" },
            { id: "arhiv-transferji", label: "Arhiv transferjev", icon: Ship, href: "/arhiv-transferji" },
            { id: "arhiv-izleti", label: "Arhiv izletov", icon: Palmtree, href: "/arhiv-izleti" },
            { id: "arhiv-nakupi-hv", label: "Arhiv nakupov HV", icon: ShoppingCart, href: "/arhiv-nakupi-hv" },
            { id: "arhiv-nakupi-komba", label: "Arhiv nakupov Komba", icon: ShoppingCart, href: "/arhiv-nakupi-komba" },
            { id: "pretekle-rezervacije", label: "Vnos pretekle rezervacije", icon: FileText, href: "/pretekle-rezervacije" },
            { id: "ceniki", label: "Ceniki", icon: Settings, href: "/admin" },
            { id: "takse", label: "Takse", icon: Landmark, action: () => setShowTaxes(true) },
          ],
        },
      ],
    },
  };

  // Count pending transfers:
  // - Arrivals: only for guests NOT yet checked in
  // - Departures: only for guests who ARE checked in but not checked out
  // Reception (ad-hoc) transfers are stored as order_items category "Transfer" whose
  // name starts with "Transfer:" (the arrival/departure ones are "Transfer ARRIVAL/DEPARTURE").
  const todayMidnightMs = (() => { const x = new Date(); x.setHours(0, 0, 0, 0); return x.getTime(); })();
  const isReceptionTransferItem = (o: { category?: string; name?: string | null }) =>
    o.category === 'Transfer' && /^transfer:\s/i.test((o.name || ''));
  const receptionTransferActive = (o: { category?: string; name?: string | null; eventDate?: string | null }) => {
    if (!isReceptionTransferItem(o)) return false;
    if (!o.eventDate) return true;
    const d = new Date(o.eventDate); d.setHours(0, 0, 0, 0);
    return d.getTime() >= todayMidnightMs; // hide reception transfers once the day has passed
  };

  const pendingCount = reservations.reduce((count, r) => {
    let transfers = 0;
    // Arrival transfer: show only if guest is NOT checked in yet
    if (r.transfers.arrival.route && !r.checkedInAt && !r.checkedOutAt) transfers++;
    // Departure transfer: show ahead of time too (until guest checks out), so it can be
    // booked in advance — consistent with the arrival, regardless of check-in status.
    if (r.transfers.departure.route && !r.checkedOutAt) transfers++;
    // Reception ad-hoc transfers (from the recepcija cash desk)
    if (!r.checkedOutAt) transfers += (r.orderItems || []).filter(receptionTransferActive).length;
    return count + transfers;
  }, 0);

  // Build list of all pending transfers
  const pendingTransfersList = reservations
    .filter(r => !r.checkedOutAt)
    .flatMap(r => {
      const list: { type: 'arrival' | 'departure'; reservation: typeof r; transfer: typeof r.transfers.arrival }[] = [];
      // Arrival: only if NOT checked in yet
      if (r.transfers.arrival.route && !r.checkedInAt) {
        list.push({ type: 'arrival', reservation: r, transfer: r.transfers.arrival });
      }
      // Departure: show ahead of time too (guest not yet checked out), consistent with
      // arrival, so the departure boat/car can be arranged before the guest arrives.
      if (r.transfers.departure.route) {
        list.push({ type: 'departure', reservation: r, transfer: r.transfers.departure });
      }
      return list;
    })
    .sort((a, b) => {
      const dateA = a.type === 'arrival' ? a.reservation.arrival : a.reservation.departure;
      const dateB = b.type === 'arrival' ? b.reservation.arrival : b.reservation.departure;
      return new Date(dateA).getTime() - new Date(dateB).getTime();
    });

  // Reception ad-hoc transfers as their own pending items (shown alongside arrival/departure)
  const receptionTransfersList = reservations
    .filter(r => !r.checkedOutAt)
    .flatMap(r =>
      (r.orderItems || [])
        .filter(receptionTransferActive)
        .map(o => ({ type: 'reception' as const, reservation: r, order: o }))
    );

  // Combined list used for the day-grouped visual pending list (reminder logic keeps
  // using pendingTransfersList only, since ordering state lives on the transfers table).
  const pendingTransfersForDisplay = [...pendingTransfersList, ...receptionTransfersList];
  
  // ===== Daily reminder (next to the calendar) =====
  const [reminderDate, setReminderDate] = React.useState<string>(today());
  // Same key the reminder itself uses, so the landing page counts only what is
  // still open — ticking an item off there updates this summary too.
  const { data: reminderChecks } = useSWR(["reminder-checks", reminderDate], () => getReminderChecks(reminderDate), { refreshInterval: 0 });
  const { data: nabavaTrips, mutate: mutateNabava } = useSWR("nabava-trips", getNabavaTrips, { refreshInterval: 0 });
  const nabavaList = nabavaTrips || [];
  // Same UTC+3 "today" boundary the purchase archive uses, so the current day's
  // trips stay on the Nabava tiles and only move to the archive once the day ends.
  const nabavaToday = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
  // Back-dated trips entered today stay on the tile so purchases can still be added to them.
  const nabavaCreatedDay = (createdAt: string) =>
    createdAt ? new Date(new Date(createdAt).getTime() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10) : "";
  const nabavaOnTile = (t: { date: string; createdAt: string }) =>
    !t.date || t.date >= nabavaToday || nabavaCreatedDay(t.createdAt) === nabavaToday;
  const nabavaHvList = nabavaList.filter((t) => t.site !== "komba" && nabavaOnTile(t));
  const nabavaKombaList = nabavaList.filter((t) => t.site === "komba" && nabavaOnTile(t));
  const reminderDateLabel = (() => {
    const d = new Date(reminderDate + "T00:00:00");
    if (isNaN(d.getTime())) return reminderDate;
    return d.toLocaleDateString("sl-SI", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  })();
  const reminderSections: ReminderSection[] = (() => {
    const boatName = (id: string | null | undefined) => dbBoats.find((b: { id: string; name: string }) => b.id === id)?.name;
    const routeName = (id: string | null | undefined) => dbRoutes.find((rt: { id: string; name: string }) => rt.id === id)?.name || id || "";
    // Date one day after the selected day (transfers must be ordered a day ahead).
    // Compute in UTC so it stays consistent with today() and the DB date strings
    // (a local-time parse + toISOString would shift the day under a +TZ offset).
    const nextDay = (() => {
      const d = new Date(reminderDate + "T00:00:00Z");
      d.setUTCDate(d.getUTCDate() + 1);
      return d.toISOString().slice(0, 10);
    })();
    const nextDayLabel = (() => {
      const d = new Date(nextDay + "T00:00:00");
      return isNaN(d.getTime()) ? nextDay : d.toLocaleDateString("sl-SI", { day: "numeric", month: "long" });
    })();
    // Build the transfer text line for one pending-transfer item
    const transferLine = (item: (typeof pendingTransfersList)[number]) => {
      const t = item.transfer;
      const r = item.reservation;
      const dir = item.type === "arrival" ? "Prihod" : "Odhod";
      const parts = [`${dir}: ${bungalowDisplayName(r.bungalow)} - ${r.guestName}`, routeName(t.route)];
      if (boatName(t.boatId)) parts.push(`čoln ${boatName(t.boatId)}`);
      if (t.time) parts.push(`ob ${t.time}`);
      if (t.hermanRouteId) parts.push(`Herman: ${routeName(t.hermanRouteId)}`);
      const ordered = t.dilipOrderedAt ? " [Dilip naročen]" : "";
      return parts.filter(Boolean).join(" �� ") + ordered;
    };
    const transferKey = (item: (typeof pendingTransfersList)[number]) => {
      const eff = item.type === "arrival" ? item.reservation.arrival : item.reservation.departure;
      return String(item.transfer.pickupDate || eff).slice(0, 10);
    };
    // Transports that happen TOMORROW but must be ordered TODAY (Borut calls Dilip/Herman a day ahead)
    const orderAhead = pendingTransfersList
      .filter((item) => transferKey(item) === nextDay)
      .map((item) => ({ id: `orderAhead::${item.reservation.id}::${item.type}`, text: `${transferLine(item)}  →  naročiti danes (jutri, ${nextDayLabel})` }));
    // Guests departing TOMORROW — Urška must prepare the invoice a day ahead
    const prepareInvoice = reservations
      .filter((r) => r.status !== "CANCELLED" && String(r.departure).slice(0, 10) === nextDay)
      .map((r) => ({ id: `prepareInvoice::${r.id}`, text: `${bungalowDisplayName(r.bungalow)} · ${r.guestName} · ${r.pax} os  →  pripraviti račun danes (odhod jutri, ${nextDayLabel})` }));
    // Guests departing TOMORROW — Borut must prepare the farewell gift a day ahead
    const prepareGift = reservations
      .filter((r) => r.status !== "CANCELLED" && String(r.departure).slice(0, 10) === nextDay)
      .map((r) => ({ id: `prepareGift::${r.id}`, text: `${bungalowDisplayName(r.bungalow)} �� ${r.guestName} · ${r.pax} os  ��  pripraviti darilo danes (odhod jutri, ${nextDayLabel})` }));
    // Guest excursions happening TOMORROW must be ordered TODAY (a day ahead) — from the guests' own bookings
    const excName = (id: string) => data?.excursions?.find((e: { id: string; name: string }) => e.id === id)?.name || "Izlet";
    const orderExcursionsAhead = reservations
      .filter((r) => r.status !== "CANCELLED" && r.status !== "CHECKED_OUT")
      .flatMap((r) =>
        (r.excursions || [])
          .filter((exc) => exc.status !== "CANCELLED" && String(exc.date).slice(0, 10) === nextDay)
          .map((exc) => ({
            id: `orderExcAhead::${exc.id}`,
            text: `${bungalowDisplayName(r.bungalow)} · ${r.guestName} · ${excName(exc.excursionId)} (${exc.pax} os)  →  naročiti danes (jutri, ${nextDayLabel})${exc.dilipOrderedAt ? " [naročeno]" : ""}`,
          })),
      );
    // Guests IN HOUSE with any police/registration field still empty — Urška sends the check-in email
    const POLICE_FIELDS = ["nationality", "passport", "dateOfBirth", "placeOfBirth", "fatherName", "motherName", "profession", "domicile", "passportDate", "passportLieu", "venantDe", "validiteVisa", "allantA"];
    const SLOT_PREFIX = ["", "second", "third", "fourth"];
    const guestField = (r: (typeof reservations)[number], slot: number, base: string) => {
      const col = slot === 0 ? base : SLOT_PREFIX[slot] + base.charAt(0).toUpperCase() + base.slice(1);
      return (r as unknown as Record<string, unknown>)[col];
    };
    const isEmpty = (v: unknown) => v === null || v === undefined || String(v).trim() === "";
    const policeEmail = reservations
      // Rule: once a guest is checked out (or has already departed) their data can no longer be
      // collected, so the police-email reminder must disappear for them.
      .filter(
        (r) =>
          r.status !== "CANCELLED" &&
          r.checkedInAt &&
          !r.checkedOutAt &&
          String(r.departure).slice(0, 10) >= reminderDate,
      )
      .filter((r) => {
        const slots = Math.min(4, Math.max(1, Number(r.pax) || 1));
        for (let s = 0; s < slots; s++) {
          // Skip extra guest slots that were never named
          if (s > 0 && isEmpty(guestField(r, s, "guestName"))) continue;
          if (POLICE_FIELDS.some((f) => isEmpty(guestField(r, s, f)))) return true;
        }
        return false;
      })
      .map((r) => ({ id: `policeEmail::${r.id}`, text: `${bungalowDisplayName(r.bungalow)} · ${r.guestName} · ${r.pax} os  ���  pošlji email za prijavo/policijo (manjkajo podatki)` }));
    // Scheduled excursions that day — ONLY show those a guest is actually booked on
    const excursions = dbScheduledExcursions
      .filter((s) => String(s.date).slice(0, 10) === reminderDate && (s.guests || []).length > 0)
      .map((s) => {
        const base = scheduleTypeLabel(s.excursionType) + (s.isOption ? " (opcija)" : "");
        const guests = (s.guests || []).map((g) => `${g.guestName} (${bungalowDisplayName(g.bungalow)}, ${g.pax} os)`);
        return { id: `excursions::${s.id}`, text: `${base} — ${guests.join("; ")}` };
      });
    return [
      { key: "policeEmail", title: "Poslati email za prijavo/policijo — manjkajo podatki (Urška)", items: policeEmail },
      { key: "prepareInvoice", title: "Pripraviti račun dan prej (Urška)", items: prepareInvoice },
      { key: "orderAhead", title: "Naročiti prevoz dan prej — Dilip/Herman (Borut)", items: orderAhead },
      { key: "orderExcursionsAhead", title: "Naročiti izlet dan prej (Borut)", items: orderExcursionsAhead },
      { key: "prepareGift", title: "Pripraviti darilo dan prej (Borut)", items: prepareGift },
      { key: "excursions", title: "Izleti", items: excursions },
    ];
  })();

  // Combined transfer view: arrivals + departures together, grouped by day so the
  // events that are up next (today/tomorrow) are always on top, not buried below
  // all future arrivals (the old two-column layout stacked all arrivals, then all
  // departures, on mobile).
  const startOfDayMs = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); };
  const todayKeyMs = startOfDayMs(new Date());
  const tomorrowKeyMs = todayKeyMs + 86400000;
  const transferGroupMap = new Map<number, typeof pendingTransfersForDisplay>();
  for (const item of pendingTransfersForDisplay) {
    let effRaw: string;
    if (item.type === 'reception') {
      effRaw = item.order.eventDate || '';
    } else {
      const eff = item.type === 'arrival' ? item.reservation.arrival : item.reservation.departure;
      effRaw = item.transfer.pickupDate || eff;
    }
    if (!effRaw) continue;
    const k = startOfDayMs(new Date(effRaw));
    const arr = transferGroupMap.get(k) || [];
    arr.push(item);
    transferGroupMap.set(k, arr);
  }
  const transferGroups = [...transferGroupMap.keys()].sort((a, b) => a - b).map((k) => ({
    key: k,
    items: transferGroupMap.get(k)!,
    label: k === todayKeyMs ? 'Danes' : k === tomorrowKeyMs ? 'Jutri' : new Date(k).toLocaleDateString('sl-SI', { weekday: 'short', day: 'numeric', month: 'short' }),
    urgent: k <= tomorrowKeyMs,
  }));

  // Plačilo dobavitelju prevoza (Dilip/Herman) — isti vzorec kot pri Fanji, keyiran po refKey.
  // supplierLabel je npr. 'Dilip (čoln)' / 'Herman (avto)'; label gre v opis vknjižbe.
  const renderSupplierPay = (refKey: string, supplier: string, amountAr: number, supplierLabel: string, label: string, accentOverride?: string) => {
    const paid = supplierPayByKey[refKey];
    const accent = accentOverride || (supplier === 'dilip' ? '#3f6b7d' : '#4f7a54');
    if (supPayOpen === refKey) {
      return (
        <div className="mt-2 rounded-lg p-2.5 space-y-2.5" style={{ border: `1px solid ${accent}40`, backgroundColor: `${accent}0d` }}>
          <p className="text-[11px] font-semibold" style={{ color: accent }}>{paid ? 'Uredi plačilo' : 'Plačilo'} · {supplierLabel} · {ar(amountAr)}</p>
          <div className="flex gap-2">
            {(['cash', 'orange'] as const).map(m => (
              <button key={m} onClick={() => setSupPayMethod(m)}
                className={`flex-1 rounded-lg px-3 py-2 text-[11px] font-medium border transition-colors ${supPayMethod === m ? '' : 'bg-[#0f2e3a]/5 text-[#2b2622]/60 border-[#0f2e3a]/15 hover:bg-[#0f2e3a]/10'}`}
                style={supPayMethod === m ? { backgroundColor: `${accent}22`, borderColor: `${accent}66`, color: accent } : undefined}>
                {m === 'cash' ? 'Gotovina' : 'Orange Money'}
              </button>
            ))}
          </div>
          {supPayMethod === 'cash' && (
            <div className="flex gap-2">
              {(['tourism', 'sarl'] as const).map(c => (
                <button key={c} onClick={() => setSupPayCompany(c)}
                  className={`flex-1 rounded-lg px-3 py-2 text-[10px] font-medium border transition-colors ${supPayCompany === c ? 'bg-[#4f7a54]/15 text-[#4f7a54] border-[#4f7a54]/40' : 'bg-[#0f2e3a]/5 text-[#2b2622]/60 border-[#0f2e3a]/15 hover:bg-[#0f2e3a]/10'}`}>
                  {c === 'tourism' ? 'KOMBA CABANA TOURISM SARL' : 'KOMBA CABANA SARL'}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[#2b2622]/55">Datum plačila:</span>
            <input type="date" value={supPayDate} onChange={e => setSupPayDate(e.target.value)}
              className="flex-1 rounded-lg bg-[#0f2e3a]/5 border border-[#0f2e3a]/15 px-2 py-1.5 text-[11px] text-[#0f2e3a] [color-scheme:light] focus:outline-none" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setSupPayOpen(null)}
              className="rounded-lg bg-[#0f2e3a]/5 border border-[#0f2e3a]/15 px-3 py-2 text-[11px] font-medium text-[#2b2622]/70 hover:bg-[#0f2e3a]/10 transition-colors">
              Prekliči
            </button>
            <button disabled={supPaySaving}
              onClick={async () => {
                setSupPaySaving(true);
                try {
                  await paySupplier({
                    refKey, supplier,
                    method: supPayMethod,
                    company: supPayMethod === 'cash' ? supPayCompany : undefined,
                    date: supPayDate,
                    amountAr,
                    label,
                  });
                  setSupPayOpen(null);
                  refresh();
                } finally {
                  setSupPaySaving(false);
                }
              }}
              className="flex-1 rounded-lg px-3 py-2 text-[11px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              style={{ backgroundColor: `${accent}22`, border: `1px solid ${accent}66`, color: accent }}>
              {supPaySaving ? 'Beležim…' : 'Zabeleži plačilo'}
            </button>
          </div>
        </div>
      );
    }
    if (paid) {
      return (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#4f7a54]/30 bg-[#4f7a54]/[0.08] px-2.5 py-2">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-[#4f7a54]">
              {supplierLabel} plačan ✓ · {paid.method === 'orange' ? <span className="text-[#c4741f]">Orange Money</span> : 'Gotovina'}
              {paid.method === 'cash' && paid.company ? ` (${paid.company === 'sarl' ? 'SARL' : 'Tourism'})` : ''}
            </p>
            <p className="text-[10px] text-[#2b2622]/55">
              {paid.paidAt ? new Date(paid.paidAt).toLocaleDateString('sl-SI', { day: 'numeric', month: 'short', year: 'numeric' }) : ''} · {ar(paid.amountAr || amountAr)}
            </p>
          </div>
          <div className="flex shrink-0 gap-1.5">
            <button onClick={() => {
              setSupPayMethod(paid.method === 'orange' ? 'orange' : 'cash');
              setSupPayCompany(paid.company === 'sarl' ? 'sarl' : 'tourism');
              setSupPayDate((paid.paidAt || new Date().toISOString()).slice(0, 10));
              setSupPayOpen(refKey);
            }}
              className="rounded-full border px-3 py-1.5 text-[10px] font-medium transition-colors" style={{ borderColor: `${accent}40`, backgroundColor: `${accent}1a`, color: accent }}>
              Uredi
            </button>
            <button onClick={async () => {
              if (!confirm('Prekličem plačilo dobavitelju? Vknjižba v blagajni/Orange Money se bo izbrisala.')) return;
              await unpaySupplier({ refKey });
              refresh();
            }}
              className="rounded-full border border-[#0f2e3a]/15 bg-[#0f2e3a]/5 px-3 py-1.5 text-[10px] font-medium text-[#2b2622]/70 hover:bg-red-500/10 hover:text-red-600 hover:border-red-500/40 transition-colors">
              Prekliči
            </button>
          </div>
        </div>
      );
    }
    return (
      <button onClick={() => {
        setSupPayMethod('cash');
        setSupPayCompany('tourism');
        setSupPayDate(new Date().toISOString().slice(0, 10));
        setSupPayOpen(refKey);
      }}
        className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full border px-4 py-2 transition-colors"
        style={{ borderColor: `${accent}40`, backgroundColor: `${accent}1a`, color: accent }}>
        <span className="text-[10px] font-semibold uppercase tracking-[0.15em]">Plačaj {supplierLabel}</span>
      </button>
    );
  };

  // Ročno gotovinsko doplačilo na transferju (voznik čolna / nosači / tuc tuc). Znesek se VPIŠE
  // (ni iz cenika, ker je vsakič drugačen). Uporabi isti mehanizem kot renderSupplierPay
  // (supplier_payments + paySupplier), gotovina → odliv iz blagajne izbranega podjetja.
  const renderExtraCashPay = (refKey: string, supplierKey: string, fieldLabel: string, descLabel: string) => {
    const paid = supplierPayByKey[refKey];
    const accent = '#8f6d3a';
    if (supPayOpen === refKey) {
      const amt = parseInt((extraAmt[refKey] || '').replace(/[^\d]/g, ''), 10) || 0;
      return (
        <div className="mt-2 rounded-lg p-2.5 space-y-2.5" style={{ border: `1px solid ${accent}40`, backgroundColor: `${accent}0d` }}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold" style={{ color: accent }}>{paid ? 'Uredi plačilo' : 'Plačilo'} · {fieldLabel}</p>
            <button onClick={() => setSupPayOpen(null)} aria-label="Zapri"
              className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-[#0f2e3a]/15 bg-[#0f2e3a]/5 text-[#2b2622]/60 transition-colors hover:bg-[#0f2e3a]/10 hover:text-[#2b2622]">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[#2b2622]/55">Znesek:</span>
            <input inputMode="numeric" value={extraAmt[refKey] || ''} onChange={e => setExtraAmt(p => ({ ...p, [refKey]: e.target.value }))} placeholder="0"
              className="flex-1 rounded-lg bg-[#0f2e3a]/5 border border-[#0f2e3a]/15 px-2 py-1.5 text-[11px] text-[#0f2e3a] focus:outline-none" />
            <span className="text-[10px] text-[#2b2622]/55">Ar</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg px-2.5 py-2" style={{ backgroundColor: `${accent}12`, border: `1px solid ${accent}33` }}>
            <span className="text-[10px] font-medium" style={{ color: accent }}>Gotovina · blagajna Komba Cabana Tourism</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[#2b2622]/55">Datum plačila:</span>
            <input type="date" value={supPayDate} onChange={e => setSupPayDate(e.target.value)}
              className="flex-1 rounded-lg bg-[#0f2e3a]/5 border border-[#0f2e3a]/15 px-2 py-1.5 text-[11px] text-[#0f2e3a] [color-scheme:light] focus:outline-none" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setSupPayOpen(null)}
              className="rounded-lg bg-[#0f2e3a]/5 border border-[#0f2e3a]/15 px-3 py-2 text-[11px] font-medium text-[#2b2622]/70 hover:bg-[#0f2e3a]/10 transition-colors">
              Prekliči
            </button>
            <button disabled={supPaySaving || amt <= 0}
              onClick={async () => {
                setSupPaySaving(true);
                try {
                  await paySupplier({
                    refKey, supplier: supplierKey,
                    method: 'cash',
                    company: 'tourism',
                    date: supPayDate,
                    amountAr: amt,
                    label: `${fieldLabel} — ${descLabel}`.slice(0, 200),
                  });
                  setSupPayOpen(null);
                  refresh();
                } finally {
                  setSupPaySaving(false);
                }
              }}
              className="flex-1 rounded-lg px-3 py-2 text-[11px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              style={{ backgroundColor: `${accent}22`, border: `1px solid ${accent}66`, color: accent }}>
              {supPaySaving ? 'Beležim…' : 'Zabeleži plačilo'}
            </button>
          </div>
        </div>
      );
    }
    if (paid) {
      return (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#4f7a54]/30 bg-[#4f7a54]/[0.08] px-2.5 py-2">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-[#4f7a54]">
              {fieldLabel} plačan ✓ · Gotovina (Tourism)
            </p>
            <p className="text-[10px] text-[#2b2622]/55">
              {paid.paidAt ? new Date(paid.paidAt).toLocaleDateString('sl-SI', { day: 'numeric', month: 'short', year: 'numeric' }) : ''} · {ar(paid.amountAr || 0)}
            </p>
          </div>
          <div className="flex shrink-0 gap-1.5">
            <button onClick={() => {
              setSupPayMethod('cash');
              setSupPayCompany('tourism');
              setSupPayDate((paid.paidAt || new Date().toISOString()).slice(0, 10));
              setExtraAmt(p => ({ ...p, [refKey]: String(paid.amountAr || '') }));
              setSupPayOpen(refKey);
            }}
              className="rounded-full border px-3 py-1.5 text-[10px] font-medium transition-colors" style={{ borderColor: `${accent}40`, backgroundColor: `${accent}1a`, color: accent }}>
              Uredi
            </button>
            <button onClick={async () => {
              if (!confirm('Prekličem plačilo? Odliv iz blagajne Tourism se bo izbrisal.')) return;
              await unpaySupplier({ refKey });
              refresh();
            }}
              className="rounded-full border border-[#0f2e3a]/15 bg-[#0f2e3a]/5 px-3 py-1.5 text-[10px] font-medium text-[#2b2622]/70 hover:bg-red-500/10 hover:text-red-600 hover:border-red-500/40 transition-colors">
              Prekliči
            </button>
          </div>
        </div>
      );
    }
    return (
      <button onClick={() => {
        setSupPayMethod('cash');
        setSupPayCompany('tourism');
        setSupPayDate(new Date().toISOString().slice(0, 10));
        setSupPayOpen(refKey);
      }}
        className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full border border-dashed px-4 py-2 transition-colors"
        style={{ borderColor: `${accent}55`, color: accent }}>
        <span className="text-[10px] font-semibold uppercase tracking-[0.15em]">+ {fieldLabel}</span>
      </button>
    );
  };

  // Ročno plačilo pri nabavi (voznik čolna / nosači / tuc tuc) — znesek se VPIŠE, na voljo sta
  // gotovina (blagajna Tourism/SARL) IN Orange Money. Uporablja isti mehanizem supplier_payments.
  const renderNabavaPay = (refKey: string, supplierKey: string, fieldLabel: string, descLabel: string) => {
    const paid = supplierPayByKey[refKey];
    const accent = '#8f6d3a';
    if (supPayOpen === refKey) {
      const amt = parseInt((extraAmt[refKey] || '').replace(/[^\d]/g, ''), 10) || 0;
      return (
        <div className="mt-2 rounded-lg p-2.5 space-y-2.5" style={{ border: `1px solid ${accent}40`, backgroundColor: `${accent}0d` }}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold" style={{ color: accent }}>{paid ? 'Uredi plačilo' : 'Plačilo'} · {fieldLabel}</p>
            <button onClick={() => setSupPayOpen(null)} aria-label="Zapri"
              className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-[#0f2e3a]/15 bg-[#0f2e3a]/5 text-[#2b2622]/60 transition-colors hover:bg-[#0f2e3a]/10 hover:text-[#2b2622]">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[#2b2622]/55">Znesek:</span>
            <input inputMode="numeric" value={extraAmt[refKey] || ''} onChange={e => setExtraAmt(p => ({ ...p, [refKey]: e.target.value }))} placeholder="0"
              className="flex-1 rounded-lg bg-[#0f2e3a]/5 border border-[#0f2e3a]/15 px-2 py-1.5 text-[11px] text-[#0f2e3a] focus:outline-none" />
            <span className="text-[10px] text-[#2b2622]/55">Ar</span>
          </div>
          <div className="flex gap-2">
            {(['cash', 'orange'] as const).map(m => (
              <button key={m} onClick={() => setSupPayMethod(m)}
                className={`flex-1 rounded-lg px-3 py-2 text-[11px] font-medium border transition-colors ${supPayMethod === m ? '' : 'bg-[#0f2e3a]/5 text-[#2b2622]/60 border-[#0f2e3a]/15 hover:bg-[#0f2e3a]/10'}`}
                style={supPayMethod === m ? { backgroundColor: `${accent}22`, borderColor: `${accent}66`, color: accent } : undefined}>
                {m === 'cash' ? 'Gotovina' : 'Orange Money'}
              </button>
            ))}
          </div>
          {supPayMethod === 'cash' && (
            <div className="flex gap-2">
              {(['tourism', 'sarl'] as const).map(c => (
                <button key={c} onClick={() => setSupPayCompany(c)}
                  className={`flex-1 rounded-lg px-3 py-2 text-[10px] font-medium border transition-colors ${supPayCompany === c ? 'bg-[#4f7a54]/15 text-[#4f7a54] border-[#4f7a54]/40' : 'bg-[#0f2e3a]/5 text-[#2b2622]/60 border-[#0f2e3a]/15 hover:bg-[#0f2e3a]/10'}`}>
                  {c === 'tourism' ? 'KOMBA CABANA TOURISM SARL' : 'KOMBA CABANA SARL'}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[#2b2622]/55">Datum plačila:</span>
            <input type="date" value={supPayDate} onChange={e => setSupPayDate(e.target.value)}
              className="flex-1 rounded-lg bg-[#0f2e3a]/5 border border-[#0f2e3a]/15 px-2 py-1.5 text-[11px] text-[#0f2e3a] [color-scheme:light] focus:outline-none" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setSupPayOpen(null)}
              className="rounded-lg bg-[#0f2e3a]/5 border border-[#0f2e3a]/15 px-3 py-2 text-[11px] font-medium text-[#2b2622]/70 hover:bg-[#0f2e3a]/10 transition-colors">
              Prekliči
            </button>
            <button disabled={supPaySaving || amt <= 0}
              onClick={async () => {
                setSupPaySaving(true);
                try {
                  await paySupplier({
                    refKey, supplier: supplierKey,
                    method: supPayMethod,
                    company: supPayMethod === 'cash' ? supPayCompany : undefined,
                    date: supPayDate,
                    amountAr: amt,
                    label: `${fieldLabel} — ${descLabel}`.slice(0, 200),
                  });
                  setSupPayOpen(null);
                  refresh();
                } finally {
                  setSupPaySaving(false);
                }
              }}
              className="flex-1 rounded-lg px-3 py-2 text-[11px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              style={{ backgroundColor: `${accent}22`, border: `1px solid ${accent}66`, color: accent }}>
              {supPaySaving ? 'Beležim…' : 'Zabeleži plačilo'}
            </button>
          </div>
        </div>
      );
    }
    if (paid) {
      return (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#4f7a54]/30 bg-[#4f7a54]/[0.08] px-2.5 py-2">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-[#4f7a54]">
              {fieldLabel} plačan ✓ · {paid.method === 'orange' ? <span className="text-[#c4741f]">Orange Money</span> : 'Gotovina'}
              {paid.method === 'cash' && paid.company ? ` (${paid.company === 'sarl' ? 'SARL' : 'Tourism'})` : ''}
            </p>
            <p className="text-[10px] text-[#2b2622]/55">
              {paid.paidAt ? new Date(paid.paidAt).toLocaleDateString('sl-SI', { day: 'numeric', month: 'short', year: 'numeric' }) : ''} · {ar(paid.amountAr || 0)}
            </p>
          </div>
          <div className="flex shrink-0 gap-1.5">
            <button onClick={() => {
              setSupPayMethod(paid.method === 'orange' ? 'orange' : 'cash');
              setSupPayCompany(paid.company === 'sarl' ? 'sarl' : 'tourism');
              setSupPayDate((paid.paidAt || new Date().toISOString()).slice(0, 10));
              setExtraAmt(p => ({ ...p, [refKey]: String(paid.amountAr || '') }));
              setSupPayOpen(refKey);
            }}
              className="rounded-full border px-3 py-1.5 text-[10px] font-medium transition-colors" style={{ borderColor: `${accent}40`, backgroundColor: `${accent}1a`, color: accent }}>
              Uredi
            </button>
            <button onClick={async () => {
              if (!confirm('Prekličem plačilo? Vknjižba v blagajni/Orange Money se bo izbrisala.')) return;
              await unpaySupplier({ refKey });
              refresh();
            }}
              className="rounded-full border border-[#0f2e3a]/15 bg-[#0f2e3a]/5 px-3 py-1.5 text-[10px] font-medium text-[#2b2622]/70 hover:bg-red-500/10 hover:text-red-600 hover:border-red-500/40 transition-colors">
              Prekliči
            </button>
          </div>
        </div>
      );
    }
    return (
      <button onClick={() => {
        setSupPayMethod('cash');
        setSupPayCompany('tourism');
        setSupPayDate(new Date().toISOString().slice(0, 10));
        setSupPayOpen(refKey);
      }}
        className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full border border-dashed px-4 py-2 transition-colors"
        style={{ borderColor: `${accent}55`, color: accent }}>
        <span className="text-[10px] font-semibold uppercase tracking-[0.15em]">+ {fieldLabel}</span>
      </button>
    );
  };

  // Compact, expandable card for one transfer (tap the header to reveal pay box + call buttons)
  const renderTransferCard = (item: (typeof pendingTransfersForDisplay)[number], idx: number) => {
    const r = item.reservation;
    // Days until the transfer, so Borut sees at a glance how far off each arrival/departure is.
    const countdownLabel = (dateStr?: string | null) => {
      const raw = dateStr ? String(dateStr).slice(0, 10) : "";
      if (!raw) return null;
      const t = today();
      const days = Math.round((Date.parse(`${raw}T00:00:00Z`) - Date.parse(`${t}T00:00:00Z`)) / 86400000);
      if (days === 0) return "danes";
      if (days === 1) return "jutri";
      if (days === -1) return "včeraj";
      if (days > 0) return `čez ${days} ${days === 2 ? "dneva" : "dni"}`;
      return `pred ${-days} ${-days === 2 ? "dnevoma" : "dnevi"}`;
    };
    // Reception ad-hoc transfer (from the recepcija cash desk). Stored as an order_item
    // named "Transfer: {route} - {N} pax | Coln: {boat}". We resolve route + boat back
    // from the name so we can show what to pay the carriers (Dilip boat + Herman) and
    // let the person who orders mark it as ordered — exactly like arrival/departure.
    if (item.type === 'reception') {
      const o = item.order;
      const shortBungalow = bungalowDisplayName(r.bungalow);
      const rawName = (o.name || '').replace(/^transfer:\s*/i, '');
      // Split "route - N pax | Coln: boat"
      const boatMatch = rawName.match(/\|\s*coln:\s*(.+)$/i);
      const boatNameFromName = boatMatch ? boatMatch[1].trim() : '';
      const routeName = rawName.replace(/\s*\|\s*coln:.*$/i, '').replace(/\s*-\s*\d+\s*pax.*$/i, '').trim();
      const matchedBoat = dbBoats.find((b: { id: string; name: string }) => b.name.toLowerCase() === boatNameFromName.toLowerCase());
      const matchedRoute = dbRoutesAll.find((rt: { id: string; name: string }) => rt.name.toLowerCase() === routeName.toLowerCase());
      const dilipCostAr = getSupplierCostAr(matchedBoat?.id, matchedRoute?.id);
      const hermanCostAr = getSupplierCostAr(HERMAN_BOAT_ID, matchedRoute?.id);
      const isOrdered = !!o.dilipOrderedAt;
      const isHermanOrdered = !!o.hermanOrderedAt;
      // Determine direction (arrival vs departure) so the card matches the arrival/departure look.
      // Priority: eventDate vs arrival/departure date, then the route direction (from/to Komba Cabana).
      const evDate = o.eventDate ? String(o.eventDate).slice(0, 10) : '';
      const arrDate = r.arrival ? String(r.arrival).slice(0, 10) : '';
      const depDate = r.departure ? String(r.departure).slice(0, 10) : '';
      const routeLc = routeName.toLowerCase();
      let recDir: 'arrival' | 'departure' | 'other' = 'other';
      if (evDate && evDate === depDate) recDir = 'departure';
      else if (evDate && evDate === arrDate) recDir = 'arrival';
      else if (/^\s*komba cabana/.test(routeLc)) recDir = 'departure';
      else if (/komba cabana\s*$/.test(routeLc)) recDir = 'arrival';
      const RecIcon = recDir === 'arrival' ? LogIn : recDir === 'departure' ? LogOut : Ship;
      const recColor = recDir === 'arrival' ? '#6f9a72' : recDir === 'departure' ? '#c4744a' : '#7fa8b8';
      const recDirLabel = recDir === 'arrival' ? 'Prihod' : recDir === 'departure' ? 'Odhod' : 'Transfer';
      const recCountdown = countdownLabel(evDate || (recDir === 'departure' ? depDate : arrDate));
      return (
        <details key={`reception-${o.id}-${idx}`} className="group rounded-xl border border-[#0f2e3a]/12 bg-[#efe8da] transition-colors hover:bg-[#e8dfc9] open:border-[#8f6d3a]/35 open:bg-[#efe8da]">
          <summary className="flex cursor-pointer list-none items-center gap-2 p-2.5 [&::-webkit-details-marker]:hidden">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: recColor + '1f', color: recColor }}>
              <RecIcon className={`h-3.5 w-3.5 ${recDir === 'departure' ? 'scale-x-[-1]' : ''}`} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-[#0f2e3a]">{shortBungalow} · {r.guestName}</p>
              {routeName
                ? <p className="truncate text-[13px] font-semibold" style={{ color: '#3f6b7d' }}><span className="font-semibold" style={{ color: recColor }}>{recDirLabel}</span> · {routeName}{boatNameFromName ? <span className="font-normal text-[#2b2622]/55"> · čoln {boatNameFromName}</span> : null}</p>
                : <p className="truncate text-[10px] text-[#2b2622]/55">{recDirLabel}</p>}
            </div>
            {recCountdown && <span className="flex-shrink-0 whitespace-nowrap rounded-full bg-[#b0203a]/12 px-2 py-0.5 text-[9px] font-semibold tracking-wide text-[#b0203a]">{recCountdown}</span>}
            {!isOrdered
              ? <span className="flex-shrink-0 rounded-full bg-[#b0203a]/12 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[#b0203a]">Naročiti</span>
              : <span className="flex-shrink-0 rounded-full bg-[#4f7a54]/12 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[#4f7a54]">Naročeno</span>}
            <ChevronDown className="h-4 w-4 flex-shrink-0 text-[#0f2e3a]/40 transition-transform group-open:rotate-180" />
          </summary>
          <div className="border-t border-[#0f2e3a]/10 px-3 pb-3 pt-2">
            {(dilipCostAr > 0 || hermanCostAr > 0) && (
              <div className="rounded-lg border border-[#8f6d3a]/40 bg-[#8f6d3a]/10 px-2 py-1">
                <p className="text-[10px] font-semibold text-[#8f6d3a]">Za plačilo prevoznikoma:</p>
                <div className="flex flex-wrap gap-x-3 text-[10px] text-[#8f6d3a]/90">
                  {dilipCostAr > 0 && <span>Dilip (čoln): {ar(dilipCostAr)}</span>}
                  {hermanCostAr > 0 && <span>Herman: {ar(hermanCostAr)}</span>}
                </div>
              </div>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              {!isOrdered ? (
                <button onClick={async () => { await setOrderItemTransferOrdered(o.id, 'dilip', true); refresh(); }} className="inline-flex min-w-[120px] flex-1 items-center justify-center gap-2 rounded-full border border-[#3f6b7d]/30 bg-[#3f6b7d]/10 px-4 py-2 text-[#3f6b7d] transition-colors hover:bg-[#3f6b7d]/20">
                  <Ship className="h-4 w-4" /><span className="text-[10px] font-semibold uppercase tracking-[0.15em]">Pokliči Dilipa</span>
                </button>
              ) : (
                <button onClick={async () => { await setOrderItemTransferOrdered(o.id, 'dilip', false); refresh(); }} title="Klikni za preklic naročila" className="inline-flex min-w-[120px] flex-1 items-center justify-center gap-2 rounded-full border border-[#5f7d75] bg-gradient-to-br from-[#8fae92] via-[#3f605b] to-[#0f2e3a] px-4 py-2 text-[#e8f0e6] transition-opacity hover:opacity-90">
                  <Ship className="h-4 w-4" /><span className="text-[10px] font-semibold uppercase tracking-[0.15em]">Dilip naročen ✓</span>
                </button>
              )}
              {hermanCostAr > 0 && (!isHermanOrdered ? (
                <button onClick={async () => { await setOrderItemTransferOrdered(o.id, 'herman', true); refresh(); }} className="inline-flex min-w-[120px] flex-1 items-center justify-center gap-2 rounded-full border border-[#4f7a54]/30 bg-[#4f7a54]/10 px-4 py-2 text-[#4f7a54] transition-colors hover:bg-[#4f7a54]/20">
                  <Car className="h-4 w-4" /><span className="text-[10px] font-semibold uppercase tracking-[0.15em]">Pokliči Hermana</span>
                </button>
              ) : (
                <button onClick={async () => { await setOrderItemTransferOrdered(o.id, 'herman', false); refresh(); }} title="Klikni za preklic naročila" className="inline-flex min-w-[120px] flex-1 items-center justify-center gap-2 rounded-full border border-[#5f7d75] bg-gradient-to-br from-[#8fae92] via-[#3f605b] to-[#0f2e3a] px-4 py-2 text-[#e8f0e6] transition-opacity hover:opacity-90">
                  <Car className="h-4 w-4" /><span className="text-[10px] font-semibold uppercase tracking-[0.15em]">Herman naročen ✓</span>
                </button>
              ))}
            </div>
            {dilipCostAr > 0 && renderSupplierPay(`reception:${o.id}:dilip`, 'dilip', dilipCostAr, 'Dilip (čoln)', `Prevoz Dilip (čoln) — ${shortBungalow} / ${r.guestName}${routeName ? ` · ${routeName}` : ''}`.slice(0, 200))}
            {hermanCostAr > 0 && renderSupplierPay(`reception:${o.id}:herman`, 'herman', hermanCostAr, 'Herman (avto)', `Prevoz Herman (avto) — ${shortBungalow} / ${r.guestName}${routeName ? ` · ${routeName}` : ''}`.slice(0, 200))}
            <div className="mt-2 border-t border-dashed border-[#8f6d3a]/25 pt-2">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[#8f6d3a]/70">Dodatna gotovinska plačila</p>
              {renderExtraCashPay(`reception:${o.id}:boatdriver`, 'boatdriver', 'Voznik čolna', `${shortBungalow} / ${r.guestName}${routeName ? ` · ${routeName}` : ''}`)}
              {renderExtraCashPay(`reception:${o.id}:porters`, 'porters', 'Nosači', `${shortBungalow} / ${r.guestName}${routeName ? ` · ${routeName}` : ''}`)}
              {renderExtraCashPay(`reception:${o.id}:tuctuc`, 'tuctuc', 'Tuc tuc', `${shortBungalow} / ${r.guestName}${routeName ? ` · ${routeName}` : ''}`)}
            </div>
          </div>
        </details>
      );
    }
    const t = item.transfer;
    const isArrival = item.type === 'arrival';
    const isOrdered = !!t.dilipOrderedAt;
    const isHermanOrdered = !!t.hermanOrderedAt;
    const shortBungalow = bungalowDisplayName(r.bungalow);
    const boatName = dbBoats.find((b: { id: string }) => b.id === t.boatId)?.name;
    const dilipCostAr = getSupplierCostAr(t.boatId, t.route);
    const taxiId = taxiIdOf(t);
    const taxiName = taxiNameOf(taxiId);
    const hermanCostAr = getSupplierCostAr(taxiId, t.hermanRouteId);
    const routeName = dbRoutes.find((rt: { id: string; name: string }) => rt.id === t.route)?.name || t.route;
    const TypeIcon = isArrival ? LogIn : LogOut;
    const typeColor = isArrival ? '#6f9a72' : '#c4744a';
    const cardCountdown = countdownLabel(t.pickupDate || (isArrival ? r.arrival : r.departure));
    return (
      <details key={`${item.type}-${r.id}-${idx}`} className="group rounded-xl border border-[#0f2e3a]/12 bg-[#efe8da] transition-colors hover:bg-[#e8dfc9] open:border-[#8f6d3a]/35 open:bg-[#efe8da]">
        <summary className="flex cursor-pointer list-none items-center gap-2 p-2.5 [&::-webkit-details-marker]:hidden">
          <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: typeColor + '1f', color: typeColor }}>
            <TypeIcon className={`h-3.5 w-3.5 ${isArrival ? '' : 'scale-x-[-1]'}`} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-[#0f2e3a]">{shortBungalow} · {r.guestName}</p>
            <p className="truncate text-[11px] font-normal" style={{ color: '#3f6b7d' }}>
              <span className="font-medium" style={{ color: typeColor }}>{isArrival ? 'Prihod' : 'Odhod'}</span> · {routeName}
              {t.time ? <span className="font-normal text-[#2b2622]/55"> · {t.time}</span> : null}
            </p>
          </div>
          {cardCountdown && <span className="flex-shrink-0 whitespace-nowrap rounded-full bg-[#b0203a]/12 px-2 py-0.5 text-[9px] font-semibold tracking-wide text-[#b0203a]">{cardCountdown}</span>}
          {!isOrdered
            ? <span className="flex-shrink-0 rounded-full bg-[#b0203a]/12 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[#b0203a]">Naročiti</span>
            : <span className="flex-shrink-0 rounded-full bg-[#4f7a54]/12 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[#4f7a54]">Naročeno</span>}
          <ChevronDown className="h-4 w-4 flex-shrink-0 text-[#0f2e3a]/40 transition-transform group-open:rotate-180" />
        </summary>
        <div className="border-t border-[#0f2e3a]/10 px-3 pb-3 pt-2">
          <p className="text-[10px] text-[#2b2622]/55">{r.pax} os</p>
          <div className="mt-1.5 space-y-0.5 text-[10px] text-[#0f2e3a]/70">
            {(() => {
              const isAirport = /airport|fascene/i.test(routeName || '') || !!t.flightNumber;
              if (isAirport) {
                return (t.flightNumber || t.flightTime) ? (<p><span className="text-[#2b2622]/45">Let:</span> {t.flightNumber || '?'}{t.flightTime ? ` ob ${t.flightTime}` : ''}</p>) : null;
              }
              const pickup = (t.pickupPoint || '').trim() || (routeName || '').split(' - ')[0]?.trim();
              return (pickup || t.flightTime) ? (<p><span className="text-[#2b2622]/45">Prevzem:</span> {pickup || '?'}{t.flightTime ? ` ob ${t.flightTime}` : ''}</p>) : null;
            })()}
            {(boatName || t.boatPortTime) && (<p><span className="text-[#2b2622]/45">Čoln:</span> {boatName || '?'}{t.boatPortTime ? ` · port ${t.boatPortTime}` : ''}</p>)}
            {t.hermanAirportTime && (<p><span className="text-[#2b2622]/45">Herman:</span> {t.hermanAirportTime}</p>)}
            {t.notes && (<p className="text-[#8f6d3a]"><span className="text-[#2b2622]/45">Opomba:</span> {t.notes}</p>)}
          </div>
          {(dilipCostAr > 0 || hermanCostAr > 0) && (
            <div className="mt-1.5 rounded-lg border border-[#8f6d3a]/40 bg-[#8f6d3a]/10 px-2 py-1">
              <p className="text-[10px] font-semibold text-[#8f6d3a]">Za plačilo prevoznikoma:</p>
              <div className="flex flex-wrap gap-x-3 text-[10px] text-[#8f6d3a]/90">
                {dilipCostAr > 0 && <span>Dilip (čoln): {ar(dilipCostAr)}</span>}
                {hermanCostAr > 0 && <span>{taxiName}: {ar(hermanCostAr)}</span>}
              </div>
              {hermanCostAr > 0 && (<p className="mt-1 text-[10px] font-semibold text-[#4f7a54]">Pokliči tudi {taxiName} ({dbRoutes.find((rt: { id: string; name: string }) => rt.id === t.hermanRouteId)?.name || 'avto'})</p>)}
            </div>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            {!isOrdered ? (
              <button onClick={async () => { await updateTransfer(r.id, item.type, { dilipOrderedAt: new Date() }); refresh(); }} className="inline-flex min-w-[120px] flex-1 items-center justify-center gap-2 rounded-full border border-[#3f6b7d]/30 bg-[#3f6b7d]/10 px-4 py-2 text-[#3f6b7d] transition-colors hover:bg-[#3f6b7d]/20">
                <Ship className="h-4 w-4" /><span className="text-[10px] font-semibold uppercase tracking-[0.15em]">Pokliči Dilipa</span>
              </button>
            ) : (
              <button onClick={async () => { await updateTransfer(r.id, item.type, { dilipOrderedAt: null }); refresh(); }} title="Klikni za preklic naročila" className="inline-flex min-w-[120px] flex-1 items-center justify-center gap-2 rounded-full border border-[#5f7d75] bg-gradient-to-br from-[#8fae92] via-[#3f605b] to-[#0f2e3a] px-4 py-2 text-[#e8f0e6] transition-opacity hover:opacity-90">
                <Ship className="h-4 w-4" /><span className="text-[10px] font-semibold uppercase tracking-[0.15em]">Dilip naročen ✓</span>
              </button>
            )}
            {hermanCostAr > 0 && (!isHermanOrdered ? (
              <button onClick={async () => { await updateTransfer(r.id, item.type, { hermanOrderedAt: new Date() }); refresh(); }} className="inline-flex min-w-[120px] flex-1 items-center justify-center gap-2 rounded-full border border-[#4f7a54]/30 bg-[#4f7a54]/10 px-4 py-2 text-[#4f7a54] transition-colors hover:bg-[#4f7a54]/20">
                <Car className="h-4 w-4" /><span className="text-[10px] font-semibold uppercase tracking-[0.15em]">Pokliči {taxiName}</span>
              </button>
            ) : (
              <button onClick={async () => { await updateTransfer(r.id, item.type, { hermanOrderedAt: null }); refresh(); }} title="Klikni za preklic naročila" className="inline-flex min-w-[120px] flex-1 items-center justify-center gap-2 rounded-full border border-[#5f7d75] bg-gradient-to-br from-[#8fae92] via-[#3f605b] to-[#0f2e3a] px-4 py-2 text-[#e8f0e6] transition-opacity hover:opacity-90">
                <Car className="h-4 w-4" /><span className="text-[10px] font-semibold uppercase tracking-[0.15em]">{taxiName} naročen ✓</span>
              </button>
            ))}
          </div>
          {dilipCostAr > 0 && renderSupplierPay(`transfer:${r.id}:${item.type}:dilip`, 'dilip', dilipCostAr, 'Dilip (čoln)', `Prevoz Dilip (čoln) — ${shortBungalow} / ${r.guestName}${routeName ? ` · ${routeName}` : ''}`.slice(0, 200))}
          {hermanCostAr > 0 && renderSupplierPay(`transfer:${r.id}:${item.type}:${taxiKey(taxiId)}`, taxiKey(taxiId), hermanCostAr, `${taxiName} (avto)`, `Prevoz ${taxiName} (avto) — ${shortBungalow} / ${r.guestName}${routeName ? ` · ${routeName}` : ''}`.slice(0, 200))}
          <div className="mt-2 border-t border-dashed border-[#8f6d3a]/25 pt-2">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[#8f6d3a]/70">Dodatna gotovinska plačila</p>
            {renderExtraCashPay(`transfer:${r.id}:${item.type}:boatdriver`, 'boatdriver', 'Voznik čolna', `${shortBungalow} / ${r.guestName}${routeName ? ` · ${routeName}` : ''}`)}
            {renderExtraCashPay(`transfer:${r.id}:${item.type}:porters`, 'porters', 'Nosači', `${shortBungalow} / ${r.guestName}${routeName ? ` · ${routeName}` : ''}`)}
            {renderExtraCashPay(`transfer:${r.id}:${item.type}:tuctuc`, 'tuctuc', 'Tuc tuc', `${shortBungalow} / ${r.guestName}${routeName ? ` · ${routeName}` : ''}`)}
          </div>
        </div>
      </details>
    );
  };
  
  // Build list of all excursions - hide only after the day has passed
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);
  
  const rawExcursionItems = reservations
    .filter(r => r.status !== "CHECKED_OUT")
    .flatMap(r => {
      // Cancelled excursions (converted to credit) drop out of the operational list.
      return (r.excursions || []).filter(exc => exc.status !== 'CANCELLED').map(exc => ({
        reservation: r,
        excursion: exc,
        excursionName: data?.excursions?.find((e: { id: string; name: string }) => e.id === exc.excursionId)?.name || 'Izlet',
        isOrdered: !!exc.dilipOrderedAt
      }));
    })
    .filter(item => {
      // Hide excursions only after the date has passed (next day)
      if (!item.excursion.date) return true;
      const excDate = new Date(item.excursion.date);
      excDate.setHours(0, 0, 0, 0);
      return excDate >= todayDate;
    });

  // Skupinske izlete (isti groupId) združimo v ENO vrstico, ker je ��oln pri Dilipu
  // naročen enkrat za celo skupino (sicer bi se plačilo Dilipu podvojilo).
  type ExcItem = (typeof rawExcursionItems)[number];
  const groupedMap = new Map<string, ExcItem[]>();
  const singleItems: ExcItem[] = [];
  for (const item of rawExcursionItems) {
    const gid = item.excursion.groupId;
    if (gid) {
      const arr = groupedMap.get(gid) || [];
      arr.push(item);
      groupedMap.set(gid, arr);
    } else {
      singleItems.push(item);
    }
  }

  const allExcursionsList = [
    ...singleItems.map(item => ({ ...item, members: [item] as ExcItem[] })),
    ...Array.from(groupedMap.values()).map(members => ({
      ...members[0],
      members,
      isOrdered: members.every(m => m.isOrdered),
    })),
  ]
    .sort((a, b) => {
      const dateA = a.excursion.date || a.reservation.arrival;
      const dateB = b.excursion.date || b.reservation.arrival;
      return new Date(dateA).getTime() - new Date(dateB).getTime();
    });
  
  const pendingExcursionsList = allExcursionsList.filter(item => !item.isOrdered);
  const pendingExcursionsCount = pendingExcursionsList.length;
  
  // Show PIN screen if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0a2029] flex items-center justify-center p-4">
        <div className="bg-[#0b2731] rounded-3xl p-8 w-full max-w-sm border border-white/10">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-[#c59b5b]/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Home className="w-8 h-8 text-[#c59b5b]" />
            </div>
            <h1 className="text-xl font-bold text-white">Komba Cabana</h1>
            <p className="text-white/40 text-sm mt-1">Vnesite PIN za dostop</p>
          </div>
          
          {/* PIN Display */}
          <div className="flex justify-center gap-3 mb-6">
            {[0, 1, 2, 3].map(i => (
              <div
                key={i}
                className={`w-14 h-14 rounded-xl border-2 flex items-center justify-center text-xl font-bold transition-colors ${
                  pin.length > i 
                    ? 'border-[#c59b5b] bg-[#c59b5b]/20 text-[#c59b5b]' 
                    : 'border-white/20 bg-white/5'
                }`}
              >
                {pin.length > i ? '•' : ''}
              </div>
            ))}
          </div>
          
          {pinError && (
            <p className="text-red-400 text-sm text-center mb-4">{pinError}</p>
          )}
          
          {/* Keypad */}
          <div className="grid grid-cols-3 gap-3">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '←'].map(key => (
              <button
                key={key}
                onClick={() => handlePinKey(key)}
                className={`h-16 rounded-xl text-xl font-medium transition-colors ${
                  key === 'C' 
                    ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' 
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                {key}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }
  
  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#071c24]">
        <div className="text-center">
          <RefreshCw className="mx-auto h-8 w-8 animate-spin text-[#c59b5b]" />
          <p className="mt-4 text-white/50">Nalagam podatke...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#071c24]">
        <div className="text-center">
          <p className="text-[#bc7d67]">Napaka pri nalaganju podatkov</p>
          <LuxuryButton variant="gold" className="mt-4" onClick={refresh}>Poskusi znova</LuxuryButton>
        </div>
      </main>
    );
  }

  const activeNavItem = nav.find(([id]) => id === tab);
  const activeColor = activeNavItem ? activeNavItem[3] : "gold";

  return (
    <main className="min-h-screen bg-[#071c24] text-white">
      {/* Ambient lighting effect */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-[#c59b5b]/5 blur-[120px]" />
        <div className="absolute -right-40 top-1/3 h-96 w-96 rounded-full bg-[#4e8296]/5 blur-[120px]" />
      </div>

      {/* Header */}
      <header className="relative z-[60] border-b border-white/[0.06] bg-[rgba(15,46,58,0.6)] backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div className="flex flex-col items-center sm:items-start">
              <button
                type="button"
                onClick={() => window.location.reload()}
                title="Osveži aplikacijo"
                aria-label="Osveži aplikacijo"
                className="group transition-transform hover:scale-[1.02] active:scale-95 cursor-pointer"
              >
                <img 
                  src="/images/komba-logo-gold.png" 
                  alt="Komba Cabana" 
                  className="h-20 sm:h-28 w-auto max-w-[280px] sm:max-w-none object-contain brightness-[1.35] saturate-[1.15] drop-shadow-[0_0_14px_rgba(232,200,138,0.75)] transition-[filter] duration-500 group-hover:brightness-[1.5] group-hover:drop-shadow-[0_0_22px_rgba(232,200,138,0.95)]"
                />
              </button>
              <p className="mt-2 text-[9px] sm:text-[10px] font-semibold uppercase tracking-[0.2em] sm:tracking-[0.28em] text-[#9dafb5]">Private Island Operating System</p>
            </div>
            {/* The Opomnik shortcut lives in each person's own header, not here:
                above the Borut/Urška picker it is unclear whose reminder it is. */}
            {/* Odjava button hidden on request — handleLogout stays in place so it
                can be shown again without rebuilding anything. */}
          </div>
        </div>
      </header>

      {/* Message Toast */}
      {message && (
        <div className="fixed top-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-gradient-to-r from-[#e8c88a] via-[#c59b5b] to-[#8f6d3a] px-8 py-3 text-sm font-medium text-[#0a2029] shadow-[0_8px_32px_rgba(197,155,91,0.4)]">
          {message}
        </div>
      )}

      {/* Navigation */}
      <nav className="sticky top-0 z-40 border-b border-white/[0.06] bg-[rgba(15,46,58,0.8)] backdrop-blur-xl">
        {/* Centered on phones (two person buttons read as a pair), left-aligned from sm up. */}
        <div className="mx-auto flex max-w-7xl flex-wrap justify-center gap-2 px-4 sm:justify-start sm:px-8 py-3 sm:py-4">
          {nav.map(([id, label, Icon, color]) => {
            const isActive = tab === id;
            const colorStyles = {
              gold: "bg-gradient-to-r from-[#e8c88a] via-[#c59b5b] to-[#8f6d3a] text-[#0a2029]",
              petrol: "bg-gradient-to-r from-[#8fae92] to-[#526b55] text-[#0a2029]",
              ocean: "bg-gradient-to-r from-[#7fa8b8] to-[#4e8296] text-[#0a2029]",
            };
            // Person buttons open their own landing page — the button always keeps
            // the person's name, and lights up while any of their entries is open.
            const person = personPages[id];
            if (person) {
              // Tabs shared by both people (Bungalovi, Rezervacije, Koledar) must not
              // light up both buttons at once — only a person's own tabs do.
              const tabsOf = (p: typeof person) => p.sections.flatMap(s => s.items.map(i => i.tab).filter(Boolean));
              const counts = new Map<string, number>();
              Object.values(personPages).forEach(p => tabsOf(p).forEach(t => counts.set(t!, (counts.get(t!) || 0) + 1)));
              const ownTabs = tabsOf(person).filter(t => counts.get(t!) === 1);
              const personActive = tab === id || ownTabs.includes(tab);
              const PersonIcon = person.icon;
              return (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={`flex flex-shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.2em] transition-all duration-300 ${
                    personActive ? colorStyles[color] : "bg-white/[0.03] text-[#9dafb5] hover:bg-white/[0.06] hover:text-[#f8f5ef]"
                  }`}
                >
                  <PersonIcon className="h-4 w-4" /> {person.label}
                </button>
              );
            }
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex flex-shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.2em] transition-all duration-300 ${
                  isActive ? colorStyles[color] : "bg-white/[0.03] text-[#9dafb5] hover:bg-white/[0.06] hover:text-[#f8f5ef]"
                }`}
              >
                <Icon className="h-4 w-4" /> {label}
              </button>
            );
  })}
  </div>
  </nav>

      {/* Pending Transfers & Excursions & Ceniki — only on Borut's landing page.
          Urška does not need it there (it lives with Borut), and the first page
          (bungalow cards) stays clean. */}
      {tab === "borut" && (
        <div className="mx-auto max-w-7xl px-4 sm:px-8 pt-6">
          <div className="flex flex-wrap gap-2 sm:gap-3">
            {/* Pending Transfers Button */}
            {pendingCount > 0 && (
              <button 
                onClick={() => { setShowPendingTransfers(!showPendingTransfers); setShowPendingExcursions(false); }}
                className="inline-flex w-full sm:w-auto sm:min-w-[260px] items-center justify-center gap-2 rounded-full bg-[#7fa8b8]/10 border border-[#7fa8b8]/20 px-5 py-2.5 text-[#7fa8b8] hover:bg-[#7fa8b8]/20 transition-colors"
              >
                <Ship className="h-4 w-4" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em]">Pending Transferji</span>
                <span className="text-sm font-medium">· {pendingCount}</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${showPendingTransfers ? 'rotate-180' : ''}`} />
              </button>
            )}
            
            {/* Excursions Button - shows if any excursions exist */}
            {allExcursionsList.length > 0 && (
              <button 
                onClick={() => { setShowPendingExcursions(!showPendingExcursions); setShowPendingTransfers(false); }}
                className={`inline-flex w-full sm:w-auto sm:min-w-[260px] items-center justify-center gap-2 rounded-full px-5 py-2.5 transition-colors ${
                  pendingExcursionsCount > 0 
                    ? 'bg-[#8fae92]/10 border border-[#8fae92]/20 text-[#8fae92] hover:bg-[#8fae92]/20'
                    : 'bg-[#8fae92]/20 border border-[#8fae92]/40 text-[#8fae92] hover:bg-[#8fae92]/30'
                }`}
              >
                <Palmtree className="h-4 w-4" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em]">Izleti</span>
                {pendingExcursionsCount > 0 ? (
                  <span className="text-sm font-medium">· {pendingExcursionsCount} za naročiti</span>
                ) : (
                  <span className="text-sm font-medium">· vsi naročeni</span>
                )}
                <ChevronDown className={`h-4 w-4 transition-transform ${showPendingExcursions ? 'rotate-180' : ''}`} />
              </button>
            )}

            {/* Nabava Button - Borut gre po nakupih brez gostov */}
            <button
              onClick={() => { setShowNabava(!showNabava); setShowPendingTransfers(false); setShowPendingExcursions(false); }}
              className="inline-flex w-full sm:w-auto sm:min-w-[220px] items-center justify-center gap-2 rounded-full bg-[#c9a86a]/10 border border-[#c9a86a]/25 px-5 py-2.5 text-[#c9a86a] hover:bg-[#c9a86a]/20 transition-colors"
            >
              <ShoppingCart className="h-4 w-4" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em]">Nabava HV</span>
              {nabavaHvList.length > 0 && <span className="text-sm font-medium">· {nabavaHvList.length}</span>}
              <ChevronDown className={`h-4 w-4 transition-transform ${showNabava ? 'rotate-180' : ''}`} />
            </button>

            {/* Nabava Komba Button - Borut kupuje samo robo (brez čolna, brez voznika) */}
            <button
              onClick={() => { setShowNabavaKomba(!showNabavaKomba); setShowNabava(false); setShowPendingTransfers(false); setShowPendingExcursions(false); }}
              className="inline-flex w-full sm:w-auto sm:min-w-[220px] items-center justify-center gap-2 rounded-full bg-[#8fae92]/10 border border-[#8fae92]/25 px-5 py-2.5 text-[#8fae92] hover:bg-[#8fae92]/20 transition-colors"
            >
              <ShoppingCart className="h-4 w-4" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em]">Nabava Komba</span>
              {nabavaKombaList.length > 0 && <span className="text-sm font-medium">· {nabavaKombaList.length}</span>}
              <ChevronDown className={`h-4 w-4 transition-transform ${showNabavaKomba ? 'rotate-180' : ''}`} />
            </button>

            {/* Ceniki Button (opens the pricing modal) - pushed to the right edge */}
            <button
              onClick={() => setShowPricingModal(true)}
              className="w-full sm:w-auto sm:ml-auto inline-flex items-center justify-center gap-2 rounded-full bg-[#d9a68f]/10 border border-[#d9a68f]/25 px-5 py-2.5 text-[#d9a68f] hover:bg-[#d9a68f]/20 transition-colors"
            >
              <Settings className="h-4 w-4" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em]">Ceniki</span>
            </button>
          </div>

          
          {/* Expanded Transfers Panel */}
          {showPendingTransfers && (
            <div className="mt-4 rounded-2xl border border-[#7fa8b8]/20 bg-[#0a2029]/90 backdrop-blur-xl p-3 sm:p-5">
              <div className="space-y-4">
                {transferGroups.length === 0 ? (
                  <p className="text-white/30 text-xs">Ni transferjev za urediti</p>
                ) : (
                  transferGroups.map((g) => (
                    <div key={g.key}>
                      <div className="mb-2 flex items-center gap-2">
                        <span className={`text-xs font-semibold uppercase tracking-wider ${g.urgent ? "text-[#c59b5b]" : "text-white/40"}`}>{g.label}</span>
                        <span className="rounded-full bg-white/5 px-1.5 text-[10px] text-white/40">{g.items.length}</span>
                        <div className="h-px flex-1 bg-white/5" />
                      </div>
                      <div className="space-y-2">
                        {g.items.map((item, idx) => renderTransferCard(item, idx))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
          
          {/* Expanded Nabava Panel - Borut gre po nakupih brez gostov */}
          {showNabava && (
            <div className="mt-4 rounded-2xl border border-[#c9a86a]/20 bg-[#0a2029]/90 backdrop-blur-xl p-3 sm:p-5">
              {/* Add form */}
              <div className="mb-4 rounded-xl border border-[#c9a86a]/20 bg-[#c9a86a]/[0.05] p-3">
                <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#c9a86a]">
                  <ShoppingCart className="h-4 w-4" /> Nova nabava
                </h4>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input type="date" value={nabavaDate} onChange={e => setNabavaDate(e.target.value)}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white [color-scheme:dark] focus:outline-none" />
                  <input value={nabavaNote} onChange={e => setNabavaNote(e.target.value)} placeholder="Opis nabave (npr. trg. Hakim — hrana, material)"
                    className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none" />
                  <button disabled={nabavaSaving}
                    onClick={async () => {
                      setNabavaSaving(true);
                      try {
                        await addNabavaTrip({ date: nabavaDate, note: nabavaNote });
                        setNabavaNote("");
                        await mutateNabava();
                      } finally {
                        setNabavaSaving(false);
                      }
                    }}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#c9a86a]/40 bg-[#c9a86a]/15 px-4 py-2 text-xs font-semibold text-[#c9a86a] transition-colors hover:bg-[#c9a86a]/25 disabled:opacity-50">
                    <Plus className="h-3.5 w-3.5" /> {nabavaSaving ? 'Dodajam…' : 'Dodaj'}
                  </button>
                </div>
              </div>

              {nabavaHvList.length === 0 ? (
                <p className="text-white/30 text-xs">Ni vnosov nabave. Dodaj prvo nabavo zgoraj.</p>
              ) : (
                <div className="space-y-3">
                  {nabavaHvList.map((trip) => (
                    <div key={trip.id} className="rounded-xl border border-[#c9a86a]/15 bg-[#f7f2e7] p-3">
                      {nabavaEditId === trip.id ? (
                        <div className="mb-1 flex flex-col gap-2 sm:flex-row sm:items-center">
                          <input type="date" value={nabavaEditDate} onChange={e => setNabavaEditDate(e.target.value)}
                            className="rounded-lg border border-[#0f2e3a]/15 bg-[#0f2e3a]/5 px-2 py-1.5 text-[11px] text-[#0f2e3a] [color-scheme:light] focus:outline-none" />
                          <input value={nabavaEditNote} onChange={e => setNabavaEditNote(e.target.value)}
                            className="flex-1 rounded-lg border border-[#0f2e3a]/15 bg-[#0f2e3a]/5 px-2 py-1.5 text-[11px] text-[#0f2e3a] focus:outline-none" />
                          <div className="flex gap-1.5">
                            <button onClick={async () => { await updateNabavaTrip({ id: trip.id, date: nabavaEditDate, note: nabavaEditNote }); setNabavaEditId(null); await mutateNabava(); }}
                              className="rounded-full border border-[#4f7a54]/40 bg-[#4f7a54]/15 px-3 py-1.5 text-[10px] font-semibold text-[#4f7a54]">Shrani</button>
                            <button onClick={() => setNabavaEditId(null)}
                              className="rounded-full border border-[#0f2e3a]/15 bg-[#0f2e3a]/5 px-3 py-1.5 text-[10px] font-medium text-[#2b2622]/70">Prekliči</button>
                          </div>
                        </div>
                      ) : (
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[11px] font-semibold text-[#8f6d3a]">
                              {trip.date ? new Date(trip.date + 'T00:00:00').toLocaleDateString('sl-SI', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                            </p>
                            {trip.note && <p className="text-[11px] text-[#2b2622]/70">{trip.note}</p>}
                          </div>
                          <div className="flex shrink-0 gap-1.5">
                            <button onClick={() => { setNabavaEditId(trip.id); setNabavaEditDate(trip.date); setNabavaEditNote(trip.note); }}
                              className="flex h-7 w-7 items-center justify-center rounded-full border border-[#0f2e3a]/15 bg-[#0f2e3a]/5 text-[#2b2622]/60 transition-colors hover:bg-[#0f2e3a]/10">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={async () => { if (!confirm('Izbrišem nabavo? Povezana plačila se bodo razveljavila.')) return; await deleteNabavaTrip(trip.id); refresh(); await mutateNabava(); }}
                              className="flex h-7 w-7 items-center justify-center rounded-full border border-[#0f2e3a]/15 bg-[#0f2e3a]/5 text-[#2b2622]/60 transition-colors hover:bg-red-500/10 hover:text-red-600 hover:border-red-500/40">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                      <div className="space-y-2 border-t border-dashed border-[#c9a86a]/30 pt-2">
                        {(() => {
                          // Preklop "brez čolna": če gre Borut po nakupih brez naročenega čolna
                          // (npr. se pelje z gosti), skrijemo blok Čoln (Dilip) in beležimo le ostale stroške.
                          return (
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-[#3f6b7d]/70">Čoln</span>
                              <button type="button" onClick={async () => { await setNabavaNoBoat({ id: trip.id, noBoat: false }); await mutateNabava(); }}
                                className={`rounded-full px-2.5 py-1 text-[10px] font-semibold transition ${!trip.noBoat ? 'bg-[#3f6b7d] text-white' : 'bg-[#3f6b7d]/10 text-[#3f6b7d]'}`}>
                                S čolnom (Dilip)
                              </button>
                              <button type="button" onClick={async () => { if (confirm('Brez čolna? Morebitno plačilo Dilipu za čoln se bo razveljavilo.')) { await setNabavaNoBoat({ id: trip.id, noBoat: true }); await mutateNabava(); } }}
                                className={`rounded-full px-2.5 py-1 text-[10px] font-semibold transition ${trip.noBoat ? 'bg-[#5b6470] text-white' : 'bg-[#5b6470]/10 text-[#5b6470]'}`}>
                                Brez čolna
                              </button>
                            </div>
                          );
                        })()}
                        {!trip.noBoat && (() => {
                          // Nabava HV: čoln je VEDNO Nero, cena Dilipu je FIKSNA 120.000 Ar (brez izbire, brez odštevanja).
                          const boatName = 'Nero';
                          const boatCostAr = 120000;
                          return (
                            <div className="rounded-lg border border-[#3f6b7d]/20 bg-[#3f6b7d]/[0.05] p-2">
                              <p className="mb-1.5 flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.15em] text-[#3f6b7d]"><Ship className="h-3.5 w-3.5" /> Čoln (Dilip)</p>
                              <div className="rounded-lg border border-[#3f6b7d]/30 bg-[#3f6b7d]/10 px-2 py-1">
                                <p className="text-[10px] font-semibold text-[#3f6b7d]">Za plačilo Dilipu (čoln {boatName}): {ar(boatCostAr)}</p>
                              </div>
                              {renderSupplierPay(`nabava:${trip.id}:boat`, 'dilip', boatCostAr, `Dilip (čoln ${boatName})`, trip.note || 'nabava', '#3f6b7d')}
                            </div>
                          );
                        })()}
                        <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.15em] text-[#8f6d3a]/70">Gotovinska / Orange Money plačila</p>
                        {renderNabavaPay(`nabava:${trip.id}:boatdriver`, 'boatdriver', 'Voznik čolna', trip.note || 'nabava')}
                        {renderNabavaPay(`nabava:${trip.id}:porters`, 'porters', 'Nosači', trip.note || 'nabava')}
                        {renderNabavaPay(`nabava:${trip.id}:tuctuc`, 'tuctuc', 'Tuc tuc', trip.note || 'nabava')}
                        <NabavaPurchasesSection tripId={trip.id} tripNote={trip.note} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Expanded Nabava Komba Panel - Borut kupuje samo robo (brez čolna, brez voznika) */}
          {showNabavaKomba && (
            <div className="mt-4 rounded-2xl border border-[#8fae92]/20 bg-[#0a2029]/90 backdrop-blur-xl p-3 sm:p-5">
              {/* Add form */}
              <div className="mb-4 rounded-xl border border-[#8fae92]/20 bg-[#8fae92]/[0.05] p-3">
                <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#8fae92]">
                  <ShoppingCart className="h-4 w-4" /> Nova nabava Komba
                </h4>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input type="date" value={nabavaKombaDate} onChange={e => setNabavaKombaDate(e.target.value)}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white [color-scheme:dark] focus:outline-none" />
                  <input value={nabavaKombaNote} onChange={e => setNabavaKombaNote(e.target.value)} placeholder="Opis nabave (npr. trg. Hakim — roba)"
                    className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none" />
                  <button disabled={nabavaKombaSaving}
                    onClick={async () => {
                      setNabavaKombaSaving(true);
                      try {
                        await addNabavaTrip({ date: nabavaKombaDate, note: nabavaKombaNote, site: "komba" });
                        setNabavaKombaNote("");
                        await mutateNabava();
                      } finally {
                        setNabavaKombaSaving(false);
                      }
                    }}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#8fae92]/40 bg-[#8fae92]/15 px-4 py-2 text-xs font-semibold text-[#8fae92] transition-colors hover:bg-[#8fae92]/25 disabled:opacity-50">
                    <Plus className="h-3.5 w-3.5" /> {nabavaKombaSaving ? 'Dodajam…' : 'Dodaj'}
                  </button>
                </div>
              </div>

              {nabavaKombaList.length === 0 ? (
                <p className="text-white/30 text-xs">Ni vnosov nabave. Dodaj prvo nabavo zgoraj.</p>
              ) : (
                <div className="space-y-3">
                  {nabavaKombaList.map((trip) => (
                    <div key={trip.id} className="rounded-xl border border-[#8fae92]/15 bg-[#f7f2e7] p-3">
                      {nabavaEditId === trip.id ? (
                        <div className="mb-1 flex flex-col gap-2 sm:flex-row sm:items-center">
                          <input type="date" value={nabavaEditDate} onChange={e => setNabavaEditDate(e.target.value)}
                            className="rounded-lg border border-[#0f2e3a]/15 bg-[#0f2e3a]/5 px-2 py-1.5 text-[11px] text-[#0f2e3a] [color-scheme:light] focus:outline-none" />
                          <input value={nabavaEditNote} onChange={e => setNabavaEditNote(e.target.value)}
                            className="flex-1 rounded-lg border border-[#0f2e3a]/15 bg-[#0f2e3a]/5 px-2 py-1.5 text-[11px] text-[#0f2e3a] focus:outline-none" />
                          <div className="flex gap-1.5">
                            <button onClick={async () => { await updateNabavaTrip({ id: trip.id, date: nabavaEditDate, note: nabavaEditNote }); setNabavaEditId(null); await mutateNabava(); }}
                              className="rounded-full border border-[#4f7a54]/40 bg-[#4f7a54]/15 px-3 py-1.5 text-[10px] font-semibold text-[#4f7a54]">Shrani</button>
                            <button onClick={() => setNabavaEditId(null)}
                              className="rounded-full border border-[#0f2e3a]/15 bg-[#0f2e3a]/5 px-3 py-1.5 text-[10px] font-medium text-[#2b2622]/70">Prekliči</button>
                          </div>
                        </div>
                      ) : (
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[11px] font-semibold text-[#4f7a54]">
                              {trip.date ? new Date(trip.date + 'T00:00:00').toLocaleDateString('sl-SI', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                            </p>
                            {trip.note && <p className="text-[11px] text-[#2b2622]/70">{trip.note}</p>}
                          </div>
                          <div className="flex shrink-0 gap-1.5">
                            <button onClick={() => { setNabavaEditId(trip.id); setNabavaEditDate(trip.date); setNabavaEditNote(trip.note); }}
                              className="flex h-7 w-7 items-center justify-center rounded-full border border-[#0f2e3a]/15 bg-[#0f2e3a]/5 text-[#2b2622]/60 transition-colors hover:bg-[#0f2e3a]/10">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={async () => { if (!confirm('Izbrišem nabavo? Povezana plačila se bodo razveljavila.')) return; await deleteNabavaTrip(trip.id); refresh(); await mutateNabava(); }}
                              className="flex h-7 w-7 items-center justify-center rounded-full border border-[#0f2e3a]/15 bg-[#0f2e3a]/5 text-[#2b2622]/60 transition-colors hover:bg-red-500/10 hover:text-red-600 hover:border-red-500/40">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                      <div className="border-t border-dashed border-[#8fae92]/30 pt-2">
                        <NabavaPurchasesSection tripId={trip.id} tripNote={trip.note} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Expanded Excursions Panel */}
          {showPendingExcursions && (
            <div className="mt-4 rounded-2xl border border-[#8fae92]/20 bg-[#0a2029]/90 backdrop-blur-xl p-5">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[#8fae92] mb-3 flex items-center gap-2">
                <Palmtree className="h-4 w-4" />
                Izleti - {pendingExcursionsCount} za naročiti
              </h4>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                {allExcursionsList.map((item, idx) => {
                  const r = item.reservation;
                  const exc = item.excursion;
                  const members = item.members;
                  const isGroup = !!exc.groupId && members.length > 1;
                  const shortBungalow = bungalowDisplayName(r.bungalow);
                  const isOrdered = item.isOrdered;
                  // Skupno število oseb (skupinski: vsota ��lanov)
                  const totalPax = members.reduce((sum, m) => sum + (m.excursion.pax || 0), 0);

                  // --- Izra��un zneskov za Dilipa in vodiča (kosilo) ---
                  // Nabavna cena čolna iz cenika "Izleti - Nabavne" (excursionPricing)
                  const boatPriceRow = data?.excursionPricing?.find(
                    (ep: { excursionId: string; boatId: string; priceAr: number }) =>
                      ep.excursionId === exc.excursionId && ep.boatId === exc.boatId
                  );
                  const boatCompletePrice = boatPriceRow?.priceAr || 0;
                  // Cena vodiča iz tipa izleta
                  const excType = data?.excursions?.find(
                    (e: { id: string; guidePriceAr?: number; entranceFeeAr?: number }) => e.id === exc.excursionId
                  );
                  const guidePrice = excType?.guidePriceAr || 0;
                  // Fiksna cena Dilipu za izleta "Top of Nosy Komba" in "Top of the Nosy Komba + Boabab" = 80.000 Ar
                  const excNameLc = (item.excursionName || '').toLowerCase();
                  const isFixedDilipExcursion = excNameLc.includes('top of') && excNameLc.includes('nosy komba');
                  // Ampangorina / Maki park: nabavna cena čolna (npr. 80.000 Ar) je DIREKTNO plačilo
                  // Dilipu za čoln (brez 10 % popusta in brez odštevanja vodiča) + vodič.
                  const isDirectBoatExcursion = excNameLc.includes('ampangorina') || excNameLc.includes('maki');
                  // Dilip = (kompletna cena čolna − vodič) × 0,90 + vodič — ČOLN je en sam za skupino
                  const boatNet = Math.max(0, boatCompletePrice - guidePrice);
                  // Top of Nosy Komba: čoln FIKSNO 80.000 Ar + vodič (guidePriceAr, npr. 50.000)
                  const dilipOverride = members.map(m => (m.excursion as { dilipOverrideAr?: number | null }).dilipOverrideAr).find(v => v != null);
                  const dilipPayment = dilipOverride != null
                    ? Number(dilipOverride)
                    : isFixedDilipExcursion
                    ? 80000 + guidePrice
                    : isDirectBoatExcursion
                      ? boatCompletePrice + guidePrice
                      : (boatNet > 0 ? Math.round(boatNet * 0.9) + guidePrice : 0);
                  // Vstopnina (skiper jo plača na licu mesta) = vstopnina/os × SKUPNO število oseb
                  const entranceTotalAr = Math.round((excType?.entranceFeeAr || 0) * totalPax);
                  // Dodatna vstopnina (npr. Maki park), vpisana na posamezni booking (znesek v Ar za celo rezervacijo)
                  const extraEntranceAr = members.reduce((sum, m) => sum + (Number(m.excursion.extraEntranceAr) || 0), 0);
                  const extraEntranceLabel = members.map(m => m.excursion.extraEntranceLabel).find(l => l && l.trim()) || 'Dodatna vstopnina';
                  // Kosilo vodiču = cena kosila/os × št. oseb, NEPOSREDNO v Ariarjih iz cenika
                  // ponudnika (pricePerPersonAr). Prej se je računalo iz shranjene EUR cene ×
                  // tečaj, kar je zaradi round-tripa Ar→EUR→Ar zaokroževalo (70.000 → 69.984 Ar).
                  const excRate = data?.exchangeRate || DEFAULT_RATE;
                  const lunchTotal = members.reduce((sum, m) => {
                    const provider = dbLunchProviders.find((lp: { id: string; pricePerPersonAr: number }) => lp.id === m.excursion.lunchProviderId);
                    if (provider) return sum + provider.pricePerPersonAr * (m.excursion.pax || 0);
                    // Rezerva (star booking brez ponudnika): pretvori shranjeno EUR ceno.
                    return sum + Math.round((m.excursion.lunchPrice || 0) * excRate);
                  }, 0);
                  // Fanja organizira izlet (ime se začne s "Fanja"): plačamo JI 90 % cene izleta
                  // za gosta (ona nam pusti 10 %). Zamenja vrstico "Dilipu (čoln + vodič)".
                  const isFanjaExcursion = (item.excursionName || '').trim().toLowerCase().startsWith('fanja');
                  const fanjaGuestTotalEur = members.reduce((sum, m) => sum + (m.excursion.guestPrice || 0), 0);
                  const fanjaPayment = Math.round(fanjaGuestTotalEur * 0.9 * excRate);
                  // Plačilo Fanji: stanje beremo iz prvega člana (vknjižba je ena za celo skupino).
                  const fanjaMemberIds = members.map(m => m.excursion.id);
                  const fanjaPaidAt = (members[0]?.excursion as { fanjaPaidAt?: string | null })?.fanjaPaidAt || null;
                  const fanjaPaidMethod = (members[0]?.excursion as { fanjaPaidMethod?: string | null })?.fanjaPaidMethod || null;
                  const fanjaPaidCompany = (members[0]?.excursion as { fanjaPaidCompany?: string | null })?.fanjaPaidCompany || null;
                  const fanjaPaidAmountAr = (members[0]?.excursion as { fanjaPaidAmountAr?: number })?.fanjaPaidAmountAr || 0;
                  const fanjaPanelKey = fanjaMemberIds.join('|');
                  const fanjaLabel = `Izlet ${item.excursionName || ''} — ${members.map(m => `${bungalowDisplayName(m.reservation.bungalow)} / ${m.reservation.guestName}`).join(', ')}`.slice(0, 200);

                  return (
                    <div key={`exc-${idx}`} className="relative overflow-hidden p-3 pl-4 rounded-xl border border-[#0f2e3a]/12 bg-[#efe8da]">
                      {/* Levi statusni trak — kot pri kartici bungalova (naročeno = žajbelj, čaka = jantar) */}
                      <span aria-hidden className="absolute left-0 top-0 h-full w-[3px]" style={{ backgroundColor: isOrdered ? '#4f7a54' : '#b0761a' }} />
                      <div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {isOrdered ? (
                              <span className="text-[#4f7a54] text-xs">✓</span>
                            ) : (
                              <span className="text-[#b0761a] text-xs">⚠</span>
                            )}
                            <span className="text-[#8f6d3a] text-sm font-medium">
                              {exc.date ? new Date(exc.date).toLocaleDateString('sl-SI', { day: 'numeric', month: 'short' }) : 'Ni datuma'}
                            </span>
                          </div>
                          <p className="text-[#4f7a54] text-xs font-medium truncate">
                            {item.excursionName}
                            {isGroup && <span className="ml-1 px-1.5 py-0.5 rounded bg-[#3f6b7d]/15 text-[#3f6b7d] text-[9px] align-middle">SKUPINA</span>}
                          </p>
                          {isGroup ? (
                            <div className="text-[#0f2e3a]/80 text-xs">
                              {members.map((m, mi) => {
                                const mb = bungalowDisplayName(m.reservation.bungalow);
                                return (
                                  <p key={mi} className="truncate">{mb} - <span className="text-[#0f2e3a] font-medium">{m.reservation.guestName}</span> <span className="text-[#2b2622]/50">({m.excursion.pax} os)</span></p>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-[#0f2e3a]/80 text-xs truncate">{shortBungalow} - <span className="text-[#0f2e3a] font-medium">{r.guestName}</span></p>
                          )}
                          <p className="text-[#2b2622]/50 text-[10px]">{totalPax} os{isGroup ? ' skupaj' : ''}</p>
                          {/* Zneski za plačilo */}
                          <div className="mt-2 space-y-1 border-t border-[#0f2e3a]/12 pt-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] text-[#2b2622]/55">{isFanjaExcursion ? 'Plačilo Fanji' : 'Dilipu (čoln + vodič)'}</span>
                              <span className="text-[11px] font-semibold text-[#3f6b7d] whitespace-nowrap">
                                {isFanjaExcursion
                                  ? (fanjaPayment > 0 ? ar(fanjaPayment) : '—')
                                  : (dilipPayment > 0 ? ar(dilipPayment) : '—')}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] text-[#2b2622]/55">Vodiču za kosilo</span>
                              <span className="text-[11px] font-semibold text-[#8f6d3a] whitespace-nowrap">
                                {lunchTotal > 0 ? ar(lunchTotal) : '—'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] text-[#2b2622]/55">Skiperju za vstopnino ({totalPax} os)</span>
                              <span className="text-[11px] font-semibold text-[#a8543a] whitespace-nowrap">
                                {isFanjaExcursion ? '—' : (entranceTotalAr > 0 ? ar(entranceTotalAr) : '—')}
                              </span>
                            </div>
                            {extraEntranceAr > 0 && (
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[10px] text-[#2b2622]/55">{extraEntranceLabel} ({totalPax} os)</span>
                                <span className="text-[11px] font-semibold text-[#a8543a] whitespace-nowrap">
                                  {ar(extraEntranceAr)}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {isOrdered ? (
                              <span className="inline-flex flex-1 min-w-[120px] items-center justify-center gap-2 rounded-full border border-[#5f7d75] bg-gradient-to-br from-[#8fae92] via-[#3f605b] to-[#0f2e3a] px-5 py-2.5 text-[#e8f0e6]">
                                <Palmtree className="h-4 w-4" />
                                <span className="text-[10px] font-semibold uppercase tracking-[0.2em]">Naročeno ✓</span>
                              </span>
                            ) : (
                              <button
                                onClick={async () => {
                                  await Promise.all(members.map(m =>
                                    updateExcursionBooking(m.excursion.id, { dilipOrderedAt: new Date().toISOString() })
                                  ));
                                  refresh();
                                }}
                                className="inline-flex flex-1 min-w-[120px] items-center justify-center gap-2 rounded-full bg-[#b0761a]/12 border border-[#b0761a]/35 px-4 py-2 text-[#b0761a] hover:bg-[#b0761a]/20 transition-colors"
                              >
                                <Palmtree className="h-4 w-4" />
                                <span className="text-[10px] font-semibold uppercase tracking-[0.15em]">Naroči izlet</span>
                              </button>
                            )}
                          </div>

                          {/* Plačilo Fanji — samo pri Fanjinih izletih z zneskom */}
                          {isFanjaExcursion && fanjaPayment > 0 && (
                            <div className="mt-2">
                              {/* Panel ima PREDNOST — tako deluje tudi urejanje že plačanega */}
                              {fanjaPayOpen === fanjaPanelKey ? (
                                <div className="rounded-xl border border-[#3f6b7d]/25 bg-[#3f6b7d]/[0.06] p-3 space-y-3">
                                  <p className="text-[11px] font-semibold text-[#3f6b7d]">{fanjaPaidAt ? 'Uredi plačilo Fanji' : 'Plačilo Fanji'} · {ar(fanjaPayment)}</p>
                                  {/* Način plačila */}
                                  <div className="flex gap-2">
                                    {(['cash', 'orange'] as const).map(m => (
                                      <button
                                        key={m}
                                        onClick={() => setFanjaPayMethod(m)}
                                        className={`flex-1 rounded-lg px-3 py-2 text-[11px] font-medium border transition-colors ${fanjaPayMethod === m ? 'bg-[#3f6b7d]/15 text-[#3f6b7d] border-[#3f6b7d]/40' : 'bg-[#0f2e3a]/5 text-[#2b2622]/60 border-[#0f2e3a]/15 hover:bg-[#0f2e3a]/10'}`}
                                      >
                                        {m === 'cash' ? 'Gotovina' : 'Orange Money'}
                                      </button>
                                    ))}
                                  </div>
                                  {/* Podjetje — samo pri gotovini */}
                                  {fanjaPayMethod === 'cash' && (
                                    <div className="flex gap-2">
                                      {(['tourism', 'sarl'] as const).map(c => (
                                        <button
                                          key={c}
                                          onClick={() => setFanjaPayCompany(c)}
                                          className={`flex-1 rounded-lg px-3 py-2 text-[10px] font-medium border transition-colors ${fanjaPayCompany === c ? 'bg-[#4f7a54]/15 text-[#4f7a54] border-[#4f7a54]/40' : 'bg-[#0f2e3a]/5 text-[#2b2622]/60 border-[#0f2e3a]/15 hover:bg-[#0f2e3a]/10'}`}
                                        >
                                          {c === 'tourism' ? 'KOMBA CABANA TOURISM SARL' : 'KOMBA CABANA SARL'}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                  {/* Datum plačila */}
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-[#2b2622]/55">Datum plačila:</span>
                                    <input
                                      type="date"
                                      value={fanjaPayDate}
                                      onChange={e => setFanjaPayDate(e.target.value)}
                                      className="flex-1 rounded-lg bg-[#0f2e3a]/5 border border-[#0f2e3a]/15 px-2 py-1.5 text-[11px] text-[#0f2e3a] [color-scheme:light] focus:border-[#3f6b7d]/40 focus:outline-none"
                                    />
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => setFanjaPayOpen(null)}
                                      className="rounded-lg bg-[#0f2e3a]/5 border border-[#0f2e3a]/15 px-3 py-2 text-[11px] font-medium text-[#2b2622]/70 hover:bg-[#0f2e3a]/10 transition-colors"
                                    >
                                      Prekliči
                                    </button>
                                    <button
                                      disabled={fanjaPaySaving}
                                      onClick={async () => {
                                        setFanjaPaySaving(true);
                                        try {
                                          await payFanja({
                                            bookingIds: fanjaMemberIds,
                                            method: fanjaPayMethod,
                                            company: fanjaPayMethod === 'cash' ? fanjaPayCompany : undefined,
                                            date: fanjaPayDate,
                                            amountAr: fanjaPayment,
                                            label: fanjaLabel,
                                          });
                                          setFanjaPayOpen(null);
                                          refresh();
                                        } finally {
                                          setFanjaPaySaving(false);
                                        }
                                      }}
                                      className="flex-1 rounded-lg bg-[#3f6b7d]/15 border border-[#3f6b7d]/40 px-3 py-2 text-[11px] font-semibold text-[#3f6b7d] hover:bg-[#3f6b7d]/25 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                      {fanjaPaySaving ? 'Beležim…' : 'Zabeleži plačilo'}
                                    </button>
                                  </div>
                                </div>
                              ) : fanjaPaidAt ? (
                                <div className="flex flex-col gap-2 rounded-xl border border-[#8f6d3a]/30 bg-[#f7efdd] px-3 py-2">
                                  <div className="min-w-0">
                                    <p className="text-[11px] font-semibold text-[#0f2e3a]">
                                      Plačano Fanji ✓ · {fanjaPaidMethod === 'orange'
                                        ? <span className="text-[#c4741f]">Orange Money</span>
                                        : 'Gotovina'}
                                      {fanjaPaidMethod === 'cash' && fanjaPaidCompany ? ` (${fanjaPaidCompany === 'sarl' ? 'SARL' : 'Tourism'})` : ''}
                                    </p>
                                    <p className="text-[10px] text-[#2b2622]/55">
                                      {new Date(fanjaPaidAt).toLocaleDateString('sl-SI', { day: 'numeric', month: 'short', year: 'numeric' })} · {ar(fanjaPaidAmountAr || fanjaPayment)}
                                    </p>
                                  </div>
                                  <div className="flex justify-center gap-1.5">
                                    <button
                                      onClick={() => {
                                        // Uredi: prednapolni panel z obstoječimi vrednostmi in ga odpri
                                        setFanjaPayMethod(fanjaPaidMethod === 'orange' ? 'orange' : 'cash');
                                        setFanjaPayCompany(fanjaPaidCompany === 'sarl' ? 'sarl' : 'tourism');
                                        setFanjaPayDate(fanjaPaidAt.slice(0, 10));
                                        setFanjaPayOpen(fanjaPanelKey);
                                      }}
                                      aria-label="Uredi plačilo"
                                      title="Uredi"
                                      className="inline-flex items-center justify-center rounded-full border border-[#8f6d3a]/30 bg-[#f7efdd] p-1.5 text-[#8f6d3a] hover:bg-[#f2e6c9] transition-colors"
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      onClick={async () => {
                                        if (!confirm('Prekličem plačilo Fanji? Vknjižba v blagajni/Orange Money se bo izbrisala.')) return;
                                        await unpayFanja({ bookingIds: fanjaMemberIds });
                                        refresh();
                                      }}
                                      className="rounded-full border border-[#8f6d3a]/30 bg-[#f7efdd] px-3 py-1.5 text-[10px] font-medium text-[#2b2622]/70 hover:bg-red-500/10 hover:text-red-600 hover:border-red-500/30 transition-colors"
                                    >
                                      Prekliči
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  onClick={() => {
                                    setFanjaPayMethod('cash');
                                    setFanjaPayCompany('tourism');
                                    setFanjaPayDate(new Date().toISOString().slice(0, 10));
                                    setFanjaPayOpen(fanjaPanelKey);
                                  }}
                                  className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#3f6b7d]/30 bg-[#3f6b7d]/10 px-4 py-2 text-[#3f6b7d] hover:bg-[#3f6b7d]/20 transition-colors"
                                >
                                  <span className="text-[10px] font-semibold uppercase tracking-[0.15em]">Plačilo Fanji</span>
                                </button>
                              )}
                            </div>
                          )}

                          {/* Plačilo dobavitelju — NE-Fanjin izlet: Dilip / kosilo / vstopnina (vsak svoj panel) */}
                          {!isFanjaExcursion && (() => {
                            const groupKey = exc.groupId ? `g:${exc.groupId}` : `s:${exc.id}`;
                            const excLabel = (who: string) => `Izlet ${item.excursionName || ''} (${who}) — ${members.map(m => `${bungalowDisplayName(m.reservation.bungalow)} / ${m.reservation.guestName}`).join(', ')}`.slice(0, 200);
                            const hasAny = dilipPayment > 0 || lunchTotal > 0 || entranceTotalAr > 0;
                            if (!hasAny) return null;
                            return (
                              <div className="mt-2 space-y-1.5">
                                {dilipPayment > 0 && renderSupplierPay(`excursion:${groupKey}:dilip`, 'dilip', dilipPayment, 'Dilipu (čoln + vodič)', excLabel('Dilip'), '#3f6b7d')}
                                {lunchTotal > 0 && renderSupplierPay(`excursion:${groupKey}:lunch`, 'lunch', lunchTotal, 'Vodiču za kosilo', excLabel('kosilo'), '#8f6d3a')}
                                {entranceTotalAr > 0 && renderSupplierPay(`excursion:${groupKey}:entrance`, 'entrance', entranceTotalAr, `Skiperju za vstopnino (${totalPax} os)`, excLabel('vstopnina'), '#a8543a')}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

  {/* Content */}
  <div className="relative mx-auto max-w-7xl px-4 sm:px-8 py-6 sm:py-10">
  {tab === "bungalows" && <Bungalows />}

  {/* Personal landing page — Borut / Urška. Lists that person's own sections
      with a live line of what is actually waiting there today. */}
  {(tab === "borut" || tab === "urska") && (() => {
    const person = personPages[tab];
    const accent = person.accent;
    const PersonIcon = person.icon;
    const t = today();
    const active = reservations.filter(r => r.status !== "CANCELLED");
    const arrivalsToday = active.filter(r => r.arrival === t).length;
    const departuresToday = active.filter(r => r.departure === t).length;
    // Only items that are still unticked count as waiting.
    const checkMap: Record<string, boolean> = reminderChecks || {};
    const reminderCount = reminderSections.reduce(
      (sum, s) => sum + s.items.filter(it => !checkMap[it.id]).length,
      0,
    );
    // Slovene needs the dual form: 1 odhod, 2 odhoda, 3-4 odhodi, 5+ odhodov.
    const sklon = (n: number, one: string, two: string, few: string, many: string) => {
      const m = n % 100;
      return m === 1 ? one : m === 2 ? two : m === 3 || m === 4 ? few : many;
    };
    const inHouse = active.filter(r => r.checkedInAt && !r.checkedOutAt).length;
    const openReservations = active.filter(r => !r.checkedOutAt).length;
    // One quiet, factual line per entry — no decorative stats.
    const metaFor = (id: string) => {
      if (id === "bungalows") {
        return inHouse > 0
          ? `${inHouse} od ${BUNGALOWS.length} zasedenih`
          : `Vseh ${BUNGALOWS.length} prostih`;
      }
      if (id === "reservations") {
        return openReservations > 0
          ? `${openReservations} ${sklon(openReservations, "aktivna rezervacija", "aktivni rezervaciji", "aktivne rezervacije", "aktivnih rezervacij")}`
          : "Ni aktivnih rezervacij";
      }
      if (id === "koledar") {
        if (arrivalsToday === 0 && departuresToday === 0) return "Danes ni prihodov niti odhodov";
        const parts: string[] = [];
        if (arrivalsToday > 0) parts.push(`${arrivalsToday} ${sklon(arrivalsToday, "prihod", "prihoda", "prihodi", "prihodov")}`);
        if (departuresToday > 0) parts.push(`${departuresToday} ${sklon(departuresToday, "odhod", "odhoda", "odhodi", "odhodov")}`);
        return `${parts.join(" · ")} danes`;
      }
      if (id === "opomnik") {
        return reminderCount > 0
          ? `${reminderCount} ${sklon(reminderCount, "zadeva", "zadevi", "zadeve", "zadev")} za danes`
          : "Ni novih zadev za danes";
      }
      // The rest state plainly what lives there, so the list reads without guessing.
      const descriptions: Record<string, string> = {
        vreme: "Veter, valovi in dež na Nosy Komba",
        bar: "Blagajna in prijave osebja",
      barblagajna: "Dobavnice po bungalovih",
      prijave: "Kdo je bil prijavljen v blagajno",
      razporedi: "Pregled razporedov po oddelkih",
      "razpored-sobarice": "Eniki, Felicia, Christaline, Mela",
      "razpored-vrtnarji": "Hijaldo, Velo, Maxim, Francelj, KD",
      "razpored-kuhinja": "Anifa, Verginie, Angelina, Nazirah, Francia, Justin",
      "razpored-bar": "Alex, Fransia, Sandia, Walas, Jonny, Justin",
        recepcija: "Blagajna, transferji in izleti",
        imenik: "Klici stikov iz Orange Money imenika",
        bentral: "Uvoz rezervacij",
        arhiv: "Odjavljeni gostje in računi",
        ceniki: "Cene, čolni in izleti",
        takse: "Občinska in turistična taksa",
        novracun: "Slikaj ali naloži račun za strošek",
        kalkulacije: "Prihodki, stroški in dobiček",
        kadrovske: "Razporedi in plače",
        emaili: "Poslana sporočila gostom",
        anketa: "Ocene gostov",
      };
      return descriptions[id] || "";
    };
    const rowClass = "group flex w-full items-center gap-5 border-b border-white/[0.08] px-1 py-5 text-left transition-colors hover:bg-white/[0.02]";
    const rowInner = (entry: PersonEntry) => {
      const EntryIcon = entry.icon;
      return (
        <>
          <EntryIcon className="h-5 w-5 flex-shrink-0 text-[#9dafb5] transition-colors group-hover:text-[#c59b5b]" />
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-light tracking-[0.02em] text-[#f8f5ef] transition-colors group-hover:text-[#c59b5b]">
              {entry.label}
            </span>
            <span className="mt-1 block text-[11px] tracking-[0.04em] text-[#9dafb5]/75">
              {metaFor(entry.id)}
            </span>
          </span>
          <ArrowRight className="h-4 w-4 flex-shrink-0 text-[#c59b5b]/50 transition-transform duration-300 group-hover:translate-x-1" />
        </>
      );
    };
    // Tile variant: a real, chunky press target per module. Tailwind v4 drops the
    // default button cursor, so cursor-pointer has to be explicit here.
    const useTiles = !!person.tiles;
    const tileClass =
      "group flex w-full cursor-pointer items-center gap-4 rounded-xl border border-white/[0.12] bg-white/[0.07] px-4 py-4 text-left transition-colors hover:border-[#c59b5b]/45 hover:bg-white/[0.11] active:bg-white/[0.14]";
    const tileInner = (entry: PersonEntry) => {
      const EntryIcon = entry.icon;
      return (
        <>
          <span
            aria-hidden
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg border"
            style={{ borderColor: accent + "40", backgroundColor: accent + "14", color: accent }}
          >
            <EntryIcon className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[16px] font-medium tracking-[0.02em] text-[#f8f5ef]">
              {entry.label}
            </span>
            <span className="mt-0.5 block text-[11px] tracking-[0.04em] text-[#9dafb5]/75">
              {metaFor(entry.id)}
            </span>
          </span>
          <ArrowRight className="h-4 w-4 flex-shrink-0 text-[#c59b5b]/50 transition-transform duration-300 group-hover:translate-x-1" />
        </>
      );
    };
    const entryClass = useTiles ? tileClass : rowClass;
    const entryInner = useTiles ? tileInner : rowInner;
    // Same tile, but the trailing arrow becomes a chevron that flips when open.
    const groupInner = (entry: PersonEntry, open: boolean) => {
      const EntryIcon = entry.icon;
      return (
        <>
          {useTiles ? (
            <span
              aria-hidden
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg border"
              style={{ borderColor: accent + "40", backgroundColor: accent + "14", color: accent }}
            >
              <EntryIcon className="h-5 w-5" />
            </span>
          ) : (
            <EntryIcon className="h-5 w-5 flex-shrink-0 text-[#9dafb5] transition-colors group-hover:text-[#c59b5b]" />
          )}
          <span className="min-w-0 flex-1">
            <span className={useTiles
              ? "block text-[16px] font-medium tracking-[0.02em] text-[#f8f5ef]"
              : "block text-[15px] font-light tracking-[0.02em] text-[#f8f5ef] transition-colors group-hover:text-[#c59b5b]"}>
              {entry.label}
            </span>
            <span className={`${useTiles ? "mt-0.5" : "mt-1"} block text-[11px] tracking-[0.04em] text-[#9dafb5]/75`}>
              {metaFor(entry.id)}
            </span>
          </span>
          <ChevronDown
            className={`h-4 w-4 flex-shrink-0 text-[#c59b5b]/50 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
          />
        </>
      );
    };
    return (
      <section className="mx-auto max-w-3xl">
        <header className="flex items-center gap-5">
          <span
            aria-hidden
            className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full border"
            style={{ borderColor: accent + "55", color: accent }}
          >
            <PersonIcon className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.28em] text-[#c59b5b]">
              <span aria-hidden className="h-px w-4 bg-[#c59b5b]/50" />
              Osebni pregled
            </p>
            <h2 className="mt-1.5 font-[family-name:var(--font-manrope)] text-[1.6rem] font-light tracking-wide text-[#f8f5ef]">
              {person.label}
            </h2>
          </div>
          {/* Shortcut to the reminder panel that sits at the very bottom of this
              page. Here it is unambiguous: on Urška's page it rings Borut. */}
          <button
            type="button"
            onClick={() => setShowPushBox(true)}
            title={`Pošlji opomnik ${tab === "borut" ? "Urški" : "Borutu"}`}
            aria-label={`Pošlji opomnik ${tab === "borut" ? "Urški" : "Borutu"}`}
            className="ml-auto flex flex-shrink-0 cursor-pointer items-center gap-2 self-center rounded-full border px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] transition-colors"
            style={{ borderColor: accent + "59", backgroundColor: accent + "1a", color: accent }}
          >
            <BellRing className="h-4 w-4" />
            Opomnik
          </button>
        </header>

        <div className="mt-9">
          {person.sections.map((section, si) => (
            <div key={section.label || `s${si}`} className={si > 0 ? "mt-9" : ""}>
              {section.label && (
                <p className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.28em] text-[#9dafb5]/70">
                  <span aria-hidden className="h-px w-4" style={{ backgroundColor: accent + "80" }} />
                  {section.label}
                </p>
              )}
              <div
                className={
                  useTiles
                    ? `flex flex-col gap-3 ${section.label ? "mt-3.5" : ""}`
                    : `border-t border-white/[0.08] ${section.label ? "mt-3.5" : ""}`
                }
              >
                {section.items.map(entry => entry.children ? (
                  // Group: the tile toggles, its children slide in underneath.
                  <div key={entry.id} className={useTiles ? "" : "contents"}>
                    <button
                      type="button"
                      onClick={() => setOpenEntryGroups(v => ({ ...v, [entry.id]: !v[entry.id] }))}
                      aria-expanded={!!openEntryGroups[entry.id]}
                      className={entryClass}
                    >
                      {groupInner(entry, !!openEntryGroups[entry.id])}
                    </button>
                    {openEntryGroups[entry.id] && (
                      <div className={useTiles ? "mt-3 flex flex-col gap-3 pl-4" : "pl-4"}>
                        {entry.children.map(child => child.href ? (
                          <Link key={child.id} href={child.href} className={entryClass}>
                            {entryInner(child)}
                          </Link>
                        ) : (
                          <button
                            key={child.id}
                            type="button"
                            onClick={() => { if (child.tab) setTab(child.tab); else child.action?.(); }}
                            className={entryClass}
                          >
                            {entryInner(child)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : entry.href ? (
                  <Link key={entry.id} href={entry.href} className={entryClass}>
                    {entryInner(entry)}
                  </Link>
                ) : (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => { if (entry.tab) setTab(entry.tab); else entry.action?.(); }}
                    className={entryClass}
                  >
                    {entryInner(entry)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* The reminder panel is reached via the "Opomnik" button in the header
            (it opens the same PushNotificationsBox as a modal), so it is not
            repeated inline here. */}
      </section>
    );
  })()}

  {tab === "prijave" && (
    <section>
      <StaffLoginsTab />
    </section>
  )}

  {tab === "vreme" && (
    <section>
      <VremeTab />
    </section>
  )}

  {/* Read-only schedules for the current month. Creating schedules and all
      payroll figures live in Urška's Kadrovski oddelek. */}
  {tab === "razpored-sobarice" && (
    <section>
      <RazporedTab year={scheduleYear} month={scheduleMonth} readOnly />
    </section>
  )}

  {tab === "razpored-vrtnarji" && (
    <section>
      <VrtnarjiTab year={scheduleYear} month={scheduleMonth} readOnly />
    </section>
  )}

  {tab === "razpored-kuhinja" && (
    <section>
      <KuhinjaTab year={scheduleYear} month={scheduleMonth} readOnly />
    </section>
  )}

  {tab === "razpored-bar" && (
    <section>
      <BarTab year={scheduleYear} month={scheduleMonth} readOnly />
    </section>
  )}

  {tab === "koledar" && (
    <section>
      <GlassCard className="p-4 sm:p-6">
        {/* Jungle Glamp Village je samo rezerva — v koledarju ga ne prikazujemo. */}
        <TimelineCalendar
          reservations={reservations}
          bungalows={BUNGALOWS.filter((b) => b !== "Jungle Glamp Village")}
          onSelect={(id) => { setSelectedReservationId(id); setTab("guest"); }}
        />
      </GlassCard>
    </section>
  )}

  {tab === "opomnik" && (
    <section className="mx-auto max-w-2xl">
      <DailyReminder
        date={reminderDate}
        onDateChange={setReminderDate}
        dateLabel={reminderDateLabel}
        sections={reminderSections}
      />
    </section>
  )}
  {tab === "bankstanje" && (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <BankBalanceCard company="tourism" />
      <BankBalanceCard company="sarl" />
    </div>
  )}
  {tab === "imenik" && <PhoneDirectoryCard />}
  {tab === "emaili" && (
    <section>
      <GlassCard className="p-4 sm:p-6">
        <SectionHeader eyebrow="Emails" title="Poslani emaili" subtitle="Pregled vseh emailov, poslanih gostom (prijava, računi, vaučerji)." />
        <div className="mt-6">
          <SentEmailsBox all />
        </div>
      </GlassCard>
    </section>
  )}
  {tab === "anketa" && (
    <section>
      <GlassCard className="p-4 sm:p-6">
        <SectionHeader eyebrow="Survey" title="Kje so nas našli" subtitle="Odgovori gostov na anketo o tem, kje so odkrili naš Lodge (zbrani samodejno)." />
        <div className="mt-6">
          <SurveyResponsesBox />
        </div>
      </GlassCard>
    </section>
  )}
  {tab === "reservations" && (
    <section>
      <GlassCard className="p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SectionHeader eyebrow="Bookings" title="Rezervacije" />
              <LuxuryButton variant="gold" className="w-full sm:w-auto" onClick={() => setShowNewBookingForm(true)}>
                <Plus className="h-4 w-4" /> Nova Rezervacija
              </LuxuryButton>
            </div>

            {/* Koliko rezervacij se prihaja — da je obseg viden brez iskanja po seznamu */}
            {(() => {
              const t = today();
              const tomorrow = new Date(Date.parse(`${t}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
              const sklon = (n: number, one: string, two: string, few: string, many: string) => {
                const m = n % 100;
                return m === 1 ? one : m === 2 ? two : m === 3 || m === 4 ? few : many;
              };
              // "Prihaja" = se ni prijavljen, prihod danes ali kasneje
              const upcoming = reservations.filter(
                r =>
                  r.status !== "CANCELLED" &&
                  !r.checkedOutAt &&
                  !r.checkedInAt &&
                  String(r.arrival).slice(0, 10) >= t,
              );
              const arrivalsToday = upcoming.filter(r => String(r.arrival).slice(0, 10) === t).length;
              const arrivalsTomorrow = upcoming.filter(r => String(r.arrival).slice(0, 10) === tomorrow).length;
              const parts: string[] = [];
              if (arrivalsToday > 0) parts.push(`danes ${arrivalsToday}`);
              if (arrivalsTomorrow > 0) parts.push(`jutri ${arrivalsTomorrow}`);

              return (
                <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-[#c59b5b]/25 bg-[#c59b5b]/[0.06] px-3 py-2.5">
                  <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#e8c88a]">
                    <span aria-hidden className="h-px w-4 bg-[#c59b5b]/60" />
                    Prihaja
                  </span>
                  <span className="text-sm font-light tabular-nums text-white">
                    {upcoming.length > 0
                      ? `${upcoming.length} ${sklon(upcoming.length, "rezervacija", "rezervaciji", "rezervacije", "rezervacij")}`
                      : "Ni prihajajočih rezervacij"}
                  </span>
                  {parts.length > 0 && (
                    <span className="text-[11px] tabular-nums text-white/50">{parts.join(" · ")}</span>
                  )}
                </div>
              );
            })()}

            <div className="mt-4 relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            value={reservationSearch}
            onChange={e => setReservationSearch(e.target.value)}
            placeholder="Iš��i po imenu, bungalovu ali viru (npr. Gaia Couture)"
            className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-9 text-sm text-white placeholder:text-white/30 focus:border-[#c59b5b]/50 focus:outline-none"
          />
          {reservationSearch && (
            <button
              onClick={() => setReservationSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-white/40 hover:bg-white/10 hover:text-white/70 transition-colors"
              aria-label="Počisti iskanje"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="mt-4 space-y-3 sm:max-h-[70vh] sm:overflow-y-auto">
          {(() => {
            const q = reservationSearch.trim();
            const isSearching = q.length >= 2;
            // When searching, use full DB search (incl. checked-out / past guests).
            // Otherwise show the active reservations loaded on the dashboard.
            const list = isSearching
              ? ((searchResults || []) as unknown as Reservation[])
              : [...reservations].sort((a, b) => new Date(a.arrival).getTime() - new Date(b.arrival).getTime());

            if (!isSearching && reservations.length === 0) {
              return <p className="text-white/40 text-center py-8">Ni rezervacij.</p>;
            }
            if (isSearching && searchLoading && (!searchResults || searchResults.length === 0)) {
              return <p className="text-white/40 text-center py-8">Iščem &hellip;</p>;
            }
            if (isSearching && !searchLoading && list.length === 0) {
              return <p className="text-white/40 text-center py-8">Ni zadetkov za &quot;{reservationSearch}&quot;.</p>;
            }
            return list.map(_res => {
            const res = _res as Reservation & { noTransferNeeded?: boolean };
            const shortBungalow = bungalowDisplayName(res.bungalow);
            const sourceVariant = res.bookingSource === 'Booking.com' ? 'ocean' 
              : res.bookingSource === 'Airbnb' ? 'danger' 
              : 'gold';
            const isInHouse = res.checkedInAt && !res.checkedOutAt;
            return (
            <button 
              key={res.id} 
              className="w-full cursor-pointer text-left rounded-xl border border-white/[0.12] bg-white/[0.07] p-4 transition-all duration-200 hover:border-[#c59b5b]/45 hover:bg-white/[0.11] active:bg-white/[0.14] active:scale-[0.98]"
              onClick={() => { setSelectedReservationId(res.id); setTab("guest"); }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`font-semibold truncate ${isInHouse ? 'text-[#c59b5b]' : 'text-white'}`}>{res.guestName}</p>
                    {isInHouse && (
                      <LuxuryBadge variant="petrol">In house</LuxuryBadge>
                    )}
                    {res.bookingSource && (
                      <LuxuryBadge variant={sourceVariant as "ocean" | "danger" | "gold"}>
                        {res.bookingSource === 'Booking.com' ? 'Booking' : res.bookingSource}
                      </LuxuryBadge>
                    )}
                    {res.mealPlanSnack && (
                      <LuxuryBadge variant="gold"><Cookie className="h-3 w-3" /> Snack</LuxuryBadge>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-white/50">{shortBungalow}</p>
                  <p className="text-xs text-white/40">{res.arrival} → {res.departure}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {res.honeymoon && (
                    <Heart className="h-4 w-4 text-[#c59b5b]" />
                  )}
                  {res.allergies && (
                    <Leaf className="h-4 w-4 text-[#8fae92]" />
                  )}
                  {/* Transfer status indicator */}
                  {(() => {
                    const hasArrivalTransfer = res.transfers?.arrival?.route;
                    const hasDepartureTransfer = res.transfers?.departure?.route;
                    const noTransferNeeded = (res as { noTransferNeeded?: boolean }).noTransferNeeded;
                    
                    if (noTransferNeeded) {
                      // Ne potrebuje prevoza - prečrtan čoln
                      return (
                        <div className="relative">
                          <Ship className="h-4 w-4 text-white/30" />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-5 h-0.5 bg-white/50 rotate-[-45deg]" />
                          </div>
                        </div>
                      );
                    } else if (hasArrivalTransfer || hasDepartureTransfer) {
                      // Ima naročen prevoz - zelen ��oln
                      return <Ship className="h-4 w-4 text-[#8fae92]" />;
                    } else {
                      // Ni prevoza in ni označeno da ne potrebuje - opozorilo
                      return (
                        <div className="relative">
                          <Ship className="h-4 w-4 text-[#bc7d67]" />
                          <HelpCircle className="absolute -top-1 -right-1 h-2.5 w-2.5 text-[#bc7d67]" />
                        </div>
                      );
                    }
                  })()}
                </div>
              </div>
            </button>
          )});
          })()}
        </div>
      </GlassCard>
      
      {/* New Booking Modal */}
      {showNewBookingForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setShowNewBookingForm(false)}>
          <div 
            className="relative w-full sm:max-w-md sm:mx-4 bg-[#0f2e3a] border-t sm:border border-white/10 sm:rounded-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Drag handle for mobile */}
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>
            
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[#c59b5b]">New Booking</p>
                <h3 className="text-lg font-semibold text-white">Nova Rezervacija</h3>
              </div>
              <button 
                onClick={() => setShowNewBookingForm(false)} 
                className="p-2 rounded-full bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            {/* Form */}
            <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
              {GuestNameInput}
              <LuxurySelect label="Bungalow" value={reservationDraft.bungalow} onChange={v => setReservationDraft(p => ({ ...p, bungalow: v }))} options={BUNGALOWS} />
              <LuxuryInput label="Pax" type="number" value={reservationDraft.pax} onChange={v => setReservationDraft(p => ({ ...p, pax: Number(v) }))} />
              <div className="grid grid-cols-2 gap-3">
                <LuxuryInput label="Prihod" type="date" value={reservationDraft.arrival} onChange={v => setReservationDraft(p => ({ ...p, arrival: v }))} />
                <LuxuryInput label="Odhod" type="date" value={reservationDraft.departure} onChange={v => setReservationDraft(p => ({ ...p, departure: v }))} />
              </div>
              <LuxurySelect label="Booking Source" value={reservationDraft.bookingSource} onChange={v => setReservationDraft(p => ({ ...p, bookingSource: v }))} options={BOOKING_SOURCES} />
              {reservationDraft.bookingSource === "Agency" && AgencyNameInput}
              {(reservationDraft.bookingSource === "Agency" || reservationDraft.bookingSource === "Booking.com" || reservationDraft.bookingSource === "Airbnb") && AgencyCommissionInput}
            </div>
            
            {/* Footer with button */}
            <div className="px-5 py-4 border-t border-white/10 bg-white/[0.02]">
              <LuxuryButton variant="gold" className="w-full" onClick={async () => { await handleCreateReservation(); setShowNewBookingForm(false); }} disabled={saving}>
                {saving ? "Shranjujem..." : "Ustvari rezervacijo"}
              </LuxuryButton>
            </div>
          </div>
        </div>
      )}
    </section>
  )}
                {tab === "guest" && GuestCard()}
                {tab === "orders" && <Orders />}
                {tab === "excursions" && <ExcursionsManager />}
              </div>

      {/* Predogled računa (email) — portal, na voljo na vseh zavihkih */}
      {invoicePreview && activeReservation() && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
          onClick={() => { if (!emailingInvoice) setInvoicePreview(null); }}
        >
          <div
            className="flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#101d22] shadow-2xl"
            style={{ maxHeight: "90vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
              <div>
                <h3 className="text-sm font-semibold text-white">
                  Predogled računa (email)
                  {invoicePreview.excludeAccommodation && <span className="ml-2 rounded-md bg-[#c59b5b]/15 px-2 py-0.5 text-[11px] font-medium text-[#c59b5b]">brez bivanja</span>}
                  {invoicePreview.onlyStayMeals && <span className="ml-2 rounded-md bg-[#c59b5b]/15 px-2 py-0.5 text-[11px] font-medium text-[#c59b5b]">bivanje + prehrana + transport</span>}
                </h3>
                <p className="mt-0.5 text-xs text-white/50">
                  Prejemnik: <span className="text-white/80">{invoicePreview.to}</span>
                </p>
              </div>
              <button
                onClick={() => { if (!emailingInvoice) setInvoicePreview(null); }}
                disabled={emailingInvoice}
                className="rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-50"
                aria-label="Zapri predogled"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-hidden bg-white">
              <iframe
                title="Predogled emaila"
                srcDoc={invoicePreview.html}
                className="h-full w-full border-0"
                style={{ minHeight: "50vh" }}
              />
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-white/10 px-5 py-4">
              <button
                onClick={() => setInvoicePreview(null)}
                disabled={emailingInvoice}
                className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-white/70 hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                Prekliči
              </button>
              <button
                onClick={() => {
                  const ifr = document.querySelector('iframe[title="Predogled emaila"]') as HTMLIFrameElement | null;
                  if (ifr?.contentWindow) {
                    ifr.contentWindow.focus();
                    ifr.contentWindow.print();
                  }
                }}
                disabled={emailingInvoice}
                className="flex items-center gap-2 rounded-xl border border-[#7fa8b8]/40 px-4 py-2.5 text-sm font-medium text-[#7fa8b8] hover:bg-[#7fa8b8]/10 transition-colors disabled:opacity-50"
              >
                <Printer className="h-4 w-4" />
                Natisni
              </button>
              <button
                onClick={async () => {
                  const rid = activeReservation()?.id;
                  if (!rid) return;
                  setEmailingInvoice(true);
                  try {
                    const { sendInvoiceEmail } = await import("@/app/actions/invoice-email");
                    const result = await sendInvoiceEmail(rid, invoicePreview.to, "en", invoicePreview.excludeAccommodation, invoicePreview.onlyStayMeals);
                    if (result.success) {
                      showMsg(`Račun poslan gostu (${invoicePreview.to}).`);
                      setSentEmailsRefresh((n) => n + 1);
                      setInvoicePreview(null);
                    } else {
                      showMsg(result.error || "Pošiljanje ni uspelo.");
                    }
                  } catch {
                    showMsg("Napaka pri pošiljanju računa. Poskusite znova.");
                  } finally {
                    setEmailingInvoice(false);
                  }
                }}
                disabled={emailingInvoice}
                className="flex items-center gap-2 rounded-xl bg-[#c59b5b] px-5 py-2.5 text-sm font-semibold text-[#0a2029] hover:bg-[#c59b5b]/90 transition-colors disabled:opacity-50"
              >
                <Mail className="h-4 w-4" />
                {emailingInvoice ? "Pošiljam..." : "Pošlji račun"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Predogled vaučerja (email) — portal, na voljo na vseh zavihkih */}
      {voucherPreview && activeReservation() && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
          onClick={() => { if (!emailingVoucher) setVoucherPreview(null); }}
        >
          <div
            className="flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#101d22] shadow-2xl"
            style={{ maxHeight: "90vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
              <div>
                <h3 className="text-sm font-semibold text-white">Predogled vaučerja ({voucherPreview.type === "arrival" ? "prihod" : "odhod"})</h3>
                <p className="mt-0.5 text-xs text-white/50">
                  Prejemnik: <span className="text-white/80">{voucherPreview.to}</span>
                </p>
              </div>
              <button
                onClick={() => { if (!emailingVoucher) setVoucherPreview(null); }}
                disabled={emailingVoucher}
                className="rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-50"
                aria-label="Zapri predogled"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-hidden bg-white">
              <iframe
                title="Predogled vaučerja"
                srcDoc={voucherPreview.html}
                className="h-full w-full border-0"
                style={{ minHeight: "50vh" }}
              />
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-white/10 px-5 py-4">
              <button
                onClick={() => setVoucherPreview(null)}
                disabled={emailingVoucher}
                className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-white/70 hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                Prekliči
              </button>
              <button
                onClick={async () => {
                  const rid = activeReservation()?.id;
                  if (!rid) return;
                  setEmailingVoucher(true);
                  try {
                    const { sendTransferVoucherEmail } = await import("@/app/actions/transfer-voucher-email");
                    const result = await sendTransferVoucherEmail(rid, voucherPreview.type, voucherPreview.to);
                    if (result.success) {
                      showMsg(`Vaučer poslan gostu (${voucherPreview.to}).`);
                      setSentEmailsRefresh((n) => n + 1);
                      setVoucherPreview(null);
                    } else {
                      showMsg(result.error || "Pošiljanje ni uspelo.");
                    }
                  } catch {
                    showMsg("Napaka pri pošiljanju vaučerja. Poskusite znova.");
                  } finally {
                    setEmailingVoucher(false);
                  }
                }}
                disabled={emailingVoucher}
                className="flex items-center gap-2 rounded-xl bg-[#53945a] px-5 py-2.5 text-sm font-semibold text-[#0a2029] hover:bg-[#53945a]/90 transition-colors disabled:opacity-50"
              >
                <Mail className="h-4 w-4" />
                {emailingVoucher ? "Po��iljam..." : "Pošlji vaučer"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Predogled emaila "Vprašaj za uro v portu" — portal */}
      {portTimePreview && activeReservation() && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
          onClick={() => { if (!sendingPortTime) setPortTimePreview(null); }}
        >
          <div
            className="flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#101d22] shadow-2xl"
            style={{ maxHeight: "90vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
              <div>
                <h3 className="text-sm font-semibold text-white">Predogled — vprašanje za uro v portu</h3>
                <p className="mt-0.5 text-xs text-white/50">
                  {portTimePreview.isAgency ? "Rezervacija je agencijska — pošlji agenciji." : "Direktna rezervacija — pošlji gostu."}
                </p>
              </div>
              <button
                onClick={() => { if (!sendingPortTime) setPortTimePreview(null); }}
                disabled={sendingPortTime}
                className="rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-50"
                aria-label="Zapri predogled"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="border-b border-white/10 px-5 py-3">
              <label className="block text-[11px] uppercase tracking-wider text-white/40 mb-1">Prejemnik (email)</label>
              <input
                type="email"
                value={portTimePreview.to}
                onChange={(e) => setPortTimePreview((p) => p ? { ...p, to: e.target.value } : p)}
                placeholder={portTimePreview.isAgency ? "email agencije" : "email gosta"}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#c5873b]/50 focus:outline-none"
              />
            </div>

            <div className="flex-1 overflow-hidden bg-white">
              <iframe
                title="Predogled emaila"
                srcDoc={portTimePreview.html}
                className="h-full w-full border-0"
                style={{ minHeight: "45vh" }}
              />
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-white/10 px-5 py-4">
              <button
                onClick={() => setPortTimePreview(null)}
                disabled={sendingPortTime}
                className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-white/70 hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                Prekliči
              </button>
              <button
                onClick={async () => {
                  const rid = activeReservation()?.id;
                  if (!rid) return;
                  const to = (portTimePreview.to || "").trim();
                  if (!to) { showMsg("Vnesite email naslov prejemnika."); return; }
                  setSendingPortTime(true);
                  try {
                    const { sendPortTimeEmail } = await import("@/app/actions/port-time-email");
                    const result = await sendPortTimeEmail(rid, to);
                    if (result.success) {
                      showMsg(`Email poslan (${to}).`);
                      setSentEmailsRefresh((n) => n + 1);
                      setPortTimePreview(null);
                    } else {
                      showMsg(result.error || "Pošiljanje ni uspelo.");
                    }
                  } catch {
                    showMsg("Napaka pri pošiljanju. Poskusite znova.");
                  } finally {
                    setSendingPortTime(false);
                  }
                }}
                disabled={sendingPortTime}
                className="flex items-center gap-2 rounded-xl bg-[#c5873b] px-5 py-2.5 text-sm font-semibold text-[#0a2029] hover:bg-[#c5873b]/90 transition-colors disabled:opacity-50"
              >
                <Mail className="h-4 w-4" />
                {sendingPortTime ? "Pošiljam..." : "Pošlji"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Nov račun (strošek) ��� modal za fotografiranje/nalaganje računa */}
      <StroskiReceiptCaptureModal isOpen={showReceiptCapture} onClose={() => setShowReceiptCapture(false)} requirePayment />

      {/* Pricing Calculator Modal */}
      {showTaxes && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setShowTaxes(false)}>
          <div
            className="relative w-full sm:max-w-3xl sm:mx-4 bg-[#0f2e3a] border-t sm:border border-white/10 sm:rounded-2xl overflow-hidden max-h-[90vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Drag handle for mobile */}
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 flex-shrink-0">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[#d9a68f]">Baza</p>
                <h3 className="text-lg font-semibold text-white">Takse</h3>
              </div>
              <button
                onClick={() => setShowTaxes(false)}
                className="p-2 rounded-full bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {/* Content */}
            <div className="px-5 py-4 overflow-y-auto flex-1">
              <TaxesPanel />
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Zvonjenje na telefon — same panel as at the bottom of the entry page. */}
      {showPushBox && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setShowPushBox(false)}>
          <div
            className="relative w-full sm:max-w-xl sm:mx-4 bg-[#0f2e3a] border-t sm:border border-white/10 sm:rounded-2xl overflow-hidden max-h-[90vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>
            {/* No heading here ��� the panel below carries its own title, and
                repeating it verbatim reads like a mistake. */}
            <div className="flex justify-end px-4 pt-3 flex-shrink-0">
              <button
                type="button"
                onClick={() => setShowPushBox(false)}
                aria-label="Zapri"
                className="cursor-pointer p-2 rounded-full bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-5 pb-5 pt-1 overflow-y-auto flex-1">
              {/* Both directions: on Borut's page he rings Urška, from any other
                  tab it is her panel ringing Borut. */}
              <PushNotificationsBox
                person={tab === "borut" ? "Borut" : "Urska"}
                sendTo={tab === "borut" ? "Urska" : "Borut"}
                accent={tab === "borut" ? "#8fae92" : "#c59b5b"}
              />
            </div>
          </div>
        </div>,
        document.body
      )}

      {showPricingModal && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setShowPricingModal(false)}>
          <div 
            className="relative w-full sm:max-w-xl sm:mx-4 bg-[#0f2e3a] border-t sm:border border-white/10 sm:rounded-2xl overflow-hidden max-h-[90vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Drag handle for mobile */}
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>
            
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 flex-shrink-0">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[#c59b5b]">Kalkulator</p>
                <h3 className="text-lg font-semibold text-white">Ceniki</h3>
              </div>
              <button 
                onClick={() => setShowPricingModal(false)} 
                className="p-2 rounded-full bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            {/* Tabs */}
            <div className="flex border-b border-white/10">
              <button
                onClick={() => setPricingTab('calculator')}
                className={`flex-1 px-4 py-2 text-xs font-medium transition-colors ${pricingTab === 'calculator' ? 'text-[#c59b5b] border-b-2 border-[#c59b5b]' : 'text-white/50 hover:text-white/80'}`}
              >
                Kalkulator
              </button>
              <button
                onClick={() => setPricingTab('group')}
                className={`flex-1 px-4 py-2 text-xs font-medium transition-colors ${pricingTab === 'group' ? 'text-[#c59b5b] border-b-2 border-[#c59b5b]' : 'text-white/50 hover:text-white/80'}`}
              >
                Skupinski izlet
              </button>
              <button
                onClick={() => setPricingTab('schedule')}
                className={`flex-1 px-4 py-2 text-xs font-medium transition-colors ${pricingTab === 'schedule' ? 'text-[#c59b5b] border-b-2 border-[#c59b5b]' : 'text-white/50 hover:text-white/80'}`}
              >
                Fanjin Urnik
              </button>
            </div>
            
            {/* Content */}
            <div className="px-5 py-4 space-y-6 overflow-y-auto flex-1">
              
              {pricingTab === 'calculator' && (
              <>
              {/* IZLETI CALCULATOR */}
              <div className="p-4 rounded-xl border border-[#7fa8b8]/20 bg-[#7fa8b8]/5">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[#7fa8b8] mb-4 flex items-center gap-2">
                  <Truck className="h-4 w-4" />
                  Izlet - Kalkulator
                </h4>
                
                {/* Selected excursion info */}
                {pricingCalc.excursionId && (() => {
                  const exc = dbExcursions.find((e: { id: string }) => e.id === pricingCalc.excursionId) as { id: string; name: string; description?: string | null; imageUrl?: string | null; entranceFeeAr?: number } | undefined;
                  if (!exc) return null;
                  return (
                    <div className="mb-4 p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                      <div className="flex gap-3">
                        {exc.imageUrl && (
                          <img src={exc.imageUrl} alt={exc.name} className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-[#c59b5b]">{exc.name}</h4>
                          {exc.description && (
                            <p className="text-xs text-white/60 mt-1 line-clamp-3">{exc.description}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-white/40 mb-1">Izlet</label>
                    <select
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-[#7fa8b8]/50 focus:outline-none [&>option]:bg-[#0f2e3a] [&>option]:text-white"
                      value={pricingCalc.excursionId}
                      onChange={e => setPricingCalc(p => ({ ...p, excursionId: e.target.value }))}
                    >
                      <option value="">-- Izberi izlet --</option>
                      {dbExcursions.map((e: { id: string; name: string }) => (
                        <option key={e.id} value={e.id}>{e.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-[10px] text-white/40 mb-1">Coln</label>
                    <select
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-[#7fa8b8]/50 focus:outline-none [&>option]:bg-[#0f2e3a] [&>option]:text-white"
                      value={pricingCalc.boatId}
                      onChange={e => setPricingCalc(p => ({ ...p, boatId: e.target.value }))}
                    >
                      <option value="">-- Izberi coln --</option>
                      {dbBoats.map((b: { id: string; name: string; engine: string }) => (
                        <option key={b.id} value={b.id}>{b.name} ({b.engine})</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-[10px] text-white/40 mb-1">Stevilo oseb</label>
                    <input
                      type="number"
                      min="1"
                      inputMode="numeric"
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-[#7fa8b8]/50 focus:outline-none"
                      value={pricingCalc.pax === 0 ? '' : pricingCalc.pax}
                      onChange={e => setPricingCalc(p => ({ ...p, pax: e.target.value === '' ? 0 : Number(e.target.value) }))}
                      onBlur={e => { if (e.target.value === '' || Number(e.target.value) < 1) setPricingCalc(p => ({ ...p, pax: 1 })) }}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-[10px] text-white/40 mb-1">Cena transporta/os</label>
                    <div className="rounded-lg border border-[#c59b5b]/30 bg-[#c59b5b]/10 px-3 py-2 text-sm font-medium text-[#c59b5b]">
                      {pricingCalc.excursionId && pricingCalc.boatId ? (
                        (() => {
                          const pricing = dbExcursionSellingPricing.find((p: { excursionId: string; boatId: string }) => 
                            p.excursionId === pricingCalc.excursionId && p.boatId === pricingCalc.boatId
                          ) as { pricePax1?: string; pricePax2?: string; pricePax3?: string; pricePax4?: string; pricePax5?: string; pricePax6?: string } | undefined;
                          if (!pricing) return "Ni cene";
                          const paxKey = `pricePax${Math.min(pricingCalc.pax, 6)}` as keyof typeof pricing;
                          const pricePerPerson = Number(pricing[paxKey]) || 0;
                          return eur(pricePerPerson);
                        })()
                      ) : "—"}
                    </div>
                  </div>
                </div>
                
                {/* Vstopnina */}
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-white/40 mb-1">Vstopnina</label>
                    <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 cursor-pointer hover:bg-white/10 transition-colors">
                      <input
                        type="checkbox"
                        checked={pricingCalc.includeEntrance}
                        onChange={e => setPricingCalc(p => ({ ...p, includeEntrance: e.target.checked }))}
                        className="rounded border-white/20"
                      />
                      <span className="text-sm text-white">
                        {pricingCalc.excursionId ? (() => {
                          const exc = dbExcursions.find((e: { id: string }) => e.id === pricingCalc.excursionId) as { entranceFeeAr?: number } | undefined;
                          return exc?.entranceFeeAr ? `${eur(arToEur(exc.entranceFeeAr, exchangeRate))}/os` : "Brez vstopnine";
                        })() : "Vkljuci"}
                      </span>
                    </label>
                  </div>
                  
                  <div>
                    <label className="block text-[10px] text-white/40 mb-1">Ponudnik kosila</label>
                    <select
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-[#c4744a]/50 focus:outline-none [&>option]:bg-[#0f2e3a] [&>option]:text-white"
                      value={pricingCalc.lunchProviderId}
                      onChange={e => setPricingCalc(p => ({ ...p, lunchProviderId: e.target.value }))}
                    >
                      <option value="">-- Brez kosila --</option>
                      {dbLunchProviders.map((lp: { id: string; name: string; pricePerPersonAr: number }) => (
                        <option key={lp.id} value={lp.id}>{lp.name} ({eur(arToEur(lp.pricePerPersonAr, exchangeRate))}/os)</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                {/* Total for excursion */}
                {pricingCalc.excursionId && pricingCalc.boatId && (
                  <div className="mt-4 p-3 rounded-lg border border-[#c59b5b]/30 bg-[#c59b5b]/10">
                    {(() => {
                      const exc = dbExcursions.find((e: { id: string }) => e.id === pricingCalc.excursionId) as { entranceFeeAr?: number } | undefined;
                      const pricing = dbExcursionSellingPricing.find((p: { excursionId: string; boatId: string }) => 
                        p.excursionId === pricingCalc.excursionId && p.boatId === pricingCalc.boatId
                      ) as { pricePax1?: string; pricePax2?: string; pricePax3?: string; pricePax4?: string; pricePax5?: string; pricePax6?: string } | undefined;
                      const lunchProvider = dbLunchProviders.find((lp: { id: string }) => lp.id === pricingCalc.lunchProviderId) as { pricePerPersonAr: number } | undefined;
                      
                      // Transport: cena na osebo glede na število oseb (že v EUR)
                      const paxKey = `pricePax${Math.min(pricingCalc.pax, 6)}` as keyof NonNullable<typeof pricing>;
                      const transportPerPerson = pricing ? (Number(pricing[paxKey]) || 0) : 0;
                      const entrancePerPerson = (pricingCalc.includeEntrance && exc?.entranceFeeAr) ? arToEur(exc.entranceFeeAr, exchangeRate) : 0;
                      const lunchPerPerson = lunchProvider ? arToEur(lunchProvider.pricePerPersonAr, exchangeRate) : 0;
                      
                      const transportTotal = transportPerPerson * pricingCalc.pax;
                      const entranceTotal = entrancePerPerson * pricingCalc.pax;
                      const lunchTotal = lunchPerPerson * pricingCalc.pax;
                      const grandTotal = transportTotal + entranceTotal + lunchTotal;
                      
                      return (
                        <>
                          <div className="flex justify-between items-center text-xs text-white/60">
                            <span>Transport ({pricingCalc.pax} oseb × {eur(transportPerPerson)}):</span>
                            <span>{eur(transportTotal)}</span>
                          </div>
                          {pricingCalc.includeEntrance && entrancePerPerson > 0 && (
                            <div className="flex justify-between items-center text-xs text-white/60 mt-1">
                              <span>Vstopnina ({pricingCalc.pax} oseb × {eur(entrancePerPerson)}):</span>
                              <span>{eur(entranceTotal)}</span>
                            </div>
                          )}
                          {lunchPerPerson > 0 && (
                            <div className="flex justify-between items-center text-xs text-white/60 mt-1">
                              <span>Kosilo ({pricingCalc.pax} oseb × {eur(lunchPerPerson)}):</span>
                              <span>{eur(lunchTotal)}</span>
                            </div>
                          )}
                          <div className="flex justify-between items-center mt-2 pt-2 border-t border-[#c59b5b]/20">
                            <span className="text-sm font-semibold text-[#c59b5b]">SKUPAJ:</span>
                            <span className="text-lg font-bold text-[#c59b5b]">{eur(grandTotal)}</span>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
              
              {/* TRANSFER CALCULATOR */}
              <div className="p-4 rounded-xl border border-[#4e8296]/20 bg-[#4e8296]/5">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[#4e8296] mb-4 flex items-center gap-2">
                  <Car className="h-4 w-4" />
                  Transfer - Kalkulator
                </h4>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-white/40 mb-1">Ruta</label>
                    <select
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-[#4e8296]/50 focus:outline-none [&>option]:bg-[#0f2e3a] [&>option]:text-white"
                      value={pricingCalc.routeId}
                      onChange={e => setPricingCalc(p => ({ ...p, routeId: e.target.value }))}
                    >
                      <option value="">-- Izberi ruto --</option>
                      {dbRoutes
                        .filter((r: { id: string }) => r.id !== 'route-airport-port')
                        .map((r: { id: string; name: string }) => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-[10px] text-white/40 mb-1">Coln</label>
                    <select
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-[#4e8296]/50 focus:outline-none [&>option]:bg-[#0f2e3a] [&>option]:text-white"
                      value={pricingCalc.transferBoatId}
                      onChange={e => setPricingCalc(p => ({ ...p, transferBoatId: e.target.value }))}
                    >
                      <option value="">-- Izberi coln --</option>
                      {dbBoats.map((b: { id: string; name: string; engine: string }) => (
                        <option key={b.id} value={b.id}>{b.name} ({b.engine})</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-[10px] text-white/40 mb-1">Stevilo oseb</label>
                    <input
                      type="number"
                      min="1"
                      inputMode="numeric"
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-[#4e8296]/50 focus:outline-none"
                      value={pricingCalc.transferPax === 0 ? '' : pricingCalc.transferPax}
                      onChange={e => setPricingCalc(p => ({ ...p, transferPax: e.target.value === '' ? 0 : Number(e.target.value) }))}
                      onBlur={e => { if (e.target.value === '' || Number(e.target.value) < 1) setPricingCalc(p => ({ ...p, transferPax: 1 })) }}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-[10px] text-white/40 mb-1">Cena na osebo</label>
                    <div className="rounded-lg border border-[#7fa8b8]/30 bg-[#7fa8b8]/10 px-3 py-2 text-sm font-medium text-[#7fa8b8]">
                      {pricingCalc.routeId && pricingCalc.transferBoatId ? (
                        (() => {
                          const pricing = dbSellingPricing.find((p: { routeId: string; boatId: string }) => 
                            p.routeId === pricingCalc.routeId && p.boatId === pricingCalc.transferBoatId
                          ) as { pricePax1?: string; pricePax2?: string; pricePax3?: string; pricePax4?: string; pricePax5?: string; pricePax6?: string } | undefined;
                          if (!pricing) return "Ni cene";
                          const paxKey = `pricePax${Math.min(pricingCalc.transferPax, 6)}` as keyof typeof pricing;
                          const pricePerPerson = Number(pricing[paxKey]) || 0;
                          return eur(pricePerPerson);
                        })()
                      ) : "��"}
                    </div>
                  </div>
                </div>
                
                {/* Total for transfer */}
                {pricingCalc.routeId && pricingCalc.transferBoatId && (
                  <div className="mt-4 p-3 rounded-lg border border-[#7fa8b8]/30 bg-[#7fa8b8]/10">
                    {(() => {
                      const pricing = dbSellingPricing.find((p: { routeId: string; boatId: string }) => 
                        p.routeId === pricingCalc.routeId && p.boatId === pricingCalc.transferBoatId
                      ) as { pricePax1?: string; pricePax2?: string; pricePax3?: string; pricePax4?: string; pricePax5?: string; pricePax6?: string } | undefined;
                      
                      const paxKey = `pricePax${Math.min(pricingCalc.transferPax, 6)}` as keyof NonNullable<typeof pricing>;
                      const pricePerPerson = pricing ? (Number(pricing[paxKey]) || 0) : 0;
                      const total = pricePerPerson * pricingCalc.transferPax;
                      
                      return (
                        <>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-white/60">Transfer ({pricingCalc.transferPax} oseb × {eur(pricePerPerson)}):</span>
                            <span className="text-sm font-medium text-[#7fa8b8]">{eur(total)}</span>
                          </div>
                          <div className="flex justify-between items-center mt-2 pt-2 border-t border-[#7fa8b8]/20">
                            <span className="text-sm font-semibold text-[#7fa8b8]">SKUPAJ:</span>
                            <span className="text-lg font-bold text-[#7fa8b8]">{eur(total)}</span>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
              
              {/* Colni info */}
              <div className="p-4 rounded-xl border border-white/[0.08] bg-white/[0.02]">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[#c59b5b] mb-3 flex items-center gap-2">
                  <Ship className="h-4 w-4" />
                  Colni
                </h4>
                <div className="flex flex-wrap gap-2">
                  {dbBoats.map((boat: { id: string; name: string; engine: string; capacity: number }) => (
                    <div key={boat.id} className="px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.02]">
                      <p className="text-sm font-medium text-white">{boat.name}</p>
                      <p className="text-[10px] text-white/40">{boat.engine} · {boat.capacity} oseb</p>
                    </div>
                  ))}
                </div>
              </div>
              </>
              )}

              {/* SKUPINSKI IZLET TAB (preview: več bungalovov na istem čolnu) */}
              {pricingTab === 'group' && (
              <div className="p-4 rounded-xl border border-[#7fa8b8]/20 bg-[#7fa8b8]/5">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[#7fa8b8] mb-2 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Skupinski izlet - Kalkulator
                </h4>
                <p className="text-[11px] text-white/50 mb-4 text-pretty">Preveri, koliko bi prišel izlet, če gre več bungalovov skupaj na istem čolnu. Cena čolna se računa po SKUPNEM številu oseb (nižja cena/os), vstopnina in kosilo pa sta na osebo.</p>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-white/40 mb-1">Izlet</label>
                    <select
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-[#7fa8b8]/50 focus:outline-none [&>option]:bg-[#0f2e3a] [&>option]:text-white"
                      value={groupCalc.excursionId}
                      onChange={e => setGroupCalc(p => ({ ...p, excursionId: e.target.value }))}
                    >
                      <option value="">-- Izberi izlet --</option>
                      {dbExcursions.map((e: { id: string; name: string }) => (
                        <option key={e.id} value={e.id}>{e.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-white/40 mb-1">Coln</label>
                    <select
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-[#7fa8b8]/50 focus:outline-none [&>option]:bg-[#0f2e3a] [&>option]:text-white"
                      value={groupCalc.boatId}
                      onChange={e => setGroupCalc(p => ({ ...p, boatId: e.target.value }))}
                    >
                      <option value="">-- Izberi coln --</option>
                      {dbBoats.map((b: { id: string; name: string; engine: string }) => (
                        <option key={b.id} value={b.id}>{b.name} ({b.engine})</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Bungalovi (osebe na bungalov) */}
                <div className="mt-4">
                  <label className="block text-[10px] text-white/40 mb-2">Bungalovi (osebe na skupino)</label>
                  <div className="space-y-2">
                    {groupCalc.parts.map((pax, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="text-xs text-white/60 w-24 shrink-0">Bungalov {idx + 1}</span>
                        <input
                          type="number"
                          min="1"
                          inputMode="numeric"
                          className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-[#7fa8b8]/50 focus:outline-none"
                          value={pax === 0 ? '' : pax}
                          onChange={e => {
                            const v = e.target.value === '' ? 0 : Number(e.target.value)
                            setGroupCalc(p => ({ ...p, parts: p.parts.map((x, i) => i === idx ? v : x) }))
                          }}
                          onBlur={e => { if (e.target.value === '' || Number(e.target.value) < 1) setGroupCalc(p => ({ ...p, parts: p.parts.map((x, i) => i === idx ? 1 : x) })) }}
                        />
                        <span className="text-xs text-white/40 shrink-0">oseb</span>
                        {groupCalc.parts.length > 2 && (
                          <button
                            onClick={() => setGroupCalc(p => ({ ...p, parts: p.parts.filter((_, i) => i !== idx) }))}
                            className="p-1.5 rounded-lg bg-white/5 text-white/50 hover:bg-red-500/20 hover:text-red-300 transition-colors"
                            aria-label="Odstrani bungalov"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => setGroupCalc(p => ({ ...p, parts: [...p.parts, 2] }))}
                    className="mt-2 flex items-center gap-1.5 text-xs text-[#7fa8b8] hover:text-[#a8c6d2] transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" /> Dodaj bungalov
                  </button>
                </div>

                {/* Vstopnina + kosilo */}
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-white/40 mb-1">Vstopnina</label>
                    <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 cursor-pointer hover:bg-white/10 transition-colors">
                      <input
                        type="checkbox"
                        checked={groupCalc.includeEntrance}
                        onChange={e => setGroupCalc(p => ({ ...p, includeEntrance: e.target.checked }))}
                        className="rounded border-white/20"
                      />
                      <span className="text-sm text-white">
                        {groupCalc.excursionId ? (() => {
                          const exc = dbExcursions.find((e: { id: string }) => e.id === groupCalc.excursionId) as { entranceFeeAr?: number } | undefined;
                          return exc?.entranceFeeAr ? `${eur(arToEur(exc.entranceFeeAr, exchangeRate))}/os` : "Brez vstopnine";
                        })() : "Vkljuci"}
                      </span>
                    </label>
                  </div>
                  <div>
                    <label className="block text-[10px] text-white/40 mb-1">Ponudnik kosila</label>
                    <select
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-[#c4744a]/50 focus:outline-none [&>option]:bg-[#0f2e3a] [&>option]:text-white"
                      value={groupCalc.lunchProviderId}
                      onChange={e => setGroupCalc(p => ({ ...p, lunchProviderId: e.target.value }))}
                    >
                      <option value="">-- Brez kosila --</option>
                      {dbLunchProviders.map((lp: { id: string; name: string; pricePerPersonAr: number }) => (
                        <option key={lp.id} value={lp.id}>{lp.name} ({eur(arToEur(lp.pricePerPersonAr, exchangeRate))}/os)</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Rezultat skupinskega izleta */}
                {groupCalc.excursionId && groupCalc.boatId && (() => {
                  const exc = dbExcursions.find((e: { id: string }) => e.id === groupCalc.excursionId) as { entranceFeeAr?: number } | undefined;
                  const pricing = dbExcursionSellingPricing.find((p: { excursionId: string; boatId: string }) =>
                    p.excursionId === groupCalc.excursionId && p.boatId === groupCalc.boatId
                  ) as { pricePax1?: string; pricePax2?: string; pricePax3?: string; pricePax4?: string; pricePax5?: string; pricePax6?: string } | undefined;
                  const lunchProvider = dbLunchProviders.find((lp: { id: string }) => lp.id === groupCalc.lunchProviderId) as { pricePerPersonAr: number } | undefined;
                  const totalPax = groupCalc.parts.reduce((s, n) => s + (n || 0), 0);
                  if (totalPax < 1) return null;
                  if (!pricing) return <div className="mt-4 p-3 rounded-lg border border-white/10 bg-white/5 text-xs text-white/50">Ni cene za izbrani izlet in coln.</div>;

                  const rateFor = (pax: number) => {
                    const key = `pricePax${Math.min(Math.max(pax, 1), 6)}` as keyof typeof pricing;
                    return Number(pricing[key]) || 0;
                  };
                  const entrancePerPerson = (groupCalc.includeEntrance && exc?.entranceFeeAr) ? arToEur(exc.entranceFeeAr, exchangeRate) : 0;
                  const lunchPerPerson = lunchProvider ? arToEur(lunchProvider.pricePerPersonAr, exchangeRate) : 0;

                  // Skupinsko: cena/os po SKUPNEM pax
                  const groupBoatPerPerson = rateFor(totalPax);
                  const perPersonTotal = groupBoatPerPerson + entrancePerPerson + lunchPerPerson;
                  const boatTotal = groupBoatPerPerson * totalPax;
                  const entranceTotal = entrancePerPerson * totalPax;
                  const lunchTotal = lunchPerPerson * totalPax;
                  const grandTotal = boatTotal + entranceTotal + lunchTotal;

                  // Primerjava: če bi šel vsak bungalov SAM (cena/os po svojem pax)
                  const separateTotal = groupCalc.parts.reduce((s, pax) => s + (rateFor(pax) + entrancePerPerson + lunchPerPerson) * (pax || 0), 0);
                  const savings = separateTotal - grandTotal;

                  return (
                    <div className="mt-4 space-y-3">
                      <div className="p-3 rounded-lg border border-[#c59b5b]/30 bg-[#c59b5b]/10">
                        <div className="flex justify-between items-center text-xs text-white/60">
                          <span>Transport ({totalPax} oseb × {eur(groupBoatPerPerson)}/os):</span>
                          <span>{eur(boatTotal)}</span>
                        </div>
                        {entrancePerPerson > 0 && (
                          <div className="flex justify-between items-center text-xs text-white/60 mt-1">
                            <span>Vstopnina ({totalPax} × {eur(entrancePerPerson)}):</span>
                            <span>{eur(entranceTotal)}</span>
                          </div>
                        )}
                        {lunchPerPerson > 0 && (
                          <div className="flex justify-between items-center text-xs text-white/60 mt-1">
                            <span>Kosilo ({totalPax} × {eur(lunchPerPerson)}):</span>
                            <span>{eur(lunchTotal)}</span>
                          </div>
                        )}
                        <div className="flex justify-between items-center mt-2 pt-2 border-t border-[#c59b5b]/20">
                          <span className="text-sm font-semibold text-[#c59b5b]">SKUPAJ ({totalPax} oseb):</span>
                          <span className="text-lg font-bold text-[#c59b5b]">{eur(grandTotal)}</span>
                        </div>
                        <div className="flex justify-between items-center text-[11px] text-white/50 mt-1">
                          <span>Na osebo:</span>
                          <span>{eur(perPersonTotal)}</span>
                        </div>
                      </div>

                      {/* Razdelitev po bungalovih */}
                      <div className="p-3 rounded-lg border border-white/[0.08] bg-white/[0.03]">
                        <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2">Razdelitev po bungalovih</p>
                        {groupCalc.parts.map((pax, idx) => (
                          <div key={idx} className="flex justify-between items-center text-xs text-white/70 py-0.5">
                            <span>Bungalov {idx + 1} ({pax} {pax === 1 ? 'oseba' : 'oseb'}):</span>
                            <span className="tabular-nums">{eur(perPersonTotal * (pax || 0))}</span>
                          </div>
                        ))}
                      </div>

                      {/* Prihranek v primerjavi s posamičnim izletom */}
                      {savings > 0.5 && (
                        <div className="p-3 rounded-lg border border-emerald-400/30 bg-emerald-400/[0.06]">
                          <div className="flex justify-between items-center text-xs text-white/60">
                            <span>Če gre vsak bungalov sam:</span>
                            <span className="tabular-nums">{eur(separateTotal)}</span>
                          </div>
                          <div className="flex justify-between items-center mt-1">
                            <span className="text-sm font-semibold text-[#8fae92]">Prihranek s skupino:</span>
                            <span className="text-base font-bold text-[#8fae92] tabular-nums">-{eur(savings)}</span>
                          </div>
                        </div>
                      )}

                      {totalPax > 6 && (
                        <p className="text-[11px] text-amber-300/80 text-pretty">Opomba: cenik ima ceno/os do 6 oseb; nad 6 se uporablja cena za 6 oseb (in običajno je potreben večji ali dodatni čoln).</p>
                      )}
                    </div>
                  );
                })()}
              </div>
              )}

              {/* FANJIN URNIK TAB */}
              {pricingTab === 'schedule' && (
              <div className="space-y-3">
                <p className="text-xs text-white/50 mb-2">Fanjini planirani izleti - dodaj objavljene izlete in preveri, kdo od gostov je ze prijavljen na kateri datum.</p>

                {/* Obrazec za dodajanje objavljenega izleta */}
                <div className="p-4 rounded-xl border border-[#c59b5b]/20 bg-[#c59b5b]/[0.04] space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-[#c59b5b] flex items-center gap-2">
                    <Plus className="h-4 w-4" /> Dodaj izlet v urnik
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/40">Datum</label>
                      <input
                        type="date"
                        value={newSchedule.date}
                        onChange={e => setNewSchedule(s => ({ ...s, date: e.target.value }))}
                        className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 py-2 text-sm text-white [color-scheme:dark] focus:border-[#c59b5b]/40 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/40">Tip izleta</label>
                      <select
                        value={newSchedule.excursionType}
                        onChange={e => setNewSchedule(s => ({ ...s, excursionType: e.target.value }))}
                        className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 py-2 text-sm text-white focus:border-[#c59b5b]/40 focus:outline-none"
                      >
                        {SCHEDULE_EXCURSION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/40">Opomba (neobvezno)</label>
                    <input
                      type="text"
                      value={newSchedule.notes}
                      placeholder="npr. Bivouac, dodatni detajli..."
                      onChange={e => setNewSchedule(s => ({ ...s, notes: e.target.value }))}
                      className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#c59b5b]/40 focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <label className="flex items-center gap-2 text-xs text-white/70 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newSchedule.isOption}
                        onChange={e => setNewSchedule(s => ({ ...s, isOption: e.target.checked }))}
                        className="h-4 w-4 rounded border-white/20 bg-white/[0.03] accent-[#c59b5b]"
                      />
                      Opcijski izlet (option)
                    </label>
                    <button
                      onClick={handleAddSchedule}
                      disabled={savingSchedule}
                      className="flex items-center gap-1.5 rounded-lg bg-[#c59b5b] px-4 py-2 text-xs font-semibold text-[#1d1b17] hover:bg-[#c59b5b]/90 transition-colors disabled:opacity-50"
                    >
                      <Plus className="h-3.5 w-3.5" /> Dodaj
                    </button>
                  </div>
                </div>

                {(() => {
                  const upcomingScheduled = dbScheduledExcursions.filter(s => String(s.date).slice(0, 10) >= today());
                  return upcomingScheduled.length === 0 ? (
                  <p className="text-white/40 text-sm text-center py-8">Ni planiranih izletov.</p>
                ) : (
                  upcomingScheduled.map((sched) => {
                    const colorClass = scheduleTypeColor(sched.excursionType);
                    const isPast = false;
                    
                    return (
                      <div 
                        key={sched.id} 
                        className={`p-3 rounded-xl border ${colorClass} ${isPast ? 'opacity-50' : ''}`}
                      >
                        <div className="flex items-center justify-between mb-2 gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm font-medium text-white">
                              {new Date(sched.date).toLocaleDateString('sl-SI', { weekday: 'short', day: 'numeric', month: 'short' })}
                            </span>
                            {sched.isOption && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-white/50">OPTION</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-xs font-medium text-white/70">{scheduleTypeLabel(sched.excursionType)}</span>
                            <button
                              onClick={() => handleDeleteSchedule(sched.id)}
                              className="p-1 rounded-md text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                              title="Izbrisi iz urnika"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                        
                        {sched.notes && (
                          <p className="text-[10px] text-white/40 mb-2">{sched.notes}</p>
                        )}
                        
                        {/* Guests booked on this date */}
                        {sched.guests && sched.guests.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {sched.guests.map((g, idx) => {
                              // Guest-facing bungalow display name (incl. special names like Beach Villa)
                              const bungalowShort = bungalowDisplayName(g.bungalow)
                              return (
                                <span 
                                  key={idx}
                                  className="text-[10px] px-2 py-1 rounded-full bg-[#c59b5b]/20 text-[#c59b5b] border border-[#c59b5b]/30"
                                >
                                  {bungalowShort} - {g.guestName?.trim()} ({g.pax} os)
                                </span>
                              )
                            })}
                          </div>
                        ) : (
                          <p className="text-[10px] text-white/30 mt-2">Ni prijavljenih gostov</p>
                        )}
                      </div>
                    );
                  })
                );
                })()}
              </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </main>
  );
}
