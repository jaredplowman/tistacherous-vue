import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { deleteDoc, deleteField, doc, getDoc, getDocs, collection, setDoc, updateDoc } from 'firebase/firestore'

const OWNER = 'owner@example.com'
const PARENT = 'parent@example.com'
const STRANGER = 'stranger@example.com'

let env: RulesTestEnvironment

const as = (email: string, verified = true) =>
  env.authenticatedContext(`uid-${email}`, { email, email_verified: verified }).firestore()

const path = (...segments: string[]) => ['households', 'main', ...segments] as [string, ...string[]]

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'rules-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  })
})

afterAll(async () => {
  await env.cleanup()
})

beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, ...path('members', OWNER)), { displayName: 'Owner', role: 'owner' })
    await setDoc(doc(db, ...path('members', PARENT)), { displayName: 'Parent', role: 'parent' })
  })
})

const seed = (collectionName: string, id: string, data: Record<string, unknown>) =>
  env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), ...path(collectionName, id)), data))

describe('access', () => {
  it('blocks signed-out visitors', async () => {
    const db = env.unauthenticatedContext().firestore()
    await assertFails(getDoc(doc(db, ...path('kids', 'k1'))))
    await assertFails(getDoc(doc(db, ...path())))
  })

  it('blocks signed-in people who are not members', async () => {
    const db = as(STRANGER)
    await assertFails(getDoc(doc(db, ...path('kids', 'k1'))))
    await assertFails(getDocs(collection(db, ...path('members'))))
    await assertFails(setDoc(doc(db, ...path('kids', 'k1')), { name: 'Sam' }))
  })

  it('blocks members whose email is not verified', async () => {
    await assertFails(getDoc(doc(as(OWNER, false), ...path('kids', 'k1'))))
  })

  it('lets a stranger check only their own membership', async () => {
    const db = as(STRANGER)
    await assertSucceeds(getDoc(doc(db, ...path('members', STRANGER))))
    await assertFails(getDoc(doc(db, ...path('members', OWNER))))
  })

  it('matches member documents regardless of email case', async () => {
    const db = env.authenticatedContext('uid-mixed', { email: 'Parent@Example.COM', email_verified: true }).firestore()
    await assertSucceeds(getDoc(doc(db, ...path('kids', 'k1'))))
  })

  it('lets members read and write kids', async () => {
    const db = as(PARENT)
    await assertSucceeds(setDoc(doc(db, ...path('kids', 'k1')), { name: 'Sam' }))
    await assertSucceeds(getDoc(doc(db, ...path('kids', 'k1'))))
  })
})

describe('members and household', () => {
  it('lets an owner add members', async () => {
    await assertSucceeds(setDoc(doc(as(OWNER), ...path('members', 'new@example.com')), { displayName: 'New', role: 'parent' }))
  })

  it('stops parents managing members or the household', async () => {
    const db = as(PARENT)
    await assertFails(setDoc(doc(db, ...path('members', 'new@example.com')), { displayName: 'New', role: 'parent' }))
    await assertFails(updateDoc(doc(db, ...path('members', PARENT)), { role: 'owner' }))
    await assertFails(setDoc(doc(db, ...path()), { name: 'Hacked' }))
  })

  it('lets an owner rename the household', async () => {
    await assertSucceeds(setDoc(doc(as(OWNER), ...path()), { name: 'Home' }, { merge: true }))
  })

  it('rejects unknown roles and extra fields', async () => {
    const db = as(OWNER)
    await assertFails(setDoc(doc(db, ...path('members', 'a@example.com')), { displayName: 'A', role: 'admin' }))
    await assertFails(setDoc(doc(db, ...path('members', 'a@example.com')), { displayName: 'A', role: 'parent', extra: 1 }))
  })

  it('stops an owner deleting themselves, but not others', async () => {
    const db = as(OWNER)
    await assertFails(deleteDoc(doc(db, ...path('members', OWNER))))
    await assertSucceeds(deleteDoc(doc(db, ...path('members', PARENT))))
  })
})

