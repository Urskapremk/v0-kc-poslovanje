"use client";

import React from "react";
import Link from "next/link";
import useSWR from "swr";
import { ArrowLeft, Printer } from "lucide-react";
import { getAllStaffMembers } from "../actions/statistics";

const MONTHS_SL = [
  "Januar", "Februar", "Marec", "April", "Maj", "Junij",
  "Julij", "Avgust", "September", "Oktober", "November", "December"
];

const MONTHS_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const MONTHS_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
];

// Francoščina je besedilo na potrdilu. Slovensko in angleško sta samo prevod pod njo.
// Ključi pokrivajo trenutna delovna mesta in starejše oznake.
const ROLES: Record<string, { fr: string; sl: string; en: string }> = {
  gardener: { fr: "Jardinier", sl: "Vrtnar", en: "Gardener" },
  housekeeper: { fr: "Femme de chambre", sl: "Sobarica", en: "Housekeeper" },
  barman: { fr: "Barman", sl: "Barman", en: "Barman" },
  kitchen: { fr: "Cuisinier", sl: "Kuhar", en: "Cook" },
  reception: { fr: "Réceptionniste", sl: "Recepcija", en: "Receptionist" },
  maintenance: { fr: "Agent d'entretien", sl: "Vzdrževalec", en: "Maintenance" },
  other: { fr: "Employé", sl: "Drugo", en: "Other" },
  chef: { fr: "Chef cuisinier", sl: "Kuhar", en: "Chef" },
  "sous-chef": { fr: "Sous-chef", sl: "Pomočnik kuharja", en: "Sous chef" },
  "kitchen-helper": { fr: "Aide-cuisinier", sl: "Kuhinjski pomočnik", en: "Kitchen helper" },
  waiter: { fr: "Serveur", sl: "Natakar", en: "Waiter" },
  guard: { fr: "Gardien", sl: "Varnostnik", en: "Guard" },
  manager: { fr: "Gérant", sl: "Upravnik", en: "Manager" },
};

function translationLine(fr: string, ...others: string[]) {
  const seen = new Set<string>([fr.toLocaleLowerCase("fr")])
  const extra: string[] = []
  for (const value of others) {
    const key = value.toLocaleLowerCase("fr")
    if (!value || seen.has(key)) continue
    seen.add(key)
    extra.push(value)
  }
  return extra.join(" / ")
}

function Label({ fr, sl, en }: { fr: string; sl: string; en: string }) {
  const under = translationLine(fr, sl, en)
  return (
    <span className="block w-44 shrink-0 leading-tight">
      <span className="block text-gray-800">{fr}</span>
      {under && <span className="block text-[10px] text-gray-400">{under}</span>}
    </span>
  )
}

function HeadCell({ fr, sl, en, align = "center", className = "" }: { fr: string; sl: string; en: string; align?: "left" | "center"; className?: string }) {
  const under = translationLine(fr, sl, en)
  return (
    <th className={`border border-black px-2 py-1.5 text-xs font-bold ${align === "left" ? "text-left" : "text-center"} ${className}`}>
      <span className="block">{fr}</span>
      {under && <span className="block text-[9px] font-normal text-gray-500">{under}</span>}
    </th>
  )
}

