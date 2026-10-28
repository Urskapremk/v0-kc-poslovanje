'use client'

import type { CompanyId } from '@/lib/payroll'
import { PREQUALIFICATION_ROWS, prequalificationValue } from '@/lib/prequalification-form'

export default function PrequalificationForm({ company }: { company: CompanyId }) {
  return (
    <div className="mt-4 border-t border-white/[0.08] pt-4">
      <div className="grid grid-cols-2 gap-3 text-[9px] font-semibold uppercase tracking-[0.18em] text-[#9dafb5]/70">
        <span>Français</span>
        <span>Slovenščina</span>
      </div>
      <div className="mt-2">
        {PREQUALIFICATION_ROWS.map((row, index) => {
          if (row.type === 'section') {
            return (
              <div key={`s-${index}`} className="mt-4 grid grid-cols-1 gap-1 sm:grid-cols-2 sm:gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#e8c88a]">{row.fr}</p>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#c59b5b]/80">{row.sl}</p>
              </div>
            )
          }
          if (row.type === 'columns') {
            return (
              <div key={`c-${index}`} className="mt-3 grid grid-cols-1 gap-2 border-t border-white/[0.06] pt-2 sm:grid-cols-2 sm:gap-3">
                <div>
                  {row.fr.map((label) => (
                    <p key={label} className="text-[11px] text-white/70">{label}</p>
                  ))}
                </div>
                <div>
                  {row.sl.map((label) => (
                    <p key={label} className="text-[11px] text-[#9dafb5]">{label}</p>
                  ))}
                </div>
              </div>
            )
          }
          const value = prequalificationValue(company, row.id)
          return (
            <div key={row.id} className="mt-3 border-t border-white/[0.06] pt-2">
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 sm:gap-3">
                <p className="text-[12px] leading-snug text-[#f8f5ef]">{row.fr}</p>
                <p className="text-[12px] leading-snug text-[#9dafb5]">{row.sl}</p>
              </div>
              <p className="mt-1 min-h-[1.25rem] text-[13px] text-[#e8c88a]">{value}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
