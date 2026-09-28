import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!

async function refreshAccessToken(refreshToken: string) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  return response.json()
}

// Gmail encodes body data as URL-safe base64.
function decodeB64Url(data: string): string {
  try {
    const normalized = data.replace(/-/g, '+').replace(/_/g, '/')
    return Buffer.from(normalized, 'base64').toString('utf-8')
  } catch {
    return ''
  }
}

// Walk the MIME tree and collect the best HTML body (fallback to plain text).
function extractBody(payload: any): { html: string; text: string } {
  let html = ''
  let text = ''

  const walk = (part: any) => {
    if (!part) return
    const mime = part.mimeType || ''
    const data = part.body?.data
    if (data) {
      if (mime === 'text/html' && !html) html = decodeB64Url(data)
      else if (mime === 'text/plain' && !text) text = decodeB64Url(data)
    }
    if (Array.isArray(part.parts)) part.parts.forEach(walk)
  }
  walk(payload)

  return { html, text }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const cookieStore = await cookies()
  let accessToken = cookieStore.get('gmail_access_token')?.value
  const refreshToken = cookieStore.get('gmail_refresh_token')?.value

  if (!accessToken && !refreshToken) {
    return NextResponse.json({ error: 'Not authenticated', needsAuth: true }, { status: 401 })
  }

  if (!accessToken && refreshToken) {
    const tokens = await refreshAccessToken(refreshToken)
    if (tokens.access_token) {
      accessToken = tokens.access_token
      cookieStore.set('gmail_access_token', tokens.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: tokens.expires_in || 3600,
      })
    } else {
      return NextResponse.json({ error: 'Token refresh failed', needsAuth: true }, { status: 401 })
    }
  }

  const fetchMessage = async (token: string) =>
    fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`, {
      headers: { Authorization: `Bearer ${token}` },
    })

  try {
    let msgResponse = await fetchMessage(accessToken!)

    if (msgResponse.status === 401 && refreshToken) {
      const tokens = await refreshAccessToken(refreshToken)
      if (tokens.access_token) {
        accessToken = tokens.access_token
        cookieStore.set('gmail_access_token', tokens.access_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: tokens.expires_in || 3600,
        })
        msgResponse = await fetchMessage(accessToken!)
      }
    }

    if (!msgResponse.ok) {
      if (msgResponse.status === 401) {
        return NextResponse.json({ error: 'Authentication expired', needsAuth: true }, { status: 401 })
      }
      return NextResponse.json({ error: 'Gmail API error' }, { status: 500 })
    }

    const msgData = await msgResponse.json()
    const headers = msgData.payload?.headers || []
    const getHeader = (name: string) =>
      headers.find((h: { name: string; value: string }) => h.name.toLowerCase() === name.toLowerCase())?.value || ''

    const { html, text } = extractBody(msgData.payload)

    return NextResponse.json({
      id: msgData.id,
      threadId: msgData.threadId,
      subject: getHeader('Subject'),
      from: getHeader('From'),
      to: getHeader('To'),
      date: getHeader('Date'),
      snippet: msgData.snippet || '',
      html,
      text,
    })
  } catch (error) {
    console.error('Gmail message fetch error:', error)
    return NextResponse.json({ error: 'Fetch failed' }, { status: 500 })
  }
}
