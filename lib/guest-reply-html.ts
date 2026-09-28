// Branded HTML shell for the guest reply (same dark theme + gold logo as the
// excursion offer email). Shared (NO 'use server') so both the email builder and
// the public page can call it — a 'use server' module may export only async fns.

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// Turn plain http(s) URLs (and bare www./domain links) into clickable, clearly-styled
// anchors. Runs on ALREADY-ESCAPED text, so `&` in query strings is `&amp;` (harmless).
function linkify(escaped: string): string {
  // Matches http(s)://…, www.…, or a bare domain like nosykombaplongee.com/english/index.html
  const re = /((?:https?:\/\/|www\.)[^\s<]+|[a-z0-9.-]+\.(?:com|org|net|mg|fr)\b(?:\/[^\s<]*)?)/gi
  return escaped.replace(re, (raw) => {
    // trailing punctuation (., ,, )) should stay outside the link
    const m = raw.match(/[).,!?]+$/)
    const trail = m ? m[0] : ''
    const url = trail ? raw.slice(0, -trail.length) : raw
    const href = /^https?:\/\//i.test(url) ? url : `https://${url}`
    return `<a href="${href}" target="_blank" rel="noopener noreferrer" style="color:#8f6d3a;font-weight:600;text-decoration:underline;">${url}</a>${trail}`
  })
}

export type ReplyExcursionImage = { name: string; url: string }

export function buildReplyHtml(
  guestName: string,
  replyText: string,
  baseUrl: string,
  images: ReplyExcursionImage[] = [],
): string {
  const base = baseUrl.replace(/\/$/, '')
  // Barvni (temni) logotip — zlati bi na bež podlagi zbledel.
  const logo = `${base}/images/komba-logo-color.png`
  const abs = (u: string) => (/^https?:\/\//i.test(u) ? u : `${base}${u.startsWith('/') ? '' : '/'}${u}`)
  const body = escapeHtml(replyText)
    .split(/\n{2,}/)
    .map(p => {
      // Cenovne vrstice (izlet/transfer) so LEVO poravnane, naziv pred „:" je odebeljen;
      // ostalo besedilo ostane sredinsko.
      const isPriceLine = /:\s*[\d.]+\s*EUR total for/i.test(p) && (/excursion:/i.test(p) || /^Transfer /i.test(p))
      let inner = linkify(p).replace(/\n/g, '<br>')
      if (isPriceLine) {
        const idx = inner.indexOf(':')
        if (idx > -1) inner = `<strong>${inner.slice(0, idx)}</strong>${inner.slice(idx)}`
      }
      const align = isPriceLine ? 'left' : 'center'
      return `<p style="margin:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.7;color:#2b2622;text-align:${align};">${inner}</p>`
    })
    .join('')

  // Excursion photo(s) the reply talks about, shown under the text.
  const gallery = images.length
    ? images
        .map(
          img => `<div style="margin-top:14px;">
            <img src="${abs(img.url)}" alt="${escapeHtml(img.name)}" width="512" style="display:block;width:100%;max-width:512px;height:auto;border:0;border-radius:12px;">
            <p style="margin:6px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#6b655d;">${escapeHtml(img.name)}</p>
          </div>`,
        )
        .join('')
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#efe8da;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#efe8da" style="background-color:#efe8da;">
    <tr><td align="center" bgcolor="#efe8da" style="background-color:#efe8da;padding:32px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" bgcolor="#efe8da" style="width:600px;max-width:600px;background-color:#efe8da;">
        <tr><td align="center" style="padding:8px 0 24px 0;">
          <img src="${logo}" alt="Komba Cabana" width="180" style="display:block;border:0;outline:none;max-width:180px;height:auto;">
        </td></tr>
        <tr><td bgcolor="#efe8da" style="background-color:#efe8da;border:1px solid #d8cfbb;border-left:3px solid #8f6d3a;border-radius:16px;padding:24px 22px;">
          ${body}
          ${gallery}
        </td></tr>
        <tr><td align="center" style="padding:20px 8px 0 8px;">
          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#837d75;">Komba Cabana Lodge · Nosy Komba, Madagascar</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
