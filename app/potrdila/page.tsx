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

const STAFF_TYPES: Record<string, string> = {
  'chef': 'Kuhar / Chef',
  'sous-chef': 'Pomočnik kuharja / Sous Chef',
  'kitchen-helper': 'Kuhinjski pomočnik / Kitchen Helper',
  'barman': 'Barman',
  'waiter': 'Natakar / Waiter',
  'housekeeper': 'Sobarica / Housekeeper',
  'gardener': 'Vrtnar / Gardener',
  'guard': 'Varnostnik / Guard',
  'maintenance': 'Vzdrževalec / Maintenance',
  'manager': 'Upravnik / Manager',
  'other': 'Drugo / Other'
};

export default function PotrdilaPrejemaPlace() {
  const { data: allStaff } = useSWR("staff-members", getAllStaffMembers);
  const activeStaff = (allStaff || []).filter((s) => s.active !== false);
  
  const [selectedStaffId, setSelectedStaffId] = React.useState("");
  const [selectedYear, setSelectedYear] = React.useState(new Date().getFullYear());
  
  const selectedStaff = activeStaff.find((s) => s.id === selectedStaffId);
  const staffRole = selectedStaff ? (STAFF_TYPES[selectedStaff.staffType] || selectedStaff.staffType) : '';
  
  // Generate years from 2026 onwards
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => 2026 + i).filter(y => y <= currentYear + 1);
  
  // Months to show - for 2026 start from June (index 5), otherwise full year
  const monthsToShow = selectedYear === 2026 
    ? [5, 6, 7, 8, 9, 10, 11] // Junij - December
    : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]; // Januar - December

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-[#0a2029]">
      {/* Header - hidden when printing */}
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

      {/* Selection Form - hidden when printing */}
      <div className="print:hidden mx-auto max-w-4xl px-6 py-8">
        <div className="rounded-2xl border border-white/10 bg-[#0b2731] p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-white/40 mb-4">Izberi delavca in leto</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Staff Selection */}
            <div>
              <label className="block text-xs font-medium text-white/40 mb-2">Delavec</label>
              <select
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#102128] px-4 py-3 text-white focus:border-[#c59b5b]/50 focus:outline-none [&>option]:bg-[#102128] [&>option]:text-white"
              >
                <option value="">-- Izberi delavca --</option>
                {activeStaff.map((s) => (
                  <option key={s.id} value={s.id}>{s.staffName} ({STAFF_TYPES[s.staffType] || s.staffType})</option>
                ))}
              </select>
            </div>
            
            {/* Year Selection */}
            <div>
              <label className="block text-xs font-medium text-white/40 mb-2">Leto</label>
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
              onClick={handlePrint}
              className="flex items-center gap-2 rounded-xl bg-[#c59b5b] px-6 py-3 text-sm font-semibold text-black hover:bg-[#c59b5b]/90 transition-colors"
            >
              <Printer className="h-4 w-4" />
              Natisni potrdilo za leto {selectedYear}
            </button>
          )}
        </div>
      </div>

      {/* Printable Receipt - Yearly */}
      {selectedStaff && (
        <div className="print:block hidden print:m-0 print:p-0">
          <div className="w-full max-w-[210mm] mx-auto p-6 bg-white text-black font-serif text-sm">
            {/* Header */}
            <div className="text-center border-b-2 border-black pb-3 mb-4">
              <h1 className="text-xl font-bold tracking-wide">KOMBA CABANA</h1>
              <p className="text-xs text-gray-600">Nosy Komba, Madagascar</p>
            </div>
            
            {/* Title */}
            <div className="text-center mb-4">
              <h2 className="text-lg font-bold uppercase tracking-wider mb-1">Potrdilo o prejemu plače {selectedYear}</h2>
              <p className="text-xs text-gray-500">Salary Receipt / Reçu de Salaire</p>
            </div>
            
            {/* Employee Info */}
            <div className="mb-4 space-y-1 text-sm">
              <div className="flex">
                <span className="w-40 text-gray-600">Ime / Name:</span>
                <span className="font-semibold">{selectedStaff.staffName}</span>
              </div>
              <div className="flex">
                <span className="w-40 text-gray-600">Delovno mesto:</span>
                <span className="font-semibold">{staffRole}</span>
              </div>
            </div>
            
            {/* Monthly Table */}
            <table className="w-full border-collapse border-2 border-black mb-4">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-black px-3 py-2 text-left text-xs font-bold">Mesec / Month</th>
                  <th className="border border-black px-3 py-2 text-center text-xs font-bold w-32">Znesek (Ar)</th>
                  <th className="border border-black px-3 py-2 text-center text-xs font-bold w-40">Podpis / Signature</th>
                  <th className="border border-black px-3 py-2 text-center text-xs font-bold w-28">Datum / Date</th>
                </tr>
              </thead>
              <tbody>
                {monthsToShow.map((monthIndex) => (
                  <tr key={monthIndex}>
                    <td className="border border-black px-3 py-3 text-xs">
                      <span className="font-medium">{MONTHS_SL[monthIndex]}</span>
                      <span className="text-gray-500 ml-1">/ {MONTHS_EN[monthIndex]}</span>
                    </td>
                    <td className="border border-black px-3 py-3"></td>
                    <td className="border border-black px-3 py-3"></td>
                    <td className="border border-black px-3 py-3 text-center text-gray-400 text-xs">__/__/____</td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {/* Confirmation Text */}
            <div className="text-xs space-y-0.5 text-gray-600 mt-4">
              <p>S podpisom potrjujem prejem plače za posamezen mesec.</p>
              <p>By signing I confirm receipt of salary for each month.</p>
              <p>Par ma signature, je confirme avoir reçu le salaire pour chaque mois.</p>
            </div>
          </div>
        </div>
      )}

      {/* Preview on screen */}
      {selectedStaff && (
        <div className="print:hidden mx-auto max-w-4xl px-6 pb-8">
          <div className="rounded-2xl border border-white/10 bg-white p-6 text-black font-serif text-sm">
            {/* Header */}
            <div className="text-center border-b-2 border-black pb-3 mb-4">
              <h1 className="text-xl font-bold tracking-wide">KOMBA CABANA</h1>
              <p className="text-xs text-gray-600">Nosy Komba, Madagascar</p>
            </div>
            
            {/* Title */}
            <div className="text-center mb-4">
              <h2 className="text-lg font-bold uppercase tracking-wider mb-1">Potrdilo o prejemu plače {selectedYear}</h2>
              <p className="text-xs text-gray-500">Salary Receipt / Reçu de Salaire</p>
            </div>
            
            {/* Employee Info */}
            <div className="mb-4 space-y-1 text-sm">
              <div className="flex">
                <span className="w-40 text-gray-600">Ime / Name:</span>
                <span className="font-semibold">{selectedStaff.staffName}</span>
              </div>
              <div className="flex">
                <span className="w-40 text-gray-600">Delovno mesto:</span>
                <span className="font-semibold">{staffRole}</span>
              </div>
            </div>
            
            {/* Monthly Table */}
            <table className="w-full border-collapse border-2 border-black mb-4">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-black px-3 py-2 text-left text-xs font-bold">Mesec / Month</th>
                  <th className="border border-black px-3 py-2 text-center text-xs font-bold w-32">Znesek (Ar)</th>
                  <th className="border border-black px-3 py-2 text-center text-xs font-bold w-40">Podpis / Signature</th>
                  <th className="border border-black px-3 py-2 text-center text-xs font-bold w-28">Datum / Date</th>
                </tr>
              </thead>
              <tbody>
                {monthsToShow.map((monthIndex) => (
                  <tr key={monthIndex}>
                    <td className="border border-black px-3 py-3 text-xs">
                      <span className="font-medium">{MONTHS_SL[monthIndex]}</span>
                      <span className="text-gray-500 ml-1">/ {MONTHS_EN[monthIndex]}</span>
                    </td>
                    <td className="border border-black px-3 py-3"></td>
                    <td className="border border-black px-3 py-3"></td>
                    <td className="border border-black px-3 py-3 text-center text-gray-400 text-xs">__/__/____</td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {/* Confirmation Text */}
            <div className="text-xs space-y-0.5 text-gray-600 mt-4">
              <p>S podpisom potrjujem prejem plače za posamezen mesec.</p>
              <p>By signing I confirm receipt of salary for each month.</p>
              <p>Par ma signature, je confirme avoir reçu le salaire pour chaque mois.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
