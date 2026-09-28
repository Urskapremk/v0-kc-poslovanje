import { NextResponse } from 'next/server'
import { readBankStatementFullFromImages } from '@/lib/receipt-ocr'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const files = formData.getAll('file').filter((f): f is File => f instanceof File)
    if (files.length === 0) {
      return NextResponse.json({ error: 'no-file' }, { status: 400 })
    }

    const images = await Promise.all(
      files.map(async (file) => ({
        data: Buffer.from(await file.arrayBuffer()),
        mediaType: file.type || 'image/jpeg',
      }))
    )

    const result = await readBankStatementFullFromImages(images)
    return NextResponse.json(result)
  } catch (e) {
    console.error('[v0] read-bank-statement error:', e)
    return NextResponse.json({ error: 'ocr-failed' }, { status: 500 })
  }
}
