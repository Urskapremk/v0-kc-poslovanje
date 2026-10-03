'use server'

import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { get } from '@vercel/blob'
import { parseCategories, type CategoryAllocation } from '@/lib/stroski-categories'
import { splitReceiptTranslation, supplierFromTranslation } from '@/lib/receipt-split'
import { readReceiptFromImages } from '@/lib/receipt-ocr'
import { getExchangeRate } from './komba'
import { addCashExpense, deleteCashExpense, getBankTransactions } from './banka'
import { getOmTransactions, addOmTransaction, deleteOmTransaction } from './orange-money'
import { getOmTransfers } from './om-transfers'

export type ReceiptPage = {
  pathname: string
  fileName: string | null
}

export type Currency = 'EUR' | 'Ar'

export type StroskiReceipt = {
  id: string
  year: number
  month: number
  date: string
  description: string
  amountEur: number
  currency: Currency
  amountOriginal: number
  categories: CategoryAllocation[]
  pathname: string
  fileName: string | null
  pages: ReceiptPage[]
  translation: string
  sentToAccountingAt: string | null
  paymentMethod: PaymentMethod | null
  cashLedgerId: string | null
  createdAt: string | null
}

export type PaymentMethod = 'card' | 'orange_money' | 'cash'

// Varno razčleni seznam strani (jsonb). Če je prazen, uporabi glavni pathname kot prvo stran.
function parsePages(raw: unknown, fallbackPathname: string, fallbackName: string | null): ReceiptPage[] {
  let arr: unknown = raw
  if (typeof raw === 'string') {
    try {
      arr = JSON.parse(raw)
    } catch {
      arr = []
    }
  }
  const pages: ReceiptPage[] = Array.isArray(arr)
    ? arr
        .filter((p): p is { pathname: string; fileName?: string | null } => !!p && typeof (p as any).pathname === 'string')
        .map((p) => ({ pathname: p.pathname, fileName: (p.fileName as string | null) ?? null }))
    : []
  if (pages.length === 0 && fallbackPathname) {
    return [{ pathname: fallbackPathname, fileName: fallbackName }]
  }
  return pages
}

// Vrne vse arhivirane račune (fotografije stroškov) za dano leto.
export async function getStroskiReceipts(year: number): Promise<StroskiReceipt[]> {
  const result = await db.execute(
    sql`SELECT * FROM stroski_receipts WHERE year = ${year} ORDER BY date DESC, "createdAt" DESC`
  )
  return result.rows.map((r) => {
    const amountEur = Number(r.amountEur ?? 0)
    const currency: Currency = r.currency === 'Ar' ? 'Ar' : 'EUR'
    const amountOriginal = r.amountOriginal != null ? Number(r.amountOriginal) : amountEur
    return {
      id: r.id as string,
      year: r.year as number,
      month: r.month as number,
      date: r.date as string,
      description: (r.description as string) ?? '',
      amountEur,
      currency,
      amountOriginal,
      categories: parseCategories(r.categories),
      pathname: r.pathname as string,
      fileName: (r.fileName as string | null) ?? null,
      pages: parsePages(r.pages, r.pathname as string, (r.fileName as string | null) ?? null),
      translation: (r.translation as string | null) ?? '',
      sentToAccountingAt: (r.sentToAccountingAt as string | null) ?? null,
      paymentMethod: (r.paymentMethod as PaymentMethod | null) ?? null,
      cashLedgerId: (r.cashLedgerId as string | null) ?? null,
      createdAt: r.createdAt as string | null,
    }
  })
}

