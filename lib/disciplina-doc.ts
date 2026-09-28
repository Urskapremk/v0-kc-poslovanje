// Generator za "CONVOCATION" — poziv delavcu na zagovor (entretien préalable) pred morebitnim
// disciplinskim ukrepom / odpustom. Eleganten A4 pokoncni dokument v slogu Komba Cabana:
// logotip, okrasni okvir, vodni znak in dva podpisna bloka. Besedilo je v FRANCOSCINI.

import { EMBEDDED_CERT_FONTS_CSS } from './certifikat-fonts'

export type ConvocationMeta = {
  companyName: string             // npr. "SARL KOMBA CABANA"
  officeAddress: string           // npr. "Andrekareka"
  employeeName: string            // npr. "Rasoamiandrina Virginie"
  gender: 'f' | 'm'
  objet?: string                  // predmet dopisa
  interviewDateLabel?: string     // datum zagovora (lahko prazno -> pikice)
  interviewTimeLabel?: string     // ura zagovora (lahko prazno -> pikice)
  placeLabel: string              // "Nosy-Be"
  dateLabel: string               // "3 juillet 2026"
  signatoryName: string           // "Borut Retelj"
  signatoryCivility?: string      // "Monsieur"
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

// Fan-palm okrasek (za vodni znak).
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

export function buildConvocationHtml(meta: ConvocationMeta): string {
  const isF = meta.gender === 'f'
  const civ = isF ? 'Madame' : 'Monsieur'
  const convoque = isF ? 'convoquée' : 'convoqué'
  const assiste = isF ? 'assistée' : 'assisté'
  const lodge = meta.lodgeName || 'KOMBA CABANA LODGE'
  const objet = meta.objet || "Convocation pour l'entretien préalable au licenciement"

  const dateFill = meta.interviewDateLabel
    ? `<strong>${esc(meta.interviewDateLabel)}</strong>`
    : '<span class="fill">&hellip;&hellip;&hellip;&hellip;&hellip;&hellip;</span>'
  const timeFill = meta.interviewTimeLabel
    ? `<strong>${esc(meta.interviewTimeLabel)}</strong>`
    : '<span class="fill">&hellip;&hellip;&hellip;</span>'

  const logo = meta.logoDataUrl
    ? `<img class="logo" src="${meta.logoDataUrl}" alt="Komba Cabana" />`
    : ''

  const watermark = meta.logoDataUrl
    ? `<img class="watermark" src="${meta.logoDataUrl}" alt="" aria-hidden="true" />`
    : `<div class="watermark palm-wm">${palmSvg('palm-wm-svg')}</div>`

  const divider = `<div class="rule-diamond"><span class="ln"></span><span class="dm">&#9671;&#9670;&#9671;</span><span class="ln"></span></div>`

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Convocation — ${esc(meta.employeeName)}</title>
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
  }
  .page {
    width: 210mm;
    min-height: 297mm;
    background: var(--paper);
    padding: 11mm;
    position: relative;
  }
  .frame {
    position: relative;
    border: 1px solid var(--line);
    min-height: calc(297mm - 22mm);
    padding: 14mm 20mm 13mm;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    overflow: hidden;
  }
  .frame::before {
    content: '';
    position: absolute;
    inset: 6px;
    border: 2px solid var(--line);
    pointer-events: none;
  }
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

  .corner { position: absolute; width: 38px; height: 38px; pointer-events: none; z-index: 2; }
  .corner::before { content: ''; position: absolute; width: 38px; height: 38px; border: 2px solid var(--green); }
  .corner::after { content: ''; position: absolute; width: 24px; height: 24px; border: 1px solid var(--gold); }
  .corner .dot { position: absolute; width: 6px; height: 6px; background: var(--gold); transform: rotate(45deg); }
  .corner.tl { top: 8px; left: 8px; }
  .corner.tl::before { top: 0; left: 0; border-right: none; border-bottom: none; }
  .corner.tl::after { top: 5px; left: 5px; border-right: none; border-bottom: none; }
  .corner.tl .dot { top: -4px; left: -4px; }
  .corner.tr { top: 8px; right: 8px; }
  .corner.tr::before { top: 0; right: 0; border-left: none; border-bottom: none; }
  .corner.tr::after { top: 5px; right: 5px; border-left: none; border-bottom: none; }
  .corner.tr .dot { top: -4px; right: -4px; }
  .corner.bl { bottom: 8px; left: 8px; }
  .corner.bl::before { bottom: 0; left: 0; border-right: none; border-top: none; }
  .corner.bl::after { bottom: 5px; left: 5px; border-right: none; border-top: none; }
  .corner.bl .dot { bottom: -4px; left: -4px; }
  .corner.br { bottom: 8px; right: 8px; }
  .corner.br::before { bottom: 0; right: 0; border-left: none; border-top: none; }
  .corner.br::after { bottom: 5px; right: 5px; border-left: none; border-top: none; }
  .corner.br .dot { bottom: -4px; right: -4px; }

  .frame > *:not(.corner):not(.watermark) { position: relative; z-index: 1; width: 100%; }

  .logo { width: 150px; height: auto; margin-bottom: 2px; }
  .lodge { font-size: 15px; letter-spacing: 5px; font-weight: 600; margin-top: 8px; color: var(--ink); }
  .location { font-size: 11px; letter-spacing: 4px; color: var(--muted); margin-top: 4px; }

  .rule-diamond { display: flex; align-items: center; justify-content: center; gap: 12px; margin: 12px auto; width: 240px; }
  .rule-diamond .ln { flex: 1; height: 1px; background: linear-gradient(90deg, transparent, var(--line) 45%, var(--line) 55%, transparent); opacity: .7; }
  .rule-diamond .dm { color: var(--gold); font-size: 10px; letter-spacing: 3px; }

  .meta { text-align: right; font-size: 15px; color: var(--ink); margin-top: 2px; }

  .addr { text-align: center; margin-top: 14px; }
  .addr .comp { font-size: 16px; font-weight: 600; letter-spacing: 1px; }
  .addr .a { font-size: 15px; color: var(--muted); margin: 4px 0; }
  .addr .to { font-size: 16px; }

  .objet { text-align: left; font-size: 15.5px; margin: 22px 0 8px; }
  .objet strong { font-weight: 600; }

  .salut { text-align: left; font-size: 16px; margin: 18px 0 6px; }

  .body { text-align: left; max-width: 100%; }
  .para { font-size: 16px; line-height: 1.85; color: var(--ink); margin: 12px 0; text-indent: 22mm; }
  .para strong { font-weight: 600; }
  .fill { letter-spacing: 1px; color: var(--muted); }

  .closing { text-align: left; font-size: 16px; line-height: 1.85; margin: 16px 0; text-indent: 22mm; }

  .grow { flex: 1 1 auto; min-height: 8px; }

  .signs { display: flex; justify-content: space-between; align-items: flex-end; gap: 20px; margin-top: 10px; }
  .sig { flex: 1; text-align: center; }
  .sig .line { border-top: 1px solid var(--line); margin: 34px 12px 6px; }
  .sig .who { font-size: 14.5px; font-weight: 600; color: var(--ink); }
  .sig .role { font-size: 12.5px; color: var(--muted); font-style: italic; margin-top: 1px; }

  @page { size: A4 portrait; margin: 0; }
  @media print {
    body { background: #fff; padding: 0; }
    .page { width: 100%; min-height: 100vh; padding: 9mm; }
  }
</style>
</head>
<body>
  <div class="page">
    <div class="frame">
      <span class="corner tl"><span class="dot"></span></span><span class="corner tr"><span class="dot"></span></span>
      <span class="corner bl"><span class="dot"></span></span><span class="corner br"><span class="dot"></span></span>
      ${watermark}

      ${logo}
      <div class="lodge">${esc(lodge)}</div>
      ${meta.locationLine ? `<div class="location">${esc(meta.locationLine)}</div>` : ''}

      ${divider}

      <div class="meta">${esc(meta.placeLabel)}, le ${esc(meta.dateLabel)}</div>

      <div class="addr">
        <div class="comp">${esc(meta.companyName)}</div>
        <div class="a">À</div>
        <div class="to">${esc(civ)} ${esc(meta.employeeName)}</div>
      </div>

      <div class="objet"><strong>Objet&nbsp;:</strong> ${esc(objet)}</div>

      <div class="salut">${esc(civ)},</div>

      <div class="body">
        <p class="para">Nous envisageons à votre encontre une éventuelle mesure de licenciement.
          Nous vous demandons de bien vouloir vous présenter à un entretien préalable.</p>

        <p class="para">Par conséquent, vous êtes ${convoque} au bureau de la société
          <strong>${esc(meta.companyName)}</strong> sise ${esc(meta.officeAddress)}&nbsp;; le ${dateFill}
          à ${timeFill}, où vous allez donner votre défense par rapport aux faits.</p>

        <p class="para">Vous avez la faculté d'être ${assiste} par une personne de votre choix.
          Il est bien de préciser que la présente procédure pourrait aboutir à votre licenciement,
          en cas de défense insuffisante.</p>

        <p class="closing">Veuillez agréer, ${esc(civ)}, l'expression de nos sentiments respectueux.</p>
      </div>

      <div class="grow"></div>

      <div class="signs">
        <div class="sig">
          <div class="line"></div>
          <div class="who">${esc(civ)} ${esc(meta.employeeName)}</div>
          <div class="role">La personne convoquée</div>
        </div>
        <div class="sig">
          <div class="line"></div>
          <div class="who">${esc(meta.signatoryCivility || 'Monsieur')} ${esc(meta.signatoryName)}</div>
          <div class="role">Le Gérant</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`
}

// ─────────────────────────────────────────────────────────────────────────────
// AVERTISSEMENT (opozorilo) — premier / deuxième / troisième. Enak vizualni slog
// kot convocation (logotip, okvir, vodni znak, dva podpisna bloka). Besedilo v FR.
// ─────────────────────────────────────────────────────────────────────────────

export type AvertissementLevel = 'premier' | 'deuxieme' | 'troisieme'

export type AvertissementMeta = {
  companyName: string             // npr. "KOMBA CABANA TOURISM SARL"
  employeeName: string            // npr. "SOAMANANO Charlesia"
  gender: 'f' | 'm'
  level: AvertissementLevel       // stopnja opozorila
  introText?: string              // uvodni odstavek (opis vedenja) — urejljiv
  faits: string[]                 // seznam očitanih dejstev (prekrški)
  placeLabel: string              // "Nosy-Be"
  dateLabel: string               // "7 mai 2026"
  signatoryName: string           // "Borut RETELJ"
  signatoryRole?: string          // "Gérant"
  lodgeName?: string
  locationLine?: string
  logoDataUrl?: string
}

export function buildAvertissementHtml(meta: AvertissementMeta): string {
  const isF = meta.gender === 'f'
  const civ = isF ? 'Madame' : 'Monsieur'
  const lodge = meta.lodgeName || 'KOMBA CABANA LODGE'

  const levelLabel =
    meta.level === 'premier'
      ? 'Premier avertissement'
      : meta.level === 'deuxieme'
        ? 'Deuxième avertissement'
        : 'Troisième et dernier avertissement'

  const levelSentence =
    meta.level === 'premier'
      ? "un <strong>premier avertissement</strong>"
      : meta.level === 'deuxieme'
        ? "un <strong>deuxième avertissement</strong>"
        : "un <strong>troisième et dernier avertissement</strong>"

  const defaultIntro =
    "Nous avons constaté un comportement inacceptable de votre part au sein de notre entreprise, " +
    "notamment un manque de respect envers votre supérieur hiérarchique ainsi que des attitudes " +
    "répétées de contestation pendant les heures de travail."
  const intro = (meta.introText && meta.introText.trim()) || defaultIntro

  const faits = (meta.faits || []).map((f) => String(f).trim()).filter(Boolean)
  const faitsList = faits.length
    ? `<ul class="faits">${faits.map((f) => `<li>${esc(f)}&nbsp;;</li>`).join('')}</ul>`
    : ''

  const logo = meta.logoDataUrl
    ? `<img class="logo" src="${meta.logoDataUrl}" alt="Komba Cabana" />`
    : ''

  const watermark = meta.logoDataUrl
    ? `<img class="watermark" src="${meta.logoDataUrl}" alt="" aria-hidden="true" />`
    : `<div class="watermark palm-wm">${palmSvg('palm-wm-svg')}</div>`

  const divider = `<div class="rule-diamond"><span class="ln"></span><span class="dm">&#9671;&#9670;&#9671;</span><span class="ln"></span></div>`

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Avertissement — ${esc(meta.employeeName)}</title>
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
  }
  .page {
    width: 210mm;
    min-height: 297mm;
    background: var(--paper);
    padding: 11mm;
    position: relative;
  }
  .frame {
    position: relative;
    border: 1px solid var(--line);
    min-height: calc(297mm - 22mm);
    padding: 14mm 20mm 13mm;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    overflow: hidden;
  }
  .frame::before {
    content: '';
    position: absolute;
    inset: 6px;
    border: 2px solid var(--line);
    pointer-events: none;
  }
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

  .corner { position: absolute; width: 38px; height: 38px; pointer-events: none; z-index: 2; }
  .corner::before { content: ''; position: absolute; width: 38px; height: 38px; border: 2px solid var(--green); }
  .corner::after { content: ''; position: absolute; width: 24px; height: 24px; border: 1px solid var(--gold); }
  .corner .dot { position: absolute; width: 6px; height: 6px; background: var(--gold); transform: rotate(45deg); }
  .corner.tl { top: 8px; left: 8px; }
  .corner.tl::before { top: 0; left: 0; border-right: none; border-bottom: none; }
  .corner.tl::after { top: 5px; left: 5px; border-right: none; border-bottom: none; }
  .corner.tl .dot { top: -4px; left: -4px; }
  .corner.tr { top: 8px; right: 8px; }
  .corner.tr::before { top: 0; right: 0; border-left: none; border-bottom: none; }
  .corner.tr::after { top: 5px; right: 5px; border-left: none; border-bottom: none; }
  .corner.tr .dot { top: -4px; right: -4px; }
  .corner.bl { bottom: 8px; left: 8px; }
  .corner.bl::before { bottom: 0; left: 0; border-right: none; border-top: none; }
  .corner.bl::after { bottom: 5px; left: 5px; border-right: none; border-top: none; }
  .corner.bl .dot { bottom: -4px; left: -4px; }
  .corner.br { bottom: 8px; right: 8px; }
  .corner.br::before { bottom: 0; right: 0; border-left: none; border-top: none; }
  .corner.br::after { bottom: 5px; right: 5px; border-left: none; border-top: none; }
  .corner.br .dot { bottom: -4px; right: -4px; }

  .frame > *:not(.corner):not(.watermark):not(.logo) { position: relative; z-index: 1; width: 100%; }

  .logo { position: relative; z-index: 1; display: block; width: 96px; height: auto; margin: 0 auto 2px; }
  .lodge { font-size: 13px; letter-spacing: 4px; font-weight: 600; margin-top: 6px; color: var(--ink); }
  .location { font-size: 10px; letter-spacing: 3px; color: var(--muted); margin-top: 3px; }

  .rule-diamond { display: flex; align-items: center; justify-content: center; gap: 12px; margin: 9px auto; width: 220px; }
  .rule-diamond .ln { flex: 1; height: 1px; background: linear-gradient(90deg, transparent, var(--line) 45%, var(--line) 55%, transparent); opacity: .7; }
  .rule-diamond .dm { color: var(--gold); font-size: 10px; letter-spacing: 3px; }

  .meta { text-align: right; font-size: 15px; color: var(--ink); margin-top: 2px; }

  .addr { text-align: left; margin-top: 14px; }
  .addr .comp { font-size: 16px; font-weight: 600; letter-spacing: 1px; }
  .addr .att { font-size: 15px; color: var(--muted); margin-top: 10px; }
  .addr .to { font-size: 16px; font-weight: 600; }

  .objet { text-align: left; font-size: 15.5px; margin: 22px 0 8px; }
  .objet strong { font-weight: 600; }

  .salut { text-align: left; font-size: 16px; margin: 16px 0 6px; }

  .body { text-align: left; max-width: 100%; }
  .para { font-size: 15.5px; line-height: 1.7; color: var(--ink); margin: 11px 0; }
  .para strong { font-weight: 600; }
  .faits { text-align: left; margin: 8px 0 12px; padding-left: 26px; }
  .faits li { font-size: 15.5px; line-height: 1.6; margin: 3px 0; }

  .grow { flex: 1 1 auto; min-height: 8px; }

  .signs { display: flex; justify-content: space-between; align-items: flex-end; gap: 20px; margin-top: 14px; }
  .sig { flex: 1; text-align: center; }
  .sig .cap { font-size: 13.5px; color: var(--muted); font-style: italic; }
  .sig .line { border-top: 1px solid var(--line); margin: 30px 12px 6px; }
  .sig .who { font-size: 14.5px; font-weight: 600; color: var(--ink); }
  .sig .role { font-size: 12.5px; color: var(--muted); font-style: italic; margin-top: 1px; }

  /* Natisni okvir/vodni znak TOČNO kot v predogledu; vodni znak dovolj močan za papir */
  html, body, .page, .frame, .watermark, .palm-wm-svg, .corner, .rule-diamond .ln {
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  @page { size: A4 portrait; margin: 0; }
  @media print {
    body { background: #fff; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page { width: 100%; min-height: 100vh; padding: 9mm; }
    .frame, .corner, .rule-diamond .ln { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    /* Brez vodnega znaka (slepega tiska) na papirju */
    .watermark { display: none !important; }
  }
</style>
</head>
<body>
  <div class="page">
    <div class="frame">
      <span class="corner tl"><span class="dot"></span></span><span class="corner tr"><span class="dot"></span></span>
      <span class="corner bl"><span class="dot"></span></span><span class="corner br"><span class="dot"></span></span>
      ${watermark}

      ${logo}
      <div class="lodge">${esc(lodge)}</div>
      ${meta.locationLine ? `<div class="location">${esc(meta.locationLine)}</div>` : ''}

      ${divider}

      <div class="meta">${esc(meta.placeLabel)}, le ${esc(meta.dateLabel)}</div>

      <div class="addr">
        <div class="comp">${esc(meta.companyName)}</div>
        <div class="att">À l'attention de&nbsp;:</div>
        <div class="to">${esc(civ)} ${esc(meta.employeeName)}</div>
      </div>

      <div class="objet"><strong>Objet&nbsp;:</strong> ${esc(levelLabel)}</div>

      <div class="salut">${esc(civ)},</div>

      <div class="body">
        <p class="para">${intro}</p>

        ${faitsList ? `<p class="para">Les faits qui vous sont reprochés sont notamment les suivants&nbsp;:</p>${faitsList}` : ''}

        <p class="para">Par la présente, nous vous adressons ${levelSentence} et vous demandons de corriger
          immédiatement votre comportement afin d'éviter toute récidive.</p>

        <p class="para">Nous vous rappelons que chaque salarié est tenu de respecter les instructions de sa
          hiérarchie, de maintenir une attitude professionnelle et de contribuer au bon fonctionnement de
          l'entreprise.</p>

        <p class="para">À défaut d'une amélioration immédiate de votre comportement, nous serons contraints
          d'engager des mesures disciplinaires plus sévères, conformément aux dispositions du Code du travail
          malgache et au règlement intérieur de l'entreprise.</p>

        <p class="para">Veuillez agréer, ${esc(civ)}, l'expression de nos salutations distinguées.</p>
      </div>

      <div class="grow"></div>

      <div class="signs">
        <div class="sig">
          <div class="cap">Signature du salarié</div>
          <div class="line"></div>
          <div class="who">${esc(civ)} ${esc(meta.employeeName)}</div>
        </div>
        <div class="sig">
          <div class="cap">Signature de l'employeur</div>
          <div class="line"></div>
          <div class="who">${esc(meta.signatoryName)}</div>
          <div class="role">${esc(meta.signatoryRole || 'Gérant')}</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`
}
