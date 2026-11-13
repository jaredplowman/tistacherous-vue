<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { member } from '@/lib/auth'
import { useBillsStore } from '@/stores/bills'
import { useChoresStore } from '@/stores/chores'
import { useTasksStore } from '@/stores/tasks'
import { attentionItems } from '@/domain/attention'
import { amountLabel, dueLabel, isOverdue } from '@/domain/bills'
import { sortStates, targetLabel } from '@/domain/tasks'
import { useForecast } from '@/features/weather/composables/useForecast'
import { usePlace } from '@/features/weather/composables/usePlace'
import { describe } from '@/features/weather/weather'
import { degWhole } from '@/features/weather/format'

const chores = useChoresStore()
const bills = useBillsStore()
const tasks = useTasksStore()
const place = usePlace()
const { forecast } = useForecast(place)

const now = new Date()
const hour = now.getHours()
const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
const dateLabel = now.toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' })

const GLANCE_LIMIT = 6

const myTasks = computed(() => sortStates(tasks.mine))
const billRows = computed(() => [...bills.soon, ...bills.inTransit])

const attention = computed(() =>
  attentionItems({
    audits: chores.auditQueue.length,
    billsOverdue: bills.toPay.filter((b) => isOverdue(b, chores.today)).length,
    billsSoon: bills.toPay.filter((b) => !isOverdue(b, chores.today)).length,
    billsInTransit: bills.inTransit.length,
    tasksLate: tasks.mine.filter((s) => s.overdue).length,
    tasksToday: tasks.mine.filter((s) => !s.overdue).length,
  }),
)

const weather = computed(() =>
  forecast.value ? { ...describe(forecast.value.now.code, forecast.value.now.isDay), temp: forecast.value.now.temp } : null,
)
</script>

<template>
  <main class="view today">
    <header class="view__head">
      <div class="today__greeting">
        <p class="label">{{ dateLabel }}</p>
        <h1>{{ greeting }}, {{ member?.displayName }}</h1>
      </div>
      <RouterLink class="weather-chip" to="/weather" title="Open weather">
        <template v-if="weather">
          <span class="weather-chip__icon" aria-hidden="true">{{ weather.icon }}</span>
          <span>{{ degWhole(weather.temp) }} · {{ weather.label }}</span>
        </template>
        <span v-else>Weather</span>
        <span class="weather-chip__place">{{ place.name }}</span>
      </RouterLink>
    </header>

    <section class="card panel" aria-labelledby="attention-title">
      <div class="panel__head">
        <h2 id="attention-title">Needs attention</h2>
      </div>
      <ul v-if="attention.length" class="attention">
        <li v-for="item in attention" :key="item.key">
          <RouterLink class="attention__item" :class="`attention__item--${item.tone}`" :to="item.to">
            {{ item.text }}
          </RouterLink>
        </li>
      </ul>
      <p v-else class="sub">Nothing needs you right now. 🎉</p>
    </section>

    <div class="today__cols">
      <section class="card panel" aria-labelledby="tasks-title">
        <div class="panel__head panel__head--row">
          <h2 id="tasks-title">My tasks today</h2>
          <RouterLink to="/tasks">All tasks</RouterLink>
        </div>
        <ul v-if="myTasks.length" class="list">
          <li v-for="state in myTasks.slice(0, GLANCE_LIMIT)" :key="state.task.id" class="row-card">
            <div class="row-card__main">
              <strong>{{ state.task.title }}</strong>
              <span class="sub" :class="{ 'is-neg': state.overdue }">
                {{ targetLabel(state.task) }}<template v-if="state.overdue"> · late</template>
              </span>
            </div>
            <button class="btn btn--small" type="button" @click="tasks.setDone(state.task, true)">Mark done</button>
          </li>
        </ul>
        <p v-else class="sub">Nothing due today. 🎉</p>
        <p v-if="myTasks.length > GLANCE_LIMIT" class="sub">
          +{{ myTasks.length - GLANCE_LIMIT }} more on <RouterLink to="/tasks">Tasks</RouterLink>
        </p>
        <p v-if="tasks.error" class="is-error">{{ tasks.error }}</p>
      </section>

      <section class="card panel" aria-labelledby="bills-title">
        <div class="panel__head panel__head--row">
          <h2 id="bills-title">Bills due soon</h2>
          <RouterLink to="/bills">All bills</RouterLink>
        </div>
        <ul v-if="billRows.length" class="list">
          <li v-for="bill in billRows.slice(0, GLANCE_LIMIT)" :key="bill.id" class="row-card">
            <div class="row-card__main">
              <strong>{{ bill.title }}</strong>
              <span v-if="bill.status === 'pending'" class="sub">Payment sent, waiting to clear</span>
              <span v-else class="sub" :class="{ 'is-neg': isOverdue(bill, chores.today) }">
                {{ dueLabel(bill, chores.today) }}<template v-if="bill.isAutopay"> · autopay</template>
              </span>
            </div>
            <span class="today__amount">{{ amountLabel(bill) }}</span>
          </li>
        </ul>
        <p v-else class="sub">No bills due this week. 🎉</p>
        <p v-if="billRows.length > GLANCE_LIMIT" class="sub">
          +{{ billRows.length - GLANCE_LIMIT }} more on <RouterLink to="/bills">Bills</RouterLink>
        </p>
      </section>
    </div>
  </main>
</template>
