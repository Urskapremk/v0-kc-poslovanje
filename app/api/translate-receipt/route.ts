import { NextResponse } from 'next/server'
import { generateText } from 'ai'

export const runtime = 'nodejs'
export const maxDuration = 120

// Prepozna vsebino računa (lahko na več fotografijah/straneh) in jo prepiše ter prevede v slovenščino.
export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const files = formData.getAll('files').filter((f): f is File => f instanceof File)
    if (files.length === 0) {
      return NextResponse.json({ error: 'no-file' }, { status: 400 })
    }

    const imageParts = await Promise.all(
      files.map(async (file) => ({
        type: 'file' as const,
        data: Buffer.from(await file.arrayBuffer()),
        mediaType: file.type || 'image/jpeg',
      })),
    )

    const { text } = await generateText({
      model: 'google/gemini-2.5-flash',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text:
                'To so fotografije enega računa (lahko več strani istega računa). ' +
                'Preberi vsebino računa (lahko je v francoščini, angleščini, malgaščini ali slovenščini) in jo PREPIŠI ter PREVEDI v slovenščino. ' +
                'Vrni razumljiv, urejen prepis v slovenščini: ime dobavitelja/trgovine, datum, postavke (naziv artikla in cena), morebitne popuste ter končni znesek. ' +
                'Ohrani vrstni red postavk. Če je več strani, jih obravnavaj kot en račun in nadaljuj oštevilčenje. ' +
                'Cene/zneske pusti v izvirni valuti (ne pretvarjaj). Vrni samo prepis, brez dodatnih razlag ali uvoda.',
            },
            ...imageParts,
          ],
        },
      ],
    })

    return NextResponse.json({ translation: (text || '').trim() })
  } catch (e) {
    console.error('[v0] translate-receipt error:', e)
    return NextResponse.json({ error: 'translate-failed' }, { status: 500 })
  }
}
