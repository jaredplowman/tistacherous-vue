import { describe, expect, it } from 'vitest'
import { formatClock, goalProgress, newKid } from './kids'

describe('formatClock', () => {
  it('converts 24h times to 12h', () => {
    expect(formatClock('19:30')).toBe('7:30 PM')
    expect(formatClock('00:05')).toBe('12:05 AM')
    expect(formatClock('12:00')).toBe('12:00 PM')
  })
})

describe('goalProgress', () => {
  const goal = (currentSaved: number, targetAmount: number) => ({
    title: '',
    imageUrl: '',
    currentSaved,
    targetAmount,
  })

  it('returns the saved share of the target', () => {
    expect(goalProgress(goal(42.5, 60))).toBeCloseTo(70.83, 1)
  })

  it('caps at 100', () => {
    expect(goalProgress(goal(90, 60))).toBe(100)
  })

  it('is 0 when there is no target or the balance is negative', () => {
    expect(goalProgress(goal(10, 0))).toBe(0)
    expect(goalProgress(goal(-5, 60))).toBe(0)
  })
})

describe('newKid', () => {
  it('starts with a clean trouble meter and an empty goal', () => {
    const kid = newKid('Kid A', 2)
    expect(kid.sortOrder).toBe(2)
    expect(kid.troubleMeter.currentStrikes).toBe(0)
    expect(kid.goal.currentSaved).toBe(0)
  })
})
