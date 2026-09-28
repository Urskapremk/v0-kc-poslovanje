"use client";

import React from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronLeft, ChevronRight, Heart, Ship, X, ExternalLink, CalendarDays, Users, MapPin, UtensilsCrossed, Building2, Maximize2, Minimize2, RotateCw } from "lucide-react";
import { bungalowLabel, bungalowKey, bungalowKeys } from "@/lib/bungalow";
import { GuestFlag } from "@/components/guest-flag";

/**
 * "Ocean Bungalow II" → "II". Units without a numeral (a reserve unit, say) keep
 * their full name so a row can never end up unlabelled.
 */
function romanOf(bungalow: string): string {
  const label = bungalowLabel(bungalow);
  const m = label.match(/\b([IVXLC]+)\s*$/);
  return m ? m[1] : label;
}

interface TimelineReservation {
  id: string;
  guestName: string;
  secondGuestName?: string | null;
  bungalow: string;
  pax: number;
  arrival: string;
  departure: string;
  status: string;
  bookingSource?: string | null;
  agencyName?: string | null;
  mealPlan?: string | null;
  honeymoon?: boolean | null;
  checkedInAt?: string | null;
  checkedOutAt?: string | null;
  notes?: string | null;
  nationality?: string | null;
  secondNationality?: string | null;
  thirdNationality?: string | null;
  fourthNationality?: string | null;
  bungalowSegments?: { key?: string; bungalow?: string; arrival: string; departure: string }[] | null;
  transfers?: { arrival?: { route?: string | null }; departure?: { route?: string | null } };
}

// Iz surovega niza opomb (loceno z \n---\n, prefiks [cas], marker "@card ")
// izlusci ocistene vrstice opomb, pripete ("@card ") postavi na vrh.
function parseNotes(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const list = raw.split("\n---\n").map((s) => s.trim()).filter(Boolean);
  const clean = (s: string) => s.replace(/^@card\s+/, "").replace(/^@nocard\s+/, "").replace(/^\[[^\]]*\]\s*/, "").trim();
  const pinned = list.filter((s) => s.startsWith("@card ")).map(clean);
  const rest = list.filter((s) => !s.startsWith("@card ")).map(clean);
  return [...pinned, ...rest].filter(Boolean);
}

interface Props {
  reservations: TimelineReservation[];
  bungalows: string[];
  onSelect: (reservationId: string) => void;
}

const DAY_W = 40; // px width per day
  const LABEL_W = 88; // px width of left bungalow column — roman numerals need far less room than full names
const BAR_H = 26; // px height of a booking bar
const LANE_GAP = 9; // px vertical breathing room above/below each bar (prevents bars looking cramped between rows)

const MONTHS_SL = [
  "Januar", "Februar", "Marec", "April", "Maj", "Junij",
  "Julij", "Avgust", "September", "Oktober", "November", "December",
];
const WEEKDAY_SL = ["N", "P", "T", "S", "Č", "P", "S"]; // Sunday..Saturday

