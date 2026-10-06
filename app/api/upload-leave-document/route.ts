import { put } from '@vercel/blob'
import { type NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Naloži v zasebno blob shrambo (podpisane odločbe in potrdila zdravnika so občutljiva)
    const kind = String(formData.get('kind') || '')
    const prefix = kind === 'doctor' ? 'doctor-' : ''
    const blob = await put(`leave-documents/${prefix}${Date.now()}-${file.name}`, file, {
      access: 'private',
    })

    // Vrni pot za uporabo prek /api/image
    return NextResponse.json({ pathname: blob.pathname })
  } catch (error) {
    console.error('Leave document upload error:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
