import { NextResponse } from 'next/server'
import { generateGuestReply, saveGuestReply } from '@/app/actions/guest-reply'

const ID = 'res-1787504362260-a66a09b55a2b3'

const GUEST_MSG = `Hello, I have a few questions before our stay:
- How can we pay?
- Can you organize the airport transfer?
- What excursions do you recommend (Lokobe, Tanikely, and activities on Nosy Komba)?
- Do you offer scuba diving?
- What about meals / board?`

const PRICE_LINES = [
  'Lokobe excursion: 196.25 EUR total for 2 people (includes boat transport, a guide and lunch).',
  'Tanikely excursion: 165.83 EUR total for 2 people (includes boat transport, a guide, park entrance and lunch).',
  'Ampangorina Maki park excursion: 82.92 EUR total for 2 people (includes boat transport, a guide, park entrance and lunch).',
  'Transfer Airport Fascene - Komba Cabana: 105.00 EUR total for 2 people (one-way, boat transfer included).',
]

const INTERNAL = [
  'Lokobe — 196.25 EUR / 2p · boat: Noah · lunch: Lokobe Hotel Doany',
  'Tanikely — 165.83 EUR / 2p · boat: Citadel · lunch: Bernice · entrance included',
  'Ampangorina Maki park — 82.92 EUR / 2p · boat: Nero · lunch: Ampangorina Lunch · entrance included',
  'Transfer Airport Fascene - Komba Cabana — 105.00 EUR / 2p · boat: Citadel · one-way',
].join('\n')

export async function GET() {
  const gen = await generateGuestReply(ID, GUEST_MSG)
  if (!gen.reply) return NextResponse.json({ ok: false, error: gen.error })
  const reply = `${gen.reply.trim()}\n\n${PRICE_LINES.join('\n\n')}`
  const res = await saveGuestReply(ID, reply, GUEST_MSG, INTERNAL)
  return NextResponse.json({ ok: res.success, error: res.error })
}
