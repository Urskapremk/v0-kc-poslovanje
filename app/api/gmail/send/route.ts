import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { sentEmails } from '@/lib/db/schema'
import { nanoid } from 'nanoid'

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

function createEmailBody(to: string, subject: string, htmlContent: string): string {
  const boundary = 'boundary_' + Date.now()
  
  const email = [
    `From: Komba Cabana <info@kombacabana.com>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    '',
    // Plain text version
    htmlContent.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' '),
    '',
    `--${boundary}`,
    `Content-Type: text/html; charset="UTF-8"`,
    '',
    htmlContent,
    '',
    `--${boundary}--`,
  ].join('\r\n')

  // Base64url encode the email
  return Buffer.from(email)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { to, subject, htmlContent, reservationId, transferId, recipientName, type, metadata } = body

  if (!to || !subject || !htmlContent) {
    return NextResponse.json({ error: 'Missing required fields: to, subject, htmlContent' }, { status: 400 })
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
    const rawEmail = createEmailBody(to, subject, htmlContent)

    const sendResponse = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ raw: rawEmail }),
      }
    )

    if (sendResponse.status === 401 && refreshToken) {
      // Token expired, try refresh and retry
      const tokens = await refreshAccessToken(refreshToken)
      if (tokens.access_token) {
        accessToken = tokens.access_token
        cookieStore.set('gmail_access_token', tokens.access_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: tokens.expires_in || 3600,
        })

        const retryResponse = await fetch(
          'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ raw: rawEmail }),
          }
        )

        if (!retryResponse.ok) {
          const errorData = await retryResponse.json()
          console.error('Gmail send error after retry:', errorData)
          return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
        }

        const data = await retryResponse.json()
        return NextResponse.json({ success: true, messageId: data.id })
      }
      return NextResponse.json({ error: 'Authentication expired', needsAuth: true }, { status: 401 })
    }

    if (!sendResponse.ok) {
      const errorData = await sendResponse.json()
      console.error('[v0] Gmail send error:', JSON.stringify(errorData))
      
      // Check for insufficient permissions error
      if (errorData.error?.code === 403 || errorData.error?.status === 'PERMISSION_DENIED') {
        return NextResponse.json({ 
          error: 'Gmail nima dovoljenja za posiljanje. Prosim ponovno povezi Gmail.', 
          needsAuth: true,
          details: errorData 
        }, { status: 403 })
      }
      
      return NextResponse.json({ error: 'Failed to send email', details: errorData }, { status: 500 })
    }

    const data = await sendResponse.json()
    
    // Archive the sent email
    try {
      await db.insert(sentEmails).values({
        id: nanoid(),
        reservationId: reservationId || null,
        transferId: transferId || null,
        type: type || 'transfer_voucher',
        recipientEmail: to,
        recipientName: recipientName || null,
        subject,
        gmailMessageId: data.id,
        status: 'sent',
        metadata: metadata ? JSON.stringify(metadata) : null,
      })
    } catch (archiveError) {
      console.error('[v0] Failed to archive email:', archiveError)
      // Don't fail the request if archiving fails
    }
    
    return NextResponse.json({ success: true, messageId: data.id })
  } catch (error) {
    console.error('Gmail send error:', error)
    return NextResponse.json({ error: 'Send failed' }, { status: 500 })
  }
}
