<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  TIER_HINTS,
  TIER_LABELS,
  filterStates,
  groupStates,
  nameOf,
  summarize,
  type TaskFields,
  type TaskFilter,
} from '@/domain/tasks'
import { useHouseholdStore } from '@/stores/household'
import { useTasksStore } from '@/stores/tasks'
import TaskForm from './TaskForm.vue'
import TaskTable from './TaskTable.vue'

const store = useTasksStore()
const household = useHouseholdStore()

const filter = ref<TaskFilter>('all')
const adding = ref(false)
const busy = ref(false)

const filters = computed(() => [
  { id: 'all', label: 'All tasks' },
  ...household.members.map((m) => ({ id: m.email, label: `${nameOf(m.email, household.members)}'s` })),
  { id: 'both', label: '👥 Two-person only' },
])

const groups = computed(() => groupStates(filterStates(store.states, filter.value)))
const summary = computed(() => summarize(groups.value))

async function create(fields: TaskFields) {
  busy.value = true
  const ok = await store.addTask(fields)
  busy.value = false
  if (ok) adding.value = false
}
</script>

<template>
  <section class="card panel" aria-labelledby="board-title">
    <div class="panel__head">
      <h2 id="board-title" class="sr-only">Task board</h2>
      <div class="chips" role="group" aria-label="View">
        <button
          v-for="item in filters"
          :key="item.id"
          class="chip"
          :class="{ 'is-on': filter === item.id }"
          type="button"
          :aria-pressed="filter === item.id"
          @click="filter = item.id"
        >
          {{ item.label }}
        </button>
      </div>
      <button v-if="!adding" class="btn btn--accent" type="button" @click="adding = true">Add task</button>
    </div>

    <p v-if="store.error" class="is-error">{{ store.error }}</p>

    <TaskForm
      v-if="adding"
      :members="household.members"
      :today="store.today"
      :busy="busy"
      @save="create"
      @cancel="adding = false"
    />

    <section class="bill-group" aria-labelledby="weekly-title">
      <h3 id="weekly-title" class="label">1. {{ TIER_LABELS.weekly }} ({{ groups.weekly.length }})</h3>
      <p class="sub">{{ TIER_HINTS.weekly }}</p>
      <TaskTable v-if="groups.weekly.length" :states="groups.weekly" target-heading="Target day" />
      <p v-else class="sub">No weekly routines{{ filter === 'all' ? ' yet' : ' for this view' }}.</p>
    </section>

    <section class="bill-group" aria-labelledby="short-title">
      <h3 id="short-title" class="label">2. {{ TIER_LABELS.short_term }} ({{ groups.shortTerm.length }})</h3>
      <p class="sub">{{ TIER_HINTS.short_term }}</p>
      <TaskTable v-if="groups.shortTerm.length" :states="groups.shortTerm" target-heading="Target date" />
      <p v-else class="sub">Nothing short-term{{ filter === 'all' ? '' : ' for this view' }}. 🎉</p>
    </section>

    <section class="bill-group" aria-labelledby="long-title">
      <h3 id="long-title" class="label">3. {{ TIER_LABELS.long_term }} ({{ groups.longTerm.length }})</h3>
      <p class="sub">{{ TIER_HINTS.long_term }}</p>
      <TaskTable v-if="groups.longTerm.length" :states="groups.longTerm" target-heading="Target window" />
      <p v-else class="sub">No long-term projects{{ filter === 'all' ? ' yet' : ' for this view' }}.</p>
    </section>

    <details v-if="groups.paused.length" class="bill-group">
      <summary class="label">Paused routines ({{ groups.paused.length }})</summary>
      <TaskTable :states="groups.paused" target-heading="Target day" />
    </details>

    <details v-if="groups.completed.length" class="bill-group">
      <summary class="label">Completed ({{ groups.completed.length }})</summary>
      <TaskTable :states="groups.completed" target-heading="Target" />
    </details>

    <p class="task-summary sub">
      Active: {{ summary.weekly }} weekly · {{ summary.shortTerm }} short-term · {{ summary.longTerm }} long-term
      ({{ summary.both }} need 👥 both)
    </p>
  </section>
</template>
