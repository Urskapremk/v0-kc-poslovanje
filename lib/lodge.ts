// Lodge position. Kept out of app/actions/vreme.ts on purpose: a "use server"
// file may only export async functions, and exporting a plain object from there
// crashes the whole page, not just the feature using it.
//
// Wind, rain and temperature are read at the lodge itself; the marine model
// snaps to the nearest offshore grid point, which is where the crossing happens.
export const LODGE = { lat: -13.45, lon: 48.34, label: "Nosy Komba" } as const

/** The limits that turn a crossing from pleasant into careful into not worth it.
 *
 *  They live here, next to the position, because two separate places now need
 *  exactly the same numbers: seaState paints the badge from them, and the
 *  ensemble reads them to answer "what are the odds we cross that line". Were
 *  they written twice, a change in one would quietly leave the probability
 *  describing a threshold the badge no longer uses.
 *
 *  Gusts are in km/h — the canonical unit — so switching the display to m/s can
 *  never move a boundary. Thresholds sit on gusts rather than mean wind because
 *  it is a gust that knocks a small boat about. */
export const SEA_LIMITS = {
  /** Gusts at which it turns uncomfortable: "Previdno". */
  cautionGusts: 33,
  /** Gusts at which it is no longer a boat trip: "Neugodno za čoln". */
  dangerGusts: 46,
  /** Wave heights (m) that raise the same two states on their own. */
  cautionWaves: 1,
  dangerWaves: 1.5,
} as const
