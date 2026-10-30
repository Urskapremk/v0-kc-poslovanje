import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  isPdfCompanyDocument,
  isPdfUpload,
  pdfStorageName,
  safeCompanyFileName,
} from './company-document-file.ts'

describe('isPdfUpload', () => {
  it('accepts a PDF picked from the computer', () => {
    assert.equal(isPdfUpload({ type: 'application/pdf', name: 'statut.pdf' }), true)
    assert.equal(isPdfUpload({ type: '', name: 'statut.PDF' }), true)
    assert.equal(isPdfUpload({ type: 'application/octet-stream', name: 'statut.pdf' }), true)
    assert.equal(isPdfUpload({ type: 'application/pdf', name: 'dokument' }), true)
  })

  it('does not treat screenshots as PDFs', () => {
    assert.equal(isPdfUpload({ type: 'image/png', name: 'posnetek.png' }), false)
    assert.equal(isPdfUpload({ type: 'image/jpeg', name: 'foto.jpg' }), false)
    assert.equal(isPdfUpload({ type: '', name: 'posnetek.png' }), false)
  })
})

describe('isPdfCompanyDocument', () => {
  it('recognises a stored PDF and leaves screenshots as images', () => {
    assert.equal(isPdfCompanyDocument({
      fileName: 'statut.pdf',
      pathname: 'company-documents/tourism/1-statut.pdf',
    }), true)
    assert.equal(isPdfCompanyDocument({
      fileName: null,
      pathname: 'company-documents/sarl/2-dokument.pdf',
    }), true)
    assert.equal(isPdfCompanyDocument({
      fileName: 'dokument.jpg',
      pathname: 'company-documents/sarl/2-dokument.jpg',
    }), false)
  })
})

describe('pdf file names', () => {
  it('keeps a readable pdf name for the card', () => {
    assert.equal(pdfStorageName('Statut.pdf'), 'Statut.pdf')
    assert.equal(pdfStorageName('Statut'), 'Statut.pdf')
  })

  it('keeps the pdf suffix on the stored file even when the name is long', () => {
    const name = safeCompanyFileName(`${'a'.repeat(200)}.pdf`, true)
    assert.match(name, /\.pdf$/)
    assert.ok(name.length <= 80)
  })

  it('keeps image names as they were', () => {
    assert.equal(safeCompanyFileName('moj posnetek.png', false), 'moj_posnetek.png')
  })
})
