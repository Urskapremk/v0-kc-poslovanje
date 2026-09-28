"use client"

import React from "react"
import { submitCheckinByToken } from "@/app/actions/checkin"
import { bungalowDisplayName } from "@/lib/bungalow"
import { Check } from "lucide-react"

type Reservation = {
  id: string
  slot: "first" | "second"
  guestName: string | null
  arrival: string | null
  departure: string | null
  bungalow: string | null
  nationality: string | null
  passport: string | null
  dateOfBirth: string | null
  placeOfBirth: string | null
  fatherName: string | null
  motherName: string | null
  profession: string | null
  domicile: string | null
  passportDate: string | null
  passportLieu: string | null
  venantDe: string | null
  validiteVisa: string | null
  allantA: string | null
}

type Lang = "en" | "fr"

const T = {
  en: {
    title: "Guest Check-in",
    subtitle:
      "We kindly ask you to complete the information below, which is required by Malagasy law for guest registration with the Police Department.\n\nWe apologize for requesting these details and sincerely appreciate your understanding and cooperation.\n\nAll information provided will be treated confidentially and used solely for the mandatory registration process.\n\nThank you for your kindness, and we wish you a wonderful stay with us.\n\nThe Komba Cabana Team",
    welcome: "Welcome",
    stay: "Your stay",
    allDone: "All your details are already complete.",
    allDoneSub: "There is nothing left to fill in. Thank you!",
    guestName: "Full name",
    nationality: "Nationality",
    passport: "Passport number",
    dateOfBirth: "Date of birth",
    placeOfBirth: "Place of birth",
    fatherName: "Father's name",
    motherName: "Mother's name",
    profession: "Profession",
    domicile: "Home address",
    passportDate: "Passport issue date",
    passportLieu: "Passport issue place",
    venantDe: "Coming from (last location)",
    validiteVisa: "Visa validity",
    allantA: "Going to (next destination)",
    submit: "Submit details",
    submitting: "Submitting...",
    success: "Thank you!",
    successSub: "Your details have been received. You can close this page.",
    error: "Something went wrong. Please try again.",
    required: "Please fill in all fields.",
    optionalHint: "Please fill in what you can — you can submit even if some fields are left blank.",
  },
  fr: {
    title: "Enregistrement du client",
    subtitle:
      "Nous vous prions de bien vouloir compléter les informations ci-dessous, requises par la loi malgache pour l'enregistrement des clients auprès du Département de Police.\n\nNous nous excusons de vous demander ces détails et apprécions sincèrement votre compréhension et votre coopération.\n\nToutes les informations fournies seront traitées de manière confidentielle et utilisées uniquement pour la procédure d'enregistrement obligatoire.\n\nMerci de votre gentillesse, et nous vous souhaitons un merveilleux séjour parmi nous.\n\nL'équipe Komba Cabana",
    welcome: "Bienvenue",
    stay: "Votre séjour",
    allDone: "Toutes vos informations sont déjà complètes.",
    allDoneSub: "Il n'y a rien à remplir. Merci !",
    guestName: "Nom complet",
    nationality: "Nationalité",
    passport: "Numéro de passeport",
    dateOfBirth: "Date de naissance",
    placeOfBirth: "Lieu de naissance",
    fatherName: "Nom du père",
    motherName: "Nom de la mère",
    profession: "Profession",
    domicile: "Adresse du domicile",
    passportDate: "Date de délivrance du passeport",
    passportLieu: "Lieu de délivrance du passeport",
    venantDe: "Venant de (dernier lieu)",
    validiteVisa: "Validité du visa",
    allantA: "Allant à (prochaine destination)",
    submit: "Envoyer les informations",
    submitting: "Envoi...",
    success: "Merci !",
    successSub: "Vos informations ont été reçues. Vous pouvez fermer cette page.",
    error: "Une erreur s'est produite. Veuillez réessayer.",
    required: "Veuillez remplir tous les champs.",
    optionalHint: "Remplissez ce que vous pouvez — vous pouvez envoyer même si certains champs restent vides.",
  },
}

const FIELD_KEYS = [
  "guestName",
  "nationality",
  "passport",
  "dateOfBirth",
  "placeOfBirth",
  "fatherName",
  "motherName",
  "profession",
  "domicile",
  "passportDate",
  "passportLieu",
  "venantDe",
  "validiteVisa",
  "allantA",
] as const

type FieldKey = (typeof FIELD_KEYS)[number]

