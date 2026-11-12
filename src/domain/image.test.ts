import { describe, expect, it } from 'vitest'
import { MAX_PICTURE_CHARS, fitSize, isImageFile, isUsableImageUrl } from './image'

describe('fitSize', () => {
  it('leaves small pictures alone', () => {
    expect(fitSize(800, 600)).toEqual({ width: 800, height: 600 })
  })

  it('scales the longest side down and keeps the shape', () => {
    expect(fitSize(4000, 3000)).toEqual({ width: 1600, height: 1200 })
    expect(fitSize(3000, 4000)).toEqual({ width: 1200, height: 1600 })
  })

  it('never goes below one pixel', () => {
    expect(fitSize(100000, 1)).toEqual({ width: 1600, height: 1 })
  })
})

describe('isImageFile', () => {
  it('accepts common picture types', () => {
    for (const type of ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']) {
      expect(isImageFile(type)).toBe(true)
    }
  })

  it('rejects everything else', () => {
    for (const type of ['', 'text/html', 'application/pdf', 'image/svg+xml']) {
      expect(isImageFile(type)).toBe(false)
    }
  })
})

describe('isUsableImageUrl', () => {
  it('accepts empty, web and stored pictures', () => {
    expect(isUsableImageUrl('')).toBe(true)
    expect(isUsableImageUrl('https://example.com/a.png')).toBe(true)
    expect(isUsableImageUrl('data:image/png;base64,AAAA')).toBe(true)
  })

  it('rejects pictures too large to store', () => {
    expect(isUsableImageUrl(`data:image/png;base64,${'A'.repeat(MAX_PICTURE_CHARS)}`)).toBe(false)
  })

  it('rejects anything else', () => {
    expect(isUsableImageUrl('javascript:alert(1)')).toBe(false)
    expect(isUsableImageUrl('not a url')).toBe(false)
  })
})
