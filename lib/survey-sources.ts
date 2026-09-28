// Shared "how did you find us" survey sources.
// Used by the feedback email (buttons) and the public survey landing page.
// NOTE: no 'use server' — this is a plain data module importable anywhere.

export type SurveySource = {
  key: string
  emoji: string
  label: string
}

// Order here = order shown in the email. `key` is the stable value stored in DB.
export const SURVEY_SOURCES: SurveySource[] = [
  { key: 'natgeo', emoji: '📖', label: 'National Geographic' },
  { key: 'google', emoji: '🌍', label: 'Google search' },
  { key: 'instagram', emoji: '📸', label: 'Instagram' },
  { key: 'facebook', emoji: '👍', label: 'Facebook' },
  { key: 'website', emoji: '🌐', label: 'Your website (www.kombacabana.com)' },
  { key: 'booking', emoji: '🧭', label: 'Booking.com' },
  { key: 'referral', emoji: '👨‍👩‍👧‍👦', label: 'Recommended by friends or family' },
  { key: 'agency', emoji: '🏝️', label: 'Travel agency' },
  { key: 'other', emoji: '✈️', label: 'Somewhere else' },
]

export function findSurveySource(key: string): SurveySource | undefined {
  return SURVEY_SOURCES.find((s) => s.key === key)
}
