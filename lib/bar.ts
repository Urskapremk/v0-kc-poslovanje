// Bar schedule logic — 4 staff, 3 shifts + day off.
//
// Staff:
//   Alex   (M)  — rotates morning / evening / off
//   Fransia(F)  — ALWAYS midday when working (poor English, stays mid-shift)
//   Sandia (F)  — morning / midday / off (NEVER evening: evening is single-person,
//                 and a girl must not work the evening shift alone)
//   Walas  (M)  — rotates morning / evening / off
//
// Shifts: MORNING 6-12, MIDDAY 11-17, EVENING 16-22 (each 6 h) + OFF.
// Every day all three shifts are covered and exactly one person is off.
// The evening shift is always a boy (Alex or Walas) so the lone evening worker
// is never a woman. Day off rotates fairly through all four on a 4-day cycle.

// Jonny (M) — pripravnik SAMO avgust 2026; ODŠEL (ni več pri nas). Avgustovske
// evidence ostajajo (BAR_MANUAL_OVERRIDES/EXTRA), a od septembra 2026 NI več v
// razporedu (glej getActiveBarStaff). Delal je vse smene prek ročnih razporeditev.
// Justin — NI barsko osebje (dela v KUHINJI, glej lib/kitchen.ts). Ostaja v tipu
// BAR_STAFF le zaradi zdruzljivosti, a se NIKOLI ne prikaze v baru.
export const BAR_STAFF = ['Alex', 'Fransia', 'Sandia', 'Walas', 'Jonny', 'Justin'] as const
export type BarStaff = (typeof BAR_STAFF)[number]

// Študenti na praksi, dodeljeni v bar (iz seznama osebja, employmentType
// 'stagiaire', allocateTo 'bar'). Od septembra 2026 so POLNO v rotaciji smen:
// pomagajo v vseh treh smenah (tedensko rotiranje) in imajo 6 dni delo + 1 prost.
export const BAR_STUDENTS = ['Flavienne Winjisna', 'Brigida Aoulati', 'Maria Franclise Soanatera'] as const

// Aktivni nabor bara za dani mesec (vrstni red prikaza). Jedro Alex/Fransia/
// Sandia/Walas vedno. Jonny le do vkljucno avgusta 2026 (potem odsel). Justin
// nikoli (kuhinjski student, po pomoti dodan v bar). Barski študenti od
// septembra 2026 naprej (glej usesSepPattern / BAR_STUDENTS).
export function getActiveBarStaff(year: number, month: number): string[] {
  const fransiaActive = year < 2026 || (year === 2026 && month <= 9)
  const core: string[] = fransiaActive ? ['Alex', 'Fransia', 'Sandia', 'Walas'] : ['Alex', 'Sandia', 'Walas']
  const jonnyActive = year < 2026 || (year === 2026 && month <= 8)
  const withJonny = jonnyActive ? [...core, 'Jonny'] : core
  const students = year > 2026 || (year === 2026 && month >= 9) ? [...BAR_STUDENTS] : []
  return [...withJonny, ...students]
}

export type BarShift = 'MORNING' | 'MIDDAY' | 'EVENING' | 'OFF'

export const SHIFT_LABELS: Record<BarShift, string> = {
  MORNING: 'Jutro 6-12:30',
  MIDDAY: 'Opoldne 11-17',
  EVENING: 'Večer 15:30-22',
  OFF: 'Prosto',
}

export const SHIFT_LABELS_FR: Record<BarShift, string> = {
  MORNING: 'Matin 6h-12h30',
  MIDDAY: 'Midi 11h-17h',
  EVENING: 'Soir 15h30-22h',
  OFF: 'Repos',
}

// Hours credited per shift (base: all shifts are 6 hours). Od septembra 2026
// jutranja (6-12:30) in večerna (15:30-22) smena trajata 6,5 ure — glej
// shiftHoursFor. Opoldne (11-17) ostane 6 ur.
export const SHIFT_HOURS: Record<BarShift, number> = {
  MORNING: 6,
  MIDDAY: 6,
  EVENING: 6,
  OFF: 0,
}

// Kreditirane ure za smeno na dani datum. Od septembra 2026 naprej jutranja in
// večerna smena štejeta 6,5 ure (delajo pol ure dlje); pred tem (avgust in prej)
// vse smene 6 ur. Opoldne je vedno 6 ur.
export function shiftHoursFor(shift: BarShift, dateStr: string): number {
  if (shift === 'OFF') return 0
  const [y, m] = dateStr.split('-').map(Number)
  const sepPlus = y > 2026 || (y === 2026 && m >= 9)
  if (sepPlus && (shift === 'MORNING' || shift === 'EVENING')) return 6.5
  return SHIFT_HOURS[shift] ?? 0
}

// A short extra segment added on top of the main shift (split shift) to top up
// monthly hours toward the norm. From Aug 2-18 the evening worker also does the
// breakfast 7-9h and the morning worker also does the evening 19-21h.
export interface BarExtra {
  hours: number
  label: string // Slovenian, e.g. "Zajtrk 7-9"
  labelFr: string // French, e.g. "Petit-déj 7h-9h"
}

