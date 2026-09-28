// Generator za "CERTIFICAT DE TRAVAIL" (potrdilo o zaposlitvi ob prekinitvi delovnega razmerja).
// Eleganten A4 pokoncni dokument v slogu Komba Cabana: logotip, okrasni okvir, vodni znak,
// palmov okrasek in podpis. Besedilo je v FRANCOSCINI.

import { EMBEDDED_CERT_FONTS_CSS } from './certifikat-fonts'

export type CertificatTravailMeta = {
  companyLines: string[]          // npr. ["SARL KOMBA CABANA", "ANDREKAREKA", "NOSY BE"]
  companyName: string             // krepko v besedilu, npr. "SARL KOMBA CABANA"
  representative: string          // npr. "RETELJ Borut"
  representativeCivility?: string // npr. "Monsieur"
  employeeName: string            // npr. "SOAMANANO Charlesia"
  gender: 'f' | 'm'
  qualite: string                 // vloga, npr. "femme de chambre"
  startLabel: string              // "01 Août 2024"
  endLabel: string                // "04 Juin 2026"
  classification?: string         // npr. "M1"
  indice?: string                 // npr. "1733"
  placeLabel: string              // "Nosy-Be"
  dateLabel: string               // "04 Juin 2026"
  signatoryRole?: string          // "Le Gérant"
  signatoryName?: string          // "RETELJ Borut"
  lodgeName?: string              // "KOMBA CABANA LODGE"
  locationLine?: string           // "NOSY KOMBA · MADAGASCAR"
  logoDataUrl?: string
}

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// Ime v elegantno velika-začetnica obliko (npr. "RABENANDRASANA Francel" -> "Rabenandrasana Francel"),
// da se v kaligrafski pisavi (Great Vibes) berljivo izriše (velike črke so preveč okrašene).
function titleCaseName(s: unknown): string {
  return String(s ?? '')
    .toLocaleLowerCase()
    .replace(/(^|[\s'’-])(\p{L})/gu, (_, sep, ch) => sep + ch.toLocaleUpperCase())
}

// Fan-palm okrasek (za podpis in vodni znak).
function palmSvg(cls: string): string {
  return `
    <svg class="${cls}" viewBox="0 0 80 46" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round">
      <path d="M40 45 C40 30 40 20 40 12"/>
      ${Array.from({ length: 13 })
        .map((_, i) => {
          const a = (-90 + (i - 6) * 13) * (Math.PI / 180)
          const len = 30 - Math.abs(i - 6) * 1.4
          const x = 40 + Math.cos(a) * len
          const y = 12 + Math.sin(a) * len
          return `<path d="M40 12 Q ${(40 + x) / 2 + (i - 6)} ${(12 + y) / 2 - 4} ${x.toFixed(1)} ${y.toFixed(1)}"/>`
        })
        .join('')}
    </svg>`
}

// Pot prirezanega (chamfer) pravokotnika z rahlo zaobljenimi spoji - elegantni koti okvirja.
function roundedChamferPath(x0: number, y0: number, x1: number, y1: number, ch: number, r: number): string {
  const pts: [number, number][] = [
    [x0 + ch, y0], [x1 - ch, y0],
    [x1, y0 + ch], [x1, y1 - ch],
    [x1 - ch, y1], [x0 + ch, y1],
    [x0, y1 - ch], [x0, y0 + ch],
  ]
  const n = pts.length
  const sub = (a: [number, number], b: [number, number]): [number, number] => [a[0] - b[0], a[1] - b[1]]
  const len = (v: [number, number]) => Math.hypot(v[0], v[1])
  const norm = (v: [number, number]): [number, number] => { const l = len(v) || 1; return [v[0] / l, v[1] / l] }
  const f = (x: number) => x.toFixed(2)
  let d = ''
  for (let i = 0; i < n; i++) {
    const cur = pts[i]
    const prev = pts[(i - 1 + n) % n]
    const next = pts[(i + 1) % n]
    const rIn = Math.min(r, len(sub(prev, cur)) / 2)
    const rOut = Math.min(r, len(sub(next, cur)) / 2)
    const vIn = norm(sub(prev, cur))
    const vOut = norm(sub(next, cur))
    const p1: [number, number] = [cur[0] + vIn[0] * rIn, cur[1] + vIn[1] * rIn]
    const p2: [number, number] = [cur[0] + vOut[0] * rOut, cur[1] + vOut[1] * rOut]
    d += (i === 0 ? `M ${f(p1[0])} ${f(p1[1])} ` : `L ${f(p1[0])} ${f(p1[1])} `)
    d += `Q ${f(cur[0])} ${f(cur[1])} ${f(p2[0])} ${f(p2[1])} `
  }
  return d + 'Z'
}

// Dvojni okrasni okvir s prirezanimi koti + kotni okrasni zavihki (volute) - kot na referenci.
function chamferFrameSvg(): string {
  const outer = roundedChamferPath(7, 7, 203, 290, 13, 1.6)
  const inner = roundedChamferPath(11, 11, 199, 286, 10.5, 1.4)
  const ornament = `
    <path d="M 33 11 C 26 11 21 12.4 19.2 15.8 C 18.1 17.9 19.2 20.2 21.6 20.2 C 20 20.2 18.9 19 18.9 17.4"/>
    <path d="M 11 33 C 11 26 12.4 21 15.8 19.2 C 17.9 18.1 20.2 19.2 20.2 21.6 C 20.2 20 19 18.9 17.4 18.9"/>
    <path d="M 15 15 l1.5 -1.5 1.5 1.5 -1.5 1.5 z" fill="var(--gold)" stroke="none"/>`
  return `
    <svg class="frame-border" viewBox="0 0 210 297" preserveAspectRatio="none" fill="none" stroke="var(--line)">
      <path d="${outer}" stroke-width="0.22"/>
      <path d="${inner}" stroke-width="0.35"/>
      <g stroke-width="0.5" stroke-linecap="round">
        <g>${ornament}</g>
        <g transform="translate(210,0) scale(-1,1)">${ornament}</g>
        <g transform="translate(0,297) scale(1,-1)">${ornament}</g>
        <g transform="translate(210,297) scale(-1,-1)">${ornament}</g>
      </g>
    </svg>`
}

// Elegantna vejica (sprig) - drobni dekorativni element ob imenu.
function sprigSvg(dir: 'l' | 'r'): string {
  const flip = dir === 'r' ? ' style="transform:scaleX(-1)"' : ''
  return `
    <svg class="sprig ${dir}"${flip} viewBox="0 0 60 20" fill="none" stroke="var(--green)" stroke-width="1" stroke-linecap="round">
      <path d="M58 10 C40 10 22 10 4 10"/>
      ${Array.from({ length: 5 })
        .map((_, i) => {
          const x = 12 + i * 10
          return `<path d="M${x} 10 C${x - 5} 4 ${x - 9} 3 ${x - 11} 5"/><path d="M${x} 10 C${x - 5} 16 ${x - 9} 17 ${x - 11} 15"/>`
        })
        .join('')}
      <circle cx="4" cy="10" r="1.6" fill="var(--green)" stroke="none"/>
    </svg>`
}

export function buildCertificatTravailHtml(meta: CertificatTravailMeta): string {
  const isF = meta.gender === 'f'
  const nomme = isF ? 'la nommée' : 'le nommé'
  const employe = isF ? 'employée' : 'employé'
  const civ = meta.representativeCivility || 'Monsieur'
  const lodge = meta.lodgeName || 'KOMBA CABANA LODGE'

  const logo = meta.logoDataUrl
    ? `<img class="logo" src="${meta.logoDataUrl}" alt="Komba Cabana" />`
    : ''

  const watermark = meta.logoDataUrl
    ? `<img class="watermark" src="${meta.logoDataUrl}" alt="" aria-hidden="true" />`
    : `<div class="watermark palm-wm">${palmSvg('palm-wm-svg')}</div>`

  const classLine =
    meta.classification || meta.indice
      ? `<p class="classif">Dernière classification&nbsp;: <strong>${esc(meta.classification || '—')}</strong>&nbsp;&nbsp;&nbsp;&nbsp;indice&nbsp;: <strong>${esc(meta.indice || '—')}</strong></p>`
      : ''

  const divider = `<div class="rule-diamond"><span class="ln"></span><span class="dm">&#9671;&#9670;&#9671;</span><span class="ln"></span></div>`

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Certificat de travail — ${esc(meta.employeeName)}</title>
<style>
  ${EMBEDDED_CERT_FONTS_CSS}
  :root {
    --ink: #202821;
    --muted: #706b62;
    --line: #2e3b2f;
    --green: #4c684e;
    --gold: #a27c4d;
    --paper: #ffffff;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    background: #ece7e1;
    color: var(--ink);
    font-family: 'Cormorant Garamond', Georgia, 'Times New Roman', serif;
    padding: 24px;
    display: flex;
    justify-content: center;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
    font-feature-settings: "liga" 1, "clig" 1, "kern" 1;
  }
  .page {
    width: 210mm;
    min-height: 297mm;
    background: var(--paper);
    padding: 11mm;
    position: relative;
  }
  /* Dvojni okrasni okvir s prirezanimi koti (SVG) prek cele strani */
  .frame-border {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 2;
  }
  .frame {
    position: relative;
    min-height: calc(297mm - 22mm);
    padding: 16mm 22mm 15mm;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    overflow: hidden;
  }
  /* Vodni znak */
  .watermark {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 118mm;
    opacity: 0.045;
    filter: grayscale(1);
    pointer-events: none;
    z-index: 0;
  }
  .palm-wm-svg { width: 118mm; height: auto; color: var(--green); }

  .frame > *:not(.watermark) { position: relative; z-index: 1; }

  .logo { width: 168px; height: auto; margin-bottom: 2px; }
  .lodge { font-size: 16px; letter-spacing: 5px; font-weight: 600; margin-top: 10px; color: var(--ink); }
  .location { font-size: 11.5px; letter-spacing: 4px; color: var(--muted); margin-top: 5px; }

  .rule-diamond { display: flex; align-items: center; justify-content: center; gap: 12px; margin: 14px 0; width: 240px; }
  .rule-diamond .ln { flex: 1; height: 1px; background: linear-gradient(90deg, transparent, var(--line) 45%, var(--line) 55%, transparent); opacity: .7; }
  .rule-diamond .dm { color: var(--gold); font-size: 10px; letter-spacing: 3px; }

  .title-row { display: flex; align-items: center; justify-content: center; gap: 18px; margin: 2px 0; width: 100%; }
  .title-row .flourish { flex: 0 0 80px; height: 1px; background: linear-gradient(90deg, transparent, var(--line)); position: relative; opacity: .8; }
  .title-row .flourish.r { background: linear-gradient(90deg, var(--line), transparent); }
  .title-row .flourish::before { content: ''; position: absolute; top: -3px; width: 7px; height: 7px; border-top: 1px solid var(--line); border-right: 1px solid var(--line); transform: rotate(45deg); }
  .title-row .flourish.l::before { right: 0; }
  .title-row .flourish.r::before { left: 0; transform: rotate(225deg); }
  .cert-title { font-size: 24px; letter-spacing: 5px; font-weight: 600; text-transform: uppercase; white-space: nowrap; }

  .name-wrap { display: flex; align-items: center; justify-content: center; gap: 16px; margin: 10px 0 2px; }
  .name { font-family: 'Great Vibes', cursive; font-size: 48px; color: var(--ink); line-height: 1.15; padding: 0 6px; }
  .sprig { width: 60px; height: 20px; opacity: .85; }
  .qualite { font-size: 16px; color: var(--muted); font-style: italic; margin-top: 2px; }

  .body { max-width: 158mm; }
  .para { font-size: 16.5px; line-height: 1.75; color: var(--ink); margin: 14px 0; text-wrap: pretty; hyphens: none; }
  .para strong { font-weight: 600; }
  .classif { font-size: 16px; color: var(--ink); margin: 8px 0; }
  .classif strong { font-weight: 600; }

  .sign .done { font-size: 14.5px; color: var(--muted); margin-bottom: 4px; font-variant-numeric: oldstyle-nums; }
  .palm { width: 84px; height: 46px; display: block; margin: 2px auto 4px; color: var(--ink); }
  .sign .who { font-size: 15px; font-weight: 700; color: var(--ink); }
  .sign .role { font-size: 13.5px; color: var(--ink); margin-top: 1px; font-style: italic; letter-spacing: .5px; }
  .sign .comp { font-size: 12.5px; color: var(--muted); margin-top: 2px; letter-spacing: .5px; }

  .grow { flex: 1 1 auto; min-height: 6px; }
  .head-gap { height: 22mm; }

  /* Natisni barvna ozadja/gradiente/okraske TOČNO kot v predogledu */
  html, body, .page, .frame, .frame-border, .divider { -webkit-print-color-adjust: exact; print-color-adjust: exact; }

  @page { size: A4 portrait; margin: 0; }
  @media print {
    body { background: #fff; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page { width: 100%; min-height: 100vh; padding: 9mm; }
    .frame, .frame-border, .divider { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    /* Vodni znak samo na zaslonu/PDF-predogledu, NE na papirju */
    .watermark { display: none !important; }
  }
</style>
</head>
<body>
  <div class="page">
    ${chamferFrameSvg()}
    <div class="frame">
      ${watermark}

      ${logo}
      <div class="lodge">${esc(lodge)}</div>
      ${meta.locationLine ? `<div class="location">${esc(meta.locationLine)}</div>` : ''}

      <div class="head-gap"></div>

      ${divider}

      <div class="title-row">
        <span class="flourish l"></span>
        <span class="cert-title">Certificat de Travail</span>
        <span class="flourish r"></span>
      </div>

      <div class="name-wrap">
        ${sprigSvg('l')}
        <span class="name">${esc(titleCaseName(meta.employeeName))}</span>
        ${sprigSvg('r')}
      </div>
      <div class="qualite">${esc(meta.qualite)}</div>

      ${divider}

      <div class="grow"></div>

      <div class="body">
        <p class="para">Nous soussignée, <strong>${esc(meta.companyName)}</strong>,
          représentée par ${esc(civ)} <strong>${esc(meta.representative)}</strong>,
          certifions par la présente que ${nomme} <strong>${esc(meta.employeeName)}</strong>
          a été ${employe} à notre service en qualité de <strong>${esc(meta.qualite)}</strong>
          pendant la période allant du <strong>${esc(meta.startLabel)}</strong>
          au <strong>${esc(meta.endLabel)}</strong>.</p>

        ${classLine}

        <p class="para">En foi de quoi, je lui délivre le présent certificat
          pour servir et valoir ce que de droit.</p>
      </div>

      <div class="grow"></div>

      ${divider}

      <div class="sign">
        <div class="done">Fait à ${esc(meta.placeLabel)}, le ${esc(meta.dateLabel)}</div>
        <div class="who">${esc(meta.signatoryName || meta.representative)}</div>
        <div class="role">${esc(meta.signatoryRole || 'Le Gérant')}</div>
        <div class="comp">${esc(meta.companyName)}</div>
      </div>
    </div>
  </div>
</body>
</html>`
}
