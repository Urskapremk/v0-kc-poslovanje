'use server'

import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import {
  computeAttendanceSummary,
  computeNorm,
  MONTHLY_NORM_HOURS,
  LEAVE_DAY_HOURS,
  formatHours,
  WEEKDAYS_SL_SHORT,
  type AttendanceMonth,
  type AttendanceStatus,
  type AttendanceSummary,
} from '@/lib/attendance'

const MONTHS_SL = [
  'januar', 'februar', 'marec', 'april', 'maj', 'junij',
  'julij', 'avgust', 'september', 'oktober', 'november', 'december',
]

function getPublicBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
  return 'https://www.kombacabana.app'
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

type ReportData = {
  staffName: string
  year: number
  month: number
  summary: AttendanceSummary
}

async function buildReportData(
  staffId: string,
  year: number,
  month: number,
): Promise<ReportData | { error: string }> {
  const staffRes = await db.execute(
    sql`SELECT "staffName" FROM staff_members WHERE id = ${staffId} LIMIT 1`
  )
  if (staffRes.rows.length === 0) return { error: 'Delavec ni najden.' }
  const staffName = (staffRes.rows[0].staffName as string) || 'Delavec'

  const daysRes = await db.execute(
    sql`SELECT day, status, "from", "to", "breakMinutes" FROM attendance_days WHERE "staffId" = ${staffId} AND year = ${year} AND month = ${month}`
  )
  const entries: AttendanceMonth = {}
  for (const r of daysRes.rows) {
    entries[r.day as number] = {
      status: ((r.status as string) || 'work') as AttendanceStatus,
      from: (r.from as string) ?? null,
      to: (r.to as string) ?? null,
      breakMinutes: Number(r.breakMinutes ?? 0),
    }
  }
  const summary = computeAttendanceSummary(entries, year, month)

  return { staffName, year, month, summary }
}

// ===== Skupni obračun za računovodstvo (vsi redno zaposleni) =====

type EmployeeExtract = {
  staffName: string
  sunday: { day: number; hours: number }[]
  sundayHours: number
  holiday: { day: number; name: string; hours: number }[]
  holidayHours: number
  leave: number[]
}

async function buildCombinedData(
  year: number,
  month: number,
): Promise<{ employees: EmployeeExtract[] } | { error: string }> {
  const staffRes = await db.execute(
    sql`SELECT id, "staffName", "firstName", "lastName" FROM staff_members WHERE "isRegularEmployee" = true ORDER BY "staffName"`
  )
  if (staffRes.rows.length === 0) return { error: 'Ni rednih zaposlenih.' }

  const employees: EmployeeExtract[] = []
  for (const s of staffRes.rows) {
    const staffId = s.id as string
    // Pravo ime: ime + priimek iz osebnih podatkov; sicer okrajšava (staffName)
    const first = ((s.firstName as string) || '').trim()
    const last = ((s.lastName as string) || '').trim()
    const fullName = [first, last].filter(Boolean).join(' ').trim() || (s.staffName as string) || 'Delavec'
    const daysRes = await db.execute(
      sql`SELECT day, status, "from", "to", "breakMinutes" FROM attendance_days WHERE "staffId" = ${staffId} AND year = ${year} AND month = ${month}`
    )
    const entries: AttendanceMonth = {}
    for (const r of daysRes.rows) {
      entries[r.day as number] = {
        status: ((r.status as string) || 'work') as AttendanceStatus,
        from: (r.from as string) ?? null,
        to: (r.to as string) ?? null,
        breakMinutes: Number(r.breakMinutes ?? 0),
      }
    }
    const summary = computeAttendanceSummary(entries, year, month)
    employees.push({
      staffName: fullName,
      sunday: summary.rows.filter((r) => r.kind === 'sunday' && r.hours > 0).map((r) => ({ day: r.day, hours: r.hours })),
      sundayHours: summary.sundayHours,
      holiday: summary.rows
        .filter((r) => r.kind === 'holiday' && r.hours > 0)
        .map((r) => ({ day: r.day, name: r.holidayName || 'praznik', hours: r.hours })),
      holidayHours: summary.holidayHours,
      leave: summary.rows.filter((r) => r.status === 'leave').map((r) => r.day),
    })
  }
  return { employees }
}

