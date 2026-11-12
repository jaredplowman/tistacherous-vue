<script setup lang="ts">
import { formatDay, type MonthDay } from '../dates'

defineProps<{ selected: MonthDay }>()
defineEmits<{ step: [delta: number] }>()
</script>

<template>
  <nav class="day-nav">
    <button class="btn" aria-label="Previous day" @click="$emit('step', -1)">‹</button>
    <h2>{{ formatDay(selected) }}</h2>
    <button class="btn" aria-label="Next day" @click="$emit('step', 1)">›</button>
  </nav>
</template>
