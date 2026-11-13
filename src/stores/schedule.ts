import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  addDaysToIso,
  dateRangeForWindow,
  groupEventsByDay,
  type CalendarInfo,
  type RawCalendarEvent,
} from '@/domain/schedule'
import { errorMessage } from '@/lib/errors'
import { user } from '@/lib/auth'
import {
  fetchCalendarEvents,
  fetchCalendars,
  requestCalendarToken,
  revokeCalendarToken,
} from '@/lib/googleCalendar'
import { useChoresStore } from './chores'
import { useHouseholdStore } from './household'

const SELECTED_KEY = 'plowman_schedule_calendars_v1'
const CACHE_KEY = 'plowman_schedule_cache_v1'
const CONNECTED_KEY = 'plowman_schedule_connected_v1'
const TOKEN_KEY = 'plowman_schedule_token_v1'

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export const useScheduleStore = defineStore('schedule', () => {
  const chores = useChoresStore()
  const household = useHouseholdStore()

  const cached = loadJson<{ calendars: CalendarInfo[]; events: RawCalendarEvent[] }>(CACHE_KEY, {
    calendars: [],
    events: [],
  })

  const savedToken = (() => {
    try {
      const raw = sessionStorage.getItem(TOKEN_KEY)
      return raw ? (JSON.parse(raw) as { accessToken: string; expiresAt: number }) : null
    } catch {
      return null
    }
  })()

  const accessToken = ref(savedToken?.accessToken ?? '')
  const tokenExpiresAt = ref(savedToken?.expiresAt ?? 0)
  const wasConnected = ref(loadJson<boolean>(CONNECTED_KEY, false))
  const calendars = ref<CalendarInfo[]>(cached.calendars)
  const selectedIds = ref<string[]>(loadJson<string[]>(SELECTED_KEY, []))
  const events = ref<RawCalendarEvent[]>(cached.events)
  const loading = ref(false)
  const error = ref('')
  const needsReconnect = ref(false)

  const startDate = ref('')
  const dayCount = ref<7 | 14>(7)

  let refreshTimer: ReturnType<typeof setTimeout> | undefined

  const effectiveStart = computed(() => startDate.value || chores.today)
  const days = computed(() => dateRangeForWindow(effectiveStart.value, dayCount.value))

  const scheduleDays = computed(() =>
    groupEventsByDay({
      events: events.value,
      days: days.value,
      todayIso: chores.today,
      timeZone: household.household.timezone || 'America/Vancouver',
    }),
  )

  const connected = computed(() => !!accessToken.value || wasConnected.value)

  function persistCache() {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ calendars: calendars.value, events: events.value }))
    } catch {
      // ignore storage quota errors
    }
  }

  function scheduleSilentRefresh() {
    clearTimeout(refreshTimer)
    const delay = Math.max(60_000, tokenExpiresAt.value - Date.now() - 5 * 60_000)
    refreshTimer = setTimeout(async () => {
      try {
        const tok = await requestCalendarToken(user.value?.email ?? undefined)
        accessToken.value = tok.accessToken
        tokenExpiresAt.value = tok.expiresAt
        sessionStorage.setItem(TOKEN_KEY, JSON.stringify(tok))
        needsReconnect.value = false
        scheduleSilentRefresh()
        await refresh()
      } catch {
        needsReconnect.value = true
      }
    }, delay)
  }

  async function ensureToken(): Promise<string> {
    if (accessToken.value && Date.now() < tokenExpiresAt.value - 60_000) {
      return accessToken.value
    }
    const tok = await requestCalendarToken(user.value?.email ?? undefined)
    accessToken.value = tok.accessToken
    tokenExpiresAt.value = tok.expiresAt
    sessionStorage.setItem(TOKEN_KEY, JSON.stringify(tok))
    wasConnected.value = true
    needsReconnect.value = false
    localStorage.setItem(CONNECTED_KEY, 'true')
    scheduleSilentRefresh()
    return tok.accessToken
  }

  async function connect() {
    error.value = ''
    loading.value = true
    try {
      await ensureToken()
      await refresh()
    } catch (e) {
      error.value = errorMessage(e)
    } finally {
      loading.value = false
    }
  }

  async function disconnect() {
    clearTimeout(refreshTimer)
    const tok = accessToken.value
    accessToken.value = ''
    tokenExpiresAt.value = 0
    wasConnected.value = false
    needsReconnect.value = false
    calendars.value = []
    events.value = []
    sessionStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(CONNECTED_KEY)
    localStorage.removeItem(CACHE_KEY)
    await revokeCalendarToken(tok).catch(() => {})
  }

  async function refresh() {
    if (!connected.value) return
    error.value = ''
    loading.value = true
    try {
      let token = await ensureToken()
      let list: CalendarInfo[]
      try {
        list = await fetchCalendars(token)
      } catch (e) {
        if ((e as Error).message.includes('401')) {
          accessToken.value = ''
          sessionStorage.removeItem(TOKEN_KEY)
          token = await ensureToken()
          list = await fetchCalendars(token)
        } else {
          throw e
        }
      }
      calendars.value = list

      if (!selectedIds.value.length && list.length) {
        const primary = list.find((c) => c.primary)?.id ?? list[0]!.id
        selectedIds.value = [primary]
        localStorage.setItem(SELECTED_KEY, JSON.stringify(selectedIds.value))
      }

      const active = list.filter((c) => selectedIds.value.includes(c.id))
      if (!active.length) {
        events.value = []
        persistCache()
        return
      }

      // Pad by +/- 1 day in ISO to cover timezone offsets cleanly.
      const timeMin = `${addDaysToIso(effectiveStart.value, -1)}T00:00:00Z`
      const timeMax = `${addDaysToIso(effectiveStart.value, dayCount.value + 1)}T23:59:59Z`
      events.value = await fetchCalendarEvents({ accessToken: token, calendars: active, timeMin, timeMax })
      persistCache()
    } catch (e) {
      const msg = errorMessage(e)
      if (msg === 'AUTH_EXPIRED' || msg.toLowerCase().includes('consent') || msg.toLowerCase().includes('popup')) {
        needsReconnect.value = true
      } else {
        error.value = msg
      }
    } finally {
      loading.value = false
    }
  }

  function toggleCalendar(id: string) {
    const next = selectedIds.value.includes(id)
      ? selectedIds.value.filter((x) => x !== id)
      : [...selectedIds.value, id]
    selectedIds.value = next
    localStorage.setItem(SELECTED_KEY, JSON.stringify(next))
    void refresh()
  }

  function shiftWindow(deltaDays: number) {
    startDate.value = addDaysToIso(effectiveStart.value, deltaDays)
    void refresh()
  }

  function resetToToday() {
    startDate.value = ''
    void refresh()
  }

  function setDayCount(count: 7 | 14) {
    dayCount.value = count
    void refresh()
  }

  return {
    connected,
    calendars,
    selectedIds,
    scheduleDays,
    effectiveStart,
    dayCount,
    loading,
    error,
    needsReconnect,
    connect,
    disconnect,
    refresh,
    toggleCalendar,
    shiftWindow,
    resetToToday,
    setDayCount,
  }
})
