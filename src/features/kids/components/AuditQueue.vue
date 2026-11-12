<script setup lang="ts">
import { bustedDeduction } from '@/domain/chores'
import { formatMoney } from '@/domain/kids'
import type { DailyChoreInstance } from '@/domain/types'
import { confirmDialog } from '@/lib/confirm'
import { useChoresStore } from '@/stores/chores'
import { useHouseholdStore } from '@/stores/household'
import { useLedgerStore } from '@/stores/ledger'

const household = useHouseholdStore()
const chores = useChoresStore()
const ledger = useLedgerStore()

const kidName = (id: string) => household.kids.find((k) => k.id === id)?.name ?? 'Unknown'

function when(instance: DailyChoreInstance) {
  if (!instance.completedAt) return instance.date
  const at = new Date(instance.completedAt)
  const time = at.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', timeZone: household.household.timezone })
  if (instance.date === chores.today) return time
  const day = at.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', timeZone: household.household.timezone })
  return `${day}, ${time}`
}

async function bust(instance: DailyChoreInstance) {
  const ok = await confirmDialog({
    title: 'Bust this chore?',
    message: 'The credit is taken back along with the fine, and the streak resets. You can undo it later.',
    details: [kidName(instance.kidId), instance.title, `-${formatMoney(bustedDeduction(instance))} from their balance`],
    confirmLabel: 'Bust it',
    danger: true,
  })
  if (ok) ledger.bust(instance)
}

async function passAll() {
  const ok = await confirmDialog({
    title: `Pass all ${chores.auditQueue.length} chores?`,
    message: 'Nothing changes in anyone\u2019s balance. They just leave this queue.',
    confirmLabel: 'Pass all',
  })
  if (ok) ledger.passAll(chores.auditQueue)
}
</script>

<template>
  <section class="card panel" aria-labelledby="audit-title">
    <div class="panel__head">
      <h2 id="audit-title">Pending audit</h2>
      <p class="sub">
        Checked-off chores are credited straight away. Pass them if they were done properly, or bust them to take the
        money back with the fine.
      </p>
    </div>

    <p v-if="ledger.error" class="is-error">{{ ledger.error }}</p>

    <table v-if="chores.auditQueue.length" class="table">
      <thead>
        <tr>
          <th scope="col">When</th>
          <th scope="col">Kid</th>
          <th scope="col">Chore</th>
          <th scope="col" class="num">Value</th>
          <th scope="col"><span class="sr-only">Actions</span></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="instance in chores.auditQueue" :key="instance.id">
          <td data-label="When">{{ when(instance) }}</td>
          <td data-label="Kid">{{ kidName(instance.kidId) }}</td>
          <td data-label="Chore">{{ instance.title }}</td>
          <td data-label="Value" class="num">{{ formatMoney(instance.value) }}</td>
          <td class="table__actions">
            <button class="btn btn--small btn--pass" type="button" @click="ledger.pass(instance)">Pass ✓</button>
            <button class="btn btn--small btn--danger" type="button" @click="bust(instance)">Busted ⚠️</button>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-else class="sub">Nothing waiting. Chores show up here when the kids check them off.</p>

    <div v-if="chores.auditQueue.length > 1">
      <button class="btn btn--small" type="button" @click="passAll">Pass all</button>
    </div>
  </section>
</template>
