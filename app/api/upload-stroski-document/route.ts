import { put } from '@vercel/blob'
import { type NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Naloži v zasebno blob shrambo (računi so občutljivi podatki)
    const blob = await put(`stroski-arhiv/${Date.now()}-${file.name}`, file, {
      access: 'private',
    })

    // Vrni pot za uporabo prek /api/image
    return NextResponse.json({ pathname: blob.pathname })
  } catch (error) {
    console.error('Stroski receipt upload error:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
