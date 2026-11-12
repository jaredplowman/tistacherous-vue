import { describe, expect, it } from 'vitest'
import {
  assigneeLabel,
  assignees,
  completionId,
  dueDateOf,
  dueNow,
  filterStates,
  groupStates,
  nameOf,
  sortStates,
  summarize,
  targetLabel,
  taskState,
  weekStartOf,
} from './tasks'
import type { AdultTask, Member } from './types'

const WEEK = '2026-11-09' // a Monday
const TODAY = '2026-11-11' // the Wednesday

const task = (patch: Partial<AdultTask> = {}): AdultTask => ({
  id: 't',
  title: 'Wheel bins to curb',
  tier: 'weekly',
  priority: 'P2',
  assignedTo: ['jared@x.com'],
  requiresBoth: false,
  targetDay: 4,
  active: true,
  isCompleted: false,
  ...patch,
})

const members: Member[] = [
  { email: 'jared@x.com', displayName: 'Jared', role: 'owner' },
  { email: 'sam@x.com', displayName: 'Sam', role: 'parent' },
]

const state = (t: AdultTask, done: string[] = []) => taskState(t, WEEK, TODAY, new Set(done))

describe('weeks', () => {
  it('starts the week on Monday', () => {
    expect(weekStartOf('2026-11-09')).toBe('2026-11-09')
    expect(weekStartOf('2026-11-11')).toBe('2026-11-09')
    expect(weekStartOf('2026-11-15')).toBe('2026-11-09') // Sunday belongs to the week before
    expect(weekStartOf('2026-11-16')).toBe('2026-11-16')
  })

  it('crosses month and year ends', () => {
    expect(weekStartOf('2027-01-01')).toBe('2026-12-28')
  })

  it('builds a per-week completion id', () => {
    expect(completionId(WEEK, 'abc')).toBe('2026-11-09_abc')
  })
})

describe('dueDateOf', () => {
  it('puts a weekly routine on its day of this week', () => {
    expect(dueDateOf(task({ targetDay: 1 }), WEEK)).toBe('2026-11-09')
    expect(dueDateOf(task({ targetDay: 4 }), WEEK)).toBe('2026-11-12')
    expect(dueDateOf(task({ targetDay: 0 }), WEEK)).toBe('2026-11-15')
  })

  it('uses the date of a one-off task', () => {
    expect(dueDateOf(task({ tier: 'short_term', targetDate: '2026-11-14' }), WEEK)).toBe('2026-11-14')
    expect(dueDateOf(task({ tier: 'long_term' }), WEEK)).toBeUndefined()
  })
})

describe('targetLabel', () => {
  it('names the weekday and time for a routine', () => {
    expect(targetLabel(task({ targetDay: 4, targetTime: 'Night' }))).toBe('Thu Night')
    expect(targetLabel(task({ targetDay: 0 }))).toBe('Sun')
  })

  it('formats a short-term date and falls back for a missing one', () => {
    expect(targetLabel(task({ tier: 'short_term', targetDate: '2026-11-14' }))).toBe('Sat, Nov 14')
    expect(targetLabel(task({ tier: 'short_term' }))).toBe('No date')
  })

  it('shows the written window for a project', () => {
    expect(targetLabel(task({ tier: 'long_term', targetDisplay: 'Spring 2027' }))).toBe('Spring 2027')
    expect(targetLabel(task({ tier: 'long_term', targetDate: '2026-12-01' }))).toBe('Dec 1')
    expect(targetLabel(task({ tier: 'long_term' }))).toBe('Someday')
  })
})

describe('taskState', () => {
  it('counts a routine as done only for weeks it was completed', () => {
    expect(state(task()).done).toBe(false)
    expect(state(task({ id: 'a' }), ['a']).done).toBe(true)
    // the next week has its own (empty) set of completions
    expect(taskState(task({ id: 'a' }), '2026-11-16', '2026-11-16', new Set()).done).toBe(false)
  })

  it('ignores the one-off flag on a weekly routine', () => {
    expect(state(task({ isCompleted: true })).done).toBe(false)
  })

  it('reads a one-off from its own flag', () => {
    expect(state(task({ tier: 'short_term', isCompleted: true })).done).toBe(true)
  })

  it('is overdue once the day has passed and it is not done', () => {
    expect(state(task({ targetDay: 1 })).overdue).toBe(true) // Monday
    expect(state(task({ targetDay: 3 })).overdue).toBe(false) // today
    expect(state(task({ id: 'a', targetDay: 1 }), ['a']).overdue).toBe(false)
    expect(state(task({ tier: 'short_term', targetDate: '2026-11-10' })).overdue).toBe(true)
    expect(state(task({ tier: 'long_term' })).overdue).toBe(false)
  })
})

