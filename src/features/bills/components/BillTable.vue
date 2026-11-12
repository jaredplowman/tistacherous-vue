<script setup lang="ts">
import { ref } from 'vue'
import {
  CATEGORY_LABELS,
  amountLabel,
  dueLabel,
  formatDay,
  isOverdue,
  needsAmount,
  paymentLabel,
  type BillSave,
  type PaymentInput,
} from '@/domain/bills'
import type { BillItem } from '@/domain/types'
import { confirmDialog } from '@/lib/confirm'
import { useBillsStore } from '@/stores/bills'
import BillAmountForm from './BillAmountForm.vue'
import BillForm from './BillForm.vue'
import BillPaymentForm from './BillPaymentForm.vue'

defineProps<{
  bills: BillItem[]
  // which part of the lifecycle these bills are in; decides the buttons
  variant: 'due' | 'pending' | 'settled'
  paymentHeading: string
}>()

const store = useBillsStore()

type Mode = 'pay' | 'pending' | 'edit' | 'amount'
// Only one row has a form open at a time.
const open = ref<{ id: string; mode: Mode } | null>(null)
const busy = ref(false)

function toggle(bill: BillItem, mode: Mode) {
  store.error = ''
  open.value = open.value?.id === bill.id && open.value.mode === mode ? null : { id: bill.id, mode }
}

async function run(action: Promise<boolean>) {
  busy.value = true
  const ok = await action
  busy.value = false
  if (ok) open.value = null
}

const submitPayment = (bill: BillItem, mode: 'pay' | 'pending', input: PaymentInput) =>
  run(mode === 'pay' ? store.pay(bill, input) : store.sendPayment(bill, input))

function save(bill: BillItem, payload: BillSave) {
  if (!payload.repeat) run(store.updateBill(bill.id, payload.data))
}

const removeLabel = (bill: BillItem) => (bill.recurringId ? 'Skip this month' : 'Delete')

async function remove(bill: BillItem) {
  const ok = await confirmDialog(
    bill.recurringId
      ? {
          title: `Skip "${bill.title}" this month?`,
          message: "It won't be created again for this month.",
          confirmLabel: 'Skip',
          danger: true,
        }
      : { title: `Delete "${bill.title}"?`, confirmLabel: 'Delete', danger: true },
  )
  if (ok) run(store.removeBill(bill))
}

async function reopen(bill: BillItem) {
  const ok = await confirmDialog({
    title: `Reopen "${bill.title}" as unpaid?`,
    message:
      bill.paymentDetails?.method === 'autopay'
        ? 'It will become a manual bill, since autopay did not go through.'
        : undefined,
    confirmLabel: 'Reopen',
  })
  if (ok) store.reopen(bill)
}
</script>

<template>
  <table class="table table--bills">
    <thead>
      <tr>
        <th scope="col">Bill</th>
        <th scope="col">Due</th>
        <th scope="col" class="num">Amount</th>
        <th scope="col">{{ paymentHeading }}</th>
        <th scope="col"><span class="sr-only">Actions</span></th>
      </tr>
    </thead>
    <tbody>
      <template v-for="bill in bills" :key="bill.id">
        <tr>
          <td data-label="Bill">
            <strong>{{ bill.title }}</strong>
            <span v-if="bill.category" class="sub"> · {{ CATEGORY_LABELS[bill.category] }}</span>
          </td>
          <td data-label="Due">
            {{ formatDay(bill.dueDate) }}
            <span
              v-if="variant === 'due'"
              class="sub bill__soon"
              :class="{ 'is-neg': isOverdue(bill, store.today) }"
            >
              · {{ dueLabel(bill, store.today) }}
            </span>
          </td>
          <td data-label="Amount" class="num" :class="{ 'is-neg': needsAmount(bill) }">{{ amountLabel(bill) }}</td>
          <td data-label="Payment">{{ paymentLabel(bill) }}</td>
          <td class="table__actions">
            <template v-if="variant === 'due' && needsAmount(bill)">
              <button class="btn btn--small btn--accent" type="button" @click="toggle(bill, 'amount')">Enter amount</button>
            </template>
            <template v-else-if="variant === 'due'">
              <button class="btn btn--small btn--accent" type="button" @click="toggle(bill, 'pay')">Pay now</button>
              <button class="btn btn--small" type="button" @click="toggle(bill, 'pending')">Mark pending</button>
            </template>
            <template v-else-if="variant === 'pending'">
              <button class="btn btn--small btn--pass" type="button" @click="store.confirmCleared(bill, store.today)">
                Confirm cleared
              </button>
              <button class="btn btn--small" type="button" @click="store.revert(bill)">Revert</button>
            </template>
            <button v-else class="btn btn--small" type="button" @click="reopen(bill)">Reopen</button>
            <button class="btn btn--small" type="button" @click="toggle(bill, 'edit')">Edit</button>
          </td>
        </tr>
        <tr v-if="open?.id === bill.id" class="table__form">
          <td colspan="5">
            <BillForm
              v-if="open.mode === 'edit'"
              :bill="bill"
              :today="store.today"
              :busy="busy"
              :remove-label="removeLabel(bill)"
              @save="save(bill, $event)"
              @cancel="open = null"
              @remove="remove(bill)"
            />
            <BillAmountForm
              v-else-if="open.mode === 'amount'"
              :busy="busy"
              @submit="run(store.setAmount(bill, $event))"
              @cancel="open = null"
            />
            <BillPaymentForm
              v-else
              :mode="open.mode as 'pay' | 'pending'"
              :today="store.today"
              :busy="busy"
              @submit="submitPayment(bill, open.mode as 'pay' | 'pending', $event)"
              @cancel="open = null"
            />
          </td>
        </tr>
      </template>
    </tbody>
  </table>
</template>
