import { addDays, weekdayOf } from './dates'
import type { AdultTask, AdultTaskTier, Member, Priority } from './types'

export const TIERS: AdultTaskTier[] = ['weekly', 'short_term', 'long_term']

export const TIER_LABELS: Record<AdultTaskTier, string> = {
  weekly: 'Weekly recurring',
  short_term: 'Short-term tasks',
  long_term: 'Long-term projects',
}

export const TIER_HINTS: Record<AdultTaskTier, string> = {
  weekly: 'Routine maintenance and reset. Starts fresh every Monday.',
  short_term: 'One-off to-dos for the next 1-3 weeks.',
  long_term: 'Seasonal, multi-stage and big-impact projects.',
}

export const PRIORITIES: Priority[] = ['P1', 'P2', 'P3']

export const PRIORITY_LABELS: Record<Priority, string> = { P1: 'High', P2: 'Med', P3: 'Low' }

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
// Weeks run Monday to Sunday, so the picker lists them that way.
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]

// What the task form edits, and what it hands back when saved.
export type TaskFields = Omit<AdultTask, 'id' | 'isCompleted' | 'completedAt' | 'completedBy'>

// 'all' and 'both' are the fixed filters; anything else is a member's email.
export type TaskFilter = 'all' | 'both' | string

export interface TaskState {
  task: AdultTask
  done: boolean
  due?: string
  overdue: boolean
}

// ---- weeks ----

// The Monday of the week a date falls in.
export const weekStartOf = (date: string) => addDays(date, -((weekdayOf(date) + 6) % 7))

export const completionId = (weekStart: string, taskId: string) => `${weekStart}_${taskId}`

// ---- dates and labels ----

function formatDate(date: string, withWeekday: boolean): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Intl.DateTimeFormat('en-CA', {
    ...(withWeekday && { weekday: 'short' }),
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, d)))
}

// The date a task is due: this week's target day for a weekly routine, otherwise its own date.
export function dueDateOf(task: AdultTask, weekStart: string): string | undefined {
  if (task.tier === 'weekly') {
    return task.targetDay === undefined ? undefined : addDays(weekStart, (task.targetDay + 6) % 7)
  }
  return task.targetDate || undefined
}

// "Thu Night", "Sat, Nov 14", "Spring 2027"
export function targetLabel(task: AdultTask): string {
  if (task.tier === 'weekly') {
    const day = task.targetDay === undefined ? '' : WEEKDAYS[task.targetDay].slice(0, 3)
    return [day, task.targetTime].filter(Boolean).join(' ') || 'Any day'
  }
  if (task.tier === 'short_term') return task.targetDate ? formatDate(task.targetDate, true) : 'No date'
  return task.targetDisplay || (task.targetDate ? formatDate(task.targetDate, false) : 'Someday')
}

// ---- status ----

export function taskState(task: AdultTask, weekStart: string, today: string, doneThisWeek: ReadonlySet<string>): TaskState {
  const done = task.tier === 'weekly' ? doneThisWeek.has(task.id) : task.isCompleted
  const due = dueDateOf(task, weekStart)
  return { task, done, due, overdue: !done && !!due && due < today }
}

// A paused weekly routine, or a finished one-off, isn't something anyone has to do.
export const isOpen = (state: TaskState) => state.task.active && !state.done

// Open tasks that are due today or already late. With an email, only the ones that person has to do.
export function dueNow(states: TaskState[], today: string, email?: string): TaskState[] {
  return states.filter(
    (s) =>
      isOpen(s) &&
      !!s.due &&
      s.due <= today &&
      (!email || !s.task.assignedTo.length || s.task.assignedTo.includes(email)),
  )
}

// ---- ordering and filtering ----

const rank = (p: Priority) => PRIORITIES.indexOf(p)

// Most important first, then soonest, then by name. Tasks with no date go last.
export function sortStates(states: TaskState[]): TaskState[] {
  return [...states].sort(
    (a, b) =>
      rank(a.task.priority) - rank(b.task.priority) ||
      (a.due ?? '9999').localeCompare(b.due ?? '9999') ||
      a.task.title.localeCompare(b.task.title),
  )
}

export function filterStates(states: TaskState[], filter: TaskFilter): TaskState[] {
  if (filter === 'all') return states
  if (filter === 'both') return states.filter((s) => s.task.requiresBoth)
  return states.filter((s) => s.task.assignedTo.includes(filter))
}

export interface TaskGroups {
  weekly: TaskState[] // active routines
  paused: TaskState[] // paused routines
  shortTerm: TaskState[]
  longTerm: TaskState[]
  completed: TaskState[] // finished one-offs and projects
}

export function groupStates(states: TaskState[]): TaskGroups {
  const sorted = sortStates(states)
  const open = (tier: AdultTaskTier) => sorted.filter((s) => s.task.tier === tier && !s.done)
  return {
    weekly: sorted.filter((s) => s.task.tier === 'weekly' && s.task.active),
    paused: sorted.filter((s) => s.task.tier === 'weekly' && !s.task.active),
    shortTerm: open('short_term'),
    longTerm: open('long_term'),
    completed: sorted
      .filter((s) => s.task.tier !== 'weekly' && s.done)
      .sort((a, b) => (b.task.completedAt ?? '').localeCompare(a.task.completedAt ?? '')),
  }
}

// "4 Weekly | 3 Short-term | 4 Long-term (3 need both)"
export function summarize(groups: TaskGroups) {
  const open = [...groups.weekly, ...groups.shortTerm, ...groups.longTerm]
  return {
    weekly: groups.weekly.length,
    shortTerm: groups.shortTerm.length,
    longTerm: groups.longTerm.length,
    both: open.filter((s) => s.task.requiresBoth).length,
  }
}

// ---- people ----

export const nameOf = (email: string, members: Member[]) =>
  members.find((m) => m.email === email)?.displayName ?? email.split('@')[0]

export function assigneeLabel(task: AdultTask, members: Member[]): string {
  if (task.requiresBoth) return 'Both'
  if (!task.assignedTo.length) return 'Anyone'
  return task.assignedTo.map((email) => nameOf(email, members)).join(', ')
}

// A task that needs both people is assigned to everyone, so it shows up under each of them.
export const assignees = (requiresBoth: boolean, chosen: string[], everyone: string[]) =>
  requiresBoth ? [...everyone] : chosen
