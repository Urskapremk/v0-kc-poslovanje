// =====================================================================
// Registre d'employeur — generator tiskalnega HTML (ZAČASNA postavitev).
// BREZ 'use server'. Podatkovno voden: klicatelj poda stolpce + vrstice
// (že formatirane), zato je isti generator uporaben za 1ère/2ème/3ème
// Partie in posebne registre.
//
// Spec §11–§15: uradna glava na vsaki strani (thead se v tisku ponovi),
// oznaka MODÈLE PROVISOIRE, brez aplikacijske navigacije, vgrajene pisave
// (offline tisk na Madagaskarju). Dokončno postavitev uskladimo po
// fotografijah originalnih obrazcev.
// =====================================================================

import { EMBEDDED_CERT_FONTS_CSS } from './certifikat-fonts'
import { PROVISIONAL_WATERMARK, type Establishment } from './employer-register'

function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export type PrintColumn = { key: string; label: string; width?: string }

export type RegisterPrintOptions = {
  establishment: Establishment
  partLabel: string           // npr. "1ère Partie — Identité et chronologie"
  columns: PrintColumn[]
  rows: Record<string, string>[]
  provisional?: boolean       // privzeto true (dokler ni uskladitve postavitve)
  exportInfo?: { number: number; version: number; checksum: string } | null
  logoDataUrl?: string
  orientation?: 'portrait' | 'landscape'
}

