"use client";

import { useEffect, useState } from "react";
import { getExcursionVoucherData } from "@/app/actions/komba";

export default function VoucherPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const [data, setData] = useState<{
    booking: {
      id: string;
      date: string | null;
      pax: number | null;
      notes: string | null;
    };
    excursion: {
      name: string;
      description: string | null;
      imageUrl: string | null;
    };
    reservation: {
      guestName: string;
      secondGuestName: string | null;
      honeymoon: boolean | null;
      pax: number;
    };
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    params.then(({ bookingId }) => {
      getExcursionVoucherData(bookingId).then((result) => {
        setData(result);
        setLoading(false);
      });
    });
  }, [params]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f2e3a] flex items-center justify-center">
        <div className="text-white/50">Loading...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#0f2e3a] flex items-center justify-center">
        <div className="text-white/50">Voucher not found</div>
      </div>
    );
  }

  const { booking, excursion, reservation } = data;
  const pax = booking.pax || reservation.pax;

  return (
    <div className="min-h-screen bg-[#0f2e3a] p-4">
      <div className="w-full max-w-[900px] mx-auto bg-white rounded-2xl overflow-hidden shadow-2xl">
        {/* Header - compact */}
        <div className="bg-gradient-to-r from-[#0f2e3a] to-[#1c3742] p-4 flex items-center justify-between">
          <img 
            src="/images/komba-logo-gold.png" 
            alt="Komba Cabana" 
            className="h-[60px] w-auto"
          />
          <div className="text-xs tracking-[3px] text-white/60 uppercase">Excursion Voucher</div>
        </div>

        {/* Main content - horizontal layout */}
        <div className="flex flex-col md:flex-row">
          {/* Left - Image */}
          {excursion.imageUrl && (
            <div className="md:w-[300px] h-[200px] md:h-auto flex-shrink-0">
              <img 
                src={excursion.imageUrl} 
                alt={excursion.name} 
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Right - Content */}
          <div className="flex-1 p-5">
            <h1 className="text-xl font-bold text-[#0f2e3a] mb-2">{excursion.name}</h1>
            
            {excursion.description && (
              <p className="text-xs text-[#5b8494] leading-relaxed mb-4 whitespace-pre-line">
                {excursion.description}
              </p>
            )}

            {/* Guest + Info row */}
            <div className="flex flex-wrap gap-3 mb-3">
              {/* Guest */}
              <div className="flex-1 min-w-[180px] bg-gradient-to-br from-[#7fa8b8]/10 to-[#7fa8b8]/5 border border-[#7fa8b8]/30 rounded-xl p-3">
                <div className="text-[9px] tracking-wider uppercase text-[#7fa8b8] mb-1">
                  {reservation.secondGuestName ? 'Guests' : 'Guest'}
                </div>
                <div className="text-sm font-bold text-[#0f2e3a]">
                  {reservation.guestName}
                  {reservation.secondGuestName && (
                    <><br />{reservation.secondGuestName}</>
                  )}
                </div>
                {reservation.honeymoon && (
                  <div className="inline-flex items-center gap-1 bg-gradient-to-r from-[#f2e4d3] to-[#e4c7a3] border border-[#c5873b] rounded-full px-2 py-1 mt-2 text-[#753f2b] text-[10px] font-semibold">
                    <svg viewBox="0 0 24 24" className="w-3 h-3 fill-red-500">
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                    </svg>
                    Honeymoon
                  </div>
                )}
              </div>

              {/* Date */}
              <div className="bg-[#f8f5ef] rounded-xl p-3 min-w-[140px]">
                <div className="text-[9px] tracking-wider uppercase text-[#9dafb5] mb-1">Date</div>
                <div className="text-sm font-semibold text-[#0f2e3a]">
                  {booking.date 
                    ? new Date(booking.date).toLocaleDateString('en-GB', { 
                        weekday: 'short', 
                        day: 'numeric', 
                        month: 'short', 
                        year: 'numeric' 
                      }) 
                    : 'TBC'}
                </div>
              </div>

              {/* Guests count */}
              <div className="bg-[#f8f5ef] rounded-xl p-3 min-w-[80px]">
                <div className="text-[9px] tracking-wider uppercase text-[#9dafb5] mb-1">Guests</div>
                <div className="text-sm font-semibold text-[#0f2e3a]">
                  {pax} {pax === 1 ? 'person' : 'people'}
                </div>
              </div>
            </div>

            {/* Notes */}
            {booking.notes && (
              <div className="bg-[#faf6f0] border border-[#d5a974] rounded-lg p-2 text-xs text-[#633524]">
                <span className="font-semibold">Note:</span> {booking.notes}
              </div>
            )}
          </div>
        </div>

        {/* Footer - compact */}
        <div className="bg-[#f8f5ef] border-t border-[#e8e3d9] px-4 py-2 text-center">
          <div className="text-[10px] text-[#9dafb5]">Thank you for choosing Komba Cabana. Enjoy your adventure!</div>
        </div>
      </div>
    </div>
  );
}
