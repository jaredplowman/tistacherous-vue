<script setup lang="ts">
import { formatMoney } from '@/domain/kids'
import type { DailyChoreInstance } from '@/domain/types'
import { useChoresStore } from '@/stores/chores'
import { useHouseholdStore } from '@/stores/household'
import { bustedAmount, requestReopen, requestUndoBust } from '../audit'

const household = useHouseholdStore()
const chores = useChoresStore()

const kidName = (id: string) => household.kids.find((k) => k.id === id)?.name ?? 'Unknown'
const taken = bustedAmount

function when(instance: DailyChoreInstance) {
  const stamp = instance.auditedAt
  if (!stamp) return instance.date
  const zone = household.household.timezone
  const at = new Date(stamp)
  const time = at.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', timeZone: zone })
  const day = at.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', timeZone: zone })
  return `${day}, ${time}`
}

</script>

<template>
  <section class="card panel" aria-labelledby="recent-title">
    <div class="panel__head">
      <h2 id="recent-title">Recently audited</h2>
      <p class="sub">The last 7 days. Busted by mistake? Undo it and the chore returns to the queue above.</p>
    </div>

    <table v-if="chores.recentAudits.length" class="table">
      <thead>
        <tr>
          <th scope="col">When</th>
          <th scope="col">Kid</th>
          <th scope="col">Chore</th>
          <th scope="col">Result</th>
          <th scope="col"><span class="sr-only">Actions</span></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="instance in chores.recentAudits" :key="instance.id">
          <td data-label="When">{{ when(instance) }}</td>
          <td data-label="Kid">{{ kidName(instance.kidId) }}</td>
          <td data-label="Chore">{{ instance.title }}</td>
          <td data-label="Result">
            <span v-if="instance.status === 'busted'" class="is-error">Busted -{{ formatMoney(taken(instance)) }}</span>
            <span v-else>Passed ✓</span>
          </td>
          <td class="table__actions">
            <button v-if="instance.status === 'busted'" class="btn btn--small" type="button" @click="requestUndoBust(instance)">
              Undo bust
            </button>
            <button v-else class="btn btn--small" type="button" @click="requestReopen(instance)">Reopen</button>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-else class="sub">Nothing audited in the last week.</p>
  </section>
</template>
