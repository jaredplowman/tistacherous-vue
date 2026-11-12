import { describe, expect, it } from 'vitest'
import { moveChore, newChore, nextSortOrder, sortChores, sortInstances } from './chores'
import type { ChoreDefinition, DailyChoreInstance } from './types'

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

describe('chore ordering', () => {
  const list = [
    chore({ id: 'c', title: 'Table', sortOrder: 2 }),
    chore({ id: 'a', title: 'Dishes', sortOrder: 0 }),
    chore({ id: 'b', title: 'Bed', sortOrder: 1 }),
  ]

  it('sorts by position', () => {
    expect(sortChores(list).map((c) => c.id)).toEqual(['a', 'b', 'c'])
  })

  it('puts chores without a position last, by name', () => {
    const mixed = [chore({ id: 'z', title: 'Zebra' }), chore({ id: 'n', title: 'Apple' }), chore({ id: 'p', sortOrder: 5 })]
    expect(sortChores(mixed).map((c) => c.id)).toEqual(['p', 'n', 'z'])
  })

  it('gives the next new chore the last position', () => {
    expect(nextSortOrder(list)).toBe(3)
    expect(nextSortOrder([])).toBe(0)
  })

  it('swaps two neighbours and only reports what changed', () => {
    expect(moveChore(list, 'b', -1)).toEqual([
      { id: 'b', sortOrder: 0 },
      { id: 'a', sortOrder: 1 },
    ])
    expect(moveChore(list, 'b', 1)).toEqual([
      { id: 'c', sortOrder: 1 },
      { id: 'b', sortOrder: 2 },
    ])
  })

  it('does nothing at either end or for an unknown chore', () => {
    expect(moveChore(list, 'a', -1)).toEqual([])
    expect(moveChore(list, 'c', 1)).toEqual([])
    expect(moveChore(list, 'nope', 1)).toEqual([])
  })

  it('numbers chores that had no position yet', () => {
    const fresh = [chore({ id: 'x', title: 'Apple' }), chore({ id: 'y', title: 'Berry' }), chore({ id: 'w', title: 'Cherry' })]
    expect(moveChore(fresh, 'w', -1)).toEqual([
      { id: 'x', sortOrder: 0 },
      { id: 'w', sortOrder: 1 },
      { id: 'y', sortOrder: 2 },
    ])
  })

  it("orders a kid's chores the same way", () => {
    const today = [
      inst({ id: '1', choreDefinitionId: 'c', title: 'Table' }),
      inst({ id: '2', choreDefinitionId: 'a', title: 'Dishes' }),
      inst({ id: '3', choreDefinitionId: 'deleted', title: 'Old' }),
      inst({ id: '4', choreDefinitionId: 'b', title: 'Bed' }),
    ]
    expect(sortInstances(today, list).map((i) => i.id)).toEqual(['2', '4', '1', '3'])
  })
})
