import { NextResponse } from 'next/server'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!

// Derive the callback URL from the actual domain the app is served on, so it
// keeps working even when the deployment/domain changes. Falls back to an env
// override (GOOGLE_REDIRECT_URI) if set. NOTE: this exact URL must be listed as
// an "Authorized redirect URI" in the Google Cloud Console OAuth client.
function getRedirectUri(request: Request): string {
  if (process.env.GOOGLE_REDIRECT_URI) return process.env.GOOGLE_REDIRECT_URI
  const url = new URL(request.url)
  const host = request.headers.get('x-forwarded-host') || url.host
  const proto = request.headers.get('x-forwarded-proto') || url.protocol.replace(':', '')
  return `${proto}://${host}/api/auth/google/callback`
}

export async function GET(request: Request) {
  const REDIRECT_URI = getRedirectUri(request)
  // Include both read and send scopes for Gmail
  const scopes = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send'
  ]
  const scope = encodeURIComponent(scopes.join(' '))
  
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${GOOGLE_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&response_type=code` +
    `&scope=${scope}` +
    `&access_type=offline` +
    `&prompt=consent`

  return NextResponse.redirect(authUrl)
}