// Doda arhiviran račun. Mesec/leto se izpeljeta iz datuma računa.
export async function addStroskiReceipt(params: {
  date: string
  description: string
  amountEur: number
  currency?: Currency
  amountOriginal?: number
  categories?: CategoryAllocation[]
  pathname: string
  fileName?: string
  pages?: ReceiptPage[]
}) {
  const { date, description, amountEur, pathname, fileName } = params
  const currency: Currency = params.currency === 'Ar' ? 'Ar' : 'EUR'
  const amountOriginal = params.amountOriginal != null ? params.amountOriginal : amountEur
  const categories = parseCategories(params.categories)
  // Če strani niso podane, uporabi glavni pathname kot edino stran.
  const pages: ReceiptPage[] =
    params.pages && params.pages.length > 0 ? params.pages : [{ pathname, fileName: fileName ?? null }]
  const d = new Date(date)
  const year = d.getFullYear()
  const month = d.getMonth() + 1
  const id = `receipt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  await db.execute(
    sql`INSERT INTO stroski_receipts (id, year, month, date, description, "amountEur", currency, "amountOriginal", categories, "pathname", "fileName", pages)
        VALUES (${id}, ${year}, ${month}, ${date}, ${description || ''}, ${amountEur || 0}, ${currency}, ${amountOriginal || 0}, ${JSON.stringify(categories)}::jsonb, ${pathname}, ${fileName ?? null}, ${JSON.stringify(pages)}::jsonb)`
  )
  revalidatePath('/statistika')
  revalidatePath('/')
  return { id }
}

// Doda nove strani (fotografije) k obstoječemu računu.
export async function addStroskiReceiptPages(id: string, newPages: ReceiptPage[]) {
  if (!newPages || newPages.length === 0) return
  const result = await db.execute(sql`SELECT pages, "pathname", "fileName" FROM stroski_receipts WHERE id = ${id}`)
  const row = result.rows[0]
  if (!row) return
  const existing = parsePages(row.pages, row.pathname as string, (row.fileName as string | null) ?? null)
  const merged = [...existing, ...newPages]
  await db.execute(sql`UPDATE stroski_receipts SET pages = ${JSON.stringify(merged)}::jsonb WHERE id = ${id}`)
  revalidatePath('/statistika')
  return { pages: merged }
}

// Shrani prepis + prevod vsebine računa v slovenščino.
// Če kategorije še niso vpisane, jih pravilo razporedi: hrana v kuhinjo,
// pijača in papirnati serveti v bar, pripomočki za sobe v nočitve.
// Ročno razporejenih računov ne prepiše.
export async function saveStroskiTranslation(id: string, translation: string) {
  await db.execute(sql`UPDATE stroski_receipts SET translation = ${translation} WHERE id = ${id}`)
  await fillReceiptSplitFromTranslation(id, translation)
  revalidatePath('/statistika')
}

async function fillReceiptSplitFromTranslation(id: string, translation: string) {
  const text = translation.trim()
  if (!text) return
  const result = await db.execute(
    sql`SELECT description, currency, "amountOriginal", "amountEur", categories FROM stroski_receipts WHERE id = ${id} LIMIT 1`
  )
  const row = result.rows[0]
  if (!row) return
  if (parseCategories(row.categories).length > 0) return

  const rate = await getExchangeRate()
  const safeRate = rate > 0 ? rate : 4800
  const currency: Currency = row.currency === 'Ar' ? 'Ar' : 'EUR'
  const amountOriginal = Number(row.amountOriginal ?? 0)
  const amountEur = Number(row.amountEur ?? 0)
  const bookedAr = currency === 'Ar' && amountOriginal > 0
    ? Math.round(amountOriginal)
    : currency === 'EUR' && amountEur > 0
      ? Math.round(amountEur * safeRate)
      : 0

  const categories = splitReceiptTranslation(text, safeRate, bookedAr > 0 ? bookedAr : null, amountEur > 0 ? amountEur : null)
  if (categories.length === 0) return

  const currentDesc = ((row.description as string | null) ?? '').trim()
  const description = currentDesc || supplierFromTranslation(text) || ''

  if (bookedAr > 0) {
    await db.execute(
      sql`UPDATE stroski_receipts SET categories = ${JSON.stringify(categories)}::jsonb, description = ${description} WHERE id = ${id}`
    )
    return
  }

  const totalAr = categories.reduce((sum, item) => sum + (item.amountOriginal ?? 0), 0)
  const totalEur = Math.round(categories.reduce((sum, item) => sum + item.amountEur, 0) * 100) / 100
  await db.execute(
    sql`UPDATE stroski_receipts
        SET categories = ${JSON.stringify(categories)}::jsonb,
            description = ${description},
            currency = 'Ar',
            "amountOriginal" = ${totalAr},
            "amountEur" = ${totalEur}
        WHERE id = ${id}`
  )
}

// Posodobi podatke arhiviranega računa (datum, opis, znesek).
export async function updateStroskiReceipt(
  id: string,
  params: {
    date: string
    description: string
    amountEur: number
    currency?: Currency
    amountOriginal?: number
    categories?: CategoryAllocation[]
  },
) {
  const { date, description, amountEur } = params
  const currency: Currency = params.currency === 'Ar' ? 'Ar' : 'EUR'
  const amountOriginal = params.amountOriginal != null ? params.amountOriginal : amountEur
  const categories = parseCategories(params.categories)
  const d = new Date(date)
  const year = d.getFullYear()
  const month = d.getMonth() + 1
  await db.execute(
    sql`UPDATE stroski_receipts
        SET date = ${date}, year = ${year}, month = ${month}, description = ${description || ''}, "amountEur" = ${amountEur || 0}, currency = ${currency}, "amountOriginal" = ${amountOriginal || 0}, categories = ${JSON.stringify(categories)}::jsonb
        WHERE id = ${id}`
  )
  revalidatePath('/statistika')
}

// Združi več računov v enega (Priporočeno pri npr. dolgem računu na več vnosih).
// Zneski se seštejejo (predpostavimo isto valuto — vzame se valuta prvega),
// strani in prepisi se združijo, kategorije se seštejejo. Ostali računi se izbrišejo.
export async function mergeStroskiReceipts(ids: string[]) {
  if (!ids || ids.length < 2) return { error: 'Izberi vsaj dva računa za združitev.' }
  const idList = sql.join(
    ids.map((id) => sql`${id}`),
    sql`, `
  )
  const result = await db.execute(
    sql`SELECT * FROM stroski_receipts WHERE id IN (${idList}) ORDER BY date ASC, "createdAt" ASC`
  )
  const rows = result.rows
  if (rows.length < 2) return { error: 'Računov za združitev ni dovolj.' }

  // Prvi (najstarejši) je cilj; ostali se zlijejo vanj.
  const target = rows[0]
  const targetId = target.id as string

  // Valuta = valuta cilja; zneski v isti valuti se seštejejo.
  const currency: Currency = target.currency === 'Ar' ? 'Ar' : 'EUR'
  let totalOriginal = 0
  let totalEur = 0
  const mergedPages: ReceiptPage[] = []
  const catTotals: Record<string, number> = {}
  const translations: string[] = []

  for (const r of rows) {
    totalEur += Number(r.amountEur ?? 0)
    totalOriginal += r.amountOriginal != null ? Number(r.amountOriginal) : Number(r.amountEur ?? 0)
    const pages = parsePages(r.pages, r.pathname as string, (r.fileName as string | null) ?? null)
    mergedPages.push(...pages)
    for (const c of parseCategories(r.categories)) {
      catTotals[c.category] = (catTotals[c.category] || 0) + Number(c.amountEur)
    }
    const t = (r.translation as string | null) ?? ''
    if (t.trim()) translations.push(t.trim())
  }

  const mergedCategories = Object.entries(catTotals)
    .filter(([, v]) => v > 0)
    .map(([category, amountEur]) => ({ category, amountEur: Math.round(amountEur * 100) / 100 }))
  const mergedTranslation = translations.join('\n\n— — —\n\n')
  const roundedEur = Math.round(totalEur * 100) / 100
  const roundedOriginal = Math.round(totalOriginal * 100) / 100

  await db.execute(
    sql`UPDATE stroski_receipts
        SET "amountEur" = ${roundedEur}, currency = ${currency}, "amountOriginal" = ${roundedOriginal},
            categories = ${JSON.stringify(mergedCategories)}::jsonb, pages = ${JSON.stringify(mergedPages)}::jsonb,
            translation = ${mergedTranslation}, "sentToAccountingAt" = NULL
        WHERE id = ${targetId}`
  )
  const others = ids.filter((x) => x !== targetId)
  if (others.length > 0) {
    const otherList = sql.join(
      others.map((id) => sql`${id}`),
      sql`, `
    )
    await db.execute(sql`DELETE FROM stroski_receipts WHERE id IN (${otherList})`)
  }
  revalidatePath('/statistika')
  return { id: targetId }
}

// Razdruži večstranski račun na ločene enostranske račune (obratno od združevanja).
// Vsaka stran postane svoj samostojen račun. Ker po razdružitvi ne vemo zneska
// posamezne strani, se znesek/prepis/kategorije/način plačila ponastavijo — vsak
// nastali račun je čist enostranski zapis, ki ga lahko znova prepoznaš.
export async function splitStroskiReceipt(id: string) {
  const result = await db.execute(sql`SELECT * FROM stroski_receipts WHERE id = ${id}`)
  const row = result.rows[0]
  if (!row) return { error: 'Računa ni mogoče najti.' }

  const pages = parsePages(row.pages, row.pathname as string, (row.fileName as string | null) ?? null)
  if (pages.length < 2) return { error: 'Račun ima samo eno stran — ni kaj razdružiti.' }

  const currency: Currency = row.currency === 'Ar' ? 'Ar' : 'EUR'
  const date = row.date as string
  const description = (row.description as string) ?? ''
  const d = new Date(date)
  const year = d.getFullYear()
  const month = d.getMonth() + 1

  // Če je bil račun plačan z gotovino (odhodek blagajne), razveljavi ta odhodek —
  // znesek postane neveljaven po razdružitvi.
  const cashLedgerId = (row.cashLedgerId as string | null) ?? null
  if (cashLedgerId) {
    try {
      await deleteCashExpense(cashLedgerId)
    } catch {
      // ignoriraj — če odhodka ni več, nadaljuj
    }
  }

  // Prva stran ostane na obstoječem zapisu; ponastavi znesek/prepis/kategorije/plačilo.
  const first = pages[0]
  await db.execute(
    sql`UPDATE stroski_receipts
        SET "amountEur" = 0, "amountOriginal" = 0, currency = ${currency},
            categories = '[]'::jsonb, translation = '', "sentToAccountingAt" = NULL,
            "paymentMethod" = NULL, "cashLedgerId" = NULL,
            pages = ${JSON.stringify([first])}::jsonb, "pathname" = ${first.pathname}, "fileName" = ${first.fileName ?? null}
        WHERE id = ${id}`
  )

  // Ostale strani → nov samostojen račun za vsako.
  const newIds: string[] = [id]
  for (let i = 1; i < pages.length; i++) {
    const p = pages[i]
    const newId = `receipt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${i}`
    await db.execute(
      sql`INSERT INTO stroski_receipts (id, year, month, date, description, "amountEur", currency, "amountOriginal", categories, "pathname", "fileName", pages)
          VALUES (${newId}, ${year}, ${month}, ${date}, ${description}, 0, ${currency}, 0, '[]'::jsonb, ${p.pathname}, ${p.fileName ?? null}, ${JSON.stringify([p])}::jsonb)`
    )
    newIds.push(newId)
  }

  revalidatePath('/statistika')
  revalidatePath('/')
  return { ids: newIds, count: newIds.length }
}

const ACCOUNTING_EMAIL_KEY = 'accountingEmail'

// Naslov računovodstva (stalen, shranjen v nastavitvah).
export async function getAccountingEmail(): Promise<string> {
  const result = await db.execute(sql`SELECT value FROM settings WHERE key = ${ACCOUNTING_EMAIL_KEY} LIMIT 1`)
  return (result.rows[0]?.value as string | undefined) ?? ''
}

export async function setAccountingEmail(email: string) {
  const value = (email || '').trim()
  const existing = await db.execute(sql`SELECT id FROM settings WHERE key = ${ACCOUNTING_EMAIL_KEY} LIMIT 1`)
  if (existing.rows[0]) {
    await db.execute(
      sql`UPDATE settings SET value = ${value}, "updatedAt" = ${new Date().toISOString()} WHERE key = ${ACCOUNTING_EMAIL_KEY}`
    )
  } else {
    await db.execute(
      sql`INSERT INTO settings (id, key, value) VALUES (${`set-${ACCOUNTING_EMAIL_KEY}`}, ${ACCOUNTING_EMAIL_KEY}, ${value})`
    )
  }
  revalidatePath('/statistika')
  return { email: value }
}

const MONTHS_SL_ARHIV = [
  'januar', 'februar', 'marec', 'april', 'maj', 'junij',
  'julij', 'avgust', 'september', 'oktober', 'november', 'december',
]

function formatEurArhiv(n: number) {
  return new Intl.NumberFormat('sl-SI', { style: 'currency', currency: 'EUR' }).format(n || 0)
}

// Pošlji račun (vse strani + prepis) računovodstvu prek Resend.
export async function sendReceiptToAccounting(id: string): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { success: false, error: 'E-pošta še ni nastavljena (manjka RESEND_API_KEY).' }

  const to = await getAccountingEmail()
  if (!to) return { success: false, error: 'Najprej vpiši e-naslov računovodstva (gumb „Računovodstvo").' }

  const result = await db.execute(sql`SELECT * FROM stroski_receipts WHERE id = ${id} LIMIT 1`)
  const row = result.rows[0]
  if (!row) return { success: false, error: 'Računa ni bilo mogoče najti.' }

  const description = (row.description as string) || 'Račun'
  const date = row.date as string
  const amountEur = Number(row.amountEur ?? 0)
  const currency: Currency = row.currency === 'Ar' ? 'Ar' : 'EUR'
  const amountOriginal = row.amountOriginal != null ? Number(row.amountOriginal) : amountEur
  const translation = ((row.translation as string | null) ?? '').trim()
  const pages = parsePages(row.pages, row.pathname as string, (row.fileName as string | null) ?? null)

  const base = process.env.NEXT_PUBLIC_APP_URL || ''

  // Priloge: prenesi vsako stran prek /api/image in pripni kot base64.
  const attachments: { filename: string; content: string }[] = []
  for (let i = 0; i < pages.length; i++) {
    try {
      const url = `${base}/api/image?pathname=${encodeURIComponent(pages[i].pathname)}`
      const resp = await fetch(url)
      if (!resp.ok) continue
      const buf = Buffer.from(await resp.arrayBuffer())
      const ext = (pages[i].pathname.match(/\.(\w+)$/)?.[1] || 'jpg').toLowerCase()
      attachments.push({ filename: `racun-${i + 1}.${ext}`, content: buf.toString('base64') })
    } catch {
      // preskoči stran, ki je ni mogoče prenesti
    }
  }

  const amountLine =
    currency === 'Ar'
      ? `${amountOriginal.toLocaleString('sl-SI')} Ar (≈ ${formatEurArhiv(amountEur)})`
      : formatEurArhiv(amountEur)

  const d = new Date(date)
  const dateLabel = isNaN(d.getTime())
    ? date
    : `${d.getDate()}. ${MONTHS_SL_ARHIV[d.getMonth()]} ${d.getFullYear()}`

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;max-width:600px;margin:0 auto">
      <h2 style="color:#152329;margin:0 0 4px">Račun za računovodstvo</h2>
      <p style="margin:0 0 16px;color:#555">Komba Cabana</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr><td style="padding:6px 0;color:#777;width:120px">Opis</td><td style="padding:6px 0;font-weight:600">${escapeHtml(description)}</td></tr>
        <tr><td style="padding:6px 0;color:#777">Datum</td><td style="padding:6px 0">${escapeHtml(dateLabel)}</td></tr>
        <tr><td style="padding:6px 0;color:#777">Znesek</td><td style="padding:6px 0;font-weight:600">${escapeHtml(amountLine)}</td></tr>
        <tr><td style="padding:6px 0;color:#777">Št. strani</td><td style="padding:6px 0">${pages.length}</td></tr>
      </table>
      ${
        translation
          ? `<h3 style="color:#152329;margin:20px 0 8px;font-size:15px">Prepis vsebine</h3>
             <div style="white-space:pre-line;background:#f6f6f4;border-radius:8px;padding:12px;font-size:13px;line-height:1.5">${escapeHtml(translation)}</div>`
          : ''
      }
      <p style="margin:20px 0 0;font-size:12px;color:#999">Slike vseh strani računa so pripete tej e-pošti.</p>
    </div>`

  const from = process.env.EMAIL_FROM || 'Komba Cabana <info@kombacabana.app>'
  const subject = `Račun — ${description} (${dateLabel})`

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, html, attachments }),
    })
    if (!resp.ok) {
      const detail = await resp.text()
      return { success: false, error: `Pošiljanje ni uspelo: ${detail.slice(0, 200)}` }
    }
    await db.execute(
      sql`UPDATE stroski_receipts SET "sentToAccountingAt" = ${new Date().toISOString()} WHERE id = ${id}`
    )
    revalidatePath('/statistika')
    return { success: true }
  } catch (e) {
    return { success: false, error: `Napaka pri pošiljanju: ${(e as Error).message}` }
  }
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Izbriše zapis računa (blob ostane v shrambi, a ni več prikazan).
export async function deleteStroskiReceipt(id: string) {
  const res = await db.execute(sql`SELECT "cashLedgerId", "omLedgerId" FROM stroski_receipts WHERE id = ${id} LIMIT 1`)
  const row = (res.rows as Record<string, unknown>[])[0]
  if (row?.cashLedgerId) await deleteCashExpense(row.cashLedgerId as string).catch(() => {})
  if (row?.omLedgerId) await deleteOmTransaction(row.omLedgerId as string).catch(() => {})
  await db.execute(sql`DELETE FROM stroski_receipts WHERE id = ${id}`)
  revalidatePath('/statistika')
}