const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function buildCombinedHtml(employees: EmployeeExtract[], year: number, month: number): string {
  const period = `${MONTHS_EN[month - 1]} ${year}`
  const logo = `${getPublicBaseUrl()}/images/komba-logo-gold.png`
  const d = (day: number) => `${MONTHS_EN[month - 1].slice(0, 3)} ${day}`
  const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`

  const line = (label: string, valueHtml: string, datesHtml: string, accent: string) =>
    `<tr>
      <td style="padding:8px 0;color:${accent};vertical-align:top;width:34%;font-size:13px;">${label}</td>
      <td style="padding:8px 0;text-align:right;color:#e8e3d9;font-size:13px;">
        <span style="font-weight:700;">${valueHtml}</span>
        ${datesHtml ? `<br/><span style="color:#9dafb5;font-size:12px;">${datesHtml}</span>` : ''}
      </td>
    </tr>`

  const blocks = employees
    .map((emp) => {
      const sundayDates = emp.sunday.length
        ? emp.sunday.map((x) => `${d(x.day)} (${formatHours(x.hours)})`).join(', ')
        : ''
      const holidayDates = emp.holiday.length
        ? emp.holiday.map((x) => `${d(x.day)} ${escapeHtml(x.name)} (${formatHours(x.hours)})`).join(', ')
        : ''
      const leaveDates = emp.leave.length ? emp.leave.map((x) => d(x)).join(', ') : ''
      return `<div style="background:#12232a;border:1px solid #21343c;border-radius:12px;padding:14px 16px;margin-bottom:16px;">
        <h2 style="color:#c59b5b;font-size:16px;margin:0 0 6px;border-bottom:1px solid #2b3e45;padding-bottom:8px;">${escapeHtml(emp.staffName)}</h2>
        <table style="width:100%;border-collapse:collapse;">
          ${line('Sunday work', emp.sunday.length ? `${formatHours(emp.sundayHours)} · ${days(emp.sunday.length)}` : '—', sundayDates, '#8ec6dc')}
          ${line('Public holiday work', emp.holiday.length ? `${formatHours(emp.holidayHours)} · ${days(emp.holiday.length)}` : '—', holidayDates, '#d09f63')}
          ${line('Annual leave', emp.leave.length ? days(emp.leave.length) : '—', leaveDates, '#8fae92')}
        </table>
      </div>`
    })
    .join('')

  return `<!doctype html>
<html><body style="margin:0;background:#0a2029;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:640px;margin:0 auto;padding:28px 20px;">
    <div style="text-align:center;margin-bottom:20px;">
      <img src="${logo}" alt="Komba Cabana" width="120" style="max-width:120px;height:auto;" />
    </div>
    <h1 style="color:#c59b5b;font-size:20px;margin:0 0 4px;text-align:center;">Working hours — employees</h1>
    <p style="color:#9dafb5;font-size:14px;margin:0 0 24px;text-align:center;">${period}</p>
    <div style="background:#143a49;border:1px solid #1d4a5c;border-left:3px solid #c59b5b;border-radius:10px;padding:14px 16px;margin-bottom:20px;">
      <p style="color:#e8e3d9;font-size:13px;line-height:1.6;margin:0;">
        The basis for payroll is the minimum wage plus the allowances the employee is entitled to.
        For employees who have been with us for more than 3 years, please apply the length-of-service
        (seniority) allowance and accordingly increase the salary by the legally prescribed percentage.
        All of this must be visible on the payslip that the employee receives.
      </p>
    </div>
    ${blocks}
    <p style="color:#8ec6dc;font-size:12px;margin:20px 0 0;text-align:center;">
      Note: Sunday and public holiday work is entitled to a bonus. Annual leave is listed with dates.
    </p>
  </div>
</body></html>`
}

const STATUS_LABEL: Record<string, string> = {
  work: 'Delo',
  leave: 'Dopust',
  off: 'Prosto',
}

function buildReportHtml(data: ReportData): string {
  const { staffName, year, month, summary } = data
  const period = `${MONTHS_SL[month - 1]} ${year}`
  const logo = `${getPublicBaseUrl()}/images/komba-logo-gold.png`

  const rowsHtml = summary.rows
    .map((r) => {
      const marker = r.holidayName
        ? `<span style="color:#c9a79b;font-size:11px;"> · ${escapeHtml(r.holidayName)}</span>`
        : r.isSunday
          ? '<span style="color:#8ec6dc;font-size:11px;"> · nedelja</span>'
          : ''
      const bg = r.holidayName ? '#2a211e' : r.isSunday ? '#143a49' : 'transparent'
      const statusTxt = r.status ? STATUS_LABEL[r.status] : '—'
      const time = r.status === 'work' && r.from && r.to ? `${r.from}–${r.to}` : ''
      const hrs =
        r.kind === 'holiday'
          ? `<span style="color:#d09f63;font-weight:600;">${formatHours(r.hours)}</span>`
          : r.kind === 'sunday'
            ? `<span style="color:#8ec6dc;font-weight:600;">${formatHours(r.hours)}</span>`
            : r.hours > 0
              ? formatHours(r.hours)
              : ''
      return `<tr style="background:${bg};">
        <td style="padding:4px 8px;border-bottom:1px solid #233339;color:#c9d1cf;">${r.day}. ${WEEKDAYS_SL_SHORT[r.weekday]}${marker}</td>
        <td style="padding:4px 8px;border-bottom:1px solid #233339;color:#9dafb5;">${statusTxt}</td>
        <td style="padding:4px 8px;border-bottom:1px solid #233339;color:#9dafb5;">${time}</td>
        <td style="padding:4px 8px;border-bottom:1px solid #233339;text-align:right;color:#e8e3d9;">${hrs}</td>
      </tr>`
    })
    .join('')

  const sumRow = (label: string, value: string, accent?: string) =>
    `<tr>
      <td style="padding:6px 10px;color:#c9d1cf;">${label}</td>
      <td style="padding:6px 10px;text-align:right;font-weight:700;color:${accent || '#c59b5b'};">${value}</td>
    </tr>`

  return `<!doctype html>
<html><body style="margin:0;background:#0a2029;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:640px;margin:0 auto;padding:28px 20px;">
    <div style="text-align:center;margin-bottom:20px;">
      <img src="${logo}" alt="Komba Cabana" width="120" style="max-width:120px;height:auto;" />
    </div>
    <h1 style="color:#c59b5b;font-size:20px;margin:0 0 4px;text-align:center;">Obračun ur — prisotnost</h1>
    <p style="color:#9dafb5;font-size:14px;margin:0 0 24px;text-align:center;">
      ${escapeHtml(staffName)} · ${period}
    </p>

    <div style="background:#12232a;border:1px solid #21343c;border-radius:12px;padding:8px 12px;margin-bottom:24px;">
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        ${sumRow('Navadni delovni dnevi', `${summary.normalDays} dni · ${formatHours(summary.normalHours)}`)}
        ${summary.sundayDays > 0 ? sumRow('Delo v nedeljo (dodatek)', `${summary.sundayDays} dni · ${formatHours(summary.sundayHours)}`, '#8ec6dc') : ''}
        ${sumRow('Delo na praznik (dodatek)', `${summary.holidayDays} dni · ${formatHours(summary.holidayHours)}`, '#d09f63')}
        ${sumRow('Dopust', `${summary.leaveDays} dni`, '#8fae92')}
        ${sumRow('Prosti dnevi (beleženi)', `${summary.offDays} dni`, '#9dafb5')}
        <tr><td colspan="2" style="border-top:1px solid #2b3e45;padding-top:2px;"></td></tr>
        ${sumRow('SKUPAJ opravljeno', `${summary.totalWorkDays} dni · ${formatHours(summary.totalWorkHours)}`)}
      </table>
    </div>

    ${(() => {
      const norm = computeNorm(summary)
      const manjka = norm.diff < -0.005
      const badgeColor = manjka ? '#bc7d67' : '#8fae92'
      const badgeText = manjka ? `Manjka ${formatHours(Math.abs(norm.diff))}` : `Presežek ${formatHours(norm.diff)}`
      return `<div style="background:#12232a;border:1px solid #21343c;border-radius:12px;padding:12px;margin-bottom:24px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <span style="color:#9dafb5;font-size:12px;">Norma ${MONTHLY_NORM_HOURS.toFixed(2).replace('.', ',')} h/mesec · dopust = ${LEAVE_DAY_HOURS} h/dan</span>
          <span style="color:${badgeColor};font-weight:700;font-size:13px;">${badgeText}</span>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          ${sumRow('Opravljeno', formatHours(norm.workHours), '#e8e3d9')}
          ${sumRow(`Dopust (${norm.leaveDays} × ${LEAVE_DAY_HOURS} h)`, formatHours(norm.leaveHours), '#8fae92')}
          ${sumRow('Skupaj priznano', formatHours(norm.creditedHours), '#c59b5b')}
          ${sumRow('Norma', formatHours(norm.norm), '#9dafb5')}
        </table>
      </div>`
    })()}

    <h2 style="color:#c9d1cf;font-size:15px;margin:0 0 8px;">Dnevna razčlenitev</h2>
    <table style="width:100%;border-collapse:collapse;font-size:13px;background:#0b2731;border:1px solid #21343c;border-radius:8px;overflow:hidden;">
      <thead>
        <tr style="background:#123543;">
          <th style="padding:6px 8px;text-align:left;color:#9dafb5;font-weight:600;">Dan</th>
          <th style="padding:6px 8px;text-align:left;color:#9dafb5;font-weight:600;">Status</th>
          <th style="padding:6px 8px;text-align:left;color:#9dafb5;font-weight:600;">Čas</th>
          <th style="padding:6px 8px;text-align:right;color:#9dafb5;font-weight:600;">Ure</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>

    <p style="color:#8ec6dc;font-size:12px;margin:20px 0 0;text-align:center;">
      Opomba: delo v nedeljo in na praznik je upravičeno do dodatka.
    </p>
  </div>
</body></html>`
}

// Predogled emaila (HTML) + prejemnik (nastavljen v env / prazen).
export async function getAttendanceReportPreview(
  staffId: string,
  year: number,
  month: number,
): Promise<{ html?: string; staffName?: string; to?: string; error?: string }> {
  const built = await buildReportData(staffId, year, month)
  if ('error' in built) return { error: built.error }
  return {
    html: buildReportHtml(built),
    staffName: built.staffName,
    to: process.env.ACCOUNTING_EMAIL || '',
  }
}

// Poslji obracun ur racunovodstvu prek Resend (brez priloge).
export async function sendAttendanceReport(
  staffId: string,
  year: number,
  month: number,
  toEmail: string,
): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { success: false, error: 'E-pošta še ni nastavljena (manjka RESEND_API_KEY).' }

  const to = (toEmail || '').trim()
  if (!to) return { success: false, error: 'Vpiši email naslov računovodstva.' }

  const built = await buildReportData(staffId, year, month)
  if ('error' in built) return { success: false, error: built.error }

  const html = buildReportHtml(built)
  const from = process.env.EMAIL_FROM || 'Komba Cabana <info@kombacabana.app>'
  const period = `${MONTHS_SL[month - 1]} ${year}`
  const subject = `Obračun ur — ${built.staffName} (${period})`

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html,
      }),
    })
    if (!resp.ok) {
      const detail = await resp.text()
      return { success: false, error: `Pošiljanje ni uspelo: ${detail.slice(0, 200)}` }
    }
    await logAccountingEmail({
      type: 'attendance',
      recipient: to,
      subject,
      staffId,
      staffName: built.staffName,
      year,
      month,
      html,
    })
    return { success: true }
  } catch (e) {
    return { success: false, error: `Napaka pri pošiljanju: ${(e as Error).message}` }
  }
}

// Predogled SKUPNEGA obračuna (vsi redno zaposleni) za računovodstvo.
export async function getCombinedReportPreview(
  year: number,
  month: number,
): Promise<{ html?: string; to?: string; error?: string }> {
  const built = await buildCombinedData(year, month)
  if ('error' in built) return { error: built.error }
  return {
    html: buildCombinedHtml(built.employees, year, month),
    to: process.env.ACCOUNTING_EMAIL || '',
  }
}

// Pošlji SKUPNI obračun (vsi redno zaposleni) računovodstvu prek Resend.
export async function sendCombinedReport(
  year: number,
  month: number,
  toEmail: string,
): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { success: false, error: 'E-pošta še ni nastavljena (manjka RESEND_API_KEY).' }

  const to = (toEmail || '').trim()
  if (!to) return { success: false, error: 'Vpiši email naslov računovodstva.' }

  const built = await buildCombinedData(year, month)
  if ('error' in built) return { success: false, error: built.error }

  const html = buildCombinedHtml(built.employees, year, month)
  const from = process.env.EMAIL_FROM || 'Komba Cabana <info@kombacabana.app>'
  const period = `${MONTHS_EN[month - 1]} ${year}`
  const subject = `Working hours — employees (${period})`

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, html }),
    })
    if (!resp.ok) {
      const detail = await resp.text()
      return { success: false, error: `Pošiljanje ni uspelo: ${detail.slice(0, 200)}` }
    }
    await logAccountingEmail({
      type: 'attendance-combined',
      recipient: to,
      subject,
      staffName: 'Vsi zaposleni',
      year,
      month,
      html,
    })
    return { success: true }
  } catch (e) {
    return { success: false, error: `Napaka pri pošiljanju: ${(e as Error).message}` }
  }
}

// ---- Pregled poslanih emailov računovodstvu ----

export type AccountingEmailType = 'attendance' | 'attendance-combined'

export interface AccountingEmailRecord {
  id: string
  type: string
  recipient: string
  subject: string
  staffId: string | null
  staffName: string | null
  year: number
  month: number
  sentAt: string
}

// Zabeleži uspešno poslan email računovodstvu. Nikoli ne vrže (beleženje ne sme prekiniti pošiljanja).
async function logAccountingEmail(entry: {
  type: AccountingEmailType
  recipient: string
  subject: string
  staffId?: string | null
  staffName?: string | null
  year: number
  month: number
  html?: string | null
}): Promise<void> {
  try {
    const id = `acc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    await db.execute(sql`
      INSERT INTO accounting_emails (id, type, recipient, subject, "staffId", "staffName", year, month, html)
      VALUES (${id}, ${entry.type}, ${entry.recipient}, ${entry.subject},
              ${entry.staffId ?? null}, ${entry.staffName ?? null}, ${entry.year}, ${entry.month}, ${entry.html ?? null})
    `)
  } catch (e) {
    console.log('[v0] logAccountingEmail failed:', (e as Error).message)
  }
}

