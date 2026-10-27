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
// Prvi Jungle Glamp ostane shranjen kot "Jungle Glamp Village" (stabilen id),
// na karticah in povsod, kjer se ime prikazuje, pa pise "Jungle Glamp Village I".
const BUNGALOW_DISPLAY_NAMES: Record<string, string> = {
  'ocean-iv': 'Bungalow IV - Beach Villa',
  'jungle': 'Jungle Glamp Village I',
  'jungle-ii': 'Jungle Glamp Village II',
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

// Distinct bungalow names for guest-facing copy when Bentral repeats the same unit
// across rate segments (semicolon-separated). Each physical unit appears once; two
// different units are joined with ", ".
export function bungalowDistinctDisplayNames(raw: string | null | undefined): string {
  if (!raw) return ''
  const seen = new Set<string>()
  const names: string[] = []
  for (const seg of raw.split(';').map((s) => s.trim()).filter(Boolean)) {
    const key = segmentKey(seg)
    if (seen.has(key)) continue
    seen.add(key)
    const special = BUNGALOW_DISPLAY_NAMES[key]
    names.push(special || cleanSingleName(seg))
  }
  return names.join(', ')
}

// Normaliziran kljuc enote za ROBUSTNO ujemanje razlicnih zapisov istega bungalova.
// Bentral zapise npr. "Ocean Bungalov I – za 4 / Ocean Bungalov I – za 4 (4+0)",
// aplikacija pa uporablja kratke angleske nazive "Ocean Bungalow I".
// Vrne npr. "ocean-i", "garden-iii", "ocean-iv", "jungle", "jungle-ii".
// "jungle" ostane kljuc prvega Glampa (tudi brez rimske stevilke), da stare
// rezervacije se vedno kazejo na enoto I. "jungle-ii" je nova enota.
export function bungalowKey(raw: string | null | undefined): string {
  const s = bungalowLabel(raw)
    .toLowerCase()
    .replace(/bungalov/g, 'bungalow')
  return unitKeyFromNormalized(s)
}

// Normaliziran kljuc iz ENEGA segmenta (brez razdelitve po ';').
function segmentKey(seg: string): string {
  const s = (seg.split('/')[0] || seg)
    .trim()
    .toLowerCase()
    .replace(/bungalov/g, 'bungalow')
  return unitKeyFromNormalized(s)
}

function unitKeyFromNormalized(s: string): string {
  if (s.includes('jungle') || s.includes('glamp')) {
    if (/\bii\b/.test(s)) return 'jungle-ii'
    return 'jungle'
  }
  const type = s.includes('garden') ? 'garden' : s.includes('ocean') ? 'ocean' : 'other'
  // rimska stevilka kot samostojna beseda (daljse pred krajsimi)
  const roman = s.match(/\b(viii|vii|vi|iv|iii|ii|i|v)\b/)
  return `${type}-${roman ? roman[1] : '?'}`
}

// Ime na rezervacijski kartici. Ostali bungalovi ostanejo tocno taksni, kot so.
// Prvi Glamp ima stabilen id "Jungle Glamp Village", kartica pa pise "... I".
export function bungalowCardLabel(unitId: string): string {
  if (unitId === 'Jungle Glamp Village' || unitId === 'Jungle Glamp Village II') {
    return bungalowDisplayName(unitId)
  }
  return unitId
}

// Ali rezervacija pripada tej nastanitveni enoti. "Ocean Bungalow I" ne ujame "II"/"IV".
// Shranjen "Jungle Glamp Village" (in izrecen "... I" ali Bentralovo "... 1") pripada prvi enoti.
// Bentralovo "Jungle Glamp Village 2" je druga enota. Ce ista rezervacija ze vsebuje
// obe (npr. VITOGAZ), ostane na I in se doda se na II. Samo "2" brez prve enote
// se ne prestavi, da drugi gostje ostanejo, kjer so.
export function reservationMatchesBungalow(reservationBungalow: string | null | undefined, unitId: string): boolean {
  const hay = String(reservationBungalow || '')
    .toLowerCase()
    .replace(/bungalov\b/g, 'bungalow')
    .replace(/\s+/g, ' ')
  if (bungalowUnitPattern(unitId).test(hay)) return true
  const n = unitId.toLowerCase().replace(/bungalov\b/g, 'bungalow').replace(/\s+/g, ' ').trim()
  if (n !== 'jungle glamp village ii') return false
  const glamp = glampUnitsIn(hay)
  return glamp.has('i') && glamp.has('ii')
}

function glampUnitsIn(hay: string): Set<'i' | 'ii'> {
  const units = new Set<'i' | 'ii'>()
  const parts = hay
    .split(/[;/]/)
    .map(part => part.replace(/\(\d+\+\d+\)/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  for (const part of parts) {
    if (!part.includes('jungle') && !part.includes('glamp')) continue
    // Bentral repeats the bare name before "/", so only an explicit 1 or 2 counts.
    // "(2+0)" is stripped above and must not look like unit 2.
    if (/\bvillage\s+(ii|2)\b/.test(part)) units.add('ii')
    else if (/\bvillage\s+(i|1)\b/.test(part)) units.add('i')
  }
  return units
}

function bungalowUnitPattern(unitId: string): RegExp {
  const n = unitId.toLowerCase().replace(/bungalov\b/g, 'bungalow').replace(/\s+/g, ' ').trim()
  const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // Brez stevilke je ime predpona "... Village II". Meja besede za "village"
  // bi drugo enoto pripisala prvi, zato II izlocimo, izrecen " I" pa ostane.
  if (n === 'jungle glamp village') {
    return new RegExp(`\\b${escaped}(?:\\s+i)?\\b(?!\\s*ii\\b)`, 'i')
  }
  return new RegExp(`\\b${escaped}\\b`, 'i')
}

const STAY_UNIT_LABELS: Record<string, string> = {
  'ocean-i': 'Ocean Bungalow I',
  'ocean-ii': 'Ocean Bungalow II',
  'garden-iii': 'Garden Bungalow III',
  'ocean-iv': 'Ocean Bungalow IV',
  'jungle': 'Jungle Glamp Village I',
  'jungle-ii': 'Jungle Glamp Village II',
}

// Physical units on one booking, in the order Bentral lists them. A glamp
// written as "Village 1" and "Village 2" stays two units. Card names are unchanged.
export function stayUnits(raw: string | null | undefined): { key: string; label: string }[] {
  if (!raw) return []
  const seen = new Set<string>()
  const units: { key: string; label: string }[] = []
  const add = (key: string) => {
    if (!key || seen.has(key)) return
    seen.add(key)
    units.push({ key, label: STAY_UNIT_LABELS[key] || key })
  }
  for (const seg of raw.split(';').map(s => s.trim()).filter(Boolean)) {
    const full = seg.toLowerCase().replace(/bungalov/g, 'bungalow')
    if (full.includes('jungle') || full.includes('glamp')) {
      const parts = full.split('/').map(p => p.replace(/\(\s*\d+\s*\+\s*\d+\s*\)/g, ' ').replace(/\s+/g, ' ').trim())
      let numbered = false
      for (const part of parts) {
        if (/\bvillage\s+ii\b/.test(part) || /\bvillage\s+2\b/.test(part)) {
          add('jungle-ii')
          numbered = true
        } else if (/\bvillage\s+i\b/.test(part) || /\bvillage\s+1\b/.test(part)) {
          add('jungle')
          numbered = true
        }
      }
      if (!numbered) add('jungle')
      continue
    }
    add(segmentKey(seg))
  }
  return units
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
