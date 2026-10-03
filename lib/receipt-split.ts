import type { CategoryAllocation, StrosekCategory } from '@/lib/stroski-categories'

// Razporeditev postavk z računa, potem ko je prepis že v slovenščini.
// Hrana gre v kuhinjo. Pijača, ki se prodaja v baru, in papirnati serveti grejo v bar.
// Pripomočki za sobe (npr. sredstvo za občutljivo kožo, toaletni papir) grejo v nočitve.
// Česar pravilo ne pozna, ostane v Ostalo, da se ne pripiše napačnemu oddelku.
// Če se postavke ne seštejejo v končni znesek računa, se deleži sorazmerno
// uskladijo s končnim zneskom, ki je bil dejansko plačan.

const BAR_WORDS = [
  'servet', 'serviet', 'prtick', 'prtic', 'napkin',
  'kava', 'kavo', 'coffee',
  'čaj', 'caj',
  'pivo', 'beer', 'vino', 'wine', 'sirup',
  'sok', 'juice', 'cola', 'coca', 'fanta', 'sprite', 'fizz', 'gaziran', 'limonad',
  'rhum', 'rum', 'viski', 'whisky', 'whiskey', 'vodka', 'gin', 'liker',
  'red bull', 'energijsk',
]

const ROOM_WORDS = [
  'hipalergen', 'hipoalergen',
  'občutljiv', 'obcutljiv',
  'toaletni', 'wc papir', 'papier toilette',
  'komar', 'rokavic', 'brisač', 'brisac',
  'šampon', 'sampon', 'milo', 'mehčalec', 'mehcalec',
]

const KITCHEN_WORDS = [
  'jogurt', 'maslo', 'sir', 'piškot', 'piskot', 'smetan', 'mortadel', 'salam', 'klobas',
  'omak', 'preliv', 'palacink', 'palačink', 'majonez', 'olje', 'oljk', 'kumaric', 'kapr', 'pistac',
  'tort', 'drobtin', 'testenin', 'tagliatelle', 'cvetač', 'cvetac', 'brokol',
  'mleko', 'krema', 'sladoled', 'moka', 'moulinet', 'meso', 'riba', 'kruh', 'riž', 'riz',
  'jajc', 'sladkor', 'sol', 'čokolad', 'cokolad', 'zelenjav', 'sadje', 'začimb', 'zacimb',
  'paradižnik', 'paradiznik', 'čebul', 'cebul', 'krompir', 'solat', 'korenj',
  'pomivanje', 'gobica', 'gobice', 'drgnjen',
]

const CATEGORY_ORDER: StrosekCategory[] = ['kuhinja', 'bar', 'nocitve', 'ostalo']