// Prebere bajte ene strani (slike) računa iz blob shrambe.
async function fetchPageBytes(pathname: string): Promise<{ data: Buffer; mediaType: string } | null> {
  try {
    const result = await get(pathname, { access: 'private' })
    if (!result || result.statusCode === 304) return null
    const chunks: Uint8Array[] = []
    // @ts-ignore — result.stream je bralni tok
    for await (const chunk of result.stream) chunks.push(chunk as Uint8Array)
    return { data: Buffer.concat(chunks), mediaType: result.blob.contentType || 'image/jpeg' }
  } catch {
    return null
  }
}

// Prepozna datum + znesek + valuto enega računa STREŽNIŠKO in posodobi zapis.
// Vrne true, če je bil znesek uspešno razbran.
async function recognizeReceiptRow(row: Record<string, unknown>, rate: number): Promise<boolean> {
  const pages = parsePages(row.pages, row.pathname as string, (row.fileName as string | null) ?? null)
  // Slikovne strani (PDF preskočimo pri OCR).
  const imagePages = pages.filter((p) => !/\.pdf$/i.test(p.pathname))
  const source = imagePages.length > 0 ? imagePages : pages
  const images: { data: Buffer; mediaType: string }[] = []
  for (const p of source.slice(0, 4)) {
    const bytes = await fetchPageBytes(p.pathname)
    if (bytes && !/pdf/i.test(bytes.mediaType)) images.push(bytes)
  }
  if (images.length === 0) return false

  const result = await readReceiptFromImages(images)
  if (typeof result.amount !== 'number' || !(result.amount > 0)) return false

  const currency: Currency = result.currency === 'Ar' ? 'Ar' : result.currency === 'EUR' ? 'EUR' : 'EUR'
  const amountOriginal = Math.round(result.amount * 100) / 100
  const amountEur = currency === 'Ar' ? Math.round((amountOriginal / rate) * 100) / 100 : amountOriginal

  const currentDesc = ((row.description as string | null) ?? '').trim()
  const newDesc = currentDesc || (result.description ? result.description.trim() : '')
  let date = row.date as string
  let year = row.year as number
  let month = row.month as number
  if (result.date && /^\d{4}-\d{2}-\d{2}$/.test(result.date)) {
    date = result.date
    const d = new Date(result.date)
    year = d.getFullYear()
    month = d.getMonth() + 1
  }

  await db.execute(
    sql`UPDATE stroski_receipts
        SET "amountEur" = ${amountEur}, currency = ${currency}, "amountOriginal" = ${amountOriginal},
            description = ${newDesc}, date = ${date}, year = ${year}, month = ${month}
        WHERE id = ${row.id as string}`
  )
  return true
}

