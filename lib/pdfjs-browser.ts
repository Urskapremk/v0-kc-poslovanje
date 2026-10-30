import type { PdfPageImage } from './company-documents-pdf'

// Worker is the pdfjs-dist 4.10.38 build copied to public/, same version as the
// package. A mismatched worker renders a blank page.
export const PDFJS_WORKER_SRC = '/pdf.worker.min.mjs'

export async function loadPdfjs() {
  const pdfjs = await import('pdfjs-dist')
  if (pdfjs.GlobalWorkerOptions.workerSrc !== PDFJS_WORKER_SRC) {
    pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_SRC
  }
  return pdfjs
}

export async function openPdfDocument(data: Uint8Array) {
  const pdfjs = await loadPdfjs()
  return pdfjs.getDocument({ data, isEvalSupported: false }).promise
}

export async function rasterizePdfBytes(data: Uint8Array): Promise<PdfPageImage[]> {
  const pdf = await openPdfDocument(data)
  const images: PdfPageImage[] = []
  try {
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const base = page.getViewport({ scale: 1 })
      const scale = Math.min(2, 1600 / Math.max(base.width, 1))
      const viewport = page.getViewport({ scale })
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.ceil(viewport.width))
      canvas.height = Math.max(1, Math.ceil(viewport.height))
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('pdf')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      await page.render({ canvasContext: ctx, viewport }).promise
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
      page.cleanup()
      images.push({
        dataUrl,
        width: canvas.width,
        height: canvas.height,
      })
    }
  } finally {
    await pdf.destroy()
  }
  if (images.length === 0) throw new Error('pdf')
  return images
}
