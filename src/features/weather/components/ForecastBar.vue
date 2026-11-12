<script setup lang="ts">
import { computed } from 'vue'
import { describe } from '../weather'
import { degWhole } from '../format'
import type { MonthDay } from '../dates'
import type { Forecast } from '../types'

const props = withDefaults(
  defineProps<{
    forecast: Forecast | null
    error?: string
    selected: MonthDay
  }>(),
  { error: '' },
)
const emit = defineEmits<{ select: [value: MonthDay] }>()

const now = computed(() => (props.forecast ? describe(props.forecast.now.code, props.forecast.now.isDay) : null))

const parse = (date: string): MonthDay => {
  const [, month, day] = date.split('-').map(Number)
  return { month, day }
}
const weekday = (date: string, i: number) =>
  i === 0 ? 'Today' : new Date(`${date}T12:00`).toLocaleDateString([], { weekday: 'short' })
const isSelected = (date: string) => {
  const { month, day } = parse(date)
  return props.selected.month === month && props.selected.day === day
}
</script>

<template>
  <section class="card forecast">
    <p v-if="error" class="sub is-error">{{ error }}</p>
    <p v-else-if="!forecast || !now" class="sub">Loading forecast…</p>

    <template v-else>
      <div class="forecast__now">
        <p class="label">Now</p>
        <p class="value">{{ now.icon }} {{ degWhole(forecast.now.temp) }}</p>
        <p class="sub">{{ now.label }} · feels like {{ degWhole(forecast.now.feels) }}</p>
        <p class="sub">Wind {{ Math.round(forecast.now.wind) }} km/h</p>
      </div>

      <div class="forecast__days">
        <button
          v-for="(d, i) in forecast.days"
          :key="d.date"
          class="btn forecast__day"
          :class="{ 'is-selected': isSelected(d.date) }"
          :title="describe(d.code).label"
          @click="emit('select', parse(d.date))"
        >
          <span class="label">{{ weekday(d.date, i) }}</span>
          <span class="forecast__icon">{{ describe(d.code).icon }}</span>
          <span class="is-high">{{ degWhole(d.high) }}</span>
          <span class="is-low">{{ degWhole(d.low) }}</span>
        </button>
      </div>
    </template>
  </section>
</template>
