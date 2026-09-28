import { writeFileSync, readFileSync } from 'fs'
import { buildCertificatTravailHtml } from '../lib/certifikat-travail-doc.ts'
let logo
try { logo = 'data:image/png;base64,' + readFileSync('public/images/komba-logo-color.png').toString('base64') } catch {}
const html = buildCertificatTravailHtml({
  companyLines:['SARL KOMBA CABANA','ANDREKAREKA','NOSY BE'],
  companyName:'SARL KOMBA CABANA', representative:'RETELJ Borut', representativeCivility:'Monsieur',
  employeeName:'SOAMANANO Charlesia', gender:'f', qualite:'femme de chambre',
  startLabel:'01 Août 2024', endLabel:'04 Juin 2026', classification:'M1', indice:'1733',
  placeLabel:'Nosy-Be', dateLabel:'04 Juin 2026', signatoryRole:'Le Gérant',
  signatoryName:'RETELJ Borut', lodgeName:'KOMBA CABANA LODGE', locationLine:'NOSY KOMBA \u00b7 MADAGASCAR', logoDataUrl:logo,
})
writeFileSync('public/_tmp_travorn.html', html); console.log('ok')
