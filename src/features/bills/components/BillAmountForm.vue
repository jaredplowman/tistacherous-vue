<script setup lang="ts">
import { computed, ref } from 'vue'
import { roundMoney } from '@/domain/chores'

defineProps<{ busy?: boolean }>()
const emit = defineEmits<{
  submit: [amount: number]
  cancel: []
}>()

const amount = ref<number | null>(null)
const valid = computed(() => typeof amount.value === 'number' && amount.value > 0)

const submit = () => valid.value && emit('submit', roundMoney(amount.value as number))
</script>

<template>
  <form class="kid-edit" @submit.prevent="submit">
    <div class="form-row">
      <label class="field">
        <span>Amount owing ($)</span>
        <input v-model.number="amount" class="input" type="number" min="0.01" step="0.01" required autofocus />
      </label>
    </div>
    <p class="sub">Enter the amount from this month's statement. Then you can pay it.</p>
    <div class="kid-edit__actions">
      <button class="btn" type="button" @click="emit('cancel')">Cancel</button>
      <button class="btn btn--accent" type="submit" :disabled="busy || !valid">Save amount</button>
    </div>
  </form>
</template>
