import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!

async function refreshAccessToken(refreshToken: string) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  return response.json()
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const query = body.query

  if (!query) {
    return NextResponse.json({ error: 'Query parameter required' }, { status: 400 })
  }

  const cookieStore = await cookies()
  let accessToken = cookieStore.get('gmail_access_token')?.value
  const refreshToken = cookieStore.get('gmail_refresh_token')?.value

  if (!accessToken && !refreshToken) {
    return NextResponse.json({ error: 'Not authenticated', needsAuth: true }, { status: 401 })
  }

  // Try to refresh token if access token is missing
  if (!accessToken && refreshToken) {
    const tokens = await refreshAccessToken(refreshToken)
    if (tokens.access_token) {
      accessToken = tokens.access_token
      // Update the cookie
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

  try {
    // Search emails
    const searchResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=20`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    if (searchResponse.status === 401) {
      // Token expired, try refresh
      if (refreshToken) {
        const tokens = await refreshAccessToken(refreshToken)
        if (tokens.access_token) {
          accessToken = tokens.access_token
          cookieStore.set('gmail_access_token', tokens.access_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: tokens.expires_in || 3600,
          })
          
          // Retry the search
          const retryResponse = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=20`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            }
          )
          
          if (!retryResponse.ok) {
            return NextResponse.json({ error: 'Gmail API error', needsAuth: true }, { status: 401 })
          }
          
          const retryData = await retryResponse.json()
          return processMessages(retryData, accessToken!)
        }
      }
      return NextResponse.json({ error: 'Authentication expired', needsAuth: true }, { status: 401 })
    }

    const searchData = await searchResponse.json()
    return processMessages(searchData, accessToken!)
  } catch (error) {
    console.error('Gmail search error:', error)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}

async function processMessages(searchData: { messages?: { id: string }[] }, accessToken: string) {
  if (!searchData.messages || searchData.messages.length === 0) {
    return NextResponse.json({ emails: [] })
  }

  // Fetch details for each message (limit to 10 for performance)
  const messageIds = searchData.messages.slice(0, 10)
  const emails = await Promise.all(
    messageIds.map(async (msg: { id: string }) => {
      const msgResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      )
      
      if (!msgResponse.ok) return null
      
      const msgData = await msgResponse.json()
      const headers = msgData.payload?.headers || []
      
      const getHeader = (name: string) => 
        headers.find((h: { name: string; value: string }) => h.name.toLowerCase() === name.toLowerCase())?.value || ''

      return {
        id: msg.id,
        threadId: msgData.threadId || msg.id,
        subject: getHeader('Subject'),
        from: getHeader('From'),
        date: getHeader('Date'),
        snippet: msgData.snippet || '',
      }
    })
  )

  return NextResponse.json({ 
    emails: emails.filter(Boolean),
    total: searchData.messages.length 
  })
}
