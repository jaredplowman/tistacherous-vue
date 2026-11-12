import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import {
  addDoc,
  deleteDoc,
  deleteField,
  doc,
  increment,
  onSnapshot,
  query,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { householdCollection, householdDoc } from '@/lib/firestore'
import { errorMessage } from '@/lib/errors'
import { addDays, dateKey } from '@/domain/dates'
import {
  STREAK_WINDOW_DAYS,
  computeStreak,
  dayTotals,
  missingInstances,
  moveChore as reorderChores,
  nextSortOrder,
  screenStatus,
  sortChores,
  sortInstances,
  visibleInstances,
  type ScreenStatus,
} from '@/domain/chores'
import { pendingAudit, recentlyAudited } from '@/domain/ledger'
import type { ChoreDefinition, DailyChoreInstance, KidProfile } from '@/domain/types'
import { useHouseholdStore } from './household'

export interface KidBoardEntry {
  kid: KidProfile
  chores: DailyChoreInstance[]
  streak: number
  screen: ScreenStatus
  earned: number
  possible: number
}

const CLOCK_TICK_MS = 30_000

export const useChoresStore = defineStore('chores', () => {
  const household = useHouseholdStore()

  const chores = ref<ChoreDefinition[]>([])
  const instances = ref<DailyChoreInstance[]>([])
  const error = ref('')
  const now = ref(new Date())
  const started = ref(false)
  const choresLoaded = ref(false)
  // True once the instance listener has heard from the server. Generating from a stale local
  // cache could overwrite a chore that was already checked off on another device.
  const instancesSynced = ref(false)

  let unsubChores: Unsubscribe | undefined
  let unsubInstances: Unsubscribe | undefined
  let ticker: ReturnType<typeof setInterval> | undefined
  let generating = false

  const today = computed(() => dateKey(now.value, household.household.timezone))
  const windowStart = computed(() => addDays(today.value, -STREAK_WINDOW_DAYS))

  const onError = (e: Error) => (error.value = errorMessage(e))
  const sortedChores = computed(() => sortChores(chores.value))

  async function ensureDate(date: string) {
    if (!started.value || !choresLoaded.value || !instancesSynced.value || generating) return
    const missing = missingInstances(
      chores.value,
      household.kids.map((k) => k.id),
      new Set(instances.value.map((i) => i.id)),
      date,
    )
    if (!missing.length) return

    generating = true
    try {
      const batch = writeBatch(db)
      for (const { id, ...data } of missing) batch.set(householdDoc('instances', id), data)
      await batch.commit()
    } catch (e) {
      error.value = errorMessage(e)
    } finally {
      generating = false
    }
  }

  const boardForDate = (date: string): KidBoardEntry[] =>
    household.kids.map((kid) => {
      const mine = visibleInstances(
        instances.value.filter((i) => i.kidId === kid.id),
        chores.value,
        kid.id,
      )
      const todays = sortInstances(
        mine.filter((i) => i.date === date),
        chores.value,
      )
      return {
        kid,
        chores: todays,
        streak: computeStreak(mine, today.value),
        screen: screenStatus(todays),
        ...dayTotals(todays),
      }
    })

  const board = computed(() => boardForDate(today.value))

  const auditQueue = computed(() =>
    pendingAudit(instances.value, new Set(household.kids.map((k) => k.id))),
  )

  const recentAudits = computed(() =>
    recentlyAudited(instances.value, new Set(household.kids.map((k) => k.id)), today.value),
  )

  function subscribeInstances() {
    unsubInstances?.()
    instancesSynced.value = false
    unsubInstances = onSnapshot(
      query(householdCollection('instances'), where('date', '>=', windowStart.value)),
      { includeMetadataChanges: true },
      (snap) => {
        instances.value = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as DailyChoreInstance)
        instancesSynced.value = !snap.metadata.fromCache
      },
      onError,
    )
  }

  function start() {
    if (started.value) return
    started.value = true
    now.value = new Date()
    ticker = setInterval(() => (now.value = new Date()), CLOCK_TICK_MS)
    unsubChores = onSnapshot(
      householdCollection('chores'),
      (snap) => {
        chores.value = snap.docs.map((d) => ({ description: '', ...d.data(), id: d.id }) as ChoreDefinition)
        choresLoaded.value = true
      },
      onError,
    )
    subscribeInstances()
  }

  function stop() {
    started.value = false
    clearInterval(ticker)
    unsubChores?.()
    unsubInstances?.()
    unsubChores = unsubInstances = undefined
    chores.value = []
    instances.value = []
    choresLoaded.value = false
    instancesSynced.value = false
  }

  // The window slides forward each day, so the listener is rebuilt when the start date moves.
  watch(windowStart, () => started.value && subscribeInstances())

  // No Cloud Functions: whichever device is open first each day creates that day's chores.
  async function ensureToday() {
    await ensureDate(today.value)
  }

  watch([chores, () => household.kids, instances, instancesSynced, started, today], ensureToday)

  const addChore = (chore: Omit<ChoreDefinition, 'id'>) =>
    addDoc(householdCollection('chores'), { ...chore, sortOrder: nextSortOrder(chores.value) })
  const updateChore = (id: string, patch: Partial<Omit<ChoreDefinition, 'id'>>) =>
    updateDoc(householdDoc('chores', id), patch)
  const removeChore = (id: string) => deleteDoc(householdDoc('chores', id))

  async function moveChore(id: string, direction: -1 | 1) {
    const changes = reorderChores(chores.value, id, direction)
    if (!changes.length) return
    const batch = writeBatch(db)
    for (const { id: choreId, sortOrder } of changes) batch.update(householdDoc('chores', choreId), { sortOrder })
    error.value = ''
    try {
      await batch.commit()
    } catch (e) {
      error.value = errorMessage(e)
    }
  }

  // Checking a chore credits the kid right away; unchecking reverses it with a new ledger
  // entry rather than deleting the old one, so the ledger only ever grows.
  async function toggleInstance(instance: DailyChoreInstance) {
    if (instance.status !== 'pending' && instance.status !== 'completed') return
    const completing = instance.status === 'pending'
    const amount = completing ? instance.value : -instance.value
    const batch = writeBatch(db)

    batch.update(householdDoc('instances', instance.id), {
      status: completing ? 'completed' : 'pending',
      completedAt: completing ? new Date().toISOString() : deleteField(),
    })
    batch.update(householdDoc('kids', instance.kidId), { 'goal.currentSaved': increment(amount) })
    batch.set(doc(householdCollection('ledger')), {
      kidId: instance.kidId,
      timestamp: new Date().toISOString(),
      amount,
      reason: completing ? 'chore_completed' : 'chore_undone',
      referenceId: instance.id,
      notes: instance.title,
    })

    error.value = ''
    try {
      await batch.commit()
    } catch (e) {
      error.value = errorMessage(e)
    }
  }

  return {
    chores: sortedChores,
    instances,
    board,
    boardForDate,
    ensureDate,
    auditQueue,
    recentAudits,
    today,
    windowStart,
    error,
    start,
    stop,
    addChore,
    updateChore,
    removeChore,
    moveChore,
    toggleInstance,
  }
})
