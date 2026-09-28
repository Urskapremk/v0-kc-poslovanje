import { getReservationByToken } from "@/app/actions/checkin"
import { CheckinForm } from "./checkin-form"

export const dynamic = "force-dynamic"

export default async function CheckinPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const reservation = await getReservationByToken(token)

  if (!reservation) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0a2029] px-6">
        <div className="w-full max-w-md rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
          <h1 className="mb-3 text-xl font-semibold text-white text-balance">
            Link is no longer valid
          </h1>
          <p className="text-sm leading-relaxed text-white/50">
            This check-in link has expired or is invalid. Please contact the
            reception for assistance.
          </p>
          <p className="mt-4 text-xs leading-relaxed text-white/30">
            Ce lien d&apos;enregistrement a expiré ou n&apos;est pas valide.
            Veuillez contacter la réception.
          </p>
        </div>
      </main>
    )
  }

  return <CheckinForm token={token} reservation={reservation} />
}
