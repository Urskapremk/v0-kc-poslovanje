// Converts an item/product name to English for display on the delivery note
// and the "Postavke za placilo" reception view. Mirrors the invoice (racun)
// word map so all documents read the same. Slovenian meal names are stored as
// dual-language "Slovensko / English" (e.g. "Zajtrk / Breakfast"); after word
// replacement they become "Breakfast / Breakfast" and are collapsed to one word.
// Multi-word phrases first (longest / most specific), then single words.
const EN_WORD_MAP: Record<string, string> = {
  'Monoporcijska sladica': 'Single-portion dessert',
  'Sladoled kepica': 'Ice cream scoop',
  'Pravnje perila': 'Laundry',
  'Pranje perila': 'Laundry',
  'Polni penzion': 'Full Board',
  Bivanje: 'Accommodation',
  noci: 'nights',
  'noči': 'nights',
  oseb: 'persons',
  dni: 'days',
  Skupaj: 'Total',
  Placano: 'Paid',
  'Plačano': 'Paid',
  kartica: 'card',
  gotovina: 'cash',
  nakazilo: 'transfer',
  Zajtrk: 'Breakfast',
  Polpenzion: 'Half Board',
  Kosilo: 'Lunch',
  Vecerja: 'Dinner',
  'Večerja': 'Dinner',
}

export function toEnglishItemName(name: string | null | undefined): string {
  if (!name) return ''
  let out = name
  for (const [sl, tr] of Object.entries(EN_WORD_MAP)) {
    out = out.replace(new RegExp(`\\b${sl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'), tr)
  }
  // Collapse dual-language meal names ("Slovensko / English"). After word
  // replacement the two halves match, e.g. "Breakfast / Breakfast" or
  // "Full Board / Full Board (FB)" -> keep only the English half.
  const slash = out.split(' / ')
  if (slash.length === 2) {
    const left = slash[0].trim()
    const right = slash[1].trim()
    if (right === left || right.startsWith(left)) out = right
  }
  return out
}
