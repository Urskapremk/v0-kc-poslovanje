import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function safe(error: unknown) {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
  const stack = error instanceof Error ? (error.stack || '').split('\n').slice(0, 8).join('\n') : ''
  return {
    message: message.replace(/postgres(?:ql)?:\/\/\S+/gi, 'postgres://***').slice(0, 800),
    stack: stack.replace(/postgres(?:ql)?:\/\/\S+/gi, 'postgres://***').slice(0, 800),
  }
}

export async function GET(request: Request) {
  const year = Number(new URL(request.url).searchParams.get('year') || '2026')
  const out: Record<string, unknown> = { year }
  try {
    const mod = await import('@/app/actions/sarl-bank-invoices')
    out.sarl = await mod.getSarlBankInvoices(year)
  } catch (error) {
    out.sarl = safe(error)
  }
  try {
    const stats = await import('@/app/actions/statistics')
    const monthly = await stats.getMonthlyStatistics(year, 11)
    out.stats = { ok: true, revenue: monthly?.revenue?.total ?? null }
  } catch (error) {
    out.stats = safe(error)
  }
  return NextResponse.json(out)
}
