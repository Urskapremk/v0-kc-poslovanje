import { put } from '@vercel/blob'
import { type NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Naloži v zasebno blob shrambo (podpisani dokumenti o napitnini so občutljivi)
    const blob = await put(`napitnina-documents/${Date.now()}-${file.name}`, file, {
      access: 'private',
    })

    // Vrni pot za uporabo prek /api/image
    return NextResponse.json({ pathname: blob.pathname })
  } catch (error) {
    console.error('Napitnina document upload error:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
