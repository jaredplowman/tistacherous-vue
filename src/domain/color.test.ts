import { describe, expect, it } from 'vitest'
import { contrastRatio, isHexColor, kidPalette, readableText } from './color'

describe('color', () => {
  it('computes WCAG contrast', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0)
    expect(contrastRatio('#777777', '#777777')).toBe(1)
  })

  it('picks readable text', () => {
    expect(readableText('#ffffff')).toBe('#11111b')
    expect(readableText('#101030')).toBe('#ffffff')
    expect(readableText('#ff0000')).toBe('#ffffff')
    expect(readableText('#ffff00')).toBe('#11111b')
  })

  it('validates hex', () => {
    expect(isHexColor('#a1B2c3')).toBe(true)
    expect(isHexColor('red')).toBe(false)
    expect(isHexColor('')).toBe(false)
  })

  it('builds a palette, overriding illegible name colours', () => {
    expect(kidPalette('', '#ffffff')).toBeNull()
    expect(kidPalette('#ffffff', '#ffffff')?.name).toBe('#11111b')
    expect(kidPalette('#ffffff', '#990000')?.name).toBe('#990000')
    expect(kidPalette('#000000', undefined)).toEqual({ background: '#000000', text: '#ffffff', name: '#ffffff' })
  })
})