// Pregled poslanih emailov računovodstvu (najnovejši najprej).
export async function getAccountingEmails(limit = 200): Promise<AccountingEmailRecord[]> {
  const res = await db.execute(sql`
    SELECT id, type, recipient, subject, "staffId", "staffName", year, month, "sentAt"
    FROM accounting_emails ORDER BY "sentAt" DESC LIMIT ${limit}
  `)
  return res.rows.map((r) => ({
    id: r.id as string,
    type: r.type as string,
    recipient: r.recipient as string,
    subject: r.subject as string,
    staffId: (r.staffId as string | null) ?? null,
    staffName: (r.staffName as string | null) ?? null,
    year: Number(r.year),
    month: Number(r.month),
    sentAt: (r.sentAt instanceof Date ? r.sentAt : new Date(r.sentAt as unknown as string)).toISOString(),
  }))
}

// Vrne shranjeno HTML vsebino poslanega emaila (za predogled). Starejši zapisi (pred to funkcijo) je nimajo.
export async function getAccountingEmailHtml(id: string): Promise<{ html: string | null }> {
  const res = await db.execute(sql`SELECT html FROM accounting_emails WHERE id = ${id}`)
  return { html: (res.rows[0]?.html as string | null) ?? null }
}

// Izbriši zapis iz dnevnika poslanih emailov računovodstvu.
export async function deleteAccountingEmail(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    await db.execute(sql`DELETE FROM accounting_emails WHERE id = ${id}`)
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
