import type { KidProfile } from './types'

export const DEFAULT_MAX_STRIKES = 5
export const DEFAULT_STRIKE_PENALTY = 10
export const DEFAULT_SCREEN_CUTOFF = '19:30'

export function newKid(name: string, sortOrder: number): Omit<KidProfile, 'id'> {
  return {
    name,
    sortOrder,
    screenTimeCutoff: DEFAULT_SCREEN_CUTOFF,
    troubleMeter: {
      currentStrikes: 0,
      maxStrikes: DEFAULT_MAX_STRIKES,
      penaltyAmount: DEFAULT_STRIKE_PENALTY,
    },
    goal: { title: '', targetAmount: 0, currentSaved: 0, imageUrl: '' },
  }
}

export const nextKidOrder = (kids: KidProfile[]) => kids.reduce((highest, k) => Math.max(highest, k.sortOrder), -1) + 1

// Same renumbering as chores: returns only the kids whose position changes.
export function moveKid(kids: KidProfile[], id: string, direction: -1 | 1): { id: string; sortOrder: number }[] {
  const list = [...kids].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
  const from = list.findIndex((k) => k.id === id)
  const to = from + direction
  if (from < 0 || to < 0 || to >= list.length) return []

  const [moved] = list.splice(from, 1)
  list.splice(to, 0, moved!)
  return list.flatMap((kid, index) => (kid.sortOrder === index ? [] : [{ id: kid.id, sortOrder: index }]))
}

export function goalProgress({ currentSaved, targetAmount }: KidProfile['goal']): number {
  if (targetAmount <= 0) return 0
  return Math.min(100, Math.max(0, (currentSaved / targetAmount) * 100))
}

// '19:30' -> '7:30 PM'
export function formatClock(time: string): string {
  const [h, m] = time.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return time
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

export const formatMoney = (n: number) =>
  new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(n)
