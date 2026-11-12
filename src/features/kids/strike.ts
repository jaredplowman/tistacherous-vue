import { formatMoney } from '@/domain/kids'
import { addStrike } from '@/domain/ledger'
import type { KidProfile } from '@/domain/types'
import { confirmDialog } from '@/lib/confirm'
import { useLedgerStore } from '@/stores/ledger'

// A strike that fills the meter takes money, so that one asks first; the others just count.
export async function requestStrike(kid: KidProfile): Promise<boolean> {
  const { troubleMeter: meter, goal } = kid
  const outcome = addStrike(meter, goal.currentSaved)
  if (outcome.triggered) {
    const ok = await confirmDialog({
      title: `Add strike ${meter.currentStrikes + 1} of ${meter.maxStrikes}?`,
      message: 'This fills the trouble meter, so the penalty is taken straight away and the meter starts over.',
      details: [kid.name, `-${formatMoney(outcome.applied)} from their balance`],
      confirmLabel: 'Add strike',
      danger: true,
    })
    if (!ok) return false
  }
  return useLedgerStore().strike(kid.id)
}
