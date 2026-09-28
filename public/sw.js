// Service worker for Komba Cabana push reminders.
// Runs even when the app is closed, which is the whole point: the phone must ring
// while it sits in a pocket. Keep this file dependency-free and defensive — a throw
// in here silently kills notification delivery with no visible error anywhere.

self.addEventListener("install", () => {
  // Take over immediately so a freshly enabled phone doesn't need a second visit.
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener("push", (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    // Fall back to raw text so a malformed payload still rings rather than vanishing.
    payload = { body: event.data ? event.data.text() : "" }
  }

  const title = payload.title || "Komba Cabana"
  const body = payload.body || "Nov opomnik"
  const url = payload.url || "/"

  // Android owns the notification volume — a web app cannot raise it. The only
  // real lever is ringing repeatedly, so one reminder rings three times.
  // The tag is computed ONCE and reused: with renotify, each repeat replaces the
  // same entry (one line in the shade) yet rings and vibrates again. A fresh tag
  // per repeat would pile up three separate notifications instead.
  const tag = payload.tag || `komba-${Date.now()}`
  const RINGS = 3
  const GAP_MS = 5000

  const ring = () =>
    self.registration.showNotification(title, {
      body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      // Longer, heavier pattern so it is felt through a pocket.
      vibrate: [500, 200, 500, 200, 500, 200, 700],
      tag,
      renotify: true,
      requireInteraction: true,
      // Carried along so the tap can show the text inside the app.
      data: { url, title, body, at: Date.now() },
    })

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

  event.waitUntil(
    (async () => {
      for (let i = 0; i < RINGS; i++) {
        if (i > 0) {
          await wait(GAP_MS)
          // Stop nagging the moment she has seen it: if the notification is gone
          // from the shade, it was opened or dismissed.
          const open = await self.registration.getNotifications({ tag })
          if (!open.length) return
        }
        await ring()
      }
    })(),
  )
})

self.addEventListener("notificationclick", (event) => {
  // Closing only clears the shade entry (and stops the repeat ringing). The text
  // itself is handed to the app, which keeps it on screen until it is dismissed by
  // hand — a notification vanishes far too quickly to be read.
  event.notification.close()

  const data = event.notification.data || {}
  const base = data.url || "/"
  const params = new URLSearchParams()
  if (data.body) params.set("opomnik", data.body)
  if (data.title) params.set("opomnikNaslov", data.title)
  const query = params.toString()
  const target = query ? `${base}${base.includes("?") ? "&" : "?"}${query}` : base

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Reuse an already-open tab instead of stacking duplicates.
      for (const client of clientList) {
        if ("focus" in client) {
          // Pass it in place rather than navigating, so whatever he was looking at
          // stays put and the reminder simply appears on top.
          client.postMessage({
            type: "komba-reminder",
            title: data.title || "",
            body: data.body || "",
            at: data.at || Date.now(),
          })
          return client.focus()
        }
      }
      return self.clients.openWindow(target)
    }),
  )
})
