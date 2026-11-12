<script setup lang="ts">
import { computed, ref } from 'vue'
import { CATEGORIES, CATEGORY_LABELS, type BillSave } from '@/domain/bills'
import { roundMoney } from '@/domain/chores'
import type { BillCategory, BillItem, RecurringBill } from '@/domain/types'

const props = defineProps<{
  bill?: BillItem
  plan?: RecurringBill
  // new bills can be made recurring; editing an existing one can't change that
  allowRepeat?: boolean
  today: string
  busy?: boolean
  removeLabel?: string
}>()
const emit = defineEmits<{
  save: [payload: BillSave]
  cancel: []
  remove: []
}>()

const title = ref(props.bill?.title ?? props.plan?.title ?? '')
const amount = ref(props.bill?.amount ?? props.plan?.amount ?? 0)
const dueDate = ref(props.bill?.dueDate ?? props.today)
const dueDay = ref(props.plan?.dueDay ?? Number(props.today.slice(8, 10)))
const isAutopay = ref(props.bill?.isAutopay ?? props.plan?.isAutopay ?? false)
const category = ref<BillCategory>(props.bill?.category ?? props.plan?.category ?? 'utility')
const active = ref(props.plan?.active ?? true)
const repeat = ref(false)
const variableAmount = ref(props.plan?.variableAmount ?? false)

const isPlan = computed(() => !!props.plan || repeat.value)
const isVariable = computed(() => isPlan.value && variableAmount.value)

const valid = computed(
  () =>
    title.value.trim() &&
    (isVariable.value || amount.value >= 0) &&
    (isPlan.value ? Number.isInteger(dueDay.value) && dueDay.value >= 1 && dueDay.value <= 31 : !!dueDate.value),
)

function submit() {
  if (!valid.value) return
  const common = {
    title: title.value.trim(),
    amount: isVariable.value ? 0 : roundMoney(amount.value),
    isAutopay: isAutopay.value,
    category: category.value,
  }
  emit(
    'save',
    isPlan.value
      ? { repeat: true, data: { ...common, dueDay: dueDay.value, active: active.value, variableAmount: variableAmount.value } }
      : { repeat: false, data: { ...common, dueDate: dueDate.value } },
  )
}
</script>

<template>
  <form class="kid-edit" @submit.prevent="submit">
    <div class="form-row">
      <label class="field">
        <span>Bill</span>
        <input v-model="title" class="input" required maxlength="100" placeholder="Gas" />
      </label>
      <label v-if="!isVariable" class="field">
        <span>Amount ($)</span>
        <input v-model.number="amount" class="input" type="number" min="0" step="0.01" required />
      </label>
      <label v-if="isPlan" class="field">
        <span>Due day of month</span>
        <input v-model.number="dueDay" class="input" type="number" min="1" max="31" step="1" required />
      </label>
      <label v-else class="field">
        <span>Due date</span>
        <input v-model="dueDate" class="input" type="date" required />
      </label>
      <label class="field">
        <span>Type</span>
        <select v-model="category" class="input">
          <option v-for="id in CATEGORIES" :key="id" :value="id">{{ CATEGORY_LABELS[id] }}</option>
        </select>
      </label>
    </div>

    <p v-if="isVariable" class="sub">
      Each month's bill starts with no amount and shows up under "Action required" until you enter it.
    </p>
    <p v-else class="sub">Leave the amount at $0 if you don't know it yet. Edit it once the bill arrives.</p>

    <label class="check">
      <input v-model="isAutopay" type="checkbox" />
      <span>Autopay: marked as paid automatically on its due date</span>
    </label>
    <label v-if="allowRepeat" class="check">
      <input v-model="repeat" type="checkbox" />
      <span>Repeats every month</span>
    </label>
    <label v-if="isPlan" class="check">
      <input v-model="variableAmount" type="checkbox" />
      <span>Amount changes every month, like a credit card: ask me for it each month</span>
    </label>
    <label v-if="plan" class="check">
      <input v-model="active" type="checkbox" />
      <span>Active (paused bills stop being created each month)</span>
    </label>

    <div class="kid-edit__actions">
      <button v-if="removeLabel" class="btn btn--danger" type="button" :disabled="busy" @click="emit('remove')">
        {{ removeLabel }}
      </button>
      <button class="btn" type="button" @click="emit('cancel')">Cancel</button>
      <button class="btn btn--accent" type="submit" :disabled="busy || !valid">Save</button>
    </div>
  </form>
</template>
