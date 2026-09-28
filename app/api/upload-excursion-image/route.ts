import { put } from '@vercel/blob'
import { type NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Upload to private blob storage
    const blob = await put(`excursions/${Date.now()}-${file.name}`, file, {
      access: 'private',
    })

    // Return pathname for use with /api/image route
    return NextResponse.json({ url: `/api/image?pathname=${encodeURIComponent(blob.pathname)}` })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
