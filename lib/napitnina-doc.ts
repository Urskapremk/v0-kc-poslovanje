// Dokument za razdelitev napitnine (pourboires) med zaposlene - FRANCOSCINA.
// Eleganten zlato-olivni slog, usklajen z bulletin-paie.ts.

export type NapitninaRow = {
  name: string          // ime in priimek zaposlenega
  fonction?: string     // delovno mesto (neobvezno)
  amountAr?: number     // znesek napitnine v Ar (lahko prazen -> rocno vpise)
}

export type NapitninaMeta = {
  company: string
  companyAddress?: string
  monthLabelFr: string  // npr. "Juin 2026"
  upToDateFr?: string   // "napitnina do datuma" - npr. "31 juillet 2026"
  rows: NapitninaRow[]
  presentNames: string[]        // prisotni pri stetju napitnine
  totalAr?: number              // skupni znesek (ce podan; sicer se sesteje iz vrstic)
  logoDataUrl?: string
}

const esc = (s: unknown) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function ar(v?: number): string {
  if (v == null || !isFinite(v) || v === 0) return ''
  return Math.round(v).toLocaleString('fr-FR').replace(/\u202f/g, ' ') + ' Ar'
}

export function buildNapitninaHtml(meta: NapitninaMeta): string {
  const stroke = 'fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"'
  const ICON_COIN = `<svg viewBox="0 0 24 24" ${stroke}><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 0 1 5 0c0 1.5-1.5 2-2.5 2.5s-2.5 1-2.5 2.5a2.5 2.5 0 0 0 5 0"/><path d="M12 6.5v11"/></svg>`
  const ICON_USERS = `<svg viewBox="0 0 24 24" ${stroke}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>`
  const ORNAMENT = `<svg viewBox="0 0 40 12" ${stroke}><path d="M2 6c6-5 10 5 16 0S32 1 38 6"/></svg>`

  const total =
    meta.totalAr != null
      ? meta.totalAr
      : meta.rows.reduce((a, r) => a + (Number(r.amountAr) || 0), 0)

  const rowsHtml = meta.rows
    .map(
      (r, i) => `
      <tr>
        <td class="idx">${i + 1}</td>
        <td class="nm">${esc(r.name)}${r.fonction ? `<span class="fn">${esc(r.fonction)}</span>` : ''}</td>
        <td class="num">${ar(r.amountAr)}</td>
        <td class="sig"></td>
      </tr>`,
    )
    .join('')

  const presentHtml = meta.presentNames.length
    ? meta.presentNames
        .map(
          (nm) => `
        <div class="present-row">
          <span class="present-name">${esc(nm)}</span>
          <span class="present-sig"></span>
        </div>`,
        )
        .join('')
    : `<div class="present-empty">—</div>`

  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"/>
<title>Répartition des pourboires — ${esc(meta.monthLabelFr)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  :root {
    --ink: #332a20; --muted: #a78e6f; --olive: #836d51;
    --gold: #c59b5b; --gold-soft: #d6c3ab;
    --line-card: #ece6df; --line-table: #ede8e1; --beige: #f4efe9;
    --serif: 'Cormorant Garamond', Georgia, serif;
    --sans: 'Inter', 'Helvetica Neue', Arial, sans-serif;
  }
  * { box-sizing: border-box; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: var(--sans); color: var(--ink); background: #f5f2ee; margin: 0; padding: 32px; font-size: 11px; }
  .sheet { max-width: 720px; margin: 0 auto; background: #fff; border: 1px solid var(--line-card);
           border-radius: 4px; padding: 32px 46px 26px; }
  svg { display: inline-block; vertical-align: middle; }

  .brand { text-align: center; }
  .brand img { height: 40px; width: auto; }
  .divider { display: flex; align-items: center; justify-content: center; gap: 14px; max-width: 66%; margin: 16px auto 0; }
  .divider .ln { flex: 1; height: 1px; background: linear-gradient(to right, transparent, var(--gold-soft) 35%, var(--gold-soft) 65%, transparent); }
  .divider .orn { color: var(--gold); width: 36px; height: 10px; }
  .doc-title { text-align: center; font-family: var(--serif); font-weight: 600; font-size: 25px;
               letter-spacing: .22em; text-transform: uppercase; color: var(--ink); margin: 14px 0 0; padding-left: .22em; }
  .period { display: flex; align-items: center; justify-content: center; gap: 11px;
            font-size: 11px; letter-spacing: 1px; color: var(--muted); margin-top: 6px; }
  .period .d { width: 26px; height: 1px; background: var(--gold-soft); }
  .company { text-align: center; margin-top: 14px; }
  .company .nm { font-family: var(--serif); font-size: 15px; font-weight: 600; color: var(--ink); }
  .company .ad { font-size: 10px; color: var(--muted); margin-top: 2px; }

  .intro { margin-top: 20px; font-size: 10.5px; color: var(--muted); line-height: 1.5; text-align: center; }
  .upto { margin-top: 10px; text-align: center; font-size: 11px; color: var(--olive); letter-spacing: .3px; }
  .upto strong { color: var(--ink); font-weight: 600; }

  table { width: 100%; border-collapse: collapse; margin-top: 18px; }
  th, td { text-align: left; }
  thead th { font-size: 9px; letter-spacing: 1.2px; text-transform: uppercase; color: var(--muted);
             font-weight: 600; border-bottom: 1.5px solid var(--gold-soft); padding: 0 10px 9px; }
  thead th:first-child { padding-left: 12px; }
  thead th.num, td.num { text-align: right; }
  thead th.sig, td.sig { text-align: left; width: 34%; }
  tbody td { font-size: 11px; border-bottom: 1px solid var(--line-table); color: var(--ink); padding: 11px 10px; }
  tbody td:first-child { padding-left: 12px; }
  td.idx { color: var(--muted); font-variant-numeric: tabular-nums; width: 26px; }
  td.nm { font-weight: 500; }
  td.nm .fn { display: block; font-size: 9px; font-weight: 400; letter-spacing: .3px; color: var(--muted); text-transform: uppercase; margin-top: 2px; }
  td.num { font-variant-numeric: tabular-nums; white-space: nowrap; }
  tfoot td { font-size: 10.5px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; color: var(--olive);
             background: var(--beige); border-top: 1.5px solid var(--gold-soft); padding: 11px 10px; }
  tfoot td:first-child { padding-left: 12px; border-top-left-radius: 7px; border-bottom-left-radius: 7px; }
  tfoot td.num { text-align: right; color: var(--ink); }
  tfoot td:last-child { border-top-right-radius: 7px; border-bottom-right-radius: 7px; }

  .present { margin-top: 26px; }
  .present-title { display: flex; align-items: center; gap: 8px; font-size: 9.5px; letter-spacing: 1.5px;
                   text-transform: uppercase; color: var(--olive); margin-bottom: 12px; }
  .present-title svg { width: 14px; height: 14px; }
  .present-row { display: flex; align-items: flex-end; gap: 14px; margin-bottom: 16px; }
  .present-name { font-size: 11px; font-weight: 500; color: var(--ink); min-width: 40%; }
  .present-sig { flex: 1; border-bottom: 1px dotted #cdbfae; height: 16px; }
  .present-empty { color: var(--muted); }

  .employer { margin-top: 30px; margin-left: auto; width: 46%; text-align: center; }
  .employer-line { border-bottom: 1px solid #cdbfae; height: 26px; }
  .employer-role { font-size: 8.5px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--muted); margin-top: 6px; }
  .employer-name { font-family: var(--serif); font-size: 13px; font-weight: 600; color: var(--ink); margin-top: 2px; }

  .foot { text-align: center; font-size: 8.5px; letter-spacing: .5px; color: #bdbab3; margin-top: 26px; }

  @page { size: A4 portrait; margin: 9mm 10mm; }
  @media print {
    body { background: #fff; padding: 0; }
    .sheet { border: 1px solid var(--line-card); border-radius: 8px; max-width: none; margin: 0; padding: 26px 30px 22px; }
    tr, .present-title, .present-row, .employer { page-break-inside: avoid; }
    thead { display: table-header-group; }
    tfoot { display: table-row-group; }
  }
</style></head>
<body>
  <div class="sheet">
    ${meta.logoDataUrl ? `<div class="brand"><img src="${meta.logoDataUrl}" alt="${esc(meta.company)}"/></div>` : ''}
    <div class="divider"><span class="ln"></span><span class="orn">${ORNAMENT}</span><span class="ln"></span></div>
    <div class="doc-title">Répartition des pourboires</div>
    <div class="period"><span class="d"></span>${esc(meta.monthLabelFr)}<span class="d"></span></div>

    <div class="company">
      <div class="nm">${esc(meta.company)}</div>
      ${meta.companyAddress ? `<div class="ad">${esc(meta.companyAddress)}</div>` : ''}
    </div>

    <p class="intro">Répartition mensuelle des pourboires laissés par les clients.<br/>
      Chaque employé signe pour confirmer la réception du montant indiqué.</p>
    ${meta.upToDateFr ? `<p class="upto">Pourboires jusqu&rsquo;au <strong>${esc(meta.upToDateFr)}</strong></p>` : ''}

    <table>
      <thead>
        <tr>
          <th>N°</th>
          <th>Nom &amp; prénom</th>
          <th class="num">Montant reçu</th>
          <th class="sig">Signature</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
      <tfoot>
        <tr>
          <td colspan="2">Total distribué</td>
          <td class="num">${ar(total) || '—'}</td>
          <td></td>
        </tr>
      </tfoot>
    </table>

    <div class="present">
      <div class="present-title">${ICON_USERS} Présents au comptage des pourboires</div>
      ${presentHtml}
    </div>

    <div class="employer">
      <div class="employer-line"></div>
      <div class="employer-role">L&rsquo;employeur</div>
      <div class="employer-name">Borut Retelj &middot; Komba Cabana Lodge</div>
    </div>

    <div class="foot">Document généré par Komba Cabana · ${esc(meta.monthLabelFr)}</div>
  </div>
</body></html>`
}
