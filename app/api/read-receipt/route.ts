import { NextResponse } from 'next/server'
import { readReceiptFromImages } from '@/lib/receipt-ocr'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'no-file' }, { status: 400 })
    }

    const bytes = Buffer.from(await file.arrayBuffer())
    const mediaType = file.type || 'image/jpeg'

    const result = await readReceiptFromImages([{ data: bytes, mediaType }])
    return NextResponse.json(result)
  } catch (e) {
    console.error('[v0] read-receipt error:', e)
    return NextResponse.json({ error: 'ocr-failed' }, { status: 500 })
  }
}
