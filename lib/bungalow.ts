// Pomozne funkcije za prikaz naziva nastanitvene enote (bungalova).
// Naziv iz Bentrala je pogosto sestavljen niz z vec segmenti, npr.
//   "Garden Bungalov III / Garden Bungalov III (2+0); Garden Bungalov III / Garden Bungalov III (2+0)"
// Te funkcije iz njega izpeljejo cist, kratek prikaz.

// Cist, kratek naziv enote: vzame prvi segment (pred ';' in '/') brez ponovitev.
export function bungalowLabel(raw: string | null | undefined): string {
  if (!raw) return ''
  const first = raw.split(';')[0]?.split('/')[0]?.trim()
  return first || raw.trim()
}

// Posebna prikazna imena bungalovov (marketinski/gostom prijazni nazivi).
// Kljuci so bungalowKey (glej spodaj). Kar ni v tabeli, uporabi ocisceno ime.
const BUNGALOW_DISPLAY_NAMES: Record<string, string> = {
  'ocean-iv': 'Bungalow IV - Beach Villa',
}

// Ocisceno ENKRATNO ime enote za prikaz gostu (brez podvajanja in "- za N").
// Bentral shrani npr. "Ocean Bungalow IV - za 4 / Ocean Bungalow IV" -> "Ocean Bungalow IV".
function cleanSingleName(raw: string | null | undefined): string {
  if (!raw) return ''
  const base = raw.split(';')[0] || raw
  const parts = base.split('/').map(p => p.trim()).filter(Boolean)
  const name = parts.length > 1 ? parts[parts.length - 1] : parts[0] || base
  const cleaned = name
    // odstrani pripono sestave gostov, npr. "(4+0)", "(2+1)"
    .replace(/\s*\(\d+\+\d+\)\s*$/g, '')
    // odstrani "- za N" / "– za N" / "— za N" (razlicni pomisljaji)
    .replace(/\s*[-–—]\s*za\s+\d+\s*$/i, '')
    .trim()
  return cleaned || base.trim()
}

// Prikazno ime bungalova za VSE poglede v aplikaciji (racun, email, seznami, ...).
// Ce ima enota poseben naziv (npr. Ocean Bungalow IV -> "Bungalow IV - Beach Villa"),
// vrne tega; sicer vrne ocisceno enkratno ime.
export function bungalowDisplayName(raw: string | null | undefined): string {
  if (!raw) return ''
  const special = BUNGALOW_DISPLAY_NAMES[bungalowKey(raw)]
  if (special) return special
  return cleanSingleName(raw)
}

// Normaliziran kljuc enote za ROBUSTNO ujemanje razlicnih zapisov istega bungalova.
// Bentral zapise npr. "Ocean Bungalov I – za 4 / Ocean Bungalov I – za 4 (4+0)",
// aplikacija pa uporablja kratke angleske nazive "Ocean Bungalow I".
// Vrne npr. "ocean-i", "garden-iii", "ocean-iv", "jungle".
export function bungalowKey(raw: string | null | undefined): string {
  const s = bungalowLabel(raw)
    .toLowerCase()
    .replace(/bungalov/g, 'bungalow')
  if (s.includes('jungle') || s.includes('glamp')) return 'jungle'
  const type = s.includes('garden') ? 'garden' : s.includes('ocean') ? 'ocean' : 'other'
  // rimska stevilka kot samostojna beseda (daljse pred krajsimi)
  const roman = s.match(/\b(viii|vii|vi|iv|iii|ii|i|v)\b/)
  return `${type}-${roman ? roman[1] : '?'}`
}

// Normaliziran kljuc iz ENEGA segmenta (brez razdelitve po ';').
function segmentKey(seg: string): string {
  const s = (seg.split('/')[0] || seg)
    .trim()
    .toLowerCase()
    .replace(/bungalov/g, 'bungalow')
  if (s.includes('jungle') || s.includes('glamp')) return 'jungle'
  const type = s.includes('garden') ? 'garden' : s.includes('ocean') ? 'ocean' : 'other'
  const roman = s.match(/\b(viii|vii|vi|iv|iii|ii|i|v)\b/)
  return `${type}-${roman ? roman[1] : '?'}`
}

// VSI kljuci enot v sestavljenem nizu (rezervacija cez VEC bungalovov).
// Bentral loci vec bungalovov s ';', npr.
//   "Ocean Bungalow II / Ocean Bungalow II (2+0); Garden Bungalov III"
// -> ["ocean-ii", "garden-iii"]. Ponovitve odstranjene.
export function bungalowKeys(raw: string | null | undefined): string[] {
  if (!raw) return []
  const keys = raw
    .split(';')
    .map(seg => seg.trim())
    .filter(Boolean)
    .map(segmentKey)
  return Array.from(new Set(keys))
}

// Kratka znacka za kvadratek: rimska/arabska oznaka enote (npr. "III", "2"),
// sicer zacetnice besed (npr. "GB"). Nikoli ne vrne sestavljenega niza stevilk.
export function bungalowBadge(raw: string | null | undefined): string {
  const label = bungalowLabel(raw)
  if (!label) return 'B'
  // koncna rimska stevilka ali stevilo, npr. "Garden Bungalov III" -> "III", "Bungalow 2" -> "2"
  const trailing = label.match(/\b([IVXLCDM]+|\d+)\s*$/i)
  if (trailing) return trailing[1].toUpperCase()
  // sicer prve arabske stevilke kjerkoli
  const digits = label.replace(/\D/g, '')
  if (digits) return digits
  // sicer zacetnice besed
  return label
    .split(/\s+/)
    .map(w => w[0])
    .join('')
    .slice(0, 3)
    .toUpperCase()
}
