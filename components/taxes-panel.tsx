"use client";

import React from "react";
import useSWR from "swr";
import { Landmark, Printer, ChevronLeft, ChevronRight, X, RotateCcw } from "lucide-react";
import { getTaxesForMonth, setReservationTaxExclusion, type MonthlyTaxes } from "@/app/actions/komba";
import { bungalowLabel } from "@/lib/bungalow";

const ar = (value: unknown) => `${Math.round(Number(value) || 0).toLocaleString("fr-FR")} Ar`;

const MONTH_NAMES = [
  "Januar", "Februar", "Marec", "April", "Maj", "Junij",
  "Julij", "Avgust", "September", "Oktober", "November", "December",
  ];

const MONTH_NAMES_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
  ];

export function TaxesPanel() {
  // Default to previous month (taxes are paid by the 5th for the previous month)
  const now = new Date();
  const initial = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const [year, setYear] = React.useState(initial.getFullYear());
  const [month, setMonth] = React.useState(initial.getMonth() + 1); // 1-12

  const { data, isLoading, mutate } = useSWR<MonthlyTaxes>(
    ["taxes", year, month],
    () => getTaxesForMonth(year, month),
    { revalidateOnFocus: false }
  );

  const [togglingId, setTogglingId] = React.useState<string | null>(null);

  const handleToggleExclude = async (reservationId: string, excluded: boolean) => {
    setTogglingId(reservationId);
    // Optimistično posodobi seznam + vsote
    await mutate(
      async () => {
        await setReservationTaxExclusion(reservationId, excluded);
        return getTaxesForMonth(year, month);
      },
      { revalidate: false }
    );
    setTogglingId(null);
  };

  const goPrev = () => {
    const d = new Date(year, month - 2, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
  };
  const goNext = () => {
    const d = new Date(year, month, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
  };

  const monthLabel = `${MONTH_NAMES[month - 1]} ${year}`;
  // Deadline: 5th of the following month
  const deadline = new Date(year, month, 5);
  const deadlineLabel = deadline.toLocaleDateString("sl-SI", { day: "numeric", month: "long", year: "numeric" });
  const deadlineLabelFr = deadline.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  const monthLabelFr = `${MONTH_NAMES_FR[month - 1]} ${year}`;

  const handlePrint = () => {
    if (!data) return;
    const rows = data.lineItems
      .filter((i) => !i.excluded)
      .map(
        (i) => `
        <tr>
          <td>${escapeHtml(bungalowLabel(i.bungalow))}</td>
          <td>${escapeHtml(i.guestName)}</td>
          <td style="text-align:center">${i.pax}</td>
          <td style="text-align:center">${i.nights}</td>
          <td style="text-align:center">${i.arrival} → ${i.departure}</td>
          <td style="text-align:right">${ar(i.communalTax)}</td>
          <td style="text-align:right">${ar(i.touristTax)}</td>
          <td style="text-align:right">${ar(i.total)}</td>
        </tr>`
      )
      .join("");

    const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>Taxes - ${monthLabelFr}</title>
<style>
  /* LEŽEČI format — široka tabela (8 stolpcev) na pokončni strani ne zdrži */
  @page { size: A4 landscape; margin: 12mm; }
  * { box-sizing: border-box; }
  /* Ves izpis je namenoma ČRNO-BEL in BREZ krepkih pisav — uradni obračun */
  body, h1, div, p, table, th, td, span { color: #000 !important; font-weight: normal !important; }
  body { font-family: Arial, Helvetica, sans-serif; background: #fff; margin: 0; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .sub { font-size: 12px; margin-bottom: 2px; }
  .deadline { font-size: 12px; margin: 8px 0 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th, td { border: 1px solid #000; padding: 5px 8px; }
  th { background: #fff; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; }
  /* Glava se PONOVI na vsaki strani, seštevki ostanejo SAMO na koncu */
  thead { display: table-header-group; }
  tfoot { display: table-row-group; }
  tr, th, td { page-break-inside: avoid; break-inside: avoid; }
  tfoot tr { page-break-before: avoid; break-before: avoid; }
  /* BREZ text-transform — velike črke bi valuto "Ar" pretvorile v "AR" */
  tfoot td { background: #fff; letter-spacing: 0.04em; }
  /* Okvirji seštevkov se ne smejo prerezati na prelomu strani */
  .totals { margin-top: 20px; display: flex; gap: 32px; page-break-inside: avoid; break-inside: avoid; }
  .totals .box { border: 1px solid #000; padding: 10px 14px; page-break-inside: avoid; break-inside: avoid; }
  .totals .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; }
  .totals .val { font-size: 16px; margin-top: 4px; }
  .grand { font-size: 19px !important; }
  .meta { margin-top: 10px; font-size: 10px; }
  @media print {
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; color: #000 !important; font-weight: normal !important; }
  }
</style>
</head>
<body>
  <h1>Komba Cabana — Décompte des taxes</h1>
  <div class="sub">Période : ${monthLabelFr}</div>
  <div class="sub">Taxe communale : 2.000 Ar / personne / nuit &nbsp;·&nbsp; Taxe de séjour : 1.000 Ar / bungalow / nuit</div>
  <div class="deadline">Date limite de paiement : le ${escapeHtml(deadlineLabelFr)}</div>
  <table>
    <thead>
      <tr>
        <th>Bungalow</th><th>Client</th><th>Personnes</th><th>Nuits</th><th>Période</th>
        <th style="text-align:right">Communale</th><th style="text-align:right">Séjour</th><th style="text-align:right">Total</th>
      </tr>
    </thead>
    <tbody>${rows || `<tr><td colspan="8" style="text-align:center">Aucune donnée pour cette période</td></tr>`}</tbody>
    <tfoot>
      <tr>
        <td colspan="5" style="text-align:right">TOTAL</td>
        <td style="text-align:right">${ar(data.communalTotal)}</td>
        <td style="text-align:right">${ar(data.touristTotal)}</td>
        <td style="text-align:right">${ar(data.grandTotal)}</td>
      </tr>
    </tfoot>
  </table>
  <div class="totals">
    <div class="box"><div class="label">Taxe communale</div><div class="val">${ar(data.communalTotal)}</div></div>
    <div class="box"><div class="label">Taxe de séjour</div><div class="val">${ar(data.touristTotal)}</div></div>
    <div class="box"><div class="label">Total à payer</div><div class="val grand">${ar(data.grandTotal)}</div></div>
  </div>
  <div class="meta">Imprimé le : ${new Date().toLocaleString("fr-FR")}</div>
  <script>window.onload = function(){ window.print(); }</script>
</body>
</html>`;

    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  };

  return (
    <div className="mt-4 rounded-2xl border border-[#8f6d3a]/25 bg-[#f8f5ef] p-5">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-[#8f6d3a] flex items-center gap-2">
          <Landmark className="h-4 w-4" />
          Takse — {monthLabel}
        </h4>
        <div className="flex items-center gap-2">
          {/* Month navigation */}
          <div className="flex items-center gap-1 rounded-lg border border-[#0f2e3a]/12 bg-white p-1">
            <button
              onClick={goPrev}
              className="cursor-pointer rounded-md p-1.5 text-[#2b2622]/55 hover:bg-[#0f2e3a]/[0.06] hover:text-[#0f2e3a] transition-colors"
              aria-label="Prejšnji mesec"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-2 text-xs font-medium text-[#2b2622]/85 min-w-[90px] text-center">{monthLabel}</span>
            <button
              onClick={goNext}
              className="cursor-pointer rounded-md p-1.5 text-[#2b2622]/55 hover:bg-[#0f2e3a]/[0.06] hover:text-[#0f2e3a] transition-colors"
              aria-label="Naslednji mesec"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <button
            onClick={handlePrint}
            disabled={!data || data.lineItems.length === 0}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#8f6d3a]/35 bg-[#8f6d3a]/10 px-3 py-2 text-xs font-medium text-[#8f6d3a] hover:bg-[#8f6d3a]/20 transition-colors disabled:opacity-40"
          >
            <Printer className="h-3.5 w-3.5" /> Natisni
          </button>
        </div>
      </div>

      {/* Deadline notice */}
      <p className="mb-4 text-[11px] text-[#2b2622]/55">
        Rok za plačilo: <span className="text-[#8f6d3a] font-medium">do {deadlineLabel}</span>
        <span className="mx-2 text-[#0f2e3a]/20">·</span>
        Občinska 2.000 Ar/os/noč · Turistična 1.000 Ar/bungalov/noč
      </p>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="rounded-xl border border-[#0f2e3a]/[0.08] bg-white p-3">
          <div className="text-[10px] uppercase tracking-wider text-[#2b2622]/50">Občinska</div>
          <div className="mt-1 text-sm font-semibold tabular-nums text-[#0f2e3a]">{ar(data?.communalTotal || 0)}</div>
        </div>
        <div className="rounded-xl border border-[#0f2e3a]/[0.08] bg-white p-3">
          <div className="text-[10px] uppercase tracking-wider text-[#2b2622]/50">Turistična</div>
          <div className="mt-1 text-sm font-semibold tabular-nums text-[#0f2e3a]">{ar(data?.touristTotal || 0)}</div>
        </div>
        <div className="rounded-xl border border-[#8f6d3a]/30 bg-[#8f6d3a]/[0.08] p-3">
          <div className="text-[10px] uppercase tracking-wider text-[#8f6d3a]/80">Skupaj</div>
          <div className="mt-1 text-base font-bold tabular-nums text-[#8f6d3a]">{ar(data?.grandTotal || 0)}</div>
        </div>
      </div>

      {/* Line items table */}
      {isLoading ? (
        <p className="py-6 text-center text-sm font-light italic text-[#2b2622]/50">Nalaganje…</p>
      ) : !data || data.lineItems.length === 0 ? (
        <p className="py-6 text-center text-sm font-light italic text-[#2b2622]/50">Ni gostov z nočitvami v tem mesecu.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-[#2b2622]/50">
                <th className="pb-2 pr-3 font-medium">Bungalov</th>
                <th className="pb-2 pr-3 font-medium">Gost</th>
                <th className="pb-2 px-2 font-medium text-center">Os.</th>
                <th className="pb-2 px-2 font-medium text-center">Noči</th>
                <th className="pb-2 px-3 font-medium text-right">Občinska</th>
                <th className="pb-2 px-3 font-medium text-right">Turistična</th>
                <th className="pb-2 pl-3 font-medium text-right">Skupaj</th>
                <th className="pb-2 pl-3 font-medium text-center w-10"><span className="sr-only">Izključi</span></th>
              </tr>
            </thead>
            <tbody>
              {data.lineItems.map((i) => (
                <tr
                  key={i.reservationId}
                  className={`border-t border-[#0f2e3a]/[0.08] ${i.excluded ? "opacity-45" : ""}`}
                >
                  <td className={`py-2 pr-3 text-[#2b2622]/85 ${i.excluded ? "line-through" : ""}`}>{bungalowLabel(i.bungalow)}</td>
                  <td className={`py-2 pr-3 text-[#2b2622]/65 ${i.excluded ? "line-through" : ""}`}>
                    {i.guestName}
                    {i.excluded && <span className="ml-2 no-underline opacity-100 text-[9px] uppercase tracking-wider text-[#8f6d3a]">izključeno</span>}
                  </td>
                  <td className="py-2 px-2 text-center tabular-nums text-[#2b2622]/65">{i.pax}</td>
                  <td className="py-2 px-2 text-center tabular-nums text-[#2b2622]/65">{i.nights}</td>
                  <td className="py-2 px-3 text-right whitespace-nowrap tabular-nums text-[#2b2622]/70">{ar(i.communalTax)}</td>
                  <td className="py-2 px-3 text-right whitespace-nowrap tabular-nums text-[#2b2622]/70">{ar(i.touristTax)}</td>
                  <td className="py-2 pl-3 text-right whitespace-nowrap font-medium tabular-nums text-[#0f2e3a]">{ar(i.total)}</td>
                  <td className="py-2 pl-3 text-center">
                    <button
                      onClick={() => handleToggleExclude(i.reservationId, !i.excluded)}
                      disabled={togglingId === i.reservationId}
                      className={`cursor-pointer rounded-md p-1 transition-colors disabled:opacity-40 ${
                        i.excluded
                          ? "text-[#4f7a54] hover:bg-[#4f7a54]/12"
                          : "text-[#2b2622]/40 hover:bg-[#0f2e3a]/[0.06] hover:text-[#8f6d3a]"
                      }`}
                      aria-label={i.excluded ? "Vključi nazaj v takse" : "Izključi iz taks"}
                      title={i.excluded ? "Vključi nazaj v takse" : "Izključi iz taks"}
                    >
                      {i.excluded ? <RotateCcw className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
