// Pictures are stored as text on the kid's record, which can't pass 1 MB in total and holds two
// pictures. Base64 adds a third, so each picture gets a budget well under half of that.
export const MAX_PICTURE_CHARS = 420_000
// Small files are saved exactly as they were uploaded.
export const KEEP_ORIGINAL_BYTES = 300_000
export const MAX_SIDE = 1600

// Scales to fit within `max` pixels on the longest side, never enlarging.
export function fitSize(width: number, height: number, max = MAX_SIDE): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

export const isImageFile = (type: string) => /^image\/(png|jpe?g|webp|gif|avif|bmp)$/.test(type)

export function isUsableImageUrl(value: string): boolean {
  if (!value) return true
  if (value.startsWith('data:image/')) return value.length <= MAX_PICTURE_CHARS
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}
