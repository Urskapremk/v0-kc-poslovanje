'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { clampPrintFrom, monthDate, monthLastDay } from '@/lib/print-from'

export function PrintFromDialog({
  open,
  year,
  month,
  value,
  person,
  onChange,
  onCancel,
  onPrint,
}: {
  open: boolean
  year: number
  month: number
  value: string
  person?: string | null
  onChange: (value: string) => void
  onCancel: () => void
  onPrint: () => void
}) {
  const first = monthDate(year, month, 1)
  const last = monthDate(year, month, monthLastDay(year, month))
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onCancel() }}>
      <DialogContent className="no-print border-[#c59b5b]/40 bg-[#142028] text-[#f6f1e7] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[#f6f1e7]">Od katerega dne naprej?</DialogTitle>
          <DialogDescription className="text-[#f6f1e7]/70">
            {person
              ? `Na papir gre razpored za ${person}, samo od izbranega dne do konca meseca.`
              : 'Na papir gre razpored za vse, samo od izbranega dne do konca meseca.'}
            {' '}Dnevi pred tem datumom se ne natisnejo.
          </DialogDescription>
        </DialogHeader>
        <label className="block text-sm text-[#f6f1e7]/80">
          Od dne
          <input
            type="date"
            min={first}
            max={last}
            value={value}
            onChange={(e) => onChange(clampPrintFrom(e.target.value, year, month))}
            className="mt-1 w-full rounded-xl border border-[#c59b5b]/40 bg-white px-3 py-2 text-[#1a2420]"
          />
        </label>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-white/15 px-4 py-2 text-sm text-[#f6f1e7]/80"
          >
            Prekliči
          </button>
          <button
            type="button"
            onClick={onPrint}
            className="rounded-xl bg-[#c59b5b] px-4 py-2 text-sm font-medium text-[#1a140c]"
          >
            Natisni
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
