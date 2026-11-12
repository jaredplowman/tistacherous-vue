<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { formatMoney } from '@/domain/kids'
import { REASON_LABELS } from '@/domain/ledger'
import { useHouseholdStore } from '@/stores/household'
import { useLedgerStore } from '@/stores/ledger'

const household = useHouseholdStore()
const ledger = useLedgerStore()

const kidFilter = ref('')

onMounted(ledger.start)
onBeforeUnmount(ledger.stop)

const kidName = (id: string) => household.kids.find((k) => k.id === id)?.name ?? 'Removed kid'

const rows = computed(() => (kidFilter.value ? ledger.entries.filter((e) => e.kidId === kidFilter.value) : ledger.entries))

function when(timestamp: string) {
  return new Date(timestamp).toLocaleString('en-CA', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: household.household.timezone,
  })
}

const signed = (n: number) => (n > 0 ? `+${formatMoney(n)}` : formatMoney(n))
</script>

<template>
  <section class="card panel" aria-labelledby="ledger-title">
    <div class="panel__head">
      <h2 id="ledger-title">Ledger</h2>
      <p class="sub">Every change to a balance, newest first. Entries are never edited or deleted. Fix mistakes with an adjustment.</p>
    </div>

    <label class="field ledger__filter">
      <span>Show</span>
      <select v-model="kidFilter" class="input">
        <option value="">Everyone</option>
        <option v-for="kid in household.kids" :key="kid.id" :value="kid.id">{{ kid.name }}</option>
      </select>
    </label>

    <p v-if="ledger.error" class="is-error">{{ ledger.error }}</p>

    <table v-if="rows.length" class="table">
      <thead>
        <tr>
          <th scope="col">When</th>
          <th scope="col">Kid</th>
          <th scope="col">What</th>
          <th scope="col" class="num">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="entry in rows" :key="entry.id">
          <td data-label="When">{{ when(entry.timestamp) }}</td>
          <td data-label="Kid">{{ kidName(entry.kidId) }}</td>
          <td data-label="What">
            <strong>{{ REASON_LABELS[entry.reason] }}</strong>
            <span v-if="entry.notes" class="sub"> · {{ entry.notes }}</span>
            <span v-if="entry.by" class="sub"> · by {{ entry.by }}</span>
          </td>
          <td data-label="Amount" class="num" :class="entry.amount < 0 ? 'is-neg' : entry.amount > 0 ? 'is-pos' : ''">
            {{ signed(entry.amount) }}
          </td>
        </tr>
      </tbody>
    </table>
    <p v-else-if="ledger.loaded" class="sub">Nothing here yet.</p>
    <p v-else class="sub">Loading…</p>

    <div v-if="ledger.hasMore">
      <button class="btn btn--small" type="button" @click="ledger.loadMore">Load older entries</button>
    </div>
  </section>
</template>
