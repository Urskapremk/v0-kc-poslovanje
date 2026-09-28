"use client";

import React from "react";
import { BankaVlogaLetters } from "@/components/banka-vloga-letters";

export default function BankaVlogaPage() {
  return (
    <div className="min-h-screen bg-white">
      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 20mm;
          }
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .no-print {
            display: none !important;
          }
          .letter-page {
            page-break-after: always;
          }
          .letter-page:last-child {
            page-break-after: auto;
          }
        }
      `}</style>

      {/* Print button */}
      <div className="no-print fixed top-4 right-4 z-50">
        <button
          onClick={() => window.print()}
          className="rounded-lg bg-[#576f59] px-6 py-3 font-medium text-white shadow-lg transition-colors hover:bg-[#485b4a]"
        >
          Print letters
        </button>
      </div>

      <BankaVlogaLetters />
    </div>
  );
}
