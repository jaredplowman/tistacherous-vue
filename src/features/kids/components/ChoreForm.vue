<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  ALL_DAYS,
  DAY_LABELS,
  DAY_ORDER,
  WEEKDAYS,
  WEEKENDS,
  newChore,
  roundMoney,
} from '@/domain/chores'
import type { ChoreDefinition, KidProfile } from '@/domain/types'

const props = defineProps<{
  chore?: ChoreDefinition
  kids: KidProfile[]
  busy?: boolean
}>()
const emit = defineEmits<{
  save: [chore: Omit<ChoreDefinition, 'id'>]
  cancel: []
  remove: []
}>()

const initial = props.chore ?? newChore()
const title = ref(initial.title)
const description = ref(initial.description)
const value = ref(initial.value)
const multiplier = ref(initial.penaltyMultiplier)
const isGatekeeper = ref(initial.isGatekeeper)
const active = ref(initial.active)
const assigned = ref(new Set(initial.assignedKidIds))
const days = ref(new Set(initial.scheduleDays))

const setDays = (list: number[]) => (days.value = new Set(list))
const toggleDay = (day: number) => {
  const next = new Set(days.value)
  if (!next.delete(day)) next.add(day)
  days.value = next
}
const toggleKid = (id: string) => {
  const next = new Set(assigned.value)
  if (!next.delete(id)) next.add(id)
  assigned.value = next
}

const valid = computed(
  () => title.value.trim() && assigned.value.size > 0 && days.value.size > 0 && value.value >= 0 && multiplier.value >= 1,
)

function submit() {
  if (!valid.value) return
  emit('save', {
    title: title.value.trim(),
    description: description.value.trim(),
    value: roundMoney(value.value),
    penaltyMultiplier: multiplier.value,
    isGatekeeper: isGatekeeper.value,
    active: active.value,
    assignedKidIds: props.kids.filter((k) => assigned.value.has(k.id)).map((k) => k.id),
    scheduleDays: [...days.value].sort((a, b) => a - b),
  })
}
</script>

<template>
  <form class="kid-edit" @submit.prevent="submit">
    <div class="form-row">
      <label class="field">
        <span>Chore</span>
        <input v-model="title" class="input" required maxlength="60" placeholder="Make bed" />
      </label>
      <label class="field">
        <span>Value ($)</span>
        <input v-model.number="value" class="input" type="number" min="0" step="0.05" required />
      </label>
      <label class="field">
        <span>Bust penalty (x value)</span>
        <input v-model.number="multiplier" class="input" type="number" min="1" step="0.5" required />
      </label>
    </div>

    <label class="field">
      <span>Notes (optional)</span>
      <input v-model="description" class="input" maxlength="140" placeholder="What counts as done" />
    </label>

    <fieldset class="chips">
      <legend class="label">Who does it</legend>
      <label v-for="kid in kids" :key="kid.id" class="chip" :class="{ 'is-on': assigned.has(kid.id) }">
        <input type="checkbox" :checked="assigned.has(kid.id)" @change="toggleKid(kid.id)" />
        {{ kid.name }}
      </label>
      <p v-if="!kids.length" class="sub">Add a kid in Settings first.</p>
    </fieldset>

    <fieldset class="chips">
      <legend class="label">Which days</legend>
      <label v-for="day in DAY_ORDER" :key="day" class="chip" :class="{ 'is-on': days.has(day) }">
        <input type="checkbox" :checked="days.has(day)" @change="toggleDay(day)" />
        {{ DAY_LABELS[day] }}
      </label>
      <span class="chips__presets">
        <button class="btn btn--small" type="button" @click="setDays(ALL_DAYS)">Every day</button>
        <button class="btn btn--small" type="button" @click="setDays(WEEKDAYS)">Weekdays</button>
        <button class="btn btn--small" type="button" @click="setDays(WEEKENDS)">Weekends</button>
      </span>
    </fieldset>

    <label class="check">
      <input v-model="isGatekeeper" type="checkbox" />
      <span>Screen time gatekeeper: must be done to unlock screens</span>
    </label>
    <label class="check">
      <input v-model="active" type="checkbox" />
      <span>Active (inactive chores stop appearing on the board)</span>
    </label>

    <div class="kid-edit__actions">
      <button v-if="chore" class="btn btn--danger" type="button" :disabled="busy" @click="emit('remove')">Delete</button>
      <button class="btn" type="button" @click="emit('cancel')">Cancel</button>
      <button class="btn btn--accent" type="submit" :disabled="busy || !valid">Save</button>
    </div>
  </form>
</template>
