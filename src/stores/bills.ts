import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import {
  addDoc,
  deleteDoc,
  deleteField,
  onSnapshot,
  query,
  runTransaction,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { householdCollection, householdDoc } from '@/lib/firestore'
import { errorMessage } from '@/lib/errors'
import {
  MONTHS_AHEAD,
  addMonths,
  autopayDue,
  billsForMonth,
  billsInTransit,
  billsSoon,
  confirmCleared as clearedChange,
  markPaid,
  markPending,
  missingBills,
  monthEnd,
  monthOf,
  monthStart,
  planUpdates,
  reopen as reopenChange,
  settlementForAutopay,
  type BillChange,
  type BillFields,
  type PaymentInput,
} from '@/domain/bills'
import type { BillItem, BillStatus, RecurringBill } from '@/domain/types'
import { useChoresStore } from './chores'

export const useBillsStore = defineStore('bills', () => {
  // The chores store already keeps the household-timezone clock, so bills share it.
  const chores = useChoresStore()

  const plans = ref<RecurringBill[]>([])
  const ahead = ref<BillItem[]>([]) // this month onward: what gets generated and shown by default
  const outstanding = ref<BillItem[]>([]) // anything unpaid or pending, however old
  const past = ref<BillItem[]>([]) // the month being browsed, when it is before this one
  const viewMonth = ref('')
  const error = ref('')
  const started = ref(false)
  const plansLoaded = ref(false)
  // True once a listener has heard from the server. Generating from a stale local cache could
  // recreate a bill that was already paid or skipped on another device.
  const aheadSynced = ref(false)
  const outstandingSynced = ref(false)

  let unsubPlans: Unsubscribe | undefined
  let unsubAhead: Unsubscribe | undefined
  let unsubOutstanding: Unsubscribe | undefined
  let unsubPast: Unsubscribe | undefined
  let working = false

  const today = computed(() => chores.today)
  const currentMonth = computed(() => monthOf(today.value))
  const month = computed(() => viewMonth.value || currentMonth.value)

  const onError = (e: Error) => (error.value = errorMessage(e))
  const read = (docs: { id: string; data(): unknown }[]) => docs.map((d) => ({ ...(d.data() as object), id: d.id }) as BillItem)

  const all = computed(() => {
    const byId = new Map<string, BillItem>()
    for (const list of [past.value, ahead.value, outstanding.value]) for (const bill of list) byId.set(bill.id, bill)
    return [...byId.values()]
  })

  // Everything the tracker shows for the month being viewed.
  const monthBills = computed(() => billsForMonth(all.value, month.value))

  const sortedPlans = computed(() => [...plans.value].sort((a, b) => a.title.localeCompare(b.title)))

  // Unpaid and due this month or earlier: the number that belongs on a badge.
  const dueNow = computed(() =>
    all.value.filter((b) => !b.skipped && b.status === 'unpaid' && monthOf(b.dueDate) <= currentMonth.value),
  )

  // Overdue or due within the week, and payments waiting to clear: the Today widget.
  const soon = computed(() => billsSoon(all.value, today.value))
  const inTransit = computed(() => billsInTransit(all.value))
  // Autopay bills settle themselves, so only the manual ones ask anyone to do something.
  const toPay = computed(() => soon.value.filter((b) => !b.isAutopay))

  function subscribeAhead() {
    unsubAhead?.()
    aheadSynced.value = false
    unsubAhead = onSnapshot(
      query(householdCollection('bills'), where('dueDate', '>=', monthStart(currentMonth.value))),
      { includeMetadataChanges: true },
      (snap) => {
        ahead.value = read(snap.docs)
        aheadSynced.value = !snap.metadata.fromCache
      },
      onError,
    )
  }

  function subscribePast() {
    unsubPast?.()
    unsubPast = undefined
    past.value = []
    if (!started.value || month.value >= currentMonth.value) return
    unsubPast = onSnapshot(
      query(
        householdCollection('bills'),
        where('dueDate', '>=', monthStart(month.value)),
        where('dueDate', '<=', monthEnd(month.value)),
      ),
      (snap) => (past.value = read(snap.docs)),
      onError,
    )
  }

  function start() {
    if (started.value) return
    started.value = true
    unsubPlans = onSnapshot(
      householdCollection('recurringBills'),
      (snap) => {
        plans.value = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as RecurringBill)
        plansLoaded.value = true
      },
      onError,
    )
    subscribeAhead()
    unsubOutstanding = onSnapshot(
      query(householdCollection('bills'), where('status', 'in', ['unpaid', 'pending'])),
      { includeMetadataChanges: true },
      (snap) => {
        outstanding.value = read(snap.docs)
        outstandingSynced.value = !snap.metadata.fromCache
      },
      onError,
    )
    subscribePast()
  }

  function stop() {
    started.value = false
    unsubPlans?.()
    unsubAhead?.()
    unsubOutstanding?.()
    unsubPast?.()
    unsubPlans = unsubAhead = unsubOutstanding = unsubPast = undefined
    plans.value = []
    ahead.value = []
    outstanding.value = []
    past.value = []
    plansLoaded.value = false
    aheadSynced.value = false
    outstandingSynced.value = false
    viewMonth.value = ''
  }

  function showMonth(next: string) {
    viewMonth.value = next
  }

  watch(month, subscribePast)
  // The window slides forward when the month rolls over.
  watch(currentMonth, () => {
    if (!started.value) return
    subscribeAhead()
    subscribePast()
  })

  // No Cloud Functions: whichever device opens the app first creates this month's (and next
  // month's) recurring bills, and settles autopay bills that have come due.
  async function maintain() {
    if (!started.value || !plansLoaded.value || !aheadSynced.value || !outstandingSynced.value || working) return

    const months = Array.from({ length: MONTHS_AHEAD + 1 }, (_, n) => addMonths(currentMonth.value, n))
    const missing = missingBills(plans.value, new Set(all.value.map((b) => b.id)), months)
    const settling = autopayDue(all.value, today.value)
    if (!missing.length && !settling.length) return

    working = true
    try {
      const batch = writeBatch(db)
      for (const { id, ...data } of missing) batch.set(householdDoc('bills', id), data)
      for (const bill of settling) {
        batch.update(householdDoc('bills', bill.id), {
          status: 'settled',
          paymentDetails: settlementForAutopay(bill),
        })
      }
      await batch.commit()
    } catch (e) {
      error.value = errorMessage(e)
    } finally {
      working = false
    }
  }

  watch([plans, ahead, outstanding, aheadSynced, outstandingSynced, started, today], maintain)

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

  // Each step re-reads the bill and checks it is still where this device thinks it is, so two
  // people acting on the same bill can't overwrite each other.
  const move = (bill: BillItem, from: BillStatus[], change: BillChange) =>
    perform(() =>
      runTransaction(db, async (tx) => {
        const ref = householdDoc('bills', bill.id)
        const snap = await tx.get(ref)
        if (!snap.exists()) throw new Error('That bill no longer exists.')
        if (!from.includes((snap.data() as BillItem).status)) {
          throw new Error('That bill was changed on another device. It has been refreshed.')
        }
        tx.update(ref, {
          status: change.status,
          paymentDetails: change.paymentDetails ?? deleteField(),
          ...(change.isAutopay !== undefined && { isAutopay: change.isAutopay }),
        })
      }),
    )

  const pay = (bill: BillItem, input: PaymentInput) => move(bill, ['unpaid'], markPaid(input))
  const sendPayment = (bill: BillItem, input: PaymentInput) => move(bill, ['unpaid'], markPending(input))
  const confirmCleared = (bill: BillItem, date: string) => move(bill, ['pending'], clearedChange(bill, date))
  const revert = (bill: BillItem) => move(bill, ['pending'], reopenChange(bill))
  const reopen = (bill: BillItem) => move(bill, ['settled'], reopenChange(bill))

  const addBill = (data: BillFields) =>
    perform(() => addDoc(householdCollection('bills'), { ...data, status: 'unpaid' as BillStatus }))

  const updateBill = (id: string, data: BillFields) => perform(() => updateDoc(householdDoc('bills', id), data))

  const setAmount = (bill: BillItem, amount: number) =>
    perform(() => updateDoc(householdDoc('bills', bill.id), { amount }))

  // A generated bill is skipped rather than deleted, otherwise it would be generated again.
  const removeBill = (bill: BillItem) =>
    perform(() =>
      bill.recurringId
        ? updateDoc(householdDoc('bills', bill.id), { skipped: true })
        : deleteDoc(householdDoc('bills', bill.id)),
    )

  const addRecurring = (data: Omit<RecurringBill, 'id'>) =>
    perform(() => addDoc(householdCollection('recurringBills'), data))

  const updateRecurring = (before: RecurringBill, data: Omit<RecurringBill, 'id'>) =>
    perform(async () => {
      const batch = writeBatch(db)
      batch.update(householdDoc('recurringBills', before.id), data)
      for (const { id, patch } of planUpdates(before, { ...data, id: before.id }, all.value)) {
        batch.update(householdDoc('bills', id), patch)
      }
      await batch.commit()
    })

  const removeRecurring = (id: string) => perform(() => deleteDoc(householdDoc('recurringBills', id)))

  return {
    plans: sortedPlans,
    bills: monthBills,
    dueNow,
    soon,
    inTransit,
    toPay,
    month,
    currentMonth,
    today,
    error,
    start,
    stop,
    showMonth,
    pay,
    sendPayment,
    confirmCleared,
    revert,
    reopen,
    addBill,
    updateBill,
    setAmount,
    removeBill,
    addRecurring,
    updateRecurring,
    removeRecurring,
  }
})
