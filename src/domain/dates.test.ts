import { describe, expect, it } from 'vitest'
import { addDays, dateKey, weekdayOf } from './dates'

describe('dateKey', () => {
  it('uses the household timezone, not the device timezone', () => {
    const instant = new Date('2026-11-12T03:30:00Z')
    expect(dateKey(instant, 'America/Vancouver')).toBe('2026-11-11')
    expect(dateKey(instant, 'Asia/Tokyo')).toBe('2026-11-12')
  })

  it('falls back instead of throwing on a bad zone', () => {
    expect(dateKey(new Date('2026-06-15T12:00:00Z'), 'Not/AZone')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('weekdayOf', () => {
  it('returns 0 for Sunday through 6 for Saturday', () => {
    expect(weekdayOf('2026-11-08')).toBe(0)
    expect(weekdayOf('2026-11-11')).toBe(3)
    expect(weekdayOf('2026-11-14')).toBe(6)
  })
})

describe('addDays', () => {
  it('crosses month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })
})
