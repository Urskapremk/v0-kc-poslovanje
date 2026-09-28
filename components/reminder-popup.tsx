"use client"

import * as React from "react"
import useSWR from "swr"
import { BellRing, X } from "lucide-react"
import { getUnreadPushMessages, markPushMessageRead, type PushTarget } from "@/app/actions/push"
import { PUSH_PERSON_KEY } from "@/lib/push-person"

type Reminder = { id?: string; title: string; body: string; at: number }

/**
 * A phone notification is gone from the screen in a second or two, and its text is
 * truncated. This card keeps the full reminder up until it is closed by hand.
 *
 * It does NOT rely on the notification tap to carry the text: every reminder is
 * stored server-side, so the card is driven by "what has this person not read
 * yet". That way a phone still running an older service worker, or a notification
 * that vanished before it could be read, still ends up showing the reminder.
 */
export function ReminderPopup() {
  const [reminder, setReminder] = React.useState<Reminder | null>(null)
  const [person, setPerson] = React.useState<PushTarget | null>(null)
  // Ids already closed here, so the pending list cannot flash them back up in the
  // window between marking read and the refetch landing.
  const dismissed = React.useRef<Set<string>>(new Set())

  React.useEffect(() => {
    // Whose phone this is — recorded when notifications were switched on.
    const stored = localStorage.getItem(PUSH_PERSON_KEY)
    if (stored === "Borut" || stored === "Urska") setPerson(stored)

    // The app was opened by the tap (it was closed before), so the reminder
    // arrives in the address bar.
    const params = new URLSearchParams(window.location.search)
    const body = params.get("opomnik")
    if (body) {
      setReminder({ title: params.get("opomnikNaslov") || "Opomnik", body, at: Date.now() })
      // Drop the params so a later refresh doesn't resurrect an old reminder.
      params.delete("opomnik")
      params.delete("opomnikNaslov")
      const query = params.toString()
      window.history.replaceState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}`)
    }

    if (!("serviceWorker" in navigator)) return
    // Phones cache the worker; ask for the current one on every page so fixes to
    // the notification handling actually reach the device.
    navigator.serviceWorker.getRegistration().then((reg) => reg?.update().catch(() => {}))

    // The app was already open, so the worker passes it in directly — no
    // navigation, so nothing on screen is lost.
    const onMessage = (event: MessageEvent) => {
      const data = event.data
      if (data && data.type === "komba-reminder" && data.body) {
        setReminder({ title: data.title || "Opomnik", body: data.body, at: data.at || Date.now() })
      }
    }
    navigator.serviceWorker.addEventListener("message", onMessage)
    return () => navigator.serviceWorker.removeEventListener("message", onMessage)
  }, [])

  const { data: pending, mutate } = useSWR(
    person ? ["unread-push", person] : null,
    () => getUnreadPushMessages(person!),
    // Checked on open and whenever the app comes back to the foreground, which is
    // exactly when a tapped notification lands here.
    { refreshInterval: 30000, revalidateOnFocus: true },
  )

  React.useEffect(() => {
    if (reminder || !pending?.length) return
    const next = pending.find((m) => !dismissed.current.has(m.id))
    if (next) {
      setReminder({
        id: next.id,
        title: next.title,
        body: next.body,
        at: new Date(next.createdAt).getTime(),
      })
    }
  }, [pending, reminder])

  const close = () => {
    const id = reminder?.id
    setReminder(null)
    if (!id) return
    dismissed.current.add(id)
    markPushMessageRead(id)
      .then(() => mutate())
      .catch(() => {})
  }

  if (!reminder) return null

  const waiting = pending ? pending.filter((m) => !dismissed.current.has(m.id)).length - 1 : 0

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Prejet opomnik"
      className="fixed inset-0 z-[200] flex items-center justify-center bg-[#071c24]/85 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-sm rounded-2xl border border-[#c59b5b]/35 bg-[#0f2e3a] p-5 shadow-2xl">
        <div className="flex items-center gap-2">
          <span aria-hidden className="h-px w-4 bg-[#c59b5b]/60" />
          <BellRing className="h-4 w-4 text-[#e8c88a]" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#e8c88a]">Opomnik</span>
          <button
            type="button"
            onClick={close}
            aria-label="Zapri opomnik"
            className="ml-auto cursor-pointer rounded-lg border border-white/10 bg-white/5 p-1.5 text-white/55 transition-colors hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-4 text-[17px] font-light leading-snug text-pretty text-white">{reminder.body}</p>

        <p className="mt-3 text-[11px] text-white/40">
          <span className="tabular-nums">
            {new Date(reminder.at).toLocaleString("sl-SI", {
              day: "numeric",
              month: "long",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          {reminder.title && reminder.title !== "Opomnik" && ` · ${reminder.title}`}
        </p>

        <button
          type="button"
          onClick={close}
          className="mt-5 w-full cursor-pointer rounded-xl bg-[#c59b5b] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#0a2029] transition-colors hover:bg-[#e8c88a]"
        >
          Prebrano — zapri
        </button>

        {waiting > 0 && (
          <p className="mt-2.5 text-center text-[10px] uppercase tracking-[0.16em] text-white/35">
            {waiting === 1
              ? "Še 1 opomnik čaka"
              : waiting === 2
                ? "Še 2 opomnika čakata"
                : waiting === 3 || waiting === 4
                  ? `Še ${waiting} opomniki čakajo`
                  : `Še ${waiting} opomnikov čaka`}
          </p>
        )}
      </div>
    </div>
  )
}
