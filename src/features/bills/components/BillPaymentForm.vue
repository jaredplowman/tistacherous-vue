<script setup lang="ts">
import { ref } from 'vue'
import { MANUAL_METHODS, METHOD_LABELS, type PaymentInput } from '@/domain/bills'
import type { PaymentMethod } from '@/domain/types'

const props = defineProps<{
  mode: 'pay' | 'pending'
  today: string
  busy?: boolean
}>()
const emit = defineEmits<{
  submit: [input: PaymentInput]
  cancel: []
}>()

const method = ref<PaymentMethod>('etransfer')
const date = ref(props.today)
const confirmationRef = ref('')

const submit = () => date.value && emit('submit', { method: method.value, date: date.value, confirmationRef: confirmationRef.value })
</script>

<template>
  <form class="kid-edit" @submit.prevent="submit">
    <div class="form-row">
      <label class="field">
        <span>Paid by</span>
        <select v-model="method" class="input">
          <option v-for="id in MANUAL_METHODS" :key="id" :value="id">{{ METHOD_LABELS[id] }}</option>
        </select>
      </label>
      <label class="field">
        <span>{{ mode === 'pay' ? 'Paid on' : 'Sent on' }}</span>
        <input v-model="date" class="input" type="date" required />
      </label>
      <label class="field">
        <span>Confirmation # (optional)</span>
        <input v-model="confirmationRef" class="input" maxlength="60" />
      </label>
    </div>
    <p v-if="mode === 'pending'" class="sub">
      Use this when the payment is on its way but hasn't cleared yet. Confirm it once it has.
    </p>
    <div class="kid-edit__actions">
      <button class="btn" type="button" @click="emit('cancel')">Cancel</button>
      <button class="btn btn--accent" type="submit" :disabled="busy">
        {{ mode === 'pay' ? 'Mark paid' : 'Mark pending' }}
      </button>
    </div>
  </form>
</template>
