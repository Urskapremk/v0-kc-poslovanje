// En PDF iz vseh prilepljenih posnetkov. Tourism, nato SARL; znotraj podjetja
// ostane vrstni red, v kakršnem so prišli (prilepljeni po vrsti).

export type PdfCompanyId = 'tourism' | 'sarl'

export type PdfCompanyDocument = {
  id: string
  company: PdfCompanyId
}

export type PdfPageImage = {
  dataUrl: string
  width: number
  height: number
}

export const PDF_FILENAME = 'Podatki-podjetij.pdf'
export const NOTHING_TO_SAVE = 'Ničesar ni za shraniti.'

const COMPANY_ORDER: PdfCompanyId[] = ['tourism', 'sarl']

export function documentsForPdf<T extends PdfCompanyDocument>(docs: T[]): T[] {
  return COMPANY_ORDER.flatMap((company) => docs.filter((doc) => doc.company === company))
}

export async function buildCompanyDocumentsPdf(pages: PdfPageImage[]): Promise<Uint8Array | null> {
  if (pages.length === 0) return null
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  pages.forEach((page, index) => {
    if (index > 0) pdf.addPage()
    const pageW = pdf.internal.pageSize.getWidth()
    const pageH = pdf.internal.pageSize.getHeight()
    const margin = 8
    const maxW = pageW - margin * 2
    const maxH = pageH - margin * 2
    if (!page.width || !page.height) throw new Error('Prazna slika')
    const scale = Math.min(maxW / page.width, maxH / page.height)
    const w = page.width * scale
    const h = page.height * scale
    const x = (pageW - w) / 2
    const y = (pageH - h) / 2
    pdf.addImage(page.dataUrl, 'JPEG', x, y, w, h)
  })
  return new Uint8Array(pdf.output('arraybuffer'))
}
