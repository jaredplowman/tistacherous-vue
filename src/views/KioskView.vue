<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useWakeLock } from '@/lib/wakeLock'
import { useChoresStore } from '@/stores/chores'
import { useHouseholdStore } from '@/stores/household'
import { useTasksStore } from '@/stores/tasks'
import { assigneeLabel, groupStates, targetLabel } from '@/domain/tasks'
import KidSummaryCard from '@/features/kids/components/KidSummaryCard.vue'

useWakeLock()

const household = useHouseholdStore()
const chores = useChoresStore()
const tasks = useTasksStore()
const now = ref(new Date())

// A wall display is for reference, so the adults' weekly routines are shown but not tickable here.
const routines = computed(() => groupStates(tasks.states).weekly)
const doneCount = computed(() => routines.value.filter((s) => s.done).length)

const timer = setInterval(() => (now.value = new Date()), 1000)
onBeforeUnmount(() => clearInterval(timer))

const time = () => now.value.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' })
const date = () => now.value.toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' })
</script>

<template>
  <header class="kiosk__head">
    <h1>{{ household.household.name }}</h1>
    <div class="kiosk__clock">
      <span class="kiosk__time">{{ time() }}</span>
      <span class="sub">{{ date() }}</span>
    </div>
  </header>

  <main>
    <p v-if="chores.error" class="card is-error">{{ chores.error }}</p>
    <div v-if="household.kids.length" class="kid-grid">
      <KidSummaryCard
        v-for="entry in chores.board"
        :key="entry.kid.id"
        :entry="entry"
        interactive
        large
        @toggle="chores.toggleInstance"
      />
    </div>
    <div v-else class="card empty">
      <p class="sub">No kids have been set up yet.</p>
    </div>

    <section v-if="routines.length" class="card panel routines" aria-labelledby="routines-title">
      <div class="panel__head panel__head--row">
        <h2 id="routines-title">Adult weekly chores</h2>
        <span class="sub">{{ doneCount }} of {{ routines.length }} done this week</span>
      </div>
      <ul class="routines__list">
        <li
          v-for="state in routines"
          :key="state.task.id"
          class="routine"
          :class="{ 'is-done': state.done, 'is-late': state.overdue }"
        >
          <span class="routine__box" aria-hidden="true">{{ state.done ? '✓' : '' }}</span>
          <span class="routine__title">{{ state.task.title }}</span>
          <span class="routine__meta sub">
            {{ targetLabel(state.task) }}<template v-if="state.overdue"> · late</template>
            · {{ assigneeLabel(state.task, household.members) }}
          </span>
        </li>
      </ul>
    </section>
  </main>
</template>
