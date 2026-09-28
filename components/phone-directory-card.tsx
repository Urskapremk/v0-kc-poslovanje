'use client'

import useSWR from 'swr'
import { Phone, BookUser, Printer } from 'lucide-react'
import { getPhoneContacts } from '@/app/actions/phone-contacts'

/** Madagascar številko pretvori v mednarodno tel: obliko (+261, brez vodilne 0). */
function toDialHref(number: string): string {
  const cleaned = number.replace(/[^\d+]/g, '')
  if (cleaned.startsWith('+')) return `tel:${cleaned}`
  if (cleaned.startsWith('261')) return `tel:+${cleaned}`
  if (cleaned.startsWith('0')) return `tel:+261${cleaned.slice(1)}`
  return `tel:${cleaned}`
}

export default function PhoneDirectoryCard() {
  const { data: contacts, isLoading } = useSWR(['phone-contacts'], () => getPhoneContacts())
  const list = contacts ?? []

  return (
    <div className="mx-auto max-w-md">
      <style jsx global>{`
        @media print {
          @page { size: A4; margin: 18mm; }
          body * { visibility: hidden !important; }
          .phone-print-root, .phone-print-root * { visibility: visible !important; }
          .phone-print-root { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="no-print mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BookUser className="h-5 w-5 text-[#8fae92]" />
          <h2 className="text-lg font-semibold text-white">Telefonski imenik</h2>
        </div>
        {list.length > 0 && (
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-lg bg-[#8fae92]/15 px-3 py-2 text-xs font-medium text-[#8fae92] transition-colors hover:bg-[#8fae92]/25"
          >
            <Printer className="h-4 w-4" /> Natisni imenik
          </button>
        )}
      </div>
      <p className="no-print mb-4 text-sm text-white/50">
        Klikni stik za klic. Številke se urejajo v Orange Money imeniku.
      </p>

      {/* Tiskljiva različica (bela podlaga) — vidna samo pri tisku */}
      <div className="phone-print-root hidden print:block">
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#111', marginBottom: '4px' }}>
          Telefonski imenik
        </h1>
        <p style={{ fontSize: '12px', color: '#555', marginBottom: '16px' }}>Komba Cabana</p>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', color: '#111' }}>
          <tbody>
            {list.map((c) => (
              <tr key={c.id} style={{ borderBottom: '1px solid #ddd' }}>
                <td style={{ padding: '8px 4px', fontWeight: 600 }}>{c.name}</td>
                <td style={{ padding: '8px 4px', textAlign: 'right', whiteSpace: 'nowrap' }}>{c.number}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isLoading ? (
        <p className="no-print py-8 text-center text-sm text-white/30">Nalaganje …</p>
      ) : list.length === 0 ? (
        <p className="no-print py-8 text-center text-sm text-white/30">Imenik je prazen.</p>
      ) : (
        <div className="no-print grid grid-cols-1 gap-3 sm:grid-cols-2">
          {list.map((c) => (
            <a
              key={c.id}
              href={toDialHref(c.number)}
              className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition-colors hover:border-[#8fae92]/40 hover:bg-[#8fae92]/10"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#8fae92]/15 text-[#8fae92]">
                <Phone className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-base font-medium text-white">{c.name}</span>
                <span className="block truncate text-sm text-white/45">{c.number}</span>
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
