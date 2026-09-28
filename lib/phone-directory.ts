// Borutov telefonski imenik — isti stiki kot ploščice na Borutovi domači strani
// (app/page.tsx). Uporablja se za razreševanje prejemnikov Orange Money nakazil.
// Številke hranimo v lokalni obliki (vodilna 0); ujemanje teče po zadnjih 9 številkah
// (nacionalna številka), da +261 / 0 predpone ne motijo.

export type Contact = { name: string; number: string }

export const PHONE_DIRECTORY: Contact[] = [
  { name: 'Dilip', number: '0324800513' },
  { name: 'Herman', number: '0325604665' },
  { name: 'Fanja', number: '0327490280' },
  { name: 'Amad', number: '0325674276' },
  { name: 'Vanilija', number: '0326769290' },
  { name: 'Koko', number: '0325662267' },
]

/** Zadnjih 9 številk (nacionalna značilna številka) za robustno ujemanje. */
export function normalizeMgNumber(raw: string): string {
  return raw.replace(/\D/g, '').slice(-9)
}

/**
 * Vrne ime stika za dano telefonsko številko, ali null če ni v imeniku.
 * Če je podan `contacts` (npr. iz baze / urejljivega imenika), se uporabi ta
 * seznam; sicer pade nazaj na privzeti PHONE_DIRECTORY.
 */
export function resolveContactName(
  number: string,
  contacts: Contact[] = PHONE_DIRECTORY,
): string | null {
  const key = normalizeMgNumber(number)
  if (!key) return null
  const hit = contacts.find((c) => normalizeMgNumber(c.number) === key)
  return hit ? hit.name : null
}
