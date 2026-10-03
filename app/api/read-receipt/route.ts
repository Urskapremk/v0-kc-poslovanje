import { NextResponse } from 'next/server'
import { generateText, Output } from 'ai'
import { z } from 'zod'

export const runtime = 'nodejs'
export const maxDuration = 60

const schema = z.object({
  amountEur: z
    .number()
    .nullable()
    .describe('Končni znesek za plačilo v EUR (skupaj / total / za plačilo). Samo število, npr. 232.61. Če ni jasno, null.'),
  date: z
    .string()
    .nullable()
    .describe('Datum računa v obliki YYYY-MM-DD. Če ni jasno, null.'),
  description: z
    .string()
    .nullable()
    .describe('Kratek opis (dobavitelj ali vrsta stroška), največ nekaj besed, v slovenščini. Če ni jasno, null.'),
})

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'no-file' }, { status: 400 })
    }

    const bytes = Buffer.from(await file.arrayBuffer())
    const mediaType = file.type || 'image/jpeg'

    const { output } = await generateText({
      model: 'google/gemini-2.5-flash',
      output: Output.object({ schema }),
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text:
                'To je fotografija ali skenirani račun (lahko v slovenščini, angleščini ali francoščini). ' +
                'Razberi KONČNI znesek za plačilo v EUR (išči "Za plačilo", "Skupaj", "Total", "TTC", "Total EUR"), ' +
                'datum računa in kratek opis (ime dobavitelja ali vrsta stroška). ' +
                'Če je znesek v drugi valuti, ga NE pretvarjaj — vrni le če je EUR. Vrni samo to, kar jasno vidiš.',
            },
            { type: 'file', data: bytes, mediaType },
          ],
        },
      ],
    })

    return NextResponse.json({
      amountEur: output.amountEur ?? null,
      date: output.date ?? null,
      description: output.description ?? null,
    })
  } catch (e) {
    console.error('[v0] read-receipt error:', e)
    return NextResponse.json({ error: 'ocr-failed' }, { status: 500 })
  }
}
