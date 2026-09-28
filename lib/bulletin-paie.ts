// Gradnik francoske placilne liste "BULLETIN DE PAIE" (cist HTML za tisk/PDF).
// Oblika je klasicna madagaskarska placilna lista; formule in zneski prihajajo iz calcMgPayslip.

import { formatMgAr, type MgPayslip } from './payroll-mg'

const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

export type BulletinMeta = {
  employer: string
  employerAddress: string
  // Davcni podatki podjetja (Carte fiscale)
  employerNif?: string
  employerRcs?: string
  employerStat?: string
  employerTaxCenter?: string
  fullName: string
  fonction: string
  category: string
  hireDate: string      // ISO ali prazno
  year: number
  month: number         // 1-12
  cnapsNumber?: string
  ominoNumber?: string
  // Osebni podatki zaposlenega (osebna izkaznica)
  dateOfBirth?: string
  placeOfBirth?: string
  cin?: string
  domicile?: string
  // Saldo dopusta (conges payes) za tekoce leto do konca meseca
  leaveAccrued?: number   // pridobljeni dnevi (2,5 x meseci + prenos)
  leaveUsed?: number      // koristeni dnevi v letu
  leaveRemaining?: number // preostali saldo
  leaveAsOf?: string      // datum stanja (ISO)
  leavePriorByYear?: { year: string; days: number }[]  // razclemba prenosa po letih
  logoDataUrl?: string    // barvni logo (data URI, da se zanesljivo natisne)
  grossUpLabelFr: string // naziv postavke povecanja (uporabnik izbere)
}

