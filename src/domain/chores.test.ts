import { describe, expect, it } from 'vitest'
import {
  computeStreak,
  describeSchedule,
  dayTotals,
  instanceId,
  missingInstances,
  newChore,
  screenStatus,
  visibleInstances,
} from './chores'
import type { ChoreDefinition, ChoreStatus, DailyChoreInstance } from './types'

const chore = (patch: Partial<ChoreDefinition> = {}): ChoreDefinition => ({
  ...newChore(),
  id: 'c1',
  title: 'Make bed',
  assignedKidIds: ['a'],
  ...patch,
})

const inst = (patch: Partial<DailyChoreInstance> = {}): DailyChoreInstance => ({
  id: 'x',
  choreDefinitionId: 'c1',
  kidId: 'a',
  date: '2026-11-11',
  title: 'Make bed',
  value: 1,
  isGatekeeper: false,
  penaltyMultiplier: 2,
  status: 'pending',
  ...patch,
})

// 2026-11-11 is a Wednesday
describe('missingInstances', () => {
  it('creates one instance per assigned kid on a scheduled day', () => {
    const result = missingInstances([chore({ assignedKidIds: ['a', 'b'] })], ['a', 'b'], new Set(), '2026-11-11')
    expect(result.map((i) => i.id)).toEqual([instanceId('2026-11-11', 'c1', 'a'), instanceId('2026-11-11', 'c1', 'b')])
    expect(result[0]).toMatchObject({ status: 'pending', title: 'Make bed', value: 0.5, penaltyMultiplier: 2 })
  })

  it('skips unscheduled days, inactive chores, unknown kids and existing instances', () => {
    const existing = new Set([instanceId('2026-11-11', 'c1', 'a')])
    expect(missingInstances([chore({ scheduleDays: [1, 5] })], ['a'], new Set(), '2026-11-11')).toEqual([])
    expect(missingInstances([chore({ active: false })], ['a'], new Set(), '2026-11-11')).toEqual([])
    expect(missingInstances([chore({ assignedKidIds: ['gone'] })], ['a'], new Set(), '2026-11-11')).toEqual([])
    expect(missingInstances([chore()], ['a'], existing, '2026-11-11')).toEqual([])
  })
})

describe('visibleInstances', () => {
  it('hides pending work for chores that were removed or unassigned', () => {
    const pending = inst()
    expect(visibleInstances([pending], [chore()], 'a')).toHaveLength(1)
    expect(visibleInstances([pending], [], 'a')).toHaveLength(0)
    expect(visibleInstances([pending], [chore({ active: false })], 'a')).toHaveLength(0)
    expect(visibleInstances([pending], [chore({ assignedKidIds: ['b'] })], 'a')).toHaveLength(0)
  })

  it('keeps completed work even when the chore is gone', () => {
    expect(visibleInstances([inst({ status: 'completed' })], [], 'a')).toHaveLength(1)
  })
})

describe('screenStatus', () => {
  it('has no gate when nothing is a gatekeeper', () => {
    expect(screenStatus([inst()]).state).toBe('none')
  })

  it('stays locked until every gatekeeper is done', () => {
    const gate = (title: string, status: ChoreStatus) => inst({ title, status, isGatekeeper: true })
    expect(screenStatus([gate('Reading', 'pending'), gate('Pets', 'completed')])).toEqual({
      state: 'locked',
      remaining: ['Reading'],
    })
    expect(screenStatus([gate('Reading', 'busted')]).state).toBe('locked')
    expect(screenStatus([gate('Reading', 'verified'), gate('Pets', 'completed')]).state).toBe('unlocked')
  })
})

describe('dayTotals', () => {
  it('sums earned and possible values without float drift', () => {
    const list = [inst({ value: 0.1, status: 'completed' }), inst({ value: 0.2, status: 'verified' }), inst({ value: 1.15 })]
    expect(dayTotals(list)).toEqual({ earned: 0.3, possible: 1.45 })
  })
})

describe('computeStreak', () => {
  const day = (date: string, status: ChoreStatus) => inst({ date, status })

  it('counts consecutive fully-done days including today', () => {
    const list = [day('2026-11-11', 'completed'), day('2026-11-10', 'verified'), day('2026-11-09', 'completed')]
    expect(computeStreak(list, '2026-11-11')).toBe(3)
  })

  it('does not break on a still-pending today', () => {
    const list = [day('2026-11-11', 'pending'), day('2026-11-10', 'completed'), day('2026-11-09', 'completed')]
    expect(computeStreak(list, '2026-11-11')).toBe(2)
  })

  it('stops at the first day with unfinished chores', () => {
    const list = [day('2026-11-10', 'completed'), day('2026-11-09', 'pending'), day('2026-11-08', 'completed')]
    expect(computeStreak(list, '2026-11-11')).toBe(1)
  })

  it('skips days with no chores scheduled', () => {
    const list = [day('2026-11-11', 'completed'), day('2026-11-09', 'completed')]
    expect(computeStreak(list, '2026-11-11')).toBe(2)
  })

  it('resets to zero when something is busted today', () => {
    const list = [day('2026-11-11', 'busted'), day('2026-11-10', 'completed')]
    expect(computeStreak(list, '2026-11-11')).toBe(0)
  })

  it('breaks on a busted past day', () => {
    const list = [day('2026-11-10', 'completed'), day('2026-11-09', 'busted'), day('2026-11-08', 'completed')]
    expect(computeStreak(list, '2026-11-11')).toBe(1)
  })

  it('needs every chore of the day done, not just one', () => {
    const list = [day('2026-11-10', 'completed'), { ...day('2026-11-10', 'pending'), id: 'y' }]
    expect(computeStreak(list, '2026-11-11')).toBe(0)
  })
})

describe('describeSchedule', () => {
  it('names the common patterns and lists the rest Monday first', () => {
    expect(describeSchedule([0, 1, 2, 3, 4, 5, 6])).toBe('Every day')
    expect(describeSchedule([5, 4, 3, 2, 1])).toBe('Weekdays')
    expect(describeSchedule([6, 0])).toBe('Weekends')
    expect(describeSchedule([5, 1, 3])).toBe('Mon, Wed, Fri')
    expect(describeSchedule([])).toBe('Never')
  })
})
