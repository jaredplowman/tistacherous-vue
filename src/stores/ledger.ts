import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  deleteField,
  doc,
  getDocs,
  limit as limitTo,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  where,
  writeBatch,
  type Transaction,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { householdCollection, householdDoc } from '@/lib/firestore'
import { member } from '@/lib/auth'
import { roundMoney } from '@/domain/chores'
import { formatMoney } from '@/domain/kids'
import { addStrike, bustCollection, bustRefund, shortfallNote } from '@/domain/ledger'
import type { DailyChoreInstance, KidProfile, LedgerTransaction } from '@/domain/types'
import { errorMessage } from '@/lib/errors'

const PAGE_SIZE = 100

// -0 would print as "-$0.00"
const debit = (n: number) => (n ? -n : 0)

type Entry = Omit<LedgerTransaction, 'id' | 'timestamp' | 'by'>

// Every money-moving action is a transaction that re-reads the current balance, so two parents
// acting at once can't double-apply, and a balance can never be pushed below $0.
export const useLedgerStore = defineStore('ledger', () => {
  const entries = ref<LedgerTransaction[]>([])
  const pageLimit = ref(PAGE_SIZE)
  const loaded = ref(false)
  const error = ref('')

  let unsubscribe: Unsubscribe | undefined

  const hasMore = computed(() => entries.value.length >= pageLimit.value)

  function subscribe() {
    unsubscribe?.()
    unsubscribe = onSnapshot(
      query(householdCollection('ledger'), orderBy('timestamp', 'desc'), limitTo(pageLimit.value)),
      (snap) => {
        entries.value = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as LedgerTransaction)
        loaded.value = true
      },
      (e) => (error.value = errorMessage(e)),
    )
  }

  // The ledger only loads while its tab is open; ticking chores doesn't need it.
  function start() {
    pageLimit.value = PAGE_SIZE
    subscribe()
  }

  function stop() {
    unsubscribe?.()
    unsubscribe = undefined
    entries.value = []
    loaded.value = false
  }

  function loadMore() {
    pageLimit.value += PAGE_SIZE
    subscribe()
  }

  const author = () => member.value?.displayName

  function record(tx: Transaction, entry: Entry) {
    tx.set(doc(householdCollection('ledger')), {
      ...entry,
      timestamp: new Date().toISOString(),
      by: author(),
    })
  }

  async function perform(action: () => Promise<unknown>): Promise<boolean> {
    error.value = ''
    try {
      await action()
      return true
    } catch (e) {
      error.value = errorMessage(e)
      return false
    }
  }

  const readKid = async (tx: Transaction, kidId: string) => {
    const snap = await tx.get(householdDoc('kids', kidId))
    if (!snap.exists()) throw new Error('That kid no longer exists.')
    return snap.data() as KidProfile
  }

  const pass = (instance: DailyChoreInstance) =>
    perform(() =>
      runTransaction(db, async (tx) => {
        const ref = householdDoc('instances', instance.id)
        const current = (await tx.get(ref)).data() as DailyChoreInstance | undefined
        if (current?.status !== 'completed') throw new Error('That chore was changed on another device. It has been refreshed.')
        tx.update(ref, { status: 'verified', auditedAt: new Date().toISOString() })
      }),
    )

  // Verifying doesn't move money, so a whole queue can be passed in one batch.
  const passAll = (instances: DailyChoreInstance[]) =>
    perform(async () => {
      const batch = writeBatch(db)
      const auditedAt = new Date().toISOString()
      for (const i of instances) batch.update(householdDoc('instances', i.id), { status: 'verified', auditedAt })
      await batch.commit()
    })

  // Busted: the credit for the chore is taken back and the fine added (value x multiplier in total).
  const bust = (instance: DailyChoreInstance) =>
    perform(() =>
      runTransaction(db, async (tx) => {
        const ref = householdDoc('instances', instance.id)
        const current = (await tx.get(ref)).data() as DailyChoreInstance | undefined
        if (current?.status !== 'completed') throw new Error('That chore was changed on another device. It has been refreshed.')
        const kid = await tx.get(householdDoc('kids', current.kidId))

        if (!kid.exists()) {
          tx.update(ref, { status: 'busted', auditedAt: new Date().toISOString(), bustedAmount: 0 })
          return
        }

        const balance = (kid.data() as KidProfile).goal.currentSaved
        const collection = bustCollection(current, balance)
        tx.update(ref, { status: 'busted', auditedAt: new Date().toISOString(), bustedAmount: collection.applied })
        tx.update(kid.ref, { 'goal.currentSaved': roundMoney(balance - collection.applied) })
        record(tx, {
          kidId: current.kidId,
          amount: debit(collection.applied),
          reason: 'busted_penalty',
          referenceId: current.id,
          notes: shortfallNote(`Busted: ${current.title}`, collection, formatMoney),
        })
      }),
    )

  // Busts made before the amount was stored on the chore: find what was taken in the ledger.
  async function bustAmountFromLedger(instanceId: string): Promise<number | null> {
    const found = await getDocs(
      query(householdCollection('ledger'), where('referenceId', '==', instanceId), where('reason', '==', 'busted_penalty')),
    )
    const entry = found.docs[0]?.data() as LedgerTransaction | undefined
    return entry ? Math.abs(entry.amount) : null
  }

  // Undoing a bust gives back what it took and puts the chore back in the audit queue.
  const unbust = (instance: DailyChoreInstance) =>
    perform(async () => {
      const fromLedger = instance.bustedAmount === undefined ? await bustAmountFromLedger(instance.id) : null
      await runTransaction(db, async (tx) => {
        const ref = householdDoc('instances', instance.id)
        const current = (await tx.get(ref)).data() as DailyChoreInstance | undefined
        if (current?.status !== 'busted') throw new Error('That chore was changed on another device. It has been refreshed.')
        const kid = await tx.get(householdDoc('kids', current.kidId))

        tx.update(ref, {
          status: 'completed',
          auditedAt: deleteField(),
          auditNotes: deleteField(),
          bustedAmount: deleteField(),
        })
        if (!kid.exists()) return

        const refund = bustRefund(current, fromLedger)
        if (refund <= 0) return
        tx.update(kid.ref, { 'goal.currentSaved': roundMoney((kid.data() as KidProfile).goal.currentSaved + refund) })
        record(tx, {
          kidId: current.kidId,
          amount: refund,
          reason: 'bust_reverted',
          referenceId: current.id,
          notes: `Bust undone: ${current.title}`,
        })
      })
    })

  // Passed by mistake: no money moves, the chore just goes back to waiting for an audit.
  const reopenAudit = (instance: DailyChoreInstance) =>
    perform(() =>
      runTransaction(db, async (tx) => {
        const ref = householdDoc('instances', instance.id)
        const current = (await tx.get(ref)).data() as DailyChoreInstance | undefined
        if (current?.status !== 'verified') throw new Error('That chore was changed on another device. It has been refreshed.')
        tx.update(ref, { status: 'completed', auditedAt: deleteField(), auditNotes: deleteField() })
      }),
    )

  const strike = (kidId: string) =>
    perform(() =>
      runTransaction(db, async (tx) => {
        const kid = await readKid(tx, kidId)
        const balance = kid.goal.currentSaved
        const outcome = addStrike(kid.troubleMeter, balance)

        tx.update(householdDoc('kids', kidId), {
          'troubleMeter.currentStrikes': outcome.strikes,
          ...(outcome.triggered && { 'goal.currentSaved': roundMoney(balance - outcome.applied) }),
        })
        if (outcome.triggered) {
          record(tx, {
            kidId,
            amount: debit(outcome.applied),
            reason: 'strike_penalty',
            notes: shortfallNote(`${kid.troubleMeter.maxStrikes} strikes`, outcome, formatMoney),
          })
        }
      }),
    )

  const forgiveStrike = (kidId: string) =>
    perform(() =>
      runTransaction(db, async (tx) => {
        const kid = await readKid(tx, kidId)
        tx.update(householdDoc('kids', kidId), {
          'troubleMeter.currentStrikes': Math.max(0, kid.troubleMeter.currentStrikes - 1),
        })
      }),
    )

  // Cash handed over in person; the money leaves the kid's balance.
  const payout = (kidId: string, amount: number, notes = '') =>
    perform(() =>
      runTransaction(db, async (tx) => {
        const kid = await readKid(tx, kidId)
        const value = roundMoney(amount)
        if (!(value > 0)) throw new Error('Enter an amount greater than $0.')
        if (value > kid.goal.currentSaved) {
          throw new Error(`${kid.name} only has ${formatMoney(kid.goal.currentSaved)} to pay out.`)
        }
        tx.update(householdDoc('kids', kidId), { 'goal.currentSaved': roundMoney(kid.goal.currentSaved - value) })
        record(tx, { kidId, amount: -value, reason: 'payout', notes: notes || 'Cash payout' })
      }),
    )

  // A signed correction (+ or -) for fixing mistakes; the reason is required so the ledger explains itself.
  const adjust = (kidId: string, amount: number, notes: string) =>
    perform(() =>
      runTransaction(db, async (tx) => {
        const kid = await readKid(tx, kidId)
        const value = roundMoney(amount)
        if (!value) throw new Error('Enter an amount other than $0.')
        const next = roundMoney(kid.goal.currentSaved + value)
        if (next < 0) throw new Error(`That would take ${kid.name} below $0.`)
        tx.update(householdDoc('kids', kidId), { 'goal.currentSaved': next })
        record(tx, { kidId, amount: value, reason: 'manual_adjustment', notes })
      }),
    )

  return {
    entries,
    loaded,
    hasMore,
    error,
    start,
    stop,
    loadMore,
    pass,
    passAll,
    bust,
    unbust,
    reopenAudit,
    strike,
    forgiveStrike,
    payout,
    adjust,
  }
})
