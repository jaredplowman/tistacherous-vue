<script setup lang="ts">
import { ref, computed } from 'vue'
import { useHistory, statsFor } from './composables/useHistory'
import { useForecast } from './composables/useForecast'
import { usePlace } from './composables/usePlace'
import { today, stepDay, formatDay } from './dates'
import { deg } from './format'
import LocationSearch from './components/LocationSearch.vue'
import ForecastBar from './components/ForecastBar.vue'
import DayNav from './components/DayNav.vue'
import Calendar from './components/Calendar.vue'
import StatCard from './components/StatCard.vue'
import YearChart from './components/YearChart.vue'
import './styles/weather.scss'

const place = usePlace()

const selected = ref(today())
const { loading, error, rowsFor, reload } = useHistory(place)
const { forecast, error: forecastError } = useForecast(place)

const rows = computed(() => rowsFor(selected.value.month, selected.value.day))
const stats = computed(() => statsFor(rows.value))
// the stats to show, or null while loading, failed, or empty
const ready = computed(() => (!loading.value && !error.value ? stats.value : null))
</script>

<template>
  <main class="weather">
    <div class="page">
      <header class="header">
        <div>
          <p class="label">Historical weather</p>
          <h1>📍 {{ place.name }}</h1>
        </div>
        <LocationSearch :name="place.name" @select="place = $event" />
      </header>

      <div class="grid">
        <Calendar :selected="selected" @select="selected = $event" />

        <div class="grid__main">
          <ForecastBar :forecast="forecast" :error="forecastError" :selected="selected" @select="selected = $event" />
          <DayNav :selected="selected" @step="selected = stepDay(selected, $event)" />

          <div v-if="ready" class="stats">
            <StatCard label="Record high">
              <p class="value is-high">{{ deg(ready.recordHigh.high) }}</p>
              <p class="sub">{{ ready.recordHigh.year }}</p>
            </StatCard>
            <StatCard label="Record low">
              <p class="value is-low">{{ deg(ready.recordLow.low) }}</p>
              <p class="sub">{{ ready.recordLow.year }}</p>
            </StatCard>
            <StatCard label="50-year average">
              <template v-if="ready.average">
                <p class="row"><span class="sub">High</span><span class="value is-high">{{ deg(ready.average.high) }}</span></p>
                <p class="row"><span class="sub">Low</span><span class="value is-low">{{ deg(ready.average.low) }}</span></p>
                <p class="sub">{{ ready.average.from }} – {{ ready.average.to }}</p>
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
        <YearChart :rows="rows" :average="ready.average" />
      </section>

      <footer class="footer">Data: Open-Meteo · history from ERA5 reanalysis (most recent ~5 days not available yet), forecast from weather models</footer>
    </div>
  </main>
</template>
