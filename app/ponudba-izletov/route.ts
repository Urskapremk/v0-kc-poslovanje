import { buildExcursionOfferHtml } from '@/lib/excursion-offer'

// Preview of the excursion offer email. Open /ponudba-izletov to see exactly
// how the email will look. Pass ?name=Rob to preview a specific greeting.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const name = searchParams.get('name') || 'Guest'
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'https://www.kombacabana.app'

  const html = buildExcursionOfferHtml({ guestName: name, baseUrl: base })
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