describe('dueNow', () => {
  const states = [
    state(task({ id: 'late', targetDay: 1 })),
    state(task({ id: 'today', targetDay: 3 })),
    state(task({ id: 'later', targetDay: 5 })),
    state(task({ id: 'done', targetDay: 1 }), ['done']),
    state(task({ id: 'paused', targetDay: 1, active: false })),
    state(task({ id: 'sams', targetDay: 1, assignedTo: ['sam@x.com'] })),
  ]
  const ids = (list: { task: AdultTask }[]) => list.map((s) => s.task.id)

  it('lists late and due-today tasks that are still open', () => {
    expect(ids(dueNow(states, TODAY))).toEqual(['late', 'today', 'sams'])
  })

  it('narrows to one person', () => {
    expect(ids(dueNow(states, TODAY, 'jared@x.com'))).toEqual(['late', 'today'])
    expect(ids(dueNow(states, TODAY, 'sam@x.com'))).toEqual(['sams'])
  })

  it('counts a task nobody owns for everyone', () => {
    const open = [state(task({ id: 'any', assignedTo: [], targetDay: 1 }))]
    expect(ids(dueNow(open, TODAY, 'sam@x.com'))).toEqual(['any'])
  })
})

describe('sortStates', () => {
  it('orders by priority, then date, then name, with undated last', () => {
    const list = [
      state(task({ id: 'c', title: 'C', priority: 'P2', targetDay: 6 })),
      state(task({ id: 'b', title: 'B', priority: 'P2', targetDay: 2 })),
      state(task({ id: 'n', title: 'N', priority: 'P2', tier: 'long_term', targetDay: undefined })),
      state(task({ id: 'a', title: 'A', priority: 'P1', targetDay: 6 })),
      state(task({ id: 'z', title: 'Z', priority: 'P3', targetDay: 1 })),
    ]
    expect(sortStates(list).map((s) => s.task.id)).toEqual(['a', 'b', 'c', 'n', 'z'])
  })
})

describe('filterStates', () => {
  const list = [
    state(task({ id: 'j', assignedTo: ['jared@x.com'] })),
    state(task({ id: 's', assignedTo: ['sam@x.com'] })),
    state(task({ id: 'b', assignedTo: ['jared@x.com', 'sam@x.com'], requiresBoth: true })),
  ]
  const ids = (f: string) => filterStates(list, f).map((s) => s.task.id)

  it('filters by person, including shared tasks', () => {
    expect(ids('all')).toEqual(['j', 's', 'b'])
    expect(ids('jared@x.com')).toEqual(['j', 'b'])
    expect(ids('sam@x.com')).toEqual(['s', 'b'])
  })

  it('filters to two-person tasks', () => {
    expect(ids('both')).toEqual(['b'])
  })
})

describe('groupStates and summarize', () => {
  const states = [
    state(task({ id: 'w1' })),
    state(task({ id: 'w2', requiresBoth: true })),
    state(task({ id: 'wp', active: false })),
    state(task({ id: 's1', tier: 'short_term', targetDate: '2026-11-14' })),
    state(task({ id: 'sd', tier: 'short_term', isCompleted: true, completedAt: '2026-11-10T10:00:00Z' })),
    state(task({ id: 'l1', tier: 'long_term', requiresBoth: true })),
    state(task({ id: 'ld', tier: 'long_term', isCompleted: true, completedAt: '2026-11-11T10:00:00Z' })),
  ]
  const groups = groupStates(states)
  const ids = (list: { task: AdultTask }[]) => list.map((s) => s.task.id).sort()

  it('separates tiers, paused routines and finished work', () => {
    expect(ids(groups.weekly)).toEqual(['w1', 'w2'])
    expect(ids(groups.paused)).toEqual(['wp'])
    expect(ids(groups.shortTerm)).toEqual(['s1'])
    expect(ids(groups.longTerm)).toEqual(['l1'])
  })

  it('lists finished work newest first', () => {
    expect(groups.completed.map((s) => s.task.id)).toEqual(['ld', 'sd'])
  })

  it('keeps a completed weekly routine in the weekly list', () => {
    const done = groupStates([state(task({ id: 'w' }), ['w'])])
    expect(done.weekly.map((s) => s.task.id)).toEqual(['w'])
    expect(done.completed).toEqual([])
  })

  it('counts open work and the tasks that need both people', () => {
    expect(summarize(groups)).toEqual({ weekly: 2, shortTerm: 1, longTerm: 1, both: 2 })
  })
})

describe('people', () => {
  it('looks up a display name and falls back to the email name', () => {
    expect(nameOf('sam@x.com', members)).toBe('Sam')
    expect(nameOf('gone@x.com', members)).toBe('gone')
  })

  it('labels the assignee', () => {
    expect(assigneeLabel(task(), members)).toBe('Jared')
    expect(assigneeLabel(task({ assignedTo: ['jared@x.com', 'sam@x.com'] }), members)).toBe('Jared, Sam')
    expect(assigneeLabel(task({ requiresBoth: true }), members)).toBe('Both')
    expect(assigneeLabel(task({ assignedTo: [] }), members)).toBe('Anyone')
  })

  it('assigns a both-people task to everyone', () => {
    expect(assignees(true, ['jared@x.com'], ['jared@x.com', 'sam@x.com'])).toEqual(['jared@x.com', 'sam@x.com'])
    expect(assignees(false, ['sam@x.com'], ['jared@x.com', 'sam@x.com'])).toEqual(['sam@x.com'])
  })
})
