import { writeFileSync } from 'node:fs'
import { buildCertificateHtml } from '../lib/certifikat-doc.ts'
const html = buildCertificateHtml({
  studentName: 'HIMDY Ainaty Sandia',
  roleLabel: 'waitress',
  bodyParagraphs: [
    'has successfully completed her internship as a waitress at the restaurant of Komba Cabana Lodge.',
    'During this period, she demonstrated seriousness, motivation, professionalism and an excellent sense of customer service.',
    'She actively participated in welcoming guests, preparing tables, serving food and beverages, and in the smooth daily operation of the restaurant.',
    'Thanks to her dedication and commitment, she has acquired valuable practical skills in the field of hospitality, service and restaurant operations.',
  ],
  conclusion: 'The internship was completed successfully and to our entire satisfaction.',
  place: 'Nosy Komba',
  dateLabel: 'June 9, 2026',
  signatoryName: 'Borut Retelj',
  signatoryTitle: 'CEO',
  company: 'Komba Cabana Tourism SARL',
  locationLine: 'NOSY KOMBA \u00b7 MADAGASCAR',
})
writeFileSync('public/_tmp_gap.html', html)
console.log('ok')
