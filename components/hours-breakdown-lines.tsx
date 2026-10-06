'use client'

import type { HoursBreakdown } from '@/lib/work-hours'

// Compact per-worker hours breakdown shown inside the stats card:
// regular work / Sunday work / holiday work / leave. Sunday & holiday lines are
// highlighted when > 0 so they stand out for payroll.
export function HoursBreakdownLines({ b }: { b: HoursBreakdown }) {
  return (
    <div className="mt-2 space-y-1 border-t border-white/10 pt-2 text-[11px]">
      <Row label="Redno delo" value={`${b.regularHours} ur`} muted />
      <Row
        label="Delo v nedeljo"
        value={`${b.sundayHours} ur`}
        accent={b.sundayHours > 0 ? 'text-[#7fa8b8]' : undefined}
      />
      <Row
        label="Delo na praznik"
        value={`${b.holidayHours} ur`}
        accent={b.holidayHours > 0 ? 'text-[#c48872]' : undefined}
      />
      <Row
        label="Dopust"
        value={`${b.leaveDays} dni`}
        accent={b.leaveDays > 0 ? 'text-[#cc8e77]' : undefined}
      />
      {(b.sickDays ?? 0) > 0 && (
        <Row
          label="Bolniška (100%)"
          value={`${b.sickDays} dni`}
          accent="text-[#d4c4ea]"
        />
      )}
    </div>
  )
}

function Row({
  label,
  value,
  muted,
  accent,
}: {
  label: string
  value: string
  muted?: boolean
  accent?: string
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className={accent ?? (muted ? 'text-white/40' : 'text-white/50')}>{label}</span>
      <span className={`font-medium ${accent ?? 'text-white/70'}`}>{value}</span>
    </div>
  )
}
