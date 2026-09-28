"use client";

import React from "react";

// Two printable letters to the bank (BMOI), one per company account, in English,
// requesting the opening of sub-accounts, signed by Borut Retelj.
// Shared by the standalone /banka-vloga page and the Banka tab in Kalkulacije.
const ACCOUNTS = [
  {
    company: "KOMBA CABANA TOURISM SARL",
    accountNumber: "00026 03002920101 73 MGA",
  },
  {
    company: "KOMBA CABANA SARL",
    accountNumber: "00026 03074120101 87 MGA",
  },
];

export function BankaVlogaLetters() {
  const today = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <>
      {ACCOUNTS.map((acc) => (
        <div
          key={acc.accountNumber}
          className="letter-page mx-auto flex min-h-[240mm] max-w-[210mm] flex-col bg-white px-10 py-8 text-[#1a1a1a]"
        >
          {/* Letterhead */}
          <div className="mb-6 border-b-2 border-[#8fa992] pb-4 text-center">
            <img
              src="/komba-logo-print.png"
              alt="Komba Cabana"
              className="mx-auto mb-2 h-16"
              crossOrigin="anonymous"
            />
            <p className="text-base font-semibold tracking-wide text-[#5c4c38]">
              {acc.company}
            </p>
            <p className="mt-0.5 text-xs text-[#5c4c38]/70">
              Nosy Komba, Nosy Be, Madagascar
            </p>
          </div>

          {/* Date */}
          <p className="mb-5 text-right text-sm">Nosy Be, {today}</p>

          {/* Recipient */}
          <div className="mb-5 text-sm leading-relaxed">
            <p className="font-semibold">To the Management of BMOI</p>
            <p>Banque Malgache de l&apos;Océan Indien</p>
            <p>Nosy Be Branch</p>
            <p>Madagascar</p>
          </div>

          {/* Subject */}
          <p className="mb-4 text-sm">
            <span className="font-semibold">Subject:</span> Request to open
            sub-accounts under our current account
          </p>

          {/* Body */}
          <div className="flex-1 space-y-3 text-sm leading-relaxed">
            <p>Dear,</p>

            <p>
              We are writing to you on behalf of{" "}
              <span className="font-semibold">{acc.company}</span>, holder of the
              current account number{" "}
              <span className="font-semibold">{acc.accountNumber}</span> at your
              institution.
            </p>

            <p>
              We would like to kindly request the opening of sub-accounts linked
              to the above-mentioned main account. These sub-accounts will allow
              us to organise and separate our funds according to their purpose,
              while remaining under the same main account.
            </p>

            <p>
              Thank you in advance for your kind attention to this matter. We look
              forward to your favourable response.
            </p>

            <p>Regards,</p>
          </div>

          {/* Signature */}
          <div className="mt-10 text-sm">
            <div className="mb-1 h-10 w-56 border-b border-[#1a1a1a]/40" />
            <p className="font-semibold">Borut Retelj</p>
            <p className="text-[#5c4c38]/70">Manager — {acc.company}</p>
          </div>
        </div>
      ))}
    </>
  );
}
