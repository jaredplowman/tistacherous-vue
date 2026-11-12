import { ref, watch, onBeforeUnmount, type Ref } from 'vue'
import type { Forecast, Place } from '../types'

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast'
const FORECAST_DAYS = 6
const REFRESH_MS = 15 * 60 * 1000

export function useForecast(place: Ref<Place>) {
  const forecast = ref<Forecast | null>(null)
  const error = ref('')
  let requestId = 0

  async function load() {
    const id = ++requestId
    const params = new URLSearchParams({
      latitude: String(place.value.lat),
      longitude: String(place.value.lon),
      timezone: 'auto',
      forecast_days: String(FORECAST_DAYS),
      current: 'temperature_2m,apparent_temperature,weather_code,wind_speed_10m,is_day',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min',
    })
    try {
      const res = await fetch(`${FORECAST_URL}?${params}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const { current, daily } = await res.json()
      if (id !== requestId) return
      forecast.value = {
        now: {
          temp: current.temperature_2m,
          feels: current.apparent_temperature,
          wind: current.wind_speed_10m,
          code: current.weather_code,
          isDay: !!current.is_day,
          date: current.time.slice(0, 10),
        },
        days: daily.time.map((date: string, i: number) => ({
          date,
          code: daily.weather_code[i],
          high: daily.temperature_2m_max[i],
          low: daily.temperature_2m_min[i],
        })),
      }
      error.value = ''
    } catch (e) {
      if (id === requestId) error.value = `Couldn't fetch forecast: ${(e as Error).message}`
    }
  }

  watch(
    place,
    () => {
      forecast.value = null
      load()
    },
    { immediate: true },
  )

  const timer = setInterval(load, REFRESH_MS)
  onBeforeUnmount(() => clearInterval(timer))

  return { forecast, error }
}
