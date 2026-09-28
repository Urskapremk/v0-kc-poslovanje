import { writeFileSync, readFileSync } from 'fs'
import { buildCertificateHtml } from '../lib/certifikat-doc.ts'
let logo
try { logo = 'data:image/png;base64,' + readFileSync('public/images/komba-logo-color.png').toString('base64') } catch {}
const html = buildCertificateHtml({ studentName:'RABENANDRASANA Francel', roleLabel:'waitress', bodyParagraphs:['has successfully completed her internship as a waitress at the restaurant of Komba Cabana Lodge.','During this period she demonstrated seriousness, motivation and professionalism.'], conclusion:'The internship was completed successfully and to our entire satisfaction.', place:'Nosy Komba', dateLabel:'July 23, 2026', signatoryName:'Borut Retelj', signatoryTitle:'CEO', company:'Komba Cabana Tourism SARL', lodgeName:'KOMBA CABANA LODGE', locationLine:'NOSY KOMBA \u00b7 MADAGASCAR', logoDataUrl:logo })
writeFileSync('public/_tmp_sign.html', html); console.log('ok', html.length)
