<script setup>
import { ref, computed, watch } from 'vue'
import { useHistory, statsFor } from './composables/useHistory'
import { useForecast } from './composables/useForecast'
import { today, stepDay, formatDay } from './dates'
import { deg } from './format'
import LocationSearch from './components/LocationSearch.vue'
import ForecastBar from './components/ForecastBar.vue'
import DayNav from './components/DayNav.vue'
import Calendar from './components/Calendar.vue'
import StatCard from './components/StatCard.vue'
import YearChart from './components/YearChart.vue'

const PLACE_KEY = 'place'
const DEFAULT_PLACE = { name: 'Salmon Arm, BC', lat: 50.7001, lon: -119.2723 }

function loadPlace() {
  try {
    return JSON.parse(localStorage.getItem(PLACE_KEY)) ?? DEFAULT_PLACE
  } catch {
    return DEFAULT_PLACE
  }
}

const place = ref(loadPlace())
watch(place, (p) => localStorage.setItem(PLACE_KEY, JSON.stringify(p)))

const selected = ref(today())
const { loading, error, rowsFor, reload } = useHistory(place)
const { forecast, error: forecastError } = useForecast(place)

const rows = computed(() => rowsFor(selected.value.month, selected.value.day))
const stats = computed(() => statsFor(rows.value))
const ready = computed(() => stats.value && !loading.value && !error.value)
</script>

<template>
  <main class="page">
    <header class="header">
      <h1>📍 {{ place.name }}</h1>
      <LocationSearch :name="place.name" @select="place = $event" />
    </header>

    <div class="grid">
      <Calendar :selected="selected" @select="selected = $event" />

      <div class="grid__main">
        <ForecastBar :forecast="forecast" :error="forecastError" :selected="selected" @select="selected = $event" />
        <DayNav :selected="selected" @step="selected = stepDay(selected, $event)" />

        <div v-if="ready" class="stats">
          <StatCard label="Record high">
            <p class="value is-high">{{ deg(stats.recordHigh.high) }}</p>
            <p class="sub">{{ stats.recordHigh.year }}</p>
          </StatCard>
          <StatCard label="Record low">
            <p class="value is-low">{{ deg(stats.recordLow.low) }}</p>
            <p class="sub">{{ stats.recordLow.year }}</p>
          </StatCard>
          <StatCard label="50-year average">
            <template v-if="stats.average">
              <p class="row"><span class="sub">High</span><span class="value is-high">{{ deg(stats.average.high) }}</span></p>
              <p class="row"><span class="sub">Low</span><span class="value is-low">{{ deg(stats.average.low) }}</span></p>
              <p class="sub">{{ stats.average.from }} – {{ stats.average.to }}</p>
            </template>
            <p v-else class="sub">Not enough data</p>
          </StatCard>
        </div>

        <div v-else class="card">
          <p v-if="loading" class="sub">Loading weather history… the first load for a location can take several seconds.</p>
          <template v-else-if="error">
            <p class="is-error">{{ error }}</p>
            <button class="btn" @click="reload">Retry</button>
          </template>
          <p v-else class="sub">No data for this day.</p>
        </div>
      </div>
    </div>

    <section v-if="ready" class="card chart">
      <div class="row">
        <h2>{{ formatDay(selected) }} · every year since {{ rows[0].year }}</h2>
        <p class="chart__legend sub">
          <span><i class="swatch swatch--high"></i>High</span>
          <span><i class="swatch swatch--low"></i>Low</span>
          <span><i class="swatch swatch--current"></i>This year</span>
          <span>- - - 50-yr average</span>
        </p>
      </div>
      <YearChart :rows="rows" :average="stats.average" />
    </section>

    <footer class="footer">Data: Open-Meteo · history from ERA5 reanalysis (most recent ~5 days not available yet), forecast from weather models</footer>
  </main>
</template>