// Parse 'YYYY-MM-DD' (or full ISO timestamp) as a local date (avoid timezone shift)
function parseDate(s: string): Date {
  const [y, m, d] = (s || "").slice(0, 10).split("-").map(Number);
  return new Date(y || 1970, (m || 1) - 1, d || 1);
}
function atMidnight(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function formatDateSlo(s: string): string {
  const d = parseDate(s);
  return `${d.getDate()}. ${MONTHS_SL[d.getMonth()].toLowerCase()} ${d.getFullYear()}`;
}
function nightsBetween(a: string, dep: string): number {
  const A = parseDate(a);
  const D = parseDate(dep);
  return Math.max(1, Math.round((D.getTime() - A.getTime()) / 86400000));
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function daysBetween(a: Date, b: Date): number {
  return Math.round((atMidnight(b).getTime() - atMidnight(a).getTime()) / 86400000);
}
function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// Meal plan -> short badge (B breakfast, HB half board, FB full board) + colour
function mealBadgeOf(r: TimelineReservation): { code: string; color: string; label: string } | null {
  const mp = String(r.mealPlan || "").toUpperCase();
  // Saturated past the card's accents, like the bar icons: at 9px the muted
  // green and teal read as the same grey. Same hues, pushed apart in intensity.
  if (mp === "FB") return { code: "FB", color: "#2f7f45", label: "Polni penzion" };
  if (mp === "HB") return { code: "HB", color: "#1f6f96", label: "Polpenzion" };
  if (mp === "B") return { code: "B", color: "#a8761a", label: "Zajtrk" };
  return null;
}

// Colour a booking bar by its source/status
function barColors(r: TimelineReservation): { bg: string; text: string; border: string } {
  const isAgency = (r.bookingSource === "Agency" && r.agencyName) || !!r.agencyName;
  if (r.honeymoon) return { bg: "#c59b5b", text: "#0a2029", border: "#c9a06e" };
  if (r.checkedOutAt) return { bg: "#374f59", text: "#c2d3da", border: "#3d6b7d" }; // checked out — muted
  // Agency also sand, but a navy rule instead of gold keeps it apart from direct bookings.
  if (isAgency) return { bg: "#f8f5ef", text: "#0f2e3a", border: "#3f6b7d" };
  // In house is said by the thin green glow around the bar, so the bar itself
  // stays sand and only takes a sage rule — no filled green background.
  if (r.checkedInAt) return { bg: "#f8f5ef", text: "#0f2e3a", border: "#4f7a54" };
  return { bg: "#f8f5ef", text: "#0f2e3a", border: "#8f6d3a" }; // upcoming direct — light sand
}

export function TimelineCalendar({ reservations, bungalows, onSelect }: Props) {
  const today = atMidnight(new Date());
  // Open on today — past days are behind us. Stays that began earlier are still
  // visible: their bars get clipped to the left edge of the grid.
  const [rangeStart, setRangeStart] = React.useState<Date>(today);
  const [selected, setSelected] = React.useState<TimelineReservation | null>(null);
  // Full-screen calendar view — mostly useful on phones: tap the button, turn the
  // phone to landscape, and the timeline fills the whole screen (many more days visible).
  const [fullscreen, setFullscreen] = React.useState(false);
  const [portrait, setPortrait] = React.useState(false);
  // The grid is tall; folding it away leaves the rest of the page reachable
  // without scrolling past forty-six days of bars.
  const [collapsed, setCollapsed] = React.useState(false);
  // Full-screen is a deliberate "show me everything", so it always wins.
  const open = fullscreen || !collapsed;
  const daysToShow = 46;

  // Lock page scroll while the full-screen calendar is open + track orientation
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(orientation: portrait)");
    const update = () => setPortrait(mq.matches);
    update();
    mq.addEventListener("change", update);
    if (fullscreen) document.body.style.overflow = "hidden";
    return () => {
      mq.removeEventListener("change", update);
      document.body.style.overflow = "";
    };
  }, [fullscreen]);

  // Close full-screen with the Escape key
  React.useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setFullscreen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  const days = React.useMemo(
    () => Array.from({ length: daysToShow }, (_, i) => addDays(rangeStart, i)),
    [rangeStart]
  );
  const rangeEnd = days[days.length - 1];

  // Shown in the folded header, so closing the calendar does not also hide the
  // two numbers that decide whether it is worth opening.
  const summary = React.useMemo(() => {
    let inHouse = 0;
    let arriving = 0;
    reservations.forEach((r) => {
      if (r.checkedOutAt) return;
      if (r.checkedInAt) inHouse++;
      else if (sameDay(parseDate(r.arrival), today)) arriving++;
    });
    return { inHouse, arriving };
  }, [reservations, today]);

  // Group consecutive days by month for the top header
  const monthGroups = React.useMemo(() => {
    const groups: { key: string; label: string; span: number }[] = [];
    for (const d of days) {
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const last = groups[groups.length - 1];
      if (last && last.key === key) last.span += 1;
      else groups.push({ key, label: `${MONTHS_SL[d.getMonth()]} ${d.getFullYear()}`, span: 1 });
    }
    return groups;
  }, [days]);

  // Bookings per bungalow, packed into non-overlapping lanes
  const rows = React.useMemo(() => {
    return bungalows.map((bungalow) => {
      const rowKey = bungalowKey(bungalow);
      const bookings = reservations
        .filter((r) => bungalowKeys(r.bungalow).includes(rowKey))
        .map((r) => {
          // Bivanje cez vec bungalovov z razlicnimi obdobji (gost se preseli):
          // za TO vrstico uporabi datume ustreznega segmenta, ce obstaja.
          const segs = Array.isArray(r.bungalowSegments) ? r.bungalowSegments : null;
          const seg = segs?.find((s) => (s.key || bungalowKey(s.bungalow || "")) === rowKey);
          return seg ? { ...r, arrival: seg.arrival, departure: seg.departure } : r;
        })
        .filter((r) => {
          if (!r.arrival || !r.departure) return false;
          const a = parseDate(r.arrival);
          const dep = parseDate(r.departure);
          return dep >= rangeStart && a <= rangeEnd; // overlaps visible range
        })
        .sort((a, b) => parseDate(a.arrival).getTime() - parseDate(b.arrival).getTime());

      const lanes: TimelineReservation[][] = [];
      const placed: { r: TimelineReservation; lane: number }[] = [];
      for (const b of bookings) {
        const a = parseDate(b.arrival).getTime();
        const dep = parseDate(b.departure).getTime();
        let lane = 0;
        while (true) {
          const conflict = (lanes[lane] || []).some((o) => {
            const oa = parseDate(o.arrival).getTime();
            const od = parseDate(o.departure).getTime();
            return a < od && oa < dep; // overlap
          });
          if (!conflict) break;
          lane += 1;
        }
        if (!lanes[lane]) lanes[lane] = [];
        lanes[lane].push(b);
        placed.push({ r: b, lane });
      }
      return { bungalow, placed, laneCount: Math.max(1, lanes.length) };
    });
  }, [bungalows, reservations, rangeStart, rangeEnd]);

  const gridW = daysToShow * DAY_W;

  const content = (
    <section className={fullscreen ? "fixed inset-0 z-[95] overflow-y-auto bg-[#092028] p-3 sm:p-6" : ""}>
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-expanded={open}
          title={open ? "Zapri koledar" : "Odpri koledar"}
          className="flex cursor-pointer items-center gap-3 text-left"
        >
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7fa8b8]">Koledar</p>
            <h2 className="mt-1 text-xl font-semibold text-white">Časovni pregled zasedenosti</h2>
          </div>
          <ChevronDown
            className={`h-5 w-5 flex-shrink-0 text-white/40 transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>

        {/* Folded: the counts stand in for the grid. Open: the navigation, which
            would do nothing visible while the grid is hidden. */}
        {!open && (
          <p className="flex items-center gap-4 text-[11px] text-white/45">
            {/* Solid dots, not the legend's sand swatches: on this navy header the
                sand fill swamps the thin coloured border and both read alike. */}
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="inline-block h-2 w-2 rounded-full bg-[#8fae92]" />
              <span className="tabular-nums text-white/70">{summary.inHouse}</span> v hiši
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="inline-block h-2 w-2 rounded-full bg-[#c59b5b]" />
              <span className="tabular-nums text-white/70">{summary.arriving}</span> danes prihaja
            </span>
          </p>
        )}

        <div className={open ? "flex items-center gap-2" : "hidden"}>
          {/* Full-screen toggle — most useful on phones (turn to landscape after opening) */}
          <button
            onClick={() => setFullscreen((v) => !v)}
            className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/[0.03] p-2 text-white/70 hover:bg-white/[0.08] hover:text-white transition-colors"
            title={fullscreen ? "Zapri celozaslonski pogled" : "Celozaslonski pogled"}
            aria-label={fullscreen ? "Zapri celozaslonski pogled" : "Celozaslonski pogled"}
          >
            {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <button
            onClick={() => setRangeStart(addDays(rangeStart, -14))}
            className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/[0.03] p-2 text-white/70 hover:bg-white/[0.08] hover:text-white transition-colors"
            title="Nazaj"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setRangeStart(today)}
            className="rounded-full border border-[#7fa8b8]/30 bg-[#7fa8b8]/10 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#7fa8b8] hover:bg-[#7fa8b8]/20 transition-colors"
          >
            Danes
          </button>
          <button
            onClick={() => setRangeStart(addDays(rangeStart, 14))}
            className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/[0.03] p-2 text-white/70 hover:bg-white/[0.08] hover:text-white transition-colors"
            title="Naprej"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Hidden rather than unmounted, so the grid keeps its horizontal scroll
          position and re-measures correctly when reopened. */}
      <div className={open ? "" : "hidden"}>
      {/* Legend */}
      <div className="mb-4 flex flex-wrap items-center gap-4 text-[11px] text-white/60">
                <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-sm" style={{ background: "#f8f5ef", border: "1px solid #8f6d3a" }} /> Prihaja</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-sm" style={{ background: "#f8f5ef", border: "1px solid #4f7a54", boxShadow: "0 0 5px rgba(79,122,84,0.6)" }} /> V hiši</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-sm" style={{ background: "#f8f5ef", border: "1px solid #3f6b7d" }} /> Agencija</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-sm" style={{ background: "#c59b5b" }} /> Medeni tedni</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-sm" style={{ background: "#374f59" }} /> Odjavljeni</span>
      </div>

      {/* Rotate hint — only while full-screen on a phone held in portrait */}
      {fullscreen && portrait && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-[#7fa8b8]/20 bg-[#7fa8b8]/10 px-3 py-2 text-xs text-[#bcdeec] sm:hidden">
          <RotateCw className="h-4 w-4 flex-shrink-0" />
          <span>Obrnite telefon v ležeči položaj za širši pregled koledarja.</span>
        </div>
      )}

      {/* Timeline */}
      <div className="overflow-x-auto rounded-2xl border border-[#0f2e3a]/12 bg-[#efe8da]">
        <div style={{ width: LABEL_W + gridW, minWidth: "100%" }}>
          {/* Month header */}
          <div className="flex border-b border-[#0f2e3a]/12">
            <div
              className="sticky left-0 z-20 flex-shrink-0 border-r border-[#0f2e3a]/12 bg-[#efe8da]"
              style={{ width: LABEL_W }}
            />
            {monthGroups.map((g) => (
              <div
                key={g.key}
                className="flex items-center justify-center border-r border-[#0f2e3a]/12 py-2 text-sm font-semibold text-[#0f2e3a]"
                style={{ width: g.span * DAY_W }}
              >
                {g.label}
              </div>
            ))}
          </div>

          {/* Day header */}
          <div className="flex border-b border-[#0f2e3a]/12">
            <div
              className="sticky left-0 z-20 flex-shrink-0 border-r border-[#0f2e3a]/12 bg-[#efe8da] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#2b2622]/55"
              style={{ width: LABEL_W }}
            >
              Bungalov
            </div>
            {days.map((d, i) => {
              const isToday = sameDay(d, today);
              const wd = d.getDay();
              const isWeekend = wd === 0 || wd === 6;
              return (
                <div
                  key={i}
                  className="flex flex-shrink-0 flex-col items-center justify-center border-r border-[#0f2e3a]/[0.08] py-1"
                  style={{
                    width: DAY_W,
                    background: isToday ? "rgba(63,107,125,0.24)" : isWeekend ? "rgba(15,46,58,0.05)" : "transparent",
                  }}
                >
                  <span className={`text-xs font-semibold ${isToday ? "text-[#3f6b7d]" : "text-[#2b2622]/85"}`}>{d.getDate()}</span>
                  <span className={`text-[9px] ${isToday ? "text-[#3f6b7d]" : "text-[#2b2622]/55"}`}>{WEEKDAY_SL[wd]}</span>
                </div>
              );
            })}
          </div>

          {/* Bungalow rows */}
          {rows.map((row, ri) => {
            const rowH = row.laneCount * (BAR_H + LANE_GAP) + LANE_GAP;
            return (
              <div
                key={row.bungalow}
                className="flex border-b border-[#0f2e3a]/[0.08]"
                style={{ background: ri % 2 === 0 ? "transparent" : "rgba(15,46,58,0.025)" }}
              >
                {/* Sticky label */}
                <div
                  className="sticky left-0 z-10 flex flex-shrink-0 items-center border-r border-[#0f2e3a]/12 bg-[#efe8da] px-3"
                  style={{ width: LABEL_W, height: rowH }}
                >
                  <span
                    className="truncate text-[15px] font-semibold tracking-[0.1em] text-[#0f2e3a]"
                    title={bungalowLabel(row.bungalow)}
                  >
                    {romanOf(row.bungalow)}
                  </span>
                </div>

                {/* Day grid + bars */}
                <div className="relative" style={{ width: gridW, height: rowH }}>
                  {/* background day cells */}
                  {days.map((d, i) => {
                    const isToday = sameDay(d, today);
                    const wd = d.getDay();
                    const isWeekend = wd === 0 || wd === 6;
                    return (
                      <div
                        key={i}
                        className="absolute top-0 border-r border-[#0f2e3a]/[0.08]"
                        style={{
                          left: i * DAY_W,
                          width: DAY_W,
                          height: rowH,
                          background: isToday ? "rgba(63,107,125,0.18)" : isWeekend ? "rgba(15,46,58,0.035)" : "transparent",
                        }}
                      />
                    );
                  })}

                  {/* booking bars */}
                  {row.placed.map(({ r, lane }) => {
                    const a = parseDate(r.arrival);
                    const dep = parseDate(r.departure);
                    const startIdx = daysBetween(rangeStart, a);
                    const nights = Math.max(1, daysBetween(a, dep));
                    // Hotel convention: bar spans from mid arrival day to mid departure day.
                    // (A 1-night stay is exactly one column wide, centered on the arrival/departure boundary.)
                    const leftBase = startIdx * DAY_W + DAY_W / 2;
                    const rightBase = (startIdx + nights) * DAY_W + DAY_W / 2;
                    // clip to visible range
                    const left = Math.max(0, leftBase);
                    const right = Math.min(gridW, rightBase);
                    const width = right - left;
                    if (width <= 0) return null;
                    const c = barColors(r);
                    const inHouse = !!r.checkedInAt && !r.checkedOutAt;
                    // Guest due to arrive today and not yet checked in — today's job, so it blinks.
                    const arrivingToday = !inHouse && !r.checkedOutAt && !r.checkedInAt && sameDay(a, today);
                    // Sand bars carry dark text, so they take the card's semantic accents;
                    // the coloured bars (in house, honeymoon, checked out) inherit instead.
                    const onSand = c.bg === "#f8f5ef";
                    const label = `${r.agencyName ? r.agencyName + " · " : ""}${r.guestName}${r.pax > 1 ? ` x${r.pax}` : ""}`;
                    const arrivalBooked = !!r.transfers?.arrival?.route;
                    const departureBooked = !!r.transfers?.departure?.route;
                    // The bar is a timeline, so each leg sits at its own end: the arrival
                    // ride leads, and once the guest checks in it gives way to the ride home.
                    const showArrivalRide = !r.checkedInAt && !r.checkedOutAt && arrivalBooked;
                    const showDepartureRide = inHouse;
                    return (
                      <button
                        key={r.id}
                        onClick={() => setSelected(r)}
                        title={`${label} · ${r.arrival} → ${r.departure}${showDepartureRide && !departureBooked ? " · Prevoz ob odhodu še ni urejen" : ""}`}
                        className={`absolute flex items-center gap-1 overflow-hidden rounded-md px-2 text-left transition-transform hover:z-10 hover:scale-[1.01]${arrivingToday ? " animate-arriving-border" : ""}`}
                        style={{
                          left,
                          width,
                          top: LANE_GAP + lane * (BAR_H + LANE_GAP),
                          height: BAR_H,
                          background: c.bg,
                          color: c.text,
                          // Inline border/shadow would outrank the keyframes, so the blinking
                          // bar leaves both to the animation.
                          border: arrivingToday ? "1px solid" : `1px solid ${c.border}`,
                          // Thin ring plus a soft halo — enough to read as "in
                          // house" without filling the bar with colour.
                          boxShadow: inHouse ? "0 0 0 1px #4f7a54, 0 0 6px rgba(79,122,84,0.45)" : undefined,
                        }}
                      >
                        {/* No in-house dot: the green ring around the bar already says it. */}
                        {r.honeymoon ? (
                          <Heart className="h-3.5 w-3.5 flex-shrink-0" strokeWidth={2.5} style={onSand ? { color: "#a8761a" } : undefined} />
                        ) : null}
                        {/* Rides sit a step quieter than the meal mark: thinner stroke and the
                            card's calmer sage, so they read as context rather than a shout. */}
                        {showArrivalRide ? (
                          <Ship className="h-3 w-3 flex-shrink-0" strokeWidth={1.75} style={onSand ? { color: "#4f7a54" } : undefined} title="Prevoz ob prihodu je urejen" />
                        ) : null}
                        {(() => {
                          const mb = mealBadgeOf(r);
                          if (!mb) return null;
                          return (
                            <>
                              {/* Typographic mark plus a hairline rule — the card's badge language,
                                  in place of the pill this used to be. */}
                              <span
                                className="flex-shrink-0 text-[9px] font-semibold uppercase tracking-[0.16em]"
                                style={{ color: onSand ? mb.color : c.text }}
                                title={mb.label}
                              >
                                {mb.code}
                              </span>
                              <span
                                aria-hidden
                                className="h-2.5 w-px flex-shrink-0"
                                style={{ background: onSand ? "rgba(15,46,58,0.15)" : "rgba(255,255,255,0.25)" }}
                              />
                            </>
                          );
                        })()}
                        <span className="truncate text-[12px] font-light tracking-[0.01em]">{label}</span>
                        {showDepartureRide ? (
                          // Booked reads sage like the arrival ride; unbooked takes the card's
                          // terracotta "Prevoz ni urejen" accent plus a dot to flag the gap.
                          <span
                            className="relative ml-auto flex-shrink-0"
                            title={departureBooked ? "Prevoz ob odhodu je urejen" : "Prevoz ob odhodu še ni urejen"}
                          >
                            <Ship
                              className="h-3 w-3"
                              strokeWidth={1.75}
                              style={{ color: departureBooked ? (onSand ? "#4f7a54" : "#1a2d1c") : onSand ? "#a15a3f" : "#c4744a" }}
                            />
                            {departureBooked ? null : (
                              <span
                                aria-hidden
                                className="absolute -right-0.5 -top-0.5 h-1 w-1 rounded-full"
                                style={{ background: onSand ? "#a15a3f" : "#c4744a" }}
                              />
                            )}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="mt-3 text-[11px] text-white/40">Kliknite na rezervacijo za podrobnosti. Modri stolpec označuje današnji dan.</p>
      </div>

      {selected && typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
            onClick={() => setSelected(null)}
          >
            <div
              className="relative w-full max-w-md overflow-hidden rounded-2xl border border-[#0f2e3a]/12 bg-[#efe8da] shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {(() => {
                const inHouse = !!selected.checkedInAt && !selected.checkedOutAt;
                const nights = nightsBetween(selected.arrival, selected.departure);
                const stateLabel = selected.checkedOutAt
                  ? "Odjavljen"
                  : inHouse
                    ? "Trenutno v hiši"
                    : (selected.bookingSource === "Agency" && selected.agencyName) || selected.agencyName
                      ? "Agencija"
                      : "Prihaja";
                // Same status stripe language as the bungalow card: a hairline of colour
                // on the left edge instead of a tinted header.
                const accent = selected.checkedOutAt
                  ? "#6e655c"
                  : inHouse
                    ? "#4f7a54"
                    : stateLabel === "Agencija"
                      ? "#3f6b7d"
                      : "#8f6d3a";
                return (
                  <>
                    <span aria-hidden className="absolute left-0 top-0 h-full w-[3px]" style={{ backgroundColor: accent }} />

                    <div className="flex items-start justify-between gap-3 py-4 pl-5 pr-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          {selected.honeymoon ? <Heart className="h-4 w-4 flex-shrink-0 text-[#8f6d3a]" /> : null}
                          <GuestFlag
                            nationalities={[
                              selected.nationality,
                              selected.secondNationality,
                              selected.thirdNationality,
                              selected.fourthNationality,
                            ]}
                          />
                          <h3 className="truncate text-[17px] font-semibold leading-tight tracking-[0.01em] text-[#0f2e3a]">
                            {selected.guestName}
                          </h3>
                        </div>
                        <span aria-hidden className="mt-2 block h-px w-full bg-[#8f6d3a]/35" />
                        {selected.secondGuestName ? (
                          <p className="mt-1.5 truncate text-[13px] font-light text-[#2b2622]/60">+ {selected.secondGuestName}</p>
                        ) : null}
                        <p
                          className="mt-1.5 text-[9px] font-semibold uppercase tracking-[0.22em]"
                          style={{ color: accent }}
                        >
                          {stateLabel}
                        </p>
                      </div>
                      <button
                        onClick={() => setSelected(null)}
                        className="flex-shrink-0 cursor-pointer rounded-full border border-[#0f2e3a]/12 bg-white p-1.5 text-[#2b2622]/55 transition-colors hover:bg-[#0f2e3a]/[0.06]"
                        title="Zapri"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="mx-5 mb-4 space-y-3 rounded-lg border border-[#0f2e3a]/[0.08] bg-white p-4 text-[13px] text-[#2b2622]/85">
                      <div className="flex items-center gap-2.5">
                        <MapPin className="h-4 w-4 flex-shrink-0 text-[#2b2622]/40" />
                        <span>{bungalowLabel(selected.bungalow)}</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <CalendarDays className="h-4 w-4 flex-shrink-0 text-[#2b2622]/40" />
                        <span className="tabular-nums">
                          {formatDateSlo(selected.arrival)} → {formatDateSlo(selected.departure)}
                          <span className="text-[#2b2622]/50"> · {nights} {nights === 1 ? "noč" : "noči"}</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <Users className="h-4 w-4 flex-shrink-0 text-[#2b2622]/40" />
                        <span className="tabular-nums">{selected.pax} {selected.pax === 1 ? "oseba" : selected.pax === 2 ? "osebi" : "oseb"}</span>
                      </div>
                      {(() => {
                        const mb = mealBadgeOf(selected);
                        if (!mb) return null;
                        return (
                          <div className="flex items-center gap-2.5">
                            <UtensilsCrossed className="h-4 w-4 flex-shrink-0 text-[#8f6d3a]" />
                            <span>
                              {/* Darker variants of the meal colours so they read on the white panel. */}
                              <span className="font-semibold" style={{ color: mb.color === "#8b612e" ? "#8f6d3a" : mb.color === "#357c98" ? "#3f6b7d" : "#4f7a54" }}>{mb.code}</span>
                              {" · "}{mb.label}
                            </span>
                          </div>
                        );
                      })()}
                      {selected.agencyName ? (
                        <div className="flex items-center gap-2.5">
                          <Building2 className="h-4 w-4 flex-shrink-0 text-[#3f6b7d]" />
                          <span>Agencija: {selected.agencyName}</span>
                        </div>
                      ) : null}
                      {(selected.transfers?.arrival?.route || selected.transfers?.departure?.route) ? (
                        <div className="flex items-center gap-2.5">
                          {/* Sage green is the "transfer arranged" colour used on the bungalow card. */}
                          <Ship className="h-4 w-4 flex-shrink-0 text-[#4f7a54]" />
                          <span>Urejen prevoz</span>
                        </div>
                      ) : null}
                      {parseNotes(selected.notes).length > 0 ? (
                        // Notes read like a margin note on print: a gold rule, no icon.
                        <div className="min-w-0 space-y-1 border-l border-[#8f6d3a]/40 pl-2.5">
                          {parseNotes(selected.notes).map((n, i) => (
                            <p key={i} className="text-[11px] font-light leading-relaxed text-[#2b2622]/75">{n}</p>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <div className="flex gap-2 border-t border-[#0f2e3a]/[0.08] px-5 py-4">
                      <button
                        onClick={() => { const id = selected.id; setSelected(null); onSelect(id); }}
                        className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#0f2e3a] px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#f8f5ef] transition-opacity hover:opacity-90"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Odpri kartico gosta
                      </button>
                      <button
                        onClick={() => setSelected(null)}
                        className="cursor-pointer rounded-xl border border-[#0f2e3a]/15 bg-white px-4 py-2.5 text-[10px] font-medium uppercase tracking-[0.18em] text-[#2b2622]/70 transition-colors hover:bg-[#0f2e3a]/[0.04]"
                      >
                        Zapri
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>,
          document.body
        )}
    </section>
  );

  // When full-screen, portal to <body> so `fixed inset-0` escapes any transformed ancestor.
  return fullscreen && typeof document !== "undefined"
    ? createPortal(content, document.body)
    : content;
}
