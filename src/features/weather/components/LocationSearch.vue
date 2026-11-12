<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Place } from '../types'

const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search'
const DEBOUNCE_MS = 300

interface GeocodeResult {
  id: number
  name: string
  admin1?: string
  country_code?: string
  latitude: number
  longitude: number
}

defineProps<{ name: string }>()
const emit = defineEmits<{ select: [place: Place] }>()

const query = ref('')
const results = ref<GeocodeResult[]>([])
let timer: ReturnType<typeof setTimeout>

const label = (r: GeocodeResult) => [r.name, r.admin1, r.country_code].filter(Boolean).join(', ')

async function search(text: string) {
  const res = await fetch(`${GEOCODE_URL}?${new URLSearchParams({ name: text, count: '6', language: 'en' })}`)
  results.value = res.ok ? ((await res.json()).results ?? []) : []
}

watch(query, (text) => {
  clearTimeout(timer)
  if (text.trim().length < 2) {
    results.value = []
    return
  }
  timer = setTimeout(() => search(text.trim()).catch(() => (results.value = [])), DEBOUNCE_MS)
})

function pick(r: GeocodeResult) {
  emit('select', { name: [r.name, r.admin1].filter(Boolean).join(', '), lat: r.latitude, lon: r.longitude })
  query.value = ''
  results.value = []
}
</script>

<template>
  <div class="search">
    <input v-model="query" class="input" type="search" placeholder="Search for a location…" :aria-label="`Change location (currently ${name})`" />
    <ul v-if="results.length" class="card search__results">
      <li v-for="r in results" :key="r.id" class="search__item" tabindex="0" @click="pick(r)" @keydown.enter="pick(r)">
        {{ label(r) }}
      </li>
    </ul>
  </div>
</template>
