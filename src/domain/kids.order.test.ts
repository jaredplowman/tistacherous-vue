import { describe, expect, it } from 'vitest'
import { moveKid, newKid, nextKidOrder } from './kids'
import type { KidProfile } from './types'

const kid = (id: string, sortOrder: number, name = id): KidProfile => ({ ...newKid(name, sortOrder), id })

describe('kid ordering', () => {
  const kids = [kid('a', 0), kid('b', 1), kid('c', 2)]

  it('puts a new kid after the last, even after one was removed', () => {
    expect(nextKidOrder(kids)).toBe(3)
    expect(nextKidOrder([kid('a', 0), kid('c', 4)])).toBe(5)
    expect(nextKidOrder([])).toBe(0)
  })

  it('swaps neighbours', () => {
    expect(moveKid(kids, 'a', 1)).toEqual([
      { id: 'b', sortOrder: 0 },
      { id: 'a', sortOrder: 1 },
    ])
  })

  it('does nothing at the ends', () => {
    expect(moveKid(kids, 'a', -1)).toEqual([])
    expect(moveKid(kids, 'c', 1)).toEqual([])
  })

  it('renumbers kids that share a position', () => {
    const tied = [kid('a', 0), kid('b', 0), kid('c', 0)]
    expect(moveKid(tied, 'c', -1)).toEqual([
      { id: 'c', sortOrder: 1 },
      { id: 'b', sortOrder: 2 },
    ])
  })
})
