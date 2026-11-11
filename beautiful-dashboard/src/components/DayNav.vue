<script setup>
import { formatDay } from '../dates'

defineProps({ selected: { type: Object, required: true } })
defineEmits(['step'])
</script>

<template>
  <nav class="day-nav">
    <button class="btn" aria-label="Previous day" @click="$emit('step', -1)">‹</button>
    <h2>{{ formatDay(selected) }}</h2>
    <button class="btn" aria-label="Next day" @click="$emit('step', 1)">›</button>
  </nav>
</template>
