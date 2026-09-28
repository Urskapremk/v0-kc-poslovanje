"use client"

import * as React from "react"
import useSWR from "swr"
import {
  BellRing,
  BellOff,
  Send,
  Loader2,
  Smartphone,
  ChevronDown,
  Check,
  CheckCheck,
  AlertTriangle,
  Inbox,
  Smile,
  Trash2,
  Undo2,
} from "lucide-react"
import {
  getPushConfig,
  savePushSubscription,
  removePushSubscription,
  countPushDevices,
  sendPushToPerson,
  getPushMessages,
  getReceivedPushMessages,
  getTrashedPushMessages,
  getSenderTrashedPushMessages,
  markPushMessageRead,
  trashPushMessage,
  restorePushMessage,
  trashSentPushMessage,
  restoreSentPushMessage,
  type PushTarget,
} from "@/app/actions/push"
import { PUSH_PERSON_KEY } from "@/lib/push-person"

/**
 * A full keyboard-style set, grouped and scrollable, the way a chat app shows them.
 * Kept as a plain list on purpose: no emoji-picker dependency, and the glyphs come
 * from the phone itself, so they render in the same style the user already knows.
 */
const EMOJI_GROUPS = [
  {
    label: "Nasmeški",
    items: [
      "😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "🙃", "😉", "😊",
      "😇", "🥲", "🥹", "😌", "😏", "🤗", "🤭", "🫢", "🤫", "🤔", "🫡", "🤨",
    ],
  },
  {
    label: "Ljubkost in norčije",
    items: [
      "😍", "🥰", "😘", "😗", "😙", "😚", "🤩", "🥳", "😜", "😝", "😛", "🤪",
      "😋", "🤤", "😎", "🥸", "🤠", "🤓", "🧐", "🫠", "🤑", "🤡", "👻", "💩",
    ],
  },
  {
    label: "Utrujeno in žalostno",
    items: [
      "😐", "😑", "😶", "🙄", "😴", "😪", "🥱", "😮‍💨", "😔", "😞", "😟", "🙁",
      "😢", "😭", "😩", "😫", "🥺", "😣", "😖", "😕", "🫤", "😬", "😰", "😥",
    ],
  },
  {
    label: "Jeza in presenečenje",
    items: [
      "😤", "😠", "😡", "🤬", "😱", "😨", "😧", "😦", "😯", "😲", "🤯", "🥵",
      "🥶", "🤢", "🤮", "🤧", "😷", "🤒", "🤕", "😵", "😈", "👽", "🤖", "🎃",
    ],
  },
  {
    label: "Kretnje",
    items: [
      "👍", "👎", "👌", "🤌", "🤏", "✌️", "🤞", "🫰", "🤟", "🤘", "👏", "🙌",
      "🫶", "🙏", "🤝", "💪", "👋", "🖐️", "✋", "🤙", "👈", "👉", "👆", "👇",
    ],
  },
  {
    label: "Srčki in znaki",
    items: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "💕", "💖", "💘", "💔",
      "✨", "🎉", "🎊", "🔥", "⭐", "🌟", "💯", "❗", "❓", "💤", "💥", "🙈",
    ],
  },
  {
    label: "Lodge in delo",
    items: [
      "✅", "⏰", "📞", "🔑", "🧺", "🧹", "📦", "💰", "🛳️", "✈️", "🚗", "🛺",
      "🍽️", "🍺", "🍹", "☕", "🐟", "🦞", "🌴", "🏝️", "☀️", "🌧️", "⚡", "🌙",
    ],
  },
] as const

/** VAPID keys travel as base64url but PushManager wants raw bytes. */
function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = window.atob(base64)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

type Props = {
  /** Whose phone this device belongs to. */
  person: PushTarget
  /** Who we can send reminders to from here. */
  sendTo?: PushTarget
  accent?: string
}

