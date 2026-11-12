<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { MONTHS, daysInMonth, today, type MonthDay } from '../dates'

const props = defineProps<{ selected: MonthDay }>()
const emit = defineEmits<{ select: [value: MonthDay] }>()

const viewMonth = ref(props.selected.month)
watch(() => props.selected.month, (m) => (viewMonth.value = m))

const days = computed(() => Array.from({ length: daysInMonth(viewMonth.value) }, (_, i) => i + 1))
const now = today()

const shiftMonth = (delta: number) => (viewMonth.value = ((viewMonth.value - 1 + delta + 12) % 12) + 1)
const isSelected = (day: number) => props.selected.month === viewMonth.value && props.selected.day === day
const isToday = (day: number) => now.month === viewMonth.value && now.day === day
</script>

<template>
  <section class="card calendar">
    <header class="calendar__head">
      <button class="btn" aria-label="Previous month" @click="shiftMonth(-1)">‹</button>
      <h2>{{ MONTHS[viewMonth - 1] }}</h2>
      <button class="btn" aria-label="Next month" @click="shiftMonth(1)">›</button>
    </header>
    <div class="calendar__grid">
      <button
        v-for="day in days"
        :key="day"
        class="btn calendar__day"
        :class="{ 'is-selected': isSelected(day), 'is-today': isToday(day) }"
        @click="emit('select', { month: viewMonth, day })"
      >
        {{ day }}
      </button>
    </div>
  </section>
</template>
