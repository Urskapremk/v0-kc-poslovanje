"use client";

import { Ship, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { bungalowDisplayName } from "@/lib/bungalow";

interface TransferVoucherProps {
  guestName: string;
  date: string;
  time: string;
  route: string;
  passengers: number;
  flightNumber?: string;
  flightTime?: string; // Landing/departure time of flight
  type: "arrival" | "departure";
  bungalow?: string;
}

export function TransferVoucher({
  guestName,
  date,
  time,
  route,
  passengers,
  flightNumber,
  flightTime,
  type,
  bungalow,
}: TransferVoucherProps) {
  const formattedDate = format(new Date(date), "d MMMM yyyy");
  const isAirportTransfer = route?.toLowerCase().includes("airport");

  return (
    <div className="mx-auto max-w-md">
      {/* Voucher Card */}
      <div className="overflow-hidden rounded-2xl border border-[#c59b5b]/30 bg-gradient-to-b from-[#0e1a1f] to-[#071c24] shadow-[0_8px_40px_rgba(0,0,0,0.5)]">
        {/* Header with logo */}
        <div className="border-b border-white/10 bg-gradient-to-r from-[#c59b5b]/10 to-transparent px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.25em] text-[#c59b5b]/60">
                Transfer Voucher
              </p>
              <h1 className="mt-1 font-light tracking-[0.15em] text-[#c59b5b]">
                KOMBA CABANA
              </h1>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#c59b5b]/30 bg-[#c59b5b]/10">
              <Ship className="h-6 w-6 text-[#c59b5b]" />
            </div>
          </div>
        </div>

        {/* Guest Name Section */}
        <div className="border-b border-white/5 px-6 py-5">
          <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/40">
            Guest
          </p>
          <p className="mt-1 text-xl font-light tracking-wide text-white">
            {guestName}
          </p>
          {bungalow && (
            <p className="mt-1 text-sm text-white/50">{bungalow}</p>
          )}
        </div>

        {/* Transfer Details */}
        <div className="space-y-4 px-6 py-5">
          {/* Type Badge */}
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                type === "arrival"
                  ? "bg-[#2a7897]/20 text-[#2a7897]"
                  : "bg-[#7fa8b8]/20 text-[#7fa8b8]"
              }`}
            >
              {type === "arrival" ? "Arrival Transfer" : "Departure Transfer"}
            </span>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/40">
                Date
              </p>
              <p className="mt-1 text-sm text-white">{formattedDate}</p>
            </div>
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/40">
                Time
              </p>
              <p className="mt-1 text-sm text-white">{time || "TBA"}</p>
            </div>
          </div>

          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/40">
              Route
            </p>
            <p className="mt-1 text-sm text-white">{route}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/40">
                Passengers
              </p>
              <p className="mt-1 text-sm text-white">
                {passengers} {passengers === 1 ? "person" : "persons"}
              </p>
            </div>
            {flightNumber && (
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/40">
                  Flight
                </p>
                <p className="mt-1 text-sm text-white">{flightNumber}</p>
              </div>
            )}
          </div>

          {flightTime && (
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/40">
                {type === "arrival" ? "Flight Landing" : "Flight Departure"}
              </p>
              <p className="mt-1 text-sm text-white">{flightTime}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-white/5 bg-white/[0.02] px-6 py-4">
          {type === "arrival" ? (
            <div className="space-y-2">
              {isAirportTransfer && (
                <div className="mb-4 -mx-6 px-6 py-5 bg-gradient-to-t from-white via-white to-transparent">
                  <p className="mb-3 text-[9px] font-semibold uppercase tracking-[0.2em] text-black/50 text-center">Look for our logo at the airport:</p>
                  <div className="flex justify-center">
                    <img src="/logo-resort.png" alt="Komba Cabana Lodge Logo" className="h-14 w-auto" />
                  </div>
                </div>
              )}
              {isAirportTransfer ? (
                <p className="text-[11px] leading-relaxed text-white/50">
                  Our driver will meet you at the airport with the Komba Cabana Lodge logo. 
                  You will be driven to the port of Hell-Ville (Andoany), where a boat will 
                  be waiting to take you directly to Komba Cabana Lodge beach.
                </p>
              ) : (
                <p className="text-[11px] leading-relaxed text-white/50">
                  Our boat will be waiting for you at the port of Hell-Ville (Andoany) 
                  to take you directly to Komba Cabana Lodge beach.
                </p>
              )}
              <p className="text-[10px] text-white/30">
                Please present this voucher upon arrival.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {isAirportTransfer ? (
                <p className="text-[11px] leading-relaxed text-white/50">
                  Our boat will pick you up from Komba Cabana Lodge beach and take you 
                  to the port of Hell-Ville. From there, our driver will take you to the airport.
                </p>
              ) : (
                <p className="text-[11px] leading-relaxed text-white/50">
                  Our boat will pick you up from Komba Cabana Lodge beach and take you 
                  to the port of Hell-Ville (Andoany).
                </p>
              )}
              <p className="text-[10px] text-white/30">
                Please be ready at the lodge reception at the indicated time.
              </p>
            </div>
          )}
          
          {/* Payment info */}
          <div className="mt-4 rounded-lg border border-[#c59b5b]/20 bg-[#c59b5b]/5 px-4 py-3">
            <p className="text-[11px] font-medium text-[#c59b5b]">
              Transfer is payable at checkout during your final bill settlement.
            </p>
          </div>
          
          <p className="mt-3 text-center text-[10px] text-white/30">
            For questions: info@kombacabana.com
          </p>
        </div>
      </div>

      {/* Print-friendly styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .transfer-voucher-print,
          .transfer-voucher-print * {
            visibility: visible;
          }
          .transfer-voucher-print {
            position: absolute;
            left: 0;
            top: 0;
          }
        }
      `}</style>
    </div>
  );
}