// Množična prepoznava STREŽNIŠKO: obdela vse (ali samo še neprepoznane) račune leta v enem klicu.
// Robustno — ne prekine se ob težavi z brskalnikom, ker teče na strežniku.
export async function recognizeAllStroskiReceipts(
  year: number,
  onlyMissing = true
): Promise<{ processed: number; recognized: number; failed: number }> {
  const rate = await getExchangeRate()
  const where = onlyMissing
    ? sql`WHERE year = ${year} AND (COALESCE("amountEur", 0) = 0)`
    : sql`WHERE year = ${year}`
  const result = await db.execute(sql`SELECT * FROM stroski_receipts ${where} ORDER BY date DESC`)
  const rows = result.rows

  let recognized = 0
  let failed = 0
  for (const row of rows) {
    try {
      const ok = await recognizeReceiptRow(row, rate)
      if (ok) recognized++
      else failed++
    } catch {
      failed++
    }
  }
  revalidatePath('/statistika')
  return { processed: rows.length, recognized, failed }
}

// Znesek računa v ariarijih (za blagajno / OM ujemanje).
function receiptAmountAr(row: Record<string, unknown>, rate: number): number {
  const currency: Currency = row.currency === 'Ar' ? 'Ar' : 'EUR'
  const amountEur = Number(row.amountEur ?? 0)
  const amountOriginal = row.amountOriginal != null ? Number(row.amountOriginal) : amountEur
  if (currency === 'Ar') return Math.round(amountOriginal || amountEur * rate)
  return Math.round(amountEur * rate)
}

