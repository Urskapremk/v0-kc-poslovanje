'use client'

import useSWR from 'swr'
import { LogIn, RefreshCw, User } from 'lucide-react'
import { getStaffLogins, getStaffLoginSummary } from '@/app/actions/payroll'

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleString('sl-SI', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const ROLE_LABEL: Record<string, string> = {
  bar: 'Bar',
  admin: 'Admin',
  reception: 'Recepcija',
}

export function StaffLoginsTab() {
  const { data: logins, mutate: mutateLogins, isLoading } = useSWR(
    'staff-logins',
    () => getStaffLogins(200),
    { refreshInterval: 0 },
  )
  const { data: summary, mutate: mutateSummary } = useSWR(
    'staff-logins-summary',
    () => getStaffLoginSummary(),
    { refreshInterval: 0 },
  )

  const refresh = () => {
    mutateLogins()
    mutateSummary()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <LogIn className="h-5 w-5 text-[#8fae92]" />
            Prijave v bar blagajno
          </h2>
          <p className="text-sm text-white/50 mt-0.5">
            Kdo in kdaj se je prijavil s svojo kodo. Vsak naj uporablja SVOJ PIN.
          </p>
        </div>
        <button
          onClick={refresh}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium bg-white/5 text-white/70 hover:bg-white/10 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Osveži
        </button>
      </div>

      {/* Povzetek po delavcu */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {(summary ?? []).map((s) => (
          <div
            key={(s.staffName ?? 'neznano') + (s.role ?? '')}
            className="rounded-xl border border-white/10 bg-white/5 p-4"
          >
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-full bg-[#8fae92]/15 flex items-center justify-center">
                <User className="h-4 w-4 text-[#8fae92]" />
              </div>
              <div className="min-w-0">
                <p className="text-white font-medium truncate">{s.staffName ?? 'Neznano'}</p>
                <p className="text-[11px] text-white/40">{s.role ? ROLE_LABEL[s.role] ?? s.role : ''}</p>
              </div>
            </div>
            <div className="mt-3 flex items-end justify-between">
              <div>
                <p className="text-2xl font-semibold text-[#c59b5b]">{s.count}</p>
                <p className="text-[11px] text-white/40">prijav</p>
              </div>
              <p className="text-[11px] text-white/50 text-right">
                Zadnja:
                <br />
                {formatDateTime(s.lastAt)}
              </p>
            </div>
          </div>
        ))}
        {summary && summary.length === 0 && (
          <p className="text-sm text-white/40 col-span-full">Zaenkrat še ni zabeleženih prijav.</p>
        )}
      </div>

      {/* Zgodovina prijav */}
      <div className="rounded-xl border border-white/10 overflow-hidden">
        <div className="px-4 py-3 bg-white/5 border-b border-white/10">
          <p className="text-sm font-medium text-white/80">Zgodovina prijav (zadnjih 200)</p>
        </div>
        <div className="divide-y divide-white/5">
          {isLoading && <p className="px-4 py-4 text-sm text-white/40">Nalagam…</p>}
          {(logins ?? []).map((l) => (
            <div key={l.id} className="px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <LogIn className="h-4 w-4 text-white/30 shrink-0" />
                <span className="text-white truncate">{l.staffName ?? 'Neznano'}</span>
                {l.role && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/50">
                    {ROLE_LABEL[l.role] ?? l.role}
                  </span>
                )}
              </div>
              <span className="text-xs text-white/50 whitespace-nowrap">{formatDateTime(l.loggedInAt)}</span>
            </div>
          ))}
          {logins && logins.length === 0 && !isLoading && (
            <p className="px-4 py-4 text-sm text-white/40">Zaenkrat še ni zabeleženih prijav.</p>
          )}
        </div>
      </div>
    </div>
  )
}