// Preview component for the modal
export function TransferVoucherPreview({
  reservation,
  transfer,
  type,
  onClose,
  onSend,
  reservationId,
  transferId,
}: {
  reservation: {
    guestName: string;
    bungalow: string;
    pax: number;
    email?: string | null;
  };
  transfer: {
    date: string;
    time: string;
    route: string;
    flightNumber?: string;
    flightTime?: string;
  };
  type: "arrival" | "departure";
  onClose: () => void;
  onSend: () => void;
  reservationId?: string;
  transferId?: string;
}) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateEmailHTML = () => {
    const formattedDate = format(new Date(transfer.date), "d MMMM yyyy");
    const typeLabel = type === "arrival" ? "Arrival Transfer" : "Departure Transfer";
    const typeColor = type === "arrival" ? "#2a7897" : "#7fa8b8";
    const isAirportTransfer = transfer.route?.toLowerCase().includes("airport");

    // Generate arrival description based on route
    const arrivalDescription = isAirportTransfer
      ? `Our driver will meet you at the airport with the Komba Cabana Lodge logo. 
         You will be driven to the port of Hell-Ville (Andoany), where a boat will 
         be waiting to take you directly to Komba Cabana Lodge beach.`
      : `Our boat will be waiting for you at the port of Hell-Ville (Andoany) 
         to take you directly to Komba Cabana Lodge beach.`;

    // Generate departure description based on route
    const departureDescription = isAirportTransfer
      ? `Our boat will pick you up from Komba Cabana Lodge beach and take you 
         to the port of Hell-Ville. From there, our driver will take you to the airport.`
      : `Our boat will pick you up from Komba Cabana Lodge beach and take you 
         to the port of Hell-Ville (Andoany).`;

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 20px; background-color: #f6f5f4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 420px; margin: 0 auto; background: linear-gradient(180deg, #0e1a1f 0%, #071c24 100%); border-radius: 16px; overflow: hidden; border: 1px solid rgba(197,155,91, 0.3);">
    
    <!-- Header -->
    <div style="padding: 24px; border-bottom: 1px solid rgba(255,255,255,0.1); background: linear-gradient(90deg, rgba(197,155,91, 0.1) 0%, transparent 100%);">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <p style="margin: 0; font-size: 9px; font-weight: 600; letter-spacing: 3px; color: rgba(197,155,91, 0.6); text-transform: uppercase;">Transfer Voucher</p>
            <h1 style="margin: 4px 0 0 0; font-size: 18px; font-weight: 300; letter-spacing: 2px; color: #c59b5b;">KOMBA CABANA</h1>
          </td>
          <td align="right">
            <div style="width: 48px; height: 48px; border-radius: 50%; border: 1px solid rgba(197,155,91, 0.3); background: rgba(197,155,91, 0.1); text-align: center; line-height: 48px;">
              <span style="font-size: 20px;">⛵</span>
            </div>
          </td>
        </tr>
      </table>
    </div>

    <!-- Guest Name -->
    <div style="padding: 20px 24px; border-bottom: 1px solid rgba(255,255,255,0.05);">
      <p style="margin: 0; font-size: 9px; font-weight: 600; letter-spacing: 2px; color: rgba(255,255,255,0.4); text-transform: uppercase;">Guest</p>
      <p style="margin: 4px 0 0 0; font-size: 20px; font-weight: 300; color: #ffffff;">${reservation.guestName}</p>
      ${reservation.bungalow ? `<p style="margin: 4px 0 0 0; font-size: 14px; color: rgba(255,255,255,0.5);">${bungalowDisplayName(reservation.bungalow)}</p>` : ''}
    </div>

    <!-- Transfer Details -->
    <div style="padding: 20px 24px;">
      <!-- Type Badge -->
      <div style="margin-bottom: 16px;">
        <span style="display: inline-block; padding: 6px 12px; border-radius: 20px; background: ${typeColor}20; color: ${typeColor}; font-size: 10px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase;">${typeLabel}</span>
      </div>

      <!-- Date & Time -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 16px;">
        <tr>
          <td width="50%">
            <p style="margin: 0; font-size: 9px; font-weight: 600; letter-spacing: 2px; color: rgba(255,255,255,0.4); text-transform: uppercase;">Date</p>
            <p style="margin: 4px 0 0 0; font-size: 14px; color: #ffffff;">${formattedDate}</p>
          </td>
          <td width="50%">
            <p style="margin: 0; font-size: 9px; font-weight: 600; letter-spacing: 2px; color: rgba(255,255,255,0.4); text-transform: uppercase;">Time</p>
            <p style="margin: 4px 0 0 0; font-size: 14px; color: #ffffff;">${transfer.time || 'TBA'}</p>
          </td>
        </tr>
      </table>

      <!-- Route -->
      <div style="margin-bottom: 16px;">
        <p style="margin: 0; font-size: 9px; font-weight: 600; letter-spacing: 2px; color: rgba(255,255,255,0.4); text-transform: uppercase;">Route</p>
        <p style="margin: 4px 0 0 0; font-size: 14px; color: #ffffff;">${transfer.route}</p>
      </div>

      <!-- Passengers & Flight -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 16px;">
        <tr>
          <td width="50%">
            <p style="margin: 0; font-size: 9px; font-weight: 600; letter-spacing: 2px; color: rgba(255,255,255,0.4); text-transform: uppercase;">Passengers</p>
            <p style="margin: 4px 0 0 0; font-size: 14px; color: #ffffff;">${reservation.pax} ${reservation.pax === 1 ? 'person' : 'persons'}</p>
          </td>
          ${transfer.flightNumber ? `
          <td width="50%">
            <p style="margin: 0; font-size: 9px; font-weight: 600; letter-spacing: 2px; color: rgba(255,255,255,0.4); text-transform: uppercase;">Flight</p>
            <p style="margin: 4px 0 0 0; font-size: 14px; color: #ffffff;">${transfer.flightNumber}</p>
          </td>
          ` : ''}
        </tr>
      </table>

      ${transfer.flightTime ? `
      <!-- Flight Time -->
      <div style="margin-bottom: 16px;">
        <p style="margin: 0; font-size: 9px; font-weight: 600; letter-spacing: 2px; color: rgba(255,255,255,0.4); text-transform: uppercase;">${type === "arrival" ? "Flight Landing" : "Flight Departure"}</p>
        <p style="margin: 4px 0 0 0; font-size: 14px; color: #ffffff;">${transfer.flightTime}</p>
      </div>
      ` : ''}
    </div>

    <!-- Footer -->
    <div style="padding: 20px 24px; border-top: 1px solid rgba(255,255,255,0.05); background: rgba(255,255,255,0.02);">
      ${type === "arrival" && isAirportTransfer ? `
      <!-- Logo for driver identification with gradient -->
      <div style="margin: 0 -24px 16px -24px; padding: 20px 24px; background: linear-gradient(to top, #ffffff 0%, #ffffff 60%, transparent 100%);">
        <p style="margin: 0 0 12px 0; font-size: 10px; font-weight: 600; letter-spacing: 2px; color: rgba(0,0,0,0.4); text-transform: uppercase; text-align: center;">Look for our logo at the airport:</p>
        <div style="text-align: center;">
          <img src="https://v0-kc-poslovanje.vercel.app/logo-resort.png" alt="Komba Cabana Lodge Logo" style="height: 55px; width: auto;" />
        </div>
      </div>
      ` : ''}
      ${type === "arrival" ? `
      <p style="margin: 0; font-size: 11px; line-height: 1.6; color: rgba(255,255,255,0.5);">
        ${arrivalDescription}
      </p>
      <p style="margin: 12px 0 0 0; font-size: 10px; color: rgba(255,255,255,0.3);">
        Please present this voucher upon arrival.
      </p>
      ` : `
      <p style="margin: 0; font-size: 11px; line-height: 1.6; color: rgba(255,255,255,0.5);">
        ${departureDescription}
      </p>
      <p style="margin: 12px 0 0 0; font-size: 10px; color: rgba(255,255,255,0.3);">
        Please be ready at the lodge reception at the indicated time.
      </p>
      `}
      
      <!-- Payment Info -->
      <div style="margin-top: 16px; padding: 12px 16px; border-radius: 8px; border: 1px solid rgba(197,155,91, 0.2); background: rgba(197,155,91, 0.05);">
        <p style="margin: 0; font-size: 11px; font-weight: 500; color: #c59b5b;">
          Transfer is payable at checkout during your final bill settlement.
        </p>
      </div>
      
      <p style="margin: 16px 0 0 0; font-size: 10px; color: rgba(255,255,255,0.3); text-align: center;">For questions: info@kombacabana.com</p>
    </div>
  </div>

  <p style="margin: 20px 0 0 0; font-size: 11px; color: #888; text-align: center;">
    Komba Cabana · Nosy Komba, Madagascar
  </p>
</body>
</html>
    `;
  };

  const handleSend = async () => {
    if (!reservation.email) return;

    setSending(true);
    setError(null);

    try {
      const typeLabel = type === "arrival" ? "Arrival" : "Departure";
      const formattedDate = format(new Date(transfer.date), "d MMM yyyy");

const response = await fetch('/api/gmail/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
  to: reservation.email,
  subject: `Your ${typeLabel} Transfer Confirmation - ${formattedDate} | Komba Cabana`,
  htmlContent: generateEmailHTML(),
  reservationId,
  transferId,
  recipientName: reservation.guestName,
  type: 'transfer_voucher',
  metadata: {
    transferType: type,
    route: transfer.route,
    date: transfer.date,
    time: transfer.time,
    pax: reservation.pax,
  },
  }),
  });

      const data = await response.json();

      if (!response.ok) {
        if (data.needsAuth) {
          setError('Gmail ni povezan. Prosim povezi Gmail v nastavitvah.');
        } else {
          setError(data.error || 'Napaka pri posiljanju.');
        }
        return;
      }

      setSent(true);
      setTimeout(() => {
        onSend();
      }, 1500);
    } catch (err) {
      setError('Napaka pri posiljanju emaila.');
      console.error(err);
    } finally {
      setSending(false);
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0e1a1f] p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-light text-white">Transfer Voucher Preview</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="transfer-voucher-print">
          <TransferVoucher
            guestName={reservation.guestName}
            date={transfer.date}
            time={transfer.time}
            route={transfer.route}
            passengers={reservation.pax}
            flightNumber={transfer.flightNumber}
            type={type}
            bungalow={reservation.bungalow ? bungalowDisplayName(reservation.bungalow) : undefined}
          />
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={() => window.print()}
            className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white/80 transition-colors hover:bg-white/10"
          >
            Print
          </button>
          <button
            onClick={handleSend}
            disabled={!reservation.email || sending || sent}
            className="flex-1 rounded-xl bg-gradient-to-r from-[#c59b5b] to-[#8f6d3a] px-4 py-3 text-sm font-semibold text-[#0a2029] transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Posiljam...
              </>
            ) : sent ? (
              "Poslano!"
            ) : reservation.email ? (
              "Poslji gostu"
            ) : (
              "Ni emaila"
            )}
          </button>
        </div>
        {error && (
          <p className="mt-3 text-center text-sm text-red-400">{error}</p>
        )}
      </div>
    </div>
  );
}