// Nastavi način plačila stroška.
//  - 'card'         → samo označi (že v bančnih izpiskih).
//  - 'orange_money' → samo označi (ujemanje z odlivi preveriš posebej).
//  - 'cash'         → ustvari odhodek v blagajni Tourism (v Ar) in poveži prek cashLedgerId.
// Ob preklopu stran od gotovine se prejšnji blagajniški odhodek izbriše.
export async function setReceiptPaymentMethod(
  id: string,
  method: PaymentMethod | null,
  opts?: { createOmOutflow?: boolean },
) {
  const res = await db.execute(sql`SELECT * FROM stroski_receipts WHERE id = ${id} LIMIT 1`)
  const row = (res.rows as Record<string, unknown>[])[0]
  if (!row) return { ok: false as const, error: 'Račun ni najden.' }

  const prevMethod = (row.paymentMethod as PaymentMethod | null) ?? null
  const prevCashId = (row.cashLedgerId as string | null) ?? null
  const prevOmId = (row.omLedgerId as string | null) ?? null

  if (prevOmId && method !== 'orange_money') {
    try {
      await deleteOmTransaction(prevOmId)
    } catch {
      // odliv morda že ne obstaja
    }
  }

  let omLedgerId: string | null = method === 'orange_money' ? prevOmId : null
  if (method === 'orange_money' && !prevOmId && opts?.createOmOutflow) {
    const rate = await getExchangeRate()
    const amountAr = receiptAmountAr(row, rate)
    if (amountAr > 0) {
      const desc = ((row.description as string | null) ?? '').trim() || 'Račun'
      const { id: omId } = await addOmTransaction({
        date: (row.date as string) || new Date().toISOString().slice(0, 10),
        direction: 'out',
        category: 'dobavitelj',
        amount: amountAr,
        description: `Strošek: ${desc}`,
      })
      omLedgerId = omId
    }
  }

  // Če je bil prej gotovina in zdaj ni več → razveljavi blagajniški odhodek.
  if (prevCashId && method !== 'cash') {
    try {
      await deleteCashExpense(prevCashId)
    } catch {
      // odhodek morda že ne obstaja
    }
  }

  let cashLedgerId: string | null = method === 'cash' ? prevCashId : null

  if (method === 'cash' && !prevCashId) {
    const rate = await getExchangeRate()
    const amountAr = receiptAmountAr(row, rate)
    if (amountAr > 0) {
      const desc = ((row.description as string | null) ?? '').trim() || 'Račun'
      const { id: ceId } = await addCashExpense({
        company: 'tourism',
        date: (row.date as string) || new Date().toISOString().slice(0, 10),
        purpose: `Strošek: ${desc}`,
        amount: amountAr,
      })
      cashLedgerId = ceId
    }
  }

  await db.execute(
    sql`UPDATE stroski_receipts SET "paymentMethod" = ${method}, "cashLedgerId" = ${cashLedgerId}, "omLedgerId" = ${omLedgerId} WHERE id = ${id}`
  )
  revalidatePath('/statistika')
  return { ok: true as const, cashLedgerId, prevMethod }
}

