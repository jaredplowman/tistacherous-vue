<script setup lang="ts">
import { computed, ref } from 'vue'
import { formatMoney } from '@/domain/kids'
import { useLedgerStore } from '@/stores/ledger'
import { requestStrike } from '../strike'
import KidAvatar from './KidAvatar.vue'
import type { KidBoardEntry } from '@/stores/chores'

const props = defineProps<{ entry: KidBoardEntry; pending: number }>()
const ledger = useLedgerStore()

const kid = computed(() => props.entry.kid)
const meter = computed(() => kid.value.troubleMeter)

// null when nothing is open; the form is shared between paying out and adjusting
const mode = ref<'payout' | 'adjust' | null>(null)
const amount = ref<number | null>(null)
const note = ref('')
const busy = ref(false)

function open(next: 'payout' | 'adjust') {
  mode.value = next
  amount.value = next === 'payout' ? kid.value.goal.currentSaved : null
  note.value = ''
  ledger.error = ''
}

const close = () => (mode.value = null)

async function submit() {
  if (!mode.value || amount.value === null) return
  busy.value = true
  const ok =
    mode.value === 'payout'
      ? await ledger.payout(kid.value.id, amount.value, note.value.trim())
      : await ledger.adjust(kid.value.id, amount.value, note.value.trim())
  busy.value = false
  if (ok) close()
}

const strike = () => requestStrike(kid.value)
</script>

<template>
  <div class="account">
    <div class="account__row">
      <KidAvatar :kid="kid" :size="40" />
      <div class="account__who">
        <strong>{{ kid.name }}</strong>
        <span class="sub">
          {{ entry.streak > 0 ? '🔥' : '❄️' }} {{ entry.streak }} {{ entry.streak === 1 ? 'day' : 'days' }} ·
          ⚠️ {{ meter.currentStrikes }}/{{ meter.maxStrikes }}
        </span>
      </div>
      <div class="account__money">
        <span class="label">Balance</span>
        <strong>
          {{ formatMoney(kid.goal.currentSaved) }}
          <span v-if="kid.goal.targetAmount > 0" class="sub">/ {{ formatMoney(kid.goal.targetAmount) }}</span>
        </strong>
      </div>
      <div class="account__money">
        <span class="label">Pending audit</span>
        <strong>{{ formatMoney(pending) }}</strong>
      </div>
      <div class="row-card__actions">
        <button class="btn btn--small" type="button" @click="strike">Add strike</button>
        <button
          class="btn btn--small"
          type="button"
          :disabled="meter.currentStrikes === 0"
          @click="ledger.forgiveStrike(kid.id)"
        >
          Remove strike
        </button>
        <button class="btn btn--small btn--accent" type="button" :disabled="kid.goal.currentSaved <= 0" @click="open('payout')">
          Pay out
        </button>
        <button class="btn btn--small" type="button" @click="open('adjust')">Adjust</button>
      </div>
    </div>

    <form v-if="mode" class="kid-edit" @submit.prevent="submit">
      <div class="form-row">
        <label class="field">
          <span>{{ mode === 'payout' ? 'Cash paid out ($)' : 'Change ($, use − to subtract)' }}</span>
          <input
            v-model.number="amount"
            class="input"
            type="number"
            step="0.05"
            :min="mode === 'payout' ? 0.05 : undefined"
            :max="mode === 'payout' ? kid.goal.currentSaved : undefined"
            required
          />
        </label>
        <label class="field">
          <span>{{ mode === 'payout' ? 'Note (optional)' : 'Why' }}</span>
          <input
            v-model="note"
            class="input"
            maxlength="80"
            :required="mode === 'adjust'"
            :placeholder="mode === 'payout' ? 'Cash payout' : 'Correcting a mistake'"
          />
        </label>
      </div>
      <p class="sub" v-if="mode === 'payout'">Hand over the cash, then record it here. It comes off {{ kid.name }}'s balance.</p>
      <p v-if="ledger.error" class="is-error">{{ ledger.error }}</p>
      <div class="kid-edit__actions">
        <button class="btn" type="button" @click="close">Cancel</button>
        <button class="btn btn--accent" type="submit" :disabled="busy || amount === null">
          {{ mode === 'payout' ? 'Record payout' : 'Apply' }}
        </button>
      </div>
    </form>
  </div>
</template>
