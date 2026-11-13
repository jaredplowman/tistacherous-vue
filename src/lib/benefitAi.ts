import { getGenerativeModel, Schema } from 'firebase/ai'
import { errorMessage } from './errors'
import { ai } from './firebase'
import type { BenefitPdfSlot } from './storage'

export interface ScannedBenefitPdf {
  caregiverName: string
  careType: string
  patient: string
  serviceDate: string
  title: string
  billedAmount: number | null
  paidAmount: number | null
  denied: boolean
}

const scanSchema = Schema.object({
  properties: {
    caregiverName: Schema.string({ description: 'Clinic, practitioner, or pharmacy name. Empty string if unknown.' }),
    careType: Schema.string({ description: 'Short category like Dental, Physio, Vision, Massage, Chiropractic, Pharmacy. Empty string if unknown.' }),
    patient: Schema.string({ description: 'Patient or person who received the service. Empty string if unknown.' }),
    serviceDate: Schema.string({ description: 'Date of service, treatment, or receipt in YYYY-MM-DD format. Empty string if unknown.' }),
    title: Schema.string({ description: 'Short 2-5 word summary of the service (e.g. Dental cleaning, Physio visit, Eye exam). Always provide a best-guess summary if any service or clinic is visible.' }),
    billedAmount: Schema.number({ description: 'Total billed, charged, or receipt total amount in dollars (numeric, no $ sign).', nullable: true }),
    paidAmount: Schema.number({ description: 'Amount paid/reimbursed by the insurance provider in dollars (for EOB/response PDFs).', nullable: true }),
    denied: Schema.boolean({ description: 'True if the insurance provider response explicitly denied/declined the claim.' }),
  },
})

function normalizeDate(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  const trimmed = raw.trim()
  if (!trimmed) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toISOString().slice(0, 10)
}

function normalizeMoney(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.round(raw * 100) / 100
  if (typeof raw === 'string') {
    const cleaned = raw.replace(/[$,\s]/g, '')
    const num = Number(cleaned)
    if (cleaned && Number.isFinite(num)) return Math.round(num * 100) / 100
  }
  return null
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : '')
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export interface ScanResult {
  data: ScannedBenefitPdf | null
  error?: string
}

export async function scanBenefitPdf(
  file: File,
  slot: BenefitPdfSlot,
  existingTypes: string[],
): Promise<ScanResult> {
  try {
    const base64 = await fileToBase64(file)
    if (!base64) return { data: null, error: 'Could not read PDF file.' }

    const model = getGenerativeModel(ai, {
      model: 'gemini-3.8-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: scanSchema,
      },
    })

    const roleHint =
      slot === 'receipt'
        ? 'This PDF is a medical/health receipt or invoice.'
        : 'This PDF is an insurance provider Explanation of Benefits (EOB) / claim response.'
    const typesHint = existingTypes.length
      ? `Prefer one of these existing care types if it fits: ${existingTypes.join(', ')}.`
      : ''

    const result = await model.generateContent([
      { type: 'inlineData', inlineData: { data: base64, mimeType: 'application/pdf' } },
      `Extract the benefit claim details from this PDF. ${roleHint} ${typesHint} Convert any service/treatment/receipt date to YYYY-MM-DD. Extract the total billed/charged dollar amount as billedAmount, and a short 2-5 word title describing the service. Use empty string or null only if a field is completely absent.`,
    ])

    const parsed = JSON.parse(result.response.text()) as Record<string, unknown>
    return {
      data: {
        caregiverName: typeof parsed.caregiverName === 'string' ? parsed.caregiverName.trim() : '',
        careType: typeof parsed.careType === 'string' ? parsed.careType.trim() : '',
        patient: typeof parsed.patient === 'string' ? parsed.patient.trim() : '',
        serviceDate: normalizeDate(parsed.serviceDate),
        title: typeof parsed.title === 'string' ? parsed.title.trim() : '',
        billedAmount: normalizeMoney(parsed.billedAmount),
        paidAmount: normalizeMoney(parsed.paidAmount),
        denied: parsed.denied === true,
      },
    }
  } catch (e) {
    console.error('AI PDF scan failed:', e)
    return { data: null, error: errorMessage(e) }
  }
}
