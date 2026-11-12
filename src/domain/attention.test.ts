import { describe, expect, it } from 'vitest'
import { attentionItems, type AttentionInput } from './attention'

const none: AttentionInput = { audits: 0, billsOverdue: 0, billsSoon: 0, billsInTransit: 0, tasksLate: 0, tasksToday: 0 }

describe('attentionItems', () => {
  it('is empty when nothing needs anyone', () => {
    expect(attentionItems(none)).toEqual([])
  })

  it('links each item to where it can be dealt with', () => {
    const items = attentionItems({ ...none, audits: 2, tasksToday: 1 })
    expect(items.map((i) => [i.key, i.to])).toEqual([
      ['audits', '/kids?tab=audits'],
      ['tasks-today', '/tasks'],
    ])
  })

  it('puts urgent items first', () => {
    const items = attentionItems({ audits: 1, billsOverdue: 1, billsSoon: 1, billsInTransit: 1, tasksLate: 1, tasksToday: 1 })
    expect(items.map((i) => i.tone)).toEqual(['bad', 'bad', 'warn', 'warn', 'warn', 'info'])
    expect(items[0].key).toBe('bills-overdue')
  })

  it('words singular and plural counts', () => {
    expect(attentionItems({ ...none, billsOverdue: 1 })[0].text).toBe('1 bill is overdue')
    expect(attentionItems({ ...none, billsOverdue: 3 })[0].text).toBe('3 bills are overdue')
    expect(attentionItems({ ...none, audits: 1 })[0].text).toBe('1 chore waiting for audit')
    expect(attentionItems({ ...none, tasksLate: 2 })[0].text).toBe('2 tasks of yours are late')
  })
})