describe('ledger', () => {
  const entry = { kidId: 'k1', timestamp: '2026-11-11T10:00:00Z', amount: 2.5, reason: 'chore_completed' }

  it('lets members append entries', async () => {
    await assertSucceeds(setDoc(doc(as(PARENT), ...path('ledger', 'e1')), entry))
  })

  it('never lets an entry change or disappear', async () => {
    await seed('ledger', 'e1', entry)
    const db = as(OWNER)
    await assertFails(updateDoc(doc(db, ...path('ledger', 'e1')), { amount: 100 }))
    await assertFails(deleteDoc(doc(db, ...path('ledger', 'e1'))))
    await assertSucceeds(getDoc(doc(db, ...path('ledger', 'e1'))))
  })

  it('accepts a bust being undone', async () => {
    await assertSucceeds(setDoc(doc(as(PARENT), ...path('ledger', 'e9')), { ...entry, amount: 2, reason: 'bust_reverted' }))
  })

  it('rejects malformed entries', async () => {
    const db = as(PARENT)
    await assertFails(setDoc(doc(db, ...path('ledger', 'e2')), { ...entry, reason: 'gift' }))
    await assertFails(setDoc(doc(db, ...path('ledger', 'e3')), { ...entry, amount: '5' }))
    await assertFails(setDoc(doc(db, ...path('ledger', 'e4')), { ...entry, sneaky: true }))
    await assertFails(setDoc(doc(db, ...path('ledger', 'e5')), { kidId: 'k1', amount: 1, reason: 'payout' }))
  })
})

describe('chore instances', () => {
  const base = {
    choreDefinitionId: 'c1',
    kidId: 'k1',
    date: '2026-11-11',
    title: 'Dishes',
    value: 1,
    isGatekeeper: false,
    penaltyMultiplier: 2,
  }
  const at = (status: string, extra: Record<string, unknown> = {}) => ({ ...base, status, ...extra })
  const ref = (db: ReturnType<typeof as>) => doc(db, ...path('instances', 'i1'))

  it('only creates pending instances', async () => {
    const db = as(PARENT)
    await assertSucceeds(setDoc(ref(db), at('pending')))
    await assertFails(setDoc(doc(db, ...path('instances', 'i2')), at('verified')))
  })

  it('allows the check-off and undo', async () => {
    await seed('instances', 'i1', at('pending'))
    const db = as(PARENT)
    await assertSucceeds(updateDoc(ref(db), { status: 'completed', completedAt: '2026-11-11T10:00:00Z' }))
    await assertSucceeds(updateDoc(ref(db), { status: 'pending', completedAt: '2026-11-11T10:01:00Z' }))
  })

  it('allows an audit to pass or bust a completed chore', async () => {
    await seed('instances', 'i1', at('completed'))
    await assertSucceeds(updateDoc(ref(as(PARENT)), { status: 'busted', auditedAt: 'now', auditNotes: 'not done' }))
  })

  it('refuses to skip the audit', async () => {
    await seed('instances', 'i1', at('pending'))
    await assertFails(updateDoc(ref(as(PARENT)), { status: 'verified', auditedAt: 'now' }))
  })

  it('locks audited chores', async () => {
    await seed('instances', 'i1', at('busted'))
    const db = as(PARENT)
    await assertFails(updateDoc(ref(db), { status: 'verified', auditedAt: 'now' }))
    await assertFails(updateDoc(ref(db), { status: 'pending', completedAt: 'now' }))
  })

  it('records what a bust took', async () => {
    await seed('instances', 'i1', at('completed'))
    await assertSucceeds(updateDoc(ref(as(PARENT)), { status: 'busted', auditedAt: 'now', bustedAmount: 2 }))
  })

  it('lets a bust be undone, back to the audit queue', async () => {
    await seed('instances', 'i1', at('busted', { auditedAt: 'now', bustedAmount: 2 }))
    await assertSucceeds(
      updateDoc(ref(as(PARENT)), {
        status: 'completed',
        auditedAt: deleteField(),
        auditNotes: deleteField(),
        bustedAmount: deleteField(),
      }),
    )
  })

  it('lets a pass be reopened', async () => {
    await seed('instances', 'i1', at('verified', { auditedAt: 'now' }))
    await assertSucceeds(updateDoc(ref(as(PARENT)), { status: 'completed', auditedAt: deleteField() }))
  })

  it('does not let an undo change what the chore was worth', async () => {
    await seed('instances', 'i1', at('busted', { auditedAt: 'now' }))
    await assertFails(updateDoc(ref(as(PARENT)), { status: 'completed', auditedAt: deleteField(), value: 99 }))
  })

  it('refuses to rewrite what a chore was worth', async () => {
    await seed('instances', 'i1', at('completed'))
    await assertFails(updateDoc(ref(as(PARENT)), { status: 'verified', auditedAt: 'now', value: 50 }))
  })
})

