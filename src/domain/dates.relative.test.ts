import { describe, expect, it } from 'vitest'
import { formatRelativeDay, canStepPrev, canStepNext, addDays } from './dates'

describe('relative dates', () => {
  const today = '2026-11-12'

  it('formats relative days correctly', () => {
    expect(formatRelativeDay(today, today)).toBe('Today')
    expect(formatRelativeDay(addDays(today, -1), today)).toBe('Yesterday')
    expect(formatRelativeDay('2026-11-01', today)).toBe('Sunday, Nov 1')
  })

  it('bounds navigation correctly', () => {
    const windowStart = addDays(today, -60)
    expect(canStepPrev(today, windowStart)).toBe(true)
    expect(canStepPrev(windowStart, windowStart)).toBe(false)
    expect(canStepNext(today, today)).toBe(false)
    expect(canStepNext(addDays(today, -1), today)).toBe(true)
  })
})
