<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { ScheduleEvent } from '@/domain/schedule'
import { useChoresStore } from '@/stores/chores'
import { useScheduleStore } from '@/stores/schedule'

const chores = useChoresStore()
const schedule = useScheduleStore()

const showCalendars = ref(false)
const expandedId = ref<string | null>(null)

onMounted(() => {
  if (schedule.connected) void schedule.refresh()
})

const rangeLabel = computed(() => {
  const days = schedule.scheduleDays
  if (!days.length) return ''
  const first = days[0]!.label
  const last = days[days.length - 1]!.label
  return `${first} – ${last}`
})

const isTodayWindow = computed(() => schedule.effectiveStart === chores.today)

function toggleExpand(id: string) {
  expandedId.value = expandedId.value === id ? null : id
}

function allDayEvents(events: ScheduleEvent[]): ScheduleEvent[] {
  return events.filter((e) => e.allDay)
}

function timedEvents(events: ScheduleEvent[]): ScheduleEvent[] {
  return events.filter((e) => !e.allDay)
}
</script>

<template>
  <main class="view">
    <header class="view__head">
      <div>
        <h1>Schedule</h1>
        <p class="sub">{{ rangeLabel }}</p>
      </div>
      <div v-if="schedule.connected" class="schedule-head-actions">
        <div class="schedule-range-toggle" role="group" aria-label="Days shown">
          <button
            class="btn btn--small"
            :class="{ 'is-selected': schedule.dayCount === 7 }"
            type="button"
            @click="schedule.setDayCount(7)"
          >
            7 days
          </button>
          <button
            class="btn btn--small"
            :class="{ 'is-selected': schedule.dayCount === 14 }"
            type="button"
            @click="schedule.setDayCount(14)"
          >
            14 days
          </button>
        </div>
        <button class="btn btn--small" type="button" @click="showCalendars = !showCalendars">
          Calendars ({{ schedule.selectedIds.length }})
        </button>
        <button class="btn btn--small" type="button" :disabled="schedule.loading" @click="schedule.refresh()">
          {{ schedule.loading ? 'Loading…' : 'Refresh' }}
        </button>
      </div>
    </header>

    <section v-if="!schedule.connected" class="card panel">
      <div class="panel__head">
        <h2>Connect Google Calendar</h2>
        <p class="sub">Read-only access to show your family's upcoming events starting from today.</p>
      </div>
      <div>
        <button class="btn btn--accent" type="button" :disabled="schedule.loading" @click="schedule.connect()">
          {{ schedule.loading ? 'Connecting…' : 'Connect Google Calendar' }}
        </button>
      </div>
      <p v-if="schedule.error" class="is-error">{{ schedule.error }}</p>
    </section>

    <template v-else>
      <div v-if="schedule.needsReconnect" class="card is-info schedule-reconnect">
        <p>Calendar session expired — showing cached events.</p>
        <button class="btn btn--small btn--accent" type="button" @click="schedule.connect()">Reconnect calendar</button>
      </div>

      <p v-if="schedule.error" class="card is-error">{{ schedule.error }}</p>

      <section v-if="showCalendars" class="card panel schedule-calendars">
        <div class="panel__head panel__head--row">
          <h2>Calendars</h2>
          <div class="schedule-head-actions">
            <button class="btn btn--small btn--danger" type="button" @click="schedule.disconnect()">Disconnect</button>
            <button class="btn btn--small" type="button" @click="showCalendars = false">Done</button>
          </div>
        </div>
        <div v-if="schedule.calendars.length" class="schedule-cal-list">
          <label v-for="cal in schedule.calendars" :key="cal.id" class="check schedule-cal-item">
            <input
              type="checkbox"
              :checked="schedule.selectedIds.includes(cal.id)"
              @change="schedule.toggleCalendar(cal.id)"
            />
            <span class="schedule-cal-dot" :style="{ background: cal.backgroundColor }"></span>
            <span>{{ cal.summary }}</span>
          </label>
        </div>
        <p v-else class="sub">No calendars loaded yet.</p>
      </section>

      <div class="schedule-nav">
        <button class="btn btn--small" type="button" @click="schedule.shiftWindow(-schedule.dayCount)">← Earlier</button>
        <button class="btn btn--small" :class="{ 'is-today': isTodayWindow }" type="button" @click="schedule.resetToToday()">
          Today
        </button>
        <button class="btn btn--small" type="button" @click="schedule.shiftWindow(schedule.dayCount)">Later →</button>
      </div>

      <ul class="schedule-rows">
        <li
          v-for="day in schedule.scheduleDays"
          :key="day.date"
          class="card schedule-day"
          :class="{ 'is-today': day.badge === 'Today' }"
        >
          <div class="schedule-day__head">
            <span v-if="day.badge" class="badge badge--accent">{{ day.badge }}</span>
            <strong>{{ day.label }}</strong>
            <div v-if="allDayEvents(day.events).length" class="schedule-day__all-day">
              <button
                v-for="ev in allDayEvents(day.events)"
                :key="ev.id"
                class="schedule-all-day-pill"
                :style="{ '--event-color': ev.color }"
                type="button"
                @click="toggleExpand(ev.id)"
              >
                <span class="schedule-cal-dot" :style="{ background: ev.color }" aria-hidden="true"></span>
                <span>{{ ev.title }}</span>
              </button>
            </div>
          </div>

          <p
            v-for="ev in allDayEvents(day.events).filter((e) => expandedId === e.id && e.description)"
            :key="`${ev.id}-desc`"
            class="sub schedule-event__desc"
          >
            {{ ev.description }}
          </p>

          <ul v-if="timedEvents(day.events).length" class="schedule-events">
            <li v-for="ev in timedEvents(day.events)" :key="ev.id">
              <button class="schedule-event" type="button" @click="toggleExpand(ev.id)">
                <span class="schedule-event__bar" :style="{ background: ev.color }" aria-hidden="true"></span>
                <span class="schedule-event__time">{{ ev.timeLabel }}</span>
                <span class="schedule-event__main">
                  <strong>{{ ev.title }}</strong>
                  <span v-if="ev.location" class="sub"> · {{ ev.location }}</span>
                </span>
              </button>
              <p v-if="expandedId === ev.id && ev.description" class="sub schedule-event__desc">
                {{ ev.description }}
              </p>
            </li>
          </ul>
          <p v-else-if="!day.events.length" class="sub schedule-day__empty">No events</p>
        </li>
      </ul>
    </template>
  </main>
</template>