export type OmMatch = { id: string; date: string; amount: number; description: string; exact: boolean }

// Poišče odlive v Orange Money, ki se ujemajo z zneskom računa (za preverjanje OM plačila).
export async function getOmMatchesForReceipt(id: string): Promise<OmMatch[]> {
  const res = await db.execute(sql`SELECT * FROM stroski_receipts WHERE id = ${id} LIMIT 1`)
  const row = (res.rows as Record<string, unknown>[])[0]
  if (!row) return []
  const rate = await getExchangeRate()
  const amountAr = receiptAmountAr(row, rate)
  if (amountAr <= 0) return []

  const tol = Math.max(2000, Math.round(amountAr * 0.03)) // 3 % ali vsaj 2000 Ar

  // 1) Odlivi v denarnici Orange Money (orange_money_transactions).
  const txs = await getOmTransactions(row.year as number)
  const walletMatches: OmMatch[] = txs
    .filter((t) => t.direction === 'out' && Math.abs(t.amount - amountAr) <= tol)
    .map((t) => ({
      id: t.id,
      date: t.date,
      amount: t.amount,
      description: t.description,
      exact: t.amount === amountAr,
    }))

  // 2) Seznam nakazil (om_transfers) — tam so npr. plačila dobaviteljem prek OM.
  //    Znesek se lahko ujema s samo prenosom (amount) ali s prenosom + provizijo (amount + fees),
  //    ker je na računu lahko zapisan bruto ali neto znesek.
  const transfers = await getOmTransfers()
  const transferMatches: OmMatch[] = transfers
    .filter((t) => {
      const fees = t.fees ?? 0
      return Math.abs(t.amount - amountAr) <= tol || Math.abs(t.amount + fees - amountAr) <= tol
    })
    .map((t) => {
      const fees = t.fees ?? 0
      const who = t.recipientName || t.recipientNumber || 'Neznan prejemnik'
      return {
        id: t.id,
        date: t.transferDate ?? '',
        amount: t.amount,
        description: `Nakazilo · ${who}${t.transId ? ` · ${t.transId}` : ''}`,
        exact: t.amount === amountAr || t.amount + fees === amountAr,
      }
    })

  return [...walletMatches, ...transferMatches]
    .sort((a, b) => {
      // Točna ujemanja najprej, nato po najmanjši razliki.
      if (a.exact !== b.exact) return a.exact ? -1 : 1
      return Math.abs(a.amount - amountAr) - Math.abs(b.amount - amountAr)
    })
    .slice(0, 5)
}

