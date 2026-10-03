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
  'pivo', 'beer', 'pilsener', 'pilsner', 'vino', 'wine', 'sirup',
  'sok', 'juice', 'eau vive', 'voda', 'cristal', 'cola', 'coca', 'fanta', 'sprite', 'fizz', 'gaziran', 'limonad',
  'rhum', 'rum', 'viski', 'whisky', 'whiskey', 'vodka', 'gin', 'liker',
  'red bull', 'energijsk', 'slamice', 'zobotrebec',
]

const ROOM_WORDS = [
  'hipalergen', 'hipoalergen',
  'občutljiv', 'obcutljiv',
  'toaletni', 'wc papir', 'papier toilette',
  'komar', 'rokavic', 'brisač', 'brisac',
  'šampon', 'sampon', 'milo', 'mehčalec', 'mehcalec',
  'zobn', 'colgate', 'dentifric',
  'parfum', 'parfem', 'kolonij',
  'robčk', 'robck',
]

const KITCHEN_WORDS = [
  'jogurt', 'maslo', 'sir', 'piškot', 'piskot', 'smetan', 'mortadel', 'salam', 'klobas',
  'omak', 'preliv', 'palacink', 'palačink', 'majonez', 'olje', 'oljk', 'kumaric', 'kapr', 'pistac',
  'tort', 'drobtin', 'testenin', 'tagliatelle', 'cvetač', 'cvetac', 'brokol',
  'mleko', 'krema', 'sladoled', 'moka', 'moulinet', 'meso', 'riba', 'kruh', 'riž', 'riz',
  'jajc', 'sladkor', 'sol', 'piščan', 'piscan', 'čips', 'cips', 'kakec', 'nabodal',
  'jastog', 'langoust', 'langust', 'homar', 'sigal', 'cigal', 'kozic', 'rakov',
  'baget', 'štruc', 'struc', 'roglj', 'rozin', 'svinj', 'kotlet', 'socolait', 'pak choi',
  'karamel', 'toffee', 'sardin', 'zamrzoval', 'pripravek', 'kečap', 'kecap',
  'čokolad', 'cokolad', 'chocolat', 'zelenjav', 'sadje', 'začimb', 'zacimb',
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

// Kratka imena pijač, ki se sicer skrijejo v daljšo besedo (cola v chocolat).
const WHOLE_DRINK_STEMS = new Set(['cola', 'coca'])

function hasWord(text: string, words: string[]): boolean {
  const folded = fold(text)
  return words.some((word) => {
    const needle = fold(word)
    if (needle.includes(' ')) return folded.includes(needle)
    // Kratke besede (sir, sok, gin) samo kot cela beseda, da ne zadenemo sosednje.
    // cola in coca prav tako, da "chocolat" ostane hrana. Daljši koreni ostanejo:
    // "servet" znotraj "serveti", "fizz" znotraj "JOLIEFIZZ".
    if (needle.length <= 3 || WHOLE_DRINK_STEMS.has(needle)) {
      return new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(needle)}(?:[^a-z0-9]|$)`).test(folded)
    }
    return folded.includes(needle)
  })
}

export function classifyReceiptLine(name: string): StrosekCategory {
  // "Kristalno olje" ni pijača, čeprav je v imenu cristal.
  if (!hasWord(name, ['olje', 'huile']) && hasWord(name, BAR_WORDS)) return 'bar'
  if (hasWord(name, ROOM_WORDS)) return 'nocitve'
  if (hasWord(name, KITCHEN_WORDS)) return 'kuhinja'
  return 'ostalo'
}

function moneyFrom(raw: string, allowBare = false): number | null {
  const trimmed = raw.trim().replace(/\u00a0/g, ' ')
  if (!trimmed || /%\s*$/.test(trimmed)) return null
  // 3.200.000 AR in 80.000 AR: pike ločujejo tisočice, ne decimalk.
  const dotted = trimmed.match(/(\d{1,3}(?:\.\d{3})+)(?:,(\d{1,2}))?\s*(?:ar|ariary|mga|m)?\s*$/i)
  const dottedHasCurrency = !!dotted && /(?:ar|ariary|mga|m)\s*$/i.test(trimmed)
  if (dotted && (dottedHasCurrency || allowBare)) {
    const whole = dotted[1].replace(/\./g, '')
    const value = dotted[2] ? Number(`${whole}.${dotted[2]}`) : Number(whole)
    if (Number.isFinite(value) && value > 0) return Math.round(value)
  }
  const withCurrency = trimmed.match(/(\d{1,3}(?: \d{3})+|\d+)(?:[.,](\d{1,2}))?\s*(?:ar|ariary|mga)\s*$/i)
  const withM = trimmed.match(/(\d{1,3}(?: \d{3})+|\d+)(?:[.,](\d{1,2}))?\s*m\s*$/i)
  const decimal = trimmed.match(/(\d{1,3}(?: \d{3})+|\d+)[.,](\d{2})\s*$/)
  const bare = allowBare ? trimmed.match(/(\d{1,3}(?: \d{3})+|\d+)\s*$/) : null
  const match = withCurrency ?? withM ?? decimal ?? bare
  if (!match) return null
  const whole = match[1].replace(/ /g, '')
  const value = match[2] ? Number(`${whole}.${match[2]}`) : Number(whole)
  if (!Number.isFinite(value) || value <= 0) return null
  return Math.round(value)
}

function lineAmount(line: string): number | null {
  return moneyFrom(line, false)
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
    const match = line.match(/(?:dobavitelj\w*(?:\s*\/\s*trgovin\w*)?|trgovin\w*)\s*:\s*(.+)$/i)
    const name = match?.[1]?.trim()
    if (!name) continue
    // Na nekaterih računih prepis zamenja kupca in dobavitelja.
    if (/komba cabana/i.test(name)) continue
    return name
  }
  return null
}

const SL_MONTHS: Record<string, number> = {
  januar: 1, januarja: 1,
  februar: 2, februarja: 2,
  marec: 3, marca: 3,
  april: 4, aprila: 4,
  maj: 5, maja: 5,
  junij: 6, junija: 6,
  julij: 7, julija: 7,
  avgust: 8, avgusta: 8,
  september: 9, septembra: 9,
  oktober: 10, oktobra: 10,
  november: 11, novembra: 11,
  december: 12, decembra: 12,
}

export function receiptDateFromTranslation(text: string): string | null {
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\*/g, '').trim()
    const numeric = line.match(/datum\s*:\s*(\d{1,2})[./](\d{1,2})[./](\d{2,4})/i)
    if (numeric) {
      const day = Number(numeric[1])
      const month = Number(numeric[2])
      let year = Number(numeric[3])
      if (year < 100) year += 2000
      if (month < 1 || month > 12 || day < 1 || day > 31) continue
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    }
    const named = line.match(/datum\s*:\s*(\d{1,2})\.?\s+([a-zčšž]+)\.?\s+(\d{4})/i)
    if (!named) continue
    const day = Number(named[1])
    const month = SL_MONTHS[fold(named[2])]
    const year = Number(named[3])
    if (!month || day < 1 || day > 31) continue
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }
  return null
}

export function receiptTotalFromTranslation(text: string): number | null {
  const candidates: { score: number; amount: number }[] = []
  for (const line of text.split(/\r?\n/)) {
    const folded = fold(line)
    const isPayable = /za placilo|net a payer|total ttc|koncni znesek/.test(folded)
    const isWithTax = (/skupaj z ddv|skupni znesek/.test(folded) && !/brez|postavk|za postavko/.test(folded))
      || (/skupn.*ddv/.test(folded) && !/brez/.test(folded))
    const isBareTotal = /^skupaj\b/.test(folded)
    const isFooter = isPayable || isWithTax || isBareTotal
    const amount = lineAmount(line) ?? (isFooter ? moneyFrom(line, true) : null)
    if (!amount) continue
    if (isPayable) candidates.push({ score: 3, amount })
    else if (isWithTax) candidates.push({ score: 2, amount })
    else if (isBareTotal) candidates.push({ score: 1, amount })
  }
  candidates.sort((a, b) => b.score - a.score)
  return candidates[0]?.amount ?? null
}

// Tržnica in podobni listi: v isti vrstici sta opis in znesek, brez besede AR.
function marketReceiptLines(text: string): { line: string; amount: number; category: StrosekCategory }[] | null {
  const rows: { line: string; amount: number; category: StrosekCategory }[] = []
  for (const rawLine of text.split(/\r?\n/)) {
    const line = plainLine(rawLine)
    const folded = fold(line)
    if (!/opis\s*:/.test(folded) || !/znesek\s*:/.test(folded)) continue
    if (/skupn|koncn/.test(folded)) continue
    const name = line.match(/opis\s*:\s*([^,]+)/i)?.[1]?.trim()
    const amountText = line.match(/znesek\s*:\s*(.+)$/i)?.[1] ?? ''
    const amount = moneyFrom(amountText, true)
    if (!name || !amount || isCancelled(name)) continue
    rows.push({ line: name, amount, category: classifyReceiptLine(name) })
  }
  return rows.length > 0 ? rows : null
}

// Vrstica s postavko in zneskom v isti vrsti, npr.
// "1. Jogurt | Količina: 6 | Cena/kos: 1 500 | Znesek: 9 000"
// Znesek je končni znesek postavke, brez besede AR in brez dodajanja DDV.
function pricedReceiptLines(text: string): { line: string; amount: number; category: StrosekCategory }[] | null {
  const rows: { line: string; amount: number; category: StrosekCategory }[] = []
  for (const rawLine of text.split(/\r?\n/)) {
    const line = plainLine(rawLine)
    if (!line || isTotalLine(line) || isCancelled(line)) continue
    if (!/znesek\s*:/i.test(line)) continue
    const amountText = line.match(/znesek\s*:\s*(.+)$/i)?.[1] ?? ''
    const amount = moneyFrom(amountText, true)
    if (!amount) continue
    let name = line.replace(/^\d+\.\s*/, '').split('|')[0].trim()
    name = name.replace(/\s*znesek\s*:.*$/i, '').replace(/[, ]+$/g, '').trim()
    if (!name || /^(kolicina|cena)\b/.test(fold(name))) continue
    rows.push({ line: name, amount, category: classifyReceiptLine(name) })
  }
  return rows.length > 0 ? rows : null
}

function isFieldLabel(line: string): boolean {
  const folded = fold(line).replace(/^[-*]\s*/, '').replace(/^\d+\.\s*/, '')
  return /^(kolicina|cena|znesek|popust|ddv|tva|davek|skupaj|skupni|koncni|vmesni|sous)\b/.test(folded)
}

function isInvoiceFooter(folded: string): boolean {
  if (/^(popust|ddv|tva|davek|predplacilo|acompte|placilo)\b/.test(folded)) return true
  if (/koncni znesek|total ttc|total ht|sous-total|vmesni sestev|skupaj brez|skupaj z ddv|skupni znesek racuna|skupaj za |skupni znesek postavk/.test(folded)) return true
  if (/^skupni znesek\b/.test(folded) && !/za postavko/.test(folded)) return true
  return false
}

function productName(nameLine: string): string {
  let name = nameLine.split('|')[0]
  name = name.replace(/\b(skupni znesek|skupaj|znesek)\b.*$/i, '')
  name = name.replace(/\s*[:\-]\s*\d[\d\s.,]*\s*(?:ar|ariary|mga|m)?\s*$/i, '')
  name = name.replace(/^\s*naziv artikla\s*:\s*/i, '')
  return name.trim().replace(/[, ]+$/g, '')
}

function amountFromBlock(lines: string[]): number | null {
  for (const line of lines) {
    const folded = fold(line)
    if (/cena na enoto|popust|kolicina/.test(folded) && !/skupaj|znesek/.test(folded)) continue
    const labeled = line.match(/(?:skupni znesek[^:]*|skupaj|znesek)\s*:\s*(.+)$/i)
    if (!labeled || /brez ddv|\bht\b|popust/.test(folded)) continue
    const amount = moneyFrom(labeled[1], true)
    if (amount) return amount
  }
  for (const line of lines) {
    if (/cena na enoto/.test(fold(line)) && /davk|ttc|\bar\b|mga/.test(fold(line))) {
      const labeled = line.match(/:\s*(.+)$/)
      const amount = labeled ? moneyFrom(labeled[1], true) : null
      if (amount) return amount
    }
  }
  const trail = lines[0].match(/(?::|-)\s*([0-9][^:-]*)$/)
  if (!trail) return null
  return moneyFrom(trail[1], true)
}

// Postavka in znesek nista vedno v isti obliki: nekje je "Znesek:", drugje
// "Skupaj:", "12 000" na koncu vrstice ali znesek v naslednji vrstici.
function looseReceiptLines(text: string): { line: string; amount: number; category: StrosekCategory }[] | null {
  const blocks: { name: string; lines: string[] }[] = []
  let current: { name: string; lines: string[] } | null = null
  const close = () => {
    if (current) blocks.push(current)
    current = null
  }

  const itemText = (raw: string) => raw.replace(/\*\*/g, '').replace(/^\s*(?:[-*•]|\d+\.)\s+/, '').trim()
  const hasMarker = (raw: string) => /^\s*(?:[-*•]|\d+\.)\s+/.test(raw.replace(/\*\*/g, ''))

  for (const rawLine of text.split(/\r?\n/)) {
    const line = itemText(rawLine)
    if (!line) continue
    const folded = fold(line)
    if (/^(postavke|zneski|povzetek)\b/.test(folded)) {
      close()
      continue
    }
    if (isInvoiceFooter(folded) || isCancelled(line)) {
      close()
      continue
    }
    const label = isFieldLabel(line)
    const lineTotal = /^skupaj\b/.test(folded)
    if (current && (label || lineTotal)) {
      current.lines.push(line)
      continue
    }
    if (hasMarker(rawLine) && !label && !lineTotal) {
      close()
      current = { name: line, lines: [line] }
      continue
    }
    close()
  }
  close()

  const rows: { line: string; amount: number; category: StrosekCategory }[] = []
  for (const block of blocks) {
    const amount = amountFromBlock(block.lines)
    const name = productName(block.name)
    if (!name || !amount || isCancelled(name)) continue
    rows.push({ line: name, amount, category: classifyReceiptLine(name) })
  }
  return rows.length > 0 ? rows : null
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
  const market = marketReceiptLines(text)
  if (market) return market
  const priced = pricedReceiptLines(text)
  if (priced) return priced
  const loose = looseReceiptLines(text)
  if (loose) return loose
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
