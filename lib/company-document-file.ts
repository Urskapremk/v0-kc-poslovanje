// Posnetki ostanejo slike. PDF, ki ga Urška izbere na računalniku, se shrani
// kot PDF (pripona ostane), da ga lahko kasneje odpre in pokaže prvo stran.

export function isPdfUpload(file: { type?: string | null; name?: string | null }): boolean {
  const type = (file.type || '').toLowerCase()
  const name = file.name || ''
  if (type === 'application/pdf' || type === 'application/x-pdf') return true
  if (!/\.pdf$/i.test(name)) return false
  return type === '' || type === 'application/octet-stream'
}

export function isPdfCompanyDocument(doc: { pathname?: string | null; fileName?: string | null }): boolean {
  return endsWithPdf(doc.fileName) || endsWithPdf(doc.pathname)
}

export function pdfStorageName(name: string | null | undefined): string {
  const base = (name || '').trim() || 'dokument'
  return /\.pdf$/i.test(base) ? base : `${base}.pdf`
}

export function safeCompanyFileName(name: string | null | undefined, pdf: boolean): string {
  let safe = (name || 'dokument')
    .replace(/[^\w.\-]+/g, '_')
    .replace(/^\.+/, '')
  if (!pdf) return safe.slice(0, 80) || 'dokument'
  safe = safe.replace(/\.pdf$/i, '')
  safe = safe.slice(0, 76).replace(/\.+$/, '')
  return `${safe || 'dokument'}.pdf`
}

function endsWithPdf(value: string | null | undefined): boolean {
  const path = (value || '').split(/[?#]/)[0]
  return /\.pdf$/i.test(path)
}
