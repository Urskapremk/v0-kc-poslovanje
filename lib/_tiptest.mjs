import { writeFileSync, readFileSync } from 'fs'
import { buildNapitninaHtml } from './napitnina-doc.ts'
import { getMgCompany } from './payroll-mg.ts'
let logo
try { logo = 'data:image/png;base64,' + readFileSync('public/images/komba-logo-color.png').toString('base64') } catch {}
const c = getMgCompany('tourism')
const rows = [
  {name:'Jaomanjary Fleming Alexando', fonction:'Barman', amountAr:180000},
  {name:'RAZAFY Angeline', fonction:'Kitchen', amountAr:180000},
  {name:'RASOAMANANA Hanipha', fonction:'Kitchen', amountAr:180000},
  {name:'Christaline', fonction:'Housekeeper', amountAr:180000},
]
const html = buildNapitninaHtml({ company:c.name, companyAddress:c.address, monthLabelFr:'Juillet 2026', rows, presentNames:['RAZAFY Angeline','Christaline'], logoDataUrl:logo })
writeFileSync('public/_tmp_tip.html', html); console.log('OK')