export const BREAKFAST_EXTRA: BarExtra = { hours: 2, label: 'Zajtrk 7-9', labelFr: 'Petit-déj 7h-9h' }
export const EVENING_EXTRA: BarExtra = { hours: 2, label: 'Večer 19-21', labelFr: 'Soir 19h-21h' }
// Full midday shift worked as an extra on a day off (so the schedule still shows
// "Prosto" for payroll, with the worked shift added on top).
export const MIDDAY_EXTRA: BarExtra = { hours: 6, label: 'Opoldne 11-17', labelFr: 'Midi 11h-17h' }
// Pomožna (druga) smena, ko nekdo že dela eno smeno in pride pomagat še na drugo.
// Pravilo uporabnice: če pride pomagat ZJUTRAJ, dela samo 6-9 (3h); če dela celo
// jutranjo in pride pomagat ZVEČER, dela 18-22 (4h). NISO polne 6-urne smene.
export const MORNING_HELP: BarExtra = { hours: 3, label: 'Jutro 6-9', labelFr: 'Matin 6h-9h' }
export const EVENING_HELP: BarExtra = { hours: 4, label: 'Večer 18-22', labelFr: 'Soir 18h-22h' }
// Opoldanska pomoč 12-15 (3h), ko nekdo pride pomagat sredi dneva poleg druge smene.
export const MIDDAY_HELP: BarExtra = { hours: 3, label: 'Opoldne 12-15', labelFr: 'Midi 12h-15h' }

export interface BarDay {
  date: string // YYYY-MM-DD
  assignments: Record<string, BarShift>
  // Optional extra split-shift segments per person (added to the main shift hours).
  extras?: Record<string, BarExtra[]>
}

// Extra segments for a person on a day (empty if none).
export function barExtrasFor(day: BarDay, person: string): BarExtra[] {
  return day.extras?.[person] ?? []
}

// Total hours credited to a person on a day: main shift + any extra segments.
export function barDayHours(day: BarDay, person: string): number {
  const shift = (day.assignments[person] || 'OFF') as BarShift
  const extra = barExtrasFor(day, person).reduce((s, e) => s + e.hours, 0)
  return shiftHoursFor(shift, day.date) + extra
}

// Whether the shift-based breakfast/evening top-up window applies for this date.
// Weekly-off months (Aug 2026+), day-of-month 2..18 inclusive: the evening worker
// also does breakfast 7-9h and the morning worker also does evening 19-21h.
function usesHourTopUp(year: number, month: number, day: number): boolean {
  // August-only ramp-up window (not September+, which has its own pattern).
  return year === 2026 && month === 8 && day >= 2 && day <= 18
}

// Whether the named-helper window applies: Aug 24-29 (weekly-off months).
// Fransia helps at breakfast 7-9h and Sandia at dinner 19-21h — but only on the
// days they are actually scheduled to work (not OFF).
function usesNamedHelperWindow(year: number, month: number, day: number): boolean {
  // August-only window (not September+, which has its own pattern).
  return year === 2026 && month === 8 && day >= 24 && day <= 29
}

