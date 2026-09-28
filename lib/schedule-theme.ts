/**
 * Colors for the four staff schedule tables (sobarice, vrtnarji, kuhinja, bar).
 *
 * Two modes, picked by the `readOnly` prop of each tab:
 *   navy — Urška's editing view in Kadrovski oddelek. Original palette; she
 *          works with the dropdowns daily and finds it easier to read.
 *   sand — Borut's view-only view. Darker accents, because the light navy/gold
 *          used on dark backgrounds would wash out on the sand panel.
 *
 * Class strings are written out in full (never assembled from a hex + opacity
 * suffix), because Tailwind cannot generate classes from concatenated strings.
 */

export type ScheduleTheme = {
  /** Table card wrapper. */
  card: string
  /** Small colour legend above the table. */
  legend: string
  /** Table header row. */
  head: string
  rowBorder: string
  holidayRow: string
  sundayRow: string
  /** Day name on a Sunday or public holiday. */
  dayAccent: string
  dayMuted: string
  dateText: string
  holidayBadge: string
  sundayLabel: string
  /** Gold bar plus label marking today's row. */
  todayBar: string
  todayLabel: string
  /** Leave badge that replaces a shift cell. */
  leaveBadge: string
  /** Leave styling applied to an inline cell (sobarice). */
  leaveCell: string
  /** Dimming for an empty "Prosto" cell. */
  offDim: string
  /** Text-only "off" cell (vrtnarji, kuhinja, bar). */
  offText: string
  empty: string
}

export const TABLE_THEME: { navy: ScheduleTheme; sand: ScheduleTheme } = {
  navy: {
    card: 'bg-white/[0.03] border-white/10',
    legend: 'text-white/50',
    head: 'text-white/40',
    rowBorder: 'border-white/5',
    holidayRow: 'bg-[#c48872]/10',
    sundayRow: 'bg-[#7fa8b8]/[0.07]',
    dayAccent: 'text-[#c48872]',
    dayMuted: 'text-white/50',
    dateText: 'text-white/70',
    holidayBadge: 'border-[#c48872]/40 bg-[#c48872]/15 text-[#c48872]',
    sundayLabel: 'text-[#7fa8b8]',
    todayBar: 'border-l-[#c59b5b]',
    todayLabel: 'text-[#c59b5b]',
    leaveBadge: 'border-[#cc8e77]/40 bg-[#cc8e77]/15 text-[#cc8e77]',
    leaveCell: 'border-[#cc8e77]/40 bg-[#cc8e77]/10 text-[#cc8e77]',
    offDim: 'opacity-40',
    offText: 'text-white/25',
    empty: 'text-white/40 bg-white/[0.03] border-white/10',
  },
  sand: {
    card: 'bg-[#efe8da] border-[#0f2e3a]/12',
    legend: 'text-[#2b2622]/60',
    head: 'text-[#2b2622]/55',
    rowBorder: 'border-[#0f2e3a]/[0.08]',
    holidayRow: 'bg-[#a15a3f]/[0.10]',
    sundayRow: 'bg-[#3f6b7d]/[0.08]',
    dayAccent: 'text-[#a15a3f]',
    dayMuted: 'text-[#2b2622]/55',
    dateText: 'text-[#2b2622]/85',
    holidayBadge: 'border-[#a15a3f]/40 bg-[#a15a3f]/[0.12] text-[#a15a3f]',
    sundayLabel: 'text-[#3f6b7d]',
    todayBar: 'border-l-[#8f6d3a]',
    todayLabel: 'text-[#8f6d3a]',
    leaveBadge: 'border-[#a15a3f]/40 bg-[#a15a3f]/[0.12] text-[#a15a3f]',
    leaveCell: 'border-[#a15a3f]/40 bg-[#a15a3f]/[0.10] text-[#a15a3f]',
    // The white "Prosto" panel would nearly vanish at 40% on sand.
    offDim: 'opacity-70',
    offText: 'text-[#2b2622]/40',
    empty: 'font-light italic text-[#2b2622]/55 bg-[#efe8da] border-[#0f2e3a]/12',
  },
}

export const themeFor = (readOnly: boolean): ScheduleTheme =>
  readOnly ? TABLE_THEME.sand : TABLE_THEME.navy

/**
 * Shift and post pills. Gold = morning, blue = afternoon/beach, green =
 * midday/garden — the same meaning in both modes, only darker on sand.
 */
export const PILL = {
  navy: {
    gold: 'bg-[#c59b5b]/15 text-[#c59b5b] border border-[#c59b5b]/25',
    blue: 'bg-[#7fa8b8]/15 text-[#7fa8b8] border border-[#7fa8b8]/25',
    green: 'bg-[#9ab39d]/15 text-[#9ab39d] border border-[#9ab39d]/25',
    sky: 'bg-[#9ecbdd]/15 text-[#9ecbdd] border border-[#9ecbdd]/25',
    sage: 'bg-[#8fae92]/15 text-[#8fae92] border border-[#8fae92]/25',
    neutral: 'bg-white/5 text-white/50 border border-white/10',
  },
  sand: {
    gold: 'bg-[#8f6d3a]/12 text-[#8f6d3a] border border-[#8f6d3a]/35',
    blue: 'bg-[#3f6b7d]/12 text-[#3f6b7d] border border-[#3f6b7d]/35',
    green: 'bg-[#4f7a54]/12 text-[#4f7a54] border border-[#4f7a54]/35',
    sky: 'bg-[#3f6b7d]/12 text-[#3f6b7d] border border-[#3f6b7d]/35',
    sage: 'bg-[#4f7a54]/12 text-[#4f7a54] border border-[#4f7a54]/35',
    // White panels on sand give depth without adding a colour.
    neutral: 'bg-white text-[#2b2622]/45 border border-[#0f2e3a]/[0.08]',
  },
} as const

export type SchedulePill = Record<keyof (typeof PILL)['navy'], string>

/** Legend swatch, same colour family as the pill it explains. */
export const SWATCH = {
  navy: {
    gold: 'bg-[#c59b5b]/40 border-[#c59b5b]/60',
    blue: 'bg-[#7fa8b8]/40 border-[#7fa8b8]/60',
    sage: 'bg-[#8fae92]/40 border-[#8fae92]/60',
    terracotta: 'bg-[#cc8e77]/40 border-[#cc8e77]/60',
    neutral: 'bg-white/10 border-white/20',
  },
  sand: {
    gold: 'bg-[#8f6d3a]/40 border-[#8f6d3a]/60',
    blue: 'bg-[#3f6b7d]/40 border-[#3f6b7d]/60',
    sage: 'bg-[#4f7a54]/40 border-[#4f7a54]/60',
    terracotta: 'bg-[#a15a3f]/40 border-[#a15a3f]/60',
    neutral: 'bg-white border-[#0f2e3a]/20',
  },
} as const