export function PushNotificationsBox({ person, sendTo, accent = "#c59b5b" }: Props) {
  const { data: config } = useSWR("push-config", getPushConfig, { revalidateOnFocus: false })
  const { data: deviceCount, mutate: mutateCount } = useSWR(
    sendTo ? ["push-devices", sendTo] : null,
    () => countPushDevices(sendTo!),
    { revalidateOnFocus: false },
  )

  const [showHistory, setShowHistory] = React.useState(false)
  // Read receipts change on the other person's phone, so refresh on focus —
  // otherwise the sender keeps looking at a stale "not read yet".
  const { data: history, mutate: mutateHistory } = useSWR(
    sendTo ? ["push-messages", sendTo] : null,
    () => getPushMessages(sendTo!),
    { revalidateOnFocus: true },
  )

  // This person's own inbox.
  const [showInbox, setShowInbox] = React.useState(false)
  const { data: inbox, mutate: mutateInbox } = useSWR(
    ["push-received", person],
    () => getReceivedPushMessages(person),
    { revalidateOnFocus: true },
  )
  const unread = inbox?.filter((m) => !m.readAt).length ?? 0

  // What this person cleared away. Loaded lazily — no point querying it until the
  // trash is actually opened.
  const [showTrash, setShowTrash] = React.useState(false)
  const { data: trash, mutate: mutateTrash } = useSWR(
    showTrash ? ["push-trashed", person] : null,
    () => getTrashedPushMessages(person),
  )

  const markRead = async (id: string) => {
    await markPushMessageRead(id)
    mutateInbox()
  }

  const trashOne = async (id: string) => {
    await trashPushMessage(id)
    mutateInbox()
    mutateTrash()
  }

  const restoreOne = async (id: string) => {
    await restorePushMessage(id)
    mutateInbox()
    mutateTrash()
  }

  // Same idea on the sent side, with its own flag so the two lists stay independent.
  const [showSentTrash, setShowSentTrash] = React.useState(false)
  const { data: sentTrash, mutate: mutateSentTrash } = useSWR(
    showSentTrash && sendTo ? ["push-sent-trashed", sendTo] : null,
    () => getSenderTrashedPushMessages(sendTo!),
  )

  const trashSent = async (id: string) => {
    await trashSentPushMessage(id)
    mutateHistory()
    mutateSentTrash()
  }

  const restoreSent = async (id: string) => {
    await restoreSentPushMessage(id)
    mutateHistory()
    mutateSentTrash()
  }

  const [subscribed, setSubscribed] = React.useState<boolean | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [note, setNote] = React.useState<string | null>(null)
  const [message, setMessage] = React.useState("")
  const [sending, setSending] = React.useState(false)

  const [showEmoji, setShowEmoji] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  const emojiWrapRef = React.useRef<HTMLDivElement | null>(null)

  // Insert at the caret, not at the end — she may want the emoji in front of the
  // text ("❗ pokliči Dilipa"). Focus and caret are restored after the re-render.
  const insertEmoji = (emoji: string) => {
    const el = inputRef.current
    const at = el ? (el.selectionStart ?? message.length) : message.length
    const next = message.slice(0, at) + emoji + message.slice(el ? (el.selectionEnd ?? at) : at)
    setMessage(next)
    const caret = at + emoji.length
    requestAnimationFrame(() => {
      const i = inputRef.current
      if (!i) return
      i.focus()
      i.setSelectionRange(caret, caret)
    })
  }

  // Close the picker on an outside click or Escape, so it never sits over the
  // history list waiting to be dismissed.
  React.useEffect(() => {
    if (!showEmoji) return
    const onDown = (e: MouseEvent) => {
      if (!emojiWrapRef.current?.contains(e.target as Node)) setShowEmoji(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowEmoji(false)
    }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [showEmoji])

  const supported =
    typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window

  // Push targets are ASCII, but the UI must read Slovene.
  const label = (p: PushTarget) => (p === "Urska" ? "Urška" : p)
  // "Opomnik za ..." needs the accusative, otherwise the phone shows broken Slovene.
  const labelAcc = (p: PushTarget) => (p === "Urska" ? "Urško" : "Boruta")
  // "Pošlji opomnik ..." needs the dative.
  const labelDat = (p: PushTarget) => (p === "Urska" ? "Urški" : "Borutu")
  // Read receipts read as a sentence about a person, so the verb needs gender.
  const labelRead = (p: PushTarget) => (p === "Urska" ? "prebrala" : "prebral")

  // Reflect the true browser state rather than assuming — the phone may have
  // revoked permission since the last visit.
  React.useEffect(() => {
    if (!supported) {
      setSubscribed(false)
      return
    }
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        // The phone caches the worker, so a changed ring pattern would keep using
        // the old one until some later visit. Ask for the new version explicitly.
        reg.update().catch(() => {})
        return reg.pushManager.getSubscription()
      })
      .then((sub) => {
        setSubscribed(!!sub)
        // Remember whose phone this is (device identity, not app data) so the
        // reminder card knows which reminders to show, on any page.
        if (sub) localStorage.setItem(PUSH_PERSON_KEY, person)
      })
      .catch(() => setSubscribed(false))
  }, [supported, person])

  const enable = async () => {
    setBusy(true)
    setNote(null)
    try {
      if (!config?.publicKey) {
        setNote("Ključa za obvestila še nista vpisana v nastavitvah.")
        return
      }
      const permission = await Notification.requestPermission()
      if (permission !== "granted") {
        setNote("Telefon je obvestila zavrnil. Dovoli jih v nastavitvah brskalnika.")
        return
      }
      const reg = await navigator.serviceWorker.register("/sw.js")
      await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(config.publicKey),
      })
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
      const res = await savePushSubscription(person, json, navigator.userAgent)
      if (!res.ok) {
        setNote(res.error || "Naročnine ni bilo mogoče shraniti.")
        return
      }
      setSubscribed(true)
      localStorage.setItem(PUSH_PERSON_KEY, person)
      setNote("Ta telefon bo zdaj zvonil.")
      mutateCount()
    } catch (err) {
      console.log("[v0] enable push failed:", (err as Error)?.message)
      setNote("Vklop ni uspel. Poskusi znova.")
    } finally {
      setBusy(false)
    }
  }

  const disable = async () => {
    setBusy(true)
    setNote(null)
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      const sub = await reg?.pushManager.getSubscription()
      if (sub) {
        await removePushSubscription(sub.endpoint)
        await sub.unsubscribe()
      }
      setSubscribed(false)
      localStorage.removeItem(PUSH_PERSON_KEY)
      setNote("Obvestila so izklopljena na tem telefonu.")
      mutateCount()
    } catch {
      setNote("Izklop ni uspel.")
    } finally {
      setBusy(false)
    }
  }

  const send = async () => {
    const text = message.trim()
    if (!text || !sendTo) return
    setSending(true)
    setNote(null)
    try {
      const res = await sendPushToPerson(sendTo, {
        title: `Opomnik za ${labelAcc(sendTo)}`,
        body: text,
        url: "/",
      })
      if (res.error) setNote(res.error)
      else if (res.sent > 0) {
        setNote(`Poslano — zazvonilo je na ${res.sent === 1 ? "1 telefonu" : `${res.sent} telefonih`}.`)
        setMessage("")
        setShowEmoji(false)
      } else setNote("Obvestila ni bilo mogoče dostaviti.")
      // Every attempt is logged, including failures — reload so the list matches.
      mutateHistory()
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
      <div className="flex items-center gap-2">
        <span aria-hidden className="h-px w-4" style={{ backgroundColor: `${accent}99` }} />
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: accent }}>
          Zvonjenje na telefon
        </p>
      </div>

      {!config?.configured && (
        <p className="mt-3 rounded-lg border border-[#b0203a]/30 bg-[#b0203a]/10 px-3 py-2 text-[11px] leading-relaxed text-[#f0a8b4]">
          Manjkata ključa za obvestila. Vpiši ju v Vars (nastavitve zgoraj desno), potem bo zvonjenje
          delovalo brez dodatnega dela.
        </p>
      )}

      {/* This device's own switch. */}
      <div className="mt-3 flex flex-wrap items-center gap-2.5">
        <span className="inline-flex items-center gap-1.5 text-[11px] text-white/50">
          <Smartphone className="h-3.5 w-3.5" />
          Ta telefon ({label(person)})
        </span>
        {subscribed === null ? (
          <span className="text-[11px] text-white/40">preverjam…</span>
        ) : !supported ? (
          <span className="text-[11px] text-white/40">Ta brskalnik obvestil ne podpira.</span>
        ) : subscribed ? (
          <button
            type="button"
            onClick={disable}
            disabled={busy}
            className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70 transition-colors hover:bg-white/[0.08] disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <BellOff className="h-3 w-3" />}
            Izklopi
          </button>
        ) : (
          <button
            type="button"
            onClick={enable}
            disabled={busy || !config?.configured}
            className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border border-[#4f7a54]/40 bg-[#4f7a54]/15 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8fae92] transition-colors hover:bg-[#4f7a54]/25 disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <BellRing className="h-3 w-3" />}
            Vklopi obvestila
          </button>
        )}
      </div>

      {/* This person's inbox — what they were sent, and what they still owe an
          acknowledgement for. */}
      <div className="mt-4 border-t border-white/[0.06] pt-3">
        <button
          type="button"
          onClick={() => setShowInbox((v) => !v)}
          aria-expanded={showInbox}
          className="flex w-full cursor-pointer items-center justify-between gap-2 text-left"
        >
          <span className="flex flex-wrap items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
            <Inbox className="h-3.5 w-3.5" />
            Prejeti opomniki
            {inbox && inbox.length > 0 && <span className="text-white/25">{` · ${inbox.length}`}</span>}
            {unread > 0 && (
              <span
                className="rounded-full px-1.5 py-0.5 text-[9px] tracking-[0.12em]"
                style={{ backgroundColor: `${accent}26`, color: accent }}
              >
                {unread === 1
                  ? "1 nov"
                  : unread === 2
                    ? "2 nova"
                    : unread === 3 || unread === 4
                      ? `${unread} novi`
                      : `${unread} novih`}
              </span>
            )}
          </span>
          <ChevronDown
            className={`h-3.5 w-3.5 flex-shrink-0 text-white/40 transition-transform duration-300 ${showInbox ? "rotate-180" : ""}`}
          />
        </button>

        {showInbox && (
          <div className="mt-2 flex flex-col divide-y divide-white/[0.06]">
            {!inbox ? (
              <p className="py-2 text-[11px] text-white/40">Nalagam…</p>
            ) : inbox.length === 0 ? (
              <p className="py-2 text-[11px] font-light italic text-white/40">Še nič prejetega.</p>
            ) : (
              inbox.map((m) => (
                <div key={m.id} className="flex items-start gap-2 py-2">
                  {m.readAt ? (
                    <CheckCheck className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[#8fae92]" />
                  ) : (
                    <span
                      aria-hidden
                      className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full"
                      style={{ backgroundColor: accent }}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className={`text-[12px] leading-snug ${m.readAt ? "text-white/60" : "text-white/90"}`}>
                      {m.body}
                    </p>
                    <p className="mt-0.5 text-[10px] text-white/35">
                      <span className="tabular-nums">
                        {new Date(m.createdAt).toLocaleString("sl-SI", {
                          day: "numeric",
                          month: "long",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {m.source === "task" && " · opravilo"}
                      {m.readAt && " · prebrano"}
                    </p>
                    {!m.readAt && (
                      <button
                        type="button"
                        onClick={() => markRead(m.id)}
                        className="mt-1.5 cursor-pointer rounded-full border border-white/15 bg-white/[0.04] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/60 transition-colors hover:bg-white/[0.08]"
                      >
                        Označi kot prebrano
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => trashOne(m.id)}
                    aria-label="Odstrani v koš"
                    title="Odstrani v koš"
                    className="-mr-1 flex h-8 w-8 flex-shrink-0 cursor-pointer items-center justify-center rounded-full text-white/30 transition-colors hover:bg-[#b0203a]/15 hover:text-[#b0203a]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}

            {/* Undo lives right here rather than in a separate screen: the mistake
                and the fix belong in the same place. */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowTrash((v) => !v)}
                aria-expanded={showTrash}
                className="flex w-full cursor-pointer items-center gap-1.5 text-left text-[10px] font-semibold uppercase tracking-[0.16em] text-white/30 transition-colors hover:text-white/50"
              >
                <Trash2 className="h-3 w-3" />
                Koš
                {trash && trash.length > 0 && <span className="text-white/25">{` · ${trash.length}`}</span>}
                <ChevronDown
                  className={`ml-auto h-3 w-3 transition-transform duration-300 ${showTrash ? "rotate-180" : ""}`}
                />
              </button>

              {showTrash && (
                <div className="mt-1.5 flex flex-col divide-y divide-white/[0.06]">
                  {!trash ? (
                    <p className="py-2 text-[11px] text-white/40">Nalagam…</p>
                  ) : trash.length === 0 ? (
                    <p className="py-2 text-[11px] font-light italic text-white/40">Koš je prazen.</p>
                  ) : (
                    trash.map((m) => (
                      <div key={m.id} className="flex items-start gap-2 py-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-[12px] leading-snug text-white/45 line-through">{m.body}</p>
                          <p className="mt-0.5 text-[10px] text-white/30">
                            <span className="tabular-nums">
                              {new Date(m.createdAt).toLocaleString("sl-SI", {
                                day: "numeric",
                                month: "long",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                            {m.source === "task" && " · opravilo"}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => restoreOne(m.id)}
                          aria-label="Vrni iz koša"
                          title="Vrni iz koša"
                          className="-mr-1 flex h-8 w-8 flex-shrink-0 cursor-pointer items-center justify-center rounded-full text-white/30 transition-colors hover:bg-white/10 hover:text-white/70"
                        >
                          <Undo2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Free-text reminder to the other person. */}
      {sendTo && (
        <div className="mt-4 border-t border-white/[0.06] pt-3">
          <p className="text-[11px] text-white/50">
            Pošlji opomnik <span className="text-white/80">{labelDat(sendTo)}</span>
            {typeof deviceCount === "number" && (
              <span className="text-white/35">
                {" · "}
                {deviceCount === 0
                  ? "še ni vklopil obvestil"
                  : deviceCount === 1
                    ? "1 telefon pripravljen"
                    : deviceCount === 2
                      ? "2 telefona pripravljena"
                      : `${deviceCount} telefonov pripravljenih`}
              </span>
            )}
          </p>
          <div ref={emojiWrapRef} className="mt-2">
          <div className="flex flex-wrap gap-2">
            <input
              ref={inputRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                // Guard against CJK IME composition confirming with Enter.
                if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229) {
                  e.preventDefault()
                  send()
                }
              }}
              placeholder="Kaj naj stori?"
              className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-white/25 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setShowEmoji((v) => !v)}
              aria-expanded={showEmoji}
              aria-label="Dodaj emotikon"
              title="Dodaj emotikon"
              className={`inline-flex h-9 w-9 flex-shrink-0 cursor-pointer items-center justify-center rounded-full border transition-colors ${
                showEmoji
                  ? "border-white/25 bg-white/[0.10] text-white/80"
                  : "border-white/10 bg-white/[0.03] text-white/45 hover:bg-white/[0.08]"
              }`}
            >
              <Smile className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={send}
              disabled={sending || !message.trim()}
              className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] transition-colors disabled:opacity-40"
              style={{ borderColor: `${accent}66`, backgroundColor: `${accent}22`, color: accent }}
            >
              {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
              Pošlji
            </button>
          </div>

          {showEmoji && (
            <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-white/10 bg-white/[0.04] p-2">
              {EMOJI_GROUPS.map((group) => (
                <div key={group.label} className="mb-2 last:mb-0">
                  <p className="mb-1 px-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/30">
                    {group.label}
                  </p>
                  <div className="grid grid-cols-8 gap-1">
                    {group.items.map((e) => (
                      <button
                        key={e}
                        type="button"
                        onClick={() => insertEmoji(e)}
                        aria-label={`Dodaj ${e}`}
                        className="flex h-8 cursor-pointer items-center justify-center rounded text-[19px] leading-none transition-colors hover:bg-white/10"
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          </div>

          {/* What was already sent — collapsed so the panel stays short. */}
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            aria-expanded={showHistory}
            className="mt-3 flex w-full cursor-pointer items-center justify-between gap-2 text-left"
          >
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
              Poslani opomniki
              {history && history.length > 0 && <span className="text-white/25">{` · ${history.length}`}</span>}
            </span>
            <ChevronDown
              className={`h-3.5 w-3.5 text-white/40 transition-transform duration-300 ${showHistory ? "rotate-180" : ""}`}
            />
          </button>

          {showHistory && (
            <div className="mt-2 flex flex-col divide-y divide-white/[0.06]">
              {!history ? (
                <p className="py-2 text-[11px] text-white/40">Nalagam…</p>
              ) : history.length === 0 ? (
                <p className="py-2 text-[11px] font-light italic text-white/40">Še nič poslanega.</p>
              ) : (
                history.map((m) => {
                  const arrived = m.sentCount > 0
                  return (
                    <div key={m.id} className="flex items-start gap-2 py-2">
                      {!arrived ? (
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[#f0a8b4]" />
                      ) : m.readAt ? (
                        // Two ticks: delivered and acknowledged on their phone.
                        <CheckCheck className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[#8fae92]" />
                      ) : (
                        <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-white/35" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] leading-snug text-white/80">{m.body}</p>
                        <p className="mt-0.5 text-[10px] text-white/35">
                          <span className="tabular-nums">
                            {new Date(m.createdAt).toLocaleString("sl-SI", {
                              day: "numeric",
                              month: "long",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          {m.source === "task" && " · opravilo"}
                          {!arrived && " · ni dostavljeno"}
                        </p>
                        {arrived && (
                          <p className="mt-0.5 text-[10px]">
                            {m.readAt ? (
                              <span className="text-[#8fae92]">
                                {`${label(sendTo)} je ${labelRead(sendTo)} `}
                                <span className="tabular-nums">
                                  {new Date(m.readAt).toLocaleString("sl-SI", {
                                    day: "numeric",
                                    month: "long",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              </span>
                            ) : (
                              <span className="text-white/30">{`${label(sendTo)} še ni ${labelRead(sendTo)}`}</span>
                            )}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => trashSent(m.id)}
                        aria-label="Odstrani iz poslanih"
                        title="Odstrani iz poslanih"
                        className="-mr-1 flex h-8 w-8 flex-shrink-0 cursor-pointer items-center justify-center rounded-full text-white/30 transition-colors hover:bg-[#b0203a]/15 hover:text-[#b0203a]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )
                })
              )}

              {/* Undo sits next to the list it undoes, same as in the inbox. */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowSentTrash((v) => !v)}
                  aria-expanded={showSentTrash}
                  className="flex w-full cursor-pointer items-center gap-1.5 text-left text-[10px] font-semibold uppercase tracking-[0.16em] text-white/30 transition-colors hover:text-white/50"
                >
                  <Trash2 className="h-3 w-3" />
                  Koš
                  {sentTrash && sentTrash.length > 0 && (
                    <span className="text-white/25">{` · ${sentTrash.length}`}</span>
                  )}
                  <ChevronDown
                    className={`ml-auto h-3 w-3 transition-transform duration-300 ${showSentTrash ? "rotate-180" : ""}`}
                  />
                </button>

                {showSentTrash && (
                  <div className="mt-1.5 flex flex-col divide-y divide-white/[0.06]">
                    {!sentTrash ? (
                      <p className="py-2 text-[11px] text-white/40">Nalagam…</p>
                    ) : sentTrash.length === 0 ? (
                      <p className="py-2 text-[11px] font-light italic text-white/40">Koš je prazen.</p>
                    ) : (
                      sentTrash.map((m) => (
                        <div key={m.id} className="flex items-start gap-2 py-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-[12px] leading-snug text-white/45 line-through">{m.body}</p>
                            <p className="mt-0.5 text-[10px] text-white/30">
                              <span className="tabular-nums">
                                {new Date(m.createdAt).toLocaleString("sl-SI", {
                                  day: "numeric",
                                  month: "long",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                              {m.source === "task" && " · opravilo"}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => restoreSent(m.id)}
                            aria-label="Vrni iz koša"
                            title="Vrni iz koša"
                            className="-mr-1 flex h-8 w-8 flex-shrink-0 cursor-pointer items-center justify-center rounded-full text-white/30 transition-colors hover:bg-white/10 hover:text-white/70"
                          >
                            <Undo2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {note && <p className="mt-3 text-[11px] leading-relaxed text-white/55">{note}</p>}
    </div>
  )
}