function SalaryReceipt({
  name,
  role,
  year,
  months,
}: {
  name: string
  role: { fr: string; sl: string; en: string } | null
  year: number
  months: number[]
}) {
  const roleUnder = role ? translationLine(role.fr, role.sl, role.en) : ""
  return (
    <div className="w-full max-w-[210mm] mx-auto bg-white p-6 text-black font-serif text-sm">
      <div className="mb-4 border-b-2 border-black pb-3 text-center">
        <h1 className="text-xl font-bold tracking-wide">KOMBA CABANA</h1>
        <p className="text-xs text-gray-600">Nosy Komba, Madagascar</p>
      </div>

      <div className="mb-4 text-center">
        <h2 className="mb-1 text-lg font-bold uppercase tracking-wider">Reçu de salaire {year}</h2>
        <p className="text-xs text-gray-500">Potrdilo o prejemu plače / Salary receipt</p>
      </div>

      <div className="mb-4 space-y-2 text-sm">
        <div className="flex items-start gap-2">
          <Label fr="Nom" sl="Ime" en="Name" />
          <span className="font-semibold">{name}</span>
        </div>
        <div className="flex items-start gap-2">
          <Label fr="Poste" sl="Delovno mesto" en="Position" />
          <span>
            <span className="block font-semibold">{role?.fr || "—"}</span>
            {roleUnder && <span className="block text-[10px] text-gray-500">{roleUnder}</span>}
          </span>
        </div>
      </div>

      <table className="mb-4 w-full border-collapse border-2 border-black">
        <thead>
          <tr className="bg-gray-100">
            <HeadCell fr="Mois" sl="Mesec" en="Month" align="left" />
            <HeadCell fr="Montant (Ar)" sl="Znesek (Ar)" en="Amount (Ar)" className="w-32" />
            <HeadCell fr="Signature" sl="Podpis" en="Signature" className="w-40" />
            <HeadCell fr="Date" sl="Datum" en="Date" className="w-28" />
          </tr>
        </thead>
        <tbody>
          {months.map((monthIndex) => (
            <tr key={monthIndex}>
              <td className="border border-black px-2 py-1.5 text-xs">
                <span className="block font-medium">{MONTHS_FR[monthIndex]}</span>
                <span className="block text-[10px] text-gray-500">
                  {MONTHS_SL[monthIndex]} / {MONTHS_EN[monthIndex]}
                </span>
              </td>
              <td className="border border-black px-2 py-1.5" />
              <td className="border border-black px-2 py-1.5" />
              <td className="border border-black px-2 py-1.5 text-center text-[10px] text-gray-400">JJ/MM/AAAA</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 space-y-0.5 text-xs">
        <p className="text-black">Par ma signature, je confirme avoir reçu le salaire pour chaque mois.</p>
        <p className="text-[10px] text-gray-500">S podpisom potrjujem prejem plače za posamezen mesec.</p>
        <p className="text-[10px] text-gray-500">By signing I confirm receipt of salary for each month.</p>
      </div>
    </div>
  )
}

export default function PotrdilaPrejemaPlace() {
  const { data: allStaff } = useSWR("staff-members", getAllStaffMembers);
  const activeStaff = (allStaff || []).filter((s) => s.active !== false);

  const [selectedStaffId, setSelectedStaffId] = React.useState("");
  const [selectedYear, setSelectedYear] = React.useState(new Date().getFullYear());

  const selectedStaff = activeStaff.find((s) => s.id === selectedStaffId);
  const role = selectedStaff ? (ROLES[selectedStaff.staffType] || null) : null;
  const roleLabel = (staffType: string) => ROLES[staffType]?.sl || staffType;

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => 2026 + i).filter(y => y <= currentYear + 1);

  const monthsToShow = selectedYear === 2026
    ? [5, 6, 7, 8, 9, 10, 11]
    : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

  return (
    <div className="min-h-screen bg-[#0a2029]">
      <div className="print:hidden border-b border-white/10 bg-[#0b2731]">
        <div className="mx-auto max-w-4xl px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/statistika" className="text-white/60 hover:text-white transition-colors">
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <h1 className="text-lg font-semibold text-white">Potrdilo o prejemu plače</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="print:hidden mx-auto max-w-4xl px-6 py-8">
        <div className="rounded-2xl border border-white/10 bg-[#0b2731] p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white/40">Izberi delavca in leto</h2>

          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-medium text-white/40">Delavec</label>
              <select
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#102128] px-4 py-3 text-white focus:border-[#c59b5b]/50 focus:outline-none [&>option]:bg-[#102128] [&>option]:text-white"
              >
                <option value="">-- Izberi delavca --</option>
                {activeStaff.map((s) => (
                  <option key={s.id} value={s.id}>{s.staffName} ({roleLabel(s.staffType)})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium text-white/40">Leto</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="w-full rounded-xl border border-white/10 bg-[#102128] px-4 py-3 text-white focus:border-[#c59b5b]/50 focus:outline-none [&>option]:bg-[#102128] [&>option]:text-white"
              >
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          {selectedStaff && (
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 rounded-xl bg-[#c59b5b] px-6 py-3 text-sm font-semibold text-black transition-colors hover:bg-[#c59b5b]/90"
            >
              <Printer className="h-4 w-4" />
              Natisni potrdilo za leto {selectedYear}
            </button>
          )}
        </div>
      </div>

      {selectedStaff && (
        <div className="hidden print:block print:m-0 print:p-0">
          <SalaryReceipt
            name={selectedStaff.staffName}
            role={role}
            year={selectedYear}
            months={monthsToShow}
          />
        </div>
      )}

      {selectedStaff && (
        <div className="print:hidden mx-auto max-w-4xl px-6 pb-8">
          <div className="overflow-hidden rounded-2xl border border-white/10">
            <SalaryReceipt
              name={selectedStaff.staffName}
              role={role}
              year={selectedYear}
              months={monthsToShow}
            />
          </div>
        </div>
      )}
    </div>
  );
}
