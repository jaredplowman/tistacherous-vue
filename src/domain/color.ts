// WCAG 2.x contrast helpers for user-picked colours.

const HEX = /^#[0-9a-f]{6}$/i

export const isHexColor = (value: unknown): value is string => typeof value === 'string' && HEX.test(value)

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const channel = parseInt(hex.slice(i, i + 2), 16) / 255
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

const DARK_TEXT = '#11111b'
const LIGHT_TEXT = '#ffffff'

// Whichever of near-black / white reads better on the background.
export const readableText = (background: string): string =>
  contrastRatio(background, DARK_TEXT) >= contrastRatio(background, LIGHT_TEXT) ? DARK_TEXT : LIGHT_TEXT

export interface KidPalette {
  background: string
  text: string
  name: string
}

// Returns null when no valid background is set (use the default theme). A chosen name colour is
// kept only if it is legible (3:1, the WCAG bar for large text) on the background.
export function kidPalette(background: string | undefined, nameColor: string | undefined): KidPalette | null {
  if (!isHexColor(background)) return null
  const text = readableText(background)
  const name = isHexColor(nameColor) && contrastRatio(nameColor, background) >= 3 ? nameColor : text
  return { background, text, name }
}
