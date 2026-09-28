import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!

// Must match EXACTLY the redirect_uri used to start the OAuth flow (see
// app/api/auth/google/route.ts) — derive it from the actual request host.
function getRedirectUri(request: NextRequest): string {
  if (process.env.GOOGLE_REDIRECT_URI) return process.env.GOOGLE_REDIRECT_URI
  const host = request.headers.get('x-forwarded-host') || request.nextUrl.host
  const proto = request.headers.get('x-forwarded-proto') || request.nextUrl.protocol.replace(':', '')
  return `${proto}://${host}/api/auth/google/callback`
}

export async function GET(request: NextRequest) {
  const REDIRECT_URI = getRedirectUri(request)
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(new URL('/?gmail_error=' + error, request.url))
  }

  if (!code) {
    return NextResponse.redirect(new URL('/?gmail_error=no_code', request.url))
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    })

    const tokens = await tokenResponse.json()

    if (tokens.error) {
      console.error('Token error:', tokens)
      return NextResponse.redirect(new URL('/?gmail_error=' + tokens.error, request.url))
    }

    // Store tokens in cookies (httpOnly for security)
    const cookieStore = await cookies()
    
    cookieStore.set('gmail_access_token', tokens.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: tokens.expires_in || 3600,
    })

    if (tokens.refresh_token) {
      cookieStore.set('gmail_refresh_token', tokens.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 days
      })
    }

    return NextResponse.redirect(new URL('/?gmail_connected=true', request.url))
  } catch (error) {
    console.error('OAuth callback error:', error)
    return NextResponse.redirect(new URL('/?gmail_error=callback_failed', request.url))
  }
}