// Manual per-date overrides: force a worker onto a specific MAIN shift even if the
// rotation would give them the day off. (People who come in on their day off are
// handled via BAR_MANUAL_EXTRA_OVERRIDES so the schedule still shows "Prosto".)
const BAR_MANUAL_OVERRIDES: Record<string, Partial<Record<BarStaff, BarShift>>> = {
  // 1. avgust 2026: še ni gostov → brez večerne smene, nihče prost.
  // 2 zjutraj (Alex, Walas) + Jonny dopoldan = 3 v jutranji smeni;
  // 2 popoldan (Fransia, Sandia) = opoldanska smena.
  '2026-08-01': {
    Alex: 'MORNING',
    Walas: 'MORNING',
    Jonny: 'MORNING',
    Fransia: 'MIDDAY',
    Sandia: 'MIDDAY',
  },
  // 2.–7. avgust 2026 (do vključno jutra 7.8.): vsak dan 2 jutro / 2 opoldne / 2 večer,
  // nihče prost. Fransia + Sandia vedno opoldne; večer vedno 2 fanta. Ker je 6 mest, a
  // le 5 ljudi, en fant dela DVOJNO smeno (jutro glavno + poln večer kot dodatek,
  // EVENING_FULL_EXTRA v BAR_MANUAL_EXTRA_OVERRIDES). Dvojno smeno rotiramo pošteno
  // med Alex/Walas/Jonny (vsak dvakrat). Glavne smene: doubler=MORNING, jutranji
  // fant=MORNING, večerni fant=EVENING.
  // 2.8. IZJEMA: Fransia PROSTA, Sandia SAMA opoldne (ostalo isto: Alex+Jonny jutro, Walas večer, Jonny večerna pomoč).
  '2026-08-02': { Jonny: 'MORNING', Alex: 'MORNING', Walas: 'EVENING', Sandia: 'MIDDAY', Fransia: 'OFF' }, // doubler Jonny; Fransia prosta
  '2026-08-03': { Alex: 'MORNING', Walas: 'MORNING', Jonny: 'EVENING', Fransia: 'MIDDAY', Sandia: 'MIDDAY' }, // doubler Alex
  '2026-08-04': { Walas: 'MORNING', Jonny: 'MORNING', Alex: 'EVENING', Fransia: 'MIDDAY', Sandia: 'MIDDAY' }, // doubler Walas
  '2026-08-05': { Jonny: 'MORNING', Alex: 'MORNING', Walas: 'EVENING', Fransia: 'MIDDAY', Sandia: 'MIDDAY' }, // doubler Jonny
  '2026-08-06': { Alex: 'MORNING', Walas: 'MORNING', Jonny: 'EVENING', Fransia: 'MIDDAY', Sandia: 'MIDDAY' }, // doubler Alex
  '2026-08-07': { Walas: 'MORNING', Jonny: 'MORNING', Alex: 'EVENING', Fransia: 'MIDDAY', Sandia: 'MIDDAY' }, // doubler Walas (jutro pokrito; popoldne/večer 7.8. po naslednjem naročilu)
  // 8. avgust 2026: Jonny IN Sandia PROSTA (oba prosta) → delajo samo 3 (Alex, Walas,
  // Fransia). Fransia SAMA opoldne; Walas polna večerna 16-22 + jutranja pomoč zajtrk 6-9;
  // Alex cela jutranja 6-12 + večerna pomoč 18-22 (simetrična medsebojna pomoč Alex↔Walas).
  '2026-08-08': { Alex: 'MORNING', Walas: 'EVENING', Fransia: 'MIDDAY', Jonny: 'OFF', Sandia: 'OFF' },
  // 9. avgust 2026: Alex PROST (edini prost). Fransia + Sandia opoldne; simetrična
  // medsebojna pomoč Walas↔Jonny: Jonny dela celo jutranjo (6-12) + večerna pomoč
  // 18-22; Walas dela polno večerno smeno (16-22) + jutranja pomoč na zajtrk 6-9.
  '2026-08-09': { Jonny: 'MORNING', Walas: 'EVENING', Fransia: 'MIDDAY', Sandia: 'MIDDAY', Alex: 'OFF' },
  // 10. avgust 2026: NAJVEČ gostov, vsi delajo (NIHČE prost). 2 zjutraj (Alex + Jonny),
  // 2 opoldne (Fransia + Sandia), večer s fantom (Walas polna 16-22). Fanta si pomagata:
  // Jonny (cela jutranja) pride pomagat zvečer 18-22, Walas (poln večer) pride na zajtrk 6-9.
  '2026-08-10': { Alex: 'MORNING', Jonny: 'MORNING', Walas: 'EVENING', Fransia: 'MIDDAY', Sandia: 'MIDDAY' },
  // 11. avgust 2026: Walas PROST (edini prost). Fransia + Sandia opoldne; simetrična
  // medsebojna pomoč Alex↔Jonny: Alex dela polno večerno smeno (16-22) + jutranja pomoč
  // na zajtrk 6-9; Jonny dela celo jutranjo (6-12) + večerna pomoč 18-22.
  '2026-08-11': { Jonny: 'MORNING', Alex: 'EVENING', Fransia: 'MIDDAY', Sandia: 'MIDDAY', Walas: 'OFF' },
  // 12. avgust 2026: Fransia PROSTA (edina prosta). Sandia SAMA opoldne; Alex dela polno
  // večerno smeno (16-22); Walas + Jonny jutro. Medsebojna pomoč Alex↔Jonny: Jonny (cela
  // jutranja) pomaga zvečer 18-22, Alex (poln večer) pomaga na zajtrk 6-9. Walas samo jutro.
  '2026-08-12': { Walas: 'MORNING', Jonny: 'MORNING', Alex: 'EVENING', Sandia: 'MIDDAY', Fransia: 'OFF' },
  // 13.–16. avgust 2026: vsi delajo (NIHČE prost), enak vzorec kot 10.8. — 2 zjutraj
  // (Alex + Jonny), 2 opoldne (Fransia + Sandia), Walas polna večerna 16-22; Jonny (cela
  // jutranja) pomaga zvečer 18-22 (EVENING_HELP spodaj). Walas BREZ jutranje pomoči.
  '2026-08-13': { Alex: 'MORNING', Jonny: 'MORNING', Walas: 'EVENING', Fransia: 'MIDDAY', Sandia: 'MIDDAY' },
  '2026-08-14': { Alex: 'MORNING', Jonny: 'MORNING', Walas: 'EVENING', Fransia: 'MIDDAY', Sandia: 'MIDDAY' },
  '2026-08-15': { Alex: 'MORNING', Jonny: 'MORNING', Walas: 'EVENING', Fransia: 'MIDDAY', Sandia: 'MIDDAY' },
  '2026-08-16': { Alex: 'MORNING', Jonny: 'MORNING', Walas: 'EVENING', Fransia: 'MIDDAY', Sandia: 'MIDDAY' },
  // 18. avgust 2026: Sandia PROSTA (edina prosta). Fransia + Jonny opoldne; SAMO Walas
  // zjutraj (cela jutranja 6-12); Alex polna večerna 16-22 + Walas pride pomagat zvečer
  // 18-22 (EVENING_HELP spodaj). Torej Walas = jutro + večerna pomoč.
  '2026-08-18': { Walas: 'MORNING', Jonny: 'MIDDAY', Alex: 'EVENING', Fransia: 'MIDDAY', Sandia: 'OFF' },
  // 19. avgust 2026: Walas PROST (edini prost), ostalo kot po navadi (enak vzorec kot
  // 11.8.): Fransia + Sandia opoldne; simetrična medsebojna pomoč Alex↔Jonny — Jonny cela
  // jutranja 6-12 + večerna pomoč 18-22; Alex polna večerna 16-22 + jutranja pomoč zajtrk 6-9.
  '2026-08-19': { Jonny: 'MORNING', Alex: 'EVENING', Fransia: 'MIDDAY', Sandia: 'MIDDAY', Walas: 'OFF' },
  // 20. avgust 2026: Alex PROST (edini prost), ostali po istem sistemu (enak vzorec kot
  // 9.8.): Fransia + Sandia opoldne; simetrična medsebojna pomoč Walas↔Jonny — Jonny cela
  // jutranja 6-12 + večerna pomoč 18-22; Walas polna večerna 16-22 + jutranja pomoč zajtrk 6-9.
  '2026-08-20': { Jonny: 'MORNING', Walas: 'EVENING', Fransia: 'MIDDAY', Sandia: 'MIDDAY', Alex: 'OFF' },
  // 21. avgust 2026: Fransia PROSTA in Jonny PROST (oba prosta). Sandia SAMA opoldne; Alex
  // večer 16-22, Walas jutro 6-12. Brez pomoči/dodatkov.
  '2026-08-21': { Alex: 'EVENING', Walas: 'MORNING', Sandia: 'MIDDAY', Jonny: 'OFF', Fransia: 'OFF' },
  // 22. avgust 2026: Jonny OPOLDNE (k Fransii), vse ostalo kot samodejna rotacija tega dne
  // (Alex večer 16-22, Fransia opoldne, Walas jutro 6-12, Sandia prosta). Brez pomoči/dodatkov.
  '2026-08-22': { Alex: 'EVENING', Fransia: 'MIDDAY', Jonny: 'MIDDAY', Walas: 'MORNING', Sandia: 'OFF' },
  // 23. avgust 2026: Jonny OPOLDNE (k Fransii), vse ostalo kot samodejna rotacija tega dne
  // (Alex večer 16-22, Fransia opoldne, Sandia jutro 6-12, Walas prost). Brez pomoči/dodatkov.
  '2026-08-23': { Alex: 'EVENING', Fransia: 'MIDDAY', Jonny: 'MIDDAY', Sandia: 'MORNING', Walas: 'OFF' },
  // 25. avgust 2026: Jonny pomaga na ZAJTRK (6-9) IN VEČERJO (18-22) — glavna smena
  // Prosto, samo dve pomoči (spodaj v EXTRA). Fransia SAMA opoldne, Sandia SAMO opoldne
  // (par opoldne). Glavni smeni: Walas jutro 6-12, Alex večer 16-22. Ta ročni dan
  // preskoči samodejno imensko okno 24-29 (Fransia zajtrk / Sandia večerja) — pomoč prevzame Jonny.
  '2026-08-25': { Alex: 'EVENING', Walas: 'MORNING', Fransia: 'MIDDAY', Sandia: 'MIDDAY', Jonny: 'OFF' },
  // 26. avgust 2026: ENAKO kot 25.8. — Jonny pomaga na zajtrk (6-9) IN večerjo (18-22),
  // glavna smena Prosto. Fransia + Sandia samo opoldne; Walas jutro 6-12, Alex večer 16-22.
  '2026-08-26': { Alex: 'EVENING', Walas: 'MORNING', Fransia: 'MIDDAY', Sandia: 'MIDDAY', Jonny: 'OFF' },
  // 27. avgust 2026: ENAKO kot 25./26.8. — Jonny pomaga na zajtrk (6-9) IN večerjo (18-22),
  // glavna smena Prosto. Fransia + Sandia samo opoldne; Walas jutro 6-12, Alex večer 16-22.
  '2026-08-27': { Alex: 'EVENING', Walas: 'MORNING', Fransia: 'MIDDAY', Sandia: 'MIDDAY', Jonny: 'OFF' },
  // 28. avgust 2026: Jonny pomaga na ZAJTRK (6-9) IN OPOLDNE (12-15) — glavna smena Prosto
  // (pomoči spodaj v EXTRA). Ostali "kot so" (samodejna rotacija tega dne): Alex jutro 6-12,
  // Fransia PROSTA, Sandia opoldne + večerja 19-21, Walas večer 16-22. Sandiina večerja 19-21
  // je bila samodejna (imensko okno 24-29); ker je to zdaj ročni dan, ji jo izrecno ohranimo v EXTRA.
  '2026-08-28': { Alex: 'MORNING', Walas: 'EVENING', Sandia: 'MIDDAY', Jonny: 'OFF', Fransia: 'OFF' },
  // 29. avgust 2026: Alex IN Walas PROSTA (oba prosta) → delajo samo 3 (Jonny, Fransia,
  // Sandia). Jonny JUTRO 6-12 (namesto Alexa, ker je prost); Fransia opoldne; Sandia VEČER
  // 16-22. Brez pomoči/dodatkov.
  '2026-08-29': { Jonny: 'MORNING', Fransia: 'MIDDAY', Sandia: 'EVENING', Alex: 'OFF', Walas: 'OFF' },
  // 30. avgust 2026: Sandia PROSTA, Walas dela JUTRO 6-12. Vse ostalo kot samodejna rotacija
  // tega dne (Alex večer 16-22, Fransia opoldne, Jonny prost). Brez pomoči/dodatkov.
  '2026-08-30': { Walas: 'MORNING', Fransia: 'MIDDAY', Alex: 'EVENING', Sandia: 'OFF', Jonny: 'OFF' },
  // 31. avgust 2026: Jonny pomaga ZJUTRAJ (zajtrk 6-9) IN ZVEČER (18-22) — glavna smena
  // Prosto (pomoči spodaj v EXTRA). Ostali "kot so" (samodejna rotacija): Alex jutro 6-12,
  // Fransia + Sandia opoldne, Walas večer 16-22.
  '2026-08-31': { Alex: 'MORNING', Fransia: 'MIDDAY', Sandia: 'MIDDAY', Walas: 'EVENING', Jonny: 'OFF' },
  // 9.–10. september 2026: Fransia na DOPUSTU → opoldanske smene ne pokriva.
  // Uporabnica: Sandia naj bo takrat sredi dneva (opoldne) namesto Fransie.
  '2026-09-09': { Sandia: 'MIDDAY' },
  '2026-09-10': { Sandia: 'MIDDAY' },
}

