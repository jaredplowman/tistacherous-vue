import { KEEP_ORIGINAL_BYTES, MAX_PICTURE_CHARS, MAX_SIDE, fitSize, isImageFile } from '@/domain/image'

const readAsDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error("Couldn't read that file."))
    reader.readAsDataURL(blob)
  })

// Each step trades a little quality, then size, until the picture fits the record.
const ATTEMPTS = [
  { side: MAX_SIDE, quality: 0.85 },
  { side: MAX_SIDE, quality: 0.7 },
  { side: 1200, quality: 0.7 },
  { side: 900, quality: 0.6 },
  { side: 640, quality: 0.6 },
]

// Small pictures are saved exactly as uploaded. Big ones are re-saved at a high quality, scaled so the
// longest side is at most 1600 px, with no crop and no shape. Transparency is kept.
export async function preparePicture(file: File): Promise<string> {
  if (!isImageFile(file.type)) throw new Error('Choose a picture file (PNG, JPEG, WebP or GIF).')

  if (file.size <= KEEP_ORIGINAL_BYTES) {
    const original = await readAsDataUrl(file)
    if (original.length <= MAX_PICTURE_CHARS) return original
  }

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new Error("Couldn't open that picture. Try a different file.")
  }

  try {
    for (const { side, quality } of ATTEMPTS) {
      const { width, height } = fitSize(bitmap.width, bitmap.height, side)
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error("This browser can't process pictures.")
      ctx.drawImage(bitmap, 0, 0, width, height)

      let url = canvas.toDataURL('image/webp', quality)
      if (!url.startsWith('data:image/webp')) url = canvas.toDataURL('image/jpeg', quality)
      if (url.length <= MAX_PICTURE_CHARS) return url
    }
  } finally {
    bitmap.close()
  }

  throw new Error('That picture is too large to save. Try a smaller one.')
}
