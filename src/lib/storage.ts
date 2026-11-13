import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import type { BenefitAttachment } from '@/domain/types'
import { HOUSEHOLD_ID } from './firestore'
import { storage } from './firebase'

export type BenefitPdfSlot = 'receipt' | 'primaryResponse' | 'secondaryResponse'

const MAX_PDF_BYTES = 15 * 1024 * 1024

export async function uploadBenefitPdf(
  claimId: string,
  slot: BenefitPdfSlot,
  file: File,
): Promise<BenefitAttachment> {
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    throw new Error('Please choose a PDF file.')
  }
  if (file.size > MAX_PDF_BYTES) {
    throw new Error('That PDF is over 15 MB.')
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `households/${HOUSEHOLD_ID}/benefits/${claimId}/${slot}_${Date.now()}_${safeName}`
  const storageRef = ref(storage, path)
  await uploadBytes(storageRef, file, { contentType: 'application/pdf' })
  const url = await getDownloadURL(storageRef)
  return { name: file.name, path, url, size: file.size }
}

export async function deleteBenefitFile(path: string | undefined): Promise<void> {
  if (!path) return
  try {
    await deleteObject(ref(storage, path))
  } catch (e) {
    // Missing files are fine when cleaning up old/replaced attachments.
    if ((e as { code?: string }).code !== 'storage/object-not-found') throw e
  }
}