// Manual per-date overrides for the extra split-shift segments. Replaces the
// computed extras for the listed people (empty array = removes their extras).
// Aug 7: Fransia is off but comes in for breakfast 7-9 (instead of Alex) and
// evening 19-21 (instead of Walas), so those extras move to her.
const BAR_MANUAL_EXTRA_OVERRIDES: Record<string, Partial<Record<BarStaff, BarExtra[]>>> = {
  // 2.–7. avgust: dvojna smena — doubler dela CELO jutranjo (6-12) in pride POMAGAT
  // zvečer 18-22 (EVENING_HELP, 4h; NE polnih 16-22). Glavna smena ostane MORNING;
  // večerna pomoč se prišteje kot dodatek. Rotacija doublerja: 2=Jonny, 3=Alex,
  // 4=Walas, 5=Jonny, 6=Alex, 7=Walas. Skupaj doubler = 6h + 4h = 10h ta dan.
  '2026-08-02': { Jonny: [EVENING_HELP] },
  '2026-08-03': { Alex: [EVENING_HELP] },
  '2026-08-04': { Walas: [EVENING_HELP] },
  '2026-08-05': { Jonny: [EVENING_HELP] },
  '2026-08-06': { Alex: [EVENING_HELP] }, // doubler Alex (nadomesti star načrt)
  '2026-08-07': { Walas: [EVENING_HELP] }, // doubler Walas (nadomesti star načrt)
  // Days off where someone comes in to work the full midday shift to keep Fransia
  // company — stays "Prosto" on the schedule (payroll: extra day worked on a day off).
  // 8. avgust: Alex dela celo jutranjo + večerna pomoč 18-22; Walas dela polno večerno
  // smeno 16-22 in pride ZJUTRAJ pomagat na zajtrk 6-9 (MORNING_HELP, 3h).
  // (nadomesti star vnos Sandia:[MIDDAY_EXTRA], ker je Sandia zdaj prosta).
  '2026-08-08': { Alex: [EVENING_HELP], Walas: [MORNING_HELP] },
  // 9. avgust: Jonny (cela jutranja) pride pomagat zvečer 18-22; Walas (poln večer)
  // pride zjutraj pomagat na zajtrk 6-9. Simetrična medsebojna pomoč (kot 8.8., a Walas↔Jonny).
  '2026-08-09': { Jonny: [EVENING_HELP], Walas: [MORNING_HELP] },
  // 10. avgust: veliko gostov — Jonny (cela jutranja) pomaga zvečer 18-22. Walas dela
  // SAMO polno večerno smeno (BREZ jutranje pomoči 6-9 — uporabnica: Walas ne rabi zjutraj).
  '2026-08-10': { Jonny: [EVENING_HELP] },
  // 11. avgust: Walas prost → Alex↔Jonny simetrična pomoč. Jonny (cela jutranja) pomaga
  // zvečer 18-22; Alex (poln večer) pomaga na zajtrk 6-9.
  '2026-08-11': { Jonny: [EVENING_HELP], Alex: [MORNING_HELP] },
  // 12. avgust: Fransia prosta, Sandia sama opoldne → Alex↔Jonny simetrična pomoč.
  // Jonny (cela jutranja) pomaga zvečer 18-22; Alex (poln večer) pomaga na zajtrk 6-9.
  '2026-08-12': { Jonny: [EVENING_HELP], Alex: [MORNING_HELP] },
  // 13.–16. avgust: vsi delajo, Jonny (cela jutranja) pomaga zvečer 18-22; Walas dela
  // SAMO polno večerno smeno (BREZ jutranje pomoči — kot 10.8.). Nadomesti stare vnose
  // 13/14/15 iz prejšnjega načrta (Alex/Sandia opoldne, Fransia off na 14.).
  '2026-08-13': { Jonny: [EVENING_HELP] },
  '2026-08-14': { Jonny: [EVENING_HELP] },
  '2026-08-15': { Jonny: [EVENING_HELP] },
  '2026-08-16': { Jonny: [EVENING_HELP] },
  // 25. avgust: Jonny pomaga na zajtrk 6-9 (MORNING_HELP) IN na večerjo 18-22 (EVENING_HELP);
  // glavna smena Prosto. Fransia + Sandia opoldne, Walas jutro, Alex večer.
  '2026-08-25': { Jonny: [MORNING_HELP, EVENING_HELP] },
  // 26. avgust: enako kot 25.8. — Jonny pomaga na zajtrk 6-9 + večerja 18-22, glavna Prosto.
  '2026-08-26': { Jonny: [MORNING_HELP, EVENING_HELP] },
  // 27. avgust: enako kot 25./26.8. — Jonny pomaga na zajtrk 6-9 + večerja 18-22, glavna Prosto.
  '2026-08-27': { Jonny: [MORNING_HELP, EVENING_HELP] },
  // 28. avgust: Jonny pomaga na zajtrk 6-9 (MORNING_HELP) IN opoldne 12-15 (MIDDAY_HELP),
  // glavna smena Prosto. Sandii ohranimo večerjo 19-21 (EVENING_EXTRA) — ročni dan bi sicer
  // izklopil samodejno imensko okno 24-29.
  '2026-08-28': { Jonny: [MORNING_HELP, MIDDAY_HELP], Sandia: [EVENING_EXTRA] },
  // 31. avgust: Jonny pomaga na zajtrk 6-9 (MORNING_HELP) IN zvečer 18-22 (EVENING_HELP),
  // glavna smena Prosto. Ostali kot so (Alex jutro, Fransia+Sandia opoldne, Walas večer).
  '2026-08-31': { Jonny: [MORNING_HELP, EVENING_HELP] },
  // 18. avgust: Jonny opoldne (k Fransii). Alex poln večer 16-22; Walas (cela jutranja)
  // pride pomagat zvečer 18-22.
  '2026-08-18': { Walas: [EVENING_HELP] },
  // 19. avgust: Walas prost → Alex↔Jonny simetrična pomoč (kot 11.8.). Jonny (cela
  // jutranja) pomaga zvečer 18-22; Alex (poln večer) pomaga na zajtrk 6-9.
  '2026-08-19': { Jonny: [EVENING_HELP], Alex: [MORNING_HELP] },
  // 20. avgust: Alex prost → Walas↔Jonny simetrična pomoč (kot 9.8.). Jonny (cela
  // jutranja) pomaga zvečer 18-22; Walas (poln večer) pomaga na zajtrk 6-9.
  '2026-08-20': { Jonny: [EVENING_HELP], Walas: [MORNING_HELP] },
}