describe('bills', () => {
  const bill = { title: 'Hydro', amount: 80, dueDate: '2026-11-20', isAutopay: false, status: 'unpaid' }

  it('accepts a valid bill', async () => {
    await assertSucceeds(setDoc(doc(as(PARENT), ...path('bills', 'b1')), bill))
    await assertSucceeds(setDoc(doc(as(PARENT), ...path('bills', 'b2')), { ...bill, category: 'utility', skipped: true }))
  })

  it.each([
    ['a negative amount', { amount: -1 }],
    ['an unknown status', { status: 'lost' }],
    ['a malformed date', { dueDate: 'tomorrow' }],
    ['an empty title', { title: '' }],
    ['an unknown category', { category: 'fun' }],
    ['an unknown field', { secret: 1 }],
  ])('rejects %s', async (_name, patch) => {
    await assertFails(setDoc(doc(as(PARENT), ...path('bills', 'bad')), { ...bill, ...patch }))
  })

  it('rejects a bill with a missing field', async () => {
    const { isAutopay: _omit, ...rest } = bill
    await assertFails(setDoc(doc(as(PARENT), ...path('bills', 'bad')), rest))
  })
})

describe('recurring bills', () => {
  const plan = { title: 'Rent', amount: 1500, dueDay: 1, isAutopay: true, category: 'housing', active: true }

  it('accepts a valid plan', async () => {
    await assertSucceeds(setDoc(doc(as(PARENT), ...path('recurringBills', 'r1')), plan))
  })

  it.each([
    ['day 0', { dueDay: 0 }],
    ['day 32', { dueDay: 32 }],
    ['a fractional day', { dueDay: 1.5 }],
    ['a negative amount', { amount: -5 }],
  ])('rejects %s', async (_name, patch) => {
    await assertFails(setDoc(doc(as(PARENT), ...path('recurringBills', 'bad')), { ...plan, ...patch }))
  })
})

describe('adult tasks', () => {
  const task = {
    title: 'Vacuum',
    tier: 'weekly',
    priority: 'P2',
    assignedTo: [PARENT],
    requiresBoth: false,
    active: true,
    isCompleted: false,
  }

  it('accepts valid tasks', async () => {
    const db = as(PARENT)
    await assertSucceeds(setDoc(doc(db, ...path('tasks', 't1')), task))
    await assertSucceeds(
      setDoc(doc(db, ...path('tasks', 't2')), { ...task, tier: 'short_term', targetDate: '2026-11-30', notes: 'soon' }),
    )
  })

  it.each([
    ['an unknown tier', { tier: 'daily' }],
    ['an unknown priority', { priority: 'P9' }],
    ['a target day of 7', { targetDay: 7 }],
    ['assignees that are not a list', { assignedTo: PARENT }],
    ['a malformed target date', { targetDate: 'soon' }],
    ['an unknown field', { secret: 1 }],
  ])('rejects %s', async (_name, patch) => {
    await assertFails(setDoc(doc(as(PARENT), ...path('tasks', 'bad')), { ...task, ...patch }))
  })

  it('accepts a weekly completion and rejects a malformed one', async () => {
    const db = as(PARENT)
    const completion = { taskId: 't1', weekStart: '2026-11-09', completedAt: '2026-11-11T10:00:00Z', completedBy: PARENT }
    await assertSucceeds(setDoc(doc(db, ...path('taskCompletions', '2026-11-09_t1')), completion))
    await assertFails(setDoc(doc(db, ...path('taskCompletions', 'bad')), { ...completion, weekStart: 'monday' }))
    await assertFails(setDoc(doc(db, ...path('taskCompletions', 'bad2')), { ...completion, extra: 1 }))
    await assertSucceeds(deleteDoc(doc(db, ...path('taskCompletions', '2026-11-09_t1'))))
  })
})
