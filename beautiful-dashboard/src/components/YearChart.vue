<script setup>
import { ref, computed } from 'vue'
import { deg } from '../format'

const W = 800
const H = 320
const M = { top: 16, right: 16, bottom: 28, left: 44 }
const STEPS = [1, 2, 5, 10, 20]
const MAX_TICKS = 7

const props = defineProps({
  rows: { type: Array, required: true },
  average: { type: Object, default: null },
})

const hovered = ref(null)
const currentYear = new Date().getFullYear()
const innerW = W - M.left - M.right
const innerH = H - M.top - M.bottom

const minYear = computed(() => props.rows[0].year)
const span = computed(() => currentYear - minYear.value || 1)

const x = (year) => M.left + ((year - minYear.value) / span.value) * innerW

const scale = computed(() => {
  const lo = Math.min(...props.rows.map((r) => r.low))
  const hi = Math.max(...props.rows.map((r) => r.high))
  const step = STEPS.find((s) => (hi - lo) / s <= MAX_TICKS) ?? STEPS.at(-1)
  const min = Math.floor(lo / step) * step
  const max = Math.ceil(hi / step) * step
  const ticks = []
  for (let t = min; t <= max; t += step) ticks.push(t)
  return { min, max, ticks }
})

const y = (value) => M.top + ((scale.value.max - value) / (scale.value.max - scale.value.min)) * innerH

const decades = computed(() => {
  const out = []
  for (let yr = Math.ceil(minYear.value / 10) * 10; yr <= currentYear; yr += 10) out.push(yr)
  return out
})

const columnWidth = computed(() => Math.max(innerW / span.value, 4))
const isCurrent = (row) => row.year === currentYear
const dotClass = (row, kind) => (isCurrent(row) ? 'dot--current' : `dot--${kind}`)

const tooltipStyle = computed(() => ({ left: `${(x(hovered.value.year) / W) * 100}%` }))
const tooltipFlipped = computed(() => x(hovered.value.year) > W * 0.6)
</script>

<template>
  <div class="chart__scroll">
    <div class="chart__canvas">
      <svg class="chart__svg" :viewBox="`0 0 ${W} ${H}`" role="img" aria-label="High and low temperature for this day in every year" @mouseleave="hovered = null">
        <g v-for="t in scale.ticks" :key="t">
          <line class="chart__grid" :x1="M.left" :x2="W - M.right" :y1="y(t)" :y2="y(t)" />
          <text class="chart__axis" :x="M.left - 8" :y="y(t) + 4" text-anchor="end">{{ t }}°</text>
        </g>
        <text v-for="yr in decades" :key="yr" class="chart__axis" :x="x(yr)" :y="H - 8" text-anchor="middle">{{ yr }}</text>

        <rect
          v-for="row in rows"
          :key="`hover-${row.year}`"
          class="chart__hover"
          :x="x(row.year) - columnWidth / 2"
          :y="M.top"
          :width="columnWidth"
          :height="innerH"
          @mouseenter="hovered = row"
        />

        <template v-if="average">
          <line class="chart__avg chart__avg--high" :x1="M.left" :x2="W - M.right" :y1="y(average.high)" :y2="y(average.high)" />
          <line class="chart__avg chart__avg--low" :x1="M.left" :x2="W - M.right" :y1="y(average.low)" :y2="y(average.low)" />
        </template>

        <g v-for="row in rows" :key="row.year" class="chart__dots">
          <circle :class="dotClass(row, 'high')" :cx="x(row.year)" :cy="y(row.high)" r="3.5" />
          <circle :class="dotClass(row, 'low')" :cx="x(row.year)" :cy="y(row.low)" r="3.5" />
        </g>
      </svg>

      <div v-if="hovered" class="card chart__tooltip" :class="{ 'is-flipped': tooltipFlipped }" :style="tooltipStyle">
        <strong>{{ hovered.year }}</strong><br />
        <span class="is-high">High {{ deg(hovered.high) }}</span><br />
        <span class="is-low">Low {{ deg(hovered.low) }}</span>
      </div>
    </div>
  </div>
</template>
