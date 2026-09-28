import { buildCertificateHtml } from '../lib/certifikat-doc.ts'
import { writeFileSync } from 'node:fs'
const html = buildCertificateHtml({
  studentName: 'Himdy Ainaty Sandia',
  lodgeName: 'Komba Cabana Lodge',
  locationLine: 'Nosy Komba \u00b7 Madagascar',
  place: 'Nosy Komba',
  dateLabel: 'July 23, 2026',
  signatoryName: 'Borut Retelj',
  signatoryRole: 'CEO',
  company: 'Komba Cabana Tourism SARL',
  bodyParagraphs: [
    'has successfully completed her internship as a waitress at the restaurant of Komba Cabana Lodge.',
    'During this period, she demonstrated seriousness, motivation, professionalism and an excellent sense of customer service.',
    'She actively participated in welcoming guests, preparing tables, serving food and beverages, and in the smooth daily operation of the restaurant.',
    'Thanks to her dedication and commitment, she has acquired valuable practical skills in the field of hospitality, service and restaurant operations.',
    'The internship was completed successfully and to our entire satisfaction.',
  ],
})
writeFileSync('public/_tmp_palmwm.html', html)
console.log('hasLogoImg', /class="watermark" src=/.test(html), 'hasPalmWm', /palm-wm-svg/.test(html))
