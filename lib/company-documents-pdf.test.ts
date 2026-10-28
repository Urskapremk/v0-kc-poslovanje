import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildCompanyDocumentsPdf,
  documentsForPdf,
  type PdfPageImage,
} from './company-documents-pdf.ts'

const JPEG =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA='

describe('documentsForPdf', () => {
  it('puts Tourism before SARL and keeps paste order inside each company', () => {
    const ordered = documentsForPdf([
      { id: 's1', company: 'sarl' },
      { id: 't1', company: 'tourism' },
      { id: 's2', company: 'sarl' },
      { id: 't2', company: 'tourism' },
    ])
    assert.deepEqual(ordered.map((doc) => doc.id), ['t1', 't2', 's1', 's2'])
  })

  it('returns nothing when there are no images', () => {
    assert.deepEqual(documentsForPdf([]), [])
  })
})

describe('buildCompanyDocumentsPdf', () => {
  const page: PdfPageImage = { dataUrl: JPEG, width: 1, height: 1 }

  it('does not create a file when there are no images', async () => {
    assert.equal(await buildCompanyDocumentsPdf([]), null)
  })

  it('builds one PDF page per image', async () => {
    const bytes = await buildCompanyDocumentsPdf([page, page])
    assert.ok(bytes)
    assert.equal(String.fromCharCode(...bytes.slice(0, 4)), '%PDF')
    const body = Buffer.from(bytes).toString('latin1')
    assert.equal((body.match(/\/Type\s*\/Page\b/g) || []).length, 2)
  })
})