export function CheckinForm({
  token,
  reservation,
}: {
  token: string
  reservation: Reservation
}) {
  const [lang, setLang] = React.useState<Lang>("en")
  const t = T[lang]

  // Determine which fields are still missing
  const missingFields = FIELD_KEYS.filter(
    (key) => !reservation[key] || String(reservation[key]).trim() === ""
  )

  // Always let the guest confirm/correct their own name, even when it is already
  // filled: the operator may have entered a placeholder (e.g. "Child") that the
  // guest needs to replace. Name goes first, then the remaining missing fields.
  const shownFields = [
    "guestName",
    ...missingFields.filter((k) => k !== "guestName"),
  ] as FieldKey[]

  const [values, setValues] = React.useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    shownFields.forEach((k) => {
      // Pre-fill with the stored value so the guest can edit it in place.
      init[k] = reservation[k] ? String(reservation[k]) : ""
    })
    return init
  })
  const [status, setStatus] = React.useState<"idle" | "saving" | "done" | "error">(
    "idle"
  )
  const [errorMsg, setErrorMsg] = React.useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // Guests may fill in as much as they can — partial submissions are allowed.
    // Whatever they leave blank stays empty and can be completed later.
    setStatus("saving")
    setErrorMsg("")
    const res = await submitCheckinByToken(token, values)
    if (res.success) {
      setStatus("done")
    } else {
      setErrorMsg(t.error)
      setStatus("error")
    }
  }

  const formatDateRange = () => {
    if (!reservation.arrival || !reservation.departure) return ""
    const fmt = (d: string) =>
      new Date(d).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    return `${fmt(reservation.arrival)} → ${fmt(reservation.departure)}`
  }

  if (status === "done") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0a2029] px-6">
        <div className="w-full max-w-md rounded-2xl border border-[#8fae92]/30 bg-[#8fae92]/[0.06] p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#8fae92]/20">
            <Check className="h-7 w-7 text-[#8fae92]" />
          </div>
          <h1 className="mb-2 text-xl font-semibold text-white">{t.success}</h1>
          <p className="text-sm leading-relaxed text-white/50">{t.successSub}</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#0a2029] px-5 py-10">
      <div className="mx-auto w-full max-w-md">
        {/* Language toggle */}
        <div className="mb-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setLang("en")}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              lang === "en"
                ? "bg-[#c59b5b]/20 text-[#c59b5b]"
                : "bg-white/[0.04] text-white/40 hover:text-white/70"
            }`}
          >
            English
          </button>
          <button
            type="button"
            onClick={() => setLang("fr")}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              lang === "fr"
                ? "bg-[#c59b5b]/20 text-[#c59b5b]"
                : "bg-white/[0.04] text-white/40 hover:text-white/70"
            }`}
          >
            Français
          </button>
        </div>

        {/* Header */}
        <header className="mb-8 flex flex-col items-center text-center">
          <img
            src="/images/komba-logo-gold.png"
            alt="Komba Cabana"
            className="mb-6 h-24 w-auto max-w-[280px] object-contain drop-shadow-[0_0_30px_rgba(197,155,91,0.3)]"
          />
          <h1 className="text-2xl font-semibold text-white text-balance">
            {t.title}
          </h1>
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-white/50 text-pretty">
            {t.subtitle}
          </p>
        </header>

        {/* Reservation summary */}
        <div className="mb-8 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
          <p className="text-[11px] font-medium uppercase tracking-wider text-white/40">
            {t.welcome}
          </p>
          <p className="mt-1 text-lg font-semibold text-white">
            {reservation.guestName || "—"}
          </p>
          {reservation.bungalow && (
            <p className="text-sm text-[#c59b5b]">{bungalowDisplayName(reservation.bungalow)}</p>
          )}
          {formatDateRange() && (
            <p className="mt-2 text-xs text-white/40">
              {t.stay}: {formatDateRange()}
            </p>
          )}
        </div>

        {missingFields.length === 0 ? (
          <div className="rounded-2xl border border-[#8fae92]/30 bg-[#8fae92]/[0.06] p-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#8fae92]/20">
              <Check className="h-6 w-6 text-[#8fae92]" />
            </div>
            <p className="font-medium text-white">{t.allDone}</p>
            <p className="mt-1 text-sm text-white/50">{t.allDoneSub}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <p className="rounded-xl border border-[#7fa8b8]/20 bg-[#7fa8b8]/[0.06] px-4 py-3 text-xs leading-relaxed text-[#7fa8b8]">
              {t.optionalHint}
            </p>
            {shownFields.map((key) => (
              <div key={key}>
                <label
                  htmlFor={key}
                  className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40"
                >
                  {t[key as FieldKey]}
                </label>
                <input
                  id={key}
                  type={key === "dateOfBirth" || key === "passportDate" || key === "validiteVisa" ? "date" : "text"}
                  value={values[key]}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [key]: e.target.value }))
                  }
                  className={`w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white placeholder:text-white/20 focus:border-[#7fa8b8]/40 focus:outline-none ${
                    key === "dateOfBirth" || key === "passportDate" || key === "validiteVisa" ? "[color-scheme:dark]" : ""
                  }`}
                />
              </div>
            ))}

            {status === "error" && (
              <p className="text-sm text-red-400">{errorMsg}</p>
            )}

            <button
              type="submit"
              disabled={status === "saving"}
              className="mt-2 w-full rounded-xl bg-[#c59b5b] px-4 py-3.5 text-sm font-semibold text-[#0a2029] transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {status === "saving" ? t.submitting : t.submit}
            </button>
          </form>
        )}
      </div>
    </main>
  )
}