function esc(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// Dnevi dopusta v fr obliki (decimalka z vejico, brez odvecne nicle): 15 / 17,5 / 11,5
function fmtDays(v?: number): string {
  const num = Number(v ?? 0)
  return num.toLocaleString('fr-FR', { maximumFractionDigits: 1 })
}

function fmtDateFr(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso.length <= 10 ? iso + 'T00:00:00' : iso)
  if (isNaN(d.getTime())) return esc(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

export function buildBulletinHtml(p: MgPayslip, meta: BulletinMeta): string {
  const period = `${MONTHS_FR[(meta.month - 1) % 12]} ${meta.year}`
  const ar = (v: number) => formatMgAr(v)

  // Vrstice zasluzka (gains)
  // Osnovno placo razdelimo na REDNO DELO in PLACAN DOPUST (oba zneska,
  // skupaj = osnovna placa). Dopust je placan kot navaden dan.
  const gains: Array<[string, string]> = []
  if (p.leaveDays > 0) {
    const jours = `${p.leaveDays} ${p.leaveDays === 1 ? 'jour' : 'jours'}`
    const travailAmount = Math.max(0, p.baseSalary - p.leaveAmount)
    gains.push(['Salaire (travail effectif)', ar(travailAmount)])
    gains.push([`Congés payés (${jours})`, ar(p.leaveAmount)])
  } else {
    gains.push(['Salaire de base', ar(p.baseSalary)])
  }
  if (p.sundayAmount) gains.push(['Majoration dimanche', ar(p.sundayAmount)])
  if (p.holidayAmount) gains.push(['Majoration jours fériés', ar(p.holidayAmount)])
  if (p.overtimeAmount) gains.push(['Heures supplémentaires', ar(p.overtimeAmount)])
  if (p.seniorityAmount) {
    const ans = `${p.seniorityYears} ${p.seniorityYears === 1 ? 'an' : 'ans'}`
    gains.push([`Prime d'ancienneté (${ans}, ${Math.round(p.seniorityRate * 100)}%)`, ar(p.seniorityAmount)])
  }
  if (p.otherBonuses) gains.push(['Primes', ar(p.otherBonuses)])
  gains.push([esc(meta.grossUpLabelFr), ar(p.grossUp)])

  // Vrstice odbitkov (retenues)
  const retenues: Array<[string, string]> = []
  for (const c of p.contributions) {
    if (c.employeeAmount > 0) retenues.push([`${esc(c.name)} salarié`, ar(c.employeeAmount)])
  }
  retenues.push(['IRSA', ar(p.irsa)])
  if (p.advances) retenues.push(['Avances', ar(p.advances)])
  if (p.otherDeductions) retenues.push(['Autres retenues', ar(p.otherDeductions)])

  // Pomozna vrstica label/vrednost (izpise se le, ce vrednost obstaja)
  const info = (lbl: string, val?: string) =>
    val && String(val).trim() ? `<div class="info-row"><span class="info-lbl">${esc(lbl)}:</span> <span class="info-val">${esc(val)}</span></div>` : ''

  const employerInfo = [
    info('NIF', meta.employerNif),
    info('RCS', meta.employerRcs),
    info('N° Statistique', meta.employerStat),
    info('Centre fiscal', meta.employerTaxCenter),
  ].join('')

  const employeeInfo = [
    info('Fonction', meta.fonction),
    info('Catégorie professionnelle', meta.category),
    info('Date d\'embauche', meta.hireDate ? fmtDateFr(meta.hireDate) : ''),
    info('N° CNAPS', meta.cnapsNumber),
    info('N° OMINO', meta.ominoNumber),
    info('N° CIN', meta.cin),
    info('Né(e) le', meta.dateOfBirth ? fmtDateFr(meta.dateOfBirth) : ''),
    info('Lieu de naissance', meta.placeOfBirth),
  ].join('')

  const gainsRows = gains
    .map(
      ([l, v]) =>
        `<tr><td>${l}</td><td class="num">${v}</td><td class="num muted">–</td></tr>`,
    )
    .join('')
  const retenuesRows = retenues
    .map(
      ([l, v]) =>
        `<tr><td>${l}</td><td class="num muted">–</td><td class="num">${v}</td></tr>`,
    )
    .join('')

  // Diskretne crtne ikone (olivne/zlate) in okrasni element (zlato-bez).
  const stroke = 'fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"'
  const ICON_BUILDING = `<svg viewBox="0 0 24 24" ${stroke}><path d="M3 21h18"/><path d="M5 21V5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v16"/><path d="M13 9h5a1 1 0 0 1 1 1v11"/><path d="M8 8h.01M8 12h.01M8 16h.01"/></svg>`
  const ICON_USER = `<svg viewBox="0 0 24 24" ${stroke}><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>`
  const ICON_WALLET = `<svg viewBox="0 0 24 24" ${stroke}><path d="M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v2"/><path d="M3 7v10a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-3"/><path d="M16 12h6v4h-6a2 2 0 0 1 0-4z"/></svg>`
  const ICON_CAL = `<svg viewBox="0 0 24 24" ${stroke}><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/></svg>`
  const ORNAMENT = `<svg viewBox="0 0 44 12" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round"><path d="M4 6c4-4 7-4 9 0M31 6c2 4 5 4 9 0"/><circle cx="22" cy="6" r="2.2"/></svg>`

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>Bulletin de paie - ${esc(meta.fullName)} - ${period}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  :root {
    --ink: #332a20;          /* topla temna */
    --muted: #a78e6f;        /* topla siva besedila */
    --olive: #836d51;        /* topla olivno-zlata (oznake + ikone) */
    --gold: #c59b5b;         /* zlata (okraski, crte) */
    --gold-soft: #d6c3ab;    /* nezna zlata (podcrtaj, robovi) */
    --line-card: #ece6df;    /* komaj viden bez okvir kartic */
    --line-table: #ede8e1;   /* skoraj nevidne crte tabele */
    --beige: #f4efe9;        /* svetlo bez (TOTAUX vrstica) */
    --serif: 'Cormorant Garamond', Georgia, 'Times New Roman', serif;
    --sans: 'Inter', 'Helvetica Neue', Arial, sans-serif;
  }
  * { box-sizing: border-box; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: var(--sans); color: var(--ink); background: #f5f2ee; margin: 0; padding: 32px; font-size: 11px; }
  .sheet { max-width: 720px; margin: 0 auto; background: #ffffff; border: 1px solid var(--line-card);
           border-radius: 4px; padding: 30px 46px 24px; }
  svg { display: inline-block; vertical-align: middle; }

  /* Glava */
  .brand { text-align: center; }
  .brand img { height: 40px; width: auto; }
  .divider { display: flex; align-items: center; justify-content: center; gap: 14px; max-width: 66%; margin: 16px auto 0; }
  .divider .ln { flex: 1; height: 1px; background: linear-gradient(to right, transparent, var(--gold-soft) 35%, var(--gold-soft) 65%, transparent); }
  .divider .orn { color: var(--gold); width: 36px; height: 10px; }
  .doc-title { text-align: center; font-family: var(--serif); font-weight: 600; font-size: 27px;
               letter-spacing: .35em; text-transform: uppercase; color: var(--ink); margin: 16px 0 0; padding-left: .35em; }
  .period { display: flex; align-items: center; justify-content: center; gap: 11px;
            font-size: 11px; letter-spacing: 1px; color: var(--muted); margin-top: 7px; }
  .period .d { width: 26px; height: 1px; background: var(--gold-soft); }

  /* Kartici delodajalec / zaposleni */
  .head { display: flex; gap: 22px; margin-top: 22px; }
  .head .box { flex: 1; border: 1px solid var(--line-card); border-radius: 10px; padding: 20px 26px; }
  .box-title { display: flex; align-items: center; gap: 8px; font-size: 9.5px; letter-spacing: 2px;
               text-transform: uppercase; color: var(--olive); margin-bottom: 14px; }
  .box-title svg { width: 13px; height: 13px; }
  .name-line { font-family: var(--serif); font-size: 18px; font-weight: 600; line-height: 1.15; color: var(--ink); }
  .addr { font-size: 10.5px; color: var(--muted); margin: 5px 0 12px; line-height: 1.4; }
  .info-row { font-size: 11px; margin-top: 7px; line-height: 1.35; }
  .info-lbl { color: var(--muted); }
  .info-val { color: var(--ink); font-weight: 600; }

  /* Tabela */
  table { width: 100%; border-collapse: collapse; margin-top: 22px; }
  th, td { padding: 8px 12px; text-align: left; }
  thead th { font-size: 9.5px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--muted);
             font-weight: 600; border-bottom: 1.5px solid var(--gold-soft); padding-bottom: 10px; }
  thead th:first-child { padding-left: 16px; }
  thead th:last-child, tbody td:last-child, tfoot td:last-child { padding-right: 16px; }
  tbody td { font-size: 11.5px; border-bottom: 1px solid var(--line-table); color: var(--ink); }
  tbody td:first-child { padding-left: 16px; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  td.num.muted { color: #cbc2b0; }
  tfoot td { font-size: 10.5px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase;
             color: var(--olive); background: var(--beige); border-top: 1.5px solid var(--gold-soft);
             padding-top: 11px; padding-bottom: 11px; }
  tfoot td:first-child { padding-left: 16px; border-top-left-radius: 7px; border-bottom-left-radius: 7px; }
  tfoot td:last-child { border-top-right-radius: 7px; border-bottom-right-radius: 7px; }

  /* Neto */
  .net { display: flex; align-items: center; justify-content: space-between; margin: 16px 0 0;
         padding: 11px 22px; border: 1px solid var(--line-card); border-radius: 10px; background: #fff; }
  .net-left { display: flex; align-items: center; gap: 12px; }
  .net-circle { width: 28px; height: 28px; border: 1px solid var(--gold-soft); border-radius: 50%;
                display: flex; align-items: center; justify-content: center; }
  .net-circle svg { width: 15px; height: 15px; color: var(--olive); }
  .net-label { font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: var(--muted); }
  .net-amount { font-family: var(--serif); font-size: 17px; font-weight: 600; letter-spacing: .3px; color: var(--ink); }

  /* Dopust */
  .leave { margin-top: 18px; }
  .leave-title { display: flex; align-items: center; gap: 7px; font-size: 9px; letter-spacing: 1.5px;
                 text-transform: uppercase; color: var(--olive); margin-bottom: 8px; }
  .leave-title svg { width: 12px; height: 12px; }
  .leave-title .muted-date { color: var(--muted); font-weight: 400; }
  .leave-grid { display: flex; }
  .leave-grid > div { flex: 1; display: flex; align-items: baseline; gap: 8px; justify-content: center;
                      padding: 1px 12px; border-right: 1px solid var(--line-table); }
  .leave-grid > div:last-child { border-right: none; }
  .leave-lbl { font-size: 8.5px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--muted); }
  .leave-val { font-size: 11.5px; font-weight: 600; color: var(--ink); font-variant-numeric: tabular-nums; }
  .leave-prior { margin-top: 8px; font-size: 9px; color: var(--muted); line-height: 1.4; }
  .leave-prior .lbl { text-transform: uppercase; letter-spacing: 1px; color: var(--olive); }
  .leave-prior .yr { color: var(--ink); font-weight: 600; font-variant-numeric: tabular-nums; }

  /* Podpisi */
  .sign { display: flex; align-items: flex-end; justify-content: space-between; gap: 30px; margin-top: 20px; }
  .sign .col { flex: 0 0 40%; text-align: center; }
  .sign .line { border-top: 1px solid #e2e1de; margin-top: 22px; padding-top: 8px;
                font-size: 9px; font-style: italic; letter-spacing: .5px; color: #a8a49a; }
  .sign .orn { color: var(--gold); width: 32px; height: 9px; padding-bottom: 6px; flex: 0 0 auto; }

  .foot { text-align: center; font-size: 8.5px; letter-spacing: .5px; color: #bdbab3; margin-top: 18px; }

  @page { size: A4 portrait; margin: 9mm 10mm; }
  @media print {
    body { background: #fff; padding: 0; font-size: 10.5px; }
    .sheet { border: 1px solid var(--line-card); border-radius: 8px; max-width: none; margin: 0; padding: 26px 30px 22px; }
    .head, table, .net, .leave, .sign { page-break-inside: avoid; }
  }
</style>
</head>
<body>
  <div class="sheet">
    <div class="brand">
      ${
        meta.logoDataUrl
          ? `<img src="${meta.logoDataUrl}" alt="${esc(meta.employer)}" />`
          : `<div style="font-family:var(--serif);font-size:24px;color:var(--ink)">${esc(meta.employer)}</div>`
      }
    </div>
    <div class="divider"><span class="ln"></span><span class="orn">${ORNAMENT}</span><span class="ln"></span></div>
    <div class="doc-title">Bulletin de paie</div>
    <div class="period"><span class="d"></span>${period}<span class="d"></span></div>

    <div class="head">
      <div class="box">
        <div class="box-title">${ICON_BUILDING} Employeur</div>
        <div class="name-line">${esc(meta.employer)}</div>
        <div class="addr">${esc(meta.employerAddress)}</div>
        ${employerInfo}
      </div>
      <div class="box">
        <div class="box-title">${ICON_USER} Salarié(e)</div>
        <div class="name-line">${esc(meta.fullName)}</div>
        <div class="addr"></div>
        ${employeeInfo}
      </div>
    </div>

    <table>
      <thead>
        <tr><th>Désignation</th><th class="num">Gains</th><th class="num">Retenues</th></tr>
      </thead>
      <tbody>
        ${gainsRows}
        ${retenuesRows}
      </tbody>
      <tfoot>
        <tr>
          <td>Totaux</td>
          <td class="num">${ar(p.grossPay)}</td>
          <td class="num">${ar(p.totalDeductions)}</td>
        </tr>
      </tfoot>
    </table>

    <div class="net">
      <div class="net-left"><span class="net-circle">${ICON_WALLET}</span><span class="net-label">Montant net à payer</span></div>
      <span class="net-amount">${ar(p.netToPay)}</span>
    </div>

    ${
      meta.leaveRemaining != null
        ? `<div class="leave">
      <div class="leave-title">${ICON_CAL} Congés payés (${meta.year})${meta.leaveAsOf ? ` <span class="muted-date">— au ${fmtDateFr(meta.leaveAsOf)}</span>` : ''}</div>
      <div class="leave-grid">
        <div><span class="leave-lbl">Acquis</span><span class="leave-val">${fmtDays(meta.leaveAccrued)} j</span></div>
        <div><span class="leave-lbl">Pris</span><span class="leave-val">${fmtDays(meta.leaveUsed)} j</span></div>
        <div><span class="leave-lbl">Solde</span><span class="leave-val">${fmtDays(meta.leaveRemaining)} j</span></div>
      </div>${
        meta.leavePriorByYear && meta.leavePriorByYear.length
          ? `
      <div class="leave-prior"><span class="lbl">Dont report des années précédentes :</span> ${meta.leavePriorByYear
              .map((pr) => `${esc(pr.year)} : <span class="yr">${fmtDays(pr.days)} j</span>`)
              .join(' &nbsp;·&nbsp; ')}</div>`
          : ''
      }
    </div>`
        : ''
    }

    <div class="sign">
      <div class="col"><div class="line">Signature du salarié(e)</div></div>
      <span class="orn">${ORNAMENT}</span>
      <div class="col"><div class="line">Signature de l'employeur</div></div>
    </div>

    <div class="foot">Document généré par Komba Cabana · Base horaire ${p.monthlyHours.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} h/mois</div>
  </div>
</body>
</html>`
}