function fold(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function hasWord(text: string, words: string[]): boolean {
  const folded = fold(text)
  return words.some((word) => {
    const needle = fold(word)
    if (needle.includes(' ')) return folded.includes(needle)
    // Kratke besede (sir, sok, gin) samo kot cela beseda, da ne zadenemo sosednje.
    // Daljše ostanejo kot koren: "servet" znotraj "serveti", "fizz" znotraj "JOLIEFIZZ".
    if (needle.length <= 3) {
      return new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(needle)}(?:[^a-z0-9]|$)`).test(folded)
    }
    return folded.includes(needle)
  })
}

export function classifyReceiptLine(name: string): StrosekCategory {
  if (hasWord(name, BAR_WORDS)) return 'bar'
  if (hasWord(name, ROOM_WORDS)) return 'nocitve'
  if (hasWord(name, KITCHEN_WORDS)) return 'kuhinja'
  return 'ostalo'
}

function lineAmount(line: string): number | null {
  const trimmed = line.trim()
  if (/%\s*$/.test(trimmed)) return null
  const withCurrency = trimmed.match(/(\d{1,3}(?:[ \u00a0]\d{3})+|\d+)(?:[.,](\d{1,2}))?\s*(?:ar|ariary)\s*$/i)
  const match = withCurrency ?? trimmed.match(/(\d{1,3}(?:[ \u00a0]\d{3})+|\d+)[.,](\d{2})\s*$/)
  if (!match) return null
  const whole = match[1].replace(/[ \u00a0]/g, '')
  const value = match[2] ? Number(`${whole}.${match[2]}`) : Number(whole)
  if (!Number.isFinite(value) || value <= 0) return null
  return Math.round(value)
}

function plainLine(line: string): string {
  return line.replace(/\*/g, '').trim()
}

function isTotalLine(line: string): boolean {
  const folded = fold(line)
  // "ht" samo kot cela beseda. "UHT mleko" ni vrstica z davkom.
  return /\b(ddv|tva|ttc|ht|total|montant)\b/.test(folded)
    || /skupn|koncn|za placilo|net a payer|znesek z ddv|znesek brez/.test(folded)
}

function isCancelled(line: string): boolean {
  return /preklic|annul|cancelled|storno/i.test(fold(line))
}

export function supplierFromTranslation(text: string): string | null {
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\*/g, '').trim()
    const match = line.match(/^(?:dobavitelj\s*\/\s*trgovina|dobavitelj|trgovina)\s*:\s*(.+)$/i)
    const name = match?.[1]?.trim()
    if (!name) continue
    // Na nekaterih računih prepis zamenja kupca in dobavitelja.
    if (/komba cabana/i.test(name)) continue
    return name
  }
  return null
}

export function receiptTotalFromTranslation(text: string): number | null {
  const candidates: { score: number; amount: number }[] = []
  for (const line of text.split(/\r?\n/)) {
    const folded = fold(line)
    const amount = lineAmount(line)
    if (!amount) continue
    if (/za placilo|net a payer|total ttc/.test(folded)) candidates.push({ score: 3, amount })
    else if (/skupni znesek \(z ddv\)|znesek z ddv/.test(folded) && !/brez/.test(folded)) candidates.push({ score: 2, amount })
    else if (/skupn.*ddv/.test(folded) && !/brez/.test(folded)) candidates.push({ score: 1, amount })
  }
  candidates.sort((a, b) => b.score - a.score)
  return candidates[0]?.amount ?? null
}

// Račun, kjer je vsaka postavka v več vrsticah: ime, količina, znesek brez DDV, stopnja DDV.
function detailedReceiptLines(text: string): { line: string; amount: number; category: StrosekCategory }[] | null {
  const items: { name: string; ht: number | null; rate: number }[] = []
  let current: { name: string; ht: number | null; rate: number } | null = null
  let sawLineTotal = false

  const close = () => {
    if (current) items.push(current)
    current = null
  }

  for (const rawLine of text.split(/\r?\n/)) {
    const line = plainLine(rawLine)
    if (!line) continue
    const folded = fold(line)
    if (/povzetek|koncni znesek|skupni bruto|neto znesek|osnova za ddv|znesek za placilo|predplacilo/.test(folded)) {
      close()
      continue
    }
    const itemMatch = line.match(/^(\d+)\.\s+(.+)$/)
    if (itemMatch) {
      close()
      current = { name: itemMatch[2].trim(), ht: null, rate: 0 }
      continue
    }
    if (!current) continue
    if (/znesek \(brez ddv\)/.test(folded) && !/skupn|neto|bruto/.test(folded)) {
      const amount = lineAmount(line)
      if (amount) {
        current.ht = amount
        sawLineTotal = true
      }
    } else if (/ddv\s*:/.test(folded) && /%/.test(line)) {
      const rate = line.match(/(\d+(?:[.,]\d+)?)\s*%/)
      if (rate) current.rate = Number(rate[1].replace(',', '.'))
    }
  }
  close()
  if (!sawLineTotal) return null

  const rows: { line: string; amount: number; category: StrosekCategory }[] = []
  for (const item of items) {
    if (!item.ht || isCancelled(item.name)) continue
    const amount = Math.round((item.ht * (100 + (item.rate || 0))) / 100)
    if (amount <= 0) continue
    rows.push({ line: item.name, amount, category: classifyReceiptLine(item.name) })
  }
  return rows.length > 0 ? rows : null
}

export function receiptLinesForSplit(text: string): { line: string; amount: number; category: StrosekCategory }[] {
  const detailed = detailedReceiptLines(text)
  if (detailed) return detailed

  const rows: { line: string; amount: number; category: StrosekCategory }[] = []
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || isTotalLine(line) || isCancelled(line)) continue
    const amount = lineAmount(line)
    if (!amount) continue
    rows.push({ line, amount, category: classifyReceiptLine(line) })
  }
  return rows
}

function allocateToTarget(totals: Map<StrosekCategory, number>, target: number): Map<StrosekCategory, number> {
  const entries = CATEGORY_ORDER
    .map((category) => ({ category, amount: totals.get(category) || 0 }))
    .filter((entry) => entry.amount > 0)
  const sum = entries.reduce((total, entry) => total + entry.amount, 0)
  if (sum <= 0 || target <= 0) return new Map()
  if (sum === target) return new Map(entries.map((entry) => [entry.category, entry.amount]))

  const raw = entries.map((entry) => (entry.amount * target) / sum)
  const amounts = raw.map((value) => Math.floor(value))
  let left = target - amounts.reduce((total, value) => total + value, 0)
  const byFraction = raw
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index)
  for (let i = 0; i < left; i++) amounts[byFraction[i % byFraction.length].index] += 1
  return new Map(entries.map((entry, index) => [entry.category, amounts[index]]))
}

function euros(amount: number, rate: number): number {
  return Math.round((amount / rate) * 100) / 100
}

export function splitReceiptTranslation(
  text: string,
  rate = 4800,
  targetOriginal?: number | null,
  targetEur?: number | null,
): CategoryAllocation[] {
  const totals = new Map<StrosekCategory, number>()
  for (const row of receiptLinesForSplit(text)) {
    totals.set(row.category, (totals.get(row.category) || 0) + row.amount)
  }
  const lineSum = [...totals.values()].reduce((sum, amount) => sum + amount, 0)
  if (lineSum <= 0) return []

  const footer = receiptTotalFromTranslation(text)
  const target = targetOriginal && targetOriginal > 0
    ? Math.round(targetOriginal)
    : footer && footer > 0
      ? footer
      : lineSum
  const allocated = allocateToTarget(totals, target)
  const safeRate = rate > 0 ? rate : 4800
  const eurGoal = targetEur && targetEur > 0 ? Math.round(targetEur * 100) / 100 : euros(target, safeRate)

  const rows: CategoryAllocation[] = []
  for (const category of CATEGORY_ORDER) {
    const amountOriginal = allocated.get(category) || 0
    if (amountOriginal <= 0) continue
    rows.push({
      category,
      amountOriginal,
      amountEur: euros(amountOriginal, safeRate),
    })
  }
  if (rows.length === 0) return []

  const eurSum = Math.round(rows.reduce((sum, row) => sum + row.amountEur, 0) * 100) / 100
  const eurDiff = Math.round((eurGoal - eurSum) * 100) / 100
  if (eurDiff !== 0) {
    let biggest = rows[0]
    for (const row of rows) {
      if ((row.amountOriginal ?? 0) > (biggest.amountOriginal ?? 0)) biggest = row
    }
    biggest.amountEur = Math.round((biggest.amountEur + eurDiff) * 100) / 100
  }
  return rows
}
