import { put } from '@vercel/blob'
import { type NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Naloži v zasebno blob shrambo (podpisane placilne liste so interni dokumenti)
    const blob = await put(`payslip-images/${Date.now()}-${file.name}`, file, {
      access: 'private',
    })

    // Vrni pot za prikaz prek /api/image
    return NextResponse.json({ pathname: blob.pathname })
  } catch (error) {
    console.error('Payslip image upload error:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
