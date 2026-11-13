import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

GlobalWorkerOptions.workerSrc = workerUrl

// Extracts text from the first two pages of a PDF for automatic caregiver detection.
// Returns '' on scanned/image-only PDFs or parse errors so uploads still succeed.
export async function extractPdfText(file: File): Promise<string> {
  try {
    const data = new Uint8Array(await file.arrayBuffer())
    const pdf = await getDocument({ data }).promise
    const pages = Math.min(2, pdf.numPages)
    const chunks: string[] = []
    for (let i = 1; i <= pages; i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      const line = content.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ')
      chunks.push(line)
    }
    return chunks.join('\n')
  } catch {
    return ''
  }
}
