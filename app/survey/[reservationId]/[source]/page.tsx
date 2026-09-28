import { recordSurveyResponse } from "@/app/actions/survey"
import { findSurveySource } from "@/lib/survey-sources"
import { SurveyThankYou } from "./thank-you"

export const dynamic = "force-dynamic"

export default async function SurveyPage({
  params,
}: {
  params: Promise<{ reservationId: string; source: string }>
}) {
  const { reservationId, source } = await params

  // Guard against unknown source keys.
  if (!findSurveySource(source)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0a2029] px-6">
        <div className="w-full max-w-md rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
          <h1 className="mb-3 text-xl font-semibold text-white text-balance">Link is not valid</h1>
          <p className="text-sm leading-relaxed text-white/50">
            This survey link is invalid. Please contact the reception for assistance.
          </p>
        </div>
      </main>
    )
  }

  const result = await recordSurveyResponse(reservationId, source)

  return (
    <SurveyThankYou
      reservationId={reservationId}
      guestName={result.guestName}
      initialSource={source}
      initialSelected={result.selected}
    />
  )
}
