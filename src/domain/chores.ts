import { addDays, weekdayOf } from './dates'
import type { ChoreDefinition, DailyChoreInstance } from './types'

export const DEFAULT_PENALTY_MULTIPLIER = 2
// How many days of history the app loads; also the longest streak it can show.
export const STREAK_WINDOW_DAYS = 60

export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]
export const WEEKDAYS = [1, 2, 3, 4, 5]
export const WEEKENDS = [0, 6]
// Monday-first order for display; the data stays 0 = Sunday.
export const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]
export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export const roundMoney = (n: number) => Math.round(n * 100) / 100

export function newChore(): Omit<ChoreDefinition, 'id'> {
  return {
    title: '',
    description: '',
    value: 0.5,
    assignedKidIds: [],
    scheduleDays: [...ALL_DAYS],
    isGatekeeper: false,
    penaltyMultiplier: DEFAULT_PENALTY_MULTIPLIER,
    active: true,
  }
}

export function describeSchedule(days: number[]): string {
  const set = new Set(days)
  const matches = (target: number[]) => set.size === target.length && target.every((d) => set.has(d))
  if (!set.size) return 'Never'
  if (matches(ALL_DAYS)) return 'Every day'
  if (matches(WEEKDAYS)) return 'Weekdays'
  if (matches(WEEKENDS)) return 'Weekends'
  return DAY_ORDER.filter((d) => set.has(d)).map((d) => DAY_LABELS[d]).join(', ')
}

export const instanceId = (date: string, choreId: string, kidId: string) => `${date}_${choreId}_${kidId}`

export const isScheduledOn = (chore: ChoreDefinition, date: string) =>
  chore.active && chore.scheduleDays.includes(weekdayOf(date))

export const isDone = (instance: DailyChoreInstance) => instance.status === 'completed' || instance.status === 'verified'

// Instances for `date` that don't exist yet. Ids are deterministic, so two devices
// generating at the same moment write the same documents instead of duplicates.
export function missingInstances(
  chores: ChoreDefinition[],
  kidIds: string[],
  existingIds: Set<string>,
  date: string,
): DailyChoreInstance[] {
  const kids = new Set(kidIds)
  const result: DailyChoreInstance[] = []
  for (const chore of chores) {
    if (!isScheduledOn(chore, date)) continue
    for (const kidId of chore.assignedKidIds) {
      const id = instanceId(date, chore.id, kidId)
      if (!kids.has(kidId) || existingIds.has(id)) continue
      result.push({
        id,
        choreDefinitionId: chore.id,
        kidId,
        date,
        title: chore.title,
        value: chore.value,
        isGatekeeper: chore.isGatekeeper,
        penaltyMultiplier: chore.penaltyMultiplier,
        status: 'pending',
      })
    }
  }
  return result
}

// A chore that was switched off, deleted or unassigned stops showing once it is no longer
// owed. Anything already checked off or audited stays, because money moved for it.
// Any instance whose chore definition still exists uses the live title so edits (e.g. emojis) show up right away.
export function visibleInstances(instances: DailyChoreInstance[], chores: ChoreDefinition[], kidId: string) {
  const byId = new Map(chores.map((c) => [c.id, c]))
  return instances.flatMap((i) => {
    const chore = byId.get(i.choreDefinitionId)
    if (i.status === 'pending' && (!chore || !chore.active || !chore.assignedKidIds.includes(kidId))) return []
    return [chore && chore.title !== i.title ? { ...i, title: chore.title } : i]
  })
}

export type ScreenState = 'none' | 'locked' | 'unlocked'

export interface ScreenStatus {
  state: ScreenState
  remaining: string[]
}

export function screenStatus(instances: DailyChoreInstance[]): ScreenStatus {
  const gates = instances.filter((i) => i.isGatekeeper)
  if (!gates.length) return { state: 'none', remaining: [] }
  const remaining = gates.filter((i) => !isDone(i)).map((i) => i.title)
  return { state: remaining.length ? 'locked' : 'unlocked', remaining }
}

export function dayTotals(instances: DailyChoreInstance[]) {
  const sum = (list: DailyChoreInstance[]) => roundMoney(list.reduce((total, i) => total + i.value, 0))
  return { earned: sum(instances.filter(isDone)), possible: sum(instances) }
}

export const bustedDeduction = (instance: DailyChoreInstance) => roundMoney(instance.value * instance.penaltyMultiplier)

// Consecutive days with every scheduled chore done and none busted. A day with no chores
// neither extends nor breaks the run. Today only counts once it is fully done, and a bust
// today resets to zero; an unfinished today doesn't break anything yet.
export function computeStreak(instances: DailyChoreInstance[], today: string): number {
  const byDate = new Map<string, DailyChoreInstance[]>()
  for (const i of instances) byDate.set(i.date, [...(byDate.get(i.date) ?? []), i])

  const todays = byDate.get(today) ?? []
  if (todays.some((i) => i.status === 'busted')) return 0

  let streak = todays.length && todays.every(isDone) ? 1 : 0
  for (let n = 1; n <= STREAK_WINDOW_DAYS; n++) {
    const day = byDate.get(addDays(today, -n))
    if (!day?.length) continue
    if (!day.every(isDone)) break
    streak++
  }
  return streak
}

// ---- ordering ----

const rank = (chore: Pick<ChoreDefinition, 'sortOrder'>) => chore.sortOrder ?? Number.MAX_SAFE_INTEGER

// The order chores are listed in: by position, then by name for chores that have none yet.
export function sortChores<T extends Pick<ChoreDefinition, 'title' | 'sortOrder'>>(chores: T[]): T[] {
  return [...chores].sort((a, b) => rank(a) - rank(b) || a.title.localeCompare(b.title))
}

export const nextSortOrder = (chores: ChoreDefinition[]) =>
  chores.reduce((highest, c) => Math.max(highest, c.sortOrder ?? -1), -1) + 1

// Moving a chore up or down renumbers the whole list 0..n-1 and returns only what changed. That also
// tidies lists where several chores had no position or shared one.
export function moveChore(
  chores: ChoreDefinition[],
  id: string,
  direction: -1 | 1,
): { id: string; sortOrder: number }[] {
  const list = sortChores(chores)
  const from = list.findIndex((c) => c.id === id)
  const to = from + direction
  if (from < 0 || to < 0 || to >= list.length) return []

  const [moved] = list.splice(from, 1)
  list.splice(to, 0, moved!)
  return list.flatMap((chore, index) => (chore.sortOrder === index ? [] : [{ id: chore.id, sortOrder: index }]))
}

// Today's chores for one kid in the same order as the manage list.
export function sortInstances(instances: DailyChoreInstance[], chores: ChoreDefinition[]): DailyChoreInstance[] {
  const position = new Map(chores.map((c) => [c.id, rank(c)]))
  const at = (i: DailyChoreInstance) => position.get(i.choreDefinitionId) ?? Number.MAX_SAFE_INTEGER
  return [...instances].sort((a, b) => at(a) - at(b) || a.title.localeCompare(b.title))
}