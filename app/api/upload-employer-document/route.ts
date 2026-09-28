import { put } from '@vercel/blob'
import { type NextRequest, NextResponse } from 'next/server'

// Nalaganje uradnih prilog registra delodajalca (pogodbe, PV inšpekcije, dovoljenja ...).
// Zasebna blob shramba; do datotek se dostopa prek /api/image?pathname=...
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const blob = await put(`employer-register-documents/${Date.now()}-${file.name}`, file, {
      access: 'private',
    })

    return NextResponse.json({ pathname: blob.pathname })
  } catch (error) {
    console.error('Employer register document upload error:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
