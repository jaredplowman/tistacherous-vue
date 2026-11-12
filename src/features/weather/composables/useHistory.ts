import { ref, shallowRef, watch, type Ref } from 'vue'
import type { DayRow, DayStats, Place } from '../types'

const ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive'
const START_DATE = '1940-01-01'
const AVERAGE_YEARS = 50
const CACHE_PREFIX = 'history:'
const MAX_CACHED_PLACES = 4
// The latest days get revised by ERA5 after the fact, so refetch a short overlap.
const REFRESH_OVERLAP_DAYS = 14
const DAY_MS = 86_400_000

interface HistoryData {
  start: string
  end: string
  fetched: string
  high: (number | null)[]
  low: (number | null)[]
}

const pad = (n: number) => String(n).padStart(2, '0')
const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const toUtc = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}
const addDays = (iso: string, n: number) => new Date(toUtc(iso) + n * DAY_MS).toISOString().slice(0, 10)
const daysBetween = (a: string, b: string) => Math.round((toUtc(b) - toUtc(a)) / DAY_MS)
export const dayKey = (month: number, day: number) => month * 100 + day

const cacheKey = ({ lat, lon }: Place) => `${CACHE_PREFIX}${lat.toFixed(2)},${lon.toFixed(2)}`

function readCache(loc: Place): HistoryData | null {
  try {
    const cached = JSON.parse(localStorage.getItem(cacheKey(loc)) ?? 'null')
    return cached?.end ? cached : null
  } catch {
    return null
  }
}

// Each entry is a few hundred KB, so keep only the most recently fetched places.
function writeCache(loc: Place, data: HistoryData) {
  try {
    const others = Object.keys(localStorage)
      .filter((k) => k.startsWith(CACHE_PREFIX) && k !== cacheKey(loc))
      .map((k) => ({ k, fetched: JSON.parse(localStorage.getItem(k) ?? 'null')?.fetched ?? '' }))
      .sort((a, b) => b.fetched.localeCompare(a.fetched))
    others.slice(MAX_CACHED_PLACES - 1).forEach(({ k }) => localStorage.removeItem(k))
    localStorage.setItem(cacheKey(loc), JSON.stringify(data))
  } catch {
    // storage full or unavailable: the app still works, just refetches
  }
}

async function fetchRange(loc: Place, start: string, end: string) {
  const params = new URLSearchParams({
    latitude: String(loc.lat),
    longitude: String(loc.lon),
    start_date: start,
    end_date: end,
    daily: 'temperature_2m_max,temperature_2m_min',
    timezone: 'auto',
    models: 'era5',
  })
  const res = await fetch(`${ARCHIVE_URL}?${params}`)
  if (res.status === 429) throw new Error('Open-Meteo rate limit reached, try again in a minute')
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const { daily } = await res.json()
  return { high: daily.temperature_2m_max as (number | null)[], low: daily.temperature_2m_min as (number | null)[] }
}

// Full download once per place (large, and rate limited); afterwards only the recent tail.
async function loadHistory(loc: Place): Promise<HistoryData> {
  const today = isoDate(new Date())
  const cached = readCache(loc)
  if (cached?.fetched === today) return cached

  try {
    const from = cached ? addDays(cached.end, -REFRESH_OVERLAP_DAYS) : START_DATE
    const keep = cached ? daysBetween(cached.start, from) : 0
    const fresh = await fetchRange(loc, from, today)
    const data: HistoryData = {
      start: START_DATE,
      end: today,
      fetched: today,
      high: [...(cached?.high.slice(0, keep) ?? []), ...fresh.high],
      low: [...(cached?.low.slice(0, keep) ?? []), ...fresh.low],
    }
    writeCache(loc, data)
    return data
  } catch (e) {
    if (cached) return cached
    throw e
  }
}

// Daily values are consecutive from `start`, so dates are derived by index.
function indexByDay({ start, high, low }: HistoryData) {
  const [y, m, d] = start.split('-').map(Number)
  const byDay = new Map<number, DayRow[]>()
  for (let i = 0; i < high.length; i++) {
    const hi = high[i]
    const lo = low[i]
    if (hi == null || lo == null) continue
    const date = new Date(Date.UTC(y, m - 1, d + i))
    const key = dayKey(date.getUTCMonth() + 1, date.getUTCDate())
    if (!byDay.has(key)) byDay.set(key, [])
    byDay.get(key)!.push({ year: date.getUTCFullYear(), high: hi, low: lo })
  }
  return byDay
}

const mean = (rows: DayRow[], field: 'high' | 'low') => rows.reduce((sum, r) => sum + r[field], 0) / rows.length

export function statsFor(rows: DayRow[]): DayStats | null {
  if (!rows.length) return null
  const currentYear = new Date().getFullYear()
  const recent = rows.filter((r) => r.year < currentYear && r.year >= currentYear - AVERAGE_YEARS)
  return {
    recordHigh: rows.reduce((a, r) => (r.high > a.high ? r : a)),
    recordLow: rows.reduce((a, r) => (r.low < a.low ? r : a)),
    average: recent.length
      ? {
          high: mean(recent, 'high'),
          low: mean(recent, 'low'),
          from: recent[0].year,
          to: recent[recent.length - 1].year,
        }
      : null,
  }
}

export function useHistory(location: Ref<Place>) {
  const byDay = shallowRef(new Map<number, DayRow[]>())
  const loading = ref(false)
  const error = ref('')
  let requestId = 0

  async function load() {
    const id = ++requestId
    const loc = location.value
    loading.value = true
    error.value = ''
    try {
      const data = await loadHistory(loc)
      if (id !== requestId) return
      byDay.value = indexByDay(data)
    } catch (e) {
      if (id !== requestId) return
      error.value = `Couldn't fetch history: ${(e as Error).message}`
    } finally {
      if (id === requestId) loading.value = false
    }
  }

  watch(location, load, { immediate: true })

  const rowsFor = (month: number, day: number) => byDay.value.get(dayKey(month, day)) ?? []

  return { loading, error, rowsFor, reload: load }
}
