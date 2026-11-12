import { bustedDeduction } from '@/domain/chores'
import { formatMoney } from '@/domain/kids'
import type { DailyChoreInstance } from '@/domain/types'
import { confirmDialog } from '@/lib/confirm'
import { useHouseholdStore } from '@/stores/household'
import { useLedgerStore } from '@/stores/ledger'

const kidName = (id: string) => useHouseholdStore().kids.find((k) => k.id === id)?.name ?? 'Unknown'

export const bustedAmount = (instance: DailyChoreInstance) => instance.bustedAmount ?? bustedDeduction(instance)

export async function requestUndoBust(instance: DailyChoreInstance): Promise<boolean> {
  const ok = await confirmDialog({
    title: 'Undo this bust?',
    message: 'The money comes back and the chore goes back to the audit queue, so you can pass or bust it again.',
    details: [kidName(instance.kidId), instance.title, `+${formatMoney(bustedAmount(instance))} back to their balance`],
    confirmLabel: 'Undo bust',
  })
  return ok ? useLedgerStore().unbust(instance) : false
}

export async function requestReopen(instance: DailyChoreInstance): Promise<boolean> {
  const ok = await confirmDialog({
    title: 'Send back to the audit queue?',
    message: 'No money moves. You can pass or bust it again.',
    details: [kidName(instance.kidId), instance.title],
    confirmLabel: 'Reopen',
  })
  return ok ? useLedgerStore().reopenAudit(instance) : false
}
