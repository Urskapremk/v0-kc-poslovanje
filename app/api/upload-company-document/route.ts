import { put } from '@vercel/blob'
import { type NextRequest, NextResponse } from 'next/server'

// Posnetki dokumentov podjetij. Zasebna blob shramba; prikaz prek /api/image?pathname=...
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const company = String(formData.get('company') || '')

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }
    if (company !== 'tourism' && company !== 'sarl') {
      return NextResponse.json({ error: 'Unknown company' }, { status: 400 })
    }
    if (file.type && !file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Only images are accepted' }, { status: 400 })
    }

    const safeName = (file.name || 'dokument')
      .replace(/[^\w.\-]+/g, '_')
      .replace(/^\.+/, '')
      .slice(0, 80) || 'dokument'

    const blob = await put(`company-documents/${company}/${Date.now()}-${safeName}`, file, {
      access: 'private',
    })

    return NextResponse.json({ pathname: blob.pathname })
  } catch (error) {
    console.error('Company document upload error:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
