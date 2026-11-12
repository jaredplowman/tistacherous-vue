import { describe, expect, it } from 'vitest'
import {
  addStrike,
  bustCollection,
  bustRefund,
  clampDeduction,
  pendingAudit,
  pendingAuditTotal,
  recentlyAudited,
  shortfallNote,
} from './ledger'
import type { DailyChoreInstance } from './types'

const inst = (patch: Partial<DailyChoreInstance> = {}): DailyChoreInstance => ({
  id: 'x',
  choreDefinitionId: 'c1',
  kidId: 'a',
  date: '2026-11-11',
  title: 'Make bed',
  value: 1.5,
  isGatekeeper: false,
  penaltyMultiplier: 2,
  status: 'completed',
  completedAt: '2026-11-11T20:00:00.000Z',
  ...patch,
})

const meter = (currentStrikes: number, maxStrikes = 5, penaltyAmount = 10) => ({ currentStrikes, maxStrikes, penaltyAmount })

describe('clampDeduction', () => {
  it('takes the full amount when the balance covers it', () => {
    expect(clampDeduction(20, 10)).toBe(10)
  })

  it('never takes more than the balance', () => {
    expect(clampDeduction(4.25, 10)).toBe(4.25)
    expect(clampDeduction(0, 10)).toBe(0)
    expect(clampDeduction(-3, 10)).toBe(0)
  })
})

describe('bustCollection', () => {
  it('charges value x multiplier', () => {
    expect(bustCollection(inst(), 20)).toEqual({ owed: 3, applied: 3 })
  })

  it('collects only what the balance holds', () => {
    expect(bustCollection(inst(), 1)).toEqual({ owed: 3, applied: 1 })
  })

  it('uses the multiplier copied onto the instance', () => {
    expect(bustCollection(inst({ penaltyMultiplier: 1 }), 20).owed).toBe(1.5)
  })
})

describe('addStrike', () => {
  it('just counts a strike below the limit', () => {
    expect(addStrike(meter(2), 50)).toEqual({ strikes: 3, triggered: false, owed: 0, applied: 0 })
  })

  it('takes the penalty and resets when the meter fills', () => {
    expect(addStrike(meter(4), 50)).toEqual({ strikes: 0, triggered: true, owed: 10, applied: 10 })
  })

  it('clamps the penalty at the balance', () => {
    expect(addStrike(meter(4), 3.5)).toEqual({ strikes: 0, triggered: true, owed: 10, applied: 3.5 })
    expect(addStrike(meter(4), 0).applied).toBe(0)
  })

  it('still triggers if the limit was lowered below the current count', () => {
    expect(addStrike(meter(4, 3), 50).triggered).toBe(true)
  })
})

describe('pendingAudit', () => {
  const kids = new Set(['a', 'b'])

  it('lists only completed chores for known kids, newest first', () => {
    const queue = pendingAudit(
      [
        inst({ id: '1', completedAt: '2026-11-11T09:00:00.000Z' }),
        inst({ id: '2', completedAt: '2026-11-11T18:00:00.000Z' }),
        inst({ id: '3', status: 'verified' }),
        inst({ id: '4', status: 'pending' }),
        inst({ id: '5', status: 'busted' }),
        inst({ id: '6', kidId: 'gone' }),
      ],
      kids,
    )
    expect(queue.map((i) => i.id)).toEqual(['2', '1'])
  })

  it('totals the pending value for one kid', () => {
    const queue = [inst({ id: '1', value: 1.1 }), inst({ id: '2', value: 2.2 }), inst({ id: '3', kidId: 'b', value: 5 })]
    expect(pendingAuditTotal(queue, 'a')).toBe(3.3)
  })
})

describe('shortfallNote', () => {
  const money = (n: number) => `$${n.toFixed(2)}`

  it('leaves the note alone when fully collected', () => {
    expect(shortfallNote('Busted: Make bed', { owed: 3, applied: 3 }, money)).toBe('Busted: Make bed')
  })

  it('explains a partial collection', () => {
    expect(shortfallNote('Busted: Make bed', { owed: 3, applied: 1 }, money)).toBe(
      'Busted: Make bed (balance covered $1.00 of $3.00)',
    )
  })
})

describe('bustRefund', () => {
  it('gives back the amount the bust actually took', () => {
    expect(bustRefund(inst({ status: 'busted', bustedAmount: 2.25 }), null)).toBe(2.25)
    expect(bustRefund(inst({ status: 'busted', bustedAmount: 0 }), null)).toBe(0)
  })

  it('falls back to the ledger entry for older busts', () => {
    expect(bustRefund(inst({ status: 'busted' }), 1.1)).toBe(1.1)
  })

  it('assumes the full fine when nothing was recorded', () => {
    expect(bustRefund(inst({ status: 'busted' }), null)).toBe(3)
  })
})

describe('recentlyAudited', () => {
  const kids = new Set(['a'])
  const list = [
    inst({ id: '1', status: 'verified', date: '2026-11-10', auditedAt: '2026-11-10T21:00:00Z' }),
    inst({ id: '2', status: 'busted', date: '2026-11-11', auditedAt: '2026-11-11T09:00:00Z' }),
    inst({ id: '3', status: 'busted', date: '2026-10-01', auditedAt: '2026-10-01T09:00:00Z' }),
    inst({ id: '4', status: 'completed', date: '2026-11-11' }),
    inst({ id: '5', status: 'verified', date: '2026-11-11', kidId: 'gone', auditedAt: '2026-11-11T10:00:00Z' }),
  ]

  it('keeps recent verified and busted chores of current kids, newest first', () => {
    expect(recentlyAudited(list, kids, '2026-11-11').map((i) => i.id)).toEqual(['2', '1'])
  })
})
