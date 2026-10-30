import { type NextRequest, NextResponse } from 'next/server'
import { get } from '@vercel/blob'

export async function GET(request: NextRequest) {
  try {
    const pathname = request.nextUrl.searchParams.get('pathname')

    if (!pathname) {
      return NextResponse.json({ error: 'Missing pathname' }, { status: 400 })
    }

    const result = await get(pathname, {
      access: 'private',
      ifNoneMatch: request.headers.get('if-none-match') ?? undefined,
    })

    if (!result) {
      return new NextResponse('Not found', { status: 404 })
    }

    // Blob hasn't changed — tell the browser to use its cached copy
    if (result.statusCode === 304) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: result.blob.etag,
          'Cache-Control': 'private, no-cache',
        },
      })
    }

    const contentType = result.blob.contentType || 'application/octet-stream'
    const pdf = contentType === 'application/pdf' || pathname.toLowerCase().endsWith('.pdf')
    const headers: Record<string, string> = {
      'Content-Type': pdf ? 'application/pdf' : contentType,
      ETag: result.blob.etag,
      'Cache-Control': 'private, no-cache',
    }
    if (pdf) headers['Content-Disposition'] = 'inline'

    return new NextResponse(result.stream, { headers })
  } catch (error) {
    console.error('Error serving file:', error)
    return NextResponse.json({ error: 'Failed to serve file' }, { status: 500 })
  }
}
