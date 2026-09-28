// Guest / agency facing "port departure time" request email.
// Many transfers arrive without a known boat time at the Nosy Be port, so we ask
// the guest (direct bookings) or the agency (agency bookings) for the departure
// time from the Port of Nosy Be, since that time is what we need to have our boat
// ready. Bilingual EN + FR. Shared (no 'use server') so the email builder and any
// preview can both use it. Same dark, gold-logo Komba Cabana style as the other emails.

function escapeHtml(s: string): string {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function firstNameOf(fullName: string): string {
  // Skip leading titles (Mr., Mrs., Ms., Dr., etc.) so the greeting is a real name.
  const parts = (fullName || '')
    .trim()
    .split(/\s+/)
    .filter((p) => !/^(mr|mrs|ms|miss|dr|prof|sir|madam|mme|m|mlle)\.?$/i.test(p))
  return parts[0] || 'there'
}

export type PortTimeEmailOpts = {
  guestName: string
  bungalow?: string
  arrival?: string // YYYY-MM-DD
  pax?: number
  isAgency: boolean
  agencyName?: string
  baseUrl: string
}

export function buildPortTimeRequestHtml(opts: PortTimeEmailOpts): string {
  const base = opts.baseUrl.replace(/\/$/, '')
  const logo = `${base}/images/komba-logo-gold.png`
  const guest = escapeHtml(opts.guestName || 'Guest')
  const hi = escapeHtml(firstNameOf(opts.guestName))
  const arrival = escapeHtml(opts.arrival || '')
  const bungalow = escapeHtml(opts.bungalow || '')
  const pax = opts.pax && opts.pax > 0 ? opts.pax : undefined

  // Reservation summary block (shown to both, more relevant for the agency)
  const summaryRows = [
    ['Guest / Client', guest],
    bungalow ? ['Bungalow', bungalow] : null,
    arrival ? ['Arrival / Arrivée', arrival] : null,
    pax ? ['Guests / Personnes', String(pax)] : null,
  ].filter(Boolean) as [string, string][]

  const summary = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#143a49" style="background-color:#143a49;border:1px solid #1d4a5c;border-radius:12px;margin:8px 0 4px 0;">
      <tr><td style="padding:14px 18px;">
        ${summaryRows
          .map(
            ([k, v]) =>
              `<p style="margin:0 0 6px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:#b9c6ca;"><span style="color:#7fa8b8;text-transform:uppercase;font-size:11px;letter-spacing:.3px;">${escapeHtml(k)}:</span> <span style="color:#ffffff;font-weight:600;">${v}</span></p>`,
          )
          .join('')}
      </td></tr>
    </table>`

  // Body copy — English then French
  const bodyEn = opts.isAgency
    ? `<p style="margin:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#b9c6ca;">We are arranging the boat transfer for the guests on the reservation below. To have our boat ready at the right moment, we need to know <strong style="color:#ffffff;">at what time you order / plan the boat departure from the Port of Nosy Be (Hell-Ville)</strong>.</p>
       <p style="margin:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#c59b5b;font-weight:600;">Could you please confirm the departure time at the port? The time at the port is what matters most for us.</p>`
    : `<p style="margin:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#b9c6ca;">Dear ${hi}, we are looking forward to welcoming you to Komba Cabana. To organize your boat transfer, we need to know <strong style="color:#ffffff;">at what time you will depart from the Port of Nosy Be (Hell-Ville)</strong> so our boat is ready to pick you up.</p>
       <p style="margin:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#c59b5b;font-weight:600;">Could you please let us know your departure time from the port? The time at the port is what we need most.</p>`

  const bodyFr = opts.isAgency
    ? `<p style="margin:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#b9c6ca;">Nous organisons le transfert en bateau pour les clients de la réservation ci-dessous. Afin de préparer notre bateau au bon moment, nous avons besoin de savoir <strong style="color:#ffffff;">à quelle heure vous commandez / prévoyez le départ du bateau depuis le Port de Nosy Be (Hell-Ville)</strong>.</p>
       <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#c59b5b;font-weight:600;">Pourriez-vous confirmer l'heure de départ au port ? C'est l'heure au port qui est la plus importante pour nous.</p>`
    : `<p style="margin:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#b9c6ca;">Cher/Chère ${hi}, nous avons hâte de vous accueillir à Komba Cabana. Pour organiser votre transfert en bateau, nous devons savoir <strong style="color:#ffffff;">à quelle heure vous partirez du Port de Nosy Be (Hell-Ville)</strong>, afin que notre bateau soit prêt à vous accueillir.</p>
       <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#c59b5b;font-weight:600;">Pourriez-vous nous indiquer votre heure de départ du port ? C'est l'heure au port dont nous avons le plus besoin.</p>`

  const title = opts.isAgency ? 'Boat departure time at the port' : 'Your boat transfer'

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
          <h1 style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:24px;font-weight:700;color:#ffffff;">${escapeHtml(title)}</h1>
        </td></tr>
        <tr><td bgcolor="#0a2029" style="background-color:#0a2029;padding:12px 20px 0 20px;">
          ${summary}
        </td></tr>
        <tr><td bgcolor="#0a2029" style="background-color:#0a2029;padding:8px 20px 0 20px;">
          ${bodyEn}
        </td></tr>
        <tr><td bgcolor="#0a2029" style="background-color:#0a2029;padding:0 20px 0 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:1px solid #1d4a5c;padding-top:16px;">
          ${bodyFr}
          </td></tr></table>
        </td></tr>
        <tr><td bgcolor="#0a2029" style="background-color:#0a2029;padding:20px 20px 0 20px;">
          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#b9c6ca;">Thank you very much. / Merci beaucoup.<br>Warm regards, / Cordialement,<br><span style="color:#c59b5b;font-weight:600;">Komba Cabana Team</span></p>
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
