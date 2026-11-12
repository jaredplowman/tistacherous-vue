<script setup lang="ts">
import { ref } from 'vue'
import { CATEGORY_LABELS, newRecurring, ordinal, type BillSave } from '@/domain/bills'
import { formatMoney } from '@/domain/kids'
import type { RecurringBill } from '@/domain/types'
import { confirmDialog } from '@/lib/confirm'
import { useBillsStore } from '@/stores/bills'
import BillForm from './BillForm.vue'

const store = useBillsStore()

// 'new' for the add form, a plan id when editing one, null when nothing is open
const editing = ref<string | 'new' | null>(null)
const busy = ref(false)

const blank: RecurringBill = { id: '', ...newRecurring() }

async function run(action: Promise<boolean>) {
  busy.value = true
  const ok = await action
  busy.value = false
  if (ok) editing.value = null
}

function save(payload: BillSave, plan?: RecurringBill) {
  if (!payload.repeat) return
  run(plan ? store.updateRecurring(plan, payload.data) : store.addRecurring(payload.data))
}

async function remove(plan: RecurringBill) {
  const ok = await confirmDialog({
    title: `Delete "${plan.title}"?`,
    message: 'Bills already created stay. To pause it instead, mark it inactive.',
    confirmLabel: 'Delete',
    danger: true,
  })
  if (ok) run(store.removeRecurring(plan.id))
}
</script>

<template>
  <section class="card panel" aria-labelledby="recurring-title">
    <div class="panel__head">
      <h2 id="recurring-title">Recurring bills</h2>
      <p class="sub">
        These are created automatically each month. Editing one also updates this and next month's bills, unless
        you've already changed them or paid them.
      </p>
    </div>

    <ul v-if="store.plans.length" class="list">
      <li v-for="plan in store.plans" :key="plan.id">
        <BillForm
          v-if="editing === plan.id"
          :plan="plan"
          :today="store.today"
          :busy="busy"
          remove-label="Delete"
          @save="save($event, plan)"
          @cancel="editing = null"
          @remove="remove(plan)"
        />
        <div v-else class="row-card">
          <div class="row-card__main">
            <strong>
              {{ plan.title }}
              <span v-if="plan.variableAmount" class="badge">Variable</span>
              <span v-if="plan.isAutopay" class="badge badge--accent">Autopay</span>
              <span v-if="!plan.active" class="badge">Paused</span>
            </strong>
            <span class="sub">
              {{ plan.variableAmount ? 'Amount entered monthly' : plan.amount > 0 ? formatMoney(plan.amount) : 'Amount varies' }} · the {{ ordinal(plan.dueDay) }} of each month ·
              {{ CATEGORY_LABELS[plan.category] }}
            </span>
          </div>
          <div class="row-card__actions">
            <button class="btn btn--small" type="button" @click="editing = plan.id">Edit</button>
          </div>
        </div>
      </li>
    </ul>
    <p v-else-if="editing !== 'new'" class="sub">No recurring bills yet. Add the first one.</p>

    <BillForm v-if="editing === 'new'" :plan="blank" :today="store.today" :busy="busy" @save="save($event)" @cancel="editing = null" />
    <div v-else>
      <button class="btn btn--accent" type="button" @click="editing = 'new'">Add recurring bill</button>
    </div>

    <p v-if="store.error" class="is-error">{{ store.error }}</p>
  </section>
</template>