// Weekly 6-on / 1-off rotation (from August 2026 onwards).
// Each worker is off exactly once every 7 days; off-slots are staggered so that
// at least three people work on any given day (slots 4-6 = nobody off, all four work).
// Fransia therefore always has colleagues on the days she works, and on full-staff
// days Sandia joins her on the midday shift so she is never left alone.
// Jonny: -1 = nedosegljiv slot (pos je vedno 0-6), zato mu samodejna rotacija NE
// dodeli prostega dne; njegovo razporeditev določimo posebej (naslednji korak).
  const WEEKLY_OFF_SLOT: Record<BarStaff, number> = { Alex: 0, Fransia: 1, Sandia: 2, Walas: 3, Jonny: -1, Justin: -1 }

// The new schedule (6 work days, every 7th day off) applies from August 2026 on.
// July 2026 and earlier keep the original 4-day off rotation.
  function usesWeeklyOff(year: number, month: number): boolean {
  return year > 2026 || (year === 2026 && month >= 8)
  }

  // September 2026 onward uses a distinct main-shift pattern: Fransia works ONLY
  // the midday shift; Alex/Sandia/Walas cover morning + evening; Sandia works the
  // evening regularly, always paired with a boy (most often Walas), and the other
  // boy takes the morning. August 2026 keeps its own weekly logic (below).
  function usesSepPattern(year: number, month: number): boolean {
  return year > 2026 || (year === 2026 && month >= 9)
  }

  // Od oktobra 2026 Fransia ne dela več v baru.
  function usesOctPattern(year: number, month: number): boolean {
  return year > 2026 || (year === 2026 && month >= 10)
  }