export function buildRegisterPrintHtml(opts: RegisterPrintOptions): string {
  const provisional = opts.provisional !== false
  const orientation = opts.orientation || 'landscape'
  const est = opts.establishment
  const now = new Date().toLocaleString('fr-FR')

  const headCells = opts.columns
    .map((c) => `<th${c.width ? ` style="width:${esc(c.width)}"` : ''}>${esc(c.label)}</th>`)
    .join('')

  const bodyRows = opts.rows.length
    ? opts.rows
        .map(
          (row) =>
            `<tr>${opts.columns.map((c) => `<td>${esc(row[c.key] ?? '')}</td>`).join('')}</tr>`,
        )
        .join('')
    : `<tr><td colspan="${opts.columns.length}" style="text-align:center;color:#888;padding:18px">Aucune donnée</td></tr>`

  const exportLine = opts.exportInfo
    ? `<div class="exp">Export officiel N° ${opts.exportInfo.number} · Version ${opts.exportInfo.version} · Empreinte ${esc(opts.exportInfo.checksum)}</div>`
    : ''

  const logo = opts.logoDataUrl ? `<img class="logo" src="${opts.logoDataUrl}" alt="" />` : ''

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>Registre d'employeur — ${esc(opts.partLabel)}</title>
<style>
  ${EMBEDDED_CERT_FONTS_CSS}
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: 'Cormorant Garamond', Georgia, 'Times New Roman', serif;
    color: #19201a;
    background: #ece7e1;
    padding: 16px;
    font-size: 12px;
  }
  .sheet { background: #fff; padding: 12mm; max-width: ${orientation === 'landscape' ? '420mm' : '210mm'}; margin: 0 auto; }
  .top { display: flex; align-items: flex-start; gap: 14px; border-bottom: 2px solid #2e3b2f; padding-bottom: 8px; }
  .logo { width: 74px; height: auto; }
  .ident { flex: 1; }
  .ident .rs { font-size: 15px; font-weight: 600; letter-spacing: .5px; }
  .ident .row { font-size: 11px; color: #444; margin-top: 1px; }
  .ident .row span { margin-right: 14px; }
  .doc-meta { text-align: right; font-size: 11px; color: #333; min-width: 150px; }
  .doc-meta .part { font-size: 13px; font-weight: 600; color: #2e3b2f; }
  h1 { font-size: 15px; text-align: center; letter-spacing: 1px; margin: 12px 0 4px; text-transform: uppercase; }
  .sub { text-align: center; font-size: 11px; color: #555; margin-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  th, td { border: 1px solid #333; padding: 4px 6px; text-align: left; vertical-align: top; word-break: break-word; }
  thead th { background: #edf0ed; font-weight: 600; font-size: 10.5px; }
  tbody td { font-size: 10.5px; }
  .exp { margin-top: 8px; font-size: 10px; color: #2e3b2f; font-weight: 600; }
  .foot { margin-top: 10px; display: flex; justify-content: space-between; font-size: 10px; color: #666; }
  .prov {
    margin: 8px 0; padding: 4px 8px; border: 1px dashed #a0743f; color: #7d592c;
    font-size: 10.5px; letter-spacing: .5px; text-align: center; font-weight: 600;
    background: #f9f3eb;
  }
  .prov-wm {
    position: fixed; top: 42%; left: 50%; transform: translate(-50%,-50%) rotate(-24deg);
    font-size: 46px; color: rgba(143,109,58,.10); font-weight: 700; letter-spacing: 3px;
    pointer-events: none; white-space: nowrap; z-index: 0;
  }
  @page { size: A4 ${orientation}; margin: 10mm; }
  @media print {
    body { background: #fff; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .sheet { padding: 0; max-width: none; }
    thead { display: table-header-group; }  /* ponovi glavo tabele na vsaki strani */
    tr { page-break-inside: avoid; }
    .prov, thead th { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
  ${provisional ? `<div class="prov-wm">${esc(PROVISIONAL_WATERMARK)}</div>` : ''}
  <div class="sheet">
    <div class="top">
      ${logo}
      <div class="ident">
        <div class="rs">${esc(est.raisonSociale || est.name)}</div>
        <div class="row">
          <span>NIF : ${esc(est.nif || '—')}</span>
          <span>STAT : ${esc(est.stat || '—')}</span>
          <span>RCS : ${esc(est.rcs || '—')}</span>
        </div>
        <div class="row">
          <span>Établissement : ${esc(est.name)}</span>
          <span>Activité : ${esc(est.activitePrincipale || '—')}</span>
        </div>
        <div class="row">
          <span>Adresse : ${esc(est.adresseEtablissement || est.adresseSiege || '—')}</span>
        </div>
        <div class="row">
          <span>Responsable : ${esc(est.responsableLegal || '—')}</span>
          <span>Inspection : ${esc(est.inspectionOffice || '—')}</span>
        </div>
      </div>
      <div class="doc-meta">
        <div class="part">REGISTRE D'EMPLOYEUR</div>
        <div>${esc(opts.partLabel)}</div>
        <div>Registre N° : ${esc(est.registerNumber || '—')}</div>
        <div>Édité le : ${esc(now)}</div>
      </div>
    </div>

    <h1>Registre unique du personnel</h1>
    <div class="sub">${esc(opts.partLabel)}</div>

    ${provisional ? `<div class="prov">${esc(PROVISIONAL_WATERMARK)}</div>` : ''}

    <table>
      <thead><tr>${headCells}</tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>

    ${exportLine}

    <div class="foot">
      <div>${esc(est.raisonSociale || est.name)} — ${esc(opts.partLabel)}</div>
      <div>Document généré par le système · ${esc(now)}</div>
    </div>
  </div>
</body>
</html>`
}

// =====================================================================
// Obrazec label:value (A4 pokončno, črno-belo) — za Déclaration
// d'établissement in Renseignements périodiques (spec §4). Uradni naslov,
// razdelki, prostor za podpis in žig, oznaka MODÈLE PROVISOIRE (izklopljiva).
// =====================================================================

export type DocSection = { title: string; rows: { label: string; value: string }[] }

export type DocumentPrintOptions = {
  establishment: Establishment
  title: string              // uradni naslov dokumenta (FR)
  subtitle?: string
  sections: DocSection[]
  provisional?: boolean      // privzeto true; za dokončni model se izklopi
  exportInfo?: { number: number; version: number; checksum: string } | null
  logoDataUrl?: string
  notice?: string            // npr. sporočilo o dodatnih straneh
  signature?: boolean        // pokaži blok za podpis/žig (privzeto true)
  pageLabel?: string         // npr. "Page 1"
}

export function buildDocumentPrintHtml(opts: DocumentPrintOptions): string {
  const provisional = opts.provisional !== false
  const showSignature = opts.signature !== false
  const est = opts.establishment
  const now = new Date().toLocaleString('fr-FR')
  const logo = opts.logoDataUrl ? `<img class="logo" src="${opts.logoDataUrl}" alt="" />` : ''

  const sectionsHtml = opts.sections
    .map(
      (s) => `
      <div class="section">
        <div class="section-title">${esc(s.title)}</div>
        <table class="kv">
          ${s.rows
            .map((r) => `<tr><th>${esc(r.label)}</th><td>${esc(r.value) || '&nbsp;'}</td></tr>`)
            .join('')}
        </table>
      </div>`,
    )
    .join('')

  const exportLine = opts.exportInfo
    ? `<div class="exp">Export officiel N° ${opts.exportInfo.number} · Version ${opts.exportInfo.version} · Empreinte ${esc(opts.exportInfo.checksum)}</div>`
    : ''

  const noticeHtml = opts.notice ? `<div class="notice">${esc(opts.notice)}</div>` : ''

  const signatureHtml = showSignature
    ? `<div class="sign">
        <div class="sign-box">
          <div class="sign-line">Fait à : ______________________</div>
          <div class="sign-line">Le : ______________________</div>
        </div>
        <div class="sign-box">
          <div class="sign-cap">Nom, qualité et signature du déclarant</div>
          <div class="sign-space"></div>
          <div class="sign-cap">Signature et cachet</div>
        </div>
      </div>`
    : ''

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>${esc(opts.title)}</title>
<style>
  ${EMBEDDED_CERT_FONTS_CSS}
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: 'Cormorant Garamond', Georgia, 'Times New Roman', serif;
    color: #111; background: #ece7e1; padding: 16px; font-size: 12.5px;
  }
  .sheet { background: #fff; padding: 14mm; max-width: 210mm; margin: 0 auto; position: relative; }
  .top { display: flex; align-items: flex-start; gap: 14px; border-bottom: 2px solid #111; padding-bottom: 8px; }
  .logo { width: 66px; height: auto; filter: grayscale(1); }
  .ident { flex: 1; }
  .ident .rs { font-size: 14px; font-weight: 600; letter-spacing: .4px; }
  .ident .row { font-size: 10.5px; color: #333; margin-top: 1px; }
  .ident .row span { margin-right: 14px; }
  .doc-meta { text-align: right; font-size: 10.5px; color: #222; min-width: 140px; }
  .doc-meta .part { font-size: 12px; font-weight: 600; }
  h1 { font-size: 15px; text-align: center; letter-spacing: 1px; margin: 14px 0 2px; text-transform: uppercase; }
  .sub { text-align: center; font-size: 11px; color: #444; margin-bottom: 10px; }
  .section { margin-top: 12px; page-break-inside: avoid; }
  .section-title { font-size: 11.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; border-bottom: 1px solid #111; padding-bottom: 2px; margin-bottom: 4px; }
  table.kv { width: 100%; border-collapse: collapse; }
  table.kv th { width: 42%; text-align: left; font-weight: 600; vertical-align: top; padding: 3px 8px 3px 0; border-bottom: 1px dotted #bbb; font-size: 11px; }
  table.kv td { vertical-align: top; padding: 3px 0; border-bottom: 1px dotted #bbb; font-size: 11px; }
  .notice { margin-top: 12px; padding: 6px 8px; border: 1px solid #888; font-size: 10.5px; font-style: italic; color: #333; }
  .exp { margin-top: 10px; font-size: 10px; font-weight: 600; }
  .sign { margin-top: 22px; display: flex; gap: 24px; }
  .sign-box { flex: 1; }
  .sign-line { font-size: 11px; margin-bottom: 10px; }
  .sign-cap { font-size: 10px; color: #444; }
  .sign-space { height: 52px; border-bottom: 1px solid #111; margin: 4px 0; }
  .foot { margin-top: 14px; display: flex; justify-content: space-between; font-size: 9.5px; color: #666; border-top: 1px solid #ccc; padding-top: 4px; }
  .prov { margin: 10px 0; padding: 4px 8px; border: 1px dashed #555; color: #333; font-size: 10.5px; letter-spacing: .5px; text-align: center; font-weight: 600; }
  .prov-wm { position: fixed; top: 44%; left: 50%; transform: translate(-50%,-50%) rotate(-24deg); font-size: 40px; color: rgba(0,0,0,.06); font-weight: 700; letter-spacing: 3px; pointer-events: none; white-space: nowrap; z-index: 0; }
  @page { size: A4 portrait; margin: 12mm; }
  @media print {
    body { background: #fff; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .sheet { padding: 0; max-width: none; }
    .section { page-break-inside: avoid; }
  }
</style>
</head>
<body>
  ${provisional ? `<div class="prov-wm">${esc(PROVISIONAL_WATERMARK)}</div>` : ''}
  <div class="sheet">
    <div class="top">
      ${logo}
      <div class="ident">
        <div class="rs">${esc(est.raisonSociale || est.name)}</div>
        <div class="row">
          <span>NIF : ${esc(est.nif || '—')}</span>
          <span>STAT : ${esc(est.stat || '—')}</span>
          <span>RCS : ${esc(est.rcs || '—')}</span>
        </div>
        <div class="row"><span>Établissement : ${esc(est.name)}</span></div>
      </div>
      <div class="doc-meta">
        <div class="part">RÉPUBLIQUE DE MADAGASCAR</div>
        <div>${esc(opts.pageLabel || '')}</div>
        <div>Édité le : ${esc(now)}</div>
      </div>
    </div>

    <h1>${esc(opts.title)}</h1>
    ${opts.subtitle ? `<div class="sub">${esc(opts.subtitle)}</div>` : ''}

    ${provisional ? `<div class="prov">${esc(PROVISIONAL_WATERMARK)}</div>` : ''}

    ${sectionsHtml}
    ${noticeHtml}
    ${signatureHtml}
    ${exportLine}

    <div class="foot">
      <div>${esc(est.raisonSociale || est.name)} — ${esc(opts.title)}</div>
      <div>${esc(opts.pageLabel || '')} · ${esc(now)}</div>
    </div>
  </div>
</body>
</html>`
}

// Pomožno: pretvori vrednost polja v prikaz za tisk.
export function fmtCell(v: unknown): string {
  if (v == null || v === '') return ''
  if (v === true) return 'Oui'
  if (v === false) return 'Non'
  return String(v)
}
