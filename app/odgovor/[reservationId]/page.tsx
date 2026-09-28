import { getGuestReply, getReplyExcursionImages } from '@/app/actions/guest-reply'
import { buildReplyHtml } from '@/lib/guest-reply-html'

function getPublicBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
  return 'https://www.kombacabana.app'
}

export const dynamic = 'force-dynamic'

export default async function GuestReplyPage({
  params,
}: {
  params: Promise<{ reservationId: string }>
}) {
  const { reservationId } = await params
  const data = await getGuestReply(reservationId)

  if (!data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0a2029] p-6 text-center">
        <p className="text-sm text-white/60">Ta odgovor ni na voljo.</p>
      </main>
    )
  }

  const images = await getReplyExcursionImages(data.replyText)
  const html = buildReplyHtml(data.guestName, data.replyText, getPublicBaseUrl(), images)
  return (
    <main className="min-h-screen bg-[#0a2029]">
      <div className="mx-auto max-w-[640px]" dangerouslySetInnerHTML={{ __html: html }} />
    </main>
  )
}
