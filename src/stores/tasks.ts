import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import {
  addDoc,
  deleteDoc,
  deleteField,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { householdCollection, householdDoc } from '@/lib/firestore'
import { errorMessage } from '@/lib/errors'
import { member } from '@/lib/auth'
import { completionId, dueNow, taskState, weekStartOf, type TaskFields } from '@/domain/tasks'
import type { AdultTask, TaskCompletion } from '@/domain/types'
import { useChoresStore } from './chores'

// Fields a task may leave empty. On an edit they have to be deleted, not just left out.
const OPTIONAL = ['notes', 'targetDay', 'targetTime', 'targetDate', 'targetDisplay'] as const

export const useTasksStore = defineStore('tasks', () => {
  // The chores store already keeps the household-timezone clock, so tasks share it.
  const chores = useChoresStore()

  const tasks = ref<AdultTask[]>([])
  const completions = ref<TaskCompletion[]>([]) // this week's only
  const error = ref('')
  const started = ref(false)

  let unsubTasks: Unsubscribe | undefined
  let unsubCompletions: Unsubscribe | undefined

  const today = computed(() => chores.today)
  const weekStart = computed(() => weekStartOf(today.value))

  const onError = (e: Error) => (error.value = errorMessage(e))

  const doneThisWeek = computed(() => new Set(completions.value.map((c) => c.taskId)))

  const states = computed(() =>
    tasks.value.map((task) => taskState(task, weekStart.value, today.value, doneThisWeek.value)),
  )

  // Open tasks due today or already late: the number that belongs on a badge.
  const lateOrDue = computed(() => dueNow(states.value, today.value))
  const mine = computed(() => dueNow(states.value, today.value, member.value?.email))

  function subscribeCompletions() {
    unsubCompletions?.()
    unsubCompletions = undefined
    completions.value = []
    if (!started.value) return
    unsubCompletions = onSnapshot(
      query(householdCollection('taskCompletions'), where('weekStart', '==', weekStart.value)),
      (snap) => (completions.value = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as TaskCompletion)),
      onError,
    )
  }

  function start() {
    if (started.value) return
    started.value = true
    unsubTasks = onSnapshot(
      householdCollection('tasks'),
      (snap) => (tasks.value = snap.docs.map((d) => ({ active: true, ...d.data(), id: d.id }) as AdultTask)),
      onError,
    )
    subscribeCompletions()
  }

  function stop() {
    started.value = false
    unsubTasks?.()
    unsubCompletions?.()
    unsubTasks = unsubCompletions = undefined
    tasks.value = []
    completions.value = []
  }

  // A new week starts with a clean slate: only that week's completions are loaded.
  watch(weekStart, subscribeCompletions)

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

  const addTask = (fields: TaskFields) =>
    perform(() => addDoc(householdCollection('tasks'), { ...fields, isCompleted: false }))

  const updateTask = (id: string, fields: TaskFields) => {
    const patch: Record<string, unknown> = { ...fields }
    for (const key of OPTIONAL) if (fields[key] === undefined) patch[key] = deleteField()
    return perform(() => updateDoc(householdDoc('tasks', id), patch))
  }

  // A weekly routine is done for this week only: that is one completion record, and removing it
  // undoes it. Anything else finishes once on the task itself.
  const setDone = (task: AdultTask, done: boolean) =>
    perform(() => {
      const email = member.value?.email ?? ''
      const now = new Date().toISOString()
      if (task.tier === 'weekly') {
        const ref = householdDoc('taskCompletions', completionId(weekStart.value, task.id))
        return done
          ? setDoc(ref, { taskId: task.id, weekStart: weekStart.value, completedAt: now, completedBy: email })
          : deleteDoc(ref)
      }
      return updateDoc(
        householdDoc('tasks', task.id),
        done
          ? { isCompleted: true, completedAt: now, completedBy: email }
          : { isCompleted: false, completedAt: deleteField(), completedBy: deleteField() },
      )
    })

  const removeTask = (task: AdultTask) =>
    perform(async () => {
      const batch = writeBatch(db)
      batch.delete(householdDoc('tasks', task.id))
      for (const c of completions.value) if (c.taskId === task.id) batch.delete(householdDoc('taskCompletions', c.id))
      await batch.commit()
    })

  return {
    states,
    lateOrDue,
    mine,
    today,
    weekStart,
    error,
    start,
    stop,
    addTask,
    updateTask,
    setDone,
    removeTask,
  }
})