export type BankMatch = { id: string; date: string; amount: number; description: string; exact: boolean; company: string }

// Poišče odlive na bančnih izpiskih (obe podjetji), ki se ujemajo z zneskom računa
// (za samodejno preverjanje plačila s kreditno kartico).
export async function getBankMatchesForReceipt(id: string): Promise<BankMatch[]> {
  const res = await db.execute(sql`SELECT * FROM stroski_receipts WHERE id = ${id} LIMIT 1`)
  const row = (res.rows as Record<string, unknown>[])[0]
  if (!row) return []
  const rate = await getExchangeRate()
  const amountAr = receiptAmountAr(row, rate)
  if (amountAr <= 0) return []

  const year = row.year as number
  const [tourism, sarl] = await Promise.all([
    getBankTransactions('tourism', year),
    getBankTransactions('sarl', year),
  ])
  const txs = [...tourism, ...sarl]
  const tol = Math.max(2000, Math.round(amountAr * 0.03)) // 3 % ali vsaj 2000 Ar
  return txs
    .filter((t) => t.direction === 'out' && Math.abs(t.amount - amountAr) <= tol)
    .map((t) => ({
      id: t.id,
      date: t.date,
      amount: t.amount,
      description: t.description,
      exact: t.amount === amountAr,
      company: t.company,
    }))
    .sort((a, b) => Math.abs(a.amount - amountAr) - Math.abs(b.amount - amountAr))
    .slice(0, 5)
}