/**
 * Generate the bar schedule for a whole month.
 *
 * From August 2026 (see usesWeeklyOff): continuous 7-day rotation across month
 * boundaries — each worker works 6 days and is off the 7th. Off-slots per worker
 * are 0 Alex, 1 Fransia, 2 Sandia, 3 Walas; on the remaining slots (4-6) nobody is
 * off, all four work and Sandia joins Fransia at midday for company.
 *
 * July 2026 and earlier: original 4-day off rotation (pos = dayIndex % 4).
 * The evening shift is always a boy (Alex/Walas); Sandia never works evenings;
 * Fransia always works midday when on duty.
 */
export function generateBarSchedule(year: number, month: number): BarDay[] {
  const lastDay = new Date(year, month, 0).getDate()
  const days: BarDay[] = []
  const weekly = usesWeeklyOff(year, month)

  for (let d = 1; d <= lastDay; d++) {
    const date = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`

    let alex: BarShift
    let fransia: BarShift
    let sandia: BarShift
    let walas: BarShift
    // Jonny in Justin privzeto prosta, dokler ne določimo njune rotacije (razporedita
    // se dnevno prek BAR_MANUAL_OVERRIDES po naročilu).
    const jonny: BarShift = 'OFF'
    const justin: BarShift = 'OFF'
    // Barski študenti (september 2026+) — napolni se v septembrski veji spodaj.
    const studentShifts: Record<string, BarShift> = {}

    if (weekly) {
      // Continuous day count so the 7-day cycle carries across month boundaries.
      const globalDay = Math.floor(Date.UTC(year, month - 1, d) / 86400000)
      const pos = ((globalDay % 7) + 7) % 7
      const evenWeek = Math.floor(globalDay / 7) % 2 === 0

      if (usesOctPattern(year, month)) {
        // --- Oktober 2026 naprej: Fransia NE dela več v baru ---
        // Mentorji Alex/Sandia/Walas (6+1, prosti dnevi pos 0/2/3). Ko delajo vsi
        // trije: en mentor na smeno — večer fant (tedensko menjava), drugi fant
        // jutro, Sandia opoldne. Ko je en mentor prost: jutro + večer mentor,
        // opoldne pokrije študentka (prekrivanje 11-12:30 in 15:30-17 z mentorjem).
        fransia = 'OFF'
        if (pos === WEEKLY_OFF_SLOT.Alex) {
          alex = 'OFF'
          sandia = 'MORNING'
          walas = 'EVENING'
        } else if (pos === WEEKLY_OFF_SLOT.Walas) {
          walas = 'OFF'
          if (evenWeek) {
            sandia = 'EVENING'
            alex = 'MORNING'
          } else {
            sandia = 'MORNING'
            alex = 'EVENING'
          }
        } else if (pos === WEEKLY_OFF_SLOT.Sandia) {
          sandia = 'OFF'
          if (evenWeek) {
            walas = 'EVENING'
            alex = 'MORNING'
          } else {
            alex = 'EVENING'
            walas = 'MORNING'
          }
        } else {
          // Vsi trije v službi: Alex opoldne, Sandia + Walas si delita jutro/večer
          // (tedenska menjava, da Sandia dela tako jutra kot večere).
          alex = 'MIDDAY'
          if (evenWeek) {
            sandia = 'EVENING'
            walas = 'MORNING'
          } else {
            sandia = 'MORNING'
            walas = 'EVENING'
          }
        }

        // Študentke: po ena na smeno (jutro/opoldne/večer), tedensko rotirajo,
        // da vsaka dela vse smene; vsaka 1 prost dan na teden (pos 4/5/6 — takrat
        // so vsi trije mentorji v službi). Zvečer nikoli več kot ena študentka.
        const weekIndex = Math.floor(globalDay / 7)
        const rot: BarShift[] = ['MORNING', 'MIDDAY', 'EVENING']
        const offIdx = pos >= 4 && pos <= 6 ? pos - 4 : -1
        BAR_STUDENTS.forEach((name, i) => {
          studentShifts[name] = i === offIdx ? 'OFF' : rot[(i + weekIndex) % 3]
        })
      } else if (usesSepPattern(year, month)) {
        // --- September 2026 onward ---
        // Fransia ONLY midday. Alex/Sandia/Walas across morning+evening.
        // Sandia works evening regularly (on no-off days), always with a boy
        // (most often Walas); the other boy takes morning alone. On off days
        // Sandia takes morning. When Fransia is off, a boy covers midday.
        if (pos === WEEKLY_OFF_SLOT.Alex) {
          // Alex off. Fransia midday, Sandia morning, Walas evening (boy alone).
          alex = 'OFF'
          fransia = 'MIDDAY'
          sandia = 'MORNING'
          walas = 'EVENING'
        } else if (pos === WEEKLY_OFF_SLOT.Walas) {
          // Walas off. Fransia midday, Sandia morning, Alex evening (boy alone).
          walas = 'OFF'
          fransia = 'MIDDAY'
          sandia = 'MORNING'
          alex = 'EVENING'
        } else if (pos === WEEKLY_OFF_SLOT.Sandia) {
          // Sandia off. Fransia midday, boys split morning/evening (evening a boy).
          sandia = 'OFF'
          fransia = 'MIDDAY'
          if (evenWeek) {
            walas = 'EVENING'
            alex = 'MORNING'
          } else {
            alex = 'EVENING'
            walas = 'MORNING'
          }
        } else if (pos === WEEKLY_OFF_SLOT.Fransia) {
          // Fransia off → a boy covers midday. Sandia morning, other boy evening.
          fransia = 'OFF'
          sandia = 'MORNING'
          if (evenWeek) {
            walas = 'MIDDAY'
            alex = 'EVENING'
          } else {
            alex = 'MIDDAY'
            walas = 'EVENING'
          }
        } else {
          // Nobody off (slots 4-6): all four work. Fransia midday; Sandia EVENING
          // with a boy (most often Walas); the other boy takes morning.
          fransia = 'MIDDAY'
          sandia = 'EVENING'
          if (pos === 6) {
            // occasionally Alex is Sandia's evening companion
            alex = 'EVENING'
            walas = 'MORNING'
          } else {
            walas = 'EVENING'
            alex = 'MORNING'
          }
        }

        // Barski študenti delajo VEDNO ob mentorju (Walas/Sandia/Alex), ki so v
        // jutranji in večerni smeni (Fransia je opoldne in ne mentorira), zato so
        // študenti razporejeni samo v JUTRO ali VEČER. BAR_STUDENTS index:
        // 0 = Flavienne (Flavi), 1 = Brigida, 2 = Maria Franclise (Frenki).
        const weekIndex = Math.floor(globalDay / 7)
        const isSep2026 = year === 2026 && month === 9
        if (isSep2026 && (d === 1 || d === 2)) {
          // Poseben začetek: Frenki + Brigida začneta v večerni smeni,
          // Flavi je danes (1.9.) in jutri zjutraj (2.9.) v jutranji smeni.
          studentShifts['Flavienne Winjisna'] = 'MORNING'
          studentShifts['Brigida Aoulati'] = 'EVENING'
          studentShifts['Maria Franclise Soanatera'] = 'EVENING'
        } else {
          // Od 3.9. naprej enakomerno: 2 študentki v eni smeni, 1 v drugi
          // (majority/minority se tedensko obrne, osamljena študentka rotira),
          // vsaka študentka 1 prost dan na teden (pos 4/5/6 → po ena naenkrat).
          const majority: BarShift = weekIndex % 2 === 0 ? 'MORNING' : 'EVENING'
          const minority: BarShift = majority === 'MORNING' ? 'EVENING' : 'MORNING'
          const loneIdx = weekIndex % 3
          const offIdx = pos >= 4 && pos <= 6 ? pos - 4 : -1
          if (offIdx >= 0) {
            // Ena študentka prosta → drugi dve pokrijeta jutro in večer (1+1).
            const working = [0, 1, 2].filter((i) => i !== offIdx)
            studentShifts[BAR_STUDENTS[offIdx]] = 'OFF'
            studentShifts[BAR_STUDENTS[working[0]]] = 'MORNING'
            studentShifts[BAR_STUDENTS[working[1]]] = 'EVENING'
          } else {
            // Vse tri delajo → 2+1 razdelitev, osamljena študentka v manjšinsko smeno.
            BAR_STUDENTS.forEach((name, i) => {
              studentShifts[name] = i === loneIdx ? minority : majority
            })
          }
        }

        // Kadar sta ZVEČER dve študentki, eno prestavimo v OPOLDANSKO smeno
        // (uporabnica). Katera ostane zvečer, se tedensko rotira zaradi pravičnosti.
        const eveningStudents = BAR_STUDENTS.filter((n) => studentShifts[n] === 'EVENING')
        if (eveningStudents.length >= 2) {
          const keepIdx = weekIndex % eveningStudents.length
          eveningStudents.forEach((n, k) => {
            if (k !== keepIdx) studentShifts[n] = 'MIDDAY'
          })
        }
      } else if (pos === WEEKLY_OFF_SLOT.Alex) {
        // Alex off. Fransia midday, Walas evening (boy), Sandia morning.
        alex = 'OFF'
        fransia = 'MIDDAY'
        walas = 'EVENING'
        sandia = 'MORNING'
      } else if (pos === WEEKLY_OFF_SLOT.Fransia) {
        // Fransia off. Sandia covers midday. Alex & Walas split morning/evening.
        fransia = 'OFF'
        sandia = 'MIDDAY'
        if (evenWeek) {
          walas = 'EVENING'
          alex = 'MORNING'
        } else {
          alex = 'EVENING'
          walas = 'MORNING'
        }
      } else if (pos === WEEKLY_OFF_SLOT.Sandia) {
        // Sandia off. Fransia midday. Alex & Walas split morning/evening.
        sandia = 'OFF'
        fransia = 'MIDDAY'
        if (evenWeek) {
          walas = 'EVENING'
          alex = 'MORNING'
        } else {
          alex = 'EVENING'
          walas = 'MORNING'
        }
      } else if (pos === WEEKLY_OFF_SLOT.Walas) {
        // Walas off. Fransia midday, Alex evening (boy), Sandia morning.
        walas = 'OFF'
        fransia = 'MIDDAY'
        alex = 'EVENING'
        sandia = 'MORNING'
      } else {
        // Nobody off (slots 4-6): all four work. Fransia + Sandia midday (company for
        // Fransia), boys split morning/evening (evening stays a boy).
        fransia = 'MIDDAY'
        sandia = 'MIDDAY'
        if (evenWeek) {
          walas = 'EVENING'
          alex = 'MORNING'
        } else {
          alex = 'EVENING'
          walas = 'MORNING'
        }
      }
    } else {
      // --- Original 4-day rotation (July 2026 and earlier) ---
      const dayIndex = d - 1
      const pos = dayIndex % 4
      const evenWeek = Math.floor(dayIndex / 7) % 2 === 0

      if (pos === 0) {
        alex = 'OFF'
        fransia = 'MIDDAY'
        walas = 'EVENING'
        sandia = 'MORNING'
      } else if (pos === 1) {
        fransia = 'OFF'
        sandia = 'MIDDAY'
        if (evenWeek) {
          walas = 'EVENING'
          alex = 'MORNING'
        } else {
          alex = 'EVENING'
          walas = 'MORNING'
        }
      } else if (pos === 2) {
        sandia = 'OFF'
        fransia = 'MIDDAY'
        if (evenWeek) {
          walas = 'EVENING'
          alex = 'MORNING'
        } else {
          alex = 'EVENING'
          walas = 'MORNING'
        }
      } else {
        walas = 'OFF'
        fransia = 'MIDDAY'
        alex = 'EVENING'
        sandia = 'MORNING'
      }
    }

    const assignments: Record<string, BarShift> = {
      Alex: alex,
      Fransia: fransia,
      Sandia: sandia,
      Walas: walas,
      Jonny: jonny,
      Justin: justin,
      ...studentShifts,
    }

    // Manual overrides for specific dates (force a worker onto a shift even if off).
    const override = BAR_MANUAL_OVERRIDES[date]
    if (override) {
      for (const p of BAR_STAFF) {
        if (override[p]) assignments[p] = override[p]!
      }
    }

    // Ročno določeni dnevi (BAR_MANUAL_OVERRIDES) so v celoti ročni → samodejni
    // dodatki (top-up 2-18, imenska pomoč 24-29) se zanje NE uporabijo.
    const isManualDay = !!BAR_MANUAL_OVERRIDES[date]

    // Hour top-up (Aug 2-18): the evening worker also does breakfast 7-9h, and the
    // morning worker also does the short evening 19-21h — a split shift adding 2 h each.
    let extras: Record<string, BarExtra[]> | undefined
    if (!isManualDay && usesHourTopUp(year, month, d)) {
      extras = {}
      for (const p of BAR_STAFF) {
        if (assignments[p] === 'MORNING') extras[p] = [EVENING_EXTRA]
        else if (assignments[p] === 'EVENING') extras[p] = [BREAKFAST_EXTRA]
      }
    }

    // Named-helper window (Aug 24-29): Fransia helps at breakfast 7-9h and Sandia at
    // dinner 19-21h, but only on days they are scheduled to work (not OFF).
    if (!isManualDay && usesNamedHelperWindow(year, month, d)) {
      extras = extras ?? {}
      if (assignments.Fransia !== 'OFF') extras.Fransia = [...(extras.Fransia ?? []), BREAKFAST_EXTRA]
      if (assignments.Sandia !== 'OFF') extras.Sandia = [...(extras.Sandia ?? []), EVENING_EXTRA]
    }

    // Manual extra-shift overrides for specific dates (e.g. helper comes in on a day off).
    const extraOverride = BAR_MANUAL_EXTRA_OVERRIDES[date]
    if (extraOverride) {
      extras = extras ?? {}
      for (const p of BAR_STAFF) {
        if (extraOverride[p]) extras[p] = extraOverride[p]!
      }
    }

    days.push({ date, assignments, ...(extras ? { extras } : {}) })
  }

  return days
}

export function computeBarStats(schedule: BarDay[]): Record<string, { hours: number; shifts: number }> {
  const stats: Record<string, { hours: number; shifts: number }> = {}
  // Zajemi vse osebe, ki nastopajo v razporedu (jedro + študenti), ne le BAR_STAFF.
  const people = new Set<string>(BAR_STAFF as readonly string[])
  for (const day of schedule) for (const p of Object.keys(day.assignments)) people.add(p)
  for (const p of people) stats[p] = { hours: 0, shifts: 0 }
  for (const day of schedule) {
    for (const p of people) {
      const shift = day.assignments[p] || 'OFF'
      if (shift !== 'OFF') {
        stats[p].hours += shiftHoursFor(shift as BarShift, day.date)
        stats[p].shifts += 1
      }
      // Add any extra split-shift segments (breakfast / short evening top-ups).
      for (const e of barExtrasFor(day, p)) stats[p].hours += e.hours
    }
  }
  return stats
}
