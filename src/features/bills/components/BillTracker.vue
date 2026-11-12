<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  addMonths,
  billTotals,
  filterBills,
  formatMonth,
  groupBills,
  monthOf,
  type BillFilter,
  type BillSave,
} from '@/domain/bills'
import { formatMoney } from '@/domain/kids'
import { useBillsStore } from '@/stores/bills'
import BillForm from './BillForm.vue'
import BillTable from './BillTable.vue'

const store = useBillsStore()

const filter = ref<BillFilter>('all')
const adding = ref(false)
const busy = ref(false)

const visible = computed(() => filterBills(store.bills, filter.value))
const groups = computed(() => groupBills(visible.value))
const totals = computed(() => billTotals(visible.value))

const stats = computed(() => [
  { label: 'Total', value: totals.value.total },
  { label: 'Paid', value: totals.value.paid },
  { label: 'Pending', value: totals.value.pending },
  { label: 'Due', value: totals.value.due },
])

const step = (n: number) => store.showMonth(addMonths(store.month, n))

async function create(payload: BillSave) {
  busy.value = true
  const ok = payload.repeat ? await store.addRecurring(payload.data) : await store.addBill(payload.data)
  busy.value = false
  if (!ok) return
  adding.value = false
  if (!payload.repeat) store.showMonth(monthOf(payload.data.dueDate))
}
</script>

<template>
  <section class="card panel" aria-labelledby="tracker-title">
    <div class="bill-bar">
      <div class="bill-nav">
        <button class="btn btn--small" type="button" aria-label="Previous month" @click="step(-1)">‹</button>
        <h2 id="tracker-title">{{ formatMonth(store.month) }}</h2>
        <button class="btn btn--small" type="button" aria-label="Next month" @click="step(1)">›</button>
        <button
          v-if="store.month !== store.currentMonth"
          class="btn btn--small"
          type="button"
          @click="store.showMonth(store.currentMonth)"
        >
          This month
        </button>
      </div>
      <label class="field bill-bar__filter">
        <span class="sr-only">Show</span>
        <select v-model="filter" class="input" aria-label="Filter bills">
          <option value="all">All bills</option>
          <option value="autopay">Autopay</option>
          <option value="manual">Manual</option>
        </select>
      </label>
    </div>

    <dl class="bill-stats">
      <div v-for="stat in stats" :key="stat.label" class="bill-stat">
        <dt class="label">{{ stat.label }}</dt>
        <dd>{{ formatMoney(stat.value) }}</dd>
      </div>
    </dl>
    <p v-if="totals.awaitingAmount" class="sub is-neg">
      {{ totals.awaitingAmount }} {{ totals.awaitingAmount === 1 ? 'bill needs its' : 'bills need their' }} amount entered, so
      the totals are incomplete.
    </p>

    <p v-if="store.error" class="is-error">{{ store.error }}</p>

    <section class="bill-group" aria-labelledby="due-title">
      <h3 id="due-title" class="label">Action required / due soon ({{ groups.due.length }})</h3>
      <BillTable v-if="groups.due.length" :bills="groups.due" variant="due" payment-heading="Autopay?" />
      <p v-else class="sub">Nothing to pay. 🎉</p>
    </section>

    <section v-if="groups.pending.length" class="bill-group" aria-labelledby="pending-title">
      <h3 id="pending-title" class="label">In transit / pending clearance ({{ groups.pending.length }})</h3>
      <BillTable :bills="groups.pending" variant="pending" payment-heading="Payment" />
    </section>

    <details v-if="groups.settled.length" class="bill-group" open>
      <summary class="label">Settled ({{ groups.settled.length }})</summary>
      <BillTable :bills="groups.settled" variant="settled" payment-heading="Payment" />
    </details>

    <p v-if="!store.bills.length" class="sub">
      No bills for {{ formatMonth(store.month) }}. Add one below, or set up monthly bills in the Recurring tab.
    </p>

    <BillForm v-if="adding" allow-repeat :today="store.today" :busy="busy" @save="create" @cancel="adding = false" />
    <div v-else>
      <button class="btn btn--accent" type="button" @click="adding = true">New bill</button>
    </div>
  </section>
</template>
