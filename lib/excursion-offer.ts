// Guest-facing excursion offer — a curated, de-duplicated list of the trips we
// can organize for guests, drawn from the active excursions in the catalog but
// cleaned up for guests (no internal "Fanja"/provider names, no duplicates).
// Shared (no 'use server') so both the email builder and any preview can use it.

export type OfferExcursion = {
  title: string
  duration: string
  blurb: string
}

// Order roughly by popularity / signature trips first.
export const OFFER_EXCURSIONS: OfferExcursion[] = [
  {
    title: 'Nosy Tanikely & Nosy Sakatia',
    duration: 'Full day · with lunch on the beach',
    blurb:
      'Our signature day out. Snorkel the open-air aquarium of Nosy Tanikely among turtles, rays and tropical fish, climb to the lighthouse for a panoramic view of the bay, then swim with the giant green sea turtles of Nosy Sakatia. Lunch of local specialities is served in the shade of the palm trees.',
  },
  {
    title: 'Nosy Iranja — the turtle island',
    duration: 'Full day',
    blurb:
      'A boat trip to one of the most beautiful white-sand islands of the region, famous for its turquoise water and the sandbar that links the two islets at low tide. Time to swim, relax and explore.',
  },
  {
    title: 'Lokobe National Park',
    duration: 'Full day · Nosy Be',
    blurb:
      'A guided walk through the last primary rainforest of Nosy Be. Spot lemurs, chameleons, boas and colourful frogs with a local guide, reached by a traditional pirogue.',
  },
  {
    title: 'Ampangorina Maki Park',
    duration: 'Half day · on Nosy Komba',
    blurb:
      'A short, easy visit to the lemur park in the village of Ampangorina, right here on Nosy Komba — perfect for meeting the friendly lemurs up close.',
  },
  {
    title: 'Top of Nosy Komba (with Baobab option)',
    duration: 'Half day · with local guide',
    blurb:
      'A hike to the summit of our island with a local guide, for sweeping views over the bay. Can be combined with a visit to the baobab tree.',
  },
  {
    title: 'Around Nosy Komba island',
    duration: 'Flexible',
    blurb:
      'A relaxed tour around our own island, discovering the beaches, villages and viewpoints of Nosy Komba.',
  },
]

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function firstNameOf(fullName: string): string {
  return (fullName || '').trim().split(/\s+/)[0] || 'there'
}

// Build the branded HTML excursion offer email in the Komba Cabana style
// (same dark theme + gold logo as the check-in / feedback emails).
export function buildExcursionOfferHtml(opts: { guestName: string; baseUrl: string }): string {
  const base = opts.baseUrl.replace(/\/$/, '')
  const logo = `${base}/images/komba-logo-gold.png`
  const hi = escapeHtml(firstNameOf(opts.guestName))

  const cards = OFFER_EXCURSIONS.map(
    (e) => `
      <tr>
        <td style="padding:8px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#143a49" style="background-color:#143a49;border:1px solid #1d4a5c;border-radius:12px;">
            <tr><td style="padding:16px 18px;">
              <p style="margin:0 0 4px 0;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:700;color:#c59b5b;">${escapeHtml(e.title)}</p>
              <p style="margin:0 0 10px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:600;letter-spacing:.3px;text-transform:uppercase;color:#7fa8b8;">${escapeHtml(e.duration)}</p>
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#b9c6ca;">${escapeHtml(e.blurb)}</p>
            </td></tr>
          </table>
        </td>
      </tr>`,
  ).join('')

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#0a2029;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#0a2029" style="background-color:#0a2029;">
    <tr><td align="center" bgcolor="#0a2029" style="background-color:#0a2029;padding:32px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" bgcolor="#0a2029" style="width:600px;max-width:600px;background-color:#0a2029;">
        <tr><td align="center" bgcolor="#0a2029" style="background-color:#0a2029;padding:8px 0 24px 0;">
          <img src="${logo}" alt="Komba Cabana" width="150" style="display:block;border:0;outline:none;max-width:150px;height:auto;">
        </td></tr>
        <tr><td align="center" bgcolor="#0a2029" style="background-color:#0a2029;padding:0 8px 8px 8px;">
          <h1 style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:26px;font-weight:700;color:#ffffff;">Excursions &amp; day trips</h1>
        </td></tr>
        <tr><td bgcolor="#0a2029" style="background-color:#0a2029;padding:12px 16px 8px 16px;">
          <p style="margin:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#b9c6ca;text-align:center;">Dear ${hi},</p>
          <p style="margin:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#b9c6ca;text-align:center;">We are delighted to have you with us at Komba Cabana. To make the most of your stay, here are the excursions and day trips we would be happy to organize for you.</p>
          <p style="margin:0 0 12px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#c59b5b;text-align:center;font-weight:600;">Just let us know at reception which ones interest you, and we will take care of the rest.</p>
        </td></tr>
        <tr><td bgcolor="#0a2029" style="background-color:#0a2029;padding:4px 20px 0 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#0a2029" style="background-color:#0a2029;">${cards}</table>
        </td></tr>
        <tr><td bgcolor="#0a2029" style="background-color:#0a2029;padding:16px 16px 0 16px;">
          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:#7f9095;text-align:center;">Prices depend on the number of participants — our team will gladly share the exact price and availability for your chosen dates. Departures are usually in the morning from the Komba Cabana beach.</p>
          <p style="margin:16px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#b9c6ca;text-align:center;">We look forward to helping you discover the beauty of Nosy Komba and its islands.</p>
          <p style="margin:16px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#b9c6ca;text-align:center;">Warm regards,<br>Komba Cabana Team</p>
        </td></tr>
        <tr><td align="center" bgcolor="#0a2029" style="background-color:#0a2029;padding:24px 16px 8px 16px;">
          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#7e786d;">Komba Cabana &middot; Nosy Komba, Madagascar</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
