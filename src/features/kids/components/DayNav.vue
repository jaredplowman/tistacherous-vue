<script setup lang="ts">
import { addDays, formatRelativeDay } from '@/domain/dates'
import { useChoresStore } from '@/stores/chores'

defineProps<{ selected: string }>()
defineEmits<{ select: [date: string] }>()

const chores = useChoresStore()
</script>

<template>
  <nav class="day-nav" aria-label="Day navigation">
    <button
      class="btn btn--small"
      type="button"
      aria-label="Previous day"
      :disabled="selected <= chores.windowStart"
      @click="$emit('select', addDays(selected, -1))"
    >
      ‹
    </button>
    <h2>{{ formatRelativeDay(selected, chores.today) }}</h2>
    <button
      class="btn btn--small"
      type="button"
      aria-label="Next day"
      :disabled="selected >= chores.today"
      @click="$emit('select', addDays(selected, 1))"
    >
      ›
    </button>
  </nav>
</template>
