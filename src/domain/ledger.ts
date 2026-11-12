import { bustedDeduction, roundMoney } from './chores'
import { addDays } from './dates'
import type { DailyChoreInstance, KidProfile, LedgerTransaction } from './types'

// A kid's balance never goes below $0, so a fine can only take what is there.
export const clampDeduction = (balance: number, amount: number) =>
  roundMoney(Math.min(Math.max(amount, 0), Math.max(balance, 0)))

export interface Collection {
  owed: number
  applied: number
}

export function bustCollection(instance: DailyChoreInstance, balance: number): Collection {
  const owed = bustedDeduction(instance)
  return { owed, applied: clampDeduction(balance, owed) }
}

export interface StrikeOutcome extends Collection {
  strikes: number
  triggered: boolean
}

// Adding a strike that fills the meter takes the penalty straight away and starts the meter over.
export function addStrike(meter: KidProfile['troubleMeter'], balance: number): StrikeOutcome {
  const next = meter.currentStrikes + 1
  if (next < meter.maxStrikes) return { strikes: next, triggered: false, owed: 0, applied: 0 }
  return {
    strikes: 0,
    triggered: true,
    owed: roundMoney(meter.penaltyAmount),
    applied: clampDeduction(balance, meter.penaltyAmount),
  }
}

// Checked off but not yet reviewed by a parent, newest first.
export function pendingAudit(instances: DailyChoreInstance[], kidIds: Set<string>): DailyChoreInstance[] {
  const stamp = (i: DailyChoreInstance) => i.completedAt ?? i.date
  return instances
    .filter((i) => i.status === 'completed' && kidIds.has(i.kidId))
    .sort((a, b) => stamp(b).localeCompare(stamp(a)))
}

// Audited in the last few days, newest first, so a mistake can still be undone.
export function recentlyAudited(
  instances: DailyChoreInstance[],
  kidIds: Set<string>,
  today: string,
  days = 7,
): DailyChoreInstance[] {
  const since = addDays(today, -days)
  return instances
    .filter((i) => (i.status === 'verified' || i.status === 'busted') && kidIds.has(i.kidId) && i.date >= since)
    .sort((a, b) => (b.auditedAt ?? b.date).localeCompare(a.auditedAt ?? a.date))
}

// Undoing a bust gives back what it took. Busts made before that amount was recorded are looked up
// in the ledger by the caller; if neither is known the full fine is assumed.
export function bustRefund(instance: DailyChoreInstance, fromLedger: number | null): number {
  const taken = instance.bustedAmount ?? fromLedger ?? bustedDeduction(instance)
  return roundMoney(Math.max(taken, 0))
}

export const pendingAuditTotal = (queue: DailyChoreInstance[], kidId: string) =>
  roundMoney(queue.filter((i) => i.kidId === kidId).reduce((total, i) => total + i.value, 0))

export function shortfallNote(note: string, { owed, applied }: Collection, format: (n: number) => string): string {
  return applied < owed ? `${note} (balance covered ${format(applied)} of ${format(owed)})` : note
}

export const REASON_LABELS: Record<LedgerTransaction['reason'], string> = {
  chore_completed: 'Chore done',
  chore_undone: 'Chore undone',
  busted_penalty: 'Busted',
  bust_reverted: 'Bust undone',
  strike_penalty: 'Strike penalty',
  payout: 'Cash payout',
  manual_adjustment: 'Adjustment',
}
